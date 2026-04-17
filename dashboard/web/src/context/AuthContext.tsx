import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Signed-in user (client-side demo — not production auth). */
export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

const USERS_KEY = "courtflow_accounts_v1";
const SESSION_KEY = "courtflow_session_v1";
const GUEST_KEY = "courtflow_guest_v1";

type StoredAccount = {
  id: string;
  email: string;
  /** Demo only — stored in plain text in localStorage. */
  password: string;
  displayName: string;
};

type AuthContextValue = {
  /** Hydration finished (read localStorage). */
  ready: boolean;
  user: AuthUser | null;
  /** User chose "continue without account". */
  isGuest: boolean;
  register: (email: string, password: string, displayName: string) => { ok: true } | { ok: false; error: "exists" | "invalid" };
  login: (email: string, password: string) => { ok: true } | { ok: false; error: "bad_credentials" | "invalid" };
  logout: () => void;
  continueAsGuest: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readAccounts(): Record<string, StoredAccount> {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, StoredAccount>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeAccounts(acc: Record<string, StoredAccount>) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(acc));
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    try {
      const guest = localStorage.getItem(GUEST_KEY) === "1";
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { userId?: string; email?: string };
        const email = typeof s.email === "string" ? s.email.toLowerCase().trim() : "";
        const accounts = readAccounts();
        const a = accounts[email];
        if (a && a.id === s.userId) {
          setUser({ id: a.id, email: a.email, displayName: a.displayName });
          setIsGuest(false);
          setReady(true);
          return;
        }
      }
      if (guest) {
        setIsGuest(true);
        setUser(null);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const register = useCallback((email: string, password: string, displayName: string) => {
    const e = email.trim().toLowerCase();
    const name = displayName.trim();
    if (!e || !password || !name) return { ok: false as const, error: "invalid" as const };
    const accounts = readAccounts();
    if (accounts[e]) return { ok: false as const, error: "exists" as const };
    const id = crypto.randomUUID();
    accounts[e] = { id, email: e, password, displayName: name };
    writeAccounts(accounts);
    setUser({ id, email: e, displayName: name });
    setIsGuest(false);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: id, email: e }));
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
    return { ok: true as const };
  }, []);

  const login = useCallback((email: string, password: string) => {
    const e = email.trim().toLowerCase();
    if (!e || !password) return { ok: false as const, error: "invalid" as const };
    const accounts = readAccounts();
    const a = accounts[e];
    if (!a || a.password !== password) return { ok: false as const, error: "bad_credentials" as const };
    setUser({ id: a.id, email: a.email, displayName: a.displayName });
    setIsGuest(false);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: a.id, email: e }));
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
    return { ok: true as const };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsGuest(false);
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser(null);
    setIsGuest(true);
    try {
      localStorage.setItem(GUEST_KEY, "1");
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      isGuest,
      register,
      login,
      logout,
      continueAsGuest,
    }),
    [ready, user, isGuest, register, login, logout, continueAsGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
