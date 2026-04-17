import { usePreferences } from "../context/PreferencesContext";
import { useMatchHistory } from "../context/MatchHistoryContext";

type SaveMatchStripProps = {
  matchId: string;
  courtId: string;
};

/** Explicit "add this match to my account" — shown when signed in and match data is loaded. */
export function SaveMatchStrip({ matchId, courtId }: SaveMatchStripProps) {
  const { t } = usePreferences();
  const { isMatchSaved, addMatchToAccount, removeMatchFromAccount } = useMatchHistory();
  const saved = isMatchSaved(matchId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 text-xs leading-snug text-cf-muted">{t("match.saveBlurb")}</p>
      <div className="flex shrink-0 items-center gap-2">
        {saved ? (
          <>
            <span className="rounded-pill bg-cf-lime/20 px-3 py-1 text-[11px] font-bold text-cf-lime-dark">{t("match.savedLabel")}</span>
            <button
              type="button"
              onClick={() => removeMatchFromAccount(matchId)}
              className="text-[11px] font-semibold text-cf-muted underline decoration-cf-line underline-offset-2 hover:text-cf-navy"
            >
              {t("match.removeFromAccount")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => addMatchToAccount(matchId, courtId)}
            className="rounded-pill bg-cf-navy px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:opacity-95"
          >
            {t("match.addToAccount")}
          </button>
        )}
      </div>
    </div>
  );
}
