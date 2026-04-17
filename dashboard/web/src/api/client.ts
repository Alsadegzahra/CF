import { getApiBase } from "./config";

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.statusText || "Request failed", res.status, text);
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Invalid JSON response", res.status, text);
  }
}

export async function fetchCloudUrls(matchId: string): Promise<{
  highlights_url?: string | null;
  report_url?: string | null;
  heatmap_url?: string | null;
} | null> {
  try {
    return await fetchJson(`/matches/${encodeURIComponent(matchId)}/cloud/urls`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) return null;
    return null;
  }
}
