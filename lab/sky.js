// D. BUILD A SKY — atmospheric optics sandbox for The Light Lab.
// Drag the sun along its arc, thicken the air, grow the particles.
// Rayleigh 1/λ⁴ vs Mie, airmass 1→38, T = exp(−τ). No libraries.
(function () {
  'use strict';
  if (!window.LAB) return;

  const K = 0.27;          // Rayleigh optical depth at 460 nm, 1 Earth atmosphere, zenith
  const MAX_AM = 38;       // airmass at the horizon
  const LAM = [620, 545, 460];   // sampled wavelengths for the R,G,B channels

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const airmass = elevDeg =>
    1 / Math.max(Math.sin(clamp(elevDeg, 0, 90) * Math.PI / 180), 1 / MAX_AM);
  const frac = x => x - Math.floor(x);

  window.LAB.register({
    id: 'sky',
    title: 'D. BUILD A SKY',
    goal: 'START WITH A WHITE ATMOSPHERE. MAKE EARTH’S.',
    question: {
      text: 'Why is the sky blue at noon but red at the horizon at sunset?',
      choices: ['Air is faintly blue', 'Blue light scatters far more than red', 'The sun actually reddens', 'Reflection from the oceans'],
      reveal: 'Blue light scatters far more — in proportion to 1/λ⁴, so 460 nm blue scatters about 3.3× more than 620 nm red. Look away from the sun and scattered blue is what reaches you. At sunset the light crosses ~38× more air, the blue is scattered out en route, and only the red survives the trip. Same air, same law, both colors of sky.'
    },
    hint: 'Three dials: drag the sun, thicken the air, grow the particles. Challenges: make Earth’s noon. Make Mars. Make a white sky. Make the reddest sunset you can.',

    init(mount, api) {
      const state = { elev: 65, th: 1, mie: 1 };   // start with a white (Mie) atmosphere
      const H = 300, GROUND = 34;
      let W = 0;

      // --- DOM ---------------------------------------------------------------
      const canvas = document.createElement('canvas');
      canvas.style.height = H + 'px';
      canvas.setAttribute('aria-label', 'Sky simulator: drag the sun along its arc');

      const readout = document.createElement('p');
      readout.style.cssText = 'font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;' +
        'color:#8b98a8;margin:8px 0 0;min-height:1.4em;';

      const controls = document.createElement('div');
      controls.className = 'controls';
      controls.innerHTML =
        '<label>Atmosphere <input type="range" min="0" max="2" step="0.01" value="1">' +
        ' <span class="num"></span></label>' +
        '<label>Particle size <input type="range" min="0" max="1" step="0.01" value="1">' +
        ' <span class="num"></span></label>';

      mount.appendChild(canvas);
      mount.appendChild(readout);
      mount.appendChild(controls);

      const thIn  = controls.querySelectorAll('input')[0];
      const mieIn = controls.querySelectorAll('input')[1];
      const thNum  = controls.querySelectorAll('.num')[0];
      const mieNum = controls.querySelectorAll('.num')[1];
      const ctx = canvas.getContext('2d');

      // --- physics -----------------------------------------------------------
      // wavelength dependence of scattering: Rayleigh (1/λ⁴) blended toward Mie (flat)
      const sFactor = nm => {
        const ray = Math.pow(460 / nm, 4);
        return ray + (1 - ray) * state.mie;
      };
      const tau = (nm, am) => K * state.th * am * sFactor(nm);
      const trans = (nm, am) => Math.exp(-tau(nm, am));

      // iron-oxide dust absorbs blue: only matters at big particles + thin air (Mars)
      const dustTint = () => {
        const d = state.mie * clamp(1 - state.th / 0.55, 0, 1);
        return [1, 1 - 0.28 * d, 1 - 0.52 * d];
      };

      // transmitted sun disc color: [rgb 0..1 normalized] and overall survival m
      function sunColor() {
        const amS = airmass(state.elev);
        const T = LAM.map(nm => trans(nm, amS));
        const m = Math.max(T[0], T[1], T[2], 1e-9);
        const bright = Math.pow(m, 0.18);
        return { rgb: T.map(t => (t / m) * bright), m };
      }

      // sky color seen at view-elevation velev: per channel,
      // scattered ∝ (1 − T along the view path) × T of the sunlight already crossed
      function skyRGB(velev) {
        const amV = airmass(velev);
        const amS = airmass(state.elev);
        const tint = dustTint();
        return LAM.map((nm, i) => {
          const scat = (1 - Math.exp(-tau(nm, amV))) *
                       Math.exp(-0.5 * tau(nm, amS)) * tint[i];
          return Math.pow(1 - Math.exp(-4 * scat), 0.8);   // gain + soft tone map
        });
      }

      const css = (c, a) => 'rgba(' + Math.round(255 * clamp(c[0], 0, 1)) + ',' +
        Math.round(255 * clamp(c[1], 0, 1)) + ',' +
        Math.round(255 * clamp(c[2], 0, 1)) + ',' + (a === undefined ? 1 : a) + ')';

      // --- geometry ----------------------------------------------------------
      const groundY = () => H - GROUND;
      const arcR = () => Math.max(60, Math.min(W * 0.5 - 46, groundY() - 42));
      function sunPos() {
        const a = state.elev * Math.PI / 180, cx = W / 2, gy = groundY();
        return { x: cx + arcR() * Math.cos(a), y: gy - arcR() * Math.sin(a) };
      }

      // --- render ------------------------------------------------------------
      function draw() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        W = rect.width;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const gy = groundY();

        // sky: vertical gradient, stops computed from the physics
        const grad = ctx.createLinearGradient(0, 0, 0, gy);
        [[0, 78], [0.45, 36], [0.78, 14], [1, 2.5]].forEach(s => {
          grad.addColorStop(s[0], css(skyRGB(s[1])));
        });
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, gy);

        // stars fade in as the air is pumped out
        if (state.th < 0.15) {
          const a = (0.15 - state.th) / 0.15;
          for (let i = 0; i < 70; i++) {
            const x = frac(Math.sin(i * 12.9898 + 78.233) * 43758.5453) * W;
            const y = frac(Math.sin(i * 39.3468 + 11.135) * 27183.1) * (gy - 6);
            const tw = 0.25 + 0.75 * frac(Math.sin(i * 7.13) * 999.7);
            ctx.fillStyle = 'rgba(223,236,255,' + (a * tw).toFixed(3) + ')';
            ctx.fillRect(x, y, 1.4, 1.4);
          }
        }

        const sp = sunPos();
        const sun = sunColor();

        // glow around the sun, tinted by what survived the trip
        if (state.th > 0.02) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, gy);
          ctx.clip();
          ctx.globalCompositeOperation = 'lighter';
          const gr = clamp(W * 0.3, 110, 260);
          const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, gr);
          const ga = 0.5 * Math.min(1, state.th) * Math.pow(sun.m, 0.1);
          g.addColorStop(0, css(sun.rgb, ga));
          g.addColorStop(0.35, css(sun.rgb, ga * 0.35));
          g.addColorStop(1, css(sun.rgb, 0));
          ctx.fillStyle = g;
          ctx.fillRect(sp.x - gr, sp.y - gr, gr * 2, gr * 2);
          ctx.restore();
        }

        // the arc the sun rides (faint, dotted)
        ctx.save();
        ctx.strokeStyle = 'rgba(196,228,255,.16)';
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.arc(W / 2, gy, arcR(), -Math.PI / 2, 0);
        ctx.stroke();
        ctx.restore();

        // sun disc: soft-edged, color = transmission per channel
        const dr = 15;
        const dg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, dr);
        const core = sun.rgb.map(c => c + (1 - c) * 0.55 * Math.pow(sun.m, 0.18));
        dg.addColorStop(0, css(core));
        dg.addColorStop(0.7, css(sun.rgb));
        dg.addColorStop(1, css(sun.rgb, 0));
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, dr, 0, Math.PI * 2);
        ctx.fill();

        // ground: dark silhouette strip (a setting sun sinks behind it)
        ctx.fillStyle = '#0a0e12';
        ctx.fillRect(0, gy, W, GROUND);
        ctx.strokeStyle = 'rgba(196,228,255,.16)';
        ctx.beginPath();
        ctx.moveTo(0, gy + 0.5);
        ctx.lineTo(W, gy + 0.5);
        ctx.stroke();
      }

      // --- strip: transmitted sunlight spectrum through the current path -----
      function updateStrip() {
        api.strip.light(nm => {
          const amS = airmass(state.elev);
          const tmax = Math.max(trans(750, amS), 1e-6);  // normalize: noon ≈ full band
          return trans(nm, amS) / tmax;
        });
      }

      // --- readout + challenge detection -------------------------------------
      function updateReadout() {
        const amS = airmass(state.elev);
        let t;
        if (state.th < 0.05) {
          t = '⬛ space: no air, black sky, white sun';
        } else if (state.mie > 0.6 && state.th < 0.45) {
          t = '🟠 Mars-ish: thin air, big dust';
        } else if (state.mie > 0.7) {
          t = '⚪ white sky — big-droplet Mie scattering';
        } else if (state.elev < 15 && state.mie < 0.35 && state.th > 0.7 && state.th < 1.4) {
          t = '🔴 proper sunset';
          api.solved();
        } else if (state.elev > 60 && state.mie < 0.25 && state.th > 0.85 && state.th < 1.15) {
          t = '☀ Earth noon';
        } else {
          t = 'light is crossing ' + (amS * state.th).toFixed(1) + ' atmospheres';
        }
        readout.textContent = t;
        thNum.textContent = state.th < 0.05 ? 'vacuum' : state.th.toFixed(2) + '× Earth';
        mieNum.textContent = state.mie < 0.25 ? 'molecules' : (state.mie < 0.6 ? 'haze' : 'droplets/dust');
      }

      function refresh() {        // interaction handlers only — no idle loop
        draw();
        updateStrip();
        updateReadout();
      }

      // --- sun dragging ------------------------------------------------------
      let dragging = false;
      const toLocal = e => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const nearSun = p => {
        const s = sunPos();
        return Math.hypot(p.x - s.x, p.y - s.y) <= 26;
      };
      function moveSun(p) {
        const a = Math.atan2(groundY() - p.y, p.x - W / 2) * 180 / Math.PI;
        state.elev = clamp(a, 0, 90);
        refresh();
      }
      canvas.addEventListener('pointerdown', e => {
        const p = toLocal(e);
        if (!nearSun(p)) return;
        dragging = true;
        canvas.style.cursor = 'grabbing';
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        e.preventDefault();
        moveSun(p);
      });
      canvas.addEventListener('pointermove', e => {
        const p = toLocal(e);
        if (dragging) moveSun(p);
        else canvas.style.cursor = nearSun(p) ? 'grab' : '';
      });
      const endDrag = e => {
        if (!dragging) return;
        dragging = false;
        canvas.style.cursor = '';
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ }
      };
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);

      // --- sliders -----------------------------------------------------------
      thIn.addEventListener('input', () => {
        state.th = parseFloat(thIn.value);
        refresh();
      });
      mieIn.addEventListener('input', () => {
        state.mie = parseFloat(mieIn.value);
        refresh();
      });

      // --- resize: redraw only (the shared strip belongs to whoever last touched it)
      if (typeof ResizeObserver === 'function') {
        new ResizeObserver(() => draw()).observe(canvas);
      } else {
        window.addEventListener('resize', draw);
      }

      draw();
      updateReadout();
    }
  });
})();
