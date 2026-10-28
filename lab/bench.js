/* lab/bench.js: what the six benches of the Light Lab share.
 *
 * Every bench is a ship.viewport with its own scene; the things they have in
 * common live here rather than six times over: the spectral colour function
 * in GLSL (the same fit physics.js uses in JS, so a ray on screen and a number
 * in a readout agree), Cauchy dispersion for real glasses, a one-draw-call
 * set of beams of light, the octave strip under each instrument, and the
 * small DOM makers (dials, chips, readouts) that keep the page honest about
 * which value is truth and which is display.
 */
import { THREE, label, glowSprite } from '../ship/ship.js';
import * as P from '../ship/physics.js';

export { THREE, P };

/* ---- colour -------------------------------------------------------------- */
export const TAU = Math.PI * 2, DEG = Math.PI / 180;
export const clamp = P.clamp;
export const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export const colorOfNm = nm => { const [r, g, b] = P.lambdaRGB(nm); return new THREE.Color(r / 255, g / 255, b / 255); };
export const rgb01 = nm => P.lambdaRGB(nm).map(v => v / 255);
export const cssOfNm = (nm, a = 1) => { const c = P.lambdaRGB(nm); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

/* Bruton's fit, in GLSL, identical to P.lambdaRGB: returns 0..1 sRGB-ish.
   Any shader that colours by wavelength includes this chunk. */
export const GLSL_WL = `
vec3 wl2rgb(float nm){
  float r=0.,g=0.,b=0.;
  if(nm<440.){r=-(nm-440.)/60.;b=1.;}
  else if(nm<490.){g=(nm-440.)/50.;b=1.;}
  else if(nm<510.){g=1.;b=-(nm-510.)/20.;}
  else if(nm<580.){r=(nm-510.)/70.;g=1.;}
  else if(nm<645.){r=1.;g=-(nm-645.)/65.;}
  else r=1.;
  float k=nm<420.?.3+.7*(nm-380.)/40.:(nm>700.?.3+.7*(750.-nm)/50.:1.);
  return pow(max(vec3(r,g,b)*k,0.),vec3(.8));}
float hash1(float n){return fract(sin(n)*43758.5453);}
`;

/* ---- dispersion: Cauchy from the two numbers a glass catalogue gives -------
   n(lambda) = A + B / lambda^2 with lambda in micrometres. From the d-line
   index and the Abbe number V = (n_d - 1) / (n_F - n_C), with F = 486.13 nm,
   d = 587.56 nm, C = 656.27 nm:
     B = (n_d - 1) / V / (1/0.48613^2 - 1/0.65627^2) = (n_d - 1) / (1.9097 V)
     A = n_d - B / 0.58756^2
   Good to a few 1e-4 across the visible for ordinary glasses. */
const ABBE_K = 1 / (0.48613 * 0.48613) - 1 / (0.65627 * 0.65627);
export function cauchy(nd, V) {
  const B = V > 0 ? (nd - 1) / V / ABBE_K : 0;
  const A = nd - B / (0.58756 * 0.58756);
  const n = um => A + B / (um * um);
  return { A, B, nd, V, n, nNm: nm => n(nm / 1000) };
}
/* real materials: d-line index and Abbe number (Schott, CRC) */
export const MATERIALS = [
  { id: 'water',   name: 'Water',        nd: 1.3330, V: 55.7 },
  { id: 'silica',  name: 'Fused silica', nd: 1.4585, V: 67.8 },
  { id: 'bk7',     name: 'BK7 crown',    nd: 1.5168, V: 64.2 },
  { id: 'f2',      name: 'F2 flint',     nd: 1.6200, V: 36.4 },
  { id: 'sf10',    name: 'SF10 dense flint', nd: 1.7283, V: 28.5 },
  { id: 'diamond', name: 'Diamond',      nd: 2.4175, V: 55.3 },
];

/* ---- a set of beams, one draw call ------------------------------------------
   An instanced open tube running 0..1 along +Y, aimed and stretched per
   instance; a soft additive shader so a beam reads as light, not a wire.
   set(i, from, to, radius, color, alpha) poses one; use(n) says how many. */
const BVERT = `
attribute float aAlpha; attribute vec3 aColor;
varying vec2 vUv; varying vec3 vN, vW, vC; varying float vA;
void main(){
  vUv = uv; vC = aColor; vA = aAlpha;
  mat4 im = instanceMatrix;
  vec3 n = normalize(mat3(im) * normal);
  vN = normalMatrix * n;
  vec4 mv = modelViewMatrix * im * vec4(position, 1.0);
  vW = mv.xyz; gl_Position = projectionMatrix * mv; }`;
const BFRAG = `
varying vec2 vUv; varying vec3 vN, vW, vC; varying float vA; uniform float uTail;
void main(){
  float core = pow(abs(dot(normalize(vN), normalize(-vW))), 1.6);
  float env = smoothstep(0.0, 0.02, vUv.y) * (1.0 - uTail * smoothstep(0.55, 1.0, vUv.y));
  gl_FragColor = vec4(vC * (vA * core * env), 1.0); }`;
export function beamSet(max, { tail = 0 } = {}) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    vertexShader: BVERT, fragmentShader: BFRAG, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    uniforms: { uTail: { value: tail } },
  });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  const col = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const alp = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  geo.setAttribute('aColor', col); geo.setAttribute('aAlpha', alp);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), d = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  mesh.count = 0;
  mesh.userData.set = (i, a, b, r, c, alpha) => {
    d.subVectors(b, a); const len = d.length() || 1e-6; d.divideScalar(len);
    q.setFromUnitVectors(Y, d); s.set(r, len, r);
    m.compose(a, q, s); mesh.setMatrixAt(i, m);
    col.setXYZ(i, c.r, c.g, c.b); alp.setX(i, alpha);
  };
  mesh.userData.use = n => { mesh.count = Math.min(max, n); mesh.instanceMatrix.needsUpdate = true; col.needsUpdate = true; alp.needsUpdate = true; };
  return mesh;
}

