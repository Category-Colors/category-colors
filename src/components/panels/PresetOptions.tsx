import { PRESET_PALETTES } from '@/lib/presets'

// The preset palettes as dropdown rows, each name over a swatch strip: the
// add bar's presets menu and the Configuration menu's Load a preset
export function PresetOptions({ onPick }: { onPick: (colors: string[]) => void }) {
  return PRESET_PALETTES.map((preset) => (
    <button
      key={preset.name}
      className="dialkit-select-option preset-option"
      data-selected="false"
      onClick={() => onPick([...preset.colors])}
    >
      <span>{preset.name}</span>
      <span className="preset-swatches">
        {preset.colors.map((hex) => (
          <i key={hex} style={{ backgroundColor: hex }} />
        ))}
      </span>
    </button>
  ))
}
