# Glacial design

The redesign uses an original procedural ice-block data core, a glacial landscape, a cool gray palette, large typography, and small technical labels. Igloo Inc. is the visual reference; its assets, logo, and source are not copied.

## Source

- `assets/glacial.css`: shared identity, responsive layout, article and table presentation.
- `assets/base.css`: the existing checkup interface's base styles.
- `assets/ice-scene.js`: the local Three.js scene, frost texture, terrain, pointer/scroll movement, and pause control.
- `assets/ice-core.svg`: static fallback if WebGL is unavailable.
- `assets/experience.js`: optional section reveals.
- `assets/vendor/`: self-hosted Three.js 0.180.0 and RoundedBoxGeometry, with the MIT license.

The CSV engine, analysis interface script, file processing, and Content Security Policy are unchanged. The scene uses no network API and no remote assets. External web fonts were removed. Animation pauses when the hero is offscreen or the tab is hidden; reduced-motion preferences disable continuous motion. The analyzer works independently of scene initialization.

## Preview

From this checkout:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

Open `http://127.0.0.1:8767/`, then try the demo or a synthetic fixture under `tests/fixtures/`.

## Verification

- Desktop hero and live WebGL scene, pause/resume, demo, report details, and copy preview.
- Synthetic `partial.csv` through the real file chooser: $100 included, invalid/unpriced rows disclosed.
- Mobile 390px hero, demo, expanded coverage, and pricing. No document-level horizontal overflow.
- Reference tables scroll inside their container on phones.
- 52 historical engine regression tests from commit `04ade50` pass against the current unchanged engine. The historical suite was run outside the checkout; this change does not reintroduce the deleted test suite.
- JavaScript syntax, local links and IDs, and `git diff --check`.

This verifies the design and existing synthetic scenarios, not compatibility with unobserved real provider exports.
