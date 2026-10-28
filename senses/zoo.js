/* senses/zoo.js: the Spectral Zoo's own physics, kept out of the page so it
 * can be run and checked in node without a browser.
 *
 *   node -e "import('./senses/zoo.js').then(z => console.log(z.sight(z.creature)))"
 *
 * Two jobs live here. The first is formatting a creature's range in the three
 * currencies the card reads out (wavelength, frequency, photon energy) from
 * the kernel's own ladders, so this deck never spells a unit differently from
 * the Bridge. The second is the "be the creature" model: a handful of
 * reference objects, each with a reflectance spectrum and a surface
 * temperature, lit by the Sun and glowing with their own heat, integrated
 * over one creature's sensing band and coloured with the vessel's own
 * translation colours. It is schematic on purpose, and the page says so.
 *
 * absPlanck is a physics function ship/physics.js does not have (planckRel is
 * relative to its own peak, which cannot compare a 5778 K sun to a 307 K
 * person). It belongs in the kernel; it lives here until the integrator moves
 * it. Nothing in it is a new constant: it uses the kernel's H, C and K_B.
 */

import * as P from '../ship/physics.js';

/* ---- formatting ---------------------------------------------------------- */

/* "1.00 mm" reads as "1 mm", "21.0 cm" as "21 cm", "100 µm" stays */
export const tidy = s => s.replace(/(\.\d*?)0+ /, '$1 ').replace(/\. /, ' ');

const parts = s => { const i = s.lastIndexOf(' '); return [s.slice(0, i), s.slice(i + 1)]; };

/* a range of two values in one ladder: the unit is shared when it can be
   ("380 to 750 nm", "930 to 1020 nm"), and each value keeps its own when the
   span is too wide ("750 nm to 100 µm") */
export function rangeText(a, b, fmt, metresOf) {
  const sa = tidy(fmt(a, true)), sb = tidy(fmt(b, true));
  const [va, ua] = parts(sa), [vb, ub] = parts(sb);
  if (ua === ub) return `${va} to ${vb} ${ua}`;
  if (metresOf) {
    // try b in a's unit: the divisor of a's unit falls out of a itself
    const d = metresOf(a) / parseFloat(va);
    const alt = tidy(P.unit(metresOf(b), [[d, ua]], ua, true));
    const [vAlt] = parts(alt);
    // a span under twenty to one shares a unit ("930 to 1020 nm"); a wider
    // one keeps both ("1 mm to 21 cm"), which is how the data file says it
    if (parseFloat(vAlt) / parseFloat(va) < 20 && parseFloat(vAlt) >= 1) return `${va} to ${vAlt} ${ua}`;
  }
  return `${sa} to ${sb}`;
}

/* the three readouts for a creature whose band is lo..hi in hertz */
export function bandText(lo, hi) {
  return {
    wave: rangeText(hi, lo, P.fmtWave, f => P.C / f),          // short wavelength first
    freq: rangeText(lo, hi, P.fmtFreq, f => 1 / f),             // "1/f" is a monotone stand-in so the shared-unit trick works
    energy: rangeText(lo, hi, P.fmtEnergy, f => f * P.EV_PER_HZ),
    octaves: P.octaves(lo, hi),
    decades: P.decades(lo, hi),
  };
}

/* ---- lanes ---------------------------------------------------------------- */
/* Several creatures share a band, so each gets a lane of its own, packed
   greedily in log frequency: the first lane with room takes it. `pad` is the
   room a sprite needs either side, in decades. */
export function packLanes(items, pad = 0.14) {
  const lanes = [];
  return items.map(z => {
    const a = P.log10(z.lo) - pad, b = P.log10(z.hi) + pad;
    let lane = lanes.findIndex(spans => spans.every(([x, y]) => b <= x || a >= y));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane].push([a, b]);
    return lane;
  });
}

/* ---- the sight model ------------------------------------------------------ */

/* Planck's spectral radiance B_lambda in W m^-2 sr^-1 m^-1, absolute */
export function absPlanck(lambda, T) {
  const x = P.H * P.C / (lambda * P.K_B * T);
  if (x > 700) return 0;
  return 2 * P.H * P.C * P.C / Math.pow(lambda, 5) / Math.expm1(x);
}

