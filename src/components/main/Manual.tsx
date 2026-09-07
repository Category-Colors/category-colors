import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import type { ManualEntry } from '@/lib/manual'
import { useWindowEscape, useWindowFocusReturn } from '@/lib/use-window-escape'
import { ScrollOverlay } from '@/components/ScrollOverlay'
import { BookIcon, XIcon } from '@/components/panels/icons'
import { windowMotion } from '@/components/dialkit'

// ⌘? is ⌘⇧/ on a US layout, so the chord arrives as either '?' or '/' depending
// on whether shift was held. Both open it, which also gives the ⌘/ that most
// apps use for help. Ctrl elsewhere.
const SHORTCUT = navigator.userAgent.includes('Mac') ? '⌘?' : 'Ctrl+?'

const matches = (entry: ManualEntry, query: string) =>
  `${entry.term} ${entry.where ?? ''} ${entry.body}`.toLowerCase().includes(query)

/**
 * The glossary window.
 *
 * A draggable, non-modal window rather than a native modal dialog, matching the
 * About window: same title bar, same close, same absence of a scrim. The manual
 * is a reference — something to leave open beside the panel you are reading it
 * about — and a modal made that impossible, holding the page inert behind a
 * dimmed backdrop while you looked up what a term meant.
 *
 * What `showModal()` was providing and this now arranges by hand: Escape comes
 * from useWindowEscape, focus is placed on the search field and handed back on
 * close, and the top layer becomes .window-layer's z-index. Nothing replaces the
 * focus trap or the inert page — both are the point of a non-modal window.
 */
function ManualWindow({ onClose }: { onClose: () => void }) {
  const [manual, setManual] = useState<typeof import('@/lib/manual').MANUAL | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoadError(false)
    import('@/lib/manual').then((m) => { if (active) setManual(m.MANUAL) }, () => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [attempt])
  const layerRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const [query, setQuery] = useState('')

  useWindowEscape(windowRef, onClose)
  useWindowFocusReturn(windowRef)

  // showModal() used to place focus for us. The search field, not the window:
  // the manual is opened to look something up.
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const q = query.trim().toLowerCase()
  const sections = q
    ? (manual ?? []).map((s) => ({ ...s, entries: s.entries.filter((e) => matches(e, q)) })).filter(
        (s) => s.entries.length > 0
      )
    : manual ?? []

  return createPortal(
    <motion.div ref={layerRef} className="window-layer">
      <motion.div
        ref={windowRef}
        className="manual-window window-surface"
        role="dialog"
        aria-labelledby="manual-title"
        {...windowMotion()}
        dragControls={dragControls}
        dragConstraints={layerRef}
      >
        <div
          className="window-bar"
          onPointerDown={(event) => {
            event.preventDefault()
            dragControls.start(event)
          }}
        >
          <span id="manual-title" className="window-title">
            Manual
          </span>
          <div className="window-bar-controls">
            {/* The chord that opened it, so the next visit doesn't need the
                button. Chrome, so it sits in the chrome. */}
            <kbd className="manual-kbd">{SHORTCUT}</kbd>
            <button
              type="button"
              className="window-close"
              aria-label="Close Manual window"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onClose}
            >
              <XIcon />
            </button>
          </div>
        </div>

        <div className="manual-head">
          {/* type=text, not search: WebKit and Blink give a search field its
              own Escape handling, which swallows the key before the window
              sees it and leaves the one universal way out working only on the
              second press */}
          <input
            ref={searchRef}
            className="manual-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // The list under the field is now a different list. Left where
              // it was, a scrolled reader types a query and lands in the
              // middle of its results with matches hidden above.
              if (bodyRef.current) bodyRef.current.scrollTop = 0
            }}
            placeholder="Search the manual"
            aria-label="Search the manual"
          />
        </div>

        <div className="manual-scroll">
          <div className="manual-body" ref={bodyRef}>
            {sections.map((section) => (
              <section key={section.title} className="manual-section">
                <h3 className="manual-section-title">{section.title}</h3>
                {/* A blurb orients a reader browsing the section; around the
                    two entries a search turned up it is just noise. */}
                {!q && <p className="manual-blurb">{section.blurb}</p>}
                <dl className="manual-list">
                  {section.entries.map((entry) => (
                    <div key={entry.term} className="manual-entry">
                      <dt>
                        {entry.term}
                        {entry.where && <span className="manual-where">{entry.where}</span>}
                      </dt>
                      <dd>{entry.body}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            {!manual && !loadError && <p role="status">Loading the manual…</p>}
            {loadError && <p role="alert">The manual couldn’t load. <button className="underline" onClick={() => setAttempt((a) => a + 1)}>Retry</button></p>}
            {manual && sections.length === 0 && (
              <p className="manual-nothing">Nothing in the manual matches “{query.trim()}”.</p>
            )}
          </div>
          {/* the same floating thumb the export preview uses, so an OS set to
              always-visible scrollbars can't reserve a gutter out of the text */}
          <ScrollOverlay scrollerRef={bodyRef} watch={q} />
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

/**
 * The manual's trigger, and the chord that opens it without one.
 *
 * The trigger travels with the window. The manual is one thing, and splitting
 * the button from it would mean lifting `open` to the app root to reunite them.
 *
 * Memoized because it takes no props and App re-renders on every frame of a
 * slider drag: without it, dragging a dial rebuilds this on the frame budget
 * the drag needs.
 */
export const Manual = memo(function Manual() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.repeat: held down, the chord would otherwise toggle the window for
      // as long as the key is held, replaying the entrance on every cycle.
      if (e.repeat || !(e.metaKey || e.ctrlKey) || (e.key !== '?' && e.key !== '/')) return
      e.preventDefault()
      // A shortcut that only opens is a shortcut you have to leave the
      // keyboard to undo.
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <>
      <button className="nav-trigger" onClick={() => setOpen(true)}>
        <BookIcon />
        <span className="nav-trigger-label">Manual</span>
      </button>
      {/* Remounted on each open, so a fresh visit gets an empty search field
          and an unscrolled list without having to clear them on the way out —
          which would swap the unfiltered list back in under the exit fade. */}
      <AnimatePresence>{open && <ManualWindow onClose={close} />}</AnimatePresence>
    </>
  )
})
