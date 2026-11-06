import { ChevronDown, Leaf, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme, type ThemePreference } from '../lib/theme';

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'sawah', label: 'Tampilan Sekarang (Sawah)', Icon: Leaf },
  { value: 'white', label: 'Putih Bersih (White)', Icon: Sun },
  { value: 'dark', label: 'Gelap (Dark)', Icon: Moon },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[0];
  const ActiveIcon = active.Icon;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Pilih tema tampilan"
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-garis bg-panel px-3 text-xs font-bold text-tinta2 transition-colors hover:text-tinta"
      >
        <ActiveIcon size={16} aria-hidden="true" />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-12 z-50 min-w-[220px] rounded-md border border-garis bg-panel p-1.5 shadow-pop"
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <li key={value}>
              <button
                role="option"
                aria-selected={value === preference}
                onClick={() => {
                  setPreference(value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  value === preference
                    ? 'bg-cta text-ctafg'
                    : 'text-tinta2 hover:bg-panel2 hover:text-tinta'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
