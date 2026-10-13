import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { ThemeProvider, useTheme } from "./theme-context";

let root: Root;
let container: HTMLElement;

function Appearance() {
  return <output>{useTheme().theme}</output>;
}

beforeEach(() => {
  const { window } = parseHTML('<html data-theme="black" class="dark"><body><div id="root"></div></body></html>');
  Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = window.document.getElementById("root")!;
  root = createRoot(container);
  act(() => root.render(<ThemeProvider><Appearance /></ThemeProvider>));
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

function notify(key: string | null, newValue: string | null) {
  const event = new window.Event("storage");
  Object.assign(event, { key, newValue });
  act(() => window.dispatchEvent(event));
}

describe("appearance in multiple tabs", () => {
  it("applies another tab's theme and resets after storage is cleared", () => {
    notify("unrelated-key", "light");
    expect(container.textContent).toBe("black");
    notify("wordflash-theme", "light");
    expect(container.textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    notify(null, null);
    expect(container.textContent).toBe("black");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("falls back safely when another tab stores an invalid theme", () => {
    notify("wordflash-theme", "unknown");
    expect(container.textContent).toBe("black");
    expect(document.documentElement.getAttribute("data-theme")).toBe("black");
  });
});
