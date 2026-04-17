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

export type Friend = {
  id: string;
  name: string;
};

const friendsStorageKey = (userId: string) => `courtflow_friends_${userId}`;
const rosterStorageKey = (userId: string) => `courtflow_match_rosters_${userId}`;

/** matchId -> playerId "1".."4" -> friendId | null */
export type MatchRosterMap = Record<string, Record<string, string | null>>;

function readFriends(userId: string): Friend[] {
  try {
    const raw = localStorage.getItem(friendsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is Friend => x && typeof x === "object" && typeof (x as Friend).id === "string" && typeof (x as Friend).name === "string");
  } catch {
    return [];
  }
}

function writeFriends(userId: string, list: Friend[]) {
  try {
    localStorage.setItem(friendsStorageKey(userId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function readRosters(userId: string): MatchRosterMap {
  try {
    const raw = localStorage.getItem(rosterStorageKey(userId));
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) return o as MatchRosterMap;
  } catch {
    /* ignore */
  }
  return {};
}

function writeRosters(userId: string, m: MatchRosterMap) {
  try {
    localStorage.setItem(rosterStorageKey(userId), JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

type SocialContextValue = {
  friends: Friend[];
  addFriend: (name: string) => Friend | null;
  removeFriend: (friendId: string) => void;
  getFriend: (friendId: string) => Friend | undefined;
  getAssignedFriendId: (matchId: string, playerId: string) => string | null;
  setPlayerFriendAssignment: (matchId: string, playerId: string, friendId: string | null) => void;
};

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [friends, setFriends] = useState<Friend[]>([]);
  const [rosters, setRosters] = useState<MatchRosterMap>({});

  useEffect(() => {
    if (!userId) {
      setFriends([]);
      setRosters({});
      return;
    }
    setFriends(readFriends(userId));
    setRosters(readRosters(userId));
  }, [userId]);

  const addFriend = useCallback(
    (name: string) => {
      if (!userId) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      const id = crypto.randomUUID();
      const f: Friend = { id, name: trimmed };
      setFriends((prev) => {
        const next = [...prev, f];
        writeFriends(userId, next);
        return next;
      });
      return f;
    },
    [userId],
  );

  const removeFriend = useCallback(
    (friendId: string) => {
      if (!userId) return;
      setFriends((prev) => {
        const next = prev.filter((x) => x.id !== friendId);
        writeFriends(userId, next);
        return next;
      });
      setRosters((prev) => {
        const copy: MatchRosterMap = { ...prev };
        for (const mid of Object.keys(copy)) {
          const row = { ...copy[mid] };
          for (const pid of Object.keys(row)) {
            if (row[pid] === friendId) row[pid] = null;
          }
          copy[mid] = row;
        }
        writeRosters(userId, copy);
        return copy;
      });
    },
    [userId],
  );

  const getFriend = useCallback(
    (friendId: string) => friends.find((f) => f.id === friendId),
    [friends],
  );

  const getAssignedFriendId = useCallback(
    (matchId: string, playerId: string) => {
      return rosters[matchId]?.[playerId] ?? null;
    },
    [rosters],
  );

  const setPlayerFriendAssignment = useCallback(
    (matchId: string, playerId: string, friendId: string | null) => {
      if (!userId) return;
      setRosters((prev) => {
        const next: MatchRosterMap = {
          ...prev,
          [matchId]: { ...(prev[matchId] ?? {}), [playerId]: friendId },
        };
        writeRosters(userId, next);
        return next;
      });
    },
    [userId],
  );

  const value = useMemo<SocialContextValue>(
    () => ({
      friends,
      addFriend,
      removeFriend,
      getFriend,
      getAssignedFriendId,
      setPlayerFriendAssignment,
    }),
    [friends, addFriend, removeFriend, getFriend, getAssignedFriendId, setPlayerFriendAssignment],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
}
