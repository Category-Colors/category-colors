import { useMemo } from 'react'
import { buildJndReport, testTitles } from '@/lib/report'
import type { PaletteVersion } from '@/lib/palette'
import { ColorSpaceMap } from './ColorSpaceMap'
import { PairGrid } from './PairGrid'
import { StatsPanel } from './StatsPanel'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-medium tracking-[-0.01em] text-ink">{children}</p>
}

export function ReportView({ version }: { version: PaletteVersion }) {
  const report = useMemo(() => buildJndReport(version), [version])

  if (!report) {
    return (
      <p className="pt-6 tabular-nums text-[12px] text-ink/50">
        A report needs at least two colors in the palette.
      </p>
    )
  }

  const titles = testTitles(report.tests)

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
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
        <PairGrid report={report} colors={version.colors} threshold={version.params.jnd} />
      </section>

      <div className="flex flex-col gap-5 xl:flex-row">
        <section className="flex flex-col gap-2.5 xl:w-[308px] xl:shrink-0">
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
