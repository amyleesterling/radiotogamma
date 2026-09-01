/* THE LIGHT LAB — C. GARDEN HOSE
   A rainbow is not a thing at a place; it is an angle. Drag the sun along its
   arc and the spray cloud through the air; when droplets sit near 42 degrees
   off the antisolar axis (sun -> your head, extended), the bow appears.
   Light that bounces twice inside each droplet exits near 51 degrees instead,
   making a fainter secondary bow with the colours flipped, and no droplet can
   aim light into the gap between them: Alexander's dark band.
   Self-contained; registers with window.LAB (see lab.html). */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var TAU = Math.PI * 2;
  var BANDS = [660, 620, 590, 560, 520, 480, 450, 415]; // red outer -> violet inner
  var TH2_LO = 50.4, TH2_HI = 53.5; // secondary bow: two bounces, red inner -> violet outer

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function wrap(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  window.LAB.register({
    id: 'hose',
    title: 'C. GARDEN HOSE',
    goal: 'MAKE A RAINBOW.',
    question: {
      text: 'Sun, you, and a cloud of spray. Where can the rainbow appear?',
      choices: [
        'Wherever the mist is thickest',
        'Anywhere the sun hits water',
        'Only at one angle from your shadow',
        'Directly toward the sun'
      ],
      reveal: 'Only at one angle. Each droplet sends red light back at 42° from the line running from the sun through your head — the antisolar point. The rainbow is not a thing at a place; it is an angle, a 42° cone around your own shadow, and every observer stands at the tip of their own private cone.'
    },
    hint: 'Drag the sun across the sky and the spray around the yard. Nothing… nothing… then geometry. When the bow is strong, look just outside it: a fainter twin at 51°, colors flipped, with Alexander’s dark band of sky between the two. SHOW THE LIGHT reveals why.',

    init: function (mount, api) {
      var H = 320;

      var canvas = document.createElement('canvas');
      canvas.style.height = H + 'px';
      canvas.setAttribute('aria-label', 'Backyard side view: drag the sun along its arc and the spray cloud through the air until a rainbow forms at 42 degrees from the antisolar direction.');
      mount.appendChild(canvas);

      var controls = document.createElement('div');
      controls.className = 'controls';
      controls.innerHTML = '<button type="button" aria-pressed="false">SHOW THE LIGHT</button>';
      mount.appendChild(controls);
      var btn = controls.firstChild;

      var ctx = canvas.getContext('2d'), W = 0;

      // ---- state ----
      var sunA = 2.55;                      // position along the sky arc, radians
      var spray = { fx: 0.66, fy: 0.30 };   // cloud centre, canvas fractions
      var drops = [];
      for (var i = 0; i < 80; i++) {
        var rr = 46 * Math.sqrt(Math.random());
        var th = Math.random() * TAU;
        drops.push({ ox: rr * Math.cos(th), oy: 0.78 * rr * Math.sin(th), ph: Math.random() * TAU });
      }
      var showLight = false, solvedSent = false, drag = null, lastStrip = -1;

      function geom() {
        var groundY = H - 26;
        var cx = W * 0.5;
        var R = Math.min(W * 0.46, groundY - 44);
        return {
          groundY: groundY, cx: cx, R: R,
          hx: W * 0.30, hy: groundY - 46,                       // observer's head
          sx: cx + R * Math.cos(sunA), sy: groundY - R * Math.sin(sunA),
          spx: spray.fx * W, spy: spray.fy * H
        };
      }

      // which colour a droplet at this off-axis angle sends to the eye
      function nmOf(ang) { return 380 + clamp((ang - 40.0) / 3.4, 0, 1) * 320; }

      // same question for the two-bounce path: the ordering is flipped,
      // red on the secondary's inside edge, violet on its outside
      function nm2Of(ang) { return 380 + clamp((TH2_HI - ang) / (TH2_HI - TH2_LO), 0, 1) * 320; }

      function rgbCss(nm, a) {
        var c = api.strip.wavelengthRGB(nm);
        return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
               Math.round(c[2] * 255) + ',' + a + ')';
      }

      function updateStrip(intensity) {
        var w = 0.15 + 0.75 * intensity;    // a rainbow holds every visible wavelength
        if (Math.abs(w - lastStrip) < 0.02) return;
        lastStrip = w;
        api.strip.light(function () { return w; });
      }

      function draw() {
        if (!W) return;
        var g = geom();
        var t = performance.now() / 1000;
        var jitter = !!drag && !api.reducedMotion;   // drift only mid-drag

        var pts = [];
        for (var i = 0; i < drops.length; i++) {
          var o = drops[i];
          pts.push({
            x: g.spx + o.ox + (jitter ? Math.sin(t * 2.3 + o.ph) * 2.4 : 0),
            y: g.spy + o.oy + (jitter ? Math.cos(t * 1.9 + o.ph * 1.7) * 2.4 : 0)
          });
        }

        // ---- physics: every droplet's angle off the antisolar axis ----
        var dx = g.hx - g.sx, dy = g.hy - g.sy, dl = Math.hypot(dx, dy) || 1;
        var ax = dx / dl, ay = dy / dl;              // antisolar unit vector
        var mid2 = (TH2_LO + TH2_HI) / 2;
        var qual = [], qual2 = [], best = null;
        for (i = 0; i < pts.length; i++) {
          var vx = pts[i].x - g.hx, vy = pts[i].y - g.hy, vl = Math.hypot(vx, vy);
          if (vl < 24 || pts[i].y > g.groundY - 2) continue;
          var ang = Math.acos(clamp((vx * ax + vy * ay) / vl, -1, 1)) / DEG;
          if (Math.abs(ang - 42) < 2.8) qual.push({ x: pts[i].x, y: pts[i].y, ang: ang });
          if (Math.abs(ang - mid2) < 3.4) qual2.push({ x: pts[i].x, y: pts[i].y, ang: ang });
          if (!best || Math.abs(ang - 42) < Math.abs(best.ang - 42)) best = { x: pts[i].x, y: pts[i].y, ang: ang };
        }
        var vxC = g.spx - g.hx, vyC = g.spy - g.hy, distC = Math.hypot(vxC, vyC) || 1;
        var angC = Math.acos(clamp((vxC * ax + vyC * ay) / distC, -1, 1)) / DEG;
        var angRad = Math.atan2(50, distC) / DEG;    // cloud's angular radius from the eye
        var intensity = smooth(1 - Math.abs(angC - 42) / (angRad + 1.5));
        var intensity2 = smooth(1 - Math.abs(angC - mid2) / (angRad + 1.5));
        var Lax = distC * Math.cos(angC * DEG);      // spray depth along the axis:
        var bowOn = Lax > 40 && qual.length >= 4;    // >0 means sun is behind you
        var bow2On = Lax > 40 && qual2.length >= 4;
        if (bowOn && qual.length >= 6 && intensity >= 0.55 && !solvedSent) { solvedSent = true; api.solved(); }
        // either bow spans the whole visible octave; light the strip for whichever is stronger
        updateStrip(Math.max(bowOn ? intensity : 0, bow2On ? 0.45 * intensity2 : 0));

        // ---- scene ----
        ctx.fillStyle = '#05070c';
        ctx.fillRect(0, 0, W, H);

        // the sun's rail across the sky
        ctx.strokeStyle = 'rgba(255,217,122,.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 7]);
        ctx.beginPath(); ctx.arc(g.cx, g.groundY, g.R, -Math.PI + 0.18, -0.18); ctx.stroke();
        ctx.setLineDash([]);

        // ground
        ctx.strokeStyle = 'rgba(196,228,255,.25)';
        ctx.beginPath(); ctx.moveTo(0, g.groundY + 0.5); ctx.lineTo(W, g.groundY + 0.5); ctx.stroke();

        // sun, soft glow
        var gl = ctx.createRadialGradient(g.sx, g.sy, 2, g.sx, g.sy, 42);
        gl.addColorStop(0, 'rgba(255,217,122,.55)');
        gl.addColorStop(1, 'rgba(255,217,122,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(g.sx, g.sy, 42, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd97a';
        ctx.beginPath(); ctx.arc(g.sx, g.sy, 12, 0, TAU); ctx.fill();

        // observer
        ctx.strokeStyle = 'rgba(196,228,255,.85)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(g.hx, g.hy, 5, 0, TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(g.hx, g.hy + 5); ctx.lineTo(g.hx, g.groundY - 16);
        ctx.moveTo(g.hx - 8, g.hy + 19); ctx.lineTo(g.hx, g.hy + 10); ctx.lineTo(g.hx + 8, g.hy + 19);
        ctx.moveTo(g.hx - 7, g.groundY); ctx.lineTo(g.hx, g.groundY - 16); ctx.lineTo(g.hx + 7, g.groundY);
        ctx.stroke();
        ctx.lineWidth = 1;

        // spray: drag halo, then the droplets themselves
        ctx.strokeStyle = 'rgba(126,224,255,.14)';
        ctx.setLineDash([3, 6]);
        ctx.beginPath(); ctx.arc(g.spx, g.spy, 54, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(126,224,255,.5)';
        for (i = 0; i < pts.length; i++) {
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.5, 0, TAU); ctx.fill();
        }

        // ---- the bows ----
        if ((qual.length || qual2.length) && Lax > 40) {
          ctx.save();
          ctx.beginPath(); ctx.rect(0, 0, W, g.groundY); ctx.clip();
          // both bows are centred on the antisolar axis at the spray's depth —
          // tangent there to the true 42° / 52° loci — clipped to the droplets' span
          var ccx = g.hx + ax * Lax, ccy = g.hy + ay * Lax;
          var phc = Math.atan2(g.spy - ccy, g.spx - ccx);
          var lo = 9, hi = -9, all = qual.concat(qual2);
          for (i = 0; i < all.length; i++) {
            var da = wrap(Math.atan2(all[i].y - ccy, all[i].x - ccx) - phc);
            if (da < lo) lo = da;
            if (da > hi) hi = da;
          }
          lo -= 0.05; hi += 0.05;

          // Alexander's dark band: no droplet can send light between the
          // primary's red edge (42.4°) and the secondary's (50.4°); the sky
          // just inside and just outside picks up scattered light instead
          if (bowOn || bow2On) {
            var peak = Math.max(bowOn ? intensity : 0, bow2On ? intensity2 : 0);
            var r1 = Lax * Math.tan((40.7 + 1.7) * DEG);
            var r2 = Lax * Math.tan(TH2_LO * DEG);
            ctx.strokeStyle = 'rgba(207,230,255,' + (0.05 * peak).toFixed(3) + ')';
            ctx.lineWidth = r1 * 0.55;
            ctx.beginPath(); ctx.arc(ccx, ccy, r1 * 0.7, phc + lo, phc + hi); ctx.stroke();
            ctx.strokeStyle = 'rgba(207,230,255,' + (0.03 * peak).toFixed(3) + ')';
            ctx.lineWidth = 34;
            ctx.beginPath(); ctx.arc(ccx, ccy, Lax * Math.tan(TH2_HI * DEG) + 18, phc + lo, phc + hi); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,' + (0.3 * peak).toFixed(3) + ')';
            ctx.lineWidth = Math.max(1, r2 - r1);
            ctx.beginPath(); ctx.arc(ccx, ccy, (r1 + r2) / 2, phc + lo, phc + hi); ctx.stroke();
          }

          ctx.globalCompositeOperation = 'lighter';
          // each qualifying droplet glints in the one colour it sends your way
          for (i = 0; i < qual.length; i++) {
            ctx.fillStyle = rgbCss(nmOf(qual[i].ang), 0.3 + 0.6 * intensity);
            ctx.beginPath(); ctx.arc(qual[i].x, qual[i].y, 2.1, 0, TAU); ctx.fill();
          }
          for (i = 0; i < qual2.length; i++) {
            ctx.fillStyle = rgbCss(nm2Of(qual2[i].ang), (0.3 + 0.6 * intensity2) * 0.45);
            ctx.beginPath(); ctx.arc(qual2[i].x, qual2[i].y, 2.1, 0, TAU); ctx.fill();
          }
          if (bowOn) {
            ctx.globalAlpha = 0.15 + 0.85 * intensity;
            ctx.lineWidth = 2.2;
            for (i = 0; i < BANDS.length; i++) {
              var thb = (40.7 + (BANDS[i] - 380) / 320 * 1.7) * DEG; // red 42.4° … violet 40.7°
              ctx.strokeStyle = rgbCss(BANDS[i], 1);
              ctx.beginPath(); ctx.arc(ccx, ccy, Lax * Math.tan(thb), phc + lo, phc + hi); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          if (bow2On) {
            // two bounces flip the spread: red hugs the inside, violet the outside
            ctx.globalAlpha = (0.15 + 0.85 * intensity2) * 0.4;
            ctx.lineWidth = 2.2;
            for (i = 0; i < BANDS.length; i++) {
              var th2 = (TH2_HI - (BANDS[i] - 380) / 320 * (TH2_HI - TH2_LO)) * DEG; // red 50.4° … violet 53.5°
              ctx.strokeStyle = rgbCss(BANDS[i], 1);
              ctx.beginPath(); ctx.arc(ccx, ccy, Lax * Math.tan(th2), phc + lo, phc + hi); ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          ctx.restore();
        }

        if (showLight) overlay(g, ax, ay, qual, best);
      }

      function overlay(g, ax, ay, qual, best) {
        var FAR = W + H;
        ctx.save();
        ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 1;
        ctx.lineCap = 'butt';

        // sun -> head, extended out to the antisolar point
        ctx.strokeStyle = 'rgba(160,124,255,.55)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(g.hx + ax * FAR, g.hy + ay * FAR); ctx.stroke();
        if (ay > 0.02) {                    // where the axis meets the ground
          var gx = g.hx + ax * (g.groundY - g.hy) / ay;
          if (gx > 10 && gx < W - 10) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(gx - 4, g.groundY - 4); ctx.lineTo(gx + 4, g.groundY + 4);
            ctx.moveTo(gx + 4, g.groundY - 4); ctx.lineTo(gx - 4, g.groundY + 4);
            ctx.stroke();
            ctx.fillStyle = '#a07cff';
            ctx.fillText('antisolar', gx, Math.min(H - 4, g.groundY + 16));
            ctx.setLineDash([5, 5]);
          }
        }

        // the 42° cone around the axis, opening from your head
        var A = Math.atan2(ay, ax);
        var e1 = A - 42 * DEG, e2 = A + 42 * DEG;
        ctx.fillStyle = 'rgba(160,124,255,.06)';
        ctx.beginPath();
        ctx.moveTo(g.hx, g.hy);
        ctx.lineTo(g.hx + Math.cos(e1) * FAR, g.hy + Math.sin(e1) * FAR);
        ctx.arc(g.hx, g.hy, FAR, e1, e2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,124,255,.35)';
        ctx.beginPath();
        ctx.moveTo(g.hx + Math.cos(e1) * FAR, g.hy + Math.sin(e1) * FAR);
        ctx.lineTo(g.hx, g.hy);
        ctx.lineTo(g.hx + Math.cos(e2) * FAR, g.hy + Math.sin(e2) * FAR);
        ctx.stroke();

        // the angle itself, marked on the upward-pointing edge
        var eL = Math.sin(e1) < Math.sin(e2) ? e1 : e2;
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(160,124,255,.8)';
        ctx.beginPath(); ctx.arc(g.hx, g.hy, 46, Math.min(A, eL), Math.max(A, eL)); ctx.stroke();
        var mid = (A + eL) / 2;
        ctx.fillStyle = '#a07cff';
        ctx.fillText('42°', g.hx + Math.cos(mid) * 64, g.hy + Math.sin(mid) * 64 + 4);

        // ray paths: sun -> droplet -> eye, for droplets sitting on the cone
        var picks = [];
        if (qual.length) {
          var qs = qual.slice().sort(function (a, b) { return a.x - b.x; });
          picks.push(qs[0]);
          if (qs.length > 2) picks.push(qs[qs.length >> 1]);
          if (qs.length > 1) picks.push(qs[qs.length - 1]);
        } else if (best) {
          picks.push(best);                 // nearest miss: path shown, no colour
        }
        for (var i = 0; i < picks.length; i++) {
          var p = picks[i];
          var onCone = Math.abs(p.ang - 42) < 2.8;
          ctx.strokeStyle = 'rgba(255,217,122,' + (onCone ? '.5' : '.3') + ')';
          ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(p.x, p.y); ctx.stroke();
          ctx.strokeStyle = onCone ? rgbCss(nmOf(p.ang), 0.85) : 'rgba(196,228,255,.35)';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(g.hx, g.hy); ctx.stroke();
          ctx.fillStyle = onCone ? rgbCss(nmOf(p.ang), 0.9) : 'rgba(196,228,255,.5)';
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, TAU); ctx.fill();
        }

        // inset: inside one droplet — one internal bounce vs two
        var iw = 268, ih = 122, ix = clamp(W - iw - 14, 8, W), iy = 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(5,7,12,.85)';
        ctx.fillRect(ix, iy, iw, ih);
        ctx.strokeStyle = 'rgba(196,228,255,.2)';
        ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
        dropletDiagram(ix + 70, iy + 48, 19, 1);
        dropletDiagram(ix + 198, iy + 48, 19, 2);
        ctx.fillStyle = '#a07cff';
        ctx.fillText('one bounce → 42°', ix + 70, iy + ih - 20);
        ctx.fillText('two bounces → 51°,', ix + 198, iy + ih - 20);
        ctx.fillText('colors flipped', ix + 198, iy + ih - 8);
        ctx.restore();
      }

      // a droplet in cross-section: sunlight in, one or two internal
      // reflections, and the dispersed fan on the way out
      function dropletDiagram(cx0, cy0, r, bounces) {
        ctx.strokeStyle = 'rgba(126,224,255,.6)';
        ctx.beginPath(); ctx.arc(cx0, cy0, r, 0, TAU); ctx.stroke();
        var path = bounces === 1
          ? [{ x: cx0 - 0.64 * r, y: cy0 - 0.77 * r },
             { x: cx0 + 0.98 * r, y: cy0 + 0.20 * r },
             { x: cx0 - 0.34 * r, y: cy0 + 0.94 * r }]
          : [{ x: cx0 - 0.64 * r, y: cy0 - 0.77 * r },
             { x: cx0 + 0.99 * r, y: cy0 - 0.10 * r },
             { x: cx0 + 0.05 * r, y: cy0 + 1.00 * r },
             { x: cx0 - 0.95 * r, y: cy0 + 0.30 * r }];
        // sunlight in from the left
        ctx.strokeStyle = 'rgba(255,217,122,.75)';
        ctx.beginPath(); ctx.moveTo(path[0].x - 24, path[0].y); ctx.lineTo(path[0].x, path[0].y); ctx.stroke();
        // the internal legs
        ctx.strokeStyle = 'rgba(196,228,255,.55)';
        ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
        for (var k = 1; k < path.length; k++) ctx.lineTo(path[k].x, path[k].y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(196,228,255,.85)';
        for (k = 1; k < path.length - 1; k++) {     // mark each internal bounce
          ctx.beginPath(); ctx.arc(path[k].x, path[k].y, 2, 0, TAU); ctx.fill();
        }
        // exit: the two-bounce path leaves steeper, and its colours come out flipped
        var exit = path[path.length - 1];
        var base = bounces === 1 ? Math.atan2(0.62, -0.79) : Math.atan2(-0.76, -0.65);
        var fan = bounces === 1 ? [660, 415] : [415, 660];
        for (k = 0; k < fan.length; k++) {
          var fa = base + (k - 0.5) * 0.18;
          ctx.strokeStyle = rgbCss(fan[k], 0.9);
          ctx.beginPath(); ctx.moveTo(exit.x, exit.y);
          ctx.lineTo(exit.x + Math.cos(fa) * 22, exit.y + Math.sin(fa) * 22); ctx.stroke();
        }
      }

      // ---- interaction ----
      function toLocal(e) {
        var r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }

      canvas.addEventListener('pointerdown', function (e) {
        var p = toLocal(e), g = geom();
        if (Math.hypot(p.x - g.sx, p.y - g.sy) < 34) drag = { kind: 'sun' };
        else if (Math.hypot(p.x - g.spx, p.y - g.spy) < 70) {
          drag = { kind: 'spray', ox: g.spx - p.x, oy: g.spy - p.y };
        } else return;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        draw();
      });

      canvas.addEventListener('pointermove', function (e) {
        var p = toLocal(e), g = geom();
        if (!drag) {
          var near = Math.hypot(p.x - g.sx, p.y - g.sy) < 34 ||
                     Math.hypot(p.x - g.spx, p.y - g.spy) < 70;
          canvas.style.cursor = near ? 'grab' : '';
          return;
        }
        if (drag.kind === 'sun') {
          sunA = clamp(Math.atan2(g.groundY - p.y, p.x - g.cx), 0.18, Math.PI - 0.18);
        } else {
          spray.fx = clamp(p.x + drag.ox, 60, W - 40) / W;
          spray.fy = clamp(p.y + drag.oy, 50, g.groundY - 42) / H;
        }
        e.preventDefault();
        draw();
      });

      function endDrag() {
        if (!drag) return;
        drag = null; canvas.style.cursor = '';
        draw();                             // settle drifted droplets back home
      }
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);

      btn.addEventListener('click', function () {
        showLight = !showLight;
        btn.setAttribute('aria-pressed', String(showLight));
        draw();
      });

      function resize() {
        var r = canvas.getBoundingClientRect();
        if (!r.width) return;
        W = r.width;
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
      }
      if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
      else window.addEventListener('resize', resize);
      resize();
    }
  });
})();
