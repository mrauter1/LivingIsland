import { describe, expect, it } from "vitest";
import { WORLD_GRID_SIZE } from "../../simulation/core/constants";
import { buildStarterTerrain, summarizeStarterBasin } from "./terrain";

describe("starter terrain generation", () => {
  it("is deterministic for a fixed seed", () => {
    const first = buildStarterTerrain("terrain-seed");
    const second = buildStarterTerrain("terrain-seed");

    expect(first).toEqual(second);
  });

  it("varies across different seeds", () => {
    const first = buildStarterTerrain("terrain-seed-a");
    const second = buildStarterTerrain("terrain-seed-b");

    expect(first.tiles).not.toEqual(second.tiles);
  });

  it("keeps the starter basin viable across representative foundation seeds", () => {
    for (const seed of [
      "starter-seed",
      "app-shell-seed",
      "terrain-seed",
      "archipelago-01",
      "archipelago-02",
      "aurora-bay",
      "delta-harbor",
      "emerald-cove",
      "harvest-tide",
      "silver-lagoon",
    ]) {
      const terrain = buildStarterTerrain(seed);
      const basin = summarizeStarterBasin(terrain);

      expect(terrain.width).toBe(WORLD_GRID_SIZE);
      expect(terrain.height).toBe(WORLD_GRID_SIZE);
      expect(terrain.tiles).toHaveLength(WORLD_GRID_SIZE * WORLD_GRID_SIZE);
      expect(basin.center).toEqual({ x: WORLD_GRID_SIZE / 2, y: WORLD_GRID_SIZE / 2 });
      expect(basin.viable).toBe(true);
      expect(basin.buildableTileCount).toBeGreaterThanOrEqual(700);
    }
  });
});
