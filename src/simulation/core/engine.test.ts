import { describe, expect, it } from "vitest";
import { GROWTH_CHECK_INTERVAL, SIMULATION_UPDATE_ORDER, TICKS_PER_HOUR, WORLD_GRID_SIZE } from "./constants";
import { simulationKernel } from "./engine";
import { isSavePayload } from "../../persistence/saveSchema";
import { getTile } from "../../world/terrain/terrain";

function findEmptyRect(world: ReturnType<typeof simulationKernel.createInitialWorld>, width: number, height: number) {
  for (let y = 0; y <= world.terrain.height - height; y += 1) {
    for (let x = 0; x <= world.terrain.width - width; x += 1) {
      let valid = true;
      for (let dy = 0; dy < height && valid; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          const tile = getTile(world.terrain, x + dx, y + dy);
          if (!tile?.isBuildable || tile.districtId || tile.utilityId) {
            valid = false;
            break;
          }
        }
      }
      if (valid) {
        return { x, y };
      }
    }
  }

  throw new Error(`Expected to find an empty ${width}x${height} rect.`);
}

function findBuildableRoadSegment(world: ReturnType<typeof simulationKernel.createInitialWorld>) {
  for (let y = 2; y < world.terrain.height - 2; y += 1) {
    for (let x = 2; x < world.terrain.width - 2; x += 1) {
      const start = getTile(world.terrain, x, y);
      const horizontalMid = getTile(world.terrain, x + 1, y);
      const horizontalEnd = getTile(world.terrain, x + 2, y);
      const verticalMid = getTile(world.terrain, x + 2, y + 1);
      const verticalEnd = getTile(world.terrain, x + 2, y + 2);
      if (
        start?.terrain !== "water" &&
        horizontalMid?.terrain !== "water" &&
        horizontalEnd?.terrain !== "water" &&
        verticalMid?.terrain !== "water" &&
        verticalEnd?.terrain !== "water"
      ) {
        return {
          horizontal: [
            { x, y },
            { x: x + 2, y },
          ],
          vertical: [
            { x: x + 2, y },
            { x: x + 2, y: y + 2 },
          ],
        };
      }
    }
  }

  throw new Error("Expected a buildable road segment on the starter island.");
}

function syncNextIds(world: ReturnType<typeof simulationKernel.createInitialWorld>) {
  const highestSuffix = (prefix: string, ids: string[]) =>
    ids.reduce((highest, id) => {
      const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
      return match ? Math.max(highest, Number.parseInt(match[1] ?? "", 10)) : highest;
    }, 0);

  world.runtime.nextIds = {
    district: highestSuffix("district", world.districts.map((district) => district.id)),
    utility: highestSuffix("utility", world.utilities.map((utility) => utility.id)),
    "road-node": highestSuffix("road-node", world.roadNodes.map((node) => node.id)),
    "road-edge": highestSuffix("road-edge", world.roadEdges.map((edge) => edge.id)),
    "tram-stop": highestSuffix("tram-stop", world.tramStops.map((stop) => stop.id)),
    "tram-line": highestSuffix("tram-line", world.tramLines.map((line) => line.id)),
    "ferry-dock": highestSuffix("ferry-dock", world.ferryDocks.map((dock) => dock.id)),
    "ferry-route": highestSuffix("ferry-route", world.ferryRoutes.map((route) => route.id)),
    event: highestSuffix("event", world.events.map((event) => event.id)),
  };
  return world;
}

