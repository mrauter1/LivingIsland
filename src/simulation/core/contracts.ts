import type { CameraState, OverlayKind, SavePayload, TerrainClass, TileCoord, WorldState } from "../../types";
import type { EditorAction } from "../../types";

export interface SimConfig {
  speed: number;
}

export interface PresentationTile {
  x: number;
  y: number;
  elevation: number;
  terrain: TerrainClass;
  coastline: boolean;
}

export interface PresentationDistrict {
  id: string;
  type: WorldState["districts"][number]["type"];
  footprint: { x: number; y: number; width: number; height: number };
  level: number;
  efficiency: number;
  saturation: number;
  activity: number;
  blackout: boolean;
  onFire: boolean;
  overlayMetrics: {
    traffic: number;
    power: number;
    water: number;
    satisfaction: number;
  };
}

export interface PresentationUtility {
  id: string;
  type: WorldState["utilities"][number]["type"];
  footprint: { x: number; y: number; width: number; height: number };
}

export interface PresentationRoadEdge {
  id: string;
  path: TileCoord[];
  congestion: number;
}

export interface PresentationTramLine {
  id: string;
  path: TileCoord[];
}

export interface PresentationFerryRoute {
  id: string;
  from: TileCoord;
  to: TileCoord;
}

export interface PresentationState {
  worldName: string;
  seed: string;
  weather: WorldState["weather"]["state"];
  clockLabel: string;
  dayProgress: number;
  overlay: OverlayKind;
  averageCongestion: number;
  ferryEfficiency: number;
  tiles: PresentationTile[];
  districts: PresentationDistrict[];
  utilities: PresentationUtility[];
  roadEdges: PresentationRoadEdge[];
  tramLines: PresentationTramLine[];
  ferryRoutes: PresentationFerryRoute[];
  actors: WorldState["actorTargets"];
}

export interface RendererFrameInput {
  presentation: PresentationState;
  camera: CameraState;
}

export interface SimulationKernel {
  createInitialWorld(seed: string): WorldState;
  stepWorld(state: WorldState, dtTicks: number, config: SimConfig): WorldState;
  applyEditorAction(state: WorldState, action: EditorAction): WorldState;
  derivePresentation(state: WorldState, overlay: OverlayKind): PresentationState;
  serializeSave(state: WorldState, slotId: SavePayload["slot"]["id"], camera?: CameraState): SavePayload;
  hydrateSave(payload: SavePayload): WorldState;
}
