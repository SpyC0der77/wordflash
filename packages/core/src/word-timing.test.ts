import { describe, it, expect } from "vitest";
import {
  calculateReadingTimeMs,
  FIRST_PROPER_NOUN_DELAY_MS_AT_250_WPM,
  getFirstProperNounFlags,
  getWordTiming,
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

  it("does not treat closing parentheses as sentence endings", () => {
    expect(wordEndsSentence("(1)")).toBe(false);
    expect(wordEndsSentence("end)")).toBe(false);
    expect(wordEndsSentence("see)")).toBe(false);
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
    const lineBreakDelay = Math.round(sentenceEndMs * (250 / wpm) * LINE_BREAK_PAUSE_MULTIPLIER);
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
    expect(withBreak - plain).toBe(lineBreakDelay);
  });

  it("adds extra dwell on the first proper noun", () => {
    const wpm = 250;
    const delay = FIRST_PROPER_NOUN_DELAY_MS_AT_250_WPM;
    const withoutName = calculateReadingTimeMs(
      ["the", "cat", "sat"],
      wpm,
      sentenceEndMs,
      speechBreakMs,
    );
    const withName = calculateReadingTimeMs(
      ["the", "Morgan", "sat"],
      wpm,
      sentenceEndMs,
      speechBreakMs,
    );
    expect(withName - withoutName).toBe(delay);
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

describe("getFirstProperNounFlags", () => {
  it("flags the first mid-sentence capitalized name", () => {
    const words = ["I", "met", "Morgan", "yesterday."];
    expect(getFirstProperNounFlags(words)).toEqual([false, false, true, false]);
  });

  it("does not flag later mentions of the same name", () => {
    const words = ["I", "met", "Morgan", "yesterday.", "Then", "Morgan", "left."];
    expect(getFirstProperNounFlags(words)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("treats a sentence-start name as the first instance", () => {
    const words = ["Elizabeth", "walked", "home."];
    expect(getFirstProperNounFlags(words)).toEqual([true, false, false]);
  });

  it("does not treat sentence-start function words as names", () => {
    expect(getFirstProperNounFlags(["The", "cat", "sat."])).toEqual([
      false,
      false,
      false,
    ]);
    expect(getFirstProperNounFlags(["However,", "she", "left."])).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("treats a sentence-start capital as a name when it appears mid-sentence later", () => {
    const words = ["Morgan", "walked", "home.", "Later", "Morgan", "sat."];
    expect(getFirstProperNounFlags(words)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("matches names across trailing punctuation and possessives", () => {
    const words = ['"Morgan,"', "said", "Ann.", "Morgan's", "hat."];
    expect(getFirstProperNounFlags(words)).toEqual([
      true,
      false,
      true,
      false,
      false,
    ]);
  });

  it("returns an empty array for no words", () => {
    expect(getFirstProperNounFlags([])).toEqual([]);
  });

  it("does not flag ALL CAPS shouting", () => {
    expect(getFirstProperNounFlags(["STOP", "yelling", "HELP."])).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("does not flag a capitalized word that also appears lowercase", () => {
    const words = ["An", "Apple", "fell.", "The", "apple", "rotted."];
    expect(getFirstProperNounFlags(words)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("does not flag honorifics, and treats the following name as mid-sentence", () => {
    expect(getFirstProperNounFlags(["Mr.", "Smith", "left."])).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("dwells on the first unusual word of a multi-word name, not common English parts", () => {
    const words = ["I", "flew", "to", "New", "York", "City."];
    expect(getFirstProperNounFlags(words)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it("does not dwell again on a later mention of a name from a span", () => {
    const words = [
      "I",
      "met",
      "John",
      "Smith.",
      "Then",
      "John",
      "left.",
    ];
    expect(getFirstProperNounFlags(words)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("treats particle names as one span", () => {
    expect(
      getFirstProperNounFlags(["Ludwig", "van", "Beethoven", "composed."]),
    ).toEqual([true, false, false, false]);
  });

  it("does not flag common sentence-start content words", () => {
    expect(getFirstProperNounFlags(["Help", "arrived."])).toEqual([
      false,
      false,
    ]);
  });

  it("does not linger on names that are also common English words", () => {
    expect(getFirstProperNounFlags(["Will", "arrived."])).toEqual([
      false,
      false,
    ]);
    expect(getFirstProperNounFlags(["I", "met", "Will", "yesterday."])).toEqual([
      false,
      false,
      false,
      false,
    ]);
    const gazetteer = new Set(["will"]);
    expect(getFirstProperNounFlags(["Will", "arrived."], gazetteer)).toEqual([
      false,
      false,
    ]);
  });

  it("does not guess unknown sentence-start words when a gazetteer is loaded", () => {
    const gazetteer = new Set(["morgan"]);
    expect(
      getFirstProperNounFlags(["Zyglorf", "walked", "home."], gazetteer),
    ).toEqual([false, false, false]);
    expect(
      getFirstProperNounFlags(["I", "met", "Zyglorf", "later."], gazetteer),
    ).toEqual([false, false, true, false]);
  });
});


describe("natural reading timing", () => {
  const timing = (word: string, context = {}) => getWordTiming(word, 250, 500, 250, context);

  it.each(["word,”", "word,’", "word,\"", "word,)]”,", "word,]"])("recognizes quoted or nested comma pauses: %s", (word) => {
    expect(timing(word).pauseMs).toBe(250);
  });

  it.each(["word—", "word--", "word–", "word;", "word:"])("gives stronger clause boundaries more time: %s", (word) => {
    expect(timing(word).pauseMs).toBe(313);
  });

  it.each(["end.”", "end!’", "end?)]”", "wait…", "wait..."])("recognizes sentence boundaries: %s", (word) => {
    expect(timing(word).pauseMs).toBe(500);
    expect(wordEndsSentence(word)).toBe(true);
    expect(getSentenceToneMark(word)).not.toBeNull();
  });

  it.each(["Dr.", "Mr.", "J.", "e.g.", "U.S."])("does not pause as a sentence at an abbreviation before a name: %s", (word) => {
    expect(timing(word, { nextWord: "Morgan" }).pauseMs).toBe(0);
    expect(wordStartsSentence([word, "Morgan"], 1)).toBe(false);
  });

  it("can end a sentence after an abbreviation", () => {
    expect(timing("U.S.", { nextWord: "The" }).pauseMs).toBe(500);
    expect(timing("etc.").pauseMs).toBe(500);
  });

  it("keeps sentence cues past titles and parenthetical asides", () => {
    const words = ["Did", "Dr.", "Morgan", "(really)", "leave?"];
    expect(getSentenceEndIndex(words, 0)).toBe(4);
    expect(getSentenceToneMarkAt(words, 0)).toBe("?");
    expect(timing("(really)").pauseMs).toBe(125);
  });

  it.each(["3.14", "1,000", "12:30", "2026-09-11", "$42.50", "75%", "٣٫١٤", "v2"])("gives numeric tokens attention without treating internal punctuation as a break: %s", (word) => {
    expect(timing(word).attentionMs).toBeGreaterThan(0);
    expect(timing(word).pauseMs).toBe(0);
  });

  it("scales numeric attention with complexity and caps it", () => {
    expect(timing("7").attentionMs).toBe(80);
    expect(timing("2026").attentionMs).toBe(170);
    expect(timing("12.34").attentionMs).toBe(230);
    expect(timing("9".repeat(100)).attentionMs).toBe(360);
    expect(timing("2026,").attentionMs).toBe(timing("2026").attentionMs);
    expect(timing("2026.").attentionMs).toBe(timing("2026").attentionMs);
  });

  it("adds a bounded long-word dwell without penalizing short words", () => {
    expect(timing("ordinary").attentionMs).toBe(0);
    expect(timing("understanding").attentionMs).toBe(100);
    expect(timing("a".repeat(100)).attentionMs).toBe(180);
  });

  it("uses the strongest attention adjustment instead of stacking them", () => {
    expect(timing("Bartholomew", { isFirstProperNoun: true }).attentionMs).toBe(250);
    expect(timing("123456789012", { isFirstProperNoun: true }).attentionMs).toBe(360);
  });

  it("uses the line-break pause instead of adding a second sentence pause", () => {
    expect(timing("end.", { hasLineBreakAfter: true }).pauseMs).toBe(1000);
    expect(timing("end,", { hasLineBreakAfter: true }).pauseMs).toBe(1000);
  });

  it("scales base, attention, and pauses with WPM", () => {
    const slow = timing("2026,");
    const fast = getWordTiming("2026,", 500, 500, 250);
    expect(fast.totalMs).toBe(slow.totalMs / 2);
  });

  it.each([0, -1, NaN, Infinity, Number.MIN_VALUE, 100000])("keeps timing finite and positive at WPM %s", (wpm) => {
    const result = getWordTiming("123.", wpm, NaN, -100);
    expect(Number.isFinite(result.totalMs)).toBe(true);
    expect(result.totalMs).toBeGreaterThanOrEqual(30);
    expect(result.pauseMs).toBe(0);
  });

  it("supports disabled punctuation pauses", () => {
    expect(getWordTiming("123.", 250, 0, 0, { hasLineBreakAfter: true }).pauseMs).toBe(0);
    expect(getWordTiming("123.", 250, 0, 0).attentionMs).toBeGreaterThan(0);
  });

  it("keeps playback durations and full or partial estimates identical", () => {
    const words = ["Dr.", "Morgan", "paid", "$1,234.50,", "then", "left—", "really?!”", "Next", "day."];
    const breaks = words.map((_, i) => i === 6);
    const flags = getFirstProperNounFlags(words);
    for (const wpm of [150, 250, 600, 3000]) {
      const durations = words.map((word, i) => getWordTiming(word, wpm, 500, 250, {
        nextWord: words[i + 1],
        hasLineBreakAfter: breaks[i],
        isFirstProperNoun: flags[i],
      }).totalMs);
      expect(calculateReadingTimeMs(words, wpm, 500, 250, 0, undefined, breaks)).toBe(durations.reduce((a, b) => a + b, 0));
      expect(calculateReadingTimeMs(words, wpm, 500, 250, 1, 5, breaks)).toBe(durations.slice(1, 6).reduce((a, b) => a + b, 0));
    }
  });

  it("does not merge distinct names across punctuation", () => {
    expect(getFirstProperNounFlags(["Morgan,", "Elizabeth", "arrived."])).toEqual([true, true, false]);
    expect(getFirstProperNounFlags(["Morgan.", "Elizabeth", "arrived."])).toEqual([true, true, false]);
  });

  it("dwells on the new name component when the first component was already seen", () => {
    expect(getFirstProperNounFlags(["John", "left.", "John", "Petrov", "arrived."])).toEqual([true, false, false, true, false]);
  });

  it("exempts common English names even when supplied by the gazetteer", () => {
    expect(getFirstProperNounFlags(["Will", "May", "Hope"], new Set(["will", "may", "hope"]))).toEqual([false, false, false]);
  });
});
