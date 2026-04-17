import { useId } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import { NET_Y_HI, NET_Y_LOW, SERVICE_LINE_NORM } from "../../lib/courtZoneGeometry";

const VB_W = 100;
const VB_H = 200;
const M = 3;
const INNER_X = M;
const INNER_Y = M;
const INNER_W = VB_W - 2 * M;
const INNER_H = VB_H - 2 * M;

type LiveCourtZoneMapProps = {
  /** `overlay`: semi-transparent on top of heatmap; `standalone`: neutral background */
  variant?: "overlay" | "standalone";
  className?: string;
};

/**
 * Schematic full court with six tactical zones (team half A/B × back/mid/net).
 * Matches overlay video + spatial._zone_index (x ignored).
 */
export function LiveCourtZoneMap({ variant = "standalone", className }: LiveCourtZoneMapProps) {
  const { t } = usePreferences();
  const uid = useId().replace(/:/g, "");
  const sl = SERVICE_LINE_NORM;
  /** Map normalized court y [0,1] to SVG y inside the inner court box. */
  const innerY = (yn: number) => INNER_Y + yn * INNER_H;
  const yBottom = INNER_Y + INNER_H;
  const ySl = innerY(sl);
  const yNl = innerY(NET_Y_LOW);
  const yNet = innerY(0.5);
  const yNh = innerY(NET_Y_HI);
  const ySr = innerY(1 - sl);

  const isOverlay = variant === "overlay";
  const strokeCourt = isOverlay ? "rgba(255,255,255,0.88)" : "rgba(15,23,42,0.2)";
  const strokeZone = isOverlay ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.14)";
  const strokeNet = isOverlay ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.35)";
  const fillA = isOverlay ? "rgba(59,130,246,0.04)" : "rgba(59,130,246,0.09)";
  const fillB = isOverlay ? "rgba(245,158,11,0.04)" : "rgba(245,158,11,0.09)";
  const textFill = isOverlay ? "rgba(255,255,255,0.95)" : "rgba(51,65,85,0.92)";
  const textStroke = isOverlay ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)";
  const bg = isOverlay ? "transparent" : "rgba(248,250,252,0.96)";

  const labels = [
    t("analysis.zoneMapAbbr0"),
    t("analysis.zoneMapAbbr1"),
    t("analysis.zoneMapAbbr2"),
    t("analysis.zoneMapAbbr3"),
    t("analysis.zoneMapAbbr4"),
    t("analysis.zoneMapAbbr5"),
  ];

  const cx = INNER_X + INNER_W / 2;
  const positions: { x: number; y: number; i: number }[] = [
    { x: cx, y: (INNER_Y + ySl) / 2, i: 0 },
    { x: cx, y: (ySl + yNl) / 2, i: 1 },
    { x: cx, y: (yNl + yNet) / 2, i: 2 },
    { x: cx, y: (yNet + yNh) / 2, i: 5 },
    { x: cx, y: (yNh + ySr) / 2, i: 4 },
    { x: cx, y: (ySr + yBottom) / 2, i: 3 },
  ];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={className}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
      aria-hidden
    >
      <defs>
        <filter id={`zshadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodOpacity={isOverlay ? 0.7 : 0.25} />
        </filter>
      </defs>
      <rect width={VB_W} height={VB_H} fill={bg} rx={4} />

      {/* Team A half tint */}
      <rect x={INNER_X} y={INNER_Y} width={INNER_W} height={yNet - INNER_Y} fill={fillA} />
      {/* Team B half tint */}
      <rect x={INNER_X} y={yNet} width={INNER_W} height={yBottom - yNet} fill={fillB} />

      {/* Zone band shading (subtle stripes per depth) */}
      <rect x={INNER_X} y={INNER_Y} width={INNER_W} height={ySl - INNER_Y} fill={isOverlay ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)"} />
      <rect x={INNER_X} y={ySr} width={INNER_W} height={yBottom - ySr} fill={isOverlay ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)"} />

      <rect
        x={INNER_X}
        y={INNER_Y}
        width={INNER_W}
        height={INNER_H}
        fill="none"
        stroke={strokeCourt}
        strokeWidth={isOverlay ? 1.2 : 1}
        rx={3}
      />

      {/* Service lines + net */}
      <line x1={INNER_X} y1={ySl} x2={INNER_X + INNER_W} y2={ySl} stroke={strokeNet} strokeWidth={isOverlay ? 1 : 0.9} opacity={0.95} />
      <line x1={INNER_X} y1={ySr} x2={INNER_X + INNER_W} y2={ySr} stroke={strokeNet} strokeWidth={isOverlay ? 1 : 0.9} opacity={0.95} />
      <line x1={INNER_X} y1={yNet} x2={INNER_X + INNER_W} y2={yNet} stroke={strokeNet} strokeWidth={isOverlay ? 1.4 : 1.2} />
      {/* Center service line */}
      <line x1={VB_W / 2} y1={ySl} x2={VB_W / 2} y2={ySr} stroke={strokeZone} strokeWidth={0.7} strokeDasharray="2 2" opacity={0.9} />

      {/* Zone dividers (mid vs net) */}
      <line x1={INNER_X} y1={yNl} x2={INNER_X + INNER_W} y2={yNl} stroke={strokeZone} strokeWidth={0.6} />
      <line x1={INNER_X} y1={yNh} x2={INNER_X + INNER_W} y2={yNh} stroke={strokeZone} strokeWidth={0.6} />

      {positions.map(({ x, y, i }) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textFill}
          stroke={textStroke}
          strokeWidth={0.35}
          paintOrder="stroke fill"
          fontSize={8.5}
          fontWeight={700}
          letterSpacing="-0.02em"
          style={{ fontFamily: "system-ui, sans-serif" }}
          filter={isOverlay ? `url(#zshadow-${uid})` : undefined}
        >
          {labels[i] ?? ""}
        </text>
      ))}
    </svg>
  );
}
