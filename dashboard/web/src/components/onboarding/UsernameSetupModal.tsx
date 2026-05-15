import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";

export function UsernameSetupModal() {
  const { user, completeProfileSetup } = useAuth();
  const { t } = usePreferences();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await completeProfileSetup(username, displayName);
    setLoading(false);
    if (!r.ok) setError(r.error);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-card border border-cf-line bg-white p-6 shadow-2xl">
        {/* Avatar preview */}
        <div className="mb-4 flex justify-center">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-cf-line" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cf-navy text-xl font-bold text-white">
              {(displayName || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <h2 className="mb-1 text-center text-lg font-bold text-cf-navy">{t("setup.title")}</h2>
        <p className="mb-5 text-center text-sm text-cf-muted">{t("setup.subtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-cf-muted">{t("setup.displayName")}</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              placeholder={t("setup.displayNamePlaceholder")}
              className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-cf-muted">{t("setup.username")}</span>
            <div className="relative mt-1">
              <span className="absolute inset-y-0 start-3 flex items-center text-sm font-semibold text-cf-muted">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                autoComplete="username"
                placeholder={t("setup.usernamePlaceholder")}
                maxLength={20}
                className="w-full rounded-xl border border-cf-line py-2 pe-3 ps-7 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15"
              />
            </div>
            <p className="mt-1 text-[10px] text-cf-muted">{t("setup.usernameHint")}</p>
          </label>

          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !username || !displayName}
            className="w-full rounded-pill bg-cf-navy py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-50"
          >
            {loading ? "…" : t("setup.continue")}
          </button>
        </form>
      </div>
    </div>
  );
}
