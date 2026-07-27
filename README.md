# Category Colors

A browser-based categorical palette optimizer. It generates palettes with simulated annealing, evaluates pairwise distinguishability (including color-vision-deficiency simulations), and previews the result against live weather visualizations.

## What it includes

- Configurable RGB, HSL, OKHSL, OKLCH, and OKLAB search spaces
- Energy, range, JND, CVD, similarity, avoidance, contrast, and saliency evaluators
- Fixed seed colors and optional order optimization
- Editable palette history with raw, CSS, and DTCG JSON export
- Palette extraction from images and a set of established starting palettes
- Pairwise JND/WCAG reporting, loss history, and color-space visualization
- Persistent light, dark, and custom themes

The optimizer runs in a Web Worker so generation does not block the interface. The large reporting code is loaded only when the Report tab is opened.

## Development

Requires Node.js `^20.19.0` or `>=22.12.0`. The sibling [`category-colors`](../category-colors) package must be present because this app links it through a local `file:` dependency.

```sh
npm install
npm run dev
```

Useful checks:

```sh
npm test
npm run lint
npm run build
```

The app also contains two development-only reference surfaces:

- `/?story=` lists focused component stories.
- `/design-system` shows the component and token reference.

## Preset regeneration

The initial palette and its recorded loss curve are checked in so the first load is instant. After changing optimizer defaults, regenerate them with:

```sh
node scripts/regen-preset.cjs
```

That script updates the values documented in `src/lib/palette.ts` and `src/lib/preset-history.ts`.
