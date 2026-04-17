import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";

type AccountMenuProps = {
  onOpenAuth: () => void;
  onOpenFriends?: () => void;
  onOpenSavedMatches?: () => void;
};

/**
 * Compact account control for the top bar (next to language). Opens AuthModal via onOpenAuth.
 */
export function AccountMenu({ onOpenAuth, onOpenFriends, onOpenSavedMatches }: AccountMenuProps) {
  const { t } = usePreferences();
  const { ready, user, isGuest, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handle(ev: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  if (!ready) {
    return (
      <span className="rounded-pill border border-cf-line bg-slate-50/90 px-3 py-1.5 text-xs font-semibold text-cf-muted">
        {t("auth.loading")}
      </span>
    );
  }

  if (user) {
    const label = user.displayName.trim() || user.email;
    return (
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="max-w-[11rem] truncate rounded-pill border border-cf-line bg-white px-3 py-1.5 text-left text-xs font-bold text-cf-navy shadow-sm hover:bg-slate-50"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={t("auth.accountMenuAria")}
        >
          {label}
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute end-0 top-full z-50 mt-1 min-w-[11rem] rounded-xl border border-cf-line bg-white py-1 shadow-lg"
          >
            {onOpenFriends ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-start text-sm font-semibold text-cf-navy hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenFriends();
                }}
              >
                {t("friends.title")}
              </button>
            ) : null}
            {onOpenSavedMatches ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-start text-sm font-semibold text-cf-navy hover:bg-slate-50"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSavedMatches();
                }}
              >
                {t("match.recentTitle")}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-start text-sm font-semibold text-cf-navy hover:bg-slate-50"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              {t("auth.signOut")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (isGuest) {
    return (
      <button
        type="button"
        onClick={onOpenAuth}
        className="rounded-pill border border-dashed border-cf-line bg-slate-50/90 px-3 py-1.5 text-xs font-bold text-cf-muted hover:border-cf-navy/30 hover:text-cf-navy"
        aria-label={t("auth.accountMenuAria")}
      >
        {t("auth.guestBadge")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenAuth}
      className="rounded-pill border border-cf-line bg-white px-3 py-1.5 text-xs font-bold text-cf-navy shadow-sm hover:bg-slate-50"
      aria-label={t("auth.accountMenuAria")}
    >
      {t("auth.login")}
    </button>
  );
}
