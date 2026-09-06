import type { ReactNode } from 'react'
import type { MotionValue } from 'motion/react'
import { Sheet } from '@/components/mobile/Sheet'
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
  phone,
  open,
  onOpenChange,
  hoverToOpen,
  width,
  children,
}: {
  side: 'left' | 'right'
  name: string
  phone: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  hoverToOpen: boolean
  width: MotionValue<number>
  children: ReactNode
}) {
  if (phone) {
    return (
      <Sheet open={open} onClose={() => onOpenChange(false)} label={name}>
        <div className="dialkit-panel" data-mode="inline">
          <div className="dialkit-panel-inner">{children}</div>
        </div>
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
      {children}
    </MorphPanel>
  )
}
