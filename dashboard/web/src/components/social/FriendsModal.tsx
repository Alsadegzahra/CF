import { useState } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import { useSocial } from "../../context/SocialContext";

type FriendsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FriendsModal({ open, onClose }: FriendsModalProps) {
  const { t } = usePreferences();
  const { friends, addFriend, removeFriend } = useSocial();
  const [name, setName] = useState("");

  if (!open) return null;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const f = addFriend(name);
    if (f) setName("");
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-modal-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-auto rounded-card border border-cf-line bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="friends-modal-title" className="text-lg font-bold text-cf-navy">
              {t("friends.title")}
            </h2>
            <p className="mt-1 text-sm text-cf-muted">{t("friends.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-cf-muted hover:bg-slate-100"
            aria-label={t("friends.close")}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("friends.addPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy placeholder:text-cf-muted/70 focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15"
          />
          <button
            type="submit"
            className="shrink-0 rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            {t("friends.add")}
          </button>
        </form>

        <ul className="space-y-2">
          {friends.length === 0 ? (
            <li className="rounded-xl border border-dashed border-cf-line bg-slate-50/80 px-3 py-6 text-center text-sm text-cf-muted">{t("friends.empty")}</li>
          ) : (
            friends.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-cf-line bg-slate-50/80 px-3 py-2.5"
              >
                <span className="font-semibold text-cf-navy">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFriend(f.id)}
                  className="text-xs font-semibold text-red-700 hover:underline"
                >
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
