import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractArticle } from "./extract-article";
import { ArticleFetchError, fetchArticleHtml } from "./article-fetch";

vi.mock("./article-fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./article-fetch")>();
  return { ...actual, fetchArticleHtml: vi.fn() };
});
beforeEach(() => { vi.mocked(fetchArticleHtml).mockReset(); });

describe("article extraction", () => {
  it("resolves article links and media using the final redirect URL", async () => {
    vi.mocked(fetchArticleHtml).mockResolvedValue({
      url: "https://example.org/articles/final",
      html: `<html><head><title>Example</title><base href="https://wrong.example/"></head><body><article>
        <h1>Example</h1><p>${"A readable sentence with enough article content to extract. ".repeat(20)}
        <a href="../source">Source</a><img src="./image.jpg" alt="Example"></p></article></body></html>`,
    });
    const result = await extractArticle("https://example.org/start");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.content).toContain('href="https://example.org/source"');
      expect(result.body.content).toContain('src="https://example.org/articles/image.jpg"');
      expect(result.body.content).not.toContain("wrong.example");
    }
  });
  it("preserves extraction failure status", async () => {
    vi.mocked(fetchArticleHtml).mockRejectedValue(new ArticleFetchError(413, "Response too large"));
    expect(await extractArticle("https://example.org/")).toEqual({ ok: false, status: 413, body: { error: "Response too large" } });
  });
  it("maps a timeout to a helpful error without exposing internals", async () => {
    vi.mocked(fetchArticleHtml).mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await extractArticle("https://example.org/")).toEqual({ ok: false, status: 504, body: { error: "Request timed out" } });
    spy.mockRestore();
  });
});
