import type { ReactNode } from 'react'
import type { MotionValue } from 'motion/react'
import { Sheet } from '@/components/mobile/Sheet'
import { useIsPhone } from '@/lib/use-media'
import { MorphPanel } from './MorphPanel'

/**
 * The container a panel's body lands in, chosen by viewport.
 *
 * Wide, it's the docked glass panel that morphs into a puck. On a phone the
 * same body goes into a bottom sheet — the dock's collapse target is a 42px
 * puck at the screen edge, and two of those cost a quarter of a phone's width
 * before any content is drawn.
 *
 * Both shells render the panel body inside the same `.dialkit-panel` scroller,
 * so the sticky header and the sticky `.panel-footer` behave identically in
 * each and neither body needs to know which one it's in.
 */
export function PanelShell({
  side,
  name,
  open,
  onOpenChange,
  hoverToOpen,
  width,
  children,
}: {
  side: 'left' | 'right'
  name: string
  open: boolean
  onOpenChange: (open: boolean) => void
  hoverToOpen: boolean
  width: MotionValue<number>
  children: ReactNode
}) {
  // Asked here rather than threaded down from App: the panels themselves never
  // read it, and it is the same subscription to the same query either way.
  const phone = useIsPhone()
  // One wrapper, built here rather than once per shell, and named: every rule
  // that styles a panel body targets `.panel-shell` and neither shell's class
  // appears in it. Only the two rules that set the scroller's extent differ,
  // because that is the only thing that actually differs.
  const body = (
    <div className="panel-shell dialkit-panel" data-mode="inline">
      <div className="dialkit-panel-inner">{children}</div>
    </div>
  )
  if (phone) {
    return (
      <Sheet open={open} onClose={() => onOpenChange(false)} label={name}>
        {body}
      </Sheet>
    )
  }
  return (
    <MorphPanel
      side={side}
      name={name}
      minimized={!open}
      onMinimizedChange={(minimized) => onOpenChange(!minimized)}
      hoverToOpen={hoverToOpen}
      width={width}
    >
      {body}
    </MorphPanel>
  )
}
