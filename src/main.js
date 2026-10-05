import { rendement } from './logic.js';
const $ = (id) => document.getElementById(id);
const root = document.documentElement;
root.classList.replace('no-js', 'js');
function mill() {
  const kg = parseFloat($('kg').value), l = parseFloat($('l').value), r = rendement(kg, l);
  $('rd').textContent = r ? r.pct.toFixed(2) + ' %' : '-';
  $('wk').textContent = r ? `${l} L \u00d7 0.916 = ${r.oil.toFixed(2)} kg of oil, from ${kg} kg of olives` : 'Enter the kilos delivered.';
}
$('kg').addEventListener('input', mill); $('l').addEventListener('input', mill);
mill();
// The page ripens: the background follows the section in view.
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) root.dataset.stage = e.target.dataset.stage;
}), { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('[data-stage]').forEach((s) => io.observe(s));

/* ---------------------------------------------------------------- demo
   Posters are static images taken from the real app by tools/build-demo.sh.
   They carry the look; the live build carries the behaviour, and it is only
   fetched on a deliberate tap. The marketing page never waits for it. */

const demo = document.querySelector('#demo');
const poster = demo && demo.querySelector('.poster');
const liveBtn = demo && demo.querySelector('#golive');

const ALT = {
  'my-trees': "The app's My Trees screen: a parcel called Near the well, 25 Chemlali trees, with a ripeness gauge reading Soon.",
  'overview': 'The parcel Overview: a ripeness gauge reading 2.98, harvest yield 15.3%, and an alternate-bearing forecast for 2026.',
  'ripeness': 'The Ripeness tab: an empty counter for Green, Turning, Purple and Black olives, and the gauge that reads them.',
  'harvest': 'The Harvest tab: the season total, a pre-press oil estimate given as a range, and the form to add a harvest entry.',
  'mill': 'The Mill tab: last and previous rendement, and the form to record olives delivered and oil received.',
  'years': 'The Years tab: a year-over-year bar chart of 2024 to 2026, and the yearly breakdown.',
  'settings': 'Settings: weight units in kilograms or quintals, language, and your data.',
};

function showShot(name) {
  if (!poster || !ALT[name]) return;
  poster.src = `/demo-posters/${name}.webp`;
  poster.alt = ALT[name];
  demo.querySelectorAll('.shotbtn').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.shot === name)));
}

demo && demo.querySelectorAll('.shotbtn').forEach((b) => {
  b.addEventListener('click', () => showShot(b.dataset.shot));
});

/* The demo lives at a path relative to the deployed site root, which build.py
   writes into the page as data-demo-url. Reading it here keeps this file free of
   a hardcoded path that would break on a subpath deploy (GitHub Pages). */
const DEMO_URL = document.body.dataset.demoUrl || '/flutter-demo/';

/* Warm the live build as the reader approaches the demo, so the tap is usually
   instant.
 *
 * Two deliberate limits:
 *  - rel="prefetch", not "preload": it is low priority and the browser may drop
 *    it. A preload would compete for bandwidth and be billed to the visitor on a
 *    metered connection even if they never tap.
 *  - Nothing here is render-blocking, so first paint never waits on the engine.
 *
 * Measured: the demo sits in the hero, so on a tall viewport it is already inside
 * the 600px margin at load and the prefetch starts immediately. That is intended
 * -- it costs the reader nothing they are waiting on -- but it does mean "no
 * engine bytes until asked" is only true for viewports where the demo starts
 * below the margin. The e2e suite asserts the property that actually matters:
 * first paint and interactivity never depend on the engine.
 */
if (demo) {
  const warm = () => {
    for (const file of ['main.dart.js', 'canvaskit/chromium/canvaskit.wasm']) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'fetch';
      link.href = `${DEMO_URL}${file}`;
      link.fetchPriority = 'low';
      document.head.append(link);
    }
  };
  new IntersectionObserver((es, o) => {
    if (es.some((e) => e.isIntersecting)) { warm(); o.disconnect(); }
  }, { rootMargin: '600px' }).observe(demo);
  // Keyboard users tabbing toward the button get the same head start.
  demo.addEventListener('focusin', warm, { once: true });
}

/* The live build is ~4MB compressed. Show what it costs, and let it fail without
   taking the page down with it. */
function goLive() {
  // The posters come out of the way rather than sitting above the live app: the
  // app is the point of the tap, and two phone frames stacked is just clutter.
  demo.classList.add('is-live');
  demo.querySelector('.shots')?.setAttribute('hidden', '');
  const frame = document.createElement('iframe');
  frame.className = 'fdlive';
  frame.src = DEMO_URL;
  frame.title = 'Zitouna running live';
  frame.loading = 'lazy';
  liveBtn.replaceWith(frame);
  frame.addEventListener('error', () => failLive());
}
function failLive() {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = 'The live demo could not start here. The screenshots above are the same app.';
  demo.querySelector('.livetrap').replaceChildren(p);
}
liveBtn && liveBtn.addEventListener('click', goLive);
