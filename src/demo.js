// Demo of the app's parcel screen. Rules come from logic.js (ported from the app); geometry from ripeness_arc_gauge.dart.
import { ripeness, rendement } from './logic.js';
import { gaugeSvg as gauge } from './gauge.js';
const $ = (s, r = document) => r.querySelector(s);
const STAGES = ['Too Early', 'Soon', 'Pick Now', 'Getting Late'];
const BUCKETS = [['g', 'Green', 0], ['t', 'Turning', 1], ['p', 'Purple', 2], ['b', 'Black', 3]];
const st = { tab: 'overview', c: { g: 0, t: 0, p: 0, b: 0 }, checks: [], mill: null, kg: '', l: '' };
const chip = (s) => `<span class="chip k${s}">${STAGES[s]}</span>`;
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const views = {
  overview() {
    const l = st.checks[st.checks.length - 1];
    return `<section class="card big"><div class="row"><span class="lbl">Check Ripeness</span>${l ? chip(l.stage) : '<span class="dash"></span>'}</div>${gauge(l ? l.index : 0, true)}
<p class="cap">${st.checks.length} ripeness checks logged \u00b7 last on ${l ? l.date : '\u2014'}</p></section>
<section class="card"><p class="v">${st.mill ? st.mill.toFixed(2) + ' %' : '\u2014'}</p><p class="t">What the Mill Gave Me</p><p class="cap">${st.mill ? 'Last rendement' : 'No mill deliveries recorded yet.'}</p></section>
<section class="card"><p class="t">Alternate-Bearing Forecast</p><p>Record at least 2 seasons to unlock alternate-bearing forecasts for this parcel.</p></section>`;
  },
  ripeness() {
    return `<section class="card hint"><p class="t">Spread ~50 olives on a flat surface</p></section><section class="card big"><div id="g" aria-hidden="true"></div><div class="read" aria-hidden="true"><span id="chip"></span><p class="idx"><b id="idx"></b> <small>/ 7.00</small></p></div><p class="sr" id="sum" role="status"></p></section>
${BUCKETS.map(([k, n, s]) => `<div class="ctr"><i class="dot d${s}"></i><span class="cl">${n}</span><button class="rb" data-k="${k}" data-d="-1" aria-label="Remove one ${n} olive">\u2212</button><output id="n-${k}" aria-label="${n} count">0</output><button class="rb" data-k="${k}" data-d="1" aria-label="Add one ${n} olive">+</button><button class="rb five" data-k="${k}" data-d="5" aria-label="Add five ${n} olives">+5</button></div>`).join('')}
<button class="save" id="save">Save Ripeness Check</button>`;
  },
  mill() {
    return `<section class="card"><label class="f">Olives delivered, kg<input id="kg" type="number" inputmode="decimal" min="0" value="${st.kg}"></label><label class="f">Oil received, litres<input id="l" type="number" inputmode="decimal" min="0" value="${st.l}"></label>
<p class="cap">Extraction Rendement</p><p class="v" id="rd" aria-live="polite">\u2014</p><p class="cap" id="wk">Enter both amounts.</p></section><button class="save" id="save">Save Delivery</button>`;
  },
};

function paintRipeness() {
  const r = ripeness(st.c);
  $('#g').innerHTML = gauge(r.index, false); $('#chip').innerHTML = chip(r.stage); $('#idx').textContent = r.index.toFixed(2);
  $('#sum').textContent = `${STAGES[r.stage]}. Ripeness index ${r.index.toFixed(2)} of 7.00, from ${r.n} olives.`;
  for (const k in st.c) { $('#n-' + k).textContent = st.c[k]; $(`.rb[data-k=${k}][data-d="-1"]`).setAttribute('aria-disabled', !st.c[k]); }
  $('#save').setAttribute('aria-disabled', !r.n);
}
function toast(m) { const t = $('#toast'); t.textContent = ''; setTimeout(() => { t.textContent = m; }, 60); t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
function show(tab, focus) {
  st.tab = tab;
  document.querySelectorAll('#demo [role=tab]').forEach((b) => { const on = b.dataset.t === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  const p = $('#p'); p.setAttribute('aria-labelledby', 't-' + tab); p.innerHTML = views[tab]();
  if (tab === 'ripeness') {
    paintRipeness();
    p.querySelectorAll('.rb').forEach((b) => b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') === 'true') return; const k = b.dataset.k; st.c[k] = Math.max(0, st.c[k] + +b.dataset.d); paintRipeness(); }));
    $('#save').onclick = () => { const r = ripeness(st.c); if (!r.n) return; st.checks.push({ ...r, date: today() }); toast('Ripeness check saved successfully'); };
  }
  if (tab === 'mill') {
    const upd = () => { st.kg = $('#kg').value; st.l = $('#l').value; const kg = parseFloat($('#kg').value), l = parseFloat($('#l').value), r = rendement(kg, l);
      $('#rd').textContent = r ? r.pct.toFixed(2) + ' %' : '\u2014'; $('#wk').textContent = r ? `${l} L \u00d7 0.916 = ${r.oil.toFixed(2)} kg of oil` : 'Enter both amounts.'; $('#save').setAttribute('aria-disabled', !r); st.pend = r; };
    $('#kg').oninput = $('#l').oninput = upd; upd();
    $('#save').onclick = () => { if (st.pend) { st.mill = st.pend.pct; toast('Mill delivery saved successfully'); } };
  }
}
const root = $('#demo');
root.innerHTML = `<div class="app" role="group" aria-label="Zitouna app demo"><header class="ah"><p class="nm">Example parcel</p><p>Chemlali \u00b7 25 trees</p></header>
<div class="tabs" role="tablist" aria-label="Parcel sections">${[['overview', 'Overview'], ['ripeness', 'Ripeness'], ['mill', 'Mill']].map(([k, l]) => `<button role="tab" id="t-${k}" aria-controls="p" data-t="${k}">${l}</button>`).join('')}</div>
<div id="p" role="tabpanel" tabindex="0"></div><div class="toast" id="toast" role="status"></div></div>`;
const order = ['overview', 'ripeness', 'mill'];
root.querySelectorAll('[role=tab]').forEach((b) => { b.onclick = () => show(b.dataset.t); b.onkeydown = (e) => { const i = order.indexOf(st.tab), n = { ArrowRight: (i + 1) % 3, ArrowLeft: (i + 2) % 3, Home: 0, End: 2 }[e.key]; if (n !== undefined) { e.preventDefault(); show(order[n], true); } }; });
show('overview');
