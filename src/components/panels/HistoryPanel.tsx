import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { SegmentedControl, ButtonGroup, Folder, SelectControl } from '@/components/dialkit'
import type { PaletteVersion } from '@/lib/palette'
import {
  convertValue,
  hexValue,
  parseCssColor,
  valueToCss,
  type ColorValue,
  type Space,
} from '@/lib/color'
import {
  EXPORT_FORMATS,
  copyText,
  downloadPalette,
  formatPalette,
  parsePalette,
  type ExportFormat,
} from '@/lib/exporters'
import { ScrollOverlay } from '@/components/ScrollOverlay'
import { AddColorBar } from './AddColorBar'
import { ColorRow } from './ColorRow'
import { HistoryPopover, type HistoryPopoverHandle } from './HistoryPopover'
import { CheckIcon, CopyIcon, TrashIcon, XIcon } from './icons'
import { MorphPanel } from './MorphPanel'
import { PanelMenu } from './PanelMenu'
import { ListRow, ReorderList } from './ReorderList'

// ReorderList and row animations need stable identity, which bare color
// strings can't provide — the palette is mirrored locally as id-tagged rows.
// Each row keeps its own ColorValue, so per-color formats survive; the
// version stores css strings, which carry the format through the round-trip.
interface PaletteItem {
  id: number
  value: ColorValue
}

let nextItemId = 1
const MAX_PALETTE_BYTES = 5_000_000

