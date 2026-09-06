import { ChevronsDownUpIcon, ChevronsUpDownIcon } from './icons'

// Header action that folds every section of a panel, or unfolds them all once
// none is open.
export function CollapseAllButton({
  allCollapsed,
  onToggle,
}: {
  allCollapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      className="color-row-icon"
      aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
      onClick={onToggle}
    >
      {allCollapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
    </button>
  )
}
