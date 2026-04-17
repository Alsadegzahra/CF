import type { CSSProperties, ReactNode } from "react";

type Variant = "default" | "accent" | "muted" | "outline" | "nav";

type PillProps = {
  children: ReactNode;
  variant?: Variant;
  active?: boolean;
  onClick?: () => void;
  type?: "button" | "span";
  style?: CSSProperties;
};

function pillStyles(variant: Variant, active: boolean, clickable: boolean): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: "var(--cf-radius-pill)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.02em",
    border: "1px solid transparent",
    cursor: clickable ? "pointer" : "default",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
  };

  if (variant === "nav") {
    return {
      ...base,
      background: active ? "var(--cf-nav-active-bg)" : "transparent",
      borderColor: active ? "var(--cf-nav-active-bg)" : "var(--cf-border-strong)",
      color: active ? "var(--cf-nav-active-text)" : "var(--cf-text-secondary)",
    };
  }

  if (variant === "accent") {
    return {
      ...base,
      background: active ? "var(--cf-accent)" : "transparent",
      borderColor: active ? "var(--cf-accent-strong)" : "var(--cf-border-strong)",
      color: active ? "var(--cf-text)" : "var(--cf-text-secondary)",
    };
  }
  if (variant === "outline") {
    return {
      ...base,
      background: active ? "var(--cf-surface-hover)" : "transparent",
      borderColor: "var(--cf-border-strong)",
      color: "var(--cf-text-secondary)",
    };
  }
  if (variant === "muted") {
    return {
      ...base,
      background: "var(--cf-surface)",
      borderColor: "var(--cf-border)",
      color: "var(--cf-text-muted)",
    };
  }
  return {
    ...base,
    background: "var(--cf-surface)",
    borderColor: "var(--cf-border)",
    color: "var(--cf-text-secondary)",
  };
}

export function Pill({
  children,
  variant = "default",
  active = false,
  onClick,
  type = "span",
  style: extra,
}: PillProps) {
  const style = { ...pillStyles(variant, active, Boolean(onClick)), ...extra };
  if (type === "button" || onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...style, font: "inherit" }}>
        {children}
      </button>
    );
  }
  return <span style={style}>{children}</span>;
}
