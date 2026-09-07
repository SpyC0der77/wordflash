export {
  PROPER_NOUN_GAZETTEER_VERSION,
  parseProperNounGazetteer,
} from "./proper-noun-gazetteer";
export type { ProperNounGazetteerPayload } from "./proper-noun-gazetteer";
export {
  FIRST_PROPER_NOUN_DELAY_MS_AT_250_WPM,
  LINE_BREAK_PAUSE_MULTIPLIER,
  calculateReadingTimeMs,
  getFirstProperNounFlags,
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
