import { useId } from "react";

type SparklineMiniProps = {
  values: number[];
  height?: number;
};

export function SparklineMini({ values, height = 40 }: SparklineMiniProps) {
  const gid = useId().replace(/:/g, "");
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = height;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sparkFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cf-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--cf-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#sparkFill-${gid})`}
        points={`0,${h} ${pts} ${w},${h}`}
      />
      <polyline
        fill="none"
        stroke="var(--cf-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}
