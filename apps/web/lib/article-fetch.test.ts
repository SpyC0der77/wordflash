import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import { fetchArticleHtml, isPublicAddress } from "./article-fetch";

const mocks = vi.hoisted(() => ({ get: vi.fn(), lookup: vi.fn() }));
vi.mock("node:http", () => ({ default: { get: mocks.get } }));
vi.mock("node:https", () => ({ default: { get: mocks.get } }));
vi.mock("node:dns", () => ({ default: { lookup: mocks.lookup } }));

type Fixture = { status?: number; headers?: Record<string, string>; chunks?: Buffer[] };
let responses: Fixture[];
beforeEach(() => {
  responses = [];
  mocks.lookup.mockReset();
  mocks.lookup.mockImplementation((_hostname, _options, callback) => callback(null, [{ address: "93.184.216.34", family: 4 }]));
  mocks.get.mockReset();
  mocks.get.mockImplementation((url, options, callback) => {
    const request = new EventEmitter();
    queueMicrotask(() => options.lookup(url.hostname, {}, (error: Error | null) => {
      if (error) { request.emit("error", error); return; }
      const fixture = responses.shift() ?? {};
      const response = Readable.from(fixture.chunks ?? [Buffer.from("<html>hello</html>")]) as IncomingMessage;
      response.statusCode = fixture.status ?? 200;
      response.headers = fixture.headers ?? {};
      callback(response);
    }));
    return request;
  });
});
afterEach(() => vi.restoreAllMocks());

describe("article destination validation", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.1.2.3", "100.64.0.1", "224.0.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"])("rejects %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it.each(["93.184.216.34", "2606:4700::1111", "::ffff:5db8:d822"])("allows %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });
  it.each(["http://localhost/", "http://localhost./", "http://127.0.0.1/", "http://[::ffff:127.0.0.1]/", "file:///etc/passwd", "http://user:password@example.org/"])("rejects forbidden URL %s before connecting", async (url) => {
    await expect(fetchArticleHtml(url)).rejects.toMatchObject({ status: 400 });
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("rejects a redirect to a private destination", async () => {
    responses.push({ status: 302, headers: { location: "http://169.254.169.254/latest/" } });
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 400 });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it("validates a redirected hostname at connection time", async () => {
    responses.push({ status: 302, headers: { location: "https://private.example.org/article" } });
    mocks.lookup.mockImplementation((hostname, _options, callback) => callback(null, [{
      address: hostname === "private.example.org" ? "10.0.0.1" : "93.184.216.34", family: 4,
    }]));
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 400 });
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    expect(mocks.lookup.mock.calls[1][0]).toBe("private.example.org");
  });
  it("rejects mixed public and private DNS answers at connection time", async () => {
    mocks.lookup.mockImplementation((_host, _opts, callback) => callback(null, [
      { address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 },
    ]));
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 400 });
  });
  it("resolves once per connection and disables address reselection", async () => {
    await fetchArticleHtml("https://example.org/");
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(mocks.get.mock.calls[0][1]).toMatchObject({ agent: false, autoSelectFamily: false });
  });
  it("uses the final URL for relative redirects", async () => {
    responses.push({ status: 302, headers: { location: "/article" } }, {});
    expect(await fetchArticleHtml("https://example.org/start")).toMatchObject({ url: "https://example.org/article" });
  });
  it("bounds redirect loops", async () => {
    responses.push(...Array.from({ length: 6 }, () => ({ status: 302, headers: { location: "/loop" } })));
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 502, message: "Too many redirects" });
  });
});

describe("article body limits", () => {
  it.each<Record<string, string>>([{}, { "content-length": "1" }])("measures actual streamed bytes with headers %j", async (headers) => {
    responses.push({ headers, chunks: [Buffer.alloc(3 * 1024 * 1024), Buffer.alloc(3 * 1024 * 1024)] });
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 413 });
  });
  it("bounds decompressed bodies as well", async () => {
    responses.push({ headers: { "content-encoding": "gzip" }, chunks: [gzipSync(Buffer.alloc(6 * 1024 * 1024))] });
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 413 });
  });
  it("bounds chunked compressed transfers even when the decoded body is small", async () => {
    const gzip = gzipSync(Buffer.from("hi"));
    const header = Buffer.from(gzip.subarray(0, 10));
    header[3] |= 8; // Valid gzip FNAME metadata can exceed the decoded payload size.
    responses.push({ headers: { "content-encoding": "gzip" }, chunks: [
      Buffer.concat([header, Buffer.alloc(3 * 1024 * 1024, 97)]),
      Buffer.concat([Buffer.alloc(3 * 1024 * 1024, 97), Buffer.from([0]), gzip.subarray(10)]),
    ] });
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 413 });
  });
  it("rejects declared oversized bodies", async () => {
    responses.push({ headers: { "content-length": String(6 * 1024 * 1024) } });
    await expect(fetchArticleHtml("https://example.org/")).rejects.toMatchObject({ status: 413 });
  });
});
