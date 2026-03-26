export const DISTRICT_TYPES = [
  "residential",
  "commercial",
  "industrial",
  "leisure",
] as const;

export const UTILITY_TYPES = [
  "power_plant",
  "water_tower",
  "waste_center",
  "park",
  "fire_station",
] as const;

export const WEATHER_STATES = ["clear", "cloudy", "rain", "storm", "fog"] as const;
export const EVENT_TYPES = ["storm", "blackout", "traffic_collapse", "fire"] as const;
export const OVERLAY_KINDS = ["none", "traffic", "power", "water", "satisfaction"] as const;
export const APP_MODES = [
  "inspect",
  "build_zone",
  "build_road",
  "build_tram",
  "build_ferry",
  "place_utility",
  "demolish",
] as const;
export const SIMULATION_SPEEDS = ["pause", "1x", "4x", "16x", "timelapse"] as const;
export const TERRAIN_CLASSES = ["water", "coast", "plains", "hills", "forest", "cliff"] as const;
export const SELECTION_KINDS = [
  "district",
  "road_edge",
  "tram_line",
  "tram_stop",
  "ferry_dock",
  "ferry_route",
  "utility",
  "event",
] as const;

export type DistrictType = (typeof DISTRICT_TYPES)[number];
export type UtilityType = (typeof UTILITY_TYPES)[number];
export type WeatherState = (typeof WEATHER_STATES)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type OverlayKind = (typeof OVERLAY_KINDS)[number];
export type AppMode = (typeof APP_MODES)[number];
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];
export type TerrainClass = (typeof TERRAIN_CLASSES)[number];
export type SelectionKind = (typeof SELECTION_KINDS)[number];
export type UtilityNetworkKind = "power" | "water" | "waste";
export type DeficitSeverity = "none" | "mild" | "severe";
export type CongestionSeverity = "low" | "moderate" | "severe";

export interface TileCoord {
  x: number;
  y: number;
}

export interface WorldTile extends TileCoord {
  elevation: number;
  slope: number;
  terrain: TerrainClass;
  isBuildable: boolean;
  districtId?: string;
  utilityId?: string;
  roadNodeId?: string;
  coastline: boolean;
}

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileMap {
  width: number;
  height: number;
  tiles: WorldTile[];
}

export interface DemandProfile {
  population: number;
  jobs: number;
  power: number;
  water: number;
  waste: number;
  transport: number;
}

export interface DistrictDemandScore {
  demand: number;
  utility: number;
  transport: number;
  service: number;
  attractiveness: number;
  congestionPenalty: number;
  eventPenalty: number;
  growthScore: number;
}

export interface ServiceCoverage {
  parkCoverage: boolean;
  fireCoverage: boolean;
  transportBonus: number;
  islandConnectivityBonus: number;
}

export interface UtilityDeficitState {
  power: DeficitSeverity;
  water: DeficitSeverity;
  waste: DeficitSeverity;
}

export interface District {
  id: string;
  type: DistrictType;
  footprint: TileRect;
  tiles: TileCoord[];
  level: 1 | 2 | 3 | 4 | 5;
  population: number;
  jobs: number;
  satisfaction: number;
  attractiveness: number;
  powerDemand: number;
  waterDemand: number;
  wasteDemand: number;
  transportDemand: number;
  serviceScore: number;
  growthProgress: number;
  activeEventIds: string[];
  operationalEfficiency: number;
  serviceCoverage: ServiceCoverage;
  deficits: UtilityDeficitState;
  congestionPenalty: number;
  demandScore: DistrictDemandScore;
}

export interface UtilityBuilding {
  id: string;
  type: UtilityType;
  footprint: TileRect;
  serviceRadius?: number;
  capacity?: number;
}

export interface RoadNode extends TileCoord {
  id: string;
  connectedEdgeIds: string[];
  isCoastlineNode: boolean;
}

export interface RoadEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  path: TileCoord[];
  length: number;
  capacity: number;
  load: number;
  congestion: number;
}

export interface TramStop {
  id: string;
  nodeId: string;
}

export interface TramLine {
  id: string;
  stopIds: string[];
  edgeIds: string[];
  lineFrequency: number;
  capacityContribution: number;
}

export interface FerryDock {
  id: string;
  nodeId: string;
  position: TileCoord;
}

export interface FerryRoute {
  id: string;
  dockAId: string;
  dockBId: string;
  length: number;
  fixedFrequency: number;
  capacityContribution: number;
}

export interface SimEvent {
  id: string;
  type: EventType;
  startTick: number;
  endTick: number;
  affectedDistrictIds: string[];
}

export interface TimelineEntry {
  id: string;
  tick: number;
  type: "event" | "system";
  title: string;
  detail: string;
}

export interface WeatherStateSnapshot {
  state: WeatherState;
  remainingTicks: number;
  tendencySeed: number;
}

export interface GameClock {
  tick: number;
  day: number;
  hour: number;
  minute: number;
}

export interface UtilityNetworkState {
  power: { supply: number; demand: number; deficitRatio: number };
  water: { supply: number; demand: number; deficitRatio: number };
  waste: { supply: number; demand: number; deficitRatio: number };
}

export interface TrafficState {
  averageCongestion: number;
  severeEdgeIds: string[];
  highTrafficAverageCongestion: number;
}

export interface ActorSpawnTargets {
  cars: number;
  trams: number;
  ferries: number;
}

export interface SimulationRuntimeState {
  severePowerDeficitTicks: number;
  highCongestionTicks: number;
  recoveredCongestionTicks: number;
}

export interface WorldMetadata {
  seed: string;
  worldName: string;
  generatedAtTick: number;
}

export interface WorldState {
  metadata: WorldMetadata;
  terrain: TileMap;
  districts: District[];
  utilities: UtilityBuilding[];
  roadNodes: RoadNode[];
  roadEdges: RoadEdge[];
  tramStops: TramStop[];
  tramLines: TramLine[];
  ferryDocks: FerryDock[];
  ferryRoutes: FerryRoute[];
  weather: WeatherStateSnapshot;
  events: SimEvent[];
  timeline: TimelineEntry[];
  utilitiesState: UtilityNetworkState;
  traffic: TrafficState;
  actorTargets: ActorSpawnTargets;
  runtime: SimulationRuntimeState;
  clock: GameClock;
}

export interface SelectionState {
  kind: SelectionKind;
  entityId: string;
}

export interface CameraState {
  target: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  distance: number;
  cinematic: boolean;
  hudHidden: boolean;
}

export interface OverlayState {
  active: OverlayKind;
}

export interface PersistenceStatus {
  lastAutosaveAt?: number;
  activeSlotId?: string;
  pending: boolean;
  error?: string;
}

export interface WorldSummary {
  districtCountByType: Record<DistrictType, number>;
  districtCountByLevel: Record<1 | 2 | 3 | 4 | 5, number>;
  utilityCountByType: Record<UtilityType, number>;
  averageSatisfaction: number;
  averageCongestion: number;
}
