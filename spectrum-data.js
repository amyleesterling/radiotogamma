// Landmarks and stories for the EM comparison observatory. Everything here is
// data, not behavior: each landmark is a physical thing with an honest spectral
// shape (a line, a band, or a broad spectrum), a representative frequency, and
// one sentence on why it belongs. The page derives all numbers from these.
window.SPECTRUM_DATA = (() => {
  const C = 299792458;
  const nm = w => C / (w * 1e-9);           // wavelength in nm -> Hz
  const um = w => C / (w * 1e-6);           // wavelength in µm -> Hz
  const keV = e => e * 1e3 / 4.135667696e-15; // photon energy in keV -> Hz

  // type: 'line'   — effectively monochromatic, drawn as a line
  //       'band'   — a defined allocation or range, drawn as a translucent span
  //       'spectrum' — a broad emission, drawn as a soft footprint; the marker
  //                    sits at an approximate peak or representative value
  const LANDMARKS = [
    // --- Lasers and beams (ids kept stable for shared URLs) -------------
    { id: 'separator-gold', name: 'Shortwave, 18 MHz', cat: 'technology',
      type: 'line', hz: 18e6,
      why: 'Shortwave radio near 18 MHz: waves that bounce off the ionosphere and cross oceans.' ,
      how: 'A real patent proposes sorting particles by size with radio waves: grains of a given size respond most strongly to a matching frequency, and for 1.6 mm gold grains that tuning lands near 18 MHz - the same band shortwave broadcasters use to skip signals off the ionosphere.' },
    { id: 'dust-off', name: 'Green laser', cat: 'lasers',
      type: 'line', hz: nm(532),
      why: 'A 532 nm green laser pointer, the brightest-looking beam a pocket can carry.' ,
      how: 'A 532 nm green laser. Inside, a crystal doubles the frequency of a hidden 1064 nm infrared beam, and the resulting green lands near the eye\'s peak sensitivity - which is why it looks so impossibly bright.' },
    { id: 'red-laser', name: 'Red laser', cat: 'lasers',
      type: 'line', hz: nm(633),
      why: 'A classic 633 nm helium–neon red, the lab-bench standard.' ,
      how: 'The helium-neon laser\'s classic 633 nm line. Energized neon atoms are coaxed into emitting in lockstep, every photon the same wavelength and in step - that lockstep is what makes laser light one pure color.' },
    { id: 'blue-laser', name: 'Blue laser', cat: 'lasers',
      type: 'line', hz: nm(450),
      why: '450 nm diode blue, the color inside most laser projectors.' ,
      how: 'A 450 nm diode laser: electrons falling across a gallium-nitride semiconductor junction give up their energy as blue photons. The same chips power laser projectors and Blu-ray players.' },
    { id: 'ir-illuminator', name: 'IR illuminator', cat: 'lasers',
      type: 'line', hz: nm(940),
      why: '940 nm near-infrared: sensing and illumination light cameras see and eyes do not.' ,
      how: 'A floodlight of 940 nm LEDs, just past the red edge of vision. A camera\'s silicon sensor sees that light perfectly well, so the scene is lit for the camera while looking pitch dark to you - how night-vision security cameras work.' },

    // --- Everyday technology -------------------------------------------
    { id: 'am-radio', name: 'AM radio', cat: 'technology',
      type: 'band', lo: 540e3, hi: 1.7e6, hz: 1e6,
      why: 'The AM broadcast band, 540 kHz to 1.7 MHz. Waves hundreds of meters long.' ,
      how: 'Broadcast radio\'s oldest band. The station encodes sound by varying the strength (amplitude) of a steady carrier wave; the waves are hundreds of meters long and curve past hills and over the horizon.' },
    { id: 'fm-radio', name: 'FM radio', cat: 'technology',
      type: 'band', lo: 87.5e6, hi: 108e6, hz: 100e6,
      why: 'The FM broadcast band, 87.5 to 108 MHz. 100 MHz is the classic representative.' ,
      how: 'Broadcast radio that encodes sound by nudging the carrier\'s frequency up and down instead of its strength - which is why FM shrugs off the crackle and static that plague AM.' },
    { id: 'gps', name: 'GPS', cat: 'technology',
      type: 'line', hz: 1.57542e9,
      why: 'The GPS L1 carrier at 1575.42 MHz, whispering down from orbit.' ,
      how: 'Satellites 20,000 km up broadcast precise time signals at 1575.42 MHz. Your phone compares how late each satellite\'s signal arrives and triangulates its own position to within a few meters.' },
    { id: 'cellular', name: 'Cellular', cat: 'technology',
      type: 'band', lo: 600e6, hi: 6e9, hz: 1.9e9,
      why: 'Phone networks scatter across many allocations from 600 MHz to 6 GHz.' ,
      how: 'Phone networks scattered across many bands from 600 MHz to 6 GHz. Lower frequencies travel farther and pass through walls better; higher ones carry more data over shorter hops.' },
    { id: 'wifi', name: 'Wi-Fi', cat: 'technology',
      type: 'band', lo: 2.4e9, hi: 5.9e9, hz: 2.4e9,
      why: 'Wi-Fi lives in defined bands near 2.4 and 5–6 GHz, not at one point.' ,
      how: 'Short-range data radio in bands near 2.4 and 5-6 GHz, chopped into shared channels. 2.4 GHz reaches farther; 5 GHz carries more data through fewer walls. Your router whispers with under a watt.' },
    { id: 'microwave-oven', name: 'Microwave oven', cat: 'technology',
      type: 'line', hz: 2.45e9,
      why: '2.45 GHz — almost exactly where Wi-Fi sits. The difference is power, not place.' ,
      how: 'A magnetron tube pours about a kilowatt of 2.45 GHz waves into a sealed metal box. The waves yank water molecules back and forth billions of times a second, and that molecular friction is the heat.' },
    { id: 'radar', name: 'Radar', cat: 'technology',
      type: 'band', lo: 1e9, hi: 40e9, hz: 10e9,
      why: 'Radar bands run from about 1 to 40 GHz depending on the job.' ,
      how: 'Sends out a microwave pulse and times the echo: the delay gives distance, and the frequency shift of the reflection (the Doppler effect) gives speed. Airports, weather, and speed guns all run on it.' },
    { id: 'tv-remote', name: 'TV remote', cat: 'technology',
      type: 'line', hz: nm(940),
      why: 'Your remote blinks at ~940 nm infrared, invisible but a camera shows it.' ,
      how: 'A tiny 940 nm infrared LED blinking a digital code. The blinks are invisible to you but not to a phone camera - point one at the remote and watch it flash.' },

    // --- Body and nature -------------------------------------------------
    { id: 'lightning', name: 'Lightning (radio crackle)', cat: 'nature',
      type: 'spectrum', lo: 1e4, hi: 3e5, hz: 1e4,
      why: 'A stroke is a colossal current pulse, so it radiates real radio waves — the static you hear on AM during a storm — peaking near 10 kHz.' ,
      how: 'A stroke drives tens of kiloamperes through the air in microseconds, and a current changing that violently radiates a broadband radio burst called a sferic. The crackle on AM radio during a storm is lightning\'s own radio emission, often from hundreds of kilometers away.' },
    { id: 'cmb', name: 'Cosmic microwave background', cat: 'nature',
      type: 'spectrum', lo: 1e9, hi: 1e12, hz: 160.23e9,
      why: 'The afterglow of the Big Bang: a thermal spectrum peaking at 160 GHz.' ,
      how: 'The oldest light in existence: released 380,000 years after the Big Bang and stretched by the expansion of space into microwaves. It arrives from every direction in the sky, the thermal glow of a universe now 2.7 degrees above absolute zero.' },
    { id: 'body-heat', name: 'Human body heat', cat: 'nature',
      type: 'spectrum', lo: 3e12, hi: 1e14, hz: um(9.5),
      why: 'You glow, broadly, in the infrared — peaking near 9.5 µm at skin temperature.' ,
      how: 'Everything warm glows with thermal radiation, and at skin temperature that glow peaks near 9.5 um in the infrared. A thermal camera images this light directly - in its view, you are the lamp.' },
    { id: 'fire', name: 'Campfire', cat: 'nature',
      type: 'spectrum', lo: 1e13, hi: 5e14, hz: um(1.9),
      why: 'A fire’s thermal spectrum peaks in the near-infrared; the visible flicker is its high tail.' ,
      how: 'Hot soot particles glowing thermally. At roughly 1,500 K the emission peaks in the near-infrared, so most of a campfire\'s output is invisible warmth on your skin; the visible flicker is only the spectrum\'s high tail.' },
    { id: 'sunlight', name: 'Sunlight', cat: 'nature',
      type: 'spectrum', lo: 1e14, hi: 1.5e15, hz: nm(500),
      why: 'Sunlight spans infrared through ultraviolet, peaking right in the visible.' ,
      how: 'The thermal glow of the Sun\'s 5,800 K surface, peaking right in the visible band - no coincidence, since eyes evolved to use the brightest light on offer. About half its energy arrives as infrared warmth.' },
    { id: 'supernova', name: 'Supernova', cat: 'nature',
      type: 'spectrum', lo: 1e14, hi: 3e15, hz: 299792458 / 430e-9,
      why: 'A dying star\'s flash: a thermal glow peaking near the visible, like the Sun\'s.',
      how: 'When a massive star collapses, its shockwave flash and radioactive debris glow with a thermal spectrum peaking in the visible and UV, right where the Sun\'s does. For weeks it shines several billion times brighter than the Sun, outshining its entire galaxy.' },
    { id: 'sodium-line', name: 'Sodium streetlight line', cat: 'nature',
      type: 'line', hz: nm(589),
      why: 'The 589 nm sodium doublet — the amber of old streetlights and flame tests.' ,
      how: 'Sodium atoms energized in a lamp or a flame emit at almost exactly 589 nm as their outer electron falls back down. That one amber line lit a century of streetlights and gives salt-sprinkled flames their color.' },
    { id: 'h-alpha', name: 'Hydrogen-alpha line', cat: 'nature',
      type: 'line', hz: nm(656.3),
      why: '656.3 nm — the red glow of hydrogen, painting nebulae across the sky.' ,
      how: 'The red photon a hydrogen atom emits when its electron drops from the third energy level to the second: always 656.3 nm. Nebulae across the sky glow with it, which is why deep-space photographs run crimson.' },

    // --- Medicine and high energy ----------------------------------------
    { id: 'uvb', name: 'UVB (sunburn)', cat: 'high energy',
      type: 'band', lo: nm(315), hi: nm(280), hz: nm(300),
      why: 'The 280–315 nm band that sunburns skin. Non-ionizing, yet clearly not harmless.' ,
      how: 'The 280-315 nm slice of sunlight that causes sunburn. Each photon carries enough energy to damage DNA directly - technically non-ionizing, yet plainly potent. The ozone layer soaks up most of it before it reaches you.' },
    { id: 'uvc', name: 'Germicidal UVC', cat: 'high energy',
      type: 'line', hz: nm(254),
      why: '254 nm mercury-lamp light, used to sterilize because it shreds DNA bonds.' ,
      how: '254 nm light from a mercury discharge lamp, energetic enough to wreck DNA and RNA on contact - which is precisely why it sterilizes water, air, and instruments. The Sun makes UVC too, but the atmosphere stops all of it.' },
    { id: 'dental-xray', name: 'Dental x-ray', cat: 'high energy',
      type: 'spectrum', lo: keV(10), hi: keV(70), hz: keV(30),
      why: 'An x-ray tube emits a distribution of energies; a dental set peaks near 30 keV.' ,
      how: 'An x-ray tube slams electrons into a tungsten target; their sudden stop radiates a broad spread of x-ray energies peaking near 30 keV. Enamel and bone absorb more than flesh does, and that difference draws the shadow image.' },
    { id: 'ct-xray', name: 'CT scan x-rays', cat: 'high energy',
      type: 'spectrum', lo: keV(10), hi: keV(140), hz: keV(60),
      why: 'CT scanners run at 80–140 kVp, a broad braking-radiation spectrum.' ,
      how: 'The same electrons-into-metal physics as any x-ray tube, run at 80-140 kV. A CT scanner spins the tube around you, takes hundreds of shadow images, and reconstructs them into a 3D map, slice by slice.' },
    { id: 'tc99m-gamma', name: 'Medical gamma (Tc-99m)', cat: 'high energy',
      type: 'line', hz: keV(140),
      why: 'The 140 keV gamma line of technetium-99m, the workhorse of nuclear medicine.' ,
      how: 'Technetium-99m nuclei relax to a lower energy state by emitting a 140 keV gamma photon. Injected as a tracer, it lets a gamma camera watch organs working from the inside - and it decays away within a day.' },
  ];

  // Curated pairs, each with an insight that only makes sense for that pair.
  // a/b are landmark ids; the page falls back to a generic insight otherwise.
  const STORIES = [
    { a: 'fm-radio', b: 'dust-off',
      name: 'FM radio vs a green laser',
      insight: 'The laser sits 6.75 orders of magnitude — 22.4 doublings — above FM radio. Same phenomenon, wildly different address.' },
    { a: 'wifi', b: 'microwave-oven',
      name: 'Wi-Fi vs a microwave oven',
      insight: 'These operate at almost the same frequency. Their radically different effects come from power, confinement, geometry, and exposure — not from living in a more dangerous part of the spectrum.' },
    { a: 'red-laser', b: 'blue-laser',
      name: 'Red vs blue',
      insight: 'The entire human-visible rainbow spans only about one octave of frequency — one doubling, out of the 53 in this view.' },
    { a: 'body-heat', b: 'dust-off',
      name: 'You vs a green laser',
      insight: 'You are glowing continuously in infrared, about 18 times lower in frequency than the laser. Your eyes simply did not receive the memo.' },
    { a: 'cmb', b: 'microwave-oven',
      name: 'The Big Bang vs your kitchen',
      insight: 'The afterglow of the Big Bang peaks a mere 65× above your oven’s frequency. Your kitchen outshines the early universe — locally, and only because of power.' },
    { a: 'sunlight', b: 'supernova',
      name: 'Supernova vs the Sun',
      insight: 'They peak in almost the same octave of the spectrum. What separates them is power alone: for weeks a supernova outshines the Sun several billion times over, bright enough to outshine its whole galaxy. Same photons, unimaginable gap in intensity.' },
    { a: 'am-radio', b: 'tc99m-gamma',
      name: 'AM radio vs medical gamma',
      insight: 'Thirteen and a half orders of magnitude apart, yet both are the same phenomenon: an electromagnetic wave, differing only in frequency.' },
  ];

  // Familiar objects for the wavelength scale ladder. size is a representative
  // length in meters; each marker's wavelength is compared against the nearest
  // object in log space, with the honest ratio stated rather than hidden.
  const SCALE_OBJECTS = [
    { id: 'city',      name: 'a city',            size: 5e3,    img: 'scale/city.png' },
    { id: 'person',    name: 'a person',          size: 1.7,    img: 'scale/person.png' },
    { id: 'apple',     name: 'an apple',          size: 0.08,   img: 'apple.png' },
    { id: 'finger',    name: 'a finger’s width',  size: 0.016,  img: 'scale/finger.png' },
    { id: 'sand',      name: 'a grain of sand',   size: 5e-4,   img: 'scale/sand.png' },
    { id: 'cell',      name: 'a living cell',     size: 1.5e-5, img: 'scale/cell.png' },
    { id: 'bacterium', name: 'a bacterium',       size: 2e-6,   img: 'scale/bacterium.png' },
    { id: 'virus',     name: 'a virus',           size: 1e-7,   img: 'scale/virus.png' },
    { id: 'dna',       name: 'a DNA double helix, across', size: 2e-9, img: 'scale/dna.png' },
    { id: 'atom',      name: 'an atom',           size: 1e-10,  img: 'scale/atom.png' },
    // an atomic nucleus (~10 fm) sits below any wavelength in the displayed
    // 10 kHz–100 EHz window — it is here so the ladder keeps its footing if
    // the window ever grows, and as a reminder the spectrum does not end here
    { id: 'nucleus',   name: 'an atomic nucleus', size: 1e-14,  img: 'scale/nucleus.png' },
  ];

  return { LANDMARKS, STORIES, SCALE_OBJECTS };
})();
