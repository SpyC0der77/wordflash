import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { ReaderSettingsProvider, useReaderSettings } from "./reader-settings-context";

let root: Root;
let container: HTMLElement;
let settings: ReturnType<typeof useReaderSettings>;
let blocked: boolean;
let storage: Map<string, string>;

function notifyStorage(key: string | null, newValue: string | null = null) {
  const event = new window.Event("storage");
  Object.assign(event, { key, newValue });
  act(() => window.dispatchEvent(event));
}

function Preferences() {
  const preferences = useReaderSettings();
  React.useEffect(() => { settings = preferences; }, [preferences]);
  return <output>{preferences.wordsPerMinute} {preferences.fontSize} {preferences.speechBreakDurationMs}</output>;
}

beforeEach(() => {
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  blocked = false;
  storage = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (blocked) throw new Error("Storage blocked");
      return storage.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (blocked) throw new Error("Storage blocked");
      storage.set(key, value);
    },
    removeItem: (key: string) => storage.delete(key),
  });
  container = window.document.getElementById("root")!;
  root = createRoot(container);
  act(() => root.render(<ReaderSettingsProvider><Preferences /></ReaderSettingsProvider>));
});

afterEach(() => {
  blocked = false;
  act(() => settings.resetDefaults());
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe("preferences without browser storage", () => {
  it.each([null, "speedreader-reader-settings", "wordflash-reader-settings"])("retains unsaved preferences after %s storage is removed", (key) => {
    blocked = true;
    act(() => settings.setWordsPerMinute(450));
    act(() => settings.setFontSize("xl"));
    notifyStorage(key);
    expect(container.textContent).toBe("450 xl 250");
  });

  it("retains the fallback if a primary-key event cannot be read", () => {
    blocked = true;
    act(() => settings.setWordsPerMinute(450));
    notifyStorage("wordflash-reader-settings", JSON.stringify({ wordsPerMinute: 650 }));
    expect(container.textContent).toBe("450 md 250");
  });

  it("accepts a valid persisted replacement for unsaved preferences", () => {
    blocked = true;
    act(() => settings.setWordsPerMinute(450));
    blocked = false;
    const replacement = JSON.stringify({ wordsPerMinute: 650 });
    storage.set("wordflash-reader-settings", replacement);
    notifyStorage("wordflash-reader-settings", replacement);
    expect(container.textContent).toBe("650 md 250");
  });
  it("updates when another tab changes or clears preferences", () => {
    const notify = (key: string | null) => {
      const event = new window.Event("storage");
      Object.assign(event, { key });
      act(() => window.dispatchEvent(event));
    };
    storage.set("wordflash-reader-settings", JSON.stringify({ wordsPerMinute: 650, fontSize: "lg" }));
    notify("unrelated-key");
    expect(container.textContent).toBe("300 md 250");
    notify("wordflash-reader-settings");
    expect(container.textContent).toBe("650 lg 250");
    storage.clear();
    notify(null);
    expect(container.textContent).toBe("300 md 250");
  });
  it("applies successive settings and resets even when reads and writes fail", () => {
    blocked = true;
    act(() => settings.setWordsPerMinute(450));
    act(() => settings.setFontSize("xl"));
    act(() => settings.setSpeechBreakDurationMs(175));
    expect(container.textContent).toBe("450 xl 175");
    act(() => settings.resetDefaults());
    expect(container.textContent).toBe("300 md 250");
  });

  it("saves the session preferences when storage becomes available again", () => {
    blocked = true;
    act(() => settings.setFontSize("lg"));
    blocked = false;
    act(() => settings.setWordsPerMinute(500));
    expect(container.textContent).toBe("500 lg 250");
    expect(JSON.parse(storage.get("wordflash-reader-settings")!)).toMatchObject({ fontSize: "lg", wordsPerMinute: 500 });
  });
});
