import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseHTML } from "linkedom";
import { extractTextFromHtml, getWordTiming, parseWordsDetailed, wrapWordsInHtml } from "@wordflash/core";

beforeEach(() => {
  const { window } = parseHTML("<html><body></body></html>");
  vi.stubGlobal("document", window.document);
  vi.stubGlobal("DOMParser", window.DOMParser);
});
afterEach(() => vi.unstubAllGlobals());

function article(body: string) { return `<html><body>${body}</body></html>`; }

describe("article tokens across markup", () => {
  it.each([
    ["<strong>Hello</strong>, world", "Hello, world"],
    ["un<em>believ</em>able", "unbelievable"],
    ["<em>“Hello”</em>.", "“Hello”."],
    ["<a href='/x'>hello</a>?! next", "hello?! next"],
    ["don<strong>’</strong>t stop", "don’t stop"],
    ["<b>3</b>.14 and U.<i>S.</i> Army", "3.14 and U.S. Army"],
    ["one<span> </span>two", "one two"],
    ["one&nbsp;<b>two</b>", "one two"],
    ["one—<b>two</b>", "one—two"],
    ["<p>one</p><p>two</p>", "one\ntwo"],
    ["<h2>Title</h2><ul><li>one</li><li>two</li></ul>", "Title\none\ntwo"],
    ["one<br><br>two", "one\n\ntwo"],
    ["<table><tr><td>one</td><td>two</td></tr></table>", "one two"],
    ["one<script>bad</script><span hidden>bad</span> two", "one two"],
  ])("preserves reading boundaries for %s", (html, expected) => {
    const input = article(html);
    expect(extractTextFromHtml(input)).toBe(expected);
    const words = parseWordsDetailed(expected).words;
    const { document } = parseHTML(wrapWordsInHtml(input));
    const fragments = Array.from(document.querySelectorAll("[data-word-index]"));
    const reconstructed = words.map((_, index) => fragments
      .filter((node) => node.getAttribute("data-word-index") === String(index))
      .map((node) => node.textContent).join(""));
    expect(reconstructed).toEqual(words);
    expect(fragments.every((node) => Number(node.getAttribute("data-word-index")) < words.length)).toBe(true);
  });

  it("keeps styling and links on fragments of the same word", () => {
    const { document } = parseHTML(wrapWordsInHtml(article("un<em>believ</em><a href='/x'>able</a>!")));
    expect(document.querySelector("em span")?.textContent).toBe("believ");
    expect(document.querySelector("a")?.getAttribute("href")).toBe("/x");
    expect(Array.from(document.querySelectorAll("span")).map((node) => node.getAttribute("data-word-index"))).toEqual(["0", "0", "0", "0"]);
  });

  it("adds paragraph pauses without adding pauses for inline emphasis", () => {
    const parsed = parseWordsDetailed(extractTextFromHtml(article("<p>one <em>two</em></p><p>three</p>")));
    expect(parsed.words).toEqual(["one", "two", "three"]);
    expect(parsed.hasLineBreakAfter).toEqual([false, true, false]);
  });

  it.each([
    ["<b>Hello</b>, next", "Hello, next"],
    ["<em>‘Really?</em>’ Next", "‘Really?’ Next"],
    ["<a href='/x'>3</a>.14 next", "3.14 next"],
    ["Dr.<b> </b>Smith arrived.", "Dr. Smith arrived."],
    ["don<em>’t</em> stop... yet", "don’t stop... yet"],
    ["one<b>—</b>two", "one—two"],
  ])("matches plain-text timing for %s", (html, plain) => {
    const timings = (text: string) => {
      const { words, hasLineBreakAfter } = parseWordsDetailed(text);
      return words.map((word, index) => getWordTiming(word, 250, 500, 250, {
        nextWord: words[index + 1], hasLineBreakAfter: hasLineBreakAfter[index],
      }));
    };
    expect(timings(extractTextFromHtml(article(html)))).toEqual(timings(plain));
  });
});
