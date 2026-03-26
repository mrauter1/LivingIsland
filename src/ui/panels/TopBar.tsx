import { useAppStore } from "../../app/store/appStore";

export function TopBar() {
  const world = useAppStore((state) => state.world);
  const simulationSpeed = useAppStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useAppStore((state) => state.setSimulationSpeed);
  const autosave = useAppStore((state) => state.autosave);
  const newWorld = useAppStore((state) => state.newWorld);
  const persistence = useAppStore((state) => state.persistence);

  return (
    <header className="panel top-bar">
      <div>
        <strong>Living Island</strong>
        <span>{world.metadata.worldName}</span>
        <span>Seed {world.metadata.seed}</span>
      </div>
      <div>
        <span>{`Day ${world.clock.day} ${`${world.clock.hour}`.padStart(2, "0")}:${`${world.clock.minute}`.padStart(2, "0")}`}</span>
        <span>{world.weather.state}</span>
      </div>
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
        <button onClick={() => void autosave()} type="button">
          Save
        </button>
        <button onClick={() => newWorld(`${Date.now()}`)} type="button">
          New World
        </button>
        {persistence.pending ? <span>Saving...</span> : null}
        {persistence.error ? <span className="error-text">{persistence.error}</span> : null}
      </div>
    </header>
  );
}
