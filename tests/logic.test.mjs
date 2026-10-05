// Unit tests for the one rule the site itself computes.
//
// Everything else the app knows -- ripeness staging, pre-press estimates,
// alternate-bearing forecasts, weight units -- runs inside the real Flutter app
// in the demo frame. Those rules live in the app repo and are exercised by that
// repo's own Dart test suite (351 tests). Duplicating a copy here is exactly the
// translation that drifted before, so there is nothing to test for them here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rendement } from '../src/logic.js';

test('rendement converts litres of oil to a percentage of olives', () => {
  const r = rendement(1000, 180);
  assert.equal(r.oil.toFixed(2), '164.88');       // 180 L x 0.916 kg/L
  assert.equal(r.pct.toFixed(2), '16.49');        // 164.88 / 1000
});

test('rendement rejects impossible input rather than reporting a wrong number', () => {
  assert.equal(rendement(0, 10), null);            // no olives weighed
  assert.equal(rendement(100, -1), null);         // negative oil
  assert.equal(rendement(NaN, 5), null);          // blank field
  assert.equal(rendement(-100, 5), null);         // negative olives
});

test('zero oil is a real answer, not a missing one', () => {
  assert.equal(rendement(100, 0).pct, 0);
});