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

    function activeObj() {
      var best = null;
      for (var i = 0; i < objs.length; i++) {
        var o = objs[i];
        if ((o.placed || (drag && drag.obj === o)) && onBeam(o)) {
          if (!best || o.x < best.x) best = o;
        }
      }
      return best;
    }

    /* ---------- drawing ---------- */
    function ray(x1, y1, x2, y2, style, w, blur, alpha) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = style; ctx.lineWidth = w;
      ctx.shadowColor = style; ctx.shadowBlur = blur;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }

    function whiteBeam(x1, x2) {
      ray(x1, BEAM_Y, x2, BEAM_Y, 'rgba(255,255,255,.28)', 7, 0, .6);
      ray(x1, BEAM_Y, x2, BEAM_Y, '#ffffff', 2, 10, .95);
    }

    function glowDot(x, y, r, a) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    function drawBeam() {
      var a = activeObj();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (!a) {
        whiteBeam(0, W);
      } else if (a.id === 'mirror') {
        whiteBeam(0, a.x);
        ray(a.x, BEAM_Y, a.x, 0, 'rgba(255,255,255,.28)', 7, 0, .6);
        ray(a.x, BEAM_Y, a.x, 0, '#ffffff', 2, 10, .95);
      } else if (a.id === 'lens') {
        whiteBeam(0, a.x - 14);
        var fx = a.x + 64;
        var g1 = ctx.createLinearGradient(a.x, 0, fx, 0);
        g1.addColorStop(0, 'rgba(255,255,255,.16)');
        g1.addColorStop(1, 'rgba(255,255,255,.45)');
        ctx.fillStyle = g1;
        ctx.beginPath(); ctx.moveTo(a.x + 2, BEAM_Y - 11); ctx.lineTo(fx, BEAM_Y);
        ctx.lineTo(a.x + 2, BEAM_Y + 11); ctx.closePath(); ctx.fill();
        glowDot(fx, BEAM_Y, 12, .9);
        var g2 = ctx.createLinearGradient(fx, 0, W, 0);
        g2.addColorStop(0, 'rgba(255,255,255,.30)');
        g2.addColorStop(1, 'rgba(255,255,255,.02)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.moveTo(fx, BEAM_Y); ctx.lineTo(W, BEAM_Y - 34);
        ctx.lineTo(W, BEAM_Y + 34); ctx.closePath(); ctx.fill();
      } else if (a.id === 'glass') {
        whiteBeam(0, a.x - 18);
        glowDot(a.x - 16, BEAM_Y, 18, .18);
      } else if (a.id === 'prism') {
        whiteBeam(0, a.x - 18);
        ray(a.x - 18, BEAM_Y, a.x + 6, BEAM_Y, 'rgba(255,255,255,.5)', 2, 0, .5);
        drawFan(a.x + 6, BEAM_Y);
        if (!solved) { solved = true; api.solved(); }
      }
      ctx.restore();
    }

    function drawFan(cx, cy) {
      var base = 8 + rot * 0.7;                 /* exit direction follows rotation */
      var spread = 11 + Math.abs(rot) * 0.7;    /* steeper prism = wider fan       */
      for (var i = 0; i < 40; i++) {
        var nm = 380 + 370 * i / 39;
        var u = (750 - nm) / 370;               /* 0 at red .. 1 at blue: blue bends most */
        var ang = (base + u * spread) * Math.PI / 180;
        var c = api.strip.wavelengthRGB(nm);
        ctx.strokeStyle = 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * W, cy + Math.sin(ang) * W);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    var INK = 'rgba(196,228,255,.8)', INK_FAINT = 'rgba(196,228,255,.16)';

    function drawObject(o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      if (o.id === 'mirror') {
        ctx.rotate(-Math.PI / 4);
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
      drawBeam();
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
      var a = activeObj();
      if (a && a.id === 'prism') api.strip.light(function () { return 0.9; });
      else api.strip.light(function () { return 0.15; });
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
