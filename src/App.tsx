import { useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import {
  DEFAULT_PARAMS,
  PRESET_PALETTE,
  type PaletteParams,
  type PaletteVersion,
} from '@/lib/palette'
import { generatePaletteAsync } from '@/lib/generate'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MainTabs } from '@/components/main/MainTabs'
import { TooltipLayer } from '@/components/TooltipLayer'
import { ParametersPanel } from '@/components/panels/ParametersPanel'
import { HistoryPanel } from '@/components/panels/HistoryPanel'

export default function App() {
  const [params, setParams] = useState<PaletteParams>(DEFAULT_PARAMS)
  // Boot with the precomputed preset instead of annealing on load
  const [versions, setVersions] = useState<PaletteVersion[]>(() => [
    { id: 1, params: DEFAULT_PARAMS, ...PRESET_PALETTE, createdAt: Date.now() },
  ])
  const [currentId, setCurrentId] = useState<number | null>(1)
  const [busy, setBusy] = useState(false)
  const [panelMinimized, setPanelMinimized] = useState(false)
  const [rightMinimized, setRightMinimized] = useState(false)
  const nextId = useRef(2)
  const paramsRef = useRef(params)
  paramsRef.current = params

  const generate = () => {
    setBusy(true)
    const snapshot = paramsRef.current
    // annealing runs in a web worker, so the UI stays live throughout
    generatePaletteAsync(snapshot)
      .then((result) => {
        const version: PaletteVersion = {
          id: nextId.current++,
          params: snapshot,
          ...result,
          createdAt: Date.now(),
        }
        setVersions((prev) => [...prev, version])
        setCurrentId(version.id)
      })
      .catch((err) => {
        console.error('Palette generation failed:', err)
        alert('Palette generation failed — see the console for details.')
      })
      .finally(() => setBusy(false))
  }

  const current = versions.find((v) => v.id === currentId) ?? null

  const restore = (version: PaletteVersion) => {
    setParams(version.params)
    setCurrentId(version.id)
  }

  // Hand edits from the Output panel rewrite the current version's colors;
  // preview, report, and stats all derive from them and follow along. With
  // no current version (cleared history), the first edit starts one.
  const updateColors = (colors: string[]) => {
    if (currentId === null) {
      addPalette(colors)
      return
    }
    setVersions((prev) => prev.map((v) => (v.id === currentId ? { ...v, colors } : v)))
  }

  const clearVersions = () => {
    setVersions([])
    setCurrentId(null)
  }

  // Deleting the current version falls back to the newest remaining one;
  // panel params stay as they are (only an explicit restore changes them)
  const deleteVersion = (id: number) => {
    const next = versions.filter((v) => v.id !== id)
    setVersions(next)
    if (id === currentId) setCurrentId(next.length ? next[next.length - 1].id : null)
  }

  // Wholesale palette loads (presets, imports) become their own history
  // entries; empty costHistory marks that the optimizer never ran
  const addPalette = (colors: string[]) => {
    const version: PaletteVersion = {
      id: nextId.current++,
      params: paramsRef.current,
      colors,
      cost: 0,
      iterations: 0,
      costHistory: [],
      createdAt: Date.now(),
    }
    setVersions((prev) => [...prev, version])
    setCurrentId(version.id)
  }

  return (
    <ThemeProvider>
    <MotionConfig reducedMotion="user">
    <div className="app">
      <ParametersPanel
        params={params}
        onParamsChange={setParams}
        onGenerate={generate}
        busy={busy}
        minimized={panelMinimized}
        onMinimizedChange={setPanelMinimized}
      />
      <main
        className={`app-main${panelMinimized ? ' app-main-left-min' : ''}${
          rightMinimized ? ' app-main-right-min' : ''
        }`}
      >
        <MainTabs version={current} />
      </main>
      <HistoryPanel
        versions={versions}
        currentId={currentId}
        onRestore={restore}
        onColorsChange={updateColors}
        onPaletteReplace={addPalette}
        onDeleteVersion={deleteVersion}
        onClearVersions={clearVersions}
        minimized={rightMinimized}
        onMinimizedChange={setRightMinimized}
      />
      <TooltipLayer />
    </div>
    </MotionConfig>
    </ThemeProvider>
  )
}
