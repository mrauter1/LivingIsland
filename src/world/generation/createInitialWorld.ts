import {
  DISTRICT_BASE_COEFFICIENTS,
  UTILITY_DEFAULTS,
} from "../../simulation/core/constants";
import type {
  ActorSpawnTargets,
  District,
  DistrictType,
  RoadNode,
  TileCoord,
  TileRect,
  UtilityBuilding,
  UtilityNetworkState,
  WeatherState,
  WorldState,
} from "../../types";
import {
  buildStarterTerrain,
  createSeededRng,
  expandRectToTiles,
  getTile,
  hashSeed,
} from "../terrain/terrain";

const STARTER_BASIN_ORIGIN = { x: 44, y: 44 } as const;
const STARTER_BASIN_SIZE = 40;

const WEATHER_DURATION_RANGES: Record<WeatherState, [number, number]> = {
  clear: [24, 72],
  cloudy: [24, 48],
  rain: [16, 40],
  storm: [12, 24],
  fog: [12, 24],
};

type LayoutTransform = {
  rotation: 0 | 1 | 2 | 3;
  mirrorX: boolean;
};

type DistrictTemplate = {
  id: string;
  type: DistrictType;
  x: number;
  y: number;
  width: number;
  height: number;
  level: 1 | 2 | 3 | 4 | 5;
};

type UtilityTemplate = {
  id: string;
  type: UtilityBuilding["type"];
  x: number;
  y: number;
};

const BASE_DISTRICT_TEMPLATES: DistrictTemplate[] = [
  { id: "district-1", type: "residential", x: 7, y: 8, width: 7, height: 7, level: 2 },
  { id: "district-2", type: "commercial", x: 18, y: 8, width: 6, height: 6, level: 1 },
  { id: "district-3", type: "residential", x: 24, y: 14, width: 7, height: 7, level: 1 },
  { id: "district-4", type: "leisure", x: 9, y: 22, width: 6, height: 6, level: 1 },
  { id: "district-5", type: "industrial", x: 22, y: 24, width: 8, height: 7, level: 1 },
];

const BASE_UTILITY_TEMPLATES: UtilityTemplate[] = [
  { id: "utility-1", type: "power_plant", x: 3, y: 25 },
  { id: "utility-2", type: "water_tower", x: 30, y: 6 },
  { id: "utility-3", type: "waste_center", x: 31, y: 29 },
  { id: "utility-4", type: "park", x: 15, y: 16 },
  { id: "utility-5", type: "fire_station", x: 4, y: 4 },
];

const BASE_ROAD_PATHS: TileCoord[][] = [
  [
    { x: 5, y: 20 },
    { x: 14, y: 20 },
  ],
  [
    { x: 14, y: 20 },
    { x: 26, y: 20 },
  ],
  [
    { x: 26, y: 20 },
    { x: 35, y: 20 },
  ],
  [
    { x: 20, y: 5 },
    { x: 20, y: 14 },
  ],
  [
    { x: 20, y: 14 },
    { x: 20, y: 26 },
  ],
  [
    { x: 20, y: 26 },
    { x: 20, y: 35 },
  ],
  [
    { x: 11, y: 11 },
    { x: 14, y: 14 },
    { x: 20, y: 14 },
  ],
  [
    { x: 20, y: 26 },
    { x: 26, y: 26 },
    { x: 29, y: 29 },
  ],
  [
    { x: 12, y: 28 },
    { x: 20, y: 26 },
  ],
  [
    { x: 26, y: 14 },
    { x: 29, y: 11 },
  ],
];

function districtDemandFor(type: DistrictType, level: 1 | 2 | 3 | 4 | 5) {
  const base = DISTRICT_BASE_COEFFICIENTS[type];
  return {
    population: Math.round(base.population * level ** 1.5),
    jobs: Math.round(base.jobs * level ** 1.4),
    power: Math.round(base.power * level ** 1.4),
    water: Math.round(base.water * level ** 1.3),
    waste: Math.round(base.waste * level ** 1.3),
  };
}

function createDistrict(
  id: string,
  type: DistrictType,
  x: number,
  y: number,
  width: number,
  height: number,
  level: 1 | 2 | 3 | 4 | 5,
): District {
  const demand = districtDemandFor(type, level);
  return {
    id,
    type,
    footprint: { x, y, width, height },
    tiles: expandRectToTiles({ x, y }, width, height),
    level,
    population: demand.population,
    jobs: demand.jobs,
    satisfaction: 62,
    attractiveness: 55 + DISTRICT_BASE_COEFFICIENTS[type].attractivenessBias,
    powerDemand: demand.power,
    waterDemand: demand.water,
    wasteDemand: demand.waste,
    transportDemand: Math.round((demand.population + demand.jobs) * 0.12),
    serviceScore: 10,
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
    demandScore: {
      demand: 12,
      utility: 20,
      transport: 8,
      service: 0,
      attractiveness: 5,
      congestionPenalty: 0,
      eventPenalty: 0,
      growthScore: 45,
    },
  };
}

