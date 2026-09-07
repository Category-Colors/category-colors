import { formatHex, interpolate, wcagContrast } from 'culori'

// Find the nearest mixture that meets normal-text contrast on every surface
// it is used on. Report cards are close to the page color; popovers use their
// own panel background. This also protects reports in low-contrast custom themes.
export function readableColor(backgrounds: string[], preferred: string): string {
  const passes = (c: string) => backgrounds.every((bg) => wcagContrast(c, bg) >= 4.5)
  if (passes(preferred)) return preferred
  for (let step = 1; step <= 100; step++) {
    for (const end of ['#ffffff', '#000000']) {
      const color = formatHex(interpolate([preferred, end], 'rgb')(step / 100))
      if (passes(color)) return color
    }
  }
  return wcagContrast('#000', backgrounds[0]) > wcagContrast('#fff', backgrounds[0]) ? '#000000' : '#ffffff'
}

export function reportTextColors(bg: string, ink: string, danger: string) {
  const card = formatHex(interpolate([bg, ink], 'rgb')(0.05))
  const muted = formatHex(interpolate([bg, ink], 'rgb')(0.75))
  return { text: readableColor([bg, card], muted), danger: readableColor([bg, card], danger) }
}
