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
  const reopened = useRef(false);
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
      const amount = reopened.current ? 0 : Math.min(1, Math.max(0, window.scrollY || 0) / Math.min(96, scrollRange));
      const progress = reduceMotion || systemReduceMotion ? Number(amount >= 1) : amount;
      const desktop = window.innerWidth >= 640;
      const expandedWidth = content.offsetWidth || 220;
      const expandedHeight = content.offsetHeight || 36;
      frame.style.width = `${expandedWidth * (1 - progress) + 44 * progress}px`;
      frame.style.height = `${expandedHeight * (1 - progress) + 44 * progress}px`;
      frame.style.top = `${(desktop ? 32 : 12) * (1 - progress) + 8 * progress}px`;
      frame.style.right = `${(desktop ? 32 : 12) * (1 - progress) + 12 * progress}px`;
      content.style.opacity = String(Math.max(0, 1 - progress / 0.65));
      icon.style.opacity = String(Math.max(0, (progress - 0.65) / 0.35));
      setCollapsed(progress >= 0.65);
    };
    redraw.current = draw;
    const schedule = () => {
      reopened.current = false;
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
      className="fixed right-3 top-3 z-50 overflow-hidden transition-opacity duration-150 sm:right-8 sm:top-8"
      style={{ opacity: dimmed ? 0.4 : 1 }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          reopened.current = false;
          redraw.current();
          if (window.scrollY > 0) iconRef.current?.focus();
        }
      }}
    >
      <div
        id="home-navigation"
        ref={contentRef}
        className="flex w-max items-center gap-2"
        inert={collapsed}
        aria-hidden={collapsed}
      >
        {children}
      </div>
      <Button
        ref={iconRef}
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 size-11 rounded-none border border-border bg-background opacity-0 transition-none"
        style={{ pointerEvents: collapsed ? "auto" : "none" }}
        tabIndex={collapsed ? 0 : -1}
        aria-hidden={!collapsed}
        aria-label="Expand navigation"
        aria-expanded={!collapsed}
        aria-controls="home-navigation"
        onClick={() => {
          reopened.current = true;
          redraw.current();
          contentRef.current?.querySelector<HTMLElement>("a, button")?.focus();
        }}
      >
        <Menu className="size-5" />
      </Button>
    </div>
  );
}
