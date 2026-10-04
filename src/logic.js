// Ported from the app: lib/logic/ripeness_calculator.dart and rendement_calculator.dart
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
