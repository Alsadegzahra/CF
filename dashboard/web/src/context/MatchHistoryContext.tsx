import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type RecentMatchEntry = {
  matchId: string;
  courtId: string;
  openedAt: number;
  title?: string;
};

type MatchHistoryContextValue = {
  savedMatches: RecentMatchEntry[];
  isMatchSaved: (matchId: string) => boolean;
  addMatchToAccount: (matchId: string, courtId: string, title?: string) => void;
  removeMatchFromAccount: (matchId: string) => void;
  updateMatchTitle: (matchId: string, title: string) => void;
};

const MatchHistoryContext = createContext<MatchHistoryContextValue | null>(null);

export function MatchHistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [savedMatches, setSavedMatches] = useState<RecentMatchEntry[]>([]);

  useEffect(() => {
    if (!user) {
      setSavedMatches([]);
      return;
    }
    supabase
      .from("user_matches")
      .select("match_id, court_id, played_at, title")
      .eq("user_id", user.id)
      .order("played_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (!data) return;
        setSavedMatches(
          data.map((r) => ({
            matchId: r.match_id,
            courtId: r.court_id ?? "",
            openedAt: new Date(r.played_at).getTime(),
            title: r.title ?? undefined,
          })),
        );
      });
  }, [user?.id]);

  const isMatchSaved = useCallback(
    (matchId: string) => savedMatches.some((x) => x.matchId === matchId.trim()),
    [savedMatches],
  );

  const addMatchToAccount = useCallback(
    (matchId: string, courtId: string, title?: string) => {
      if (!user) return;
      const mid = matchId.trim();
      if (!mid) return;
      const entry: RecentMatchEntry = { matchId: mid, courtId: courtId.trim(), openedAt: Date.now(), title: title?.trim() || undefined };
      setSavedMatches((prev) => [entry, ...prev.filter((x) => x.matchId !== mid)].slice(0, 20));
      supabase
        .from("user_matches")
        .upsert(
          { user_id: user.id, match_id: mid, court_id: courtId.trim() || null, title: title?.trim() || null, played_at: new Date().toISOString(), visibility: "friends" },
          { onConflict: "user_id,match_id" },
        )
        .then(() => {});
    },
    [user],
  );

  const updateMatchTitle = useCallback(
    (matchId: string, title: string) => {
      if (!user) return;
      setSavedMatches((prev) => prev.map((x) => x.matchId === matchId ? { ...x, title: title.trim() || undefined } : x));
      supabase.from("user_matches").update({ title: title.trim() || null }).eq("user_id", user.id).eq("match_id", matchId).then(() => {});
    },
    [user],
  );

  const removeMatchFromAccount = useCallback(
    (matchId: string) => {
      if (!user) return;
      setSavedMatches((prev) => prev.filter((x) => x.matchId !== matchId));
      supabase
        .from("user_matches")
        .delete()
        .eq("user_id", user.id)
        .eq("match_id", matchId)
        .then(() => {});
    },
    [user],
  );

  const value = useMemo<MatchHistoryContextValue>(
    () => ({ savedMatches, isMatchSaved, addMatchToAccount, removeMatchFromAccount, updateMatchTitle }),
    [savedMatches, isMatchSaved, addMatchToAccount, removeMatchFromAccount, updateMatchTitle],
  );

  return <MatchHistoryContext.Provider value={value}>{children}</MatchHistoryContext.Provider>;
}

export function useMatchHistory(): MatchHistoryContextValue {
  const ctx = useContext(MatchHistoryContext);
  if (!ctx) throw new Error("useMatchHistory must be used within MatchHistoryProvider");
  return ctx;
}
