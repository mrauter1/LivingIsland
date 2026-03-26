import type { CameraState, WorldState } from "./domain";

export const SAVE_SCHEMA_VERSION = "p0-v2";
export const SAVE_SLOT_IDS = ["autosave", "slot-1", "slot-2", "slot-3"] as const;
export const MANUAL_SAVE_SLOT_IDS = ["slot-1", "slot-2", "slot-3"] as const;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];
export type ManualSaveSlotId = (typeof MANUAL_SAVE_SLOT_IDS)[number];

export interface SavePreferences {
  manualSlotLabels: Record<ManualSaveSlotId, string>;
}

export interface SaveSlotMeta {
  id: SaveSlotId;
  label: string;
  updatedAt: number;
}

export interface SavePayload {
  version: typeof SAVE_SCHEMA_VERSION;
  slot: SaveSlotMeta;
  state: WorldState;
  camera?: CameraState;
}
