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
vi.mock("@/components/home-scroll-menu", () => ({
  HomeScrollMenu: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => React.createElement("a", props),
}));
vi.mock("@/components/ui/drawer", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/components/ui/drawer")>(),
  Drawer: () => null,
}));
vi.mock("@/components/ui/slider", () => ({ Slider: () => null }));

let root: Root;
let container: HTMLElement;
let restoreLayout = () => {};

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
  restoreLayout();
  restoreLayout = () => {};
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

describe("Scrub auto-follow", () => {
  it("scrolls only the text panel when switching tabs and advancing playback", () => {
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    const prototype = window.HTMLElement.prototype;
    const properties = ["scrollIntoView", "scrollTo", "getBoundingClientRect", "clientHeight"] as const;
    const descriptors = properties.map((key) => Object.getOwnPropertyDescriptor(prototype, key));
    restoreLayout = () => properties.forEach((key, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(prototype, key, descriptor);
      else Reflect.deleteProperty(prototype, key);
    });
    prototype.scrollIntoView = scrollIntoView;
    prototype.scrollTo = scrollTo;
    prototype.getBoundingClientRect = () => ({
      top: 600, bottom: 628, left: 0, right: 100, width: 100, height: 28,
      x: 0, y: 600, toJSON: () => ({}),
    });
    Object.defineProperty(prototype, "clientHeight", { configurable: true, get: () => 176 });

    act(() => root.render(React.createElement(Reader, { variant: "full" })));
    act(() => container.querySelector("#reader-scrub-tab")!.dispatchEvent(
      new window.Event("click", { bubbles: true }),
    ));
    const scrub = container.querySelector("[data-word-index]")!.parentElement!;
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.contexts.every((element) => element === scrub)).toBe(true);
    expect(scrollIntoView).not.toHaveBeenCalled();

    scrollTo.mockClear();
    const play = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Play")!;
    act(() => play.dispatchEvent(new window.Event("click", { bubbles: true })));
    advance(1000);
    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.contexts.every((element) => element === scrub)).toBe(true);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("reader playback timing", () => {
  it("pauses for an external seek even when the selected word stays the same", () => {
    const render = (pauseRequest: number) => act(() => root.render(React.createElement(Reader, {
      variant: "test", text: "hello world again", wordsPerMinute: 250, pauseRequest,
    })));
    render(0);
    click();
    render(1);
    expect(button().textContent).toBe("Play");
    advance(2000);
    expect(container.textContent).toContain("1/3");
    click();
    expect(button().textContent).toBe("Pause");
    render(2);
    expect(button().textContent).toBe("Play");
  });
  it("pauses when covered and stays paused when the covering view closes", () => {
    renderReader("hello world again");
    click();
    act(() => root.render(React.createElement(Reader, {
      variant: "test", text: "hello world again", wordsPerMinute: 250, playbackBlocked: true,
    })));
    expect(button().textContent).toBe("Play");
    advance(2000);
    act(() => root.render(React.createElement(Reader, {
      variant: "test", text: "hello world again", wordsPerMinute: 250, playbackBlocked: false,
    })));
    expect(button().textContent).toBe("Play");
    click();
    expect(button().textContent).toBe("Pause");
  });
  it("pauses when the reader is hidden instead of advancing unseen words", () => {
    const { onWordIndexChange } = renderReader("hello world again");
    click();
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new window.Event("visibilitychange")));
    expect(button().textContent).toBe("Play");
    advance(2000);
    expect(onWordIndexChange).toHaveBeenLastCalledWith(0);
  });
  it("ignores repeated Space events while allowing the first press", () => {
    renderReader("hello world");
    const press = (repeat: boolean) => {
      const event = new window.Event("keydown", { bubbles: true, cancelable: true });
      Object.assign(event, { code: "Space", repeat });
      act(() => window.dispatchEvent(event));
    };
    press(false);
    expect(button().textContent).toBe("Pause");
    press(true);
    expect(button().textContent).toBe("Pause");
    advance(240);
    press(false);
    expect(button().textContent).toBe("Play");
  });

  it("reports playback changes for saving progress on pause and completion", () => {
    const onPlaybackChange = vi.fn();
    act(() => root.render(React.createElement(Reader, {
      variant: "test", text: "hello world", wordsPerMinute: 250, onPlaybackChange,
    })));
    expect(onPlaybackChange).toHaveBeenLastCalledWith(false);
    click();
    expect(onPlaybackChange).toHaveBeenLastCalledWith(true);
    click();
    expect(onPlaybackChange).toHaveBeenLastCalledWith(false);
    click();
    advance(240);
    advance(240);
    expect(onPlaybackChange).toHaveBeenLastCalledWith(false);
  });
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
