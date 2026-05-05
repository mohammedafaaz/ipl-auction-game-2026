import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [openRouterKey, setOpenRouterKey] = useState(
    () => import.meta.env.VITE_OPENROUTER_KEY || localStorage.getItem('openRouterKey') || sessionStorage.getItem('openRouterKey') || ''
  );

  // Re-sync when user enters key on Home page
  useEffect(() => {
    const sync = () => {
      const key = import.meta.env.VITE_OPENROUTER_KEY || localStorage.getItem('openRouterKey') || '';
      setOpenRouterKey(key);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <AppContext.Provider value={{ firebaseReady, setFirebaseReady, toasts, showToast, openRouterKey }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
