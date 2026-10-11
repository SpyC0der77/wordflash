"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useReduceMotion } from "@/lib/reduce-motion-context";

export function HomeScrollMenu({ children, dimmed }: { children: ReactNode; dimmed: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const manualProgress = useRef<number | null>(null);
  const hovered = useRef(false);
  const focusOnCollapse = useRef(false);
  const redraw = useRef<(animate?: boolean) => void>(() => {});
  const [collapsed, setCollapsed] = useState(false);
  const [iconVisible, setIconVisible] = useState(false);
  const { reduceMotion } = useReduceMotion();
  const systemReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useLayoutEffect(() => {
    if (collapsed && iconVisible && focusOnCollapse.current) {
      iconRef.current?.focus({ preventScroll: true });
      focusOnCollapse.current = false;
    }
  }, [collapsed, iconVisible]);

  useEffect(() => {
    let pendingFrame: number | undefined;
    let scrollRange = 1;
    let expandedWidth = 220;
    let mobile = false;
    const draw = (animate = false) => {
      const frame = frameRef.current;
      const content = contentRef.current;
      const icon = iconRef.current;
      if (!frame || !content || !icon) return;
      const scroll = Math.max(0, window.scrollY || 0);
      const distance = Math.min(mobile ? 64 : 120, scrollRange);
      const fadeDistance = Math.min(mobile ? 12 : 24, distance / 4);
      const amount = Math.min(1, Math.max(0, (scroll - fadeDistance) / (distance - fadeDistance)));
      // Ease out while closing; reversing the same curve eases in while opening.
      const easedAmount = 1 - (1 - amount) ** 2;
      const reduced = reduceMotion || systemReduceMotion;
      const progress = manualProgress.current ?? (hovered.current ? 0 : reduced ? Number(scroll > 0) : easedAmount);
      const travel = (expandedWidth + 8) * progress;
      const opening = progress === 0;
      const duration = mobile ? (opening ? 150 : 100) : (opening ? 220 : 150);
      const easing = opening ? "cubic-bezier(0.16, 1, 0.3, 1)" : "ease-out";
      const animateReveal = animate && !reduced;
      // Keep the reveal edge in sync with the controls behind the stationary button.
      frame.style.transitionProperty = animateReveal ? "opacity, clip-path" : "opacity";
      frame.style.transitionDuration = animateReveal ? `150ms, ${duration}ms` : "150ms";
      const opacityEasing = "cubic-bezier(0.4, 0, 0.2, 1)";
      frame.style.transitionTimingFunction = animateReveal ? `${opacityEasing}, ${easing}` : opacityEasing;
      content.style.transition = animateReveal ? `transform ${duration}ms ${easing}` : "none";
      frame.style.clipPath = `inset(0 0 0 ${travel}px)`;
      content.style.transform = `translate3d(${travel}px, 0, 0)`;
      icon.style.opacity = String(reduced ? Number(scroll > 0) : Math.min(1, scroll / fadeDistance));
      if (progress >= 1 && content.contains(document.activeElement)) focusOnCollapse.current = true;
      if (scroll === 0 && document.activeElement === icon) icon.blur();
      setCollapsed(progress >= 1);
      setIconVisible(reduced ? scroll > 0 : scroll >= fadeDistance);
    };
    const measure = () => {
      scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      expandedWidth = contentRef.current?.offsetWidth || 220;
      mobile = window.innerWidth < 768 || Boolean(window.matchMedia?.("(pointer: coarse)").matches);
      if (frameRef.current) frameRef.current.style.width = `${expandedWidth + 52}px`;
      draw();
    };
    redraw.current = draw;
    const schedule = () => {
      manualProgress.current = null;
      if (pendingFrame !== undefined) return;
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = undefined;
        draw();
      });
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (contentRef.current) observer?.observe(contentRef.current);
    if (frameRef.current?.parentElement) observer?.observe(frameRef.current.parentElement);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
      if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
      redraw.current = () => {};
    };
  }, [reduceMotion, systemReduceMotion]);

  return (
    <div
      ref={frameRef}
      className="fixed right-3 top-3 z-50 h-11 overflow-hidden transition-opacity duration-150 sm:right-8 sm:top-8"
      style={{ opacity: dimmed ? 0.4 : 1 }}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        hovered.current = true;
        manualProgress.current = null;
        redraw.current(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        hovered.current = false;
        manualProgress.current = null;
        redraw.current(true);
      }}
      onKeyDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (event.key === "Escape" && iconVisible) {
          manualProgress.current = 1;
          redraw.current(true);
          iconRef.current?.focus();
        }
      }}
    >
      <div
        id="home-navigation"
        ref={contentRef}
        className="pointer-events-auto flex h-11 w-max items-center gap-2"
        inert={collapsed}
        aria-hidden={collapsed}
      >
        {children}
      </div>
      <Button
        ref={iconRef}
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 z-10 size-11 border border-border bg-background opacity-0 transition-colors hover:bg-background dark:hover:bg-background"
        style={{ pointerEvents: iconVisible ? "auto" : "none" }}
        tabIndex={iconVisible ? 0 : -1}
        aria-hidden={!iconVisible}
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        aria-controls="home-navigation"
        onClick={() => {
          manualProgress.current = collapsed ? 0 : 1;
          redraw.current(true);
          if (collapsed) window.requestAnimationFrame(() => {
            if (!contentRef.current?.hasAttribute("inert")) {
              contentRef.current?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true });
            }
          });
        }}
      >
        <Menu className="size-5" />
      </Button>
    </div>
  );
}
