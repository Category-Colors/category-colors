import { SegmentedControl } from './SegmentedControl';
import type { ShortcutConfig } from './types';
import { formatToggleShortcut } from './shortcut-utils';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  shortcut?: ShortcutConfig;
  shortcutActive?: boolean;
}

export function Toggle({ label, checked, onChange, shortcut, shortcutActive }: ToggleProps) {
  return (
    <div
      className="dialkit-labeled-control dialkit-toggle-row"
      // The label and the gap beside it are part of the target, the way a
      // <label> extends a checkbox's. A click that landed on a segment is
      // that segment's to answer — flipping as well would undo it.
      // Deliberately no role or tabIndex: the segments are already the
      // accessible control, and wrapping them would nest one interactive
      // element inside another and add a second tab stop for the same thing.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.dialkit-segmented')) return;
        onChange(!checked);
      }}
    >
      <span className="dialkit-labeled-control-label">
        {label}
        {shortcut && (
          <span className={`dialkit-shortcut-pill${shortcutActive ? ' dialkit-shortcut-pill-active' : ''}`}>
            {formatToggleShortcut(shortcut)}
          </span>
        )}
      </span>
      <SegmentedControl
        options={[
          { value: 'off' as const, label: 'Off' },
          { value: 'on' as const, label: 'On' },
        ]}
        value={checked ? 'on' : 'off'}
        onChange={(val) => onChange(val === 'on')}
      />
    </div>
  );
}
