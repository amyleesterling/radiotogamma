# Working on Radio to Gamma

A static site, no build step, no framework. Five decks (HTML pages) on one
shared runtime in `ship/`, one data file, one physics kernel. Read
`README.md` for the map and `SHIP.md` for how a deck is built.

## Rules that keep the site honest

- **Every number on a page must be right.** The site's whole brand is that
  the physics is real. Before writing a figure into copy, compute it (a
  one-line `node -e` is enough) and keep the derivation in the commit
  message when it is not obvious. Comparisons ("the energy of a thrown
  ping-pong ball") count as numbers: check them.
- **Physics lives in `ship/physics.js`.** Constants, conversions, unit
  ladders, Planck, Wien, Stefan-Boltzmann, the band table, spectral colour.
  A deck imports what it needs and never re-declares a constant. A missing
  function is added to the kernel, with a comment, not to a page.
- **Data lives in `spectrum-data.js`.** Landmarks, stories, the scale
  ladder, and the spectral zoo. Never duplicate an entry into a page; give it
  an id and have the page look it up.
- **Chrome lives in `ship/ship.css`; the runtime in `ship/ship.js`.** If a
  rule or a helper appears on two decks, move it there. The deck bar, the
  hull canvas and the viewport mechanism come from `ship.mount()` and
  `ship.viewport()`; a page never writes its own header or its own
  WebGLRenderer.
- **Visual scale may be compressed; the page must say so.** Sixteen decades
  do not fit in a box. Every instrument that compresses, exaggerates or
  translates (a colour for light the eye cannot see) carries a `.vp-note`
  that says what is real and what is drawn.
- **Body text is sans-serif; readouts, ticks, tags and svg text are
  monospace** via `.num` / `.mono` or a page rule.
- **Sliders are sliders to assistive tech.** Anything with `role="slider"`
  carries `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (log10 Hz) and
  `aria-valuetext` (the human units), and the arrow keys step it.
- **Reduced motion is honoured.** Instruments still answer input; ambient
  drift, entrances and celebrations are held. Read `ship.motion`.
- **`vendor/` is never edited.** Change upstream, copy down, and update the
  folder's `SOURCE.txt` so it describes exactly what is there and who uses it.
- **Images are right-sized.** Prefer WebP with alpha; keep the source no
  larger than about 2x its drawn size.

## Checking a change

1. Serve the folder (`python3 -m http.server`) and load every deck you
   touched; the console must be clean and every asset request must be 200.
2. `observatory.html?test=1` runs the conversion self-tests in the page.
3. At 375 px wide the page must never scroll sideways: `scrollWidth` equals
   `clientWidth` with any `overflow-x: hidden` turned off.
4. Headless Chromium reports `prefers-reduced-motion: reduce` by default;
   pass `reducedMotion: 'no-preference'` or every entrance silently never
   runs and the test passes while measuring nothing.

## Style

- Commit messages: a short, specific first line in the voice of the site
  ("The dung beetle joins the cuttlefish on the polarization wing"), then
  the reasoning.
- Comments explain why, not what, and record the user-facing reason for a
  design choice when there is one.
- **No em or en dashes in copy, ever.** Amy's standing rule, and it outranks
  whatever the surrounding page does. Use commas, semicolons, colons, or full
  stops; a numeric range reads "380 to 750 nm"; compound names take a plain
  hyphen (Stefan-Boltzmann). Code comments are not copy.
