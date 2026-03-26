import { useEffect, useState } from "react";
import type { ManualSaveSlotId } from "../../types";
import { deriveSaveSlotEntries, deriveWorldVitals, type SaveSlotEntry, useAppStore } from "../../app/store/appStore";

function formatUpdatedAt(updatedAt?: number): string {
  if (!updatedAt) {
    return "Empty";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(updatedAt);
}

function formatClock(day: number, hour: number, minute: number): string {
  return `Day ${day} ${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
}

function manualSlotInputLabel(slotId: ManualSaveSlotId): string {
  return `${slotId} name`;
}

function SaveSlotRow({
  slot,
  activeSlotId,
  manualLabel,
  onLabelChange,
  onLoad,
  onSave,
}: {
  slot: SaveSlotEntry;
  activeSlotId?: string;
  manualLabel?: string;
  onLabelChange?: (label: string) => void;
  onLoad: () => void;
  onSave?: () => void;
}) {
  const isActive = activeSlotId === slot.id;

  return (
    <div className={`save-slot-row${isActive ? " active" : ""}`}>
      <div className="save-slot-row__meta">
        <strong>{slot.id === "autosave" ? "Autosave" : slot.label}</strong>
        <span>{formatUpdatedAt(slot.updatedAt)}</span>
      </div>
      {slot.id !== "autosave" && onLabelChange ? (
        <input
          aria-label={manualSlotInputLabel(slot.id)}
          className="save-slot-row__input"
          onChange={(event) => onLabelChange(event.target.value)}
          type="text"
          value={manualLabel ?? slot.label}
        />
      ) : null}
      <div className="save-slot-row__actions">
        {onSave ? (
          <button onClick={onSave} type="button">
            Save
          </button>
        ) : null}
        <button disabled={!slot.occupied} onClick={onLoad} type="button">
          Load
        </button>
      </div>
    </div>
  );
}

export function TopBar() {
  const world = useAppStore((state) => state.world);
  const camera = useAppStore((state) => state.camera);
  const simulationSpeed = useAppStore((state) => state.simulationSpeed);
  const saveSlots = useAppStore((state) => state.saveSlots);
  const manualSlotLabels = useAppStore((state) => state.manualSlotLabels);
  const persistence = useAppStore((state) => state.persistence);
  const setSimulationSpeed = useAppStore((state) => state.setSimulationSpeed);
  const setCamera = useAppStore((state) => state.setCamera);
  const autosave = useAppStore((state) => state.autosave);
  const saveToSlot = useAppStore((state) => state.saveToSlot);
  const loadSave = useAppStore((state) => state.loadSave);
  const setManualSaveSlotLabel = useAppStore((state) => state.setManualSaveSlotLabel);
  const newWorld = useAppStore((state) => state.newWorld);
  const [seedInput, setSeedInput] = useState(world.metadata.seed);

  const vitals = deriveWorldVitals(world);
  const slotEntries = deriveSaveSlotEntries(saveSlots, manualSlotLabels);
  const normalizedSeedInput = seedInput.trim();

  useEffect(() => {
    setSeedInput(world.metadata.seed);
  }, [world.metadata.seed]);

  const handleGenerateWorld = () => {
    newWorld(normalizedSeedInput || world.metadata.seed);
  };

  return (
    <header className="panel top-bar">
      <div className="top-bar__headline">
        <div className="top-bar__identity">
          <span className="eyebrow">Living Island</span>
          <strong>{world.metadata.worldName}</strong>
          <span>{`Seed ${world.metadata.seed}`}</span>
        </div>
        <div className="top-bar__status">
          <span>{formatClock(world.clock.day, world.clock.hour, world.clock.minute)}</span>
          <span>{`Weather ${world.weather.state}`}</span>
          <span>{`Population ${vitals.population}`}</span>
          <span>{`Jobs ${vitals.jobs}`}</span>
          <span>{`Satisfaction ${vitals.summary.averageSatisfaction.toFixed(0)}%`}</span>
          <span>{`Congestion ${(vitals.summary.averageCongestion * 100).toFixed(0)}%`}</span>
        </div>
      </div>

      <div className="top-bar__controls">
        <div className="toolbar-row">
          {(["pause", "1x", "4x", "16x", "timelapse"] as const).map((speed) => (
            <button
              className={simulationSpeed === speed ? "active" : ""}
              key={speed}
              onClick={() => setSimulationSpeed(speed)}
              type="button"
            >
              {speed}
            </button>
          ))}
        </div>
        <div className="toolbar-row">
          <button
            className={camera.cinematic ? "active" : ""}
            onClick={() => setCamera({ cinematic: !camera.cinematic })}
            type="button"
          >
            Cinematic
          </button>
          <button onClick={() => void autosave()} type="button">
            Autosave Now
          </button>
          <button onClick={() => setCamera({ hudHidden: !camera.hudHidden })} type="button">
            Photo Mode
          </button>
        </div>
        <div className="toolbar-row toolbar-row--seed">
          <label className="seed-input">
            <span>Seed</span>
            <input
              aria-label="World seed"
              onChange={(event) => setSeedInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleGenerateWorld();
                }
              }}
              type="text"
              value={seedInput}
            />
          </label>
          <button onClick={handleGenerateWorld} type="button">
            Generate World
          </button>
          <button onClick={() => newWorld(`${Date.now()}`)} type="button">
            Surprise Me
          </button>
        </div>
        <div className="toolbar-row toolbar-row--metrics">
          <span>{`Power ${vitals.power.supply}/${vitals.power.demand}`}</span>
          <span>{`Water ${vitals.water.supply}/${vitals.water.demand}`}</span>
          <span>{`Waste ${vitals.waste.supply}/${vitals.waste.demand}`}</span>
          <span>{`Active events ${vitals.activeEvents}`}</span>
        </div>
      </div>

      <div className="save-bank">
        {slotEntries.map((slot) =>
          slot.id === "autosave" ? (
            <SaveSlotRow
              activeSlotId={persistence.activeSlotId}
              key={slot.id}
              onLoad={() => void loadSave(slot.id)}
              slot={slot}
            />
          ) : (
            <SaveSlotRow
              activeSlotId={persistence.activeSlotId}
              key={slot.id}
              manualLabel={manualSlotLabels[slot.id as ManualSaveSlotId]}
              onLabelChange={(label) => setManualSaveSlotLabel(slot.id as ManualSaveSlotId, label)}
              onLoad={() => void loadSave(slot.id)}
              onSave={() => void saveToSlot(slot.id as ManualSaveSlotId)}
              slot={slot}
            />
          ),
        )}
      </div>

      <div className="top-bar__footer">
        <span>{persistence.pending ? "Saving or loading..." : `Autosave ${formatUpdatedAt(persistence.lastAutosaveAt)}`}</span>
        {persistence.error ? <span className="error-text">{persistence.error}</span> : null}
      </div>
    </header>
  );
}
