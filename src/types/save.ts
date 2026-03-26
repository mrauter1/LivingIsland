import type { CameraState, WorldState } from "./domain";

export const SAVE_SCHEMA_VERSION = "p0-v2";

export interface SaveSlotMeta {
  id: "autosave" | "slot-1" | "slot-2" | "slot-3";
  label: string;
  updatedAt: number;
}

export interface SavePayload {
  version: typeof SAVE_SCHEMA_VERSION;
  slot: SaveSlotMeta;
  state: WorldState;
  camera?: CameraState;
}
