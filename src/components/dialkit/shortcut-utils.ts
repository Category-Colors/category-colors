// Trimmed from joshpuckett/dialkit src/shortcut-utils.ts — only the pure
// helpers the controls use; the DialStore-coupled functions were left behind.

import type { ShortcutConfig } from './types';

// ── Math helpers ──

export function decimalsForStep(step: number): number {
  const s = step.toString();
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function roundValue(val: number, step: number): number {
  const raw = Math.round(val / step) * step;
  return parseFloat(raw.toFixed(decimalsForStep(step)));
}

export function snapToDecile(rawValue: number, min: number, max: number): number {
  const normalized = (rawValue - min) / (max - min);
  const nearest = Math.round(normalized * 10) / 10;
  if (Math.abs(normalized - nearest) <= 0.03125) {
    return min + nearest * (max - min);
  }
  return rawValue;
}

// ── Formatting helpers ──

export function formatInteractionLabel(interaction: string): string {
  switch (interaction) {
    case 'drag': return 'Drag';
    case 'move': return 'Move';
    case 'scroll-only': return 'Scroll';
    default: return 'Scroll';
  }
}

export function formatSliderShortcut(sc: ShortcutConfig): string {
  const interaction = sc.interaction ?? 'scroll';
  const actionLabel = formatInteractionLabel(interaction);
  if (!sc.key) return actionLabel;
  const mod = formatModifier(sc.modifier);
  return `${mod}${sc.key.toUpperCase()}+${actionLabel}`;
}

export function formatToggleShortcut(sc: ShortcutConfig): string {
  if (!sc.key) return 'Press';
  const mod = formatModifier(sc.modifier);
  return `${mod}${sc.key.toUpperCase()}`;
}

function formatModifier(modifier?: string): string {
  return modifier === 'alt' ? '⌥'
    : modifier === 'shift' ? '⇧'
    : modifier === 'meta' ? '⌘'
    : '';
}
