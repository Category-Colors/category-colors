import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { SPRING } from '@/components/dialkit'
import { useAnchoredPortal, useDismiss, useWarmHover } from '@/components/dialkit/use-dropdown'
import { extractColors } from '@/lib/extract-colors'
import { PRESET_PALETTES } from '@/lib/presets'
import { PhotoIcon, PlusIcon, SwatchesIcon } from './icons'

interface Extracted {
  url: string
  colors: string[]
  selected: string[]
}

// Add-row for color lists: plain add, add-from-image (popover with a drop
// zone that extracts a palette from a picture), and a presets menu that
// swaps the whole list. `ghost` renders the same three actions as small
// text buttons for use inside an empty-state slot.
export function AddColorBar({
  label = 'Add color',
  ghost = false,
  onAdd,
  onAddMany,
  onReplace,
}: {
  label?: string
  ghost?: boolean
  onAdd: () => void
  onAddMany: (hexes: string[]) => void
  onReplace: (hexes: string[]) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const presetsRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const imagePopRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // The image popover anchors to the whole bar and also resolves the portal
  // root the presets menu reuses.
  const { portalTarget, pos: imagePos } = useAnchoredPortal(imageOpen, barRef, {
    dropdownHeight: 300,
  })

  // The presets menu is right-aligned to its trigger rather than left-aligned
  // and trigger-width, so it measures itself instead of using the shared helper
  useEffect(() => {
    if (!menuOpen || !presetsRef.current || !portalTarget) return
    const t = presetsRef.current.getBoundingClientRect()
    const root = portalTarget.getBoundingClientRect()
    setMenuPos({ top: t.bottom - root.top + 4, right: root.right - t.right })
  }, [menuOpen, portalTarget])

  // Every preview url is revoked exactly once — when it's replaced, cleared,
  // or the bar unmounts — so a session of retries can't strand blobs.
  const previewUrl = useRef<string | null>(null)
  const setPreview = useCallback((url: string | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
    previewUrl.current = url
  }, [])
  useEffect(() => () => setPreview(null), [setPreview])

  const clearExtracted = useCallback(() => {
    setPreview(null)
    setExtracted(null)
    setFailed(false)
  }, [setPreview])

  const closeImage = useCallback(() => {
    setImageOpen(false)
    setDragOver(false)
    clearExtracted()
  }, [clearExtracted])

  useDismiss(menuOpen, useCallback(() => setMenuOpen(false), []), [presetsRef, menuRef])
  const warmMenuRef = useWarmHover(menuRef)
  useDismiss(imageOpen, closeImage, [barRef, imagePopRef])

  // While the image popover is open, pasting an image anywhere in the window
  // feeds it into the extractor
  useEffect(() => {
    if (!imageOpen) return
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) {
        e.preventDefault()
        openImage(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageOpen])

  // Anything the browser can't decode (or an image with no usable colors)
  // lands back on the drop zone with a retry message rather than silently
  // doing nothing.
  const openImage = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setFailed(false)
    try {
      const colors = await extractColors(file, 8)
      if (colors.length) {
        const url = URL.createObjectURL(file)
        setPreview(url)
        setExtracted({ url, colors, selected: [...colors] })
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const toggleSwatch = (hex: string) =>
    setExtracted((d) =>
      d
        ? {
            ...d,
            selected: d.selected.includes(hex)
              ? d.selected.filter((s) => s !== hex)
              : [...d.selected, hex],
          }
        : d
    )

  return (
    <div ref={barRef} className={ghost ? 'add-bar-ghost' : 'add-bar'}>
      {ghost ? (
        <>
          <button className="ghost-button" onClick={onAdd}>
            <PlusIcon />
            {label}
          </button>
          <button
            className="ghost-button"
            data-open={String(imageOpen)}
            onClick={() => (imageOpen ? closeImage() : setImageOpen(true))}
          >
            <PhotoIcon />
            From image
          </button>
          <button
            ref={presetsRef}
            className="ghost-button"
            data-open={String(menuOpen)}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <SwatchesIcon />
            Presets…
          </button>
        </>
      ) : (
        <>
          <button className="dialkit-button add-bar-main" onClick={onAdd}>
            {label}
          </button>
          <button
            className="dialkit-button add-bar-icon"
            data-open={String(imageOpen)}
            aria-label="Add from image…"
            onClick={() => (imageOpen ? closeImage() : setImageOpen(true))}
          >
            <PhotoIcon />
          </button>
          <button
            ref={presetsRef}
            className="dialkit-button add-bar-icon"
            data-open={String(menuOpen)}
            aria-label="Swap in a preset…"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <SwatchesIcon />
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          openImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {menuOpen && menuPos && (
              <motion.div
                ref={warmMenuRef}
                className="dialkit-select-dropdown preset-menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={SPRING.pop}
                style={{ position: 'absolute', top: menuPos.top, right: menuPos.right }}
              >
                {PRESET_PALETTES.map((preset) => (
                  <button
                    key={preset.name}
                    className="dialkit-select-option preset-option"
                    data-selected="false"
                    onClick={() => {
                      setMenuOpen(false)
                      onReplace(preset.colors)
                    }}
                  >
                    <span>{preset.name}</span>
                    <span className="preset-swatches">
                      {preset.colors.map((hex) => (
                        <i key={hex} style={{ backgroundColor: hex }} />
                      ))}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}

      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {imageOpen && imagePos && (
              <motion.div
                ref={imagePopRef}
                className="color-picker-popover image-popover"
                initial={{ opacity: 0, y: imagePos.above ? 8 : -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: imagePos.above ? 8 : -8, scale: 0.97 }}
                transition={SPRING.pop}
                style={{
                  position: 'absolute',
                  left: imagePos.left,
                  top: imagePos.top,
                  width: imagePos.width,
                  transformOrigin: imagePos.above ? 'bottom' : 'top',
                }}
              >
                {extracted ? (
                  <>
                    <img className="image-preview" src={extracted.url} alt="" />
                    <div className="image-swatches">
                      {extracted.colors.map((hex) => (
                        <button
                          key={hex}
                          className="image-swatch"
                          data-selected={String(extracted.selected.includes(hex))}
                          style={{ backgroundColor: hex }}
                          aria-label={hex}
                          onClick={() => toggleSwatch(hex)}
                        />
                      ))}
                    </div>
                    <div className="image-actions dialkit-button-group">
                      <button className="dialkit-button" onClick={clearExtracted}>
                        Back
                      </button>
                      <button
                        className="dialkit-button"
                        disabled={extracted.selected.length === 0}
                        onClick={() => {
                          onAddMany(extracted.colors.filter((c) => extracted.selected.includes(c)))
                          closeImage()
                        }}
                      >
                        Add {extracted.selected.length}
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    className="image-drop"
                    data-over={String(dragOver)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOver(false)
                      openImage(e.dataTransfer.files?.[0])
                    }}
                  >
                    {busy ? (
                      <span>Extracting…</span>
                    ) : (
                      <>
                        <span>
                          {failed
                            ? "Couldn't read colors from that image"
                            : 'Drop or paste an image'}
                        </span>
                        <button
                          className="image-pick-link"
                          onClick={() => fileRef.current?.click()}
                        >
                          or pick a file…
                        </button>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  )
}
