import { summarizeWorld, useAppStore } from "../../app/store/appStore";
import { deriveInspectorTarget } from "../../simulation/core/editing";

export function RightInspectorPanel() {
  const selection = useAppStore((state) => state.selection);
  const world = useAppStore((state) => state.world);
  const focusSelection = useAppStore((state) => state.focusSelection);
  const summary = summarizeWorld(world);
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
          <span>{`Residential districts: ${summary.districtCountByType.residential}`}</span>
          <span>{`Commercial districts: ${summary.districtCountByType.commercial}`}</span>
          <span>{`Industrial districts: ${summary.districtCountByType.industrial}`}</span>
          <span>{`Leisure districts: ${summary.districtCountByType.leisure}`}</span>
          <span>{`Avg. satisfaction: ${summary.averageSatisfaction.toFixed(1)}`}</span>
          <span>{`Avg. congestion: ${(summary.averageCongestion * 100).toFixed(0)}%`}</span>
          <span>{`Active events: ${world.events.length}`}</span>
          <span>{`Weather: ${world.weather.state}`}</span>
        </div>
      )}
    </aside>
  );
}
