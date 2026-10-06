import { describe, expect, it } from "vitest";
import { parseProperNounGazetteer } from "./proper-noun-gazetteer";

describe("parseProperNounGazetteer", () => {
  it("reads a versioned names payload", () => {
    const gazetteer = parseProperNounGazetteer({
      version: 1,
      names: ["Elizabeth", " York ", "a"],
    });
    expect(gazetteer.has("elizabeth")).toBe(true);
    expect(gazetteer.has("york")).toBe(true);
    expect(gazetteer.has("a")).toBe(false);
  });

  it("reads a bare array", () => {
    const gazetteer = parseProperNounGazetteer(["Morgan"]);
    expect(gazetteer.has("morgan")).toBe(true);
  });

  it("rejects invalid payloads", () => {
    expect(() => parseProperNounGazetteer({ names: "nope" })).toThrow();
  });
});
