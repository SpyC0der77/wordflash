"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TransitionEvent,
} from "react";
import { cn } from "@/lib/utils";

interface PunctuationGlyphProps {
  mark: "." | "?" | "!" | null;
  fadingOut: boolean;
  fadeInDurationMs: number;
  fadeOutDurationMs: number;
  holdDurationMs: number;
  centerTittleVertically: boolean;
  fontFamilyClassName: string;
  reduceTransparency: boolean;
  reduceMotion: boolean;
}

function getLowestInkCentroid(
  glyph: string,
  font: string,
): { x: number; y: number } | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.font = font;
  const metrics = ctx.measureText(glyph);
  const left = Math.ceil(Math.abs(metrics.actualBoundingBoxLeft || 0));
  const right = Math.ceil(
    Math.abs(metrics.actualBoundingBoxRight || metrics.width),
  );
  const ascent = Math.ceil(Math.abs(metrics.actualBoundingBoxAscent || 0));
  const descent = Math.ceil(Math.abs(metrics.actualBoundingBoxDescent || 0));
  const pad = 4;
  const width = left + right + pad * 2;
  const height = ascent + descent + pad * 2;
  if (width <= 0 || height <= 0) return null;

  canvas.width = width;
  canvas.height = height;
  ctx.font = font;
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  const originX = left + pad;
  const originY = ascent + pad;
  ctx.fillText(glyph, originX, originY);

  const { data } = ctx.getImageData(0, 0, width, height);
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];

  let seedX = -1;
  let seedY = -1;
  for (let y = height - 1; y >= 0 && seedY < 0; y--) {
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) > 24) {
        seedX = x;
        seedY = y;
        break;
      }
    }
  }
  if (seedY < 0) return null;

  const seen = new Uint8Array(width * height);
  const stack = [seedX, seedY];
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;
    const index = y * width + x;
    if (seen[index]) continue;
    if (alphaAt(x, y) <= 24) continue;
    seen[index] = 1;
    sumX += x;
    sumY += y;
    count += 1;
    if (x > 0) stack.push(x - 1, y);
    if (x + 1 < width) stack.push(x + 1, y);
    if (y > 0) stack.push(x, y - 1);
    if (y + 1 < height) stack.push(x, y + 1);
  }

  if (count === 0) return null;
  return {
    x: sumX / count - originX,
    y: sumY / count - originY,
  };
}

export function PunctuationGlyph({
  mark,
  fadingOut,
  fadeInDurationMs,
  fadeOutDurationMs,
  holdDurationMs,
  centerTittleVertically,
  fontFamilyClassName,
  reduceTransparency,
  reduceMotion,
}: PunctuationGlyphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<SVGTextElement>(null);
  const [paintedMark, setPaintedMark] = useState(mark);
  const [exiting, setExiting] = useState(fadingOut);
  const exitCompleteRef = useRef(fadingOut);
  const exitingRef = useRef(fadingOut);
  const markRef = useRef(mark);
  const fadingOutRef = useRef(fadingOut);

  useEffect(() => {
    markRef.current = mark;
    fadingOutRef.current = fadingOut;
  });

  function finishExit() {
    exitCompleteRef.current = true;
    setPaintedMark(markRef.current);
    if (fadingOutRef.current) return;
    exitingRef.current = false;
    setExiting(false);
  }

  useLayoutEffect(() => {
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- snap the painted mark when motion is off
      setPaintedMark(mark);
      if (!fadingOut) {
        setExiting(false);
        exitingRef.current = false;
        exitCompleteRef.current = true;
      }
      return;
    }

    if (fadingOut) {
      if (exitingRef.current) return;
      exitCompleteRef.current = false;
      exitingRef.current = true;
      setExiting(true);
      return;
    }

    if (exitCompleteRef.current) {
      setPaintedMark(mark);
      exitingRef.current = false;
      setExiting(false);
    }
  }, [fadingOut, mark, reduceMotion]);

  useEffect(() => {
    if (!fadingOut) return;
    if (reduceMotion) {
      const timeout = window.setTimeout(() => {
        exitingRef.current = true;
        exitCompleteRef.current = true;
        setExiting(true);
        setPaintedMark(markRef.current);
      }, holdDurationMs);
      return () => clearTimeout(timeout);
    }
    if (!exiting) return;
    const waitMs = holdDurationMs + fadeOutDurationMs + 32;
    const timeout = window.setTimeout(() => {
      if (!exitCompleteRef.current) finishExit();
    }, waitMs);
    return () => clearTimeout(timeout);
  }, [
    exiting,
    fadingOut,
    holdDurationMs,
    fadeOutDurationMs,
    reduceMotion,
  ]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !paintedMark) return;

    function alignInk() {
      const svgEl = svgRef.current;
      const textEl = textRef.current;
      if (!svgEl || !textEl) return;
      textEl.removeAttribute("transform");
      const bbox = textEl.getBBox();
      if (bbox.width === 0 && bbox.height === 0) return;

      let cx = bbox.x + bbox.width / 2;
      let cy = bbox.y + bbox.height / 2;
      if (paintedMark === "?" || paintedMark === "!") {
        const style = window.getComputedStyle(textEl);
        const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const tittle = getLowestInkCentroid(paintedMark, font);
        if (tittle) {
          cx = tittle.x;
          if (centerTittleVertically) cy = tittle.y;
        }
      }

      const dx = svgEl.clientWidth / 2 - cx;
      const dy = svgEl.clientHeight / 2 - cy;
      textEl.setAttribute("transform", `translate(${dx} ${dy})`);
    }

    alignInk();
    const observer = new ResizeObserver(alignInk);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [paintedMark, fontFamilyClassName, centerTittleVertically]);

  if (!paintedMark) return null;

  const hidden = exiting;

  const durationMs = hidden ? fadeOutDurationMs : fadeInDurationMs;
  const delayMs = hidden ? holdDurationMs : 0;

  function handleTransitionEnd(event: TransitionEvent<SVGSVGElement>) {
    if (event.propertyName !== "opacity" || !exiting) return;
    finishExit();
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <svg
        ref={svgRef}
        className={cn(
          "absolute inset-0 h-full w-full",
          fontFamilyClassName,
          reduceTransparency
            ? "text-foreground/10"
            : "text-foreground/[0.028] dark:text-foreground/[0.045]",
          !reduceTransparency &&
            "[mask-image:radial-gradient(ellipse_at_center,black_22%,transparent_62%)]",
        )}
        style={
          reduceMotion
            ? undefined
            : {
                opacity: hidden ? 0 : 1,
                transitionProperty: "opacity",
                transitionDuration: `${durationMs}ms`,
                transitionDelay: `${delayMs}ms`,
                transitionTimingFunction: hidden
                  ? "cubic-bezier(0.4, 0, 1, 1)"
                  : "cubic-bezier(0.22, 1, 0.36, 1)",
              }
        }
        onTransitionEnd={handleTransitionEnd}
      >
        <text
          ref={textRef}
          x={0}
          y={0}
          fill="currentColor"
          className={
            paintedMark === "."
              ? "text-[5rem] sm:text-[7rem]"
              : "text-[6.75rem] sm:text-[9.5rem]"
          }
        >
          {paintedMark}
        </text>
      </svg>
    </div>
  );
}
