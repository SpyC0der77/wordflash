/**
 * Web-only utilities that depend on DOM (DOMParser).
 * Portable text preprocessing lives in @speedreader/core.
 */

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
