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
