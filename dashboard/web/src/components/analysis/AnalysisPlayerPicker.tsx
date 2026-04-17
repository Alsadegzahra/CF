import { usePreferences } from "../../context/PreferencesContext";
import type { LineupPlayer } from "../../types";

function sortPlayers(players: LineupPlayer[]): LineupPlayer[] {
  return [...players].sort((a, b) => Number(a.id) - Number(b.id));
}

type AnalysisPlayerPickerProps = {
  players: LineupPlayer[];
  selectedId: string;
  onSelect: (playerId: string) => void;
};

export function AnalysisPlayerPicker({ players, selectedId, onSelect }: AnalysisPlayerPickerProps) {
  const { t, displayNameForPlayer } = usePreferences();
  const ordered = sortPlayers(players);

  return (
    <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
      <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("analysis.selectPlayer")}</h2>
      <p className="mb-3 text-xs leading-relaxed text-cf-muted">{t("analysis.selectPlayerHint")}</p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("analysis.selectPlayer")}>
        {ordered.map((p) => {
          const label = displayNameForPlayer(p.id, p.label);
          const selected = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(p.id)}
              className={`min-w-0 max-w-full truncate rounded-pill px-4 py-2.5 text-sm font-semibold transition active:scale-[0.99] ${
                selected
                  ? "bg-cf-navy text-white shadow-md ring-2 ring-cf-navy/15"
                  : "border border-cf-line bg-slate-50/90 text-cf-navy hover:border-cf-navy/25"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
