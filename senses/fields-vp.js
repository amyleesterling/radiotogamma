/* senses/fields-vp.js: the field wing's instrument. A dark sea floor, a
 * prey fish whose body is a current dipole, its field lines in the water,
 * and a hunter whose electroreceptors light up with the field at its snout.
 * The physics is in fields.js (pure, node-testable); this file only draws
 * it on the ship's runtime.
 *
 * Scale: one world unit is 10 cm, so a 60 cm dogfish is 6 units long and
 * Kalmijn's 12 cm plaice is 1.2. Nothing is compressed in the geometry;
 * what is drawn rather than measured is said in the vp-note and the page.
 */

import { ship, THREE, label, glowSprite } from '../ship/ship.js';
import * as F from './fields.js';

const U = 10;                                            // world units per metre
const ACCENT = new THREE.Color(168 / 255, 224 / 255, 106 / 255);

/* ---- the three modes ----------------------------------------------------- */
const MODES = {
  shark: {
    name: 'Shark & ray', hunter: 'shark', prey: 'plaice', src: F.PLAICE, sense: F.SENSES.shark,
    picked: 'Dogfish · plaice · seawater', organ: 'ampullae of Lorenzini', preyName: 'plaice',
    period: 1.2, amp: 0.9, dist: [2, 60], distDefault: 15, zoom: 1,
    note: 'Scale 1:1, a 60 cm dogfish · static dc dipole field · the pulse is drawn',
  },
  platypus: {
    name: 'Platypus', hunter: 'platypus', prey: 'shrimp', src: F.SHRIMP, sense: F.SENSES.platypus,
    picked: 'Platypus · shrimp · freshwater', organ: 'bill electroreceptors', preyName: 'shrimp',
    period: 1.6, amp: 1.2, dist: [1, 30], distDefault: 7, zoom: 0.62,
    note: 'Scale 1:1, a 45 cm platypus · the shrimp\'s moment is a chosen value · twitches drawn as pulses',
  },
  knife: {
    name: 'Weakly electric fish', hunter: null, prey: null, src: F.KNIFEFISH, sense: null,
    picked: 'Black ghost knifefish · its own field · freshwater', organ: 'skin electroreceptors',
    period: 0.5, amp: 0.7, zoom: 0.5,
    note: 'Scale 1:1, a 20 cm knifefish · its 1 kHz discharge drawn thousands of times slower',
  },
};