export const SUN_T = 5778;                                   // K, the photosphere
export const SUN_R = 6.957e8, AU = 1.495978707e11;           // m
/* a Lambertian surface of reflectance R in full sun has radiance
   R * B(T_sun) * (R_sun / AU)^2: the Sun's radiance diluted by its solid
   angle, with the pi of irradiance and the pi of a diffuse surface cancelling */
export const SUN_DILUTION = (SUN_R / AU) * (SUN_R / AU);     // 2.163e-5

/* reflectance as a piecewise-linear curve in nm, flat beyond the ends */
export function curve(pts) {
  return nm => {
    if (nm <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (nm <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (nm - x0) / (x1 - x0); }
    }
    return pts[pts.length - 1][1];
  };
}

/* The reference scene. Reflectance curves are textbook shapes, not
   measurements of one specimen: a yellow petal whose tips reflect UV and whose
   centre absorbs it (the nectar guide bees read), a leaf with chlorophyll's
   green bump and the near-infrared red edge, brown fur, mid-tone skin, grey
   stone. Temperatures: skin 34 C as the mosquito entry states; a mouse's
   warmest skin runs about 5 C under its 37 C core on a thermal camera, so 32 C;
   everything else at a 20 C afternoon. Emissivity 0.95 to 0.97 for all of
   them, as for most non-metals. */
export const OBJECTS = [
  { id: 'petal', name: 'petal', T: 293.15, eps: 0.96,
    R: curve([[250, .35], [380, .40], [420, .10], [480, .08], [520, .45], [560, .75], [700, .78], [1100, .75], [2500, .20], [30000, .04]]) },
  { id: 'guide', name: 'nectar guide', T: 293.15, eps: 0.96,
    R: curve([[250, .05], [400, .06], [480, .08], [520, .45], [560, .75], [700, .78], [1100, .75], [2500, .20], [30000, .04]]) },
  { id: 'leaf', name: 'leaves', T: 293.15, eps: 0.97,
    R: curve([[250, .05], [400, .05], [500, .08], [550, .18], [620, .08], [680, .05], [720, .30], [760, .50], [1100, .50], [1500, .25], [2500, .08], [30000, .03]]) },
  { id: 'mouse', name: 'mouse', T: 305.15, eps: 0.97,
    R: curve([[250, .05], [400, .06], [500, .10], [600, .18], [700, .28], [1100, .45], [2500, .20], [30000, .03]]) },
  { id: 'skin', name: 'person', T: 307.15, eps: 0.97,
    R: curve([[250, .05], [400, .15], [500, .25], [600, .45], [700, .55], [1100, .60], [1500, .30], [2500, .05], [30000, .03]]) },
  { id: 'stone', name: 'stone', T: 293.15, eps: 0.95,
    R: curve([[250, .20], [30000, .25]]) },
];

/* the reference span for "share of its light": 250 nm to 1 m, energy units */
const REF_LO = 250e-9, REF_HI = 1;

/* integrate f(lambda) over [la, lb] on a log grid, n samples */
function integrate(la, lb, n, f) {
  const l0 = Math.log(la), l1 = Math.log(lb), dl = (l1 - l0) / n;
  let s = 0;
  // d lambda = lambda d(ln lambda); the measure is handed to f so a callback
  // can accumulate side sums on the same grid
  for (let i = 0; i < n; i++) { const lam = Math.exp(l0 + (i + 0.5) * dl), m = lam * dl; s += f(lam, m) * m; }
  return s;
}

/* radiance of an object at wavelength lam (m), split into what it reflects
   and what it emits; `sun` is 1 in daylight, 0 at night */
export function radiance(obj, lam, sun) {
  const nm = lam * 1e9;
  return {
    refl: sun * obj.R(nm) * absPlanck(lam, SUN_T) * SUN_DILUTION,
    emit: obj.eps * absPlanck(lam, obj.T),
  };
}

