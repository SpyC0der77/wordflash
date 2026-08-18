"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type {
  FocalColorKey,
  FontFamilyKey,
  FontSizeKey,
} from "@/lib/reader-appearance";

const STORAGE_KEY = "wordflash-reader-settings";
const LEGACY_STORAGE_KEY = "speedreader-reader-settings";

const DEFAULT_SENTENCE_END_MS = 500;
const DEFAULT_SPEECH_BREAK_MS = 250;
const DEFAULT_PUNCTUATION_GLYPH_LEAD_MS = 80;
const PUNCTUATION_GLYPH_LEAD_MAX_MS = 200;
const DEFAULT_PUNCTUATION_GLYPH_DURATION_MS = 400;
const PUNCTUATION_GLYPH_DURATION_MAX_MS = 1000;
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
  showPunctuationGlyph: boolean;
  punctuationGlyphLeadMs: number;
  punctuationGlyphDurationMs: number;
  punctuationGlyphAlwaysVisible: boolean;
  centerPunctuationTittleVertically: boolean;
}

const DEFAULTS: StoredSettings = {
  fontSize: "md",
  fontFamily: "serif",
  focalColor: "rose",
  sentenceEndDurationMs: DEFAULT_SENTENCE_END_MS,
  speechBreakDurationMs: DEFAULT_SPEECH_BREAK_MS,
  wordsPerMinute: DEFAULT_WORDS_PER_MINUTE,
  showPunctuationGlyph: true,
  punctuationGlyphLeadMs: DEFAULT_PUNCTUATION_GLYPH_LEAD_MS,
  punctuationGlyphDurationMs: DEFAULT_PUNCTUATION_GLYPH_DURATION_MS,
  punctuationGlyphAlwaysVisible: false,
  centerPunctuationTittleVertically: false,
};

function loadStored(): StoredSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    const fromLegacy = !raw && !!localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    const result = {
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
      showPunctuationGlyph:
        typeof parsed.showPunctuationGlyph === "boolean"
          ? parsed.showPunctuationGlyph
          : DEFAULTS.showPunctuationGlyph,
      punctuationGlyphLeadMs:
        typeof parsed.punctuationGlyphLeadMs === "number" &&
        parsed.punctuationGlyphLeadMs >= 0 &&
        parsed.punctuationGlyphLeadMs <= PUNCTUATION_GLYPH_LEAD_MAX_MS
          ? parsed.punctuationGlyphLeadMs
          : DEFAULTS.punctuationGlyphLeadMs,
      punctuationGlyphDurationMs:
        typeof parsed.punctuationGlyphDurationMs === "number" &&
        parsed.punctuationGlyphDurationMs >= 0 &&
        parsed.punctuationGlyphDurationMs <= PUNCTUATION_GLYPH_DURATION_MAX_MS
          ? parsed.punctuationGlyphDurationMs
          : DEFAULTS.punctuationGlyphDurationMs,
      punctuationGlyphAlwaysVisible:
        typeof parsed.punctuationGlyphAlwaysVisible === "boolean"
          ? parsed.punctuationGlyphAlwaysVisible
          : DEFAULTS.punctuationGlyphAlwaysVisible,
      centerPunctuationTittleVertically:
        typeof parsed.centerPunctuationTittleVertically === "boolean"
          ? parsed.centerPunctuationTittleVertically
          : DEFAULTS.centerPunctuationTittleVertically,
    };
    if (fromLegacy) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Ignore - keep legacy key if write fails; saveStored swallows errors
      }
    }
    return result;
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

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

let cachedSnapshot: StoredSettings | null = null;

function shallowEqualSettings(a: StoredSettings, b: StoredSettings): boolean {
  return (
    a.fontSize === b.fontSize &&
    a.fontFamily === b.fontFamily &&
    a.focalColor === b.focalColor &&
    a.sentenceEndDurationMs === b.sentenceEndDurationMs &&
    a.speechBreakDurationMs === b.speechBreakDurationMs &&
    a.wordsPerMinute === b.wordsPerMinute &&
    a.showPunctuationGlyph === b.showPunctuationGlyph &&
    a.punctuationGlyphLeadMs === b.punctuationGlyphLeadMs &&
    a.punctuationGlyphDurationMs === b.punctuationGlyphDurationMs &&
    a.punctuationGlyphAlwaysVisible === b.punctuationGlyphAlwaysVisible &&
    a.centerPunctuationTittleVertically === b.centerPunctuationTittleVertically
  );
}

function getSnapshot(): StoredSettings {
  const next = loadStored();
  if (cachedSnapshot && shallowEqualSettings(cachedSnapshot, next)) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return next;
}

function getServerSnapshot(): StoredSettings {
  return DEFAULTS;
}

function updateStored(updater: (prev: StoredSettings) => StoredSettings) {
  const next = updater(loadStored());
  saveStored(next);
  emitChange();
}

