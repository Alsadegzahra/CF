import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { Card } from "../ui/Card";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenFriends?: () => void;
  onOpenSavedMatches?: () => void;
  onOpenFeed?: () => void;
  onOpenProfile?: () => void;
};

export function AuthModal({ open, onClose, onOpenFriends, onOpenSavedMatches, onOpenFeed, onOpenProfile }: AuthModalProps) {
  const { t } = usePreferences();
  const { ready, user, isGuest, loginWithEmail, registerWithEmail, loginWithGoogle, logout, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "register") {
      const r = await registerWithEmail(email, password, displayName);
      setLoading(false);
      if (!r.ok) { setError(r.error); return; }
      setRegistered(true);
      return;
    }

    const r = await loginWithEmail(email, password);
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    onClose();
  }

  async function handleGoogle() {
    setLoading(true);
    await loginWithGoogle();
    // page will redirect — no need to setLoading(false)
  }

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.4)", overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "60px 16px 16px" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div style={{ width: "100%", maxWidth: 448, background: "white", borderRadius: 16, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="auth-modal-title" className="text-lg font-bold text-cf-navy">
            {t("auth.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-cf-muted hover:bg-slate-100"
            aria-label={t("auth.closeModal")}
          >
            ✕
          </button>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-cf-muted">{t("auth.loading")}</p>
        ) : registered ? (
          <Card padding="md">
            <p className="mb-2 text-sm font-semibold text-cf-navy">{t("auth.checkEmail")}</p>
            <p className="text-xs text-cf-muted">{t("auth.checkEmailHint")}</p>
            <button
              type="button"
              onClick={() => { setRegistered(false); setMode("login"); }}
              className="mt-3 rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              {t("auth.login")}
            </button>
          </Card>
        ) : user ? (
          <Card padding="md">
            <div className="mb-3 flex items-center gap-3">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cf-navy text-sm font-bold text-white">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-cf-navy">{user.displayName}</p>
                <p className="truncate text-xs text-cf-muted">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {onOpenProfile ? (
                <button type="button" onClick={() => { onOpenProfile(); onClose(); }}
                  className="rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                  {t("profile.title")}
                </button>
              ) : null}
              {onOpenFeed ? (
                <button type="button" onClick={() => { onOpenFeed(); onClose(); }}
                  className="rounded-pill border border-cf-line bg-white px-4 py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50">
                  {t("feed.title")}
                </button>
              ) : null}
              {onOpenFriends ? (
                <button type="button" onClick={() => { onOpenFriends(); onClose(); }}
                  className="rounded-pill border border-cf-line bg-white px-4 py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50">
                  {t("friends.title")}
                </button>
              ) : null}
              {onOpenSavedMatches ? (
                <button type="button" onClick={() => { onOpenSavedMatches(); onClose(); }}
                  className="rounded-pill border border-cf-line bg-white px-4 py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50">
                  {t("match.recentTitle")}
                </button>
              ) : null}
              <button type="button" onClick={() => { logout(); onClose(); }}
                className="rounded-pill border border-cf-line bg-white px-4 py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50">
                {t("auth.signOut")}
              </button>
            </div>
          </Card>
        ) : isGuest ? (
          <Card padding="md">
            <p className="mb-3 text-sm text-cf-muted">{t("auth.guestMode")}</p>
            <button type="button" onClick={() => logout()}
              className="rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
              {t("auth.signInInstead")}
            </button>
          </Card>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              <button type="button" onClick={() => { setMode("login"); setError(null); setRegistered(false); }}
                className={`flex-1 rounded-pill py-2 text-sm font-bold ${mode === "login" ? "bg-cf-navy text-white" : "border border-cf-line bg-white text-cf-muted"}`}>
                {t("auth.login")}
              </button>
              <button type="button" onClick={() => { setMode("register"); setError(null); setRegistered(false); }}
                className={`flex-1 rounded-pill py-2 text-sm font-bold ${mode === "register" ? "bg-cf-navy text-white" : "border border-cf-line bg-white text-cf-muted"}`}>
                {t("auth.register")}
              </button>
            </div>

            {/* Google OAuth */}
            <button type="button" onClick={handleGoogle} disabled={loading}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-pill border border-cf-line bg-white py-2.5 text-sm font-semibold text-cf-navy shadow-sm hover:bg-slate-50 disabled:opacity-60">
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("auth.continueGoogle")}
            </button>

            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-cf-line" />
              <span className="text-xs text-cf-muted">{t("auth.orEmail")}</span>
              <div className="h-px flex-1 bg-cf-line" />
            </div>

            <form onSubmit={submit}>
              {mode === "register" ? (
                <label className="mb-2 block">
                  <span className="text-xs font-semibold text-cf-muted">{t("auth.displayName")}</span>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15" />
                </label>
              ) : null}
              <label className="mb-2 block">
                <span className="text-xs font-semibold text-cf-muted">{t("auth.email")}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15" />
              </label>
              <label className="mb-3 block">
                <span className="text-xs font-semibold text-cf-muted">{t("auth.password")}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15" />
              </label>

              {error ? <p className="mb-2 text-sm text-red-700" role="alert">{error}</p> : null}

              <button type="submit" disabled={loading}
                className="mb-3 w-full rounded-pill bg-cf-navy py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60">
                {loading ? "…" : mode === "register" ? t("auth.createAccount") : t("auth.signIn")}
              </button>
            </form>

            <button type="button" onClick={() => { continueAsGuest(); onClose(); }}
              className="w-full rounded-pill border border-cf-line bg-white py-3 text-sm font-semibold text-cf-muted hover:bg-slate-50">
              {t("auth.continueGuest")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
