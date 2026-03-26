import { deriveRecentAlerts, useAppStore } from "../../app/store/appStore";

export function BottomTimeline() {
  const world = useAppStore((state) => state.world);
  const camera = useAppStore((state) => state.camera);
  const simulationSpeed = useAppStore((state) => state.simulationSpeed);
  const setSelection = useAppStore((state) => state.setSelection);
  const recentTimeline = world.timeline.slice(-5).reverse();
  const alerts = deriveRecentAlerts(world);

  return (
    <footer className="panel bottom-strip">
      <section className="timeline-column">
        <h2>Timeline</h2>
        <div className="timeline-column__list">
          {recentTimeline.map((entry) => (
            <article className="timeline-entry" key={entry.id}>
              <strong>{entry.title}</strong>
              <span>{entry.detail}</span>
              <span>{`Tick ${entry.tick}`}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="alerts-column">
        <h2>Recent Alerts</h2>
        <div className="alerts-column__list">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <button
                className={`alert-card alert-${alert.severity}`}
                key={alert.id}
                onClick={() => setSelection({ kind: "event", entityId: alert.id })}
                type="button"
              >
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
                <span>{`${alert.remainingTicks} ticks remaining`}</span>
              </button>
            ))
          ) : (
            <div className="timeline-entry timeline-entry--quiet">
              <strong>Stable conditions</strong>
              <span>No active weather or infrastructure incidents.</span>
            </div>
          )}
        </div>
      </section>

      <section className="indicator-column">
        <h2>Indicators</h2>
        <div className="indicator-card">
          <strong>{simulationSpeed === "timelapse" ? "Timelapse active" : "Realtime view"}</strong>
          <span>{`Speed ${simulationSpeed}`}</span>
        </div>
        <div className={`indicator-card${camera.cinematic ? " active" : ""}`}>
          <strong>{camera.cinematic ? "Cinematic camera" : "Manual camera"}</strong>
          <span>{camera.cinematic ? "Orbit motion is enabled." : "User camera control is active."}</span>
        </div>
        <div className="indicator-card">
          <strong>{`Day ${world.clock.day}`}</strong>
          <span>{`${`${world.clock.hour}`.padStart(2, "0")}:${`${world.clock.minute}`.padStart(2, "0")}`}</span>
        </div>
      </section>
    </footer>
  );
}
