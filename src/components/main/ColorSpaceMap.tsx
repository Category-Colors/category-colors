import { useEffect, useMemo, useRef, useState } from 'react'
import { converter } from 'culori'
import { SpaceSelect } from '@/components/SpaceSelect'
import { SPACE_OPTIONS, spaceDef, type WorkingSpace } from '@/lib/color-spaces'
import { useTheme } from '@/lib/theme'

// 3D plot of the palette inside its working color space: the sRGB gamut as a
// point cloud with the palette as ringed dots. Drag to rotate; auto-rotates
// gently unless the user prefers reduced motion.
//
// The solid's shape follows the space's geometry — a cylinder for the polar
// and opponent spaces (lightness up the axis) and a cube for rgb — so what
// you see is the region the annealer's channel ranges actually carve up.

interface Pt {
  x: number
  y: number
  z: number
  css: string
  palette: boolean
}

const CYL_HEIGHT = 1.4
const GRID_N = 16 // sRGB samples per channel → 16³ ≈ 4.1k cloud points
const MAX_SRGB_CHROMA = 0.33 // oklch chroma (and oklab |ab|) tops out near 0.32 in sRGB

// Any of the five modes' channel sets; each geometry reads only its own keys
type Coords = Partial<Record<'r' | 'g' | 'b' | 'h' | 's' | 'l' | 'c' | 'a', number>>

function toXYZ(space: WorkingSpace, c: Coords) {
  const height = ((c.l ?? 0) - 0.5) * CYL_HEIGHT
  switch (spaceDef(space).geometry) {
    case 'cube':
      // the unit rgb cube, centred on the origin
      return { x: (c.r ?? 0) - 0.5, y: (c.g ?? 0) - 0.5, z: (c.b ?? 0) - 0.5 }
    case 'opponent':
      // a/b are already the cartesian form of chroma/hue
      return {
        x: (c.a ?? 0) / MAX_SRGB_CHROMA,
        y: height,
        z: (c.b ?? 0) / MAX_SRGB_CHROMA,
      }
    case 'polar': {
      const angle = ((c.h ?? 0) * Math.PI) / 180
      // hsl/okhsl carry saturation on 0–1; oklch carries chroma
      const radius = c.s ?? Math.min(1, (c.c ?? 0) / MAX_SRGB_CHROMA)
      return { x: radius * Math.cos(angle), y: height, z: radius * Math.sin(angle) }
    }
  }
}

// The neutral axis the solid is built around: the r=g=b diagonal of the cube,
// the vertical lightness axis of everything else.
const achromaticAxis = (space: WorkingSpace): [Pt3, Pt3] => {
  const pad = 0.12
  if (spaceDef(space).geometry === 'cube') {
    const e = 0.5 + pad / 2
    return [
      { x: -e, y: -e, z: -e },
      { x: e, y: e, z: e },
    ]
  }
  const e = CYL_HEIGHT / 2 + pad
  return [
    { x: 0, y: -e, z: 0 },
    { x: 0, y: e, z: 0 },
  ]
}

const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0)
  return `rgba(${r},${g},${b},${alpha})`
}

interface Pt3 {
  x: number
  y: number
  z: number
}

