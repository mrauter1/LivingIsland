import { describe, expect, it } from "vitest";
import { simulationKernel } from "./engine";
import {
  deriveInspectorTarget,
  planTramLine,
  resolveSelectionAtTile,
  validateRoadPlacement,
} from "./editing";

function findWaterPath(world: ReturnType<typeof simulationKernel.createInitialWorld>) {
  for (let y = 0; y < world.terrain.height - 1; y += 1) {
    for (let x = 0; x < world.terrain.width - 1; x += 1) {
      const current = world.terrain.tiles[y * world.terrain.width + x];
      const right = world.terrain.tiles[y * world.terrain.width + x + 1];
      if (current?.terrain === "water" && right?.terrain === "water") {
        return [
          { x, y },
          { x: x + 1, y },
        ];
      }
    }
  }

  throw new Error("Expected a water segment in the generated island.");
}

describe("editing helpers", () => {
  it("routes selection into a consistent inspector contract", () => {
    const world = simulationKernel.createInitialWorld("inspector-seed");
    const targetDistrict = world.districts[0]!;
    const selection = resolveSelectionAtTile(world, targetDistrict.tiles[0]!);
    const inspector = deriveInspectorTarget(world, selection);

    expect(selection).toEqual({ kind: "district", entityId: targetDistrict.id });
    expect(inspector?.title).toContain(targetDistrict.id);
    expect(inspector?.fields.some((field) => field.label === "Population")).toBe(true);
  });

  it("exposes district operational efficiency through the inspector contract", () => {
    const world = simulationKernel.createInitialWorld("efficiency-inspector-seed");
    const targetDistrict = world.districts[0]!;
    targetDistrict.operationalEfficiency = 0.55;

    const inspector = deriveInspectorTarget(world, {
      kind: "district",
      entityId: targetDistrict.id,
    });

    expect(inspector?.fields).toContainEqual({
      label: "Operational efficiency",
      value: "55%",
    });
  });

  it("rejects roads that cross water", () => {
    const world = simulationKernel.createInitialWorld("water-road-seed");
    const validation = validateRoadPlacement(world, findWaterPath(world));

    expect(validation.valid).toBe(false);
    expect(validation.reason).toContain("water");
  });

  it("plans tram lines across connected road edges", () => {
    const world = simulationKernel.createInitialWorld("tram-plan-seed");
    world.roadNodes = [
      { id: "road-node-a", x: 8, y: 8, connectedEdgeIds: ["road-edge-1"], isCoastlineNode: false },
      { id: "road-node-b", x: 12, y: 8, connectedEdgeIds: ["road-edge-1", "road-edge-2"], isCoastlineNode: false },
      { id: "road-node-c", x: 16, y: 8, connectedEdgeIds: ["road-edge-2"], isCoastlineNode: false },
    ];
    world.roadEdges = [
      {
        id: "road-edge-1",
        fromNodeId: "road-node-a",
        toNodeId: "road-node-b",
        path: [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
        ],
        length: 4,
        capacity: 100,
        load: 0,
        congestion: 0,
      },
      {
        id: "road-edge-2",
        fromNodeId: "road-node-b",
        toNodeId: "road-node-c",
        path: [
          { x: 12, y: 8 },
          { x: 16, y: 8 },
        ],
        length: 4,
        capacity: 100,
        load: 0,
        congestion: 0,
      },
    ];

    const plan = planTramLine(world, ["road-node-a", "road-node-c"]);

    expect(plan.valid).toBe(true);
    expect(plan.edgeIds).toEqual(["road-edge-1", "road-edge-2"]);
    expect(plan.path).toEqual([
      { x: 8, y: 8 },
      { x: 12, y: 8 },
      { x: 16, y: 8 },
    ]);
  });
});
