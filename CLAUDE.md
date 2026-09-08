# Working on Radio to Gamma

A static site, no build step, no framework. Five HTML pages, one shared
stylesheet, one data file, four lab modules. Read `README.md` for the map.

## Rules that keep the site honest

- **Every number on a page must be right.** The site's whole brand is that
  the physics is real. Before writing a figure into copy, compute it (a
  one-line `node -e` is enough) and keep the derivation in the commit
  message when it is not obvious. Comparisons ("the energy of a thrown
  ping-pong ball") count as numbers: check them.
- **Data lives in `spectrum-data.js`.** Landmarks, stories, the scale
  ladder, and the spectral zoo. Never duplicate an entry into a page; give it
  an id and have the page look it up. `senses.html` and the observatory's
  Senses layer both read `SPECTRUM_DATA.ZOO`.
- **Shared CSS lives in `site.css`.** If a rule appears on two pages, move
  it there. The header bar and the body base are already shared; do not
  paste them back into a page.
- **Body text is sans-serif; readouts, ticks, tags and svg text are
  monospace** via `.num` / `.mono` or a page rule. The homepage used to be
  all-monospace; keep it in line with the other pages.
- **Sliders are sliders to assistive tech.** Anything with `role="slider"`
  carries `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (log10 Hz) and
  `aria-valuetext` (the human units). See `ariaSlider()` in `index.html`.
- **`vendor/` is never edited.** Change upstream, copy down, and update the
  folder's `SOURCE.txt` so it describes exactly what is there and who uses it.
- **Images are right-sized.** A picture drawn at 128 px does not ship at
  512 px PNG. Prefer WebP with alpha; keep the source no larger than about
  2× its drawn size. The creature icons in `senses/` are already small.

## Checking a change

1. Serve the folder (`python3 -m http.server`) and load every page you
   touched; the console must be clean and every asset request must be 200.
2. `observatory.html?test=1` runs the conversion self-tests in the page.
3. On a phone-width viewport the page must never scroll sideways.

## Style

- Commit messages: a short, specific first line in the voice of the site
  ("The dung beetle joins the cuttlefish on the polarization wing"), then
  the reasoning.
- Comments explain why, not what, and record the user-facing reason for a
  design choice when there is one.
- The site's copy uses em-dashes freely; match the surrounding page rather
  than imposing a house rule.
