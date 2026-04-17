/**
 * Normalized padel court zones — keep in sync with `src/analytics/spatial.py`.
 * y ∈ [0,1]: 0 and 1 are baselines, 0.5 is the net. Team A = y < 0.5, Team B = y > 0.5.
 */
export const COURT_HEIGHT_M = 20;
export const SERVICE_LINE_FROM_BASELINE_M = 3.05;
export const NET_ATTACK_DEPTH_M = 3;

export const SERVICE_LINE_NORM = SERVICE_LINE_FROM_BASELINE_M / COURT_HEIGHT_M;
export const NET_Y_LOW = 0.5 - NET_ATTACK_DEPTH_M / COURT_HEIGHT_M;
export const NET_Y_HI = 0.5 + NET_ATTACK_DEPTH_M / COURT_HEIGHT_M;

/** Map normalized court y to SVG y (viewBox height = 200, top = baseline 0). */
export function normYToSvgY(y: number, viewH = 200): number {
  return y * viewH;
}
