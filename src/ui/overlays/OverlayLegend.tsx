import { OVERLAY_PALETTE } from "../../simulation/core/constants";
import { useAppStore } from "../../app/store/appStore";

const OVERLAY_COPY = {
  traffic: {
    title: "Traffic",
    labels: ["Light flow", "Heavy flow", "Gridlock"],
  },
  power: {
    title: "Power",
    labels: ["Stable", "Strained", "Outage risk"],
  },
  water: {
    title: "Water",
    labels: ["Stable", "Strained", "Shortfall"],
  },
  satisfaction: {
    title: "Satisfaction",
    labels: ["Low", "Mixed", "High"],
  },
} as const;

export function OverlayLegend() {
  const overlay = useAppStore((state) => state.overlay);
  if (overlay === "none") {
    return null;
  }

  const config = OVERLAY_COPY[overlay];
  const colors = OVERLAY_PALETTE[overlay];

  return (
    <div className="overlay-legend">
      <strong>{config.title}</strong>
      <div className="overlay-legend__scale" role="presentation">
        {colors.map((color, index) => (
          <span className="overlay-legend__swatch" key={`${overlay}-${color}`} style={{ ["--legend-color" as string]: color }}>
            {config.labels[index]}
          </span>
        ))}
      </div>
    </div>
  );
}
