/* lab/film.js: bench 05, SOAP FILM.
 *
 * A film of soapy water in a wire wand, a few hundred nanometres thick,
 * draining under gravity. Two reflections, one from the front face and one
 * from the back, differ in path by 2 n t cos(theta_t), and the front one
 * flips phase, so for each wavelength the pair add as sin^2(2 pi n t
 * cos(theta_t) / lambda). The shader sums that over twenty wavelengths per
 * pixel, weighted by each wavelength's colour, and Newton's sequence falls
 * out: black, silver, straw, magenta, blue, green, then paler and paler as
 * the orders crowd. On the ship the viewing angle is not a slider: tilt the
 * wand and every pixel takes its own angle from the camera.
 *
 * Schematic: the thickness field is a sculpted wedge with a swirl, not a
 * fluid simulation; reflectance uses the two-beam approximation with a
 * Fresnel amplitude (n - 1)^2 / (n + 1)^2 relative to water.
 */
import { ship } from '../ship/ship.js';
import { fitFov, THREE, P, TAU, DEG, clamp, sm, GLSL_WL, rgb01, octave, dial, chips, readouts, voice, benchFloor, tag } from './bench.js';

export const question = {
  id: 'film', title: 'Bench 05 · Soap film',
  text: 'A soap bubble has no pigment. Where do its swirling colours come from?',
  choices: ['Oil in the soap, floating on the water', 'Two reflections, front and back of the film, in and out of step', 'The film splits light like a tiny prism', 'The colours of the room, reflected'], answer: 1,
  reveal: 'Two reflections, one from the front of the film and one from the back, a few hundred nanometres apart. For some wavelengths the extra trip puts the second reflection in step with the first and that colour shows; for others it lands out of step and cancels. The film is only a few wavelengths thick, so its colours are its thickness made visible. As it drains and thins past about 30 nm, every colour cancels at once and the film goes black, moments before it pops.',
};

/* the thickness field in nm, shared by the shader and the probe, u,v in -1..1 */
const THICK_GLSL = `
float sm1(float x){ x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float thickness(float u, float v, float t){
  float top = 520.0 * exp(-t / 9.0), bot = 1150.0 * exp(-t / 45.0) + 240.0;
  float s = (v + 1.0) / 2.0;
  float base = top + (bot - top) * pow(s, 1.7);
  float rr = sqrt(u * u + v * v), an = atan(v, u);
  float sw = sin(3.1 * u + t * 0.35 + sin(2.2 * v - t * 0.27)) * sin(2.6 * v - t * 0.22 + cos(3.4 * u + t * 0.19)) * 0.5
           + sin(6.5 * u - 5.1 * v + t * 0.5) * 0.18 + sin(3.0 * an + 4.0 * rr - t * 0.45) * 0.35 * rr * (1.0 - rr);
  float th = base * (1.0 + 0.22 * sw);
  float front = sm1((t - 10.0) / 14.0) * 0.55;
  float blk = 1.0 - sm1((s - front + 0.06 + 0.05 * sw) / 0.08);
  return max(0.0, th * (1.0 - 0.985 * blk) + 12.0 * blk); }`;
function thicknessJS(u, v, t) {
  const top = 520 * Math.exp(-t / 9), bot = 1150 * Math.exp(-t / 45) + 240, s = (v + 1) / 2, base = top + (bot - top) * Math.pow(s, 1.7);
  const rr = Math.sqrt(u * u + v * v), an = Math.atan2(v, u);
  const sw = Math.sin(3.1 * u + t * 0.35 + Math.sin(2.2 * v - t * 0.27)) * Math.sin(2.6 * v - t * 0.22 + Math.cos(3.4 * u + t * 0.19)) * 0.5 + Math.sin(6.5 * u - 5.1 * v + t * 0.5) * 0.18 + Math.sin(3 * an + 4 * rr - t * 0.45) * 0.35 * rr * (1 - rr);
  const th = base * (1 + 0.22 * sw), front = sm((t - 10) / 14) * 0.55, blk = 1 - sm((s - front + 0.06 + 0.05 * sw) / 0.08);
  return Math.max(0, th * (1 - 0.985 * blk) + 12 * blk);
}
const FRAG = `
precision highp float;
varying vec2 vUv; varying vec3 vN, vW; uniform float uT, uN, uMul, uAlive; uniform vec3 uCam, uWsum;
${GLSL_WL}
${THICK_GLSL}
void main(){
  float u = vUv.x * 2.0 - 1.0, v = 1.0 - vUv.y * 2.0;
  if (u * u + v * v > 1.0) discard;
  vec3 V = normalize(uCam - vW); float cosI = abs(dot(normalize(vN), V));
  float sinT = sqrt(max(0.0, 1.0 - cosI * cosI)) / uN; float cosT = sqrt(max(0.0, 1.0 - sinT * sinT));
  float t = thickness(u, v, uT) * uMul;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 20; i++) {
    float nm = 380.0 + 370.0 * float(i) / 19.0;
    float s = sin(6.2831853 * uN * t * cosT / nm);
    acc += s * s * wl2rgb(nm); }
  acc /= uWsum;
  float mean = (acc.r + acc.g + acc.b) / 3.0;
  acc = clamp(mean + (acc - mean) * 1.6, 0.0, 1.0);
  float r = (uN - 1.0) / (uN + 1.0), rw = 0.33 / 2.33;
  float fres = clamp((r * r) / (rw * rw), 0.0, 3.0);
  float win = 0.5 + 0.5 * sm1((u + 1.0) / 0.55) * (1.0 - sm1((u + 0.05) / 0.5)) * sm1((v + 1.0) / 0.5) * (1.0 - sm1((v + 0.1) / 0.5)) + 0.2 * exp(-((u - 0.45) * (u - 0.45) * 4.0 + (v - 0.5) * (v - 0.5) * 6.0));
  float rim = 1.0 - 0.3 * sm1((u * u + v * v - 0.8) / 0.2);
  gl_FragColor = vec4(acc * win * rim * fres * uAlive, uAlive); }`;
