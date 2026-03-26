import { openDB } from "idb";
import type { SavePayload, SaveSlotMeta } from "../types";
import { isSavePayload } from "./saveSchema";

const DB_NAME = "living-island";
const STORE_NAME = "saves";

async function getDatabase() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveSlot(payload: SavePayload): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAME, payload, payload.slot.id);
}

export async function loadSlot(slotId: SaveSlotMeta["id"]): Promise<SavePayload | undefined> {
  const database = await getDatabase();
  const payload: unknown = await database.get(STORE_NAME, slotId);
  return isSavePayload(payload) ? payload : undefined;
}

export async function listSlots(): Promise<SavePayload["slot"][]> {
  const database = await getDatabase();
  const slotIds: SaveSlotMeta["id"][] = ["autosave", "slot-1", "slot-2", "slot-3"];
  const payloads = await Promise.all(slotIds.map((slotId) => database.get(STORE_NAME, slotId)));
  return payloads.filter(isSavePayload).map((payload) => payload.slot);
}
