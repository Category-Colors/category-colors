# Category Colors

A browser-based categorical palette optimizer, and the reference demo for the
[`category-colors`](https://www.npmjs.com/package/category-colors) package. It generates palettes with simulated annealing, evaluates pairwise distinguishability (including color-vision-deficiency simulations), and previews the result against live weather visualizations.

Every control in the interface maps onto a field of the package's config object, so the app doubles as a way to explore what the library's parameters do before writing any code.

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

Requires Node.js `>=22.12.0`, the floor `category-colors` sets.

To develop against a local checkout of the library instead of the published package, point the dependency at it with `npm install ../category-colors` and start the dev server with `vite --force` so the pre-bundled copy is rebuilt after each library change.

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
node scripts/regen-preset.mjs
```

That script updates the values documented in `src/lib/palette.ts` and `src/lib/preset-history.ts`.
