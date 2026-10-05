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
// Demo loader: the framed Flutter app downloads ~10MB (engine + CanvasKit) before
// first paint, which on a phone connection reads as a dead blank frame. Show a
// loading state until the engine actually paints, and a retry message if it never does.
(function () {
  const wrap = document.querySelector('.fdemo-wrap');
  const frame = wrap && wrap.querySelector('iframe.fdemo');
  const loader = wrap && wrap.querySelector('.fdemo-loading');
  if (!wrap || !frame || !loader) return;
  const done = () => loader.classList.add('done');
  const failed = () => {
    loader.innerHTML = '<p class="fdemo-failed">The demo could not load. Check your connection and try again.</p><p><button type="button" class="btn sm" id="fdemo-retry">Reload demo</button></p>';
    const retry = document.getElementById('fdemo-retry');
    if (retry) retry.addEventListener('click', () => location.reload());
  };
  const deadline = Date.now() + 90000;
  const tick = () => {
    let painted = false;
    try {
      const canvas = frame.contentDocument && frame.contentDocument.querySelector('canvas');
      painted = !!canvas && canvas.width > 0 && canvas.height > 0;
    } catch (_) { /* cross-origin during load; keep waiting */ }
    if (painted) { done(); return; }
    if (Date.now() > deadline) { failed(); return; }
    setTimeout(tick, 1000);
  };
  // Start polling once the frame document exists.
  frame.addEventListener('load', () => setTimeout(tick, 1000));
  setTimeout(() => { if (!loader.classList.contains('done')) tick(); }, 5000);
})();
