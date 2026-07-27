import { Suspense, lazy, useRef, useState } from 'react'
import type { PaletteVersion } from '@/lib/palette'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { ThemeMenu } from './ThemeMenu'

// The report is the only surface that scores palettes on the main thread, so
// it owns the categorycolors import (and its ~470 kB saliency dataset). Split
// out, that weight loads when the tab is first opened rather than at boot.
const ReportView = lazy(() => import('./ReportView').then((m) => ({ default: m.ReportView })))

const tabClass =
  'flex h-[30px] items-center rounded-md px-3 text-[13px] font-medium text-ink/40 ' +
  'transition-colors hover:text-ink/70 data-active:bg-ink/5 data-active:text-ink/95 ' +
  'focus-visible:outline-2 focus-visible:outline-ink/50'

const TABS = [
  { value: 'preview', label: 'Preview' },
  { value: 'report', label: 'Report' },
] as const

export function MainTabs({ version }: { version: PaletteVersion | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('preview')
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
        <p className="text-lg font-medium tracking-[-0.01em] text-ink">Category colors</p>
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
              <ReportView version={version} />
            </Suspense>
          )}
        </div>
      )}
    </>
  )
}
