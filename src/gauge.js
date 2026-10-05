// Gauge geometry from lib/widgets/ripeness_arc_gauge.dart (full 340x176, mini 300x140).
import { CHEMLALI } from './logic.js';
const GEO = { full: { w: 340, h: 176, r: 138, sw: 15, mr: 8.5, mw: 3.2 }, mini: { w: 300, h: 140, r: 130, sw: 10, mr: 7.5, mw: 3.5 } };
export function geometry(mini) { const g = mini ? GEO.mini : GEO.full; return { ...g, cx: g.w / 2, cy: g.h - g.sw / 2 }; }
export function point(index, mini) {
  const g = geometry(mini), f = Math.min(1, Math.max(0, index / 7)), t = ((180 - f * 180) * Math.PI) / 180;
  return [g.cx + g.r * Math.cos(t), g.cy - g.r * Math.sin(t)];
}
export function fits(mini) { const g = geometry(mini); return g.cy - g.r - g.sw / 2 >= 0 && g.cy + g.sw / 2 <= g.h && g.cx - g.r - g.sw / 2 >= 0 && g.cx + g.r + g.sw / 2 <= g.w; }
export function gaugeSvg(index, mini) {
  const g = geometry(mini), f = (n) => n.toFixed(2), pt = (v) => point(v, mini);
  const b = [0, CHEMLALI.soon, CHEMLALI.pickNow, CHEMLALI.late, 7];
  let s = `<svg class="gauge" viewBox="0 0 ${g.w} ${g.h}" role="img" aria-label="Ripeness gauge, index ${index.toFixed(2)} of 7.00">`;
  for (let i = 0; i < 4; i++) { const [p, q] = [pt(b[i]), pt(b[i + 1])]; s += `<path class="gs gs${i}" stroke-width="${g.sw}" fill="none" d="M${f(p[0])} ${f(p[1])}A${g.r} ${g.r} 0 0 1 ${f(q[0])} ${f(q[1])}"/>`; }
  const [a, z] = [pt(0), pt(7)];
  s += `<circle class="gf gf0" cx="${f(a[0])}" cy="${f(a[1])}" r="${g.sw / 2}"/><circle class="gf gf3" cx="${f(z[0])}" cy="${f(z[1])}" r="${g.sw / 2}"/>`;
  if (!mini) for (const v of b.slice(1, 4)) { const p = pt(v); s += `<circle class="tick" cx="${f(p[0])}" cy="${f(p[1])}" r="3"/>`; }
  const m = pt(index);
  if (!mini) s += `<circle class="halo" cx="${f(m[0])}" cy="${f(m[1])}" r="13"/>`;
  return s + `<circle class="mk" cx="${f(m[0])}" cy="${f(m[1])}" r="${g.mr}" stroke-width="${g.mw}"/></svg>`;
}
