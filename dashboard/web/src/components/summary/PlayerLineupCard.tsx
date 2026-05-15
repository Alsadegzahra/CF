import { useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { useSocial } from "../../context/SocialContext";
import type { LineupPlayer } from "../../types";

type PlayerLineupCardProps = {
  players: LineupPlayer[];
  matchId: string;
};

function avatarInitials(displayLabel: string): string {
  const s = displayLabel.trim();
  if (!s) return "?";
  const pm = /^P(\d)$/i.exec(s);
  if (pm) return pm[1]!;
  const compact = s.replace(/\s+/g, "");
  return compact.length <= 2 ? compact : compact.slice(0, 2);
}

export function PlayerLineupCard({ players, matchId }: PlayerLineupCardProps) {
  const {
    t,
    displayNameForPlayer,
    playerDisplayNames,
    setPlayerDisplayNames,
    teamDisplayNames,
    setTeamDisplayNames,
  } = usePreferences();
  const { loadRosterForMatch } = useSocial();

  useEffect(() => { loadRosterForMatch(matchId); }, [matchId, loadRosterForMatch]);

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  return (
    <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("summary.lineup")}</h2>
      <div className="mb-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
        <label className="sr-only" htmlFor="team-name-a">
          {t("summary.teamNameA")}
        </label>
        <input
          id="team-name-a"
          type="text"
          autoComplete="off"
          placeholder={t("summary.teamA")}
          value={teamDisplayNames.A}
          onChange={(e) => setTeamDisplayNames((prev) => ({ ...prev, A: e.target.value }))}
          className="min-w-0 flex-1 rounded-xl border border-cf-line bg-slate-50/90 px-3 py-2 text-center text-sm font-semibold text-cf-navy placeholder:text-cf-muted/70 focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15 sm:max-w-[11rem]"
        />
        <span className="shrink-0 text-center text-xs font-bold uppercase tracking-wide text-cf-muted">{t("summary.vs")}</span>
        <label className="sr-only" htmlFor="team-name-b">
          {t("summary.teamNameB")}
        </label>
        <input
          id="team-name-b"
          type="text"
          autoComplete="off"
          placeholder={t("summary.teamB")}
          value={teamDisplayNames.B}
          onChange={(e) => setTeamDisplayNames((prev) => ({ ...prev, B: e.target.value }))}
          className="min-w-0 flex-1 rounded-xl border border-cf-line bg-slate-50/90 px-3 py-2 text-center text-sm font-semibold text-cf-navy placeholder:text-cf-muted/70 focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15 sm:max-w-[11rem]"
        />
      </div>
      <div className="flex justify-between gap-2">
        <div className="flex flex-1 justify-center gap-2">
          {teamA.map((p) => (
            <PlayerSlot
              key={p.id}
              matchId={matchId}
              player={p}
              displayLabel={displayNameForPlayer(p.id, p.label)}
              draftValue={playerDisplayNames[p.id] ?? ""}
              onDraftChange={(v) => setPlayerDisplayNames((prev) => ({ ...prev, [p.id]: v }))}
              placeholder={t("names.placeholder")}
            />
          ))}
        </div>
        <div className="w-px shrink-0 bg-cf-line" aria-hidden />
        <div className="flex flex-1 justify-center gap-2">
          {teamB.map((p) => (
            <PlayerSlot
              key={p.id}
              matchId={matchId}
              player={p}
              displayLabel={displayNameForPlayer(p.id, p.label)}
              draftValue={playerDisplayNames[p.id] ?? ""}
              onDraftChange={(v) => setPlayerDisplayNames((prev) => ({ ...prev, [p.id]: v }))}
              placeholder={t("names.placeholder")}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayerSlot({
  displayLabel,
  draftValue,
  onDraftChange,
  placeholder,
  player,
  matchId,
}: {
  displayLabel: string;
  draftValue: string;
  onDraftChange: (v: string) => void;
  placeholder: string;
  player: LineupPlayer;
  matchId: string;
}) {
  const { t } = usePreferences();
  const { user } = useAuth();
  const { friends, getAssignedFriendId, setPlayerFriendAssignment, getFriend } = useSocial();

  const assignedId = user ? getAssignedFriendId(matchId, player.id) : null;

  function onFriendSelect(friendId: string) {
    if (!user) return;
    const fid = friendId || null;
    setPlayerFriendAssignment(matchId, player.id, fid);
    if (fid) {
      const f = getFriend(fid);
      if (f) onDraftChange(f.name);
    } else {
      onDraftChange("");
    }
  }

  return (
    <div className="flex max-w-[6.25rem] flex-col items-center gap-1.5 rounded-2xl border border-cf-line/80 bg-slate-50/90 p-1.5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-cf-navy ring-1 ring-cf-line">
        {avatarInitials(displayLabel)}
      </div>
      <span className="max-w-full truncate px-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-cf-muted" title={displayLabel}>
        {displayLabel}
      </span>
      {user ? (
        <label className="w-full">
          <span className="sr-only">{t("friends.assignToSlot")}</span>
          <select
            value={assignedId ?? ""}
            onChange={(e) => onFriendSelect(e.target.value)}
            className="w-full min-w-0 rounded-md border border-cf-line bg-white px-0.5 py-1 text-[9px] font-medium text-cf-navy focus:border-cf-navy/40 focus:outline-none focus:ring-1 focus:ring-cf-navy/20"
          >
            <option value="">{t("friends.none")}</option>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="sr-only" htmlFor={`player-name-${player.id}`}>
        {t("summary.optionalName")} · {displayLabel}
      </label>
      <input
        id={`player-name-${player.id}`}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={draftValue}
        onChange={(e) => onDraftChange(e.target.value)}
        className="w-full min-w-0 rounded-lg border border-cf-line bg-white px-1.5 py-1 text-center text-[10px] font-medium text-cf-navy placeholder:text-cf-muted/70 focus:border-cf-navy/40 focus:outline-none focus:ring-1 focus:ring-cf-navy/20"
      />
    </div>
  );
}
