import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { AuthUser, LoginPayload, RegisterPayload } from '../types';

const TOKEN_KEY = 'rp_auth_token';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) { setIsLoading(false); return; }
      try {
        const me = await api.getMe(token);
        setUser({ ...me, access_token: token });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const data = await api.login(payload);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await api.register(payload);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    setUser(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
