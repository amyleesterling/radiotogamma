/* ship/physics.js: the one physics kernel every deck runs on.
 *
 * Every number the vessel shows is derived here, from CODATA constants, so no
 * deck can quietly drift from another. Frequencies are in hertz, wavelengths
 * in metres, energies in joules unless a function says eV. Nothing here touches
 * the DOM. Loaded as an ES module by the decks and also hung on window.RTG so
 * a plain script (spectrum-data.js, the old lab modules) can reach it.
 */

export const C = 299792458;                 // m/s, exact
export const H = 6.62607015e-34;            // J s, exact
export const K_B = 1.380649e-23;            // J/K, exact
export const EV = 1.602176634e-19;          // J per eV, exact
export const EV_PER_HZ = H / EV;            // 4.135667696e-15 eV s
export const WIEN = 2.897771955e-3;         // m K
export const SIGMA = 5.670374419e-8;        // W m^-2 K^-4

/* The vessel's window on the spectrum: 10 kHz to 100 EHz, sixteen decades.
   Every deck maps frequency to position through these two numbers, so a
   landmark sits at the same place on every instrument. */
export const F0 = 4, F1 = 20;
export const VIS_LO = C / 750e-9, VIS_HI = C / 380e-9;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const log10 = Math.log10;
/* 0 at 10 kHz, 1 at 100 EHz, unclamped so an off-window value still has a
   side to be on */
export const posOf = f => (log10(f) - F0) / (F1 - F0);
export const freqAt = x => Math.pow(10, F0 + clamp(x, 0, 1) * (F1 - F0));
export const visPos = f => (log10(f) - log10(VIS_LO)) / (log10(VIS_HI) - log10(VIS_LO));
export const visFreq = x => Math.pow(10, log10(VIS_LO) + clamp(x, 0, 1) * (log10(VIS_HI) - log10(VIS_LO)));

/* The named bands. Boundaries are the usual conventions, drawn softly on every
   deck because they are human labels on one continuous phenomenon. `rgb` is the
   vessel's translation colour for light the eye cannot see; inside the visible
   band the true spectral colour is used instead (see lambdaRGB). */
export const BANDS = [
  { id: 'radio',     name: 'radio',       short: 'RADIO', lo: 1e4,    hi: 3e8,    rgb: [74, 150, 224] },
  { id: 'microwave', name: 'microwave',   short: 'MW',    lo: 3e8,    hi: 3e11,   rgb: [74, 200, 224] },
  { id: 'infrared',  name: 'infrared',    short: 'IR',    lo: 3e11,   hi: VIS_LO, rgb: [214, 96, 64] },
  { id: 'visible',   name: 'visible',     short: 'VIS',   lo: VIS_LO, hi: VIS_HI, rgb: [255, 255, 255] },
  { id: 'uv',        name: 'UV',          short: 'UV',    lo: VIS_HI, hi: 3e16,   rgb: [138, 96, 230] },
  { id: 'xray',      name: 'x-ray',       short: 'X-RAY', lo: 3e16,   hi: 3e19,   rgb: [126, 224, 255] },
  { id: 'gamma',     name: 'gamma',       short: 'GAMMA', lo: 3e19,   hi: 1e20,   rgb: [226, 120, 180] },
];
export function bandOf(f) {
  for (const b of BANDS) if (f >= b.lo && f < b.hi) return b;
  return f < 1e4 ? BANDS[0] : BANDS[BANDS.length - 1];
}

/* ---- conversions ------------------------------------------------------- */
export const lambdaOf = f => C / f;
export const freqOfLambda = l => C / l;
export const periodOf = f => 1 / f;
export const energyJ = f => H * f;
export const energyEV = f => f * EV_PER_HZ;
export const freqOfEV = e => e / EV_PER_HZ;
export const photonsPerSecond = (watts, f) => watts / (H * f);

