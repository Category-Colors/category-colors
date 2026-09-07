import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MANUAL, type ManualEntry } from '@/lib/manual'
import { ScrollOverlay } from '@/components/ScrollOverlay'
import { BookIcon, XIcon } from '@/components/panels/icons'

// ⌘? is ⌘⇧/ on a US layout, so the chord arrives as either '?' or '/' depending
// on whether shift was held. Both open it, which also gives the ⌘/ that most
// apps use for help. Ctrl elsewhere.
const MAC = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
const SHORTCUT = MAC ? '⌘?' : 'Ctrl+?'

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
 */
export function Manual() {
  const ref = useRef<HTMLDialogElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')

  const open = useCallback(() => {
    setQuery('')
    ref.current?.showModal()
    // showModal() moves focus to the element carrying the `autofocus`
    // attribute, which React sets by calling focus() at mount instead — and at
    // mount this dialog isn't open. Without this the close button takes it.
    searchRef.current?.focus()
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || (e.key !== '?' && e.key !== '/')) return
      e.preventDefault()
      // A shortcut that only opens is a shortcut you have to leave the
      // keyboard to undo.
      if (ref.current?.open) ref.current.close()
      else open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const q = query.trim().toLowerCase()
  // Blurbs orient a reader browsing the section; while filtering they are
  // noise around the two entries that matched, so only the entries survive.
  const sections = q
    ? MANUAL.map((s) => ({ ...s, blurb: '', entries: s.entries.filter((e) => matches(e, q)) })).filter(
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
          className="manual"
          aria-labelledby="manual-title"
          // The backdrop is not a child, so its clicks are dispatched to the
          // dialog itself; anything inside targets that instead.
          onClick={(e) => {
            if (e.target === ref.current) ref.current.close()
          }}
          onClose={() => setQuery('')}
        >
          <div className="manual-head">
            <div className="manual-title-row">
              <h2 id="manual-title" className="manual-title">
                Manual
              </h2>
              <kbd className="manual-kbd">{SHORTCUT}</kbd>
              <button className="manual-close" onClick={() => ref.current?.close()}>
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
                  {section.blurb && <p className="manual-blurb">{section.blurb}</p>}
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
}
