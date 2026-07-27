import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  loadTheme,
  polarityOf,
  resolveTokens,
  saveTheme,
  ThemeContext,
  type ThemeState,
} from '@/lib/theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  // read once, lazily — localStorage is synchronous and this runs before the
  // first paint, so there's no flash of the default theme
  const [state, setState] = useState<ThemeState>(loadTheme)
  const tokens = useMemo(() => resolveTokens(state), [state])

  // The tokens go out twice: as CSS variables for everything drawn in CSS,
  // and through context for the canvas and the contrast maths, which need
  // them as data. Both come from the same resolve so they can't drift.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--theme-bg', tokens.bg)
    root.style.setProperty('--theme-panel', tokens.panel)
    root.style.setProperty('--theme-ink', tokens.ink)
    root.style.setProperty('--theme-danger', tokens.danger)
    // Derived from the resolved background rather than state.mode, so custom
    // themes get it too. Drives the shadow weight in CSS, and tells the
    // browser how to paint form controls and default scrollbars.
    const polarity = polarityOf(tokens.bg)
    root.dataset.polarity = polarity
    root.style.colorScheme = polarity
  }, [tokens])

  useEffect(() => saveTheme(state), [state])

  return <ThemeContext value={{ state, setState, tokens }}>{children}</ThemeContext>
}
