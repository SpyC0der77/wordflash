import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import net from "net";
import dns from "dns";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "localhost4",
  "localhost6",
  "ip6-localhost",
  "ip6-loopback",
  "0.0.0.0",
  "127.0.0.1",
  "::1",
  "::",
]);

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

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255))
    return false;
  if (parts[0] === 10) return true; // 10.0.0.0/8
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
  if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
  if (parts[0] === 127) return true; // 127.0.0.0/8
  if (parts[0] === 169 && parts[1] === 254) return true; // 169.254.0.0/16
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return true; // unspecified
  const parts = ip.split(":");
  const firstHex = parts[0] ? parseInt(parts[0], 16) : NaN;
  if (!isNaN(firstHex)) {
    if (firstHex >= 0xfc00 && firstHex <= 0xfdff) return true; // fc00::/7
    if (firstHex >= 0xfe80 && firstHex <= 0xfebf) return true; // fe80::/10
  }
  return false;
}

function isBlockedIP(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return false;
}

async function isBlockedHostname(hostname: string): Promise<boolean> {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (net.isIP(normalized)) return isBlockedIP(normalized);
  try {
    const results = await dns.promises.lookup(normalized, { all: true });
    for (const r of results) {
      if (isBlockedIP(r.address)) return true;
    }
  } catch {
    return true; // Reject on DNS failure to be safe
  }
  return false;
}

export async function extractArticle(url: unknown): Promise<ExtractResponse> {
  try {
    if (!url || typeof url !== "string") {
      return { ok: false, status: 400, body: { error: "URL is required" } };
    }

    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return {
        ok: false,
        status: 400,
        body: { error: "Invalid URL protocol" },
      };
    }

    const hostname = parsedUrl.hostname;
    if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
      return { ok: false, status: 400, body: { error: "Forbidden URL" } };
    }
    if (net.isIP(hostname) && isBlockedIP(hostname)) {
      return { ok: false, status: 400, body: { error: "Forbidden URL" } };
    }
    if (!net.isIP(hostname)) {
      const blocked = await isBlockedHostname(hostname);
      if (blocked) {
        return { ok: false, status: 400, body: { error: "Forbidden URL" } };
      }
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WordFlash/1.0; +https://github.com)",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        body: { error: `Failed to fetch: ${response.statusText}` },
      };
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      const size = parseInt(contentLength, 10);
      if (!Number.isNaN(size) && size > MAX_HTML_BYTES) {
        return { ok: false, status: 413, body: { error: "Response too large" } };
      }
    }

    let html: string;
    if (contentLength !== null && !Number.isNaN(parseInt(contentLength, 10))) {
      html = await response.text();
    } else {
      const reader = response.body?.getReader();
      if (!reader) {
        return { ok: false, status: 502, body: { error: "No response body" } };
      }
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.length;
          if (totalBytes > MAX_HTML_BYTES) {
            reader.cancel();
            return {
              ok: false,
              status: 413,
              body: { error: "Response too large" },
            };
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const c of chunks) {
        combined.set(c, offset);
        offset += c.length;
      }
      html = decoder.decode(combined);
    }
    const safeUrl = url.replace(/"/g, "&quot;");
    const htmlWithBase = html.includes("<head")
      ? html.replace(/<head/i, `<head><base href="${safeUrl}">`)
      : html;
    const { document } = parseHTML(htmlWithBase);
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
    console.error("Article extraction error:", error);
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, status: 504, body: { error: "Request timed out" } };
    }
    return {
      ok: false,
      status: 500,
      body: {
        error:
          error instanceof Error ? error.message : "Failed to extract article",
      },
    };
  }
}
