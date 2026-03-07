"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dialog } from "radix-ui";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Kbd } from "@/components/ui/kbd";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useReaderSettings } from "@/lib/reader-settings-context";
import { useReduceMotion } from "@/lib/reduce-motion-context";
import { useReduceTransparency } from "@/lib/reduce-transparency-context";
import { useTheme, THEMES, type Theme } from "@/lib/theme-context";
import {
  calculateReadingTimeMs,
  getWordParts,
  parseWords,
  wordEndsSentence,
  wordHasPausePunctuation,
} from "@/lib/speed-reader";
import { cn } from "@/lib/utils";

const SAMPLE_TEXT =
  "Paste your own text below, focus on the red letter, press play, and let the words flow.";

const SENTENCE_END_DELAY_MS_AT_250_WPM = 500;
const PAUSE_PUNCTUATION_DELAY_MS_AT_250_WPM = 250;
const DEFAULT_SENTENCE_END_MS = 500;
const DEFAULT_SPEECH_BREAK_MS = 250;

interface SpeedReaderBaseProps {
  wordsPerMinute?: number;
  onWordIndexChange?: (index: number) => void;
  onComplete?: () => void;
  sentenceEndDurationMsAt250Wpm?: number;
  speechBreakDurationMsAt250Wpm?: number;
  /** When provided, syncs to this index (e.g. when user clicks a word in the article) */
  controlledWordIndex?: number;
}

interface SpeedReaderFullProps extends SpeedReaderBaseProps {
  variant: "full";
}

export const FONT_SIZES = {
  sm: { label: "Small", className: "text-3xl sm:text-4xl md:text-5xl" },
  md: { label: "Medium", className: "text-4xl sm:text-5xl md:text-6xl" },
  lg: { label: "Large", className: "text-5xl sm:text-6xl md:text-7xl" },
  xl: { label: "Extra large", className: "text-6xl sm:text-7xl md:text-8xl" },
} as const;

export const FONT_FAMILIES = {
  sans: { label: "Sans", className: "font-sans" },
  serif: { label: "Serif", className: "font-serif" },
  mono: { label: "Mono", className: "font-mono" },
} as const;

export const FOCAL_COLORS = {
  rose: {
    label: "Rose",
    className: "text-rose-500",
    previewClass: "bg-rose-500",
  },
  blue: {
    label: "Blue",
    className: "text-blue-500",
    previewClass: "bg-blue-500",
  },
  green: {
    label: "Green",
    className: "text-green-500",
    previewClass: "bg-green-500",
  },
  amber: {
    label: "Amber",
    className: "text-amber-500",
    previewClass: "bg-amber-500",
  },
} as const;

export type FontSizeKey = keyof typeof FONT_SIZES;
export type FontFamilyKey = keyof typeof FONT_FAMILIES;
export type FocalColorKey = keyof typeof FOCAL_COLORS;

interface SpeedReaderSettingsContentProps {
  idPrefix: string;
  theme: Theme;
  setTheme: (v: Theme) => void;
  fontSize: FontSizeKey;
  setFontSize: (v: FontSizeKey) => void;
  fontFamily: FontFamilyKey;
  setFontFamily: (v: FontFamilyKey) => void;
  focalColor: FocalColorKey;
  setFocalColor: (v: FocalColorKey) => void;
  sentenceEndDurationMs: number;
  setSentenceEndDurationMs: (v: number) => void;
  speechBreakDurationMs: number;
  setSpeechBreakDurationMs: (v: number) => void;
  reduceTransparency: boolean;
  setReduceTransparency: (v: boolean) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
}

