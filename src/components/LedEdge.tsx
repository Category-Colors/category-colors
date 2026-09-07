import { useEffect, useRef } from 'react'
import { clampChroma, converter } from 'culori'
import { prefersReducedMotion } from '@/components/dialkit'
import { useTheme } from '@/lib/theme'

// Three rows of LED matrix along the end of the page, seen close enough that
// the individual emitters are rounded squares with dark gutters between them.
// Most sit dark; a few pulse up and fade out again.
//
// It is one colour — the theme's ink — because the whole UI is, and because a
// single-colour panel is what the effect is imitating. Three rows is few
// enough to read as a strip of hardware rather than a field that has to fade
// out to explain where it stops.

const toRgb = converter('rgb')

/** How long the loop sleeps between draws — about 30fps. The pulses are slow
 *  enough that halving the rate is invisible, and unlike a spring this layer
 *  never settles: at full rate it would hold the compositor for as long as it
 *  is on screen. The real gap is this plus however long the frame that's asked
 *  for afterwards takes to arrive, so the cadence lands at or a little under
 *  30 depending on the display. Nothing here needs it exact. */
const FRAME = 1000 / 30

const VERTEX = `#version 300 es
void main() {
  // One triangle big enough to cover the clip square, built from the vertex
  // index — no buffers, no attributes.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;

uniform float uBand; // drawing buffer height, device px
uniform float uTime; // seconds
uniform vec3 uInk;

out vec4 outColor;

#define PI 3.14159265

// Half-width of an emitter and its corner radius, in cell units: an 8.6px
// square with a 1.3px radius at the default band height.
const float HALF = 0.36;
const float ROUND = 0.11;

const float ROWS = 3.0;

// Alpha of an emitter at the top of its pulse. The knob to reach for first if
// the strip reads hot or dim.
const float PEAK = 0.6;

// One time scale governs both pulse cycles and the field drifting through
// them. At roughly a third speed, changes register as a slow current rather
// than a twinkle.
const float SPEED = 0.32;

// Integer bit-mixing, not the usual fract(sin(dot(p, k))). That one bands into
// visible diagonals at exactly the frequency a pixel grid samples it at, which
// is what the eye picks up as a pattern.
float hash(vec2 cell) {
  uvec2 q = uvec2(ivec2(cell)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967296.0);
}

// Value noise over the same hash — smooth, and cheaper than simplex for a
// field this slow.
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  // The pitch is the band's height over the row count, so the strip is exactly
  // three emitters tall whatever height the CSS gives it — and there is no dpr
  // arithmetic to keep in step, since uBand is already in device pixels.
  float pitch = uBand / ROWS;
  vec2 grid = gl_FragCoord.xy / pitch;
  vec2 id = floor(grid);
  vec2 cell = fract(grid) - 0.5;

  // Rounded square: a box SDF whose corners are pulled in by ROUND and then
  // grown back out, which is what rounds them.
  vec2 d = abs(cell) - (HALF - ROUND);
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - ROUND;
  float aa = fwidth(sd);
  float led = 1.0 - smoothstep(-aa, aa, sd);

  float time = uTime * SPEED;

  // Each emitter runs its own cycle at its own rate. The cycle index reseeds
  // the pick, so which ones light changes every time round rather than
  // settling into a pattern the eye can learn.
  float period = mix(2.4, 6.0, hash(id + 19.0));
  float phase = time / period + hash(id);
  // Offset, or the first cycle's pick would be hash(id) itself — and the phase
  // is built from that too, so the two would cancel and the strip would open
  // with no sparks at all. Reduced motion renders exactly that frame.
  float pick = hash(id + floor(phase) * 31.0 + 7.0);

  // A slow noise field drifting along the strip decides where emitters are
  // likely to light. Without it every one is equally likely and the result is
  // evenly salted; with it they arrive in loose groups that move.
  float cluster = valueNoise(id * 0.07 + vec2(time * 0.05, time * 0.015));

  // AMOLED, not backlit: an emitter that isn't lit emits nothing at all, so
  // the grid itself is invisible and only what's on gets drawn. Roughly one
  // cell in seven clears the typical threshold; the drifting field varies
  // that between sparse dark stretches and loose, still-dark-majority groups.
  // Emitters only just over the threshold come up dim; those well over it spark.
  float amp = smoothstep(mix(0.94, 0.78, cluster), 1.0, pick);
  // Wide, so a lit emitter dwells rather than blinking — with three rows and
  // no falloff, brief flashes would read as noise instead of as a panel.
  float pulse = pow(sin(fract(phase) * PI), 1.4);

  // Strength falls away from the page edge: full at the bottom, half through
  // the middle, and just 12% on top. id.y counts upward from the bottom.
  float row = id.y < 1.0 ? 1.0 : (id.y < 2.0 ? 0.50 : 0.12);

  float a = led * amp * pulse * PEAK * row;

  outColor = vec4(uInk * a, a);
}`