function createUtility(id: string, type: UtilityBuilding["type"], x: number, y: number): UtilityBuilding {
  const defaults = UTILITY_DEFAULTS[type];
  return {
    id,
    type,
    footprint: { x, y, width: defaults.width, height: defaults.height },
    serviceRadius: defaults.serviceRadius,
    capacity: defaults.capacity,
  };
}

function transformLocalCoord(coord: TileCoord, transform: LayoutTransform): TileCoord {
  let next = { ...coord };

  if (transform.mirrorX) {
    next = { x: STARTER_BASIN_SIZE - 1 - next.x, y: next.y };
  }

  for (let rotation = 0; rotation < transform.rotation; rotation += 1) {
    next = {
      x: STARTER_BASIN_SIZE - 1 - next.y,
      y: next.x,
    };
  }

  return {
    x: STARTER_BASIN_ORIGIN.x + next.x,
    y: STARTER_BASIN_ORIGIN.y + next.y,
  };
}

function transformRect(rect: TileRect, transform: LayoutTransform): TileRect {
  const corners = [
    transformLocalCoord({ x: rect.x, y: rect.y }, transform),
    transformLocalCoord({ x: rect.x + rect.width - 1, y: rect.y }, transform),
    transformLocalCoord({ x: rect.x, y: rect.y + rect.height - 1 }, transform),
    transformLocalCoord({ x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 }, transform),
  ];
  const minX = Math.min(...corners.map((corner) => corner.x));
  const minY = Math.min(...corners.map((corner) => corner.y));
  const maxX = Math.max(...corners.map((corner) => corner.x));
  const maxY = Math.max(...corners.map((corner) => corner.y));
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function rectIsBuildable(terrain: WorldState["terrain"], rect: TileRect, occupied: Set<string>): boolean {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const tile = getTile(terrain, x, y);
      if (!tile || !tile.isBuildable || occupied.has(tileKey(x, y))) {
        return false;
      }
    }
  }
  return true;
}

function reserveRect(occupied: Set<string>, rect: TileRect): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      occupied.add(tileKey(x, y));
    }
  }
}

function resolveStarterRect(terrain: WorldState["terrain"], rect: TileRect, occupied: Set<string>): TileRect {
  if (rectIsBuildable(terrain, rect, occupied)) {
    return rect;
  }

  const minX = STARTER_BASIN_ORIGIN.x;
  const minY = STARTER_BASIN_ORIGIN.y;
  const maxX = STARTER_BASIN_ORIGIN.x + STARTER_BASIN_SIZE - rect.width;
  const maxY = STARTER_BASIN_ORIGIN.y + STARTER_BASIN_SIZE - rect.height;

  for (let radius = 1; radius <= 12; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
          continue;
        }
        const candidate = {
          x: rect.x + dx,
          y: rect.y + dy,
          width: rect.width,
          height: rect.height,
        };
        if (candidate.x < minX || candidate.y < minY || candidate.x > maxX || candidate.y > maxY) {
          continue;
        }
        if (rectIsBuildable(terrain, candidate, occupied)) {
          return candidate;
        }
      }
    }
  }

  return rect;
}

function createStarterRoadGraph(paths: TileCoord[][], terrain: WorldState["terrain"]) {
  const roadNodes: RoadNode[] = [];
  const roadEdges: WorldState["roadEdges"] = [];

  const getOrCreateNode = (coord: TileCoord) => {
    const existingNode = roadNodes.find((node) => node.x === coord.x && node.y === coord.y);
    if (existingNode) {
      const terrainTile = getTile(terrain, coord.x, coord.y);
      if (terrainTile?.coastline) {
        existingNode.isCoastlineNode = true;
      }
      return existingNode;
    }

    const terrainTile = getTile(terrain, coord.x, coord.y);
    const node: RoadNode = {
      id: `road-node-${roadNodes.length + 1}`,
      x: coord.x,
      y: coord.y,
      connectedEdgeIds: [],
      isCoastlineNode: terrainTile?.coastline ?? false,
    };
    roadNodes.push(node);
    return node;
  };

  for (const path of paths) {
    const first = path[0];
    const last = path[path.length - 1];
    if (!first || !last) {
      continue;
    }

    const fromNode = getOrCreateNode(first);
    const toNode = getOrCreateNode(last);
    const edgeId = `road-edge-${roadEdges.length + 1}`;
    const length = path.slice(1).reduce((sum, point, index) => {
      const previous = path[index];
      return previous ? sum + Math.hypot(point.x - previous.x, point.y - previous.y) : sum;
    }, 0);

    roadEdges.push({
      id: edgeId,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      path,
      length,
      capacity: 100,
      load: Math.round(24 + roadEdges.length * 7),
      congestion: 0.14 + roadEdges.length * 0.02,
    });

    fromNode.connectedEdgeIds.push(edgeId);
    toNode.connectedEdgeIds.push(edgeId);
  }

  return { roadNodes, roadEdges };
}

