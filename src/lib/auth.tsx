import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { get, post } from './api';

export interface User { id: number; email: string; name: string; role: 'office' | 'member'; memberId: number | null; isDemo: boolean }
interface AuthState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthCtx = createContext<AuthState>({ user: null, ready: false, setUser: () => {}, signOut: async () => {}, refresh: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await get<{ user: User }>('/api/auth/me');
      setUser(r.user);
    } catch {
      setUser(null);
    }
  }, []);
  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);
  const signOut = useCallback(async () => {
    try { await post('/api/auth/logout'); } catch { /* the cookie is cleared on the next request anyway */ }
    setUser(null);
  }, []);
  return <AuthCtx.Provider value={{ user, ready, setUser, signOut, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
