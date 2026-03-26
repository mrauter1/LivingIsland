import { describe, expect, it } from "vitest";
import { createInitialWorld } from "./createInitialWorld";

describe("createInitialWorld", () => {
  it("is deterministic for a fixed seed", () => {
    const first = createInitialWorld("layout-seed");
    const second = createInitialWorld("layout-seed");

    expect(first).toEqual(second);
  });

  it("keeps starter districts, utilities, and transit valid across representative seeds", () => {
    for (const seed of [
      "starter-seed",
      "archipelago-01",
      "archipelago-02",
      "aurora-bay",
      "delta-harbor",
      "emerald-cove",
      "harvest-tide",
      "silver-lagoon",
      "trade-winds",
      "volcanic-garden",
    ]) {
      const world = createInitialWorld(seed);

      expect(world.actorTargets.trams).toBeGreaterThanOrEqual(1);
      expect(world.tramStops.length).toBeGreaterThanOrEqual(2);
      expect(world.tramLines).toHaveLength(1);

      for (const edge of world.roadEdges) {
        for (const coord of edge.path) {
          const tile = world.terrain.tiles[coord.y * world.terrain.width + coord.x];
          expect(tile?.isBuildable).toBe(true);
        }
      }

      for (const tramLine of world.tramLines) {
        expect(tramLine.stopIds.length).toBeGreaterThanOrEqual(2);
        expect(tramLine.edgeIds.length).toBeGreaterThanOrEqual(1);
        for (const edgeId of tramLine.edgeIds) {
          expect(world.roadEdges.some((edge) => edge.id === edgeId)).toBe(true);
        }
      }

      for (const district of world.districts) {
        expect(district.tiles).toHaveLength(district.footprint.width * district.footprint.height);
        for (const coord of district.tiles) {
          const tile = world.terrain.tiles[coord.y * world.terrain.width + coord.x];
          expect(tile?.isBuildable).toBe(true);
          expect(tile?.districtId).toBe(district.id);
        }
      }

      for (const utility of world.utilities) {
        for (
          let y = utility.footprint.y;
          y < utility.footprint.y + utility.footprint.height;
          y += 1
        ) {
          for (
            let x = utility.footprint.x;
            x < utility.footprint.x + utility.footprint.width;
            x += 1
          ) {
            const tile = world.terrain.tiles[y * world.terrain.width + x];
            expect(tile?.isBuildable).toBe(true);
            expect(tile?.utilityId).toBe(utility.id);
          }
        }
      }
    }
  });
});
