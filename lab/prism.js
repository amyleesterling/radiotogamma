/* lab/prism.js: bench 01, PRISM.
 *
 * A block of real glass on a bench, white light in from the left. Every ray
 * is traced through the block with Snell's law at each face, and every
 * wavelength carries its own index from Cauchy's formula fitted to the
 * catalogue numbers of the chosen material, so the fan that leaves is the
 * fan that glass actually makes. The one concession to the screen: a BK7
 * prism spreads red from blue by about a degree, which is a few pixels, so
 * the fan can be widened about its true mean by a stated factor. The
 * readouts never use that factor; they report the traced angles.
 *
 * INVENT is the same tracer handed a glass that does not exist: any index,
 * including one below 1, any dispersion, any apex. The physics does not
 * care, and says what it sees.
 */
import { ship } from '../ship/ship.js';
import { THREE, P, TAU, DEG, clamp, sm, colorOfNm, rgb01, cauchy, MATERIALS, beamSet, octave, dial, chips, readouts, voice, fmtDeg, chase, benchFloor, tag, glowSprite } from './bench.js';

const SRC = new THREE.Vector3(-3.7, 0, 0);     // the lamp
const SCREEN_X = 3.4;                           // where the fan lands
const BOUND = 4.6;                              // the bench edge
const WLS = []; for (let i = 0; i < 28; i++) WLS.push(400 + 300 * i / 27);

export const question = {
  id: 'prism', title: 'Bench 01 · Prism',
  text: 'Which colour bends most through glass?',
  choices: ['Red', 'Green', 'Blue'], answer: 2,
  reveal: 'Blue bends most. Glass slows every frequency by a slightly different amount, so the index of refraction climbs toward the blue end and each colour refracts through a slightly different angle, blue the hardest. White light fans into a continuous band, one colour per frequency, no seams.',
};

