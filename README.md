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
- A searchable manual (`⌘?`) defining every technical term in the interface

The optimizer runs in a Web Worker so generation does not block the interface. The large reporting code is loaded only when the Report tab is opened.

## Development

Requires Node.js `>=22.12.0`, the floor `category-colors` sets.

To develop against a local checkout of the library instead of the published package, link it without touching `package.json` or the lockfile:

```sh
npm install --no-save ../category-colors
```

Vite serves the linked checkout from source, so library edits hot-reload. A plain `npm install` restores the published package.

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

## Deployment and sessions

Run `npm ci`, the checks above, and publish `dist/` to a static HTTPS host.
The production build excludes the development reference pages. Serve HTML with
revalidation and hashed assets with long-lived caching; retain prior assets
during deployments so open sessions can still load the report chunk.

Palettes, history, and configuration currently live in memory and are lost on
reload. Download palettes and export configuration before leaving. Only the
theme is persisted locally.

The chart preview requests forecasts directly from Open-Meteo. Its free endpoint
is for non-commercial use; review [Open-Meteo's terms](https://open-meteo.com/en/terms)
before a commercial launch. Weather attribution appears below the charts.
