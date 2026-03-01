import { describe, it, expect } from "vitest";
import {
  calculateReadingTimeMs,
  wordEndsSentence,
  wordHasPausePunctuation,
} from "./word-timing";

describe("wordEndsSentence", () => {
  it("returns true for words ending in period", () => {
    expect(wordEndsSentence("end.")).toBe(true);
    expect(wordEndsSentence("Dr.")).toBe(true);
    expect(wordEndsSentence("U.S.A.")).toBe(true);
  });

  it("returns true for words ending in question mark", () => {
    expect(wordEndsSentence("really?")).toBe(true);
    expect(wordEndsSentence("what?")).toBe(true);
  });

  it("returns true for words ending in exclamation", () => {
    expect(wordEndsSentence("wow!")).toBe(true);
    expect(wordEndsSentence("stop!")).toBe(true);
  });

  it("returns true when sentence-ending punctuation is followed by closing quote", () => {
    expect(wordEndsSentence('said."')).toBe(true);
    expect(wordEndsSentence('end."')).toBe(true);
    expect(wordEndsSentence("really?'")).toBe(true);
  });

  it("returns false for words ending in comma", () => {
    expect(wordEndsSentence("hello,")).toBe(false);
    expect(wordEndsSentence("well,")).toBe(false);
  });

  it("returns false for words ending in colon or semicolon", () => {
    expect(wordEndsSentence("Note:")).toBe(false);
    expect(wordEndsSentence("first;")).toBe(false);
  });

  it("returns false for words ending in em dash", () => {
    expect(wordEndsSentence("word—")).toBe(false);
  });

  it("returns false for words without sentence-ending punctuation", () => {
    expect(wordEndsSentence("hello")).toBe(false);
    expect(wordEndsSentence("middle")).toBe(false);
  });

  it("returns false for empty or whitespace-only", () => {
    expect(wordEndsSentence("")).toBe(false);
    expect(wordEndsSentence("   ")).toBe(false);
  });

  it("handles period in middle of word", () => {
    expect(wordEndsSentence("U.S.A")).toBe(false);
    expect(wordEndsSentence("3.14")).toBe(false);
  });

  it("mixed interrobang-style punctuation (?! or !?)", () => {
    expect(wordEndsSentence("What?!")).toBe(true);
    expect(wordEndsSentence("Really!?")).toBe(true);
  });
});

describe("wordHasPausePunctuation", () => {
  it("returns true for words ending in comma", () => {
    expect(wordHasPausePunctuation("hello,")).toBe(true);
    expect(wordHasPausePunctuation("well,")).toBe(true);
  });

  it("returns true for words ending in colon", () => {
    expect(wordHasPausePunctuation("Note:")).toBe(true);
    expect(wordHasPausePunctuation("following:")).toBe(true);
  });

  it("returns true for words ending in semicolon", () => {
    expect(wordHasPausePunctuation("first;")).toBe(true);
    expect(wordHasPausePunctuation("however;")).toBe(true);
  });

  it("returns true for words ending in em dash", () => {
    expect(wordHasPausePunctuation("word—")).toBe(true);
    expect(wordHasPausePunctuation("something—")).toBe(true);
  });

  it("returns true for words ending in double hyphen", () => {
    expect(wordHasPausePunctuation("word--")).toBe(true);
  });

  it("returns true when pause punctuation is followed by closing quote", () => {
    expect(wordHasPausePunctuation('said,"')).toBe(true);
    expect(wordHasPausePunctuation("well—'")).toBe(true);
  });

  it("returns false for words ending in period, question, or exclamation", () => {
    expect(wordHasPausePunctuation("end.")).toBe(false);
    expect(wordHasPausePunctuation("really?")).toBe(false);
    expect(wordHasPausePunctuation("wow!")).toBe(false);
  });

  it("returns false for words without pause punctuation", () => {
    expect(wordHasPausePunctuation("hello")).toBe(false);
    expect(wordHasPausePunctuation("middle")).toBe(false);
  });

  it("returns false for empty or whitespace-only", () => {
    expect(wordHasPausePunctuation("")).toBe(false);
    expect(wordHasPausePunctuation("   ")).toBe(false);
  });

  it("punctuation-only token (e.g. stray comma or em dash)", () => {
    expect(wordHasPausePunctuation(",")).toBe(true);
    expect(wordHasPausePunctuation("—")).toBe(true);
    expect(wordHasPausePunctuation("--")).toBe(true);
  });
});

describe("calculateReadingTimeMs", () => {
  const words = ["Hello,", "world.", "How", "are", "you?"];
  const sentenceEndMs = 500;
  const speechBreakMs = 250;

  it("returns 0 for empty words array", () => {
    expect(
      calculateReadingTimeMs([], 300, sentenceEndMs, speechBreakMs)
    ).toBe(0);
  });

  it("clamps toIndex to valid bounds when out of range", () => {
    const valid = calculateReadingTimeMs(
      words,
      300,
      sentenceEndMs,
      speechBreakMs,
      0,
      words.length - 1
    );
    const outOfRange = calculateReadingTimeMs(
      words,
      300,
      sentenceEndMs,
      speechBreakMs,
      0,
      999
    );
    expect(outOfRange).toBe(valid);
  });

  it("clamps negative toIndex to 0", () => {
    const fromZero = calculateReadingTimeMs(
      words,
      300,
      sentenceEndMs,
      speechBreakMs,
      0,
      0
    );
    const negativeToIndex = calculateReadingTimeMs(
      words,
      300,
      sentenceEndMs,
      speechBreakMs,
      0,
      -5
    );
    expect(negativeToIndex).toBe(fromZero);
  });

  it("uses minimum WPM of 1 when WPM is zero", () => {
    const result = calculateReadingTimeMs(
      words,
      0,
      sentenceEndMs,
      speechBreakMs
    );
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("uses minimum WPM of 1 when WPM is negative", () => {
    const result = calculateReadingTimeMs(
      words,
      -100,
      sentenceEndMs,
      speechBreakMs
    );
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("uses minimum WPM of 1 when WPM is NaN", () => {
    const result = calculateReadingTimeMs(
      words,
      Number.NaN,
      sentenceEndMs,
      speechBreakMs
    );
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("handles very high WPM without producing invalid timings", () => {
    const result = calculateReadingTimeMs(
      words,
      10000,
      sentenceEndMs,
      speechBreakMs
    );
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("computes positive time for valid inputs", () => {
    const result = calculateReadingTimeMs(
      words,
      300,
      sentenceEndMs,
      speechBreakMs,
      0,
      2
    );
    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);
  });
});
