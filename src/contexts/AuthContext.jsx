import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Routes a client reaches by scanning a code. Nobody signs in on any of them,
// so they must not pay for auth — not the download and not the wait.
const CLIENT_ROUTES = [
  /^\/artist\//,
  /^\/join\//,
  /^\/customer\//,
  /^\/kiosk\//,
  /^\/display\//,
  /^\/event\/[^/]+\/find\/?$/
];

export function AuthProvider({ children }) {
  const location = useLocation();
  const isClientRoute = CLIENT_ROUTES.some(re => re.test(location.pathname));

  const [currentUser, setCurrentUser] = useState(null);
  // Client routes start resolved: there is nothing to wait for.
  const [loading, setLoading] = useState(!isClientRoute);
  const [authApi, setAuthApi] = useState(null);

  useEffect(() => {
    if (isClientRoute) {
      setLoading(false);
      return;
    }

    let unsubscribe;
    let cancelled = false;

    // Imported dynamically so the auth SDK lands in its own chunk instead of
    // the bundle every client downloads.
    (async () => {
      try {
        const [{ onAuthStateChanged, signOut }, { auth }] = await Promise.all([
          import('firebase/auth'),
          import('../auth')
        ]);
        if (cancelled) return;

        setAuthApi({ signOut, auth });
        unsubscribe = onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
          setLoading(false);
        });
      } catch (error) {
        console.error('Auth failed to initialise:', error);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isClientRoute]);

  const logout = async () => {
    if (!authApi) return;
    await authApi.signOut(authApi.auth);
  };

  const value = { currentUser, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
