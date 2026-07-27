import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const DWELL = 200

// One delegated tooltip for every icon-only button in the app: any
// `button[aria-label]` grows a styled label after a 200ms dwell. A single
// fixed node is repositioned imperatively (compositor-only transitions),
// glides between adjacent buttons, and hides on press, leave, or scroll.
export function TooltipLayer() {
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tip = tipRef.current
    if (!tip) return
    const state = { el: null as Element | null, timer: 0, visible: false }

    const hide = () => {
      window.clearTimeout(state.timer)
      state.el = null
      if (!state.visible) return
      state.visible = false
      tip.style.opacity = '0'
    }

    const show = (el: Element) => {
      const label = el.getAttribute('aria-label')
      if (!label) return
      tip.textContent = label
      const rect = el.getBoundingClientRect()
      const above = rect.top > 40
      const target = `translate3d(${rect.left + rect.width / 2}px, ${
        above ? rect.top - 6 : rect.bottom + 6
      }px, 0) translate(-50%, ${above ? '-100%' : '0%'})`
      if (!state.visible) {
        // enter is instant — the dwell was the anticipation; exit still fades
        tip.style.transitionProperty = 'none'
        tip.style.transform = target
        tip.style.opacity = '1'
        void tip.offsetWidth
        tip.style.transitionProperty = ''
        state.visible = true
      } else {
        tip.style.transform = target // glide between neighbors
      }
    }

    const onOver = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.('button[aria-label]') ?? null
      if (el === state.el) return
      window.clearTimeout(state.timer)
      state.el = el
      if (!el) {
        hide()
        return
      }
      if (state.visible) {
        show(el) // already warm: retarget without a fresh dwell
      } else {
        state.timer = window.setTimeout(() => show(el), DWELL)
      }
    }

    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) hide()
    }

    document.addEventListener('pointerover', onOver, true)
    document.addEventListener('pointerout', onOut, true)
    document.addEventListener('pointerdown', hide, true)
    window.addEventListener('blur', hide)
    window.addEventListener('scroll', hide, { passive: true, capture: true })
    return () => {
      window.clearTimeout(state.timer)
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('pointerout', onOut, true)
      document.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('blur', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  return createPortal(<div ref={tipRef} className="tooltip-chip" aria-hidden />, document.body)
}
