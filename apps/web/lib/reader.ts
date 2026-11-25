export {
  calculateReadingTimeMs,
  extractTextFromHtml,
  getFirstProperNounFlags,
  getWordTiming,
  getSentenceToneMarkAt,
  getWordParts,
  parseWords,
  parseWordsDetailed,
  wordEndsSentence,
  wordStartsSentence,
  wrapWordsInHtml,
} from "@wordflash/core";
export type { SentenceToneMark } from "@wordflash/core";

/** Compact label such as `~3 min` or `~40 sec`. */
export function formatReadingTime(ms: number): string {
  return ms >= 60000
    ? `~${Math.round(ms / 60000)} min`
    : `~${Math.round(ms / 1000)} sec`;
}
