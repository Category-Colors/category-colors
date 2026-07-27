import { Suspense, lazy } from 'react'
import { Tabs } from '@base-ui/react/tabs'
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

export function MainTabs({ version }: { version: PaletteVersion | null }) {
  return (
    <Tabs.Root defaultValue="preview">
      {/* three equal columns so the tab list is centred on the canvas rather
          than on whatever the title and the theme button happen to measure */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-5">
        <p className="text-lg font-medium tracking-[-0.01em] text-ink">Category colors</p>
        <Tabs.List className="flex gap-1 rounded-[10px] p-1">
          <Tabs.Tab value="preview" className={tabClass}>
            Preview
          </Tabs.Tab>
          <Tabs.Tab value="report" className={tabClass}>
            Report
          </Tabs.Tab>
        </Tabs.List>
        <div className="flex justify-end">
          <ThemeMenu />
        </div>
      </div>

      {/* keepMounted so returning to the preview doesn't refetch the weather */}
      <Tabs.Panel value="preview" keepMounted className="pt-5 focus-visible:outline-none">
        {version && <Dashboard colors={version.colors} />}
      </Tabs.Panel>
      <Tabs.Panel value="report" className="pt-5 focus-visible:outline-none">
        {version && (
          <Suspense
            fallback={
              <p className="pt-6 tabular-nums text-[12px] text-ink/50">Loading the report…</p>
            }
          >
            <ReportView version={version} />
          </Suspense>
        )}
      </Tabs.Panel>
    </Tabs.Root>
  )
}
