/* lab/sky.js: bench 04, BUILD A SKY.
 *
 * You stand under a dome. Every pixel of it is lit by single scattering of
 * sunlight along the line of sight, with the scattering cross-section
 * proportional to 1 / lambda^4 for molecules (Rayleigh) and flat for big
 * droplets and dust (Mie), blended by the particle-size dial. Optical depth
 * at the zenith is 0.27 at 460 nm for one Earth atmosphere, and the air mass
 * grows from 1 overhead to about 38 at the horizon, so the sunset is the
 * same law as the noon sky with a longer path. Thicken the air to five
 * atmospheres, pump it out to none, or load it with Martian dust: the dome
 * recomputes.
 *
 * Schematic: single scattering only, three wavelengths stand in for the
 * band, the sun is drawn three times its true size, and the aureole around
 * it is a simple forward lobe rather than a Mie phase function.
 */
import { ship } from '../ship/ship.js';
import { THREE, P, DEG, clamp, sm, octave, dial, chips, readouts, voice, fmtDeg, benchFloor } from './bench.js';

export const question = {
  id: 'sky', title: 'Bench 04 · Build a sky',
  text: 'Why is the sky blue at noon but red at the horizon at sunset?',
  choices: ['Air is faintly blue', 'Blue light scatters far more than red', 'The sun actually reddens', 'Reflection from the oceans'], answer: 1,
  reveal: 'Blue light scatters far more, in proportion to 1/λ⁴, so 460 nm blue scatters about 3.3× more than 620 nm red. Look away from the sun and scattered blue is what reaches you. At sunset the light crosses about 38× more air, the blue is scattered out en route, and only the red survives the trip. Same air, same law, both colours of sky.',
};

const K = 0.27, MAX_AM = 38, LAM = [620, 545, 460];
const airmass = e => 1 / Math.max(Math.sin(clamp(e, 0, 90) * DEG), 1 / MAX_AM);
const PRESETS = [
  { id: 'noon', name: 'Earth noon', el: 65, th: 1, mie: 0.02 },
  { id: 'sunset', name: 'Sunset', el: 2, th: 1, mie: 0.1 },
  { id: 'mars', name: 'Mars', el: 30, th: 0.3, mie: 0.85 },
  { id: 'white', name: 'White sky', el: 50, th: 1, mie: 1 },
  { id: 'space', name: 'Space', el: 40, th: 0, mie: 0 },
  { id: 'soup', name: 'Five atmospheres', el: 40, th: 5, mie: 0.15 },
];

const FRAG = `
precision highp float;
varying vec3 vDir; uniform vec3 uSun; uniform float uTh, uMie, uEl;
const float K = 0.27; const vec3 LAM = vec3(620., 545., 460.);
float airmass(float e){ return 1.0 / max(sin(max(e, 0.0)), 1.0 / 38.0); }
vec3 tau(float am){ vec3 ray = pow(vec3(460.) / LAM, vec3(4.)); vec3 s = ray + (1.0 - ray) * uMie; return K * uTh * am * s; }
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float velev = asin(clamp(d.y, -1.0, 1.0));
  float amV = airmass(velev), amS = airmass(uEl);
  float dust = uMie * clamp(1.0 - uTh / 0.55, 0.0, 1.0);
  vec3 tint = vec3(1.0, 1.0 - 0.28 * dust, 1.0 - 0.52 * dust);
  vec3 tV = tau(amV), tS = tau(amS);
  vec3 scat = (1.0 - exp(-tV)) * exp(-0.5 * tS) * tint;
  vec3 col = pow(1.0 - exp(-4.0 * scat), vec3(0.8));
  // the sun, as what survived its path
  vec3 T = exp(-tS); float m = max(max(T.r, T.g), max(T.b, 1e-9));
  vec3 sunrgb = T / m * pow(m, 0.18);
  float a = acos(clamp(dot(d, uSun), -1.0, 1.0));
  float aur = exp(-a / (0.05 + 0.4 * uMie)) * (0.25 + 0.75 * uMie) * smoothstep(0.0, 0.3, uTh) * (1.0 - exp(-2.0 * (tV.g + 0.02)));
  col += sunrgb * aur * 0.75;
  float disc = 1.0 - smoothstep(0.013, 0.018, a);
  vec3 core = sunrgb + (1.0 - sunrgb) * 0.55 * pow(m, 0.18);
  col = mix(col, core, disc * step(0.0, uEl));
  // stars, once the air is pumped out
  if (uTh < 0.15) {
    vec3 g = floor(d * 90.0); float h = hash(g), h2 = hash(g + 7.1);
    vec3 c = fract(d * 90.0) - 0.5; float r = length(c);
    float st = step(0.985, h) * smoothstep(0.22, 0.0, r) * (0.3 + 0.7 * h2) * (0.15 - uTh) / 0.15;
    col += vec3(0.87, 0.93, 1.0) * st;
  }
  gl_FragColor = vec4(col, 1.0); }`;
