import { testTitles } from '@/lib/report'
import type { JndReport } from '@/lib/report'
import type { PaletteVersion } from '@/lib/palette'
import { ColorSpaceMap } from './ColorSpaceMap'
import { PairGrid } from './PairGrid'
import { StatsPanel } from './StatsPanel'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-medium tracking-[-0.01em] text-ink">{children}</p>
}

// The report arrives already scored: MainTabs needs it for the tab badge on
// every palette change, so computing it again here would be the same work twice.
export function ReportView({
  version,
  report,
}: {
  version: PaletteVersion
  report: JndReport | null
}) {
  if (!report) {
    return (
      <p className="pt-6 tabular-nums text-[12px] text-ink/50">
        A report needs at least two colors in the palette.
      </p>
    )
  }

  const titles = testTitles(report.tests)

  return (
    // a query container, because the report's width is set by the side panels
    // (.app-main pads by --panel-width, and either panel can collapse) rather
    // than by the viewport — a viewport breakpoint reads a width this column
    // never has
    <div className="@container flex flex-col gap-5">
      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel>Pairs</SectionLabel>
          <div className="flex flex-wrap items-center gap-4">
            {report.tests.map((test, i) => (
              <span key={test.label} className="flex items-center gap-1.5">
                <span className="text-[11px] text-ink/45">{titles[i]}</span>
                <span
                  className={`rounded-full px-2 py-0.5 tabular-nums text-[11px] ${
                    test.issueCount === 0
                      ? 'bg-ink/[0.06] text-ink/55'
                      : 'bg-danger/10 text-danger/90'
                  }`}
                >
                  {test.issueCount}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-[10px] bg-ink/5 p-5">
          <PairGrid report={report} colors={version.colors} threshold={version.params.jnd} />
        </div>
      </section>

      {/* 680px = the map's 308 + the 20 gap + the stats card's 307 floor (its
          table's min-content plus padding), rounded up for headroom. Splitting
          any earlier hands the stats column less than its table can occupy and
          the card grows out past the pair grid. */}
      <div className="flex flex-col gap-5 @min-[680px]:flex-row">
        <section className="flex flex-col gap-2.5 @min-[680px]:w-[308px] @min-[680px]:shrink-0">
          <SectionLabel>Map</SectionLabel>
          <div className="relative aspect-square overflow-hidden rounded-[10px] bg-ink/5">
            <ColorSpaceMap
              colors={version.colors}
              defaultSpace={version.params.colorSpace.mode}
            />
          </div>
        </section>
        <section className="flex flex-1 flex-col gap-2.5">
          <SectionLabel>Statistics</SectionLabel>
          <StatsPanel version={version} />
        </section>
      </div>
    </div>
  )
}
