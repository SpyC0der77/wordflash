import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import ReaderPage from "./page";

const state = vi.hoisted(() => ({
  query: { url: null as string | null, wpm: 0, theme: null as string | null, fontSize: null as string | null },
  setQuery: vi.fn(), reset: vi.fn(), setTheme: vi.fn(), sanitize: vi.fn((html: string) => html),
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  reader: null as null | { controlledWordIndex: number; pauseRequest: number; onWordIndexChange: (index: number) => void; onPlaybackChange: (playing: boolean) => void },
  domSnapshots: [] as Array<{ title: string | null; body: string | null }>,
}));
vi.mock("nuqs", () => ({ useQueryStates: () => [state.query, state.setQuery] }));
vi.mock("./reader-search-params", () => ({ readerSearchParams: {} }));
vi.mock("dompurify", () => ({ default: { sanitize: state.sanitize } }));
vi.mock("sonner", () => ({ toast: state.toast }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => true }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "black", setTheme: state.setTheme }) }));
vi.mock("@/lib/reduce-motion-context", () => ({ useReduceMotion: () => ({ reduceMotion: true, setReduceMotion: vi.fn() }) }));
vi.mock("@/lib/reduce-transparency-context", () => ({ useReduceTransparency: () => ({ reduceTransparency: false, setReduceTransparency: vi.fn() }) }));
vi.mock("@/lib/reader-settings-context", () => ({ useReaderSettings: () => ({
  fontSize: "md", fontFamily: "serif", focalColor: "rose", sentenceEndDurationMs: 500,
  speechBreakDurationMs: 250, wordsPerMinute: 300, resetDefaults: state.reset,
}) }));
vi.mock("@/components/reader", () => ({ Reader: (props: NonNullable<typeof state.reader>) => {
  state.reader = props;
  React.useLayoutEffect(() => {
    state.domSnapshots.push({ title: document.querySelector("h1")?.textContent ?? null, body: document.querySelector(".reader-article")?.textContent ?? null });
  });
  return React.createElement("div", { "data-reader-index": props.controlledWordIndex });
} }));
vi.mock("@/components/reader-settings-content", () => ({ ReaderSettingsContent: ({ onResetDefaults }: { onResetDefaults: () => void }) =>
  React.createElement("button", { onClick: onResetDefaults }, "Reset defaults") }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => React.createElement("a", null, children) }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick, disabled, type, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
  React.createElement("button", { onClick, disabled, type, "aria-label": props["aria-label"] }, children) }));
vi.mock("@/components/ui/input", () => ({ Input: ({ onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) =>
  React.createElement("input", { ...props, onInput: onChange }) }));
vi.mock("radix-ui", () => {
  const div = ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children);
  return { Dialog: Object.fromEntries(["Root", "Trigger", "Portal", "Content", "Overlay", "Title", "Description", "Close"].map((key) => [key, div])) };
});
vi.mock("@/components/ui/drawer", () => {
  const div = ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children);
  return Object.fromEntries(["Drawer", "DrawerContent", "DrawerDescription", "DrawerHeader", "DrawerTitle", "DrawerTrigger"].map((key) => [key, div]));
});
vi.mock("@/components/ui/dropdown-menu", () => {
  const div = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => React.createElement("div", { onClick }, children);
  return Object.fromEntries(["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSub", "DropdownMenuSubContent", "DropdownMenuSubTrigger", "DropdownMenuTrigger"].map((key) => [key, div]));
});

let root: Root;
let container: HTMLElement;
let storage: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
const URL_A = "https://example.org/a";
const URL_B = "https://example.org/b";
const POSITIONS = "wordflash-reading-positions";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.query = { url: URL_A, wpm: 0, theme: null, fontSize: null };
  state.reader = null;
  state.domSnapshots = [];
  storage = new Map();
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  Object.assign(window, { location: { origin: "https://wordflash.test", href: "https://wordflash.test/reader", search: "" },
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), scrollBy() {} });
  window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 100, bottom: 120, height: 20, width: 100, left: 0, right: 100, x: 0, y: 100, toJSON() {} });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("Text", window.Text);
  vi.stubGlobal("DOMParser", window.DOMParser);
  vi.stubGlobal("NodeFilter", { SHOW_ELEMENT: 1, SHOW_TEXT: 4 });
  vi.stubGlobal("getComputedStyle", () => ({ overflow: "auto" }));
  window.HTMLElement.prototype.scrollBy = () => {};
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  container = window.document.getElementById("root")!;
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function response(title: string) {
  return { ok: true, json: async () => ({ title, content: "<html><body><p>one two three four five</p></body></html>", excerpt: null, byline: null, siteName: null }) };
}
async function render() { await act(async () => root.render(React.createElement(ReaderPage))); }
function saved() { return JSON.parse(storage.get(POSITIONS) ?? "{}"); }

