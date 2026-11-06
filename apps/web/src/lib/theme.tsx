import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { saveThemePreference } from './api';

export type ThemePreference = 'sawah' | 'white' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  applyProfileTheme: (profileTheme?: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'jagapadi-theme';
const THEME_CLASSES: ThemePreference[] = ['sawah', 'white', 'dark'];

function readStored(): ThemePreference | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'sawah' || saved === 'white' || saved === 'dark' ? saved : null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => (typeof window === 'undefined' ? 'sawah' : readStored() ?? 'sawah'),
  );

  useEffect(() => {
    const root = document.documentElement;
    for (const cls of THEME_CLASSES) root.classList.remove(`theme-${cls}`);
    root.classList.add(`theme-${preference}`);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, value);
    setPreferenceState(value);
    // Sinkronkan ke profil user bila terautentikasi (gagal diam-diam bila 401)
    void saveThemePreference(value).catch(() => undefined);
  }, []);

  /** AuthProvider memanggil ini setelah /me sukses: terapkan tema profil bila user belum memilih manual. */
  const applyProfileTheme = useCallback((profileTheme?: string | null) => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (profileTheme === 'sawah' || profileTheme === 'white' || profileTheme === 'dark') {
      setPreferenceState(profileTheme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, setPreference, applyProfileTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
