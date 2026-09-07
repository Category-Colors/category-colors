# Launch review — September 7, 2026

The app is a credible candidate for a limited beta after the fixes in this review. I would not yet give an unrestricted public launch sign-off. The core generation, preview, and report flows work, but session recovery, keyboard access, and deployment validation still need attention.

## Remaining findings, in priority order

| Priority | Finding and evidence | Recommended next step |
| --- | --- | --- |
| P1 | Refreshing or closing the tab discards palettes, history, and configuration. `src/App.tsx:26` initializes everything from defaults; only theme settings are persisted. This was also observed during browser reloads. | Add bounded, versioned local session recovery with validation and storage-failure handling. At minimum, disclose the temporary-session behavior in the UI. |
| P1 for commercial launch | Preview uses the free Open-Meteo endpoint directly. Its terms restrict that endpoint to non-commercial use, including restrictions on promotional use. | Resolve the intended launch's eligibility; if needed, use a paid service behind a server that protects credentials, or replace live weather with sample data. No subscription or infrastructure was purchased. |
| P2 | Palette drag handles are buttons with only `onPointerDown` behavior (`src/components/panels/ReorderList.tsx:64`). Pair detail popovers also rely on pointer hover (`src/components/main/PairGrid.tsx:397`). Keyboard users cannot access the equivalent interactions. | Add keyboard reordering with announcements and focus retention; expose pair detail through focus/click and touch. |
| P2 | Editing a generated palette changes `colors` but retains the original `cost`, iterations, and loss history (`src/App.tsx:135`). Statistics recalculate, while the history tooltip still labels the old cost as the result. | Mark edited versions and label the curve/cost as the original optimization run, or separate original-run metadata from current palette statistics. |
| P2 | The lazy report has a loading fallback but no error boundary (`src/components/main/MainTabs.tsx`). A failed chunk load can take down the React tree. | Isolate report failures so export remains usable. Retain previous hashed assets during releases and verify cache headers on the actual host. |
| P2 | Imports convert colors to hex; DTCG imports use scanned hex fallbacks rather than interpreting structured components (`src/lib/exporters.ts`). Wide-gamut values lose fidelity, and valid component-only token files are not supported. | Define and document import fidelity, then implement structured DTCG parsing if interoperability is a launch promise. |
| P2 | Some report labels use small type at low ink opacity, such as table headings at `text-ink/30`. No complete contrast or screen-reader audit has been performed. | Measure contrast across light/dark/custom themes and run an accessibility pass before claiming conformance. |
| P3 | The production entry is about 573 kB minified / 187 kB gzip; the report adds about 222 kB gzip, and the generation worker is about 502 kB minified. Vite emits its large-chunk warning. | Measure cold-load and first-generation performance on slower phones. Split only where measurements justify it; the optimizer already runs off the main thread. |

Open-Meteo source: [Terms and API eligibility](https://open-meteo.com/en/terms). Attribution was added, but attribution alone does not establish eligibility for the free endpoint.

## Fixed in this review

- Weather failure now offers an in-app retry, preserving palettes. Requests time out after 15 seconds instead of potentially leaving an indefinite loading state.
- Added Open-Meteo attribution, a CC BY 4.0 link, and a description of the derived values.
- Disclosed that weather preview covers only the first 20 colors for larger palettes.
- Limited palette file imports to 256 colors before running quadratic pair reports. Oversized imports are rejected rather than silently truncated.
- Fixed plain-text imports dropping named colors when mixed with hex or functional notation.
- Fixed extraction returning no colors from a one-pixel opaque image.
- Added accessible names and selected state to history restore controls, specific names to history deletion controls, and pressed state to extracted-color selections.
- Fixed the history popover reusing an outdated version object after edits.
- Excluded development reference routes and their JavaScript chunks from production.
- Updated PostCSS 8.5.16 → 8.5.28 and nanoid 3.3.15 → 3.3.18. npm's audit found two high-severity dependency entries before the update and zero known vulnerabilities afterward. This is an advisory scan, not proof of application security.
- Added page description metadata and corrected deployment/session documentation, including removing instructions for a nonexistent preset regeneration script.

## Validation

- `npm test`: passes. Added regression cases for mixed color imports, failed weather request recovery, concurrent request deduplication, cache reuse, forecast conversions, one-pixel extraction, bitmap release, and generation in RGB/HSL/OKHSL/OKLCH/OKLAB.
- `npm run lint`: passes.
- `npm run build`: passes, with the bundle-size warning noted above. No story or design-system JavaScript chunks remain in the output.
- `git diff --check`: passes.
- Browser smoke checks used the development app and the production build served locally. Verified generation, preset loading, live forecast loading, report rendering, desktop layout at 1440 × 1000, phone layout at 390 × 844, output sheet opening/dismissal, export menu selection, and JSON export preview.

## Limits of this sign-off

The actual public host, CDN caching, HTTPS configuration, deployment rollback, and old-tab behavior across a release were not tested. Neither were real iOS Safari, Firefox, screen-reader operation, a full touch/gesture matrix, or saved-download contents. Weather recovery was tested with mocked fetch failures; an actual browser network-outage test remains useful. There is no automated end-to-end browser suite in the repository.

Before a broad launch, prioritize session recovery and the keyboard gaps, settle weather service eligibility, and smoke-test the deployed build in Safari and Firefox. An opt-in beta can be useful sooner if users understand that their sessions are temporary.
