"use client";

import * as React from "react";

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const subscribe = React.useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = React.useCallback(() => defaultValue, [defaultValue]);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
