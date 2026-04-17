import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  style?: CSSProperties;
};

const pad = { sm: "14px 16px", md: "18px 20px", lg: "22px 24px" };

export function Card({ children, className = "", padding = "md", style }: CardProps) {
  return (
    <div
      className={`cf-card ${className}`.trim()}
      style={{
        background: "var(--cf-elevated)",
        border: "1px solid var(--cf-border)",
        borderRadius: "var(--cf-radius-md)",
        boxShadow: "var(--cf-shadow-card)",
        padding: pad[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
