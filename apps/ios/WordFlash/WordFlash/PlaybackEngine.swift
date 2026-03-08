import Foundation
import Combine

@MainActor
final class PlaybackEngine: ObservableObject {
    @Published private(set) var words: [String] = []
    @Published private(set) var isPlaying = false
    @Published var wordIndex = 0 {
        didSet {
            let clamped = clampedIndex(wordIndex)
            if clamped != wordIndex {
                wordIndex = clamped
                return
            }
            if oldValue != wordIndex {
                onWordIndexChanged?(wordIndex)
            }
        }
    }

    var onWordIndexChanged: ((Int) -> Void)?
    var onComplete: (() -> Void)?

    private var wordsPerMinute = 300
    private var sentenceEndDurationMs = 500
    private var speechBreakDurationMs = 250
    private var tickTask: Task<Void, Never>?

    var isFinished: Bool {
        !words.isEmpty && !isPlaying && wordIndex >= (words.count - 1)
    }

    var activeWord: String {
        guard words.indices.contains(wordIndex) else { return "" }
        return words[wordIndex]
    }

    deinit {
        tickTask?.cancel()
    }

    func setWords(_ newWords: [String], initialIndex: Int = 0) {
        words = newWords
        wordIndex = clampedIndex(initialIndex)
        if newWords.isEmpty {
            pause()
        } else {
            refreshPlaybackSchedule()
        }
    }

    func setWordIndex(_ newIndex: Int, pausePlayback: Bool = true) {
        if pausePlayback {
            pause()
        }
        wordIndex = clampedIndex(newIndex)
        refreshPlaybackSchedule()
    }

    func configureTiming(
        wordsPerMinute: Int,
        sentenceEndDurationMs: Int,
        speechBreakDurationMs: Int
    ) {
        self.wordsPerMinute = max(1, wordsPerMinute)
        self.sentenceEndDurationMs = max(0, sentenceEndDurationMs)
        self.speechBreakDurationMs = max(0, speechBreakDurationMs)
        refreshPlaybackSchedule()
    }

    func playPauseRestart() {
        guard !words.isEmpty else { return }

        if isFinished {
            wordIndex = 0
            play()
            return
        }

        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    func pause() {
        isPlaying = false
        tickTask?.cancel()
        tickTask = nil
    }

    func remainingReadingTimeMs() -> Int {
        guard !words.isEmpty else { return 0 }
        let endIndex = max(0, words.count - 1)
        return SpeedReaderCore.calculateReadingTimeMs(
            words: words,
            wordsPerMinute: wordsPerMinute,
            sentenceEndDurationMsAt250Wpm: sentenceEndDurationMs,
            speechBreakDurationMsAt250Wpm: speechBreakDurationMs,
            fromIndex: wordIndex,
            toIndex: endIndex
        )
    }

    func totalReadingTimeMs() -> Int {
        guard !words.isEmpty else { return 0 }
        return SpeedReaderCore.calculateReadingTimeMs(
            words: words,
            wordsPerMinute: wordsPerMinute,
            sentenceEndDurationMsAt250Wpm: sentenceEndDurationMs,
            speechBreakDurationMsAt250Wpm: speechBreakDurationMs,
            fromIndex: 0,
            toIndex: words.count - 1
        )
    }

    func refreshPlaybackSchedule() {
        guard isPlaying else { return }
        scheduleNextTick()
    }

    private func play() {
        guard !words.isEmpty else { return }
        isPlaying = true
        scheduleNextTick()
    }

    private func scheduleNextTick() {
        tickTask?.cancel()
        guard isPlaying, !words.isEmpty else { return }

        let currentWord = words[clampedIndex(wordIndex)]
        let delayMs = SpeedReaderCore.nextWordDelayMs(
            for: currentWord,
            wordsPerMinute: wordsPerMinute,
            sentenceEndDurationMsAt250Wpm: sentenceEndDurationMs,
            speechBreakDurationMsAt250Wpm: speechBreakDurationMs
        )

        tickTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(max(1, delayMs)) * 1_000_000)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard let self, self.isPlaying, !self.words.isEmpty else { return }
                let next = min(self.wordIndex + 1, self.words.count - 1)
                self.wordIndex = next
                if next >= self.words.count - 1 {
                    self.isPlaying = false
                    self.tickTask?.cancel()
                    self.tickTask = nil
                    self.onComplete?()
                } else {
                    self.scheduleNextTick()
                }
            }
        }
    }

    private func clampedIndex(_ proposed: Int) -> Int {
        guard !words.isEmpty else { return 0 }
        return max(0, min(proposed, words.count - 1))
    }
}
