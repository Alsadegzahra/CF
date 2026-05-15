import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type Friend = {
  id: string; // profile id of the friend
  name: string;
  avatarUrl: string | null;
};

export type PendingRequest = {
  friendshipId: string;
  fromProfileId: string;
  fromName: string;
  fromAvatarUrl: string | null;
};

/** matchId -> playerSlot "1".."4" -> profileId | null */
export type MatchRosterMap = Record<string, Record<string, string | null>>;

type SocialContextValue = {
  friends: Friend[];
  pendingRequests: PendingRequest[];
  addFriend: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeFriend: (friendProfileId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  getFriend: (friendProfileId: string) => Friend | undefined;
  getAssignedFriendId: (matchId: string, playerId: string) => string | null;
  setPlayerFriendAssignment: (matchId: string, playerId: string, friendId: string | null) => void;
  loadRosterForMatch: (matchId: string) => void;
};

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [rosters, setRosters] = useState<MatchRosterMap>({});
  const loadedMatchRosters = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setPendingRequests([]);
      setRosters({});
      loadedMatchRosters.current.clear();
      return;
    }

    // Load accepted friends
    supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, profiles!friendships_addressee_id_fkey(id, display_name, avatar_url), profiles!friendships_requester_id_fkey(id, display_name, avatar_url)")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted")
      .then(({ data }) => {
        if (!data) return;
        const list: Friend[] = data.map((row: any) => {
          const isRequester = row.requester_id === user.id;
          const friendProfile = isRequester
            ? row["profiles!friendships_addressee_id_fkey"]
            : row["profiles!friendships_requester_id_fkey"];
          return {
            id: friendProfile?.id ?? "",
            name: friendProfile?.display_name ?? "Unknown",
            avatarUrl: friendProfile?.avatar_url ?? null,
          };
        });
        setFriends(list);
      });

    // Load pending requests (incoming)
    supabase
      .from("friendships")
      .select("id, requester_id, profiles!friendships_requester_id_fkey(id, display_name, avatar_url)")
      .eq("addressee_id", user.id)
      .eq("status", "pending")
      .then(({ data }) => {
        if (!data) return;
        setPendingRequests(
          data.map((row: any) => ({
            friendshipId: row.id,
            fromProfileId: row.requester_id,
            fromName: row["profiles!friendships_requester_id_fkey"]?.display_name ?? "Unknown",
            fromAvatarUrl: row["profiles!friendships_requester_id_fkey"]?.avatar_url ?? null,
          })),
        );
      });
  }, [user?.id]);

  const loadRosterForMatch = useCallback(
    (matchId: string) => {
      if (!user || loadedMatchRosters.current.has(matchId)) return;
      loadedMatchRosters.current.add(matchId);

      supabase
        .from("user_matches")
        .select("id")
        .eq("user_id", user.id)
        .eq("match_id", matchId)
        .single()
        .then(({ data: umRow }) => {
          if (!umRow) return;
          supabase
            .from("match_players")
            .select("player_slot, profile_id")
            .eq("user_match_id", umRow.id)
            .then(({ data: rows }) => {
              if (!rows) return;
              const slots: Record<string, string | null> = {};
              for (const r of rows) slots[String(r.player_slot)] = r.profile_id;
              setRosters((prev) => ({ ...prev, [matchId]: slots }));
            });
        });
    },
    [user?.id],
  );

  const addFriend = useCallback(
    async (username: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (!user) return { ok: false, error: "Not signed in." };
      const uname = username.trim().toLowerCase().replace(/^@/, "");
      if (!uname) return { ok: false, error: "Enter a username." };
      if (uname === user.username?.toLowerCase()) return { ok: false, error: "That's your own username." };

      const { data: rows, error: rpcError } = await supabase.rpc("find_profile_by_username", { lookup_username: uname });
      if (rpcError || !rows || rows.length === 0) return { ok: false, error: "No CourtFlow account found with that username." };

      const targetId = rows[0].id;
      const alreadyFriend = friends.some((f) => f.id === targetId);
      if (alreadyFriend) return { ok: false, error: "Already friends." };

      const { error } = await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: targetId,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") return { ok: false, error: "Friend request already sent." };
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
    [user, friends],
  );

  const removeFriend = useCallback(
    async (friendProfileId: string) => {
      if (!user) return;
      setFriends((prev) => prev.filter((f) => f.id !== friendProfileId));
      await supabase
        .from("friendships")
        .delete()
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${friendProfileId}),and(requester_id.eq.${friendProfileId},addressee_id.eq.${user.id})`,
        );
    },
    [user],
  );

  const acceptFriendRequest = useCallback(
    async (friendshipId: string) => {
      if (!user) return;
      const req = pendingRequests.find((r) => r.friendshipId === friendshipId);
      if (!req) return;

      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);
      if (error) return;

      setPendingRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
      setFriends((prev) => [
        ...prev,
        { id: req.fromProfileId, name: req.fromName, avatarUrl: req.fromAvatarUrl },
      ]);
    },
    [user, pendingRequests],
  );

  const declineFriendRequest = useCallback(
    async (friendshipId: string) => {
      if (!user) return;
      await supabase.from("friendships").update({ status: "declined" }).eq("id", friendshipId);
      setPendingRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    },
    [user],
  );

  const getFriend = useCallback(
    (friendProfileId: string) => friends.find((f) => f.id === friendProfileId),
    [friends],
  );

  const getAssignedFriendId = useCallback(
    (matchId: string, playerId: string) => rosters[matchId]?.[playerId] ?? null,
    [rosters],
  );

  const setPlayerFriendAssignment = useCallback(
    (matchId: string, playerId: string, friendId: string | null) => {
      if (!user) return;

      // Optimistic update
      setRosters((prev) => ({
        ...prev,
        [matchId]: { ...(prev[matchId] ?? {}), [playerId]: friendId },
      }));

      // Persist: ensure user_match exists then upsert slot
      supabase
        .from("user_matches")
        .upsert(
          { user_id: user.id, match_id: matchId, visibility: "friends", played_at: new Date().toISOString() },
          { onConflict: "user_id,match_id" },
        )
        .select("id")
        .single()
        .then(({ data: umRow }) => {
          if (!umRow) return;
          supabase
            .from("match_players")
            .upsert(
              { user_match_id: umRow.id, player_slot: parseInt(playerId, 10), profile_id: friendId },
              { onConflict: "user_match_id,player_slot" },
            )
            .then(() => {});
        });
    },
    [user],
  );

  const value = useMemo<SocialContextValue>(
    () => ({
      friends,
      pendingRequests,
      addFriend,
      removeFriend,
      acceptFriendRequest,
      declineFriendRequest,
      getFriend,
      getAssignedFriendId,
      setPlayerFriendAssignment,
      loadRosterForMatch,
    }),
    [friends, pendingRequests, addFriend, removeFriend, acceptFriendRequest, declineFriendRequest, getFriend, getAssignedFriendId, setPlayerFriendAssignment, loadRosterForMatch],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
}
