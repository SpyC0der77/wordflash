"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useReduceMotion } from "@/lib/reduce-motion-context";

export function HomeScrollMenu({ children, dimmed }: { children: ReactNode; dimmed: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const manualProgress = useRef<number | null>(null);
  const redraw = useRef<() => void>(() => {});
  const [collapsed, setCollapsed] = useState(false);
  const { reduceMotion } = useReduceMotion();
  const systemReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    let pendingFrame: number | undefined;
    const draw = () => {
      const frame = frameRef.current;
      const content = contentRef.current;
      const icon = iconRef.current;
      if (!frame || !content || !icon) return;
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const amount = Math.min(1, Math.max(0, window.scrollY || 0) / Math.min(96, scrollRange));
      const progress = manualProgress.current ?? (reduceMotion || systemReduceMotion ? Number(amount >= 1) : amount);
      const expandedWidth = content.offsetWidth || 220;
      const travel = (expandedWidth + 8) * progress;
      // Keep the button still; translate the controls behind its solid face.
      frame.style.width = `${expandedWidth + 52}px`;
      frame.style.clipPath = `inset(0 0 0 ${travel}px)`;
      content.style.transform = `translate3d(${travel}px, 0, 0)`;
      if (progress > 0 && content.contains(document.activeElement)) icon.focus();
      setCollapsed(progress > 0);
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
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", draw);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    if (contentRef.current) observer?.observe(contentRef.current);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", draw);
      observer?.disconnect();
      if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
      redraw.current = () => {};
    };
  }, [reduceMotion, systemReduceMotion]);

  return (
    <div
      ref={frameRef}
      className="pointer-events-none fixed right-3 top-3 z-50 h-11 overflow-hidden transition-opacity duration-150 sm:right-8 sm:top-8"
      style={{ opacity: dimmed ? 0.4 : 1 }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          manualProgress.current = 1;
          redraw.current();
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
        className="pointer-events-auto absolute right-0 top-0 z-10 size-11 rounded-none border border-border bg-background transition-colors hover:bg-background dark:hover:bg-background"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        aria-controls="home-navigation"
        onClick={() => {
          manualProgress.current = collapsed ? 0 : 1;
          redraw.current();
          if (collapsed) contentRef.current?.querySelector<HTMLElement>("a, button")?.focus();
        }}
      >
        <Menu className="size-5" />
      </Button>
    </div>
  );
}
