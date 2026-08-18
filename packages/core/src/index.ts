export {
  LINE_BREAK_PAUSE_MULTIPLIER,
  calculateReadingTimeMs,
  getPunctuationGlyphTiming,
  getSentenceEndIndex,
  getSentenceToneMark,
  getSentenceToneMarkAt,
  wordEndsSentence,
  wordHasPausePunctuation,
  wordStartsSentence,
} from "./word-timing";
export type { PunctuationGlyphTiming, SentenceToneMark } from "./word-timing";
export {
  attachTrailingCommasToLinks,
  extractTextFromHtml,
  getFocalCharacterIndex,
  getWordParts,
  parseWords,
  parseWordsDetailed,
  wrapWordsInHtml,
} from "./text-preprocessing";
