import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPortal } from "react-dom";
import { parseHTML } from "linkedom";
import { HomeScrollMenu } from "./home-scroll-menu";

const preferences = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/reduce-motion-context", () => ({ useReduceMotion: () => ({ reduceMotion: preferences.reduced }) }));
vi.mock("@/components/ui/button", () => ({ Button: (props: React.ComponentProps<"button">) => React.createElement("button", props) }));

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  preferences.reduced = false;
  const { window } = parseHTML("<html><body><div id='root'></div></body></html>");
  Object.assign(window, {
    innerHeight: 1080,
    innerWidth: 1920,
    scrollY: 0,
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  });
  Object.defineProperty(window.document.documentElement, "scrollHeight", { value: 1400 });
  Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", { get: () => 185, configurable: true });
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("requestAnimationFrame", window.requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", window.cancelAnimationFrame);
  const focusState: { current: HTMLElement | null } = { current: null };
  Object.defineProperty(window.document, "activeElement", { get: () => focusState.current ?? window.document.body, configurable: true });
  window.HTMLElement.prototype.focus = function (this: HTMLElement) { focusState.current = this; };
  window.HTMLElement.prototype.blur = function (this: HTMLElement) { if (focusState.current === this) focusState.current = null; };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = window.document.getElementById("root")!;
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render(children: React.ReactNode = <a href="/about">About</a>) {
  await act(async () => root.render(
    <HomeScrollMenu dimmed={false}>{children}</HomeScrollMenu>,
  ));
}

function button() { return container.querySelector("button")!; }
function navigation() { return container.querySelector<HTMLElement>("#home-navigation")!; }
function scroll(y: number) {
  act(() => {
    Object.assign(window, { scrollY: y });
    window.dispatchEvent(new window.Event("scroll"));
    vi.runAllTimers();
  });
}
function hover(enter: boolean, pointerType = "mouse") {
  const event = new window.Event(enter ? "pointerover" : "pointerout", { bubbles: true });
  Object.assign(event, { pointerType, relatedTarget: document.body });
  act(() => button().parentElement!.dispatchEvent(event));
}

describe("home navigation scroll and hover", () => {
  it("keeps fading controls out of pointer, keyboard, and screen-reader interaction", async () => {
    await render();
    scroll(1);
    expect(button().tabIndex).toBe(-1);
    expect(button().style.pointerEvents).toBe("none");
    expect(button().getAttribute("aria-hidden")).toBe("true");
    scroll(12);
    expect(button().tabIndex).toBe(-1);
    scroll(24);
    expect(button().getAttribute("tabindex")).toBe("0");
    expect(button().style.pointerEvents).toBe("auto");
    expect(button().getAttribute("aria-hidden")).toBe("false");
  });

  it("preserves visible links and their focus until the collapse finishes", async () => {
    await render();
    const link = navigation().querySelector("a")!;
    link.focus();
    scroll(48);
    expect(navigation().hasAttribute("inert")).toBe(false);
    expect(navigation().getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(link);
    scroll(120);
    expect(navigation().hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(button());
    act(() => button().click());
    act(() => vi.runAllTimers());
    expect(navigation().hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(link);
  });

  it("ignores Escape from a Settings portal but closes on Escape within the menu", async () => {
    await render(<>
      <a href="/about">About</a>
      {createPortal(<button id="settings-portal">Settings dialog</button>, document.body)}
    </>);
    scroll(120);
    hover(true);
    const escape = () => Object.assign(new window.Event("keydown", { bubbles: true }), { key: "Escape" });
    act(() => document.getElementById("settings-portal")!.dispatchEvent(escape()));
    expect(button().getAttribute("aria-expanded")).toBe("true");
    act(() => navigation().querySelector("a")!.dispatchEvent(escape()));
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not measure control width on each scroll frame", async () => {
    const width = vi.spyOn(window.HTMLElement.prototype, "offsetWidth", "get");
    await render();
    expect(width).toHaveBeenCalledTimes(1);
    width.mockClear();
    scroll(12);
    scroll(32);
    scroll(64);
    scroll(120);
    expect(width).not.toHaveBeenCalled();
    width.mockRestore();
  });

  it("finishes the mobile collapse sooner and uses a shorter tap transition", async () => {
    Object.assign(window, { innerWidth: 390 });
    await render();
    scroll(6);
    expect(button().style.opacity).toBe("0.5");
    expect(navigation().style.transform).toBe("translate3d(0px, 0, 0)");
    scroll(64);
    expect(navigation().style.transform).toBe("translate3d(193px, 0, 0)");
    act(() => button().click());
    expect(navigation().style.transition).toBe("transform 150ms cubic-bezier(0.16, 1, 0.3, 1)");
    expect(button().parentElement!.style.transitionDuration).toBe("150ms");
    expect(button().parentElement!.style.transitionTimingFunction).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(button().getAttribute("aria-expanded")).toBe("true");
    act(() => button().click());
    expect(navigation().style.transition).toBe("transform 100ms ease-out");
    expect(button().parentElement!.style.transitionDuration).toBe("100ms");
    expect(button().parentElement!.style.transitionTimingFunction).toBe("ease-out");
  });

  it("fades the hamburger in before moving controls, and hides it at the top", async () => {
    await render();
    expect(button().style.opacity).toBe("0");
    expect(button().tabIndex).toBe(-1);
    scroll(12);
    expect(button().style.opacity).toBe("0.5");
    expect(navigation().style.transform).toBe("translate3d(0px, 0, 0)");
    scroll(120);
    expect(button().style.opacity).toBe("1");
    expect(navigation().style.transform).toBe("translate3d(193px, 0, 0)");
    expect(button().getAttribute("aria-expanded")).toBe("false");
    scroll(0);
    expect(button().style.opacity).toBe("0");
    expect(button().getAttribute("aria-expanded")).toBe("true");
  });

  it("slows the collapse on scroll down and accelerates the expansion on scroll up", async () => {
    await render();
    // Equal scroll steps move the 193px-wide controls progressively less when closing.
    const positions = [
      [24, 0],
      [48, 84.4375],
      [72, 144.75],
      [96, 180.9375],
      [120, 193],
    ];
    for (const [y, travel] of positions) {
      scroll(y);
      expect(navigation().style.transform).toBe(`translate3d(${travel}px, 0, 0)`);
    }
    // Reversing scroll retraces the same positions without a jump on direction change.
    for (const [y, travel] of positions.toReversed()) {
      scroll(y);
      expect(navigation().style.transform).toBe(`translate3d(${travel}px, 0, 0)`);
    }
  });

  it("expands on mouse hover and returns to the scroll position on leave", async () => {
    await render();
    scroll(120);
    hover(true);
    expect(navigation().style.transform).toBe("translate3d(0px, 0, 0)");
    expect(navigation().style.transition).toBe("transform 220ms cubic-bezier(0.16, 1, 0.3, 1)");
    expect(button().parentElement!.style.transitionDuration).toBe("220ms");
    expect(button().parentElement!.style.transitionTimingFunction).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(button().getAttribute("aria-expanded")).toBe("true");
    scroll(180);
    expect(button().getAttribute("aria-expanded")).toBe("true");
    hover(false);
    expect(navigation().style.transform).toBe("translate3d(193px, 0, 0)");
    expect(navigation().style.transition).toBe("transform 150ms ease-out");
    expect(button().parentElement!.style.transitionDuration).toBe("150ms");
    expect(button().parentElement!.style.transitionTimingFunction).toBe("ease-out");
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps touch expansion on the button instead of hover", async () => {
    await render();
    scroll(120);
    hover(true, "touch");
    expect(button().getAttribute("aria-expanded")).toBe("false");
    act(() => button().click());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    hover(false, "touch");
    expect(button().getAttribute("aria-expanded")).toBe("true");
  });

  it("retains hover and scroll states with reduced motion", async () => {
    preferences.reduced = true;
    await render();
    scroll(12);
    expect(navigation().style.transform).toBe("translate3d(193px, 0, 0)");
    hover(true);
    expect(navigation().style.transition).toBe("none");
    expect(button().getAttribute("aria-expanded")).toBe("true");
    hover(false);
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });
});
