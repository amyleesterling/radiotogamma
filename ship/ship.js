/* ship/ship.js: the vessel's runtime.
 *
 * One WebGL canvas sits fixed behind the whole page (the hull). The space
 * outside, the starfield and the long beam of the spectrum, renders full
 * screen as ambient; every instrument on a deck is a DOM box with the class
 * .viewport, and the ship renders that instrument's own scene into the box's
 * rectangle with a scissor. So there is one renderer, one frame loop, and as
 * many 3D instruments as a page wants, each still a scrolling, reflowing,
 * focusable part of the document.
 *
 *   import { ship, THREE } from './ship/ship.js';
 *   ship.mount({ deck: 'bridge' });
 *   ship.viewport(el, {
 *     setup({ scene, camera, size }) { ... },
 *     frame({ scene, camera, t, dt, size }) { ... },   // optional
 *     pointer(ev, { ndc, ray }) { ... },                // optional
 *   });
 *
 * Reduced motion: the loop still runs so instruments answer input, but
 * ambient drift is held, and anything a deck marks decorative should read
 * ship.motion before animating.
 */

import * as THREE from '../vendor/three/three.module.min.js';
import * as P from './physics.js';

export { THREE };

export const DECKS = [
  { id: 'bridge',      k: '01', name: 'Bridge',      href: 'index.html',       accent: '178 216 248', line: 'the beam, end to end' },
  { id: 'observatory', k: '02', name: 'Observatory', href: 'observatory.html', accent: '126 224 255', line: 'two signals, every number' },
  { id: 'lab',         k: '03', name: 'Light Lab',   href: 'lab.html',         accent: '255 212 96',  line: 'six benches, break something' },
  { id: 'gamma',       k: '04', name: 'Gamma Attic', href: 'gamma.html',       accent: '226 120 180', line: 'the top of the ruler' },
  { id: 'senses',      k: '05', name: 'Spectral Zoo', href: 'senses.html',     accent: '120 224 170', line: 'who senses what' },
];

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/* ---- the spectrum as a texture, shared by every ribbon -------------------- */
let spectrumTex = null;
export function spectrumTexture() {
  if (spectrumTex) return spectrumTex;
  const W = 4096, data = new Uint8Array(W * 4);   // wide enough that the visible band, a third of a decade, gets ~80 texels
  for (let i = 0; i < W; i++) {
    const f = P.freqAt(i / (W - 1));
    const band = P.bandOf(f);
    let rgb;
    if (band.id === 'visible') rgb = P.lambdaRGB(P.C / f * 1e9);
    else {
      // translation colours blend into their neighbours across a quarter
      // decade either side of a boundary: the bands are human labels laid on
      // one continuous phenomenon, and the beam should say so
      const x = P.log10(f), bi = P.BANDS.indexOf(band);
      const prev = P.BANDS[bi - 1], next = P.BANDS[bi + 1];
      const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
      rgb = band.rgb.slice();
      const BL = 0.25;
      if (prev && x - P.log10(band.lo) < BL) rgb = mix(prev.id === 'visible' ? [255, 60, 40] : prev.rgb, band.rgb, 0.5 + 0.5 * (x - P.log10(band.lo)) / BL);
      if (next && P.log10(band.hi) - x < BL) rgb = mix(band.rgb, next.id === 'visible' ? [120, 40, 255] : next.rgb, 0.5 - 0.5 * (P.log10(band.hi) - x) / BL);
    }
    data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
  }
  spectrumTex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  spectrumTex.colorSpace = THREE.SRGBColorSpace;
  spectrumTex.minFilter = THREE.LinearFilter; spectrumTex.magFilter = THREE.LinearFilter;
  spectrumTex.needsUpdate = true;
  return spectrumTex;
}

export const colorOf = f => { const [r, g, b] = P.freqRGB(f); return new THREE.Color(r / 255, g / 255, b / 255); };
export const colorOfRGB = rgb => new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);

/* A ribbon of light coloured by frequency along its length: u runs 10 kHz to
   100 EHz (or any window of it via uLo/uHi in bar position), v fades to the
   edges. Additive, so ribbons stack like light rather than like paint. */
