import { Component, Suspense, lazy, useState, type ReactNode } from 'react'
import type { PaletteVersion } from '@/lib/palette'
import type { JndReport } from '@/lib/report'

export class ReportBoundary extends Component<{ children: ReactNode; onRetry: () => void; onReload: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <div role="alert" className="rounded-lg bg-panel p-5 text-[14px] text-ink">
      <p>The report couldn’t be opened. Your palette is safe, and you can still edit or export it.</p>
      <button className="mt-3 underline" onClick={this.props.onRetry}>Retry report</button>
      <p className="mt-3">If retry still fails, load the latest app version. Your session will be saved first.</p>
      <button className="mt-2 underline" onClick={this.props.onReload}>Reload latest version</button>
    </div>
  }
}

const loadReport = () => lazy(() => import('./ReportView').then((m) => ({ default: m.ReportView })))

export function ResilientReport({ version, report, onReload }: { version: PaletteVersion; report: JndReport | null; onReload: () => void }) {
  // A fresh lazy wrapper on retry does not reuse React.lazy's rejected promise.
  const [attempt, setAttempt] = useState(() => ({ id: 0, View: loadReport() }))
  const View = attempt.View
  return <ReportBoundary key={attempt.id} onReload={onReload} onRetry={() => setAttempt((a) => ({ id: a.id + 1, View: loadReport() }))}>
    <Suspense fallback={<p role="status" className="pt-6 text-[13px] text-ink/75">Loading the report…</p>}>
      <View version={version} report={report} />
    </Suspense>
  </ReportBoundary>
}
