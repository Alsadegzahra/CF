import type { ReactNode } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import type { TabId } from "../../types";
import { LOGO_SRC } from "../../brand";
import { AppTopBar } from "../auth/AppTopBar";
import { CourtLogoMark } from "../CourtLogoMark";
import { SaveMatchStrip } from "../SaveMatchStrip";

type AppShellProps = {
  matchId: string;
  courtId: string;
  /** Resolved image URL (report, local override, or both). */
  courtLogoUrl?: string | null;
  tab: TabId;
  onTab: (t: TabId) => void;
  /** Exit match (e.g. clear query). If omitted, back uses browser history. */
  onBack?: () => void;
  onOpenFriends?: () => void;
  onOpenSavedMatches?: () => void;
  onOpenFeed?: () => void;
  onOpenProfile?: () => void;
  /** Signed-in + match loaded: show "Add to my account" for this match. */
  accountSaveEnabled?: boolean;
  children: ReactNode;
};

const tabs: { id: TabId; labelKey: string }[] = [
  { id: "summary", labelKey: "tab.summary" },
  { id: "analysis", labelKey: "tab.analysis" },
  { id: "replay", labelKey: "tab.replay" },
];

export function AppShell({
  matchId,
  courtId,
  courtLogoUrl = null,
  tab,
  onTab,
  onBack,
  onOpenFriends,
  onOpenSavedMatches,
  onOpenFeed,
  onOpenProfile,
  accountSaveEnabled = false,
  children,
}: AppShellProps) {
  const { t } = usePreferences();

  function handleBack() {
    if (onBack) onBack();
    else window.history.back();
  }

  return (
    <div className="min-h-screen bg-cf-canvas">
      <header className="sticky top-0 z-30 border-b border-cf-line/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-end border-b border-cf-line/70 bg-white/90 px-4 py-2">
          <AppTopBar onOpenFriends={onOpenFriends} onOpenSavedMatches={onOpenSavedMatches} onOpenFeed={onOpenFeed} onOpenProfile={onOpenProfile} />
        </div>
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3 sm:max-w-2xl">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-full text-cf-navy transition hover:bg-slate-100 active:scale-95 rtl:rotate-180"
            aria-label={t("shell.back")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold tracking-tight text-cf-navy">{t("shell.analytics")}</h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-pill border border-cf-lime/60 bg-cf-lime/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-cf-lime-dark">
              {t("shell.advanced")}
            </span>
          </div>
        </div>

        {accountSaveEnabled ? (
          <div className="border-b border-cf-line/60 bg-slate-50/90 px-4 py-2.5">
            <div className="mx-auto max-w-lg sm:max-w-2xl">
              <SaveMatchStrip matchId={matchId} courtId={courtId} />
            </div>
          </div>
        ) : null}

        <nav className="mx-auto flex max-w-lg gap-1.5 px-3 pb-3 sm:max-w-2xl" aria-label={t("shell.analytics")}>
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => onTab(tb.id)}
                className={`flex-1 rounded-pill py-2.5 text-center text-sm font-semibold transition ${
                  active
                    ? "bg-cf-navy text-white shadow-md"
                    : "border border-cf-line bg-white text-cf-muted hover:border-slate-300/80"
                }`}
              >
                {t(tb.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-3 border-t border-cf-line/60 px-4 py-2.5">
          <img src={LOGO_SRC} alt="" className="h-7 w-auto max-w-[140px] object-contain opacity-90" decoding="async" />
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[10px] font-medium text-cf-muted">
            <CourtLogoMark url={courtLogoUrl} alt={t("shell.courtLogoAlt")} />
            <span className="truncate rounded-md bg-slate-100 px-2 py-0.5">{courtId}</span>
            <span className="max-w-[180px] truncate rounded-md border border-cf-line px-2 py-0.5 font-mono text-cf-navy/70">
              {matchId}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-8 pt-4 sm:max-w-2xl">{children}</main>
    </div>
  );
}
