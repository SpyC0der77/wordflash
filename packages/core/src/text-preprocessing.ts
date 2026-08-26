export interface ParsedWords {
  words: string[];
  hasLineBreakAfter: boolean[];
  newlinesAfter: number[];
  leadingNewlines: number;
  prefixBefore: string[];
}

function splitOnEmDashes(token: string): string[] {
  return token.split(/(?<=—)|(?<=--)/).filter(Boolean);
}

function lineWords(line: string): { words: string[]; indent: string } {
  const indent = /^[ \t]*/.exec(line)?.[0] ?? "";
  const words = line
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap(splitOnEmDashes);
  return { words, indent };
}

function newlinesUntilNextWords(
  lineWordLists: string[][],
  fromLine: number,
): { count: number; hasMoreWordsAfter: boolean } {
  let emptyCount = 0;
  for (let k = fromLine + 1; k < lineWordLists.length; k++) {
    if ((lineWordLists[k]?.length ?? 0) > 0) {
      return { count: emptyCount + 1, hasMoreWordsAfter: true };
    }
    emptyCount++;
  }
  return { count: emptyCount, hasMoreWordsAfter: false };
}

/**
 * Splits text into words and records which words are followed by a manual
 * line break (`\n` / `\r\n`). Consecutive blank lines still produce a single
 * pause on the last word of the preceding non-empty line, while `newlinesAfter`
 * keeps the original break count for display.
 */
export function parseWordsDetailed(text: string): ParsedWords {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const words: string[] = [];
  const hasLineBreakAfter: boolean[] = [];
  const newlinesAfter: number[] = [];
  const prefixBefore: string[] = [];

  const parsedLines = lines.map(lineWords);
  const lineWordLists = parsedLines.map((l) => l.words);

  let leadingNewlines = 0;
  let seenWord = false;

  for (let i = 0; i < parsedLines.length; i++) {
    const currentLine = parsedLines[i];
    const currentLineWords = currentLine?.words ?? [];
    if (currentLineWords.length === 0) {
      if (!seenWord) leadingNewlines++;
      continue;
    }

    const { count, hasMoreWordsAfter } = newlinesUntilNextWords(
      lineWordLists,
      i,
    );

    for (let j = 0; j < currentLineWords.length; j++) {
      words.push(currentLineWords[j] ?? "");
      prefixBefore.push(j === 0 ? (currentLine?.indent ?? "") : "");
      const isLastOnLine = j === currentLineWords.length - 1;
      hasLineBreakAfter.push(isLastOnLine && hasMoreWordsAfter);
      newlinesAfter.push(isLastOnLine ? count : 0);
    }
    seenWord = true;
  }

  return {
    words,
    hasLineBreakAfter,
    newlinesAfter,
    leadingNewlines,
    prefixBefore,
  };
}

export function parseWords(text: string): string[] {
  return parseWordsDetailed(text).words;
}

function getGraphemeClusters(word: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return [...segmenter.segment(word)].map((s) => s.segment);
}

export function getFocalCharacterIndex(word: string): number {
  const clusters = getGraphemeClusters(word);
  const length = clusters.length;
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return Math.min(4, length - 1);
}

export function getWordParts(word: string) {
  const clusters = getGraphemeClusters(word);
  const focalCharacterIndex = getFocalCharacterIndex(word);
  return {
    left: clusters.slice(0, focalCharacterIndex).join(""),
    focalCharacter: clusters[focalCharacterIndex] ?? "",
    right: clusters.slice(focalCharacterIndex + 1).join(""),
  };
}

/**
 * Preprocesses HTML so trailing commas after links are moved inside the link.
 * E.g. `<a href="...">link</a>, ` becomes `<a href="...">link,</a> `.
 * This ensures the comma is attached to the last word of the link for
 * parseWords/wrapWordsInHtml, rather than being treated as its own word.
 */
export function attachTrailingCommasToLinks(html: string): string {
  return html.replace(/(<\/a>)(\s*,\s*)/g, (_, tag, punct) => {
    const trailingSpace = /\s$/.test(punct) ? " " : "";
    return "," + tag + trailingSpace;
  });
}

/**
 * Extracts plain text from HTML using the SAME word-boundary logic as
 * wrapWordsInHtml. Must be used for WordFlash text so indices match the
 * Reader View highlight. Client-only (DOMParser); returns "" during SSR.
 */
export function extractTextFromHtml(html: string): string {
  if (typeof document === "undefined") return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const parts: string[] = [];

  let hasProcessedWords = false;
  let lastWasLineBreak = false;

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof HTMLElement && node.tagName === "BR") {
      parts.push("\n");
      lastWasLineBreak = true;
      continue;
    }
    if (!(node instanceof Text)) continue;

    const text = (node.textContent ?? "").replace(/\s+/g, " ");
    const nodeParts = text.split(/( )/);

    const hasContent = text.trim().length > 0;
    const startsWithSpace = /^\s/.test(text);
    const needsLeadingSpace =
      hasContent &&
      !startsWithSpace &&
      hasProcessedWords &&
      !lastWasLineBreak;

    if (needsLeadingSpace) {
      parts.push(" ");
    }

    for (const part of nodeParts) {
      if (part === " ") {
        parts.push(" ");
      } else if (part) {
        parts.push(part);
        hasProcessedWords = true;
        lastWasLineBreak = false;
      }
    }
  }

  return parts
    .join("")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * Wraps each word in the HTML with spans containing data-word-index for
 * highlighting. Depends on window/document (DOMParser). During SSR
 * (typeof document === "undefined"), returns the unmodified HTML.
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
        for (const word of splitOnEmDashes(part)) {
          const span = doc.createElement("span");
          span.setAttribute("data-word-index", String(wordIndex++));
          span.textContent = word;
          fragment.appendChild(span);
          hasProcessedWords = true;
        }
      }
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return doc.body.innerHTML;
}