const VERT = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

export function mount({ el, hud, ctrl, out, solved }) {
  const T = { el: 50, th: 1, mie: 1, az: 0.4 };          // start with a white atmosphere
  const strip = octave(hud), say = voice(out);
  let done = false;
  const sFactor = nm => { const ray = Math.pow(460 / nm, 4); return ray + (1 - ray) * T.mie; };
  const tau = (nm, am) => K * T.th * am * sFactor(nm);
  const trans = (nm, am) => Math.exp(-tau(nm, am));

  const mat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uTh: { value: 1 }, uMie: { value: 1 }, uEl: { value: 0.9 } }, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), mat); dome.renderOrder = -1;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshBasicMaterial({ color: 0x0a0e12 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
  let camera; const look = { yaw: 0.4, pitch: 14 * DEG }, dl = { yaw: 0.4, pitch: 14 * DEG };
  const sunV = new THREE.Vector3();
  function pose() {
    const e = T.el * DEG; sunV.set(Math.cos(e) * Math.sin(T.az), Math.sin(e), Math.cos(e) * Math.cos(T.az));
    mat.uniforms.uSun.value.copy(sunV); mat.uniforms.uTh.value = T.th; mat.uniforms.uMie.value = T.mie; mat.uniforms.uEl.value = e;
  }

  /* ---- readouts ---- */
  const R = readouts(out, [
    { id: 'am', k: 'air mass at the sun', d: 'how many zenith atmospheres the sunlight crosses' },
    { id: 'tau', k: 'optical depth, blue and red', d: 'τ at 460 nm and 620 nm along that path; T = e<sup>−τ</sup>' },
    { id: 'sun', k: 'the sun, as it arrives', d: 'transmission per channel, normalised to the strongest' },
  ]);
  function report() {
    const am = airmass(T.el), tb = tau(460, am), tr = tau(620, am);
    R.set('am', (am * T.th).toFixed(2) + '<span class="u">atm</span>', `air mass ${am.toFixed(1)} × ${T.th.toFixed(2)} Earth atmospheres; blue scatters ${Math.pow(620 / 460, 4).toFixed(2)}× more than red by 1/λ⁴, ${T.mie > 0.02 ? 'softened toward flat by the particle size' : 'pure Rayleigh'}`);
    R.set('tau', `${tb.toFixed(2)} <span class="u">blue</span> &nbsp; ${tr.toFixed(2)} <span class="u">red</span>`, `transmitted: ${(100 * Math.exp(-tb)).toPrecision(2)}% of the blue, ${(100 * Math.exp(-tr)).toPrecision(2)}% of the red`);
    const Tc = LAM.map(nm => trans(nm, am)), m = Math.max(...Tc, 1e-9), rgb = Tc.map(t => Math.round(255 * clamp(t / m * Math.pow(m, 0.18), 0, 1)));
    R.set('sun', `<span class="swatch" style="background:rgb(${rgb.join(',')})"></span> rgb ${rgb.join(' ')}`);
    strip.light(nm => { const tmax = Math.max(trans(750, am), 1e-6); return trans(nm, am) / tmax; });
    let t;
    if (T.th < 0.05) t = 'Space: no air, so nothing to scatter. A black sky, and a white sun you could see the stars beside.';
    else if (T.th > 2.5) t = `${T.th.toFixed(1)} atmospheres: even overhead the sun arrives ${(100 * Math.exp(-tau(460, airmass(90)))).toFixed(0)}% in the blue and goes orange at noon. Thick air is a permanent sunset.`;
    else if (T.mie > 0.6 && T.th < 0.45) t = 'Mars-ish: thin air, big iron-oxide dust. The dust absorbs blue, so the daytime sky goes butterscotch and, around a low sun, blue: the opposite of home.';
    else if (T.mie > 0.7) t = 'A white sky: droplets far bigger than a wavelength scatter every colour alike, and the blue is gone. This is an overcast day, or fog.';
    else if (T.el < 15 && T.mie < 0.35 && T.th > 0.7 && T.th < 1.4) { t = `A proper sunset. Across ${(airmass(T.el) * T.th).toFixed(0)} atmospheres the blue is scattered out en route and the red survives: the same law that made the noon sky blue.`; if (!done) { done = true; solved(); } }
    else if (T.el > 60 && T.mie < 0.25 && T.th > 0.85 && T.th < 1.15) t = 'Earth at noon. Look away from the sun and what reaches you is the scattered light, mostly blue, by the fourth power of frequency.';
    else t = `Light is crossing ${(am * T.th).toFixed(1)} atmospheres to reach you from the sun.`;
    say(t);
  }

  /* ---- controls ---- */
  const presets = chips(ctrl, PRESETS.map(p => ({ id: p.id, name: p.name, on: p.id === 'white' })), { onPick: it => { T.el = it.el; T.th = it.th; T.mie = it.mie; dE.set(T.el); dT.set(T.th); dM.set(T.mie); pose(); report(); } });
  const dials = document.createElement('div'); dials.className = 'dials'; ctrl.appendChild(dials);
  const touched = () => presets.mark('');
  const dE = dial(dials, { label: 'sun elevation (or drag the sky)', min: 0, max: 90, step: 0.5, value: T.el, fmt: v => v.toFixed(1) + '°', onInput: v => { T.el = v; touched(); pose(); report(); } });
  const dT = dial(dials, { label: 'atmosphere', min: 0, max: 5, step: 0.01, value: T.th, fmt: v => v < 0.05 ? 'vacuum' : v.toFixed(2) + ' × Earth', onInput: v => { T.th = v; touched(); pose(); report(); } });
  const dM = dial(dials, { label: 'particle size', min: 0, max: 1, step: 0.01, value: T.mie, fmt: v => v < 0.25 ? 'molecules' : v < 0.6 ? 'haze' : 'droplets and dust', onInput: v => { T.mie = v; touched(); pose(); report(); } });

  let drag = null;
  ship.viewport(el, {
    fov: 70, dim: false,
    setup(vp) {
      camera = vp.camera; camera.far = 200; camera.updateProjectionMatrix(); camera.position.set(0, 1.7, 0);
      vp.scene.add(dome, ground, benchFloor(40, 20, 0x1a2a3c));
      pose(); report();
    },
    frame(vp) {
      const k = 1 - Math.exp(-vp.dt * 7);
      dl.yaw += (look.yaw - dl.yaw) * k; dl.pitch += (look.pitch - dl.pitch) * k;
      camera.position.set(0, 1.7, 0); dome.position.copy(camera.position);
      camera.lookAt(Math.sin(dl.yaw) * Math.cos(dl.pitch), 1.7 + Math.sin(dl.pitch), Math.cos(dl.yaw) * Math.cos(dl.pitch));
    },
    pointer(ev, vp) {
      if (ev.type === 'pointerdown') { el.setPointerCapture(ev.pointerId); el.classList.add('is-grabbing'); drag = { x: ev.clientX, y: ev.clientY, el: T.el, az: T.az, yaw: look.yaw, pitch: look.pitch }; }
      else if (ev.type === 'pointermove' && drag) {
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (ev.shiftKey) { look.yaw = drag.yaw - dx * 0.005; look.pitch = clamp(drag.pitch + dy * 0.005, -0.2, 1.4); }
        else { T.el = clamp(drag.el + dy * 0.15, 0, 90); T.az = drag.az - dx * 0.006; dE.set(T.el.toFixed(1)); touched(); pose(); report(); }
      } else if (ev.type === 'pointerup' || ev.type === 'pointercancel') { drag = null; el.classList.remove('is-grabbing'); }
    },
  });
}
