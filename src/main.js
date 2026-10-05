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
   The app is the demo. A poster of it is shown only while the real thing loads,
   then swapped out, so the page is never a gallery of screenshots pretending to
   be software. Everything here is generated from the app repo; see
   tools/build-demo.sh. */

const demo = document.querySelector('#demo');
const stage = demo && demo.querySelector('.stage');
const srcNote = document.querySelector('#demosrc');
const DEMO_URL = document.body.dataset.demoUrl || '/flutter-demo/';

let started = false;

/**
 * Put the real app in the frame. The poster stays visible underneath until the
 * engine has actually painted, so there is no blank gap, then it is removed.
 */
function startApp() {
  if (!stage || started) return;
  started = true;

  const frame = document.createElement('iframe');
  frame.className = 'fdlive';
  frame.src = DEMO_URL;
  frame.title = 'Zitouna running in your browser';
  // Sits over the poster, so the poster is what is seen until the app paints.
  stage.append(frame);

  // A frame's `load` also fires for an error page, so it cannot be trusted to mean
  // "the app is up". Wait for Flutter's own host element instead. Hiding the
  // poster on a plain load would blank the section whenever the engine fails.
  frame.addEventListener('load', () => {
    let tries = 0;
    const check = () => {
      let up = false;
      try {
        up = !!frame.contentDocument?.querySelector('flutter-view, flt-glass-pane');
      } catch { /* cross-origin: not ours, so not a failure */ }
      if (up) { frame.dataset.ready = '1'; return; }
      if (++tries > 120) { frame.classList.add('failed'); note(); return; }
      setTimeout(check, 500);
    };
    setTimeout(check, 500);
  }, { once: true });

  function note() {
    if (srcNote) srcNote.textContent = 'The app could not start here, so this is a screenshot of it.';
  }
}

/* Start as soon as the demo is worth starting: in view, or on the first hint that
   the visitor is going to interact. rel="prefetch" on the engine files is low
   priority and droppable, so warming them costs the reader nothing. */
if (demo) {
  new IntersectionObserver((es, o) => {
    if (es.some((e) => e.isIntersecting)) { startApp(); o.disconnect(); }
  }, { rootMargin: '400px' }).observe(demo);
  demo.addEventListener('pointerenter', startApp, { once: true, passive: true });
  demo.addEventListener('focusin', startApp, { once: true });

  for (const file of ['main.dart.js', 'canvaskit/chromium/canvaskit.wasm']) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'fetch';
    link.href = `${DEMO_URL}${file}`;
    link.fetchPriority = 'low';
    document.head.append(link);
  }
}
