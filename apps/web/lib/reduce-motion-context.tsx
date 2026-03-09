"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "wordflash-reduce-motion";
const LEGACY_STORAGE_KEY = "speedreader-reduce-motion";

interface ReduceMotionContextValue {
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}

const ReduceMotionContext = createContext<ReduceMotionContextValue | null>(null);

export function ReduceMotionProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotionState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      try {
        let stored = localStorage.getItem(STORAGE_KEY);
        if (stored === null) {
          stored = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (stored !== null) {
            localStorage.setItem(STORAGE_KEY, stored);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
        setReduceMotionState(stored === "true");
      } catch {
        // Ignore localStorage errors
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (reduceMotion) {
      root.setAttribute("data-reduce-motion", "true");
    } else {
      root.removeAttribute("data-reduce-motion");
    }
    return () => root.removeAttribute("data-reduce-motion");
  }, [reduceMotion]);

  const setReduceMotion = useCallback((value: boolean) => {
    setReduceMotionState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return (
    <ReduceMotionContext.Provider value={{ reduceMotion, setReduceMotion }}>
      {children}
    </ReduceMotionContext.Provider>
  );
}

export function useReduceMotion() {
  const ctx = useContext(ReduceMotionContext);
  if (!ctx) {
    return { reduceMotion: false, setReduceMotion: () => {} };
  }
  return ctx;
}
