/* senses/fields.js: the physics of the field wing, kept pure so it runs in
 * node without a browser.
 *
 *   node -e "import('./senses/fields.js').then(F => console.log(F.check()))"
 *
 * A living body in water is a current source: ion currents across skin,
 * gills and wounds, driven by nerve and muscle. Far from the body the field
 * is that of a current dipole in a conductor,
 *
 *   E = (1 / 4 pi sigma) [ 3 (p . r^) r^  -  p ] / r^3
 *
 * with p the current dipole moment in A m and sigma the water's conductivity
 * in S/m (the vacuum formula with 1/eps0 replaced by 1/sigma: the medium is
 * a conductor and the field is set by the current, not by a static charge).
 * The ship uses the finite form, a source and a sink a few centimetres apart,
 * which is the dipole at range and stays finite near the body.
 *
 * Every number here is SI: metres, amperes, volts per metre, S/m. The page
 * converts to the units a biologist writes (µV/cm: 1 V/m = 1e4 µV/cm).
 *
 * None of this exists in ship/physics.js (the kernel has no electrostatics);
 * it belongs there if a second deck ever needs it.
 */

/* ---- conductivities (S/m) ---------------------------------------------- */
/* seawater at 35 salinity and 20 C is close to 5 S/m; a freshwater stream
   runs 100 to 500 µS/cm, so 0.02 S/m (200 µS/cm) is a typical one */
export const SIGMA_SEA = 5;
export const SIGMA_FRESH = 0.02;

/* ---- the sources --------------------------------------------------------- */
/* Kalmijn (1971) replaced a plaice with two electrodes 5 cm apart carrying
   4 µA dc and the sharks attacked the electrodes as they attacked the fish;
   that is the prey the ship draws, so the moment is his, not a guess */
export const PLAICE = { I: 4e-6, d: 0.05, sigma: SIGMA_SEA, label: '4 µA across 5 cm, Kalmijn 1971' };
/* no measured moment for a freshwater shrimp's tail flick was found; this
   is a chosen value in the same finite form, picked so the platypus's
   50 µV/cm threshold is crossed about 9 cm off the shrimp, and the page
   says it is chosen */
export const SHRIMP = { I: 2e-5, d: 0.02, sigma: SIGMA_FRESH, label: 'chosen: 20 µA across 2 cm' };
/* the knifefish's own discharge: the electric organ runs along the body,
   so the ship spreads the current over the head half (out) and the tail
   half (in) as a row of poles on the axis, which makes the field leave the
   skin roughly square on, as it does; the total current only sets the
   drawing, every readout in that mode is a ratio */
export const KNIFEFISH = { I: 2e-4, d: 0.12, sigma: SIGMA_FRESH, label: 'own discharge' };
export function knifefishPoles(c = [0, 0, 0], n = 6, inner = 0.03, outer = 0.09) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = inner + (outer - inner) * i / (n - 1);
    out.push({ p: [c[0] + x, c[1], c[2]], I: KNIFEFISH.I / n });
    out.push({ p: [c[0] - x, c[1], c[2]], I: -KNIFEFISH.I / n });
  }
  return out;
}

/* ---- the senses ---------------------------------------------------------- */
/* thresholds in V/m; the page prints them in nV/cm and µV/cm */
export const SENSES = {
  shark:    { th: 5e-7,  hi: 1e-2, cite: 'Kalmijn 1982' },     // 5 nV/cm; saturates in the drawing at 100 µV/cm
  platypus: { th: 5e-3,  hi: 5e-1, cite: 'Scheich et al. 1986' },   // 50 µV/cm; 5 mV/cm
};

/* ---- vector helpers (plain arrays, no three.js) -------------------------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* the field of a set of point current sources {p, I} in a conductor,
   E = sum I_i (x - p_i) / (4 pi sigma |x - p_i|^3), in V/m */
export function poleField(x, poles, sigma) {
  let E = [0, 0, 0];
  for (const q of poles) {
    const r = sub(x, q.p), l = len(r);
    if (l < 1e-6) continue;
    E = add(E, mul(r, q.I / (4 * Math.PI * sigma * l * l * l)));
  }
  return E;
}

/* the poles of a finite dipole: source at c + d/2 along axis, sink behind */
export function dipolePoles(src, c, axis) {
  const a = norm(axis);
  return [{ p: add(c, mul(a, src.d / 2)), I: src.I }, { p: sub(c, mul(a, src.d / 2)), I: -src.I }];
}

/* a sphere of radius a at c in the local field E0 acquires an induced
   dipole and adds   a^3 chi [3 (E0 . r^) r^ - E0] / r^3   outside itself,
   with chi = (sigma_obj - sigma_water) / (sigma_obj + 2 sigma_water): +1
   for a perfect conductor, -1/2 for a perfect insulator (the sphere in a
   uniform field, the model Rasnow 1996 fitted to the knifefish's images) */
export const CHI = { conductor: 1, insulator: -0.5 };
export function sphereField(x, obj, E0) {
  const r = sub(x, obj.c), l = len(r);
  if (l < obj.a) return [0, 0, 0];
  const rh = mul(r, 1 / l), k = obj.a ** 3 * obj.chi / (l * l * l);
  return mul(sub(mul(rh, 3 * dot(E0, rh)), E0), k);
}

/* the total field of a scene: poles, plus every sphere's response to the
   poles' field at its centre (first order: spheres do not see each other) */
