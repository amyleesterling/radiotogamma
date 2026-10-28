/* lab/hose.js: bench 03, GARDEN HOSE RAINBOW.
 *
 * A rainbow is not a thing at a place; it is an angle. Every droplet in the
 * spray sends sunlight back most strongly at one angle from the antisolar
 * axis (the line from the sun through your head), Descartes' angle of
 * minimum deviation. For one bounce inside a water drop that is 42.5° in the
 * red and 40.6° in the violet; for two bounces 50.2° to 53.6° with the
 * colours flipped; and nothing can land between: Alexander's dark band.
 *
 * The angles are computed, not quoted: for each wavelength the drop's index
 * comes from Cauchy and the caustic from cos^2 i = (n^2 - 1) / (k^2 + 2k)
 * for k internal reflections. Change the drop's material and the bow moves,
 * or vanishes: a drop of glass bows at 21°, and a drop of diamond, with
 * n > 2, has no one-bounce bow at all.
 */
import { ship } from '../ship/ship.js';
import { THREE, P, TAU, DEG, clamp, sm, rgb01, cauchy, beamSet, octave, dial, chips, readouts, voice, fmtDeg, chase, benchFloor, tag, glowSprite } from './bench.js';

export const question = {
  id: 'hose', title: 'Bench 03 · Garden hose',
  text: 'Sun, you, and a cloud of spray. Where can the rainbow appear?',
  choices: ['Wherever the mist is thickest', 'Anywhere the sun hits water', 'Only at one angle from your shadow', 'Directly toward the sun'], answer: 2,
  reveal: 'Only at one angle. Each droplet sends red light back at 42° from the line running from the sun through your head, the antisolar point. The rainbow is not a thing at a place; it is an angle, a 42° cone around your own shadow, and every observer stands at the tip of their own private cone.',
};

/* Descartes: the angle from the antisolar axis at which k-bounce light
   piles up, for index n. NaN when there is no caustic (n^2 > 1 + k^2 + 2k). */
export function bowAngle(n, k) {
  const c2 = (n * n - 1) / (k * k + 2 * k);
  if (c2 > 1 || c2 < 0) return NaN;
  const i = Math.acos(Math.sqrt(c2)), r = Math.asin(Math.sin(i) / n);
  const dev = 2 * (i - r) + k * (Math.PI - 2 * r);
  return Math.abs(Math.PI - (dev % TAU)) / DEG;
}

const N_DROPS = 2400, EYE = new THREE.Vector3(0, 1.6, 0);
const DROPS = [{ id: 'water', name: 'Water', nd: 1.3330, V: 55.7 }, { id: 'glass', name: 'Glass bead', nd: 1.5168, V: 64.2 }, { id: 'diamond', name: 'Diamond', nd: 2.4175, V: 55.3 }];

