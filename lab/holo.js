/* lab/holo.js: bench 06, HOLOGRAM.
 *
 * A hologram is not a picture of a thing. It is a recording of an
 * interference pattern. Two waves land on the plate, the light scattered
 * off the object and a plane reference wave straight from the laser, and
 * the emulsion is exposed by |O + R|^2. Only the cross term knows which way
 * the object light was travelling, and that is the fringes. Replay the
 * developed plate with the reference alone and each patch is a grating of
 * local spacing d(u): sin(out) = sin(in) + m lambda / d. For m = +1 the
 * reference terms cancel and what leaves is the object wave, so the rays
 * back-project to where the object used to be. Break the plate and every
 * shard still holds the whole scene, dimmer and blurrier by 1.22 lambda / A.
 *
 * Scale: one scene unit is 10 µm; the plate is 80 µm wide and drawn at its
 * real fringe spacing (0.7 to 3 µm). Multiply every length by 1000 and it is
 * an 8 cm plate with the subject 8 cm behind it, the same fringes, tens of
 * thousands of them. The fringes are averaged over each pixel by the exact
 * mean of cos over the pixel's phase span, which is what a plate does to a
 * naked eye too: a hologram in the hand looks like dirty glass.
 * New on the ship: replay in a different colour than you recorded, and watch
 * the image move off the object.
 */
import { ship } from '../ship/ship.js';
import { THREE, P, TAU, DEG, clamp, sm, GLSL_WL, colorOfNm, rgb01, beamSet, octave, dial, chips, readouts, voice, fmtDeg, fmtUm, benchFloor, tag, glowSprite } from './bench.js';

export const question = {
  id: 'holo', title: 'Bench 06 · Hologram',
  text: 'A hologram is cut in half. What do you see through one half?',
  choices: ['Half the scene, sliced down the middle', 'The whole scene, from a narrower window', 'Nothing: the recording is ruined', 'The whole scene, at half the size'], answer: 1,
  reveal: 'The whole scene, a little dimmer and a little blurrier. Every point on the plate is lit by light from every point of the object, so every point on the plate records fringes belonging to the whole scene. A shard is simply a smaller window to look through. You lose brightness in proportion to the area left, and resolution, because an aperture of width A cannot separate detail finer than about 1.22 λ/A in angle: an 8 µm shard at 633 nm resolves 5.5°, where the full 80 µm plate resolved 0.55°. Cut a photograph in half and half the scene is gone. Cut a hologram in half and you have only stepped back from the window.',
};

const U_HALF = 40, U_DRAW = 52, ZE = 80, PUPIL = 7, U_MARK = -46, OBAMP = 0.40, S = 0.1;   // S: units per µm
const OBJ = [{ du: -7, dz: 6, amp: 1.0 }, { du: 0, dz: -7, amp: 0.95 }, { du: 7, dz: 3, amp: 0.9 }];
const SHARDS = [[-U_HALF, U_HALF], [2, 36], [10, 27], [15, 23]];
const laserName = nm => Math.abs(nm - 633) <= 2 ? 'HeNe' : Math.abs(nm - 532) <= 2 ? 'green DPSS' : Math.abs(nm - 488) <= 2 ? 'argon' : Math.abs(nm - 405) <= 2 ? 'violet diode' : '';

