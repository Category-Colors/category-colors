import type { ReactNode } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import { SPRING } from '@/components/dialkit'

// A list row that shows and hides like folder content — height + fade behind
// a clip mask (extended sideways so gutter handles aren't cropped). Render as
// a keyed child of the list's AnimatePresence.
export function ListRow({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={SPRING.expand}
      style={{ clipPath: 'inset(0 -20px)' }}
    >
      {children}
    </motion.div>
  )
}

// Placeholder slot standing in for a list's rows while it's empty; sharing
// the row choreography makes the swap with a first/last row one motion.
// `actions` renders ghost add buttons below the text for the initial add.
export function ListEmptyState({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <ListRow>
      <div className="list-empty">
        <span className="list-empty-text">{children}</span>
        {actions}
      </div>
    </ListRow>
  )
}

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="9" cy="5" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="9" cy="19" r="1.6" />
      <circle cx="15" cy="5" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="15" cy="19" r="1.6" />
    </svg>
  )
}

function ReorderItem<T>({ item, children }: { item: T; children: ReactNode }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      as="div"
      className="reorder-row"
      value={item}
      dragListener={false}
      dragControls={controls}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={SPRING.expand}
      style={{ clipPath: 'inset(0 -20px)' }}
    >
      <button
        className="drag-handle"
        aria-label="Drag to reorder"
        onPointerDown={(e) => {
          e.preventDefault()
          controls.start(e)
        }}
      >
        <GripIcon />
      </button>
      {children}
    </Reorder.Item>
  )
}

// Vertical drag-to-reorder list; each row gets a grip handle floating in the
// panel's left padding gutter, shown on row hover. Rows show/hide like folder
// content — height + fade behind a clip mask — so the list and everything
// below it flows with the change; no container animation needed.
export function ReorderList<T extends { id: number }>({
  items,
  onReorder,
  className,
  empty,
  emptyActions,
  generation = 0,
  children,
}: {
  items: T[]
  onReorder: (items: T[]) => void
  className?: string
  empty?: ReactNode
  emptyActions?: ReactNode
  /**
   * Bump when the list is replaced wholesale (a preset swap) rather than
   * edited. Otherwise the outgoing rows collapse underneath the incoming ones
   * — the new rows are laid out below the old block and ride upward as it
   * shrinks, so a new palette looks like it grew out of the middle of the
   * list. Remounting retires the old rows in one frame and lets the new ones
   * unfurl downward from the top.
   */
  generation?: number
  children: (item: T, index: number) => ReactNode
}) {
  return (
    <Reorder.Group
      key={generation}
      as="div"
      axis="y"
      values={items}
      onReorder={onReorder}
      className={className}
    >
      {/* `initial` stays off for the first mount so the boot palette doesn't
          animate in, and turns on for replacements so they do */}
      <AnimatePresence initial={generation > 0}>
        {items.length === 0 && empty != null && (
          <ListEmptyState key="empty" actions={emptyActions}>
            {empty}
          </ListEmptyState>
        )}
        {items.map((item, index) => (
          <ReorderItem key={item.id} item={item}>
            {children(item, index)}
          </ReorderItem>
        ))}
      </AnimatePresence>
    </Reorder.Group>
  )
}
