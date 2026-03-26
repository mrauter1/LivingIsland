import { beforeEach, describe, expect, it } from "vitest";
import { summarizeWorld, useAppStore } from "./appStore";
import { simulationKernel } from "../../simulation/core/engine";
import { getTile } from "../../world/terrain/terrain";

function findEmptyRect(world: ReturnType<typeof useAppStore.getState>["world"], width: number, height: number) {
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

function findBuildableRoadSegment(world: ReturnType<typeof useAppStore.getState>["world"]) {
  for (let y = 2; y < world.terrain.height - 2; y += 1) {
    for (let x = 2; x < world.terrain.width - 2; x += 1) {
      const start = getTile(world.terrain, x, y);
      const middle = getTile(world.terrain, x + 1, y);
      const end = getTile(world.terrain, x + 2, y);
      if (start?.terrain !== "water" && middle?.terrain !== "water" && end?.terrain !== "water") {
        return {
          start: { x, y },
          end: { x: x + 2, y },
        };
      }
    }
  }

  throw new Error("Expected a buildable road segment.");
}

function syncNextIds(world: ReturnType<typeof useAppStore.getState>["world"]) {
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

function createTramSelectionWorld() {
  const world = simulationKernel.createInitialWorld("tram-selection-seed");
  world.roadNodes = [
    { id: "road-node-a", x: 8, y: 8, connectedEdgeIds: ["road-edge-1"], isCoastlineNode: false },
    { id: "road-node-b", x: 16, y: 8, connectedEdgeIds: ["road-edge-1"], isCoastlineNode: false },
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
  world.tramStops = [
    { id: "tram-stop-1", nodeId: "road-node-a" },
    { id: "tram-stop-2", nodeId: "road-node-b" },
  ];
  world.tramLines = [
    {
      id: "tram-line-1",
      stopIds: ["tram-stop-1", "tram-stop-2"],
      edgeIds: ["road-edge-1"],
      lineFrequency: 1,
      capacityContribution: 18,
    },
  ];
  world.ferryDocks = [];
  world.ferryRoutes = [];
  return syncNextIds(world);
}

function createFerrySelectionWorld() {
  const world = simulationKernel.createInitialWorld("ferry-selection-seed");
  world.roadNodes = [
    { id: "road-node-c", x: 20, y: 20, connectedEdgeIds: [], isCoastlineNode: true },
    { id: "road-node-d", x: 24, y: 20, connectedEdgeIds: [], isCoastlineNode: true },
  ];
  world.roadEdges = [];
  world.tramStops = [];
  world.tramLines = [];
  world.ferryDocks = [
    { id: "ferry-dock-1", nodeId: "road-node-c", position: { x: 20, y: 20 } },
    { id: "ferry-dock-2", nodeId: "road-node-d", position: { x: 24, y: 20 } },
  ];
  world.ferryRoutes = [
    {
      id: "ferry-route-1",
      dockAId: "ferry-dock-1",
      dockBId: "ferry-dock-2",
      length: 4,
      fixedFrequency: 1,
      capacityContribution: 14,
    },
  ];
  return syncNextIds(world);
}

describe("app store", () => {
  beforeEach(() => {
    useAppStore.getState().newWorld("test-seed");
    useAppStore.setState({
      mode: "inspect",
      simulationSpeed: "1x",
      overlay: "none",
    });
  });

  it("creates a deterministic initial world for a seed", () => {
    const first = useAppStore.getState().world;
    useAppStore.getState().newWorld("test-seed");
    const second = useAppStore.getState().world;

    expect(first.metadata.seed).toBe(second.metadata.seed);
    expect(first.terrain.tiles[0]?.terrain).toBe(second.terrain.tiles[0]?.terrain);
    expect(first.districts.map((district) => district.id)).toEqual(second.districts.map((district) => district.id));
  });

  it("advances world time through the single store boundary", () => {
    const before = useAppStore.getState().world.clock.tick;
    useAppStore.getState().tick();
    const after = useAppStore.getState().world.clock.tick;
    expect(after).toBeGreaterThan(before);
  });

  it("summarizes world metrics deterministically for UI consumers", () => {
    const world = structuredClone(useAppStore.getState().world);
    const summary = summarizeWorld(world);

    expect(summary.districtCountByType.residential).toBeGreaterThan(0);
    expect(summary.utilityCountByType.power_plant).toBeGreaterThan(0);
    expect(summary.averageCongestion).toBe(world.traffic.averageCongestion);
  });

  it("returns zeroed satisfaction when a world has no districts", () => {
    const world = structuredClone(useAppStore.getState().world);
    world.districts = [];

    const summary = summarizeWorld(world);

    expect(summary.averageSatisfaction).toBe(0);
    expect(summary.districtCountByType).toEqual({
      residential: 0,
      commercial: 0,
      industrial: 0,
      leisure: 0,
    });
  });

  it("applies zone drag rules through the centralized editor workflow", () => {
    const store = useAppStore.getState();
    const invalidBefore = store.world.districts.length;

    store.setMode("build_zone");
    store.startZoneDrag({ x: 4, y: 4 });
    store.finishZoneDrag({ x: 5, y: 5 });

    expect(useAppStore.getState().world.districts).toHaveLength(invalidBefore);
    expect(useAppStore.getState().editor.statusText).toContain("4x4");

    const origin = findEmptyRect(useAppStore.getState().world, 4, 4);
    store.startZoneDrag(origin);
    store.finishZoneDrag({ x: origin.x + 3, y: origin.y + 3 });

    expect(useAppStore.getState().world.districts).toHaveLength(invalidBefore + 1);
    expect(useAppStore.getState().selection?.kind).toBe("district");
  });

  it("selects created district and utility ids from the post-action world after prior deletions", () => {
    const deletedDistrictWorld = simulationKernel.applyEditorAction(useAppStore.getState().world, {
      type: "demolish_entity",
      entityKind: "district",
      entityId: "district-5",
    });
    useAppStore.setState({ world: deletedDistrictWorld, selection: undefined });

    const districtStore = useAppStore.getState();
    const zoneOrigin = findEmptyRect(districtStore.world, 4, 4);
    districtStore.setMode("build_zone");
    districtStore.startZoneDrag(zoneOrigin);
    districtStore.finishZoneDrag({ x: zoneOrigin.x + 3, y: zoneOrigin.y + 3 });

    expect(useAppStore.getState().world.districts.at(-1)?.id).toBe("district-6");
    expect(useAppStore.getState().selection).toEqual({ kind: "district", entityId: "district-6" });

    const deletedUtilityWorld = simulationKernel.applyEditorAction(useAppStore.getState().world, {
      type: "demolish_entity",
      entityKind: "utility",
      entityId: "utility-5",
    });
    useAppStore.setState({ world: deletedUtilityWorld, selection: undefined });

    const utilityStore = useAppStore.getState();
    const utilityOrigin = findEmptyRect(utilityStore.world, 3, 3);
    utilityStore.setUtilityType("park");
    utilityStore.setMode("place_utility");
    utilityStore.handleWorldClick(utilityOrigin);

    expect(useAppStore.getState().world.utilities.at(-1)?.id).toBe("utility-6");
    expect(useAppStore.getState().selection).toEqual({ kind: "utility", entityId: "utility-6" });
  });

  it("handles keyboard shortcuts for mode and camera toggles", () => {
    const store = useAppStore.getState();

    store.handleShortcut("r");
    expect(useAppStore.getState().mode).toBe("build_road");

    store.handleShortcut("c");
    expect(useAppStore.getState().camera.cinematic).toBe(true);

    store.handleShortcut("t");
    expect(useAppStore.getState().simulationSpeed).toBe("timelapse");

    store.handleShortcut("h");
    expect(useAppStore.getState().camera.hudHidden).toBe(true);
  });

  it("builds a road when finalizing a draft with a duplicated terminal point", () => {
    const store = useAppStore.getState();
    const segment = findBuildableRoadSegment(store.world);

    store.setMode("build_road");
    store.handleWorldClick(segment.start);
    store.handleWorldClick(segment.end);
    store.handleWorldClick(segment.end);
    store.finalizeActiveDraft();

    expect(useAppStore.getState().world.roadEdges.at(-1)?.path).toEqual([segment.start, segment.end]);
    expect(useAppStore.getState().selection?.kind).toBe("road_edge");
  });

  it("selects created road and transit ids from the post-action world after prior deletions", () => {
    const roadWorld = simulationKernel.createInitialWorld("road-selection-seed");
    roadWorld.roadNodes = [];
    roadWorld.roadEdges = [];
    roadWorld.tramStops = [];
    roadWorld.tramLines = [];
    roadWorld.ferryDocks = [];
    roadWorld.ferryRoutes = [];
    syncNextIds(roadWorld);
    const segment = findBuildableRoadSegment(roadWorld);
    const firstRoadWorld = simulationKernel.applyEditorAction(roadWorld, {
      type: "build_road",
      path: [segment.start, segment.end],
    });
    const deletedRoadWorld = simulationKernel.applyEditorAction(firstRoadWorld, {
      type: "demolish_entity",
      entityKind: "road_edge",
      entityId: "road-edge-1",
    });
    useAppStore.setState({ world: deletedRoadWorld, selection: undefined });

    const roadStore = useAppStore.getState();
    roadStore.setMode("build_road");
    roadStore.handleWorldClick(segment.start);
    roadStore.handleWorldClick(segment.end);
    roadStore.finalizeActiveDraft();

    expect(useAppStore.getState().world.roadEdges.at(-1)?.id).toBe("road-edge-2");
    expect(useAppStore.getState().selection).toEqual({ kind: "road_edge", entityId: "road-edge-2" });

    const deletedTramLineWorld = simulationKernel.applyEditorAction(createTramSelectionWorld(), {
      type: "demolish_entity",
      entityKind: "tram_line",
      entityId: "tram-line-1",
    });
    useAppStore.setState({ world: deletedTramLineWorld, selection: undefined });

    const tramStore = useAppStore.getState();
    tramStore.setMode("build_tram");
    tramStore.handleWorldClick({ x: 8, y: 8 });
    tramStore.handleWorldClick({ x: 16, y: 8 });
    tramStore.finalizeActiveDraft();

    expect(useAppStore.getState().world.tramLines.at(-1)?.id).toBe("tram-line-2");
    expect(useAppStore.getState().selection).toEqual({ kind: "tram_line", entityId: "tram-line-2" });

    const deletedFerryRouteWorld = simulationKernel.applyEditorAction(createFerrySelectionWorld(), {
      type: "demolish_entity",
      entityKind: "ferry_route",
      entityId: "ferry-route-1",
    });
    useAppStore.setState({ world: deletedFerryRouteWorld, selection: undefined });

    const ferryStore = useAppStore.getState();
    ferryStore.setMode("build_ferry");
    ferryStore.handleWorldClick({ x: 20, y: 20 });
    ferryStore.handleWorldClick({ x: 24, y: 20 });

    expect(useAppStore.getState().world.ferryRoutes.at(-1)?.id).toBe("ferry-route-2");
    expect(useAppStore.getState().selection).toEqual({ kind: "ferry_route", entityId: "ferry-route-2" });
  });

  it("demolishes one selected district through the editor workflow", () => {
    const store = useAppStore.getState();
    const targetDistrict = store.world.districts[0]!;
    const targetTile = targetDistrict.tiles[0]!;

    store.setMode("demolish");
    store.handleWorldClick(targetTile);

    expect(useAppStore.getState().world.districts.some((district) => district.id === targetDistrict.id)).toBe(false);
    expect(useAppStore.getState().selection).toBeUndefined();
    expect(useAppStore.getState().editor.statusText).toContain("demolished");
  });

  it("round-trips a manual save slot with world state and camera state", async () => {
    const initialWorld = structuredClone(useAppStore.getState().world);
    const initialCamera = {
      ...useAppStore.getState().camera,
      yaw: 1.05,
      pitch: 0.91,
      cinematic: true,
    };

    useAppStore.setState({ camera: initialCamera });
    useAppStore.getState().setManualSaveSlotLabel("slot-1", "Regression Slot");
    await useAppStore.getState().saveToSlot("slot-1");

    useAppStore.getState().newWorld("different-seed");
    expect(useAppStore.getState().world.metadata.seed).toBe("different-seed");

    await useAppStore.getState().loadSave("slot-1");

    const restoredState = useAppStore.getState();
    expect(restoredState.world.metadata.seed).toBe(initialWorld.metadata.seed);
    expect(restoredState.world.clock.tick).toBe(initialWorld.clock.tick);
    expect(restoredState.world.events).toEqual(initialWorld.events);
    expect(restoredState.world.runtime.nextIds).toEqual(initialWorld.runtime.nextIds);
    expect(restoredState.camera.yaw).toBeCloseTo(initialCamera.yaw);
    expect(restoredState.camera.pitch).toBeCloseTo(initialCamera.pitch);
    expect(restoredState.camera.cinematic).toBe(true);
    expect(restoredState.persistence.activeSlotId).toBe("slot-1");
    expect(restoredState.saveSlots.some((slot) => slot.id === "slot-1" && slot.label === "Regression Slot")).toBe(true);
  });
});
