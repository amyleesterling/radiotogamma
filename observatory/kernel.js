/* observatory/kernel.js: the Observatory's own physics and data, on top of
 * ship/physics.js. Nothing here touches the DOM, so every function can be
 * promoted to ship/physics.js unchanged if another deck wants it. Candidates
 * for promotion are marked PROMOTE.
 */
import * as P from '../ship/physics.js';

/* ---- PROMOTE: a ratio written the way people write numbers ---------------
   P.ratioWord says "5.6 million"; a comparison readout wants three figures,
   "5,640,000", and only reaches for words past a quadrillion. */
const BIG = [[1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
export function ratioExact(r) {
  if (!(r > 0)) return '0';
  if (r < 1000) return r < 10 ? r.toFixed(2) : String(Math.round(r));
  if (r < 1e15) {
    const e = Math.floor(P.log10(r)) - 2;               // three significant figures
    return (Math.round(r / Math.pow(10, e)) * Math.pow(10, e)).toLocaleString('en-US');
  }
  for (const [d, w] of BIG) if (r >= d) { const v = r / d; return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v))) + ' ' + w; }
  return r.toExponential(2);
}
/* PROMOTE: a count (photons per second) in words, then in powers of ten */
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function bigCount(x) {
  if (x < 1e3) return P.num(x);
  if (x >= 1e18) {
    const e = Math.floor(P.log10(x));
    return (x / Math.pow(10, e)).toFixed(2) + ' × 10' + String(e).split('').map(c => SUP[+c]).join('');
  }
  for (const [d, w] of BIG) if (x >= d) { const v = x / d; return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v))) + ' ' + w; }
  return x.toExponential(2);
}
/* five significant figures for the comparison table: 563.52, not 564 */
export const num5 = v => String(parseFloat(v.toPrecision(5)));
export function unit5(x, table, fb) {
  for (const [d, u] of table) if (x >= d) return num5(x / d) + ' <span class="u">' + u + '</span>';
  return x.toExponential(2) + ' <span class="u">' + fb + '</span>';
}
const FU = [[1e18, 'EHz'], [1e15, 'PHz'], [1e12, 'THz'], [1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']];
const WU = [[1e3, 'km'], [1, 'm'], [1e-2, 'cm'], [1e-3, 'mm'], [1e-6, 'µm'], [1e-9, 'nm'], [1e-12, 'pm'], [1e-15, 'fm']];
const EU = [[1e9, 'GeV'], [1e6, 'MeV'], [1e3, 'keV'], [1, 'eV'], [1e-3, 'meV'], [1e-6, 'µeV'], [1e-9, 'neV']];
const TU = [[1, 's'], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps'], [1e-15, 'fs'], [1e-18, 'as'], [1e-21, 'zs'], [1e-24, 'ys']];
export const freq5 = f => unit5(f, FU, 'Hz');
export const wave5 = f => unit5(P.C / f, WU, 'm');
export const energy5 = f => unit5(f * P.EV_PER_HZ, EU, 'eV');
export const period5 = f => unit5(1 / f, TU, 's');

/* ---- PROMOTE: a typed value in any unit the spectrum speaks -------------- */
export function parseValue(str) {
  const m = String(str).trim().match(/^([\d.]+)\s*(hz|khz|mhz|ghz|thz|phz|ehz|nm|µm|um|mm|cm|km|m|ev|kev|mev|µev|uev|gev)$/i);
  if (!m) return null;
  const v = parseFloat(m[1]); if (!isFinite(v) || v <= 0) return null;
  const u = m[2].toLowerCase();
  const F = { hz: 1, khz: 1e3, mhz: 1e6, ghz: 1e9, thz: 1e12, phz: 1e15, ehz: 1e18 };
  const W = { km: 1e3, m: 1, cm: 1e-2, mm: 1e-3, 'µm': 1e-6, um: 1e-6, nm: 1e-9 };
  const E = { 'µev': 1e-6, uev: 1e-6, ev: 1, kev: 1e3, mev: 1e6, gev: 1e9 };
  if (u in F) return v * F[u];
  if (u in W) return P.freqOfLambda(v * W[u]);
  if (u in E) return P.freqOfEV(v * E[u]);
  return null;
}

/* ---- PROMOTE: how matter commonly responds, by frequency ------------------
   Overlapping regimes, common mechanisms rather than walls. */
export const REGIMES = [
  { lo: 1e4,  hi: 1e11,   name: 'collective currents, antennas' },
  { lo: 1e8,  hi: 1e11,   name: 'spin transitions' },
  { lo: 1e9,  hi: 1e12,   name: 'molecular rotation' },
  { lo: 1e12, hi: 1.5e14, name: 'molecular vibration' },
  { lo: 3e14, hi: 3e16,   name: 'electronic excitation' },
  { lo: 7e14, hi: 3e16,   name: 'photochemistry' },
  { lo: 3e15, hi: 1e20,   name: 'ionization' },
  { lo: 1e19, hi: 1e20,   name: 'nuclear and particle interactions' },
];

/* ---- PROMOTE: atmospheric transmission, clear sky, sea level ---------------
   Fraction of light reaching the ground as (log10 Hz, fraction) knots,
   interpolated linearly in log frequency. Coarse on purpose: the ionospheric
   cutoff, the 22 and 183 GHz water and 60 and 118 GHz oxygen lines, the
   far-infrared wall, the 3 to 5 and 8 to 13 µm windows, the J, H and K
   near-infrared windows between water bands, the optical window, and the
   ozone edge at 300 nm. Everything above is absorbed by the air. */
export const TRANS = [
  [4, 0], [6.8, 0], [7.0, .05], [7.3, .5], [7.6, .95], [8, 1], [10, 1], [10.35, .85], [10.5, .95],
  [10.7, .5], [10.78, 0], [10.85, .4], [10.95, .8], [11.02, .4], [11.07, .05], [11.12, .4], [11.15, .7],
  [11.22, .3], [11.26, 0], [11.3, .3], [11.35, .45], [11.45, .25], [11.5, .15], [11.6, .05], [11.8, .02],
  [12, 0], [13.0, 0], [13.2, .05], [13.3, .3], [13.4, .8], [13.55, .8], [13.62, .3], [13.68, .05],
  [13.8, .1], [13.85, .05], [13.9, .85], [13.97, .5], [14.0, .1], [14.06, .5], [14.13, .9], [14.18, .5],
  [14.2, .2], [14.24, .6], [14.26, .9], [14.3, .4], [14.32, .1], [14.36, .6], [14.38, .9], [14.45, .8],
  [14.5, .75], [14.6, .85], [14.75, .85], [14.9, .6], [14.98, .3], [15.0, .05], [15.05, 0], [20, 0],
];
export function transAt(hz) {
  const d = P.log10(hz);
  for (let i = 1; i < TRANS.length; i++) {
    if (d <= TRANS[i][0]) {
      const [d0, t0] = TRANS[i - 1], [d1, t1] = TRANS[i];
      return t0 + (t1 - t0) * (d - d0) / Math.max(d1 - d0, 1e-9);
    }
  }
  return 0;
}
export const SKY_LABELS = [                           // [log10 Hz, text, kind, priority]
  [5.6, 'ionosphere turns it back', 'wall', 2], [9.0, 'RADIO WINDOW', 'open', 3],
  [11.3, 'water vapour, oxygen', 'wall', 1], [12.6, 'water vapour, CO₂', 'wall', 2],
  [14.1, 'IR doors', 'open', 1], [14.78, 'OPTICAL', 'open', 3],
  [15.5, 'ozone', 'wall', 1], [17.6, 'the air itself', 'wall', 3],
];
export const SKY_TELESCOPES = [                       // [log10 Hz, text, priority]
  [8.6, 'dishes on the ground', 3], [11.55, 'mountaintop mm arrays', 1], [13.9, 'JWST, in orbit', 2],
  [14.75, 'eyes', 2], [15.5, 'Hubble UV', 1], [17.6, 'Chandra, Fermi, in orbit', 3],
];
/* which instrument catches light arriving at this frequency */
export function catcher(f) {
  const lam = P.C / f;
  if (lam < 300e-9) return 'ultraviolet: Hubble’s job, from orbit';
  if (lam < 1e-6) return 'the optical window: telescopes on the ground, and eyes';
  if (lam < 5e-6) return 'near-infrared: JWST’s NIRCam territory, which is why the telescope built to find the first galaxies sees infrared';
  if (lam < 28e-6) return 'mid-infrared: JWST’s MIRI, cooled to 7 K so its own glow does not drown the signal';
  if (lam < 1e-3) return 'the far-infrared and sub-millimetre: ALMA on the Chajnantor plateau, or a cold telescope in space';
  return 'radio: the same dishes that map the microwave background and hunt the 21 cm line';
}

/* ---- PROMOTE: flat LambdaCDM lookback ------------------------------------
   H0 = 67.7 km/s/Mpc, Omega_m = 0.31, a whisper of radiation so the CMB
   lands at the right age. Integrated in ln(1+z), upward from z, so the early
   times keep their precision (the CMB is 373,000 years here, a 3e-5 sliver
   of the total that a lookback subtraction would lose). */
export const H0 = 67.7, OMEGA_M = 0.31, OMEGA_R = 9e-5, OMEGA_L = 1 - OMEGA_M - OMEGA_R, T_HUBBLE = 977.8 / H0; // Gyr
export const Ez = z => Math.sqrt(OMEGA_R * Math.pow(1 + z, 4) + OMEGA_M * Math.pow(1 + z, 3) + OMEGA_L);
export function ageAt(z) {                             // Gyr
  const L0 = Math.log1p(z), L1 = Math.log(1e9), n = 1500; let sum = 0;
  for (let i = 0; i < n; i++) sum += 1 / Ez(Math.expm1(L0 + (L1 - L0) * (i + 0.5) / n));
  return T_HUBBLE * sum * (L1 - L0) / n;
}
export const AGE_NOW = ageAt(0);                       // 13.79 Gyr
export const lookback = z => AGE_NOW - ageAt(z);
export const Z_MAX = 1090;
export const SHIFT_SOURCES = [
  { name: 'the red hydrogen line, 656 nm', hz: P.C / 656.3e-9, who: 'a galaxy’s glowing hydrogen', lm: 'h-alpha' },
  { name: 'the ultraviolet hydrogen line, 122 nm', hz: P.C / 121.6e-9, who: 'the Lyman-alpha line of a young galaxy' },
  { name: 'a sunlike star’s peak, 500 nm', hz: P.C / 500e-9, who: 'the glow of an ordinary star' },
  { name: 'the first light, a 3,000 K glow peaking at 0.97 µm', hz: P.C / 0.966e-6, who: 'the fog of the early universe at last scattering' },
  { name: 'the 21 cm hydrogen line, 1.42 GHz', hz: 1.42040575e9, who: 'cold hydrogen gas between the first stars' },
];
export const SHIFT_STOPS = [                           // [z, name, note]
  [0, 'Here', 'no stretch: the light as it left'],
  [0.0037, 'Virgo cluster', 'our nearest big cluster of galaxies, 54 million light-years'],
  [0.023, 'Coma cluster', 'a thousand galaxies, 320 million light-years'],
  [0.158, '3C 273', 'the first quasar identified, in 1963: its lines were found sitting 16% too red'],
  [1, 'z = 1', 'half the age of the universe ago'],
  [2, 'Cosmic noon', 'when the universe made stars fastest'],
  [6, 'End of reionization', 'the fog of neutral hydrogen finally burned off'],
  [10.6, 'GN-z11', 'a galaxy Hubble found and JWST confirmed, 430 million years after the Big Bang'],
  [14.32, 'JADES-GS-z14-0', 'among the most distant galaxies confirmed, seen 290 million years after the Big Bang'],
  [1090, 'The first light', 'the cosmic microwave background: the universe at about 380,000 years old'],
];
export const zOfSlider = v => Math.expm1(Math.log1p(Z_MAX) * v / 1000);
export const sliderOfZ = z => Math.round(Math.log1p(z) / Math.log1p(Z_MAX) * 1000);
export const fmtZ = z => z < 0.01 ? z.toFixed(4) : z < 1 ? z.toFixed(3) : z < 100 ? z.toFixed(2) : String(Math.round(z));
export const gyr = t => t < 0.001 ? Math.round(t * 1e9).toLocaleString('en-US') + ' years'
  : t < 1 ? Math.round(t * 1000) + ' million years' : t.toFixed(t < 10 ? 2 : 1) + ' billion years';

/* ---- the octave ladder: one step, doubled once per octave ------------------
   0.75 m × 2^n. Each band is marked at the octave where it begins, counting
   doublings up from 10 kHz: log2(lo / 1e4), rounded. */
export const STEP = 0.75;
export const LADDER = [
  [0,  '0.75 m',             'one step', 'radio'],
  [10, '768 m',              'the corner store'],
  [15, '24.6 km',            'a half-marathon and change', 'microwave'],
  [20, '786 km',             'San Francisco to San Diego'],
  [25, '25,200 km',          'five-eighths of the way around Earth', 'infrared'],
  [30, '805,000 km',         'past the Moon, twice over'],
  [35, '25.8 million km',    'a sixth of the way to the Sun', 'visible'],
  [36, '51.5 million km',    'a third of the way to the Sun; the whole rainbow was that one doubling', 'uv'],
  [41, '11 AU',              'past Saturn', 'xray'],
  [46, '353 AU',             'past Voyager 1, out of the heliosphere'],
  [51, '0.18 light-years',   'into the inner Oort cloud', 'gamma'],
  [53, '0.7 light-years',    'deep in the Oort cloud'],
];

/* ---- the quiz: five predict-first questions ------------------------------ */
export const TOUR = [
  { a: 'wifi', b: 'microwave-oven',
    q: 'Wi-Fi and a microwave oven. How far apart in frequency?',
    choices: ['About a million times apart', 'About a thousand times apart', 'Almost exactly the same'], ans: 2 },
  { a: 'body-heat', b: 'dust-off',
    q: 'Your body is glowing right now, in infrared. How far below green laser light is your glow?',
    choices: ['About 18 times lower', 'About 18 thousand times lower', 'About 18 million times lower'], ans: 0 },
  { a: 'red-laser', b: 'blue-laser',
    q: 'Red light to blue light. End to end, how wide is everything your eyes can see?',
    choices: ['About 4,000 times', 'About 40 times', 'Not even 2 times: one octave'], ans: 2 },
  { a: 'sunlight', b: 'supernova',
    q: 'Where does a supernova’s light peak, compared to sunlight?',
    choices: ['Almost the same octave', 'About a thousand times higher', 'About a billion times higher'], ans: 0 },
  { a: 'am-radio', b: 'tc99m-gamma',
    q: 'AM radio to medical gamma rays. How many times higher in frequency?',
    choices: ['34 thousand times', '34 million times', '34 trillion times'], ans: 2 },
];

/* ---- self-tests (?test=1): the old page's assertions, now against the
   kernel in ship/physics.js ------------------------------------------------ */
export function selfTest(extra) {
  const out = [];
  const ok = (name, cond) => out.push((cond ? 'PASS' : 'FAIL') + '  ' + name);
  const close = (x, y, tol) => Math.abs(x / y - 1) < (tol || 1e-6);
  const green = P.freqOfLambda(532e-9);
  ok('532 nm -> 563.52 THz', close(green, 563.5197e12, 1e-4));
  ok('default ratio ~5.635 million', close(green / 100e6, 5.6352e6, 1e-3));
  ok('ratioExact default 5,640,000', ratioExact(green / 100e6) === '5,640,000');
  ok('P.ratioWord default 5.6 million', P.ratioWord(green / 100e6) === '5.6 million');
  ok('full window ratio 1e16', close(P.freqAt(1) / P.freqAt(0), 1e16));
  ok('wavelength inverse', close(P.lambdaOf(P.freqOfLambda(532e-9)), 532e-9));
  ok('period inverse', close(P.periodOf(100e6), 10e-9));
  ok('photon energy 532 nm ~2.331 eV', close(P.energyEV(green), 2.331, 1e-3));
  ok('photon energy 100 MHz ~0.414 µeV', close(P.energyEV(100e6), 0.4136e-6, 1e-3));
  ok('E = hf in joules', close(P.energyJ(green), 3.734e-19, 1e-3));
  ok('photons per second at 1 W, FM', close(P.photonsPerSecond(1, 100e6), 1.509e25, 1e-3));
  ok('parse 532 nm', close(parseValue('532 nm'), green));
  ok('parse 2.4 GHz', close(parseValue('2.4 GHz'), 2.4e9));
  ok('parse 30 keV', close(parseValue('30 keV'), P.freqOfEV(30e3)));
  ok('octaves 10 kHz to 100 EHz ~53.15', close(P.octaves(1e4, 1e20), 53.15, 1e-3));
  ok('decades FM to green 6.75', close(P.decades(100e6, green), 6.751, 1e-3));
  ok('bandOf 532 nm is visible', P.bandOf(green).id === 'visible');
  ok('posOf 10 kHz is 0, 100 EHz is 1', P.posOf(1e4) === 0 && close(P.posOf(1e20), 1));
  ok('landmark lookup', !!P.landmarkById('fm-radio'));
  const fm = P.landmarkById('fm-radio'), bh = P.landmarkById('body-heat');
  ok('band landmark has range', fm.lo < fm.hz && fm.hz < fm.hi);
  ok('spectrum landmark has range', bh.lo < bh.hz);
  ok('transmission: optical window open', transAt(green) > 0.8);
  ok('transmission: x-rays blocked', transAt(P.freqOfEV(30e3)) === 0);
  ok('transmission: 1 GHz open', transAt(1e9) === 1);
  ok('cosmology: age 13.8 Gyr', close(AGE_NOW, 13.79, 2e-3));
  ok('cosmology: CMB at ~373,000 yr', close(ageAt(1090) * 1e9, 372900, 2e-3));
  ok('cosmology: z = 1 is 7.9 Gyr ago', close(lookback(1), 7.935, 2e-3));
  ok('ladder: 0.75 m × 2^53 = 0.71 ly', close(STEP * Math.pow(2, 53) / 9.4607e15, 0.714, 2e-3));
  ok('ladder: octave of the visible edge is 35', Math.round(Math.log2(P.VIS_LO / 1e4)) === 35);
  if (extra) extra(ok, close);
  return out;
}
