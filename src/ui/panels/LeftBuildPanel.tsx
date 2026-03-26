import { useAppStore } from "../../app/store/appStore";
import type { AppMode, DistrictType, OverlayKind, UtilityType } from "../../types";

const BUILD_MODES: AppMode[] = [
  "inspect",
  "build_zone",
  "build_road",
  "build_tram",
  "build_ferry",
  "place_utility",
  "demolish",
];

const OVERLAYS: OverlayKind[] = ["none", "traffic", "power", "water", "satisfaction"];
const DISTRICT_TYPES: DistrictType[] = ["residential", "commercial", "industrial", "leisure"];
const UTILITY_TYPES: UtilityType[] = ["power_plant", "water_tower", "waste_center", "park", "fire_station"];

export function LeftBuildPanel() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const overlay = useAppStore((state) => state.overlay);
  const setOverlay = useAppStore((state) => state.setOverlay);
  const editor = useAppStore((state) => state.editor);
  const setDistrictType = useAppStore((state) => state.setDistrictType);
  const setUtilityType = useAppStore((state) => state.setUtilityType);
  const finalizeActiveDraft = useAppStore((state) => state.finalizeActiveDraft);
  const cancelDraft = useAppStore((state) => state.cancelDraft);

  return (
    <aside className="panel left-panel">
      <h2>Build</h2>
      <div className="stack">
        {BUILD_MODES.map((candidate) => (
          <button
            className={candidate === mode ? "active" : ""}
            key={candidate}
            onClick={() => setMode(candidate)}
            type="button"
          >
            {candidate.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      {mode === "build_zone" ? (
        <>
          <h3>Zone Type</h3>
          <div className="stack">
            {DISTRICT_TYPES.map((candidate) => (
              <button
                className={candidate === editor.activeDistrictType ? "active" : ""}
                key={candidate}
                onClick={() => setDistrictType(candidate)}
                type="button"
              >
                {candidate}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {mode === "place_utility" ? (
        <>
          <h3>Utility</h3>
          <div className="stack">
            {UTILITY_TYPES.map((candidate) => (
              <button
                className={candidate === editor.activeUtilityType ? "active" : ""}
                key={candidate}
                onClick={() => setUtilityType(candidate)}
                type="button"
              >
                {candidate.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {(mode === "build_road" || mode === "build_tram") && (
        <>
          <h3>Draft</h3>
          <div className="stack">
            <span>
              {mode === "build_road"
                ? `Intersections: ${editor.roadDraft.length}`
                : `Stops: ${editor.tramDraftNodeIds.length}`}
            </span>
            <button onClick={() => finalizeActiveDraft()} type="button">
              finish
            </button>
            <button onClick={() => cancelDraft()} type="button">
              cancel
            </button>
          </div>
        </>
      )}
      {mode === "build_ferry" ? (
        <>
          <h3>Draft</h3>
          <div className="stack">
            <span>{`Selected docks: ${editor.ferryDraftDockIds.length}`}</span>
            <button onClick={() => cancelDraft()} type="button">
              cancel
            </button>
          </div>
        </>
      ) : null}
      <h3>Overlay</h3>
      <div className="stack">
        {OVERLAYS.map((candidate) => (
          <button
            className={candidate === overlay ? "active" : ""}
            key={candidate}
            onClick={() => setOverlay(candidate)}
            type="button"
          >
            {candidate}
          </button>
        ))}
      </div>
      <h3>Shortcuts</h3>
      <div className="stack build-help">
        <span>`I Z R M F U X` switch tools</span>
        <span>`Enter` finishes road and tram drafts</span>
        <span>`Esc` clears the active draft</span>
        <span>`C`, `T`, `H` toggle camera modes</span>
      </div>
      {editor.statusText ? (
        <>
          <h3>Status</h3>
          <div className="stack">
            <span>{editor.statusText}</span>
          </div>
        </>
      ) : null}
    </aside>
  );
}
