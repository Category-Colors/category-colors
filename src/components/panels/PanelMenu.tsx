import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { popoverMotion } from '@/components/dialkit'
import { useDismiss, useWarmHover } from '@/components/dialkit/use-dropdown'
import { getDialKitPortalRoot } from '@/components/dialkit/dropdown-position'
import { EllipsisIcon } from './icons'

// .preset-menu's width, which the flyout borrows
const FLYOUT_WIDTH = 216

interface Action {
  label: string
  onClick: () => void
}

// An item with `flyout` opens a child menu of those rows beside it on hover
// (or on click, for touch); a click on any of them closes the whole menu. The
// flyout is portaled to the panel's dock, which sits outside the panel's
// clipping, so it can hang past the panel's edge.
type FlyoutItem = { label: string; flyout: ReactNode }
export type MenuItem = Action | FlyoutItem

// "…" overflow menu with DialKit dropdown chrome, anchored to its trigger.
export function PanelMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  // the open child menu by label, read from the current items so its rows
  // see current props, and where it goes in its portal root
  const [child, setChild] = useState<{
    label: string
    root: HTMLElement
    pos: { top: number; left: number; maxHeight: number }
  } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const childRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setChild(null)
  }, [])
  useDismiss(open, close, [ref, childRef])
  const warmRef = useWarmHover()
  const warmChildRef = useWarmHover(childRef)

  const action = (item: Action, onMouseEnter?: () => void) => (
    <button
      key={item.label}
      className="dialkit-select-option"
      data-selected="false"
      onMouseEnter={onMouseEnter}
      onClick={() => {
        close()
        item.onClick()
      }}
    >
      {item.label}
    </button>
  )

  return (
    <div ref={ref} className="panel-menu">
      <button
        className="color-row-icon"
        data-active={String(open)}
        aria-label="More actions"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <EllipsisIcon />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={warmRef}
            className="dialkit-select-dropdown panel-menu-dropdown"
            {...popoverMotion()}
          >
            {items.map((item) => {
              if (!('flyout' in item)) return action(item, () => setChild(null))
              const show = (e: React.MouseEvent<HTMLButtonElement>) => {
                const root = getDialKitPortalRoot(e.currentTarget) ?? document.body
                const rootRect = root.getBoundingClientRect()
                const row = e.currentTarget.getBoundingClientRect()
                const menu = e.currentTarget.parentElement!.getBoundingClientRect()
                // 5px up for the flyout's border and padding, so its first
                // row sits level with this one. Without room on the right (a
                // phone sheet) it covers the menu instead of leaving the screen.
                // At least 200px tall, lifted off the bottom edge to fit
                const maxHeight = Math.max(200, window.innerHeight - row.top - 3)
                const top = Math.min(row.top - 5, window.innerHeight - 8 - maxHeight)
                const left = Math.min(menu.right + 4, window.innerWidth - FLYOUT_WIDTH - 8)
                setChild({
                  label: item.label,
                  root,
                  pos: { top: top - rootRect.top, left: left - rootRect.left, maxHeight },
                })
              }
              return (
                <button
                  key={item.label}
                  className="dialkit-select-option panel-menu-parent"
                  data-selected="false"
                  data-open={String(child?.label === item.label)}
                  aria-haspopup="menu"
                  aria-expanded={child?.label === item.label}
                  onMouseEnter={show}
                  onClick={show}
                >
                  {item.label}
                  <span aria-hidden>›</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {child &&
        createPortal(
          <motion.div
            ref={warmChildRef}
            className="dialkit-select-dropdown preset-menu"
            style={{ position: 'absolute', ...child.pos }}
            {...popoverMotion()}
            // after the row's own handler: a pick closes the whole menu, a
            // click on the padding between rows doesn't
            onClick={(e) => (e.target as Element).closest('button') && close()}
          >
            {items.find((item): item is FlyoutItem => 'flyout' in item && item.label === child.label)?.flyout}
          </motion.div>,
          child.root
        )}
    </div>
  )
}