describe("simulation kernel contracts", () => {
  it("preserves fixed PRD constants", () => {
    expect(WORLD_GRID_SIZE).toBe(128);
    expect(GROWTH_CHECK_INTERVAL).toBe(24);
    expect(SIMULATION_UPDATE_ORDER).toEqual([
      "advance_clock",
      "update_weather",
      "update_events",
      "recalculate_utility_capacity",
      "recalculate_district_demands",
      "compute_transport_loads",
      "compute_service_coverage",
      "compute_attractiveness_and_satisfaction",
      "apply_event_penalties",
      "apply_utility_deficits",
      "update_growth_decline",
      "update_actor_targets",
      "update_timeline",
    ]);
  });

  it("serializes and hydrates canonical world state", () => {
    const world = simulationKernel.createInitialWorld("kernel-seed");
    const payload = simulationKernel.serializeSave(world, "autosave");
    const hydrated = simulationKernel.hydrateSave(payload);

    expect(payload.version).toBe("p0-v2");
    expect(
      isSavePayload({
        ...payload,
        version: "p0-v1",
      }),
    ).toBe(false);
    expect(hydrated.metadata.seed).toBe("kernel-seed");
    expect(hydrated.districts).toHaveLength(world.districts.length);
    expect(hydrated.runtime.nextIds).toEqual(world.runtime.nextIds);
  });

  it("hydrates older saves without persisted next-id state by deriving live suffixes", () => {
    const world = simulationKernel.createInitialWorld("legacy-save-seed");
    const payload = JSON.parse(JSON.stringify(simulationKernel.serializeSave(world, "slot-1")));
    delete payload.state.runtime.nextIds;

    const hydrated = simulationKernel.hydrateSave(payload);
    const origin = findEmptyRect(hydrated, 4, 4);
    const rebuiltWorld = simulationKernel.applyEditorAction(hydrated, {
      type: "build_zone",
      districtType: "residential",
      rect: { x: origin.x, y: origin.y, width: 4, height: 4 },
    });

    expect(hydrated.runtime.nextIds.district).toBe(5);
    expect(rebuiltWorld.districts.at(-1)?.id).toBe("district-6");
  });

  it("continues deterministically after a scripted save and reload sequence", () => {
    let baseline = simulationKernel.createInitialWorld("save-roundtrip-seed");
    const segment = findBuildableRoadSegment(baseline);

    baseline = simulationKernel.applyEditorAction(baseline, {
      type: "build_road",
      path: segment.horizontal,
    });
    baseline = simulationKernel.applyEditorAction(baseline, {
      type: "build_road",
      path: segment.vertical,
    });

    const savedWorld = simulationKernel.stepWorld(baseline, GROWTH_CHECK_INTERVAL + 7, { speed: 1 });
    const payload = simulationKernel.serializeSave(savedWorld, "slot-1");
    const restored = simulationKernel.hydrateSave(payload);

    const continuedBaseline = simulationKernel.stepWorld(savedWorld, 18, { speed: 1 });
    const continuedRestored = simulationKernel.stepWorld(restored, 18, { speed: 1 });

    expect(continuedRestored).toEqual(continuedBaseline);
  });

  it("derives overlay metrics from canonical district and traffic state", () => {
    const world = simulationKernel.createInitialWorld("overlay-kernel-seed");
    const targetDistrict = world.districts[0]!;
    const targetRoad = world.roadEdges[0]!;

    targetDistrict.satisfaction = 28;
    targetDistrict.deficits.power = "severe";
    targetDistrict.deficits.water = "mild";
    targetDistrict.congestionPenalty = 18;
    targetRoad.congestion = 0.92;

    const presentation = simulationKernel.derivePresentation(world, "power");
    const presentationDistrict = presentation.districts.find((district) => district.id === targetDistrict.id);
    const presentationRoad = presentation.roadEdges.find((edge) => edge.id === targetRoad.id);

    expect(presentationDistrict?.overlayMetrics.power).toBe(1);
    expect(presentationDistrict?.overlayMetrics.water).toBe(0.5);
    expect(presentationDistrict?.overlayMetrics.satisfaction).toBeCloseTo(0.28);
    expect(presentationDistrict?.overlayMetrics.traffic).toBe(1);
    expect(presentationRoad?.congestion).toBeCloseTo(0.92);
  });

  it("clears occupancy markers when demolishing districts and utilities", () => {
    const initialWorld = simulationKernel.createInitialWorld("demolish-seed");
    const targetDistrict = initialWorld.districts[0]!;
    const targetUtility = initialWorld.utilities[0]!;

    const afterDistrictDemolish = simulationKernel.applyEditorAction(initialWorld, {
      type: "demolish_entity",
      entityKind: "district",
      entityId: targetDistrict.id,
    });
    for (const coord of targetDistrict.tiles) {
      const tile = afterDistrictDemolish.terrain.tiles[coord.y * WORLD_GRID_SIZE + coord.x];
      expect(tile?.districtId).toBeUndefined();
    }

    const afterUtilityDemolish = simulationKernel.applyEditorAction(afterDistrictDemolish, {
      type: "demolish_entity",
      entityKind: "utility",
      entityId: targetUtility.id,
    });
    for (let y = targetUtility.footprint.y; y < targetUtility.footprint.y + targetUtility.footprint.height; y += 1) {
      for (let x = targetUtility.footprint.x; x < targetUtility.footprint.x + targetUtility.footprint.width; x += 1) {
        const tile = afterUtilityDemolish.terrain.tiles[y * WORLD_GRID_SIZE + x];
        expect(tile?.utilityId).toBeUndefined();
      }
    }
  });

  it("reuses road nodes and updates adjacency when adding connected roads", () => {
    const world = simulationKernel.createInitialWorld("roads-seed");
    world.roadNodes = [];
    world.roadEdges = [];
    const segment = findBuildableRoadSegment(world);

    const firstRoad = simulationKernel.applyEditorAction(world, {
      type: "build_road",
      path: segment.horizontal,
    });

    const secondRoad = simulationKernel.applyEditorAction(firstRoad, {
      type: "build_road",
      path: segment.vertical,
    });

    expect(secondRoad.roadNodes).toHaveLength(3);
    const sharedPoint = segment.vertical[0]!;
    const intersectionNode = secondRoad.roadNodes.find((node) => node.x === sharedPoint.x && node.y === sharedPoint.y);
    expect(intersectionNode?.connectedEdgeIds).toHaveLength(2);
  });

  it("allocates fresh editor ids after deleted districts and roads", () => {
    const zoningWorld = simulationKernel.createInitialWorld("editor-id-seed");
    const deletedDistrictWorld = simulationKernel.applyEditorAction(zoningWorld, {
      type: "demolish_entity",
      entityKind: "district",
      entityId: "district-5",
    });
    const origin = findEmptyRect(deletedDistrictWorld, 4, 4);
    const rebuiltDistrictWorld = simulationKernel.applyEditorAction(deletedDistrictWorld, {
      type: "build_zone",
      districtType: "residential",
      rect: { x: origin.x, y: origin.y, width: 4, height: 4 },
    });

    expect(rebuiltDistrictWorld.districts.at(-1)?.id).toBe("district-6");

    const roadWorld = simulationKernel.createInitialWorld("road-id-seed");
    roadWorld.roadNodes = [];
    roadWorld.roadEdges = [];
    roadWorld.tramStops = [];
    roadWorld.tramLines = [];
    roadWorld.ferryDocks = [];
    roadWorld.ferryRoutes = [];
    syncNextIds(roadWorld);
    const segment = findBuildableRoadSegment(roadWorld).horizontal;

    const firstRoadWorld = simulationKernel.applyEditorAction(roadWorld, {
      type: "build_road",
      path: segment,
    });
    const demolishedRoadWorld = simulationKernel.applyEditorAction(firstRoadWorld, {
      type: "demolish_entity",
      entityKind: "road_edge",
      entityId: firstRoadWorld.roadEdges[0]!.id,
    });
    const rebuiltRoadWorld = simulationKernel.applyEditorAction(demolishedRoadWorld, {
      type: "build_road",
      path: segment,
    });

    expect(rebuiltRoadWorld.roadEdges.map((edge) => edge.id)).toEqual(["road-edge-2"]);
    expect(rebuiltRoadWorld.roadNodes.map((node) => node.id)).toEqual(["road-node-3", "road-node-4"]);
  });

  it("persists next-id state across cold save loads for deleted entities and expired events", () => {
    const zoningWorld = simulationKernel.createInitialWorld("persisted-id-seed");
    const deletedDistrictWorld = simulationKernel.applyEditorAction(zoningWorld, {
      type: "demolish_entity",
      entityKind: "district",
      entityId: "district-5",
    });
    const deletedDistrictPayload = JSON.parse(JSON.stringify(simulationKernel.serializeSave(deletedDistrictWorld, "slot-1")));
    const reloadedDistrictWorld = simulationKernel.hydrateSave(deletedDistrictPayload);
    const origin = findEmptyRect(reloadedDistrictWorld, 4, 4);
    const rebuiltDistrictWorld = simulationKernel.applyEditorAction(reloadedDistrictWorld, {
      type: "build_zone",
      districtType: "residential",
      rect: { x: origin.x, y: origin.y, width: 4, height: 4 },
    });

    expect(rebuiltDistrictWorld.districts.at(-1)?.id).toBe("district-6");

    const eventWorld = simulationKernel.createInitialWorld("persisted-event-id-seed");
    eventWorld.weather.state = "clear";
    eventWorld.weather.remainingTicks = 12;
    eventWorld.runtime.highCongestionTicks = 23;
    eventWorld.traffic.highTrafficAverageCongestion = 0.91;

    const firstCollapseWorld = simulationKernel.stepWorld(eventWorld, 1, { speed: 1 });
    expect(firstCollapseWorld.events.map((event) => event.id)).toContain("event-1");

    firstCollapseWorld.events[0]!.endTick = firstCollapseWorld.clock.tick;
    firstCollapseWorld.runtime.highCongestionTicks = 0;
    firstCollapseWorld.traffic.highTrafficAverageCongestion = 0;

    const clearedEventWorld = simulationKernel.stepWorld(firstCollapseWorld, 1, { speed: 1 });
    expect(clearedEventWorld.events).toHaveLength(0);

    const clearedEventPayload = JSON.parse(JSON.stringify(simulationKernel.serializeSave(clearedEventWorld, "slot-1")));
    const reloadedEventWorld = simulationKernel.hydrateSave(clearedEventPayload);
    reloadedEventWorld.runtime.highCongestionTicks = 23;
    reloadedEventWorld.traffic.highTrafficAverageCongestion = 0.91;

    const secondCollapseWorld = simulationKernel.stepWorld(reloadedEventWorld, 1, { speed: 1 });

    expect(secondCollapseWorld.events.map((event) => event.id)).toContain("event-2");
  });

  it("removes demolished road-edge adjacency while preserving nodes still referenced by transit entities", () => {
    const world = simulationKernel.createInitialWorld("road-demolish-seed");
    world.roadNodes = [];
    world.roadEdges = [];
    world.tramStops = [];
    world.tramLines = [];
    world.ferryDocks = [];
    world.ferryRoutes = [];
    syncNextIds(world);
    const segment = findBuildableRoadSegment(world);

    const withRoad = simulationKernel.applyEditorAction(world, {
      type: "build_road",
      path: segment.horizontal,
    });
    const protectedNodeId = withRoad.roadNodes[0]!.id;
    const unprotectedNodeId = withRoad.roadNodes[1]!.id;
    const withStop = simulationKernel.applyEditorAction(withRoad, {
      type: "place_tram_stop",
      nodeId: protectedNodeId,
    });

    const afterDemolish = simulationKernel.applyEditorAction(withStop, {
      type: "demolish_entity",
      entityKind: "road_edge",
      entityId: withStop.roadEdges[0]!.id,
    });

    expect(afterDemolish.roadEdges).toHaveLength(0);
    expect(afterDemolish.roadNodes.find((node) => node.id === protectedNodeId)?.connectedEdgeIds).toEqual([]);
    expect(afterDemolish.roadNodes.some((node) => node.id === protectedNodeId)).toBe(true);
    expect(afterDemolish.roadNodes.some((node) => node.id === unprotectedNodeId)).toBe(false);
  });

  it("creates tram stops and ferry docks as first-class editor entities", () => {
    const world = simulationKernel.createInitialWorld("transit-seed");
    world.roadNodes = [
      { id: "road-node-a", x: 8, y: 8, connectedEdgeIds: ["road-edge-1"], isCoastlineNode: false },
      { id: "road-node-b", x: 16, y: 8, connectedEdgeIds: ["road-edge-1"], isCoastlineNode: false },
      { id: "road-node-c", x: 20, y: 20, connectedEdgeIds: [], isCoastlineNode: true },
      { id: "road-node-d", x: 24, y: 20, connectedEdgeIds: [], isCoastlineNode: true },
    ];
    world.roadEdges = [
      {
        id: "road-edge-1",
        fromNodeId: "road-node-a",
        toNodeId: "road-node-b",
        path: [
          { x: 8, y: 8 },
          { x: 16, y: 8 },
        ],
        length: 2,
        capacity: 100,
        load: 0,
        congestion: 0,
      },
    ];
    world.tramStops = [];
    world.ferryDocks = [];
    world.tramLines = [];
    world.ferryRoutes = [];
    syncNextIds(world);

    const withFirstStop = simulationKernel.applyEditorAction(world, {
      type: "place_tram_stop",
      nodeId: "road-node-a",
    });
    const withSecondStop = simulationKernel.applyEditorAction(withFirstStop, {
      type: "place_tram_stop",
      nodeId: "road-node-b",
    });
    const invalidTramLineWorld = simulationKernel.applyEditorAction(withSecondStop, {
      type: "build_tram",
      stopIds: withSecondStop.tramStops.map((stop) => stop.id),
      edgeIds: ["missing-edge"],
    });
    const tramLineWorld = simulationKernel.applyEditorAction(withSecondStop, {
      type: "build_tram",
      stopIds: withSecondStop.tramStops.map((stop) => stop.id),
      edgeIds: ["road-edge-1"],
    });

    expect(invalidTramLineWorld.tramLines).toHaveLength(0);
    expect(tramLineWorld.tramStops).toHaveLength(2);
    expect(tramLineWorld.tramLines[0]?.stopIds).toEqual(withSecondStop.tramStops.map((stop) => stop.id));

    const withDockA = simulationKernel.applyEditorAction(tramLineWorld, {
      type: "place_ferry_dock",
      nodeId: "road-node-c",
    });
    const withDockB = simulationKernel.applyEditorAction(withDockA, {
      type: "place_ferry_dock",
      nodeId: "road-node-d",
    });
    const ferryWorld = simulationKernel.applyEditorAction(withDockB, {
      type: "build_ferry",
      dockIds: [withDockB.ferryDocks[0]!.id, withDockB.ferryDocks[1]!.id],
    });

    expect(ferryWorld.ferryDocks).toHaveLength(2);
    expect(ferryWorld.ferryRoutes[0]?.dockAId).toBe(withDockB.ferryDocks[0]!.id);
    expect(ferryWorld.ferryRoutes[0]?.length).toBeGreaterThan(0);
  });

  it("rejects invalid transit actions without mutating the world", () => {
    const world = simulationKernel.createInitialWorld("invalid-transit-seed");
    world.roadNodes = [
      { id: "road-node-a", x: 8, y: 8, connectedEdgeIds: [], isCoastlineNode: false },
    ];
    world.tramStops = [];
    world.tramLines = [];
    world.ferryDocks = [];
    world.ferryRoutes = [];

    const afterInvalidTram = simulationKernel.applyEditorAction(world, {
      type: "build_tram",
      stopIds: ["missing-stop-a", "missing-stop-b"],
      edgeIds: ["missing-edge"],
    });
    expect(afterInvalidTram.tramLines).toHaveLength(0);

    const afterInvalidDock = simulationKernel.applyEditorAction(afterInvalidTram, {
      type: "place_ferry_dock",
      nodeId: "road-node-a",
    });
    expect(afterInvalidDock.ferryDocks).toHaveLength(0);

    const afterInvalidFerry = simulationKernel.applyEditorAction(afterInvalidDock, {
      type: "build_ferry",
      dockIds: ["missing-dock-a", "missing-dock-b"],
    });
    expect(afterInvalidFerry.ferryRoutes).toHaveLength(0);
  });

  it("only applies growth checks on the six-hour cadence", () => {
    const world = simulationKernel.createInitialWorld("growth-cadence-seed");
    const beforeGrowth = world.districts.map((district) => district.growthProgress);

    const beforeCadence = simulationKernel.stepWorld(world, GROWTH_CHECK_INTERVAL - 1, { speed: 1 });
    expect(beforeCadence.districts.map((district) => district.growthProgress)).toEqual(beforeGrowth);

    const onCadence = simulationKernel.stepWorld(world, GROWTH_CHECK_INTERVAL, { speed: 1 });
    expect(onCadence.districts.some((district, index) => district.growthProgress !== beforeGrowth[index])).toBe(true);
  });

  it("triggers blackout events after sustained severe power deficits", () => {
    const world = simulationKernel.createInitialWorld("blackout-seed");
    world.runtime.severePowerDeficitTicks = 7;
    world.utilitiesState.power = {
      supply: 0,
      demand: 1000,
      deficitRatio: 0.2,
    };

    const nextWorld = simulationKernel.stepWorld(world, 1, { speed: 1 });
    const blackout = nextWorld.events.find((event) => event.type === "blackout");

    expect(blackout).toBeDefined();
    expect(blackout?.affectedDistrictIds.length).toBeGreaterThan(0);
    expect(
      nextWorld.districts.some((district) => blackout?.affectedDistrictIds.includes(district.id) && district.activeEventIds.includes(blackout.id)),
    ).toBe(true);
  });

  it("allocates fresh runtime event ids after earlier events expire", () => {
    const world = simulationKernel.createInitialWorld("event-id-seed");
    world.weather.state = "clear";
    world.weather.remainingTicks = 12;
    world.runtime.highCongestionTicks = 23;
    world.traffic.highTrafficAverageCongestion = 0.91;

    const firstCollapseWorld = simulationKernel.stepWorld(world, 1, { speed: 1 });
    expect(firstCollapseWorld.events.map((event) => event.id)).toContain("event-1");

    firstCollapseWorld.events[0]!.endTick = firstCollapseWorld.clock.tick;
    firstCollapseWorld.runtime.highCongestionTicks = 23;
    firstCollapseWorld.traffic.highTrafficAverageCongestion = 0.91;

    const secondCollapseWorld = simulationKernel.stepWorld(firstCollapseWorld, 1, { speed: 1 });

    expect(secondCollapseWorld.events.map((event) => event.id)).toContain("event-2");
    expect(secondCollapseWorld.events.map((event) => event.id)).not.toContain("event-1");
  });

  it("triggers traffic collapse after sustained severe congestion", () => {
    const world = simulationKernel.createInitialWorld("traffic-collapse-seed");
    world.runtime.highCongestionTicks = 23;
    world.traffic.highTrafficAverageCongestion = 0.91;

    const nextWorld = simulationKernel.stepWorld(world, 1, { speed: 1 });
    const collapse = nextWorld.events.find((event) => event.type === "traffic_collapse");
    const affectedCommercialOrIndustrial = nextWorld.districts.find(
      (district) =>
        collapse?.affectedDistrictIds.includes(district.id) &&
        (district.type === "commercial" || district.type === "industrial"),
    );

    expect(collapse).toBeDefined();
    expect(nextWorld.timeline.some((entry) => entry.title === "Traffic collapse")).toBe(true);
    expect(affectedCommercialOrIndustrial?.operationalEfficiency).toBe(0.55);
  });

  it("matches repeated single-tick progression when stepping multiple ticks at timelapse speed", () => {
    const world = simulationKernel.createInitialWorld("timelapse-sequencing-seed");
    world.runtime.severePowerDeficitTicks = 7;
    world.utilitiesState.power = {
      supply: 0,
      demand: 1000,
      deficitRatio: 0.2,
    };
    world.runtime.highCongestionTicks = 23;
    world.traffic.highTrafficAverageCongestion = 0.91;

    const batched = simulationKernel.stepWorld(world, 3, { speed: 32 });
    let repeated = structuredClone(world);
    for (let tick = 0; tick < 3; tick += 1) {
      repeated = simulationKernel.stepWorld(repeated, 1, { speed: 32 });
    }

    expect(batched).toEqual(repeated);
    expect(batched.events.some((event) => event.type === "blackout")).toBe(true);
    expect(batched.events.some((event) => event.type === "traffic_collapse")).toBe(true);
  });

  it("advances from day 1 08:00 and rolls over the next day at midnight", () => {
    const world = simulationKernel.createInitialWorld("clock-seed");

    const firstTickWorld = simulationKernel.stepWorld(world, 1, { speed: 1 });
    expect(firstTickWorld.clock).toMatchObject({
      tick: 1,
      day: 1,
      hour: 8,
      minute: 15,
    });

    const midnightWorld = simulationKernel.stepWorld(world, (24 - world.clock.hour) * TICKS_PER_HOUR, { speed: 1 });
    expect(midnightWorld.clock).toMatchObject({
      day: 2,
      hour: 0,
      minute: 0,
    });
    expect(midnightWorld.timeline.some((entry) => entry.title === "Day 2" && entry.tick === midnightWorld.clock.tick)).toBe(true);
  });

  it("reduces ferry transport contribution during storms", () => {
    const world = simulationKernel.createInitialWorld("ferry-weather-seed");
    const targetDistrict = world.districts[0]!;
    world.tramStops = [];
    world.tramLines = [];
    world.ferryDocks = [
      { id: "ferry-dock-a", nodeId: "road-node-a", position: { x: targetDistrict.footprint.x, y: targetDistrict.footprint.y } },
      { id: "ferry-dock-b", nodeId: "road-node-b", position: { x: targetDistrict.footprint.x + 6, y: targetDistrict.footprint.y + 1 } },
    ];
    world.ferryRoutes = [
      {
        id: "ferry-route-1",
        dockAId: "ferry-dock-a",
        dockBId: "ferry-dock-b",
        length: 8,
        fixedFrequency: 1,
        capacityContribution: 14,
      },
    ];

    const clearWorld = simulationKernel.stepWorld(structuredClone(world), 1, { speed: 1 });
    const stormWorld = simulationKernel.stepWorld(
      {
        ...structuredClone(world),
        weather: {
          ...world.weather,
          state: "storm",
          remainingTicks: 6,
        },
      },
      1,
      { speed: 1 },
    );

    const clearDistrict = clearWorld.districts.find((district) => district.id === targetDistrict.id);
    const stormDistrict = stormWorld.districts.find((district) => district.id === targetDistrict.id);
    const clearPresentation = simulationKernel.derivePresentation(clearWorld, "none");
    const stormPresentation = simulationKernel.derivePresentation(stormWorld, "none");

    expect(clearDistrict?.serviceCoverage.transportBonus).toBe(14);
    expect(stormDistrict?.serviceCoverage.transportBonus).toBe(7);
    expect(clearPresentation.ferryEfficiency).toBe(1);
    expect(stormPresentation.ferryEfficiency).toBe(0.5);
  });

  it("creates district fires from storm electrical risk and sets burning district efficiency to zero", () => {
    const world = simulationKernel.createInitialWorld("fire-seed-73");
    const industrialDistrict = world.districts.find((district) => district.type === "industrial");
    expect(industrialDistrict).toBeDefined();
    if (!industrialDistrict) {
      return;
    }

    world.weather.state = "storm";
    world.weather.remainingTicks = 6;
    world.utilitiesState.power.deficitRatio = 0.2;
    world.utilitiesState.waste.deficitRatio = 0.2;
    industrialDistrict.congestionPenalty = 16;
    industrialDistrict.serviceCoverage.fireCoverage = false;

    const nextWorld = simulationKernel.stepWorld(world, 1, { speed: 1 });
    const fire = nextWorld.events.find((event) => event.type === "fire");
    const nextIndustrialDistrict = nextWorld.districts.find((district) => district.id === industrialDistrict.id);

    expect(fire?.affectedDistrictIds).toEqual([industrialDistrict.id]);
    expect(nextIndustrialDistrict?.activeEventIds.includes(fire?.id ?? "")).toBe(true);
    expect(nextIndustrialDistrict?.operationalEfficiency).toBe(0);
    expect(nextIndustrialDistrict?.transportDemand).toBe(0);
  });

  it("resolves blackout recovery after sustained stable power and clears presentation blackout flags", () => {
    const world = simulationKernel.createInitialWorld("blackout-recovery-seed");
    const targetDistrict = world.districts[0]!;
    world.clock.tick = 12;
    world.events = [
      {
        id: "event-blackout-1",
        type: "blackout",
        startTick: 0,
        endTick: 99,
        affectedDistrictIds: [targetDistrict.id],
      },
    ];
    world.utilitiesState.power = {
      supply: 1000,
      demand: 100,
      deficitRatio: 0,
    };

    const recoveredWorld = simulationKernel.stepWorld(world, 2, { speed: 1 });
    const recoveredDistrict = recoveredWorld.districts.find((district) => district.id === targetDistrict.id);
    const recoveredPresentation = simulationKernel.derivePresentation(recoveredWorld, "none");
    const recoveredPresentationDistrict = recoveredPresentation.districts.find((district) => district.id === targetDistrict.id);

    expect(recoveredWorld.events.some((event) => event.type === "blackout")).toBe(false);
    expect(recoveredDistrict?.activeEventIds).toEqual([]);
    expect(recoveredPresentationDistrict?.blackout).toBe(false);
    expect(recoveredWorld.timeline.some((entry) => entry.title === "blackout resolved")).toBe(true);
  });

  it("derives actor targets into presentation and scales car motion down for timelapse", () => {
    const world = simulationKernel.createInitialWorld("actor-motion-seed");
    const targetDistrict = world.districts[0]!;
    const templateDistrict = structuredClone(targetDistrict);
    world.districts = Array.from({ length: 20 }, (_, index) => ({
      ...structuredClone(templateDistrict),
      id: `actor-motion-district-${index}`,
    }));
    world.ferryDocks = [
      { id: "ferry-dock-a", nodeId: "road-node-a", position: { x: targetDistrict.footprint.x, y: targetDistrict.footprint.y } },
      { id: "ferry-dock-b", nodeId: "road-node-b", position: { x: targetDistrict.footprint.x + 6, y: targetDistrict.footprint.y + 1 } },
    ];
    world.ferryRoutes = [
      {
        id: "ferry-route-1",
        dockAId: "ferry-dock-a",
        dockBId: "ferry-dock-b",
        length: 8,
        fixedFrequency: 1,
        capacityContribution: 14,
      },
    ];

    const normalWorld = simulationKernel.stepWorld(structuredClone(world), 1, { speed: 1 });
    const timelapseWorld = simulationKernel.stepWorld(structuredClone(world), 1, { speed: 32 });
    const normalPresentation = simulationKernel.derivePresentation(normalWorld, "none");
    const timelapsePresentation = simulationKernel.derivePresentation(timelapseWorld, "none");

    expect(normalWorld.actorTargets.cars).toBeGreaterThan(timelapseWorld.actorTargets.cars);
    expect(timelapseWorld.actorTargets.trams).toBeGreaterThanOrEqual(1);
    expect(timelapseWorld.actorTargets.ferries).toBeGreaterThanOrEqual(1);
    expect(normalPresentation.actors).toEqual(normalWorld.actorTargets);
    expect(timelapsePresentation.actors).toEqual(timelapseWorld.actorTargets);
  });
});
