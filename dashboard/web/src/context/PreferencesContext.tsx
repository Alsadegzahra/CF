import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "../i18n/strings";
import { translate } from "../i18n/strings";

const STORAGE_LOCALE = "courtflow_locale";
const STORAGE_NAMES = "courtflow_player_names";
const STORAGE_TEAM_NAMES = "courtflow_team_names";
/** Set when the user confirms language (this session); language screen shows until then. */
const SESSION_LANG_GATE = "courtflow_lang_gate";

function readLangGate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SESSION_LANG_GATE) === "1";
  } catch {
    return false;
  }
}

export type PlayerDisplayNames = Record<string, string>;

/** Custom labels for Team A / B (empty string = use translated default). */
export type TeamDisplayNames = { A: string; B: string };

type PreferencesContextValue = {
  locale: Locale;
  /** True after the user confirms language this browser session (sessionStorage). Until then, show the language screen first. */
  languageGateDone: boolean;
  t: (key: string) => string;
  /** Custom display names by player id "1".."4" */
  playerDisplayNames: PlayerDisplayNames;
  setPlayerDisplayNames: (
    names: PlayerDisplayNames | ((prev: PlayerDisplayNames) => PlayerDisplayNames),
  ) => void;
  teamDisplayNames: TeamDisplayNames;
  setTeamDisplayNames: (names: TeamDisplayNames | ((prev: TeamDisplayNames) => TeamDisplayNames)) => void;
  setLocale: (locale: Locale) => void;
  /** Resolve label: custom name or fallback e.g. P1 */
  displayNameForPlayer: (playerId: string, fallbackLabel: string) => string;
  /** Team label: custom or localized "Team A" / "Team B". */
  displayNameForTeam: (team: "A" | "B") => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readLocale(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_LOCALE);
    if (v === "en" || v === "ar") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function readPlayerNames(): PlayerDisplayNames {
  try {
    const raw = localStorage.getItem(STORAGE_NAMES);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) return o as PlayerDisplayNames;
  } catch {
    /* ignore */
  }
  return {};
}

function readTeamNames(): TeamDisplayNames {
  try {
    const raw = localStorage.getItem(STORAGE_TEAM_NAMES);
    if (!raw) return { A: "", B: "" };
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const rec = o as Record<string, unknown>;
      return {
        A: typeof rec.A === "string" ? rec.A : "",
        B: typeof rec.B === "string" ? rec.B : "",
      };
    }
  } catch {
    /* ignore */
  }
  return { A: "", B: "" };
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale === "ar" ? "ar" : "en";
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [localeState, setLocaleState] = useState<Locale | null>(() => readLocale());
  const [languageGateDone, setLanguageGateDone] = useState<boolean>(() => readLangGate());
  const [playerDisplayNames, setPlayerDisplayNamesState] = useState<PlayerDisplayNames>(() => readPlayerNames());
  const [teamDisplayNames, setTeamDisplayNamesState] = useState<TeamDisplayNames>(() => readTeamNames());

  const locale: Locale = localeState ?? "en";

  useLayoutEffect(() => {
    const l = readLocale();
    if (l) applyDocumentLocale(l);
  }, []);

  useEffect(() => {
    if (localeState) applyDocumentLocale(localeState);
  }, [localeState]);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(STORAGE_LOCALE, l);
    } catch {
      /* ignore */
    }
    setLocaleState(l);
    applyDocumentLocale(l);
    try {
      sessionStorage.setItem(SESSION_LANG_GATE, "1");
    } catch {
      /* ignore */
    }
    setLanguageGateDone(true);
  }, []);

  const setPlayerDisplayNames = useCallback(
    (names: PlayerDisplayNames | ((prev: PlayerDisplayNames) => PlayerDisplayNames)) => {
      setPlayerDisplayNamesState((prev) => {
        const next = typeof names === "function" ? names(prev) : names;
        try {
          localStorage.setItem(STORAGE_NAMES, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const setTeamDisplayNames = useCallback((names: TeamDisplayNames | ((prev: TeamDisplayNames) => TeamDisplayNames)) => {
    setTeamDisplayNamesState((prev) => {
      const next = typeof names === "function" ? names(prev) : names;
      try {
        localStorage.setItem(STORAGE_TEAM_NAMES, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const displayNameForPlayer = useCallback(
    (playerId: string, fallbackLabel: string) => {
      const custom = playerDisplayNames[playerId]?.trim();
      return custom || fallbackLabel;
    },
    [playerDisplayNames],
  );

  const displayNameForTeam = useCallback(
    (team: "A" | "B") => {
      const custom = teamDisplayNames[team]?.trim();
      if (custom) return custom;
      return team === "A" ? translate(locale, "summary.teamA") : translate(locale, "summary.teamB");
    },
    [teamDisplayNames, locale],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      locale,
      languageGateDone,
      t,
      playerDisplayNames,
      setPlayerDisplayNames,
      teamDisplayNames,
      setTeamDisplayNames,
      setLocale,
      displayNameForPlayer,
      displayNameForTeam,
    }),
    [
      locale,
      languageGateDone,
      t,
      playerDisplayNames,
      setPlayerDisplayNames,
      teamDisplayNames,
      setTeamDisplayNames,
      setLocale,
      displayNameForPlayer,
      displayNameForTeam,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
