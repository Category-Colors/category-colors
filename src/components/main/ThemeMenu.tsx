import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'
import { SelectControl } from '@/components/dialkit'
import { useDismiss } from '@/components/dialkit/use-dropdown'
import { ColorRow } from '@/components/panels/ColorRow'
import { hexValue, parseCssColor, valueToCss, type ColorValue } from '@/lib/color'
import {
  CUSTOM,
  THEME_PRESETS,
  TOKEN_FIELDS,
  neutralsOf,
  useTheme,
  type ThemeMode,
  type ThemeNeutrals,
} from '@/lib/theme'

const PRESET_OPTIONS = [
  ...THEME_PRESETS.map((p) => ({ value: p.id, label: p.name })),
  { value: CUSTOM, label: 'Custom…' },
]

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

// The tokens are stored as css colour strings; the row editor speaks
// ColorValue, so translate at the boundary rather than changing either.
const toValue = (css: string): ColorValue => parseCssColor(css) ?? hexValue(css)

export function ThemeMenu() {
  const { state, setState, tokens } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, useCallback(() => setOpen(false), []), [ref])

  const isCustom = state.preset === CUSTOM
  const blurb = THEME_PRESETS.find((p) => p.id === state.preset)?.blurb

  const pickPreset = (preset: string) =>
    setState(
      preset === CUSTOM
        ? // seed the editor from whatever is on screen, so "Custom…" starts
          // as the theme you were already looking at
          { ...state, preset, custom: neutralsOf(tokens) }
        : { ...state, preset }
    )

  const setToken = (key: keyof ThemeNeutrals, value: ColorValue) =>
    setState({ ...state, custom: { ...state.custom, [key]: valueToCss(value) } })

  return (
    <div ref={ref} className="theme-menu dialkit-root">
      {/* no aria-label: the visible text is already the accessible name, and
          a redundant one only earns the button a tooltip it doesn't need */}
      <button
        className="theme-trigger"
        data-open={String(open)}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Theme
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-popover popover-surface"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING.pop}
          >
            <SelectControl
              label="Preset"
              value={state.preset}
              options={PRESET_OPTIONS}
              onChange={pickPreset}
            />
            {/* a custom theme is a single set of colours, not a pair — there
                is no other mode to switch to */}
            <SelectControl
              label="Mode"
              value={state.mode}
              options={MODE_OPTIONS}
              disabled={isCustom}
              onChange={(mode) => setState({ ...state, mode: mode as ThemeMode })}
            />
            {isCustom ? (
              <div className="theme-tokens">
                {TOKEN_FIELDS.map((field) => (
                  <label key={field.key} className="theme-token">
                    <span>{field.label}</span>
                    <ColorRow
                      value={toValue(state.custom[field.key])}
                      onValueChange={(v) => setToken(field.key, v)}
                    />
                  </label>
                ))}
              </div>
            ) : (
              blurb && <p className="theme-blurb">{blurb}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
