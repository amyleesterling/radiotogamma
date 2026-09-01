/* The Light Lab — experiment A: PRISM (self-contained, no dependencies) */
(function () {
  'use strict';
  if (!window.LAB || typeof window.LAB.register !== 'function') return;

  window.LAB.register({
    id: 'prism',
    title: 'A. PRISM',
    goal: 'WHITE LIGHT → ? → SPECTRUM',
    question: {
      text: 'Which color bends most through glass?',
      choices: ['Red', 'Green', 'Blue'],
      reveal: 'Blue bends most. Glass slows every frequency by a slightly different amount, so each color refracts through a slightly different angle, blue the hardest — and white light fans into a continuous band, one color per frequency, no seams.'
    },
    hint: 'Drag an object from the tray into the beam. When you find the right one, rotate it with the slider and watch the fan change.',
    init: init
  });

  function init(mount, api) {
    var H = 300, BEAM_Y = 110, TRAY_LINE = 204, TRAY_Y = 246;
    var W = 860, DPR = 1, rot = 0, solved = false, animId = 0, drag = null;

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:' + H + 'px;' +
      'background:#05070c;border:1px solid rgba(196,228,255,.16);border-radius:6px;' +
      'touch-action:none;cursor:grab;';
    mount.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var controls = document.createElement('div');
    controls.className = 'controls';
    controls.style.cssText = 'font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b98a8;margin-top:8px;';
    var label = document.createElement('label');
    label.appendChild(document.createTextNode('Rotate the prism '));
    var slider = document.createElement('input');
    slider.type = 'range'; slider.min = '-25'; slider.max = '25'; slider.step = '1'; slider.value = '0';
    label.appendChild(slider);
    var deg = document.createElement('span');
    deg.textContent = ' 0°';
    label.appendChild(deg);
    controls.appendChild(label);
    mount.appendChild(controls);

    var objs = [
      { id: 'mirror', label: 'MIRROR' },
      { id: 'lens', label: 'MAGNIFIER' },
      { id: 'glass', label: 'BLACK GLASS' },
      { id: 'prism', label: 'PRISM' }
    ];
    objs.forEach(function (o) { o.x = 0; o.y = 0; o.hx = 0; o.hy = TRAY_Y; o.placed = false; });

    function layout() {
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        o.hx = W * (2 * i + 1) / 8;
        if (!o.placed && (!drag || drag.obj !== o)) { o.x = o.hx; o.y = o.hy; }
        else { o.x = Math.min(Math.max(o.x, 20), W - 20); }
      }
    }

    function resize() {
      var w = canvas.clientWidth || mount.clientWidth || 860;
      if (w < 40) return;
      W = w;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      layout();
      draw();
    }

    function onBeam(o) { return Math.abs(o.y - BEAM_Y) < 34 && o.x > 60 && o.x < W - 30; }

    function beamOptics() {
      var list = [];
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        if ((o.placed || (drag && drag.obj === o)) && onBeam(o)) list.push(o);
      }
      list.sort(function (a, b) { return a.x - b.x; });
      return list;
    }

    /* ---------- sequential ray tracing ----------
       Light is a list of rays {x,y,dx,dy,nm,i,h,oi}: nm null = white,
       i = intensity, h = optic interactions so far, oi = index of the next
       optic (sorted by x) this ray may meet — monotone, so no loops. */
    var RAY_CAP = 126;        /* ~120 rays total (3 white seeds + splits) */
    var MAX_HITS = 4;         /* optic interactions per ray               */
    var APER = 30;            /* half-height of each optic's aperture     */
    var EPS = 1e-4;
    var scene = null;         /* last trace, shared by draw + strip       */

    function bendDeg(nm) {
      var u = (750 - nm) / 370;               /* 0 at red .. 1 at blue: blue bends most */
      return (8 + rot * 0.7) + u * (11 + Math.abs(rot) * 0.7);
    }

    function rotDir(dx, dy, degCW) {
      var a = degCW * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      return [dx * c - dy * s, dx * s + dy * c];
    }

    function exitLen(r) {
      var t = 1e9;
      if (r.dx > EPS) t = Math.min(t, (W + 20 - r.x) / r.dx);
      else if (r.dx < -EPS) t = Math.min(t, (-20 - r.x) / r.dx);
      if (r.dy > EPS) t = Math.min(t, (H + 20 - r.y) / r.dy);
      else if (r.dy < -EPS) t = Math.min(t, (-20 - r.y) / r.dy);
      return t === 1e9 ? 0 : t;
    }

    function traceScene() {
      var optics = beamOptics();
      var queue = [], segs = [], glows = [], survivors = [];
      var made = 3, dispersed = false, guard = 0;
      var offs = [-6, 0, 6];                   /* white beam has a little width */
      for (var k = 0; k < offs.length; k++) {
        queue.push({ x: -20, y: BEAM_Y + offs[k], dx: 1, dy: 0, nm: null, i: 1, h: 0, oi: 0 });
      }
      while (queue.length && guard++ < 800) {
        var r = queue.shift();
        var hit = null, o, t, hx, hy;
        if (r.h < MAX_HITS) {
          for (var oi = r.oi; oi < optics.length && !hit; oi++) {
            o = optics[oi];
            if (o.id === 'mirror') {
              /* "/" mirror: line through (o.x,o.y), points satisfy x+y=const */
              var den = r.dx + r.dy;
              if (den <= EPS) continue;
              t = (o.x + o.y - r.x - r.y) / den;
              if (t <= EPS) continue;
              hx = r.x + r.dx * t; hy = r.y + r.dy * t;
              if (Math.abs(((hx - o.x) - (hy - o.y)) * 0.7071) > APER) continue;
            } else {
              if (r.dx <= EPS) continue;       /* vertical plane at o.x */
              t = (o.x - r.x) / r.dx;
              if (t <= EPS) continue;
              hx = o.x; hy = r.y + r.dy * t;
              if (Math.abs(hy - o.y) > APER) continue;
            }
            hit = { o: o, x: hx, y: hy, oi: oi };
          }
        }
        if (!hit) {                            /* ray leaves the canvas */
          var te = exitLen(r);
          if (te > EPS) segs.push({ x1: r.x, y1: r.y, x2: r.x + r.dx * te, y2: r.y + r.dy * te, nm: r.nm, i: r.i });
          if (r.nm !== null && r.i > 0) survivors.push(r);
          continue;
        }
        segs.push({ x1: r.x, y1: r.y, x2: hit.x, y2: hit.y, nm: r.nm, i: r.i });
        o = hit.o;
        if (o.id === 'mirror') {
          /* reflect about the "/" plane, normal (1,1)/√2 : d' = d - (dx+dy)(1,1) */
          var dn = r.dx + r.dy;
          queue.push({ x: hit.x, y: hit.y, dx: r.dx - dn, dy: r.dy - dn,
            nm: r.nm, i: r.i, h: r.h + 1, oi: hit.oi + 1 });
        } else if (o.id === 'lens') {
          /* converge through the focal point, then keep going (diverges past it) */
          var fx = o.x + 64, fy = o.y;
          var vx = fx - hit.x, vy = fy - hit.y;
          var L = Math.sqrt(vx * vx + vy * vy) || 1;
          queue.push({ x: hit.x, y: hit.y, dx: vx / L, dy: vy / L,
            nm: r.nm, i: r.i, h: r.h + 1, oi: hit.oi + 1 });
          glows.push({ x: fx, y: fy, r: 10, nm: r.nm, a: 0.3 * Math.min(1, r.i) });
        } else if (o.id === 'glass') {
          /* absorbed: a dim glow tinted by whatever arrived, no outgoing ray */
          glows.push({ x: hit.x - 3, y: hit.y, r: 14, nm: r.nm, a: 0.12 * Math.min(1, r.i) });
        } else {                               /* prism */
          if (r.nm === null) {
            var n = Math.min(40, RAY_CAP - made);
            if (n > 0) dispersed = true;
            for (var j = 0; j < n; j++) {
              var nm = 380 + 370 * j / Math.max(1, n - 1);
              var d = rotDir(r.dx, r.dy, bendDeg(nm));
              queue.push({ x: hit.x, y: hit.y, dx: d[0], dy: d[1],
                nm: nm, i: r.i, h: r.h + 1, oi: hit.oi + 1 });
              made++;
            }
          } else {
            /* already a single color: just bends by its own angle — no re-split.
               A second prism therefore widens the fan. */
            var d2 = rotDir(r.dx, r.dy, bendDeg(r.nm));
            queue.push({ x: hit.x, y: hit.y, dx: d2[0], dy: d2[1],
              nm: r.nm, i: r.i, h: r.h + 1, oi: hit.oi + 1 });
          }
        }
      }
      return { segs: segs, glows: glows, survivors: survivors, dispersed: dispersed };
    }

    /* ---------- drawing ---------- */
    function ray(x1, y1, x2, y2, style, w, blur, alpha) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = style; ctx.lineWidth = w;
      ctx.shadowColor = style; ctx.shadowBlur = blur;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    function rgbStr(nm) {
      var c = api.strip.wavelengthRGB(nm);
      return Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255);
    }

    function glow(g) {
      var col = g.nm === null ? '255,255,255' : rgbStr(g.nm);
      var grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, 'rgba(' + col + ',' + g.a + ')');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
    }

    function drawScene(sc) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var i, s;
      for (i = 0; i < sc.segs.length; i++) {
        s = sc.segs[i];
        var a = Math.min(1, s.i);
        if (s.nm === null) {
          ray(s.x1, s.y1, s.x2, s.y2, 'rgba(255,255,255,.28)', 5, 0, .45 * a);
          ray(s.x1, s.y1, s.x2, s.y2, '#ffffff', 1.6, 8, .8 * a);
        } else {
          ray(s.x1, s.y1, s.x2, s.y2, 'rgb(' + rgbStr(s.nm) + ')', 2.4, 0, .3 * a);
        }
      }
      for (i = 0; i < sc.glows.length; i++) glow(sc.glows[i]);
      ctx.restore();
    }

    var INK = 'rgba(196,228,255,.8)', INK_FAINT = 'rgba(196,228,255,.16)';

    function drawObject(o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      if (o.id === 'mirror') {
        /* "/" orientation: a left-to-right beam bounces straight up off the
           lower-left face; hatch marks sit on the back (lower-right) side */
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(196,228,255,.08)';
        ctx.fillRect(-3, -26, 6, 52);
        ctx.strokeRect(-3, -26, 6, 52);
        for (var i = -18; i <= 18; i += 12) {
          ctx.beginPath(); ctx.moveTo(4, i); ctx.lineTo(9, i + 5); ctx.stroke();
        }
      } else if (o.id === 'lens') {
        ctx.beginPath(); ctx.arc(-3, -4, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-8, -9, 4, 0, Math.PI * 2);
        ctx.strokeStyle = INK_FAINT; ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(17, 16); ctx.stroke();
      } else if (o.id === 'glass') {
        ctx.fillStyle = '#090c12';
        ctx.fillRect(-16, -16, 32, 32);
        ctx.strokeStyle = 'rgba(196,228,255,.5)';
        ctx.strokeRect(-16, -16, 32, 32);
        ctx.strokeStyle = INK_FAINT;
        ctx.beginPath(); ctx.moveTo(-16, 6); ctx.lineTo(6, -16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, 16); ctx.lineTo(16, -6); ctx.stroke();
      } else if (o.id === 'prism') {
        ctx.rotate(rot * Math.PI / 180);
        ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(22, 16); ctx.lineTo(-22, 16); ctx.closePath();
        ctx.fillStyle = 'rgba(196,228,255,.07)'; ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, W, H);
      scene = traceScene();
      drawScene(scene);
      if (scene.dispersed && !solved) { solved = true; api.solved(); }
      /* tray */
      ctx.strokeStyle = INK_FAINT;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12, TRAY_LINE); ctx.lineTo(W - 12, TRAY_LINE); ctx.stroke();
      ctx.font = '10px ui-monospace,SFMono-Regular,Menlo,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8b98a8';
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        ctx.fillText(o.label, o.hx, TRAY_Y + 36);
        if (o.x !== o.hx || o.y !== o.hy) {          /* empty slot marker */
          ctx.save();
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = 'rgba(196,228,255,.10)';
          ctx.beginPath(); ctx.arc(o.hx, o.hy, 22, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }
      for (i = 0; i < objs.length; i++) drawObject(objs[i]);
    }

    /* ---------- strip ---------- */
    function updateStrip() {
      var sc = scene || traceScene();
      var sur = sc.survivors;
      if (!sur.length) {                       /* all white, or all absorbed */
        api.strip.light(function () { return 0.15; });
        return;
      }
      var N = 128, bins = new Array(N).fill(0), mx = 0, i, idx;
      for (i = 0; i < sur.length; i++) {
        idx = Math.round((sur[i].nm - 380) / 370 * (N - 1));
        if (idx < 0) idx = 0; if (idx > N - 1) idx = N - 1;
        bins[idx] += sur[i].i;
        if (idx > 0) bins[idx - 1] += sur[i].i * 0.5;
        if (idx < N - 1) bins[idx + 1] += sur[i].i * 0.5;
      }
      for (i = 0; i < N; i++) if (bins[i] > mx) mx = bins[i];
      api.strip.light(function (nm) {
        var k = Math.round((nm - 380) / 370 * (N - 1));
        if (k < 0) k = 0; if (k > N - 1) k = N - 1;
        return Math.max(0.15, bins[k] / mx * 0.9);
      });
    }

    /* ---------- interaction ---------- */
    function pointer(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('pointerdown', function (e) {
      var p = pointer(e), best = null, bd = 30;      /* generous hit radius */
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        var d = Math.sqrt((o.x - p.x) * (o.x - p.x) + (o.y - p.y) * (o.y - p.y));
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) return;
      e.preventDefault();
      if (animId) { cancelAnimationFrame(animId); animId = 0; }
      best.placed = false;
      drag = { obj: best, dx: best.x - p.x, dy: best.y - p.y, id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      draw();
      updateStrip();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var p = pointer(e), o = drag.obj;
      o.x = Math.min(Math.max(p.x + drag.dx, 20), W - 20);
      o.y = Math.min(Math.max(p.y + drag.dy, 16), H - 16);
      draw();
      updateStrip();
    });

    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var o = drag.obj;
      drag = null;
      canvas.style.cursor = 'grab';
      if (onBeam(o)) { o.y = BEAM_Y; o.placed = true; draw(); }
      else flyHome(o);
      updateStrip();
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    function flyHome(o) {
      if (api.reducedMotion) { o.x = o.hx; o.y = o.hy; draw(); return; }
      var sx = o.x, sy = o.y, t0 = performance.now();
      if (animId) cancelAnimationFrame(animId);
      function step(t) {
        var k = Math.min(1, (t - t0) / 280);
        var ease = 1 - Math.pow(1 - k, 3);
        o.x = sx + (o.hx - sx) * ease;
        o.y = sy + (o.hy - sy) * ease;
        draw();
        animId = k < 1 ? requestAnimationFrame(step) : 0;
      }
      animId = requestAnimationFrame(step);
    }

    slider.addEventListener('input', function () {
      rot = +slider.value || 0;
      deg.textContent = ' ' + rot + '°';
      draw();
      updateStrip();
    });

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(resize).observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();   /* initial draw */
  }
})();
