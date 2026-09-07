import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PaletteParams, PaletteVersion } from '@/lib/palette'
import { buildJndReport } from '@/lib/report'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { PILL_TRANSITION } from '@/components/dialkit'
import { AboutDialog } from './AboutDialog'
import { ThemeMenu } from './ThemeMenu'
import { Manual } from './Manual'
import { EmptyState } from './EmptyState'
import { ResilientReport } from './ReportBoundary'

// The report's rendering stays split out — the map, the pair grid and the stats
// panel between them reach lib/algorithm, and with it category-colors' saliency
// lookup table, so that weight waits for the tab to be opened. The scoring
// itself lives here, because the tab badge has to know the issue count before
// you go there; lib/report imports the package's report subpath alone, so it
// brings no table with it.

// The active background is the sliding pill below, not a per-tab class, so
// switching tabs moves it the way a segmented control moves its own.
const tabClass =
  'relative flex h-[30px] items-center gap-1.5 rounded-[6px] px-3 text-[14px] font-medium ' +
  'text-ink/40 transition-colors hover:text-ink/70 data-active:text-ink/95 ' +
  'focus-visible:outline-2 focus-visible:outline-ink/50'

const TABS = [
  { value: 'preview', label: 'Preview' },
  { value: 'report', label: 'Report' },
] as const

export function MainTabs({
  version,
  busy,
  onGenerate,
  onPreset,
  onReload,
}: {
  version: PaletteVersion | null
  busy: boolean
  onGenerate: (params?: PaletteParams) => void
  onPreset: (colors: string[]) => void
  onReload: () => void
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('preview')
  const [aboutOpen, setAboutOpen] = useState(false)
  const closeAbout = useCallback(() => setAboutOpen(false), [])
  // Scored once here and handed to the report, rather than each computing its
  // own: the badge needs the count on every palette change regardless of which
  // tab is showing.
  const report = useMemo(() => (version ? buildJndReport(version) : null), [version])
  const tabListRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  // the report tab changes width when its badge appears or its count grows
  useLayoutEffect(() => {
    const active = tabListRef.current?.querySelector<HTMLElement>('[data-active]')
    if (active) setPill({ left: active.offsetLeft, width: active.offsetWidth })
  }, [tab, report?.totalIssues])
  const selectAdjacentTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = TABS.findIndex((item) => item.value === tab)
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const next = TABS[(index + offset + TABS.length) % TABS.length]
    setTab(next.value)
    requestAnimationFrame(() => {
      tabListRef.current
        ?.querySelector<HTMLButtonElement>(`[data-tab="${next.value}"]`)
        ?.focus()
    })
  }

  return (
    <>
      {/* three equal columns so the tab list is centred on the canvas rather
          than on whatever the title and the theme button happen to measure.
          --nav-row tall from the docks' top line puts its centre on the panel
          toggles', so the collapsed pucks sit in this row; the row height and
          the gap under it are set in index.css, where the scrim reads them */}
      <div className="app-nav grid grid-cols-[1fr_auto_1fr] items-center gap-5">
        <button
          type="button"
          className="app-brand"
          aria-haspopup="dialog"
          aria-expanded={aboutOpen}
          onClick={() => setAboutOpen(true)}
        >
          {/* decorative: the wordmark beside it already names the app */}
          <span className="app-mark" aria-hidden="true" />
          {/* the mock's flat #999 as a rung on the ink ladder — /55 lands
              within 4/255 of it and inverts with the theme, which a fixed grey
              wouldn't */}
          <p className="app-wordmark text-[16px] font-medium tracking-[-0.01em] text-ink/55">
            Category colors
          </p>
        </button>
        {/* Nothing to switch between until a palette exists. The theme button
            is placed in column 3 explicitly, so dropping this out of the middle
            leaves the row's ends where they were. */}
        {version && (
          <div
            ref={tabListRef}
            className="relative flex gap-1 rounded-[10px] p-1"
            role="tablist"
            aria-label="Main view"
            onKeyDown={selectAdjacentTab}
          >
            {pill && (
              <div
                className="pointer-events-none absolute inset-y-1 rounded-[6px] bg-ink/5"
                style={{
                  left: pill.left,
                  width: pill.width,
                  transition: PILL_TRANSITION,
                }}
              />
            )}
            {TABS.map((item) => (
              <button
                key={item.value}
                id={`tab-${item.value}`}
                data-tab={item.value}
                data-active={tab === item.value ? '' : undefined}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                aria-controls={`panel-${item.value}`}
                tabIndex={tab === item.value ? 0 : -1}
                className={tabClass}
                onClick={() => setTab(item.value)}
              >
                {item.label}
                {/* hidden at zero: a badge reading 0 announces a problem count
                    that isn't there, and the report says so itself */}
                {item.value === 'report' && !!report?.totalIssues && (
                  <span className="count-badge -mr-2 bg-ink/10 font-normal text-ink/70">
                    {report.totalIssues}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="col-start-3 flex justify-end">
          <Manual />
          <ThemeMenu />
        </div>
      </div>

      {!version && (
        <div className="empty-canvas">
          <EmptyState busy={busy} onGenerate={onGenerate} onPreset={onPreset} />
        </div>
      )}
      {/* keepMounted so returning to the preview doesn't refetch the weather */}
      {version && (
        <div
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          hidden={tab !== 'preview'}
          className="pt-1 focus-visible:outline-none"
        >
          <Dashboard colors={version.colors} />
        </div>
      )}
      {version && tab === 'report' && (
        <div
          id="panel-report"
          role="tabpanel"
          aria-labelledby="tab-report"
          className="pt-1 focus-visible:outline-none"
        >
          <ResilientReport version={version} report={report} onReload={onReload} />
        </div>
      )}
      <AboutDialog open={aboutOpen} onClose={closeAbout} />
    </>
  )
}
