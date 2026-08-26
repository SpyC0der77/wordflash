"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type TransitionEvent,
} from "react";
import type { SentenceToneMark } from "@/lib/reader";

interface UsePunctuationCueFadeOptions {
  mark: SentenceToneMark | null;
  fadingOut: boolean;
  fadeInDurationMs: number;
  fadeOutDurationMs: number;
  holdDurationMs: number;
  reduceMotion: boolean;
}

export function usePunctuationCueFade({
  mark,
  fadingOut,
  fadeInDurationMs,
  fadeOutDurationMs,
  holdDurationMs,
  reduceMotion,
}: UsePunctuationCueFadeOptions) {
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
  }, [exiting, fadingOut, holdDurationMs, fadeOutDurationMs, reduceMotion]);

  const hidden = exiting;
  const durationMs = hidden ? fadeOutDurationMs : fadeInDurationMs;
  const delayMs = hidden ? holdDurationMs : 0;

  function handleTransitionEnd(event: TransitionEvent<Element>) {
    if (event.propertyName !== "opacity" || !exiting) return;
    finishExit();
  }

  const fadeStyle: CSSProperties = {
    opacity: hidden ? 0 : 1,
    ...(reduceMotion
      ? undefined
      : {
          transitionProperty: "opacity",
          transitionDuration: `${durationMs}ms`,
          transitionDelay: `${delayMs}ms`,
          transitionTimingFunction: hidden
            ? "cubic-bezier(0.4, 0, 1, 1)"
            : "cubic-bezier(0.22, 1, 0.36, 1)",
        }),
  };

  return {
    paintedMark,
    hidden,
    fadeStyle,
    handleTransitionEnd,
  };
}
