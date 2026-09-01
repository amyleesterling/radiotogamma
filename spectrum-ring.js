/* The spectrum ring: one wave traveling around a circle while its wavelength
   contracts from radio to gamma. The site's mark. Mount on any
   <canvas data-ring> (sized by its CSS box), or call SpectrumRing.draw
   directly. Animates only when visible and motion is welcome; otherwise a
   single still frame. */
(function () {
  'use strict';

  // spectrum color stops, red (slow) to violet-white (fast)
  var STOPS = [
    [0.00, 255, 45, 32], [0.16, 255, 149, 0], [0.30, 255, 233, 59],
    [0.46, 53, 212, 97], [0.60, 35, 213, 232], [0.74, 59, 108, 255],
    [0.88, 180, 75, 240], [1.00, 242, 233, 255],
  ];
  function color(t) {
    var i = 1;
    while (i < STOPS.length - 1 && STOPS[i][0] < t) i++;
    var a = STOPS[i - 1], b = STOPS[i];
    var u = (t - a[0]) / (b[0] - a[0] || 1);
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
  }

  // exponential chirp: crest density grows n0 -> n1 around the circle, so the
  // integrated phase is 2*pi*n0*(g^t - 1)/ln g with g = n1/n0
  function draw(ctx, size, phase, opts) {
    opts = opts || {};
    var n0 = opts.n0 || 2.2, n1 = opts.n1 || (size < 120 ? 8 : 26);
    var g = n1 / n0, lng = Math.log(g);
    var R = size * (opts.R || 0.36), A0 = size * (opts.amp || 0.085);
    var cx = size / 2, cy = size / 2;
    var N = Math.max(240, Math.round(size * 2.2));
    var lw = Math.max(1.1, size / 24);
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    var px, py;
    for (var i = 0; i < N; i++) {
      var t = i / (N - 1);
      var th = -Math.PI / 2 + t * Math.PI * 2;           // seam at 12 o'clock
      var Phi = 2 * Math.PI * n0 * (Math.pow(g, t) - 1) / lng;
      var taper = Math.min(1, Math.min(t, 1 - t) * 18);   // pinch at the seam
      var amp = A0 * (1 - 0.55 * t) * taper;
      var r = R + amp * Math.sin(Phi - phase);
      var x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      if (i) {
        var c = color(t);
        // glow pass then core pass, so it reads as light on dark
        ctx.strokeStyle = 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',.35)';
        ctx.lineWidth = lw * 2.6;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
      px = x; py = y;
    }
    // the seam: where gamma wraps back into radio, a white-hot node
    var gl = ctx.createRadialGradient(cx, cy - R, 0, cx, cy - R, lw * 3.2);
    gl.addColorStop(0, 'rgba(255,255,255,.95)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath(); ctx.arc(cx, cy - R, lw * 3.2, 0, Math.PI * 2); ctx.fill();
  }

  function mount(canvas) {
    var ctx = canvas.getContext('2d');
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var running = false, visible = true, size = 0;
    function fit() {
      var css = canvas.clientWidth || 26;
      var dpr = Math.min(devicePixelRatio || 1, 3);
      size = css * dpr;
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    }
    function frame(now) {
      if (!running) return;
      draw(ctx, size, now / 700);
      requestAnimationFrame(frame);
    }
    function update() {
      var want = visible && !reduced && !document.hidden;
      if (want && !running) { running = true; requestAnimationFrame(frame); }
      if (!want) { running = false; fit(); draw(ctx, size, 0); }
    }
    fit(); draw(ctx, size, 0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting; update();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', update);
    addEventListener('resize', function () { fit(); if (!running) draw(ctx, size, 0); });
    update();
  }

  document.querySelectorAll('canvas[data-ring]').forEach(mount);
  window.SpectrumRing = { draw: draw, mount: mount };
})();
