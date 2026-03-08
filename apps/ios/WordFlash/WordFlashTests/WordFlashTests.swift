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

}
