import { usePreferences } from "../../context/PreferencesContext";
import type { TabId } from "../../types";

type QuickActionsProps = {
  onGoTab: (t: TabId) => void;
};

export function QuickActions({ onGoTab }: QuickActionsProps) {
  const { t } = usePreferences();

  return (
    <div className="grid grid-cols-2 gap-3 pb-2">
      <button
        type="button"
        onClick={() => onGoTab("analysis")}
        className="rounded-pill border border-cf-line bg-white py-3.5 text-sm font-semibold text-cf-navy shadow-card-sm transition hover:border-cf-navy/20 hover:shadow-md active:scale-[0.99]"
      >
        {t("actions.viewAnalysis")}
      </button>
      <button
        type="button"
        onClick={() => onGoTab("replay")}
        className="rounded-pill border border-cf-lime/50 bg-cf-lime py-3.5 text-sm font-semibold text-cf-navy shadow-sm transition hover:bg-cf-lime/90 active:scale-[0.99]"
      >
        {t("actions.watchReplay")}
      </button>
    </div>
  );
}
