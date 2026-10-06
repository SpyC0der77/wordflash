"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog } from "radix-ui";
import { PunctuationGlyph } from "@/components/punctuation-glyph";
import { ReaderSettingsContent } from "@/components/reader-settings-content";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { NumberInput } from "@/components/ui/number-input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  FOCAL_COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  type FocalColorKey,
  type FontFamilyKey,
  type FontSizeKey,
} from "@/lib/reader-appearance";
import { useReaderSettings } from "@/lib/reader-settings-context";
import { useProperNounGazetteer } from "@/lib/use-proper-noun-gazetteer";
import { useReduceMotion } from "@/lib/reduce-motion-context";
import { useReduceTransparency } from "@/lib/reduce-transparency-context";
import { useTheme } from "@/lib/theme-context";
import {
  calculateReadingTimeMs,
  getFirstProperNounFlags,
  getWordTiming,
  getPunctuationGlyphTiming,
  getSentenceToneMarkAt,
  getWordParts,
  parseWordsDetailed,
  wordEndsSentence,
  wordStartsSentence,
  type SentenceToneMark,
} from "@/lib/reader";
import { cn } from "@/lib/utils";

const SAMPLE_TEXT =
  "Paste your own text below, focus on the highlighted letter, press play, and let the words flow. Does this feel fast? Try an exclamation too!";

const INPUT_PANEL_CLASS_NAME =
  "h-full min-h-44 w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-3 text-base md:text-base leading-7 whitespace-pre-wrap break-words dark:bg-background shadow-none";

const SENTENCE_END_DELAY_MS_AT_250_WPM = 500;
const PAUSE_PUNCTUATION_DELAY_MS_AT_250_WPM = 250;
const DEFAULT_SENTENCE_END_MS = 500;
const DEFAULT_SPEECH_BREAK_MS = 250;

const SENTENCE_TONE_FADE_MS_AT_250_WPM = 300;

function visibleSentenceCue(
  mark: SentenceToneMark | null,
): "?" | "!" | null {
  return mark === "?" || mark === "!" ? mark : null;
}

export {
  FOCAL_COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  type FocalColorKey,
  type FontFamilyKey,
  type FontSizeKey,
};

interface ReaderBaseProps {
  wordsPerMinute?: number;
  /** When `wordsPerMinute` is controlled by the parent, wire this so the WPM control updates state (e.g. URL + persisted settings). */
  onWordsPerMinuteChange?: (value: number) => void;
  onWordIndexChange?: (index: number) => void;
  onComplete?: () => void;
  sentenceEndDurationMsAt250Wpm?: number;
  speechBreakDurationMsAt250Wpm?: number;
  /** When provided, syncs to this index (e.g. when user clicks a word in the article) */
  controlledWordIndex?: number;
}

interface ReaderFullProps extends ReaderBaseProps {
  variant: "full";
}

interface ReaderPanelProps extends ReaderBaseProps {
  variant: "panel";
  text: string;
  className?: string;
  /** When true, the word display area grows to fill available space (e.g. mobile full-screen) */
  fillHeight?: boolean;
  fontSize?: FontSizeKey;
  fontFamily?: FontFamilyKey;
  focalColor?: FocalColorKey;
}

interface ReaderTestProps extends ReaderBaseProps {
  variant: "test";
  text: string;
  className?: string;
}

type ReaderProps = ReaderFullProps | ReaderPanelProps | ReaderTestProps;

