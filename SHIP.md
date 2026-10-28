# The vessel: how a deck is built

Radio to Gamma is a survey vessel, built five centuries from now, that invites
anyone in the galaxy aboard to explore the electromagnetic spectrum, play with
it, break it, and come away understanding it. Every page is a deck. Every
instrument is real physics running in miniature. This file says how a deck is
built so the five of them read as one ship. `CLAUDE.md` still holds the rules
that keep the numbers honest; this file is about the vessel.

## The feeling

Not an arcade. Not neon on black with scanlines. A quiet, enormous machine
whose surfaces are glass and light, where the spectrum itself is the one
bright thing. The field is cool and dark; the beam carries all the colour.
Panels float over space rather than sit on a background. Type is light and
wide-tracked. Numbers are monospace and large. Motion is physical: things
chase their targets and settle, completions arrive, nothing loops except what
is genuinely ambient (stars, the beam's breathing).

Playful means the visitor can grab anything and the ship answers. Surprising
means the physics produces something they did not expect, and the ship says
so in a sentence. Delightful means the thing they grabbed moves beautifully.

Read `vendor/scifi-ui/SOURCE.txt` and the upstream `SCIFIIFY.md` ethos: use
what exists, evolve it, invent only what is absent. We build on `.holopanel`,
`.holo` readouts, the tap layer, and the tokens.

## The shared runtime: `ship/`

- `ship/physics.js`: every constant, conversion, formatter and blackbody
  function. Import what you need; never re-declare `C`, `H`, Planck, Wien,
  unit ladders or band tables in a deck. If a deck needs a physics function
  that is missing, add it here with a comment and tell the integrator.
- `ship/ship.js`: `ship.mount({ deck })` draws the deck bar, the hull canvas
  (stars, nebula, the long beam) and wires entrances. `ship.viewport(el, def)`
  turns a DOM box into a 3D instrument: `def.setup(vp)`, `def.frame(vp)` every
  frame with `vp.t`, `vp.dt`, `def.pointer(ev, vp)` with `vp.ndc` and `vp.ray`
  ready. `vp.scene`, `vp.camera`, `vp.size` are yours. Helpers:
  `spectrumRibbon()`, `label()`, `glowSprite()`, `colorOf(f)`,
  `spectrumTexture()`. `ship.motion` is false under reduced motion.
- `ship/ship.css`: tokens and chrome. `--deck` is the deck's accent. Classes:
  `.deck-wrap`, `.stage`, `.stage-head` (`.tag` + `h2`), `.lede`, `.viewport`
  (+ `.vhud`, `.vhud .label`, `.vhud .tick`, `.vp-note`), `.probe` (+ `.cap`),
  `.readouts .readout` (`.k .v .d`), `.chips .chip`, `.dial` with
  `input.beam`, `.glass` (on a `.holopanel`), `.hatches .hatch`,
  `.deck-foot`, `.rise`. Add deck-specific CSS in the page's own `<style>`,
  scoped under `body[data-deck="yourdeck"]`.

## Page skeleton

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Observatory · Radio to Gamma</title>
  <meta name="description" content="...">
  (og tags as the old page had)
  <link rel="icon" type="image/png" href="favicon.png">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <link rel="stylesheet" href="vendor/scifi-ui/hologram.css">
  <link rel="stylesheet" href="vendor/scifi-ui/panel-surface.css">
  <link rel="stylesheet" href="vendor/scifi-ui/data-readout.css">
  <link rel="stylesheet" href="ship/ship.css">
  <style>/* deck-specific, scoped to body[data-deck="..."] */</style>
</head>
<body>
<main class="deck">
  <div class="deck-wrap">
    <section class="stage" id="...">
      <div class="stage-head"><div class="tag">Stage 01 · the name</div><h1>...</h1><p class="lede">...</p></div>
      <div class="viewport" id="vpX" style="height: clamp(320px, 56vh, 560px)">
        <div class="vhud">...probes, labels...</div>
        <div class="fallback">What the instrument shows, in a sentence, for a browser without WebGL.</div>
      </div>
      <div class="readouts">...</div>
    </section>
    <footer class="deck-foot">...</footer>
  </div>
</main>
<script src="spectrum-data.js"></script>
<script src="vendor/scifi-ui/data-readout.js"></script>
<script type="module">
  import { ship, THREE, spectrumRibbon, label, glowSprite, colorOf } from './ship/ship.js';
  import * as P from './ship/physics.js';
  ship.mount({ deck: 'observatory' });
  ...
</script>
<script src="vendor/scifi-ui/hologram-tap.js"></script>
</body>
</html>
```

`ship.mount` inserts the deck bar; do not write a header. Pages are plain
files served from the root, no build step, relative paths.

## The three.js rules

- Import three only from `./vendor/three/three.module.min.js` (via ship.js
  re-export `THREE`). No other vendor code without asking.
- One canvas. Never create your own WebGLRenderer; every instrument is a
  `ship.viewport`. Overlays, probes and readouts are DOM over the box.
- A probe that sets a frequency is a slider to assistive tech:
  `role="slider"`, `tabindex="0"`, `aria-valuemin/max` in log10 Hz,
  `aria-valuenow`, `aria-valuetext` in human units, arrow keys step it.
- Truth and display are separate: the model holds the real value, the scene
  chases it (`disp += (truth - disp) * (1 - exp(-dt * k))`), readouts show
  the truth.
- Everything that is a number comes from `ship/physics.js` or a computation
  shown in the commit message. Visual scale is allowed to be compressed
  (sixteen decades do not fit in a box) and the page must say so in a
  `.vp-note`.
- Reduced motion: instruments still respond to input; ambient drift and
  entrances are held. Check `ship.motion`.
- Dispose nothing on the fly; build once in `setup`, mutate in `frame`.
- Keep draw calls modest: merge geometries, use instancing for crowds,
  cap particle counts near 4000. The page must stay smooth on a phone.
- Any texture or image must already be in the repo or drawn on a canvas.
- No WebGL: `body.no-webgl` is set; the `.fallback` text shows; readouts and
  controls must still work from the DOM alone.

## The copy rules

- The voice: precise, warm, a little wry, as the old site was. The vessel
  may speak ("the ship reads...") sparingly, never in every sentence.
- No em or en dashes in copy, ever. Commas, colons, full stops.
- Every number checked; derivations in the commit message.
- Carry across the old page's physics and lessons; you may rewrite the copy,
  cut what reads as filler, and add what the 3D makes possible. Do not drop a
  real fact, a landmark, a preset, or a layer without saying so in your
  report.

## Verification before you report

Serve the root (`python3 -m http.server`) and run the Playwright check at
`/tmp/claude-0/-home-claude/9048e539-2105-5551-a209-54b69ba3b32c/scratchpad/t/check.js`:
`node check.js http://localhost:PORT/yourpage.html out.png 1280` and again at
`375`. Console must be clean, every request 200, `scrollWidth ===
clientWidth` at both widths. Look at the screenshots. Say in your report
what you verified and what you did not see.

## A minimal working deck

`ship/example.html` is the smallest page that mounts the ship and renders one
instrument (a ribbon, a label, a glow). Open it first; copy its shape.
