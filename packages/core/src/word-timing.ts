/** Extra pause after a word followed by a manual line break, as a multiple of the sentence-end delay. */
export const LINE_BREAK_PAUSE_MULTIPLIER = 2;

export function wordEndsSentence(word: string): boolean {
  const trimmed = word.trim();
  return trimmed.length > 0 && /[.!?)]["']?$/.test(trimmed);
}

export function wordHasPausePunctuation(word: string): boolean {
  return /[,:;—]["']?$|--["']?$/.test(word.trim());
}

export type SentenceToneMark = "." | "?" | "!";

/**
 * Extracts sentence-ending tone punctuation from a word.
 * `?` wins over `!`, which wins over `.`, so "What?!" is a question.
 */
export function getSentenceToneMark(word: string): SentenceToneMark | null {
  const trimmed = word.trim();
  if (!trimmed) return null;
  const trailing = /[.!?…)"'\]]+$/.exec(trimmed)?.[0];
  if (!trailing) return null;
  if (trailing.includes("?")) return "?";
  if (trailing.includes("!")) return "!";
  if (trailing.includes(".") || trailing.includes("…")) return ".";
  return null;
}

/**
 * Index of the word that ends the sentence containing `index`.
 * Trailing fragments with no terminator use the last word.
 */
export function getSentenceEndIndex(
  words: readonly string[],
  index: number,
): number {
  if (words.length === 0) return 0;
  const start = Math.max(0, Math.min(index, words.length - 1));
  for (let i = start; i < words.length; i++) {
    const word = words[i] ?? "";
    if (getSentenceToneMark(word) || wordEndsSentence(word)) return i;
  }
  return words.length - 1;
}

/**
 * True when `index` is the first word of a sentence.
 */
export function wordStartsSentence(
  words: readonly string[],
  index: number,
): boolean {
  if (words.length === 0) return false;
  if (index <= 0) return true;
  return wordEndsSentence(words[index - 1] ?? "");
}

/**
 * Tone mark for the sentence that contains `index`: looks ahead to the next
 * word with sentence-ending punctuation. Defaults to `.` when none is found.
 */
export function getSentenceToneMarkAt(
  words: readonly string[],
  index: number,
): SentenceToneMark {
  if (words.length === 0) return ".";
  const end = getSentenceEndIndex(words, index);
  const word = words[end] ?? "";
  return getSentenceToneMark(word) ?? ".";
}

export interface PunctuationGlyphTiming {
  holdMs: number;
  fadeOutMs: number;
  fadeInMs: number;
}

/**
 * Flash the sentence-tone watermark at the start of a sentence: fade in over
 * `leadMs`, stay for `visibleMs`, then fade out over `fadeMs`.
 */
export function getPunctuationGlyphTiming(
  visibleMs: number,
  fadeMs: number,
  leadMs: number,
): PunctuationGlyphTiming {
  return {
    holdMs: Math.max(0, visibleMs),
    fadeOutMs: Math.max(0, fadeMs),
    fadeInMs: Math.max(0, leadMs),
  };
}

/**
 * Calculates total reading time in ms for a range of words, using the same
 * timing logic as playback: base ms/word from WPM plus scaled punctuation delays
 * and a line-break pause of twice the sentence-end delay.
 */
export function calculateReadingTimeMs(
  words: string[],
  wordsPerMinute: number,
  sentenceEndDurationMsAt250Wpm: number,
  speechBreakDurationMsAt250Wpm: number,
  fromIndex = 0,
  toIndex?: number,
  hasLineBreakAfter?: readonly boolean[],
): number {
  if (words.length === 0) return 0;

  const maxIndex = words.length - 1;
  const intFromIndex = Number.isFinite(fromIndex) ? Math.floor(fromIndex) : 0;
  const intToIndex =
    toIndex !== undefined && Number.isFinite(toIndex)
      ? Math.floor(toIndex)
      : undefined;
  const rawEnd = intToIndex ?? maxIndex;
  const end = Math.max(0, Math.min(rawEnd, maxIndex));
  const start = Math.max(0, Math.min(intFromIndex, end));

  const safeWpm =
    Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : 1;
  const baseMsPerWord = Math.max(30, Math.round(60000 / safeWpm));
  const wpmScale = 250 / safeWpm;
  const sentenceDelay = Math.round(sentenceEndDurationMsAt250Wpm * wpmScale);
  const pauseDelay = Math.round(speechBreakDurationMsAt250Wpm * wpmScale);

  let total = 0;
  for (let i = start; i <= end; i++) {
    const word = words[i] ?? "";
    const extra = wordEndsSentence(word)
      ? sentenceDelay
      : wordHasPausePunctuation(word)
        ? pauseDelay
        : 0;
    const lineBreakDelay = hasLineBreakAfter?.[i]
      ? sentenceDelay * LINE_BREAK_PAUSE_MULTIPLIER
      : 0;
    total += baseMsPerWord + extra + lineBreakDelay;
  }
  return total;
}
