import {
  BLACKOUT_TRIGGER_TICKS,
  DEFAULT_ROAD_EDGE_CAPACITY,
  DISTRICT_BASE_COEFFICIENTS,
  FERRY_DOCK_RADIUS,
  FERRY_EFFICIENCY_BY_WEATHER,
  FIRE_STATION_SERVICE_RADIUS,
  GROWTH_CHECK_INTERVAL,
  HIGH_TRAFFIC_LOAD_THRESHOLD,
  MODERATE_CONGESTION_THRESHOLD,
  OVERLAY_PALETTE,
  PARK_SERVICE_RADIUS,
  SEVERE_CONGESTION_THRESHOLD,
  SIMULATION_UPDATE_ORDER,
  TICKS_PER_DAY,
  TICKS_PER_HOUR,
  TRAFFIC_COLLAPSE_RECOVERY_THRESHOLD,
  TRAFFIC_COLLAPSE_RECOVERY_TICKS,
  TRAFFIC_COLLAPSE_TRIGGER_TICKS,
  TRANSPORT_EDGE_SEARCH_RADIUS,
  TRAM_STOP_RADIUS,
  UTILITY_DEFAULTS,
  UTILITY_DEFICIT_MILD_THRESHOLD,
  UTILITY_DEFICIT_SEVERE_THRESHOLD,
  WEATHER_ATTRACTIVENESS_SHIFT,
  WEATHER_SATISFACTION_SHIFT,
  WEATHER_TRAFFIC_MULTIPLIER,
} from "./constants";
import type { PresentationState, SimConfig, SimulationKernel } from "./contracts";
import type {
  CameraState,
  DeficitSeverity,
  District,
  DistrictDemandScore,
  EditorAction,
  EventType,
  OverlayKind,
  RoadEdge,
  RoadNode,
  SavePayload,
  SimEvent,
  TileCoord,
  TimelineEntry,
  WeatherState,
  WorldState,
} from "../../types";
import { SAVE_SCHEMA_VERSION } from "../../types";
import { createInitialWorld as createGeneratedWorld } from "../../world/generation/createInitialWorld";
import { expandRectToTiles, getTile } from "../../world/terrain/terrain";
import {
  planTramLine,
  validateFerryDockPlacement,
  validateFerryRoute,
  validateRoadPlacement,
  validateUtilityPlacement,
  validateZonePlacement,
} from "./editing";

const WEATHER_DURATION_RANGES: Record<WeatherState, [number, number]> = {
  clear: [24, 72],
  cloudy: [24, 48],
  rain: [16, 40],
  storm: [12, 24],
  fog: [12, 24],
};

const WEATHER_TRANSITIONS: Record<WeatherState, Array<[WeatherState, number]>> = {
  clear: [
    ["clear", 0.26],
    ["cloudy", 0.42],
    ["rain", 0.14],
    ["fog", 0.14],
    ["storm", 0.04],
  ],
  cloudy: [
    ["clear", 0.28],
    ["cloudy", 0.28],
    ["rain", 0.22],
    ["fog", 0.14],
    ["storm", 0.08],
  ],
  rain: [
    ["clear", 0.16],
    ["cloudy", 0.34],
    ["rain", 0.22],
    ["fog", 0.1],
    ["storm", 0.18],
  ],
  storm: [
    ["clear", 0.24],
    ["cloudy", 0.42],
    ["rain", 0.2],
    ["fog", 0.12],
    ["storm", 0.02],
  ],
  fog: [
    ["clear", 0.32],
    ["cloudy", 0.32],
    ["rain", 0.14],
    ["fog", 0.18],
    ["storm", 0.04],
  ],
};

type TickContext = {
  pendingTimelineEntries: TimelineEntry[];
};

function cloneWorld(state: WorldState): WorldState {
  return structuredClone(state);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nextId(prefix: string, currentCount: number): string {
  return `${prefix}-${currentCount + 1}`;
}

function formatClockLabel(state: WorldState): string {
  const hour = `${state.clock.hour}`.padStart(2, "0");
  const minute = `${state.clock.minute}`.padStart(2, "0");
  return `Day ${state.clock.day} ${hour}:${minute}`;
}

function createNumberRng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomForTick(state: WorldState, salt: string): number {
  const rng = createNumberRng(hashString(`${state.metadata.seed}:${state.clock.tick}:${salt}`));
  return rng();
}

function nextWeatherState(current: WeatherState, tendencySeed: number, tick: number) {
  const rng = createNumberRng(tendencySeed ^ Math.imul(tick + 1, 1597334677));
  const roll = rng();
  let cursor = 0;
  const transitions = WEATHER_TRANSITIONS[current];

  for (const [state, weight] of transitions) {
    cursor += weight;
    if (roll <= cursor) {
      const [minDuration, maxDuration] = WEATHER_DURATION_RANGES[state];
      return {
        state,
        remainingTicks: minDuration + Math.floor(rng() * (maxDuration - minDuration + 1)),
      };
    }
  }

  return {
    state: current,
    remainingTicks: WEATHER_DURATION_RANGES[current][0],
  };
}

function advanceWeatherOneTick(state: WorldState): void {
  state.weather.remainingTicks -= 1;
  if (state.weather.remainingTicks > 0) {
    return;
  }

  const next = nextWeatherState(state.weather.state, state.weather.tendencySeed, state.clock.tick);
  state.weather.state = next.state;
  state.weather.remainingTicks = next.remainingTicks;
}

function computeDayProgress(state: WorldState): number {
  const totalMinutes = state.clock.hour * 60 + state.clock.minute;
  return totalMinutes / (24 * 60);
}

function resolveTramPath(state: WorldState, edgeIds: string[]): TileCoord[] {
  const path: TileCoord[] = [];

  for (const edgeId of edgeIds) {
    const edge = state.roadEdges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      continue;
    }

    for (const point of edge.path) {
      const lastPoint = path[path.length - 1];
      if (!lastPoint || lastPoint.x !== point.x || lastPoint.y !== point.y) {
        path.push(point);
      }
    }
  }

  return path;
}

function setDistrictOccupancy(state: WorldState, tiles: TileCoord[], districtId?: string): void {
  for (const coord of tiles) {
    const tile = getTile(state.terrain, coord.x, coord.y);
    if (tile) {
      tile.districtId = districtId;
    }
  }
}

function setUtilityOccupancy(state: WorldState, origin: TileCoord, width: number, height: number, utilityId?: string): void {
  const tiles = expandRectToTiles(origin, width, height);
  for (const coord of tiles) {
    const tile = getTile(state.terrain, coord.x, coord.y);
    if (tile) {
      tile.utilityId = utilityId;
    }
  }
}

