import dns from "node:dns";
import net from "node:net";
import http, { type IncomingMessage, type RequestOptions } from "node:http";
import https from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class ArticleFetchError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Reject non-public destinations, including IPv4-mapped IPv6 addresses. */
export function isPublicAddress(address: string): boolean {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19)));
  }
  if (net.isIP(address) !== 6) return false;
  const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  if (normalized.startsWith("::ffff:")) {
    const tail = normalized.slice(7).split(":").map((part) => parseInt(part, 16));
    if (tail.length !== 2) return false;
    return isPublicAddress(`${tail[0] >> 8}.${tail[0] & 255}.${tail[1] >> 8}.${tail[1] & 255}`);
  }
  // Public unicast IPv6 is 2000::/3. Reject documentation addresses as well.
  const first = parseInt(normalized.split(":")[0], 16);
  return first >= 0x2000 && first <= 0x3fff && !normalized.startsWith("2001:db8:");
}

function validateUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new ArticleFetchError(400, "Invalid URL protocol");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (url.username || url.password || hostname === "localhost" || hostname.endsWith(".localhost") ||
      (net.isIP(hostname) && !isPublicAddress(hostname))) {
    throw new ArticleFetchError(400, "Forbidden URL");
  }
}

function requestArticle(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  validateUrl(url);
  return new Promise((resolve, reject) => {
    const options: RequestOptions & { autoSelectFamily: boolean } = {
      signal,
      // Resolve and validate at connection time, then use that same address.
      // No second DNS lookup can change the destination after validation.
      agent: false,
      autoSelectFamily: false,
      lookup(hostname, _options, callback) {
        dns.lookup(hostname, { all: true }, (error, addresses) => {
          if (error) { callback(error, "", 4); return; }
          if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
            callback(new ArticleFetchError(400, "Forbidden URL"), "", 4);
            return;
          }
          callback(null, addresses[0].address, addresses[0].family);
        });
      },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WordFlash/1.0; +https://github.com)", "Accept-Encoding": "identity" },
    };
    const request = (url.protocol === "https:" ? https : http).get(url, options, resolve);
    request.on("error", reject);
  });
}

export async function fetchArticleHtml(input: string): Promise<{ html: string; url: string }> {
  let url: URL;
  try { url = new URL(input); } catch { throw new ArticleFetchError(400, "Invalid URL"); }
  const signal = AbortSignal.timeout(30_000);
  for (let redirects = 0; ; redirects++) {
    const response = await requestArticle(url, signal);
    const status = response.statusCode ?? 502;
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      if (redirects >= MAX_REDIRECTS) throw new ArticleFetchError(502, "Too many redirects");
      if (!response.headers.location) throw new ArticleFetchError(502, "Redirect has no destination");
      url = new URL(response.headers.location, url);
      continue;
    }
    if (status < 200 || status >= 300) {
      response.destroy();
      throw new ArticleFetchError(502, `Failed to fetch: ${status}`);
    }
    const declaredSize = Number(response.headers["content-length"]);
    if (declaredSize > MAX_HTML_BYTES) {
      response.destroy();
      throw new ArticleFetchError(413, "Response too large");
    }
    const encoding = response.headers["content-encoding"]?.toLowerCase();
    const decompressor = encoding === "gzip" ? createGunzip() : encoding === "deflate" ? createInflate()
      : encoding === "br" ? createBrotliDecompress() : null;
    if (decompressor) response.on("error", (error) => decompressor.destroy(error));
    const body = decompressor ? response.pipe(decompressor) : response;
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of body) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_HTML_BYTES) throw new ArticleFetchError(413, "Response too large");
        chunks.push(bytes);
      }
      return { html: Buffer.concat(chunks, size).toString("utf8"), url: url.href };
    } finally {
      body.destroy();
      response.destroy();
    }
  }
}
