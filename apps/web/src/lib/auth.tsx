import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchMe, logoutRequest } from './api';
import { useTheme } from './theme';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  nip?: string | null;
  must_change_password: boolean;
  theme_preference?: string | null;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_KEY = 'jagapadi_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { applyProfileTheme } = useTheme();
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    try {
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  });

  // Revalidasi sesi cookie ke server saat aplikasi dibuka (sesi bisa dicabut oleh admin).
  // Bila kedaluwarsa di tengah penggunaan, apiFetch memancarkan event session-expired
  // dan AppShell mengalihkan ke /login lewat router (tanpa reload penuh).
  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        localStorage.setItem(USER_KEY, JSON.stringify(me));
        applyProfileTheme(me.theme_preference);
      })
      .catch(() => {
        // 401 sudah ditangani apiFetch (bersihkan sesi lokal)
      });

    const onExpired = () => {
      setUser(null);
      localStorage.removeItem(USER_KEY);
    };
    window.addEventListener('jagapadi:session-expired', onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('jagapadi:session-expired', onExpired);
    };
  }, []);

  const login = useCallback((newUser: AuthUser) => {
    setUser(newUser);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    void logoutRequest(); // cabut sesi di server (best effort)
    setUser(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const hasRole = useCallback((role: string) => user?.roles.includes(role) ?? false, [user]);
  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
