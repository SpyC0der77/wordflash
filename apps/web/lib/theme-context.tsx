"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "wordflash-theme";
const LEGACY_STORAGE_KEY = "speedreader-theme";
const VALID_THEMES = ["light", "black", "gray", "system"] as const;
const DEFAULT_THEME: Theme = "black";

const THEMES = {
  light: "Light",
  black: "Black",
  gray: "Gray",
  system: "System",
} as const;

type Theme = (typeof VALID_THEMES)[number];

function isValidTheme(value: unknown): value is Theme {
  return typeof value === "string" && VALID_THEMES.includes(value as Theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } else {
    document.documentElement.classList.add("dark");
  }
}

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function setThemeExternal(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore
  }
  emitChange();
}

function getSnapshot(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme");
  return isValidTheme(attr) ? attr : DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Inline script that runs before React hydrates to set the data-theme
 * attribute, preventing FOUC and hydration mismatches.
 */
export function ThemeScript() {
  const scriptContent = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(!t){var l=localStorage.getItem("${LEGACY_STORAGE_KEY}");if(l&&["light","gray","black","system"].indexOf(l)!==-1){t=l;localStorage.setItem("${STORAGE_KEY}",t);localStorage.removeItem("${LEGACY_STORAGE_KEY}")}}if(t==="light"){document.documentElement.setAttribute("data-theme","light");document.documentElement.classList.remove("dark")}else if(t==="gray"||t==="black"){document.documentElement.setAttribute("data-theme",t);document.documentElement.classList.add("dark")}else if(t==="system"){document.documentElement.setAttribute("data-theme","system");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}else{document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");document.documentElement.classList.add("dark")}}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_THEME}");document.documentElement.classList.add("dark")}})()`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: scriptContent }}
      suppressHydrationWarning
    />
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((value: Theme) => {
    setThemeExternal(value);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return { theme: DEFAULT_THEME, setTheme: () => {} };
  }
  return ctx;
}

export { THEMES };
export type { Theme };
