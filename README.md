# Molarity Calculator

A mobile-first calculator for preparing one or many samples at a target molarity. Enter one shared molar mass and molarity, then calculate the final solution volume for every weighed sample at once.

It uses plain HTML, CSS, and JavaScript. There is no framework, build step, server, account, or network dependency.

## Features

- Batch calculation for any number of samples
- Five editable sample rows on first use
- Mass input in µg, mg, or g
- Molarity in µM, mM, or M, defaulting to mM
- Final volume in µL, mL, or L, defaulting to µL
- Paste a column of weights from Excel or another spreadsheet
- Copy calculated results as a tab-separated table
- Individual four-field solver: leave mass, molar mass, molarity, or final volume empty
- Consistency check when all four individual values are supplied
- Adjustable result precision
- Saved values and unit preferences
- Responsive light and dark interface
- Installable and offline after the first hosted visit
- Direct-file-safe scripts for opening `index.html` without a local server

## Calculation

The calculator uses:

```text
final volume (L) = mass (g) ÷ molar mass (g/mol) ÷ molarity (mol/L)
```

All input units are normalized internally before calculation.

The result is **final solution volume**, not necessarily the amount of solvent to add. Prepare the solution to the displayed final volume using the appropriate laboratory procedure.

## Use locally

Double-click `index.html` to use all calculator functions immediately. Direct-file mode cannot install a service worker, but it does not require internet access.

To test installation and service-worker caching locally, serve the folder through a local web server. For example, if Python is installed:

```sh
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish with GitHub Pages

1. Create a GitHub repository.
2. Upload every file and folder in this project to the repository root.
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.
6. Open the Pages address shown after deployment completes.

All URLs are relative, so the app works from either a GitHub user site or a project site.

## Future compound presets

Preset support is already separated into `compounds.js`. Add objects to `MOLARITY_COMPOUNDS` using this shape:

```js
{ name: "Sodium borohydride", formula: "NaBH4", molarMass: 37.83 }
```

Matching a preset by name or formula fills the molar mass automatically. Version 1 intentionally ships with an empty preset list.

## Files

- `index.html` — app structure and PWA metadata
- `styles.css` — responsive light/dark interface
- `calculator.js` — unit conversion and chemistry formulas
- `compounds.js` — preset-ready compound list
- `app.js` — batch rows, individual solver, saved preferences, copy/paste, and PWA behavior
- `manifest.webmanifest` — installable app definition
- `sw.js` — offline cache and update handling
- `icons/` — standard and maskable app icons
- `tests/calculator.test.mjs` — formula and conversion tests

## Run tests

With Node.js installed:

```sh
node tests/calculator.test.mjs
```

When updating cached app files after publication, increment `CACHE_NAME` near the top of `sw.js`.
