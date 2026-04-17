import { usePreferences } from "../context/PreferencesContext";
import { useMatchHistory, type RecentMatchEntry } from "../context/MatchHistoryContext";
import { Card } from "./ui/Card";

type RecentMatchesProps = {
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

/** Shown on the match-picker when signed in — matches the user added via "Add to my account". */
export function RecentMatches({ onOpenMatch }: RecentMatchesProps) {
  const { t, locale } = usePreferences();
  const { savedMatches, removeMatchFromAccount } = useMatchHistory();

  if (savedMatches.length === 0) {
    return (
      <div className="mx-auto mt-6 max-w-[420px] px-5">
        <Card padding="md">
          <h2 className="mb-1 text-sm font-bold text-cf-navy">{t("match.recentTitle")}</h2>
          <p className="text-xs leading-relaxed text-cf-muted">{t("match.recentEmpty")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-[420px] px-5">
      <Card padding="md">
        <h2 className="mb-3 text-sm font-bold text-cf-navy">{t("match.recentTitle")}</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-cf-muted">{t("match.recentHint")}</p>
        <ul className="space-y-2">
          {savedMatches.map((entry: RecentMatchEntry) => (
            <li
              key={entry.matchId}
              className="flex items-start gap-2 rounded-xl border border-cf-line bg-slate-50/80 px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => onOpenMatch(entry.matchId, entry.courtId)}
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
      </Card>
    </div>
  );
}
