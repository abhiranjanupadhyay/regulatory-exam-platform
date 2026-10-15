import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [displaced, setDisplaced] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setDisplaced(false);
  }, []);

  useEffect(() => {
    if (getToken()) {
      api('/api/users/me').then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    }
    const onDisplaced = () => setDisplaced(true);
    const onUnauthorized = () => logout();
    window.addEventListener('session-displaced', onDisplaced);
    window.addEventListener('unauthorized', onUnauthorized);
    return () => {
      window.removeEventListener('session-displaced', onDisplaced);
      window.removeEventListener('unauthorized', onUnauthorized);
    };
  }, [logout]);

  // Heartbeat: any 401 SESSION_DISPLACED from the gateway flips the app to the lock screen.
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(() => api('/api/users/me').catch(() => {}), 20000);
    return () => clearInterval(id);
  }, [user]);

  const finish = ({ token, user: u }) => {
    setToken(token);
    setUser(u);
    setDisplaced(false);
    return u;
  };
  const login = async (idToken) => finish(await api('/api/auth/login', { method: 'POST', body: { idToken } }));
  const register = async (payload) => finish(await api('/api/auth/register', { method: 'POST', body: payload }));

  return (
    <AuthContext.Provider value={{ user, loading, displaced, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
