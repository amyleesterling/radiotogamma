# Radio to Gamma

**One phenomenon. Sixteen orders of magnitude.**

An interactive tour of the electromagnetic spectrum, live at
**[radiotogamma.com](https://radiotogamma.com)**. Every page runs the real
physics in miniature: Planck's E = hf behind every readout, Snell and
dispersion in the prism, the grating equation on a real 1.6 µm track pitch
in the CD, the 42° droplet cone, Rayleigh's 1/λ⁴ in the sky.

## The pages

| Page | What it does |
| --- | --- |
| `index.html` | The wave instrument: two markers on a 10 kHz to 100 EHz bar that snap to the observatory's landmarks, live wave lanes, a magnified visible band with a sunset lab, the apple exhibit (frequency dial × power dial → thermal and molecular verdicts), and the temperature dial (Planck's glow across the bar, Wien's peak, Stefan–Boltzmann power, twenty-five presets from a dilution fridge to the one-second-old universe). |
| `observatory.html` | Pick any two landmarks, or type a value, and compare frequency, wavelength, period and photon energy. Focus lens, lockstep explorer, equal-power photon counts, matter / wave / senses / sky (atmospheric transmission) / stories layers, a guided tour, an audible octave, and the octave ladder from one footstep to the Oort cloud. State lives in the URL. |
| `lab.html` + `lab/*.js` | The Light Lab: prism, CD (3D with three.js and a computed wave sheet at the bottom of the dive, 2D fallback), garden-hose rainbow, build-a-sky, and a draining soap film (thin-film interference). Predict-first quiz. |
| `gamma.html` | The Gamma Attic: an energy ruler from 100 keV to 3 PeV with real landmarks. |
| `senses.html` | The Spectral Zoo: who senses what, split honestly into vision, radiant heat, field senses, a polarization wing, and an X-ray footnote. |

## Layout

- **No build step.** Open any `.html` file directly, or serve the folder.
- `site.css` holds everything two or more pages share: the body base, the
  monospace helpers, and the header bar. Page-specific styling stays in each
  page's own `<style>` block.
- `spectrum-data.js` is the single source of data: observatory landmarks
  and stories, the wavelength scale ladder, and the spectral zoo. Both
  `senses.html` and the observatory's Senses layer read the zoo from here.
- `share.js` is the header share button (native share sheet, or copy-link).
- `vendor/` is copied unmodified from upstream; see the `SOURCE.txt` in each
  folder. Change things upstream and copy them down again.
- Images ship as right-sized WebP where a page draws them small; the
  creature icons in `senses/` are small PNGs.

## Checks

Append `?test=1` to `observatory.html` to run the conversion self-tests in
the page. There is no other test harness: load each page and watch the
console.

## Credits

Built by Amy Robinson Sterling ([@amyneurons](https://x.com/amyneurons)),
with Fable and Sol. Born as part of [hbdanny.com](https://hbdanny.com), and
grown into its own site. Studio lighting HDRI by
[Poly Haven](https://polyhaven.com) (CC0). Gamma-ray imagery credited on the
page.
