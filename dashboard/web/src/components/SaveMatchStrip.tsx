import { useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import { useMatchHistory } from "../context/MatchHistoryContext";

type SaveMatchStripProps = {
  matchId: string;
  courtId: string;
};

export function SaveMatchStrip({ matchId, courtId }: SaveMatchStripProps) {
  const { t } = usePreferences();
  const { isMatchSaved, addMatchToAccount, removeMatchFromAccount, updateMatchTitle, savedMatches } = useMatchHistory();
  const saved = isMatchSaved(matchId);
  const savedEntry = savedMatches.find((x) => x.matchId === matchId);

  const [showTitleInput, setShowTitleInput] = useState(false);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(savedEntry?.title ?? "");

  function handleSave() {
    if (showTitleInput) {
      addMatchToAccount(matchId, courtId, title);
      setShowTitleInput(false);
      setTitle("");
    } else {
      setShowTitleInput(true);
    }
  }

  function handleSaveTitle() {
    updateMatchTitle(matchId, editTitle);
    setEditingTitle(false);
  }

  if (saved) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t("match.titlePlaceholder")}
                className="min-w-0 flex-1 rounded-lg border border-cf-line px-2 py-1 text-xs text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-1 focus:ring-cf-navy/15"
                autoFocus
              />
              <button type="button" onClick={handleSaveTitle}
                className="shrink-0 rounded-pill bg-cf-navy px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                {t("match.saveTitle")}
              </button>
              <button type="button" onClick={() => setEditingTitle(false)}
                className="text-xs text-cf-muted hover:underline">{t("match.cancel")}</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-pill bg-cf-lime/20 px-3 py-1 text-[11px] font-bold text-cf-lime-dark">
                {t("match.savedLabel")}
              </span>
              <button type="button" onClick={() => { setEditTitle(savedEntry?.title ?? ""); setEditingTitle(true); }}
                className="text-[11px] font-semibold text-cf-muted hover:text-cf-navy">
                {savedEntry?.title ? `"${savedEntry.title}"` : t("match.addTitle")}
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => removeMatchFromAccount(matchId)}
          className="shrink-0 text-[11px] font-semibold text-cf-muted underline decoration-cf-line underline-offset-2 hover:text-cf-navy">
          {t("match.removeFromAccount")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {showTitleInput ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("match.titlePlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-cf-line px-2 py-1.5 text-xs text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-1 focus:ring-cf-navy/15"
            autoFocus
          />
          <button type="button" onClick={handleSave}
            className="shrink-0 rounded-pill bg-cf-navy px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:opacity-95">
            {t("match.addToAccount")}
          </button>
          <button type="button" onClick={() => setShowTitleInput(false)}
            className="shrink-0 text-[11px] text-cf-muted hover:underline">{t("match.cancel")}</button>
        </div>
      ) : (
        <>
          <p className="min-w-0 text-xs leading-snug text-cf-muted">{t("match.saveBlurb")}</p>
          <button type="button" onClick={handleSave}
            className="shrink-0 rounded-pill bg-cf-navy px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:opacity-95">
            {t("match.addToAccount")}
          </button>
        </>
      )}
    </div>
  );
}
