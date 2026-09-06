import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SegmentedControl, SelectControl, popoverMotion } from '@/components/dialkit'
import { useDismiss } from '@/components/dialkit/use-dropdown'
import { ColorRow } from '@/components/panels/ColorRow'
import { BrushIcon } from '@/components/panels/icons'
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
      {/* no aria-label: the text is the accessible name even once the nav
          row folds it away (index.css), and a redundant one only earns the
          button a tooltip it doesn't need */}
      <button
        className="theme-trigger"
        data-open={String(open)}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <BrushIcon />
        <span className="theme-trigger-label">Theme</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-popover popover-surface"
            {...popoverMotion()}
          >
            <SelectControl
              label="Preset"
              value={state.preset}
              options={PRESET_OPTIONS}
              onChange={pickPreset}
            />
            {/* a custom theme is a single set of colours, not a pair — there
                is no other mode to switch to */}
            <div
              className="dialkit-labeled-control dialkit-toggle-row"
              onClick={(e) => {
                if (isCustom || (e.target as HTMLElement).closest('.dialkit-segmented')) return
                setState({ ...state, mode: state.mode === 'dark' ? 'light' : 'dark' })
              }}
            >
              <span className="dialkit-labeled-control-label">Mode</span>
              <SegmentedControl
                options={MODE_OPTIONS}
                value={state.mode}
                disabled={isCustom}
                onChange={(mode) => setState({ ...state, mode: mode as ThemeMode })}
              />
            </div>
            {isCustom && (
              <div className="theme-tokens">
                {TOKEN_FIELDS.map((field) => (
                  <ColorRow
                    key={field.key}
                    label={field.label}
                    value={toValue(state.custom[field.key])}
                    onValueChange={(v) => setToken(field.key, v)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
