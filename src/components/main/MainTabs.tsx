import { Suspense, lazy, useMemo, useRef, useState } from 'react'
import type { PaletteVersion } from '@/lib/palette'
import { buildJndReport } from '@/lib/report'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { ThemeMenu } from './ThemeMenu'

// The report's rendering stays split out — the map, the pair grid and the stats
// panel between them reach lib/algorithm, and with it category-colors' saliency
// lookup table, so that weight waits for the tab to be opened. The scoring
// itself lives here, because the tab badge has to know the issue count before
// you go there; lib/report imports the package's report subpath alone, so it
// brings no table with it.
const ReportView = lazy(() => import('./ReportView').then((m) => ({ default: m.ReportView })))

const tabClass =
  'flex h-[30px] items-center gap-1.5 rounded-[6px] px-3 text-[14px] font-medium text-ink/40 ' +
  'transition-colors hover:text-ink/70 data-active:bg-ink/5 data-active:text-ink/95 ' +
  'focus-visible:outline-2 focus-visible:outline-ink/50'

const TABS = [
  { value: 'preview', label: 'Preview' },
  { value: 'report', label: 'Report' },
] as const

export function MainTabs({ version }: { version: PaletteVersion | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('preview')
  // Scored once here and handed to the report, rather than each computing its
  // own: the badge needs the count on every palette change regardless of which
  // tab is showing.
  const report = useMemo(() => (version ? buildJndReport(version) : null), [version])
  const tabListRef = useRef<HTMLDivElement>(null)
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
          than on whatever the title and the theme button happen to measure */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
        <div className="flex items-center gap-1.5">
          {/* decorative: the wordmark beside it already names the app */}
          <span className="app-mark" aria-hidden="true" />
          {/* the mock's flat #999 as a rung on the ink ladder — /55 lands
              within 4/255 of it and inverts with the theme, which a fixed grey
              wouldn't */}
          <p className="text-[16px] font-medium tracking-[-0.01em] text-ink/55">Category colors</p>
        </div>
        <div
          ref={tabListRef}
          className="flex gap-1 rounded-[10px] p-1"
          role="tablist"
          aria-label="Main view"
          onKeyDown={selectAdjacentTab}
        >
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
                <span className="rounded-full bg-ink/10 px-2 py-0.5 font-normal tabular-nums text-[11px] text-ink/70">
                  {report.totalIssues}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <ThemeMenu />
        </div>
      </div>

      {/* keepMounted so returning to the preview doesn't refetch the weather */}
      <div
        id="panel-preview"
        role="tabpanel"
        aria-labelledby="tab-preview"
        hidden={tab !== 'preview'}
        className="pt-5 focus-visible:outline-none"
      >
        {version && <Dashboard colors={version.colors} />}
      </div>
      {tab === 'report' && (
        <div
          id="panel-report"
          role="tabpanel"
          aria-labelledby="tab-report"
          className="pt-5 focus-visible:outline-none"
        >
          {version && (
            <Suspense
              fallback={
                <p className="pt-6 tabular-nums text-[12px] text-ink/50">Loading the report…</p>
              }
            >
              <ReportView version={version} report={report} />
            </Suspense>
          )}
        </div>
      )}
    </>
  )
}
