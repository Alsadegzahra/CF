import { usePreferences } from "../../context/PreferencesContext";
import { useMatchHistory, type RecentMatchEntry } from "../../context/MatchHistoryContext";

type SavedMatchesModalProps = {
  open: boolean;
  onClose: () => void;
  /** Navigate to match and typically close this modal. */
  onOpenMatch: (matchId: string, courtId: string) => void;
};

function formatOpenedAt(ts: number, locale: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString(locale === "ar" ? "ar" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export function SavedMatchesModal({ open, onClose, onOpenMatch }: SavedMatchesModalProps) {
  const { t, locale } = usePreferences();
  const { savedMatches, removeMatchFromAccount } = useMatchHistory();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-matches-modal-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-card border border-cf-line bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="saved-matches-modal-title" className="text-lg font-bold text-cf-navy">
              {t("match.recentTitle")}
            </h2>
            <p className="mt-1 text-sm text-cf-muted">{t("match.recentHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-cf-muted hover:bg-slate-100"
            aria-label={t("auth.closeModal")}
          >
            ✕
          </button>
        </div>

        {savedMatches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-cf-line bg-slate-50/80 px-3 py-8 text-center text-sm text-cf-muted">{t("match.recentEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {savedMatches.map((entry: RecentMatchEntry) => (
              <li
                key={entry.matchId}
                className="flex items-start gap-2 rounded-xl border border-cf-line bg-slate-50/80 px-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenMatch(entry.matchId, entry.courtId);
                  }}
                  className="min-w-0 flex-1 text-start font-mono text-xs font-semibold text-cf-navy hover:underline"
                >
                  {entry.matchId}
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[10px] text-cf-muted">{formatOpenedAt(entry.openedAt, locale)}</span>
                  {entry.courtId ? (
                    <span className="max-w-[100px] truncate rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-cf-muted">
                      {entry.courtId}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeMatchFromAccount(entry.matchId)}
                    className="text-[10px] font-semibold text-red-700 hover:underline"
                  >
                    {t("match.recentRemove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
