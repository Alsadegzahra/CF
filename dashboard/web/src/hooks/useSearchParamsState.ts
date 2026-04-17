import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Syncs React state with `window.location.search` (pushState, no full reload).
 */
export function useSearchParamsState() {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPop = () => setSearch(window.location.search);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const params = useMemo(() => new URLSearchParams(search), [search]);

  const setMatchParams = useCallback((matchId: string, courtId: string) => {
    const q = new URLSearchParams();
    q.set("match_id", matchId);
    if (courtId) q.set("court_id", courtId);
    const next = `${window.location.pathname}?${q.toString()}`;
    window.history.pushState({}, "", next);
    setSearch(window.location.search);
  }, []);

  const clearMatchParams = useCallback(() => {
    window.history.pushState({}, "", window.location.pathname);
    setSearch("");
  }, []);

  /** Offline demo: loads bundled mock data (no API). */
  const openDemoMatch = useCallback(() => {
    const q = new URLSearchParams();
    q.set("match_id", "match_demo");
    q.set("demo", "1");
    window.history.pushState({}, "", `${window.location.pathname}?${q.toString()}`);
    setSearch(window.location.search);
  }, []);

  return { params, setMatchParams, clearMatchParams, openDemoMatch };
}