function pickInitialWeather(seed: string): { state: WeatherState; remainingTicks: number; tendencySeed: number } {
  const tendencySeed = hashSeed(`${seed}:weather`);
  const rng = createSeededRng(tendencySeed);
  const roll = rng();
  const state: WeatherState =
    roll < 0.44 ? "clear" : roll < 0.7 ? "cloudy" : roll < 0.86 ? "rain" : roll < 0.94 ? "fog" : "storm";
  const [minDuration, maxDuration] = WEATHER_DURATION_RANGES[state];
  return {
    state,
    remainingTicks: minDuration + Math.floor(rng() * (maxDuration - minDuration + 1)),
    tendencySeed,
  };
}

function createStarterDistricts(terrain: WorldState["terrain"], transform: LayoutTransform): District[] {
  const occupied = new Set<string>();
  return BASE_DISTRICT_TEMPLATES.map((template) => {
    const footprint = resolveStarterRect(
      terrain,
      transformRect(
        { x: template.x, y: template.y, width: template.width, height: template.height },
        transform,
      ),
      occupied,
    );
    reserveRect(occupied, footprint);
    return createDistrict(
      template.id,
      template.type,
      footprint.x,
      footprint.y,
      footprint.width,
      footprint.height,
      template.level,
    );
  });
}

function createStarterUtilities(
  terrain: WorldState["terrain"],
  transform: LayoutTransform,
  occupied: Set<string>,
): UtilityBuilding[] {
  return BASE_UTILITY_TEMPLATES.map((template) => {
    const origin = resolveStarterRect(
      terrain,
      transformRect(
        {
          x: template.x,
          y: template.y,
          width: UTILITY_DEFAULTS[template.type].width,
          height: UTILITY_DEFAULTS[template.type].height,
        },
        transform,
      ),
      occupied,
    );
    reserveRect(occupied, origin);
    return createUtility(template.id, template.type, origin.x, origin.y);
  });
}

function createUtilityState(districts: District[], utilities: UtilityBuilding[]): UtilityNetworkState {
  const demand = districts.reduce(
    (acc, district) => {
      acc.power += district.powerDemand;
      acc.water += district.waterDemand;
      acc.waste += district.wasteDemand;
      return acc;
    },
    { power: 0, water: 0, waste: 0 },
  );

  const supply = utilities.reduce(
    (acc, utility) => {
      if (utility.type === "power_plant") {
        acc.power += utility.capacity ?? 0;
      }
      if (utility.type === "water_tower") {
        acc.water += utility.capacity ?? 0;
      }
      if (utility.type === "waste_center") {
        acc.waste += utility.capacity ?? 0;
      }
      return acc;
    },
    { power: 0, water: 0, waste: 0 },
  );

  return {
    power: { supply: supply.power, demand: demand.power, deficitRatio: 0 },
    water: { supply: supply.water, demand: demand.water, deficitRatio: 0 },
    waste: { supply: supply.waste, demand: demand.waste, deficitRatio: 0 },
  };
}

function findRoadNodeId(roadNodes: RoadNode[], coord: TileCoord): string | undefined {
  return roadNodes.find((node) => node.x === coord.x && node.y === coord.y)?.id;
}

function findRoadEdgeId(world: Pick<WorldState, "roadEdges">, fromNodeId: string, toNodeId: string): string | undefined {
  return world.roadEdges.find(
    (edge) =>
      (edge.fromNodeId === fromNodeId && edge.toNodeId === toNodeId) ||
      (edge.fromNodeId === toNodeId && edge.toNodeId === fromNodeId),
  )?.id;
}

