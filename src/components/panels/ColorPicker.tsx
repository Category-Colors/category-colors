import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { converter } from 'culori'
import type { Color } from 'culori'
import { SpaceSelect } from '@/components/SpaceSelect'
import {
  convertValue,
  hexValue,
  hsvToHex,
  hsvToValue,
  valueToCss,
  valueToHsv,
  type ColorValue,
  type Hsv,
  type Space,
} from '@/lib/color'
import { ICON_STROKE } from '@/components/panels/icons'

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }
const eyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const SPACE_OPTIONS = (['hex', 'rgb', 'hsl', 'oklch', 'oklab'] as Space[]).map((value) => ({
  value,
  label: value.toUpperCase(),
}))

interface ChannelDef {
  key: string
  label: string
  min: number
  max: number
  decimals: number
}

const CHANNELS: Record<Exclude<Space, 'hex'>, ChannelDef[]> = {
  rgb: [
    { key: 'r', label: 'R', min: 0, max: 255, decimals: 0 },
    { key: 'g', label: 'G', min: 0, max: 255, decimals: 0 },
    { key: 'b', label: 'B', min: 0, max: 255, decimals: 0 },
  ],
  hsl: [
    { key: 'h', label: 'H', min: 0, max: 360, decimals: 1 },
    { key: 's', label: 'S %', min: 0, max: 100, decimals: 1 },
    { key: 'l', label: 'L %', min: 0, max: 100, decimals: 1 },
  ],
  oklch: [
    { key: 'l', label: 'L', min: 0, max: 1, decimals: 3 },
    { key: 'c', label: 'C', min: 0, max: 0.4, decimals: 3 },
    { key: 'h', label: 'H', min: 0, max: 360, decimals: 1 },
  ],
  oklab: [
    { key: 'l', label: 'L', min: 0, max: 1, decimals: 3 },
    { key: 'a', label: 'A', min: -0.4, max: 0.4, decimals: 3 },
    { key: 'b', label: 'B', min: -0.4, max: 0.4, decimals: 3 },
  ],
}

// The pick surface in the color's own space, so dragging moves the numbers in
// the inputs below: a plane of two channels at the slider's third. hex and
// rgb have no plane that reads well, so they keep HSV, the surface every
// picker uses for them.
type PlaneSpace = 'hsl' | 'oklch' | 'oklab'
interface Plane {
  slider: string
  x: string
  y: string
  color: (slider: number, x: number, y: number) => Color
  sliderBackground: string
}

const HUE_RAINBOW = 'linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)'

const PLANES: Record<PlaneSpace, Plane> = {
  hsl: {
    slider: 'h', x: 's', y: 'l',
    color: (h, s, l) => ({ mode: 'hsl', h, s: s / 100, l: l / 100 }),
    sliderBackground: HUE_RAINBOW,
  },
  oklch: {
    slider: 'h', x: 'c', y: 'l',
    color: (h, c, l) => ({ mode: 'oklch', l, c, h }),
    sliderBackground: 'linear-gradient(in oklch longer hue, oklch(0.72 0.14 0), oklch(0.72 0.14 360))',
  },
  oklab: {
    slider: 'l', x: 'a', y: 'b',
    color: (l, a, b) => ({ mode: 'oklab', l, a, b }),
    sliderBackground: 'linear-gradient(to right, #000, #fff)',
  },
}

const isPlaneSpace = (space: Space): space is PlaneSpace => space in PLANES

const channel = (space: Exclude<Space, 'hex'>, key: string) => CHANNELS[space].find((d) => d.key === key)!
const fraction = (def: ChannelDef, n: number) => (n - def.min) / (def.max - def.min)
const roundTo = (def: ChannelDef, n: number) => {
  const p = 10 ** def.decimals
  return Math.round(Math.max(def.min, Math.min(def.max, n)) * p) / p
}

