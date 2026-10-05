// Ported from the app: lib/logic/ripeness_calculator.dart,
// lib/logic/rendement_calculator.dart, lib/logic/pre_press_estimate.dart,
// lib/logic/alternate_bearing.dart and lib/logic/weight_unit.dart.
// Only the demo's example parcel (Chemlali) is exercised, but every rule below
// follows the app's code path for path: thresholds, baselines, blending,
// spreads and the bearing signal are the app's, not approximations.
export const WEIGHTS = { g: 0, t: 2, p: 4.5, b: 7 };
export const CHEMLALI = { soon: 2.0, pickNow: 3.5, late: 5.5 };
export const OIL_DENSITY = 0.916; // kg per litre
export function ripeness(c, th = CHEMLALI) {
  const n = c.g + c.t + c.p + c.b;
  if (!n) return { index: 0, stage: 0, n: 0 };
  const raw = c.g * WEIGHTS.g + c.t * WEIGHTS.t + c.p * WEIGHTS.p + c.b * WEIGHTS.b;
  const index = parseFloat((raw / n).toFixed(2)); // round once, then classify
  const stage = index < th.soon ? 0 : index < th.pickNow ? 1 : index <= th.late ? 2 : 3;
  return { index, stage, n };
}
export function rendement(kg, litres) {
  if (!(kg > 0) || !(litres >= 0)) return null;
  const oil = litres * OIL_DENSITY;
  return { oil, pct: (oil / kg) * 100 };
}
// Variety baseline rendement ranges, from PrePressEstimateCalculator.baselineRendements.
export const BASELINES = {
  chemlali: [18.0, 24.0], chetoui: [17.0, 22.0], picual: [19.0, 25.0],
  koroneiki: [18.0, 23.0], arbequina: [16.0, 21.0], haouzia: [16.0, 21.0],
  aglandau: [16.0, 21.0], picholineDuLanguedoc: [15.0, 20.0],
  picholineMarocaine: [15.0, 20.0], sigoise: [15.0, 19.0],
  manzanilla: [13.0, 18.0], other: [15.0, 21.0],
};
// Pre-press oil estimate. Always a range, never a point estimate
// (constraint id="no-false-precision"). Confidence: 0 baseline only,
// 1 +ripeness, 2 +history.
export function estimate(kg, variety = 'chemlali', ripeIndex = null, histAvg = null) {
  const base = BASELINES[variety] || BASELINES.other;
  let [lo, hi] = base, conf = 0;
  const span = base[1] - base[0];
  if (ripeIndex != null) {
    conf = 1;
    const ix = Math.min(7, Math.max(0, ripeIndex));
    if (ix < 2.0) { lo = base[0]; hi = base[0] + span * 0.55; }
    else if (ix < 3.5) { lo = base[0] + span * 0.2; hi = base[0] + span * 0.75; }
    else if (ix <= 5.5) { lo = base[0] + span * 0.4; hi = base[1]; }
    else { lo = base[0] + span * 0.5; hi = base[1] + 1.0; }
  }
  if (histAvg != null) {
    conf = ripeIndex != null ? 2 : 1;
    const mid = ((lo + hi) / 2 * 0.5) + (histAvg * 0.5);
    lo = mid - 1.8; hi = mid + 1.8;
  }
  if (hi - lo < 2.5) { const mid = (lo + hi) / 2; lo = mid - 1.25; hi = mid + 1.25; }
  lo = parseFloat(lo.toFixed(1)); hi = parseFloat(hi.toFixed(1));
  if (!(kg > 0)) return { lo, hi, oilLo: 0, oilHi: 0, conf };
  const oilLo = parseFloat((kg * (lo / 100) / OIL_DENSITY).toFixed(1));
  const oilHi = parseFloat((kg * (hi / 100) / OIL_DENSITY).toFixed(1));
  return { lo, hi, oilLo, oilHi, conf };
}
// Mass-weighted rendement over mill logs (big deliveries outweigh samples).
// Logs without positive kg AND positive oil are dropped. Null when none valid.
export function weightedRendement(logs) {
  const valid = logs.filter((m) => m.kg > 0 && m.oil > 0);
  if (!valid.length) return null;
  const oilKg = valid.reduce((s, m) => s + m.oil * OIL_DENSITY, 0);
  const kg = valid.reduce((s, m) => s + m.kg, 0);
  return parseFloat(((oilKg / kg) * 100).toFixed(2));
}
// Alternate-bearing signal: this year vs trailing average (up to 3 years),
// 20% threshold. Returns -1 (likely light), 1 (likely heavy), 0 (balanced).
export function bearing(current, trailing) {
  if (!trailing.length || !(current > 0)) return 0;
  const hist = trailing.slice(-3);
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
  if (!(avg > 0)) return 0;
  const dev = (current - avg) / avg;
  if (dev >= 0.20) return -1;
  if (dev <= -0.20) return 1;
  return 0;
}
// Display units. Stored weights stay kilograms; quintals divide by 100.
export const toQ = (kg) => kg / 100;
export const fromQ = (q) => q * 100;
