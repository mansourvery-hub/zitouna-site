import test from 'node:test';
import assert from 'node:assert/strict';
// src/logic.js backs the static mill section (src/main.js). The gauge translation
// (src/gauge.js) was removed with the HTML demo: the real RipenessArcGauge now
// renders inside the framed Flutter app, so testing a dead copy would be worse
// than testing nothing.
import { ripeness, rendement, estimate, weightedRendement, bearing, toQ, fromQ } from '../src/logic.js';
const z = { g: 0, t: 0, p: 0, b: 0 };
test('empty sample is Too Early at 0.00', () => assert.deepEqual(ripeness(z), { index: 0, stage: 0, n: 0 }));
test('boundaries (Chemlali 2.0 / 3.5 / 5.5)', () => {
  assert.equal(ripeness({ ...z, g: 1, t: 49 }).stage, 0);       // 1.96
  assert.equal(ripeness({ ...z, t: 50 }).stage, 1);             // 2.00 is Soon
  assert.equal(ripeness({ ...z, g: 2, b: 2 }).index, 3.5);
  assert.equal(ripeness({ ...z, g: 2, b: 2 }).stage, 2);        // 3.50 is Pick Now
  assert.equal(ripeness({ ...z, p: 3, b: 2 }).index, 5.5);
  assert.equal(ripeness({ ...z, p: 3, b: 2 }).stage, 2);        // 5.50 is still Pick Now
  assert.equal(ripeness({ ...z, p: 2, b: 2 }).stage, 3);        // 5.75 is Getting Late
});
test('stage always agrees with the displayed index', () => {
  for (let g = 0; g <= 12; g += 3) for (let t = 0; t <= 12; t += 2) for (let p = 0; p <= 12; p += 2) for (let b = 0; b <= 12; b++) {
    const r = ripeness({ g, t, p, b }); if (!r.n) continue;
    const shown = Number(r.index.toFixed(2)), want = shown < 2 ? 0 : shown < 3.5 ? 1 : shown <= 5.5 ? 2 : 3;
    assert.equal(r.stage, want, JSON.stringify({ g, t, p, b }));
  }
});
test('rendement', () => {
  assert.equal(rendement(1000, 180).pct.toFixed(2), '16.49');
  assert.equal(rendement(0, 10), null); assert.equal(rendement(100, -1), null); assert.equal(rendement(NaN, 5), null);
  assert.equal(rendement(100, 0).pct, 0);
});
test('pre-press estimate is always a range (never a point)', () => {
  for (const [kg, ix, hist] of [[100, null, null], [100, 1.0, null], [100, 4.0, 16.5], [100, 6.0, 20.0], [0, 4.0, 16.5]]) {
    const e = estimate(kg, 'chemlali', ix, hist);
    assert.ok(e.hi - e.lo >= 2.5, JSON.stringify({ kg, ix, hist, e }));
  }
  const e = estimate(100, 'chemlali', 4.0, 16.5);
  assert.equal(e.conf, 2);
  assert.equal(estimate(100, 'chemlali').conf, 0);
  assert.equal(estimate(100, 'chemlali', 4.0).conf, 1);
});
test('weighted rendement drops invalid logs, null when none valid', () => {
  assert.equal(weightedRendement([{ kg: 1000, oil: 180 }]), 16.49);
  assert.equal(weightedRendement([{ kg: 0, oil: 10 }, { kg: -5, oil: 3 }]), null);
  assert.equal(weightedRendement([]), null);
});
test('alternate-bearing signal follows the 20% rule', () => {
  assert.equal(bearing(15, [10, 10, 10]), -1);  // +50%: likely light next
  assert.equal(bearing(5, [10, 10, 10]), 1);    // -50%: likely heavy next
  assert.equal(bearing(10.5, [10, 10, 10]), 0); // +5%: balanced
  assert.equal(bearing(10, []), 0);
  assert.equal(bearing(0, [10]), 0);
});
test('quintal conversion is exact', () => {
  assert.equal(toQ(250), 2.5); assert.equal(fromQ(2.5), 250);
});
