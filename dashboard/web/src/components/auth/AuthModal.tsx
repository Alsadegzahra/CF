import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { Card } from "../ui/Card";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenFriends?: () => void;
  onOpenSavedMatches?: () => void;
};

/**
 * Sign in / register / guest — opens from the top bar, not as a gate before the match picker.
 * Demo only: localStorage, not a real server.
 */
export function AuthModal({ open, onClose, onOpenFriends, onOpenSavedMatches }: AuthModalProps) {
  const { t } = usePreferences();
  const { ready, user, isGuest, register, login, logout, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register") {
      const r = register(email, password, displayName);
      if (!r.ok) {
        setError(r.error === "exists" ? t("auth.errorExists") : t("auth.errorInvalid"));
        return;
      }
      setEmail("");
      setPassword("");
      setDisplayName("");
      onClose();
      return;
    }
    const r = login(email, password);
    if (!r.ok) {
      setError(r.error === "bad_credentials" ? t("auth.errorCredentials") : t("auth.errorInvalid"));
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-md overflow-auto rounded-card border border-cf-line bg-white p-5 shadow-xl">
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
        ) : user ? (
          <Card padding="md">
            <p className="mb-2 text-sm font-semibold text-cf-navy">
              {t("auth.signedInLabel")} {user.displayName}
            </p>
            <p className="mb-3 text-xs text-cf-muted">{user.email}</p>
            <div className="flex flex-wrap gap-2">
              {onOpenFriends ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenFriends();
                    onClose();
                  }}
                  className="rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  {t("friends.title")}
                </button>
              ) : null}
              {onOpenSavedMatches ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSavedMatches();
                    onClose();
                  }}
                  className="rounded-pill border border-cf-line bg-white px-4 py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50"
                >
                  {t("match.recentTitle")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="rounded-pill border border-cf-line bg-white px-4 py-2 text-sm font-semibold text-cf-navy hover:bg-slate-50"
              >
                {t("auth.signOut")}
              </button>
            </div>
          </Card>
        ) : isGuest ? (
          <Card padding="md">
            <p className="mb-3 text-sm text-cf-muted">{t("auth.guestMode")}</p>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-pill bg-cf-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              {t("auth.signInInstead")}
            </button>
          </Card>
        ) : (
          <>
            <p className="mb-4 text-xs leading-relaxed text-cf-muted">{t("auth.demoWarning")}</p>

            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`flex-1 rounded-pill py-2 text-sm font-bold ${
                  mode === "login" ? "bg-cf-navy text-white" : "border border-cf-line bg-white text-cf-muted"
                }`}
              >
                {t("auth.login")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className={`flex-1 rounded-pill py-2 text-sm font-bold ${
                  mode === "register" ? "bg-cf-navy text-white" : "border border-cf-line bg-white text-cf-muted"
                }`}
              >
                {t("auth.register")}
              </button>
            </div>

            <form onSubmit={submit}>
              {mode === "register" ? (
                <label className="mb-2 block">
                  <span className="text-xs font-semibold text-cf-muted">{t("auth.displayName")}</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy"
                  />
                </label>
              ) : null}
              <label className="mb-2 block">
                <span className="text-xs font-semibold text-cf-muted">{t("auth.email")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy"
                />
              </label>
              <label className="mb-2 block">
                <span className="text-xs font-semibold text-cf-muted">{t("auth.password")}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  className="mt-1 w-full rounded-xl border border-cf-line px-3 py-2 text-sm text-cf-navy"
                />
              </label>

              {error ? (
                <p className="mb-2 text-sm text-red-700" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="mb-3 w-full rounded-pill bg-cf-navy py-3 text-sm font-bold text-white hover:opacity-95"
              >
                {mode === "register" ? t("auth.createAccount") : t("auth.signIn")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                continueAsGuest();
                onClose();
              }}
              className="w-full rounded-pill border border-cf-line bg-white py-3 text-sm font-semibold text-cf-muted hover:bg-slate-50"
            >
              {t("auth.continueGuest")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