// `defaultSpace` is the space the palette was optimized in — the most useful
// thing to see first. The picker then lets any palette be inspected in any
// space, since the interesting question is often how a palette found in one
// space sits inside another. A run in a new working space re-seeds the view.
export function ColorSpaceMap({
  colors,
  defaultSpace,
}: {
  colors: string[]
  defaultSpace: WorkingSpace
}) {
  const [space, setSpace] = useState(defaultSpace)
  const [seededFrom, setSeededFrom] = useState(defaultSpace)
  if (defaultSpace !== seededFrom) {
    setSeededFrom(defaultSpace)
    setSpace(defaultSpace)
  }

  // the axis and the palette rings are chrome, so they follow the theme's ink
  // rather than being hardcoded light-on-dark
  const { tokens } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // persists across palette regenerations so the view doesn't snap back
  const view = useRef({ yaw: -0.7, pitch: 0.4 })

  // The gamut cloud is 4k culori conversions and depends only on the working
  // space — editing a color must not pay for rebuilding it.
  const cloud = useMemo(() => {
    const convert = converter(space)
    const pts: Pt[] = []
    // deterministic jitter breaks up the sampling grid's moiré spokes while
    // keeping renders stable across regenerations
    const noise = (seed: number) => {
      const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
      return s - Math.floor(s) - 0.5
    }
    let i = 0
    for (let r = 0; r < GRID_N; r++) {
      for (let g = 0; g < GRID_N; g++) {
        for (let b = 0; b < GRID_N; b++) {
          const [R, G, B] = [r, g, b].map((v, ch) => {
            const t = v / (GRID_N - 1) + noise(i * 3 + ch) / (GRID_N - 1)
            return Math.round(Math.max(0, Math.min(1, t)) * 255)
          })
          i++
          const c = convert(`rgb(${R}, ${G}, ${B})`)
          if (c) pts.push({ ...toXYZ(space, c), css: `rgba(${R},${G},${B},0.5)`, palette: false })
        }
      }
    }
    return pts
  }, [space])

  const swatches = useMemo(() => {
    const convert = converter(space)
    const next: Pt[] = []
    for (const hex of colors) {
      const c = convert(hex)
      if (c) next.push({ ...toXYZ(space, c), css: hex, palette: true })
    }
    return next
  }, [colors, space])

  const axis = useMemo(() => achromaticAxis(space), [space])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let raf = 0
    let dragging = false
    let dirty = true

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      dirty = true
      if (reduced) {
        render()
        dirty = false
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const render = () => {
      const { yaw, pitch } = view.current
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const scale = (Math.min(w, h) / 2) * 0.72
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const project = (p: { x: number; y: number; z: number }) => {
        const x1 = p.x * cy - p.z * sy
        const z1 = p.x * sy + p.z * cy
        return {
          sx: w / 2 + x1 * scale,
          sy: h / 2 - (p.y * cp - z1 * sp) * scale,
          z: p.y * sp + z1 * cp,
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const [axisA, axisB] = axis.map(project)
      ctx.strokeStyle = withAlpha(tokens.ink, 0.14)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(axisA.sx, axisA.sy)
      ctx.lineTo(axisB.sx, axisB.sy)
      ctx.stroke()

      // The cloud is translucent texture, so a full 4k-element depth sort every
      // frame adds substantial work without useful information. Draw it in its
      // stable sample order, then depth-sort only the handful of palette rings
      // and keep those rings visibly above the cloud.
      for (const point of cloud) {
        const q = project(point)
        const r = 1 + ((q.z + 1.2) / 2.4) * 0.9
        ctx.fillStyle = point.css
        ctx.fillRect(q.sx - r / 2, q.sy - r / 2, r, r)
      }
      const projectedSwatches = swatches
        .map((point) => ({ point, ...project(point) }))
        .sort((a, b) => a.z - b.z)
      for (const q of projectedSwatches) {
        ctx.beginPath()
        ctx.arc(q.sx, q.sy, 5, 0, Math.PI * 2)
        ctx.fillStyle = q.point.css
        ctx.fill()
        ctx.strokeStyle = withAlpha(tokens.ink, 0.9)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    let lastAutoFrame = 0
    const tick = (time: number) => {
      // 30 visual updates per second is ample for the slow ambient rotation and
      // halves the canvas work while retaining a requestAnimationFrame clock.
      if (!dragging && time - lastAutoFrame >= 32) {
        view.current.yaw += 0.007
        dirty = true
        lastAutoFrame = time
      }
      if (dirty) {
        render()
        dirty = false
      }
      raf = requestAnimationFrame(tick)
    }
    if (reduced) {
      render()
      dirty = false
    } else {
      raf = requestAnimationFrame(tick)
    }

    let lastX = 0
    let lastY = 0
    const down = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      view.current.yaw += (e.clientX - lastX) * 0.008
      view.current.pitch = Math.max(
        -1.35,
        Math.min(1.35, view.current.pitch + (e.clientY - lastY) * 0.008)
      )
      lastX = e.clientX
      lastY = e.clientY
      dirty = true
      if (reduced) {
        render()
        dirty = false
      }
    }
    const up = () => {
      dragging = false
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
    }
  }, [cloud, swatches, axis, tokens.ink])

  return (
    // dialkit-root brings the --dial-* tokens into scope (they're defined on
    // that class, and the main area is otherwise outside any DialKit subtree),
    // so the overlaid select gets the same chrome as the panels' dropdowns
    <div className="dialkit-root size-full">
      <canvas
        ref={canvasRef}
        className="block size-full cursor-grab touch-none active:cursor-grabbing"
        aria-label={`3D plot of the palette in ${space}`}
      />
      <SpaceSelect
        className="space-select-overlay"
        value={space}
        options={SPACE_OPTIONS}
        onChange={setSpace}
        label="Color space to plot in"
      />
    </div>
  )
}
