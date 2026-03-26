import { WORLD_GRID_SIZE } from "../../simulation/core/constants";
import type { TerrainClass, TileCoord, TileMap, WorldTile } from "../../types";

const WATERLINE = 0.34;
const CLIFF_ELEVATION = 0.82;
const BUILDABLE_SLOPE_THRESHOLD = 0.08;
const STARTER_BASIN_RADIUS = 18;

export interface StarterBasinSummary {
  center: TileCoord;
  radius: number;
  buildableTileCount: number;
  viable: boolean;
}

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: string | number): () => number {
  let state = typeof seed === "number" ? seed || 1 : hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967295;
  };
}

function classifyTerrain(elevation: number, slope: number, coastline: boolean): TerrainClass {
  if (elevation < WATERLINE) {
    return "water";
  }
  if (coastline) {
    return "coast";
  }
  if (elevation > CLIFF_ELEVATION || slope > 0.18) {
    return "cliff";
  }
  if (elevation > 0.62) {
    return "hills";
  }
  if (elevation > 0.5) {
    return "forest";
  }
  return "plains";
}

function tileIndex(x: number, y: number): number {
  return y * WORLD_GRID_SIZE + x;
}

function getHeightSample(heightmap: number[], x: number, y: number): number {
  return heightmap[tileIndex(x, y)] ?? 0;
}

export function expandRectToTiles(origin: TileCoord, width: number, height: number): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = origin.y; y < origin.y + height; y += 1) {
    for (let x = origin.x; x < origin.x + width; x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

export function getTile(map: TileMap, x: number, y: number): WorldTile | undefined {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
    return undefined;
  }
  return map.tiles[tileIndex(x, y)];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise(seedHash: number, x: number, y: number): number {
  let state = seedHash ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  state = (state ^ (state >>> 13)) >>> 0;
  state = Math.imul(state, 1274126177) >>> 0;
  return ((state ^ (state >>> 16)) >>> 0) / 4294967295;
}

function sampleFractalNoise(seedHash: number, x: number, y: number): number {
  let amplitude = 0.55;
  let frequency = 0.035;
  let total = 0;
  let normalization = 0;

  for (let octave = 0; octave < 4; octave += 1) {
    const scaledX = x * frequency;
    const scaledY = y * frequency;
    const x0 = Math.floor(scaledX);
    const y0 = Math.floor(scaledY);
    const tx = scaledX - x0;
    const ty = scaledY - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const n00 = valueNoise(seedHash + octave * 1013, x0, y0);
    const n10 = valueNoise(seedHash + octave * 1013, x0 + 1, y0);
    const n01 = valueNoise(seedHash + octave * 1013, x0, y0 + 1);
    const n11 = valueNoise(seedHash + octave * 1013, x0 + 1, y0 + 1);
    const nx0 = lerp(n00, n10, sx);
    const nx1 = lerp(n01, n11, sx);
    total += lerp(nx0, nx1, sy) * amplitude;
    normalization += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }

  return total / normalization;
}

function smoothHeightmap(raw: number[]): number[] {
  let current = raw;

  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Array<number>(current.length).fill(0);
    for (let y = 0; y < WORLD_GRID_SIZE; y += 1) {
      for (let x = 0; x < WORLD_GRID_SIZE; x += 1) {
        let total = 0;
        let weight = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= WORLD_GRID_SIZE || ny < 0 || ny >= WORLD_GRID_SIZE) {
              continue;
            }
            const sampleWeight = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
            total += getHeightSample(current, nx, ny) * sampleWeight;
            weight += sampleWeight;
          }
        }
        next[tileIndex(x, y)] = total / weight;
      }
    }
    current = next;
  }

  return current;
}

function applyStarterBasin(heightmap: number[], seedHash: number): number[] {
  const basin = [...heightmap];

  for (let y = 0; y < WORLD_GRID_SIZE; y += 1) {
    for (let x = 0; x < WORLD_GRID_SIZE; x += 1) {
      const dx = x - WORLD_GRID_SIZE / 2;
      const dy = y - WORLD_GRID_SIZE / 2;
      const distance = Math.hypot(dx / (STARTER_BASIN_RADIUS * 1.15), dy / STARTER_BASIN_RADIUS);
      if (distance > 1.2) {
        continue;
      }
      const basinWeight = 1 - smoothstep(0.7, 1.2, distance);
      const basinNoise = sampleFractalNoise(seedHash ^ 0x9e3779b9, x, y) * 0.035;
      const targetElevation = 0.52 + basinNoise;
      const index = tileIndex(x, y);
      const currentElevation = basin[index] ?? 0;
      basin[index] = Math.max(currentElevation, lerp(currentElevation, targetElevation, basinWeight));
    }
  }

  return smoothHeightmap(basin);
}

