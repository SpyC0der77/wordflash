import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Reader } from "./reader";

vi.mock("@/lib/use-proper-noun-gazetteer", () => ({
  useProperNounGazetteer: () => null,
}));
vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));
vi.mock("@/components/punctuation-glyph", () => ({
  PunctuationGlyph: () => null,
}));

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = window.document.getElementById("root")!;
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function button() {
  return container.querySelector("button")!;
}

function click() {
  act(() => button().dispatchEvent(new window.Event("click", { bubbles: true })));
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function renderReader(text: string) {
  const onComplete = vi.fn();
  const onWordIndexChange = vi.fn();
  act(() => root.render(React.createElement(Reader, {
    variant: "test",
    text,
    wordsPerMinute: 250,
    onComplete,
    onWordIndexChange,
  })));
  return { onComplete, onWordIndexChange };
}

describe("reader playback timing", () => {
  it("holds the final number for its complete duration before completing", () => {
    const { onComplete, onWordIndexChange } = renderReader("hello 2026.");
    click();
    advance(239);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(0);
    advance(1);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(1);
    expect(button().textContent).toBe("Pause");
    expect(onComplete).not.toHaveBeenCalled();
    advance(909);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(button().textContent).toBe("Restart");
  });

  it("uses punctuation and numeric attention during playback", () => {
    const { onWordIndexChange } = renderReader("hello, 2026 done");
    click();
    advance(489);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(0);
    advance(1);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(1);
    advance(409);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(1);
    advance(1);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(2);
  });

  it("cancels the active timer while paused and restarts the current dwell on resume", () => {
    const { onWordIndexChange } = renderReader("hello, world");
    click();
    advance(100);
    click();
    advance(5000);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(0);
    click();
    advance(489);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(0);
    advance(1);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(1);
  });

  it("restarts from the beginning after the final dwell", () => {
    const { onComplete, onWordIndexChange } = renderReader("hello world");
    click();
    advance(240);
    advance(240);
    expect(onComplete).toHaveBeenCalledTimes(1);
    click();
    expect(onWordIndexChange).toHaveBeenLastCalledWith(0);
    expect(button().textContent).toBe("Pause");
    advance(240);
    advance(240);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("does not complete a one-word passage until it has been played", () => {
    const { onComplete } = renderReader("2026.");
    expect(onComplete).not.toHaveBeenCalled();
    expect(button().textContent).toBe("Play");
    click();
    advance(909);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("can pause on the last word without completing or restarting the passage", () => {
    const { onComplete, onWordIndexChange } = renderReader("hello 2026.");
    click();
    advance(240);
    advance(100);
    click();
    advance(5000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(button().textContent).toBe("Play");
    click();
    expect(onWordIndexChange).toHaveBeenLastCalledWith(1);
    advance(910);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("cancels timers on unmount", () => {
    const { onComplete, onWordIndexChange } = renderReader("hello world");
    click();
    act(() => root.unmount());
    onWordIndexChange.mockClear();
    advance(5000);
    expect(onWordIndexChange).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  it("invalidates completion after controlled navigation or a text change", () => {
    const onComplete = vi.fn();
    function render(text: string, controlledWordIndex: number) {
      act(() => root.render(React.createElement(Reader, {
        variant: "test",
        text,
        controlledWordIndex,
        wordsPerMinute: 250,
        onComplete,
      })));
    }
    render("hello world", 1);
    click();
    advance(240);
    expect(onComplete).toHaveBeenCalledTimes(1);
    render("hello world", 0);
    render("hello world", 1);
    expect(button().textContent).toBe("Play");
    expect(onComplete).toHaveBeenCalledTimes(1);
    click();
    advance(240);
    expect(onComplete).toHaveBeenCalledTimes(2);
    render("another passage", 1);
    render("hello world", 1);
    expect(button().textContent).toBe("Play");
    expect(onComplete).toHaveBeenCalledTimes(2);
    click();
    advance(240);
    expect(onComplete).toHaveBeenCalledTimes(3);
  });
});
