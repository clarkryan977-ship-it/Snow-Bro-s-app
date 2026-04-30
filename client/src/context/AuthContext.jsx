import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

/** Decode a JWT payload without a library and check if it's expired */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 < Date.now() : false;
  } catch (_) {
    return true; // treat malformed tokens as expired
  }
}

function clearAllTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage first (remember me / 30-day), then sessionStorage (session-only)
    const lsToken = localStorage.getItem('token');
    const ssToken = sessionStorage.getItem('token');

    // Prefer localStorage token if present and valid
    let savedToken = null;
    let savedUser = null;

    if (lsToken && !isTokenExpired(lsToken)) {
      savedToken = lsToken;
      savedUser = localStorage.getItem('user');
    } else if (lsToken && isTokenExpired(lsToken)) {
      // localStorage token is expired — clear it
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    if (!savedToken && ssToken && !isTokenExpired(ssToken)) {
      savedToken = ssToken;
      savedUser = sessionStorage.getItem('user');
    } else if (!savedToken && ssToken && isTokenExpired(ssToken)) {
      // sessionStorage token is expired — clear it
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (_) {
        clearAllTokens();
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
    // Clear both stores first to avoid stale tokens
    clearAllTokens();
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('token', tokenVal);
    storage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearAllTokens();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
