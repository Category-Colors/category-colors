import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'
import { useDismiss, useWarmHover } from '@/components/dialkit/use-dropdown'
import { EllipsisIcon } from './icons'

// "…" overflow menu with DialKit dropdown chrome, anchored to its trigger.
export function PanelMenu({ items }: { items: { label: string; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(open, useCallback(() => setOpen(false), []), [ref])
  const warmRef = useWarmHover()

  return (
    <div ref={ref} className="panel-menu">
      <button
        className="color-row-icon"
        data-active={String(open)}
        aria-label="More actions"
        onClick={() => setOpen(!open)}
      >
        <EllipsisIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={warmRef}
            className="dialkit-select-dropdown panel-menu-dropdown"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={SPRING.pop}
          >
            {items.map((item) => (
              <button
                key={item.label}
                className="dialkit-select-option"
                data-selected="false"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
