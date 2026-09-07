import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MANUAL, type ManualEntry } from '@/lib/manual'
import { ScrollOverlay } from '@/components/ScrollOverlay'
import { BookIcon, XIcon } from '@/components/panels/icons'

// ⌘? is ⌘⇧/ on a US layout, so the chord arrives as either '?' or '/' depending
// on whether shift was held. Both open it, which also gives the ⌘/ that most
// apps use for help. Ctrl elsewhere.
const SHORTCUT = navigator.userAgent.includes('Mac') ? '⌘?' : 'Ctrl+?'

const matches = (entry: ManualEntry, query: string) =>
  `${entry.term} ${entry.where ?? ''} ${entry.body}`.toLowerCase().includes(query)

/**
 * The glossary, as a native modal dialog.
 *
 * `<dialog>` rather than a hand-built overlay: showModal() gives the focus
 * trap, the inert page behind, Escape, and the top layer — which is also why
 * this portals to <body> rather than rendering in the nav row it is triggered
 * from. Nothing in the top layer cares about z-index, but a dialog inside
 * .app-nav would still be inheriting from a size container.
 *
 * The trigger travels with it. The manual is one thing, and splitting the
 * button from the dialog would mean lifting `open` to the app root to reunite
 * them.
 *
 * Memoized because it takes no props and App re-renders on every frame of a
 * slider drag: without it, dragging a dial rebuilds the whole closed glossary
 * — a few hundred elements — for nothing, on the frame budget the drag needs.
 */
export const Manual = memo(function Manual() {
  const ref = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const fromBackdrop = useRef(false)
  const [query, setQuery] = useState('')

  // Everything a fresh open resets lives here rather than on close: clearing
  // the filter as the dialog leaves would swap the unfiltered list back in
  // under the exit fade.
  const open = useCallback(() => {
    setQuery('')
    ref.current?.showModal()
    // showModal() moves focus to the element carrying the `autofocus`
    // attribute, which React sets by calling focus() at mount instead — and at
    // mount this dialog isn't open. Without this the close button takes it.
    searchRef.current?.focus()
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [])

  // Capture, so this sees the key before anything else does — which is what
  // lets the Escape branch below keep the modal's dismissal to itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A modal is the topmost layer by construction, so while it is open it
      // owns Escape outright: one press dismisses it and nothing else. The
      // dialog's own handling of the key is the UA's rather than a listener,
      // so taking the key here still closes the manual, while every other
      // Escape handler on the page — including any added later — is left
      // alone. Without it, a popover open behind the manual closes with it.
      //
      // stopImmediatePropagation, not stopPropagation: AboutDialog claims the
      // key the same way (a window capture listener, for the same reason),
      // and same-target listeners survive the plain version. Sharing a target
      // makes this a registration race, which the manual wins by mounting
      // with the app while About only listens once it opens — and losing it
      // was visible, since About calls preventDefault and so suppressed the
      // close request of the very dialog sitting on top of it.
      if (e.key === 'Escape') {
        if (ref.current?.open) e.stopImmediatePropagation()
        return
      }
      // e.repeat: held down, the chord would otherwise toggle the dialog for
      // as long as the key is held, replaying the entrance on every cycle.
      if (e.repeat || !(e.metaKey || e.ctrlKey) || (e.key !== '?' && e.key !== '/')) return
      e.preventDefault()
      // A shortcut that only opens is a shortcut you have to leave the
      // keyboard to undo.
      if (ref.current?.open) ref.current.close()
      else open()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  const q = query.trim().toLowerCase()
  const sections = q
    ? MANUAL.map((s) => ({ ...s, entries: s.entries.filter((e) => matches(e, q)) })).filter(
        (s) => s.entries.length > 0
      )
    : MANUAL

  return (
    <>
      <button className="nav-trigger" onClick={open}>
        <BookIcon />
        <span className="nav-trigger-label">Manual</span>
      </button>

      {createPortal(
        <dialog
          ref={ref}
          className="manual popover-surface"
          aria-labelledby="manual-title"
          // The backdrop is not a child, so its clicks are dispatched to the
          // dialog itself; anything inside targets that instead. Both ends of
          // the click have to land there: a definition selected by dragging
          // out past the dialog's edge releases on the backdrop, and the click
          // that synthesizes lands on the dialog — closing the manual out from
          // under the selection.
          onPointerDown={(e) => {
            fromBackdrop.current = e.target === ref.current
          }}
          onClick={(e) => {
            if (e.target === ref.current && fromBackdrop.current) ref.current.close()
          }}
        >
          <div className="manual-head">
            <div className="manual-title-row">
              <h2 id="manual-title" className="manual-title">
                Manual
              </h2>
              <kbd className="manual-kbd">{SHORTCUT}</kbd>
              <button
                className="color-row-icon manual-close"
                onClick={() => ref.current?.close()}
              >
                <XIcon />
                {/* the visible glyph is the label, so no aria-label: one would
                    earn this button a tooltip drawn under the top layer */}
                <span className="sr-only">Close</span>
              </button>
            </div>
            {/* type=text, not search: WebKit and Blink give a search field its
                own Escape handling, which swallows the key before the dialog
                sees it and leaves the one universal way out of a modal working
                only on the second press */}
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
              {sections.length === 0 && (
                <p className="manual-nothing">Nothing in the manual matches “{query.trim()}”.</p>
              )}
            </div>
            {/* the same floating thumb the export preview uses, so an OS set to
                always-visible scrollbars can't reserve a gutter out of the text */}
            <ScrollOverlay scrollerRef={bodyRef} watch={q} />
          </div>
        </dialog>,
        document.body
      )}
    </>
  )
})
