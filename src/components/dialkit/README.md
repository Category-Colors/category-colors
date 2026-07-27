# Vendored DialKit controls

UI controls extracted from [DialKit](https://github.com/joshpuckett/dialkit) by
Josh Puckett, MIT license (see `LICENSE` in this directory).

- Source: `joshpuckett/dialkit` @ `ae1af01e40c2898ff9c6258746dc4327ac50ffc0` (v1.3.0)
- Taken: the presentational controls (`Slider`, `Toggle`, `SegmentedControl`,
  `ColorControl`, `SelectControl`, `TextControl`, `ButtonGroup`, `Folder`),
  `icons.ts`, `dropdown-position.ts`, `theme.css`, and a trimmed
  `shortcut-utils.ts` (pure helpers only).
- Left behind: `DialRoot`, the floating `Panel` + drag logic, `DialStore`,
  `useDialKit`, keyboard-shortcut listeners, preset manager, and the
  spring/transition/easing controls.

The controls are plain controlled components (`value` + `onChange`). Styling
requires wrapping them in an element with the `dialkit-root` class and
importing `theme.css` once. `SelectControl` portals its dropdown into the
nearest `.dialkit-root` ancestor.

Local modifications:
- Import paths flattened into this directory.
- `ShortcutConfig` type moved to `types.ts` to drop the store dependency.
- `Folder` gained an optional `actions` prop: ReactNode rendered at the right
  edge of the header (non-root only), with clicks kept out of the open/close
  toggle. Styled via `.dialkit-folder-actions` in `theme.css`. `title` widened
  from `string` to `ReactNode` so callers can compose styled titles.
- Non-root folder chevrons show only on header hover and sit right-aligned
  just before any header `actions` (at the right edge when there are none).
  See end of `theme.css`. Direction semantics flipped from upstream:
  down = collapsed, up = open (matching the select dropdowns).
- `Folder` supports a controlled `open` prop (falls back to internal state via
  `defaultOpen` when omitted), and the `actions` slot also renders in the
  open inline-root header.
- `Slider` value is instantly editable: clicking the number opens the inline
  input immediately (upstream armed editing only after an 800ms hover), and
  presses on the number no longer fall through to the track as snap-clicks.
- Animation timing tokenized: motion springs in `motion.ts` (`SPRING`,
  `FADE`, `PILL_TRANSITION`), CSS durations as `--dial-anim-fast` /
  `--dial-anim-reveal` on `.dialkit-root`. Timings tightened from upstream
  (folder expand 0.35s -> 0.24s, dropdowns 0.15s -> 0.12s, hovers 0.15s -> 0.1s).
