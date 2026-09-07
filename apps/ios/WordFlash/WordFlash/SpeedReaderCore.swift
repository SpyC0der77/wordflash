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
            of: #"[.!?)]["']?$"#,
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

    static let firstProperNounDelayMsAt250Wpm = 250

    private static let sentenceStartFunctionWords: Set<String> = [
        "a", "an", "the",
        "i", "i'm", "i'll", "i've", "i'd",
        "we", "we're", "we'll", "we've", "we'd",
        "you", "you're", "you'll", "you've", "you'd",
        "he", "she", "it", "they",
        "this", "that", "these", "those",
        "there", "then", "than",
        "when", "where", "why", "how", "what", "who", "whom", "which",
        "if", "as", "but", "and", "or", "nor", "so", "yet",
        "for", "to", "in", "on", "at", "of", "by", "from", "with", "into", "onto",
        "after", "before", "during", "while", "until", "unless",
        "although", "though", "because", "since",
        "however", "therefore", "thus", "also", "still", "now", "here",
        "later", "next", "suddenly", "finally", "meanwhile",
        "yes", "no", "oh", "well", "please", "maybe", "perhaps",
        "hello", "hi", "hey",
        "my", "your", "his", "her", "its", "our", "their",
        "not", "do", "does", "did", "don't", "doesn't", "didn't",
        "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had",
        "can", "could", "will", "would", "shall", "should", "may", "might", "must",
    ]

    private static let honorifics: Set<String> = [
        "mr", "mrs", "ms", "mz", "mx", "dr", "prof", "sr", "jr", "st",
        "rev", "fr", "br", "hon", "gen", "col", "lt", "sgt", "capt", "cmdr",
        "sir", "dame", "lady", "lord", "esq",
    ]

    private static let nameParticles: Set<String> = [
        "van", "von", "de", "da", "di", "del", "della", "der", "den",
        "la", "le", "du", "bin", "ibn", "al", "af", "ter", "ten",
    ]

    private static let sentenceStartContentWords: Set<String> = [
        "help", "wait", "look", "come", "go", "stop", "let", "let's",
        "make", "take", "give", "keep", "put", "get", "see", "tell",
        "ask", "try", "use", "want", "need", "know", "think", "feel",
        "welcome", "thanks", "thank", "sorry", "good", "great", "nice",
        "happy", "dear", "chapter", "part", "section", "volume",
        "appendix", "figure", "table", "note", "introduction",
        "conclusion", "preface", "warning", "start", "begin",
        "continue", "today", "tomorrow", "yesterday",
    ]

    static func wordStartsSentence(_ words: [String], index: Int) -> Bool {
        guard !words.isEmpty else { return false }
        if index <= 0 { return true }
        return wordEndsSentence(words[index - 1])
    }

    private static func nameCore(_ word: String) -> String {
        let trimmed = word.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutLeading = trimmed.replacingOccurrences(
            of: #"^[^\p{L}]+"#,
            with: "",
            options: .regularExpression
        )
        let withoutTrailing = withoutLeading.replacingOccurrences(
            of: #"[^\p{L}\p{N}'’-]+$"#,
            with: "",
            options: .regularExpression
        )
        return withoutTrailing.replacingOccurrences(
            of: #"['’]s$"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
    }

    private static func properNounKey(_ word: String) -> String {
        nameCore(word).lowercased()
    }

    private static func isTitleCaseName(_ word: String) -> Bool {
        let core = nameCore(word)
        guard core.count >= 2, let first = core.first else { return false }
        guard first.isUppercase, first.isLetter else { return false }
        return core.contains { $0.isLetter && $0.isLowercase }
    }

    private static func startsNameSentence(_ words: [String], keys: [String], index: Int) -> Bool {
        if index <= 0 { return true }
        let prevKey = keys[index - 1]
        if honorifics.contains(prevKey) { return false }
        return wordEndsSentence(words[index - 1])
    }

    static func firstProperNounFlags(for words: [String], gazetteer: Set<String>? = nil) -> [Bool] {
        guard !words.isEmpty else { return [] }

        let keys = words.map(properNounKey)
        let titleCase = words.indices.map { index -> Bool in
            let key = keys[index]
            if key.isEmpty || honorifics.contains(key) { return false }
            return isTitleCaseName(words[index])
        }

        var lowercaseKeys = Set<String>()
        for index in words.indices {
            let key = keys[index]
            let core = nameCore(words[index])
            if let first = core.first, core.count >= 2, first.isLetter, first.isLowercase {
                lowercaseKeys.insert(key)
            }
        }

        var midSentenceKeys = Set<String>()
        for index in words.indices {
            let key = keys[index]
            if !key.isEmpty, titleCase[index], !startsNameSentence(words, keys: keys, index: index) {
                midSentenceKeys.insert(key)
            }
        }

        let likely = words.indices.map { index -> Bool in
            let key = keys[index]
            if key.isEmpty || !titleCase[index] || lowercaseKeys.contains(key) { return false }
            if CommonEnglishWords.words.contains(key) { return false }
            let atStart = startsNameSentence(words, keys: keys, index: index)
            if !atStart || midSentenceKeys.contains(key) { return true }
            if let gazetteer, gazetteer.contains(key) { return true }
            if let gazetteer, !gazetteer.isEmpty { return false }
            return !sentenceStartFunctionWords.contains(key)
                && !sentenceStartContentWords.contains(key)
        }

        var flags = Array(repeating: false, count: words.count)
        var seen = Set<String>()
        var index = 0
        while index < words.count {
            guard likely[index] else {
                index += 1
                continue
            }

            let start = index
            index += 1
            while index < words.count {
                let key = keys[index]
                let glued = likely[index]
                    || (nameParticles.contains(key)
                        && index + 1 < words.count
                        && likely[index + 1])
                if !glued { break }
                index += 1
            }

            var spanKeys: [String] = []
            for spanIndex in start..<index where likely[spanIndex] {
                spanKeys.append(keys[spanIndex])
            }
            if spanKeys.contains(where: { !seen.contains($0) }) {
                flags[start] = true
            }
            for key in spanKeys {
                seen.insert(key)
            }
        }

        return flags
    }

    static func nextWordDelayMs(
        for word: String,
        wordsPerMinute: Int,
        sentenceEndDurationMsAt250Wpm: Int,
        speechBreakDurationMsAt250Wpm: Int,
        isFirstProperNoun: Bool = false
    ) -> Int {
        let safeWpm = max(1, wordsPerMinute)
        let baseMsPerWord = max(30, Int((60_000.0 / Double(safeWpm)).rounded()))
        let wpmScale = 250.0 / Double(safeWpm)
        let sentenceDelay = Int((Double(sentenceEndDurationMsAt250Wpm) * wpmScale).rounded())
        let pauseDelay = Int((Double(speechBreakDurationMsAt250Wpm) * wpmScale).rounded())
        let properNounDelay = Int((Double(firstProperNounDelayMsAt250Wpm) * wpmScale).rounded())

        let extraDelay: Int
        if wordEndsSentence(word) {
            extraDelay = sentenceDelay
        } else if wordHasPausePunctuation(word) {
            extraDelay = pauseDelay
        } else {
            extraDelay = 0
        }

        return baseMsPerWord + extraDelay + (isFirstProperNoun ? properNounDelay : 0)
    }

    static func calculateReadingTimeMs(
        words: [String],
        wordsPerMinute: Int,
        sentenceEndDurationMsAt250Wpm: Int,
        speechBreakDurationMsAt250Wpm: Int,
        fromIndex: Int = 0,
        toIndex: Int? = nil,
        gazetteer: Set<String>? = nil
    ) -> Int {
        guard !words.isEmpty else { return 0 }

        let maxIndex = words.count - 1
        let rawEnd = toIndex ?? maxIndex
        let end = max(0, min(rawEnd, maxIndex))
        let start = max(0, min(fromIndex, end))
        let flags = firstProperNounFlags(for: words, gazetteer: gazetteer)

        var total = 0
        for index in start...end {
            total += nextWordDelayMs(
                for: words[index],
                wordsPerMinute: wordsPerMinute,
                sentenceEndDurationMsAt250Wpm: sentenceEndDurationMsAt250Wpm,
                speechBreakDurationMsAt250Wpm: speechBreakDurationMsAt250Wpm,
                isFirstProperNoun: flags[index]
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
