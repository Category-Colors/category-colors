import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'
import { ICON_CHEVRON } from '@/components/dialkit/icons'
import { useDismiss, useWarmHover } from '@/components/dialkit/use-dropdown'

// Compact color-space select reusing the DialKit dropdown chrome. Positioned
// inline rather than portaled, so clicks stay inside whatever popover or card
// encloses it — both current hosts (the color picker, the 3D map) sit inside
// something that dismisses on an outside press.
export function SpaceSelect<T extends string>({
  value,
  options,
  onChange,
  className,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  /** placement modifier on the wrapper */
  className?: string
  /** accessible name, since the trigger only shows the current space */
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // no Escape handling: an enclosing popover owns that key, and closing both
  // at once would be a surprise
  useDismiss(open, useCallback(() => setOpen(false), []), [ref], {
    event: 'pointerdown',
    escape: false,
  })
  const warmRef = useWarmHover()

  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`picker-space ${className ?? ''}`}>
      <button
        className="picker-space-trigger"
        data-open={String(open)}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        {current?.label ?? value.toUpperCase()}
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING.glyph}
        >
          <path d={ICON_CHEVRON} />
        </motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={warmRef}
            className="dialkit-select-dropdown picker-space-dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING.pop}
          >
            {options.map((option) => (
              <button
                key={option.value}
                className="dialkit-select-option"
                data-selected={String(option.value === value)}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
