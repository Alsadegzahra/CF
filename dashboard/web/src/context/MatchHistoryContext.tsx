import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

export type RecentMatchEntry = {
  matchId: string;
  courtId: string;
  openedAt: number;
};

const MAX_RECENT = 20;

const storageKey = (userId: string) => `courtflow_recent_matches_v1_${userId}`;

function readList(userId: string): RecentMatchEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RecentMatchEntry =>
          x &&
          typeof x === "object" &&
          typeof (x as RecentMatchEntry).matchId === "string" &&
          typeof (x as RecentMatchEntry).courtId === "string" &&
          typeof (x as RecentMatchEntry).openedAt === "number",
      )
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeList(userId: string, list: RecentMatchEntry[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

type MatchHistoryContextValue = {
  /** Matches the user explicitly saved (localStorage per account until backend exists). */
  savedMatches: RecentMatchEntry[];
  isMatchSaved: (matchId: string) => boolean;
  addMatchToAccount: (matchId: string, courtId: string) => void;
  removeMatchFromAccount: (matchId: string) => void;
};

const MatchHistoryContext = createContext<MatchHistoryContextValue | null>(null);

export function MatchHistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [savedMatches, setSavedMatches] = useState<RecentMatchEntry[]>([]);

  useEffect(() => {
    if (!userId) {
      setSavedMatches([]);
      return;
    }
    setSavedMatches(readList(userId));
  }, [userId]);

  const isMatchSaved = useCallback(
    (matchId: string) => savedMatches.some((x) => x.matchId === matchId.trim()),
    [savedMatches],
  );

  const addMatchToAccount = useCallback(
    (matchId: string, courtId: string) => {
      if (!userId) return;
      const mid = matchId.trim();
      if (!mid) return;
      const cid = courtId.trim();
      const list = readList(userId);
      const without = list.filter((x) => x.matchId !== mid);
      const next: RecentMatchEntry[] = [{ matchId: mid, courtId: cid, openedAt: Date.now() }, ...without].slice(
        0,
        MAX_RECENT,
      );
      writeList(userId, next);
      setSavedMatches(next);
    },
    [userId],
  );

  const removeMatchFromAccount = useCallback(
    (matchId: string) => {
      if (!userId) return;
      const next = readList(userId).filter((x) => x.matchId !== matchId);
      writeList(userId, next);
      setSavedMatches(next);
    },
    [userId],
  );

  const value = useMemo<MatchHistoryContextValue>(
    () => ({ savedMatches, isMatchSaved, addMatchToAccount, removeMatchFromAccount }),
    [savedMatches, isMatchSaved, addMatchToAccount, removeMatchFromAccount],
  );

  return <MatchHistoryContext.Provider value={value}>{children}</MatchHistoryContext.Provider>;
}

export function useMatchHistory(): MatchHistoryContextValue {
  const ctx = useContext(MatchHistoryContext);
  if (!ctx) throw new Error("useMatchHistory must be used within MatchHistoryProvider");
  return ctx;
}
