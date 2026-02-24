import { NEXUS_BREACHED_FILL, NEXUS_CLEAR_FILL } from "../globe/styles";

const items = [
  { color: NEXUS_BREACHED_FILL, label: "Nexus Breached" },
  { color: NEXUS_CLEAR_FILL, label: "No Nexus" },
] as const;

export function NexusLegend() {
  return (
    <div className="nexus-legend">
      <span className="nexus-legend__title">Exposure</span>
      {items.map((item) => (
        <div key={item.label} className="nexus-legend__item">
          <span
            className="nexus-legend__swatch"
            style={{ background: item.color }}
          />
          <span className="nexus-legend__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