export function sceneField(x, poles, sigma, objects = []) {
  let E = poleField(x, poles, sigma);
  for (const o of objects) {
    if (!o.E0) o.E0 = poleField(o.c, poles, sigma);
    E = add(E, sphereField(x, o, o.E0));
  }
  return E;
}

/* the ratio of the total field to the bare field at x: the electric image,
   what a knifefish's skin reports; 1.0 means the object is invisible */
export function imageRatio(x, poles, sigma, objects) {
  const bare = len(poleField(x, poles, sigma));
  for (const o of objects) o.E0 = null;
  return bare > 0 ? len(sceneField(x, poles, sigma, objects)) / bare : 1;
}

/* ---- field lines --------------------------------------------------------- */
/* seeds on a small sphere round the source, integrated along E (midpoint
   rule, a fixed step in metres) until the line reaches the sink, leaves the
   box, runs below the floor, or enters an object. Returns polylines. */
export function fieldLines(poles, sigma, { objects = [], n = 32, r0 = 0.012, step = 0.004, maxSteps = 900, box = 1.0, floor = -Infinity, up = [0, 1, 0], seeds = null, source = 0 } = {}) {
  const src = poles.filter(q => q.I > 0)[source], sinks = poles.filter(q => q.I < 0);
  for (const o of objects) o.E0 = null;
  const lines = [];
  seeds = (seeds || fibonacciSphere(n)).filter(v => dot(v, up) > -0.35);   // the floor swallows the rest
  for (const v of seeds) {
    let x = add(src.p, mul(v, r0));
    const pts = [x];
    for (let i = 0; i < maxSteps; i++) {
      const E1 = norm(sceneField(x, poles, sigma, objects));
      const mid = add(x, mul(E1, step / 2));
      const E2 = norm(sceneField(mid, poles, sigma, objects));
      x = add(x, mul(E2, step));
      pts.push(x);
      if (sinks.some(q => len(sub(x, q.p)) < r0)) break;
      if (Math.abs(x[0]) > box || Math.abs(x[2]) > box || x[1] > box || dot(x, up) < floor) break;
      if (objects.some(o => len(sub(x, o.c)) < o.a)) break;
    }
    lines.push(pts);
  }
  return lines;
}

/* seeds in rings about the dipole axis: a line leaving the source at angle
   theta from the axis loops out to about r0 / sin^2(theta), so a few near
   the axis reach far into the water and the rest stay close, which is the
   real shape of the field; equal spacing on the sphere would give almost
   nothing beyond the body */
export function axisSeeds(axis, thetas = [8, 12, 17, 24, 34, 48, 66, 90], azimuths = 6) {
  const a = norm(axis);
  const t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm([a[1] * t[2] - a[2] * t[1], a[2] * t[0] - a[0] * t[2], a[0] * t[1] - a[1] * t[0]]);
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const out = [];
  thetas.forEach((deg, k) => {
    const th = deg * Math.PI / 180;
    for (let i = 0; i < azimuths; i++) {
      const ph = (i + 0.5 * (k % 2)) / azimuths * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      out.push([a[0] * c + (u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * s, a[1] * c + (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * s, a[2] * c + (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * s]);
    }
  });
  return out;
}

export function fibonacciSphere(n) {
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y), t = g * i;
    out.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return out;
}

/* ---- the numbers the page reads out ------------------------------------- */
/* the field on the axis of a finite dipole, distance r from its centre,
   beyond the source: the two poles at r - d/2 and r + d/2 */
export const axialField = (src, r) => src.I / (4 * Math.PI * src.sigma) * (1 / (r - src.d / 2) ** 2 - 1 / (r + src.d / 2) ** 2);
/* broadside: on the perpendicular bisector, where the two poles pull sideways */
export const broadsideField = (src, r) => { const l = Math.hypot(r, src.d / 2); return src.I / (4 * Math.PI * src.sigma) * src.d / (l * l * l); };
/* the distance at which the axial field falls to a threshold (bisection) */
export function rangeOnAxis(src, th) {
  let lo = src.d, hi = 10;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (axialField(src, m) > th) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/* a detector's level, 0 at threshold and 1 at hi, in decades: how an
   ampulla's response is drawn, not a measured transfer function */
export const level = (E, sense) => Math.max(0, Math.min(1, Math.log10(Math.max(E, 1e-30) / sense.th) / Math.log10(sense.hi / sense.th)));

/* V/m to the biologist's units */
export function fmtField(E) {
  const tidy = s => s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  const sig = v => tidy(v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const uv = E * 1e4;                               // µV/cm
  if (uv >= 1000) return sig(uv / 1000) + ' mV/cm';
  if (uv >= 1) return sig(uv) + ' µV/cm';
  return sig(uv * 1000) + ' nV/cm';
}

/* the derivation behind every figure in the copy, runnable in node */
export function check() {
  const out = {};
  for (const r of [0.02, 0.05, 0.10, 0.15]) out['plaice axial ' + r * 100 + ' cm'] = fmtField(axialField(PLAICE, r));
  out['plaice broadside 15 cm'] = fmtField(broadsideField(PLAICE, 0.15));
  out['shark range on axis'] = (rangeOnAxis(PLAICE, SENSES.shark.th) * 100).toFixed(1) + ' cm';
  for (const r of [0.02, 0.05, 0.10]) out['shrimp axial ' + r * 100 + ' cm'] = fmtField(axialField(SHRIMP, r));
  out['platypus range on axis'] = (rangeOnAxis(SHRIMP, SENSES.platypus.th) * 100).toFixed(1) + ' cm';
  return out;
}