interface ReaderSettingsContextValue extends StoredSettings {
  setFontSize: (v: FontSizeKey) => void;
  setFontFamily: (v: FontFamilyKey) => void;
  setFocalColor: (v: FocalColorKey) => void;
  setSentenceEndDurationMs: (v: number) => void;
  setSpeechBreakDurationMs: (v: number) => void;
  setWordsPerMinute: (v: number) => void;
  setShowPunctuationGlyph: (v: boolean) => void;
  setPunctuationGlyphLeadMs: (v: number) => void;
  setPunctuationGlyphDurationMs: (v: number) => void;
  setPunctuationGlyphAlwaysVisible: (v: boolean) => void;
  setCenterPunctuationTittleVertically: (v: boolean) => void;
  resetDefaults: () => void;
}

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(
  null,
);

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFontSize = useCallback((fontSize: FontSizeKey) => {
    updateStored((s) => ({ ...s, fontSize }));
  }, []);

  const setFontFamily = useCallback((fontFamily: FontFamilyKey) => {
    updateStored((s) => ({ ...s, fontFamily }));
  }, []);

  const setFocalColor = useCallback((focalColor: FocalColorKey) => {
    updateStored((s) => ({ ...s, focalColor }));
  }, []);

  const setSentenceEndDurationMs = useCallback((sentenceEndDurationMs: number) => {
    updateStored((s) => ({ ...s, sentenceEndDurationMs }));
  }, []);

  const setSpeechBreakDurationMs = useCallback((speechBreakDurationMs: number) => {
    updateStored((s) => ({ ...s, speechBreakDurationMs }));
  }, []);

  const setWordsPerMinute = useCallback((wordsPerMinute: number) => {
    const clamped = Math.round(
      Math.max(WPM_MIN, Math.min(WPM_MAX, wordsPerMinute)),
    );
    updateStored((s) => ({ ...s, wordsPerMinute: clamped }));
  }, []);

  const setShowPunctuationGlyph = useCallback((showPunctuationGlyph: boolean) => {
    updateStored((s) => ({ ...s, showPunctuationGlyph }));
  }, []);

  const setPunctuationGlyphLeadMs = useCallback((punctuationGlyphLeadMs: number) => {
    const clamped = Math.round(
      Math.max(0, Math.min(PUNCTUATION_GLYPH_LEAD_MAX_MS, punctuationGlyphLeadMs)),
    );
    updateStored((s) => ({ ...s, punctuationGlyphLeadMs: clamped }));
  }, []);

  const setPunctuationGlyphDurationMs = useCallback(
    (punctuationGlyphDurationMs: number) => {
      const clamped = Math.round(
        Math.max(
          0,
          Math.min(PUNCTUATION_GLYPH_DURATION_MAX_MS, punctuationGlyphDurationMs),
        ),
      );
      updateStored((s) => ({ ...s, punctuationGlyphDurationMs: clamped }));
    },
    [],
  );

  const setPunctuationGlyphAlwaysVisible = useCallback(
    (punctuationGlyphAlwaysVisible: boolean) => {
      updateStored((s) => ({ ...s, punctuationGlyphAlwaysVisible }));
    },
    [],
  );

  const setCenterPunctuationTittleVertically = useCallback(
    (centerPunctuationTittleVertically: boolean) => {
      updateStored((s) => ({ ...s, centerPunctuationTittleVertically }));
    },
    [],
  );

  const resetDefaults = useCallback(() => {
    saveStored(DEFAULTS);
    emitChange();
  }, []);

  const value: ReaderSettingsContextValue = useMemo(
    () => ({
      ...settings,
      setFontSize,
      setFontFamily,
      setFocalColor,
      setSentenceEndDurationMs,
      setSpeechBreakDurationMs,
      setWordsPerMinute,
      setShowPunctuationGlyph,
      setPunctuationGlyphLeadMs,
      setPunctuationGlyphDurationMs,
      setPunctuationGlyphAlwaysVisible,
      setCenterPunctuationTittleVertically,
      resetDefaults,
    }),
    [settings, setFontSize, setFontFamily, setFocalColor, setSentenceEndDurationMs, setSpeechBreakDurationMs, setWordsPerMinute, setShowPunctuationGlyph, setPunctuationGlyphLeadMs, setPunctuationGlyphDurationMs, setPunctuationGlyphAlwaysVisible, setCenterPunctuationTittleVertically, resetDefaults],
  );

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
      setShowPunctuationGlyph: () => {},
      setPunctuationGlyphLeadMs: () => {},
      setPunctuationGlyphDurationMs: () => {},
      setPunctuationGlyphAlwaysVisible: () => {},
      setCenterPunctuationTittleVertically: () => {},
      resetDefaults: () => {},
    };
  }
  return ctx;
}