/* What a creature with band lo..hi (Hz) makes of the scene. `mode` 'v'
   weights by photon count (an eye counts photons), anything else by energy
   (a heat organ feels power). Returns, per object, the colour vector in the
   vessel's translation colours (unnormalised), its reflected and emitted
   shares, and the fraction of the object's total radiance in band. */
export function sight(cr, { sun = 1, n = 320 } = {}) {
  const la = P.C / cr.hi, lb = P.C / cr.lo;
  const photons = cr.m === 'v';
  const weight = lam => (photons ? lam / (P.H * P.C) : 1);
  const VIS_A = 380e-9, VIS_B = 750e-9;
  const illum = lam => (sun > 0 ? absPlanck(lam, SUN_T) * SUN_DILUTION : absPlanck(lam, 293.15));
  // The white point. Inside the visible band the palette is per channel, and
  // its red covers more wavelengths than its blue, so a perfect white under
  // the same light (at night, a 20 C blackbody) sets each channel's unit:
  // a grey stone reads grey to every creature. Outside the visible band the
  // palette is the beam's translation colour, kept as a tint and scaled by one
  // scalar, the whole band's white, so the share of a creature's light that
  // falls outside your eyes is painted in the beam's colour for that band.
  const wVis = [0, 0, 0]; let wAll = 0, wVisAll = 0;
  integrate(la, lb, n, (lam, m) => {
    const v = illum(lam) * weight(lam) * m, rgb = P.lambdaRGB(lam * 1e9);
    wAll += v;
    if (lam >= VIS_A && lam <= VIS_B) { wVisAll += v; for (let k = 0; k < 3; k++) wVis[k] += v * rgb[k] / 255; }
    return 0;
  });
  const sVis = wAll > 0 ? wVisAll / wAll : 0;   // the share of the white that falls inside the visible band
  return OBJECTS.map(obj => {
    const cv = [0, 0, 0], co = [0, 0, 0], ev = [0, 0, 0], eo = [0, 0, 0];
    let seen = 0;
    const inBand = integrate(la, lb, n, (lam, m) => {
      const { refl, emit } = radiance(obj, lam, sun);
      const w = weight(lam) * m, rgb = P.lambdaRGB(lam * 1e9), vis = lam >= VIS_A && lam <= VIS_B;
      seen += (refl + emit) * w;
      for (let k = 0; k < 3; k++) {
        const a = (refl + emit) * w * rgb[k] / 255, e = emit * w * rgb[k] / 255;
        if (vis) { cv[k] += a; ev[k] += e; } else { co[k] += a; eo[k] += e; }
      }
      return refl + emit;
    });
    const total = integrate(REF_LO, REF_HI, 2400, lam => { const { refl, emit } = radiance(obj, lam, sun); return refl + emit; });
    const col = [0, 1, 2].map(k => (wVis[k] > 0 ? cv[k] / wVis[k] * sVis : 0) + (wAll > 0 ? co[k] / wAll : 0));
    const emitCol = [0, 1, 2].map(k => (wVis[k] > 0 ? ev[k] / wVis[k] * sVis : 0) + (wAll > 0 ? eo[k] / wAll : 0));
    return { id: obj.id, name: obj.name, T: obj.T, col, emitCol, seen, inBand, total, fraction: total > 0 ? inBand / total : 0 };
  });
}

/* normalise a sight to display colours: exposure such that the brightest
   object's brightest channel is 1 (an eye adapts to the scene it has). If
   nothing in the scene carries more than `floor` of `ref` (the same creature's
   daylight brightest), the scene is dark and the ship says so. */
export function expose(rows, ref, floor = 1e-6) {
  const peak = Math.max(...rows.map(r => r.seen));                       // physical, for the dark test
  const peakCol = Math.max(...rows.map(r => Math.max(...r.col)));        // balanced, for display
  const dark = !(peak > 0) || (ref > 0 && peak < ref * floor);
  const gain = dark || !(peakCol > 0) ? 0 : 1 / peakCol;
  return {
    dark, peak, gain,
    rows: rows.map(r => ({
      ...r,
      rgb: r.col.map(v => Math.min(1, v * gain)),
      emitRgb: r.emitCol.map(v => Math.min(1, v * gain)),
      level: dark ? 0 : r.seen / peak,
    })),
  };
}
