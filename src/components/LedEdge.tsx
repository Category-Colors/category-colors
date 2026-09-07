import { useEffect, useRef } from 'react'
import { converter } from 'culori'
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

/** ~30fps. The pulses are slow enough that the halved rate is invisible, and
 *  unlike a spring this layer never settles: at 60 it would hold the
 *  compositor at full rate for as long as it's on screen. */
const FRAME = 1000 / 30

/** rAF deltas land a shade either side of the interval on a 60Hz display, so
 *  comparing against it exactly drops one render in every few and the strip
 *  alternates 30fps with 20 instead of holding a cadence. Slack under half a
 *  display frame absorbs the jitter and still can't let two through in one. */
const SLACK = 4

const VERTEX = `#version 300 es
void main() {
  // One triangle big enough to cover the clip square, built from the vertex
  // index — no buffers, no attributes.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uSize;  // drawing buffer, device px
uniform float uTime; // seconds
uniform vec3 uInk;

out vec4 outColor;

#define PI 3.14159265

// Half-width of an emitter and its corner radius, in cell units: an 8.6px
// square with a 1.3px radius at the default band height.
const float HALF = 0.36;
const float ROUND = 0.11;

const float ROWS = 3.0;

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
  // arithmetic to keep in step, since uSize is already in device pixels.
  float pitch = uSize.y / ROWS;
  vec2 grid = gl_FragCoord.xy / pitch;
  vec2 id = floor(grid);
  vec2 cell = fract(grid) - 0.5;

  // Rounded square: a box SDF whose corners are pulled in by ROUND and then
  // grown back out, which is what rounds them.
  vec2 d = abs(cell) - (HALF - ROUND);
  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - ROUND;
  float aa = fwidth(sd);
  float led = 1.0 - smoothstep(-aa, aa, sd);

  // Each emitter runs its own cycle at its own rate. The cycle index reseeds
  // the pick, so which ones light changes every time round rather than
  // settling into a pattern the eye can learn.
  float period = mix(2.4, 6.0, hash(id + 19.0));
  float phase = uTime / period + hash(id);
  // Offset, or the first cycle's pick would be hash(id) itself — and the phase
  // is built from that too, so the two would cancel and the strip would open
  // with no sparks at all. Reduced motion renders exactly that frame.
  float pick = hash(id + floor(phase) * 31.0 + 7.0);

  // A slow noise field drifting along the strip decides where emitters are
  // likely to light. Without it every one is equally likely and the result is
  // evenly salted; with it they arrive in loose groups that move.
  float cluster = valueNoise(id * 0.07 + vec2(uTime * 0.05, uTime * 0.015));

  // AMOLED, not backlit: an emitter that isn't lit emits nothing at all, so
  // the grid itself is invisible and only what's on gets drawn. Emitters only
  // just over the threshold come up dim; the ones well over it spark.
  float amp = smoothstep(mix(0.50, 0.10, cluster), 1.0, pick);
  // Wide, so a lit emitter dwells rather than blinking — with three rows and
  // no falloff, brief flashes would read as noise instead of as a panel.
  float pulse = pow(sin(fract(phase) * PI), 1.4);

  float a = led * amp * pulse * 0.6;

  outColor = vec4(uInk * a, a);
}`

export function LedEdge() {
  const { tokens } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The ink reaches the shader through a ref, not the setup effect's deps: a
  // theme change should swap a uniform, not rebuild the GL context.
  const ink = useRef<[number, number, number]>([1, 1, 1])
  // Set only when the loop isn't running, which is the one case where a new ink
  // wouldn't otherwise reach the screen.
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
        return
      }
      gl.attachShader(program, shader)
      // attached, so it lives until the program is deleted
      gl.deleteShader(shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('LED edge program failed to link:', gl.getProgramInfoLog(program))
      return
    }
    gl.useProgram(program)

    const uSize = gl.getUniformLocation(program, 'uSize')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uInk = gl.getUniformLocation(program, 'uInk')

    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const render = (seconds: number) => {
      gl.uniform1f(uTime, seconds)
      gl.uniform3fv(uInk, ink.current)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = 0

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uSize, canvas.width, canvas.height)
      // Nothing redraws it on its own when the loop isn't running.
      if (reduced) render(0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (now - last < FRAME - SLACK) return
      last = now
      render(now / 1000)
    }

    // Reduced motion: the matrix still paints, it just holds still. Emitters
    // frozen mid-pulse are the texture without the twinkle.
    let io: IntersectionObserver | undefined
    if (reduced) {
      redraw.current = () => render(0)
    } else {
      // The band sits at the end of the page, not against the viewport, so on
      // anything longer than a screen it spends most of its life scrolled out
      // of sight — and rAF goes on firing when it does. A hidden tab is the
      // browser's problem; this one is ours.
      io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          if (!raf) raf = requestAnimationFrame(tick)
        } else {
          cancelAnimationFrame(raf)
          raf = 0
        }
      })
      io.observe(canvas)
    }

    return () => {
      cancelAnimationFrame(raf)
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
    const rgb = toRgb(tokens.ink)
    if (rgb) ink.current = [rgb.r, rgb.g, rgb.b]
    redraw.current?.()
  }, [tokens.ink])

  return <canvas ref={canvasRef} className="led-edge" aria-hidden />
}
