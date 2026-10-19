import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { parseHTML } from "linkedom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./use-media-query";

const DESKTOP = "(min-width: 768px)";
let root: Root;
let container: HTMLElement;
let queries: Map<string, { matches: boolean; listeners: Set<() => void> }>;

function Probe({ query = DESKTOP, fallback = false }) {
  return <span>{String(useMediaQuery(query, fallback))}</span>;
}

beforeEach(() => {
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  queries = new Map();
  window.matchMedia = ((query: string) => {
    if (!queries.has(query)) queries.set(query, { matches: false, listeners: new Set() });
    const state = queries.get(query)!;
    return {
      get matches() { return state.matches; },
      addEventListener: (_event: string, listener: () => void) => state.listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => state.listeners.delete(listener),
    };
  }) as unknown as typeof window.matchMedia;
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = window.document.getElementById("root")!;
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe("useMediaQuery", () => {
  it("reads the browser match and follows changes", async () => {
    window.matchMedia(DESKTOP);
    const media = queries.get(DESKTOP)!;
    media.matches = true;
    await act(async () => root.render(<Probe />));
    expect(container.textContent).toBe("true");
    act(() => {
      media.matches = false;
      media.listeners.forEach((listener) => listener());
    });
    expect(container.textContent).toBe("false");
  });

  it("replaces the subscription when the query changes and cleans up on unmount", async () => {
    await act(async () => root.render(<Probe />));
    const desktop = queries.get(DESKTOP)!;
    expect(desktop.listeners.size).toBe(1);
    await act(async () => root.render(<Probe query="print" />));
    expect(desktop.listeners.size).toBe(0);
    expect(queries.get("print")!.listeners.size).toBe(1);
    act(() => root.unmount());
    expect(queries.get("print")!.listeners.size).toBe(0);
    root = createRoot(container);
  });

  it("uses the supplied fallback during server rendering without accessing matchMedia", () => {
    const matchMedia = vi.spyOn(window, "matchMedia");
    expect(renderToString(<Probe fallback />)).toContain("true");
    expect(renderToString(<Probe />)).toContain("false");
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