export function spectrumRibbon({ length = 10, width = 1, lo = 0, hi = 1, intensity = 1, segments = 256, soft = 1 } = {}) {
  const geo = new THREE.PlaneGeometry(length, width, segments, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uTex: { value: spectrumTexture() }, uLo: { value: lo }, uHi: { value: hi },
      uI: { value: intensity }, uT: { value: 0 }, uSoft: { value: soft },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform float uLo, uHi, uI, uT, uSoft; varying vec2 vUv;
      void main(){
        float u = mix(uLo, uHi, vUv.x);
        vec3 c = texture2D(uTex, vec2(u, 0.5)).rgb;
        float d = abs(vUv.y - 0.5) * 2.0;
        float core = exp(-d * d * 9.0 * uSoft);
        float halo = exp(-d * d * 2.2 * uSoft) * 0.28;
        float a = (core + halo) * uI;
        gl_FragColor = vec4(c * a, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.setWindow = (l, h) => { mat.uniforms.uLo.value = l; mat.uniforms.uHi.value = h; };
  return mesh;
}

/* A text label as a sprite; monospace, tracked, like every readout on the
   vessel. Cheap enough to make a few dozen. */
const labelCache = new Map();
export function label(text, { size = 22, color = '#cfe6ff', tracking = 2, weight = 400, font = 'ui-monospace, Menlo, Consolas, monospace', pad = 8 } = {}) {
  const key = [text, size, color, tracking, weight].join('|');
  let tex = labelCache.get(key);
  if (!tex) {
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    const scale = 2;
    ctx.font = `${weight} ${size}px ${font}`;
    const w = Math.ceil(ctx.measureText(text).width + tracking * text.length + pad * 2);
    cv.width = w * scale; cv.height = (size + pad * 2) * scale;
    ctx.scale(scale, scale);
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) { ctx.letterSpacing = tracking + 'px'; ctx.fillText(text, pad, size / 2 + pad); }
    else { let x = pad; for (const ch of text) { ctx.fillText(ch, x, size / 2 + pad); x += ctx.measureText(ch).width + tracking; } }
    tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
    tex.userData = { w: w, h: size + pad * 2 };
    labelCache.set(key, tex);
  }
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.userData.aspect = tex.userData.w / tex.userData.h;
  sp.userData.fit = h => sp.scale.set(h * sp.userData.aspect, h, 1);
  sp.userData.fit(0.4);
  return sp;
}

/* A soft round glow sprite, the vessel's point light you can see. */
let glowTex = null;
export function glowSprite(color = 0xffffff, size = 1, opacity = 1) {
  if (!glowTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.85)');
    g.addColorStop(0.5, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(cv);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(size, size, 1);
  return sp;
}

/* ---- the ship ------------------------------------------------------------ */
function createShip() {
  const ship = {
    THREE, P, renderer: null, canvas: null, viewports: [], deck: null,
    get motion() { return !(motionQuery && motionQuery.matches); },
    // a phone's 3x panel is a full-screen canvas nine times the pixels of a
    // laptop's; capping it at 1.5 keeps the shaders affordable there
    pixelRatio: Math.min(typeof innerWidth === 'number' && innerWidth < 760 ? 1.5 : 2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)),
    lazy: false,            // a deck may set this before building viewports: setup runs on first sight
    time: 0, scrollY: 0, pointer: { x: 0, y: 0 },
    hull: null,
  };

  /* ---- chrome ---- */
  ship.mount = function ({ deck, title, sub } = {}) {
    const d = DECKS.find(x => x.id === deck) || DECKS[0];
    ship.deck = d;
    document.body.style.setProperty('--deck', d.accent);
    document.body.dataset.deck = d.id;

    const bar = document.createElement('header');
    bar.className = 'deckbar';
    bar.innerHTML =
      `<a class="brand" href="index.html" aria-label="Radio to Gamma, bridge">
         <img src="favicon.png" alt="" width="26" height="26">
         <span><span class="name">${title || 'Radio to Gamma'}</span><span class="sub">${sub || ('Survey vessel · deck ' + d.k + ' · ' + d.name)}</span></span>
       </a>
       <button class="share" type="button" id="shareBtn" data-holo-tap>Share</button>`;
    // the deck rail is a sibling of the bar, not a child: the bar's backdrop
    // filter would otherwise become the containing block of a fixed rail,
    // and the phone dock would pin itself to the bar instead of the screen
    const nav = document.createElement('nav');
    nav.className = 'decknav'; nav.setAttribute('aria-label', 'Decks');
    nav.innerHTML = DECKS.map(x => `<a href="${x.href}"${x.id === d.id ? ' aria-current="page"' : ''} data-holo-tap><span class="k">${x.k}</span>${x.name}</a>`).join('');
    document.body.prepend(nav);
    document.body.prepend(bar);

    // the share button: the native sheet where there is one, copy the link where there is not
    bar.querySelector('#shareBtn').addEventListener('click', function () {
      const btn = this, url = location.href;
      if (navigator.share) { navigator.share({ title: document.title, url }).catch(() => {}); return; }
      const done = () => { const old = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = old; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
      else done();
    });

    // the hull
    const canvas = document.createElement('canvas');
    canvas.className = 'hull'; canvas.setAttribute('aria-hidden', 'true');
    const haze = document.createElement('div'); haze.className = 'hull-haze';
    document.body.prepend(haze); document.body.prepend(canvas);
    ship.canvas = canvas;
    try {
      ship.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      ship.renderer.setPixelRatio(ship.pixelRatio);
      ship.renderer.outputColorSpace = THREE.SRGBColorSpace;
      ship.renderer.setClearColor(0x000000, 0);
      ship.renderer.autoClear = false;
    } catch (e) {
      document.body.classList.add('no-webgl');
      ship.renderer = null;
    }
    // a context lost under memory pressure (a phone with six benches) goes
    // dark without a word unless the page says so; every viewport shows its
    // fallback text and a way back
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      document.body.classList.add('no-webgl', 'gl-lost');
      for (const vp of ship.viewports) {
        const fb = vp.el.querySelector('.fallback');
        if (fb && !fb.querySelector('.gl-reload')) fb.insertAdjacentHTML('beforeend', '<br><button type="button" class="chip gl-reload" onclick="location.reload()">The window went dark on this device. Reload the deck</button>');
      }
    });

    // entrances for anything that asks for one
    const seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); seen.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    const watch = () => document.querySelectorAll('.holopanel:not(.is-in), .rise:not(.is-in)').forEach(el => seen.observe(el));
    watch(); ship.watchEntrances = watch;

    if (ship.renderer) { buildSpace(); resize(); loop(); }
    addEventListener('resize', resize);
    addEventListener('scroll', () => { ship.scrollY = scrollY; }, { passive: true });
    addEventListener('pointermove', e => { ship.pointer.x = e.clientX / innerWidth * 2 - 1; ship.pointer.y = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });
    return ship;
  };

  /* ---- space: the ambient scene behind every deck ---- */
  let space = null;
  function buildSpace() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    camera.position.set(0, 0, 30);

    // stars: three depths, twinkling in the shader on their own phase
    const N = 1800, pos = new Float32Array(N * 3), ph = new Float32Array(N), sz = new Float32Array(N), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 60 + Math.random() * 180, th = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(th); pos[i * 3 + 1] = r * u * 0.7; pos[i * 3 + 2] = -r * s * Math.sin(th) * 0.5 - 40;
      ph[i] = Math.random() * Math.PI * 2; sz[i] = 0.6 + Math.pow(Math.random(), 3) * 2.6;
      const warm = Math.random() < 0.18, k = 0.75 + Math.random() * 0.25;
      col[i * 3] = k * (warm ? 1 : 0.82); col[i * 3 + 1] = k * (warm ? 0.86 : 0.9); col[i * 3 + 2] = k * (warm ? 0.7 : 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uPR: { value: ship.pixelRatio } },
      vertexShader: `attribute float phase, size; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uT, uPR;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float tw = 0.72 + 0.28 * sin(uT * (0.6 + 0.4 * fract(phase)) + phase);
        vA = tw; vC = color; gl_PointSize = size * uPR * 120.0 / -mv.z * tw; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.0, r); a *= a; gl_FragColor = vec4(vC * a * vA, a * vA); }`,
    }));
    scene.add(stars);

    // the beam: the whole spectrum, running away into the dark along the hull
    const beam = spectrumRibbon({ length: 220, width: 5.5, intensity: 0.5, soft: 0.9 });
    beam.position.set(14, -4, -70); beam.rotation.set(0.2, -0.95, 0.08);
    scene.add(beam);
    const beam2 = spectrumRibbon({ length: 220, width: 16, intensity: 0.08, soft: 0.5 });
    beam2.position.copy(beam.position); beam2.rotation.copy(beam.rotation);
    scene.add(beam2);

    // a faint nebula, two overlapping soft sheets
    const neb = new THREE.Mesh(new THREE.PlaneGeometry(400, 260), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(0x24406e) }, uC2: { value: new THREE.Color(0x4a1e5c) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uT; uniform vec3 uC, uC2; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
        void main(){ vec2 p = vUv * 4.0 + vec2(uT * 0.004, 0.0);
          float a = fbm(p); float b = fbm(p * 1.7 + 3.1);
          float m = smoothstep(0.42, 0.78, a) * 0.28; float m2 = smoothstep(0.5, 0.85, b) * 0.16;
          float vign = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          vec3 c = uC * m + uC2 * m2; gl_FragColor = vec4(c * vign, (m + m2) * vign); }`,
    }));
    neb.position.set(0, 10, -160);
    scene.add(neb);

    space = { scene, camera, stars, beam, beam2, neb };
    ship.hull = space;
  }

  /* ---- viewports ---- */
  const io = new IntersectionObserver(es => es.forEach(e => { const vp = e.target.__vp; if (vp) vp.visible = e.isIntersecting; }), { rootMargin: '80px' });
  ship.viewport = function (el, def) {
    const scene = new THREE.Scene();
    const camera = def.camera || new THREE.PerspectiveCamera(def.fov || 40, 1, 0.05, 500);
    const vp = { el, def, scene, camera, visible: false, size: { w: 1, h: 1 }, ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), needs: true };
    el.__vp = vp; el.classList.add('viewport');
    if (!el.querySelector('.corner')) { const c = document.createElement('div'); c.className = 'corner'; el.appendChild(c); }
    ship.viewports.push(vp);
    io.observe(el);
    const measure = () => {
      const r = el.getBoundingClientRect();
      vp.size.w = Math.max(1, r.width); vp.size.h = Math.max(1, r.height);
      if (camera.isPerspectiveCamera) { camera.aspect = vp.size.w / vp.size.h; camera.updateProjectionMatrix(); }
      if (def.resize) def.resize(vp);
      vp.needs = true;
    };
    new ResizeObserver(measure).observe(el);
    measure();
    vp.ready = false;
    vp.boot = () => { if (vp.ready) return; vp.ready = true; try { if (def.setup) def.setup(vp); } catch (err) { console.error('viewport setup failed', el.id, err); const fb = el.querySelector('.fallback'); if (fb) { fb.style.display = 'grid'; fb.textContent += ' (' + (err && err.message || err) + ')'; } vp.broken = true; } };
    const lazy = def.lazy !== undefined ? def.lazy : ship.lazy;
    if (!lazy) vp.boot();
    // focus mode: on a touch screen a drag inside an instrument fights the
    // page's own scroll, so an instrument can take the whole screen and lock
    // the page behind it until it is closed
    if (def.focus !== false) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'vp-focus'; btn.setAttribute('aria-label', 'Open this instrument full screen');
      btn.innerHTML = '<span class="open">\u2922</span><span class="close">\u2715</span>';
      el.appendChild(btn);
      btn.addEventListener('click', () => ship.focus(el.classList.contains('is-full') ? null : vp));
    }
    // pointer helpers: ndc inside this box, and a ray from its camera
    vp.pick = ev => {
      const r = el.getBoundingClientRect();
      vp.ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height * 2 - 1));
      vp.ray.setFromCamera(vp.ndc, camera);
      return vp;
    };
    vp.invalidate = () => { vp.needs = true; };
    if (def.pointer) {
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) el.addEventListener(type, ev => { def.pointer(ev, vp.pick(ev), vp); vp.needs = true; });
    }
    return vp;
  };

  /* focus mode: one viewport pinned over the page, the page locked */
  ship.focused = null;
  ship.focus = function (vp) {
    if (ship.focused && ship.focused !== vp) ship.focus(null);
    if (ship.focused && !vp) {
      const el = ship.focused.el;
      el.classList.remove('is-full'); document.body.classList.remove('vp-lock');
      window.scrollTo(0, ship.focused.scrollBack || 0);
      ship.focused = null; el.querySelector('.vp-focus').focus();
      return;
    }
    if (!vp) return;
    vp.scrollBack = scrollY;
    vp.el.classList.add('is-full'); document.body.classList.add('vp-lock');
    ship.focused = vp; vp.visible = true; vp.needs = true;
  };
  addEventListener('keydown', e => { if (e.key === 'Escape' && ship.focused) ship.focus(null); });

  /* the world size that paints as `px` pixels tall at a point, so a label
     can stay readable whatever the camera distance (sprites do not scale
     with the box on their own, and sixteen decades on a phone put the camera
     far away) */
  const _v = new THREE.Vector3();
  ship.worldPerPixel = function (vp, point) {
    const cam = vp.camera;
    if (cam.isOrthographicCamera) return (cam.top - cam.bottom) / cam.zoom / vp.size.h;
    const dist = _v.copy(point).sub(cam.position).length();
    return 2 * dist * Math.tan(cam.fov * Math.PI / 360) / vp.size.h;
  };
  ship.fitLabel = function (vp, sprite, px) { sprite.userData.fit(ship.worldPerPixel(vp, sprite.position) * px); };

  /* a translucent dimmer drawn under every instrument, so a viewport reads as
     a darker pane of the hull rather than the open sky (the DOM box itself is
     transparent: anything painted there would sit on top of the render) */
  const dimScene = new THREE.Scene();
  const dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x02040a, transparent: true, opacity: 0.62, depthTest: false, depthWrite: false })));

  /* ---- the loop ---- */
  let last = 0, W = 1, Hh = 1;
  function resize() {
    W = innerWidth; Hh = innerHeight;
    if (!ship.renderer) return;
    ship.renderer.setSize(W, Hh, false);
    if (space) { space.camera.aspect = W / Hh; space.camera.updateProjectionMatrix(); }
    for (const vp of ship.viewports) vp.needs = true;
  }
  let hidden = false;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; });
  function loop(now = 0) {
    requestAnimationFrame(loop);
    if (hidden || !ship.renderer) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (ship.motion) ship.time += dt;
    const t = ship.time;
    const r = ship.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, W, Hh);
    r.clear(true, true, true);

    // space: a slow drift, a little parallax from the pointer, and a slide
    // along the beam as the page scrolls so the hull moves under the decks
    if (space) {
      const sc = ship.scrollY / Math.max(1, document.documentElement.scrollHeight - Hh);
      const cam = space.camera;
      const tx = ship.pointer.x * 1.6 + Math.sin(t * 0.07) * 0.8;
      const ty = ship.pointer.y * 0.9 - sc * 9 + Math.cos(t * 0.05) * 0.5;
      cam.position.x += (tx - cam.position.x) * 0.04;
      cam.position.y += (ty - cam.position.y) * 0.04;
      cam.lookAt(0, -sc * 6, -60);
      space.stars.material.uniforms.uT.value = t;
      space.neb.material.uniforms.uT.value = t;
      space.beam.material.uniforms.uI.value = 0.42 + 0.08 * Math.sin(t * 0.35);
      space.beam.position.z = -70 + sc * 30;
      space.beam2.position.z = space.beam.position.z;
      r.render(space.scene, cam);
    }

    // each visible instrument, scissored into its own box
    r.setScissorTest(true);
    for (const vp of ship.viewports) {
      if (!vp.visible || vp.broken) continue;
      if (!vp.ready) vp.boot();
      if (ship.focused && ship.focused !== vp) continue;
      const rect = vp.el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > Hh || rect.right < 0 || rect.left > W) continue;
      const left = rect.left, bottom = Hh - rect.bottom, w = rect.width, h = rect.height;
      r.setViewport(left, bottom, w, h); r.setScissor(left, bottom, w, h);
      if (vp.def.dim !== false) r.render(dimScene, dimCam);
      if (vp.def.frame) vp.def.frame(Object.assign(vp, { t, dt }));
      r.render(vp.scene, vp.camera);
      vp.needs = false;
    }
    r.setScissorTest(false);
  }

  return ship;
}

export const ship = createShip();
export default ship;
