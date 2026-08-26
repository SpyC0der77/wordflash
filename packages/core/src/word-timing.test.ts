import { describe, it, expect } from "vitest";
import {
  calculateReadingTimeMs,
  getPunctuationGlyphTiming,
  getSentenceEndIndex,
  getSentenceToneMark,
  getSentenceToneMarkAt,
  LINE_BREAK_PAUSE_MULTIPLIER,
  wordEndsSentence,
  wordHasPausePunctuation,
  wordStartsSentence,
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

  it("returns true for words ending in closing parenthesis", () => {
    expect(wordEndsSentence("(1)")).toBe(true);
    expect(wordEndsSentence("end)")).toBe(true);
    expect(wordEndsSentence("see)")).toBe(true);
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

  it("returns false for words ending in period, question, exclamation, or closing paren", () => {
    expect(wordHasPausePunctuation("end.")).toBe(false);
    expect(wordHasPausePunctuation("really?")).toBe(false);
    expect(wordHasPausePunctuation("wow!")).toBe(false);
    expect(wordHasPausePunctuation("(1)")).toBe(false);
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

describe("getSentenceToneMark", () => {
  it("returns ? for questions", () => {
    expect(getSentenceToneMark("really?")).toBe("?");
    expect(getSentenceToneMark("what?")).toBe("?");
    expect(getSentenceToneMark("really?'")).toBe("?");
  });

  it("returns ! for exclamations", () => {
    expect(getSentenceToneMark("wow!")).toBe("!");
    expect(getSentenceToneMark("stop!")).toBe("!");
  });

  it("returns . for statements", () => {
    expect(getSentenceToneMark("end.")).toBe(".");
    expect(getSentenceToneMark('said."')).toBe(".");
    expect(getSentenceToneMark("Wait…")).toBe(".");
  });

  it("prefers ? when both ? and ! are present", () => {
    expect(getSentenceToneMark("What?!")).toBe("?");
    expect(getSentenceToneMark("Really!?")).toBe("?");
  });

  it("returns null when there is no sentence-ending tone mark", () => {
    expect(getSentenceToneMark("hello")).toBe(null);
    expect(getSentenceToneMark("well,")).toBe(null);
    expect(getSentenceToneMark("(1)")).toBe(null);
    expect(getSentenceToneMark("")).toBe(null);
  });
});

describe("getSentenceToneMarkAt", () => {
  it("looks ahead to the current sentence's ending mark", () => {
    const words = ["How", "are", "you?", "I", "am", "fine."];
    expect(getSentenceToneMarkAt(words, 0)).toBe("?");
    expect(getSentenceToneMarkAt(words, 2)).toBe("?");
    expect(getSentenceToneMarkAt(words, 3)).toBe(".");
  });

  it("defaults to . when the sentence has no ending punctuation", () => {
    expect(getSentenceToneMarkAt(["just", "words"], 0)).toBe(".");
  });

  it("treats a closing parenthesis sentence end as a statement", () => {
    expect(getSentenceToneMarkAt(["see)"], 0)).toBe(".");
  });
});

describe("getSentenceEndIndex", () => {
  it("returns the ending word of the current sentence", () => {
    const words = ["How", "are", "you?", "What", "now?"];
    expect(getSentenceEndIndex(words, 0)).toBe(2);
    expect(getSentenceEndIndex(words, 2)).toBe(2);
    expect(getSentenceEndIndex(words, 3)).toBe(4);
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

  it("adds twice the sentence-end delay for a manual line break", () => {
    const wpm = 300;
    const sentenceDelay = Math.round(sentenceEndMs * (250 / wpm));
    const plain = calculateReadingTimeMs(
      ["hello", "world"],
      wpm,
      sentenceEndMs,
      speechBreakMs
    );
    const withBreak = calculateReadingTimeMs(
      ["hello", "world"],
      wpm,
      sentenceEndMs,
      speechBreakMs,
      0,
      undefined,
      [true, false]
    );
    expect(withBreak - plain).toBe(sentenceDelay * LINE_BREAK_PAUSE_MULTIPLIER);
  });
});

describe("wordStartsSentence", () => {
  it("treats the first word as the start of a sentence", () => {
    expect(wordStartsSentence(["Hello", "world."], 0)).toBe(true);
  });

  it("starts a sentence after sentence-ending punctuation", () => {
    const words = ["Hello.", "How", "are", "you?"];
    expect(wordStartsSentence(words, 1)).toBe(true);
    expect(wordStartsSentence(words, 2)).toBe(false);
    expect(wordStartsSentence(words, 3)).toBe(false);
  });

  it("returns false for an empty word list", () => {
    expect(wordStartsSentence([], 0)).toBe(false);
  });
});

describe("getPunctuationGlyphTiming", () => {
  it("uses visible duration as the hold, with independent fade and lead", () => {
    expect(getPunctuationGlyphTiming(400, 300, 80)).toEqual({
      holdMs: 400,
      fadeOutMs: 300,
      fadeInMs: 80,
    });
  });

  it("clamps negative values to zero", () => {
    expect(getPunctuationGlyphTiming(-10, -20, -30)).toEqual({
      holdMs: 0,
      fadeOutMs: 0,
      fadeInMs: 0,
    });
  });
});
