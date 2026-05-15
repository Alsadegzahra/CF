import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useMatchHistory } from "../../context/MatchHistoryContext";

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenMatch: (matchId: string, courtId: string) => void;
};

export function ProfileModal({ open, onClose, onOpenMatch }: ProfileModalProps) {
  const { t, locale } = usePreferences();
  const { user, updateProfile } = useAuth();
  const { savedMatches } = useMatchHistory();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open || !user) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await updateProfile(username, displayName);
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(locale === "ar" ? "ar" : undefined, { dateStyle: "medium" });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-card border border-cf-line bg-white p-5 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="profile-modal-title" className="text-lg font-bold text-cf-navy">{t("profile.title")}</h2>
          <button type="button" onClick={onClose}
            className="shrink-0 rounded-full p-2 text-cf-muted hover:bg-slate-100"
            aria-label={t("auth.closeModal")}>✕</button>
        </div>

        {/* Avatar + identity */}
        <div className="mb-4 flex items-center gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-cf-line" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cf-navy text-xl font-bold text-white">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold text-cf-navy">{user.displayName}</p>
            {user.username ? (
              <p className="text-sm text-cf-muted">@{user.username}</p>
            ) : (
              <p className="text-sm text-amber-600">{t("profile.noUsername")}</p>
            )}
            <p className="text-xs text-cf-muted">{user.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-cf-line bg-slate-50/80 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-cf-navy">{savedMatches.length}</p>
            <p className="text-xs text-cf-muted">{t("profile.matchesSaved")}</p>
          </div>
          <div className="rounded-xl border border-cf-line bg-slate-50/80 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-cf-navy">{user.username ? "✓" : "—"}</p>
            <p className="text-xs text-cf-muted">{t("profile.usernameSet")}</p>
          </div>
        </div>

        {/* Edit profile */}
        {editing ? (
          <form onSubmit={handleSave} className="mb-4 space-y-3 rounded-xl border border-cf-line bg-slate-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-cf-muted">{t("profile.editTitle")}</p>
            <label className="block">
              <span className="text-xs font-semibold text-cf-muted">{t("auth.displayName")}</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-cf-muted">{t("setup.username")}</span>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 start-3 flex items-center text-sm font-semibold text-cf-muted">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={20}
                  className="w-full rounded-xl border border-cf-line py-2 pe-3 ps-7 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15"
                />
              </div>
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            {saved ? <p className="text-sm text-green-700">{t("profile.saved")}</p> : null}
            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 rounded-pill bg-cf-navy py-2 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50">
                {loading ? "…" : t("profile.save")}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 rounded-pill border border-cf-line bg-white py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50">
                {t("match.cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => { setEditing(true); setUsername(user.username ?? ""); setDisplayName(user.displayName); }}
            className="mb-4 w-full rounded-pill border border-cf-line bg-white py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50">
            {t("profile.editButton")}
          </button>
        )}

        {/* Recent matches */}
        {savedMatches.length > 0 ? (
          <>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-cf-muted">{t("profile.recentMatches")}</p>
            <ul className="space-y-2">
              {savedMatches.slice(0, 5).map((entry) => (
                <li key={entry.matchId}
                  className="flex items-center gap-2 rounded-xl border border-cf-line bg-slate-50/80 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold text-cf-navy">{entry.matchId}</p>
                    {entry.title ? <p className="truncate text-xs text-cf-muted">{entry.title}</p> : null}
                    <p className="text-[10px] text-cf-muted">{formatDate(entry.openedAt)}</p>
                  </div>
                  <button type="button"
                    onClick={() => { onOpenMatch(entry.matchId, entry.courtId); onClose(); }}
                    className="shrink-0 rounded-pill bg-cf-navy px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                    {t("feed.view")}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
