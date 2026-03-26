import type {
  DistrictType,
  RoadNode,
  SelectionKind,
  TileCoord,
  TileRect,
  UtilityType,
} from "./domain";

export interface EditorSelectionPreview {
  valid: boolean;
  invalidTiles: TileCoord[];
  reason?: string;
}

export interface ZonePlacementPreview extends EditorSelectionPreview {
  kind: "zone";
  districtType: DistrictType;
  rect: TileRect;
}

export interface UtilityPlacementPreview extends EditorSelectionPreview {
  kind: "utility";
  utilityType: UtilityType;
  footprint: TileRect;
}

export interface PathPlacementPreview extends EditorSelectionPreview {
  kind: "road" | "tram" | "ferry";
  path: TileCoord[];
}

export type EditorPlacementPreview =
  | ZonePlacementPreview
  | UtilityPlacementPreview
  | PathPlacementPreview;

export interface InspectorField {
  label: string;
  value: string;
}

export interface InspectorTarget {
  kind: SelectionKind;
  entityId: string;
  title: string;
  subtitle: string;
  focusTile: TileCoord;
  fields: InspectorField[];
}

export interface BuildZoneAction {
  type: "build_zone";
  districtType: DistrictType;
  rect: TileRect;
}

export interface BuildRoadAction {
  type: "build_road";
  path: TileCoord[];
}

export interface BuildTramAction {
  type: "build_tram";
  stopIds: string[];
  edgeIds: string[];
}

export interface PlaceTramStopAction {
  type: "place_tram_stop";
  nodeId: string;
}

export interface BuildFerryAction {
  type: "build_ferry";
  dockIds: [string, string];
}

export interface PlaceFerryDockAction {
  type: "place_ferry_dock";
  nodeId: string;
}

export interface PlaceUtilityAction {
  type: "place_utility";
  utilityType: UtilityType;
  origin: TileCoord;
}

export interface DemolishEntityAction {
  type: "demolish_entity";
  entityId: string;
  entityKind:
    | "district"
    | "road_edge"
    | "tram_line"
    | "ferry_dock"
    | "ferry_route"
    | "utility";
}

export type EditorAction =
  | BuildZoneAction
  | BuildRoadAction
  | PlaceTramStopAction
  | BuildTramAction
  | PlaceFerryDockAction
  | BuildFerryAction
  | PlaceUtilityAction
  | DemolishEntityAction;

export interface PlacementValidatorContext {
  roadNodesById: Record<string, RoadNode>;
}
