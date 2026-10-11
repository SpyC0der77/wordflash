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

/** Legacy compatibility helper. Word boundaries now work across inline elements. */
export function attachTrailingCommasToLinks(html: string): string {
  return html.replace(/(<\/a>)(\s*,\s*)/g, (_, tag, punct) => {
    const trailingSpace = /\s$/.test(punct) ? " " : "";
    return "," + tag + trailingSpace;
  });
}

const BLOCK_ELEMENTS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD",
  "FIGCAPTION", "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6",
  "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION", "TABLE",
  "TR", "UL",
]);
const EXCLUDED_ELEMENTS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
const MEDIA_ELEMENTS = new Set(["IMG", "VIDEO", "AUDIO", "IFRAME", "OBJECT", "EMBED"]);

/** One text stream for both playback and highlighting; inline tags add no spaces. */
function articleTextStream(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ranges: Array<{ node: Text; start: number; text: string }> = [];
  let text = "";
  function boundary() {
    // Inspect without modifying text: ranges retain their original offsets.
    if (text && !/\n *$/.test(text)) text += "\n";
  }
  function pruneHiddenContent(node: Node, inheritedVisibilityHidden = false): boolean {
    if (node.nodeType === 3) {
      if (inheritedVisibilityHidden) {
        node.parentNode?.removeChild(node);
        return false;
      }
      return /\S/.test(node.textContent ?? "");
    }
    if (node.nodeType !== 1) return false;
    const element = node as Element;
    const style = (element as HTMLElement).style;
    const display = (style?.getPropertyValue("display") ?? "").replace(/\s*!important\s*$/i, "").trim().toLowerCase();
    const visibility = (style?.getPropertyValue("visibility") ?? "").replace(/\s*!important\s*$/i, "").trim().toLowerCase();
    if (EXCLUDED_ELEMENTS.has(element.tagName) || element.hasAttribute("hidden") ||
        element.getAttribute("aria-hidden") === "true" || display === "none") {
      element.remove();
      return false;
    }
    // Inherited visibility can be overridden by a visible descendant.
    const visibilityHidden = visibility === "visible" ? false
      : visibility === "hidden" ? true : inheritedVisibilityHidden;
    const isMediaOrBreak = MEDIA_ELEMENTS.has(element.tagName) || element.tagName === "BR";
    if (visibilityHidden && isMediaOrBreak) {
      element.remove();
      return false;
    }
    let hasVisibleContent = isMediaOrBreak;
    for (const child of Array.from(node.childNodes)) {
      if (pruneHiddenContent(child, visibilityHidden)) hasVisibleContent = true;
    }
    if (visibilityHidden && !hasVisibleContent) element.remove();
    return hasVisibleContent;
  }
  function visit(node: Node) {
    if (node.nodeType === 3) {
      const value = (node.textContent ?? "").replace(/\s+/g, " ");
      ranges.push({ node: node as Text, start: text.length, text: value });
      text += value;
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (element.tagName === "BR") {
      text += "\n";
      return;
    }
    const block = BLOCK_ELEMENTS.has(element.tagName);
    if (block) boundary();
    // Adjacent table cells still represent separate words.
    if ((element.tagName === "TD" || element.tagName === "TH") && text && !/\s$/.test(text)) text += " ";
    for (const child of Array.from(node.childNodes)) visit(child);
    if (block) boundary();
  }
  // Prune before collecting offsets so hidden-only blocks add no boundaries.
  pruneHiddenContent(doc.body);
  visit(doc.body);
  return { doc, text, ranges };
}

/** Extract visible article text, preserving inline words and structural breaks. */
export function extractTextFromHtml(html: string): string {
  if (typeof document === "undefined") return "";
  return articleTextStream(html).text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** A token can span multiple styled nodes; all fragments share its word index. */
export function wrapWordsInHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const { doc, text, ranges } = articleTextStream(html);
  const tokens: Array<{ start: number; end: number; index: number }> = [];
  for (const match of text.matchAll(/\S+/g)) {
    let start = match.index;
    for (const word of splitOnEmDashes(match[0])) {
      tokens.push({ start, end: start + word.length, index: tokens.length });
      start += word.length;
    }
  }
  let tokenCursor = 0;
  for (const range of ranges) {
    const fragment = doc.createDocumentFragment();
    const end = range.start + range.text.length;
    let offset = 0;
    while (tokenCursor < tokens.length && tokens[tokenCursor].end <= range.start) tokenCursor++;
    for (let i = tokenCursor; i < tokens.length && tokens[i].start < end; i++) {
      const token = tokens[i];
      const from = Math.max(token.start, range.start) - range.start;
      const to = Math.min(token.end, end) - range.start;
      if (from > offset) fragment.appendChild(doc.createTextNode(range.text.slice(offset, from)));
      const span = doc.createElement("span");
      span.setAttribute("data-word-index", String(token.index));
      span.textContent = range.text.slice(from, to);
      fragment.appendChild(span);
      offset = to;
    }
    if (offset < range.text.length) fragment.appendChild(doc.createTextNode(range.text.slice(offset)));
    range.node.parentNode?.replaceChild(fragment, range.node);
  }
  return doc.body.innerHTML;
}
