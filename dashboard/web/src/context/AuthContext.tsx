import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

type AuthContextValue = {
  ready: boolean;
  user: AuthUser | null;
  isGuest: boolean;
  needsProfileSetup: boolean;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  loginWithGoogle: () => Promise<void>;
  completeProfileSetup: (username: string, displayName: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateProfile: (username: string, displayName: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchOrCreateProfile(authUser: SupabaseUser): Promise<{ user: AuthUser; needsSetup: boolean }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, username")
    .eq("id", authUser.id)
    .single();

  if (profile) {
    return {
      user: {
        id: authUser.id,
        email: authUser.email ?? "",
        displayName: profile.display_name,
        username: profile.username ?? null,
        avatarUrl: profile.avatar_url,
      },
      needsSetup: !profile.username,
    };
  }

  const displayName =
    (authUser.user_metadata?.full_name as string | undefined)?.trim() ||
    authUser.email?.split("@")[0] ||
    "Player";
  const avatarUrl = (authUser.user_metadata?.avatar_url as string | undefined) ?? null;

  await supabase.from("profiles").insert({
    id: authUser.id,
    display_name: displayName,
    avatar_url: avatarUrl,
    username: null,
  });

  return {
    user: { id: authUser.id, email: authUser.email ?? "", displayName, username: null, avatarUrl },
    needsSetup: true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(() => {
    try { return localStorage.getItem("courtflow_guest_v1") === "1"; } catch { return false; }
  });
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { user: u, needsSetup } = await fetchOrCreateProfile(session.user);
        setUser(u);
        setNeedsProfileSetup(needsSetup);
        setIsGuest(false);
      }
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { setUser(null); return; }
      const { user: u, needsSetup } = await fetchOrCreateProfile(session.user);
      setUser(u);
      setNeedsProfileSetup(needsSetup);
      setIsGuest(false);
      try { localStorage.removeItem("courtflow_guest_v1"); } catch { /* ignore */ }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const trimmed = displayName.trim();
    if (!trimmed) return { ok: false as const, error: "Please enter a display name." };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: trimmed } },
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const completeProfileSetup = useCallback(async (username: string, displayName: string) => {
    if (!user) return { ok: false as const, error: "Not signed in." };
    const uname = username.trim().toLowerCase();
    const dname = displayName.trim();
    if (!uname || !dname) return { ok: false as const, error: "Fill in all fields." };
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return { ok: false as const, error: "Username: 3-20 chars, letters/numbers/underscore only." };

    const { error } = await supabase
      .from("profiles")
      .update({ username: uname, display_name: dname, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Username already taken." };
      return { ok: false as const, error: error.message };
    }
    setUser((prev) => prev ? { ...prev, username: uname, displayName: dname } : null);
    setNeedsProfileSetup(false);
    return { ok: true as const };
  }, [user]);

  const updateProfile = useCallback(async (username: string, displayName: string) => {
    if (!user) return { ok: false as const, error: "Not signed in." };
    const uname = username.trim().toLowerCase();
    const dname = displayName.trim();
    if (!uname || !dname) return { ok: false as const, error: "Fill in all fields." };
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return { ok: false as const, error: "Username: 3-20 chars, letters/numbers/underscore only." };

    const { error } = await supabase
      .from("profiles")
      .update({ username: uname, display_name: dname, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "Username already taken." };
      return { ok: false as const, error: error.message };
    }
    setUser((prev) => prev ? { ...prev, username: uname, displayName: dname } : null);
    return { ok: true as const };
  }, [user]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsGuest(false);
    setNeedsProfileSetup(false);
    try { localStorage.removeItem("courtflow_guest_v1"); } catch { /* ignore */ }
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser(null);
    setIsGuest(true);
    try { localStorage.setItem("courtflow_guest_v1", "1"); } catch { /* ignore */ }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, user, isGuest, needsProfileSetup, loginWithEmail, registerWithEmail, loginWithGoogle, completeProfileSetup, updateProfile, logout, continueAsGuest }),
    [ready, user, isGuest, needsProfileSetup, loginWithEmail, registerWithEmail, loginWithGoogle, completeProfileSetup, updateProfile, logout, continueAsGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
