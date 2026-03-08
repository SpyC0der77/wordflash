"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from "react";
import type {
  FocalColorKey,
  FontFamilyKey,
  FontSizeKey,
} from "@/components/reader";

const STORAGE_KEY = "wordflash-reader-settings";

const DEFAULT_SENTENCE_END_MS = 500;
const DEFAULT_SPEECH_BREAK_MS = 250;
const DEFAULT_WORDS_PER_MINUTE = 300;
const WPM_MIN = 50;
const WPM_MAX = 1200;

interface StoredSettings {
  fontSize: FontSizeKey;
  fontFamily: FontFamilyKey;
  focalColor: FocalColorKey;
  sentenceEndDurationMs: number;
  speechBreakDurationMs: number;
  wordsPerMinute: number;
}

const DEFAULTS: StoredSettings = {
  fontSize: "md",
  fontFamily: "serif",
  focalColor: "rose",
  sentenceEndDurationMs: DEFAULT_SENTENCE_END_MS,
  speechBreakDurationMs: DEFAULT_SPEECH_BREAK_MS,
  wordsPerMinute: DEFAULT_WORDS_PER_MINUTE,
};

function loadStored(): StoredSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return {
      fontSize:
        parsed.fontSize && ["sm", "md", "lg", "xl"].includes(parsed.fontSize)
          ? parsed.fontSize
          : DEFAULTS.fontSize,
      fontFamily:
        parsed.fontFamily && ["sans", "serif", "mono"].includes(parsed.fontFamily)
          ? parsed.fontFamily
          : DEFAULTS.fontFamily,
      focalColor:
        parsed.focalColor &&
        ["rose", "blue", "green", "amber"].includes(parsed.focalColor)
          ? parsed.focalColor
          : DEFAULTS.focalColor,
      sentenceEndDurationMs:
        typeof parsed.sentenceEndDurationMs === "number" &&
        parsed.sentenceEndDurationMs >= 0 &&
        parsed.sentenceEndDurationMs <= 1000
          ? parsed.sentenceEndDurationMs
          : DEFAULTS.sentenceEndDurationMs,
      speechBreakDurationMs:
        typeof parsed.speechBreakDurationMs === "number" &&
        parsed.speechBreakDurationMs >= 0 &&
        parsed.speechBreakDurationMs <= 1000
          ? parsed.speechBreakDurationMs
          : DEFAULTS.speechBreakDurationMs,
      wordsPerMinute:
        typeof parsed.wordsPerMinute === "number" &&
        parsed.wordsPerMinute >= WPM_MIN &&
        parsed.wordsPerMinute <= WPM_MAX
          ? parsed.wordsPerMinute
          : DEFAULTS.wordsPerMinute,
    };
  } catch {
    return DEFAULTS;
  }
}

function saveStored(settings: StoredSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

interface ReaderSettingsContextValue extends StoredSettings {
  setFontSize: (v: FontSizeKey) => void;
  setFontFamily: (v: FontFamilyKey) => void;
  setFocalColor: (v: FocalColorKey) => void;
  setSentenceEndDurationMs: (v: number) => void;
  setSpeechBreakDurationMs: (v: number) => void;
  setWordsPerMinute: (v: number) => void;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(
  null,
);

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);

  useLayoutEffect(() => {
    setSettings(loadStored());
  }, []);

  const setFontSize = useCallback((fontSize: FontSizeKey) => {
    setSettings((s) => {
      const next = { ...s, fontSize };
      saveStored(next);
      return next;
    });
  }, []);

  const setFontFamily = useCallback((fontFamily: FontFamilyKey) => {
    setSettings((s) => {
      const next = { ...s, fontFamily };
      saveStored(next);
      return next;
    });
  }, []);

  const setFocalColor = useCallback((focalColor: FocalColorKey) => {
    setSettings((s) => {
      const next = { ...s, focalColor };
      saveStored(next);
      return next;
    });
  }, []);

  const setSentenceEndDurationMs = useCallback((sentenceEndDurationMs: number) => {
    setSettings((s) => {
      const next = { ...s, sentenceEndDurationMs };
      saveStored(next);
      return next;
    });
  }, []);

  const setSpeechBreakDurationMs = useCallback((speechBreakDurationMs: number) => {
    setSettings((s) => {
      const next = { ...s, speechBreakDurationMs };
      saveStored(next);
      return next;
    });
  }, []);

  const setWordsPerMinute = useCallback((wordsPerMinute: number) => {
    setSettings((s) => {
      const clamped = Math.round(
        Math.max(WPM_MIN, Math.min(WPM_MAX, wordsPerMinute)),
      );
      const next = { ...s, wordsPerMinute: clamped };
      saveStored(next);
      return next;
    });
  }, []);

  const value: ReaderSettingsContextValue = {
    ...settings,
    setFontSize,
    setFontFamily,
    setFocalColor,
    setSentenceEndDurationMs,
    setSpeechBreakDurationMs,
    setWordsPerMinute,
  };

  return (
    <ReaderSettingsContext.Provider value={value}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  const ctx = useContext(ReaderSettingsContext);
  if (!ctx) {
    return {
      ...DEFAULTS,
      setFontSize: () => {},
      setFontFamily: () => {},
      setFocalColor: () => {},
      setSentenceEndDurationMs: () => {},
      setSpeechBreakDurationMs: () => {},
      setWordsPerMinute: () => {},
    };
  }
  return ctx;
}
