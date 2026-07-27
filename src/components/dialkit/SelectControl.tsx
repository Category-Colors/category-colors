import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING } from './motion';
import { useAnchoredPortal, useDismiss, useWarmHover } from './use-dropdown';
import { ICON_CHEVRON } from './icons';

type SelectOption = string | { value: string; label: string };

interface SelectControlProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeOptions(options: SelectOption[]): { value: string; label: string }[] {
  return options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: toTitleCase(opt) } : opt
  );
}

export function SelectControl({ label, value, options, onChange, disabled }: SelectControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const normalized = normalizeOptions(options);
  const selectedOption = normalized.find((o) => o.value === value);

  const { portalTarget, pos } = useAnchoredPortal(isOpen, triggerRef, {
    // Estimate dropdown height: 8px padding + 32px per option
    dropdownHeight: 8 + normalized.length * 32,
  });
  useDismiss(isOpen, useCallback(() => setIsOpen(false), []), [triggerRef, dropdownRef]);
  const warmRef = useWarmHover(dropdownRef);

  return (
    <div className="dialkit-select-row">
      <button
        ref={triggerRef}
        className="dialkit-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        data-open={String(isOpen && !disabled)}
        disabled={disabled}
      >
        <span className="dialkit-select-label">{label}</span>
        <div className="dialkit-select-right">
          <span className="dialkit-select-value">{selectedOption?.label ?? value}</span>
          <motion.svg
            className="dialkit-select-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={SPRING.glyph}
          >
            <path d={ICON_CHEVRON} />
          </motion.svg>
        </div>
      </button>

      {portalTarget && createPortal(
        <AnimatePresence>
          {isOpen && pos && !disabled && (
            <motion.div
              ref={warmRef}
              className="dialkit-select-dropdown"
              initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.95 }}
              transition={SPRING.pop}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: pos.width,
                transformOrigin: pos.above ? 'bottom' : 'top',
              }}
            >
              {normalized.map((option) => (
                <button
                  key={option.value}
                  className="dialkit-select-option"
                  data-selected={String(option.value === value)}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        portalTarget
      )}
    </div>
  );
}
