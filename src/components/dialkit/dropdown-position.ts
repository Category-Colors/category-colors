export type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  above: boolean;
};

export type DropdownPositionOptions = {
  dropdownHeight?: number;
  gap?: number;
  allowAbove?: boolean;
};

export function getDropdownPosition(
  trigger: HTMLElement,
  portalRoot: HTMLElement,
  options: DropdownPositionOptions = {}
): DropdownPosition {
  const { dropdownHeight = 0, gap = 4, allowAbove = true } = options;
  const triggerRect = trigger.getBoundingClientRect();
  const rootRect = portalRoot.getBoundingClientRect();
  const spaceBelow = window.innerHeight - triggerRect.bottom - gap;
  const above = allowAbove && spaceBelow < dropdownHeight && triggerRect.top > spaceBelow;

  return {
    top: above
      ? triggerRect.top - rootRect.top - dropdownHeight - gap
      : triggerRect.bottom - rootRect.top + gap,
    left: triggerRect.left - rootRect.left,
    width: triggerRect.width,
    above,
  };
}

export function getDialKitPortalRoot(trigger: HTMLElement | null | undefined): HTMLElement | null {
  return (trigger?.closest('.dialkit-root') as HTMLElement | null) ?? null;
}

/**
 * Whether a pointer event came from something that can hover.
 *
 * Every surface in this app that opens on `pointerover` and closes on
 * `pointerleave` needs this. A touch has no hover to leave: the tap fires
 * pointerover, the surface appears, and nothing takes it away again until the
 * next tap lands somewhere else — so a preview meant to follow a cursor
 * becomes a panel stuck on screen. Worse for anything whose contents change
 * under a resting finger, which fires a fresh pointerover after its own
 * pointerdown and re-raises what the press just dismissed.
 *
 * Asked per event rather than by media query, so a laptop with a touchscreen
 * still gets its hover surfaces from the mouse. Charts are deliberately not
 * callers: their tooltips track a moving pointer rather than waiting on a
 * dwell, and a drag across one reads correctly on touch.
 */
export const isHoverPointer = (e: { pointerType: string }) => e.pointerType === 'mouse'