// Paints the plane at a slider setting, low resolution and stretched by CSS.
// Pixels outside sRGB are left clear: the plane shows the gamut's real shape
// rather than a clamped color that lies about where the edge is.
const toRgb = converter('rgb')
const PLANE_W = 280
const PLANE_H = 140
function paintPlane(canvas: HTMLCanvasElement, space: PlaneSpace, slider: number) {
  const plane = PLANES[space]
  const xDef = channel(space, plane.x)
  const yDef = channel(space, plane.y)
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(PLANE_W, PLANE_H)
  const data = image.data
  for (let row = 0; row < PLANE_H; row++) {
    const y = yDef.max - ((row + 0.5) / PLANE_H) * (yDef.max - yDef.min)
    for (let col = 0; col < PLANE_W; col++) {
      const x = xDef.min + ((col + 0.5) / PLANE_W) * (xDef.max - xDef.min)
      const { r, g, b } = toRgb(plane.color(slider, x, y))
      const i = (row * PLANE_W + col) * 4
      if ([r, g, b].some((c) => c < -0.002 || c > 1.002)) continue
      data[i] = Math.round(clamp01(r) * 255)
      data[i + 1] = Math.round(clamp01(g) * 255)
      data[i + 2] = Math.round(clamp01(b) * 255)
      data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

function PipetteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 22l1-1h3l9-9M3 21v-3l9-9M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
    </svg>
  )
}

// Saturation/value area + hue slider + eyedropper + per-channel inputs in the
// color's own space. Controlled by a ColorValue prop; internal HSV state keeps
// hue stable while dragging through grays where the value can't express it.
export function ColorPicker({
  value,
  onChange,
}: {
  value: ColorValue
  onChange: (value: ColorValue) => void
}) {
  const [hsv, setHsv] = useState<Hsv>(() => valueToHsv(value))
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(lastEmitted.current)) return
    setHsv(valueToHsv(value))
    lastEmitted.current = value
  }, [value])

  // Drags: hsv is the source of truth, converted into the stored space
  const emitFromHsv = (next: Hsv) => {
    setHsv(next)
    const nextValue = hsvToValue(value.space, next)
    lastEmitted.current = nextValue
    onChange(nextValue)
  }

  // Typed input / eyedropper / space switch: the value is the source of truth
  const applyValue = (next: ColorValue) => {
    setHsv(valueToHsv(next))
    lastEmitted.current = next
    onChange(next)
  }

  // The surface's three numbers: HSV for hex and rgb, the space's own
  // channels otherwise. Slider first, then the plane's x and y.
  const space = value.space
  const plane = isPlaneSpace(space) ? PLANES[space] : null
  const channels = value as unknown as Record<string, number>
  const sliderFraction = plane ? fraction(channel(space as PlaneSpace, plane.slider), channels[plane.slider]) : hsv[0] / 360
  const xFraction = plane ? fraction(channel(space as PlaneSpace, plane.x), channels[plane.x]) : hsv[1]
  const yFraction = plane ? fraction(channel(space as PlaneSpace, plane.y), channels[plane.y]) : hsv[2]

  const planeRef = useRef<HTMLCanvasElement>(null)
  const sliderValue = plane ? channels[plane.slider] : 0
  useEffect(() => {
    if (plane && planeRef.current) paintPlane(planeRef.current, space as PlaneSpace, sliderValue)
  }, [plane, space, sliderValue])

  // A pointer position on the surface, as fractions of its width and height
  const pointerFractions = (e: ReactPointerEvent<HTMLDivElement>): [number, number] | null => {
    if (e.type === 'pointerdown') e.currentTarget.setPointerCapture(e.pointerId)
    else if (e.buttons !== 1) return null
    const rect = e.currentTarget.getBoundingClientRect()
    return [clamp01((e.clientX - rect.left) / rect.width), 1 - clamp01((e.clientY - rect.top) / rect.height)]
  }

  const svPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = pointerFractions(e)
    if (!at) return
    if (!plane) return emitFromHsv([hsv[0], at[0], at[1]])
    const xDef = channel(space as PlaneSpace, plane.x)
    const yDef = channel(space as PlaneSpace, plane.y)
    applyValue({
      ...value,
      [plane.x]: roundTo(xDef, xDef.min + at[0] * (xDef.max - xDef.min)),
      [plane.y]: roundTo(yDef, yDef.min + at[1] * (yDef.max - yDef.min)),
    } as ColorValue)
  }

  const huePointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const at = pointerFractions(e)
    if (!at) return
    if (!plane) return emitFromHsv([at[0] * 360, hsv[1], hsv[2]])
    const def = channel(space as PlaneSpace, plane.slider)
    applyValue({ ...value, [plane.slider]: roundTo(def, def.min + at[0] * (def.max - def.min)) } as ColorValue)
  }

  const commitDraft = () => {
    if (!draft) return
    if (value.space === 'hex') {
      const m = /^#?([0-9a-f]{6})$/i.exec(draft.text.trim())
      if (m) applyValue(hexValue(`#${m[1].toUpperCase()}`))
    } else {
      const def = CHANNELS[value.space].find((d) => d.key === draft.key)
      const n = Number(draft.text)
      if (def && Number.isFinite(n)) {
        const p = 10 ** def.decimals
        const clamped = Math.round(Math.max(def.min, Math.min(def.max, n)) * p) / p
        applyValue({ ...value, [draft.key]: clamped } as ColorValue)
      }
    }
    setDraft(null)
  }

  const pickFromScreen = async () => {
    try {
      const result = await new eyeDropper!().open()
      applyValue(convertValue(hexValue(result.sRGBHex.toUpperCase()), value.space))
    } catch {
      // user cancelled
    }
  }

  const inputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      e.stopPropagation() // cancel the edit without closing the popover
      setDraft(null)
    }
  }

  return (
    <div className="color-picker">
      <div
        className={plane ? 'picker-sv' : 'picker-sv picker-sv-hsv'}
        style={{ '--picker-hue': `hsl(${hsv[0]}, 100%, 50%)` } as CSSProperties}
        onPointerDown={svPointer}
        onPointerMove={svPointer}
      >
        {plane && <canvas ref={planeRef} className="picker-plane" width={PLANE_W} height={PLANE_H} />}
        <div
          className="picker-handle"
          style={{
            left: `${xFraction * 100}%`,
            top: `${(1 - yFraction) * 100}%`,
            backgroundColor: plane ? valueToCss(value) : hsvToHex(hsv),
          }}
        />
      </div>
      <div
        className="picker-hue"
        style={{ background: plane ? plane.sliderBackground : HUE_RAINBOW }}
        onPointerDown={huePointer}
        onPointerMove={huePointer}
      >
        <div
          className="picker-handle"
          style={{
            left: `${sliderFraction * 100}%`,
            top: '50%',
            backgroundColor: plane
              ? valueToCss({ ...value, [plane.x]: plane.slider === 'l' ? 0 : 0.14, [plane.y]: plane.slider === 'l' ? 0 : 0.72 } as ColorValue)
              : `hsl(${hsv[0]}, 100%, 50%)`,
          }}
        />
      </div>
      <div className="picker-io">
        {eyeDropper && (
          <button className="picker-eyedropper" aria-label="Pick from screen" onClick={pickFromScreen}>
            <PipetteIcon />
          </button>
        )}
        <SpaceSelect
          value={value.space}
          options={SPACE_OPTIONS}
          onChange={(space) => applyValue(convertValue(value, space))}
          label="Color space"
        />
      </div>
      {value.space === 'hex' ? (
        <div className="picker-channels">
          <label className="picker-channel">
            <input
              value={draft?.key === 'hex' ? draft.text : value.hex.toUpperCase()}
              onFocus={() => setDraft({ key: 'hex', text: value.hex.toUpperCase() })}
              onChange={(e) => setDraft({ key: 'hex', text: e.target.value })}
              onBlur={commitDraft}
              onKeyDown={inputKeyDown}
              spellCheck={false}
            />
            <span>Hex</span>
          </label>
        </div>
      ) : (
        <div className="picker-channels">
          {CHANNELS[value.space].map((def) => (
            <label key={def.key} className="picker-channel">
              <input
                value={
                  draft?.key === def.key
                    ? draft.text
                    : String((value as unknown as Record<string, number>)[def.key])
                }
                onFocus={() =>
                  setDraft({
                    key: def.key,
                    text: String((value as unknown as Record<string, number>)[def.key]),
                  })
                }
                onChange={(e) => setDraft({ key: def.key, text: e.target.value })}
                onBlur={commitDraft}
                onKeyDown={inputKeyDown}
                inputMode="decimal"
                spellCheck={false}
              />
              <span>{def.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
