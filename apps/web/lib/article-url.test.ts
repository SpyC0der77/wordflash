import { describe, expect, it } from "vitest";
import { normalizeArticleUrl } from "./article-url";

describe("pasted article addresses", () => {
  it.each([
    ["  example.com/article  ", "https://example.com/article"],
    ["www.example.com", "https://www.example.com/"],
    ["//example.com/article", "https://example.com/article"],
    ["https://example.com/a?q=hello world", "https://example.com/a?q=hello%20world"],
    ["http://example.com/article", "http://example.com/article"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeArticleUrl(input)).toBe(expected);
  });
  it.each(["", "hello world", "mailto:reader@example.com", "javascript:alert(1)", "https://user:password@example.com"])("rejects %s with recovery guidance", (input) => {
    expect(() => normalizeArticleUrl(input)).toThrow(/Enter|Use/);
  });
});