function roadNodeMatches(node: RoadNode, coord: TileCoord): boolean {
  return node.x === coord.x && node.y === coord.y;
}

function getOrCreateRoadNode(state: WorldState, coord: TileCoord): RoadNode {
  const existingNode = state.roadNodes.find((node) => roadNodeMatches(node, coord));
  if (existingNode) {
    const terrainTile = getTile(state.terrain, coord.x, coord.y);
    if (terrainTile?.coastline) {
      existingNode.isCoastlineNode = true;
    }
    return existingNode;
  }

  const terrainTile = getTile(state.terrain, coord.x, coord.y);
  const node: RoadNode = {
    id: nextId("road-node", state.roadNodes.length),
    x: coord.x,
    y: coord.y,
    connectedEdgeIds: [],
    isCoastlineNode: terrainTile?.coastline ?? false,
  };
  state.roadNodes.push(node);
  return node;
}

function distanceBetween(a: TileCoord, b: TileCoord): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectCenter(rect: { x: number; y: number; width: number; height: number }): TileCoord {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function districtCenter(district: District): TileCoord {
  return rectCenter(district.footprint);
}

function utilityCenter(utility: WorldState["utilities"][number]): TileCoord {
  return rectCenter(utility.footprint);
}

function ferryEfficiencyForWeather(weather: WeatherState): number {
  return FERRY_EFFICIENCY_BY_WEATHER[weather];
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function removeEdgeReference(node: RoadNode | undefined, edgeId: string): void {
  if (!node) {
    return;
  }
  node.connectedEdgeIds = node.connectedEdgeIds.filter((candidate) => candidate !== edgeId);
}

function pruneUnusedRoadNodes(state: WorldState): void {
  const protectedNodeIds = new Set([
    ...state.tramStops.map((stop) => stop.nodeId),
    ...state.ferryDocks.map((dock) => dock.nodeId),
  ]);

  state.roadNodes = state.roadNodes.filter(
    (node) => node.connectedEdgeIds.length > 0 || protectedNodeIds.has(node.id),
  );
}

function levelMetrics(type: District["type"], level: District["level"]) {
  const base = DISTRICT_BASE_COEFFICIENTS[type];
  return {
    population: Math.round(base.population * level ** 1.5),
    jobs: Math.round(base.jobs * level ** 1.4),
    power: Math.round(base.power * level ** 1.4),
    water: Math.round(base.water * level ** 1.3),
    waste: Math.round(base.waste * level ** 1.3),
    transport: Math.round((base.population * level ** 1.5 + base.jobs * level ** 1.4) * 0.12),
  };
}

function createInitialDemandScore(): DistrictDemandScore {
  return {
    demand: 0,
    utility: 20,
    transport: 8,
    service: 0,
    attractiveness: 0,
    congestionPenalty: 0,
    eventPenalty: 0,
    growthScore: 28,
  };
}

function refreshDistrictLevelMetrics(district: District): void {
  const metrics = levelMetrics(district.type, district.level);
  district.population = metrics.population;
  district.jobs = metrics.jobs;
  district.powerDemand = metrics.power;
  district.waterDemand = metrics.water;
  district.wasteDemand = metrics.waste;
  district.transportDemand = metrics.transport;
}

function addTimelineEntry(
  state: WorldState,
  context: TickContext,
  type: TimelineEntry["type"],
  title: string,
  detail: string,
): void {
  context.pendingTimelineEntries.push({
    id: `timeline-${state.clock.tick}-${context.pendingTimelineEntries.length + 1}`,
    tick: state.clock.tick,
    type,
    title,
    detail,
  });
}

function activeEventsOfType(state: WorldState, type: EventType): SimEvent[] {
  return state.events.filter((event) => event.type === type && event.endTick > state.clock.tick);
}

function districtHasEvent(state: WorldState, district: District, type: EventType): boolean {
  return district.activeEventIds.some((eventId) => {
    const event = state.events.find((candidate) => candidate.id === eventId);
    return event?.type === type && event.endTick > state.clock.tick;
  });
}

function districtHasCoastline(state: WorldState, district: District): boolean {
  return district.tiles.some((coord) => getTile(state.terrain, coord.x, coord.y)?.coastline);
}

function nearestRoadEdges(state: WorldState, target: TileCoord, maxCount = 3): Array<{ edge: RoadEdge; distance: number }> {
  return state.roadEdges
    .map((edge) => ({
      edge,
      distance: Math.min(...edge.path.map((point) => distanceBetween(point, target))),
    }))
    .filter(({ distance }) => Number.isFinite(distance) && distance <= TRANSPORT_EDGE_SEARCH_RADIUS)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, maxCount);
}

function nearestDistanceToStops(state: WorldState, target: TileCoord): number | undefined {
  const distances = state.tramStops
    .map((stop) => state.roadNodes.find((node) => node.id === stop.nodeId))
    .filter((node): node is RoadNode => Boolean(node))
    .map((node) => distanceBetween(target, node));
  return distances.length > 0 ? Math.min(...distances) : undefined;
}

function nearestDistanceToDocks(state: WorldState, target: TileCoord): number | undefined {
  const activeDockIds = new Set(state.ferryRoutes.flatMap((route) => [route.dockAId, route.dockBId]));
  const distances = state.ferryDocks
    .filter((dock) => activeDockIds.has(dock.id))
    .map((dock) => distanceBetween(target, dock.position));
  return distances.length > 0 ? Math.min(...distances) : undefined;
}

function effectivePopulation(district: District): number {
  return district.population * district.operationalEfficiency;
}

function effectiveJobs(district: District): number {
  return district.jobs * district.operationalEfficiency;
}

function operationalEfficiencyForDistrict(state: WorldState, district: District): number {
  if (districtHasEvent(state, district, "fire")) {
    return 0;
  }
  if (
    districtHasEvent(state, district, "traffic_collapse") &&
    (district.type === "commercial" || district.type === "industrial")
  ) {
    return 0.55;
  }
  return 1;
}

function recalculateUtilitySnapshot(state: WorldState): void {
  const supply = {
    power: 0,
    water: 0,
    waste: 0,
  };
  const demand = {
    power: 0,
    water: 0,
    waste: 0,
  };

  for (const utility of state.utilities) {
    if (utility.type === "power_plant") {
      supply.power += utility.capacity ?? 0;
    } else if (utility.type === "water_tower") {
      supply.water += utility.capacity ?? 0;
    } else if (utility.type === "waste_center") {
      supply.waste += utility.capacity ?? 0;
    }
  }

  for (const district of state.districts) {
    demand.power += district.powerDemand;
    demand.water += district.waterDemand;
    demand.waste += district.wasteDemand;
  }

  state.utilitiesState = {
    power: {
      supply: supply.power,
      demand: demand.power,
      deficitRatio: demand.power > 0 ? Math.max(0, demand.power - supply.power) / demand.power : 0,
    },
    water: {
      supply: supply.water,
      demand: demand.water,
      deficitRatio: demand.water > 0 ? Math.max(0, demand.water - supply.water) / demand.water : 0,
    },
    waste: {
      supply: supply.waste,
      demand: demand.waste,
      deficitRatio: demand.waste > 0 ? Math.max(0, demand.waste - supply.waste) / demand.waste : 0,
    },
  };
}

function deficitSeverityFromRatio(ratio: number): DeficitSeverity {
  if (ratio >= UTILITY_DEFICIT_SEVERE_THRESHOLD) {
    return "severe";
  }
  if (ratio >= UTILITY_DEFICIT_MILD_THRESHOLD) {
    return "mild";
  }
  return "none";
}

function utilityScoreForState(state: WorldState): number {
  const severities = [
    deficitSeverityFromRatio(state.utilitiesState.power.deficitRatio),
    deficitSeverityFromRatio(state.utilitiesState.water.deficitRatio),
    deficitSeverityFromRatio(state.utilitiesState.waste.deficitRatio),
  ];
  if (severities.includes("severe")) {
    return -20;
  }
  if (severities.includes("mild")) {
    return 8;
  }
  return 20;
}

function congestionPenaltyFromAverage(value: number): number {
  if (value > SEVERE_CONGESTION_THRESHOLD) {
    return 16;
  }
  if (value >= MODERATE_CONGESTION_THRESHOLD) {
    return 8;
  }
  return 0;
}

function congestionSatisfactionPenalty(value: number): number {
  if (value > SEVERE_CONGESTION_THRESHOLD) {
    return 18;
  }
  if (value >= MODERATE_CONGESTION_THRESHOLD) {
    return 8;
  }
  return 0;
}

function serviceScoreForDistrict(state: WorldState, district: District): number {
  const covered = district.serviceCoverage.parkCoverage || district.serviceCoverage.fireCoverage;
  const distressed =
    district.congestionPenalty >= 16 ||
    districtHasEvent(state, district, "blackout") ||
    districtHasEvent(state, district, "fire") ||
    deficitSeverityFromRatio(state.utilitiesState.power.deficitRatio) === "severe" ||
    deficitSeverityFromRatio(state.utilitiesState.water.deficitRatio) === "severe";

  if (covered) {
    return 10;
  }
  if (distressed) {
    return -8;
  }
  return 0;
}

function transportScoreForDistrict(state: WorldState, district: District): number {
  const center = districtCenter(district);
  const nearbyEdges = nearestRoadEdges(state, center);
  const averageCongestion = mean(nearbyEdges.map(({ edge }) => edge.congestion));
  if (district.serviceCoverage.transportBonus >= 18 && averageCongestion < MODERATE_CONGESTION_THRESHOLD) {
    return 18;
  }
  if (district.serviceCoverage.transportBonus >= 8 || nearbyEdges.length > 0) {
    return 8;
  }
  return -12;
}

function demandScoreForDistrict(state: WorldState, district: District): number {
  const totalPopulation = state.districts.reduce((sum, candidate) => sum + effectivePopulation(candidate), 0);
  const totalJobs = state.districts.reduce((sum, candidate) => sum + effectiveJobs(candidate), 0);
  const residentialPopulation = state.districts
    .filter((candidate) => candidate.type === "residential")
    .reduce((sum, candidate) => sum + effectivePopulation(candidate), 0);
  const residentialAverageLevel = mean(
    state.districts.filter((candidate) => candidate.type === "residential").map((candidate) => candidate.level),
  );
  const averageSatisfaction = mean(state.districts.map((candidate) => candidate.satisfaction));
  const jobGap = (totalPopulation - totalJobs) / Math.max(1, totalPopulation + totalJobs);
  const logisticsPressure = clamp(state.traffic.averageCongestion * 18, 0, 12);

  let score = 0;
  switch (district.type) {
    case "residential":
      score = 10 + Math.max(0, (totalJobs - totalPopulation) / Math.max(1, totalJobs)) * 32;
      break;
    case "commercial":
      score = 6 + residentialPopulation / 180 + residentialAverageLevel * 3;
      break;
    case "industrial":
      score = 10 + Math.max(0, jobGap) * 26 + logisticsPressure;
      break;
    case "leisure":
      score = (state.districts.length > 5 ? 8 : 0) + Math.max(0, averageSatisfaction - 55) * 0.45;
      break;
    default:
      score = 0;
      break;
  }

  return Math.round(clamp(score, 0, 25));
}

function attractivenessScoreForDistrict(state: WorldState, district: District): { score: number; value: number } {
  const nearbyIndustryPenalty = state.districts.filter((candidate) => {
    if (candidate.id === district.id || candidate.type !== "industrial") {
      return false;
    }
    return distanceBetween(districtCenter(candidate), districtCenter(district)) <= 14;
  }).length;
  const hasCoast = districtHasCoastline(state, district);
  const parkBonus = district.serviceCoverage.parkCoverage ? 4 : 0;
  const coastBonus = hasCoast ? 4 : 0;
  const industryPenalty = nearbyIndustryPenalty > 0 && district.type !== "industrial" ? Math.min(8, nearbyIndustryPenalty * 3) : 0;
  const weatherPenalty = WEATHER_ATTRACTIVENESS_SHIFT[state.weather.state];
  const stormCoastPenalty = state.weather.state === "storm" && hasCoast ? 5 : 0;
  const score = clamp(
    Math.round(
      DISTRICT_BASE_COEFFICIENTS[district.type].attractivenessBias * 0.55 +
        parkBonus +
        coastBonus +
        district.serviceCoverage.islandConnectivityBonus * 0.5 -
        industryPenalty +
        weatherPenalty -
        stormCoastPenalty,
    ),
    -10,
    15,
  );

  const value = clamp(
    50 +
      DISTRICT_BASE_COEFFICIENTS[district.type].attractivenessBias +
      (district.serviceCoverage.parkCoverage ? 12 : 0) +
      (hasCoast ? 8 : 0) +
      district.serviceCoverage.islandConnectivityBonus -
      industryPenalty * 2 +
      weatherPenalty * 2 -
      stormCoastPenalty * 2,
    0,
    100,
  );

  return { score, value };
}

function recalculateGrowthScore(score: DistrictDemandScore): number {
  return clamp(
    score.demand + score.utility + score.transport + score.service + score.attractiveness - score.congestionPenalty - score.eventPenalty,
    0,
    100,
  );
}

function blackoutDistrictIds(state: WorldState, cause: "power" | "storm"): string[] {
  const ranked = [...state.districts].sort((left, right) => {
    const leftWeight = left.powerDemand + (districtHasCoastline(state, left) ? 8 : 0);
    const rightWeight = right.powerDemand + (districtHasCoastline(state, right) ? 8 : 0);
    return rightWeight - leftWeight;
  });
  const desiredCount =
    cause === "power"
      ? clamp(Math.round(state.districts.length * Math.max(0.25, state.utilitiesState.power.deficitRatio * 2.2)), 1, Math.max(1, state.districts.length))
      : clamp(Math.round(state.districts.length * 0.25), 1, Math.max(1, state.districts.length));
  return ranked.slice(0, desiredCount).map((district) => district.id);
}

function trafficCollapseDistrictIds(state: WorldState): string[] {
  return state.districts
    .filter((district) => district.type === "commercial" || district.type === "industrial")
    .filter((district) => district.congestionPenalty >= 16 || district.serviceCoverage.transportBonus <= 8)
    .map((district) => district.id);
}

function refreshDistrictEventLinks(state: WorldState): void {
  const activeEventIdsByDistrict = new Map<string, string[]>();
  for (const event of state.events) {
    if (event.endTick <= state.clock.tick) {
      continue;
    }
    for (const districtId of event.affectedDistrictIds) {
      const entries = activeEventIdsByDistrict.get(districtId) ?? [];
      entries.push(event.id);
      activeEventIdsByDistrict.set(districtId, entries);
    }
  }

  for (const district of state.districts) {
    district.activeEventIds = activeEventIdsByDistrict.get(district.id) ?? [];
  }
}

function updateEventState(state: WorldState, context: TickContext): void {
  for (const event of state.events) {
    if (event.type === "storm" && state.weather.state === "storm") {
      event.endTick = state.clock.tick + 1;
      event.affectedDistrictIds = state.districts.map((district) => district.id);
    }

    if (event.type === "blackout" && event.endTick > state.clock.tick) {
      const recovered = state.clock.tick - event.startTick >= 12 && state.utilitiesState.power.deficitRatio < UTILITY_DEFICIT_MILD_THRESHOLD;
      if (recovered) {
        event.endTick = Math.min(event.endTick, state.clock.tick + 1);
      }
    }

    if (event.type === "traffic_collapse" && event.endTick > state.clock.tick) {
      event.affectedDistrictIds = trafficCollapseDistrictIds(state);
      state.runtime.recoveredCongestionTicks =
        state.traffic.highTrafficAverageCongestion < TRAFFIC_COLLAPSE_RECOVERY_THRESHOLD
          ? state.runtime.recoveredCongestionTicks + 1
          : 0;
      if (state.runtime.recoveredCongestionTicks >= TRAFFIC_COLLAPSE_RECOVERY_TICKS) {
        event.endTick = Math.min(event.endTick, state.clock.tick + 1);
      }
    }
  }

  const beforeCount = state.events.length;
  const expiredEvents = state.events.filter((event) => event.endTick <= state.clock.tick);
  state.events = state.events.filter((event) => event.endTick > state.clock.tick);
  if (state.events.length !== beforeCount) {
    for (const event of expiredEvents) {
      addTimelineEntry(
        state,
        context,
        "system",
        `${event.type.replaceAll("_", " ")} resolved`,
        `Recovery completed for ${event.type.replaceAll("_", " ")} conditions.`,
      );
    }
  }

  let stormEvent = state.events.find((event) => event.type === "storm");
  if (state.weather.state === "storm") {
    if (!stormEvent) {
      stormEvent = {
        id: nextId("event", state.events.length),
        type: "storm",
        startTick: state.clock.tick,
        endTick: state.clock.tick + 1,
        affectedDistrictIds: state.districts.map((district) => district.id),
      };
      state.events.push(stormEvent);
      addTimelineEntry(state, context, "event", "Storm rolling in", "A storm front is reducing ferry efficiency and citywide satisfaction.");
    }
  }

  state.runtime.severePowerDeficitTicks =
    state.utilitiesState.power.deficitRatio >= UTILITY_DEFICIT_SEVERE_THRESHOLD
      ? state.runtime.severePowerDeficitTicks + 1
      : 0;
  state.runtime.highCongestionTicks =
    state.traffic.highTrafficAverageCongestion > SEVERE_CONGESTION_THRESHOLD
      ? state.runtime.highCongestionTicks + 1
      : 0;
  if (activeEventsOfType(state, "traffic_collapse").length === 0) {
    state.runtime.recoveredCongestionTicks = 0;
  }

  const activeBlackout = activeEventsOfType(state, "blackout")[0];
  const stormBlackoutChance =
    state.weather.state === "storm" ? 0.035 + state.utilitiesState.power.deficitRatio * 0.18 : 0;
  if (
    !activeBlackout &&
    (state.runtime.severePowerDeficitTicks >= BLACKOUT_TRIGGER_TICKS ||
      randomForTick(state, "storm-blackout") < stormBlackoutChance)
  ) {
    const cause =
      state.runtime.severePowerDeficitTicks >= BLACKOUT_TRIGGER_TICKS ? "power" : "storm";
    const blackout = {
      id: nextId("event", state.events.length),
      type: "blackout" as const,
      startTick: state.clock.tick,
      endTick: state.clock.tick + 12 + Math.floor(randomForTick(state, "blackout-duration") * 25),
      affectedDistrictIds: blackoutDistrictIds(state, cause),
    };
    state.events.push(blackout);
    addTimelineEntry(
      state,
      context,
      "event",
      "Blackout",
      cause === "power"
        ? "Power deficit crossed the severe threshold and darkened part of the island."
        : "Storm pressure tripped a rolling blackout across exposed districts.",
    );
  }

  if (
    activeEventsOfType(state, "traffic_collapse").length === 0 &&
    state.runtime.highCongestionTicks >= TRAFFIC_COLLAPSE_TRIGGER_TICKS
  ) {
    state.events.push({
      id: nextId("event", state.events.length),
      type: "traffic_collapse",
      startTick: state.clock.tick,
      endTick: state.clock.tick + 10_000,
      affectedDistrictIds: trafficCollapseDistrictIds(state),
    });
    state.runtime.recoveredCongestionTicks = 0;
    addTimelineEntry(
      state,
      context,
      "event",
      "Traffic collapse",
      "High-traffic road edges have remained jammed long enough to degrade commercial and industrial flow.",
    );
  }

  const activeFireDistrictIds = new Set(activeEventsOfType(state, "fire").flatMap((event) => event.affectedDistrictIds));
  let spawnedFire = false;
  for (const district of state.districts) {
    if (spawnedFire || activeFireDistrictIds.has(district.id)) {
      continue;
    }
    const overloadChance =
      district.type === "industrial" &&
      (district.congestionPenalty >= 16 ||
        state.utilitiesState.power.deficitRatio >= UTILITY_DEFICIT_SEVERE_THRESHOLD ||
        state.utilitiesState.waste.deficitRatio >= UTILITY_DEFICIT_SEVERE_THRESHOLD)
        ? 0.022
        : 0;
    const stormElectricalChance = state.weather.state === "storm" ? 0.006 : 0;
    const baselineChance = 0.0008;
    const coverageMultiplier = district.serviceCoverage.fireCoverage ? 0.55 : 1;
    const fireChance = (baselineChance + overloadChance + stormElectricalChance) * coverageMultiplier;
    if (randomForTick(state, `fire:${district.id}`) >= fireChance) {
      continue;
    }

    const minDuration = district.serviceCoverage.fireCoverage ? 8 : 16;
    const maxDuration = district.serviceCoverage.fireCoverage ? 16 : 32;
    state.events.push({
      id: nextId("event", state.events.length),
      type: "fire",
      startTick: state.clock.tick,
      endTick: state.clock.tick + minDuration + Math.floor(randomForTick(state, `fire-duration:${district.id}`) * (maxDuration - minDuration + 1)),
      affectedDistrictIds: [district.id],
    });
    addTimelineEntry(
      state,
      context,
      "event",
      "Fire",
      `${district.type.replaceAll("_", " ")} district ${district.id} is burning and has lost operational efficiency.`,
    );
    spawnedFire = true;
  }

  refreshDistrictEventLinks(state);
}

function recalculateDistrictDemands(state: WorldState): void {
  for (const district of state.districts) {
    refreshDistrictLevelMetrics(district);
    district.operationalEfficiency = operationalEfficiencyForDistrict(state, district);
    district.transportDemand = Math.round(district.transportDemand * district.operationalEfficiency);
  }
  recalculateUtilitySnapshot(state);
}

function computeTransportLoads(state: WorldState): void {
  for (const edge of state.roadEdges) {
    edge.load = 0;
  }

  for (const district of state.districts) {
    const center = districtCenter(district);
    const nearbyEdges = nearestRoadEdges(state, center);
    if (nearbyEdges.length === 0) {
      district.congestionPenalty = 16;
      continue;
    }

    const tramDistance = nearestDistanceToStops(state, center);
    const ferryDistance = nearestDistanceToDocks(state, center);
    const tramBonus = tramDistance !== undefined && tramDistance <= TRAM_STOP_RADIUS ? 18 : 0;
    const ferryBonus = ferryDistance !== undefined && ferryDistance <= FERRY_DOCK_RADIUS ? 14 : 0;
    const reliefFactor = clamp(1 - (tramBonus + ferryBonus) / 70, 0.45, 1);
    const weatherMultiplier = WEATHER_TRAFFIC_MULTIPLIER[state.weather.state];
    const totalLoad = district.transportDemand * reliefFactor * weatherMultiplier;
    const weights = nearbyEdges.map(({ distance }) => 1 / Math.max(1, distance));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

    nearbyEdges.forEach(({ edge }, index) => {
      edge.load += totalLoad * (weights[index] ?? 0) / Math.max(1, weightSum);
    });
  }

  for (const edge of state.roadEdges) {
    edge.capacity = edge.capacity || DEFAULT_ROAD_EDGE_CAPACITY;
    edge.congestion = edge.capacity > 0 ? edge.load / edge.capacity : 0;
  }

  const highTrafficEdges = state.roadEdges.filter((edge) => edge.load >= edge.capacity * HIGH_TRAFFIC_LOAD_THRESHOLD);
  state.traffic = {
    averageCongestion: mean(state.roadEdges.map((edge) => edge.congestion)),
    highTrafficAverageCongestion: mean(highTrafficEdges.map((edge) => edge.congestion)),
    severeEdgeIds: state.roadEdges.filter((edge) => edge.congestion > SEVERE_CONGESTION_THRESHOLD).map((edge) => edge.id),
  };

  for (const district of state.districts) {
    const center = districtCenter(district);
    const nearbyEdges = nearestRoadEdges(state, center);
    district.congestionPenalty = congestionPenaltyFromAverage(mean(nearbyEdges.map(({ edge }) => edge.congestion)));
  }
}

function computeServiceCoverage(state: WorldState): void {
  const ferryEfficiency = ferryEfficiencyForWeather(state.weather.state);
  for (const district of state.districts) {
    const center = districtCenter(district);
    const parkCoverage = state.utilities
      .filter((utility) => utility.type === "park")
      .some((utility) => distanceBetween(center, utilityCenter(utility)) <= PARK_SERVICE_RADIUS);
    const fireCoverage = state.utilities
      .filter((utility) => utility.type === "fire_station")
      .some((utility) => distanceBetween(center, utilityCenter(utility)) <= FIRE_STATION_SERVICE_RADIUS);
    const tramCoverage = (nearestDistanceToStops(state, center) ?? Number.POSITIVE_INFINITY) <= TRAM_STOP_RADIUS;
    const ferryCoverage = (nearestDistanceToDocks(state, center) ?? Number.POSITIVE_INFINITY) <= FERRY_DOCK_RADIUS;
    const remoteDistrict = distanceBetween(center, { x: 64, y: 64 }) > 20;

    district.serviceCoverage = {
      parkCoverage,
      fireCoverage,
      transportBonus: (tramCoverage ? 18 : 0) + (ferryCoverage ? Math.round(14 * ferryEfficiency) : 0),
      islandConnectivityBonus: ferryCoverage && remoteDistrict ? 10 : 0,
    };
  }
}

function computeAttractivenessAndSatisfaction(state: WorldState): void {
  const utilityScore = utilityScoreForState(state);

  for (const district of state.districts) {
    const demand = demandScoreForDistrict(state, district);
    const transport = transportScoreForDistrict(state, district);
    const service = serviceScoreForDistrict(state, district);
    const attractiveness = attractivenessScoreForDistrict(state, district);
    const satisfaction = clamp(
      54 +
        district.level * 3 +
        (district.serviceCoverage.parkCoverage ? 6 : 0) +
        (district.serviceCoverage.fireCoverage ? 2 : 0) +
        attractiveness.score -
        congestionSatisfactionPenalty(mean(nearestRoadEdges(state, districtCenter(district)).map(({ edge }) => edge.congestion))) +
        WEATHER_SATISFACTION_SHIFT[state.weather.state],
      0,
      100,
    );

    district.attractiveness = attractiveness.value;
    district.satisfaction = satisfaction;
    district.serviceScore = clamp(50 + service * 4, 0, 100);
    district.demandScore = {
      demand,
      utility: utilityScore,
      transport,
      service,
      attractiveness: attractiveness.score,
      congestionPenalty: district.congestionPenalty,
      eventPenalty: 0,
      growthScore: 0,
    };
    district.demandScore.growthScore = recalculateGrowthScore(district.demandScore);
  }
}

function applyEventPenalties(state: WorldState): void {
  for (const district of state.districts) {
    let eventPenalty = 0;
    let satisfactionPenalty = 0;

    if (state.weather.state === "storm") {
      eventPenalty += 8;
      satisfactionPenalty += 5;
    }
    if (districtHasEvent(state, district, "blackout")) {
      eventPenalty += 18;
      satisfactionPenalty += 20;
    }
    if (districtHasEvent(state, district, "traffic_collapse")) {
      eventPenalty += 15;
      satisfactionPenalty += 10;
    }
    if (districtHasEvent(state, district, "fire")) {
      eventPenalty += 25;
      satisfactionPenalty += 24;
    }

    district.satisfaction = clamp(district.satisfaction - satisfactionPenalty, 0, 100);
    district.demandScore.eventPenalty = eventPenalty;
    district.demandScore.growthScore = recalculateGrowthScore(district.demandScore);
  }
}

function applyUtilityDeficits(state: WorldState): void {
  const power = deficitSeverityFromRatio(state.utilitiesState.power.deficitRatio);
  const water = deficitSeverityFromRatio(state.utilitiesState.water.deficitRatio);
  const waste = deficitSeverityFromRatio(state.utilitiesState.waste.deficitRatio);

  for (const district of state.districts) {
    district.deficits = { power, water, waste };
    const penalty =
      (power === "severe" ? 14 : power === "mild" ? 6 : 0) +
      (water === "severe" ? 18 : water === "mild" ? 8 : 0) +
      (waste === "severe" ? 12 : waste === "mild" ? 5 : 0);
    district.satisfaction = clamp(district.satisfaction - penalty, 0, 100);
    district.demandScore.utility = utilityScoreForState(state);
    district.demandScore.growthScore = recalculateGrowthScore(district.demandScore);
  }
}

function updateGrowthDecline(state: WorldState, context: TickContext): void {
  if (state.clock.tick % GROWTH_CHECK_INTERVAL !== 0) {
    return;
  }

  for (const district of state.districts) {
    const frozen =
      district.deficits.power === "severe" ||
      district.deficits.water === "severe" ||
      districtHasEvent(state, district, "blackout") ||
      districtHasEvent(state, district, "fire");

    if (district.demandScore.growthScore >= 60) {
      if (!frozen) {
        district.growthProgress = clamp(district.growthProgress + 1, -4, 4);
      }
    } else if (district.demandScore.growthScore <= 40) {
      district.growthProgress = clamp(district.growthProgress - 1, -4, 4);
    } else if (district.growthProgress > 0) {
      district.growthProgress -= 1;
    } else if (district.growthProgress < 0) {
      district.growthProgress += 1;
    }

    if (district.growthProgress >= 4) {
      if (district.level < 5) {
        district.level = (district.level + 1) as District["level"];
        refreshDistrictLevelMetrics(district);
        addTimelineEntry(
          state,
          context,
          "system",
          "District growth",
          `${district.type.replaceAll("_", " ")} district ${district.id} advanced to level ${district.level}.`,
        );
      }
      district.growthProgress = 0;
    } else if (district.growthProgress <= -4) {
      if (district.level > 1) {
        district.level = (district.level - 1) as District["level"];
        refreshDistrictLevelMetrics(district);
        addTimelineEntry(
          state,
          context,
          "system",
          "District decline",
          `${district.type.replaceAll("_", " ")} district ${district.id} fell to level ${district.level}.`,
        );
      }
      district.growthProgress = 0;
    }
  }
}

function updateActorTargets(state: WorldState, config: SimConfig): void {
  const timelapseScale = config.speed >= 32 ? 0.65 : 1;
  const highLoadEdges = state.roadEdges.filter((edge) => edge.load > edge.capacity * 0.45);
  const collapseBoost = activeEventsOfType(state, "traffic_collapse").length > 0 ? 4 : 0;

  state.actorTargets = {
    cars: Math.round(clamp((state.districts.length * 0.5 + highLoadEdges.length * 2 + collapseBoost) * timelapseScale, 6, 28)),
    trams: state.tramLines.length === 0 ? 0 : Math.max(1, Math.round(state.tramLines.length * timelapseScale)),
    ferries: state.ferryRoutes.length === 0 ? 0 : Math.max(1, Math.round(state.ferryRoutes.length * timelapseScale)),
  };
}

function finalizeTimeline(state: WorldState, context: TickContext): void {
  if (state.clock.tick % TICKS_PER_DAY === 0) {
    context.pendingTimelineEntries.push({
      id: `timeline-${state.clock.tick}-day`,
      tick: state.clock.tick,
      type: "system",
      title: `Day ${state.clock.day}`,
      detail: `Satisfaction ${mean(state.districts.map((district) => district.satisfaction)).toFixed(0)}%, congestion ${(state.traffic.averageCongestion * 100).toFixed(0)}%.`,
    });
  }

  if (context.pendingTimelineEntries.length === 0) {
    return;
  }

  state.timeline = [...state.timeline, ...context.pendingTimelineEntries].slice(-32);
}

function updateClock(state: WorldState): void {
  const totalTicks = state.clock.tick + 1;
  const day = Math.floor(totalTicks / TICKS_PER_DAY) + 1;
  const dayTick = totalTicks % TICKS_PER_DAY;
  state.clock = {
    tick: totalTicks,
    day,
    hour: Math.floor(dayTick / TICKS_PER_HOUR),
    minute: (dayTick % TICKS_PER_HOUR) * 15,
  };
}

function runSingleTick(state: WorldState, config: SimConfig): void {
  const context: TickContext = {
    pendingTimelineEntries: [],
  };

  for (const stage of SIMULATION_UPDATE_ORDER) {
    switch (stage) {
      case "advance_clock":
        updateClock(state);
        break;
      case "update_weather":
        advanceWeatherOneTick(state);
        break;
      case "update_events":
        updateEventState(state, context);
        break;
      case "recalculate_utility_capacity":
        recalculateUtilitySnapshot(state);
        break;
      case "recalculate_district_demands":
        recalculateDistrictDemands(state);
        break;
      case "compute_transport_loads":
        computeTransportLoads(state);
        break;
      case "compute_service_coverage":
        computeServiceCoverage(state);
        break;
      case "compute_attractiveness_and_satisfaction":
        computeAttractivenessAndSatisfaction(state);
        break;
      case "apply_event_penalties":
        applyEventPenalties(state);
        break;
      case "apply_utility_deficits":
        applyUtilityDeficits(state);
        break;
      case "update_growth_decline":
        updateGrowthDecline(state, context);
        break;
      case "update_actor_targets":
        updateActorTargets(state, config);
        break;
      case "update_timeline":
        finalizeTimeline(state, context);
        break;
      default:
        break;
    }
  }
}

function applyBuildZone(state: WorldState, action: Extract<EditorAction, { type: "build_zone" }>): WorldState {
  const validation = validateZonePlacement(state, action.rect, action.districtType);
  if (!validation.valid) {
    return state;
  }
  const tiles = expandRectToTiles(action.rect, action.rect.width, action.rect.height);
  if (tiles.length === 0) {
    return state;
  }

  const districtLevel = 1 as const;
  const districtId = nextId("district", state.districts.length);
  const metrics = levelMetrics(action.districtType, districtLevel);
  state.districts.push({
    id: districtId,
    type: action.districtType,
    footprint: action.rect,
    tiles,
    level: districtLevel,
    population: metrics.population,
    jobs: metrics.jobs,
    satisfaction: 50,
    attractiveness: 50,
    powerDemand: metrics.power,
    waterDemand: metrics.water,
    wasteDemand: metrics.waste,
    transportDemand: metrics.transport,
    serviceScore: 0,
    growthProgress: 0,
    activeEventIds: [],
    operationalEfficiency: 1,
    serviceCoverage: {
      parkCoverage: false,
      fireCoverage: false,
      transportBonus: 0,
      islandConnectivityBonus: 0,
    },
    deficits: {
      power: "none",
      water: "none",
      waste: "none",
    },
    congestionPenalty: 0,
    demandScore: createInitialDemandScore(),
  });
  setDistrictOccupancy(state, tiles, districtId);
  recalculateUtilitySnapshot(state);

  return state;
}

function applyPlaceUtility(state: WorldState, action: Extract<EditorAction, { type: "place_utility" }>): WorldState {
  const validation = validateUtilityPlacement(state, action.utilityType, action.origin);
  if (!validation.valid) {
    return state;
  }
  const defaults = UTILITY_DEFAULTS[action.utilityType];
  const utilityId = nextId("utility", state.utilities.length);
  state.utilities.push({
    id: utilityId,
    type: action.utilityType,
    footprint: { x: action.origin.x, y: action.origin.y, width: defaults.width, height: defaults.height },
    capacity: defaults.capacity,
    serviceRadius: defaults.serviceRadius,
  });
  setUtilityOccupancy(state, action.origin, defaults.width, defaults.height, utilityId);
  recalculateUtilitySnapshot(state);
  return state;
}

function applyBuildRoad(state: WorldState, action: Extract<EditorAction, { type: "build_road" }>): WorldState {
  const validation = validateRoadPlacement(state, action.path);
  if (!validation.valid || action.path.length < 2) {
    return state;
  }

  const first = action.path[0];
  const last = action.path[action.path.length - 1];
  if (!first || !last) {
    return state;
  }

  const fromNode = getOrCreateRoadNode(state, first);
  const toNode = getOrCreateRoadNode(state, last);
  if (fromNode.id === toNode.id) {
    return state;
  }

  const edgeId = nextId("road-edge", state.roadEdges.length);
  state.roadEdges.push({
    id: edgeId,
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    path: action.path,
    length: action.path.length,
    capacity: DEFAULT_ROAD_EDGE_CAPACITY,
    load: 0,
    congestion: 0,
  });
  if (!fromNode.connectedEdgeIds.includes(edgeId)) {
    fromNode.connectedEdgeIds.push(edgeId);
  }
  if (!toNode.connectedEdgeIds.includes(edgeId)) {
    toNode.connectedEdgeIds.push(edgeId);
  }
  return state;
}

function applyPlaceTramStop(
  state: WorldState,
  action: Extract<EditorAction, { type: "place_tram_stop" }>,
): WorldState {
  const node = state.roadNodes.find((candidate) => candidate.id === action.nodeId);
  if (!node || state.tramStops.some((stop) => stop.nodeId === action.nodeId)) {
    return state;
  }
  state.tramStops.push({
    id: nextId("tram-stop", state.tramStops.length),
    nodeId: action.nodeId,
  });
  return state;
}

function applyBuildTram(state: WorldState, action: Extract<EditorAction, { type: "build_tram" }>): WorldState {
  if (action.stopIds.length < 2) {
    return state;
  }
  const allStopsExist = action.stopIds.every((stopId) => state.tramStops.some((stop) => stop.id === stopId));
  const allEdgesExist = action.edgeIds.every((edgeId) => state.roadEdges.some((edge) => edge.id === edgeId));
  if (!allStopsExist || !allEdgesExist) {
    return state;
  }
  const nodeIds = action.stopIds
    .map((stopId) => state.tramStops.find((stop) => stop.id === stopId)?.nodeId)
    .filter((nodeId): nodeId is string => Boolean(nodeId));
  const plannedLine = planTramLine(state, nodeIds);
  if (
    !plannedLine.valid ||
    plannedLine.edgeIds.length !== action.edgeIds.length ||
    plannedLine.edgeIds.some((edgeId, index) => action.edgeIds[index] !== edgeId)
  ) {
    return state;
  }
  state.tramLines.push({
    id: nextId("tram-line", state.tramLines.length),
    stopIds: action.stopIds,
    edgeIds: action.edgeIds,
    lineFrequency: 1,
    capacityContribution: 18,
  });
  return state;
}

function applyPlaceFerryDock(
  state: WorldState,
  action: Extract<EditorAction, { type: "place_ferry_dock" }>,
): WorldState {
  const validation = validateFerryDockPlacement(state, action.nodeId);
  if (!validation.valid) {
    return state;
  }
  const node = state.roadNodes.find((candidate) => candidate.id === action.nodeId);
  if (!node) {
    return state;
  }
  state.ferryDocks.push({
    id: nextId("ferry-dock", state.ferryDocks.length),
    nodeId: node.id,
    position: { x: node.x, y: node.y },
  });
  return state;
}

function applyBuildFerry(state: WorldState, action: Extract<EditorAction, { type: "build_ferry" }>): WorldState {
  const validation = validateFerryRoute(state, action.dockIds);
  if (!validation.valid) {
    return state;
  }
  const [dockAId, dockBId] = action.dockIds;
  const dockA = state.ferryDocks.find((dock) => dock.id === dockAId);
  const dockB = state.ferryDocks.find((dock) => dock.id === dockBId);
  if (!dockA || !dockB) {
    return state;
  }
  state.ferryRoutes.push({
    id: nextId("ferry-route", state.ferryRoutes.length),
    dockAId: dockA.id,
    dockBId: dockB.id,
    length: distanceBetween(dockA.position, dockB.position),
    fixedFrequency: 1,
    capacityContribution: 14,
  });
  return state;
}

function applyDemolish(state: WorldState, action: Extract<EditorAction, { type: "demolish_entity" }>): WorldState {
  switch (action.entityKind) {
    case "district": {
      const district = state.districts.find((candidate) => candidate.id === action.entityId);
      if (!district) {
        return state;
      }
      setDistrictOccupancy(state, district.tiles, undefined);
      state.districts = state.districts.filter((candidate) => candidate.id !== action.entityId);
      recalculateUtilitySnapshot(state);
      return state;
    }
    case "utility": {
      const utility = state.utilities.find((candidate) => candidate.id === action.entityId);
      if (!utility) {
        return state;
      }
      setUtilityOccupancy(
        state,
        { x: utility.footprint.x, y: utility.footprint.y },
        utility.footprint.width,
        utility.footprint.height,
        undefined,
      );
      state.utilities = state.utilities.filter((candidate) => candidate.id !== action.entityId);
      recalculateUtilitySnapshot(state);
      return state;
    }
    case "road_edge": {
      const edge = state.roadEdges.find((candidate) => candidate.id === action.entityId);
      if (!edge) {
        return state;
      }
      removeEdgeReference(state.roadNodes.find((node) => node.id === edge.fromNodeId), edge.id);
      removeEdgeReference(state.roadNodes.find((node) => node.id === edge.toNodeId), edge.id);
      state.roadEdges = state.roadEdges.filter((candidate) => candidate.id !== action.entityId);
      pruneUnusedRoadNodes(state);
      return state;
    }
    case "tram_line":
      state.tramLines = state.tramLines.filter((line) => line.id !== action.entityId);
      return state;
    case "ferry_dock":
      state.ferryRoutes = state.ferryRoutes.filter(
        (route) => route.dockAId !== action.entityId && route.dockBId !== action.entityId,
      );
      state.ferryDocks = state.ferryDocks.filter((dock) => dock.id !== action.entityId);
      return state;
    case "ferry_route":
      state.ferryRoutes = state.ferryRoutes.filter((route) => route.id !== action.entityId);
      return state;
    default:
      return state;
  }
}

function deficitStressValue(deficit: District["deficits"]["power"]): number {
  switch (deficit) {
    case "severe":
      return 1;
    case "mild":
      return 0.5;
    case "none":
    default:
      return 0;
  }
}

export const simulationKernel: SimulationKernel = {
  createInitialWorld(seed: string) {
    return createGeneratedWorld(seed);
  },

  stepWorld(state, dtTicks, config: SimConfig) {
    const nextState = cloneWorld(state);
    for (let tick = 0; tick < dtTicks; tick += 1) {
      runSingleTick(nextState, config);
    }
    return nextState;
  },

  applyEditorAction(state, action) {
    const nextState = cloneWorld(state);
    switch (action.type) {
      case "build_zone":
        return applyBuildZone(nextState, action);
      case "place_utility":
        return applyPlaceUtility(nextState, action);
      case "build_road":
        return applyBuildRoad(nextState, action);
      case "place_tram_stop":
        return applyPlaceTramStop(nextState, action);
      case "build_tram":
        return applyBuildTram(nextState, action);
      case "place_ferry_dock":
        return applyPlaceFerryDock(nextState, action);
      case "build_ferry":
        return applyBuildFerry(nextState, action);
      case "demolish_entity":
        return applyDemolish(nextState, action);
      default:
        return nextState;
    }
  },

  derivePresentation(state, overlay: OverlayKind): PresentationState {
    void OVERLAY_PALETTE;
    const ferryDocksById = new Map(state.ferryDocks.map((dock) => [dock.id, dock]));
    return {
      worldName: state.metadata.worldName,
      seed: state.metadata.seed,
      weather: state.weather.state,
      clockLabel: formatClockLabel(state),
      dayProgress: computeDayProgress(state),
      overlay,
      averageCongestion: state.traffic.averageCongestion,
      ferryEfficiency: ferryEfficiencyForWeather(state.weather.state),
      tiles: state.terrain.tiles.map((tile) => ({
        x: tile.x,
        y: tile.y,
        elevation: tile.elevation,
        terrain: tile.terrain,
        coastline: tile.coastline,
      })),
      districts: state.districts.map((district) => ({
        id: district.id,
        type: district.type,
        footprint: district.footprint,
        level: district.level,
        efficiency: district.operationalEfficiency,
        saturation: district.satisfaction / 100,
        activity: clamp((district.level / 5) * 0.32 + district.satisfaction / 180 + district.operationalEfficiency * 0.35, 0.08, 1),
        blackout: districtHasEvent(state, district, "blackout"),
        onFire: districtHasEvent(state, district, "fire"),
        overlayMetrics: {
          traffic: clamp(district.congestionPenalty / 18, 0, 1),
          power: districtHasEvent(state, district, "blackout") ? 1 : deficitStressValue(district.deficits.power),
          water: deficitStressValue(district.deficits.water),
          satisfaction: clamp(district.satisfaction / 100, 0, 1),
        },
      })),
      utilities: state.utilities.map((utility) => ({
        id: utility.id,
        type: utility.type,
        footprint: utility.footprint,
      })),
      roadEdges: state.roadEdges.map((edge) => ({
        id: edge.id,
        path: edge.path,
        congestion: edge.congestion,
      })),
      tramLines: state.tramLines.map((line) => ({
        id: line.id,
        path: resolveTramPath(state, line.edgeIds),
      })),
      ferryRoutes: state.ferryRoutes.flatMap((route) => {
        const from = ferryDocksById.get(route.dockAId);
        const to = ferryDocksById.get(route.dockBId);
        if (!from || !to) {
          return [];
        }
        return [
          {
            id: route.id,
            from: from.position,
            to: to.position,
          },
        ];
      }),
      actors: state.actorTargets,
    };
  },

  serializeSave(state, slotId, camera?: CameraState): SavePayload {
    return {
      version: SAVE_SCHEMA_VERSION,
      slot: {
        id: slotId,
        label: slotId === "autosave" ? "Autosave" : `Manual ${slotId.replace("slot-", "Slot ")}`,
        updatedAt: Date.now(),
      },
      state: cloneWorld(state),
      camera,
    };
  },

  hydrateSave(payload) {
    return cloneWorld(payload.state);
  },
};
