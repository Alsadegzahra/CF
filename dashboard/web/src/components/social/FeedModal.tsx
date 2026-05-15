import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferences } from "../../context/PreferencesContext";
import { supabase } from "../../lib/supabase";

type FeedEntry = {
  id: string;
  matchId: string;
  courtId: string | null;
  title: string | null;
  playedAt: string;
  visibility: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  playerNames: string[];
};

type FeedModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenMatch: (matchId: string, courtId: string) => void;
};

function timeAgo(iso: string, locale: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return locale === "ar" ? "الآن" : "just now";
    if (mins < 60) return locale === "ar" ? `${mins} د` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return locale === "ar" ? `${hrs} س` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return locale === "ar" ? `${days} يوم` : `${days}d ago`;
  } catch { return ""; }
}

export function FeedModal({ open, onClose, onOpenMatch }: FeedModalProps) {
  const { t, locale } = usePreferences();
  const { user } = useAuth();
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    supabase
      .from("user_matches")
      .select(`
        id, match_id, court_id, title, played_at, visibility,
        profiles!user_matches_user_id_fkey(display_name, avatar_url),
        match_players(display_name, profiles(display_name))
      `)
      .order("played_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setLoading(false);
        if (!data) return;
        setFeed(
          data.map((row: any) => {
            const owner = row["profiles!user_matches_user_id_fkey"];
            const playerNames: string[] = (row.match_players ?? []).map((mp: any) => {
              return mp.profiles?.display_name || mp.display_name || null;
            }).filter(Boolean);
            return {
              id: row.id,
              matchId: row.match_id,
              courtId: row.court_id,
              title: row.title,
              playedAt: row.played_at,
              visibility: row.visibility,
              ownerName: owner?.display_name ?? "Unknown",
              ownerAvatarUrl: owner?.avatar_url ?? null,
              playerNames,
            };
          }),
        );
      });
  }, [open, user?.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feed-modal-title"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-card border border-cf-line bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="feed-modal-title" className="text-lg font-bold text-cf-navy">{t("feed.title")}</h2>
            <p className="mt-1 text-sm text-cf-muted">{t("feed.subtitle")}</p>
          </div>
          <button type="button" onClick={onClose}
            className="shrink-0 rounded-full p-2 text-cf-muted hover:bg-slate-100"
            aria-label={t("auth.closeModal")}>✕</button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-cf-muted">{t("loading")}</p>
        ) : feed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-cf-line bg-slate-50/80 px-3 py-8 text-center text-sm text-cf-muted">
            {t("feed.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {feed.map((entry) => (
              <li key={entry.id}
                className="rounded-xl border border-cf-line bg-slate-50/80 px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  {entry.ownerAvatarUrl ? (
                    <img src={entry.ownerAvatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cf-navy text-xs font-bold text-white">
                      {entry.ownerName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-cf-navy">{entry.ownerName}</span>
                    <span className="mx-1 text-cf-muted text-sm">{t("feed.playedA")}</span>
                    <span className="font-semibold text-cf-navy">{t("feed.match")}</span>
                  </div>
                  <span className="shrink-0 text-xs text-cf-muted">{timeAgo(entry.playedAt, locale)}</span>
                </div>

                {entry.playerNames.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {entry.playerNames.map((name, i) => (
                      <span key={i} className="rounded-full bg-white border border-cf-line px-2 py-0.5 text-xs font-medium text-cf-navy">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs text-cf-muted">
                    {entry.courtId ? <span className="font-mono">{entry.courtId}</span> : null}
                    {entry.title ? <span>{entry.title}</span> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => { onOpenMatch(entry.matchId, entry.courtId ?? ""); onClose(); }}
                    className="shrink-0 rounded-pill bg-cf-navy px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                  >
                    {t("feed.view")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
