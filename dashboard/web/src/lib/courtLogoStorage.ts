const KEY = "courtflow_court_logos_v1";

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && !Array.isArray(o)) return o as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeMap(m: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Per-court image URL (HTTPS or same-origin), set from the match picker or kept from a previous session. */
export function getStoredCourtLogo(courtId: string): string | null {
  const id = courtId.trim();
  if (!id) return null;
  const u = readMap()[id];
  return typeof u === "string" && u.trim() ? u.trim() : null;
}

export function setStoredCourtLogo(courtId: string, url: string | null): void {
  const id = courtId.trim();
  if (!id) return;
  const m = readMap();
  if (url == null || !url.trim()) {
    delete m[id];
  } else {
    m[id] = url.trim();
  }
  writeMap(m);
}

/** Prefer stored logo (dashboard), then report JSON from API/pipeline. */
export function resolveCourtLogoUrl(courtId: string, reportLogoUrl: string | null | undefined): string | null {
  const stored = getStoredCourtLogo(courtId);
  if (stored) return stored;
  if (typeof reportLogoUrl === "string" && reportLogoUrl.trim()) return reportLogoUrl.trim();
  return null;
}