export function mount({ el, hud, ctrl, out, solved }) {
  /* ---- truth ---- */
  const T = { mat: 'bk7', nd: 1.5168, V: 64.2, apex: 60, tilt: 0, gain: 10 };
  let glass = cauchy(T.nd, T.V);
  const strip = octave(hud);
  const say = voice(out);
  let done = false;

  /* ---- the block: an isosceles cross-section in the bench plane (x, z) ----
     base 1.6 wide; height from the apex angle, capped at 1.6 so a 0 degree
     apex is simply a thick slab */
  function polygon() {
    const b = 1.6, A = T.apex * DEG;
    const h = A < 1 * DEG ? 1.6 : Math.min(1.6, (b / 2) / Math.tan(A / 2));
    const top = Math.max(0, b - 2 * h * Math.tan(A / 2));
    const pts = [[-b / 2, h / 2], [b / 2, h / 2], [top / 2, -h / 2], [-top / 2, -h / 2]];
    if (top < 1e-4) pts.splice(3, 1);           // a true triangle
    const c = Math.cos(T.tilt * DEG), s = Math.sin(T.tilt * DEG);
    return pts.map(([x, z]) => [x * c - z * s, x * s + z * c]);
  }

  /* ---- Snell in two dimensions ----
     Trace one wavelength through the polygon: entry, any internal bounces,
     exit. n1/n2 is the ratio across the face being crossed; when the square
     root goes negative there is no refracted ray and the light reflects
     instead, which is total internal reflection, and with an index below 1
     it can happen on the way in. */
  function hitEdges(poly, ox, oz, dx, dz, skip) {
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      if (i === skip) continue;
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - ox) * ez - (az - oz) * ex) / den;
      const u = ((ax - ox) * dz - (az - oz) * dx) / den;
      if (t > 1e-6 && u >= 0 && u <= 1 && (!best || t < best.t)) {
        const len = Math.hypot(ex, ez);
        best = { t, i, x: ox + dx * t, z: oz + dz * t, nx: ez / len, nz: -ex / len };   // outward normal (polygon is clockwise in x,z)
      }
    }
    return best;
  }
  function exitLen(ox, oz, dx, dz) {
    let t = 1e9;
    if (dx > 1e-6) t = Math.min(t, (SCREEN_X - ox) / dx); else if (dx < -1e-6) t = Math.min(t, (-BOUND - ox) / dx);
    if (dz > 1e-6) t = Math.min(t, (BOUND - oz) / dz); else if (dz < -1e-6) t = Math.min(t, (-BOUND - oz) / dz);
    return Math.max(0, t);
  }
  function trace(poly, n) {
    let ox = SRC.x, oz = SRC.z, dx = 1, dz = 0, inside = false, skip = -1;
    const segs = []; let tir = 0;
    for (let hop = 0; hop < 8; hop++) {
      const h = hitEdges(poly, ox, oz, dx, dz, skip);
      if (!h) { const L = exitLen(ox, oz, dx, dz); segs.push([ox, oz, ox + dx * L, oz + dz * L, inside]); return { segs, dx, dz, tir, out: !inside, x: ox + dx * L, z: oz + dz * L }; }
      segs.push([ox, oz, h.x, h.z, inside]);
      let nx = h.nx, nz = h.nz;                      // normal against the ray
      if (dx * nx + dz * nz > 0) { nx = -nx; nz = -nz; }
      const eta = inside ? n : 1 / n;                // n1 / n2
      const cosI = -(dx * nx + dz * nz);
      const k = 1 - eta * eta * (1 - cosI * cosI);
      if (k < 0) {                                   // total internal reflection
        const d = dx * nx + dz * nz; dx -= 2 * d * nx; dz -= 2 * d * nz; tir++;
      } else {
        const f = eta * cosI - Math.sqrt(k);
        dx = eta * dx + f * nx; dz = eta * dz + f * nz; inside = !inside;
      }
      const L = Math.hypot(dx, dz); dx /= L; dz /= L;
      ox = h.x; oz = h.z; skip = h.i;
    }
    return { segs, dx, dz, tir, out: !inside, trapped: inside, x: ox, z: oz };
  }

  /* ---- the scene ---- */
  const beams = beamSet(160);
  const glassGeo = { mesh: null, edges: null };
  const landing = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  landing.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WLS.length * 3), 3));
  landing.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WLS.length * 3), 3));
  const glassMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTint: { value: new THREE.Color(0.55, 0.78, 1) }, uK: { value: 0.1 } },
    vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uTint; uniform float uK; varying vec3 vN, vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5); gl_FragColor = vec4(uTint * (uK + 0.55 * f), 0.10 + 0.55 * f); }`,
  });
  const group = new THREE.Group();
  let cam, screen, lamp;
  const disp = { tilt: 0, apex: 60 };

  function buildGlass() {
    const poly = polygon();
    const shape = new THREE.Shape(); poly.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); geo.translate(0, -0.55, 0);
    if (glassGeo.mesh) { glassGeo.mesh.geometry.dispose(); glassGeo.mesh.geometry = geo; glassGeo.edges.geometry.dispose(); glassGeo.edges.geometry = new THREE.EdgesGeometry(geo, 20); }
    else {
      glassGeo.mesh = new THREE.Mesh(geo, glassMat); glassGeo.mesh.renderOrder = 3;
      glassGeo.edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: 0xc4e4ff, transparent: true, opacity: 0.45 }));
      group.add(glassGeo.mesh, glassGeo.edges);
    }
  }

  /* ---- run the physics, pose the beams ---- */
  const A = new THREE.Vector3(), B = new THREE.Vector3(), WHITE = new THREE.Color(1, 1, 1);
  const result = { devRed: 0, devBlue: 0, tirAny: false, trapped: 0, outCount: 0, reach: 0, fan: 0 };
  function run() {
    const poly = polygon();
    let i = 0; const outs = [];
    // the white leg: identical for every wavelength up to the first face
    const w = trace(poly, glass.nNm(550));
    const s0 = w.segs[0];
    beams.userData.set(i++, A.set(s0[0], 0, s0[1]), B.set(s0[2], 0, s0[3]), 0.045, WHITE, 0.9);
    let tirAny = false, trapped = 0, outCount = 0, reach = 0;
    const traces = WLS.map(nm => { const r = trace(poly, glass.nNm(nm)); if (r.tir) tirAny = true; if (r.trapped) trapped++; if (r.out) { outCount++; outs.push(Math.atan2(r.dz, r.dx)); } return r; });
    const mean = outs.length ? Math.atan2(outs.reduce((a, t) => a + Math.sin(t), 0), outs.reduce((a, t) => a + Math.cos(t), 0)) : 0;
    const lp = landing.geometry.attributes.position, lc = landing.geometry.attributes.color; let ln = 0;
    const hit = [];
    traces.forEach((r, k) => {
      const c = colorOfNm(WLS[k]);
      for (let s = 1; s < r.segs.length && i < 158; s++) {
        const sg = r.segs[s], last = s === r.segs.length - 1;
        let x2 = sg[2], z2 = sg[3];
        if (last && r.out && T.gain !== 1) {           // widen the fan about its true mean, display only
          const th = Math.atan2(r.dz, r.dx), wide = mean + (th - mean) * T.gain;
          const L = exitLen(sg[0], sg[1], Math.cos(wide), Math.sin(wide));
          x2 = sg[0] + Math.cos(wide) * L; z2 = sg[1] + Math.sin(wide) * L;
        }
        beams.userData.set(i++, A.set(sg[0], 0, sg[1]), B.set(x2, 0, z2), sg[4] ? 0.016 : 0.022, c, sg[4] ? 0.5 : 0.75);
        if (last && r.out && Math.abs(x2 - SCREEN_X) < 1e-3 && Math.abs(z2) < BOUND) { lp.setXYZ(ln, x2, 0, z2); lc.setXYZ(ln, c.r, c.g, c.b); ln++; reach++; hit.push(WLS[k]); }
      }
    });
    beams.userData.use(i);
    landing.geometry.setDrawRange(0, ln); lp.needsUpdate = true; lc.needsUpdate = true;
    const dev = r => r.out ? Math.atan2(r.dz, r.dx) / DEG : NaN;
    const red = trace(poly, glass.nNm(650)), blue = trace(poly, glass.nNm(450));
    Object.assign(result, { devRed: dev(red), devBlue: dev(blue), tirAny, trapped, outCount, reach, fan: outs.length ? (Math.max(...outs) - Math.min(...outs)) / DEG : 0 });
    strip.light(hit.length ? nm => (hit.some(h => Math.abs(h - nm) < 8) ? 0.95 : 0.12) : null);
    if (reach >= 10 && result.fan > 0.05 && !done) { done = true; solved(); }
    report();
  }

  /* ---- readouts ---- */
  const R = readouts(out, [
    { id: 'n', k: 'index of refraction', d: 'n at 450 nm and 650 nm, Cauchy fit to the catalogue' },
    { id: 'dev', k: 'deviation, traced', d: 'angle the exit ray makes with the beam in' },
    { id: 'fan', k: 'spread, red to blue', d: 'the true fan; the stage widens it by the stated factor' },
  ]);
  function report() {
    const n4 = glass.nNm(450), n6 = glass.nNm(650);
    R.set('n', `${n4.toFixed(4)} <span class="u">blue</span> &nbsp; ${n6.toFixed(4)} <span class="u">red</span>`, `${T.nd < 1 ? 'an index below 1: light bends away from the normal, and may not get in at all' : 'the index climbs toward the blue by ' + (n4 - n6).toFixed(4)}`);
    const d = (v) => isNaN(v) ? '<span class="u">trapped</span>' : Math.abs(v).toFixed(2) + '<span class="u">°</span>';
    R.set('dev', `${d(result.devRed)} <span class="u">red</span> &nbsp; ${d(result.devBlue)} <span class="u">blue</span>`);
    R.set('fan', result.outCount ? fmtDeg(result.fan, 2) : '<span class="u">no exit</span>', `drawn ×${T.gain}; at ×1 the stage shows the angles as traced`);
    const name = T.mat === 'invent' ? 'an invented glass' : MATERIALS.find(m => m.id === T.mat).name;
    if (T.nd < 1 && result.tirAny && !result.outCount) say(`Index ${T.nd.toFixed(2)}: below one, the beam meets the face and bounces off before it ever gets in. Nothing enters.`);
    else if (T.nd < 1) say(`Index ${T.nd.toFixed(2)}: below one, so the ray bends away from the normal on the way in, the opposite of glass. The ship knows no solid that does this; the phase index of a plasma comes close.`);
    else if (result.trapped === WLS.length) say(`Every colour is trapped: at a ${T.apex}° apex the second face meets the beam too steeply and ${name} reflects it back inside. Cut a shallower apex, or tilt the block.`);
    else if (result.trapped) say(`Total internal reflection for ${result.trapped} of ${WLS.length} wavelengths: the blue end, which bends harder, meets the exit face past the critical angle first.`);
    else if (Math.abs(T.nd - 1) < 0.005) say('Index 1.00: the glass is indistinguishable from air. The beam does not notice it.');
    else if (T.apex < 1) say(`A parallel slab shifts the beam sideways and sends it on parallel to itself; no wedge, no fan. The spread is ${result.fan.toFixed(2)}°.`);
    else if (result.fan > 2) say(`${name} spreads red from blue by ${result.fan.toFixed(1)}°, wide enough to see without help.`);
    else say(`${name} bends the beam ${Math.abs(result.devRed).toFixed(1)}° and spreads red from blue by only ${result.fan.toFixed(2)}°: a real fan is thin, which is why the stage widens it.`);
  }

  /* ---- controls ---- */
  const matChips = chips(ctrl, MATERIALS.map(m => ({ id: m.id, name: m.name, b: 'n ' + m.nd.toFixed(3), on: m.id === 'bk7' })).concat([{ id: 'invent', name: 'INVENT', b: 'your glass' }]), {
    onPick(it) {
      T.mat = it.id;
      if (it.id !== 'invent') { const m = MATERIALS.find(x => x.id === it.id); T.nd = m.nd; T.V = m.V; dN.set(m.nd); dV.set(m.V); }
      el.classList.toggle('is-invent', it.id === 'invent');
      glass = cauchy(T.nd, T.V); run();
    },
  });
  const dials = document.createElement('div'); dials.className = 'dials'; ctrl.appendChild(dials);
  const invent = v => { T.mat = 'invent'; matChips.mark('invent'); el.classList.add('is-invent'); glass = cauchy(T.nd, T.V); run(); };
  const dN = dial(dials, { label: 'index n<sub>d</sub>', min: 0.5, max: 3, step: 0.005, value: T.nd, fmt: v => v.toFixed(3), onInput: v => { T.nd = v; invent(); } });
  const dV = dial(dials, { label: 'Abbe number (lower is more dispersive)', min: 5, max: 150, step: 0.5, value: T.V, fmt: v => v.toFixed(1), onInput: v => { T.V = v; invent(); } });
  const dA = dial(dials, { label: 'apex angle', min: 0, max: 90, step: 1, value: T.apex, fmt: v => v + '°', onInput: v => { T.apex = v; buildGlass(); run(); } });
  const dT = dial(dials, { label: 'turn the block (or drag the stage)', min: -60, max: 60, step: 1, value: 0, fmt: v => v + '°', onInput: v => { T.tilt = v; buildGlass(); run(); } });
  chips(ctrl, [{ id: '1', name: '×1 true' }, { id: '10', name: '×10', on: true }, { id: '30', name: '×30' }].map(c => Object.assign(c, { b: 'fan' })), { onPick: it => { T.gain = +it.id; run(); }, cls: 'gain' });

  /* ---- the viewport ---- */
  ship.viewport(el, {
    fov: 34,
    setup(vp) {
      cam = vp.camera; cam.position.set(0.3, 6.2, 5.6); cam.lookAt(0.2, 0, 0.1);
      vp.scene.add(benchFloor(10, 20));
      vp.scene.add(group, beams, landing);
      buildGlass();
      lamp = glowSprite(0xfff4dc, 0.9); lamp.position.copy(SRC); vp.scene.add(lamp);
      screen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 7.6), new THREE.MeshBasicMaterial({ color: 0x111822, transparent: true, opacity: 0.85 }));
      screen.position.set(SCREEN_X + 0.03, 0, 0); vp.scene.add(screen);
      const l1 = tag('LAMP', 0.22, '#9aa2b1'); l1.position.set(SRC.x, 0.7, 0); vp.scene.add(l1);
      const l2 = tag('SCREEN', 0.22, '#9aa2b1'); l2.position.set(SCREEN_X, 0.95, 0); vp.scene.add(l2);
      run();
    },
    frame(vp) {
      if (!ship.motion) return;
      lamp.material.opacity = 0.85 + 0.1 * Math.sin(vp.t * 1.7);
    },
    pointer(ev, vp) {
      if (ev.type === 'pointerdown') { el.setPointerCapture(ev.pointerId); el.__drag = { x: ev.clientX, t: T.tilt }; el.classList.add('is-grabbing'); }
      else if (ev.type === 'pointermove' && el.__drag) { const t = clamp(el.__drag.t + (ev.clientX - el.__drag.x) * 0.35, -60, 60); dT.set(Math.round(t), true); }
      else if (ev.type === 'pointerup' || ev.type === 'pointercancel') { el.__drag = null; el.classList.remove('is-grabbing'); }
    },
  });
  return { run };
}
