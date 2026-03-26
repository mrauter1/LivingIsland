import { beforeEach, describe, expect, it } from "vitest";
import { simulationKernel } from "../simulation/core/engine";
import { DEFAULT_CAMERA_STATE } from "../world/camera/contracts";
import { listSlots, loadSavePreferences, loadSlot, saveSavePreferences, saveSlot } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps save payloads out of localStorage in test mode and returns cloned slot data", async () => {
    const payload = simulationKernel.serializeSave(
      simulationKernel.createInitialWorld("storage-slot-seed"),
      "slot-1",
      DEFAULT_CAMERA_STATE,
    );
    payload.slot.label = "Storage Slot";

    await saveSlot(payload);

    expect(window.localStorage.length).toBe(0);

    const loaded = await loadSlot("slot-1");
    expect(loaded?.slot.label).toBe("Storage Slot");

    if (!loaded) {
      throw new Error("Expected slot-1 to load in test storage.");
    }

    loaded.slot.label = "Mutated in test";
    const reloaded = await loadSlot("slot-1");
    expect(reloaded?.slot.label).toBe("Storage Slot");

    const slots = await listSlots();
    expect(slots.some((slot) => slot.id === "slot-1" && slot.label === "Storage Slot")).toBe(true);
  });

  it("loads default preferences when slot labels are missing or invalid", () => {
    expect(loadSavePreferences().manualSlotLabels).toEqual({
      "slot-1": "Slot One",
      "slot-2": "Slot Two",
      "slot-3": "Slot Three",
    });

    window.localStorage.setItem("living-island:save-preferences", "not-json");
    expect(loadSavePreferences().manualSlotLabels["slot-2"]).toBe("Slot Two");

    saveSavePreferences({
      manualSlotLabels: {
        "slot-1": "Alpha",
        "slot-2": "Beta",
        "slot-3": "Gamma",
      },
    });
    expect(loadSavePreferences().manualSlotLabels).toEqual({
      "slot-1": "Alpha",
      "slot-2": "Beta",
      "slot-3": "Gamma",
    });
  });
});
