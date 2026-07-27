declare module 'categorycolors/src' {
  export interface PaletteConfig {
    colorCount: number
    jnd: number
    maxIterations: number
    coolingRate: number
    cutoff: number
    logProgress?: boolean
    [key: string]: unknown
  }

  export interface PaletteState {
    colors: unknown[]
    temperature: number
    iterations: number
    cost: number
    costHistory?: [number, number][]
  }

  export interface EvaluatorCost {
    weight: number
    cost: number
    weightedCost: number
  }

  export interface JndIssue {
    indexA: number
    indexB: number
    deltaE: number
    colors: [string, string]
  }

  export interface JndTest {
    label: string
    description: string
    pairs: JndIssue[]
    issues: JndIssue[]
    issueCount: number
  }

  export interface JndReport {
    totalIssues: number
    tests: JndTest[]
  }

  export interface JndReportOptions {
    distanceMethod?: string
    distanceSpace?: string
    jndThreshold?: number
    cvdSimulations?: { type: string; severity: number }[]
    paletteSpace?: string | null
  }

  const api: {
    core: {
      prepareInitialState(state: PaletteState, config: PaletteConfig): PaletteState
      runSimulatedAnnealing(state: PaletteState, config: PaletteConfig): PaletteState
      runWithOrderOptimization(state: PaletteState, config: PaletteConfig): PaletteState
      cost(state: PaletteState, config: PaletteConfig): number
      costBreakdown(state: PaletteState, config: PaletteConfig): EvaluatorCost[]
    }
    utils: {
      deltaE(
        colorA: unknown,
        colorB: unknown,
        options?: { method?: string; space?: string; cmc?: unknown }
      ): number
    }
    config: {
      createDefaultConfig(): PaletteConfig
      createDefaultState(): PaletteState
    }
    evaluators: Record<
      string,
      (state: PaletteState, config: PaletteConfig, descriptor?: object) => number
    >
    data: Record<string, unknown>
    reports: {
      reportJndIssues(palette: unknown[], options?: JndReportOptions): JndReport
    }
  }

  export default api
}
