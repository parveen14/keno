import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('keno_user');
    return raw ? JSON.parse(raw) : null;
  });

  const applySession = useCallback((session) => {
    localStorage.setItem('keno_token', session.token);
    localStorage.setItem('keno_user', JSON.stringify(session.user));
    setUser(session.user);
  }, []);

  const loginWithPassword = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    applySession(data);
  }, [applySession]);

  const loginAsDemoUser = useCallback(async (userId) => {
    const { data } = await api.post(`/auth/login-as/${userId}`);
    applySession(data);
  }, [applySession]);

  const logout = useCallback(() => {
    localStorage.removeItem('keno_token');
    localStorage.removeItem('keno_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loginWithPassword, loginAsDemoUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
