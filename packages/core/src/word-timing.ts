import { COMMON_ENGLISH_WORDS } from "./common-english-words";

/** Extra pause after a word followed by a manual line break, as a multiple of the sentence-end delay. */
export const LINE_BREAK_PAUSE_MULTIPLIER = 2;

/** Extra dwell on the first occurrence of a proper noun, at 250 WPM. */
export const FIRST_PROPER_NOUN_DELAY_MS_AT_250_WPM = 250;

const SENTENCE_START_FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "i",
  "i'm",
  "i'll",
  "i've",
  "i'd",
  "we",
  "we're",
  "we'll",
  "we've",
  "we'd",
  "you",
  "you're",
  "you'll",
  "you've",
  "you'd",
  "he",
  "she",
  "it",
  "they",
  "this",
  "that",
  "these",
  "those",
  "there",
  "then",
  "than",
  "when",
  "where",
  "why",
  "how",
  "what",
  "who",
  "whom",
  "which",
  "if",
  "as",
  "but",
  "and",
  "or",
  "nor",
  "so",
  "yet",
  "for",
  "to",
  "in",
  "on",
  "at",
  "of",
  "by",
  "from",
  "with",
  "into",
  "onto",
  "after",
  "before",
  "during",
  "while",
  "until",
  "unless",
  "although",
  "though",
  "because",
  "since",
  "however",
  "therefore",
  "thus",
  "also",
  "still",
  "now",
  "here",
  "later",
  "next",
  "suddenly",
  "finally",
  "meanwhile",
  "yes",
  "no",
  "oh",
  "well",
  "please",
  "maybe",
  "perhaps",
  "hello",
  "hi",
  "hey",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "not",
  "do",
  "does",
  "did",
  "don't",
  "doesn't",
  "didn't",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "can",
  "could",
  "will",
  "would",
  "shall",
  "should",
  "may",
  "might",
  "must",
]);

const HONORIFICS = new Set([
  "mr",
  "mrs",
  "ms",
  "mz",
  "mx",
  "dr",
  "prof",
  "sr",
  "jr",
  "st",
  "rev",
  "fr",
  "br",
  "hon",
  "gen",
  "col",
  "lt",
  "sgt",
  "capt",
  "cmdr",
  "sir",
  "dame",
  "lady",
  "lord",
  "esq",
]);

const NAME_PARTICLES = new Set([
  "van",
  "von",
  "de",
  "da",
  "di",
  "del",
  "della",
  "der",
  "den",
  "la",
  "le",
  "du",
  "bin",
  "ibn",
  "al",
  "af",
  "ter",
  "ten",
]);

const SENTENCE_START_CONTENT_WORDS = new Set([
  "help",
  "wait",
  "look",
  "come",
  "go",
  "stop",
  "let",
  "let's",
  "make",
  "take",
  "give",
  "keep",
  "put",
  "get",
  "see",
  "tell",
  "ask",
  "try",
  "use",
  "want",
  "need",
  "know",
  "think",
  "feel",
  "welcome",
  "thanks",
  "thank",
  "sorry",
  "good",
  "great",
  "nice",
  "happy",
  "dear",
  "chapter",
  "part",
  "section",
  "volume",
  "appendix",
  "figure",
  "table",
  "note",
  "introduction",
  "conclusion",
  "preface",
  "warning",
  "start",
  "begin",
  "continue",
  "today",
  "tomorrow",
  "yesterday",
]);

function nameCore(word: string): string {
  return word
    .trim()
    .replace(/^[^\p{L}]+/u, "")
    .replace(/[^\p{L}\p{N}'’-]+$/u, "")
    .replace(/['’]s$/iu, "");
}

function properNounKey(word: string): string {
  return nameCore(word).normalize("NFC").toLowerCase();
}

/** Title case: starts uppercase and contains a lowercase letter. Drops ALL CAPS. */
function isTitleCaseName(word: string): boolean {
  const core = nameCore(word);
  if (core.length < 2) return false;
  return /^\p{Lu}/u.test(core) && /\p{Ll}/u.test(core);
}

function startsNameSentence(
  words: readonly string[],
  keys: readonly string[],
  index: number,
): boolean {
  if (index <= 0) return true;
  const prevKey = keys[index - 1];
  if (prevKey && HONORIFICS.has(prevKey)) return false;
  return wordEndsSentence(words[index - 1] ?? "");
}

/**
 * True at each index that should dwell on the first occurrence of a name.
 * Extra time is for unusual letter patterns, not names that are also common
 * English words. Uses title case, document evidence, honorifics, and
 * multi-word name spans. When `gazetteer` is present, sentence-start words
 * count only if listed there or later confirmed mid-sentence.
 */
export function getFirstProperNounFlags(
  words: readonly string[],
  gazetteer?: ReadonlySet<string> | null,
): boolean[] {
  const flags = words.map(() => false);
  if (words.length === 0) return flags;

  const keys = words.map(properNounKey);
  const titleCase = keys.map((key, i) => {
    if (!key || HONORIFICS.has(key)) return false;
    return isTitleCaseName(words[i] ?? "");
  });

  const lowercaseKeys = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const key = keys[i];
    const core = nameCore(words[i] ?? "");
    if (key && core.length >= 2 && /^\p{Ll}/u.test(core)) lowercaseKeys.add(key);
  }

  const midSentenceKeys = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const key = keys[i];
    if (key && titleCase[i] && !startsNameSentence(words, keys, i)) {
      midSentenceKeys.add(key);
    }
  }

  const likely = keys.map((key, i) => {
    if (!key || !titleCase[i] || lowercaseKeys.has(key)) return false;
    if (COMMON_ENGLISH_WORDS.has(key)) return false;
    const atStart = startsNameSentence(words, keys, i);
    if (!atStart || midSentenceKeys.has(key)) return true;
    if (gazetteer?.has(key)) return true;
    if (gazetteer && gazetteer.size > 0) return false;
    return (
      !SENTENCE_START_FUNCTION_WORDS.has(key) &&
      !SENTENCE_START_CONTENT_WORDS.has(key)
    );
  });

  const seen = new Set<string>();
  let i = 0;
  while (i < words.length) {
    if (!likely[i]) {
      i += 1;
      continue;
    }

    const start = i;
    i += 1;
    while (i < words.length) {
      const key = keys[i] ?? "";
      const glued =
        likely[i] ||
        (NAME_PARTICLES.has(key) && i + 1 < words.length && likely[i + 1]);
      if (!glued) break;
      i += 1;
    }

    const spanKeys: string[] = [];
    for (let j = start; j < i; j++) {
      if (likely[j]) spanKeys.push(keys[j] ?? "");
    }
    if (spanKeys.some((key) => !seen.has(key))) flags[start] = true;
    for (const key of spanKeys) seen.add(key);
  }

  return flags;
}

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
  gazetteer?: ReadonlySet<string> | null,
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
  const firstProperNounDelay = Math.round(
    FIRST_PROPER_NOUN_DELAY_MS_AT_250_WPM * wpmScale,
  );
  const firstProperNounFlags = getFirstProperNounFlags(words, gazetteer);

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
    const properNounDelay = firstProperNounFlags[i] ? firstProperNounDelay : 0;
    total += baseMsPerWord + extra + lineBreakDelay + properNounDelay;
  }
  return total;
}
