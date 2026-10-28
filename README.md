# Radio to Gamma

**One phenomenon. Sixteen orders of magnitude.**

A survey vessel, built some way into the future, that invites anyone in the
galaxy aboard to explore the electromagnetic spectrum: to play with it, break
it, and come away understanding it. Live at
**[radiotogamma.com](https://radiotogamma.com)**. Every deck runs the real
physics in miniature: Planck's E = hf behind every readout, Snell and Cauchy
dispersion in the prism, the grating equation on a real 1.6 µm track pitch in
the CD, the 42° droplet cone, Rayleigh's 1/λ⁴ in the sky, |O + R|² on the
holographic plate, Wien and Stefan-Boltzmann under every glowing body.

## The decks

| Deck | Page | What it does |
| --- | --- | --- |
| 01 Bridge | `index.html` | The beam: the whole spectrum as a ribbon of light in perspective, two probes you drag along it with their live waves, every landmark a chip. The visible band opened out through a real BK7 prism. An apple under a beam whose frequency and power you dial, with thermal and molecular verdicts. A glowing body floating over the frequency its Planck curve peaks at, from a dilution fridge to the one-second-old universe. |
| 02 Observatory | `observatory.html` | Pick any two signals, or type a value, and compare frequency, wavelength, period and photon energy. The lens zooms the ribbon; the lockstep explorer dollies the camera from A to B. Layers: matter, wave view, senses, sky (atmospheric transmission as a surface), redshift (a second ribbon slid by log(1 + z), lookback times from flat ΛCDM), stories. A quiz, an audible octave, the octave ladder from one footstep to the Oort cloud. State lives in the URL; `?test=1` runs the self-tests. |
| 03 Light Lab | `lab.html` + `lab/*.js` | Six benches, each a 3D instrument: prism (real glasses by catalogue index and Abbe number, plus INVENT, any index even below 1), CD (track pitch from Blu-ray to 10 µm), garden-hose rainbow (2,400 droplets coloured by Descartes' caustic; try diamond), build a sky (noon to five atmospheres, Mars), soap film (index and thickness), hologram (record, replay at the wrong colour, break the plate). Predict first. |
| 04 Gamma Attic | `gamma.html` | The energy ruler from 100 keV to 3 PeV as a ladder of light you climb, every rung a real line or detection with its source, and a dial that runs on to the Planck energy and says honestly what happens past each threshold. |
| 05 Spectral Zoo | `senses.html` + `senses/zoo.js` | Who senses what, hovering over the slice of the beam each creature reaches, and a reference scene re-lit through any creature's band so you can borrow its eyes. |

## Layout

- **No build step.** Serve the folder (`python3 -m http.server`) and open a
  deck. Pages are ES modules, so they need a server rather than `file://`.
- `ship/` is the vessel: `ship.js` (the deck bar, one WebGL canvas behind
  the page, and `ship.viewport()`, which renders a 3D instrument into any
  DOM box on that canvas), `ship.css` (chrome and tokens, built on
  scifi-ui), `physics.js` (every constant, conversion and blackbody
  function), `example.html` (the smallest working deck). `SHIP.md` is the
  spec a deck is built to.
- `spectrum-data.js` is the single source of data: landmarks, stories, the
  wavelength scale ladder, and the spectral zoo.
- `observatory/kernel.js`, `lab/bench.js`, `senses/zoo.js` hold each deck's
  own physics and helpers.
- `vendor/` is copied unmodified from upstream; see each folder's
  `SOURCE.txt`. The hologram UI is
  [scifi-ui](https://github.com/amyleesterling/scifi-ui); the 3D is
  [three.js](https://github.com/mrdoob/three.js) r184.
- Images ship as right-sized WebP; the creature icons in `senses/` are small
  PNGs; `gammaimg/` is credited on the deck.

## Checks

`CLAUDE.md` has the rules. In short: every number right, console clean,
every request 200, no sideways scroll at 375 px, `observatory.html?test=1`
passing.

## Credits

Built by Amy Robinson Sterling ([@amyneurons](https://x.com/amyneurons)),
with Fable and Sol. Born as part of [hbdanny.com](https://hbdanny.com), and
grown into its own site. Studio lighting HDRI by
[Poly Haven](https://polyhaven.com) (CC0). Gamma-ray imagery credited on the
deck.
