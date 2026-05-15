import { useState } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import { useSocial } from "../../context/SocialContext";

type FriendsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FriendsModal({ open, onClose }: FriendsModalProps) {
  const { t } = usePreferences();
  const { friends, pendingRequests, addFriend, removeFriend, acceptFriendRequest, declineFriendRequest } = useSocial();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setLoading(true);
    const r = await addFriend(email);
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    setEmail("");
    setSent(true);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-modal-title"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-card border border-cf-line bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="friends-modal-title" className="text-lg font-bold text-cf-navy">{t("friends.title")}</h2>
            <p className="mt-1 text-sm text-cf-muted">{t("friends.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose}
            className="shrink-0 rounded-full p-2 text-cf-muted hover:bg-slate-100"
            aria-label={t("friends.close")}>✕</button>
        </div>

        {/* Add by email */}
        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="absolute inset-y-0 start-3 flex items-center text-sm font-semibold text-cf-muted">@</span>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setSent(false); setError(null); }}
              placeholder={t("friends.usernamePlaceholder")}
              className="w-full rounded-xl border border-cf-line py-2 pe-3 ps-7 text-sm text-cf-navy placeholder:text-cf-muted/70 focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15"
            />
          </div>
          <button type="submit" disabled={loading}
            className="shrink-0 rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60">
            {loading ? "…" : t("friends.add")}
          </button>
        </form>
        {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
        {sent ? <p className="mb-3 text-sm text-green-700">{t("friends.requestSent")}</p> : null}

        {/* Pending incoming requests */}
        {pendingRequests.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-cf-muted">{t("friends.pendingTitle")}</p>
            <ul className="space-y-2">
              {pendingRequests.map((req) => (
                <li key={req.friendshipId}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  {req.fromAvatarUrl ? (
                    <img src={req.fromAvatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cf-navy text-xs font-bold text-white">
                      {req.fromName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 font-semibold text-cf-navy">{req.fromName}</span>
                  <button type="button" onClick={() => acceptFriendRequest(req.friendshipId)}
                    className="rounded-pill bg-cf-navy px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                    {t("friends.accept")}
                  </button>
                  <button type="button" onClick={() => declineFriendRequest(req.friendshipId)}
                    className="text-xs font-semibold text-red-700 hover:underline">
                    {t("friends.decline")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Friends list */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-cf-muted">{t("friends.friendsTitle")}</p>
        <ul className="space-y-2">
          {friends.length === 0 ? (
            <li className="rounded-xl border border-dashed border-cf-line bg-slate-50/80 px-3 py-6 text-center text-sm text-cf-muted">
              {t("friends.empty")}
            </li>
          ) : (
            friends.map((f) => (
              <li key={f.id}
                className="flex items-center gap-2 rounded-xl border border-cf-line bg-slate-50/80 px-3 py-2.5">
                {f.avatarUrl ? (
                  <img src={f.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cf-navy text-xs font-bold text-white">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 font-semibold text-cf-navy">{f.name}</span>
                <button type="button" onClick={() => removeFriend(f.id)}
                  className="text-xs font-semibold text-red-700 hover:underline">
                  {t("friends.remove")}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
