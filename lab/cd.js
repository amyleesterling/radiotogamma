/* B. THE CD — a diffraction grating that happens to hold music.
   3D disc with physically-based diffraction (three.js, loaded lazily);
   the original 2D canvas version remains as the non-WebGL fallback.
   Self-contained experiment for The Light Lab; plugs into window.LAB. */
(function () {
  'use strict';
  if (!window.LAB || !window.LAB.register) return;
  var TAU = Math.PI * 2, H = 380;
  var MONO = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function rgba(rgb, a) {
    return 'rgba(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' +
      Math.round(rgb[2] * 255) + ',' + a.toFixed(3) + ')';
  }
  function zoomText(f) {
    if (f < 0.01) return 'full disc';
    var s = Math.pow(10, f * 5);
    var p = Math.pow(10, Math.floor(Math.log(s) / Math.LN10));
    var v = Math.round(Math.round(s / p * 10) / 10 * p);   // two significant figures
    var txt = '×' + v.toLocaleString('en-US');
    if (f > 0.78) txt += ' — the grooves';
    return txt;
  }
  function makeControls(mount) {
    var controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML = '<label>Zoom into the surface <input type="range" min="0" max="1000" value="0"></label><span class="zoomlabel"></span>';
    mount.appendChild(controls);
    return controls;
  }
  // ---- shared zoom close-ups (used by the 2D fallback and the 3D overlay) --
  function drawMidView(ctx, api, W, a, f) {          // faint concentric arcs
    var t = Math.max(0, Math.min(1, (f - 0.28) / 0.5));
    var sp = 7 + 70 * t * t;                         // groove spacing grows as we dive
    var bigR = 900 + 2200 * t, cy = H / 2, oy = cy + bigR;
    var count = Math.ceil(H / sp) + 2;
    ctx.save();
    ctx.lineWidth = 1;
    for (var k = 0; k < count; k++) {
      var rad = bigR + cy - k * sp;
      var half = Math.asin(Math.min(1, (W / 2 + 30) / rad));
      var tint = api.strip.wavelengthRGB(380 + ((k * 89) % 371));
      var w = 0.3, al = a * (0.17 + 0.1 * Math.sin(k * 2.1));
      ctx.strokeStyle = 'rgba(' + Math.round(196 * (1 - w) + tint[0] * 255 * w) + ',' +
        Math.round(228 * (1 - w) + tint[1] * 255 * w) + ',' +
        Math.round(255 * (1 - w) + tint[2] * 255 * w) + ',' + al.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(W / 2, oy, rad, -Math.PI / 2 - half, -Math.PI / 2 + half);
      ctx.stroke();
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = '#8b98a8'; ctx.font = MONO; ctx.textAlign = 'center';
    ctx.fillText('not paint — structure. keep going.', W / 2, 26);
    ctx.restore();
  }
  function drawTracksView(ctx, api, W, a) {          // the diffraction cartoon
    function rot(x, y, an) { var c = Math.cos(an), s = Math.sin(an); return [x * c - y * s, x * s + y * c]; }
    ctx.save();
    ctx.globalAlpha = a;
    var sp = Math.min(120, Math.max(70, W / 7));
    var baseY = 236, midX = W / 2;
    ctx.font = MONO; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(196,228,255,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(midX - 2.9 * sp, baseY); ctx.lineTo(midX + 2.9 * sp, baseY); ctx.stroke();
    for (var i = -2; i <= 2; i++) {                  // the tracks, in cross-section
      ctx.beginPath(); ctx.arc(midX + i * sp, baseY, 8, Math.PI, 0);
      ctx.fillStyle = 'rgba(196,228,255,.18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(196,228,255,.5)'; ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(196,228,255,.45)';       // the 1.6 µm arrow
    ctx.beginPath();
    ctx.moveTo(midX + 12, baseY + 24); ctx.lineTo(midX + sp - 12, baseY + 24);
    ctx.moveTo(midX + 18, baseY + 20.5); ctx.lineTo(midX + 12, baseY + 24); ctx.lineTo(midX + 18, baseY + 27.5);
    ctx.moveTo(midX + sp - 18, baseY + 20.5); ctx.lineTo(midX + sp - 12, baseY + 24); ctx.lineTo(midX + sp - 18, baseY + 27.5);
    ctx.stroke();
    ctx.fillStyle = '#8b98a8';
    ctx.fillText('1.6 µm — a few wavelengths of light', midX, baseY + 52);
    ctx.fillText('one wave hits adjacent tracks; each color adds up at its own angle', midX, 26);
    var d = [0.42, 0.907];                           // incoming direction, down-right
    ctx.lineWidth = 1.4;
    for (var j = -1; j <= 1; j++) {                  // 3 parallel white rays
      var hx = midX + j * sp, hy = baseY - 8;
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.moveTo(hx - d[0] * 170, hy - d[1] * 170); ctx.lineTo(hx, hy); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    var out = [[650, -0.20], [550, -0.09], [470, 0]]; // red bends farthest
    for (var j2 = -1; j2 <= 1; j2++) {
      var hx2 = midX + j2 * sp, hy2 = baseY - 8;
      for (var c = 0; c < out.length; c++) {
        var v = rot(d[0], -d[1], out[c][1]);
        ctx.strokeStyle = rgba(api.strip.wavelengthRGB(out[c][0]), 0.85);
        ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.lineTo(hx2 + v[0] * 140, hy2 + v[1] * 140); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // ---- the original 2D implementation (fallback when WebGL is unavailable) -
  function init2D(mount, api) {
    var R = 110, HUB = 35, HOLE = 15, H2 = 320;
    var canvas = document.createElement('canvas');
    canvas.style.height = H2 + 'px';
    canvas.style.cursor = 'grab';
    canvas.setAttribute('aria-label', 'A CD in the dark, with a draggable lamp and a zoom slider');
    mount.appendChild(canvas);
    var controls = makeControls(mount);
    var zoomInput = controls.querySelector('input');
    var zoomLabel = controls.querySelector('.zoomlabel');
    var ctx = canvas.getContext('2d');
    var W = 860, dpr = 1, cx = W / 2, cy = H2 / 2;
    var lamp = { dx: 62, dy: -92 };                  // starts overhead, no rainbow
    var dragging = false, grabX = 0, grabY = 0, solvedDone = false, phase = 0, rafId = 0;
    function lampDist() { return Math.hypot(lamp.dx, lamp.dy); }
    function lampAngle() { return Math.atan2(lamp.dy, lamp.dx); }
    function quality() {                             // 0..1: how grazing-ish the lamp is
      var u = lampDist() / R;
      if (u <= 1.2 || u >= 2.5) return 0;
      return sm(Math.min((u - 1.2) / 0.4, (2.5 - u) / 0.5, 1));
    }
    function peakNm() {
      var u = Math.max(1.2, Math.min(2.5, lampDist() / R));
      return 380 + (u - 1.2) / 1.3 * 370;
    }
    function clampLamp() {
      var m = 22;
      lamp.dx = Math.max(m - cx, Math.min(W - m - cx, lamp.dx));
      lamp.dy = Math.max(m - cy, Math.min(H2 - m - cy, lamp.dy));
    }
    function zoomFrac() { return zoomInput.value / 1000; }
    function alphas(f) {
      return {
        disc: 1 - sm((f - 0.22) / 0.22),
        mid: sm((f - 0.26) / 0.18) * (1 - sm((f - 0.72) / 0.2)),
        tracks: sm((f - 0.74) / 0.2)
      };
    }
    function circle(r, alpha) {
      ctx.strokeStyle = 'rgba(196,228,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    }
    function wedge(center, sweep, r0, r1, style) {
      var da = sweep / 2;
      ctx.fillStyle = style;
      ctx.beginPath();
      ctx.arc(cx, cy, r1, center - da, center + da);
      ctx.arc(cx, cy, r0, center + da, center - da, true);
      ctx.closePath(); ctx.fill();
    }
    function drawSector(center, sweep, amp, flip) {
      var N = 64, r0 = HUB + 5, r1 = R - 4;
      for (var i = 0; i < N; i++) {
        var t = i / (N - 1);
        var nm = 380 + (flip ? 1 - t : t) * 370;
        var env = Math.pow(Math.sin(t * Math.PI), 0.65);
        var sh = (dragging && !api.reducedMotion) ? 0.82 + 0.18 * Math.sin(phase * 2.6 + t * 7) : 1;
        var a = 0.55 * amp * env * sh;
        if (a < 0.004) continue;
        wedge(center - sweep / 2 + t * sweep, sweep / N * 1.5, r0, r1, rgba(api.strip.wavelengthRGB(nm), a));
      }
    }
    function drawLamp(x, y, a) {
      var g = ctx.createRadialGradient(x, y, 2, x, y, 30);
      g.addColorStop(0, 'rgba(255,246,222,' + (0.75 * a).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,246,222,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,251,240,' + (0.95 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,246,222,' + (0.65 * a).toFixed(3) + ')';
      ctx.lineWidth = 1;
      for (var i = 0; i < 8; i++) {
        var an = i * TAU / 8 + 0.39;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(an) * 9.5, y + Math.sin(an) * 9.5);
        ctx.lineTo(x + Math.cos(an) * 15, y + Math.sin(an) * 15);
        ctx.stroke();
      }
    }
    function drawDiscView(a) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.arc(cx, cy, HUB, 0, TAU, true);
      ctx.fillStyle = 'rgba(196,228,255,' + (0.045 * a).toFixed(3) + ')';
      ctx.fill();
      ctx.lineWidth = 1;
      circle(R, 0.4 * a); circle(HUB, 0.3 * a); circle(HOLE, 0.22 * a);
      for (var r = HUB + 14; r < R - 6; r += 16) circle(r, 0.055 * a);
      ctx.globalCompositeOperation = 'lighter';
      var u = lampDist() / R;
      if (u < 1.35) {                                // straight-on light: plain glare, no colors
        var g = Math.min(1, (1.35 - u) / 0.35) * 0.11 * a;
        wedge(lampAngle(), 1.2, HUB + 5, R - 4, 'rgba(240,246,255,' + g.toFixed(3) + ')');
      }
      var q = quality();
      if (q > 0.001) {
        drawSector(lampAngle(), 1.7, q * a, false);
        drawSector(lampAngle() + Math.PI, 1.3, q * a * 0.35, true);
      }
      ctx.globalCompositeOperation = 'source-over';
      drawLamp(cx + lamp.dx, cy + lamp.dy, a);
      ctx.restore();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, W, H2);
      var A = alphas(zoomFrac());
      if (A.mid > 0.01) drawMidView(ctx, api, W, A.mid, zoomFrac());
      if (A.disc > 0.01) drawDiscView(A.disc);
      if (A.tracks > 0.01) drawTracksView(ctx, api, W, A.tracks);
    }
    function updateStrip() {
      var A = alphas(zoomFrac());
      var q = quality() * A.disc, pk = peakNm();
      if (A.tracks > 0.4) api.strip.light(function () { return 0.55; });
      else if (q > 0.03) api.strip.light(function (nm) {
        var g = Math.exp(-((nm - pk) * (nm - pk)) / (2 * 120 * 120));
        return Math.min(0.95, 0.15 + q * 0.78 * (0.45 + 0.55 * g));
      });
      else api.strip.light(null);
    }
    function toLocal(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function overLamp(p) { return Math.hypot(p.x - (cx + lamp.dx), p.y - (cy + lamp.dy)) <= 26; }
    canvas.addEventListener('pointerdown', function (e) {
      var p = toLocal(e);
      if (!overLamp(p)) return;
      dragging = true;
      grabX = cx + lamp.dx - p.x; grabY = cy + lamp.dy - p.y;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      canvas.style.cursor = 'grabbing';
      if (!api.reducedMotion && !rafId) {
        var tick = function () {
          phase = performance.now() / 1000;
          draw();
          rafId = dragging ? requestAnimationFrame(tick) : 0;
        };
        rafId = requestAnimationFrame(tick);
      }
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) {
        canvas.style.cursor = overLamp(toLocal(e)) ? 'grab' : 'default';
        return;
      }
      var p = toLocal(e);
      lamp.dx = p.x + grabX - cx; lamp.dy = p.y + grabY - cy;
      clampLamp();
      if (!solvedDone && quality() > 0.05) { solvedDone = true; api.solved(); }
      updateStrip();
      if (!rafId) draw();
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      canvas.style.cursor = 'grab';
      updateStrip(); draw();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    zoomInput.addEventListener('input', function () {
      zoomLabel.textContent = zoomText(zoomFrac());
      updateStrip(); draw();
    });
    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 40) return;
      W = rect.width;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H2 * dpr);
      cx = W / 2; cy = H2 / 2;
      clampLamp(); draw();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    zoomLabel.textContent = zoomText(0);
    resize();
  }
  // ---- the real thing: a 3D disc whose surface solves the grating equation -
  // Concentric tracks make the grating vector RADIAL: per fragment we take the
  // components of the light and view directions along the local radial unit
  // vector (sin of incidence / diffraction angles measured against the groove
  // direction) and solve d·(sin i − sin r) = mλ with d = 1.6 µm. Wavelengths
  // that land in 380–750 nm get added as spectral color — that IS the rainbow.
  var GLSL_WL = [                                    // shared shader chunk
    'vec3 wl2rgb(float nm){',                        // matches the JS approximation
    '  float r=0.,g=0.,b=0.,t;',
    '  if(nm<440.){t=(nm-380.)/60.;r=.35*(1.-t);b=1.;}',
    '  else if(nm<490.){t=(nm-440.)/50.;g=t;b=1.;}',
    '  else if(nm<510.){t=(nm-490.)/20.;g=1.;b=1.-t;}',
    '  else if(nm<580.){t=(nm-510.)/70.;r=t;g=1.;}',
    '  else if(nm<645.){t=(nm-580.)/65.;r=1.;g=1.-t;}',
    '  else r=1.;',
    '  float f=1.;',
    '  if(nm<420.)f=.4+.6*(nm-380.)/40.;',
    '  if(nm>700.)f=.4+.6*(750.-nm)/50.;',
    '  return vec3(r,g,b)*f;}',
    'float hash(float n){return fract(sin(n)*43758.5453);}'
  ].join('\n');
  var FRAG = [
    'varying vec3 vPos;',
    'uniform vec3 uLp, uCp;',
    'uniform sampler2D uEnv;',                       // equirect studio HDR (linear)
    'uniform float uEnvOn, uPitch, uStripe, uFlat;', // uPitch: track pitch in disc units
    'uniform mat3 uNorm;',                           // disc-local -> world rotation
    GLSL_WL,
    'void main(){',
    '  float r=length(vPos.xy);',
    '  vec2 rad=vPos.xy/max(r,1e-4);',               // grating vector: radial
    '  vec3 N=gl_FrontFacing?vec3(0.,0.,1.):vec3(0.,0.,-1.);',
    '  vec3 L=normalize(uLp-vPos), V=normalize(uCp-vPos);',
    '  float sinI=dot(L,vec3(rad,0.)), sinR=dot(V,vec3(rad,0.));',
    '  float ang=atan(vPos.y,vPos.x);',
    '  float grain=.9+.1*hash(floor(ang*700.)+floor(r*40.)*7.);', // faint radial groove noise
    '  float ndl=max(dot(N,L),0.), ndv=max(dot(N,V),0.);',
    '  vec3 col=vec3(.052,.056,.066);',              // dark plastic
    '  float lab=smoothstep(.475,.44,r);',           // label ring near the hub
    '  col=mix(col,vec3(.13,.135,.15),lab);',
    '  vec3 Hv=normalize(L+V);',
    '  float ndh=max(dot(N,Hv),0.);',
    '  col+=vec3(.9,.94,1.)*(pow(ndh,220.)*.9+pow(ndh,14.)*.10)*grain*(1.-.5*lab)*(1.-.5*uStripe);',
    '  float fres=.25+.75*pow(1.-ndv,2.);',          // Fresnel-ish weight
    '  vec3 Rw=uNorm*reflect(-V,N);',                // mirror the studio HDR off the disc
    '  vec2 euv=vec2(atan(Rw.z,Rw.x)/6.2831853+.5,acos(clamp(Rw.y,-1.,1.))/3.14159265);',
    '  vec3 env=texture2D(uEnv,euv).rgb;',
    '  col+=uEnvOn*(env/(1.+env))*(.05+.45*fres)*(1.-.55*lab)*(1.-.6*uStripe);', // tone-mapped
    '  float s=abs(sinI-sinR);',
    '  for(int m=1;m<=2;m++){',                      // diffraction orders ±1, ±2
    '    float lam=1600.*s/float(m);',               // d(sin i − sin r) = mλ, d=1.6 µm
    '    float win=smoothstep(380.,425.,lam)*(1.-smoothstep(690.,750.,lam));', // soft gamut window
    '    if(win>0.001) col+=wl2rgb(lam)*win*(.85/float(m))*fres*ndl*grain*(1.-lab)*(1.-.75*uStripe);',
    '  }',
    '  float tr=(mix(r,vPos.x,uFlat)-.68)/uPitch;',  // far-LOD stripes, phase-locked to the
    '  float wfr=max(fwidth(tr),1e-3);',             // micro patch; near the handoff they
    '  float lineF=abs(fract(tr+.5)-.5);',           // flatten from arcs to straight tracks
    '  float groove=(1.-smoothstep(.22-wfr,.22+wfr,lineF))*step(.001,uStripe);',
    '  col=mix(col,vec3(.028,.032,.04),groove*uStripe*.85);',
    '  col+=vec3(.30,.34,.42)*(1.-groove)*uStripe*.18*(.4+.6*ndl);',
    '  col*=.55+.45*grain;',
    '  gl_FragColor=vec4(col,1.);}'
  ].join('\n');
  var VERT = 'varying vec3 vPos;void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  // ---- micro-surface patch shader: real displaced pit geometry -------------
  // Positions are in µm (patch local); the mesh is uniformly scaled so one
  // 1.6 µm track pitch equals the zoom's implied pitch in disc units.
  var VERT2 = 'varying vec3 vPos;varying vec3 vNrm;void main(){vPos=position;vNrm=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  var FRAG2 = [
    'varying vec3 vPos;varying vec3 vNrm;',
    'uniform vec3 uLp, uCp;',
    'uniform sampler2D uEnv;',
    'uniform float uEnvOn, uFade;',
    'uniform mat3 uNorm;',                           // patch-local -> world (uniform scale)
    GLSL_WL,
    'void main(){',
    '  vec3 N=normalize(vNrm);',
    '  if(!gl_FrontFacing)N=-N;',
    '  vec3 L=normalize(uLp-vPos), V=normalize(uCp-vPos);',
    '  float ndl=max(dot(N,L),0.), ndv=max(dot(N,V),0.);',
    '  vec3 Hv=normalize(L+V);',
    '  float ndh=max(dot(N,Hv),0.);',
    '  float fres=.25+.75*pow(1.-ndv,2.);',
    '  vec3 col=vec3(.05,.054,.064)+vec3(.07,.075,.09)*ndl;', // aluminum, lit + shadowed
    '  col+=vec3(.95,.97,1.)*pow(ndh,110.)*.9;',     // glints off pit walls and edges
    '  vec3 Rw=normalize(uNorm*reflect(-V,N));',     // same studio HDR as the full disc
    '  vec2 euv=vec2(atan(Rw.z,Rw.x)/6.2831853+.5,acos(clamp(Rw.y,-1.,1.))/3.14159265);',
    '  vec3 env=texture2D(uEnv,euv).rgb;',
    '  col+=uEnvOn*(env/(1.+env))*(.07+.45*fres);',
    '  float s=abs(dot(L,vec3(1.,0.,0.))-dot(V,vec3(1.,0.,0.)));', // iridescence remnant:
    '  float lam=1600.*s;',                          // +X is the grating (radial) direction
    '  float win=smoothstep(380.,425.,lam)*(1.-smoothstep(690.,750.,lam));',
    '  col+=wl2rgb(lam)*win*.10*fres;',
    '  gl_FragColor=vec4(col,uFade);}'
  ].join('\n');
  // Seeded pit heightfield in µm. Real CD numbers: track pitch 1.6, pit width
  // ~0.5, depth ~0.11, run lengths ~0.83-3.05 (3T-11T). Each 2.4 µm cell of a
  // track carries one hashed pit; the hash is a pure function of (track, cell)
  // so the landscape is stable frame to frame. `soft` widens edge ramps to the
  // mesh resolution of each LOD (a cheap low-pass so coarse LODs don't alias).
  var PIT_SEED = 7.31;
  function prand(n) { var v = Math.sin(n * 12.9898 + PIT_SEED) * 43758.5453; return v - Math.floor(v); }
  function pitHeight(x, y, soft) {
    var ti = Math.round(x / 1.6), dx = x - ti * 1.6; // nearest track + offset across it
    var ax = 1 - sm((Math.abs(dx) - 0.17) / (0.08 + soft));
    if (ax <= 0.001) return 0;                       // on the flat land between tracks
    var C = 2.4, ci = Math.floor(y / C), u = y - ci * C;
    var h1 = prand(ti * 3.7 + ci * 11.93), h2 = prand(ti * 7.31 + ci * 5.17 + 99.7);
    var len = 0.83 + h1 * 1.05;                      // this cell's pit length (~3T-7T)
    var start = 0.15 + (C - len - 0.3) * h2;
    var ay = sm((u - start) / (0.09 + soft)) * (1 - sm((u - start - len) / (0.09 + soft)));
    return -0.11 * ax * ay;                          // pressed ~0.11 µm into the surface
  }
  function init3D(mount, api, THREE, HDR) {
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    var W = 860, dpr = Math.min(2, window.devicePixelRatio || 1);
    var canvas = renderer.domElement;
    canvas.style.height = H + 'px';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.setAttribute('aria-label', 'A 3D CD you can tilt, with a draggable light and a zoom slider');
    mount.appendChild(canvas);
    var overlay = document.createElement('canvas'); // labels only; the surface stays 3D
    overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:' + H + 'px;pointer-events:none;opacity:0;border:0;background:transparent;';
    mount.appendChild(overlay);
    var octx = overlay.getContext('2d');
    var controls = makeControls(mount);
    var zoomInput = controls.querySelector('input');
    var zoomLabel = controls.querySelector('.zoomlabel');
    renderer.setClearColor(0x05070c, 1);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, W / H, 0.01, 30);
    camera.position.set(0, 0.55, 3.1);
    camera.lookAt(0, 0, 0);
    var blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blackTex.needsUpdate = true;                     // placeholder until the HDR arrives
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uLp: { value: new THREE.Vector3() }, uCp: { value: new THREE.Vector3() },
        uEnv: { value: blackTex }, uEnvOn: { value: 0 },
        uPitch: { value: 1 }, uStripe: { value: 0 }, uFlat: { value: 0 },
        uNorm: { value: new THREE.Matrix3() }
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide
    });
    if (HDR && HDR.HDRLoader) {                      // real studio environment (CC0 Poly Haven)
      try {                                          // URL resolves against the PAGE (site root)
        new HDR.HDRLoader().load('env/studio_small_03_1k.hdr', function (tex) {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          mat.uniforms.uEnv.value = tex;
          mat.uniforms.uEnvOn.value = 1;
          patchMat.uniforms.uEnv.value = tex;        // same studio, same metal
          patchMat.uniforms.uEnvOn.value = 1;
          render();
        }, undefined, function () { /* keep analytic lighting */ });
      } catch (err) { /* keep analytic lighting */ }
    }
    var group = new THREE.Group();
    group.rotation.order = 'YXZ';
    group.rotation.x = -0.62;                        // pitch; yaw is rotation.y
    group.add(new THREE.Mesh(new THREE.RingGeometry(0.32, 1, 160, 1), mat)); // hub hole ~0.32 R
    scene.add(group);
    var edge = new THREE.Mesh(                       // whisper of a rim so the shape reads
      new THREE.RingGeometry(1.0, 1.022, 160, 1),
      new THREE.MeshBasicMaterial({ color: 0x1d2733, side: THREE.DoubleSide }));
    group.add(edge);
    // ---- micro-surface: displaced pit geometry at the dive target ----------
    // Three static LODs (one visible at a time, ~100k tris each) sitting
    // tangent to the disc at local (0.68, 0, 0); patch +X = radial (across
    // tracks), +Y = along the track. Curvature is negligible at this scale
    // (0.1 µm sag over a 100 µm patch on a 41 mm radius).
    var patchMat = new THREE.ShaderMaterial({
      uniforms: {
        uLp: { value: new THREE.Vector3() }, uCp: { value: new THREE.Vector3() },
        uEnv: { value: blackTex }, uEnvOn: { value: 0 },
        uFade: { value: 0 }, uNorm: { value: new THREE.Matrix3() }
      },
      vertexShader: VERT2, fragmentShader: FRAG2, side: THREE.DoubleSide,
      transparent: true, polygonOffset: true, polygonOffsetFactor: -1
    });
    var patches = null;                              // built on first dive past the handoff
    function buildPatch(extentUm, seg) {
      var geo = new THREE.PlaneGeometry(extentUm, extentUm, seg, seg);
      var pos = geo.attributes.position, soft = extentUm / seg * 0.9;
      for (var i = 0; i < pos.count; i++) pos.setZ(i, pitHeight(pos.getX(i), pos.getY(i), soft));
      geo.computeVertexNormals();
      var mesh = new THREE.Mesh(geo, patchMat);
      mesh.visible = false;
      group.add(mesh);
      return mesh;
    }
    function ensurePatches() {
      if (!patches) patches = [                      // [min zoom f, mesh]; ~100k tris each
        [0, buildPatch(128, 224)],                   // 0.57 µm mesh step
        [0.84, buildPatch(48, 224)],                 // 0.21 µm
        [0.935, buildPatch(16, 224)]                 // 0.07 µm — pits ~7 segments wide
      ];
      return patches;
    }
    // the little light: a glowing sprite orbiting a hemisphere above the disc
    var spr = document.createElement('canvas'); spr.width = spr.height = 64;
    var sctx = spr.getContext('2d');
    var g = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,251,240,1)'); g.addColorStop(0.25, 'rgba(255,246,222,.8)'); g.addColorStop(1, 'rgba(255,246,222,0)');
    sctx.fillStyle = g; sctx.fillRect(0, 0, 64, 64);
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(spr), transparent: true, depthTest: false }));
    sprite.scale.set(0.34, 0.34, 1);
    scene.add(sprite);
    var lightAz = 0.9, lightEl = 0.42, LR = 1.3;     // azimuth, elevation, orbit radius
    function lightPos() {
      return new THREE.Vector3(
        LR * Math.cos(lightEl) * Math.sin(lightAz),
        LR * Math.sin(lightEl),
        LR * Math.cos(lightEl) * Math.cos(lightAz));
    }
    var inv = new THREE.Matrix4(), tmp = new THREE.Vector3(), tgt = new THREE.Vector3();
    var DIR0 = new THREE.Vector3(0, 0.55, 3.1).normalize();
    var PITCH0 = 1.6e-6 / 0.06;                      // 1.6 µm track pitch, disc radius ≈ 60 mm
    // The zoom slider is a real camera dive toward a fixed surface point. The
    // dolly covers ~1.4 orders of magnitude; the rest of the ~5 orders is a
    // procedural LOD: the shader's track pitch is inflated by the residual
    // factor so on-screen spacing matches the total implied magnification.
    function zoomState() {
      var f = zoomInput.value / 1000;
      var dolly = 3.2 * Math.pow(0.04, f);           // geometric part of the dive
      var pitchU = PITCH0 * Math.pow(10, 4.55 * f) * dolly / 3.2;
      var pitchPx = pitchU * H / (2 * dolly * Math.tan(camera.fov * Math.PI / 360));
      var stripe = pitchPx < 1.5 ? 0 : sm((Math.log10(pitchPx) - 0.25) / 0.65);
      return { f: f, dolly: dolly, pitchU: pitchU, pitchPx: pitchPx, stripe: stripe };
    }
    function render() {
      sprite.position.copy(lightPos());
      var z = zoomState();
      // LOD handoff: past ~×600 the pit patch fades in over the (phase-locked)
      // far stripes; its uniform scale makes 1.6 µm exactly z.pitchU disc
      // units, so stripe spacing is continuous through the handoff.
      var pf = sm((z.f - 0.74) / 0.08), active = null;
      if (pf > 0.001) {
        var ps = ensurePatches(), s = z.pitchU / 1.6;
        for (var i = 0; i < ps.length; i++) {
          ps[i][1].visible = false;
          if (z.f >= ps[i][0]) active = ps[i][1];
        }
        active.visible = true;
        active.scale.set(s, s, s);
        active.position.set(0.68, 0, 0.05 * s);      // a hair above the flat ring
        patchMat.uniforms.uFade.value = pf;
      } else if (patches) {
        for (var j = 0; j < patches.length; j++) patches[j][1].visible = false;
      }
      group.updateMatrixWorld(true);
      tgt.set(0.68, 0, 0).applyMatrix4(group.matrixWorld)
        .multiplyScalar(sm(Math.min(1, z.f * 1.6))); // narrowing target of the dive
      camera.position.copy(tgt).addScaledVector(DIR0, z.dolly);
      camera.lookAt(tgt);
      sprite.material.opacity = 1 - sm((z.f - 0.45) / 0.25);
      mat.uniforms.uPitch.value = z.pitchU;
      mat.uniforms.uStripe.value = z.stripe;
      mat.uniforms.uFlat.value = pf;
      mat.uniforms.uNorm.value.setFromMatrix4(group.matrixWorld);
      inv.copy(group.matrixWorld).invert();          // disc shader: disc-local space
      mat.uniforms.uLp.value.copy(sprite.position).applyMatrix4(inv);
      mat.uniforms.uCp.value.copy(camera.position).applyMatrix4(inv);
      if (active) {                                  // patch shader: patch-local µm space
        inv.copy(active.matrixWorld).invert();
        patchMat.uniforms.uLp.value.copy(sprite.position).applyMatrix4(inv);
        patchMat.uniforms.uCp.value.copy(camera.position).applyMatrix4(inv);
        patchMat.uniforms.uNorm.value.setFromMatrix4(active.matrixWorld);
      }
      renderer.render(scene, camera);
    }
    // ---- JS-side physics sampling (no pixel reads): ~8 disc points ---------
    function sampleLambdas() {
      var Lp = mat.uniforms.uLp.value, Cp = mat.uniforms.uCp.value, out = [];
      for (var k = 0; k < 8; k++) {
        var a = k * TAU / 8, px = 0.68 * Math.cos(a), py = 0.68 * Math.sin(a);
        var Lx = Lp.x - px, Ly = Lp.y - py, Lz = Lp.z, Ln = Math.hypot(Lx, Ly, Lz);
        var Vx = Cp.x - px, Vy = Cp.y - py, Vz = Cp.z, Vn = Math.hypot(Vx, Vy, Vz);
        var sinI = (Lx * Math.cos(a) + Ly * Math.sin(a)) / Ln;
        var sinR = (Vx * Math.cos(a) + Vy * Math.sin(a)) / Vn;
        var facing = (Lz / Ln) * (Vz / Vn);          // >0: light and eye on the same side
        var s = Math.abs(sinI - sinR);
        for (var m = 1; m <= 2; m++) {
          var lam = 1600 * s / m;                    // same grating equation as the shader
          if (lam > 380 && lam < 750 && facing > 0.02) out.push(lam);
        }
      }
      return out;
    }
    var solvedDone = false;
    function updateStrip() {                         // called only from interaction handlers
      if (zoomState().stripe > 0.5) { api.strip.light(function () { return 0.55; }); return; }
      var lams = sampleLambdas();
      if (!lams.length) { api.strip.light(null); return; }
      if (!solvedDone) { solvedDone = true; api.solved(); }
      api.strip.light(function (nm) {
        var w = 0.15;                                // baseline + 0.9-weight neighborhoods
        for (var i = 0; i < lams.length; i++) {
          var d = nm - lams[i];
          w = Math.max(w, 0.15 + 0.9 * Math.exp(-d * d / (2 * 30 * 30)));
        }
        return Math.min(0.95, w);
      });
    }
    // ---- max-zoom overlay: measurement label over the (still 3D) surface ---
    function proj(v) { tmp.copy(v).project(camera); return [(tmp.x * 0.5 + 0.5) * W, (-tmp.y * 0.5 + 0.5) * H]; }
    function drawOverlay() {
      var z = zoomState();
      var a = sm((z.f - 0.82) / 0.13);
      overlay.style.opacity = a.toFixed(3);
      if (a < 0.01) return;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, W, H);
      octx.font = MONO; octx.textAlign = 'center'; octx.fillStyle = '#8b98a8';
      octx.fillText('one wave hits adjacent tracks; each color adds up at its own angle', W / 2, 26);
      octx.fillText('1.6 µm — a few wavelengths of light', W / 2, H - 24);
      // measure one real track pitch: project the radial pitch vector to screen
      var s0 = proj(tgt.set(0.68, 0, 0).applyMatrix4(group.matrixWorld));
      var s1 = proj(tgt.set(0.68 + z.pitchU, 0, 0).applyMatrix4(group.matrixWorld));
      var dx = s1[0] - s0[0], dy = s1[1] - s0[1], len = Math.hypot(dx, dy);
      if (len > 10 && len < W) {
        var px = -dy / len, py = dx / len;           // perpendicular (end caps)
        octx.strokeStyle = 'rgba(196,228,255,.75)'; octx.lineWidth = 1;
        octx.beginPath();
        octx.moveTo(s0[0], s0[1]); octx.lineTo(s1[0], s1[1]);
        octx.moveTo(s0[0] + px * 9, s0[1] + py * 9); octx.lineTo(s0[0] - px * 9, s0[1] - py * 9);
        octx.moveTo(s1[0] + px * 9, s1[1] + py * 9); octx.lineTo(s1[0] - px * 9, s1[1] - py * 9);
        octx.stroke();
      }
      // tiny ray diagram: one white wave in, three colors out at their angles
      var ox = W * 0.2, oy = H * 0.62;
      octx.lineWidth = 1.4;
      octx.strokeStyle = 'rgba(255,255,255,.7)';
      octx.beginPath(); octx.moveTo(ox - 52, oy - 84); octx.lineTo(ox, oy); octx.stroke();
      octx.globalCompositeOperation = 'lighter';
      var out = [[650, 0.62], [550, 0.44], [470, 0.28]]; // red bends farthest
      for (var c = 0; c < out.length; c++) {
        var th = -Math.PI / 2 + out[c][1];
        octx.strokeStyle = rgba(api.strip.wavelengthRGB(out[c][0]), 0.85);
        octx.beginPath(); octx.moveTo(ox, oy);
        octx.lineTo(ox + Math.cos(th) * 92, oy + Math.sin(th) * 92);
        octx.stroke();
      }
      octx.globalCompositeOperation = 'source-over';
    }
    // ---- interaction: drag tilts the disc, or grabs the light --------------
    var dragging = 0;                                // 0 none, 1 tilt, 2 light
    var lastX = 0, lastY = 0, vx = 0, vy = 0, rafId = 0, settleT = 0;
    function lightScreenXY() {
      tmp.copy(sprite.position).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * W, y: (-tmp.y * 0.5 + 0.5) * H };
    }
    function loop() {
      rafId = requestAnimationFrame(function tick() {
        if (!dragging) {                             // <0.5 s inertia settle
          var dt = (performance.now() - settleT) / 1000;
          if (api.reducedMotion || dt > 0.45 || (Math.abs(vx) + Math.abs(vy)) < 0.02) { rafId = 0; render(); drawOverlay(); return; }
          group.rotation.y += vx * 0.016;
          group.rotation.x = Math.max(-1.22, Math.min(1.22, group.rotation.x + vy * 0.016));
          vx *= 0.9; vy *= 0.9;
        }
        render();
        rafId = requestAnimationFrame(tick);
      });
    }
    function toLocal(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointerdown', function (e) {
      var p = toLocal(e), ls = lightScreenXY();
      dragging = (zoomState().f < 0.5 && Math.hypot(p.x - ls.x, p.y - ls.y) < 30) ? 2 : 1;
      lastX = p.x; lastY = p.y; vx = vy = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      canvas.style.cursor = 'grabbing';
      if (!rafId) loop();
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var p = toLocal(e), dx = p.x - lastX, dy = p.y - lastY;
      lastX = p.x; lastY = p.y;
      if (dragging === 2) {                          // move the light on its hemisphere
        lightAz += dx * 0.012;
        lightEl = Math.max(0.1, Math.min(0.62, lightEl - dy * 0.006)); // stays on screen
      } else {                                       // tilt the disc: clamped pitch, free yaw
        group.rotation.y += dx * 0.008; vx = dx * 0.5;
        group.rotation.x = Math.max(-1.22, Math.min(1.22, group.rotation.x + dy * 0.008)); vy = dy * 0.5;
      }
      render();                                      // uniforms fresh before sampling
      drawOverlay();                                 // measurement follows the tilt
      updateStrip();
    });
    function endDrag() {
      if (!dragging) return;
      dragging = 0;
      canvas.style.cursor = 'grab';
      settleT = performance.now();
      if (api.reducedMotion) { vx = vy = 0; }
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    zoomInput.addEventListener('input', function () {
      zoomLabel.textContent = zoomText(zoomInput.value / 1000);
      render(); drawOverlay(); updateStrip();
    });
    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 40) return;
      W = rect.width;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      canvas.style.width = '100%'; canvas.style.height = H + 'px';
      overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      render(); drawOverlay();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    zoomLabel.textContent = zoomText(0);
    resize();
  }
  // ---- registration: try 3D lazily, fall back to the 2D version ------------
  window.LAB.register({
    id: 'cd',
    title: 'B. THE CD',
    goal: 'THERE IS A RAINBOW HIDING IN THIS OBJECT. FIND IT.',
    question: {
      text: 'A CD has no colored pigment. Where does its rainbow come from?',
      choices: ['Microscopic colored material', 'Reflection from the room', 'A tiny repeating structure', 'Magic, obviously'],
      reveal: 'A tiny repeating structure. The data track spirals around the disc with a spacing of 1.6 micrometers — a few wavelengths of light — and that regular spacing reflects each wavelength constructively at a slightly different angle. The disc is a diffraction grating that happens to hold music.'
    },
    hint: 'Drag the lamp around the disc. When the rainbow appears, use the zoom slider to dive into the surface and find out why.',
    init: function (mount, api) {
      mount.style.position = 'relative';
      var note = document.createElement('p');
      note.textContent = 'loading the disc…';
      note.style.cssText = 'font:' + MONO + ';color:#8b98a8;opacity:.55;margin:6px 0;';
      mount.appendChild(note);
      Promise.all([
        import('../vendor/three/three.module.min.js'),
        import('../vendor/three/HDRLoader.js').catch(function () { return null; })
      ]).then(function (mods) {
        note.remove();
        init3D(mount, api, mods[0], mods[1]);        // throws if WebGL is unavailable
      }).catch(function () {
        while (mount.firstChild) mount.removeChild(mount.firstChild);
        init2D(mount, api);
      });
    }
  });
})();
