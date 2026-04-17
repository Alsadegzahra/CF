/**
 * API origin for fetches. Empty string = same origin (Vite dev proxy or FastAPI serving the SPA at /).
 * Override with VITE_API_URL=http://127.0.0.1:8000 when the UI is on a different host.
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  return (raw ?? "").replace(/\/$/, "");
}
