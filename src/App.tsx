import { useEffect, useRef, useState } from 'react'
import { MotionConfig, motion, useMotionValue, useTransform } from 'motion/react'
import type { MotionStyle } from 'motion/react'
import {
  DEFAULT_PARAMS,
  type PaletteParams,
  type PaletteVersion,
} from '@/lib/palette'
import { generatePaletteAsync } from '@/lib/generate'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MainTabs } from '@/components/main/MainTabs'
import { TooltipLayer } from '@/components/TooltipLayer'
import { ParametersPanel } from '@/components/panels/ParametersPanel'
import { HistoryPanel } from '@/components/panels/HistoryPanel'
import { PANEL_WIDTH, PUCK_SIZE } from '@/components/panels/MorphPanel'
import { MobileBar, type MobileSheet } from '@/components/mobile/MobileBar'
import { DOCKED, useIsPhone } from '@/lib/use-media'

// Below this the panels float over the canvas instead of the canvas
// reserving a column for them (index.css). Floating panels would cover what
// they float over, so at those widths both start collapsed.
const panelsFloat = () => !matchMedia(DOCKED).matches

export default function App() {
  const [params, setParams] = useState<PaletteParams>(DEFAULT_PARAMS)
  // Boots empty: the canvas explains the app until the first palette exists
  const [versions, setVersions] = useState<PaletteVersion[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  // A phone gets bottom sheets instead of docked panels, and only one at a
  // time: two sheets would stack on the same screen edge, and the one
  // underneath would be unreachable without dismissing the other.
  const phone = useIsPhone()
  const [sheet, setSheet] = useState<MobileSheet | null>(null)
  const [leftOpen, setLeftOpen] = useState(() => !panelsFloat())
  const [rightOpen, setRightOpen] = useState(() => !panelsFloat())
  const configOpen = phone ? sheet === 'config' : leftOpen
  const outputOpen = phone ? sheet === 'output' : rightOpen
  const openConfig = (open: boolean) =>
    phone ? setSheet(open ? 'config' : null) : setLeftOpen(open)
  const openOutput = (open: boolean) =>
    phone ? setSheet(open ? 'output' : null) : setRightOpen(open)
  // Each panel animates its width on one of these. How far it reaches past
  // its collapsed puck becomes a CSS variable the floating layout pads the
  // nav row by (index.css), so the logo and Theme button move with the
  // panel's own spring rather than a transition that approximates it. They
  // live on the app root, not the canvas: the docks sit outside the canvas
  // and their collapsed footprints have to measure the same push.
  const leftWidth = useMotionValue(leftOpen ? PANEL_WIDTH : PUCK_SIZE)
  const rightWidth = useMotionValue(rightOpen ? PANEL_WIDTH : PUCK_SIZE)
  const pushLeft = useTransform(leftWidth, (w) => `${w - PUCK_SIZE}px`)
  const pushRight = useTransform(rightWidth, (w) => `${w - PUCK_SIZE}px`)
  const nextId = useRef(1)
  const paramsRef = useRef(params)
  const generating = useRef(false)
  paramsRef.current = params

  // With `override`, the run uses those params and the panel adopts them
  // (the empty state's recipes); otherwise it uses whatever the panel holds.
  const generate = (override?: PaletteParams) => {
    // State updates are asynchronous, so two clicks in the same frame can both
    // observe busy=false. The ref closes that small window and keeps the UI's
    // single-run contract honest.
    if (generating.current) return
    generating.current = true
    setBusy(true)
    if (override) setParams(override)
    const snapshot = structuredClone(override ?? paramsRef.current)
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
      .finally(() => {
        generating.current = false
        setBusy(false)
      })
  }

  // The header sticks to the top of the canvas; the moment anything has
  // scrolled under it, a glass scrim fades in behind it (index.css). A flag on
  // the document rather than React state — this fires on every scroll, and
  // re-rendering the canvas and its charts to raise a boolean would be absurd.
  useEffect(() => {
    const root = document.documentElement
    let scrolled: boolean | null = null
    const sync = () => {
      const next = window.scrollY > 0
      if (next === scrolled) return
      scrolled = next
      root.toggleAttribute('data-scrolled', next)
    }
    sync()
    window.addEventListener('scroll', sync, { passive: true })
    return () => {
      window.removeEventListener('scroll', sync)
      root.removeAttribute('data-scrolled')
    }
  }, [])

  // Leaving the phone layout retires the sheet rather than leaving it parked:
  // the docks take over at that width, and coming back would otherwise reopen
  // a sheet nobody asked for.
  useEffect(() => {
    if (!phone) setSheet(null)
  }, [phone])

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
      params: structuredClone(paramsRef.current),
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
    <motion.div
      className="app"
      style={{ '--push-left': pushLeft, '--push-right': pushRight } as MotionStyle}
    >
      <ParametersPanel
        params={params}
        onParamsChange={setParams}
        onGenerate={generate}
        busy={busy}
        open={configOpen}
        onOpenChange={openConfig}
        hoverToOpen={versions.length === 0}
        width={leftWidth}
      />
      <main className="app-main">
        <MainTabs version={current} busy={busy} onGenerate={generate} onPreset={addPalette} />
      </main>
      <HistoryPanel
        versions={versions}
        currentId={currentId}
        onRestore={restore}
        onColorsChange={updateColors}
        onPaletteReplace={addPalette}
        onDeleteVersion={deleteVersion}
        onClearVersions={clearVersions}
        open={outputOpen}
        onOpenChange={openOutput}
        hoverToOpen={versions.length === 0}
        width={rightWidth}
      />
      {phone && (
        <MobileBar
          busy={busy}
            open={sheet}
          onOpen={setSheet}
          onGenerate={generate}
        />
      )}
      <TooltipLayer />
    </motion.div>
    </MotionConfig>
    </ThemeProvider>
  )
}
