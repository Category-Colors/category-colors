import { createContext, use } from 'react'

// The whole UI is drawn from three neutrals plus one accent. Text, borders,
// hover states and raised surfaces are all `ink` at some alpha over `bg`,
// which is why a theme is this small: change the pair and every surface
// follows.

/** The three neutrals a theme is built from — the part a custom theme owns. */
export interface ThemeNeutrals {
  /** page background */
  bg: string
  /** panels, popovers, dropdowns — the layer above the page */
  panel: string
  /** text, borders, and every raised surface, applied at an alpha */
  ink: string
}

export interface ThemeTokens extends ThemeNeutrals {
  /** failing contrast and JND checks; the only accent in the app */
  danger: string
}

export type ThemeMode = 'dark' | 'light'

export interface ThemePreset {
  id: string
  name: string
  blurb: string
  modes: Record<ThemeMode, ThemeTokens>
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    // "tail wind" → "back breeze"
    id: 'backbreeze',
    name: 'Backbreeze',
    blurb: 'Tailwind neutrals',
    modes: {
      dark: { bg: '#131316', panel: '#212121', ink: '#ffffff', danger: '#fb2c36' },
      light: { bg: '#fafafa', panel: '#ffffff', ink: '#18181b', danger: '#e7000b' },
    },
  },
  {
    // "anthropic" → "humane"
    id: 'humane',
    name: 'Humane',
    blurb: 'Warm greys and clay',
    modes: {
      dark: { bg: '#1f1e1d', panel: '#2b2a27', ink: '#f0eee6', danger: '#e0806a' },
      light: { bg: '#f0eee6', panel: '#faf9f5', ink: '#1f1e1d', danger: '#bc4b32' },
    },
  },
]

export const CUSTOM = 'custom' as const

export interface ThemeState {
  preset: string | typeof CUSTOM
  mode: ThemeMode
  /** neutrals only; the accent is derived, see resolveTokens */
  custom: ThemeNeutrals
}

const DEFAULT_PRESET = THEME_PRESETS[0]

export const neutralsOf = ({ bg, panel, ink }: ThemeTokens): ThemeNeutrals => ({ bg, panel, ink })

export const DEFAULT_THEME: ThemeState = {
  preset: DEFAULT_PRESET.id,
  mode: 'dark',
  // seeded from the default preset so opening the editor starts somewhere
  // recognisable rather than on black
  custom: neutralsOf(DEFAULT_PRESET.modes.dark),
}

/** Rough relative luminance of a background, for picking a polarity. */
export function polarityOf(bg: string): ThemeMode {
  const hex = bg.replace('#', '')
  if (hex.length < 6) return 'dark'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.5 ? 'light' : 'dark'
}

export function resolveTokens(state: ThemeState): ThemeTokens {
  if (state.preset === CUSTOM) {
    // A custom theme sets the neutrals only. "Failure" has one job — being
    // unmistakably a failure — so it isn't a taste knob; it follows whichever
    // polarity the chosen background lands on.
    const danger = DEFAULT_PRESET.modes[polarityOf(state.custom.bg)].danger
    return { ...state.custom, danger }
  }
  const preset = THEME_PRESETS.find((p) => p.id === state.preset) ?? DEFAULT_PRESET
  return preset.modes[state.mode]
}

export const TOKEN_FIELDS: { key: keyof ThemeNeutrals; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'panel', label: 'Panel' },
  { key: 'ink', label: 'Ink' },
]

export interface ThemeContextValue {
  state: ThemeState
  setState: (next: ThemeState) => void
  tokens: ThemeTokens
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = use(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

const STORAGE_KEY = 'category-colors:theme'

// A stored theme is user data that survives upgrades, so it's validated the
// same way an imported config is: unknown presets, missing neutrals and
// non-string values all fall back rather than painting the app with junk.
export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_THEME
    const parsed = JSON.parse(raw) as Partial<ThemeState> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_THEME

    const known = parsed.preset === CUSTOM || THEME_PRESETS.some((p) => p.id === parsed.preset)
    const custom = parsed.custom
    const neutrals =
      custom && (['bg', 'panel', 'ink'] as const).every((k) => typeof custom[k] === 'string')
        ? neutralsOf(custom as ThemeTokens)
        : DEFAULT_THEME.custom

    return {
      preset: known ? parsed.preset! : DEFAULT_THEME.preset,
      mode: parsed.mode === 'light' ? 'light' : 'dark',
      custom: neutrals,
    }
  } catch {
    // private-mode storage, corrupt json — either way, ship the default
    return DEFAULT_THEME
  }
}

export function saveTheme(state: ThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage disabled or full; the theme just won't outlive the session
  }
}
