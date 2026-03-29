import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check both localStorage (remember me) and sessionStorage (session-only)
    const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const savedUser  = localStorage.getItem('user')  || sessionStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (_) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  /**
   * login(tokenVal, userData, rememberMe)
   *   rememberMe=true  → localStorage  (persists across browser restarts, 30-day JWT)
   *   rememberMe=false → sessionStorage (cleared when tab/browser closes, 24h JWT)
   */
  const login = (tokenVal, userData, rememberMe = false) => {
    setToken(tokenVal);
    setUser(userData);
    const storage = rememberMe ? localStorage : sessionStorage;
    // Clear both to avoid stale tokens in the other store
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    storage.setItem('token', tokenVal);
    storage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
