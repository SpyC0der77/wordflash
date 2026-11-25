"use client";

import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PunctuationGlyph } from "@/components/punctuation-glyph";
import { ReaderSettingsPanel } from "@/components/reader-settings-panel";
import { HomeScrollMenu } from "@/components/home-scroll-menu";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { isTypingInFocusedElement } from "@/lib/keyboard";
import {
  FOCAL_COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  type FocalColorKey,
  type FontFamilyKey,
  type FontSizeKey,
} from "@/lib/reader-appearance";
import {
  DEFAULT_SENTENCE_END_MS,
  DEFAULT_SPEECH_BREAK_MS,
  WPM_MAX,
  WPM_MIN,
} from "@/lib/reader-defaults";
import { useReaderSettings } from "@/lib/reader-settings-context";
import { useProperNounGazetteer } from "@/lib/use-proper-noun-gazetteer";
import { useReduceMotion } from "@/lib/reduce-motion-context";
import { useReduceTransparency } from "@/lib/reduce-transparency-context";
import {
  calculateReadingTimeMs,
  formatReadingTime,
  getFirstProperNounFlags,
  getWordTiming,
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
const DRAFT_KEY = "wordflash-text-draft";
const subscribeToDraft = () => () => {};
function readDraft() {
  try { return sessionStorage.getItem(DRAFT_KEY) ?? SAMPLE_TEXT; }
  catch { return SAMPLE_TEXT; }
}

const INPUT_PANEL_CLASS_NAME =
  "h-full min-h-44 w-full overflow-y-auto rounded-md border border-input bg-background px-3 py-3 text-base md:text-base leading-7 whitespace-pre-wrap break-words dark:bg-background shadow-none";

const SENTENCE_TONE_FADE_MS_AT_250_WPM = 300;

type InputTab = "edit" | "scrub";
const INPUT_TABS: ReadonlyArray<{ id: InputTab; label: string }> = [
  { id: "edit", label: "Edit" },
  { id: "scrub", label: "Scrub" },
];

/** Multiplier that converts a duration tuned at 250 WPM to the current speed. */
function wpmScale(wordsPerMinute: number): number {
  return 250 / Math.max(1, Number.isFinite(wordsPerMinute) ? wordsPerMinute : 1);
}

function visibleSentenceCue(
  mark: SentenceToneMark | null,
): "?" | "!" | null {
  return mark === "?" || mark === "!" ? mark : null;
}

interface ReaderBaseProps {
  /** Increment after a user seeks in another view, even if the selected word is unchanged. */
  pauseRequest?: number;
  /** Pause when another view covers the words. Closing it does not resume playback. */
  playbackBlocked?: boolean;
  wordsPerMinute?: number;
  /** When `wordsPerMinute` is controlled by the parent, wire this so the WPM control updates state (e.g. URL + persisted settings). */
  onWordsPerMinuteChange?: (value: number) => void;
  onWordIndexChange?: (index: number) => void;
  onComplete?: () => void;
  onPlaybackChange?: (playing: boolean) => void;
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
  const { reduceMotion } = useReduceMotion();
  const { reduceTransparency } = useReduceTransparency();
  const readerSettings = useReaderSettings();
  const isFull = props.variant === "full";
  const isTest = props.variant === "test";
  const panelProps = props.variant === "panel" ? props : undefined;
  const isPanelFillHeight = Boolean(panelProps?.fillHeight);
  const { controlledWordIndex, onWordIndexChange, onComplete, onPlaybackChange } = props;

  // The full reader follows saved settings; embedded readers take them from props.
  const fontSize = isFull ? readerSettings.fontSize : (panelProps?.fontSize ?? "md");
  const fontFamily = isFull ? readerSettings.fontFamily : (panelProps?.fontFamily ?? "serif");
  const focalColor = isFull ? readerSettings.focalColor : (panelProps?.focalColor ?? "rose");
  const sentenceEndDurationMs = isFull
    ? readerSettings.sentenceEndDurationMs
    : (props.sentenceEndDurationMsAt250Wpm ?? DEFAULT_SENTENCE_END_MS);
  const speechBreakDurationMs = isFull
    ? readerSettings.speechBreakDurationMs
    : (props.speechBreakDurationMsAt250Wpm ?? DEFAULT_SPEECH_BREAK_MS);
  const {
    showPunctuationGlyph,
    punctuationGlyphLeadMs: punctuationGlyphLeadMsAt250Wpm,
    punctuationGlyphDurationMs: punctuationGlyphDurationMsAt250Wpm,
    punctuationGlyphAlwaysVisible,
    centerPunctuationTittleVertically,
  } = readerSettings;

  const wordsPerMinute = props.wordsPerMinute ?? readerSettings.wordsPerMinute;
  const setWordsPerMinute =
    props.onWordsPerMinuteChange ??
    (props.wordsPerMinute !== undefined
      ? () => {}
      : readerSettings.setWordsPerMinute);

  const storedDraft = useSyncExternalStore(subscribeToDraft, readDraft, () => SAMPLE_TEXT);
  const [inputText, setInputText] = useState<string | null>(null);
  const text = props.variant === "full" ? (inputText ?? storedDraft) : props.text;

  const [wordIndex, setWordIndex] = useState(() => controlledWordIndex ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previousPauseRequest, setPreviousPauseRequest] = useState(props.pauseRequest);
  if (previousPauseRequest !== props.pauseRequest) {
    setPreviousPauseRequest(props.pauseRequest);
    setIsPlaying(false);
  }
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setIsPlaying(false); };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, []);
  useEffect(() => {
    onPlaybackChange?.(isPlaying);
  }, [isPlaying, onPlaybackChange]);

  const [completedText, setCompletedText] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const playbackBlocked = isSettingsOpen || Boolean(props.playbackBlocked);
  if (playbackBlocked && isPlaying) setIsPlaying(false);

  const [inputTab, setInputTab] = useState<InputTab>("edit");
  const scrubContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<InputTab, HTMLButtonElement | null>>({ edit: null, scrub: null });
  const tabListRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);

  const timeoutRef = useRef<number | null>(null);
  const properNounGazetteer = useProperNounGazetteer();
  const [isGlyphLeading, setIsGlyphLeading] = useState(false);
  const [glyphHoldExpired, setGlyphHoldExpired] = useState(true);
  const rsvpLeftRef = useRef<HTMLSpanElement>(null);
  const rsvpRightRef = useRef<HTMLSpanElement>(null);
  const rsvpRowRef = useRef<HTMLDivElement>(null);

  const { words, hasLineBreakAfter, newlinesAfter, leadingNewlines, prefixBefore } =
    useMemo(() => parseWordsDetailed(text), [text]);
  const firstProperNounFlags = useMemo(
    () => getFirstProperNounFlags(words, properNounGazetteer),
    [words, properNounGazetteer],
  );
  const effectiveWordIndex = controlledWordIndex ?? wordIndex;
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
    return visibleSentenceCue(getSentenceToneMarkAt(words, glyphWordIndex));
  }, [words, glyphWordIndex]);

  const scale = wpmScale(wordsPerMinute);
  const glyphLeadMs = Math.max(0, Math.round(punctuationGlyphLeadMsAt250Wpm * scale));
  const glyphVisibleMs = Math.round(punctuationGlyphDurationMsAt250Wpm * scale);
  const sentenceToneFadeMs = Math.max(
    50,
    Math.round(SENTENCE_TONE_FADE_MS_AT_250_WPM * scale),
  );

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

  const mountedRef = useRef(false);
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
    const tab = tabRefs.current[inputTab];
    const list = tabListRef.current;
    if (!tab || !list) return;
    const tabRect = tab.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    setPillStyle({
      left: tabRect.left - listRect.left - (inputTab === "edit" ? 1 : 0),
      width: tabRect.width - (inputTab === "scrub" ? 1 : 0),
    });
  }, [isFull, inputTab]);

  // Scroll scrub view to keep highlighted word visible
  useEffect(() => {
    if (!isFull || inputTab !== "scrub" || words.length === 0) return;
    const container = scrubContainerRef.current;
    const span = container?.querySelector<HTMLElement>(
      `[data-word-index="${activeWordIndex}"]`,
    );
    if (!container || !span) return;
    const rect = span.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const margin = 40;
    const isComfortablyVisible =
      rect.top >= containerRect.top + margin &&
      rect.bottom <= containerRect.bottom - margin;
    if (isComfortablyVisible) return;
    // Keep auto-follow inside the text panel. scrollIntoView also pans the
    // page's visual viewport when the reader has pinch-zoomed in.
    container.scrollTo({
      top: container.scrollTop + rect.top - containerRect.top
        - (container.clientHeight - rect.height) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [isFull, inputTab, activeWordIndex, words.length, reduceMotion]);

  useEffect(() => {
    if (!isPlaying || words.length === 0) return;

    const currentWord = words[activeWordIndex] ?? "";
    const nextWord = words[activeWordIndex + 1];
    const isLastWord = activeWordIndex >= words.length - 1;
    const delay = getWordTiming(
      currentWord,
      wordsPerMinute,
      sentenceEndDurationMs,
      speechBreakDurationMs,
      {
        nextWord,
        hasLineBreakAfter: hasLineBreakAfter[activeWordIndex],
        isFirstProperNoun: firstProperNounFlags[activeWordIndex],
      },
    ).totalMs;
    const leadMs = Math.min(glyphLeadMs, delay);
    const startsSentence = wordStartsSentence(words, activeWordIndex);

    // Reset lead when the current word changes; the timeout below may turn it back on.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart glyph flash for the new word
    setIsGlyphLeading(false);
    setGlyphHoldExpired(!startsSentence);

    timeoutRef.current = window.setTimeout(() => {
      if (isLastWord) {
        setCompletedText(text);
        setIsPlaying(false);
        return;
      }
      setEffectiveWordIndex(activeWordIndex + 1);
    }, delay);

    const upcomingCue = visibleSentenceCue(
      getSentenceToneMarkAt(words, Math.min(activeWordIndex + 1, words.length - 1)),
    );
    const currentCue = visibleSentenceCue(getSentenceToneMarkAt(words, activeWordIndex));

    const glyphHideTimeout =
      showPunctuationGlyph &&
      startsSentence &&
      currentCue !== null &&
      !punctuationGlyphAlwaysVisible
        ? window.setTimeout(() => setGlyphHoldExpired(true), glyphVisibleMs)
        : null;

    const glyphLeadTimeout =
      showPunctuationGlyph &&
      upcomingCue !== null &&
      wordEndsSentence(currentWord, nextWord) &&
      !isLastWord
        ? window.setTimeout(() => setIsGlyphLeading(true), Math.max(0, delay - leadMs))
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
    wordsPerMinute,
    activeWordIndex,
    words,
    hasLineBreakAfter,
    firstProperNounFlags,
    sentenceEndDurationMs,
    speechBreakDurationMs,
    glyphLeadMs,
    glyphVisibleMs,
    punctuationGlyphAlwaysVisible,
    showPunctuationGlyph,
    setEffectiveWordIndex,
  ]);

  const isFinished =
    words.length > 0 &&
    !isPlaying &&
    completedText === text &&
    activeWordIndex >= words.length - 1;

  const remainingReadingTimeMs = useMemo(
    () =>
      calculateReadingTimeMs(
        words,
        wordsPerMinute,
        sentenceEndDurationMs,
        speechBreakDurationMs,
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
      sentenceEndDurationMs,
      speechBreakDurationMs,
      properNounGazetteer,
    ],
  );

  const hasCalledCompleteRef = useRef(false);
  useEffect(() => {
    if (!isFinished) hasCalledCompleteRef.current = false;
    if (isFinished && onComplete && !hasCalledCompleteRef.current) {
      hasCalledCompleteRef.current = true;
      onComplete();
    }
  }, [isFinished, onComplete]);

  function handlePlayPauseRestart() {
    if (words.length === 0 || playbackBlocked) return;
    if (isFinished) {
      setEffectiveWordIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }

  function seekTo(index: number) {
    setEffectiveWordIndex(index);
    setIsPlaying(false);
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
      if (isTypingInFocusedElement()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      if (el?.closest("[role=tablist], [role=slider], [role=menu], [role=menuitem]")) return;

      const {
        handlePlayPauseRestart: playPause,
        setEffectiveWordIndex: setIndex,
        activeWordIndex: idx,
        wordsLength: len,
      } = handlersRef.current;
      if (len === 0) return;

      if (e.code === "Space") {
        if (el?.tagName.toLowerCase() === "button" || el?.closest("[role=button], [role=menu], [role=menuitem]")) return;
        e.preventDefault();
        if (e.repeat) return;
        playPause();
        return;
      }
      if (e.code === "KeyR") {
        e.preventDefault();
        setIndex(0);
        setIsPlaying(true);
        return;
      }
      const seekTargets: Record<string, number> = {
        ArrowLeft: Math.max(0, idx - 1),
        ArrowRight: Math.min(len - 1, idx + 1),
        Home: 0,
        End: len - 1,
      };
      if (e.code in seekTargets) {
        e.preventDefault();
        setIndex(seekTargets[e.code]);
        setIsPlaying(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleTextChange(value: string) {
    setInputText(value);
    try { sessionStorage.setItem(DRAFT_KEY, value); } catch { /* Keep the in-memory draft. */ }
    seekTo(0);
  }

  const fontFamilyClassName = FONT_FAMILIES[fontFamily].className;
  const dimWhilePlaying = cn(
    "transition-opacity duration-300",
    isPlaying ? "opacity-40" : "opacity-100",
  );
  const isSentenceStart = wordStartsSentence(words, activeWordIndex);
  const cueVisible =
    punctuationGlyphAlwaysVisible ||
    (isPlaying && (isGlyphLeading || (isSentenceStart && !glyphHoldExpired)));

  // Center the focal character: shift the row by half the width difference of its sides.
  useLayoutEffect(() => {
    const row = rsvpRowRef.current;
    const leftSide = rsvpLeftRef.current;
    const rightSide = rsvpRightRef.current;
    if (!row || !leftSide || !rightSide) return;

    let cancelled = false;
    function measure() {
      if (cancelled || !row || !leftSide || !rightSide) return;
      const offset =
        (rightSide.getBoundingClientRect().width - leftSide.getBoundingClientRect().width) / 2;
      row.style.transform = `translateX(${offset}px)`;
    }

    measure();
    void document.fonts?.ready.then(measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    ro?.observe(leftSide);
    ro?.observe(rightSide);

    return () => {
      cancelled = true;
      ro?.disconnect();
      row.style.removeProperty("transform");
    };
  }, [left, focalCharacter, right, fontSize, fontFamily]);

  if (!isFull && words.length === 0) return null;

  const guideLineClassName =
    "pointer-events-none absolute inset-x-0 z-[1] h-px bg-border/80 dark:bg-white/12";

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
            isFull && "max-w-[min(56rem,calc(100vw-132px))] sm:max-w-[min(56rem,calc(100vw-184px))]",
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
              fadeInDurationMs={glyphLeadMs}
              fadeOutDurationMs={sentenceToneFadeMs}
              holdDurationMs={0}
              centerTittleVertically={centerPunctuationTittleVertically}
              fontFamilyClassName={fontFamilyClassName}
              reduceTransparency={reduceTransparency}
              reduceMotion={reduceMotion}
            />
          )}
          <div className="pointer-events-none absolute left-1/2 top-0 z-[1] h-full w-px -translate-x-1/2 bg-border dark:bg-white/20" />
          <div className={cn(guideLineClassName, isPanelFillHeight ? "top-8 sm:top-14" : "top-14")} />
          <div className={cn(guideLineClassName, isPanelFillHeight ? "bottom-8 sm:bottom-14" : "bottom-14")} />

          <div className="relative z-10 flex w-full max-w-2xl items-center justify-center px-3 sm:px-6">
            <div
              ref={rsvpRowRef}
              className={cn(
                "inline-flex items-baseline leading-none",
                FONT_SIZES[fontSize].className,
                fontFamilyClassName,
              )}
            >
              <span ref={rsvpLeftRef} className="text-zinc-700 dark:text-zinc-100">
                {left}
              </span>
              <span className={FOCAL_COLORS[focalColor].className}>
                {focalCharacter || "•"}
              </span>
              <span ref={rsvpRightRef} className="text-zinc-700 dark:text-zinc-100">
                {right}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 flex items-center justify-center gap-4 px-2 text-center text-sm text-zinc-700 dark:text-muted-foreground sm:mt-3",
            dimWhilePlaying,
          )}
        >
          <p>
            {words.length === 0 ? 0 : activeWordIndex + 1}/{words.length}
            <span className="ml-2">· {formatReadingTime(remainingReadingTimeMs)}</span>
          </p>
        </div>
        {words.length > 0 && !isTest && (
          <div
            className={cn(
              "mx-auto mt-3 w-full max-w-4xl shrink-0 px-1 sm:mt-4 sm:px-2",
              isPanelFillHeight ? "mb-4 sm:mb-6" : "mb-6",
              dimWhilePlaying,
            )}
          >
            <Slider
              min={0}
              max={Math.max(0, words.length - 1)}
              step={1}
              value={[activeWordIndex]}
              aria-label="Reading position"
              disabled={words.length < 2}
              onValueChange={([v]) => seekTo(v ?? 0)}
              className="cursor-pointer"
            />
          </div>
        )}
      </section>

      <section
        className={cn(
          "flex w-full flex-wrap items-center justify-center gap-3 sm:gap-4",
          dimWhilePlaying,
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
            min={WPM_MIN}
            max={WPM_MAX}
            step={50}
            unit="wpm"
            label="Reading speed"
          />
        )}
      </section>
    </>
  );

  if (props.variant === "panel") {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 bg-background px-4 py-4 sm:px-8",
          isPanelFillHeight
            ? "min-h-0"
            : cn(
                "border-t border-border",
                reduceTransparency
                  ? "bg-background"
                  : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
              ),
          props.className,
        )}
      >
        {content}
      </div>
    );
  }

  if (props.variant === "test") {
    return (
      <div className={cn("flex flex-col gap-4", props.className)}>{content}</div>
    );
  }

  const navLinkClassName =
    "text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 py-10 sm:px-8">
      <HomeScrollMenu dimmed={isPlaying}>
        <Link href="/reader" className={navLinkClassName}>
          Article Reader
        </Link>
        <Link href="/about" className={navLinkClassName}>
          About
        </Link>
        <ReaderSettingsPanel
          title="Settings"
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          triggerClassName="size-8 sm:size-9"
        />
      </HomeScrollMenu>
      {/* Reserve space for the default input height, independent of user resizing. */}
      <div className="flex min-h-[calc(100svh-19rem)] w-full shrink-0 flex-col justify-center gap-4 py-6">
        {content}
      </div>
      <section className={cn("w-full max-w-4xl pb-6 sm:pb-0", dimWhilePlaying)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label
            htmlFor={inputTab === "edit" ? "reader-text" : undefined}
            className="text-sm font-medium text-muted-foreground"
          >
            Text to read{words.length > 0 && ` (${words.length} ${words.length === 1 ? "word" : "words"})`}
          </label>
          <div
            ref={tabListRef}
            role="tablist"
            aria-label="Input mode"
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "edit" : event.key === "End" ? "scrub"
                : inputTab === "edit" ? "scrub" : "edit";
              setInputTab(next);
              tabRefs.current[next]?.focus({ preventScroll: true });
            }}
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
            {INPUT_TABS.map((tab) => {
              const selected = inputTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(node) => { tabRefs.current[tab.id] = node; }}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  aria-controls="reader-text-panel"
                  id={`reader-${tab.id}-tab`}
                  onClick={() => setInputTab(tab.id)}
                  className={cn(
                    "relative z-10 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div id="reader-text-panel" role="tabpanel" aria-labelledby={`reader-${inputTab}-tab`} className="h-44 min-h-44 resize-y overflow-hidden">
          {inputTab === "edit" ? (
            <Textarea
              id="reader-text"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste text here..."
              className={cn(
                INPUT_PANEL_CLASS_NAME,
                "field-sizing-fixed resize-none focus-visible:ring-inset",
              )}
              aria-label="Text to read"
            />
          ) : (
            <div
              ref={scrubContainerRef}
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
                      onClick={() => seekTo(i)}
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
