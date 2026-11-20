import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * CustomSelect - Reusable, theme-adaptive custom dropdown replacement for native <select>
 *
 * @param {string|number} value - Selected value
 * @param {function} onChange - Change handler (newValue) => void
 * @param {Array<string|{value: any, label: string, icon?: any, count?: number|string}>} options - Dropdown items
 * @param {React.Component} icon - Optional icon to render on the trigger
 * @param {string} placeholder - Placeholder text
 * @param {string} className - Additional CSS classes for trigger button
 * @param {string} menuClassName - Additional CSS classes for floating menu
 * @param {'left'|'right'} align - Menu alignment
 * @param {boolean} disabled - Disable trigger
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  icon: Icon,
  placeholder = 'Select...',
  className = '',
  menuClassName = '',
  align = 'left',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Normalize options array into { value, label, icon, count }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label !== undefined ? opt.label : String(opt.value),
        icon: opt.icon,
        count: opt.count,
      };
    }
    return {
      value: opt,
      label: String(opt),
      icon: null,
      count: undefined,
    };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value).toLowerCase() === String(value).toLowerCase()
  ) || normalizedOptions.find((opt) => opt.value === value);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const SelectedIcon = selectedOption?.icon || Icon;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-[6px] transition cursor-pointer select-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs focus:outline-none ${
          isOpen ? 'ring-1 ring-blue-500/50 border-blue-500/60 dark:border-blue-500/60' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {SelectedIcon && (
            <SelectedIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({selectedOption.count})
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1 min-w-[140px] max-w-[240px] w-max max-h-60 overflow-y-auto rounded-[6px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-40 animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
        >
          {normalizedOptions.map((opt) => {
            const isSelected =
              String(opt.value).toLowerCase() === String(value).toLowerCase() ||
              opt.value === value;
            const ItemIcon = opt.icon;

            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-1.5 text-xs text-left transition cursor-pointer select-none ${
                  isSelected
                    ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-500/10'
                    : 'font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {ItemIcon && (
                    <ItemIcon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400'
                      }`}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                  {opt.count !== undefined && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({opt.count})
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