export function LedEdge() {
  const { tokens } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The ink reaches the shader through a ref, not the setup effect's deps: a
  // theme change should swap a uniform, not rebuild the GL context.
  const ink = useRef<[number, number, number]>([1, 1, 1])
  // The draw path that doesn't go through the loop, for the ink effect to call.
  // It is the only way a new ink reaches the screen when there is no loop —
  // under reduced motion, or while the strip is scrolled out of view.
  const redraw = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    })
    // No WebGL2 (or no GPU to spare) — the strip is decoration, so it simply
    // isn't there.
    if (!gl) return

    const program = gl.createProgram()
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('LED edge shader failed to compile:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        gl.deleteProgram(program)
        return
      }
      gl.attachShader(program, shader)
      // attached, so it lives until the program is deleted
      gl.deleteShader(shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('LED edge program failed to link:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return
    }
    gl.useProgram(program)

    const uBand = gl.getUniformLocation(program, 'uBand')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uInk = gl.getUniformLocation(program, 'uInk')

    const render = (seconds: number) => {
      gl.uniform1f(uTime, seconds)
      gl.uniform3fv(uInk, ink.current)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const reduced = prefersReducedMotion()
    let raf = 0
    let timer = 0
    let last = 0

    // One frame outside the loop, at whatever time the loop last drew — 0
    // before it has ever run, which is the frame reduced motion holds.
    const repaint = () => render(last / 1000)

    const resize = () => {
      // Read the ratio here rather than once on setup: browser zoom and a drag
      // to a display of another density both move it, and a stale one leaves
      // the emitters rasterised soft. Rounded, or the guard below never matches
      // on a fractional ratio — the canvas truncates what it is assigned.
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      // Assigning either dimension reallocates and clears the drawing buffer
      // even when the value is unchanged, and ResizeObserver delivers sub-pixel
      // layout changes — a window drag would thrash allocation once a frame.
      // Only the allocation is worth guarding, and only the allocation may be:
      // the uniform belongs to the program, which is rebuilt on every run of
      // this effect (StrictMode does two), while the canvas keeps its size
      // across them. Guarding the upload too would leave the second program's
      // uBand at 0, and a pitch of 0/ROWS takes the whole shader to NaN.
      if (w !== canvas.width || h !== canvas.height) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.uniform1f(uBand, h)
      // Assigning the dimensions cleared the buffer, so paint it now rather
      // than leaving the strip blank until the next tick — up to 33ms on a
      // window drag, and forever when the loop isn't running at all.
      repaint()
    }
    // Once synchronously, so uBand is set before anything else can paint;
    // the observer's own first delivery then no-ops on the size guard.
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // Sleep first, then ask for a single frame — rather than re-entering rAF
    // every time and discarding most of the callbacks against an interval
    // check. rAF delivers at display rate, so that pattern woke this component
    // 120 times a second on a 120Hz panel to draw 30, and the registrations
    // cost more than the drawing did: measured 15.2ms of main thread per
    // second, of which 11.0 remained with the draw call stubbed out. This way
    // ~32 callbacks produce the same ~30 draws.
    const tick = (now: number) => {
      raf = 0
      last = now
      render(now / 1000)
      timer = setTimeout(() => {
        raf = requestAnimationFrame(tick)
      }, FRAME)
    }
    // Both halves, since a stop can land either while sleeping or while
    // waiting on the frame.
    const stop = () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      raf = 0
      timer = 0
    }

    // A new ink repaints immediately rather than waiting on the loop — which
    // under reduced motion is never, since there isn't one.
    redraw.current = repaint

    // Reduced motion is the whole reason for the branch: the matrix still
    // paints, it just holds still. Emitters frozen mid-pulse are the texture
    // without the twinkle.
    let io: IntersectionObserver | undefined
    if (!reduced) {
      // The band sits at the end of the page, not against the viewport, so on
      // anything longer than a screen it spends most of its life scrolled out
      // of sight — and rAF goes on firing when it does. A hidden tab is the
      // browser's problem; this one is ours.
      io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!raf && !timer) raf = requestAnimationFrame(tick)
        } else {
          stop()
        }
      })
      io.observe(canvas)
    }

    return () => {
      stop()
      redraw.current = null
      ro.disconnect()
      io?.disconnect()
      // Delete the program, not the context: a remount (StrictMode does one)
      // gets handed the same canvas, and getContext would return the same
      // context — losing it here would leave nothing to draw with.
      gl.deleteProgram(program)
    }
  }, [])

  useEffect(() => {
    // Gamut-map rather than just convert. A custom theme's ink is whatever the
    // Theme editor's field parses (ThemeMenu.tsx), oklch() included, and those
    // sit outside sRGB routinely — oklch(0.9 0.4 140) converts to r -0.39, g
    // 1.08. Channels outside 0–1 break the invariant the shader writes under,
    // since uInk * a must never exceed a on a premultiplied context. Reducing
    // chroma is also what CSS does to paint that same ink everywhere else, so
    // this keeps the strip the colour the rest of the UI is.
    const rgb = toRgb(clampChroma(tokens.ink, 'oklch'))
    if (rgb) ink.current = [rgb.r, rgb.g, rgb.b]
    redraw.current?.()
  }, [tokens.ink])

  return <canvas ref={canvasRef} className="led-edge" aria-hidden />
}