/* ---- blackbody ---------------------------------------------------------- */
export const wienPeakFreq = T => C * T / WIEN;          // frequency of the B_lambda peak
export const wienPeakLambda = T => WIEN / T;
export const tempOfPeakFreq = f => WIEN * f / C;
export const stefanBoltzmann = T => SIGMA * Math.pow(T, 4);
/* Planck's B_lambda relative to its own peak, computed in log space so a
   dilution fridge and a one-second-old universe both stay finite */
export function planckRel(f, T) {
  const lam = C / f, lamMax = WIEN / T;
  const u = H * C / (lam * K_B * T), um = H * C / (lamMax * K_B * T);
  const lnE = x => x > 50 ? x : Math.log(Math.expm1(x));
  return Math.exp(-5 * Math.log(lam / lamMax) - lnE(u) + lnE(um));
}
/* the colour a glowing body shows the eye (Tanner Helland's fit, good from
   1000 K to 40 000 K); below the Draper point, 798 K, it is simply dark */
export function bbRGB(T) {
  if (T < 700) return [0, 0, 0];
  const tt = clamp(T, 1000, 40000) / 100;
  let r, g, b;
  if (tt <= 66) {
    r = 255; g = 99.4708025861 * Math.log(tt) - 161.1195681661;
    b = tt <= 19 ? 0 : 138.5177312231 * Math.log(tt - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(tt - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(tt - 60, -0.0755148492); b = 255;
  }
  const k = T < 1000 ? 0.12 + 0.88 * (T - 700) / 300 : 1;
  return [r, g, b].map(v => clamp(v, 0, 255) * k);
}

/* ---- spectral colour ---------------------------------------------------- */
/* The colour of a single wavelength, 380 to 750 nm, as sRGB 0..255. Dan
   Bruton's piecewise fit with the dim ends, which is what every spectrum strip
   on the vessel draws. Outside the visible band the band's translation colour
   is returned, so one function colours the whole beam. */
export function lambdaRGB(nm) {
  if (nm < 380 || nm > 750) return bandOf(C / (nm * 1e-9)).rgb.slice();
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else { r = 1; }
  const k = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (750 - nm) / 50 : 1;
  const gam = v => Math.round(255 * Math.pow(v * k, 0.8));
  return [gam(r), gam(g), gam(b)];
}
export const freqRGB = f => lambdaRGB(C / f * 1e9);

/* ---- unit formatting ---------------------------------------------------- */
const FU = [[1e18, 'EHz'], [1e15, 'PHz'], [1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']];
const WU = [[1e3, 'km'], [1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm'], [1e-12, 'pm'], [1e-15, 'fm']];
const EU = [[1e9, 'GeV'], [1e6, 'MeV'], [1e3, 'keV'], [1, 'eV'], [1e-3, 'meV'], [1e-6, 'µeV'], [1e-9, 'neV']];
const TU = [[1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps'], [1e-15, 'fs'], [1e-18, 'as'], [1e-21, 'zs']];
const PU = [[1e12, 'TW'], [1e9, 'GW'], [1e6, 'MW'], [1e3, 'kW'], [1, 'W'], [1e-3, 'mW'], [1e-6, 'µW'], [1e-9, 'nW'], [1e-12, 'pW']];
const JU = [[1e9, 'GJ'], [1e6, 'MJ'], [1e3, 'kJ'], [1, 'J'], [1e-3, 'mJ'], [1e-6, 'µJ']];

export const num = v => v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v));
/* a value in the best unit of a ladder; `html` wraps the unit in <span class="u">
   so a deck can style it, `plain` is for aria text and canvas labels */
export function unit(x, table, fallback, plain) {
  const wrap = u => plain ? ' ' + u : ' <span class="u">' + u + '</span>';
  for (const [d, u] of table) if (x >= d) return num(x / d) + wrap(u);
  return x.toExponential(2) + wrap(fallback);
}
export const fmtFreq = (f, plain) => unit(f, FU, 'Hz', plain);
export const fmtWave = (f, plain) => unit(C / f, WU, 'm', plain);
export const fmtEnergy = (f, plain) => unit(f * EV_PER_HZ, EU, 'eV', plain);
export const fmtPeriod = (f, plain) => unit(1 / f, TU, 's', plain);
export const fmtPower = (p, plain) => unit(p, PU, 'W', plain);
export const fmtJoules = (e, plain) => unit(e, JU, 'J', plain);
export const fmtLength = (m, plain) => unit(m, WU, 'm', plain);
export function sci(v, plain) {
  if (!(v > 0)) return '0';
  const e = Math.floor(log10(v));
  const m = num(v / Math.pow(10, e));
  return plain ? m + 'e' + e : m + '&times;10<sup>' + e + '</sup>';
}
export function fmtTemp(t, plain) {
  const wrap = u => plain ? ' ' + u : ' <span class="u">' + u + '</span>';
  if (t < 0.1) return num(t * 1000) + wrap('mK');
  if (t < 10) return parseFloat(t.toPrecision(4)) + wrap('K');
  if (t < 1e6) return Math.round(t).toLocaleString('en-US') + wrap('K');
  if (t < 1e9) return num(t / 1e6) + ' million' + wrap('K');
  return num(t / 1e9) + ' billion' + wrap('K');
}

/* The bar runs 1e4 Hz to 1e20 Hz, so two probes at the ends give 1e16. */
const BIG = [[1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
export function ratioWord(r) {
  if (r < 1000) return r < 10 ? r.toFixed(2) : String(Math.round(r));
  for (const [d, w] of BIG) if (r >= d) { const v = r / d; return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ' + w; }
  return String(Math.round(r));
}
export const octaves = (fa, fb) => Math.log2(fb / fa);
export const decades = (fa, fb) => log10(fb / fa);

/* ---- landmarks ---------------------------------------------------------- */
/* read lazily so the kernel does not care whether spectrum-data.js loaded
   before or after it */
export const landmarks = () => (typeof window !== 'undefined' && window.SPECTRUM_DATA ? window.SPECTRUM_DATA.LANDMARKS : []);
export const landmarkById = id => landmarks().find(l => l.id === id) || null;
export const landmarkAt = f => landmarks().find(l => Math.abs(log10(f / l.hz)) < 0.002) || null;
/* the landmark within `radius` decades of f, closest first, or null */
export function nearestLandmark(f, radius) {
  let best = null, bd = radius;
  for (const l of landmarks()) { const d = Math.abs(log10(f / l.hz)); if (d < bd) { bd = d; best = l; } }
  return best;
}

/* ---- a tick ladder for the sixteen decades ------------------------------ */
export const DECADE_LABELS = (() => {
  const out = [];
  for (let d = F0; d <= F1; d++) out.push({ d, f: Math.pow(10, d), label: fmtFreq(Math.pow(10, d), true).replace('.00', '').replace(/\.0 /, ' ') });
  return out;
})();

const RTG = {
  C, H, K_B, EV, EV_PER_HZ, WIEN, SIGMA, F0, F1, VIS_LO, VIS_HI, BANDS,
  clamp, posOf, freqAt, visPos, visFreq, bandOf, lambdaOf, freqOfLambda, periodOf,
  energyJ, energyEV, freqOfEV, photonsPerSecond, wienPeakFreq, wienPeakLambda,
  tempOfPeakFreq, stefanBoltzmann, planckRel, bbRGB, lambdaRGB, freqRGB,
  num, unit, fmtFreq, fmtWave, fmtEnergy, fmtPeriod, fmtPower, fmtJoules, fmtLength,
  fmtTemp, sci, ratioWord, octaves, decades, landmarks, landmarkById, landmarkAt,
  nearestLandmark, DECADE_LABELS,
};
if (typeof window !== 'undefined') window.RTG = RTG;
export default RTG;
