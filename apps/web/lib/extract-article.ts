import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { ArticleFetchError, fetchArticleHtml } from "./article-fetch";

export interface ExtractedArticle {
  title: string | null;
  content: string | null;
  textContent?: string;
  excerpt: string | null;
  byline: string | null;
  siteName: string | null;
}

export interface ExtractSuccess {
  ok: true;
  status: 200;
  body: ExtractedArticle;
}

export interface ExtractFailure {
  ok: false;
  status: number;
  body: { error: string };
}

export type ExtractResponse = ExtractSuccess | ExtractFailure;

export async function extractArticle(url: unknown): Promise<ExtractResponse> {
  try {
    if (!url || typeof url !== "string") {
      return { ok: false, status: 400, body: { error: "URL is required" } };
    }

    const { html, url: finalUrl } = await fetchArticleHtml(url);
    const { document } = parseHTML(html);
    for (const base of Array.from(document.querySelectorAll("base"))) base.remove();
    // Readability also resolves srcset and lazy-loaded media using baseURI.
    Object.defineProperty(document, "baseURI", { value: finalUrl, configurable: true });
    // Resolve relative media and links against the final redirected URL without
    // modifying the source head tag or trusting an article-provided base element.
    for (const element of Array.from(document.querySelectorAll("[href], [src], [poster]"))) {
      for (const attribute of ["href", "src", "poster"]) {
        const value = element.getAttribute(attribute);
        if (value === null) continue;
        try {
          element.setAttribute(attribute, new URL(value, finalUrl).href);
        } catch {
          // Leave invalid URLs for sanitization.
        }
      }
    }
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      return {
        ok: false,
        status: 422,
        body: { error: "Could not extract article content" },
      };
    }

    const textContent = article.textContent
      ? article.textContent.replace(/\s+/g, " ").trim()
      : undefined;

    return {
      ok: true,
      status: 200,
      body: {
        title: article.title ?? null,
        content: article.content ?? null,
        textContent,
        excerpt: article.excerpt ?? null,
        byline: article.byline ?? null,
        siteName: article.siteName ?? null,
      },
    };
  } catch (error) {
    if (error instanceof ArticleFetchError) {
      return { ok: false, status: error.status, body: { error: error.message } };
    }
    console.error("Article extraction error:", error);
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
      return { ok: false, status: 504, body: { error: "Request timed out" } };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "Failed to extract article" },
    };
  }
}
