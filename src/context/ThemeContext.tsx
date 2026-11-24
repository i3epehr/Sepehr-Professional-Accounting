import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeToDom(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    body?.classList.add('dark');
    body?.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    body?.classList.remove('dark');
    body?.classList.add('light');
    root.style.colorScheme = 'light';
  }
  root.setAttribute('data-theme', mode);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kharrazi_theme') as ThemeMode;
      const initial: ThemeMode = saved === 'dark' || saved === 'light' ? saved : 'light';
      applyThemeToDom(initial);
      return initial;
    }
    return 'light';
  });

  useEffect(() => {
    applyThemeToDom(theme);
    try {
      localStorage.setItem('kharrazi_theme', theme);
    } catch {
      // Ignore storage errors in restricted iframes
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      applyThemeToDom(next);
      return next;
    });
  };

  const setTheme = (newTheme: ThemeMode) => {
    applyThemeToDom(newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
