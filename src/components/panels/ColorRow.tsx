import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'
import { useAnchoredPortal, useDismiss } from '@/components/dialkit/use-dropdown'
import { parseCssColor, valueToCss, type ColorValue } from '@/lib/color'
import { ColorPicker } from './ColorPicker'
import { CheckIcon, CopyIcon, LockIcon, PinIcon, XIcon } from './icons'

const PICKER_HEIGHT = 280

// One color row: swatch + value opens the picker popover below; fixed/pinned
// states are icon toggles. Every affordance renders only when its handler is
// provided — without onValueChange the row is read-only (selectable value,
// no picker), without onRemove there's no ×.
export function ColorRow({
  value,
  onValueChange,
  onRemove,
  onCopy,
  fixedColor,
  onFixedColorChange,
  fixedOrder,
  onFixedOrderChange,
  defaultPickerOpen = false,
}: {
  value: ColorValue
  onValueChange?: (value: ColorValue) => void
  onRemove?: () => void
  onCopy?: () => boolean | Promise<boolean>
  fixedColor?: boolean
  onFixedColorChange?: (fixed: boolean) => void
  fixedOrder?: boolean
  onFixedOrderChange?: (fixed: boolean) => void
  defaultPickerOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultPickerOpen)
  const [draft, setDraft] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const { portalTarget, pos } = useAnchoredPortal(open, rowRef, {
    dropdownHeight: PICKER_HEIGHT,
  })
  // pointerdown, not mousedown: compatibility events can retarget during the
  // rapid pointer-capture cycles a picker drag produces
  useDismiss(open, useCallback(() => setOpen(false), []), [rowRef, popRef], {
    event: 'pointerdown',
  })

  useEffect(() => () => clearTimeout(copiedTimer.current ?? undefined), [])

  return (
    <div ref={rowRef} className="color-row">
      <div
        className="color-row-chip"
        data-open={String(open)}
        title={onValueChange ? 'Edit color' : undefined}
        onClick={() => {
          if (onValueChange && !open) setOpen(true)
          inputRef.current?.focus()
        }}
      >
        <span className="color-row-swatch" style={{ backgroundColor: valueToCss(value) }} />
        <input
          ref={inputRef}
          className="color-row-input"
          value={draft ?? valueToCss(value)}
          readOnly={!onValueChange}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) {
              const next = parseCssColor(draft)
              if (next) onValueChange?.(next)
            }
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'Escape' && draft !== null) {
              e.stopPropagation() // cancel the edit without closing the popover
              setDraft(null)
            }
          }}
          spellCheck={false}
        />
      </div>
      <div className="color-row-actions">
        {onFixedColorChange && (
          <button
            className="color-row-icon"
            data-active={String(!!fixedColor)}
            aria-label={fixedColor ? 'Unfix value' : 'Fix value'}
            onClick={() => onFixedColorChange(!fixedColor)}
          >
            <LockIcon />
          </button>
        )}
        {onFixedOrderChange && (
          <button
            className="color-row-icon"
            data-active={String(!!fixedOrder)}
            aria-label={fixedOrder ? 'Unfix order' : 'Fix order'}
            onClick={() => onFixedOrderChange(!fixedOrder)}
          >
            <PinIcon />
          </button>
        )}
        {onCopy && (
          <button
            className="color-row-icon"
            data-active={String(copied)}
            aria-label="Copy value"
            onClick={async () => {
              const success = await onCopy()
              if (!success) return
              setCopied(true)
              if (copiedTimer.current) clearTimeout(copiedTimer.current)
              copiedTimer.current = setTimeout(() => setCopied(false), 1000)
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
        {onRemove && (
          <button className="color-row-icon" aria-label="Remove" onClick={onRemove}>
            <XIcon />
          </button>
        )}
      </div>
      {portalTarget &&
        onValueChange &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={popRef}
                className="color-picker-popover"
                initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.97 }}
                transition={SPRING.pop}
                style={{
                  position: 'absolute',
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  transformOrigin: pos.above ? 'bottom' : 'top',
                }}
              >
                <ColorPicker value={value} onChange={onValueChange} />
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  )
}
