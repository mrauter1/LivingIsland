import { useEffect } from "react";
import { BottomTimeline } from "../../ui/panels/BottomTimeline";
import { LeftBuildPanel } from "../../ui/panels/LeftBuildPanel";
import { RightInspectorPanel } from "../../ui/panels/RightInspectorPanel";
import { TopBar } from "../../ui/panels/TopBar";
import { OverlayLegend } from "../../ui/overlays/OverlayLegend";
import { WorldViewport } from "../../ui/components/WorldViewport";
import { useAppStore } from "../store/appStore";
import { DebugPanel } from "../../debug/DebugPanel";

export function ShellRoute() {
  const tick = useAppStore((state) => state.tick);
  const hudHidden = useAppStore((state) => state.camera.hudHidden);
  const handleShortcut = useAppStore((state) => state.handleShortcut);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      tick();
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [tick]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      handleShortcut(event.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleShortcut]);

  return (
    <div className={`app-shell${hudHidden ? " hud-hidden" : ""}`}>
      {!hudHidden ? <TopBar /> : null}
      {!hudHidden ? <LeftBuildPanel /> : null}
      <main className="world-shell">
        <WorldViewport />
        <OverlayLegend />
      </main>
      {!hudHidden ? <RightInspectorPanel /> : null}
      {!hudHidden ? <BottomTimeline /> : null}
      <DebugPanel />
    </div>
  );
}