const FRAG = `
precision highp float;
varying vec3 vW, vN;
uniform float uLam, uTheta, uZo, uUo, uReplay, uExpo, uA0, uA1; uniform vec3 uDu, uDz, uAmp, uCol;
float hash(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  vec3 N = normalize(vN);
  if (abs(N.z) < 0.5) { gl_FragColor = vec4(0.06, 0.08, 0.11, 1.0); return; }
  float u = vW.x * 10.0;
  float jag0 = uA0 > -39.0 ? 1.1 * (hash(floor(vW.y * 9.0)) - 0.5) : 0.0, jag1 = uA1 < 39.0 ? 1.1 * (hash(floor(vW.y * 9.0) + 3.0) - 0.5) : 0.0;
  if (u < uA0 + jag0 || u > uA1 + jag1) { gl_FragColor = vec4(0.045, 0.06, 0.085, 1.0); return; }
  float k = 6.2831853 / uLam, sT = sin(uTheta);
  float I = 1.0, tot = 0.0; float a[3]; float r[3];
  for (int j = 0; j < 3; j++) {
    float pu = uUo + uDu[j], pz = uZo + uDz[j], d = u - pu, rr = sqrt(d * d + pz * pz);
    float aa = uAmp[j] * ${OBAMP} * uZo / rr;
    float phi = k * (rr - u * sT), dphi = fwidth(phi);
    float damp = dphi < 1e-4 ? 1.0 : sin(dphi * 0.5) / (dphi * 0.5);
    I += aa * aa + 2.0 * aa * cos(phi) * damp; tot += aa; a[j] = aa; r[j] = rr; }
  I += 2.0 * a[0] * a[1] * cos(k * (r[0] - r[1])) + 2.0 * a[0] * a[2] * cos(k * (r[0] - r[2])) + 2.0 * a[1] * a[2] * cos(k * (r[1] - r[2]));
  float Imax = (1.0 + tot) * (1.0 + tot);
  float b = pow(clamp(I / Imax, 0.0, 1.0), 0.7) * uExpo;
  vec3 rec = uCol * (0.10 + 0.9 * b);
  vec3 dev = vec3(14.0 + 236.0 * b, 16.0 + 233.0 * b, 20.0 + 225.0 * b) / 255.0;
  gl_FragColor = vec4(mix(rec, dev, uReplay), 1.0); }`;
const VERT = 'varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';

