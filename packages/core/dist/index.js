// src/word-timing.ts
function wordEndsSentence(word) {
  const trimmed = word.trim();
  return trimmed.length > 0 && /[.!?]["']?$/.test(trimmed);
}
function wordHasPausePunctuation(word) {
  return /[,:;—]["']?$|--["']?$/.test(word.trim());
}
function calculateReadingTimeMs(words, wordsPerMinute, sentenceEndDurationMsAt250Wpm, speechBreakDurationMsAt250Wpm, fromIndex = 0, toIndex) {
  if (words.length === 0) return 0;
  const maxIndex = words.length - 1;
  const intFromIndex = Number.isFinite(fromIndex) ? Math.floor(fromIndex) : 0;
  const intToIndex = toIndex !== void 0 && Number.isFinite(toIndex) ? Math.floor(toIndex) : void 0;
  const rawEnd = intToIndex ?? maxIndex;
  const end = Math.max(0, Math.min(rawEnd, maxIndex));
  const start = Math.max(0, Math.min(intFromIndex, end));
  const safeWpm = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : 1;
  const baseMsPerWord = Math.max(30, Math.round(6e4 / safeWpm));
  const wpmScale = 250 / safeWpm;
  const sentenceDelay = Math.round(sentenceEndDurationMsAt250Wpm * wpmScale);
  const pauseDelay = Math.round(speechBreakDurationMsAt250Wpm * wpmScale);
  let total = 0;
  for (let i = start; i <= end; i++) {
    const word = words[i] ?? "";
    const extra = wordEndsSentence(word) ? sentenceDelay : wordHasPausePunctuation(word) ? pauseDelay : 0;
    total += baseMsPerWord + extra;
  }
  return total;
}

// src/text-preprocessing.ts
function parseWords(text) {
  return text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}
function getFocalCharacterIndex(word) {
  const length = word.length;
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return Math.min(4, length - 1);
}
function getWordParts(word) {
  const focalCharacterIndex = getFocalCharacterIndex(word);
  return {
    left: word.slice(0, focalCharacterIndex),
    focalCharacter: word[focalCharacterIndex] ?? "",
    right: word.slice(focalCharacterIndex + 1)
  };
}
function extractTextFromHtmlRegex(html) {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function attachTrailingCommasToLinks(html) {
  return html.replace(/(<\/a>)(\s*,\s*)/g, (_, tag, punct) => {
    const trailingSpace = /\s$/.test(punct) ? " " : "";
    return "," + tag + trailingSpace;
  });
}
export {
  attachTrailingCommasToLinks,
  calculateReadingTimeMs,
  extractTextFromHtmlRegex,
  getFocalCharacterIndex,
  getWordParts,
  parseWords,
  wordEndsSentence,
  wordHasPausePunctuation
};
