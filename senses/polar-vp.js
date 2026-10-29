/* senses/polar-vp.js: the polarization wing's instrument. The sky as a
 * dome seen from outside, a sun you drag across it, a field of short bars
 * on the dome (length by degree of polarization, tilt by e-vector), the
 * great ring 90 degrees from the sun, a bee's false-colour view, and a
 * hand-held polarizer you slide over the sky to watch Malus' law.
 * The physics is in polar.js (pure, node-testable).
 */

import { ship, THREE, label, glowSprite } from '../ship/ship.js';
import * as S from './polar.js';

export function mountPolar(ids) {
  const el = document.getElementById(ids.vp);
  const ro = id => { const r = document.getElementById(id); return { k: r.querySelector('.k'), v: r.querySelector('.v'), d: r.querySelector('.d') }; };
  const rd = { sun: ro(ids.rdSun), zen: ro(ids.rdZen), tx: ro(ids.rdTx), ev: ro(ids.rdEv) };
  const picked = document.getElementById(ids.picked), text = document.getElementById(ids.text);
  const btnPat = document.getElementById(ids.pattern), btnYou = document.getElementById(ids.you), btnBee = document.getElementById(ids.bee), btnMoon = document.getElementById(ids.moon);
  const disc = document.getElementById(ids.disc), axisIn = document.getElementById(ids.axis), axisV = document.getElementById(ids.axisV);
  const elevIn = document.getElementById(ids.elev), elevV = document.getElementById(ids.elevV);
  const chips = [...document.querySelectorAll('#' + ids.chips + ' .chip')];
  const sunLabel = document.getElementById(ids.sunLabel);

  const st = {
    sun: S.sunAt(32 * Math.PI / 180, 1.55), view: 'pattern', moon: false, creature: 'bee',
    filter: 0,                              // filter axis, radians from the screen's horizontal, counter-clockwise
    disc: { x: 0.40, y: 0.40 },             // the polarizer's centre as a fraction of the box
    cam: { az: 0.2, azGoal: 0.2, el: 0.62 },
    sunDirty: true,
  };

  let W = null;
  const px = () => (el.getBoundingClientRect().width < 640 ? 8 : 12);   // the runtime bumps labels half again on a phone
  const N = 720;
  const pts = S.domePoints(N);

  const vp = ship.viewport(el, {
    fov: 38,
    setup({ scene }) {
      // the ground, and the horizon
      const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshBasicMaterial({ color: 0x05080f }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; scene.add(ground);
      const hz = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; hz.push(Math.cos(a), 0.001, Math.sin(a)); }
      const hzg = new THREE.BufferGeometry(); hzg.setAttribute('position', new THREE.Float32BufferAttribute(hz, 3));
      scene.add(new THREE.Line(hzg, new THREE.LineBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0.35 })));

      // the dome: every pixel computes its own degree and e-vector
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: { uSun: { value: new THREE.Vector3() }, uBee: { value: 0 }, uMoon: { value: 0 } },
        vertexShader: `varying vec3 vN; void main(){ vN = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 uSun; uniform float uBee, uMoon; varying vec3 vN;
          const float PI = 3.14159265;
          vec3 hsv(float h, float s, float v){ vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0); vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0); return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s); }
          void main(){
            vec3 n = normalize(vN);
            float c = clamp(dot(n, uSun), -1.0, 1.0);
            float d = (1.0 - c * c) / (1.0 + c * c);                       // Rayleigh degree, single scattering
            vec3 e = cross(uSun, n); float el = length(e); e = el > 1e-6 ? e / el : vec3(0.0);
            vec3 m = normalize(vec3(0.0, 1.0, 0.0) - n * n.y); vec3 east = cross(n, m);
            float ang = atan(dot(e, east), dot(e, m)); if (ang < 0.0) ang += PI;   // e-vector from the local meridian, 0..pi
            // what you see: a blue sky, paler at the horizon, an aureole round the sun, no pattern at all
            vec3 zen = vec3(0.13, 0.33, 0.80), hor = vec3(0.60, 0.74, 0.92);
            vec3 sky = mix(hor, zen, pow(max(n.y, 0.0), 0.55));
            float aure = exp(-pow(acos(c) / 0.30, 2.0));
            sky += vec3(1.0, 0.96, 0.86) * aure * 0.7;
            vec3 night = mix(vec3(0.03, 0.05, 0.10), vec3(0.10, 0.13, 0.22), pow(max(n.y, 0.0), 0.5)) + vec3(0.6, 0.65, 0.8) * aure * 0.5;
            sky = mix(sky, night, uMoon);
            // what the bee sees: a convention, hue for e-vector angle, saturation and brightness for degree
            vec3 bee = hsv(ang / PI, pow(d, 0.7), 0.22 + 0.78 * d);
            bee = mix(bee, bee * 0.45, uMoon);
            gl_FragColor = vec4(mix(sky, bee, uBee), 1.0);
          }`,
      }));
      scene.add(dome);

      // the bars: one segment per patch of sky, rebuilt when the sun moves
      const bg = new THREE.BufferGeometry();
      const bpos = new Float32Array(N * 6), balpha = new Float32Array(N * 2);
      bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
      bg.setAttribute('a', new THREE.BufferAttribute(balpha, 1));
      const bars = new THREE.LineSegments(bg, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uC: { value: new THREE.Color(0.95, 0.98, 1.0) } },
        vertexShader: `attribute float a; varying float vA; void main(){ vA = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 uC; varying float vA; void main(){ gl_FragColor = vec4(uC, vA); }`,
      }));
      bars.frustumCulled = false; scene.add(bars);

      // the ring, 90 degrees from the sun, the part above the horizon
      // a thin torus whose axis is the sun; the ground hides the half below the horizon
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.012, 0.006, 6, 160), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      scene.add(ring);
      const ringTag = label('90° from the sun', { size: 18, pad: 3, color: '#f0e6ff' }); ringTag.userData.px = px(); scene.add(ringTag);

      // the sun (or the moon)
      const sunGlow = glowSprite(0xfff3d0, 0.5, 1); scene.add(sunGlow);
      const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff8e8 })); scene.add(sunDot);

      const zenTag = label('zenith', { size: 18, pad: 3, color: '#cfe0ff' }); zenTag.userData.px = px() - 1; zenTag.position.set(0, 1.06, 0); scene.add(zenTag);

      W = { dome, bars, bpos, balpha, ring, ringTag, sunGlow, sunDot };
      applyView();
    },
    frame({ camera, dt }) {
      if (!W) return;
      const k = ship.motion ? 1 - Math.exp(-dt * 5) : 1;
      const cm = st.cam; cm.az += (cm.azGoal - cm.az) * k;
      const d = Math.max(3.0, Math.min(6, 1.2 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect) + 0.4));
      camera.position.set(Math.sin(cm.az) * Math.cos(cm.el) * d, Math.sin(cm.el) * d, Math.cos(cm.az) * Math.cos(cm.el) * d);
      camera.lookAt(0, 0.18, 0);
      if (st.sunDirty) { st.sunDirty = false; layoutSun(); }
      // the sun's label lives in the DOM so it reads over the glare and over the dark alike
      _v.set(st.sun[0] * 1.02, st.sun[1] * 1.02, st.sun[2] * 1.02);
      const facing = _v.dot(camera.position) > 0.15;
      _v.project(camera);
      sunLabel.style.left = Math.max(16, Math.min(84, (_v.x + 1) / 2 * 100)) + '%'; sunLabel.style.top = ((1 - _v.y) / 2 * 100 - 7) + '%';
      sunLabel.style.opacity = facing ? 1 : 0;
      sunLabel.textContent = (st.moon ? 'moon' : 'sun') + (vp.size.w < 640 ? '' : ' · drag me');
      readFilter(camera);
    },
    pointer(ev, vp) {
      const el = vp.el;
      if (ev.type === 'pointerdown') {
        if (ev.target.closest('button, input, .polarizer')) return;
        const hit = domeHit(vp.ray.ray);
        const onSun = hit && Math.acos(Math.max(-1, Math.min(1, hit[0] * st.sun[0] + hit[1] * st.sun[1] + hit[2] * st.sun[2]))) < 0.3;
        el.__drag = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false, what: onSun ? 'sun' : 'orbit', az: st.cam.azGoal };
        return;
      }
      const d = el.__drag; if (!d) return;
      if (ev.type === 'pointermove') {
        if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 4) { d.moved = true; el.classList.add('is-grabbing'); el.setPointerCapture && el.setPointerCapture(d.id); }
        if (!d.moved) return;
        if (d.what === 'orbit') { st.cam.azGoal = d.az + (ev.clientX - d.x) * 0.008; return; }
        const hit = domeHit(vp.ray.ray); if (!hit) return;
        setSun(hit);
        return;
      }
      el.classList.remove('is-grabbing'); el.__drag = null;
    },
  });

  /* ---- geometry helpers ---- */
  function domeHit(ray) {
    // the nearest point where the ray meets the unit sphere, if it is above the horizon
    const o = ray.origin, dr = ray.direction;
    const b = o.dot(dr), c = o.lengthSq() - 1, disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc); if (t < 0) return null;
    const p = [o.x + dr.x * t, o.y + dr.y * t, o.z + dr.z * t];
    return p[1] > 0 ? S.norm(p) : null;
  }
  function setSun(v) {
    const el = Math.max(2 * Math.PI / 180, S.elevationOf(v));
    const az = Math.atan2(v[0], v[2]);
    st.sun = S.sunAt(el, az); st.sunDirty = true;
    elevIn.value = Math.round(el * 180 / Math.PI); elevV.textContent = Math.round(el * 180 / Math.PI) + '°';
    sunReadouts();
  }
  function layoutSun() {
    const sun = st.sun;
    W.dome.material.uniforms.uSun.value.set(sun[0], sun[1], sun[2]);
    W.sunGlow.position.set(sun[0] * 1.02, sun[1] * 1.02, sun[2] * 1.02);
    W.sunDot.position.copy(W.sunGlow.position);
    // the bars
    for (let i = 0; i < N; i++) {
      const P = pts[i], c = P[0] * sun[0] + P[1] * sun[1] + P[2] * sun[2];
      const d = S.degree(c), e = S.evector(sun, P), h = 0.006 + 0.034 * d, r = 1.006;
      bpos(i * 6, P[0] * r + e[0] * h, P[1] * r + e[1] * h, P[2] * r + e[2] * h);
      bpos(i * 6 + 3, P[0] * r - e[0] * h, P[1] * r - e[1] * h, P[2] * r - e[2] * h);
      W.balpha[i * 2] = W.balpha[i * 2 + 1] = 0.12 + 0.78 * d;
    }
    W.bars.geometry.attributes.position.needsUpdate = true; W.bars.geometry.attributes.a.needsUpdate = true;
    // the ring: the great circle perpendicular to the sun, drawn where it is above the horizon
    const u = S.norm([-sun[2], 0, sun[0]]);                 // horizontal, perpendicular to the sun
    let w = [sun[1] * u[2] - sun[2] * u[1], sun[2] * u[0] - sun[0] * u[2], sun[0] * u[1] - sun[1] * u[0]];   // sun x u, perpendicular to both
    if (w[1] < 0) w = [-w[0], -w[1], -w[2]];                 // the half that rises
    W.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(sun[0], sun[1], sun[2]));
    const top = [w[0] * 1.01, w[1] * 1.01, w[2] * 1.01];   // the ring's highest point
    W.ringTag.position.set(top[0], top[1] + 0.07, top[2]);
    sunReadouts();
  }
  /* the readouts that depend on the sun alone, from the state, so they are
     right before a frame is drawn and without WebGL */
  function sunReadouts() {
    const sun = st.sun, elv = S.elevationOf(sun), zd = S.degree(sun[1]);
    rd.sun.v.textContent = Math.round(elv * 180 / Math.PI) + '°';
    rd.zen.v.textContent = Math.round(zd * 100) + '%';
    rd.zen.d.innerHTML = `sin²θ / (1 + cos²θ) with θ = ${Math.round(90 - elv * 180 / Math.PI)}°, the sun’s angle from the zenith: the single-scattering ideal. The real sky peaks near 75 to 80% (Coulson 1988).`;
    elevIn.setAttribute('aria-valuetext', Math.round(elv * 180 / Math.PI) + ' degrees above the horizon; ' + Math.round(zd * 100) + ' percent polarized at the zenith');
  }
  function bpos(i, x, y, z) { W.bpos[i] = x; W.bpos[i + 1] = y; W.bpos[i + 2] = z; }

  /* ---- the hand-held polarizer ---- */
  const _v = new THREE.Vector3(), _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
  let lastTx = null;
  function readFilter(camera) {
    disc.style.left = (st.disc.x * 100) + '%'; disc.style.top = (st.disc.y * 100) + '%';
    disc.style.setProperty('--axis', (-st.filter * 180 / Math.PI) + 'deg');      // CSS turns clockwise
    _ndc.set(st.disc.x * 2 - 1, -(st.disc.y * 2 - 1));
    _ray.setFromCamera(_ndc, camera);
    const P = domeHit(_ray.ray);
    if (!P) {
      disc.style.setProperty('--tx', 0.15); disc.classList.add('is-off');
      if (lastTx !== 'off') { lastTx = 'off'; rd.tx.v.textContent = '. . .'; rd.tx.d.textContent = 'slide the filter onto the sky'; rd.ev.v.textContent = '. . .'; rd.ev.d.textContent = 'the filter is off the dome'; }
      return;
    }
    disc.classList.remove('is-off');
    const sun = st.sun, c = P[0] * sun[0] + P[1] * sun[1] + P[2] * sun[2];
    const d = S.degree(c), e = S.evector(sun, P);
    // the e-vector's angle on the screen: project the patch and a step along e
    _v.set(P[0], P[1], P[2]).project(camera); const x0 = _v.x * vp.size.w, y0 = _v.y * vp.size.h;
    _v.set(P[0] + e[0] * 0.02, P[1] + e[1] * 0.02, P[2] + e[2] * 0.02).project(camera);
    let phiE = Math.atan2(_v.y * vp.size.h - y0, _v.x * vp.size.w - x0); if (phiE < 0) phiE += Math.PI;
    const tx = S.malus(d, st.filter, phiE);
    disc.style.setProperty('--tx', tx.toFixed(3));
    const key = Math.round(tx * 100) + '|' + Math.round(d * 100) + '|' + Math.round(phiE * 180 / Math.PI);
    if (key !== lastTx) {
      lastTx = key;
      let diff = Math.abs(st.filter - phiE) * 180 / Math.PI % 180; if (diff > 90) diff = 180 - diff;
      rd.tx.v.textContent = Math.round(tx * 100) + '%';
      rd.tx.d.innerHTML = `of the light passes the filter here: the polarized ${Math.round(d * 100)}% as cos² of the ${Math.round(diff)}° between filter axis and e-vector (Malus), half of the unpolarized rest`;
      rd.ev.v.textContent = Math.round(d * 100) + '% · ' + Math.round(phiE * 180 / Math.PI) + '°';
      rd.ev.d.textContent = 'degree of polarization under the filter, and the e-vector’s tilt from horizontal on your screen; the bars draw both';
      axisIn.setAttribute('aria-valuetext', Math.round(st.filter * 180 / Math.PI) + ' degrees; ' + Math.round(tx * 100) + ' percent of the light passes');
    }
  }
  disc.addEventListener('pointerdown', ev => {
    ev.stopPropagation(); disc.setPointerCapture(ev.pointerId);
    disc.__drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, dx: st.disc.x, dy: st.disc.y };
  });
  disc.addEventListener('pointermove', ev => {
    const d = disc.__drag; if (!d || d.id !== ev.pointerId) return;
    ev.stopPropagation();
    const r = el.getBoundingClientRect();
    st.disc.x = Math.max(0.06, Math.min(0.94, d.dx + (ev.clientX - d.x) / r.width));
    st.disc.y = Math.max(0.08, Math.min(0.92, d.dy + (ev.clientY - d.y) / r.height));
  });
  for (const t of ['pointerup', 'pointercancel']) disc.addEventListener(t, ev => { ev.stopPropagation(); disc.__drag = null; });
  // the filter also walks with the arrow keys, for a keyboard
  disc.addEventListener('keydown', ev => {
    const step = 0.03; let used = true;
    if (ev.key === 'ArrowLeft') st.disc.x -= step; else if (ev.key === 'ArrowRight') st.disc.x += step;
    else if (ev.key === 'ArrowUp') st.disc.y -= step; else if (ev.key === 'ArrowDown') st.disc.y += step; else used = false;
    if (used) { ev.preventDefault(); st.disc.x = Math.max(0.06, Math.min(0.94, st.disc.x)); st.disc.y = Math.max(0.08, Math.min(0.92, st.disc.y)); }
  });
  axisIn.addEventListener('input', () => { st.filter = +axisIn.value * Math.PI / 180; axisV.textContent = axisIn.value + '°'; });
  elevIn.addEventListener('input', () => { const az = Math.atan2(st.sun[0], st.sun[2]); st.sun = S.sunAt(+elevIn.value * Math.PI / 180, az); st.sunDirty = true; elevV.textContent = elevIn.value + '°'; sunReadouts(); });

  /* ---- views and creatures ---- */
  function applyView() {
    const bee = st.view === 'bee', you = st.view === 'you';
    btnPat.setAttribute('aria-pressed', String(st.view === 'pattern')); btnYou.setAttribute('aria-pressed', String(you)); btnBee.setAttribute('aria-pressed', String(bee)); btnMoon.setAttribute('aria-pressed', String(st.moon));
    if (W) {
      W.dome.material.uniforms.uBee.value = bee ? 1 : 0; W.dome.material.uniforms.uMoon.value = st.moon ? 1 : 0;
      // your eye has no polarization channel: the bars and the ring go, the filter stays
      W.bars.visible = !you; W.ring.visible = !you; W.ringTag.visible = !you;
      W.sunGlow.material.color.set(st.moon ? 0xdfe8ff : 0xfff3d0); W.sunGlow.scale.setScalar(st.moon ? 0.3 : 0.5);
      W.sunDot.material.color.set(st.moon ? 0xf4f6ff : 0xfff8e8);
      W.bars.material.uniforms.uC.value.set(bee ? 0x111111 : 0xf2f8ff);
    }
    const c = CREATURES[st.creature];
    picked.innerHTML = c.name + '<small>' + (bee ? 'false colour by e-vector' : you ? 'your eye: no pattern' : 'the pattern, as bars') + (st.moon ? ' · moonlit' : ' · sunlit') + '</small>';
  }
  btnPat.addEventListener('click', () => { st.view = 'pattern'; applyView(); });
  btnYou.addEventListener('click', () => { st.view = 'you'; applyView(); });
  btnBee.addEventListener('click', () => { st.view = 'bee'; applyView(); });
  btnMoon.addEventListener('click', () => { st.moon = !st.moon; applyView(); });
  chips.forEach(b => b.addEventListener('click', () => {
    st.creature = b.dataset.creature;
    chips.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const c = CREATURES[st.creature];
    if (c.view) st.view = c.view;
    if (c.moon !== undefined) st.moon = c.moon;
    text.innerHTML = c.text; applyView();
  }));
  text.innerHTML = CREATURES[st.creature].text;
  chips.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.creature === st.creature)));
  applyView();
  // the sun-only readouts work from the DOM alone when there is no WebGL
  rd.sun.d.textContent = 'the ring of strongest polarization is 90° from the sun: through the zenith at sunrise and sunset, flat along the horizon when the sun is overhead';
  sunReadouts();
  if (document.body.classList.contains('no-webgl')) {
    rd.tx.v.textContent = Math.round(S.malus(0.8, 0, Math.PI / 2) * 100) + '%';
    rd.tx.d.textContent = 'passes a filter crossed with an 80% polarized patch: Malus’ law on the polarized part, half of the rest';
  }
  return { st };
}

