import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'
import { useAnchoredPortal, useDismiss, useWarmHover } from '@/components/dialkit/use-dropdown'
import { CVD_OPTIONS, TYPE_OPTIONS } from '@/lib/evaluators'
import type { CvdType, EvaluatorType } from '@/lib/palette'
import { PlusIcon } from './icons'

const BASE_OPTIONS = TYPE_OPTIONS.filter((o) => o.value !== 'cvd')

// DialKit-styled button that opens a type list; picking a type creates the
// evaluator (same dropdown chrome as SelectControl, button-shaped trigger).
// CVD evaluators are listed individually under their own group heading.
// `ghost` renders a small text button for empty-state slots; the dropdown
// then anchors to the surrounding slot so it keeps a usable width.
export function AddEvaluatorMenu({
  onAdd,
  ghost = false,
}: {
  onAdd: (type: EvaluatorType, cvd?: CvdType) => void
  ghost?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { portalTarget, pos } = useAnchoredPortal(isOpen, triggerRef, {
    // 8px padding + 32px per option + the CVD group heading
    dropdownHeight: 8 + (BASE_OPTIONS.length + CVD_OPTIONS.length) * 32 + 24,
    // a ghost trigger is a small text button inside an empty-state slot;
    // measuring the slot keeps the dropdown a usable width
    anchor: () =>
      ghost ? (triggerRef.current?.closest('.list-empty') as HTMLElement | null) : null,
  })
  useDismiss(isOpen, useCallback(() => setIsOpen(false), []), [triggerRef, dropdownRef])
  const warmRef = useWarmHover(dropdownRef)

  return (
    <div className={ghost ? undefined : 'dialkit-button-group'}>
      <button
        ref={triggerRef}
        className={ghost ? 'ghost-button' : 'dialkit-button'}
        onClick={() => setIsOpen(!isOpen)}
        data-open={String(isOpen)}
      >
        {ghost && <PlusIcon />}
        Add evaluator
      </button>
      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {isOpen && pos && (
              <motion.div
                ref={warmRef}
                className="dialkit-select-dropdown"
                initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.95 }}
                transition={SPRING.pop}
                style={{
                  position: 'absolute',
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  transformOrigin: pos.above ? 'bottom' : 'top',
                }}
              >
                {BASE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className="dialkit-select-option"
                    data-selected="false"
                    onClick={() => {
                      onAdd(option.value)
                      setIsOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
                <div className="menu-group-heading">Color vision deficiency</div>
                {CVD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className="dialkit-select-option"
                    data-selected="false"
                    onClick={() => {
                      onAdd('cvd', option.value)
                      setIsOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  )
}
