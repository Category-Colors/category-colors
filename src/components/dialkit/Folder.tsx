import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING, FADE } from './motion';
import { ICON_CHEVRON } from './icons';

interface FolderProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  /** Panel-header styling: title row without a chevron, never collapsible */
  isRoot?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  /** Header buttons. Toggling them on and off animates their slot open and
      closed so the chevron beside them glides instead of jumping. */
  actions?: ReactNode;
  /** Keep `actions` in the header while collapsed. For actions that act on the
      folder itself rather than on its contents — an evaluator's × removes the
      evaluator, which is as true closed as open. */
  keepActionsWhenClosed?: boolean;
  /** One line shown beside the title while collapsed, so a closed section
      still says what it holds */
  summary?: ReactNode;
}

export function Folder({
  title,
  children,
  defaultOpen = true,
  open,
  isRoot = false,
  onOpenChange,
  actions,
  keepActionsWhenClosed = false,
  summary,
}: FolderProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  // Actions that never toggle with the folder: the root header's, which never
  // collapses, and a caller's that acts on the folder itself. Both the slot's
  // visibility and whether it needs clipping follow from this one fact.
  const actionsAlwaysVisible = isRoot || keepActionsWhenClosed;

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
              <AnimatePresence initial={false}>
                {!isOpen && summary !== undefined && (
                  <motion.span
                    className="dialkit-folder-summary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                  >
                    {summary}
                  </motion.span>
                )}
              </AnimatePresence>
              <motion.svg
                className="dialkit-folder-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
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
          <AnimatePresence initial={false}>
            {/* A collapsed folder hides its actions: they act on contents
                nobody can see. The root's header is the panel's own, and
                never collapses out from under them, and an action aimed at the
                folder rather than its contents opts out via
                keepActionsWhenClosed. */}
            {actions && (isOpen || actionsAlwaysVisible) && (
              <motion.div
                key="actions"
                className="dialkit-folder-actions"
                // the slot opens with the folder's own spring, the icon fades in
                // once there is room for it and out ahead of the slot closing
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: 'auto',
                  opacity: 1,
                  transition: { width: SPRING.expand, opacity: { ...FADE, delay: 0.06 } },
                }}
                exit={{
                  width: 0,
                  opacity: 0,
                  transition: { width: SPRING.expand, opacity: FADE },
                }}
                // Only a slot that animates its width needs clipping; skipping
                // it lets the icons' hover surfaces bleed the 4px past the slot
                // that they are drawn to.
                style={actionsAlwaysVisible ? undefined : { overflow: 'hidden' }}
              >
                {actions}
              </motion.div>
            )}
          </AnimatePresence>
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
