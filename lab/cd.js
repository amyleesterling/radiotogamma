/* B. THE CD — a diffraction grating that happens to hold music.
   Self-contained experiment for The Light Lab; plugs into window.LAB. */
(function () {
  'use strict';
  if (!window.LAB || !window.LAB.register) return;
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
      var TAU = Math.PI * 2;
      var R = 110, HUB = 35, HOLE = 15, H = 320;
      var canvas = document.createElement('canvas');
      canvas.style.height = H + 'px';
      canvas.style.cursor = 'grab';
      canvas.setAttribute('aria-label', 'A CD in the dark, with a draggable lamp and a zoom slider');
      mount.appendChild(canvas);
      var controls = document.createElement('div');
      controls.className = 'controls';
      controls.innerHTML = '<label>Zoom into the surface <input type="range" min="0" max="1000" value="0"></label><span class="zoomlabel"></span>';
      mount.appendChild(controls);
      var zoomInput = controls.querySelector('input');
      var zoomLabel = controls.querySelector('.zoomlabel');
      var ctx = canvas.getContext('2d');
      var W = 860, dpr = 1, cx = W / 2, cy = H / 2;
      var lamp = { dx: 62, dy: -92 };          // offset from disc centre; starts overhead, no rainbow
      var dragging = false, grabX = 0, grabY = 0;
      var solvedDone = false;
      var phase = 0, rafId = 0;
      // ---- geometry -------------------------------------------------------
      function lampDist() { return Math.hypot(lamp.dx, lamp.dy); }
      function lampAngle() { return Math.atan2(lamp.dy, lamp.dx); }
      function quality() {                     // 0..1: how grazing-ish the lamp is
        var u = lampDist() / R;
        if (u <= 1.2 || u >= 2.5) return 0;
        var t = Math.min((u - 1.2) / 0.4, (2.5 - u) / 0.5, 1);
        return t * t * (3 - 2 * t);
      }
      function peakNm() {                      // which color the geometry favors
        var u = Math.max(1.2, Math.min(2.5, lampDist() / R));
        return 380 + (u - 1.2) / 1.3 * 370;
      }
      function clampLamp() {
        var m = 22;
        lamp.dx = Math.max(m - cx, Math.min(W - m - cx, lamp.dx));
        lamp.dy = Math.max(m - cy, Math.min(H - m - cy, lamp.dy));
      }
      // ---- zoom staging ---------------------------------------------------
      function zoomFrac() { return zoomInput.value / 1000; }
      function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
      function alphas(f) {
        return {
          disc: 1 - sm((f - 0.22) / 0.22),
          mid: sm((f - 0.26) / 0.18) * (1 - sm((f - 0.72) / 0.2)),
          tracks: sm((f - 0.74) / 0.2)
        };
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
      // ---- small helpers --------------------------------------------------
      function rgba(rgb, a) {
        return 'rgba(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' +
          Math.round(rgb[2] * 255) + ',' + a.toFixed(3) + ')';
      }
      function rot(x, y, a) {
        var c = Math.cos(a), s = Math.sin(a);
        return [x * c - y * s, x * s + y * c];
      }
      function circle(r, alpha) {
        ctx.strokeStyle = 'rgba(196,228,255,' + alpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
      }
      function arrow(x0, y0, x1, y1) {
        ctx.strokeStyle = 'rgba(196,228,255,.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.moveTo(x0 + 6, y0 - 3.5); ctx.lineTo(x0, y0); ctx.lineTo(x0 + 6, y0 + 3.5);
        ctx.moveTo(x1 - 6, y1 - 3.5); ctx.lineTo(x1, y1); ctx.lineTo(x1 - 6, y1 + 3.5);
        ctx.stroke();
      }
      // ---- view 1: the whole disc ----------------------------------------
      function wedge(center, sweep, r0, r1, style) {
        var da = sweep / 2;
        ctx.fillStyle = style;
        ctx.beginPath();
        ctx.arc(cx, cy, r1, center - da, center + da);
        ctx.arc(cx, cy, r0, center + da, center - da, true);
        ctx.closePath();
        ctx.fill();
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
          var a0 = center - sweep / 2 + t * sweep;
          wedge(a0, sweep / N * 1.5, r0, r1, rgba(api.strip.wavelengthRGB(nm), a));
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
        if (u < 1.35) {                        // straight-on light: plain white glare, no colors
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
      // ---- view 2: mid zoom, a field of faint concentric arcs -------------
      function drawMidView(a, f) {
        var t = Math.max(0, Math.min(1, (f - 0.28) / 0.5));
        var sp = 7 + 70 * t * t;               // groove spacing grows as we dive
        var bigR = 900 + 2200 * t;             // ...and the curvature flattens out
        var oy = cy + bigR;                    // track centre (the hub) is far below
        var count = Math.ceil(H / sp) + 2;
        ctx.save();
        ctx.lineWidth = 1;
        for (var k = 0; k < count; k++) {
          var rad = bigR + cy - k * sp;
          var half = Math.asin(Math.min(1, (W / 2 + 30) / rad));
          var tint = api.strip.wavelengthRGB(380 + ((k * 89) % 371));
          var w = 0.3;
          var al = a * (0.17 + 0.1 * Math.sin(k * 2.1));
          ctx.strokeStyle = 'rgba(' +
            Math.round(196 * (1 - w) + tint[0] * 255 * w) + ',' +
            Math.round(228 * (1 - w) + tint[1] * 255 * w) + ',' +
            Math.round(255 * (1 - w) + tint[2] * 255 * w) + ',' + al.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(cx, oy, rad, -Math.PI / 2 - half, -Math.PI / 2 + half);
          ctx.stroke();
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = '#8b98a8';
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('not paint — structure. keep going.', W / 2, 26);
        ctx.restore();
      }
      // ---- view 3: max zoom, the interference cartoon ---------------------
      function drawTracksView(a) {
        ctx.save();
        ctx.globalAlpha = a;
        var sp = Math.min(120, Math.max(70, W / 7));
        var baseY = 236, midX = W / 2;
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(196,228,255,.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(midX - 2.9 * sp, baseY);
        ctx.lineTo(midX + 2.9 * sp, baseY);
        ctx.stroke();
        for (var i = -2; i <= 2; i++) {        // the tracks, in cross-section
          var x = midX + i * sp;
          ctx.beginPath();
          ctx.arc(x, baseY, 8, Math.PI, 0);
          ctx.fillStyle = 'rgba(196,228,255,.18)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(196,228,255,.5)';
          ctx.stroke();
        }
        arrow(midX + 12, baseY + 24, midX + sp - 12, baseY + 24);
        ctx.fillStyle = '#8b98a8';
        ctx.fillText('1.6 µm — a few wavelengths of light', midX, baseY + 52);
        ctx.fillText('one wave hits adjacent tracks; each color adds up at its own angle', midX, 26);
        var d = [0.42, 0.907];                 // incoming direction, down-right
        ctx.lineWidth = 1.4;
        for (var j = -1; j <= 1; j++) {        // 3 parallel white rays
          var hx = midX + j * sp, hy = baseY - 8;
          ctx.strokeStyle = 'rgba(255,255,255,.75)';
          ctx.beginPath();
          ctx.moveTo(hx - d[0] * 170, hy - d[1] * 170);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        var out = [[650, -0.20], [550, -0.09], [470, 0]];   // red bends farthest
        for (var j2 = -1; j2 <= 1; j2++) {
          var hx2 = midX + j2 * sp, hy2 = baseY - 8;
          for (var c = 0; c < out.length; c++) {
            var v = rot(d[0], -d[1], out[c][1]);
            ctx.strokeStyle = rgba(api.strip.wavelengthRGB(out[c][0]), 0.85);
            ctx.beginPath();
            ctx.moveTo(hx2, hy2);
            ctx.lineTo(hx2 + v[0] * 140, hy2 + v[1] * 140);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      // ---- compositor -----------------------------------------------------
      function draw() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, W, H);
        var A = alphas(zoomFrac());
        if (A.mid > 0.01) drawMidView(A.mid, zoomFrac());
        if (A.disc > 0.01) drawDiscView(A.disc);
        if (A.tracks > 0.01) drawTracksView(A.tracks);
      }
      // ---- spectrum strip -------------------------------------------------
      function updateStrip() {
        var A = alphas(zoomFrac());
        var q = quality() * A.disc;
        var pk = peakNm();
        if (A.tracks > 0.4) {
          api.strip.light(function () { return 0.55; });
        } else if (q > 0.03) {
          api.strip.light(function (nm) {
            var g = Math.exp(-((nm - pk) * (nm - pk)) / (2 * 120 * 120));
            return Math.min(0.95, 0.15 + q * 0.78 * (0.45 + 0.55 * g));
          });
        } else {
          api.strip.light(null);
        }
      }
      // ---- interaction ----------------------------------------------------
      function toLocal(e) {
        var r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      function overLamp(p) {
        return Math.hypot(p.x - (cx + lamp.dx), p.y - (cy + lamp.dy)) <= 26;
      }
      function startShimmer() {
        if (rafId) return;
        var tick = function () {
          phase = performance.now() / 1000;
          draw();
          rafId = dragging ? requestAnimationFrame(tick) : 0;
        };
        rafId = requestAnimationFrame(tick);
      }
      function stopShimmer() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      }
      canvas.addEventListener('pointerdown', function (e) {
        var p = toLocal(e);
        if (!overLamp(p)) return;
        dragging = true;
        grabX = cx + lamp.dx - p.x;
        grabY = cy + lamp.dy - p.y;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
        canvas.style.cursor = 'grabbing';
        if (!api.reducedMotion) startShimmer();
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!dragging) {
          canvas.style.cursor = overLamp(toLocal(e)) ? 'grab' : 'default';
          return;
        }
        var p = toLocal(e);
        lamp.dx = p.x + grabX - cx;
        lamp.dy = p.y + grabY - cy;
        clampLamp();
        if (!solvedDone && quality() > 0.05) { solvedDone = true; api.solved(); }
        updateStrip();
        if (!rafId) draw();
      });
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        stopShimmer();
        canvas.style.cursor = 'grab';
        updateStrip();
        draw();
      }
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
      zoomInput.addEventListener('input', function () {
        zoomLabel.textContent = zoomText(zoomFrac());
        updateStrip();
        draw();
      });
      // ---- sizing ---------------------------------------------------------
      function resize() {
        var rect = canvas.getBoundingClientRect();
        if (rect.width < 40) return;
        W = rect.width;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        cx = W / 2; cy = H / 2;
        clampLamp();
        draw();
      }
      if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
      else window.addEventListener('resize', resize);
      zoomLabel.textContent = zoomText(0);
      resize();
    }
  });
})();
