/* E. SOAP FILM — thin-film interference: no pigment, no prism, no grating.
   Two reflections, one from the front of the film and one from the back, a
   few hundred nanometres apart. For each wavelength the extra trip either
   lands the second reflection in step with the first (the colour shows) or
   out of step (it cancels). The film is only a few wavelengths thick, so its
   colours are its thickness made visible; as it drains and thins past what
   any wavelength can survive, it goes black, then pops.
   Self-contained experiment for The Light Lab; plugs into window.LAB. */
(function () {
  'use strict';
  if (!window.LAB || !window.LAB.register) return;
  var TAU = Math.PI * 2, H = 380, N_FILM = 1.33;
  var MONO = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  window.LAB.register({
    id: 'film',
    title: 'E. SOAP FILM',
    goal: 'NO PIGMENT, NO PRISM, NO GRATING. WHERE DO THE COLOURS COME FROM?',
    question: {
      text: 'A soap bubble has no pigment. Where do its swirling colours come from?',
      choices: ['Oil in the soap, floating on the water',
                'Two reflections, front and back of the film, in and out of step',
                'The film splits light like a tiny prism',
                'The colours of the room, reflected'],
      answer: 1,
      reveal: 'Two reflections, one from the front of the film and one from the back, a few hundred nanometres apart. For some wavelengths the extra trip puts the second reflection in step with the first and that colour shows; for others it lands out of step and cancels. The film is only a few wavelengths thick, so its colours are its thickness made visible. As it drains and thins past about 30 nm, every colour cancels at once and the film goes black, moments before it pops.'
    },
    hint: 'Move over the film to read its thickness. Tilt the wand with the slider and watch every colour slide toward blue. Let it drain: the black spreading from the top is the film going thinner than any wavelength can survive, moments before it pops.',
    init: init
  });

  function init(mount, api) {
    var canvas = document.createElement('canvas');
    canvas.style.height = H + 'px';
    canvas.style.cursor = 'crosshair';
    canvas.setAttribute('aria-label', 'A soap film in a wire wand, draining and swirling with interference colours');
    mount.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML =
      '<label>Tilt the wand <input type="range" min="0" max="70" value="0" aria-label="Viewing angle, degrees from face-on"></label>' +
      '<span class="num" id="filmAngle">0°</span>' +
      '<button type="button" id="filmNew">BLOW A NEW FILM</button>' +
      '<button type="button" id="filmPause" aria-pressed="false">HOLD THE DRAIN</button>';
    mount.appendChild(controls);
    var angleIn = controls.querySelector('input'), angleOut = controls.querySelector('#filmAngle');
    var newBtn = controls.querySelector('#filmNew'), pauseBtn = controls.querySelector('#filmPause');

    var W = 860, dpr = 1, cx = W / 2, cy = H * 0.5, R = 150;
    var tau = api.reducedMotion ? 9 : 0;             // seconds of draining
    var held = false, popped = 0, rafId = 0, onScreen = true, lastNow = 0;
    var pointer = null, solvedDone = false;
    var cosT = 1;                                    // cos of the angle inside the film

    // ---- the colour of a film, by thickness: a lookup, rebuilt per tilt -----
    // Reflectance of the two-beam film for each wavelength: the front
    // reflection flips phase and the back one does not, so the two add as
    // 1 - e^(i delta) with delta = 4 pi n t cos(theta_t) / lambda, which is
    // 4 sin^2(delta / 2): zero at zero thickness (the black film), peaks where
    // 2 n t cos(theta_t) = (m + 1/2) lambda. Integrated over the visible band
    // with the strip's wavelength-to-colour weights, Newton's sequence falls out of it:
    // black, silver, straw, magenta, blue, green, and then paler and paler as
    // the orders crowd together and white light's colours blur back to grey.
    var LUT_MAX = 2400, LUT_STEP = 2, lut = new Float32Array((LUT_MAX / LUT_STEP + 1) * 3);
    var WL = [], WRGB = [], wsum = [0, 0, 0];
    for (var nm = 380; nm <= 750; nm += 5) {
      var c = api.strip.wavelengthRGB(nm);
      WL.push(nm); WRGB.push(c);
      wsum[0] += c[0]; wsum[1] += c[1]; wsum[2] += c[2];
    }
    function reflect(t, nm) {                        // 0..1, two-beam film
      var s = Math.sin(2 * Math.PI * N_FILM * t * cosT / nm);
      return s * s;
    }
    function buildLUT() {
      for (var i = 0; i <= LUT_MAX / LUT_STEP; i++) {
        var t = i * LUT_STEP, r = 0, g = 0, b = 0;
        for (var k = 0; k < WL.length; k++) {
          var rf = reflect(t, WL[k]);
          r += rf * WRGB[k][0]; g += rf * WRGB[k][1]; b += rf * WRGB[k][2];
        }
        // the physics gives pale colours on an sRGB screen; a modest boost of
        // saturation, around the same grey, keeps the sequence but lets it
        // read the way a film does to the eye against a dark room
        r /= wsum[0]; g /= wsum[1]; b /= wsum[2];
        var mean = (r + g + b) / 3, k = 1.45;
        lut[i * 3] = Math.max(0, Math.min(1, mean + (r - mean) * k));
        lut[i * 3 + 1] = Math.max(0, Math.min(1, mean + (g - mean) * k));
        lut[i * 3 + 2] = Math.max(0, Math.min(1, mean + (b - mean) * k));
      }
    }
    function setAngle(deg) {
      var s = Math.sin(deg * Math.PI / 180) / N_FILM;
      cosT = Math.sqrt(Math.max(0, 1 - s * s));
      angleOut.textContent = Math.round(deg) + '°';
      buildLUT();
    }
    setAngle(0);

    // ---- the film's thickness field, in nm -----------------------------------
    // A gravity wedge (thin at the top, thick at the bottom) that drains with
    // time, a slow swirl riding on it, and a black front descending from the
    // top once the crown is thinner than any visible wavelength can reflect.
    function thickness(u, v, t) {                    // u,v in -1..1 across the wand
      // a fresh film is a few hundred nm at the crown and about a micron at
      // the foot: the vivid first three orders of Newton's sequence
      var top = 520 * Math.exp(-t / 9), bot = 1150 * Math.exp(-t / 45) + 240;
      var s = (v + 1) / 2;                           // 0 top .. 1 bottom
      var base = top + (bot - top) * Math.pow(s, 1.7);
      var rr = Math.sqrt(u * u + v * v), an = Math.atan2(v, u);
      var sw = Math.sin(3.1 * u + t * 0.35 + Math.sin(2.2 * v - t * 0.27)) *
               Math.sin(2.6 * v - t * 0.22 + Math.cos(3.4 * u + t * 0.19)) * 0.5 +
               Math.sin(6.5 * u - 5.1 * v + t * 0.5) * 0.18 +
               Math.sin(3 * an + 4 * rr - t * 0.45) * 0.35 * rr * (1 - rr); // a slow vortex
      var th = base * (1 + 0.22 * sw);
      // the black film: the crown thins past ~30 nm and the front creeps down
      var front = sm((t - 10) / 14) * 0.55;          // how far down the black has crept
      var blk = 1 - sm((s - front + 0.06 + 0.05 * sw) / 0.08);
      return Math.max(0, th * (1 - 0.985 * blk) + 12 * blk);
    }

    // ---- painting ------------------------------------------------------------
    var off = document.createElement('canvas'), octx = off.getContext('2d'), img = null, OW = 0, OH = 0;
    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
      var vg = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.6);
      vg.addColorStop(0, 'rgba(20,28,40,.35)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (!popped) {
        // the film itself, at half resolution, then smoothed up
        var half = 0.5, ow = Math.round(W * half), oh = Math.round(H * half);
        if (ow !== OW || oh !== OH) { OW = ow; OH = oh; off.width = ow; off.height = oh; img = octx.createImageData(ow, oh); }
        var data = img.data, rr = R * half, ccx = cx * half, ccy = cy * half;
        var maxI = LUT_MAX / LUT_STEP;
        for (var y = 0; y < oh; y++) {
          var dy = (y - ccy) / rr;
          for (var x = 0; x < ow; x++) {
            var dx = (x - ccx) / rr, q = dx * dx + dy * dy, o = (y * ow + x) * 4;
            if (q > 1) { data[o + 3] = 0; continue; }
            var th = thickness(dx, dy, tau);
            var i = Math.min(maxI, Math.round(th / LUT_STEP)) * 3;
            // a window reflected in the film, up and to the left, with a
            // softer second pane low on the right: the light that makes the colours
            var win = 0.5 + 0.5 * sm((dx + 1.0) / 0.55) * (1 - sm((dx + 0.05) / 0.5)) * sm((dy + 1.0) / 0.5) * (1 - sm((dy + 0.1) / 0.5)) +
                      0.2 * Math.exp(-((dx - 0.45) * (dx - 0.45) * 4 + (dy - 0.5) * (dy - 0.5) * 6));
            var rim = 1 - 0.3 * sm((q - 0.8) / 0.2);
            data[o] = Math.min(255, 255 * lut[i] * win * rim);
            data[o + 1] = Math.min(255, 255 * lut[i + 1] * win * rim);
            data[o + 2] = Math.min(255, 255 * lut[i + 2] * win * rim);
            data[o + 3] = 255;
          }
        }
        octx.putImageData(img, 0, 0);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, 0, 0, W, H);
        ctx.restore();
      }
      // the wand: a metal ring with a handle off to the lower right
      ctx.save();
      ctx.lineWidth = 7;
      var mg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      mg.addColorStop(0, '#aeb8c4'); mg.addColorStop(0.5, '#5c6774'); mg.addColorStop(1, '#c8d0da');
      ctx.strokeStyle = mg;
      ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(cx, cy, R + 5.5, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
      ctx.lineWidth = 9; ctx.strokeStyle = mg; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + (R + 5) * 0.72, cy + (R + 5) * 0.72);
      ctx.lineTo(cx + R * 1.55, cy + R * 1.55); ctx.stroke();
      ctx.restore();
      if (popped) {
        ctx.fillStyle = 'rgba(207,230,230,' + (0.9 * Math.max(0, 1 - (now - popped) / 1500)).toFixed(3) + ')';
        ctx.font = '600 15px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('pop.', cx, cy + 6);
      }
      // the thickness readout follows the pointer
      if (pointer && !popped) {
        var pu = (pointer.x - cx) / R, pv = (pointer.y - cy) / R;
        if (pu * pu + pv * pv <= 1) {
          var t = thickness(pu, pv, tau);
          var lines = describe(t);
          ctx.font = MONO; ctx.textAlign = 'left';
          var bw = 0; for (var li = 0; li < lines.length; li++) bw = Math.max(bw, ctx.measureText(lines[li]).width);
          var bx = Math.min(W - bw - 22, Math.max(10, pointer.x + 16)), by = Math.max(10, Math.min(H - 16 * lines.length - 18, pointer.y - 30));
          ctx.fillStyle = 'rgba(5,7,12,.85)'; ctx.fillRect(bx, by, bw + 14, 16 * lines.length + 8);
          ctx.strokeStyle = 'rgba(196,228,255,.25)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw + 13, 16 * lines.length + 7);
          for (var lj = 0; lj < lines.length; lj++) {
            ctx.fillStyle = lj === 0 ? '#eff4fb' : '#9aa2b1';
            ctx.fillText(lines[lj], bx + 7, by + 16 + lj * 16);
          }
          ctx.strokeStyle = 'rgba(239,244,251,.6)'; ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 5, 0, TAU); ctx.stroke();
        }
      }
    }
    // which colours a film of thickness t sends back, and which it swallows
    function describe(t) {
      if (t < 40) return ['film here: ' + Math.round(t) + ' nm', 'thinner than any visible wave can', 'survive: every colour cancels. black.'];
      var path = 2 * N_FILM * t * cosT, on = [], off2 = [];
      for (var m = 0; m < 8; m++) {
        var lc = path / (m + 0.5); if (lc >= 380 && lc <= 750) on.push(Math.round(lc));
        if (m >= 1) { var ld = path / m; if (ld >= 380 && ld <= 750) off2.push(Math.round(ld)); }
      }
      var name = function (nm) { return nm < 450 ? 'violet' : nm < 495 ? 'blue' : nm < 570 ? 'green' : nm < 590 ? 'yellow' : nm < 620 ? 'orange' : 'red'; };
      var l1 = 'film here: ' + Math.round(t) + ' nm  ·  round trip ' + Math.round(path) + ' nm';
      var l2 = on.length ? 'in step, shows: ' + on.map(function (n) { return n + ' nm ' + name(n); }).join(', ') : 'in step: nothing in the visible band';
      var l3 = off2.length ? 'out of step, cancels: ' + off2.map(function (n) { return n + ' nm ' + name(n); }).join(', ') : 'out of step: nothing visible cancels';
      return [l1, l2, l3];
    }

    // ---- time: draining, popping, refilling ----------------------------------
    function step(now) {
      if (!lastNow) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
      if (!held && !popped && !api.reducedMotion) tau += dt;
      if (!popped && tau > 34) { popped = now; api.strip.reset(); }
      if (popped && now - popped > 2200) { popped = 0; tau = 0; }
      draw(now);
    }
    function active() { return onScreen && !document.hidden && !api.reducedMotion; }
    function loop() {
      if (rafId) return;
      rafId = requestAnimationFrame(function tick(now) {
        step(now);
        rafId = active() ? requestAnimationFrame(tick) : 0;
        if (!rafId) lastNow = 0;
      });
    }
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (active()) loop(); }).observe(canvas);
    document.addEventListener('visibilitychange', function () { if (active()) loop(); });

    // ---- interaction ---------------------------------------------------------
    function toLocal(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function lightStrip() {
      if (!pointer || popped) return;
      var pu = (pointer.x - cx) / R, pv = (pointer.y - cy) / R;
      if (pu * pu + pv * pv > 1) return;
      var t = thickness(pu, pv, tau);
      api.strip.light(function (nm) { return 0.12 + 0.85 * reflect(t, nm); });
      if (!solvedDone) { solvedDone = true; api.solved(); }
    }
    canvas.addEventListener('pointermove', function (e) { pointer = toLocal(e); lightStrip(); if (!rafId) draw(performance.now()); });
    canvas.addEventListener('pointerdown', function (e) { pointer = toLocal(e); lightStrip(); if (!rafId) draw(performance.now()); e.preventDefault(); });
    canvas.addEventListener('pointerleave', function () { pointer = null; if (!rafId) draw(performance.now()); });
    angleIn.addEventListener('input', function () { setAngle(+angleIn.value); lightStrip(); if (!rafId) draw(performance.now()); });
    newBtn.addEventListener('click', function () { tau = 0; popped = 0; if (!rafId) draw(performance.now()); });
    pauseBtn.addEventListener('click', function () {
      held = !held; pauseBtn.setAttribute('aria-pressed', String(held));
      pauseBtn.textContent = held ? 'LET IT DRAIN' : 'HOLD THE DRAIN';
    });
    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 40) return;
      W = rect.width; dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      cx = W / 2; cy = H * 0.5; R = Math.min(W * 0.36, H * 0.4);
      draw(performance.now());
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);
    resize();
    if (active()) loop();
  }
})();
