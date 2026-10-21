import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);

  // Synchronize authenticated profile across page reloads & refreshes
  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api
      .getMe()
      .then((res) => {
        if (isMounted && res.success && res.user) {
          setUser((prev) => {
            const merged = { ...(prev || {}), ...res.user };
            localStorage.setItem('user', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('[AuthContext] Session synchronization check:', err.message);
        if (err.status === 401 || err.status === 403) {
          logout();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = async (identifier, password) => {
    setLoading(true);
    try {
      const res = await api.login(identifier, password);
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) await api.logout().catch(() => {});
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  };

  const setAuthSession = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const updateUser = (fields) => {
    setUser((prev) => {
      const updated = { ...prev, ...fields };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, setAuthSession, isAuthenticated: !!token }}>
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
