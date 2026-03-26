import { summarizeWorld, useAppStore } from "../app/store/appStore";

export function DebugPanel() {
  const world = useAppStore((state) => state.world);
  const simulationSpeed = useAppStore((state) => state.simulationSpeed);
  const summary = summarizeWorld(world);
  const averageEfficiency =
    world.districts.length === 0
      ? 0
      : world.districts.reduce((sum, district) => sum + district.operationalEfficiency, 0) / world.districts.length;

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <aside className="debug-panel">
      <div>{`Seed: ${world.metadata.seed}`}</div>
      <div>{`Tick: ${world.clock.tick}`}</div>
      <div>{`Weather: ${world.weather.state}`}</div>
      <div>{`Active events: ${world.events.length}`}</div>
      <div>{`Power: ${world.utilitiesState.power.supply}/${world.utilitiesState.power.demand}`}</div>
      <div>{`Water: ${world.utilitiesState.water.supply}/${world.utilitiesState.water.demand}`}</div>
      <div>{`Waste: ${world.utilitiesState.waste.supply}/${world.utilitiesState.waste.demand}`}</div>
      <div>{`Average congestion: ${world.traffic.averageCongestion.toFixed(2)}`}</div>
      <div>{`High-traffic congestion: ${world.traffic.highTrafficAverageCongestion.toFixed(2)}`}</div>
      <div>{`Avg. efficiency: ${(averageEfficiency * 100).toFixed(0)}%`}</div>
      <div>{`Residential districts: ${summary.districtCountByType.residential}`}</div>
      <div>{`District levels: ${Object.entries(summary.districtCountByLevel).map(([level, count]) => `${level}:${count}`).join(" ")}`}</div>
      <div>{`Selected speed: ${simulationSpeed}`}</div>
    </aside>
  );
}