export function mount({ el, hud, ctrl, out, solved }) {
  const T = { nd: 1.3330, V: 55.7, mat: 'water', el: 24, az: -2.35, cloud: new THREE.Vector3(1.9, 1.05, 1.9), light: false, eye: false };
  let glass = cauchy(T.nd, T.V);
  const strip = octave(hud), say = voice(out);
  let done = false;

  /* ---- the bow, as a lookup by angle: built from the physics, read by the shader ---- */
  const LW = 1024, lutData = new Uint8Array(LW * 4);
  const lut = new THREE.DataTexture(lutData, LW, 1, THREE.RGBAFormat); lut.minFilter = lut.magFilter = THREE.LinearFilter;
  const ang = { r1: NaN, v1: NaN, r2: NaN, v2: NaN };
  function buildLUT() {
    const acc = new Float32Array(LW * 3);
    ang.r1 = bowAngle(glass.nNm(700), 1); ang.v1 = bowAngle(glass.nNm(400), 1);
    ang.r2 = bowAngle(glass.nNm(700), 2); ang.v2 = bowAngle(glass.nNm(400), 2);
    const dep = (deg, c, w) => {
      if (isNaN(deg)) return;
      const x0 = deg / 180 * (LW - 1), sig = 0.24 / 180 * (LW - 1);
      for (let x = Math.max(0, Math.floor(x0 - 3 * sig)); x <= Math.min(LW - 1, Math.ceil(x0 + 3 * sig)); x++) {
        const g = Math.exp(-(x - x0) * (x - x0) / (2 * sig * sig)) * w;
        acc[x * 3] += c[0] * g; acc[x * 3 + 1] += c[1] * g; acc[x * 3 + 2] += c[2] * g;
      }
    };
    for (let nm = 380; nm <= 750; nm += 4) {
      const n = glass.nNm(nm), c = rgb01(nm);
      dep(bowAngle(n, 1), c, 1); dep(bowAngle(n, 2), c, 0.43);
    }
    let mx = 1e-6; for (let i = 0; i < LW * 3; i++) mx = Math.max(mx, acc[i]);
    const inner = isNaN(ang.v1) ? -1 : ang.v1, outer = isNaN(ang.v2) ? 999 : ang.v2;
    for (let x = 0; x < LW; x++) {
      const deg = x / (LW - 1) * 180;
      // one-bounce light also fills the inside of the primary, two-bounce the outside of the secondary; between them nothing: Alexander's band
      const fill = (deg < inner ? 0.09 * (1 - deg / Math.max(inner, 1)) : 0) + (deg > outer ? 0.05 : 0);
      for (let k = 0; k < 3; k++) lutData[x * 4 + k] = Math.round(255 * clamp(acc[x * 3 + k] / mx + fill, 0, 1));
      lutData[x * 4 + 3] = 255;
    }
    lut.needsUpdate = true;
  }

  /* ---- the spray: one Points cloud coloured in the shader by its angle ---- */
  const off = new Float32Array(N_DROPS * 3), ph = new Float32Array(N_DROPS);
  for (let i = 0; i < N_DROPS; i++) {
    const r = Math.cbrt(Math.random()), th = Math.random() * TAU, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u);
    off[i * 3] = 1.25 * r * s * Math.cos(th); off[i * 3 + 1] = 0.95 * r * u; off[i * 3 + 2] = 1.25 * r * s * Math.sin(th); ph[i] = Math.random() * TAU;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(off, 3)); dgeo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const dmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uEye: { value: EYE }, uAxis: { value: new THREE.Vector3(0, 0, 1) }, uLut: { value: lut }, uSun: { value: 1 }, uC: { value: T.cloud }, uT: { value: 0 }, uPR: { value: ship.pixelRatio }, uJit: { value: 1 } },
    vertexShader: `attribute float phase; uniform vec3 uEye, uAxis, uC; uniform sampler2D uLut; uniform float uSun, uT, uPR, uJit; varying vec3 vC;
      void main(){
        vec3 p = uC + position + uJit * 0.03 * vec3(sin(uT * 2.3 + phase), cos(uT * 1.9 + phase * 1.7), sin(uT * 2.1 + phase * 0.6));
        vec3 d = normalize(p - uEye); float a = acos(clamp(dot(d, uAxis), -1.0, 1.0)) / 3.14159265;
        vec3 bow = texture2D(uLut, vec2(a, 0.5)).rgb;
        vC = vec3(0.10, 0.13, 0.17) + bow * uSun * 1.1;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPR * 26.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; float a = smoothstep(1.0, 0.15, r); gl_FragColor = vec4(vC * a, a); }`,
  });
  const drops = new THREE.Points(dgeo, dmat); drops.frustumCulled = false;

  /* ---- the figure, the sun, the cones ---- */
  const figMat = new THREE.MeshBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.3, 10), figMat); body.position.set(0, 0.72, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), figMat); head.position.copy(EYE);
  const eyeGlow = glowSprite(0x9fe8ff, 0.5); eyeGlow.position.copy(EYE);
  const sun = glowSprite(0xffd97a, 3.2); const sunCore = glowSprite(0xfff4d0, 1.0);
  const shadow = glowSprite(0xa07cff, 0.6, 0.8);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0x5c6774 }));
  const coneMat = c => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(c) }, uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uA; varying vec2 vUv; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5); float along = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y)); gl_FragColor = vec4(uC * uA * (0.06 + 0.5 * f) * along, 1.0); }` });
  const coneGeo = new THREE.CylinderGeometry(1, 0, 1, 56, 1, true).translate(0, 0.5, 0);
  const cone1 = new THREE.Mesh(coneGeo, coneMat(0xff6b6b)), cone2 = new THREE.Mesh(coneGeo, coneMat(0xa07cff));
  const axisBeams = beamSet(2);
  const Y = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(), A = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let camera, labelBow, labelAnti;

  function sunDir() { const e = T.el * DEG; return S.set(Math.cos(e) * Math.sin(T.az), Math.sin(e), Math.cos(e) * Math.cos(T.az)); }
  function pose() {
    sunDir(); A.copy(S).negate(); dmat.uniforms.uAxis.value.copy(A);
    dmat.uniforms.uSun.value = sm(T.el / 4);
    sun.position.copy(S).multiplyScalar(40).add(EYE); sunCore.position.copy(sun.position);
    // the antisolar point on the ground: the shadow of your head
    const tg = A.y < -0.02 ? -EYE.y / A.y : NaN;
    shadow.visible = !isNaN(tg); if (shadow.visible) shadow.position.copy(EYE).addScaledVector(A, tg).setY(0.02);
    nozzle.position.set(T.cloud.x, 0.15, T.cloud.z);
    const L = 7;
    const setCone = (c, deg, on) => { c.visible = on && !isNaN(deg); if (!c.visible) return; c.position.copy(EYE); c.quaternion.setFromUnitVectors(Y, A); const t = Math.tan(deg * DEG); c.scale.set(t * L, L, t * L); c.material.uniforms.uA.value = 1; };
    setCone(cone1, ang.r1, T.light); setCone(cone2, ang.v2, T.light);
    axisBeams.visible = T.light;
    axisBeams.userData.set(0, tmp.copy(EYE).addScaledVector(S, 9), EYE, 0.012, new THREE.Color(0xffd97a), 0.6);
    axisBeams.userData.set(1, EYE, tmp.copy(EYE).addScaledVector(A, isNaN(tg) ? 9 : Math.min(9, tg)), 0.012, new THREE.Color(0xa07cff), 0.7);
    axisBeams.userData.use(2);
    if (labelBow) { labelBow.visible = T.light && !isNaN(ang.r1); labelBow.position.copy(EYE).addScaledVector(A, 2.2).addScaledVector(tmp2.set(A.z, 0, -A.x).normalize(), Math.tan((isNaN(ang.r1) ? 42 : ang.r1) * DEG) * 2.2 + 0.25); }
    if (labelAnti) { labelAnti.visible = shadow.visible; labelAnti.position.copy(shadow.position).add(tmp.set(0, 0.25, 0)); }
  }
  // how many drops sit on the primary bow right now: JS-side, on change only
  function census() {
    let n1 = 0, n2 = 0;
    for (let i = 0; i < N_DROPS; i += 2) {
      tmp.set(T.cloud.x + off[i * 3], T.cloud.y + off[i * 3 + 1], T.cloud.z + off[i * 3 + 2]).sub(EYE).normalize();
      const a = Math.acos(clamp(tmp.dot(A), -1, 1)) / DEG;
      if (!isNaN(ang.r1) && a > ang.v1 - 0.3 && a < ang.r1 + 0.3) n1++;
      if (!isNaN(ang.r2) && a > ang.r2 - 0.3 && a < ang.v2 + 0.3) n2++;
    }
    return { n1: n1 * 2, n2: n2 * 2 };
  }

  /* ---- readouts ---- */
  const R = readouts(out, [
    { id: 'p', k: 'primary bow, one bounce', d: 'angle from the antisolar point, violet to red' },
    { id: 's', k: 'secondary bow, two bounces', d: 'red inside, violet outside; about 43% as bright' },
    { id: 'top', k: 'top of the primary bow', d: 'bow angle minus the sun\'s elevation, as seen from the ground' },
  ]);
  function report() {
    const c = census(), lit = T.el > 0.5;
    const rng = (a, b) => isNaN(a) ? '<span class="u">none</span>' : `${a.toFixed(1)}<span class="u">°</span> to ${b.toFixed(1)}<span class="u">°</span>`;
    R.set('p', rng(ang.v1, ang.r1), isNaN(ang.r1) ? 'n above 2: the one-bounce path has no caustic at all' : `Alexander’s dark band: ${isNaN(ang.r2) ? 'no second bow to bound it' : (ang.r2 - ang.r1).toFixed(1) + '° of darker sky above it'}`);
    R.set('s', rng(ang.r2, ang.v2));
    const top = ang.r1 - T.el;
    R.set('top', isNaN(ang.r1) ? '<span class="u">none</span>' : (top >= 0 ? fmtDeg(top) + ' <span class="u">above the horizon</span>' : fmtDeg(-top) + ' <span class="u">below the horizon</span>'), isNaN(ang.r1) ? '' : top < 0 ? 'the sun is too high; the bow is in the spray below your feet, or off a hillside' : 'full semicircle when the sun sits on the horizon');
    strip.light(c.n1 > 30 && lit ? () => 0.85 : c.n2 > 30 && lit ? () => 0.45 : null);
    if (c.n1 > 40 && lit && !done) { done = true; solved(); }
    const name = T.mat === 'custom' ? `a drop of index ${T.nd.toFixed(2)}` : DROPS.find(d => d.id === T.mat).name.toLowerCase();
    if (!lit) say('The sun is on the horizon or below it. No light, no bow: the cloud is just a cloud.');
    else if (Math.abs(T.nd - 1) < 0.01) say('Index 1.00: a drop of nothing. Light passes straight through without bending, and nothing comes back at any angle.');
    else if (isNaN(ang.r1) && !isNaN(ang.r2)) say(`${T.mat === 'diamond' ? 'Diamond' : name}, n ${T.nd.toFixed(2)}: above n = 2 the one-bounce path has no minimum deviation, so there is no primary bow. The two-bounce bow survives, at ${ang.r2.toFixed(0)}° from the antisolar point: a ring ${(180 - ang.r2).toFixed(0)}° around the sun itself.`);
    else if (isNaN(ang.r1)) say('No caustic for one bounce or two: this drop makes no bow at all.');
    else if (c.n1 > 40) say(`The spray crosses the ${ang.r1.toFixed(1)}° cone: ${c.n1} droplets are sending ${name === 'water' ? '' : name + ' '}colour your way${c.n2 > 30 ? ', and a fainter twin shows at ' + ang.r2.toFixed(0) + '° with the colours flipped' : ''}. Move the cloud or the sun and the bow stays on the cone, not on the water.`);
    else if (c.n2 > 30) say(`Only the secondary: the spray sits in the ${ang.r2.toFixed(0)}° to ${ang.v2.toFixed(0)}° shell. Bring it a little closer to your shadow for the primary.`);
    else if (ang.r1 < 30) say(`A drop of ${name === 'glass bead' ? 'glass' : name} bows at only ${ang.r1.toFixed(0)}°: the tight bows on a road’s reflective paint are made of glass beads exactly like this. Nothing is in that cone yet.`);
    else say(`Nothing, yet. The ${ang.r1.toFixed(0)}° cone around your shadow is empty of spray. Drag the cloud into it, or drag the sun until the cone sweeps across the cloud.`);
  }

  /* ---- controls ---- */
  const dropChips = chips(ctrl, DROPS.map(d => ({ id: d.id, name: d.name, b: 'n ' + d.nd.toFixed(3), on: d.id === 'water' })), { onPick: it => { T.mat = it.id; T.nd = it.nd; T.V = it.V; dN.set(it.nd); glass = cauchy(T.nd, T.V); buildLUT(); pose(); report(); } });
  const dials = document.createElement('div'); dials.className = 'dials'; ctrl.appendChild(dials);
  const dN = dial(dials, { label: 'droplet index n<sub>d</sub>', min: 1, max: 2.6, step: 0.005, value: T.nd, fmt: v => v.toFixed(3), onInput: v => { T.nd = v; T.V = 55; T.mat = 'custom'; dropChips.mark(''); glass = cauchy(T.nd, T.V); buildLUT(); pose(); report(); } });
  const dE = dial(dials, { label: 'sun elevation (or drag the sky)', min: 0, max: 70, step: 0.5, value: T.el, fmt: v => v.toFixed(1) + '°', onInput: v => { T.el = v; pose(); report(); } });
  chips(ctrl, [{ id: 'yard', name: 'over the yard', on: true }, { id: 'eye', name: 'from your eye' }], { onPick: it => { T.eye = it.id === 'eye'; } });
  chips(ctrl, [{ id: 'light', name: 'show the light' }], { radio: false, onPick: (it, b) => { T.light = !T.light; b.setAttribute('aria-pressed', String(T.light)); pose(); } });

  /* ---- the viewport ---- */
  const camPos = new THREE.Vector3(4.6, 3.4, 7.2), camTgt = new THREE.Vector3(1.4, 1.1, 1.4), wantPos = new THREE.Vector3(), wantTgt = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05);
  let drag = null;
  ship.viewport(el, {
    fov: 44,
    setup(vp) {
      camera = vp.camera; camera.position.copy(camPos); camera.lookAt(camTgt);
      vp.scene.add(benchFloor(16, 16, 0x1d3a2a), body, head, eyeGlow, sun, sunCore, shadow, nozzle, drops, cone1, cone2, axisBeams);
      labelBow = tag('THE 42° CONE', 0.22, '#ff9c8a'); labelAnti = tag('ANTISOLAR POINT', 0.2, '#a07cff');
      const lb = tag('SPRAY (DRAG IT)', 0.2, '#9aa2b1'); lb.position.set(0, 1.35, 0); drops.add(lb);
      vp.scene.add(labelBow, labelAnti);
      buildLUT(); pose(); report();
    },
    frame(vp) {
      dmat.uniforms.uT.value = vp.t; dmat.uniforms.uJit.value = ship.motion ? 1 : 0;
      if (T.eye) { wantPos.copy(EYE); wantTgt.copy(EYE).add(A); camera.fov = 78; } else { wantPos.copy(camPos); wantTgt.copy(camTgt); camera.fov = 44; }
      const k = 1 - Math.exp(-vp.dt * 5);
      camera.position.lerp(wantPos, k); camTgt.lerp(wantTgt, k); camera.lookAt(camTgt); camera.updateProjectionMatrix();
      if (ship.motion) sun.material.opacity = 0.8 + 0.12 * Math.sin(vp.t * 0.9);
    },
    pointer(ev, vp) {
      if (ev.type === 'pointerdown') {
        el.setPointerCapture(ev.pointerId); el.classList.add('is-grabbing');
        const hit = vp.ray.ray.intersectPlane(plane, tmp);
        drag = (!T.eye && hit && hit.distanceTo(T.cloud) < 1.8) ? { cloud: true, dx: T.cloud.x - hit.x, dz: T.cloud.z - hit.z } : { sky: true, x: ev.clientX, y: ev.clientY, az: T.az, el: T.el };
      } else if (ev.type === 'pointermove' && drag) {
        if (drag.cloud) { const hit = vp.ray.ray.intersectPlane(plane, tmp); if (hit) { T.cloud.set(clamp(hit.x + drag.dx, -6, 6), 1.05, clamp(hit.z + drag.dz, -6, 6)); } }
        else { T.az = drag.az - (ev.clientX - drag.x) * 0.008; T.el = clamp(drag.el + (ev.clientY - drag.y) * 0.12, 0, 70); dE.set(T.el.toFixed(1)); }
        pose(); report();
      } else if (ev.type === 'pointerup' || ev.type === 'pointercancel') { drag = null; el.classList.remove('is-grabbing'); }
    },
  });
}
