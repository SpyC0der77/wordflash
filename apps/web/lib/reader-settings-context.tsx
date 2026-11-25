"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  FOCAL_COLORS,
  FONT_FAMILIES,
  FONT_SIZES,
  type FocalColorKey,
  type FontFamilyKey,
  type FontSizeKey,
} from "@/lib/reader-appearance";
import {
  DEFAULT_PUNCTUATION_GLYPH_DURATION_MS,
  DEFAULT_PUNCTUATION_GLYPH_LEAD_MS,
  DEFAULT_SENTENCE_END_MS,
  DEFAULT_SPEECH_BREAK_MS,
  DEFAULT_WORDS_PER_MINUTE,
  PAUSE_MAX_MS,
  PUNCTUATION_GLYPH_DURATION_MAX_MS,
  PUNCTUATION_GLYPH_LEAD_MAX_MS,
  WPM_MAX,
  WPM_MIN,
} from "@/lib/reader-defaults";

const STORAGE_KEY = "wordflash-reader-settings";
const LEGACY_STORAGE_KEY = "speedreader-reader-settings";

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
  punctuationGlyphAlwaysVisible: true,
  centerPunctuationTittleVertically: false,
};

const SETTING_KEYS = Object.keys(DEFAULTS) as Array<keyof StoredSettings>;

// Keep preferences usable for this session if storage is blocked or full.
let unsavedSettings: StoredSettings | null = null;

function optionOr<K extends string>(
  value: unknown,
  options: Record<K, unknown>,
  fallback: K,
): K {
  return typeof value === "string" && Object.hasOwn(options, value)
    ? (value as K)
    : fallback;
}

function numberInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && value >= min && value <= max ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampRounded(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

/** Older builds stored a `punctuationCue` mode string instead of a boolean. */
function parseShowPunctuationGlyph(
  punctuationCue: unknown,
  showPunctuationGlyph: unknown,
): boolean {
  if (punctuationCue === "off") return false;
  if (typeof punctuationCue === "string") return true;
  return booleanOr(showPunctuationGlyph, true);
}

function parseStored(parsed: Partial<Record<keyof StoredSettings | "punctuationCue", unknown>>): StoredSettings {
  return {
    fontSize: optionOr(parsed.fontSize, FONT_SIZES, DEFAULTS.fontSize),
    fontFamily: optionOr(parsed.fontFamily, FONT_FAMILIES, DEFAULTS.fontFamily),
    focalColor: optionOr(parsed.focalColor, FOCAL_COLORS, DEFAULTS.focalColor),
    sentenceEndDurationMs: numberInRange(
      parsed.sentenceEndDurationMs, 0, PAUSE_MAX_MS, DEFAULTS.sentenceEndDurationMs,
    ),
    speechBreakDurationMs: numberInRange(
      parsed.speechBreakDurationMs, 0, PAUSE_MAX_MS, DEFAULTS.speechBreakDurationMs,
    ),
    wordsPerMinute: numberInRange(
      parsed.wordsPerMinute, WPM_MIN, WPM_MAX, DEFAULTS.wordsPerMinute,
    ),
    showPunctuationGlyph: parseShowPunctuationGlyph(
      parsed.punctuationCue,
      parsed.showPunctuationGlyph,
    ),
    punctuationGlyphLeadMs: numberInRange(
      parsed.punctuationGlyphLeadMs, 0, PUNCTUATION_GLYPH_LEAD_MAX_MS, DEFAULTS.punctuationGlyphLeadMs,
    ),
    punctuationGlyphDurationMs: numberInRange(
      parsed.punctuationGlyphDurationMs, 0, PUNCTUATION_GLYPH_DURATION_MAX_MS, DEFAULTS.punctuationGlyphDurationMs,
    ),
    punctuationGlyphAlwaysVisible: booleanOr(
      parsed.punctuationGlyphAlwaysVisible, DEFAULTS.punctuationGlyphAlwaysVisible,
    ),
    centerPunctuationTittleVertically: booleanOr(
      parsed.centerPunctuationTittleVertically, DEFAULTS.centerPunctuationTittleVertically,
    ),
  };
}

function loadStored(): StoredSettings {
  if (typeof window === "undefined") return DEFAULTS;
  if (unsavedSettings) return unsavedSettings;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    const fromLegacy = !raw && !!localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const result = parseStored(JSON.parse(raw));
    if (fromLegacy) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Keep the legacy key if the write fails; saveStored swallows errors too.
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
    unsavedSettings = null;
  } catch {
    unsavedSettings = settings;
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

function getSnapshot(): StoredSettings {
  const next = loadStored();
  if (cachedSnapshot && SETTING_KEYS.every((key) => cachedSnapshot![key] === next[key])) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return next;
}

function getServerSnapshot(): StoredSettings {
  return DEFAULTS;
}

function updateStored(patch: Partial<StoredSettings>) {
  saveStored({ ...loadStored(), ...patch });
  emitChange();
}

// Setters only touch module state, so they are stable across renders without useCallback.
const SETTERS = {
  setFontSize: (fontSize: FontSizeKey) => updateStored({ fontSize }),
  setFontFamily: (fontFamily: FontFamilyKey) => updateStored({ fontFamily }),
  setFocalColor: (focalColor: FocalColorKey) => updateStored({ focalColor }),
  setSentenceEndDurationMs: (sentenceEndDurationMs: number) =>
    updateStored({ sentenceEndDurationMs }),
  setSpeechBreakDurationMs: (speechBreakDurationMs: number) =>
    updateStored({ speechBreakDurationMs }),
  setWordsPerMinute: (wordsPerMinute: number) =>
    updateStored({ wordsPerMinute: clampRounded(wordsPerMinute, WPM_MIN, WPM_MAX) }),
  setShowPunctuationGlyph: (showPunctuationGlyph: boolean) =>
    updateStored({ showPunctuationGlyph }),
  setPunctuationGlyphLeadMs: (punctuationGlyphLeadMs: number) =>
    updateStored({
      punctuationGlyphLeadMs: clampRounded(punctuationGlyphLeadMs, 0, PUNCTUATION_GLYPH_LEAD_MAX_MS),
    }),
  setPunctuationGlyphDurationMs: (punctuationGlyphDurationMs: number) =>
    updateStored({
      punctuationGlyphDurationMs: clampRounded(punctuationGlyphDurationMs, 0, PUNCTUATION_GLYPH_DURATION_MAX_MS),
    }),
  setPunctuationGlyphAlwaysVisible: (punctuationGlyphAlwaysVisible: boolean) =>
    updateStored({ punctuationGlyphAlwaysVisible }),
  setCenterPunctuationTittleVertically: (centerPunctuationTittleVertically: boolean) =>
    updateStored({ centerPunctuationTittleVertically }),
  resetDefaults: () => {
    saveStored(DEFAULTS);
    emitChange();
  },
};

type ReaderSettingsContextValue = StoredSettings & typeof SETTERS;

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(
  null,
);

const noop = () => {};
/** Used outside a provider: defaults that ignore writes. */
const DETACHED_SETTINGS: ReaderSettingsContextValue = {
  ...DEFAULTS,
  ...(Object.fromEntries(
    Object.keys(SETTERS).map((name) => [name, noop]),
  ) as Record<keyof typeof SETTERS, () => void>),
};

export function ReaderSettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) return;
      if (unsavedSettings) {
        // Clears and legacy migration events must not erase the only saved copy.
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw || raw !== event.newValue) return;
          const persisted = JSON.parse(raw);
          if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) return;
        } catch { return; }
      }
      unsavedSettings = null;
      emitChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ ...settings, ...SETTERS }), [settings]);

  return (
    <ReaderSettingsContext.Provider value={value}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings(): ReaderSettingsContextValue {
  return useContext(ReaderSettingsContext) ?? DETACHED_SETTINGS;
}