describe("article session reliability", () => {
  it("cancels a pending article when the next query contains an invalid URL", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await render();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    state.query = { ...state.query, url: "not an article link" };
    await render();
    expect(signal.aborted).toBe(true);
    expect(container.textContent).not.toContain("Loading article...");
    await act(async () => resolve(response("Outdated article")));
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).toContain("Enter a website address");
  });

  it("never commits a new title beside the previous article body", async () => {
    fetchMock.mockResolvedValueOnce(response("Article A"));
    await render();
    state.domSnapshots = [];
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ title: "Article B", content: "<html><body><p>new replacement words</p></body></html>" }) });
    state.query = { ...state.query, url: URL_B };
    await render();
    expect(state.domSnapshots.some(({ title, body }) => title === "Article B" && body?.includes("one two three"))).toBe(false);
    expect(container.querySelector(".reader-article")?.textContent).toBe("new replacement words");
  });
  it("opens article links separately without seeking to the linked word", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({
      title: "Linked article", content: '<html><body><p>one <a href="https://example.org/reference">reference</a> three</p></body></html>',
    }) });
    await render();
    const link = container.querySelector('.reader-article a')!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    act(() => link.querySelector("span")!.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true })));
    expect(state.reader?.controlledWordIndex).toBe(0);
    expect(state.reader?.pauseRequest).toBe(0);
  });

  it("requests a pause every time the user chooses an article word", async () => {
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    const word = container.querySelector('[data-word-index="2"]')!;
    act(() => word.dispatchEvent(new window.Event("click", { bubbles: true })));
    expect(state.reader?.controlledWordIndex).toBe(2);
    expect(state.reader?.pauseRequest).toBe(1);
    act(() => container.querySelector('[data-word-index="2"]')!.dispatchEvent(new window.Event("click", { bubbles: true })));
    expect(state.reader?.pauseRequest).toBe(2);
  });
  it("adds a submitted article to browser history", async () => {
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    const input = container.querySelector("input")!;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!.call(input, URL_B);
    act(() => input.dispatchEvent(new window.Event("input", { bubbles: true })));
    await act(async () => container.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    expect(state.setQuery).toHaveBeenCalledWith({ url: URL_B }, { history: "push" });
  });

  it("clears the article when Back returns to the empty reader", async () => {
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    act(() => state.reader?.onWordIndexChange(3));
    state.query = { ...state.query, url: null };
    await render();
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("input")?.value).toBe("");
    expect(saved()[URL_A]).toBe(3);
  });

  it("aborts an in-flight load when Back removes the article URL", async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await render();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    state.query = { ...state.query, url: null };
    await render();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(response("Late article")));
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).not.toContain("Loading article...");
  });
  it("keeps the current article and its progress when the next article fails", async () => {
    fetchMock.mockResolvedValueOnce(response("Article A"));
    await render();
    act(() => state.reader?.onWordIndexChange(3));
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Unavailable" }) });
    state.query = { ...state.query, url: URL_B };
    await render();
    expect(container.querySelector("h1")?.textContent).toBe("Article A");
    expect(state.reader?.controlledWordIndex).toBe(3);
    expect(container.textContent).toContain("Unavailable");
    expect(container.textContent).toContain("Paste text instead");
    act(() => vi.advanceTimersByTime(1000));
    expect(saved()[URL_A]).toBe(3);
    expect(saved()[URL_B]).toBeUndefined();
  });
  it("rejects a successful response with no readable text", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ title: "Empty", content: "<p></p>" }) });
    await render();
    expect(container.textContent).toContain("no readable text");
    expect(state.reader).toBeNull();
  });
  it("restores styled words using the same indices as playback and highlights all fragments", async () => {
    storage.set(POSITIONS, JSON.stringify({ [URL_A]: 1 }));
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({
      title: "Styled article", content: "<html><body><p>one un<em>believ</em>able three</p></body></html>",
      excerpt: null, byline: null, siteName: null,
    }) });
    await render();
    expect(state.reader?.controlledWordIndex).toBe(1);
    const fragments = Array.from(container.querySelectorAll('[data-word-index="1"]'));
    expect(fragments.map((node) => node.textContent)).toEqual(["un", "believ", "able"]);
    expect(fragments.every((node) => node.classList.contains("reader-highlight"))).toBe(true);
  });
  it("restores progress before saving and keeps it tied to the loaded article", async () => {
    storage.set(POSITIONS, JSON.stringify({ [URL_A]: 3 }));
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    expect(state.reader?.controlledWordIndex).toBe(3);
    expect(saved()[URL_A]).toBe(3);
    const input = container.querySelector("input")!;
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    valueSetter.call(input, URL_B);
    act(() => input.dispatchEvent(new window.Event("input", { bubbles: true })));
    expect(container.querySelector("input")?.value).toBe(URL_B);
    act(() => state.reader?.onWordIndexChange(4));
    expect(container.querySelector("input")?.value).toBe(URL_B);
    act(() => vi.advanceTimersByTime(1000));
    expect(saved()).toEqual({ [URL_A]: 4 });
    const event = new window.Event("keydown", { bubbles: true, cancelable: true });
    Object.assign(event, { ctrlKey: true, shiftKey: true, key: "c" });
    await act(async () => window.dispatchEvent(event));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`https://wordflash.test/reader?url=${encodeURIComponent(URL_A)}`);
  });

  it("ignores an older response even when the transport completes after abort", async () => {
    let resolveA!: (value: ReturnType<typeof response>) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve; }));
    fetchMock.mockResolvedValueOnce(response("Article B"));
    await render();
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    state.query = { ...state.query, url: URL_B };
    await render();
    expect(firstSignal.aborted).toBe(true);
    expect(container.querySelector("h1")?.textContent).toBe("Article B");
    await act(async () => resolveA(response("Article A")));
    expect(container.querySelector("h1")?.textContent).toBe("Article B");
  });

  it("batches progress writes and flushes immediately on pause and pagehide", async () => {
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    vi.mocked(localStorage.setItem).mockClear();
    for (const index of [1, 2, 3]) act(() => state.reader?.onWordIndexChange(index));
    expect(localStorage.setItem).not.toHaveBeenCalled();
    act(() => state.reader?.onPlaybackChange(false));
    expect(saved()[URL_A]).toBe(3);
    act(() => state.reader?.onWordIndexChange(4));
    act(() => window.dispatchEvent(new window.Event("pagehide")));
    expect(saved()[URL_A]).toBe(4);
  });

  it("does not sanitize article HTML again on word advances", async () => {
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    state.sanitize.mockClear();
    act(() => state.reader?.onWordIndexChange(1));
    act(() => state.reader?.onWordIndexChange(2));
    expect(state.sanitize).not.toHaveBeenCalled();
  });

  it("clears URL setting overrides when resetting defaults", async () => {
    state.query = { ...state.query, wpm: 800, fontSize: "xl", theme: "light" };
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    const reset = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Reset defaults")!;
    await act(async () => reset.dispatchEvent(new window.Event("click", { bubbles: true })));
    expect(state.reset).toHaveBeenCalledTimes(1);
    expect(state.setQuery).toHaveBeenCalledWith({ wpm: 0, theme: null, fontSize: null });
    expect(state.setTheme).toHaveBeenLastCalledWith("black");
  });

  it("reports clipboard failures", async () => {
    fetchMock.mockResolvedValue(response("Article A"));
    await render();
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("Denied"));
    const event = new window.Event("keydown", { bubbles: true, cancelable: true });
    Object.assign(event, { ctrlKey: true, shiftKey: true, key: "c" });
    await act(async () => window.dispatchEvent(event));
    expect(state.toast.error).toHaveBeenCalledWith(expect.stringContaining("Could not copy link"));
  });

  it("allows retrying the same URL after extraction fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Unavailable" }) });
    fetchMock.mockResolvedValueOnce(response("Article A"));
    await render();
    expect(container.textContent).toContain("Unavailable");
    await act(async () => container.querySelector("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector("h1")?.textContent).toBe("Article A");
  });
});
