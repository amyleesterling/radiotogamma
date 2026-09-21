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
      reveal: 'Blue bends most. Glass slows every frequency by a slightly different amount, so each color refracts through a slightly different angle, blue the hardest, and white light fans into a continuous band, one color per frequency, no seams.'
    },
    hint: 'Drag objects out of the tray, as many as you like; drag one back onto the tray to remove it. ' +
      'Hover an object and drag the curved arrow on its ring to rotate it (hold SHIFT to snap to 45°). ' +
      'Add extra LIGHT sources and tap one to change its color. INVENT builds an optic of your own recipe; tap one twice to rewrite it. Drag the handle under the bench to make it taller.',
    init: init
  });

  function init(mount, api) {
    var H = 300, BEAM_Y = 110, TRAY_LINE = 204, TRAY_Y = 246;
    var W = 860, DPR = 1, drag = null, hot = null, solved = false;
    var RAD = Math.PI / 180;

    /* borderless + full-bleed: no frame, and negative margins matching the
       .exp card padding so the beam runs edge to edge of the card */
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:calc(100% + 36px);margin:0 -18px;height:' + H + 'px;' +
      'background:#05070c;border:none;border-radius:0;' +
      'touch-action:none;cursor:grab;';
    mount.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    /* ---------- tray slots (infinite supply) + live instances ---------- */
    var slots = [
      { type: 'mirror', label: 'MIRROR' },
      { type: 'lens', label: 'MAGNIFIER' },
      { type: 'glass', label: 'BLACK GLASS' },
      { type: 'prism', label: 'PRISM' },
      { type: 'light', label: 'LIGHT' },
      { type: 'invent', label: 'INVENT' }
    ];
    slots.forEach(function (s) { s.hx = 0; s.hy = TRAY_Y; });
    /* instances: {type, x, y, rot(deg), recipe|null, nm(lights: null=white)} */
    var instances = [{ type: 'light', x: -6, y: BEAM_Y, rot: 0, recipe: null, nm: null }];
    var MAX_OPTICS = 10, MAX_LIGHTS = 4;
    var LIGHT_NMS = [null, 650, 532, 450];    /* white → red → green → blue */

    function countLights() {
      var n = 0;
      for (var i = 0; i < instances.length; i++) if (instances[i].type === 'light') n++;
      return n;
    }

    var flashMsg = '', flashUntil = 0;
    function flash(m) {
      flashMsg = m; flashUntil = Date.now() + 1400;
      draw();
      setTimeout(function () { if (Date.now() >= flashUntil) draw(); }, 1500);
    }

    function minX(o) { return o.type === 'light' ? -18 : 20; }

    function layout() {
      for (var i = 0; i < slots.length; i++) { slots[i].hx = W * (2 * i + 1) / 12; slots[i].hy = TRAY_Y; }
      for (i = 0; i < instances.length; i++) {
        instances[i].x = Math.min(Math.max(instances[i].x, minX(instances[i])), W - 20);
      }
    }

    function resize() {
      var w = canvas.clientWidth || mount.clientWidth || 860;
      var h = canvas.clientHeight || 300;
      if (w < 40 || h < 40) return;
      if (h !== H) {
        /* fullscreen (or back): rescale the bench vertically; the layout
           formulas reproduce the classic 300px geometry exactly at h=300 */
        var oldBeam = BEAM_Y, oldH = H;
        H = h;
        BEAM_Y = Math.round(H * 110 / 300);
        TRAY_LINE = H - 96;
        TRAY_Y = H - 54;
        for (var i = 0; i < instances.length; i++) {
          var o = instances[i];
          if (Math.abs(o.y - oldBeam) < 1) o.y = BEAM_Y;
          else o.y = Math.min(Math.max(o.y * H / oldH, 16), H - 16);
        }
      }
      W = w;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      layout();
      draw();
    }

    function normAng(a) { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; }
    function onBench(o) { return o.y < TRAY_LINE - 10; }

    /* ---------- ray tracing ----------
       Rays {x,y,dx,dy,nm(null=white),i,h,prev}: h = optic interactions so
       far, prev = index of the optic just left (never re-hit immediately).
       Every optic interacts along a finite plane segment through its center:
       the mirror ("/" at rest) and custom optics rotate their plane with the
       instance; lens/glass/prism keep a vertical plane (their rotation is
       cosmetic or, for the prism, folded into the dispersion angles). */
    var RAY_CAP = 126, MAX_HITS = 6, APER = 30, EPS = 1e-4;
    var scene = null;

    function planeDir(o) {
      var a;
      if (o.type === 'mirror') a = (o.rot - 45) * RAD;        /* "/" at rot 0 */
      else if (o.type === 'custom') a = (o.rot + 90) * RAD;   /* vertical slab at rot 0 */
      else a = 90 * RAD;
      return [Math.cos(a), Math.sin(a)];
    }

    function hitPlane(r, o) {
      var m = planeDir(o);
      var den = r.dx * m[1] - r.dy * m[0];
      if (Math.abs(den) < 1e-6) return null;
      var t = ((o.x - r.x) * m[1] - (o.y - r.y) * m[0]) / den;
      if (t < 0.5) return null;
      var hx = r.x + r.dx * t, hy = r.y + r.dy * t;
      if (Math.abs((hx - o.x) * m[0] + (hy - o.y) * m[1]) > APER) return null;
      return { t: t, x: hx, y: hy, m: m };
    }

    function reflectDir(dx, dy, m) {
      var nx = -m[1], ny = m[0];
      var dn = dx * nx + dy * ny;
      return [dx - 2 * dn * nx, dy - 2 * dn * ny];
    }

    function rotDir(dx, dy, degCW) {
      var a = degCW * RAD, c = Math.cos(a), s = Math.sin(a);
      return [dx * c - dy * s, dx * s + dy * c];
    }

    /* ---------- the physics an invented optic runs on ----------
       A thin wedge of apex angle A and index n deviates a ray by (n-1)*A, and
       n climbs toward the blue, so one recipe gives both the bend and the fan.
       Real dispersion is small: crown glass spans about 0.008 across the
       visible band, dense flint about 0.02, diamond about 0.044. At a 30 deg
       apex that is under a degree of spread, a few pixels on this bench, so
       the FAN is drawn exaggerated by DISP_GAIN while the readout states the
       true angles. Illustrative in scale, honest in mechanism. */
    var APEX = { slab: 0, tri: 30, lens: 0, blob: 0, wedge: 12 };
    var DISP_MAX = 0.06, DISP_GAIN = 22, LENS_R = 62;
    function indexAt(rc, nm) {
      /* normal dispersion, centred so the stated n is the index at 550 nm */
      var u = (550 - nm) / 370;
      return rc.n + rc.disp * u;
    }
    function deviate(rc, nm, apex) {
      if (!apex) return 0;
      var base = (rc.n - 1) * apex;
      var extra = (indexAt(rc, nm) - rc.n) * apex * DISP_GAIN;
      return base + extra;
    }
    function focalOf(rc, nm) {
      /* biconvex, both radii LENS_R: 1/f = (n-1) * 2/R, exaggerated the same
         way so the colours land at visibly different focal points */
      var n = rc.n + (indexAt(rc, nm) - rc.n) * DISP_GAIN;
      return LENS_R / (2 * Math.max(0.05, n - 1));
    }
    /* frosted glass: a deterministic spread per ray, so a still bench is still */
    function scatterOf(rc, seed) {
      if (!rc.scatter) return 0;
      var h = Math.sin(seed * 12.9898 + 4.1) * 43758.5453;
      return (h - Math.floor(h) - 0.5) * 70 * rc.scatter;
    }

    function bendDeg(nm, prot) {
      var u = (750 - nm) / 370;               /* 0 at red .. 1 at blue: blue bends most */
      return (8 + prot * 0.7) + u * (11 + Math.abs(prot) * 0.7);
    }

    /* The bench is the space above the tray line: a ray leaving the scene
       runs to the edge of THAT box, not the whole canvas, so a steep fan can
       never paint over the tray icons and their labels. */
    function exitLen(r) {
      var t = 1e9, floor = TRAY_LINE - 2;
      if (r.dx > EPS) t = Math.min(t, (W + 20 - r.x) / r.dx);
      else if (r.dx < -EPS) t = Math.min(t, (-20 - r.x) / r.dx);
      if (r.dy > EPS) t = Math.min(t, (floor - r.y) / r.dy);
      else if (r.dy < -EPS) t = Math.min(t, (-20 - r.y) / r.dy);
      return t === 1e9 || t < 0 ? 0 : t;
    }

    function rgbStr(nm) {
      var c = api.strip.wavelengthRGB(nm);
      return Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255);
    }

    function traceScene() {
      var optics = [], sources = [], i;
      for (i = 0; i < instances.length; i++) {
        if (!onBench(instances[i])) continue;
        if (instances[i].type === 'light') sources.push(instances[i]);
        else optics.push(instances[i]);
      }
      var queue = [], segs = [], glows = [], survivors = [];
      var live = 0, dispersed = false, guard = 0;
      /* each source fires a small bundle along its aim; with many sources
         degrade to one ray each rather than starving the ray budget */
      var per = sources.length <= 2 ? 3 : 1;
      var offs = per === 3 ? [-6, 0, 6] : [0];
      for (i = 0; i < sources.length; i++) {
        var s0 = sources[i];
        var ca = Math.cos(s0.rot * RAD), sa = Math.sin(s0.rot * RAD);
        for (var k = 0; k < offs.length; k++) {
          queue.push({
            x: s0.x + ca * 10 - sa * offs[k], y: s0.y + sa * 10 + ca * offs[k],
            dx: ca, dy: sa, nm: s0.nm, i: 1, h: 0, prev: -1
          });
          live++;
        }
      }
      function child(r, hit, kk, dx, dy, nm, ii) {
        queue.push({ x: hit.x, y: hit.y, dx: dx, dy: dy, nm: nm, i: ii, h: r.h + 1, prev: kk });
      }
      while (queue.length && guard++ < 2000) {
        var r = queue.shift();
        var best = null, bi = -1;
        if (r.h < MAX_HITS) {
          for (var kk = 0; kk < optics.length; kk++) {
            if (kk === r.prev) continue;
            var hp = hitPlane(r, optics[kk]);
            if (hp && (!best || hp.t < best.t)) { best = hp; bi = kk; }
          }
        }
        if (!best) {
          var te = exitLen(r);
          if (te > EPS) segs.push({ x1: r.x, y1: r.y, x2: r.x + r.dx * te, y2: r.y + r.dy * te, nm: r.nm, i: r.i });
          if (r.nm !== null && r.i > 0.01) survivors.push(r);
          continue;
        }
        segs.push({ x1: r.x, y1: r.y, x2: best.x, y2: best.y, nm: r.nm, i: r.i });
        var o = optics[bi];
        var rayCol = r.nm === null ? '255,255,255' : rgbStr(r.nm);
        if (o.type === 'mirror') {
          var rd = reflectDir(r.dx, r.dy, best.m);
          child(r, best, bi, rd[0], rd[1], r.nm, r.i);
        } else if (o.type === 'lens') {
          var sgn = r.dx >= 0 ? 1 : -1;
          var fx = o.x + 64 * sgn, fy = o.y;
          var vx = fx - best.x, vy = fy - best.y;
          var L = Math.sqrt(vx * vx + vy * vy) || 1;
          child(r, best, bi, vx / L, vy / L, r.nm, r.i);
          glows.push({ x: fx, y: fy, r: 10, col: rayCol, a: 0.3 * Math.min(1, r.i) });
        } else if (o.type === 'glass') {
          glows.push({ x: best.x - 3 * (r.dx >= 0 ? 1 : -1), y: best.y, r: 14, col: rayCol, a: 0.12 * Math.min(1, r.i) });
          live--;
        } else if (o.type === 'prism') {
          var prot = normAng(o.rot);
          if (r.nm === null) {
            var n = Math.min(40, RAY_CAP - live + 1);
            if (n >= 2) {
              dispersed = true;
              for (var j = 0; j < n; j++) {
                var nm = 380 + 370 * j / (n - 1);
                var d = rotDir(r.dx, r.dy, bendDeg(nm, prot));
                child(r, best, bi, d[0], d[1], nm, r.i);
              }
              live += n - 1;
            } else {
              child(r, best, bi, r.dx, r.dy, null, r.i);   /* over budget: pass through */
            }
          } else {
            /* monochromatic light bends by its one angle — no fan */
            var d2 = rotDir(r.dx, r.dy, bendDeg(r.nm, prot));
            child(r, best, bi, d2[0], d2[1], r.nm, r.i);
          }
        } else if (o.type === 'custom') {
          var rc = o.recipe;
          var ri = r.i * rc.refl, ti = r.i * rc.trans, ai = r.i * rc.abs;
          var apex = APEX[rc.shape] || 0;
          if (ai >= 0.02) glows.push({ x: best.x, y: best.y, r: 14, col: rc.tint, a: 0.14 * Math.min(1, ai * 2) });
          /* branches, strongest first; drop the weakest when at the ray cap */
          var wantR = ri >= 0.02, wantT = ti >= 0.02;
          var order = (ri >= ti) ? ['R', 'T'] : ['T', 'R'];
          var pushed = 0;
          for (var b = 0; b < 2; b++) {
            var allow = RAY_CAP - (live + pushed) + (pushed === 0 ? 1 : 0);
            if (order[b] === 'R' && wantR && allow >= 1) {
              var rr = reflectDir(r.dx, r.dy, best.m);
              child(r, best, bi, rr[0], rr[1], r.nm, ri);
              pushed++;
            } else if (order[b] === 'T' && wantT && allow >= 1) {
              if (rc.shape === 'lens') {
                /* a real lens: the lensmaker's equation gives the focus, and
                   because n rises toward the blue every colour focuses at its
                   own distance — chromatic aberration, for free */
                var sgn2 = r.dx >= 0 ? 1 : -1;
                if (r.nm === null && rc.disp > 0) {
                  var ln = Math.min(Math.round(5 + 24 * (rc.disp / DISP_MAX)), allow);
                  if (ln >= 2) {
                    dispersed = true;
                    for (var jl = 0; jl < ln; jl++) {
                      var nml = 380 + 370 * jl / (ln - 1);
                      var fl = focalOf(rc, nml);
                      var fxl = o.x + fl * sgn2, fyl = o.y;
                      var vxl = fxl - best.x, vyl = fyl - best.y;
                      var Ll = Math.sqrt(vxl * vxl + vyl * vyl) || 1;
                      child(r, best, bi, vxl / Ll, vyl / Ll, nml, ti);
                    }
                    pushed += ln;
                  } else { child(r, best, bi, r.dx, r.dy, null, ti); pushed++; }
                } else {
                  var f1 = focalOf(rc, r.nm === null ? 550 : r.nm);
                  var fx1 = o.x + f1 * sgn2, fy1 = o.y;
                  var vx1 = fx1 - best.x, vy1 = fy1 - best.y;
                  var L1 = Math.sqrt(vx1 * vx1 + vy1 * vy1) || 1;
                  child(r, best, bi, vx1 / L1, vy1 / L1, r.nm, ti);
                  pushed++;
                }
              } else if (r.nm === null && apex > 0 && rc.disp > 0) {
                var fn = Math.min(Math.round(6 + 26 * (rc.disp / DISP_MAX)), allow);
                if (fn >= 2) {
                  dispersed = true;
                  for (var j2 = 0; j2 < fn; j2++) {
                    var nm2 = 380 + 370 * j2 / (fn - 1);
                    var dd = rotDir(r.dx, r.dy, deviate(rc, nm2, apex) + scatterOf(rc, j2));
                    child(r, best, bi, dd[0], dd[1], nm2, ti);
                  }
                  pushed += fn;
                } else {
                  child(r, best, bi, r.dx, r.dy, null, ti);
                  pushed++;
                }
              } else {
                /* one ray: white light through a shape with no wedge is not
                   spread at all (a parallel slab only shifts it sideways) */
                var dv = deviate(rc, r.nm === null ? 550 : r.nm, apex) + scatterOf(rc, pushed);
                var d3 = dv ? rotDir(r.dx, r.dy, dv) : [r.dx, r.dy];
                child(r, best, bi, d3[0], d3[1], r.nm, ti);
                pushed++;
              }
            }
          }
          live += pushed - 1;
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

    function glow(g) {
      var grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, 'rgba(' + g.col + ',' + g.a + ')');
      grad.addColorStop(1, 'rgba(' + g.col + ',0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill();
    }

    function drawScene(sc) {
      ctx.save();
      /* a hard clip as well as the shortened rays: glows have radius, and a
         glow centred just above the line would otherwise bleed onto the tray */
      ctx.beginPath(); ctx.rect(0, 0, W, TRAY_LINE - 2); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      var i, s;
      for (i = 0; i < sc.segs.length; i++) {
        s = sc.segs[i];
        var a = Math.min(1, s.i);
        if (s.nm === null) {
          ray(s.x1, s.y1, s.x2, s.y2, 'rgba(255,255,255,.28)', 5, 0, .45 * a);
          ray(s.x1, s.y1, s.x2, s.y2, '#ffffff', 1.6, 8, .8 * a);
        } else {
          var col = 'rgb(' + rgbStr(s.nm) + ')';
          ray(s.x1, s.y1, s.x2, s.y2, col, 2.4, 0, .3 * a);
        }
      }
      for (i = 0; i < sc.glows.length; i++) glow(sc.glows[i]);
      ctx.restore();
    }

    var INK = 'rgba(196,228,255,.8)', INK_FAINT = 'rgba(196,228,255,.16)';

    function hex2rgb(h) {
      return parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16);
    }

    function drawGlyph(type, o) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      if (type === 'mirror') {
        /* "/" orientation: a left-to-right beam bounces straight up off the
           lower-left face; hatch marks sit on the back (lower-right) side */
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(196,228,255,.08)';
        ctx.fillRect(-3, -26, 6, 52);
        ctx.strokeRect(-3, -26, 6, 52);
        for (var i = -18; i <= 18; i += 12) {
          ctx.beginPath(); ctx.moveTo(4, i); ctx.lineTo(9, i + 5); ctx.stroke();
        }
        ctx.restore();
      } else if (type === 'lens') {
        ctx.beginPath(); ctx.arc(-3, -4, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-8, -9, 4, 0, Math.PI * 2);
        ctx.strokeStyle = INK_FAINT; ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(17, 16); ctx.stroke();
      } else if (type === 'glass') {
        ctx.fillStyle = '#090c12';
        ctx.fillRect(-16, -16, 32, 32);
        ctx.strokeStyle = 'rgba(196,228,255,.5)';
        ctx.strokeRect(-16, -16, 32, 32);
        ctx.strokeStyle = INK_FAINT;
        ctx.beginPath(); ctx.moveTo(-16, 6); ctx.lineTo(6, -16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, 16); ctx.lineTo(16, -6); ctx.stroke();
      } else if (type === 'prism') {
        ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(22, 16); ctx.lineTo(-22, 16); ctx.closePath();
        ctx.fillStyle = 'rgba(196,228,255,.07)'; ctx.fill();
        ctx.stroke();
      } else if (type === 'light') {
        var col = (o && o.nm != null) ? rgbStr(o.nm) : '255,255,255';
        ctx.fillStyle = '#0a0e16';
        ctx.fillRect(-16, -8, 20, 16);
        ctx.strokeRect(-16, -8, 20, 16);
        glow({ x: 7, y: 0, r: 9, col: col, a: 0.9 });
        ctx.strokeStyle = 'rgba(' + col + ',.9)';
        ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(4, 6); ctx.stroke();
      } else if (type === 'invent') {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(196,228,255,.45)';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
        ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
      } else if (type === 'custom') {
        var rc = o && o.recipe;
        var tint = rc ? rc.tint : '196,228,255';
        ctx.strokeStyle = 'rgba(' + tint + ',.75)';
        ctx.fillStyle = 'rgba(' + tint + ',.1)';
        var sh = rc ? rc.shape : 'slab';
        ctx.beginPath();
        if (sh === 'slab') { ctx.rect(-4, -24, 8, 48); }
        else if (sh === 'tri') { ctx.moveTo(0, -22); ctx.lineTo(20, 14); ctx.lineTo(-20, 14); ctx.closePath(); }
        else if (sh === 'lens') { ctx.ellipse(0, 0, 7, 20, 0, 0, Math.PI * 2); }
        else {
          ctx.moveTo(0, -20);
          ctx.bezierCurveTo(18, -16, 16, 14, 2, 18);
          ctx.bezierCurveTo(-14, 22, -20, -2, 0, -20);
        }
        ctx.fill(); ctx.stroke();
      }
    }

    function drawObject(o) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot * RAD);
      drawGlyph(o.type, o);
      ctx.restore();
      /* an invented optic carries its name, upright however it is rotated */
      if (o.type === 'custom' && o.recipe && o.recipe.name) {
        ctx.fillStyle = 'rgba(' + o.recipe.tint + ',.85)';
        ctx.font = '10px ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.textAlign = 'center';
        ctx.fillText(o.recipe.name.toUpperCase(), o.x, o.y + 40);
      }
    }

    function drawRing(o) {
      ctx.save();
      ctx.strokeStyle = 'rgba(196,228,255,.28)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(o.x, o.y, 30, 0, Math.PI * 2); ctx.stroke();
      /* curved-arrow affordance on the ring's upper right */
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x, o.y, 30, -85 * RAD, -35 * RAD); ctx.stroke();
      var ax = o.x + 30 * Math.cos(-35 * RAD), ay = o.y + 30 * Math.sin(-35 * RAD);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(ax + 5 * Math.cos(55 * RAD), ay + 5 * Math.sin(55 * RAD));
      ctx.lineTo(ax + 5 * Math.cos(175 * RAD), ay + 5 * Math.sin(175 * RAD));
      ctx.lineTo(ax + 5 * Math.cos(-65 * RAD), ay + 5 * Math.sin(-65 * RAD));
      ctx.closePath(); ctx.fill();
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
      var i;
      for (i = 0; i < slots.length; i++) {
        ctx.fillStyle = '#8b98a8';
        ctx.fillText(slots[i].label, slots[i].hx, TRAY_Y + 36);
        ctx.save();
        ctx.translate(slots[i].hx, slots[i].hy);
        drawGlyph(slots[i].type, null);
        ctx.restore();
      }
      for (i = 0; i < instances.length; i++) drawObject(instances[i]);
      if (hot && instances.indexOf(hot) !== -1) drawRing(hot);
      if (drag && drag.mode === 'rotate') {
        ctx.fillStyle = '#c4e4ff';
        ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillText(Math.round(normAng(drag.obj.rot)) + '°', drag.obj.x, drag.obj.y - 44);
      }
      if (Date.now() < flashUntil) {
        ctx.fillStyle = 'rgba(255,179,107,.9)';
        ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
        ctx.fillText(flashMsg, W / 2, TRAY_LINE - 12);
      }
    }

    /* ---------- strip: integrates every ray that leaves the scene ---------- */
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

    /* ---------- INVENT panel ----------
       A recipe, not a magic object: pick a shape (the wedge angle), an index
       (how hard it bends), how the index climbs toward the blue (the fan),
       how the light splits between reflected / transmitted / absorbed, and
       how rough the surface is. The preview runs the same ray code as the
       bench, so what is drawn in the little box is what lands on the big one. */
    var TINTS = ['#c4e4ff', '#7ee0ff', '#a07cff', '#ffb36b', '#ff6b81'];
    var draft = { shape: 'tri', refl: 20, trans: 70, abs: 10,
                  n: 1.52, disp: 0.020, scatter: 0, tint: TINTS[1], name: '' };

    /* real materials, real numbers: index at 550 nm and the spread of index
       across the visible band (crown 0.008, dense flint 0.019, diamond 0.044) */
    var PRESETS = [
      ['WATER',   { shape: 'tri',  n: 1.333, disp: 0.008, refl: 8,  trans: 88, abs: 4,  scatter: 0,  tint: TINTS[1] }],
      ['CROWN',   { shape: 'tri',  n: 1.517, disp: 0.008, refl: 8,  trans: 88, abs: 4,  scatter: 0,  tint: TINTS[0] }],
      ['FLINT',   { shape: 'tri',  n: 1.620, disp: 0.019, refl: 12, trans: 84, abs: 4,  scatter: 0,  tint: TINTS[2] }],
      ['DIAMOND', { shape: 'tri',  n: 2.417, disp: 0.044, refl: 29, trans: 68, abs: 3,  scatter: 0,  tint: TINTS[0] }],
      ['FROSTED', { shape: 'slab', n: 1.517, disp: 0.008, refl: 10, trans: 72, abs: 18, scatter: 55, tint: TINTS[0] }],
      ['MIRROR',  { shape: 'slab', n: 1.000, disp: 0,     refl: 92, trans: 2,  abs: 6,  scatter: 0,  tint: TINTS[0] }],
      ['LENS',    { shape: 'lens', n: 1.517, disp: 0.012, refl: 8,  trans: 88, abs: 4,  scatter: 0,  tint: TINTS[1] }]
    ];

    var panel = document.createElement('div');
    panel.hidden = true;
    /* no display in this rule: an inline display would beat the hidden
       attribute and the panel could never close. The flex row lives on an
       inner wrapper instead. */
    panel.style.cssText = 'margin-top:8px;padding:12px 14px;border:1px solid rgba(196,228,255,.16);' +
      'background:#070a10;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b98a8;';
    var inner = document.createElement('div');
    inner.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px 18px;align-items:flex-start;';
    panel.appendChild(inner);
    mount.appendChild(panel);

    var ctrlCol = document.createElement('div');
    ctrlCol.style.cssText = 'flex:1 1 300px;min-width:min(300px,100%);';
    var prevCol = document.createElement('div');
    prevCol.style.cssText = 'flex:0 1 196px;min-width:170px;';
    inner.appendChild(ctrlCol); inner.appendChild(prevCol);

    function row() {
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;margin:6px 0;';
      ctrlCol.appendChild(d);
      return d;
    }
    function btn(txt) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = txt;
      b.style.cssText = 'font:inherit;font-size:11px;cursor:pointer;background:none;color:#9aa2b1;' +
        'border:1px solid rgba(196,228,255,.16);padding:5px 9px;';
      return b;
    }
    function markOn(b, on) {
      b.style.color = on ? '#7ee0ff' : '#9aa2b1';
      b.style.borderColor = on ? 'rgba(126,224,255,.6)' : 'rgba(196,228,255,.16)';
      b.style.background = on ? 'rgba(126,224,255,.08)' : 'none';
    }
    function label(txt) {
      var l = document.createElement('span');
      /* every row label is the same width, so the sliders line up in one
         column however long the word is */
      l.style.cssText = 'display:inline-block;min-width:min(92px,24vw);flex:none;';
      l.textContent = txt;
      return l;
    }

    var startRow = row();
    startRow.appendChild(label('START FROM'));
    var presetBtns = [];
    PRESETS.forEach(function (pz) {
      var b = btn(pz[0]);
      b.title = 'n = ' + pz[1].n.toFixed(3) + ', dispersion ' + pz[1].disp.toFixed(3);
      b.addEventListener('click', function () {
        for (var k in pz[1]) draft[k] = pz[1][k];
        draft.name = pz[0].charAt(0) + pz[0].slice(1).toLowerCase();
        syncAll();
        presetBtns.forEach(function (x) { markOn(x.el, x.n === pz[0]); });
      });
      presetBtns.push({ n: pz[0], el: b });
      startRow.appendChild(b);
    });

    var shapeRow = row();
    shapeRow.appendChild(label('SHAPE'));
    var shapeBtns = [];
    [['slab', 'SLAB'], ['wedge', 'WEDGE'], ['tri', 'PRISM'], ['lens', 'LENS'], ['blob', 'BLOB']].forEach(function (sp) {
      var b = btn(sp[1]);
      b.title = APEX[sp[0]] ? APEX[sp[0]] + ' degree wedge' : 'no wedge: no deviation';
      b.addEventListener('click', function () { draft.shape = sp[0]; syncAll(); });
      shapeBtns.push({ id: sp[0], el: b });
      shapeRow.appendChild(b);
    });

    var sliders = {};
    function mkSlider(key, name, min, max, step, fmt) {
      var r = row();
      r.style.flexWrap = 'nowrap';
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = String(min); inp.max = String(max); inp.step = String(step);
      inp.value = String(draft[key]);
      /* nowrap plus a zero minimum keeps label, slider and value on one line
         at any width: the slider is the part that gives */
      inp.style.cssText = 'flex:1 1 60px;min-width:0;';
      inp.setAttribute('aria-label', name);
      var val = document.createElement('span');
      val.style.cssText = 'min-width:52px;text-align:right;color:#c4e4ff;flex:none;';
      val.textContent = fmt(draft[key]);
      r.appendChild(label(name)); r.appendChild(inp); r.appendChild(val);
      sliders[key] = { inp: inp, val: val, fmt: fmt };
      return inp;
    }
    var pct = function (v) { return Math.round(v) + '%'; };
    mkSlider('n', 'INDEX', 1, 2.6, 0.001, function (v) { return 'n ' + (+v).toFixed(3); })
      .addEventListener('input', function () { draft.n = +sliders.n.inp.value; syncAll(); });
    /* REFLECT / TRANSMIT / ABSORB are one photon's fate, so they add to 100 */
    ['refl', 'trans', 'abs'].forEach(function (key, ki) {
      var names = ['REFLECT', 'TRANSMIT', 'ABSORB'];
      mkSlider(key, names[ki], 0, 100, 1, pct)
        .addEventListener('input', function () { renorm(key); syncAll(true); });
    });
    mkSlider('disp', 'DISPERSION', 0, DISP_MAX, 0.001, function (v) { return (+v).toFixed(3); })
      .addEventListener('input', function () { draft.disp = +sliders.disp.inp.value; syncAll(); });
    mkSlider('scatter', 'SCATTER', 0, 100, 1, pct)
      .addEventListener('input', function () { draft.scatter = +sliders.scatter.inp.value; syncAll(); });

    function renorm(changed) {
      var keys = ['refl', 'trans', 'abs'];
      draft[changed] = +sliders[changed].inp.value;
      var others = keys.filter(function (k) { return k !== changed; });
      var rest = 100 - draft[changed];
      var sum = draft[others[0]] + draft[others[1]];
      if (sum <= 0) { draft[others[0]] = rest / 2; draft[others[1]] = rest / 2; }
      else {
        draft[others[0]] = draft[others[0]] * rest / sum;
        draft[others[1]] = rest - draft[others[0]];
      }
    }

    var tintRow = row();
    tintRow.appendChild(label('TINT'));
    var tintBtns = [];
    TINTS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'width:22px;height:22px;cursor:pointer;background:' + t + ';' +
        'border:2px solid rgba(196,228,255,.2);padding:0;';
      b.setAttribute('aria-label', 'tint ' + t);
      b.addEventListener('click', function () { draft.tint = t; syncAll(); });
      tintBtns.push({ t: t, el: b });
      tintRow.appendChild(b);
    });

    var nameRow = row();
    nameRow.appendChild(label('NAME'));
    var nameInp = document.createElement('input');
    nameInp.type = 'text'; nameInp.maxLength = 14; nameInp.placeholder = 'my glass';
    nameInp.style.cssText = 'font:inherit;background:#04070a;color:#cfe6e6;padding:5px 8px;' +
      'border:1px solid rgba(196,228,255,.2);width:150px;';
    nameInp.addEventListener('input', function () { draft.name = nameInp.value; });
    nameRow.appendChild(nameInp);

    var actRow = row();
    var createBtn = btn('CREATE'), surpriseBtn = btn('SURPRISE ME'), cancelBtn = btn('CANCEL');
    markOn(createBtn, true);
    actRow.appendChild(createBtn); actRow.appendChild(surpriseBtn); actRow.appendChild(cancelBtn);
    cancelBtn.addEventListener('click', function () { panel.hidden = true; editing = null; });
    /* a roll of the dice that still lands on a possible material: real solids
       run from about n 1.3 to 2.4, and dispersion rises with index (higher
       index glasses are the fiery ones), so the two are rolled together */
    var ADJ = ['moody', 'cheap', 'haunted', 'borrowed', 'wet', 'ancient', 'suspicious', 'honest'];
    var NOUN = ['glass', 'ice', 'amber', 'quartz', 'resin', 'crystal', 'jelly', 'stuff'];
    surpriseBtn.addEventListener('click', function () {
      var rnd = Math.random();
      draft.n = +(1.3 + rnd * 1.1).toFixed(3);
      draft.disp = +(0.004 + rnd * rnd * 0.05).toFixed(3);
      draft.shape = ['slab', 'wedge', 'tri', 'lens', 'blob'][Math.floor(Math.random() * 5)];
      draft.scatter = Math.random() < 0.3 ? Math.round(Math.random() * 60) : 0;
      draft.refl = Math.round(5 + Math.random() * 45);
      draft.abs = Math.round(Math.random() * 25);
      draft.trans = 100 - draft.refl - draft.abs;
      draft.tint = TINTS[Math.floor(Math.random() * TINTS.length)];
      draft.name = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];
      presetBtns.forEach(function (x) { markOn(x.el, false); });
      syncAll();
    });

    /* ---------- the live preview: the same optic, the same ray code -------- */
    var pcv = document.createElement('canvas');
    pcv.width = 380; pcv.height = 260;                 /* drawn at 2x for sharpness */
    pcv.style.cssText = 'display:block;width:100%;height:auto;background:#05070c;' +
      'border:1px solid rgba(196,228,255,.16);';
    pcv.setAttribute('aria-label', 'Live preview of the optic being invented');
    var pctx = pcv.getContext('2d');
    var pcap = document.createElement('p');
    pcap.style.cssText = 'margin:6px 0 0;font-size:10.5px;line-height:1.5;color:#6c7c8c;';
    var ptitle = document.createElement('p');
    ptitle.style.cssText = 'margin:0 0 5px;font-size:10.5px;letter-spacing:.1em;color:#8b98a8;';
    ptitle.textContent = 'PREVIEW · WHITE LIGHT IN';
    prevCol.appendChild(ptitle); prevCol.appendChild(pcv); prevCol.appendChild(pcap);

    function recipeOf(d) {
      return { shape: d.shape, refl: d.refl / 100, trans: d.trans / 100, abs: d.abs / 100,
               n: d.n, disp: d.disp, scatter: d.scatter / 100, tint: hex2rgb(d.tint),
               name: (d.name || '').trim() };
    }

    function drawPreview() {
      var rc = recipeOf(draft), apex = APEX[rc.shape] || 0;
      var PW = 190, PH = 130, ox = PW * 0.46, oy = PH * 0.46, tilt = 18;
      pctx.setTransform(2, 0, 0, 2, 0, 0);
      pctx.fillStyle = '#05070c'; pctx.fillRect(0, 0, PW, PH);
      pctx.save();
      pctx.globalCompositeOperation = 'lighter';
      /* the beam in */
      pctx.globalAlpha = .9; pctx.strokeStyle = '#ffffff'; pctx.lineWidth = 1.4;
      pctx.beginPath(); pctx.moveTo(4, oy); pctx.lineTo(ox, oy); pctx.stroke();
      var m = [Math.cos((tilt + 90) * RAD), Math.sin((tilt + 90) * RAD)];
      var LEN = PW;
      if (rc.refl > 0.02) {                            /* the reflected share */
        var rd = reflectDir(1, 0, m);
        pctx.globalAlpha = Math.min(1, rc.refl * 1.6); pctx.lineWidth = 1.2;
        pctx.beginPath(); pctx.moveTo(ox, oy);
        pctx.lineTo(ox + rd[0] * LEN, oy + rd[1] * LEN); pctx.stroke();
      }
      if (rc.trans > 0.02) {                           /* the transmitted share */
        var N = 26;
        for (var i = 0; i < N; i++) {
          var nm = 380 + 370 * i / (N - 1), dd;
          if (rc.shape === 'lens') {
            var f = focalOf(rc, nm), fx = ox + f * 0.62, fy = oy;
            var vx = fx - ox, vy = fy - oy, L = Math.sqrt(vx * vx + vy * vy) || 1;
            dd = [vx / L, vy / L];
          } else {
            dd = rotDir(1, 0, deviate(rc, nm, apex) + scatterOf(rc, i));
          }
          var c = api.strip.wavelengthRGB(nm);
          pctx.strokeStyle = 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
          pctx.globalAlpha = Math.min(1, rc.trans) * (apex || rc.scatter || rc.shape === 'lens' ? .5 : .12);
          pctx.lineWidth = 1.6;
          pctx.beginPath(); pctx.moveTo(ox, oy);
          pctx.lineTo(ox + dd[0] * LEN, oy + dd[1] * LEN); pctx.stroke();
        }
      }
      if (rc.abs > 0.02) {                             /* what the glass keeps */
        var g = pctx.createRadialGradient(ox, oy, 0, ox, oy, 22);
        g.addColorStop(0, 'rgba(' + rc.tint + ',' + (0.5 * rc.abs).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + rc.tint + ',0)');
        pctx.globalAlpha = 1; pctx.fillStyle = g;
        pctx.beginPath(); pctx.arc(ox, oy, 22, 0, Math.PI * 2); pctx.fill();
      }
      pctx.restore();
      /* the optic itself, drawn by the same glyph the bench uses */
      var save = ctx; ctx = pctx;
      pctx.save();
      pctx.translate(ox, oy); pctx.rotate(tilt * RAD); pctx.scale(.62, .62);
      drawGlyph('custom', { recipe: rc });
      pctx.restore();
      ctx = save;

      /* the honest numbers, whatever the drawing had to exaggerate */
      var red = deviate(rc, 650, apex), blue = deviate(rc, 450, apex);
      var trueSpread = (indexAt(rc, 450) - indexAt(rc, 650)) * apex;
      if (rc.shape === 'lens') {
        pcap.innerHTML = 'n ' + rc.n.toFixed(3) + ' · focus red ' + Math.round(focalOf(rc, 650)) +
          ' px, blue ' + Math.round(focalOf(rc, 450)) + ' px. The blue focuses closer: chromatic aberration.';
      } else if (!apex) {
        pcap.innerHTML = 'No wedge, so no deviation: a parallel slab shifts the beam sideways but never fans it.' +
          (rc.scatter > 0.02 ? ' Scatter is roughening the surface.' : ' Pick WEDGE or PRISM to bend it.');
      } else {
        pcap.innerHTML = 'Deviation (n−1)×' + apex + '°: red ' + red.toFixed(1) + '°, blue ' + blue.toFixed(1) +
          '°. True spread ' + trueSpread.toFixed(2) + '°, drawn ×' + DISP_GAIN + ' to be visible.';
      }
    }

    function syncAll(skipInputs) {
      shapeBtns.forEach(function (x) { markOn(x.el, x.id === draft.shape); });
      tintBtns.forEach(function (x) { x.el.style.borderColor = x.t === draft.tint ? '#eff4fb' : 'rgba(196,228,255,.2)'; });
      for (var k in sliders) {
        var v = draft[k];
        if (!skipInputs || (k !== 'refl' && k !== 'trans' && k !== 'abs')) sliders[k].inp.value = String(v);
        else sliders[k].inp.value = String(Math.round(v));
        sliders[k].val.textContent = sliders[k].fmt(v);
      }
      if (nameInp.value !== draft.name) nameInp.value = draft.name;
      drawPreview();
    }

    /* an optic already on the bench can be reopened and rewritten in place:
       double-click it, tune the recipe, SAVE */
    var editing = null;
    function openInvent(inst) {
      editing = inst || null;
      if (inst) {
        var rc = inst.recipe;
        draft.shape = rc.shape; draft.n = rc.n; draft.disp = rc.disp;
        draft.refl = Math.round(rc.refl * 100); draft.trans = Math.round(rc.trans * 100);
        draft.abs = Math.round(rc.abs * 100); draft.scatter = Math.round((rc.scatter || 0) * 100);
        draft.name = rc.name || '';
        for (var i = 0; i < TINTS.length; i++) if (hex2rgb(TINTS[i]) === rc.tint) draft.tint = TINTS[i];
        presetBtns.forEach(function (x) { markOn(x.el, false); });
      }
      createBtn.textContent = inst ? 'SAVE' : 'CREATE';
      panel.hidden = false;
      syncAll();
    }
    createBtn.addEventListener('click', function () {
      if (editing && instances.indexOf(editing) !== -1) {
        editing.recipe = recipeOf(draft);
        hot = editing;
      } else {
        if (instances.length >= MAX_OPTICS) { flash('MAX ' + MAX_OPTICS + ' OBJECTS ON THE BENCH'); return; }
        var inst = {
          type: 'custom', x: Math.round(W * 0.55), y: BEAM_Y, rot: 0, nm: null,
          recipe: recipeOf(draft)
        };
        instances.push(inst);
        hot = inst;
      }
      editing = null;
      createBtn.textContent = 'CREATE';
      panel.hidden = true;
      draw();
      updateStrip();
    });
    syncAll();

    /* ---------- fullscreen ---------- */
    var fs = false, fsMode = null;             /* 'api' | 'css' */
    var fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.textContent = '⛶';
    fsBtn.setAttribute('aria-label', 'Toggle fullscreen');
    fsBtn.style.cssText = 'position:absolute;top:8px;right:-10px;z-index:85;' +
      'font:14px ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;' +
      'background:rgba(5,7,12,.6);color:#9aa2b1;border:1px solid rgba(196,228,255,.16);' +
      'padding:3px 8px;line-height:1;';
    mount.appendChild(fsBtn);                  /* .stage is position:relative */

    function applyFS() {
      fsBtn.textContent = fs ? '✕' : '⛶';
      fsBtn.style.right = fs ? '10px' : '-10px';
      if (fs) {
        canvas.style.width = '100%';
        canvas.style.margin = '0';
        canvas.style.height = '100%';
        panel.style.position = 'fixed'; panel.style.left = '12px';
        panel.style.bottom = '12px'; panel.style.zIndex = '90';
        panel.style.maxWidth = '420px';
      } else {
        canvas.style.width = 'calc(100% + 36px)';
        canvas.style.margin = '0 -18px';
        canvas.style.height = '300px';
        panel.style.position = ''; panel.style.left = '';
        panel.style.bottom = ''; panel.style.zIndex = '';
        panel.style.maxWidth = '';
      }
      resize();
    }

    function cssTakeover(on) {
      if (on) {
        mount.style.position = 'fixed'; mount.style.top = '0'; mount.style.left = '0';
        mount.style.right = '0'; mount.style.bottom = '0';
        mount.style.zIndex = '80'; mount.style.background = '#04070a';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      } else {
        mount.style.position = ''; mount.style.top = ''; mount.style.left = '';
        mount.style.right = ''; mount.style.bottom = '';
        mount.style.zIndex = ''; mount.style.background = '';
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
    }

    function enterCSS() { fs = true; fsMode = 'css'; cssTakeover(true); applyFS(); }
    function exitCSS() { fs = false; fsMode = null; cssTakeover(false); applyFS(); }

    fsBtn.addEventListener('click', function () {
      if (!fs) {
        if (mount.requestFullscreen) {         /* real Fullscreen API first */
          var pr = mount.requestFullscreen();
          if (pr && pr.catch) pr.catch(function () { enterCSS(); });
        } else {
          enterCSS();                          /* iOS Safari fallback */
        }
      } else if (fsMode === 'api') {
        if (document.exitFullscreen) document.exitFullscreen();
      } else {
        exitCSS();
      }
    });

    document.addEventListener('fullscreenchange', function () {
      if (document.fullscreenElement === mount) {
        fs = true; fsMode = 'api';
        mount.style.background = '#04070a';
        applyFS();
      } else if (fsMode === 'api') {
        fs = false; fsMode = null;
        mount.style.background = '';
        applyFS();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fs && fsMode === 'css') exitCSS();
    });

    /* ---------- interaction ---------- */
    function pointer(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function nearest(list, p, rad, cx, cy) {
      var best = null, bd = rad;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        var d = Math.sqrt((o[cx] - p.x) * (o[cx] - p.x) + (o[cy] - p.y) * (o[cy] - p.y));
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }

    var lastTap = { o: null, t: 0 };
    canvas.addEventListener('pointerdown', function (e) {
      var p = pointer(e);
      var grab = nearest(instances, p, 16, 'x', 'y');
      if (!grab && hot && instances.indexOf(hot) !== -1) {
        var dh = Math.sqrt((hot.x - p.x) * (hot.x - p.x) + (hot.y - p.y) * (hot.y - p.y));
        if (dh >= 22 && dh <= 42) {            /* rotation ring: drag to aim */
          e.preventDefault();
          var a0 = Math.atan2(p.y - hot.y, p.x - hot.x) / RAD;
          drag = { mode: 'rotate', obj: hot, base: hot.rot - a0, id: e.pointerId };
          canvas.setPointerCapture(e.pointerId);
          draw();
          return;
        }
      }
      if (!grab) grab = nearest(instances, p, 28, 'x', 'y');
      if (grab) {
        e.preventDefault();
        /* a second tap on the same invented optic reopens its recipe. This is
           counted here rather than with a dblclick listener because the
           preventDefault above suppresses the browser's own double-click,
           and counting taps works the same under a finger. */
        if (grab.type === 'custom' && onBench(grab) && lastTap.o === grab &&
            Date.now() - lastTap.t < 400) {
          lastTap = { o: null, t: 0 };
          openInvent(grab);
          return;
        }
        lastTap = { o: grab, t: Date.now() };
        hot = grab;
        drag = { mode: 'move', obj: grab, dx: grab.x - p.x, dy: grab.y - p.y, id: e.pointerId, sx: p.x, sy: p.y, moved: false };
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        draw();
        updateStrip();
        return;
      }
      var slot = nearest(slots, p, 30, 'hx', 'hy');
      if (!slot) return;
      e.preventDefault();
      if (slot.type === 'invent') {            /* click or drag-out both open the panel */
        openInvent(null);                      /* a fresh recipe, not the last edit */
        return;
      }
      if (instances.length >= MAX_OPTICS) { flash('MAX ' + MAX_OPTICS + ' OBJECTS ON THE BENCH'); return; }
      if (slot.type === 'light' && countLights() >= MAX_LIGHTS) { flash('MAX ' + MAX_LIGHTS + ' LIGHT SOURCES'); return; }
      var inst = { type: slot.type, x: p.x, y: p.y, rot: 0, recipe: null, nm: null };
      instances.push(inst);                    /* the tray is an infinite supply */
      hot = inst;
      drag = { mode: 'move', obj: inst, dx: 0, dy: 0, id: e.pointerId, sx: p.x, sy: p.y, moved: true };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      draw();
      updateStrip();
    });

    canvas.addEventListener('pointermove', function (e) {
      var p = pointer(e);
      if (drag && e.pointerId === drag.id) {
        var o = drag.obj;
        if (drag.mode === 'move') {
          if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4) drag.moved = true;
          if (!drag.moved) return;
          o.x = Math.min(Math.max(p.x + drag.dx, minX(o)), W - 20);
          o.y = Math.min(Math.max(p.y + drag.dy, 16), H - 16);
        } else {
          var a = Math.atan2(p.y - o.y, p.x - o.x) / RAD;
          var rr = drag.base + a;
          if (e.shiftKey) rr = Math.round(rr / 45) * 45;   /* SHIFT snaps to 45° */
          o.rot = normAng(rr);
        }
        draw();
        updateStrip();
        return;
      }
      if (drag) return;
      var h2 = nearest(instances, p, 34, 'x', 'y');        /* hover shows the ring */
      var keep = h2 === null && hot && instances.indexOf(hot) !== -1 &&
        Math.sqrt((hot.x - p.x) * (hot.x - p.x) + (hot.y - p.y) * (hot.y - p.y)) <= 46;
      if (h2 !== hot && !keep) {
        hot = h2;
        draw();
      }
    });

    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var o = drag.obj, mode = drag.mode, moved = drag.moved;
      drag = null;
      canvas.style.cursor = 'grab';
      if (mode === 'move') {
        if (!moved && o.type === 'light') {
          /* a tap on a source cycles White → Red → Green → Blue */
          var ci = LIGHT_NMS.indexOf(o.nm);
          o.nm = LIGHT_NMS[(ci + 1) % LIGHT_NMS.length];
        } else if (o.y > TRAY_LINE - 6) {       /* dropped back on the tray: delete */
          var ix = instances.indexOf(o);
          if (ix !== -1) instances.splice(ix, 1);
          if (hot === o) hot = null;
        } else if (Math.abs(o.y - BEAM_Y) < 34 && Math.abs(normAng(o.rot)) % 180 < 30) {
          o.y = BEAM_Y;                        /* gentle snap onto the beam line */
        }
      }
      draw();
      updateStrip();
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(resize).observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();   /* initial draw */
  }
})();