const VERT = 'varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';

export function mount({ el, hud, ctrl, out, solved }) {
  const T = { n: 1.33, mul: 1, held: false };
  const strip = octave(hud), say = voice(out);
  let tau = ship.motion ? 0 : 9, popped = 0, done = false, probe = null;
  const wsum = [0, 0, 0]; for (let i = 0; i < 20; i++) { const c = rgb01(380 + 370 * i / 19); wsum[0] += c[0]; wsum[1] += c[1]; wsum[2] += c[2]; }
  const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uN: { value: 1.33 }, uMul: { value: 1 }, uAlive: { value: 1 }, uCam: { value: new THREE.Vector3() }, uWsum: { value: new THREE.Vector3(...wsum) } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true });
  const R0 = 1.2;
  const film = new THREE.Mesh(new THREE.PlaneGeometry(2 * R0, 2 * R0, 1, 1), mat);
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.9, roughness: 0.35 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.03, 0.035, 10, 72), metal);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 10), metal); handle.position.set((R0 + 0.7) * 0.707, -(R0 + 0.7) * 0.707, 0); handle.rotation.z = Math.PI / 4;
  const wand = new THREE.Group(); wand.add(film, ring, handle);
  const pop = document.createElement('div'); pop.className = 'pop'; pop.textContent = 'pop.'; pop.hidden = true; hud.appendChild(pop);
  const cursor = document.createElement('div'); cursor.className = 'probe-dot'; cursor.hidden = true; hud.appendChild(cursor);
  let camera;

  /* ---- readouts ---- */
  const R = readouts(out, [
    { id: 'here', k: 'film under the pointer', d: 'move over the film to read it' },
    { id: 'on', k: 'in step, shows', d: '2 n t cos θ = (m + ½) λ' },
    { id: 'off', k: 'out of step, cancels', d: '2 n t cos θ = m λ' },
  ]);
  function describe(t, cosT) {
    if (t < 40) return [`${Math.round(t)}<span class="u">nm</span>`, 'thinner than any visible wave can survive', 'every colour cancels at once: the black film'];
    const path = 2 * T.n * t * cosT, on = [], off = [];
    for (let m = 0; m < 12; m++) { const lc = path / (m + 0.5); if (lc >= 380 && lc <= 750) on.push(Math.round(lc)); if (m >= 1) { const ld = path / m; if (ld >= 380 && ld <= 750) off.push(Math.round(ld)); } }
    const name = nm => nm < 450 ? 'violet' : nm < 495 ? 'blue' : nm < 570 ? 'green' : nm < 590 ? 'yellow' : nm < 620 ? 'orange' : 'red';
    return [`${Math.round(t)}<span class="u">nm</span> <span class="u">round trip ${Math.round(path)} nm</span>`, on.length ? on.map(n => `${n} nm ${name(n)}`).join(', ') : 'nothing in the visible band', off.length ? off.map(n => `${n} nm ${name(n)}`).join(', ') : 'nothing visible cancels'];
  }
  function reportProbe() {
    if (!probe || popped) { cursor.hidden = true; return; }
    const t = thicknessJS(probe.u, probe.v, tau) * T.mul, lines = describe(t, probe.cosT);
    R.set('here', lines[0], `view angle ${(Math.acos(probe.cosI) / DEG).toFixed(0)}° from the normal here, ${(Math.acos(probe.cosT) / DEG).toFixed(0)}° inside the film`);
    R.set('on', lines[1]); R.set('off', lines[2]);
    strip.light(nm => { const s = Math.sin(TAU * T.n * t * probe.cosT / nm); return 0.12 + 0.85 * s * s; });
    if (!done) { done = true; solved(); }
  }
  function reportState() {
    if (Math.abs(T.n - 1) < 0.01) say('Index 1.00: there is no interface. Nothing reflects from the front or the back, so there is nothing to interfere. The film is invisible.');
    else if (T.mul > 4) say(`${T.mul.toFixed(0)}× thicker: a few microns now, so dozens of wavelengths are in step at once and their colours add back to grey. Thick films are colourless; the colour was the thinness.`);
    else if (T.mul < 0.3) say('A film this thin is below the first order everywhere: every colour cancels and the whole film is black before it has drained at all.');
    else if (T.n > 1.9) say(`n ${T.n.toFixed(2)}: each face reflects ${(100 * Math.pow((T.n - 1) / (T.n + 1), 2)).toFixed(0)}% instead of water’s 2%, so the same thickness is far brighter, and the colours shift because the optical path is n times the thickness.`);
    else say(tau > 24 && !popped ? 'The crown has thinned past 30 nm and gone black: the front reflection flips phase and the back one does not, so a vanishing path leaves them exactly out of step. The film is about to pop.' : 'Drag to tilt the wand: every pixel takes its own viewing angle, and the colours slide toward blue as the path inside the film shortens by cos θ.');
  }

  /* ---- controls ---- */
  chips(ctrl, [{ id: 'new', name: 'blow a new film' }, { id: 'hold', name: 'hold the drain' }], { radio: false, onPick: (it, b) => {
    if (it.id === 'new') { tau = 0; popped = 0; mat.uniforms.uAlive.value = 1; pop.hidden = true; reportState(); }
    else { T.held = !T.held; b.setAttribute('aria-pressed', String(T.held)); b.textContent = T.held ? 'let it drain' : 'hold the drain'; }
  } });
  const dials = document.createElement('div'); dials.className = 'dials'; ctrl.appendChild(dials);
  dial(dials, { label: 'film index n', min: 1, max: 2.5, step: 0.01, value: 1.33, fmt: v => v.toFixed(2), onInput: v => { T.n = v; mat.uniforms.uN.value = v; reportProbe(); reportState(); } });
  dial(dials, { label: 'thickness, times', min: -1, max: 1, step: 0.01, value: 0, fmt: v => '×' + Math.pow(10, v).toFixed(2), onInput: v => { T.mul = Math.pow(10, v); mat.uniforms.uMul.value = T.mul; reportProbe(); reportState(); } });

  let drag = null; const tmp = new THREE.Vector3();
  ship.viewport(el, {
    fov: 36,
    resize(vp) { fitFov(vp, 36); },
    setup(vp) {
      camera = vp.camera; camera.position.set(0, 0.6, 5.2); camera.lookAt(0, 0, 0);
      const key = new THREE.DirectionalLight(0xfff2dc, 1.6); key.position.set(-3, 4, 3);
      vp.scene.add(wand, benchFloor(12, 12).translateY(-1.8), new THREE.AmbientLight(0x6f84a0, 0.9), key);
      reportState();
    },
    frame(vp) {
      if (!T.held && !popped && ship.motion) tau += vp.dt;
      if (!popped && tau > 34) { popped = vp.t || 1e-3; mat.uniforms.uAlive.value = 0; pop.hidden = false; strip.reset(); }
      if (popped && vp.t - popped > 2.2) { popped = 0; tau = 0; mat.uniforms.uAlive.value = 1; pop.hidden = true; }
      mat.uniforms.uT.value = tau; mat.uniforms.uCam.value.copy(camera.position);
      if (!drag && ship.motion) { wand.rotation.y += (Math.sin(vp.t * 0.23) * 0.35 - wand.rotation.y) * (1 - Math.exp(-vp.dt * 1.5)); }
      if (probe) reportProbe();
      if (ship.motion && Math.floor(tau) % 6 === 0 && !popped) reportState();
    },
    pointer(ev, vp) {
      if (ev.type === 'pointerdown') { el.setPointerCapture(ev.pointerId); el.classList.add('is-grabbing'); drag = { x: ev.clientX, y: ev.clientY, ry: wand.rotation.y, rx: wand.rotation.x, moved: false }; }
      if (ev.type === 'pointermove' && drag) { const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; wand.rotation.y = drag.ry + dx * 0.008; wand.rotation.x = clamp(drag.rx + dy * 0.008, -1.2, 1.2); }
      if (ev.type === 'pointerup' || ev.type === 'pointercancel') { drag = null; el.classList.remove('is-grabbing'); }
      if (ev.type === 'pointermove' || ev.type === 'pointerdown') {
        const hit = vp.ray.intersectObject(film, false)[0];
        if (hit) {
          const u = hit.uv.x * 2 - 1, v = 1 - hit.uv.y * 2;
          if (u * u + v * v <= 1) {
            tmp.copy(camera.position).sub(hit.point).normalize();
            const n = hit.face.normal.clone().transformDirection(film.matrixWorld), cosI = Math.abs(n.dot(tmp)), sinT = Math.sqrt(1 - cosI * cosI) / T.n;
            probe = { u, v, cosI, cosT: Math.sqrt(Math.max(0, 1 - sinT * sinT)) };
            const r = el.getBoundingClientRect(); cursor.hidden = false; cursor.style.left = (ev.clientX - r.left) + 'px'; cursor.style.top = (ev.clientY - r.top) + 'px';
            return;
          }
        }
        probe = null; cursor.hidden = true;
      }
    },
  });
}
