# Category Colors mark

Two solid Cs sit side by side: the initials, and two of a kind. Each C is
opened by a horizontal slot rather than a wedge, so the opening reads as a
letter instead of a mouth.

## References

The direction came from a study of Logobook's C collection, particularly
[Carlo Ciarli](https://logobook.com/logo/carlo-ciarli/) for repeated solid Cs
and [Cope by Cruz Novillo](https://logobook.com/logo/cope/) for an opening that
isn't a wedge. Two earlier directions were rejected: overlapping monoline Cs
(too close to Meta's logo and to Mash Creative's
[Cusp](https://logobook.com/logo/cusp/)) and a five-swatch C, whose wedge
opening read as Pac-Man at small sizes. The five-swatch C and three other
explorations are kept in `docs/logo-alternatives/`.

## Assets and use

- `src/assets/mark.svg`: primary one-color silhouette; used as a theme-aware CSS
  mask in the header and About window.
- `src/assets/mark-color.svg`: two-color version for larger applications.
- `public/favicon.svg`: the same silhouette with light/dark browser ink.

Use the one-color mark at small sizes. The header uses a 20px box and 65% theme
ink. The favicon uses full-strength ink. Keep the mark static, with the two Cs
the same size and weight, and leave clear space around it of at least the slot's
height. The existing Geist interface wordmark remains in use.

The construction uses a 32-unit viewBox and radius 12; every other measure is a
ratio of it. Each C is a disc cut by a flat edge 0.15r right of its center. Its
slot is 0.5r tall and runs 60% of the C's width in from the flat edge. The Cs
are 0.15r apart. Run `node scripts/build-brand.mjs` to regenerate the three
standalone marks.

The social card (`public/og.png`, from `scripts/og-card.html`) carries the mark
in its title panel the way the About window does. Run `scripts/build-og.mjs` to
re-render it after changing the mark.
