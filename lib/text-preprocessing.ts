export function parseWords(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function getFocalCharacterIndex(word: string): number {
  const length = word.length;
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return Math.min(4, length - 1);
}

export function getWordParts(word: string) {
  const focalCharacterIndex = getFocalCharacterIndex(word);
  return {
    left: word.slice(0, focalCharacterIndex),
    focalCharacter: word[focalCharacterIndex] ?? "",
    right: word.slice(focalCharacterIndex + 1),
  };
}

const ZWSP = "\u200B"; // zero-width space for break opportunities

/**
 * Splits a string into display chunks at sensible break points (hyphens, or
 * after vowels for long runs). Each chunk is intended to fit on one line.
 */
export function splitIntoDisplayChunks(
  text: string,
  maxCharsPerChunk = 6,
): string[] {
  if (text.length <= maxCharsPerChunk) return text ? [text] : [];

  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const chunkEnd = Math.min(i + maxCharsPerChunk, text.length);
    const chunk = text.slice(i, chunkEnd);

    const hyphenIdx = chunk.indexOf("-");
    if (hyphenIdx >= 0) {
      chunks.push(chunk.slice(0, hyphenIdx + 1));
      i += hyphenIdx + 1;
      continue;
    }

    if (chunkEnd >= text.length) {
      chunks.push(chunk);
      break;
    }

    const lastVowel = chunk.split("").findLastIndex((c) =>
      /[aeiouyAEIOUY]/.test(c),
    );
    const breakAfter = lastVowel >= 0 ? lastVowel + 1 : chunk.length;
    chunks.push(chunk.slice(0, breakAfter));
    i += breakAfter;
  }

  return chunks;
}

/**
 * Inserts zero-width spaces at sensible break points so long strings can wrap
 * without breaking mid-syllable. Prefers breaking after vowels; for hyphenated
 * segments, hyphens already provide break points.
 */
export function addWordBreakOpportunities(
  text: string,
  maxCharsBeforeBreak = 6,
): string {
  return splitIntoDisplayChunks(text, maxCharsBeforeBreak).join(ZWSP);
}

/**
 * Preprocesses HTML so trailing commas and periods after links are moved inside
 * the link. E.g. `<a href="...">link</a>, ` becomes `<a href="...">link,</a> `,
 * and `<a href="...">link</a>. ` becomes `<a href="...">link.</a> `.
 * This ensures punctuation is attached to the last word of the link for
 * parseWords/wrapWordsInHtml, rather than being treated as its own word.
 */
export function attachTrailingCommasToLinks(html: string): string {
  return html.replace(/(<\/a>)(\s*([.,])\s*)/g, (_, tag, punct, char) => {
    const trailingSpace = /\s$/.test(punct) ? " " : "";
    return char + tag + trailingSpace;
  });
}

/**
 * Extracts plain text from HTML using the SAME word-boundary logic as
 * wrapWordsInHtml. Must be used for SpeedReader text so indices match the
 * Reader View highlight. Client-only (DOMParser).
 */
export function extractTextFromHtml(html: string): string {
  if (typeof document === "undefined") return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const parts: string[] = [];

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text) textNodes.push(node);
  }

  let hasProcessedWords = false;

  for (const node of textNodes) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ");
    const nodeParts = text.split(/( )/);

    const hasContent = text.trim().length > 0;
    const startsWithSpace = /^\s/.test(text);
    const needsLeadingSpace =
      hasContent && !startsWithSpace && hasProcessedWords;

    if (needsLeadingSpace) {
      parts.push(" ");
    }

    for (const part of nodeParts) {
      if (part === " ") {
        parts.push(" ");
      } else if (part) {
        parts.push(part);
        hasProcessedWords = true;
      }
    }
  }

  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Client-only utility that wraps each word in the HTML with spans containing
 * data-word-index for highlighting. Depends on window/document (DOMParser).
 * During SSR (typeof document === "undefined"), returns the unmodified HTML.
 * Callers must invoke this only from client contexts (e.g., inside useEffect or
 * a Client Component) so words are indexed/highlighted. For stricter behavior,
 * consider throwing when document is undefined or guarding call sites.
 */
export function wrapWordsInHtml(html: string): string {
  if (typeof document === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  let wordIndex = 0;

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Text) textNodes.push(node);
  }

  let hasProcessedWords = false;

  for (const node of textNodes) {
    const text = (node.textContent ?? "").replace(/\s+/g, " ");
    const parts = text.split(/( )/);
    const fragment = doc.createDocumentFragment();

    const hasContent = text.trim().length > 0;
    const startsWithSpace = /^\s/.test(text);
    const needsLeadingSpace =
      hasContent && !startsWithSpace && hasProcessedWords;

    if (needsLeadingSpace) {
      fragment.appendChild(doc.createTextNode(" "));
    }

    for (const part of parts) {
      if (part === " ") {
        fragment.appendChild(doc.createTextNode(" "));
      } else if (part) {
        const span = doc.createElement("span");
        span.setAttribute("data-word-index", String(wordIndex++));
        span.textContent = part;
        fragment.appendChild(span);
        hasProcessedWords = true;
      }
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return doc.body.innerHTML;
}