function createStarterTransit(
  transform: LayoutTransform,
  roadNodes: RoadNode[],
  roadEdges: WorldState["roadEdges"],
): Pick<WorldState, "tramStops" | "tramLines" | "ferryDocks" | "ferryRoutes"> {
  const tramStopCoords = [
    transformLocalCoord({ x: 20, y: 5 }, transform),
    transformLocalCoord({ x: 20, y: 14 }, transform),
    transformLocalCoord({ x: 20, y: 26 }, transform),
    transformLocalCoord({ x: 20, y: 35 }, transform),
  ];
  const tramStopIds = tramStopCoords
    .map((coord, index) => {
      const nodeId = findRoadNodeId(roadNodes, coord);
      return nodeId
        ? {
            id: `tram-stop-${index + 1}`,
            nodeId,
          }
        : undefined;
    })
    .filter((stop): stop is WorldState["tramStops"][number] => Boolean(stop));
  const lineEdgeIds = tramStopIds
    .map((stop, index, stops) => {
      const nextStop = stops[index + 1];
      if (!nextStop) {
        return undefined;
      }
      return findRoadEdgeId({ roadEdges }, stop.nodeId, nextStop.nodeId);
    })
    .filter((edgeId): edgeId is string => Boolean(edgeId));

  return {
    tramStops: tramStopIds,
    tramLines:
      tramStopIds.length >= 2 && lineEdgeIds.length >= 1
        ? [
            {
              id: "tram-line-1",
              stopIds: tramStopIds.map((stop) => stop.id),
              edgeIds: lineEdgeIds,
              lineFrequency: 1,
              capacityContribution: 18,
            },
          ]
        : [],
    ferryDocks: [],
    ferryRoutes: [],
  };
}

export function createInitialWorld(seed: string): WorldState {
  const terrain = buildStarterTerrain(seed);
  const seedHash = hashSeed(seed);
  const transform: LayoutTransform = {
    rotation: (seedHash % 4) as 0 | 1 | 2 | 3,
    mirrorX: ((seedHash >>> 4) & 1) === 1,
  };
  const districts = createStarterDistricts(terrain, transform);
  const occupied = new Set<string>();
  districts.forEach((district) => reserveRect(occupied, district.footprint));
  const utilities = createStarterUtilities(terrain, transform, occupied);
  const roadPaths = BASE_ROAD_PATHS.map((path) => path.map((coord) => transformLocalCoord(coord, transform)));
  const { roadNodes, roadEdges } = createStarterRoadGraph(roadPaths, terrain);
  const transit = createStarterTransit(transform, roadNodes, roadEdges);
  const weather = pickInitialWeather(seed);

  for (const district of districts) {
    for (const tile of district.tiles) {
      const terrainTile = getTile(terrain, tile.x, tile.y);
      if (terrainTile) {
        terrainTile.districtId = district.id;
      }
    }
  }

  for (const utility of utilities) {
    for (const tile of expandRectToTiles(utility.footprint, utility.footprint.width, utility.footprint.height)) {
      const terrainTile = getTile(terrain, tile.x, tile.y);
      if (terrainTile) {
        terrainTile.utilityId = utility.id;
      }
    }
  }

  const utilitiesState = createUtilityState(districts, utilities);
  const actorTargets: ActorSpawnTargets = {
    cars: Math.max(8, Math.round(roadEdges.length * 1.6)),
    trams: Math.max(1, transit.tramLines.length),
    ferries: transit.ferryRoutes.length,
  };

  return {
    metadata: {
      seed,
      worldName: `Island ${seed.slice(0, 6).toUpperCase()}`,
      generatedAtTick: 0,
    },
    terrain,
    districts,
    utilities,
    roadNodes,
    roadEdges,
    tramStops: transit.tramStops,
    tramLines: transit.tramLines,
    ferryDocks: transit.ferryDocks,
    ferryRoutes: transit.ferryRoutes,
    weather,
    events: [],
    timeline: [
      {
        id: "timeline-1",
        tick: 0,
        type: "system",
        title: "World Generated",
        detail: "Starter basin, road spine, initial settlement, and a tram corridor seeded.",
      },
    ],
    utilitiesState,
    traffic: {
      averageCongestion: 0.24,
      highTrafficAverageCongestion: 0.24,
      severeEdgeIds: [],
    },
    actorTargets,
    runtime: {
      severePowerDeficitTicks: 0,
      highCongestionTicks: 0,
      recoveredCongestionTicks: 0,
      nextIds: {
        district: districts.length,
        utility: utilities.length,
        "road-node": roadNodes.length,
        "road-edge": roadEdges.length,
        "tram-stop": transit.tramStops.length,
        "tram-line": transit.tramLines.length,
        "ferry-dock": transit.ferryDocks.length,
        "ferry-route": transit.ferryRoutes.length,
        event: 0,
      },
    },
    clock: {
      tick: 0,
      day: 1,
      hour: 8,
      minute: 0,
    },
  };
}
