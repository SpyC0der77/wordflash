import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadProperNounGazetteer,
  resetProperNounGazetteerForTests,
} from "./proper-noun-gazetteer";

afterEach(() => {
  resetProperNounGazetteerForTests();
});

describe("loadProperNounGazetteer", () => {
  it("returns the dataset when fetch is fast", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ version: 1, names: ["elizabeth", "york"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const gazetteer = await loadProperNounGazetteer({
      fetch: fetchImpl,
      timeoutMs: 1_000,
    });
    expect(gazetteer?.has("elizabeth")).toBe(true);
    expect(gazetteer?.has("york")).toBe(true);
  });

  it("falls back to null when fetch exceeds the timeout", async () => {
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));

    const gazetteer = await loadProperNounGazetteer({
      fetch: fetchImpl,
      timeoutMs: 20,
    });
    expect(gazetteer).toBeNull();
  });
});