/* ---- the octave: a strip under each instrument ------------------------------
   Red on the left, violet on the right, 750 to 380 nm, lit by whatever the
   bench is doing to the light. light(fn) takes fn(nm) -> 0..1. */
export function octave(hud) {
  const cv = document.createElement('canvas'); cv.className = 'octave'; cv.setAttribute('aria-hidden', 'true');
  hud.appendChild(cv);
  const ctx = cv.getContext('2d');
  let fn = () => 0.15, W = 0;
  function draw() {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    W = Math.round(r.width); cv.width = W; cv.height = 6;
    for (let x = 0; x < W; x++) {
      const nm = 750 - x / (W - 1) * 370, c = P.lambdaRGB(nm), w = clamp(fn(nm), 0.06, 1);
      ctx.fillStyle = `rgb(${Math.round(c[0] * w)},${Math.round(c[1] * w)},${Math.round(c[2] * w)})`;
      ctx.fillRect(x, 0, 1, 6);
    }
  }
  new ResizeObserver(draw).observe(cv);
  return { light(f) { fn = f || (() => 0.15); draw(); }, reset() { fn = () => 0.15; draw(); } };
}

/* ---- DOM: dials, chips, readouts --------------------------------------------
   A dial is a range input; the model keeps the truth and the scene chases it.
   fmt(v) renders the value shown beside the label. */
export function dial(host, { label, min, max, step = 'any', value, fmt = v => v, onInput, aria }) {
  const el = document.createElement('div'); el.className = 'dial';
  const id = 'd' + Math.random().toString(36).slice(2, 8);
  el.innerHTML = `<label class="dial-k" for="${id}"><span>${label}</span><b></b></label><input class="beam" id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"${aria ? ` aria-label="${aria}"` : ''}>`;
  host.appendChild(el);
  const input = el.querySelector('input'), out = el.querySelector('b');
  const show = () => { out.innerHTML = fmt(+input.value); };
  input.addEventListener('input', () => { show(); onInput && onInput(+input.value, 'input'); });
  input.addEventListener('change', () => { onInput && onInput(+input.value, 'change'); });
  show();
  return { el, input, get value() { return +input.value; }, set(v, fire) { input.value = v; show(); if (fire) onInput && onInput(+input.value, 'set'); } };
}
export function chips(host, items, { onPick, radio = true, cls = '' } = {}) {
  const row = document.createElement('div'); row.className = 'chips ' + cls; host.appendChild(row);
  const els = items.map(it => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.id = it.id;
    b.innerHTML = (it.b ? `<span class="b">${it.b}</span>` : '') + it.name;
    if (it.title) b.title = it.title;
    b.setAttribute('aria-pressed', it.on ? 'true' : 'false');
    b.setAttribute('data-holo-tap', '');
    b.addEventListener('click', () => { if (radio) mark(it.id); onPick && onPick(it, b); });
    row.appendChild(b); return b;
  });
  function mark(id) { els.forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false')); }
  return { row, els, mark, get(id) { return els.find(b => b.dataset.id === id); } };
}
export function readouts(host, items) {
  const grid = document.createElement('div'); grid.className = 'readouts'; host.appendChild(grid);
  const map = {};
  for (const it of items) {
    const d = document.createElement('div'); d.className = 'readout'; if (it.p) d.style.setProperty('--p', it.p);
    d.innerHTML = `<p class="k">${it.k}</p><p class="v">${it.v || '&nbsp;'}</p><p class="d">${it.d || ''}</p>`;
    grid.appendChild(d); map[it.id] = d;
  }
  return {
    grid,
    set(id, v, d) { const el = map[id]; if (!el) return; if (v != null) el.querySelector('.v').innerHTML = v; if (d != null) el.querySelector('.d').innerHTML = d; },
    el(id) { return map[id]; },
  };
}
/* the one line in which the vessel speaks: a status that chases its text */
export function voice(host) {
  const p = document.createElement('p'); p.className = 'voice'; p.setAttribute('aria-live', 'polite'); host.appendChild(p);
  let last = '';
  return t => { if (t === last) return; last = t; p.classList.remove('is-new'); void p.offsetWidth; p.textContent = t; p.classList.add('is-new'); };
}
export const fmtDeg = (v, d = 1) => v.toFixed(d) + '<span class="u">°</span>';
export const fmtNm = v => Math.round(v) + '<span class="u">nm</span>';
export const fmtUm = (v, d = 2) => v.toFixed(d) + '<span class="u">µm</span>';

/* display chases truth: disp += (truth - disp) * (1 - exp(-dt * k)) */
export const chase = (disp, truth, dt, k = 8) => disp + (truth - disp) * (1 - Math.exp(-dt * k));

/* a flat dark bench with a faint grid, the floor of several instruments */
export function benchFloor(size = 10, divisions = 20, color = 0x1a2a3c) {
  const g = new THREE.GridHelper(size, divisions, color, color);
  g.material.transparent = true; g.material.opacity = 0.35; g.material.depthWrite = false;
  return g;
}
/* a text sprite already sized for a bench */
export function tag(text, h = 0.28, color = '#cfe6ff') {
  const s = label(text, { size: 20, color, tracking: 3 });
  s.userData.fit(h); return s;
}
export { label, glowSprite };