export function mount({ el, hud, ctrl, out, solved }) {
  const T = { replay: false, zo: 80, uo: 0, theta: 12 * DEG, lam: 0.633, lam2: 0.633, lvl: 0, eyeU: 0, expo: 1 };
  const strip = octave(hud), say = voice(out);
  let done = false;
  const aper = () => SHARDS[T.lvl], aperW = () => aper()[1] - aper()[0];
  const pointAt = j => ({ u: T.uo + OBJ[j].du, z: T.zo + OBJ[j].dz });
  const nu = (u, j) => { const p = pointAt(j), d = u - p.u, r = Math.sqrt(d * d + p.z * p.z); return (d / r - Math.sin(T.theta)) / T.lam; };
  const spacing = (u, j) => { const n = Math.abs(nu(u, j)); return n < 1e-9 ? Infinity : 1 / n; };
  const sinOut = (u, j, m) => clamp(Math.sin(T.theta) + m * T.lam2 * nu(u, j), -0.999, 0.999);
  /* where the m = +1 rays from the two ends of the aperture back-project to */
  function imageOf(j) {
    const [a0, a1] = aper(), s0 = sinOut(a0, j, 1), s1 = sinOut(a1, j, 1);
    const k0 = s0 / Math.sqrt(1 - s0 * s0), k1 = s1 / Math.sqrt(1 - s1 * s1);
    let z = Math.abs(k0 - k1) < 1e-6 ? -1e4 : (a1 - a0) / (k0 - k1);
    z = clamp(z, -300, 300);
    return { u: a0 + k0 * z, z, far: Math.abs(z) >= 300 };
  }
  const blurUm = (pz) => 1.22 * T.lam2 * pz / aperW();
  function sees(j) {
    const im = imageOf(j), a = aper(); if (im.z >= 0) return false;
    const f = -im.z / (ZE - im.z), c = im.u + (T.eyeU - im.u) * f, pw = PUPIL * f;
    return c > a[0] - pw && c < a[1] + pw;
  }

  /* ---- the scene ---- */
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uLam: { value: 0.633 }, uTheta: { value: T.theta }, uZo: { value: 80 }, uUo: { value: 0 }, uReplay: { value: 0 }, uExpo: { value: 1 }, uA0: { value: -40 }, uA1: { value: 40 }, uDu: { value: new THREE.Vector3(...OBJ.map(o => o.du)) }, uDz: { value: new THREE.Vector3(...OBJ.map(o => o.dz)) }, uAmp: { value: new THREE.Vector3(...OBJ.map(o => o.amp)) }, uCol: { value: colorOfNm(633) } } });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2 * U_HALF * S, 5, 0.12), mat);
  const holder = new THREE.Mesh(new THREE.BoxGeometry(2 * U_DRAW * S, 5.6, 0.06), new THREE.MeshBasicMaterial({ color: 0x0c1118 })); holder.position.z = -0.1;
  const beams = beamSet(96);
  const objGlow = OBJ.map(() => glowSprite(0xffffff, 0.5)), imgGlow = OBJ.map(() => glowSprite(0xffffff, 0.5)), twinGlow = glowSprite(0xffffff, 0.4, 0.4);
  const eye = glowSprite(0x7ee0ff, 0.5), mark = glowSprite(0xc4e4ff, 0.22, 0.9);
  mark.position.set(U_MARK * S, 0, 0.08);
  const lblObj = tag('OBJECT', 0.22, '#eff4fb'), lblImg = tag('VIRTUAL IMAGE', 0.22, '#eff4fb'), lblEye = tag('EYE (DRAG IT)', 0.2, '#7ee0ff'), lblRef = tag('REFERENCE BEAM', 0.2, '#9aa2b1'), lblMark = tag('MARK ON THE HOLDER', 0.18, '#9aa2b1'), lblPlate = tag('PLATE', 0.2, '#7ee0ff'), lblTwin = tag('TWIN IMAGE', 0.18, '#9aa2b1');
  lblMark.position.set(U_MARK * S, -0.4, 0.1); lblPlate.position.set(U_HALF * S - 0.6, 2.85, 0.1);
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  const viewfinder = document.createElement('div'); viewfinder.className = 'finder'; viewfinder.innerHTML = '<span class="k">what the eye sees</span><div class="bar"><i class="m"></i><b></b><b></b><b></b></div>'; viewfinder.hidden = true; hud.appendChild(viewfinder);
  const fMark = viewfinder.querySelector('.m'), fDots = viewfinder.querySelectorAll('b');

  function pose() {
    const c = colorOfNm(T.lam * 1000), c2 = colorOfNm(T.lam2 * 1000), col = T.replay ? c2 : c, lamR = T.replay ? T.lam2 : T.lam;
    mat.uniforms.uLam.value = T.lam; mat.uniforms.uTheta.value = T.theta; mat.uniforms.uZo.value = T.zo; mat.uniforms.uUo.value = T.uo;
    mat.uniforms.uReplay.value = T.replay ? 1 : 0; mat.uniforms.uExpo.value = T.expo; mat.uniforms.uA0.value = aper()[0]; mat.uniforms.uA1.value = aper()[1]; mat.uniforms.uCol.value = c;
    let i = 0; const tT = Math.tan(T.theta), Lz = 110 + 14, a = aper();
    for (let k = -4; k <= 4; k++) { const ue = k * (U_DRAW / 4); beams.userData.set(i++, A.set((ue - tT * Lz) * S, 0, -Lz * S), B.set(ue * S, 0, 0), 0.02, col, T.replay ? 0.22 : 0.32); }
    lblRef.position.set((-U_DRAW * 0.55 - tT * Lz * 0.45) * S, 0.5, -Lz * 0.45 * S);
    objGlow.forEach((g, j) => { const p = pointAt(j); g.position.set(p.u * S, 0, -p.z * S); g.material.color = c; g.visible = !T.replay; });
    const mid = pointAt(1); lblObj.position.set(mid.u * S, 0.55, -mid.z * S); lblObj.visible = !T.replay;
    if (!T.replay) {
      for (let j = 0; j < 3; j++) { const p = pointAt(j); for (let k = -2; k <= 2; k++) beams.userData.set(i++, A.set(p.u * S, 0, -p.z * S), B.set(k * (U_HALF / 2) * S, 0, 0), 0.012, c, 0.14); }
      imgGlow.forEach(g => g.visible = false); twinGlow.visible = false; eye.visible = false; lblEye.visible = false; lblImg.visible = false; lblTwin.visible = false; viewfinder.hidden = true;
    } else {
      for (let k = 0; k <= 4; k++) { const ue = a[0] + (a[1] - a[0]) * k / 4; beams.userData.set(i++, A.set(ue * S, 0, 0), B.set((ue + tT * ZE) * S, 0, ZE * S), 0.012, c2, 0.08); }
      for (let k = 0; k <= 4; k++) { const ut = a[0] + (a[1] - a[0]) * k / 4, so = sinOut(ut, 1, -1), t = ZE / Math.sqrt(1 - so * so); beams.userData.set(i++, A.set(ut * S, 0, 0), B.set((ut + so * t) * S, 0, ZE * S), 0.012, c2, 0.08); }
      const twinU = mid.u + 2 * Math.sin(T.theta) * mid.z; twinGlow.position.set(twinU * S, 0, mid.z * S); twinGlow.material.color = c2; twinGlow.visible = mid.z < ZE + 14; lblTwin.position.copy(twinGlow.position).add(A.set(0, 0.4, 0)); lblTwin.visible = twinGlow.visible && Math.abs(twinU - T.eyeU) > 12;
      const frac = aperW() / (2 * U_HALF);
      for (let j = 0; j < 3; j++) {
        const im = imageOf(j), seen = sees(j);
        for (let k = 0; k < 7; k++) { const u = a[0] + (a[1] - a[0]) * k / 6, so = sinOut(u, j, 1), tf = (ZE + 14) / Math.sqrt(1 - so * so); beams.userData.set(i++, A.set(u * S, 0, 0), B.set((u + so * tf) * S, 0, (ZE + 14) * S), 0.011, c2, seen ? 0.2 : 0.09); }
        if (!im.far) { beams.userData.set(i++, A.set(a[0] * S, 0, 0), B.set(im.u * S, 0, im.z * S), 0.008, c2, 0.1); beams.userData.set(i++, A.set(a[1] * S, 0, 0), B.set(im.u * S, 0, im.z * S), 0.008, c2, 0.1); }
        const g = imgGlow[j]; g.visible = !im.far; g.position.set(im.u * S, 0, im.z * S); g.material.color = c2;
        const rad = Math.max(0.26, blurUm(Math.abs(im.z)) * S * 1.2); g.scale.set(rad * 2, rad * 2, 1); g.material.opacity = (0.18 + 0.75 * frac) * (seen ? 1 : 0.16);
        if (seen) beams.userData.set(i++, A.set(im.u * S, 0, im.z * S), B.set(T.eyeU * S, 0, ZE * S), 0.014, c2, 0.5);
      }
      const im1 = imageOf(1); lblImg.position.set(im1.u * S, 0.6, im1.z * S); lblImg.visible = !im1.far;
      eye.position.set(T.eyeU * S, 0, ZE * S); eye.visible = true; lblEye.position.copy(eye.position).add(A.set(0, -0.45, 0)); lblEye.visible = true;
      viewfinder.hidden = false;
      const span = 44, at = deg => (50 + clamp(deg, -span, span) / span * 46) + '%';
      fMark.style.left = at(Math.atan((U_MARK - T.eyeU) / ZE) / DEG);
      for (let j = 0; j < 3; j++) { const im = imageOf(j), ad = Math.atan((im.u - T.eyeU) / (ZE - im.z)) / DEG, r = Math.max(5, 1.22 * T.lam2 / aperW() / DEG / span * 90); fDots[j].style.left = at(ad); fDots[j].style.width = fDots[j].style.height = r + 'px'; fDots[j].style.background = cssGlow(c2); fDots[j].style.opacity = sees(j) ? 1 : 0.15; }
    }
    beams.userData.use(i);
    lblPlate.visible = true;
  }
  const cssGlow = c => `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;

  /* ---- readouts ---- */
  const R = readouts(out, [
    { id: 'fr', k: 'finest fringes on the plate', d: 'the local grating spacing at the edge; a carrier of λ / sin θ under them' },
    { id: 'win', k: 'window', d: 'what is left of the plate, and 1.22 λ / A, the finest angle it can resolve' },
    { id: 'see', k: 'the eye', d: 'light through the window, and the parallax against the mark' },
  ]);
  const parallax = () => { const im = T.replay ? imageOf(1) : { u: pointAt(1).u, z: -pointAt(1).z }; return (Math.atan((im.u - T.eyeU) / (ZE - im.z)) - Math.atan((U_MARK - T.eyeU) / ZE)) / DEG; };
  function report() {
    let fine = Infinity; for (let j = 0; j < 3; j++) for (const s of [-1, 1]) fine = Math.min(fine, spacing(s * U_HALF, j));
    R.set('fr', fmtUm(fine), T.theta < 0.6 * DEG ? 'in line, 0°: each point writes a Gabor zone plate, fringes opening out at the centre' : `off axis: a ${(T.lam / Math.sin(T.theta)).toFixed(2)} µm carrier under them, from the ${(T.theta / DEG).toFixed(1)}° reference`);
    const Aw = aperW(), angR = 1.22 * T.lam2 / Aw / DEG, frac = Aw / (2 * U_HALF);
    R.set('win', `${Aw.toFixed(0)}<span class="u">µm</span> &nbsp; ${angR.toFixed(2)}<span class="u">°</span>`, `${Math.round(frac * 100)}% of the plate; blur at the image ${blurUm(T.zo).toFixed(2)} µm`);
    let seen = 0; for (let j = 0; j < 3; j++) if (sees(j)) seen++;
    R.set('see', T.replay ? `${seen}<span class="u">of 3</span> &nbsp; ${(parallax() >= 0 ? '+' : '') + parallax().toFixed(1)}<span class="u">°</span>` : '<span class="u">recording</span>', T.replay ? (seen === 3 ? `all three points, ${Math.round(frac * 100)}% of the light` : 'drag the eye into the beam that leaves the shard') : 'the plate is being exposed; replay it to look');
    const nm = Math.round(T.lam * 1000), nm2 = Math.round(T.lam2 * 1000);
    strip.light(x => { const d = (x - (T.replay ? nm2 : nm)) / 6; return 0.05 + 0.95 * Math.exp(-d * d); });
    if (!T.replay) say(`Recording at ${nm} nm${laserName(nm) ? ' (' + laserName(nm) + ')' : ''}. Nothing here is a picture: the plate is marking where the object wave and the reference arrive in step. ${T.theta < 0.6 * DEG ? 'With the reference straight on, each point writes a zone plate.' : 'Drag the object around and watch the fringes re-form.'}`);
    else if (Math.abs(nm2 - nm) > 6) say(`Replayed at ${nm2} nm, recorded at ${nm}: the grating equation now hands back the wrong angle at every fringe, so the image ${imageOf(1).far ? 'runs off to infinity' : 'forms at ' + Math.round(-imageOf(1).z) + ' µm instead of ' + T.zo + ', shifted sideways'}. The plate remembers angles in units of the colour that wrote it.`);
    else if (T.lvl) say(`A ${Aw.toFixed(0)} µm shard still reconstructs all three points, in the right places at the right depth, because every part of the plate saw every part of the object. Dimmer, ${Math.round(frac * 100)}% of the light; blurrier, ${angR.toFixed(1)}° instead of ${(1.22 * T.lam2 / 80 / DEG).toFixed(2)}°. A piece of a hologram is a smaller window, not a smaller scene.`);
    else say('The developed plate, lit by the reference alone. Every fringe is a grating line, and the first order leaves at exactly the angle the object wave had. Drag the eye: the three points swing against the mark, the way a scene does and a photograph never can. Now break it.');
  }

  /* ---- controls ---- */
  const modeChips = chips(ctrl, [{ id: 'rec', name: 'record', on: true }, { id: 'rep', name: 'replay the plate' }], { onPick: it => setMode(it.id === 'rep') });
  const brk = chips(ctrl, [{ id: 'break', name: 'break the plate' }, { id: 'fix', name: 'restore the plate' }], { radio: false, onPick: it => { if (it.id === 'break') { if (!T.replay) setMode(true); setBreak(T.lvl + 1); } else setBreak(0); } });
  const dials = document.createElement('div'); dials.className = 'dials'; ctrl.appendChild(dials);
  const dZ = dial(dials, { label: 'object depth behind the plate', min: 20, max: 110, step: 1, value: 80, fmt: v => v + ' µm', onInput: v => { T.zo = v; expose(); pose(); report(); } });
  dial(dials, { label: 'reference angle', min: 0, max: 25, step: 0.5, value: 12, fmt: v => v.toFixed(1) + '°' + (v < 0.6 ? ' in line' : ''), onInput: v => { T.theta = v * DEG; expose(); pose(); report(); } });
  dial(dials, { label: 'laser, recording', min: 400, max: 700, step: 1, value: 633, fmt: v => v + ' nm ' + laserName(v), onInput: v => { T.lam = v / 1000; expose(); pose(); report(); } });
  dial(dials, { label: 'laser, replaying (break it: a different colour)', min: 400, max: 700, step: 1, value: 633, fmt: v => v + ' nm ' + laserName(v), onInput: v => { T.lam2 = v / 1000; pose(); report(); } });
  const expose = () => { T.expo = ship.motion ? 0 : 1; };
  function breakUI() { const b = brk.get('break'), f = brk.get('fix'); f.hidden = T.lvl === 0; b.textContent = T.lvl === 0 ? 'break the plate' : T.lvl < SHARDS.length - 1 ? 'break it again' : 'broken as it goes'; b.disabled = T.lvl === SHARDS.length - 1; }
  function setMode(r) { T.replay = r; modeChips.mark(r ? 'rep' : 'rec'); if (!r) { T.lvl = 0; breakUI(); expose(); } pose(); report(); }
  function setBreak(n) {
    T.lvl = clamp(n, 0, SHARDS.length - 1); breakUI();
    if (T.lvl > 0) { const a = aper(), uc = 0.5 * (a[0] + a[1]), im = imageOf(1); T.eyeU = clamp(im.u + (uc - im.u) * (ZE - im.z) / -im.z, -U_DRAW, U_DRAW); if (!done) { done = true; solved(); } }
    pose(); report();
  }
  breakUI();

  let drag = null; const tmp = new THREE.Vector3(), planeEye = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ZE * S), planeObj = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  ship.viewport(el, {
    fov: 38,
    setup(vp) {
      vp.camera.position.set(6.5, 7.5, 13); vp.camera.lookAt(0.5, -0.5, 0);
      vp.scene.add(benchFloor(30, 30).translateY(-2.9), plate, holder, beams, mark, eye, twinGlow, lblObj, lblImg, lblEye, lblRef, lblMark, lblPlate, lblTwin, ...objGlow, ...imgGlow);
      pose(); report();
    },
    frame(vp) {
      if (!T.replay && T.expo < 1) { T.expo = Math.min(1, T.expo + vp.dt / 0.9); mat.uniforms.uExpo.value = T.expo; }
    },
    pointer(ev, vp) {
      if (ev.type === 'pointerdown') { el.setPointerCapture(ev.pointerId); el.classList.add('is-grabbing'); drag = true; }
      if ((ev.type === 'pointermove' || ev.type === 'pointerdown') && drag) {
        if (T.replay) { const h = vp.ray.ray.intersectPlane(planeEye, tmp); if (h) { T.eyeU = clamp(h.x / S, -U_DRAW, U_DRAW); pose(); report(); } }
        else { const h = vp.ray.ray.intersectPlane(planeObj, tmp); if (h) { T.uo = clamp(h.x / S, -18, 18); T.zo = Math.round(clamp(-h.z / S, 20, 110)); dZ.set(T.zo); expose(); pose(); report(); } }
      }
      if (ev.type === 'pointerup' || ev.type === 'pointercancel') { drag = null; el.classList.remove('is-grabbing'); }
    },
  });
}
