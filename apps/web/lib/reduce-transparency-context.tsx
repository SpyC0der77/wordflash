"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "wordflash-reduce-transparency";

interface ReduceTransparencyContextValue {
  reduceTransparency: boolean;
  setReduceTransparency: (value: boolean) => void;
}

const ReduceTransparencyContext = createContext<ReduceTransparencyContextValue | null>(null);

export function ReduceTransparencyProvider({ children }: { children: React.ReactNode }) {
  const [reduceTransparency, setReduceTransparencyState] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        setReduceTransparencyState(stored === "true");
      } catch {
        // Ignore localStorage errors
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const setReduceTransparency = useCallback((value: boolean) => {
    setReduceTransparencyState(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return (
    <ReduceTransparencyContext.Provider value={{ reduceTransparency, setReduceTransparency }}>
      {children}
    </ReduceTransparencyContext.Provider>
  );
}

export function useReduceTransparency() {
  const ctx = useContext(ReduceTransparencyContext);
  if (!ctx) {
    return { reduceTransparency: false, setReduceTransparency: () => {} };
  }
  return ctx;
}
