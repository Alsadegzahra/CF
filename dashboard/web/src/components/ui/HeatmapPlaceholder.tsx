import { useState } from "react";
import { usePreferences } from "../../context/PreferencesContext";

type HeatmapPlaceholderProps = {
  /** Full URL to heatmap PNG from API or R2; if missing or load fails, show decorative mock */
  imageUrl?: string | null;
  /** Draw only a net reference line on top of the heatmap. */
  showZoneOverlay?: boolean;
};

export function HeatmapPlaceholder({ imageUrl, showZoneOverlay = true }: HeatmapPlaceholderProps) {
  const { t } = usePreferences();
  const [imgError, setImgError] = useState(false);
  const showImg = Boolean(imageUrl) && !imgError;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--cf-radius-sm)",
        overflow: "hidden",
        background: "var(--cf-bg-subtle)",
        border: "1px solid var(--cf-border)",
        aspectRatio: "16 / 10",
        maxHeight: 320,
      }}
    >
      {showImg ? (
        <img
          src={imageUrl!}
          alt="Court heatmap"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#f8fafc" }}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 55% 44%, rgba(239,68,68,0.26), transparent 36%), radial-gradient(circle at 35% 65%, rgba(251,191,36,0.22), transparent 34%), #f8fafc",
          }}
        />
      )}

      {showZoneOverlay ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            style={{
              position: "absolute",
              left: "3%",
              right: "3%",
              top: "50%",
              height: 0,
              borderTop: "2px solid rgba(22,163,74,0.95)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.5)",
            }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 12,
          right: 12,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--cf-text-muted)",
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 12px",
          alignItems: "baseline",
        }}
      >
        <span>{showImg ? "Heatmap" : t("analysis.heatmap")}</span>
        {showZoneOverlay ? (
          <span style={{ fontWeight: 500, letterSpacing: "0.02em", textTransform: "none", fontSize: 9, opacity: 0.92 }}>
            Net line only
          </span>
        ) : null}
        {!showImg ? (
          <span style={{ fontWeight: 500, letterSpacing: "0.04em", textTransform: "none", fontSize: 9, opacity: 0.85 }}>
            Placeholder · Phase 1
          </span>
        ) : null}
      </div>
    </div>
  );
}
