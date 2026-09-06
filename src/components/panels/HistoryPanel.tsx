import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { Folder, SelectControl } from '@/components/dialkit'
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
import { PanelShell } from './PanelShell'
import type { MotionValue } from 'motion/react'
import { PanelMenu } from './PanelMenu'
import { ListRow, ReorderList } from './ReorderList'
import { CollapseAllButton } from './CollapseAllButton'
import { countOf, useSections } from './sections'

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
  phone,
  open,
  onOpenChange,
  hoverToOpen,
  width,
}: {
  versions: PaletteVersion[]
  currentId: number | null
  onRestore: (version: PaletteVersion) => void
  onColorsChange: (colors: string[]) => void
  onPaletteReplace: (colors: string[]) => void
  onDeleteVersion: (id: number) => void
  onClearVersions: () => void
  phone: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  hoverToOpen: boolean
  width: MotionValue<number>
}) {
  const [format, setFormat] = useState<ExportFormat>('raw')
  // the preview is optional reading, so it starts folded
  // Nothing to show and nothing to say about it: with no versions yet, the
  // whole section goes rather than standing there empty. It keeps its open
  // state for when the first palette brings it back.
  const hasHistory = versions.length > 0
  const sections = useSections(
    ['palette', 'history', 'preview'] as const,
    ['preview'],
    hasHistory ? (['palette', 'history', 'preview'] as const) : (['palette', 'preview'] as const)
  )
  const [copied, setCopied] = useState(false)
  const previewRef = useRef<HTMLTextAreaElement>(null)
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

  // Delegated hover: one pair of listeners for the whole list. Only the
  // palette itself previews — the row's × is beside it, not part of it, so
  // reaching for the × neither opens the popover nor lights the row.
  //
  // Mouse only. The popover is a hover preview of a row you can already see,
  // and a tap has no hover to leave; it also hangs itself off the left edge of
  // the docked panel, which a sheet doesn't have — so on a phone a tap on a
  // history row would show it off the side of the screen and leave it there.
  const onListOver = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const el = (e.target as Element).closest('.color-row-chip')?.closest('[data-version]')
    if (!el) {
      popover.current?.hide()
      return
    }
    const version = versions.find((v) => v.id === Number(el.getAttribute('data-version')))
    if (version) popover.current?.show(version, el)
  }
  const onListLeave = () => popover.current?.hide()

  // the rows unmount when the panel collapses; the popover must follow
  useEffect(() => {
    if (!open) popover.current?.hide()
  }, [open])

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
    <PanelShell
      side="right"
      name="Output"
      phone={phone}
      open={open}
      onOpenChange={onOpenChange}
      hoverToOpen={hoverToOpen}
      width={width}
    >
      <Folder
        title="Output"
        isRoot
        actions={
          <>
            <PanelMenu
              items={[{ label: 'Import palette…', onClick: () => fileRef.current?.click() }]}
            />
            <CollapseAllButton allCollapsed={sections.allCollapsed} onToggle={sections.toggleAll} />
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
        {/* Both formats sit above the sections, like the config panel's
            Colors row: they govern everything below and what the footer
            copies and downloads */}
        <SelectControl
          label="Color format"
          value={formatValue}
          options={formatOptions}
          onChange={convertAll}
        />
        <SelectControl
          label="Output format"
          value={format}
          options={EXPORT_FORMATS}
          onChange={(v) => setFormat(v as ExportFormat)}
        />
        <Folder
          title="Palette"
          open={sections.open.palette}
          onOpenChange={sections.setSection('palette')}
          summary={countOf(items.length, 'color')}
          actions={
            items.length > 0 && (
              <button className="color-row-icon" aria-label="Delete all" onClick={() => commit([])}>
                <TrashIcon />
              </button>
            )
          }
        >
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
        {hasHistory && (
          <Folder
            title="History"
            open={sections.open.history}
            onOpenChange={sections.setSection('history')}
            summary={countOf(versions.length, 'version')}
            actions={
              <button className="color-row-icon" aria-label="Delete all" onClick={onClearVersions}>
                <TrashIcon />
              </button>
            }
          >
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
          </Folder>
        )}
        <Folder
          title="Preview"
          open={sections.open.preview}
          onOpenChange={sections.setSection('preview')}
        >
          {current ? (
            <div className="export-preview-frame">
              {/* A read-only textarea rather than a <pre>: it's focusable and
                  selectable on its own, so the platform's select-all works
                  here without the app owning a shortcut. */}
              <textarea
                ref={previewRef}
                className="export-preview"
                aria-label="Palette export"
                readOnly
                spellCheck={false}
                value={formatPalette(formatted, format)}
              />
              <ScrollOverlay scrollerRef={previewRef} watch={`${format}:${formatted.length}`} />
            </div>
          ) : (
            <p className="panel-status">Generate a palette to preview its export.</p>
          )}
        </Folder>
      </Folder>
      <div className="panel-footer">
        <div className="dialkit-button-group">
          <button
            className="dialkit-button square-button"
            data-active={String(copied)}
            // static name: the checkmark carries the confirmation, and a
            // label that changes mid-hover leaves the tooltip stale
            aria-label="Copy to clipboard"
            disabled={!current}
            onClick={copy}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          <button
            className="dialkit-button"
            disabled={!current}
            onClick={() => downloadPalette(formatted, format)}
          >
            Download
          </button>
        </div>
      </div>
      <HistoryPopover ref={popover} />
    </PanelShell>
  )
}