export function summarizeStarterBasin(map: TileMap): StarterBasinSummary {
  const center = { x: WORLD_GRID_SIZE / 2, y: WORLD_GRID_SIZE / 2 };
  let buildableTileCount = 0;

  for (let y = center.y - STARTER_BASIN_RADIUS; y <= center.y + STARTER_BASIN_RADIUS; y += 1) {
    for (let x = center.x - STARTER_BASIN_RADIUS; x <= center.x + STARTER_BASIN_RADIUS; x += 1) {
      const tile = getTile(map, x, y);
      const distance = Math.hypot(x - center.x, y - center.y);
      if (!tile || distance > STARTER_BASIN_RADIUS) {
        continue;
      }
      if (tile.isBuildable) {
        buildableTileCount += 1;
      }
    }
  }

  return {
    center,
    radius: STARTER_BASIN_RADIUS,
    buildableTileCount,
    viable: buildableTileCount >= 700,
  };
}

export function buildStarterTerrain(seed: string): TileMap {
  const seedHash = hashSeed(seed);
  const rng = createSeededRng(seedHash);
  const islandCenterX = WORLD_GRID_SIZE / 2 + Math.round((rng() - 0.5) * 10);
  const islandCenterY = WORLD_GRID_SIZE / 2 + Math.round((rng() - 0.5) * 10);
  const mainRadiusX = 36 + rng() * 6;
  const mainRadiusY = 34 + rng() * 8;
  const satelliteCount = Math.floor(rng() * 3);
  const satellites = Array.from({ length: satelliteCount }, () => {
    const angle = rng() * Math.PI * 2;
    const distance = 28 + rng() * 18;
    return {
      x: WORLD_GRID_SIZE / 2 + Math.cos(angle) * distance,
      y: WORLD_GRID_SIZE / 2 + Math.sin(angle) * distance,
      radiusX: 8 + rng() * 4,
      radiusY: 7 + rng() * 5,
      strength: 0.24 + rng() * 0.08,
    };
  });

  const rawHeights = new Array<number>(WORLD_GRID_SIZE * WORLD_GRID_SIZE).fill(0);
  for (let y = 0; y < WORLD_GRID_SIZE; y += 1) {
    for (let x = 0; x < WORLD_GRID_SIZE; x += 1) {
      const lowFrequency = sampleFractalNoise(seedHash ^ 0x45d9f3b, x, y);
      const detail = sampleFractalNoise(seedHash ^ 0x632be5ab, x + 17, y - 13);
      const dx = (x - islandCenterX) / mainRadiusX;
      const dy = (y - islandCenterY) / mainRadiusY;
      const radialDistance = Math.hypot(dx, dy);
      const coastlineVariation = (lowFrequency - 0.5) * 0.45;
      const mainIsland = clamp01(1 - smoothstep(0.72 + coastlineVariation, 1.2 + coastlineVariation, radialDistance));

      let satelliteHeight = 0;
      for (const satellite of satellites) {
        const satelliteDistance = Math.hypot((x - satellite.x) / satellite.radiusX, (y - satellite.y) / satellite.radiusY);
        satelliteHeight = Math.max(
          satelliteHeight,
          clamp01(1 - smoothstep(0.82, 1.25, satelliteDistance)) * satellite.strength,
        );
      }

      const mountainBias = Math.max(0, detail - 0.62) * 0.36;
      const elevation = clamp01(mainIsland * 0.72 + satelliteHeight + lowFrequency * 0.18 + mountainBias - 0.14);
      rawHeights[tileIndex(x, y)] = elevation;
    }
  }

  const smoothedHeights = applyStarterBasin(smoothHeightmap(rawHeights), seedHash);
  const tiles: WorldTile[] = [];

  for (let y = 0; y < WORLD_GRID_SIZE; y += 1) {
    for (let x = 0; x < WORLD_GRID_SIZE; x += 1) {
      const elevation = getHeightSample(smoothedHeights, x, y);
      const west = getHeightSample(smoothedHeights, Math.max(0, x - 1), y);
      const east = getHeightSample(smoothedHeights, Math.min(WORLD_GRID_SIZE - 1, x + 1), y);
      const north = getHeightSample(smoothedHeights, x, Math.max(0, y - 1));
      const south = getHeightSample(smoothedHeights, x, Math.min(WORLD_GRID_SIZE - 1, y + 1));
      const slope = Math.max(Math.abs(east - west), Math.abs(south - north));
      const coastline = elevation >= WATERLINE && elevation < 0.43;
      const terrain = classifyTerrain(elevation, slope, coastline);
      tiles.push({
        x,
        y,
        elevation,
        slope,
        terrain,
        isBuildable: terrain !== "water" && terrain !== "cliff" && slope <= BUILDABLE_SLOPE_THRESHOLD,
        coastline,
      });
    }
  }

  return {
    width: WORLD_GRID_SIZE,
    height: WORLD_GRID_SIZE,
    tiles,
  };
}
