import { describe, expect, it } from "vitest";
import { normalizeArticleUrl } from "./article-url";

describe("pasted article addresses", () => {
  it.each([
    ["  example.com/article  ", "https://example.com/article"],
    ["www.example.com", "https://www.example.com/"],
    ["//example.com/article", "https://example.com/article"],
    ["https://example.com/a?q=hello world", "https://example.com/a?q=hello%20world"],
    ["http://example.com/article", "http://example.com/article"],
    ["b\u00fccher.de/article", "https://xn--bcher-kva.de/article"],
    ["m\u00fcnich.de", "https://xn--mnich-kva.de/"],
    ["\u4f8b\u3048.\u30c6\u30b9\u30c8/article", "https://xn--r8jz45g.xn--zckzah/article"],
    ["example.com:8080/article", "https://example.com:8080/article"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeArticleUrl(input)).toBe(expected);
  });
  it.each(["", "hello world", "mailto:reader@example.com", "javascript:alert(1)", "https://user:password@example.com"])("rejects %s with recovery guidance", (input) => {
    expect(() => normalizeArticleUrl(input)).toThrow(/Enter|Use/);
  });
});
