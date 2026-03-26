import { openDB } from "idb";
import { MANUAL_SAVE_SLOT_IDS, type ManualSaveSlotId, type SavePayload, type SavePreferences, type SaveSlotMeta } from "../types";
import { isSavePayload } from "./saveSchema";

const DB_NAME = "living-island";
const STORE_NAME = "saves";
const SAVE_PREFERENCES_KEY = "living-island:save-preferences";
const TEST_SAVE_STORE = new Map<SaveSlotMeta["id"], SavePayload>();

const DEFAULT_SAVE_PREFERENCES: SavePreferences = {
  manualSlotLabels: {
    "slot-1": "Slot One",
    "slot-2": "Slot Two",
    "slot-3": "Slot Three",
  },
};

async function getDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });
}

function useTestSaveStore(): boolean {
  return import.meta.env.MODE === "test";
}

export async function saveSlot(payload: SavePayload): Promise<void> {
  if (useTestSaveStore()) {
    TEST_SAVE_STORE.set(payload.slot.id, structuredClone(payload));
    return;
  }

  const database = await getDatabase();
  await database.put(STORE_NAME, payload, payload.slot.id);
}

export async function loadSlot(slotId: SaveSlotMeta["id"]): Promise<SavePayload | undefined> {
  if (useTestSaveStore()) {
    const payload = TEST_SAVE_STORE.get(slotId);
    return payload ? structuredClone(payload) : undefined;
  }

  const database = await getDatabase();
  const payload: unknown = await database.get(STORE_NAME, slotId);
  return isSavePayload(payload) ? payload : undefined;
}

export async function listSlots(): Promise<SavePayload["slot"][]> {
  if (useTestSaveStore()) {
    return (["autosave", "slot-1", "slot-2", "slot-3"] as const)
      .map((slotId) => TEST_SAVE_STORE.get(slotId))
      .filter((payload): payload is SavePayload => Boolean(payload))
      .map((payload) => structuredClone(payload.slot));
  }

  const database = await getDatabase();
  const slotIds: SaveSlotMeta["id"][] = ["autosave", "slot-1", "slot-2", "slot-3"];
  const payloads = await Promise.all(slotIds.map((slotId) => database.get(STORE_NAME, slotId)));
  return payloads.filter(isSavePayload).map((payload) => payload.slot);
}

function isManualSlotLabels(value: unknown): value is Record<ManualSaveSlotId, string> {
  if (!value || typeof value !== "object") {
    return false;
  }

  return MANUAL_SAVE_SLOT_IDS.every((slotId) => typeof (value as Record<ManualSaveSlotId, unknown>)[slotId] === "string");
}

export function loadSavePreferences(): SavePreferences {
  if (typeof window === "undefined") {
    return structuredClone(DEFAULT_SAVE_PREFERENCES);
  }

  const rawValue = window.localStorage.getItem(SAVE_PREFERENCES_KEY);
  if (!rawValue) {
    return structuredClone(DEFAULT_SAVE_PREFERENCES);
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (
      parsed &&
      typeof parsed === "object" &&
      "manualSlotLabels" in parsed &&
      isManualSlotLabels((parsed as { manualSlotLabels?: unknown }).manualSlotLabels)
    ) {
      return {
        manualSlotLabels: {
          "slot-1": (parsed as { manualSlotLabels: Record<ManualSaveSlotId, string> }).manualSlotLabels["slot-1"],
          "slot-2": (parsed as { manualSlotLabels: Record<ManualSaveSlotId, string> }).manualSlotLabels["slot-2"],
          "slot-3": (parsed as { manualSlotLabels: Record<ManualSaveSlotId, string> }).manualSlotLabels["slot-3"],
        },
      };
    }
  } catch {
    return structuredClone(DEFAULT_SAVE_PREFERENCES);
  }

  return structuredClone(DEFAULT_SAVE_PREFERENCES);
}

export function saveSavePreferences(preferences: SavePreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SAVE_PREFERENCES_KEY, JSON.stringify(preferences));
}
