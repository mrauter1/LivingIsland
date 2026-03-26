import { useAppStore } from "../../app/store/appStore";

export function OverlayLegend() {
  const overlay = useAppStore((state) => state.overlay);
  if (overlay === "none") {
    return null;
  }
  return <div className="overlay-legend">{`Overlay: ${overlay}`}</div>;
}
