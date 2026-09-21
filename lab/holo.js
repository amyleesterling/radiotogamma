/* F. HOLOGRAM — a hologram is not a picture of a thing. It is a recording of
   an interference pattern. Two waves land on the plate: the light scattered
   off the object, and a plane reference wave straight from the laser. Where
   they arrive in step the plate is exposed, where they arrive out of step it
   is not, so what the emulsion keeps is the PHASE of the object wave, the
   direction each ray was travelling, and not just its brightness. Light the
   developed fringes with the reference beam alone and they act as a grating
   whose first order leaves at exactly the angle the object wave had, so the
   rays diverge from where the object used to be: a virtual image at the
   recorded depth, with real parallax. Break the plate and every piece still
   holds the whole scene, because every piece saw the whole scene.
   Self-contained experiment for The Light Lab; plugs into window.LAB. */
(function () {
  'use strict';
  if (!window.LAB || !window.LAB.register) return;

  var TAU = Math.PI * 2, DEG = 180 / Math.PI;
  var MONO = '11.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var MONO_S = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  // ---- scale ---------------------------------------------------------------
  // Every length in here is a micrometre, and that is the whole trick of
  // making this drawable. A hologram of something you could hold carries tens
  // of thousands of fringes a micron or two apart: 1e4 lines across a 300 px
  // canvas is grey mush. Shrink the WHOLE scene, plate and object together,
  // and every angle is preserved, so the fringe spacings stay exactly where
  // they really are (0.7 to 3 µm here) and only the count comes down to about
  // sixty, which a screen can actually show. Multiply every number below by
  // 1000 and this is an 8 cm plate with the subject 8 cm behind it.
  var U_HALF = 40;              // the plate runs from -40 to +40 µm along x
  var U_DRAW = 52;              // how far either side of the plate we draw
  var ZO_MIN = 20, ZO_MAX = 110;
  var ZE = 80;                  // the eye sits 80 µm in front of the plate
  var PUPIL = 7;                // µm; scaled up by 1000 that is a 7 mm pupil
  var U_MARK = -46;             // a scratch on the plate holder: the near reference
  var OBAMP = 0.40;             // object wave amplitude at the plate centre, |R| = 1

  // The object is three points in a tight cluster rather than one, because
  // "the whole object survives" is the thing a broken plate has to show, and
  // one point cannot demonstrate it. They sit at slightly different depths so
  // the reconstruction has real depth in it.
  var OBJ = [
    { du: -7, dz: 6, amp: 1.00 },
    { du: 0, dz: -7, amp: 0.95 },
    { du: 7, dz: 3, amp: 0.90 }
  ];

  // Breaking the plate keeps one contiguous shard, deliberately off centre so
  // the viewer has to move to look through it. Widths: 80, 34, 17, 8 µm.
  var SHARDS = [[-U_HALF, U_HALF], [2, 36], [10, 27], [15, 23]];

  var HINT_RECORD = 'Nothing here is a picture. The plate is recording where the object wave and the reference wave arrive in step, and where they arrive out of step. Take the reference angle down to 0° and each point writes a Gabor zone plate: fringes that open right out at the centre and crowd tighter and tighter toward the edges. Then replay it.';
  var HINT_REPLAY = 'Now the developed plate is lit by the reference beam alone. Every fringe is a grating line, and the first order leaves at exactly the angle the object wave had, so the rays diverge from where the object used to be. Drag the eye: the three points swing against the mark on the holder, the way a real scene does and a photograph never can. Now break it.';
  var HINT_BROKEN = 'The shard still reconstructs all three points, in the right places at the right depth, because every part of the plate saw every part of the object. It is dimmer, because less light gets through, and blurrier, because an aperture of width A cannot resolve anything finer than about 1.22 λ/A. A piece of a hologram is not a piece of the scene. It is a smaller window onto all of it.';

  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' +
      Math.round(c[2] * 255) + ',' + a.toFixed(3) + ')';
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  // lab.html renders the hint as a sibling of the stage, so walk up for it
  function bindHint(mount) {
    var exp = mount.closest ? mount.closest('.exp') : null;
    var el = exp && exp.querySelector('.hint');
    return function (t) { if (el && el.textContent !== t) el.textContent = t; };
  }
  // the handful of lines a physicist would actually reach for
  function laserName(nm) {
    if (Math.abs(nm - 633) <= 2) return 'HeNe';
    if (Math.abs(nm - 532) <= 2) return 'green DPSS';
    if (Math.abs(nm - 488) <= 2) return 'argon';
    if (Math.abs(nm - 405) <= 2) return 'violet diode';
    return '';
  }

  window.LAB.register({
    id: 'holo',
    title: 'F. HOLOGRAM',
    goal: 'NOT A PICTURE OF A THING. A RECORDING OF AN INTERFERENCE PATTERN.',
    question: {
      text: 'A hologram is cut in half. What do you see through one half?',
      choices: ['Half the scene, sliced down the middle',
                'The whole scene, from a narrower window',
                'Nothing: the recording is ruined',
                'The whole scene, at half the size'],
      answer: 1,
      reveal: 'The whole scene, a little dimmer and a little blurrier. A hologram is not a picture that can be cut into pieces: every point on the plate is lit by light from every point of the object, so every point on the plate records fringes belonging to the whole scene. A shard is simply a smaller window to look through. You lose brightness, in proportion to the area left, and you lose resolution, because an aperture of width A cannot separate detail finer than about 1.22 λ/A in angle: an 8 µm shard at 633 nm resolves 5.5°, where the full 80 µm plate resolved 0.55°. Cut a photograph in half and half the scene is gone. Cut a hologram in half and you have only stepped back from the window.',
    },
    hint: HINT_RECORD,
    init: init
  });

  function init(mount, api) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label',
      'A hologram being recorded and replayed: an object point, a reference beam, the fringes on the plate, and the reconstructed virtual image');
    mount.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var controls = document.createElement('div');
    controls.className = 'controls';
    controls.innerHTML =
      '<label>Object depth <input type="range" id="holoZ" min="20" max="110" value="80" ' +
      'aria-label="Depth of the object behind the plate, micrometres"></label>' +
      '<span class="num" id="holoZOut">80 µm</span>' +
      '<label>Reference angle <input type="range" id="holoA" min="0" max="25" step="0.5" value="12" ' +
      'aria-label="Angle of the reference beam, degrees"></label>' +
      '<span class="num" id="holoAOut">12.0°</span>' +
      '<label>Wavelength <input type="range" id="holoW" min="400" max="700" value="633" ' +
      'aria-label="Laser wavelength, nanometres"></label>' +
      '<span class="num" id="holoWOut">633 nm HeNe</span>' +
      '<button type="button" id="holoMode" aria-pressed="false">REPLAY THE PLATE</button>' +
      '<button type="button" id="holoBreak">BREAK THE PLATE</button>' +
      '<button type="button" id="holoFix" hidden>RESTORE THE PLATE</button>';
    mount.appendChild(controls);
    var zIn = controls.querySelector('#holoZ'), zOut = controls.querySelector('#holoZOut');
    var aIn = controls.querySelector('#holoA'), aOut = controls.querySelector('#holoAOut');
    var wIn = controls.querySelector('#holoW'), wOut = controls.querySelector('#holoWOut');
    var modeBtn = controls.querySelector('#holoMode');
    var breakBtn = controls.querySelector('#holoBreak'), fixBtn = controls.querySelector('#holoFix');

    var setHint = bindHint(mount);

    // ---- state -------------------------------------------------------------
    var replay = false, zo = 80, uo = 0, theta = 12 / DEG, lam = 0.633;  // lam in µm
    var lvl = 0, eyeU = 0, expo = 1, solvedDone = false;
    var W = 860, H = 400, defH = 0, dpr = 1, port = false;
    var s = 3.4, plateX = 470, plateY = 300, cxp = 430, cyp = 200;
    var rafId = 0, onScreen = true, lastNow = 0, march = 0;

    // ---- the frame: u runs along the plate, v is depth (negative = object) --
    // One transform, two layouts. Wide: the plate is a vertical line, object
    // on the left, eye on the right. Narrow: the plate lies across the canvas,
    // object above, eye below, so the plate gets the long side of a phone
    // screen and its fringes stay wide enough to see.
    function PX(u, v) { return port ? (cxp + u * s) : (plateX + v * s); }
    function PY(u, v) { return port ? (plateY + v * s) : (cyp - u * s); }
    function toU(x, y) { return port ? (x - cxp) / s : (cyp - y) / s; }
    function toV(x, y) { return port ? (y - plateY) / s : (x - plateX) / s; }
    function line(u1, v1, u2, v2) {
      ctx.beginPath();
      ctx.moveTo(PX(u1, v1), PY(u1, v1));
      ctx.lineTo(PX(u2, v2), PY(u2, v2));
      ctx.stroke();
    }

    // ---- the physics -------------------------------------------------------
    // RECORD. At plate point u the object wave from a point at (pu, -pz) has
    // travelled r = sqrt((u - pu)^2 + pz^2); the plane reference wave, tilted
    // by theta, has travelled u*sin(theta). The plate is exposed by
    // |O + R|^2 = |O|^2 + |R|^2 + 2|O||R| cos(k (r - u sin theta)).
    function aper() { return SHARDS[lvl]; }
    function aperW() { var a = aper(); return a[1] - a[0]; }
    function pointAt(j) { return { u: uo + OBJ[j].du, z: zo + OBJ[j].dz }; }

    // Averaged across the pixel, not sampled at its centre. The mean of
    // cos(phi) over a pixel whose phase runs phi1 to phi2 is exactly
    // (sin phi2 - sin phi1)/(phi2 - phi1), which fades smoothly to flat grey
    // as the fringes go finer than one pixel. That is not a rendering dodge:
    // it is precisely what a real plate does to a naked eye that cannot
    // resolve a micron either. A hologram in the hand looks like dirty glass.
    function plateBright(ua, ub) {
      var k = TAU / lam, sT = Math.sin(theta), um = 0.5 * (ua + ub);
      var amp = [], rm = [], dc = 0, cross = 0, tot = 0, j, i;
      for (j = 0; j < OBJ.length; j++) {
        var p = pointAt(j);
        var da = ua - p.u, db = ub - p.u, dm = um - p.u;
        var ra = Math.sqrt(da * da + p.z * p.z);
        var rb = Math.sqrt(db * db + p.z * p.z);
        var r = Math.sqrt(dm * dm + p.z * p.z);
        var a = OBJ[j].amp * OBAMP * zo / r;        // a point source falls off as 1/r
        amp[j] = a; rm[j] = r; dc += a * a; tot += a;
        var pa = k * (ra - ua * sT), pb = k * (rb - ub * sT), dp = pb - pa;
        cross += 2 * a * (Math.abs(dp) < 1e-7 ? Math.cos(pa) : (Math.sin(pb) - Math.sin(pa)) / dp);
      }
      // object against object: these beat at k(r_i - r_j), which varies slowly
      // across the plate, so point sampling them is safe
      for (i = 0; i < OBJ.length; i++)
        for (j = i + 1; j < OBJ.length; j++)
          dc += 2 * amp[i] * amp[j] * Math.cos(k * (rm[i] - rm[j]));
      var I = 1 + dc + cross, Imax = (1 + tot) * (1 + tot);
      return Math.pow(clamp(I / Imax, 0, 1), 0.7);
    }

    // local fringe frequency at u, in lines per µm: the derivative of the
    // recorded phase. Its reciprocal is the local grating spacing d(u).
    function nu(u, j) {
      var p = pointAt(j), d = u - p.u, r = Math.sqrt(d * d + p.z * p.z);
      return (d / r - Math.sin(theta)) / lam;
    }
    function spacing(u, j) { var n = Math.abs(nu(u, j)); return n < 1e-9 ? Infinity : 1 / n; }

    // REPLAY. Light the fringes with the reference beam alone and each patch
    // of plate is a grating of spacing d(u): sin(out) = sin(in) + m lambda / d.
    // Work it out that way rather than asserting the answer, and for m = +1 the
    // sin(theta) terms cancel and what comes out is (u - pu)/r, the direction
    // cosine the object wave had at that very point. The plate hands the
    // object wave back. m = -1 is the twin image, m = 0 is the beam going on
    // through undiffracted.
    function sinOut(u, j, m) { return clamp(Math.sin(theta) + m * lam * nu(u, j), -0.999, 0.999); }

    // Diffraction limit of the surviving aperture. Rayleigh: two points are
    // resolved when they are 1.22 lambda / A apart in angle, so the point
    // spreads to 1.22 lambda z / A across at the image.
    function blurUm(pz) { return 1.22 * lam * pz / aperW(); }

    // Where the sight line from the eye to a reconstructed point crosses the
    // plate. If that crossing has been broken away, the eye cannot see that
    // point from here, exactly as with a window.
    function crossing(j) {
      var p = pointAt(j);
      return p.u + (eyeU - p.u) * p.z / (p.z + ZE);
    }
    function sees(j) {
      var a = aper(), p = pointAt(j);
      var pw = PUPIL * p.z / (p.z + ZE);           // the pupil, projected back onto the plate
      var c = crossing(j);
      return c > a[0] - pw && c < a[1] + pw;
    }

    // ---- layout ------------------------------------------------------------
    function layout() {
      var vSpan = (ZO_MAX + 16) + (ZE + 22), uSpan = 2 * U_DRAW;
      if (port) {
        s = Math.min((W - 14) / uSpan, (H - 44) / vSpan);
        cxp = W / 2; plateY = (H - vSpan * s) / 2 + (ZO_MAX + 16) * s;
      } else {
        s = Math.min((H - 46) / uSpan, (W - 20) / vSpan);
        cyp = H / 2; plateX = (W - vSpan * s) / 2 + (ZO_MAX + 16) * s;
      }
    }

    // ---- drawing -----------------------------------------------------------
    function col() { return api.strip.wavelengthRGB(lam * 1000); }

    function drawRefBeam(alpha) {
      var c = col(), tT = Math.tan(theta), Lz = ZO_MAX + 14, i;
      ctx.save();
      ctx.strokeStyle = rgba(c, alpha); ctx.lineWidth = 1.2;
      ctx.setLineDash([7, 6]); ctx.lineDashOffset = -march;
      for (i = -5; i <= 5; i++) {
        var ue = i * (U_DRAW / 5);
        line(ue - tT * Lz, -Lz, ue, 0);
      }
      ctx.restore();
      // one arrowhead, so which way it is travelling is never in doubt
      var au = -U_DRAW * 0.55, av = -Lz * 0.45;
      arrow(au - tT * av * 0 + tT * 0, av, Math.sin(theta), Math.cos(theta), rgba(c, Math.min(1, alpha * 3)));
      label('REFERENCE BEAM', PX(au, av) + (port ? 10 : 6), PY(au, av) + (port ? -6 : -8), rgba(c, 0.75));
    }
    function arrow(u, v, du, dv, style) {
      var x = PX(u, v), y = PY(u, v);
      var x2 = PX(u + du * 6, v + dv * 6), y2 = PY(u + du * 6, v + dv * 6);
      var ang = Math.atan2(y2 - y, x2 - x);
      ctx.save(); ctx.fillStyle = style;
      ctx.translate(x2, y2); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, 3.2); ctx.lineTo(-7, -3.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function label(t, x, y, style, font) {
      ctx.font = font || MONO_S; ctx.fillStyle = style; ctx.textAlign = 'left';
      ctx.fillText(t, clamp(x, 4, W - ctx.measureText(t).width - 4), clamp(y, 12, H - 4));
    }
    function glow(x, y, rad, c, a) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(c, a));
      g.addColorStop(0.4, rgba(c, a * 0.45));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    }

    // the plate itself: the computed fringes, the broken-away pieces, the
    // holder and the scratch on it that the reconstruction is measured against
    function drawPlate() {
      var TH = Math.max(9, Math.min(16, 4.6 * s));   // how thick to draw the glass
      var a = aper(), c = col();
      var n = Math.max(2, Math.round(2 * U_HALF * s));
      var base = port ? PX(-U_HALF, 0) : PY(U_HALF, 0);
      for (var i = 0; i < n; i++) {
        var ua = port ? toU(base + i, 0) : toU(0, base + i);
        var ub = port ? toU(base + i + 1, 0) : toU(0, base + i + 1);
        var inside = Math.min(ua, ub) >= a[0] && Math.max(ua, ub) <= a[1];
        if (!inside) {                                // broken away: empty holder
          ctx.fillStyle = 'rgba(12,17,24,.85)';
        } else {
          var b = plateBright(ua, ub) * expo;
          // Recording: the fringes are laser light landing on the emulsion, so
          // they are drawn in the laser's colour. Replaying: the plate has been
          // developed and is silver, so they go neutral.
          ctx.fillStyle = replay
            ? 'rgb(' + Math.round(28 + 200 * b) + ',' + Math.round(30 + 198 * b) + ',' + Math.round(34 + 190 * b) + ')'
            : rgba(c, 0.10 + 0.9 * b);
        }
        if (port) ctx.fillRect(base + i, plateY - TH / 2, 1.05, TH);
        else ctx.fillRect(plateX - TH / 2, base + i, TH, 1.05);
      }
      // glass outline, plus a jagged edge wherever it has been snapped
      ctx.strokeStyle = 'rgba(196,228,255,.3)'; ctx.lineWidth = 1;
      var x0 = PX(-U_HALF, 0), y0 = PY(-U_HALF, 0), x1 = PX(U_HALF, 0), y1 = PY(U_HALF, 0);
      ctx.strokeRect(Math.min(x0, x1) - (port ? 0 : TH / 2) + 0.5, Math.min(y0, y1) - (port ? TH / 2 : 0) + 0.5,
        port ? Math.abs(x1 - x0) : TH - 1, port ? TH - 1 : Math.abs(y1 - y0));
      if (lvl > 0) {
        ctx.strokeStyle = 'rgba(255,155,120,.85)'; ctx.lineWidth = 1.6;
        [a[0], a[1]].forEach(function (ue) {
          ctx.beginPath();
          for (var q = 0; q <= 6; q++) {
            var vv = (-TH / 2 + q * TH / 6) / s, jag = (q % 2 ? 1.1 : -1.1);
            var xx = PX(ue + jag, vv), yy = PY(ue + jag, vv);
            if (q === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
          }
          ctx.stroke();
        });
      }
      // the mark on the holder: the near reference the image moves against
      ctx.strokeStyle = 'rgba(196,228,255,.5)'; ctx.lineWidth = 1.4;
      line(U_MARK - 3.5, 0, U_MARK + 3.5, 0);
      line(U_MARK, -3.5, U_MARK, 3.5);
      label('MARK ON THE HOLDER', PX(U_MARK, 0) + (port ? 8 : -14), PY(U_MARK, 0) + (port ? 16 : 18), 'rgba(154,162,177,.8)');
      label(replay ? 'DEVELOPED PLATE' : 'PLATE', PX(U_HALF, 0) + (port ? 6 : -30), PY(U_HALF, 0) - (port ? 14 : 12), 'rgba(126,224,255,.85)');
    }

    function drawRecord() {
      var c = col(), j, i;
      drawRefBeam(0.28);
      // the object wave: rays from each point out to the plate
      ctx.strokeStyle = rgba(c, 0.13); ctx.lineWidth = 1;
      for (j = 0; j < OBJ.length; j++) {
        var p = pointAt(j);
        for (i = -4; i <= 4; i++) line(p.u, -p.z, i * (U_HALF / 4), 0);
      }
      // the object itself
      for (j = 0; j < OBJ.length; j++) {
        var q = pointAt(j);
        glow(PX(q.u, -q.z), PY(q.u, -q.z), 9, c, 0.95);
        ctx.fillStyle = '#eff4fb';
        ctx.beginPath(); ctx.arc(PX(q.u, -q.z), PY(q.u, -q.z), 2.1, 0, TAU); ctx.fill();
      }
      var mid = pointAt(1);
      label('OBJECT', PX(mid.u, -mid.z) + (port ? 14 : -22), PY(mid.u, -mid.z) - (port ? 18 : 20), '#eff4fb');
      // a dimension line for the depth
      ctx.save();
      ctx.strokeStyle = 'rgba(196,228,255,.22)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      line(mid.u - 14, -zo, mid.u - 14, 0);
      ctx.restore();
      label(Math.round(zo) + ' µm', PX(mid.u - 14, -zo * 0.5) + (port ? -44 : -14), PY(mid.u - 14, -zo * 0.5) + (port ? 0 : 14), 'rgba(154,162,177,.9)');
    }

    function drawReplay() {
      var c = col(), a = aper(), j, i, NR = 9;
      drawRefBeam(0.2);
      // m = 0: the reference carries straight on through, undiffracted
      ctx.save();
      ctx.strokeStyle = rgba(c, 0.1); ctx.lineWidth = 1;
      var tT = Math.tan(theta);
      for (i = 0; i <= 6; i++) {
        var ue = a[0] + (a[1] - a[0]) * i / 6;
        line(ue, 0, ue + tT * (ZE + 20), ZE + 20);
      }
      ctx.restore();
      // m = -1: the twin image, real, on this side of the plate. At theta = 0
      // it sits right on top of the view of the virtual one, which is exactly
      // what made Gabor's in-line holograms so murky; tilt the reference and
      // the two orders swing apart, which is the whole point of off-axis.
      var mid = pointAt(1);
      ctx.strokeStyle = rgba(c, 0.09); ctx.lineWidth = 1;
      for (i = 0; i <= 6; i++) {
        var ut = a[0] + (a[1] - a[0]) * i / 6;
        var so = sinOut(ut, 1, -1), t = (ZE + 18) / Math.sqrt(1 - so * so);
        line(ut, 0, ut + so * t, (ZE + 18));
      }
      var twinU = mid.u + 2 * Math.sin(theta) * mid.z;
      if (mid.z < ZE + 18) {
        glow(PX(twinU, mid.z), PY(twinU, mid.z), 7, c, 0.3);
        label('TWIN IMAGE', PX(twinU, mid.z) + 8, PY(twinU, mid.z) + 4, rgba(c, 0.55));
      }
      // m = +1: the reconstruction. Each ray leaves at the angle the object
      // wave had, so the fan back-projects onto the original point.
      for (j = 0; j < OBJ.length; j++) {
        var p = pointAt(j);
        ctx.strokeStyle = rgba(c, sees(j) ? 0.2 : 0.09); ctx.lineWidth = 1;
        for (i = 0; i < NR; i++) {
          var u = a[0] + (a[1] - a[0]) * (NR === 1 ? 0.5 : i / (NR - 1));
          var so1 = sinOut(u, j, 1), tf = (ZE + 18) / Math.sqrt(1 - so1 * so1);
          line(u, 0, u + so1 * tf, ZE + 18);
        }
        // and the backward extension: dashed, straight onto the virtual point
        ctx.save();
        ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(c, 0.22); ctx.lineWidth = 1;
        line(a[0], 0, p.u, -p.z); line(a[1], 0, p.u, -p.z);
        ctx.restore();
      }
      // the virtual image, blurred by the surviving aperture and dimmed by it
      var frac = aperW() / (2 * U_HALF);
      for (j = 0; j < OBJ.length; j++) {
        var pp = pointAt(j), seen = sees(j);
        var rad = Math.max(2.6, 0.5 * blurUm(pp.z) * s);
        var al = (0.18 + 0.75 * frac) * (seen ? 1 : 0.16);
        glow(PX(pp.u, -pp.z), PY(pp.u, -pp.z), rad + 5, c, al * 0.5);
        glow(PX(pp.u, -pp.z), PY(pp.u, -pp.z), rad, c, al);
        if (seen) {
          ctx.strokeStyle = rgba(c, 0.5); ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(PX(pp.u, -pp.z), PY(pp.u, -pp.z), rad, 0, TAU); ctx.stroke();
        }
      }
      var m2 = pointAt(1);
      label('VIRTUAL IMAGE', PX(m2.u, -m2.z) + (port ? 16 : -28), PY(m2.u, -m2.z) - (port ? 20 : 24), '#eff4fb');
      // the sight lines actually entering the pupil, and the eye
      for (j = 0; j < OBJ.length; j++) {
        if (!sees(j)) continue;
        var pq = pointAt(j);
        ctx.strokeStyle = rgba(c, 0.55); ctx.lineWidth = 1.1;
        line(pq.u, -pq.z, eyeU, ZE);
      }
      drawEye();
    }

    function drawEye() {
      var x = PX(eyeU, ZE), y = PY(eyeU, ZE);
      // the eye looks back down the v axis toward the plate
      var ang = port ? -Math.PI / 2 : Math.PI;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(239,244,251,.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-11, 0); ctx.quadraticCurveTo(0, -8.5, 11, 0);
      ctx.quadraticCurveTo(0, 8.5, -11, 0); ctx.stroke();
      ctx.fillStyle = 'rgba(126,224,255,.9)';
      ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill();
      ctx.restore();
      label('EYE  (DRAG IT)', x + (port ? 16 : -18), y + (port ? 6 : 26), 'rgba(126,224,255,.9)');
    }

    // ---- what the eye actually sees: a one-line viewfinder -------------------
    // The scene here is a slice, so the view from the eye is a line. Plot the
    // holder mark and the three points at their true angles from the pupil and
    // the parallax is right there: move the eye and the points slide across
    // the mark, because they are 80 µm further away. A photograph cannot.
    function drawFinder(x, y) {
      var bw = port ? 150 : 172, bh = 40, c = col(), j;
      ctx.fillStyle = 'rgba(5,7,12,.86)'; ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = 'rgba(196,228,255,.2)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      label('WHAT THE EYE SEES', x + 7, y + 13, 'rgba(126,224,255,.8)');
      var by = y + 28, span = 44;                 // degrees across the strip
      function at(deg) { return x + bw / 2 + clamp(deg, -span, span) / span * (bw / 2 - 10); }
      ctx.strokeStyle = 'rgba(196,228,255,.18)';
      ctx.beginPath(); ctx.moveTo(x + 8, by); ctx.lineTo(x + bw - 8, by); ctx.stroke();
      var aMark = Math.atan((U_MARK - eyeU) / ZE) * DEG;
      ctx.strokeStyle = 'rgba(196,228,255,.75)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(at(aMark), by - 7); ctx.lineTo(at(aMark), by + 7); ctx.stroke();
      for (j = 0; j < OBJ.length; j++) {
        var p = pointAt(j);
        var ad = Math.atan((p.u - eyeU) / (p.z + ZE)) * DEG;
        // the same 1.22 lambda / A that blurs the image blurs it here too
        var rad = Math.max(2, (1.22 * lam / aperW()) * DEG / span * (bw / 2 - 10));
        glow(at(ad), by, rad + 2, c, sees(j) ? 0.85 : 0.12);
      }
    }

    // ---- readouts ------------------------------------------------------------
    function panel(lines, x, y) {
      ctx.font = MONO;
      var wmax = 0, i;
      for (i = 0; i < lines.length; i++) wmax = Math.max(wmax, ctx.measureText(lines[i].t).width);
      var bh = 16 * lines.length + 10;
      ctx.fillStyle = 'rgba(5,7,12,.86)'; ctx.fillRect(x, y, wmax + 14, bh);
      ctx.strokeStyle = 'rgba(196,228,255,.16)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, wmax + 13, bh - 1);
      ctx.textAlign = 'left';
      for (i = 0; i < lines.length; i++) {
        ctx.fillStyle = lines[i].c || '#9aa2b1';
        ctx.fillText(lines[i].t, x + 7, y + 17 + i * 16);
      }
      return y + bh;
    }
    function fmt(x, d) { return x.toFixed(d === undefined ? 2 : d); }
    function readout() {
      var nm = Math.round(lam * 1000), lines = [];
      // the finest fringe anywhere on the plate, and whether a screen can hold it
      var fine = Infinity, j, i;
      for (j = 0; j < OBJ.length; j++)
        for (i = -1; i <= 1; i += 2) fine = Math.min(fine, spacing(i * U_HALF, j));
      var px = fine * s;
      if (!replay) {
        lines.push({ t: 'RECORD  ·  ' + nm + ' nm  ·  reference at ' + fmt(theta * DEG, 1) + '°', c: '#7ee0ff' });
        lines.push({ t: 'the plate is exposed by |O + R|², not by the object', c: '#cfe6e6' });
        lines.push({
          t: 'finest fringes: ' + fmt(fine) + ' µm' +
            (px < 2 ? '  (finer than this screen: it greys out, like the real thing)'
              : '  (' + fmt(px, 1) + ' px here)')
        });
        lines.push(theta * DEG < 0.6
          ? { t: 'in line: three Gabor zone plates, open at the centre, crowding to the edges', c: '#ffd479' }
          : { t: 'off axis: a ' + fmt(lam / Math.sin(theta)) + ' µm carrier runs under the zone plates' });
      } else {
        var A = aperW(), ang = 1.22 * lam / A * DEG, frac = A / (2 * U_HALF);
        lines.push({ t: 'REPLAY  ·  reference beam alone  ·  first order = the object wave', c: '#7ee0ff' });
        lines.push({ t: 'virtual image: 3 points, ' + Math.round(zo) + ' µm behind the plate', c: '#cfe6e6' });
        lines.push({
          t: 'window ' + fmt(A, 1) + ' µm  ·  1.22λ/A = ' + fmt(ang, 2) + '°  ·  blur ' + fmt(blurUm(zo)) + ' µm',
          c: lvl ? '#ffd479' : '#9aa2b1'
        });
        var seen = 0;
        for (j = 0; j < OBJ.length; j++) if (sees(j)) seen++;
        lines.push(seen === OBJ.length
          ? {
            t: 'all 3 points visible  ·  light ' + Math.round(frac * 100) + '%  ·  parallax ' +
              (parallax() >= 0 ? '+' : '') + fmt(parallax(), 1) + '°'
          }
          : { t: 'drag the eye to look through the piece that is left', c: '#ff9c8a' });
      }
      var shortLines = lines;
      if (port) {                                   // a phone has no room for the long forms
        shortLines = lines.map(function (l) {
          return { t: l.t.replace('  ·  ', ' · ').replace(/\s*\(.*\)\s*$/, ''), c: l.c };
        });
      }
      var y = panel(shortLines, 12, 12);
      if (replay) drawFinder(12, y + 6);
      // the honest footnote about scale
      ctx.font = MONO_S; ctx.fillStyle = 'rgba(92,107,122,.95)'; ctx.textAlign = 'left';
      var note = port
        ? ['80 µm of plate. Scale it up 1000×', 'for a plate you can hold: the same', 'fringes, tens of thousands of them.']
        : ['80 µm of plate, drawn at its real fringe spacing. Scale the whole scene up 1000× and it is an 8 cm plate',
           'with the subject 8 cm behind it, the same fringes a micron or two apart, tens of thousands of them.'];
      for (i = 0; i < note.length; i++) ctx.fillText(note[i], 12, H - 10 - (note.length - 1 - i) * 12);
    }
    // the angle between the middle point and the mark on the holder, from the eye
    function parallax() {
      var p = pointAt(1);
      return (Math.atan((p.u - eyeU) / (p.z + ZE)) - Math.atan((U_MARK - eyeU) / ZE)) * DEG;
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, W, H);
      if (replay) drawReplay(); else drawRecord();
      drawPlate();
      readout();
    }

    // ---- animation: only while on screen, and never under reduced motion ----
    function active() { return onScreen && !document.hidden && !api.reducedMotion; }
    function step(now) {
      if (!lastNow) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
      march = (march + dt * 26) % 13;               // the beam's crests, marching in
      if (!replay && expo < 1) expo = Math.min(1, expo + dt / 0.9);   // the exposure building
      draw();
    }
    function loop() {
      if (rafId) return;
      rafId = requestAnimationFrame(function tick(now) {
        step(now);
        rafId = active() ? requestAnimationFrame(tick) : 0;
        if (!rafId) lastNow = 0;
      });
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (en) {
        onScreen = en[0].isIntersecting;
        if (active()) loop();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { if (active()) loop(); });

    // ---- controls ------------------------------------------------------------
    function lightStrip() {
      // a laser is one line. The real HeNe line is about 0.002 nm wide, far
      // narrower than one pixel of the strip, so it is drawn a few nm wide to
      // be visible at all.
      var nm = lam * 1000;
      api.strip.light(function (x) {
        var d = (x - nm) / 6;
        return 0.05 + 0.95 * Math.exp(-d * d);
      });
    }
    function expose() { expo = api.reducedMotion ? 1 : 0; }
    function refresh() { if (!rafId) draw(); }

    function setMode(r) {
      replay = r;
      modeBtn.setAttribute('aria-pressed', String(r));
      modeBtn.textContent = r ? 'BACK TO RECORDING' : 'REPLAY THE PLATE';
      canvas.style.cursor = r ? 'grab' : 'crosshair';
      if (!r) expose();
      setHint(r ? (lvl ? HINT_BROKEN : HINT_REPLAY) : HINT_RECORD);
      refresh();
    }
    function setBreak(n) {
      lvl = clamp(n, 0, SHARDS.length - 1);
      fixBtn.hidden = lvl === 0;
      breakBtn.textContent = lvl === 0 ? 'BREAK THE PLATE'
        : lvl < SHARDS.length - 1 ? 'BREAK IT AGAIN' : 'BROKEN AS IT GOES';
      breakBtn.disabled = lvl === SHARDS.length - 1;
      if (lvl > 0) {
        // put the eye where the shard's beam actually goes, so the first thing
        // seen is the scene surviving; finding it by hand comes after
        var a = aper(), uc = 0.5 * (a[0] + a[1]), p = pointAt(1);
        eyeU = clamp(p.u + (uc - p.u) * (p.z + ZE) / p.z, -U_DRAW, U_DRAW);
        if (!solvedDone) { solvedDone = true; api.solved(); }
      }
      if (lvl > 0 && !replay) setMode(true); else setHint(replay ? (lvl ? HINT_BROKEN : HINT_REPLAY) : HINT_RECORD);
      refresh();
    }
    zIn.addEventListener('input', function () {
      zo = +zIn.value; zOut.textContent = zo + ' µm'; expose(); refresh();
    });
    aIn.addEventListener('input', function () {
      theta = +aIn.value / DEG;
      aOut.textContent = fmt(+aIn.value, 1) + '°' + (+aIn.value < 0.6 ? ' in line' : '');
      expose(); refresh();
    });
    wIn.addEventListener('input', function () {
      lam = +wIn.value / 1000;
      var n = laserName(+wIn.value);
      wOut.textContent = wIn.value + ' nm' + (n ? ' ' + n : '');
      lightStrip(); expose(); refresh();
    });
    modeBtn.addEventListener('click', function () { setMode(!replay); lightStrip(); });
    breakBtn.addEventListener('click', function () { setBreak(lvl + 1); lightStrip(); });
    fixBtn.addEventListener('click', function () { setBreak(0); refresh(); });

    // ---- direct manipulation ---------------------------------------------------
    // Recording: drag the object around, in depth and across. Replaying: drag
    // the eye, which is the only way to feel the parallax.
    var dragging = false;
    function toLocal(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function apply(p) {
      var u = toU(p.x, p.y), v = toV(p.x, p.y);
      if (replay) eyeU = clamp(u, -U_DRAW, U_DRAW);
      else {
        zo = Math.round(clamp(-v, ZO_MIN, ZO_MAX));
        uo = clamp(u, -18, 18);
        zIn.value = zo; zOut.textContent = zo + ' µm';
        expose();
      }
      refresh();
    }
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      e.preventDefault(); apply(toLocal(e)); lightStrip();
    });
    canvas.addEventListener('pointermove', function (e) { if (dragging) apply(toLocal(e)); });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ }
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // ---- size ------------------------------------------------------------------
    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (rect.width < 40) return;
      W = rect.width;
      port = W < 600;
      // the plate wants the long side of the canvas: taller on a phone, where
      // it lies across the screen, shorter on a desktop where it stands up
      var want = port ? 620 : 400;
      if (defH !== want) {
        defH = want; canvas.style.height = want + 'px';
        rect = canvas.getBoundingClientRect();
      }
      H = Math.max(160, Math.round(rect.height) || want);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      layout();
      draw();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    else window.addEventListener('resize', resize);

    setMode(false);
    setBreak(0);
    resize();
    if (active()) loop();
  }
})();
