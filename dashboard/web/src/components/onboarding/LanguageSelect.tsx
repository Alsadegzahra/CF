import { LOGO_SRC } from "../../brand";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { usePreferences } from "../../context/PreferencesContext";
import type { Locale } from "../../i18n/strings";

/**
 * First screen: choose English or Arabic. Copy is bilingual so it works before locale is stored.
 */
export function LanguageSelect() {
  const { setLocale } = usePreferences();

  function choose(l: Locale) {
    setLocale(l);
  }


  return (
    <div className="flex min-h-screen flex-col bg-cf-canvas">
      <div className="sticky top-0 z-40 flex justify-end border-b border-cf-line/80 bg-white/95 px-4 py-2.5 backdrop-blur-md">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-10">
        <img
          src={LOGO_SRC}
          alt="CourtFlow"
          className="mx-auto mb-10 h-11 w-auto max-w-[220px] object-contain"
          decoding="async"
        />
        <div className="mb-8 text-center">
          <h1 className="text-xl font-extrabold tracking-tight text-cf-navy">Choose your language</h1>
          <p className="mt-2 text-lg font-bold text-cf-navy/90" dir="rtl">
            اختر اللغة
          </p>
          <p className="mt-3 text-sm leading-relaxed text-cf-muted">CourtFlow · English or العربية</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => choose("en")}
            className="rounded-card border-2 border-cf-line bg-white py-4 text-center text-base font-bold text-cf-navy shadow-card-sm transition hover:border-cf-navy/25 hover:shadow-md active:scale-[0.99]"
          >
            English
          </button>
          <button
            type="button"
            onClick={() => choose("ar")}
            className="rounded-card border-2 border-cf-lime/50 bg-white py-4 text-center text-lg font-bold text-cf-navy shadow-card-sm transition hover:bg-cf-lime/10 active:scale-[0.99]"
            dir="rtl"
          >
            العربية
          </button>
        </div>
      </div>
    </div>
  );
}