export function mountFields(ids) {
  const el = document.getElementById(ids.vp);
  const ro = id => { const r = document.getElementById(id); return { k: r.querySelector('.k'), v: r.querySelector('.v'), d: r.querySelector('.d') }; };
  const rd = { f: ro(ids.rdF), d: ro(ids.rdD), p: ro(ids.rdP), r: ro(ids.rdR) };
  const picked = document.getElementById(ids.picked), note = document.getElementById(ids.note);
  const buryBtn = document.getElementById(ids.bury), distIn = document.getElementById(ids.dist), distV = document.getElementById(ids.distV), distWrap = document.getElementById(ids.distWrap);
  const chips = [...document.querySelectorAll('#' + ids.chips + ' .chip')];
  const text = document.getElementById(ids.text);

  /* ---- state, in metres and radians (truth); the scene chases it ---- */
  const st = {
    mode: 'shark', buried: false,
    prey: { c: [0.12, 0.015, 0.04], h: 0.0 },                 // centre, heading (radians about y)
    hunter: { c: [-0.31, 0.05, -0.08], h: 0.0 },
    objs: [{ id: 'conductor', c: [0.07, 0.03, 0.065], a: 0.025, chi: F.CHI.conductor }, { id: 'insulator', c: [-0.065, 0.03, 0.065], a: 0.025, chi: F.CHI.insulator }],
    cam: { az: 0.55, azGoal: 0.55, el: 0.62 },
    dirty: true,
  };
  st.hunter.h = Math.atan2(-(st.prey.c[2] - st.hunter.c[2]), st.prey.c[0] - st.hunter.c[0]);
  const M = () => MODES[st.mode];

  /* ---- scene pieces, filled in setup ---- */
  let S = null;
  const px = () => (el.getBoundingClientRect().width < 640 ? 8 : 12);   // the runtime bumps labels half again on a phone

  const vp = ship.viewport(el, {
    fov: 34,
    setup({ scene, camera }) {
      scene.fog = new THREE.Fog(0x04101c, 14, 40);
      scene.add(new THREE.HemisphereLight(0x9fd6ff, 0x141a14, 1.3));
      const sunL = new THREE.DirectionalLight(0xcfe8ff, 1.2); sunL.position.set(3, 8, 4); scene.add(sunL);

      // the sea floor: a canvas of ripples, so the sand reads as sand without a texture file
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
      c.fillStyle = '#2b2a22'; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${58 + Math.random() * 30 | 0},${40 + Math.random() * 20 | 0},${0.35 + Math.random() * 0.4})`; c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
      c.strokeStyle = 'rgba(90,86,64,.35)'; c.lineWidth = 2;
      for (let y = 0; y < 256; y += 18) { c.beginPath(); for (let x = 0; x <= 256; x += 8) c.lineTo(x, y + Math.sin(x / 22 + y) * 4); c.stroke(); }
      const sandTex = new THREE.CanvasTexture(cv); sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(6, 4); sandTex.colorSpace = THREE.SRGBColorSpace;
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshLambertMaterial({ map: sandTex, color: 0x8a8670 }));
      sand.rotation.x = -Math.PI / 2; scene.add(sand);

      // the prey: a group that carries the fish, its mound and its field lines
      const prey = new THREE.Group(); scene.add(prey);
      const plaice = new THREE.Group();
      const pm = new THREE.MeshLambertMaterial({ color: 0x7a6a44, transparent: true, opacity: 1 });
      const pb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), pm); pb.scale.set(1.2, 0.22, 0.75); plaice.add(pb);
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), pm); pt.rotation.z = Math.PI / 2; pt.scale.set(1, 1, 0.3); pt.position.x = -0.75; plaice.add(pt);
      for (const dz of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0x111111 })); e.position.set(0.35, 0.11, dz); plaice.add(e); }
      prey.add(plaice);
      const shrimp = new THREE.Group();
      const sm = new THREE.MeshLambertMaterial({ color: 0x9a8a7a, transparent: true, opacity: 1 });
      const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 10), sm); sb.rotation.z = Math.PI / 2; shrimp.add(sb);
      const stl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 6), sm); stl.rotation.z = Math.PI / 2; stl.scale.z = 0.4; stl.position.x = -0.24; shrimp.add(stl);
      shrimp.visible = false; prey.add(shrimp);
      const mound = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshLambertMaterial({ map: sandTex, color: 0x9a9578, transparent: true, opacity: 0 }));
      mound.rotation.x = -Math.PI / 2; mound.position.y = 0.012; mound.scale.set(1, 0.7, 1); prey.add(mound);
      const preyLines = makeLines(ACCENT); prey.add(preyLines.mesh);
      const preyTag = label('plaice · 0.2 µA·m', { size: 18, pad: 3, color: '#cfe6b0' }); preyTag.userData.px = px(); preyTag.position.set(0, 0.5, 0); prey.add(preyTag);

      // the hunters
      const shark = buildShark(); scene.add(shark.g);
      const platypus = buildPlatypus(); platypus.g.visible = false; scene.add(platypus.g);

      // the knifefish, its own lines (in world space, they bend round the objects), its skin, and the two spheres
      const knife = buildKnifefish(); knife.g.visible = false; scene.add(knife.g);
      const knifeLines = makeLines(new THREE.Color(0.75, 0.95, 1.0)); knifeLines.mesh.visible = false; scene.add(knifeLines.mesh);
      const objMeshes = st.objs.map(o => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(o.a * U, 24, 16), o.chi > 0
          ? new THREE.MeshStandardMaterial({ color: 0xd8d4c4, metalness: 0.9, roughness: 0.25 })
          : new THREE.MeshLambertMaterial({ color: 0x5a5a58 }));
        m.visible = false; scene.add(m);
        const tag = label(o.id, { size: 18, pad: 3, color: o.chi > 0 ? '#ffe9b0' : '#bfc4cc' }); tag.userData.px = px(); tag.position.y = o.a * U + 0.3; m.add(tag);
        return m;
      });

      // invisible drag targets, generous on purpose: a finger is not a cursor
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitPrey = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), hitMat); hitPrey.userData.what = 'prey'; prey.add(hitPrey);
      const hitHunter = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), hitMat); hitHunter.userData.what = 'hunter'; scene.add(hitHunter);
      const hitObjs = objMeshes.map((m, i) => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), hitMat); h.userData.what = 'obj' + i; m.add(h); return h; });

      S = { prey, plaice, shrimp, pm, sm, mound, preyLines, preyTag, shark, platypus, knife, knifeLines, objMeshes, hitPrey, hitHunter, hitObjs, camera };
      applyMode();
    },
    frame({ camera, dt, t }) {
      if (!S) return;
      const k = ship.motion ? 1 - Math.exp(-dt * 5) : 1;
      const cm = st.cam; cm.az += (cm.azGoal - cm.az) * k;
      const zoom = M().zoom || 1;
      st.cam.d = (st.cam.d || 14) + (Math.max(10, Math.min(24, 4.6 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect))) * zoom - (st.cam.d || 14)) * k;
      const d = st.cam.d;
      camera.position.set(Math.sin(cm.az) * Math.cos(cm.el) * d, Math.sin(cm.el) * d, Math.cos(cm.az) * Math.cos(cm.el) * d);
      // the frame centres on the pair, hunter and prey, and chases it as they are dragged
      const mid = M().sense ? [(st.prey.c[0] + st.hunter.c[0]) / 2 * U, 0.25, (st.prey.c[2] + st.hunter.c[2]) / 2 * U] : [0, 0.3, 0];
      st.cam.look = st.cam.look || mid.slice();
      for (let i = 0; i < 3; i++) st.cam.look[i] += (mid[i] - st.cam.look[i]) * k;
      camera.position.add(new THREE.Vector3(st.cam.look[0], 0, st.cam.look[2]));
      camera.lookAt(st.cam.look[0], st.cam.look[1], st.cam.look[2]);

      // the prey and the hunter sit where the truth says; the fish fades when buried
      S.prey.position.set(st.prey.c[0] * U, st.prey.c[1] * U, st.prey.c[2] * U); S.prey.rotation.y = st.prey.h;
      const hunter = st.mode === 'shark' ? S.shark : S.platypus;
      hunter.g.position.set(st.hunter.c[0] * U, st.hunter.c[1] * U, st.hunter.c[2] * U); hunter.g.rotation.y = st.hunter.h;
      S.hitHunter.position.copy(hunter.g.position);
      const fade = st.buried ? 0 : 1;
      S.pm.opacity += (fade - S.pm.opacity) * k; S.sm.opacity += (fade - S.sm.opacity) * k;
      S.mound.material.opacity += ((st.buried ? 0.95 : 0) - S.mound.material.opacity) * k;
      S.prey.position.y = (st.buried ? -0.012 : st.prey.c[1]) * U;
      S.preyLines.mesh.position.y = st.buried ? st.prey.c[1] * U + 0.12 : 0;     // the field does not move with the sand

      // the pulse: a packet running source to sink once a period
      const m = M();
      for (const L of [S.preyLines, S.knifeLines]) { L.mat.uniforms.uT.value = t; L.mat.uniforms.uPeriod.value = m.period; L.mat.uniforms.uAmp.value = m.amp; }

      // the knifefish's objects and skin
      st.objs.forEach((o, i) => S.objMeshes[i].position.set(o.c[0] * U, o.c[1] * U, o.c[2] * U));

      // the knifefish's lines are re-integrated on every change, so a drag refreshes at most every 40 ms
      if (st.dirty && (st.mode !== 'knife' || t - (st.lastRefresh || -1) > 0.04 || !ship.motion)) { st.dirty = false; st.lastRefresh = t; refresh(); }
      // the receptors glow with the field at the snout, by decades over the sense's range
      if (m.sense) {
        const E = F.poleField(snoutWorld(), preyPoles(), m.src.sigma);
        const lv = F.level(Math.hypot(...E), m.sense);
        hunter.dots.material.uniforms.uLevel.value += (lv - hunter.dots.material.uniforms.uLevel.value) * k;
        hunter.glow.material.opacity = 0.1 + 0.9 * hunter.dots.material.uniforms.uLevel.value;
        hunter.glow.scale.setScalar(0.6 + 1.6 * hunter.dots.material.uniforms.uLevel.value);
      }
    },
    pointer(ev, vp) {
      const el = vp.el;
      if (ev.type === 'pointerdown') {
        if (ev.target.closest('button, input')) return;
        vp.ray.camera = vp.camera;
        const targets = st.mode === 'knife' ? S.hitObjs : [S.hitPrey, S.hitHunter];
        const hit = vp.ray.intersectObjects(targets, false)[0];
        el.__drag = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false, what: hit ? hit.object.userData.what : 'orbit', az: st.cam.azGoal, last: planePoint(vp) };
        return;
      }
      const d = el.__drag;
      if (!d) return;
      if (ev.type === 'pointermove') {
        if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 5) { d.moved = true; el.classList.add('is-grabbing'); el.setPointerCapture && el.setPointerCapture(d.id); }
        if (!d.moved) return;
        if (d.what === 'orbit') { st.cam.azGoal = d.az + (ev.clientX - d.x) * 0.008; return; }
        const p = planePoint(vp); if (!p || !d.last) return;
        const dx = p[0] - d.last[0], dz = p[2] - d.last[2]; d.last = p;
        const body = d.what === 'prey' ? st.prey : d.what === 'hunter' ? st.hunter : st.objs[+d.what.slice(3)];
        body.c[0] = clampTo(body.c[0] + dx, 0.7); body.c[2] = clampTo(body.c[2] + dz, 0.45);
        if (d.what === 'hunter' && Math.hypot(dx, dz) > 0.0005) { const h = Math.atan2(-dz, dx); st.hunter.h += wrap(h - st.hunter.h) * 0.35; }
        st.dirty = true;
        return;
      }
      el.classList.remove('is-grabbing'); el.__drag = null;
    },
  });

  /* ---- helpers ---- */
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const clampTo = (v, m) => Math.max(-m, Math.min(m, v));
  const _p = new THREE.Vector3();
  function planePoint(vp) {
    // where the pointer's ray meets the sea floor, in metres
    const r = vp.ray.ray; if (Math.abs(r.direction.y) < 1e-6) return null;
    const t = -r.origin.y / r.direction.y; if (t < 0) return null;
    _p.copy(r.direction).multiplyScalar(t).add(r.origin);
    return [_p.x / U, 0, _p.z / U];
  }
  function preyPoles() {
    const axis = [Math.cos(st.prey.h), 0, -Math.sin(st.prey.h)];       // the fish's head points along +x in its own frame
    return F.dipolePoles(M().src, st.prey.c, axis);
  }
  function knifePoles() { return F.knifefishPoles([0, 0.06, 0]); }
  /* the snout in metres, from the state alone, so the readouts never wait
     for the scene: rotation.y = h takes local +x to (cos h, 0, -sin h) */
  const SNOUT = { shark: [0.3, 0, 0], platypus: [0.225, -0.005, 0] };
  function snoutWorld() {
    const l = SNOUT[st.mode], c = st.hunter.c, h = st.hunter.h;
    return [c[0] + l[0] * Math.cos(h) + l[2] * Math.sin(h), c[1] + l[1], c[2] - l[0] * Math.sin(h) + l[2] * Math.cos(h)];
  }

  /* ---- the readouts and the lines: recomputed when something moved ---- */
  function refresh() {
    const m = M();
    if (m.sense) {
      const sn = snoutWorld(), poles = preyPoles();
      const E = Math.hypot(...F.poleField(sn, poles, m.src.sigma));
      const dist = Math.hypot(sn[0] - st.prey.c[0], sn[1] - st.prey.c[1], sn[2] - st.prey.c[2]);
      const over = E / m.sense.th;
      rd.f.v.textContent = F.fmtField(E);
      rd.f.d.innerHTML = over >= 1
        ? `<b>${over >= 100 ? Math.round(over).toLocaleString('en-US') : over.toFixed(1)}&times;</b> the ${F.fmtField(m.sense.th)} threshold (${m.sense.cite}): detected`
        : `below the ${F.fmtField(m.sense.th)} threshold (${m.sense.cite}): nothing to feel`;
      rd.d.v.innerHTML = (dist * 100).toFixed(dist < 0.1 ? 1 : 0) + ' <span class="u">cm</span>';
      rd.d.d.textContent = m.organ + ' to the ' + m.preyName + '’s centre; the field falls as 1/r³, so twice the distance is an eighth of the field';
      distIn.value = Math.round(dist * 100); distV.textContent = Math.round(dist * 100) + ' cm';
      distIn.setAttribute('aria-valuetext', Math.round(dist * 100) + ' cm, field ' + F.fmtField(E));
      const range = F.rangeOnAxis(m.src, m.sense.th);
      rd.r.v.innerHTML = (range * 100).toFixed(1) + ' <span class="u">cm</span>';
      rd.r.d.textContent = `where the field on the ${m.preyName}’s axis drops to threshold in noiseless water; off its flank the field is half as strong, so the reach is shorter there`;
    } else {
      if (!S) return;
      // the electric image: the skin point nearest each sphere, and the sphere that bends the field most there
      const poles = knifePoles();
      let best = null;
      for (const o of st.objs) {
        let near = null, nd = Infinity;
        for (const x of S.knife.skinM) { const dd = Math.hypot(x[0] - o.c[0], x[1] - o.c[1], x[2] - o.c[2]); if (dd < nd) { nd = dd; near = x; } }
        const ratio = F.imageRatio(near, poles, F.SIGMA_FRESH, [o]);
        if (!best || Math.abs(ratio - 1) > Math.abs(best.ratio - 1)) best = { o, ratio, gap: nd - o.a };
      }
      const pc = (best.ratio - 1) * 100;
      rd.f.v.textContent = (pc >= 0 ? '+' : '−') + Math.abs(pc).toFixed(Math.abs(pc) < 1 ? 2 : 1) + '%';
      rd.f.d.innerHTML = `field at the skin nearest the <b>${best.o.id}</b>, against the fish’s own field there: its electric image`;
      rd.d.v.innerHTML = (best.gap * 100).toFixed(1) + ' <span class="u">cm</span>';
      rd.d.d.textContent = `from the ${best.o.id}’s surface to the skin; the image fades with the cube of the distance, so the sense reaches about a body length (von der Emde 1999)`;
      // the skin lights by its image, warm where the field gathers, cold where it thins
      const lv = S.knife.dots.geometry.attributes.lvl;
      for (const o of st.objs) o.E0 = null;
      S.knife.skinM.forEach((x, i) => { const r = F.imageRatio(x, poles, F.SIGMA_FRESH, st.objs); lv.array[i] = Math.max(-1, Math.min(1, (r - 1) * 25)); });
      lv.needsUpdate = true;
      // a few lines from each of the head poles; they end at the tail poles, the floor, a sphere or the edge
      const seeds = F.axisSeeds([0, 0, 1], [40, 95], 4).concat(F.axisSeeds([0, 0, -1], [40, 95], 3));
      let lines = [];
      for (let i = 0; i < 6; i++) lines = lines.concat(F.fieldLines(poles, F.SIGMA_FRESH, { objects: st.objs, seeds, source: i, r0: 0.02, step: 0.007, maxSteps: 300, box: 0.6, floor: 0.004 }));
      const near = Math.hypot(...F.poleField([0.06, 0.06, 0.03], poles, F.SIGMA_FRESH));   // the field 2 cm off the flank by the head, the bright end of the drawing
      S.knifeLines.set(lines, [0, 0, 0], x => Math.max(0, Math.min(1, 1 + Math.log10(Math.hypot(...F.sceneField(x, poles, F.SIGMA_FRESH, st.objs)) / near) / 2.5)));
    }
  }

  /* ---- the modes ---- */
  function applyMode() {
    const m = M(), sense = !!m.sense;
    chips.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
    picked.innerHTML = m.name + '<small>' + m.picked + '</small>';
    note.textContent = m.note;
    buryBtn.disabled = !sense; distWrap.hidden = !sense;
    buryBtn.textContent = (st.buried ? 'Dig up the ' : 'Bury the ') + (m.preyName || 'prey');
    if (sense) {
      distIn.min = m.dist[0]; distIn.max = m.dist[1];
      rd.f.k.textContent = 'Field at the ' + (st.mode === 'shark' ? 'snout' : 'bill');
      rd.d.k.textContent = 'Reach'; rd.r.k.textContent = 'Range at threshold';
      rd.p.k.textContent = 'Prey dipole';
      rd.p.v.innerHTML = (m.src.I * m.src.d * 1e6).toFixed(1) + ' <span class="u">µA·m</span>';
      rd.p.d.textContent = m.src.label + ', in water of ' + m.src.sigma + ' S/m; near the body that is ' + F.fmtField(F.axialField(m.src, 0.02)) + ' at 2 cm on the axis';
    } else {
      rd.f.k.textContent = 'Electric image'; rd.d.k.textContent = 'Gap'; rd.p.k.textContent = 'Own field'; rd.r.k.textContent = 'The two spheres';
      rd.p.v.innerHTML = '&lt; 100 <span class="u">mV/cm</span>';
      rd.p.d.textContent = 'at the skin, with a discharge spectrum of 0.5 to 10 kHz (Rasnow 1994); every readout in this mode is a ratio, so the moment the ship draws does not matter';
      rd.r.v.textContent = 'conductor · insulator';
      rd.r.d.textContent = 'a sphere that conducts better than the water gathers the field lines into itself; one that conducts worse pushes them aside (the sphere in a uniform field: +1 and −1/2 of the ideal induced dipole)';
      rd.f.v.textContent = '. . .'; rd.d.v.textContent = '. . .'; rd.f.d.textContent = 'the electric image needs the instrument running'; rd.d.d.textContent = '';
    }
    st.dirty = true;
    if (!S) return;
    S.shark.g.visible = st.mode === 'shark'; S.platypus.g.visible = st.mode === 'platypus';
    S.plaice.visible = st.mode === 'shark'; S.shrimp.visible = st.mode === 'platypus';
    S.prey.visible = sense; S.preyLines.mesh.visible = sense; S.hitHunter.visible = sense;
    S.knife.g.visible = !sense; S.knifeLines.mesh.visible = !sense;
    S.objMeshes.forEach(o => { o.visible = !sense; });
    if (sense) {
      // the prey's own lines, in its own frame: they ride with it as it is dragged
      const poles = F.dipolePoles(m.src, [0, 0, 0], [1, 0, 0]);
      const lines = F.fieldLines(poles, m.src.sigma, { seeds: F.axisSeeds([1, 0, 0]), r0: m.src.d * 0.3, step: m.src.d * 0.08, maxSteps: 900, box: 0.45, floor: -0.013 });
      S.preyLines.set(lines, [0, 0, 0], x => F.level(Math.hypot(...F.poleField(x, poles, m.src.sigma)), m.sense));
      S.prey.remove(S.preyTag);
      S.preyTag = label(m.preyName + ' · ' + (m.src.I * m.src.d * 1e6).toFixed(1) + ' µA·m', { size: 18, pad: 3, color: '#cfe6b0' }); S.preyTag.userData.px = px(); S.preyTag.position.set(0, 0.5, 0); S.prey.add(S.preyTag);
    }
  }

  /* ---- controls ---- */
  chips.forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.mode; applyMode(); if (M().sense) { distIn.value = M().distDefault; placeAt(M().distDefault / 100); } setText(); refresh(); }));
  buryBtn.addEventListener('click', () => { st.buried = !st.buried; buryBtn.setAttribute('aria-pressed', String(st.buried)); buryBtn.textContent = (st.buried ? 'Dig up the ' : 'Bury the ') + M().preyName; st.dirty = true; });
  distIn.addEventListener('input', () => { placeAt(+distIn.value / 100); refresh(); });
  function placeAt(D) {
    // slide the hunter along the line from its snout to the prey until the snout is this far away
    const p = st.prey.c;
    st.hunter.h = Math.atan2(-(p[2] - st.hunter.c[2]), p[0] - st.hunter.c[0]);          // face the prey first
    const sn = snoutWorld();
    const v = [sn[0] - p[0], 0, sn[2] - p[2]]; const l = Math.hypot(v[0], v[2]) || 1;
    const goal = [p[0] + v[0] / l * D, 0, p[2] + v[2] / l * D];
    st.hunter.c[0] += goal[0] - sn[0]; st.hunter.c[2] += goal[2] - sn[2];
    st.dirty = true;
  }
  function setText() { text.innerHTML = TEXT[st.mode]; }
  setText();
  // the copy and the readouts come from the state alone, so they are right
  // before the scene has drawn a frame, and without WebGL at all
  applyMode();
  refresh();
  return { st, refresh: () => { st.dirty = true; } };

  /* ---- builders ---- */
  function makeLines(color) {
    // one LineSegments for all the lines, with an arc parameter per vertex for the pulse
    const MAX = 40 * 900 * 2;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3), s = new Float32Array(MAX), w = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('s', new THREE.BufferAttribute(s, 1));
    geo.setAttribute('w', new THREE.BufferAttribute(w, 1));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uPeriod: { value: 1.2 }, uAmp: { value: 0.9 }, uBase: { value: 0.55 }, uC: { value: color } },
      vertexShader: `attribute float s, w; varying float vS, vW; void main(){ vS = s; vW = w; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uT, uPeriod, uAmp, uBase; uniform vec3 uC; varying float vS, vW;
        void main(){ float ph = fract(vS - uT / uPeriod); float pulse = exp(-pow((ph - 0.5) * 4.0, 2.0));
          float a = (uBase + uAmp * pulse * 0.6) * (0.3 + 0.7 * vW); gl_FragColor = vec4(uC * a, a); }`,
    });
    const mesh = new THREE.LineSegments(geo, mat); mesh.frustumCulled = false;
    // weight(point) is 0..1, the local field on the sense's own scale: a line
    // fades out where the field drops below what the animal can feel
    const set = (lines, origin, weight) => {
      let n = 0;
      for (const L of lines) {
        const total = L.length - 1; if (total < 1) continue;
        const wt = L.map(weight);
        for (let i = 0; i < total && n + 2 <= MAX; i++) {
          for (const j of [i, i + 1]) {
            pos[n * 3] = (L[j][0] - origin[0]) * U; pos[n * 3 + 1] = (L[j][1] - origin[1]) * U; pos[n * 3 + 2] = (L[j][2] - origin[2]) * U;
            s[n] = j / total; w[n] = wt[j]; n++;
          }
        }
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.s.needsUpdate = true; geo.attributes.w.needsUpdate = true; geo.setDrawRange(0, n);
    };
    return { mesh, mat, set };
  }
  function receptorDots(points, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geo.setAttribute('rnd', new THREE.Float32BufferAttribute(points.map(() => Math.random()), 1));
    geo.setAttribute('lvl', new THREE.Float32BufferAttribute(points.map(() => 0), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uLevel: { value: 0 }, uPR: { value: ship.pixelRatio }, uC: { value: color }, uImage: { value: 0 } },
      vertexShader: `attribute float rnd, lvl; uniform float uLevel, uPR, uImage; varying float vA; varying float vL;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float lv = uImage > 0.5 ? 0.55 + 0.45 * lvl : uLevel;
          vA = 0.08 + 0.92 * lv * (0.7 + 0.3 * rnd); vL = lvl;
          gl_PointSize = (uImage > 0.5 ? 1.2 + 2.2 * lv : 2.2 + 5.0 * lv) * uPR * 60.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uC; uniform float uImage; varying float vA, vL;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.1, r) * vA;
          vec3 c = uImage > 0.5 ? mix(uC, vL > 0.0 ? vec3(1.0, 0.85, 0.5) : vec3(0.3, 0.45, 1.0), abs(vL)) : uC;
          gl_FragColor = vec4(c * a, a); }`,
    });
    return new THREE.Points(geo, mat);
  }
  function buildShark() {
    // a 60 cm dogfish: snout at local x = +3, tail at -3, swimming along +x
    const g = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0x4c5a66 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 4.2, 6, 18), skin); body.rotation.z = Math.PI / 2; body.position.x = 0.48; body.scale.set(1, 0.8, 1); g.add(body);
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), skin); dorsal.position.set(0.3, 0.55, 0); dorsal.scale.set(1.2, 1, 0.25); dorsal.rotation.y = Math.PI / 4; g.add(dorsal);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.2, 4), skin); tail.position.set(-2.55, 0.15, 0); tail.rotation.z = Math.PI / 2 + 0.3; tail.rotation.y = Math.PI / 4; tail.scale.set(1.5, 1, 0.2); g.add(tail);
    for (const dz of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 4), skin); f.position.set(1.0, -0.15, dz * 0.55); f.rotation.x = dz * Math.PI / 2; f.rotation.y = Math.PI / 4; f.scale.set(1.3, 1, 0.2); g.add(f); }
    // the ampullae: pores over the snout, under and over, drawn as the points that light
    const pts = [];
    const cx = 3 - 0.42;
    for (let i = 0; i < 70; i++) {
      const ph = Math.random() * Math.PI * 2, th = Math.random() * 1.25;   // within 72 degrees of the tip
      pts.push([cx + Math.cos(th) * 0.43, Math.sin(th) * Math.cos(ph) * 0.35, Math.sin(th) * Math.sin(ph) * 0.43]);
    }
    for (let i = 0; i < 30; i++) { const ph = Math.PI + (Math.random() - 0.5) * 2.2; pts.push([1.6 + Math.random() * 1.0, Math.sin(ph) * 0.35, Math.cos(ph) * 0.43]); }   // the underside, back toward the mouth
    const dots = receptorDots(pts, ACCENT); g.add(dots);
    const glow = glowSprite(0xbfff80, 1.2, 0.2); glow.position.set(2.7, 0, 0); g.add(glow);
    const tag = label('ampullae of Lorenzini', { size: 18, pad: 3, color: '#cfe6b0' }); tag.userData.px = px(); tag.position.set(2.6, 0.9, 0); g.add(tag);
    return { g, dots, glow };
  }
  function buildPlatypus() {
    // a 45 cm platypus: bill tip at local x = +2.25
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 2.2, 6, 16), fur); body.rotation.z = Math.PI / 2; body.position.x = 0.1; body.scale.set(1, 0.7, 1); g.add(body);
    const tailM = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.8), fur); tailM.position.set(-1.9, -0.05, 0); g.add(tailM);
    const billM = new THREE.MeshLambertMaterial({ color: 0x2c2a2a });
    const bill = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.62), billM); bill.position.set(1.85, -0.05, 0); g.add(bill);
    for (const dz of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.6), fur); f.position.set(0.8, -0.3, dz * 0.6); f.rotation.x = dz * 0.5; g.add(f); }
    // about 40,000 receptors in rows along the bill (Manger and Pettigrew 1995): a few dozen stand for them
    const pts = [];
    for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) for (const sy of [-1, 1]) pts.push([1.5 + i * 0.085, sy * 0.065, (r - 2) * 0.13]);
    const dots = receptorDots(pts, ACCENT); g.add(dots);
    const glow = glowSprite(0xbfff80, 0.9, 0.2); glow.position.set(1.9, 0, 0); g.add(glow);
    const tag = label('bill electroreceptors', { size: 18, pad: 3, color: '#cfe6b0' }); tag.userData.px = px(); tag.position.set(1.8, 0.75, 0); g.add(tag);
    return { g, dots, glow };
  }
  function buildKnifefish() {
    // a 20 cm Apteronotus at 6 cm off the floor, head +x; the skin points are kept in metres for the image
    const g = new THREE.Group(); g.position.y = 0.6;
    const skin = new THREE.MeshLambertMaterial({ color: 0x1c1a22 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skin); body.scale.set(1.0, 0.16, 0.09); g.add(body);
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.22), new THREE.MeshLambertMaterial({ color: 0x2a2838, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); fin.position.set(-0.2, -0.2, 0); g.add(fin);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); tip.position.set(-1.0, 0, 0); g.add(tip);
    const pts = [], skinM = [];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) {
      const u = -0.95 + 1.9 * (i + 0.5) / 12, ph = j / 8 * Math.PI * 2, rr = Math.sqrt(Math.max(0, 1 - u * u));
      const p = [u, Math.sin(ph) * 0.16 * rr, Math.cos(ph) * 0.09 * rr];
      pts.push(p); skinM.push([p[0] / U, (p[1] + 0.6) / U, p[2] / U]);
    }
    const dots = receptorDots(pts, new THREE.Color(0.7, 0.9, 1.0)); dots.material.uniforms.uImage.value = 1; g.add(dots);
    const tag = label('knifefish · own discharge', { size: 18, pad: 3, color: '#cfe6ff' }); tag.userData.px = px(); tag.position.set(-0.3, 0.62, 0); g.add(tag);
    return { g, dots, skinM };
  }
}

/* the creature sentences, one or two each; the facts come from the cards
   this instrument replaced, with their sources */
const TEXT = {
  shark: 'Ampullae of Lorenzini, jelly-filled pores over the snout, read dc fields down to about <b>5 nV/cm</b> (Kalmijn 1982). In Kalmijn’s tank a dogfish found a plaice hidden under sand or under agar from 15 cm, and lost it the moment a plastic film cut the field (Kalmijn 1971): the fish was found by its electricity, not its smell. The ray does the same from above the sand.',
  platypus: 'About 40,000 electroreceptors line the bill in rows (Manger and Pettigrew 1995), sensitive to roughly <b>50 µV/cm</b> (Scheich et al. 1986). The platypus hunts with eyes, ears and nostrils shut, reading the twitches of shrimp muscle and cross-checking with the bill’s touch receptors to judge distance. Freshwater and a threshold ten thousand times the shark’s make the reach a hand’s width.',
  knife: 'The black ghost knifefish makes its own field, a discharge near a kilohertz, and reads how nearby things bend it: a better conductor than the water (a worm, a metal rod) gathers the field lines into itself, a worse one (a stone) pushes them aside, and the skin reports the difference as an electric image. The image fades with the cube of the distance, so the sense reaches about a body length (von der Emde 1999). Drag the two spheres.',
};
