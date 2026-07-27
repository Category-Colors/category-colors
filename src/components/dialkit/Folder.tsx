import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING } from './motion';
import { ICON_CHEVRON } from './icons';

interface FolderProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  /** Panel-header styling: title row without a chevron, never collapsible */
  isRoot?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  actions?: ReactNode;
}

export function Folder({
  title,
  children,
  defaultOpen = true,
  open,
  isRoot = false,
  onOpenChange,
  actions,
}: FolderProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const handleToggle = () => {
    if (isRoot) return;
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const folderContent = (
    <div
      className={`dialkit-folder ${isRoot ? 'dialkit-folder-root' : ''}`}
      data-open={String(isOpen)}
    >
      <div className={`dialkit-folder-header ${isRoot ? 'dialkit-panel-header' : ''}`}>
        <div className="dialkit-folder-header-top">
          {isRoot ? (
            <div className="dialkit-folder-title-row">
              <span className="dialkit-folder-title dialkit-folder-title-root">{title}</span>
            </div>
          ) : (
            <button
              type="button"
              className="dialkit-folder-title-row"
              aria-expanded={isOpen}
              onClick={handleToggle}
            >
              <span className="dialkit-folder-title">{title}</span>
              <motion.svg
                className="dialkit-folder-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={SPRING.glyph}
              >
                <path d={ICON_CHEVRON} />
              </motion.svg>
            </button>
          )}
          {actions && (
            <div className="dialkit-folder-actions">{actions}</div>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="dialkit-folder-content"
            initial={isRoot ? undefined : { height: 0, opacity: 0 }}
            animate={isRoot ? undefined : { height: 'auto', opacity: 1 }}
            exit={isRoot ? undefined : { height: 0, opacity: 0 }}
            transition={isRoot ? undefined : SPRING.expand}
            style={isRoot ? undefined : { clipPath: 'inset(0 -20px)' }}
          >
            <div className="dialkit-folder-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // The root folder keeps its own padded wrapper inside the host panel; the
  // two nested .dialkit-panel-inner layers are what produce the panel inset.
  return isRoot ? (
    <div className="dialkit-panel-inner dialkit-panel-inline">{folderContent}</div>
  ) : (
    folderContent
  );
}
