import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Invalid URL protocol" },
        { status: 400 }
      );
    }

    const hostname = parsedUrl.hostname;
    if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden URL" }, { status: 400 });
    }
    if (net.isIP(hostname) && isBlockedIP(hostname)) {
      return NextResponse.json({ error: "Forbidden URL" }, { status: 400 });
    }
    if (!net.isIP(hostname)) {
      const blocked = await isBlockedHostname(hostname);
      if (blocked) {
        return NextResponse.json({ error: "Forbidden URL" }, { status: 400 });
      }
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SpeedReader/1.0; +https://github.com)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.statusText}` },
        { status: 502 }
      );
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength !== null) {
      const size = parseInt(contentLength, 10);
      if (!Number.isNaN(size) && size > MAX_HTML_BYTES) {
        return NextResponse.json(
          { error: "Response too large" },
          { status: 413 }
        );
      }
    }

    let html: string;
    if (contentLength !== null && !Number.isNaN(parseInt(contentLength, 10))) {
      html = await response.text();
    } else {
      const reader = response.body?.getReader();
      if (!reader) {
        return NextResponse.json(
          { error: "No response body" },
          { status: 502 }
        );
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
            return NextResponse.json(
              { error: "Response too large" },
              { status: 413 }
            );
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
      return NextResponse.json(
        { error: "Could not extract article content" },
        { status: 422 }
      );
    }

    const textContent = article.textContent
      ? article.textContent.replace(/\s+/g, " ").trim()
      : undefined;

    return NextResponse.json({
      title: article.title,
      content: article.content,
      textContent,
      excerpt: article.excerpt,
      byline: article.byline,
      siteName: article.siteName,
    });
  } catch (error) {
    console.error("Article extraction error:", error);
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract article" },
      { status: 500 }
    );
  }
}