export function SpeedReaderSettingsContent({
  idPrefix,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  fontFamily,
  setFontFamily,
  focalColor,
  setFocalColor,
  sentenceEndDurationMs,
  setSentenceEndDurationMs,
  speechBreakDurationMs,
  setSpeechBreakDurationMs,
  reduceTransparency,
  setReduceTransparency,
  reduceMotion,
  setReduceMotion,
}: SpeedReaderSettingsContentProps) {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`${idPrefix}theme-select`}
          className="mb-2 block text-sm font-medium text-zinc-100"
        >
          Theme
        </label>
        <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <SelectTrigger id={`${idPrefix}theme-select`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(THEMES) as Theme[]).map((key) => (
              <SelectItem key={key} value={key}>
                {THEMES[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}font-size-select`}
          className="mb-2 block text-sm font-medium text-zinc-100"
        >
          Font size
        </label>
        <Select value={fontSize} onValueChange={(v) => setFontSize(v as FontSizeKey)}>
          <SelectTrigger id={`${idPrefix}font-size-select`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FONT_SIZES) as FontSizeKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {FONT_SIZES[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}font-family-select`}
          className="mb-2 block text-sm font-medium text-zinc-100"
        >
          Font family
        </label>
        <Select
          value={fontFamily}
          onValueChange={(v) => setFontFamily(v as FontFamilyKey)}
        >
          <SelectTrigger id={`${idPrefix}font-family-select`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FONT_FAMILIES) as FontFamilyKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {FONT_FAMILIES[key].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}focal-color-select`}
          className="mb-2 block text-sm font-medium text-zinc-100"
        >
          Focal character color
        </label>
        <Select
          value={focalColor}
          onValueChange={(v) => setFocalColor(v as FocalColorKey)}
        >
          <SelectTrigger id={`${idPrefix}focal-color-select`}>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  FOCAL_COLORS[focalColor].previewClass,
                )}
              />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FOCAL_COLORS) as FocalColorKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-3 shrink-0 rounded-full",
                      FOCAL_COLORS[key].previewClass,
                    )}
                  />
                  {FOCAL_COLORS[key].label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}sentence-end-full`}
          className="mb-2 block text-sm font-medium text-zinc-100"
        >
          Sentence End Duration ({sentenceEndDurationMs}ms)
        </label>
        <Slider
          id={`${idPrefix}sentence-end-full`}
          min={0}
          max={1000}
          step={50}
          value={[sentenceEndDurationMs]}
          onValueChange={([v]) =>
            setSentenceEndDurationMs(v ?? DEFAULT_SENTENCE_END_MS)
          }
        />
      </div>
      <div>
        <label
          htmlFor={`${idPrefix}speech-break-full`}
          className="mb-2 block text-sm font-medium text-zinc-100"
        >
          Speech Break Duration ({speechBreakDurationMs}ms)
        </label>
        <Slider
          id={`${idPrefix}speech-break-full`}
          min={0}
          max={1000}
          step={25}
          value={[speechBreakDurationMs]}
          onValueChange={([v]) =>
            setSpeechBreakDurationMs(v ?? DEFAULT_SPEECH_BREAK_MS)
          }
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={`${idPrefix}reduce-transparency-speedreader`}
          className="text-sm font-medium text-zinc-100"
        >
          Reduce transparency
        </label>
        <Switch
          id={`${idPrefix}reduce-transparency-speedreader`}
          checked={reduceTransparency}
          onCheckedChange={setReduceTransparency}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor={`${idPrefix}reduce-motion-speedreader`}
          className="text-sm font-medium text-zinc-100"
        >
          Reduce motion
        </label>
        <Switch
          id={`${idPrefix}reduce-motion-speedreader`}
          checked={reduceMotion}
          onCheckedChange={setReduceMotion}
        />
      </div>
      <ul className="pt-2 text-xs text-muted-foreground list-disc pl-4 space-y-1">
        <li>
          <Kbd>Space</Kbd> — play/pause
        </li>
        <li>
          <Kbd>R</Kbd> — restart from beginning
        </li>
        <li>
          <Kbd>←</Kbd> <Kbd>→</Kbd> — skip words
        </li>
        <li>
          <Kbd>Home</Kbd> <Kbd>End</Kbd> — jump to start/end
        </li>
      </ul>
    </div>
  );
}

interface SpeedReaderPanelProps extends SpeedReaderBaseProps {
  variant: "panel";
  text: string;
  className?: string;
  /** When true, the word display area grows to fill available space (e.g. mobile full-screen) */
  fillHeight?: boolean;
  fontSize?: FontSizeKey;
  fontFamily?: FontFamilyKey;
  focalColor?: FocalColorKey;
}

interface SpeedReaderTestProps extends SpeedReaderBaseProps {
  variant: "test";
  text: string;
  className?: string;
}

type SpeedReaderProps =
  | SpeedReaderFullProps
  | SpeedReaderPanelProps
  | SpeedReaderTestProps;