const CREATURES = {
  cuttlefish: { name: 'Cuttlefish', view: 'you', text: 'Colour-blind, and yet it tells polarization angles apart to about <b>1°</b> (Temple et al. 2012), the finest polarization vision measured in any animal. Transparent prey that vanish in plain light stand out in polarization contrast, and the skin can flash polarized patterns most of the reef cannot see. Rotate the filter and watch the sky change brightness: that difference is the channel.' },
  beetle: { name: 'Dung beetle', view: 'pattern', moon: true, text: 'Rolls its ball in a straight line away from the pile by reading the sky’s polarization ring through a strip along the top of each eye. The first animal shown to steer by <b>polarized moonlight</b> (Dacke et al. 2003), a sky a few hundred thousand to a million times fainter than the day’s (a full moon lights the ground at about 0.1 to 0.3 lux, the sun at up to 100,000); on moonless nights it steers by the Milky Way (Dacke et al. 2013).' },
  bee: { name: 'Honeybee & desert ant', view: 'bee', moon: false, text: 'Karl von Frisch showed in 1949 that bees steer by the sky’s polarization when the sun is hidden; a patch of blue sky is enough. The compass is the <b>dorsal rim area</b>, a strip of facets along the top of each eye whose receptors answer to e-vector angle. <i>Cataglyphis</i> desert ants run the same compass hundreds of metres out over bare sand and straight back to a centimetre-wide nest hole (Wehner 2003).' },
  mantis: { name: 'Mantis shrimp', view: 'bee', text: 'Reads linear polarization like the cuttlefish, and then goes one further: the only animal known to detect <b>circular</b> polarization, light whose field corkscrews as it travels (Chiou et al. 2008), a channel it uses for private signalling. The ship draws linear polarization only; skylight has next to no circular component to show.' },
};
