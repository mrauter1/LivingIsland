import { deriveWorldVitals, useAppStore } from "../app/store/appStore";
import { deriveInspectorTarget } from "../simulation/core/editing";

export function DebugPanel() {
  const world = useAppStore((state) => state.world);
  const selection = useAppStore((state) => state.selection);
  const simulationSpeed = useAppStore((state) => state.simulationSpeed);
  const hudHidden = useAppStore((state) => state.camera.hudHidden);
  const vitals = deriveWorldVitals(world);
  const inspector = deriveInspectorTarget(world, selection);

  if (!import.meta.env.DEV || hudHidden) {
    return null;
  }

  return (
    <aside className="debug-panel">
      <strong>Debug</strong>
      <div>{`Seed: ${world.metadata.seed}`}</div>
      <div>{`Tick: ${world.clock.tick}`}</div>
      <div>{`Time: Day ${world.clock.day} ${`${world.clock.hour}`.padStart(2, "0")}:${`${world.clock.minute}`.padStart(2, "0")}`}</div>
      <div>{`Weather: ${world.weather.state}`}</div>
      <div>{`Active events: ${world.events.length}`}</div>
      <div>{`Power: ${vitals.power.supply}/${vitals.power.demand}`}</div>
      <div>{`Water: ${vitals.water.supply}/${vitals.water.demand}`}</div>
      <div>{`Waste: ${vitals.waste.supply}/${vitals.waste.demand}`}</div>
      <div>{`Average congestion: ${world.traffic.averageCongestion.toFixed(2)}`}</div>
      <div>{`Residential districts: ${vitals.summary.districtCountByType.residential}`}</div>
      <div>{`Commercial districts: ${vitals.summary.districtCountByType.commercial}`}</div>
      <div>{`Industrial districts: ${vitals.summary.districtCountByType.industrial}`}</div>
      <div>{`Leisure districts: ${vitals.summary.districtCountByType.leisure}`}</div>
      <div>{`District levels: ${Object.entries(vitals.summary.districtCountByLevel).map(([level, count]) => `${level}:${count}`).join(" ")}`}</div>
      <div>{`Selected speed: ${simulationSpeed}`}</div>
      {inspector?.kind === "district" ? (
        <div className="debug-panel__selection">
          <strong>{inspector.title}</strong>
          {inspector.fields.map((field) => (
            <div key={field.label}>{`${field.label}: ${field.value}`}</div>
          ))}
        </div>
      ) : (
        <div className="debug-panel__selection">Select a district to inspect district diagnostics.</div>
      )}
    </aside>
  );
}
