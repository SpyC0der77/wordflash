import Foundation

enum SpeedReaderCore {
    static func parseWords(_ text: String) -> [String] {
        let collapsed = text
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !collapsed.isEmpty else { return [] }
        return collapsed.split(separator: " ").map(String.init)
    }

    static func focalCharacterIndex(for word: String) -> Int {
        let graphemes = Array(word)
        let length = graphemes.count

        if length <= 1 { return 0 }
        if length <= 5 { return 1 }
        if length <= 9 { return 2 }
        if length <= 13 { return 3 }
        return min(4, length - 1)
    }

    static func wordParts(for word: String) -> (left: String, focal: String, right: String) {
        let graphemes = Array(word)
        guard !graphemes.isEmpty else { return ("", "", "") }

        let index = focalCharacterIndex(for: word)
        let left = String(graphemes.prefix(index))
        let focal = String(graphemes[index])
        let right = String(graphemes.dropFirst(index + 1))
        return (left, focal, right)
    }

    static func wordEndsSentence(_ word: String) -> Bool {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return trimmed.range(
            of: #"[.!?]["']?$"#,
            options: .regularExpression
        ) != nil
    }

    static func wordHasPausePunctuation(_ word: String) -> Bool {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return trimmed.range(
            of: #"[,:;—]["']?$|--["']?$"#,
            options: .regularExpression
        ) != nil
    }

    static func nextWordDelayMs(
        for word: String,
        wordsPerMinute: Int,
        sentenceEndDurationMsAt250Wpm: Int,
        speechBreakDurationMsAt250Wpm: Int
    ) -> Int {
        let safeWpm = max(1, wordsPerMinute)
        let baseMsPerWord = max(30, Int((60_000.0 / Double(safeWpm)).rounded()))
        let wpmScale = 250.0 / Double(safeWpm)
        let sentenceDelay = Int((Double(sentenceEndDurationMsAt250Wpm) * wpmScale).rounded())
        let pauseDelay = Int((Double(speechBreakDurationMsAt250Wpm) * wpmScale).rounded())

        let extraDelay: Int
        if wordEndsSentence(word) {
            extraDelay = sentenceDelay
        } else if wordHasPausePunctuation(word) {
            extraDelay = pauseDelay
        } else {
            extraDelay = 0
        }

        return baseMsPerWord + extraDelay
    }

    static func calculateReadingTimeMs(
        words: [String],
        wordsPerMinute: Int,
        sentenceEndDurationMsAt250Wpm: Int,
        speechBreakDurationMsAt250Wpm: Int,
        fromIndex: Int = 0,
        toIndex: Int? = nil
    ) -> Int {
        guard !words.isEmpty else { return 0 }

        let maxIndex = words.count - 1
        let rawEnd = toIndex ?? maxIndex
        let end = max(0, min(rawEnd, maxIndex))
        let start = max(0, min(fromIndex, end))

        var total = 0
        for index in start...end {
            total += nextWordDelayMs(
                for: words[index],
                wordsPerMinute: wordsPerMinute,
                sentenceEndDurationMsAt250Wpm: sentenceEndDurationMsAt250Wpm,
                speechBreakDurationMsAt250Wpm: speechBreakDurationMsAt250Wpm
            )
        }
        return total
    }

    static func readingTimeLabel(ms: Int) -> String {
        if ms >= 60_000 {
            return "~\(Int((Double(ms) / 60_000.0).rounded())) min"
        }
        return "~\(Int((Double(ms) / 1000.0).rounded())) sec"
    }
}
