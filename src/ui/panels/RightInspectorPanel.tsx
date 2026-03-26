import { deriveRecentAlerts, deriveWorldVitals, useAppStore } from "../../app/store/appStore";
import { deriveInspectorTarget } from "../../simulation/core/editing";

export function RightInspectorPanel() {
  const selection = useAppStore((state) => state.selection);
  const world = useAppStore((state) => state.world);
  const focusSelection = useAppStore((state) => state.focusSelection);
  const vitals = deriveWorldVitals(world);
  const alerts = deriveRecentAlerts(world);
  const inspector = deriveInspectorTarget(world, selection);

  return (
    <aside className="panel right-panel">
      <h2>{inspector ? "Inspector" : "World Summary"}</h2>
      {inspector ? (
        <div className="stack">
          <strong>{inspector.title}</strong>
          <span>{inspector.subtitle}</span>
          {inspector.fields.map((field) => (
            <span key={field.label}>{`${field.label}: ${field.value}`}</span>
          ))}
          <button onClick={() => focusSelection()} type="button">
            focus camera
          </button>
        </div>
      ) : (
        <div className="stack">
          <strong>Citywide</strong>
          <span>{`Population: ${vitals.population}`}</span>
          <span>{`Jobs: ${vitals.jobs}`}</span>
          <span>{`Avg. satisfaction: ${vitals.summary.averageSatisfaction.toFixed(1)}`}</span>
          <span>{`Avg. congestion: ${(vitals.summary.averageCongestion * 100).toFixed(0)}%`}</span>
          <span>{`Active events: ${vitals.activeEvents}`}</span>
          <span>{`Weather: ${world.weather.state}`}</span>
          <span>{`Power: ${vitals.power.supply}/${vitals.power.demand}`}</span>
          <span>{`Water: ${vitals.water.supply}/${vitals.water.demand}`}</span>
          <span>{`Waste: ${vitals.waste.supply}/${vitals.waste.demand}`}</span>
          <strong>Districts</strong>
          <span>{`Residential: ${vitals.summary.districtCountByType.residential}`}</span>
          <span>{`Commercial: ${vitals.summary.districtCountByType.commercial}`}</span>
          <span>{`Industrial: ${vitals.summary.districtCountByType.industrial}`}</span>
          <span>{`Leisure: ${vitals.summary.districtCountByType.leisure}`}</span>
          <strong>Active Alerts</strong>
          {alerts.length > 0 ? alerts.map((alert) => <span key={alert.id}>{`${alert.title}: ${alert.remainingTicks} ticks left`}</span>) : <span>No active alerts.</span>}
        </div>
      )}
    </aside>
  );
}
