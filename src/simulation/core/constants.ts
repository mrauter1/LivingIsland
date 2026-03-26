import type { DistrictType, UtilityType } from "../../types";

export const WORLD_GRID_SIZE = 128;
export const REALTIME_TICK_MS = 500;
export const IN_GAME_MINUTES_PER_TICK = 15;
export const TICKS_PER_HOUR = 4;
export const TICKS_PER_DAY = 96;
export const GROWTH_CHECK_INTERVAL = 24;
export const DEFAULT_ROAD_EDGE_CAPACITY = 100;
export const UTILITY_DEFICIT_MILD_THRESHOLD = 0.05;
export const UTILITY_DEFICIT_SEVERE_THRESHOLD = 0.15;
export const PARK_SERVICE_RADIUS = 12;
export const FIRE_STATION_SERVICE_RADIUS = 16;
export const TRAM_STOP_RADIUS = 10;
export const FERRY_DOCK_RADIUS = 14;
export const TRANSPORT_EDGE_SEARCH_RADIUS = 18;
export const HIGH_TRAFFIC_LOAD_THRESHOLD = 0.6;
export const MODERATE_CONGESTION_THRESHOLD = 0.6;
export const SEVERE_CONGESTION_THRESHOLD = 0.85;
export const TRAFFIC_COLLAPSE_RECOVERY_THRESHOLD = 0.75;
export const BLACKOUT_TRIGGER_TICKS = 8;
export const TRAFFIC_COLLAPSE_TRIGGER_TICKS = 24;
export const TRAFFIC_COLLAPSE_RECOVERY_TICKS = 12;
export const OVERLAY_PALETTE = {
  traffic: ["#17405c", "#f3a712", "#e94560"],
  power: ["#1b5e20", "#fbc02d", "#d84315"],
  water: ["#145da0", "#6ec6ff", "#1f7a8c"],
  satisfaction: ["#7a5c1f", "#f6f2d4", "#1c7c54"],
} as const;

export const SIMULATION_UPDATE_ORDER = [
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
] as const;

export const DISTRICT_BASE_COEFFICIENTS: Record<
  DistrictType,
  { population: number; jobs: number; power: number; water: number; waste: number; attractivenessBias: number }
> = {
  residential: { population: 70, jobs: 10, power: 8, water: 10, waste: 7, attractivenessBias: 10 },
  commercial: { population: 0, jobs: 60, power: 12, water: 5, waste: 8, attractivenessBias: 4 },
  industrial: { population: 0, jobs: 80, power: 18, water: 8, waste: 14, attractivenessBias: -8 },
  leisure: { population: 0, jobs: 40, power: 10, water: 6, waste: 6, attractivenessBias: 18 },
};

export const UTILITY_DEFAULTS: Record<
  UtilityType,
  { width: number; height: number; capacity?: number; serviceRadius?: number }
> = {
  power_plant: { width: 4, height: 4, capacity: 220 },
  water_tower: { width: 3, height: 3, capacity: 220 },
  waste_center: { width: 3, height: 3, capacity: 220 },
  park: { width: 3, height: 3, serviceRadius: 12 },
  fire_station: { width: 4, height: 4, serviceRadius: 16 },
};

export const WEATHER_TRAFFIC_MULTIPLIER = {
  clear: 1,
  cloudy: 1,
  rain: 1.08,
  storm: 1.14,
  fog: 1.05,
} as const;

export const WEATHER_ATTRACTIVENESS_SHIFT = {
  clear: 0,
  cloudy: -2,
  rain: -4,
  storm: -6,
  fog: -3,
} as const;

export const WEATHER_SATISFACTION_SHIFT = {
  clear: 0,
  cloudy: -1,
  rain: -2,
  storm: -5,
  fog: -2,
} as const;

export const FERRY_EFFICIENCY_BY_WEATHER = {
  clear: 1,
  cloudy: 1,
  rain: 0.9,
  storm: 0.5,
  fog: 0.92,
} as const;
