//
//  WordFlashTests.swift
//  WordFlashTests
//
//  Created by Carter Stach on 3/8/26.
//

import Testing
@testable import WordFlash

struct WordFlashTests {
    @Test
    func parseWordsCollapsesWhitespace() async throws {
        let words = SpeedReaderCore.parseWords(" hello   world \n again ")
        #expect(words == ["hello", "world", "again"])
    }

    @Test
    func focalCharacterIndexMatchesRules() async throws {
        #expect(SpeedReaderCore.focalCharacterIndex(for: "a") == 0)
        #expect(SpeedReaderCore.focalCharacterIndex(for: "hello") == 1)
        #expect(SpeedReaderCore.focalCharacterIndex(for: "reading") == 2)
        #expect(SpeedReaderCore.focalCharacterIndex(for: "extraordinary") == 3)
        #expect(SpeedReaderCore.focalCharacterIndex(for: "supercalifragilistic") == 4)
    }

    @Test
    func punctuationSignalsPauses() async throws {
        #expect(SpeedReaderCore.wordEndsSentence("end.") == true)
        #expect(SpeedReaderCore.wordEndsSentence("wow!") == true)
        #expect(SpeedReaderCore.wordEndsSentence("word,") == false)

        #expect(SpeedReaderCore.wordHasPausePunctuation("word,") == true)
        #expect(SpeedReaderCore.wordHasPausePunctuation("word;") == true)
        #expect(SpeedReaderCore.wordHasPausePunctuation("word.") == false)
    }

    @Test
    func readingTimeUsesPunctuationDelays() async throws {
        let words = ["Hello,", "world.", "again"]
        let ms = SpeedReaderCore.calculateReadingTimeMs(
            words: words,
            wordsPerMinute: 250,
            sentenceEndDurationMsAt250Wpm: 500,
            speechBreakDurationMsAt250Wpm: 250
        )

        // 3 base words at 250WPM ~= 240ms each + comma delay + sentence delay.
        #expect(ms == (240 * 3) + 250 + 500)
    }

    @Test
    func firstProperNounGetsExtraDwell() async throws {
        let flags = SpeedReaderCore.firstProperNounFlags(
            for: ["I", "met", "Carter", "yesterday.", "Then", "Carter", "left."]
        )
        #expect(flags == [false, false, true, false, false, false, false])

        let withoutName = SpeedReaderCore.calculateReadingTimeMs(
            words: ["the", "cat", "sat"],
            wordsPerMinute: 250,
            sentenceEndDurationMsAt250Wpm: 500,
            speechBreakDurationMsAt250Wpm: 250
        )
        let withName = SpeedReaderCore.calculateReadingTimeMs(
            words: ["the", "Carter", "sat"],
            wordsPerMinute: 250,
            sentenceEndDurationMsAt250Wpm: 500,
            speechBreakDurationMsAt250Wpm: 250
        )
        #expect(withName - withoutName == SpeedReaderCore.firstProperNounDelayMsAt250Wpm)
    }

    @Test
    func firstProperNounHeuristicIgnoresShoutingAndSpansNames() async throws {
        #expect(
            SpeedReaderCore.firstProperNounFlags(for: ["STOP", "yelling", "HELP."])
                == [false, false, false]
        )
        #expect(
            SpeedReaderCore.firstProperNounFlags(for: ["Mr.", "Smith", "left."])
                == [false, true, false]
        )
        #expect(
            SpeedReaderCore.firstProperNounFlags(for: ["I", "flew", "to", "New", "York", "City."])
                == [false, false, false, false, true, false]
        )
        #expect(
            SpeedReaderCore.firstProperNounFlags(for: ["Will", "arrived."])
                == [false, false]
        )
        #expect(
            SpeedReaderCore.firstProperNounFlags(
                for: ["Will", "arrived."],
                gazetteer: ["will"]
            ) == [false, false]
        )
        #expect(
            SpeedReaderCore.firstProperNounFlags(for: ["I", "met", "Will", "yesterday."])
                == [false, false, false, false]
        )
    }

}
