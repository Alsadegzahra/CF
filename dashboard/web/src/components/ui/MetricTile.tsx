import type { ReactNode } from "react";

type MetricTileProps = {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
};

export function MetricTile({ label, value, hint }: MetricTileProps) {
  return (
    <div
      style={{
        background: "var(--cf-surface)",
        border: "1px solid var(--cf-border)",
        borderRadius: "var(--cf-radius-sm)",
        padding: "14px 16px",
        minHeight: 88,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--cf-text-muted)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 650, color: "var(--cf-text)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {hint ? (
        <div style={{ fontSize: 11, color: "var(--cf-text-muted)", marginTop: 2 }}>{hint}</div>
      ) : null}
    </div>
  );
}
