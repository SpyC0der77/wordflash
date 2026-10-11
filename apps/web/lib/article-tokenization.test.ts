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
    ["<p>one</p>\n  <p>two</p>", "one\ntwo"],
    ["<div> <p>one</p>\n <p>two</p> </div>", "one\ntwo"],
    ["<h2>Title</h2><ul><li>one</li><li>two</li></ul>", "Title\none\ntwo"],
    ["one<br><br>two", "one\n\ntwo"],
    ["<table><tr><td>one</td><td>two</td></tr></table>", "one two"],
    ["one<script>bad</script><style>bad</style><template>bad</template><noscript>bad</noscript><span hidden>bad</span> two", "one two"],
    ["one<span aria-hidden='true'>bad</span> two", "one two"],
    ["one<span style='display: none'>bad</span> two", "one two"],
    ["one<span style='visibility: hidden'>bad</span> two", "one two"],
    ["one <span style='visibility: hidden'>bad<strong style='visibility: visible'>two</strong>bad</span> three", "one two three"],
    ["one <span style='visibility: hidden'><i><b style='visibility: visible !important'>two</b></i></span> three", "one two three"],
    ["one <span style='visibility: hidden'><b style='visibility: visible'>two<i style='visibility: hidden'>bad</i></b></span> three", "one two three"],
    ["one<span style='display: none'><b style='visibility: visible'>bad</b></span> two", "one two"],
    ["one<div style='visibility: hidden'>bad</div> two", "one two"],
    ["one<div style='visibility: hidden'><p>bad</p></div> two", "one two"],
    ["one<div style='visibility: hidden'><b style='visibility: visible'>two</b></div>three", "one\ntwo\nthree"],
    ["one<span style='display: none !important'><b>bad</b></span> two", "one two"],
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
    expect(fragments.every((node) => {
      const index = Number(node.getAttribute("data-word-index"));
      return Number.isInteger(index) && index >= 0 && index < words.length;
    })).toBe(true);
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
  it("retains one structural break across indentation without shifting word indices", () => {
    const html = article("<p>one</p>\n  <p><b>two</b> three</p>");
    expect(parseWordsDetailed(extractTextFromHtml(html)).newlinesAfter).toEqual([1, 0, 0]);
    const { document } = parseHTML(wrapWordsInHtml(html));
    expect(document.querySelector("b span")?.getAttribute("data-word-index")).toBe("1");
  });
  it("removes inline-hidden descendants before the renderer can strip their styles", () => {
    const wrapped = wrapWordsInHtml(article("one<span style='visibility: hidden'><b>secret</b></span> two"));
    expect(wrapped).not.toContain("secret");
  });
  it("preserves visible descendant markup and indices inside a hidden ancestor", () => {
    const html = article("one <span style='visibility: hidden'>secret <a href='/source' style='visibility: visible'><em>two</em></a> secret</span> three");
    const wrapped = wrapWordsInHtml(html);
    const { document } = parseHTML(wrapped);
    expect(extractTextFromHtml(html)).toBe("one two three");
    expect(wrapped).not.toContain("secret");
    expect(document.querySelector("a")?.getAttribute("href")).toBe("/source");
    expect(document.querySelector("a em span")?.textContent).toBe("two");
    expect(document.querySelector("a em span")?.getAttribute("data-word-index")).toBe("1");
  });
  it("keeps visibility inheritance from exposing hidden media after sanitization", () => {
    const wrapped = wrapWordsInHtml(article("one <span style='visibility: hidden'><img src='/hidden.jpg'><img src='/visible.jpg' style='visibility: visible'></span> two"));
    expect(wrapped).not.toContain("/hidden.jpg");
    expect(wrapped).toContain("/visible.jpg");
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
