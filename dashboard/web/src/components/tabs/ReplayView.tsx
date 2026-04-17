import { useCallback, useRef } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import type { MockMatch } from "../../types";
import { CourtLogoMark } from "../CourtLogoMark";
import { Card } from "../ui/Card";
import { Pill } from "../ui/Pill";

type ReplayViewProps = {
  data: MockMatch;
};

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${f}`;
}

export function ReplayView({ data }: ReplayViewProps) {
  const { t, displayNameForPlayer, displayNameForTeam } = usePreferences();
  const videoRef = useRef<HTMLVideoElement>(null);

  const jumpTo = useCallback((sec: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = sec;
    void el.play().catch(() => {});
  }, []);
  const shareHighlight = useCallback(async (startSec: number, label: string) => {
    const src = data.replay.videoSrc || window.location.href;
    const text = `${label} (${fmtTime(startSec)})`;
    const url = `${src}${src.includes("#") ? "" : `#t=${Math.floor(startSec)}`}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "CourtFlow highlight", text, url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} - ${url}`);
    } catch {
      // ignore
    }
  }, [data.replay.videoSrc]);
  const saveHighlight = useCallback((startSec: number) => {
    const src = data.replay.videoSrc;
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = `highlight_${Math.floor(startSec)}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [data.replay.videoSrc]);

  const { videoSrc } = data.replay;
  const teamA = data.lineup.players.filter((p) => p.team === "A");
  const teamB = data.lineup.players.filter((p) => p.team === "B");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 pb-28 pt-2 sm:max-w-2xl">
      <p className="text-sm leading-relaxed text-cf-secondary">{t("replay.simpleIntro")}</p>

      <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-cf-muted">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-cf-navy/80">
            <CourtLogoMark url={data.courtLogoUrl ?? null} alt={t("shell.courtLogoAlt")} className="mr-1.5 h-5 w-5 rounded-md text-[11px]" />
            {t("replay.contextCourt")}: {data.courtId}
          </span>
          <span className="text-cf-muted/80">·</span>
          <span className="max-w-[min(100%,280px)] truncate rounded-md border border-cf-line px-2 py-0.5 font-mono text-cf-navy/80">
            {t("replay.contextMatch")}: {data.matchId}
          </span>
        </div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("replay.lineupHint")}</p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-snug text-cf-navy">
          <span className="font-bold text-cf-navy/90">{displayNameForTeam("A")}</span>
          <span className="text-cf-muted">:</span>
          <span>
            {teamA.map((p) => displayNameForPlayer(p.id, p.label)).join(" · ")}
          </span>
          <span className="mx-1 font-semibold text-cf-muted">{t("summary.vs")}</span>
          <span className="font-bold text-cf-navy/90">{displayNameForTeam("B")}</span>
          <span className="text-cf-muted">:</span>
          <span>
            {teamB.map((p) => displayNameForPlayer(p.id, p.label)).join(" · ")}
          </span>
        </div>
      </section>

      <Card padding="md">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 12 }}>{t("replay.videoPlayer")}</div>
        <div
          style={{
            borderRadius: "var(--cf-radius-sm)",
            overflow: "hidden",
            background: "#000",
            border: "1px solid var(--cf-border)",
            aspectRatio: "16 / 9",
            maxHeight: 420,
            position: "relative",
          }}
        >
          {videoSrc ? (
            <video
              ref={videoRef}
              controls
              aria-label={t("replay.videoAria")}
              style={{ width: "100%", height: "100%", display: "block", maxHeight: 420 }}
              src={videoSrc}
            />
          ) : (
            <div
              style={{
                height: "100%",
                minHeight: 200,
                display: "grid",
                placeItems: "center",
                color: "var(--cf-text-muted)",
                fontSize: 14,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 8 }}>{t("replay.noSourceTitle")}</div>
                <p style={{ margin: 0, lineHeight: 1.55 }}>{t("replay.noSourceHint")}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card padding="md">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 4 }}>{t("replay.highlightsTitle")}</div>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--cf-text-muted)" }}>{t("replay.highlightsSimpleSubtitle")}</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {data.replay.highlights.map((h) => (
            <li
              key={h.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "var(--cf-surface)",
                border: "1px solid var(--cf-border)",
                borderRadius: "var(--cf-radius-sm)",
              }}
            >
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontWeight: 600, color: "var(--cf-text)", marginBottom: 4 }}>{h.label}</div>
                <div style={{ fontSize: 12, color: "var(--cf-text-muted)" }}>
                  <span style={{ marginRight: 6 }}>{t("replay.timeRange")}:</span>
                  {fmtTime(h.startSec)} → {fmtTime(h.endSec)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Pill variant="outline" onClick={() => jumpTo(h.startSec)}>
                  {t("replay.jump")}
                </Pill>
                <Pill variant="outline" onClick={() => saveHighlight(h.startSec)}>
                  {t("replay.save")}
                </Pill>
                <Pill variant="outline" onClick={() => shareHighlight(h.startSec, h.label)}>
                  {t("replay.share")}
                </Pill>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
