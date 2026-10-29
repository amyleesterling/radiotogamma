/* senses/polar.js: the physics of the polarization wing, kept pure so it
 * runs in node without a browser.
 *
 *   node -e "import('./senses/polar.js').then(S => console.log(S.check()))"
 *
 * Sunlight is unpolarized. A molecule of air scatters it (Rayleigh, the
 * 1/lambda^4 bench on deck 03), and the scattered light is partly linearly
 * polarized, with
 *
 *   degree  d = sin^2 theta / (1 + cos^2 theta)
 *
 * for scattering angle theta between the sun and the patch of sky, and the
 * electric vector perpendicular to the scattering plane (the plane holding
 * the sun, the patch and the observer). d is 1 at theta = 90 degrees: a
 * great circle of fully polarized sky, 90 degrees from the sun, that swings
 * across the dome as the sun moves. This is the single-scattering ideal. The
 * real sky peaks near 75 to 80 percent (Coulson 1988): multiple scattering,
 * haze and ground light dilute it, and there are neutral points near the sun
 * and antisun that the single-scattering picture has no room for.
 *
 * Coordinates: y is up, unit vectors on the dome, angles in radians.
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const UP = [0, 1, 0];

/* the Rayleigh degree of linear polarization for cos(theta) = sun . patch */
export const degree = c => (1 - c * c) / (1 + c * c);

/* the e-vector at a patch P for a sun S: perpendicular to the scattering
   plane, hence tangent to the dome; undefined at the sun and antisun */
export function evector(S, P) {
  const e = cross(S, P);
  return len(e) < 1e-9 ? [0, 0, 0] : norm(e);
}

/* the e-vector's angle from the local meridian (the tangent toward the
   zenith), 0 to pi; what a bee's dorsal rim compares against */
export function evectorAngle(S, P) {
  const e = evector(S, P);
  const m = norm([UP[0] - P[0] * P[1], UP[1] - P[1] * P[1], UP[2] - P[2] * P[1]]);   // zenith-ward tangent
  const east = cross(P, m);
  let a = Math.atan2(dot(e, east), dot(e, m));
  if (a < 0) a += Math.PI;
  return a;
}

/* Malus' law for partly polarized light: the polarized fraction d passes
   as cos^2 of the angle between filter axis and e-vector; the unpolarized
   fraction (1 - d) passes at one half whatever the filter's angle */
export const malus = (d, filterAngle, eAngle) => (1 - d) / 2 + d * Math.cos(filterAngle - eAngle) ** 2;

/* a sun from elevation and azimuth (radians; azimuth 0 along +z) */
export const sunAt = (el, az) => [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
export const elevationOf = S => Math.asin(Math.max(-1, Math.min(1, S[1])));

/* n points spread evenly over the hemisphere above the horizon, a little
   above it so no bar sits on the ground */
export function domePoints(n, minY = 0.03) {
  const out = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = minY + (1 - minY) * (i + 0.5) / n, r = Math.sqrt(1 - y * y), t = g * i;
    out.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return out;
}

/* the derivations behind the copy, runnable in node */
export function check() {
  const deg = x => (x * 180 / Math.PI).toFixed(1) + '°';
  const out = {};
  out['degree at 90°'] = degree(0);
  out['degree at 60°'] = degree(Math.cos(Math.PI / 3)).toFixed(3);
  out['degree at zenith, sun 30° up'] = degree(Math.sin(Math.PI / 6)).toFixed(3);
  out['degree at zenith, sun on the horizon'] = degree(0);
  out['degree at zenith, sun overhead'] = degree(1);
  const S = sunAt(0.5, 0.3), P = norm([0.3, 0.8, 0.2]);
  out['e-vector tangent to dome'] = Math.abs(dot(evector(S, P), P)).toExponential(1);
  out['e-vector angle sample'] = deg(evectorAngle(S, P));
  out['malus fully polarized, aligned'] = malus(1, 0, 0);
  out['malus fully polarized, crossed'] = malus(1, Math.PI / 2, 0);
  out['malus unpolarized'] = malus(0, 0.7, 0);
  out['malus d=0.8 crossed'] = malus(0.8, Math.PI / 2, 0).toFixed(2);
  out['full moon vs sun, lux'] = '0.1 to 0.3 against 100000: ' + Math.round(1e5 / 0.3 / 1e3) + 'k to ' + Math.round(1e5 / 0.1 / 1e3) + 'k times fainter';
  return out;
}