export function SpeedReader(
  props: SpeedReaderProps,
): React.ReactElement | null {
  const { reduceMotion, setReduceMotion } = useReduceMotion();
  const { reduceTransparency, setReduceTransparency } = useReduceTransparency();
  const { theme, setTheme } = useTheme();
  const readerSettings = useReaderSettings();
  const isFull = props.variant === "full";
  const isTest = props.variant === "test";
  const controlledWordIndex = props.controlledWordIndex;

  const [inputText, setInputText] = useState(
    isFull
      ? SAMPLE_TEXT
      : (props as SpeedReaderPanelProps | SpeedReaderTestProps).text,
  );
  const [wordIndex, setWordIndex] = useState(() => controlledWordIndex ?? 0);
  const wordsPerMinute = props.wordsPerMinute ?? readerSettings.wordsPerMinute;
  const setWordsPerMinute =
    props.wordsPerMinute !== undefined
      ? () => {}
      : readerSettings.setWordsPerMinute;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const fontSize = isFull
    ? readerSettings.fontSize
    : ((props as SpeedReaderPanelProps).fontSize ?? "md");
  const fontFamily = isFull
    ? readerSettings.fontFamily
    : ((props as SpeedReaderPanelProps).fontFamily ?? "serif");
  const focalColor = isFull
    ? readerSettings.focalColor
    : ((props as SpeedReaderPanelProps).focalColor ?? "rose");
  const sentenceEndDurationMs = isFull
    ? readerSettings.sentenceEndDurationMs
    : ((props as SpeedReaderPanelProps).sentenceEndDurationMsAt250Wpm ??
      DEFAULT_SENTENCE_END_MS);
  const speechBreakDurationMs = isFull
    ? readerSettings.speechBreakDurationMs
    : ((props as SpeedReaderPanelProps).speechBreakDurationMsAt250Wpm ??
      DEFAULT_SPEECH_BREAK_MS);
  const setFontSize = readerSettings.setFontSize;
  const setFontFamily = readerSettings.setFontFamily;
  const setFocalColor = readerSettings.setFocalColor;
  const setSentenceEndDurationMs = readerSettings.setSentenceEndDurationMs;
  const setSpeechBreakDurationMs = readerSettings.setSpeechBreakDurationMs;
  const timeoutRef = useRef<number | null>(null);

  const effectiveSentenceEndMs = isFull
    ? sentenceEndDurationMs
    : (props.sentenceEndDurationMsAt250Wpm ?? SENTENCE_END_DELAY_MS_AT_250_WPM);
  const effectiveSpeechBreakMs = isFull
    ? speechBreakDurationMs
    : (props.speechBreakDurationMsAt250Wpm ??
      PAUSE_PUNCTUATION_DELAY_MS_AT_250_WPM);

  const text = isFull
    ? inputText
    : (props as SpeedReaderPanelProps | SpeedReaderTestProps).text;
  const words = useMemo(() => parseWords(text), [text]);
  const onWordIndexChange =
    "onWordIndexChange" in props ? props.onWordIndexChange : undefined;
  const effectiveWordIndex =
    controlledWordIndex !== undefined ? controlledWordIndex : wordIndex;
  const activeWordIndex =
    words.length === 0 ? 0 : Math.min(effectiveWordIndex, words.length - 1);
  const activeWord = words[activeWordIndex] ?? "";
  const { left, focalCharacter, right } = useMemo(
    () => getWordParts(activeWord),
    [activeWord],
  );
  const mountedRef = useRef(false);

  const setEffectiveWordIndex = useCallback(
    (index: number) => {
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

  useEffect(() => {
    if (!isPlaying || words.length === 0) return;

    const baseMsPerWord = Math.max(30, Math.round(60000 / wordsPerMinute));
    const wpmScale = 250 / wordsPerMinute;
    const sentenceEndMs = effectiveSentenceEndMs;
    const speechBreakMs = effectiveSpeechBreakMs;
    const sentenceDelay = Math.round(sentenceEndMs * wpmScale);
    const pauseDelay = Math.round(speechBreakMs * wpmScale);

    const currentWord = words[activeWordIndex] ?? "";
    const extraDelay = wordEndsSentence(currentWord)
      ? sentenceDelay
      : wordHasPausePunctuation(currentWord)
        ? pauseDelay
        : 0;
    const delay = baseMsPerWord + extraDelay;

    timeoutRef.current = window.setTimeout(() => {
      const next = Math.min(activeWordIndex + 1, words.length - 1);
      if (next >= words.length - 1) {
        setIsPlaying(false);
      }
      setEffectiveWordIndex(next);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    isPlaying,
    words.length,
    wordsPerMinute,
    activeWordIndex,
    words,
    effectiveSentenceEndMs,
    effectiveSpeechBreakMs,
    setEffectiveWordIndex,
  ]);

  const isFinished =
    words.length > 0 && !isPlaying && activeWordIndex >= words.length - 1;
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
      ),
    [
      words,
      wordsPerMinute,
      activeWordIndex,
      effectiveSentenceEndMs,
      effectiveSpeechBreakMs,
    ],
  );

  const readingTimeLabel =
    remainingReadingTimeMs >= 60000
      ? `~${Math.round(remainingReadingTimeMs / 60000)} min`
      : `~${Math.round(remainingReadingTimeMs / 1000)} sec`;

  const onComplete = "onComplete" in props ? props.onComplete : undefined;
  useEffect(() => {
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

  if (!isFull && words.length === 0) return null;

  const isPanelFillHeight =
    props.variant === "panel" && (props as SpeedReaderPanelProps).fillHeight;

  const effectiveFontSize = isFull
    ? fontSize
    : ((props as SpeedReaderPanelProps).fontSize ?? "md");
  const effectiveFontFamily = isFull
    ? fontFamily
    : ((props as SpeedReaderPanelProps).fontFamily ?? "serif");
  const effectiveFocalColor = isFull
    ? focalColor
    : ((props as SpeedReaderPanelProps).focalColor ?? "rose");

  const wordDisplayClassName = cn(
    FONT_SIZES[effectiveFontSize].className,
    FONT_FAMILIES[effectiveFontFamily].className,
  );
  const focalColorClassName = FOCAL_COLORS[effectiveFocalColor].className;

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
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border dark:bg-white/20" />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 h-px bg-border/80 dark:bg-white/12",
              isPanelFillHeight ? "top-8 sm:top-14" : "top-14",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 h-px bg-border/80 dark:bg-white/12",
              isPanelFillHeight ? "bottom-8 sm:bottom-14" : "bottom-14",
            )}
          />

          <div
            className={cn(
              "grid w-full max-w-2xl grid-cols-[1fr_auto_1fr] items-baseline px-3 leading-none sm:px-6",
              wordDisplayClassName,
            )}
          >
            <span className="justify-self-end pr-1 text-muted-foreground dark:text-zinc-100">
              {left}
            </span>
            <span className={focalColorClassName}>{focalCharacter || "•"}</span>
            <span className="justify-self-start pl-1 text-muted-foreground dark:text-zinc-100">
              {right}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 flex items-center justify-center gap-4 px-2 text-center text-sm text-muted-foreground transition-opacity duration-300 sm:mt-3",
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
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-zinc-900 p-4 shadow-xl sm:rounded-xl sm:p-6",
                  reduceTransparency ? "border-zinc-700" : "border-white/10",
                  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                )}
              >
                <Dialog.Title className="mb-2 shrink-0 text-lg font-semibold text-zinc-100">
                  Settings
                </Dialog.Title>
                <Dialog.Description className="mb-4 shrink-0 text-sm text-muted-foreground">
                  Adjust pause durations (values at 250 WPM; scale with speed).
                </Dialog.Description>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <SpeedReaderSettingsContent
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
                    reduceTransparency={reduceTransparency}
                    setReduceTransparency={setReduceTransparency}
                    reduceMotion={reduceMotion}
                    setReduceMotion={setReduceMotion}
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
            <DrawerContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
              <DrawerHeader className="shrink-0 text-left">
                <DrawerTitle>Settings</DrawerTitle>
                <DrawerDescription>
                  Adjust pause durations (values at 250 WPM; scale with speed).
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
                <SpeedReaderSettingsContent
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
                  reduceTransparency={reduceTransparency}
                  setReduceTransparency={setReduceTransparency}
                  reduceMotion={reduceMotion}
                  setReduceMotion={setReduceMotion}
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
        <label
          htmlFor="reader-text"
          className="mb-2 block text-sm font-medium text-muted-foreground"
        >
          Text to read{words.length > 0 && ` (${words.length} words)`}
        </label>
        <Textarea
          id="reader-text"
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste text here..."
          className="min-h-44 resize-y"
        />
      </section>
    </main>
  );
}