const COLOR_FORMATS: { value: Space; label: string }[] = [
  { value: 'hex', label: 'Hex' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
  { value: 'oklch', label: 'OKLCH' },
  { value: 'oklab', label: 'OKLAB' },
]

function VersionRow({
  version,
  active,
  onRestore,
  onDelete,
}: {
  version: PaletteVersion
  active: boolean
  onRestore: () => void
  onDelete: () => void
}) {
  return (
    // same anatomy as ColorRow: a restore chip with the actions outside it
    <div className="version-row" data-version={version.id}>
      <button
        type="button"
        className="color-row-chip"
        data-open={String(active)}
        onClick={onRestore}
      >
        <span className="version-facepile">
          {version.colors.map((hex, i) => (
            <span key={i} className="version-chip" style={{ backgroundColor: hex }} />
          ))}
        </span>
      </button>
      <div className="color-row-actions">
        <button className="color-row-icon" aria-label="Remove" onClick={onDelete}>
          <XIcon />
        </button>
      </div>
    </div>
  )
}

export function HistoryPanel({
  versions,
  currentId,
  onRestore,
  onColorsChange,
  onPaletteReplace,
  onDeleteVersion,
  onClearVersions,
  minimized,
  onMinimizedChange,
}: {
  versions: PaletteVersion[]
  currentId: number | null
  onRestore: (version: PaletteVersion) => void
  onColorsChange: (colors: string[]) => void
  onPaletteReplace: (colors: string[]) => void
  onDeleteVersion: (id: number) => void
  onClearVersions: () => void
  minimized: boolean
  onMinimizedChange: (minimized: boolean) => void
}) {
  const [format, setFormat] = useState<ExportFormat>('raw')
  const [copied, setCopied] = useState(false)
  const previewRef = useRef<HTMLPreElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const popover = useRef<HistoryPopoverHandle>(null)

  const current = versions.find((v) => v.id === currentId) ?? null
  const newestFirst = [...versions].reverse()

  // id-stable mirror of the current palette. Rebuilt only when the current
  // VERSION changes (generate, restore, preset, import, delete) — never by
  // comparing values. Edits from this panel write through to the version, so
  // a value compare races against our own in-flight echo: when renders lag a
  // fast picker drag, mirror and version can hold different moments of the
  // same edit, and a compare would "detect" an external change and rebuild,
  // remounting every row and killing the open picker. The version id is the
  // one signal that only external changes move. Initialized synchronously so
  // the first paint already has rows, and `gen` keys the list so rebuilds
  // swap in instantly — row animations are reserved for add/remove.
  const buildItems = (colors: string[]): PaletteItem[] =>
    colors.map((color) => ({ id: nextItemId++, value: parseCssColor(color) ?? hexValue(color) }))
  const [palette, setPalette] = useState(() => ({
    gen: 0,
    items: buildItems(current?.colors ?? []),
  }))
  const items = palette.items
  const mirroredId = useRef(currentId)
  useEffect(() => {
    if (currentId === mirroredId.current) return
    mirroredId.current = currentId
    const colors = current?.colors ?? []
    setPalette((prev) => ({ gen: prev.gen + 1, items: buildItems(colors) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId])

  const commit = (next: PaletteItem[]) => {
    setPalette((prev) => ({ ...prev, items: next }))
    onColorsChange(next.map((item) => valueToCss(item.value)))
  }

  // the format select reflects the rows: one shared space, or 'multiple'
  // when the user has mixed formats; picking a space converts every row
  const spaces = new Set(items.map((item) => item.value.space))
  const formatValue = spaces.size === 1 ? [...spaces][0] : spaces.size === 0 ? 'hex' : 'multiple'
  const formatOptions =
    formatValue === 'multiple'
      ? [{ value: 'multiple', label: 'Multiple' }, ...COLOR_FORMATS]
      : COLOR_FORMATS
  const convertAll = (space: string) => {
    if (space === 'multiple') return
    commit(items.map((item) => ({ ...item, value: convertValue(item.value, space as Space) })))
  }

  // same three-way add bar as the config panel's Initialize section
  const paletteAddBar = (ghost?: boolean) => (
    <AddColorBar
      ghost={ghost}
      onAdd={() => commit([...items, { id: nextItemId++, value: hexValue('#888888') }])}
      onAddMany={(hexes) =>
        commit([...items, ...hexes.map((hex) => ({ id: nextItemId++, value: hexValue(hex) }))])
      }
      onReplace={onPaletteReplace} // presets are a new palette, not an edit
    />
  )

  const fileRef = useRef<HTMLInputElement>(null)
  const importPalette = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_PALETTE_BYTES) {
      alert('That palette file is too large.')
      return
    }
    file.text().then(
      (text) => {
        const colors = parsePalette(text)
        if (colors.length > 0) onPaletteReplace(colors)
        else alert('No colors found in that file.')
      },
      () => alert("That file couldn't be read.")
    )
  }

  // delegated hover: one pair of listeners for the whole list
  const onListOver = (e: React.PointerEvent) => {
    const el = (e.target as Element).closest('[data-version]')
    if (!el) return
    const version = versions.find((v) => v.id === Number(el.getAttribute('data-version')))
    if (version) popover.current?.show(version, el)
  }
  const onListLeave = () => popover.current?.hide()

  // the rows unmount when the panel collapses; the popover must follow
  useEffect(() => {
    if (minimized) popover.current?.hide()
  }, [minimized])

  useEffect(() => () => clearTimeout(copyTimer.current ?? undefined), [])

  // version colors are css strings that already carry each color's format
  const formatted = current?.colors ?? []

  const copy = async () => {
    if (!current) return
    const success = await copyText(formatPalette(formatted, format))
    if (!success) return
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 1000)
  }

  return (
    <MorphPanel side="right" minimized={minimized} onMinimizedChange={onMinimizedChange}>
      <Folder
        title="Output"
        isRoot
        actions={
          <>
            <PanelMenu
              items={[{ label: 'Import palette…', onClick: () => fileRef.current?.click() }]}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,.css,application/json,text/plain,text/css"
              hidden
              onChange={(e) => {
                importPalette(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </>
        }
      >
        <Folder
          title="Palette"
          actions={
            <button className="color-row-icon" aria-label="Delete all" onClick={() => commit([])}>
              <TrashIcon />
            </button>
          }
        >
          <SelectControl
            label="Format"
            value={formatValue}
            options={formatOptions}
            onChange={convertAll}
          />
          <ReorderList
            key={palette.gen}
            className="panel-list"
            items={items}
            onReorder={commit}
            empty="No colors"
            emptyActions={paletteAddBar(true)}
          >
            {(item, i) => (
              <ColorRow
                value={item.value}
                onValueChange={(value) =>
                  commit(items.map((it, k) => (k === i ? { ...it, value } : it)))
                }
                onCopy={() => copyText(valueToCss(item.value))}
                onRemove={() => commit(items.filter((_, k) => k !== i))}
              />
            )}
          </ReorderList>
          <AnimatePresence initial={false}>
            {items.length > 0 && <ListRow key="add-bar">{paletteAddBar()}</ListRow>}
          </AnimatePresence>
        </Folder>
        <Folder
          title="History"
          actions={
            <button className="color-row-icon" aria-label="Delete all" onClick={onClearVersions}>
              <TrashIcon />
            </button>
          }
        >
          {versions.length === 0 ? (
            <p className="panel-status">Generate a palette to start a history.</p>
          ) : (
            <div className="version-list" onPointerOver={onListOver} onPointerLeave={onListLeave}>
              {newestFirst.map((v) => (
                <VersionRow
                  key={v.id}
                  version={v}
                  active={v.id === currentId}
                  onRestore={() => onRestore(v)}
                  onDelete={() => {
                    popover.current?.hide() // its anchor row is going away
                    onDeleteVersion(v.id)
                  }}
                />
              ))}
            </div>
          )}
        </Folder>
        <Folder title="Export">
          <SegmentedControl
            options={EXPORT_FORMATS}
            value={format}
            onChange={(v) => setFormat(v as ExportFormat)}
          />
          {current && (
            // copy is an inset affordance on the preview it acts on, which
            // leaves download as the panel's single primary action
            <div className="export-preview-frame">
              {/* tabIndex keeps the region reachable by keyboard now that the
                  native scrollbar is hidden */}
              <pre ref={previewRef} className="export-preview" tabIndex={0}>
                {formatPalette(formatted, format)}
              </pre>
              <ScrollOverlay scrollerRef={previewRef} watch={`${format}:${formatted.length}`} />
              <button
                className="color-row-icon export-copy"
                data-active={String(copied)}
                // static name: the checkmark carries the confirmation, and a
                // label that changes mid-hover leaves the tooltip stale
                aria-label="Copy to clipboard"
                onClick={copy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          )}
        </Folder>
      </Folder>
      <div className="panel-footer">
        <ButtonGroup
          buttons={[
            {
              label: 'Download',
              onClick: () => downloadPalette(formatted, format),
              disabled: !current,
            },
          ]}
        />
      </div>
      <HistoryPopover ref={popover} />
    </MorphPanel>
  )
}
