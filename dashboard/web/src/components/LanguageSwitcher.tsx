import { usePreferences } from "../context/PreferencesContext";
import type { Locale } from "../i18n/strings";

/**
 * Compact EN / AR control — keep visible in the top bar so users can switch anytime.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = usePreferences();

  function pick(next: Locale) {
    if (next !== locale) setLocale(next);
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-pill border border-cf-line bg-slate-50/90 p-0.5 shadow-sm"
      role="group"
      aria-label={t("lang.switcherAria")}
    >
      <LangPill code="en" label={t("lang.enShort")} active={locale === "en"} onPick={() => pick("en")} />
      <LangPill code="ar" label={t("lang.arShort")} active={locale === "ar"} onPick={() => pick("ar")} dir="rtl" />
    </div>
  );
}

function LangPill({
  code,
  label,
  active,
  onPick,
  dir,
}: {
  code: string;
  label: string;
  active: boolean;
  onPick: () => void;
  dir?: "rtl";
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`min-w-[3rem] rounded-pill px-2.5 py-1.5 text-xs font-bold transition ${
        active ? "bg-cf-navy text-white shadow-sm" : "text-cf-muted hover:bg-white/80 hover:text-cf-navy"
      }`}
      aria-pressed={active}
      aria-label={code === "en" ? "English" : "العربية"}
      dir={dir}
    >
      {label}
    </button>
  );
}