export function Reader(props: ReaderProps): React.ReactElement | null {
  const { reduceMotion, setReduceMotion } = useReduceMotion();
  const { reduceTransparency, setReduceTransparency } = useReduceTransparency();
  const { theme, setTheme } = useTheme();
  const readerSettings = useReaderSettings();
  const isFull = props.variant === "full";
  const isTest = props.variant === "test";
  const controlledWordIndex = props.controlledWordIndex;

  const [inputText, setInputText] = useState(
    isFull ? SAMPLE_TEXT : (props as ReaderPanelProps | ReaderTestProps).text,
  );
  const [wordIndex, setWordIndex] = useState(() => controlledWordIndex ?? 0);
  const wordsPerMinute = props.wordsPerMinute ?? readerSettings.wordsPerMinute;
  const setWordsPerMinute =
    props.onWordsPerMinuteChange ??
    (props.wordsPerMinute !== undefined
      ? () => {}
      : readerSettings.setWordsPerMinute);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedText, setCompletedText] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputTab, setInputTab] = useState<"edit" | "scrub">("edit");
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const scrubContainerRef = useRef<HTMLDivElement>(null);
  const editTabRef = useRef<HTMLButtonElement>(null);
  const scrubTabRef = useRef<HTMLButtonElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const fontSize = isFull
    ? readerSettings.fontSize
    : ((props as ReaderPanelProps).fontSize ?? "md");
  const fontFamily = isFull
    ? readerSettings.fontFamily
    : ((props as ReaderPanelProps).fontFamily ?? "serif");
  const focalColor = isFull
    ? readerSettings.focalColor
    : ((props as ReaderPanelProps).focalColor ?? "rose");
  const sentenceEndDurationMs = isFull
    ? readerSettings.sentenceEndDurationMs
    : ((props as ReaderPanelProps).sentenceEndDurationMsAt250Wpm ??
      DEFAULT_SENTENCE_END_MS);
  const speechBreakDurationMs = isFull
    ? readerSettings.speechBreakDurationMs
    : ((props as ReaderPanelProps).speechBreakDurationMsAt250Wpm ??
      DEFAULT_SPEECH_BREAK_MS);
  const setFontSize = readerSettings.setFontSize;
  const setFontFamily = readerSettings.setFontFamily;
  const setFocalColor = readerSettings.setFocalColor;
  const setSentenceEndDurationMs = readerSettings.setSentenceEndDurationMs;
  const setSpeechBreakDurationMs = readerSettings.setSpeechBreakDurationMs;
  const showPunctuationGlyph = readerSettings.showPunctuationGlyph;
  const setShowPunctuationGlyph = readerSettings.setShowPunctuationGlyph;
  const punctuationGlyphLeadMsAt250Wpm =
    readerSettings.punctuationGlyphLeadMs;
  const setPunctuationGlyphLeadMs = readerSettings.setPunctuationGlyphLeadMs;
  const punctuationGlyphDurationMsAt250Wpm =
    readerSettings.punctuationGlyphDurationMs;
  const setPunctuationGlyphDurationMs =
    readerSettings.setPunctuationGlyphDurationMs;
  const punctuationGlyphAlwaysVisible =
    readerSettings.punctuationGlyphAlwaysVisible;
  const setPunctuationGlyphAlwaysVisible =
    readerSettings.setPunctuationGlyphAlwaysVisible;
  const centerPunctuationTittleVertically =
    readerSettings.centerPunctuationTittleVertically;
  const setCenterPunctuationTittleVertically =
    readerSettings.setCenterPunctuationTittleVertically;
  const resetDefaults = readerSettings.resetDefaults;
  const timeoutRef = useRef<number | null>(null);
  const properNounGazetteer = useProperNounGazetteer();
  const [isGlyphLeading, setIsGlyphLeading] = useState(false);
  const [glyphHoldExpired, setGlyphHoldExpired] = useState(true);
  const rsvpLeftRef = useRef<HTMLSpanElement>(null);
  const rsvpRightRef = useRef<HTMLSpanElement>(null);
  const rsvpRowRef = useRef<HTMLDivElement>(null);

  const effectiveSentenceEndMs = isFull
    ? sentenceEndDurationMs
    : (props.sentenceEndDurationMsAt250Wpm ?? SENTENCE_END_DELAY_MS_AT_250_WPM);
  const effectiveSpeechBreakMs = isFull
    ? speechBreakDurationMs
    : (props.speechBreakDurationMsAt250Wpm ??
      PAUSE_PUNCTUATION_DELAY_MS_AT_250_WPM);

  const text = isFull
    ? inputText
    : (props as ReaderPanelProps | ReaderTestProps).text;
  const { words, hasLineBreakAfter, newlinesAfter, leadingNewlines, prefixBefore } =
    useMemo(() => parseWordsDetailed(text), [text]);
  const firstProperNounFlags = useMemo(
    () => getFirstProperNounFlags(words, properNounGazetteer),
    [words, properNounGazetteer],
  );
  const onWordIndexChange =
    "onWordIndexChange" in props ? props.onWordIndexChange : undefined;
  const effectiveWordIndex =
    controlledWordIndex !== undefined ? controlledWordIndex : wordIndex;
  const activeWordIndex =
    words.length === 0 ? 0 : Math.min(effectiveWordIndex, words.length - 1);
  const [playbackPosition, setPlaybackPosition] = useState({
    text,
    index: effectiveWordIndex,
  });
  if (
    playbackPosition.text !== text ||
    playbackPosition.index !== effectiveWordIndex
  ) {
    setPlaybackPosition({ text, index: effectiveWordIndex });
    setCompletedText(null);
  }
  const activeWord = words[activeWordIndex] ?? "";
  const { left, focalCharacter, right } = useMemo(
    () => getWordParts(activeWord),
    [activeWord],
  );
  const glyphWordIndex =
    isPlaying && isGlyphLeading
      ? Math.min(activeWordIndex + 1, Math.max(0, words.length - 1))
      : activeWordIndex;
  const sentenceToneMark = useMemo(() => {
    if (words.length === 0) return null;
    return visibleSentenceCue(
      getSentenceToneMarkAt(words, glyphWordIndex),
    );
  }, [words, glyphWordIndex]);
  const mountedRef = useRef(false);

  const setEffectiveWordIndex = useCallback(
    (index: number) => {
      setCompletedText(null);
      if (controlledWordIndex !== undefined) {
        onWordIndexChange?.(index);
      } else {
        setWordIndex(index);
      }
    },
    [controlledWordIndex, onWordIndexChange],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (mountedRef.current) {
      onWordIndexChange?.(effectiveWordIndex);
    }
  }, [effectiveWordIndex, onWordIndexChange]);

  // Measure and update pill position for tab switcher
  useLayoutEffect(() => {
    if (!isFull) return;
    const activeRef = inputTab === "edit" ? editTabRef : scrubTabRef;
    const tab = activeRef.current;
    const list = tabListRef.current;
    if (!tab || !list) return;
    const tabRect = tab.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const baseLeft = tabRect.left - listRect.left;
    const baseWidth = tabRect.width;
    setPillStyle({
      left: baseLeft - (inputTab === "edit" ? 1 : 0),
      width: baseWidth - (inputTab === "scrub" ? 1 : 0),
    });
  }, [isFull, inputTab]);

  // Scroll scrub view to keep highlighted word visible
  useEffect(() => {
    if (!isFull || inputTab !== "scrub" || words.length === 0) return;
    const container = scrubContainerRef.current;
    if (!container) return;
    const span = container.querySelector(
      `[data-word-index="${activeWordIndex}"]`,
    ) as HTMLElement | null;
    if (span) {
      const rect = span.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const margin = 40;
      const isComfortablyVisible =
        rect.top >= containerRect.top + margin &&
        rect.bottom <= containerRect.bottom - margin;
      if (!isComfortablyVisible) {
        const behavior = reduceMotion ? "auto" : "smooth";
        span.scrollIntoView({ behavior, block: "center" });
      }
    }
  }, [isFull, inputTab, activeWordIndex, words.length, reduceMotion]);

  useEffect(() => {
    if (!isPlaying || words.length === 0) return;

    const wpmScale =
      250 / Math.max(1, Number.isFinite(wordsPerMinute) ? wordsPerMinute : 1);
    const currentWord = words[activeWordIndex] ?? "";
    const delay = getWordTiming(
      currentWord,
      wordsPerMinute,
      effectiveSentenceEndMs,
      effectiveSpeechBreakMs,
      {
        nextWord: words[activeWordIndex + 1],
        hasLineBreakAfter: hasLineBreakAfter[activeWordIndex],
        isFirstProperNoun: firstProperNounFlags[activeWordIndex],
      },
    ).totalMs;
    const rawLeadMs = Math.max(
      0,
      Math.round(punctuationGlyphLeadMsAt250Wpm * wpmScale),
    );
    const leadMs = Math.max(0, Math.min(rawLeadMs, delay));
    const visibleMs = Math.round(
      punctuationGlyphDurationMsAt250Wpm * wpmScale,
    );
    const startsSentence = wordStartsSentence(words, activeWordIndex);

    // Reset lead when the current word changes; the timeout below may turn it back on.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart glyph flash for the new word
    setIsGlyphLeading(false);
    setGlyphHoldExpired(!startsSentence);

    timeoutRef.current = window.setTimeout(() => {
      if (activeWordIndex >= words.length - 1) {
        setCompletedText(text);
        setIsPlaying(false);
        return;
      }
      setEffectiveWordIndex(activeWordIndex + 1);
    }, delay);

    const upcomingCue = visibleSentenceCue(
      getSentenceToneMarkAt(
        words,
        Math.min(activeWordIndex + 1, words.length - 1),
      ),
    );
    const currentCue = visibleSentenceCue(
      getSentenceToneMarkAt(words, activeWordIndex),
    );

    const glyphHideTimeout =
      showPunctuationGlyph &&
      startsSentence &&
      currentCue !== null &&
      !punctuationGlyphAlwaysVisible
        ? window.setTimeout(() => {
            setGlyphHoldExpired(true);
          }, visibleMs)
        : null;

    const glyphLeadTimeout =
      showPunctuationGlyph &&
      upcomingCue !== null &&
      wordEndsSentence(currentWord, words[activeWordIndex + 1]) &&
      activeWordIndex < words.length - 1
        ? window.setTimeout(() => {
            setIsGlyphLeading(true);
          }, Math.max(0, delay - leadMs))
        : null;

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (glyphHideTimeout) clearTimeout(glyphHideTimeout);
      if (glyphLeadTimeout) clearTimeout(glyphLeadTimeout);
    };
  }, [
    isPlaying,
    text,
    words.length,
    wordsPerMinute,
    activeWordIndex,
    words,
    hasLineBreakAfter,
    firstProperNounFlags,
    effectiveSentenceEndMs,
    effectiveSpeechBreakMs,
    punctuationGlyphLeadMsAt250Wpm,
    punctuationGlyphDurationMsAt250Wpm,
    punctuationGlyphAlwaysVisible,
    showPunctuationGlyph,
    setEffectiveWordIndex,
  ]);

  const isFinished =
    words.length > 0 &&
    !isPlaying &&
    completedText === text &&
    activeWordIndex >= words.length - 1;
  const hasCalledCompleteRef = useRef(false);

  const remainingReadingTimeMs = useMemo(
    () =>
      calculateReadingTimeMs(
        words,
        wordsPerMinute,
        effectiveSentenceEndMs,
        effectiveSpeechBreakMs,
        activeWordIndex,
        words.length - 1,
        hasLineBreakAfter,
        properNounGazetteer,
      ),
    [
      words,
      hasLineBreakAfter,
      wordsPerMinute,
      activeWordIndex,
      effectiveSentenceEndMs,
      effectiveSpeechBreakMs,
      properNounGazetteer,
    ],
  );

  const readingTimeLabel =
    remainingReadingTimeMs >= 60000
      ? `~${Math.round(remainingReadingTimeMs / 60000)} min`
      : `~${Math.round(remainingReadingTimeMs / 1000)} sec`;

  const onComplete = "onComplete" in props ? props.onComplete : undefined;
  useEffect(() => {
    if (!isFinished) hasCalledCompleteRef.current = false;
    if (isFinished && onComplete && !hasCalledCompleteRef.current) {
      hasCalledCompleteRef.current = true;
      onComplete();
    }
  }, [isFinished, onComplete]);

  function handlePlayPauseRestart() {
    if (words.length === 0) return;
    if (isFinished) {
      setEffectiveWordIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }

  const handlersRef = useRef({
    handlePlayPauseRestart,
    setEffectiveWordIndex,
    activeWordIndex,
    wordsLength: words.length,
  });
  useEffect(() => {
    handlersRef.current = {
      handlePlayPauseRestart,
      setEffectiveWordIndex,
      activeWordIndex,
      wordsLength: words.length,
    };
  });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const el = document.activeElement;
      const tag = el?.tagName.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el?.getAttribute("contenteditable") === "true" ||
        el?.closest("[role='dialog']")
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const {
        handlePlayPauseRestart: playPause,
        setEffectiveWordIndex: setIndex,
        activeWordIndex: idx,
        wordsLength: len,
      } = handlersRef.current;
      if (len === 0) return;

      if (e.code === "Space") {
        e.preventDefault();
        playPause();
        return;
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        setIndex(0);
        setIsPlaying(true);
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        setIndex(Math.max(0, idx - 1));
        setIsPlaying(false);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        setIndex(Math.min(len - 1, idx + 1));
        setIsPlaying(false);
        return;
      }
      if (e.code === "Home") {
        e.preventDefault();
        setIndex(0);
        setIsPlaying(false);
        return;
      }
      if (e.code === "End") {
        e.preventDefault();
        setIndex(len - 1);
        setIsPlaying(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleTextChange(value: string) {
    setInputText(value);
    setEffectiveWordIndex(0);
    setIsPlaying(false);
  }

  const isPanelFillHeight =
    props.variant === "panel" && Boolean((props as ReaderPanelProps).fillHeight);

  const effectiveFontSize = isFull
    ? fontSize
    : ((props as ReaderPanelProps).fontSize ?? "md");
  const effectiveFontFamily = isFull
    ? fontFamily
    : ((props as ReaderPanelProps).fontFamily ?? "serif");
  const effectiveFocalColor = isFull
    ? focalColor
    : ((props as ReaderPanelProps).focalColor ?? "rose");

  const wordDisplayClassName = cn(
    FONT_SIZES[effectiveFontSize].className,
    FONT_FAMILIES[effectiveFontFamily].className,
  );
  const focalColorClassName = FOCAL_COLORS[effectiveFocalColor].className;
  const wpmScale = 250 / wordsPerMinute;
  const sentenceToneFadeMs = Math.max(
    50,
    Math.round(SENTENCE_TONE_FADE_MS_AT_250_WPM * wpmScale),
  );
  const sentenceToneLeadMs = Math.max(
    0,
    Math.round(punctuationGlyphLeadMsAt250Wpm * wpmScale),
  );
  const isSentenceStart = wordStartsSentence(words, activeWordIndex);
  const cueVisible = punctuationGlyphAlwaysVisible
    ? true
    : isPlaying &&
      (isGlyphLeading || (isSentenceStart && !glyphHoldExpired));
  const {
    holdMs: sentenceToneHoldMs,
    fadeOutMs: sentenceToneFadeOutMs,
    fadeInMs: sentenceToneFadeInMs,
  } = getPunctuationGlyphTiming(0, sentenceToneFadeMs, sentenceToneLeadMs);

  useLayoutEffect(() => {
    const rowForCleanup = rsvpRowRef.current;
    if (!rowForCleanup) return;

    let cancelled = false;
    function measure() {
      if (cancelled) return;
      const row = rsvpRowRef.current;
      const le = rsvpLeftRef.current;
      const re = rsvpRightRef.current;
      if (!row || !le || !re) {
        row?.style.removeProperty("transform");
        return;
      }
      const l = le.getBoundingClientRect().width;
      const r = re.getBoundingClientRect().width;
      row.style.transform = `translateX(${(r - l) / 2}px)`;
    }

    const le = rsvpLeftRef.current;
    const re = rsvpRightRef.current;
    if (!le || !re) {
      rowForCleanup.style.removeProperty("transform");
      return;
    }

    measure();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(measure);
    }

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(le);
      ro.observe(re);
    }

    return () => {
      cancelled = true;
      ro?.disconnect();
      rowForCleanup.style.removeProperty("transform");
    };
  }, [left, focalCharacter, right, effectiveFontSize, effectiveFontFamily]);

  if (!isFull && words.length === 0) return null;

  const content = (
    <>
      <section
        className={cn(
          "w-full",
          isPanelFillHeight ? "flex min-h-0 flex-1 flex-col" : "shrink-0",
        )}
      >
        <div
          className={cn(
            "relative mx-auto flex w-full max-w-4xl items-center justify-center overflow-hidden rounded-lg border sm:rounded-xl",
            reduceTransparency
              ? "border-border bg-muted dark:border-zinc-700"
              : "border-border bg-muted/80 dark:border-white/10 dark:bg-muted/90",
            isPanelFillHeight ? "min-h-40 flex-1 sm:min-h-48" : "h-44 sm:h-60",
          )}
        >
          {showPunctuationGlyph && (
            <PunctuationGlyph
              mark={sentenceToneMark}
              fadingOut={!cueVisible || sentenceToneMark == null}
              fadeInDurationMs={sentenceToneFadeInMs}
              fadeOutDurationMs={sentenceToneFadeOutMs}
              holdDurationMs={sentenceToneHoldMs}
              centerTittleVertically={centerPunctuationTittleVertically}
              fontFamilyClassName={FONT_FAMILIES[effectiveFontFamily].className}
              reduceTransparency={reduceTransparency}
              reduceMotion={reduceMotion}
            />
          )}
          <div className="pointer-events-none absolute left-1/2 top-0 z-[1] h-full w-px -translate-x-1/2 bg-border dark:bg-white/20" />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-[1] h-px bg-border/80 dark:bg-white/12",
              isPanelFillHeight ? "top-8 sm:top-14" : "top-14",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 z-[1] h-px bg-border/80 dark:bg-white/12",
              isPanelFillHeight ? "bottom-8 sm:bottom-14" : "bottom-14",
            )}
          />

          <div className="relative z-10 flex w-full max-w-2xl items-center justify-center px-3 sm:px-6">
            <div
              ref={rsvpRowRef}
              className={cn(
                "inline-flex items-baseline leading-none",
                wordDisplayClassName,
              )}
            >
              <span
                ref={rsvpLeftRef}
                className="text-zinc-700 dark:text-zinc-100"
              >
                {left}
              </span>
              <span className={focalColorClassName}>
                {focalCharacter || "•"}
              </span>
              <span
                ref={rsvpRightRef}
                className="text-zinc-700 dark:text-zinc-100"
              >
                {right}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 flex items-center justify-center gap-4 px-2 text-center text-sm text-zinc-700 transition-opacity duration-300 dark:text-muted-foreground sm:mt-3",
            isPlaying ? "opacity-40" : "opacity-100",
          )}
        >
          <p>
            {words.length === 0 ? 0 : activeWordIndex + 1}/{words.length}
            {readingTimeLabel && (
              <span className="ml-2">· {readingTimeLabel}</span>
            )}
          </p>
        </div>
        {words.length > 0 && !isTest && (
          <div
            className={cn(
              "mx-auto mt-3 w-full max-w-4xl shrink-0 px-1 transition-opacity duration-300 sm:mt-4 sm:px-2",
              isPanelFillHeight ? "mb-4 sm:mb-6" : "mb-6",
              isPlaying ? "opacity-40" : "opacity-100",
            )}
          >
            <Slider
              min={0}
              max={Math.max(0, words.length - 1)}
              step={1}
              value={[activeWordIndex]}
              onValueChange={([v]) => setEffectiveWordIndex(v ?? 0)}
              className="cursor-pointer"
            />
          </div>
        )}
      </section>

      <section
        className={cn(
          "flex w-full flex-wrap items-center justify-center gap-3 transition-opacity duration-300 sm:gap-4",
          isPlaying ? "opacity-40" : "opacity-100",
        )}
      >
        <Button
          variant="outline"
          size="lg"
          onClick={handlePlayPauseRestart}
          disabled={words.length === 0}
          className="px-5 sm:px-6"
        >
          {isPlaying ? "Pause" : isFinished ? "Restart" : "Play"}
        </Button>
        {!isTest && (
          <NumberInput
            value={wordsPerMinute}
            onChange={setWordsPerMinute}
            min={50}
            max={1200}
            step={50}
            unit="wpm"
          />
        )}
      </section>
    </>
  );

  if (props.variant === "panel") {
    const { className } = props;
    return (
      <div
        className={cn(
          "flex flex-col gap-4 bg-background px-4 py-4 sm:px-8",
          !isPanelFillHeight && "border-t border-border",
          !isPanelFillHeight &&
            (reduceTransparency
              ? "bg-background"
              : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"),
          isPanelFillHeight && "min-h-0",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  if (props.variant === "test") {
    const { className } = props;
    return (
      <div className={cn("flex flex-col gap-4", className)}>{content}</div>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 py-10 sm:px-8">
      <div
        className={cn(
          "fixed right-3 top-3 z-50 flex items-center gap-2 transition-opacity duration-300 sm:right-8 sm:top-8",
          isPlaying ? "opacity-40" : "opacity-100",
        )}
      >
        <Link
          href="/reader"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Article Reader
        </Link>
        <Link
          href="/about"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          About
        </Link>
        {isDesktop ? (
          <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open settings"
                className="size-8 sm:size-9"
              >
                <Settings className="size-5" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                className={cn(
                  "fixed inset-0 z-50",
                  reduceTransparency ? "bg-black" : "bg-black/80",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                )}
              />
              <Dialog.Content
                data-settings-modal
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background p-4 shadow-xl scrollbar-hide sm:rounded-xl sm:p-6",
                  reduceTransparency ? "border-zinc-700" : "border-white/10",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                )}
              >
                <Dialog.Title className="mb-2 shrink-0 text-lg font-semibold text-foreground">
                  Settings
                </Dialog.Title>
                <Dialog.Description className="mb-4 shrink-0 text-sm text-muted-foreground">
                  Appearance, playback, and accessibility. Pause values are at
                  250 WPM and scale with speed.
                </Dialog.Description>
                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
                  <ReaderSettingsContent
                    idPrefix=""
                    theme={theme}
                    setTheme={setTheme}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                    fontFamily={fontFamily}
                    setFontFamily={setFontFamily}
                    focalColor={focalColor}
                    setFocalColor={setFocalColor}
                    sentenceEndDurationMs={sentenceEndDurationMs}
                    setSentenceEndDurationMs={setSentenceEndDurationMs}
                    speechBreakDurationMs={speechBreakDurationMs}
                    setSpeechBreakDurationMs={setSpeechBreakDurationMs}
                    showPunctuationGlyph={showPunctuationGlyph}
                    setShowPunctuationGlyph={setShowPunctuationGlyph}
                    punctuationGlyphLeadMs={punctuationGlyphLeadMsAt250Wpm}
                    setPunctuationGlyphLeadMs={setPunctuationGlyphLeadMs}
                    punctuationGlyphDurationMs={
                      punctuationGlyphDurationMsAt250Wpm
                    }
                    setPunctuationGlyphDurationMs={
                      setPunctuationGlyphDurationMs
                    }
                    punctuationGlyphAlwaysVisible={
                      punctuationGlyphAlwaysVisible
                    }
                    setPunctuationGlyphAlwaysVisible={
                      setPunctuationGlyphAlwaysVisible
                    }
                    centerPunctuationTittleVertically={
                      centerPunctuationTittleVertically
                    }
                    setCenterPunctuationTittleVertically={
                      setCenterPunctuationTittleVertically
                    }
                    reduceTransparency={reduceTransparency}
                    setReduceTransparency={setReduceTransparency}
                    reduceMotion={reduceMotion}
                    setReduceMotion={setReduceMotion}
                    onResetDefaults={resetDefaults}
                  />
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        ) : (
          <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open settings"
                className="size-8 sm:size-9"
              >
                <Settings className="size-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent
              data-settings-modal
              className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden scrollbar-hide"
              overlayClassName={reduceTransparency ? "bg-black" : undefined}
            >
              <DrawerHeader className="shrink-0 text-left">
                <DrawerTitle>Settings</DrawerTitle>
                <DrawerDescription>
                  Appearance, playback, and accessibility. Pause values are at
                  250 WPM and scale with speed.
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-4 pb-6">
                <ReaderSettingsContent
                  idPrefix="drawer-"
                  theme={theme}
                  setTheme={setTheme}
                  fontSize={fontSize}
                  setFontSize={setFontSize}
                  fontFamily={fontFamily}
                  setFontFamily={setFontFamily}
                  focalColor={focalColor}
                  setFocalColor={setFocalColor}
                  sentenceEndDurationMs={sentenceEndDurationMs}
                  setSentenceEndDurationMs={setSentenceEndDurationMs}
                  speechBreakDurationMs={speechBreakDurationMs}
                  setSpeechBreakDurationMs={setSpeechBreakDurationMs}
                  showPunctuationGlyph={showPunctuationGlyph}
                  setShowPunctuationGlyph={setShowPunctuationGlyph}
                  punctuationGlyphLeadMs={punctuationGlyphLeadMsAt250Wpm}
                  setPunctuationGlyphLeadMs={setPunctuationGlyphLeadMs}
                  punctuationGlyphDurationMs={
                    punctuationGlyphDurationMsAt250Wpm
                  }
                  setPunctuationGlyphDurationMs={setPunctuationGlyphDurationMs}
                  punctuationGlyphAlwaysVisible={
                    punctuationGlyphAlwaysVisible
                  }
                  setPunctuationGlyphAlwaysVisible={
                    setPunctuationGlyphAlwaysVisible
                  }
                  centerPunctuationTittleVertically={
                    centerPunctuationTittleVertically
                  }
                  setCenterPunctuationTittleVertically={
                    setCenterPunctuationTittleVertically
                  }
                  reduceTransparency={reduceTransparency}
                  setReduceTransparency={setReduceTransparency}
                  reduceMotion={reduceMotion}
                  setReduceMotion={setReduceMotion}
                  onResetDefaults={resetDefaults}
                />
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
      <div className="min-h-0 flex-1 shrink-0" aria-hidden />
      {content}
      <div className="min-h-0 flex-1 shrink-0" aria-hidden />
      <section
        className={cn(
          "w-full max-w-4xl pb-6 transition-opacity duration-300 sm:pb-0",
          isPlaying ? "opacity-40" : "opacity-100",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <label
            htmlFor={inputTab === "edit" ? "reader-text" : undefined}
            className="text-sm font-medium text-muted-foreground"
          >
            Text to read{words.length > 0 && ` (${words.length} words)`}
          </label>
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Input mode"
            className="relative flex rounded-lg border border-border bg-muted/50 p-0.5"
          >
            {pillStyle && (
              <div
                className={cn(
                  "absolute inset-y-0 rounded-md bg-background shadow-sm",
                  reduceMotion
                    ? "transition-none"
                    : "transition-[left,width] duration-200 ease-out",
                )}
                style={{
                  left: pillStyle.left,
                  width: pillStyle.width,
                  top: 2,
                  bottom: 2,
                }}
                aria-hidden
              />
            )}
            <button
              ref={editTabRef}
              type="button"
              role="tab"
              aria-selected={inputTab === "edit"}
              aria-controls="reader-text-panel"
              id="reader-edit-tab"
              onClick={() => setInputTab("edit")}
              className={cn(
                "relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                inputTab === "edit"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Edit
            </button>
            <button
              ref={scrubTabRef}
              type="button"
              role="tab"
              aria-selected={inputTab === "scrub"}
              aria-controls="reader-scrub-panel"
              id="reader-scrub-tab"
              onClick={() => setInputTab("scrub")}
              className={cn(
                "relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                inputTab === "scrub"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Scrub
            </button>
          </div>
        </div>
        <div className="h-44 min-h-44 resize-y overflow-hidden">
          {inputTab === "edit" ? (
            <Textarea
              id="reader-text"
              value={inputText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste text here..."
              className={cn(
                INPUT_PANEL_CLASS_NAME,
                "field-sizing-fixed resize-none focus-visible:ring-inset",
              )}
              aria-labelledby="reader-edit-tab"
            />
          ) : (
            <div
              ref={scrubContainerRef}
              id="reader-scrub-panel"
              role="tabpanel"
              aria-labelledby="reader-scrub-tab"
              className={cn(
                INPUT_PANEL_CLASS_NAME,
                "cursor-pointer [&_[data-word-index]]:cursor-pointer [&_[data-word-index]]:rounded-sm [&_[data-word-index]]:transition-colors [&_[data-word-index]]:hover:bg-muted/50",
              )}
            >
              {words.length === 0 ? (
                <span className="text-muted-foreground">Paste text here...</span>
              ) : (
                <>
                  {"\n".repeat(leadingNewlines)}
                  {words.flatMap((word, i) => [
                    ...(i > 0 && (newlinesAfter[i - 1] ?? 0) === 0
                      ? [" " as const]
                      : []),
                    prefixBefore[i] ?? "",
                    <span
                      key={i}
                      data-word-index={i}
                      className={cn(i === activeWordIndex && "reader-highlight")}
                      onClick={() => {
                        setEffectiveWordIndex(i);
                        setIsPlaying(false);
                      }}
                    >
                      {word}
                    </span>,
                    ...(newlinesAfter[i]
                      ? ["\n".repeat(newlinesAfter[i] ?? 0)]
                      : []),
                  ])}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
