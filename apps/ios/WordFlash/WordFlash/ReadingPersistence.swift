import Foundation

struct PreviousArticle: Codable, Hashable, Identifiable {
    let url: String
    let title: String

    var id: String { url }
}

enum ReadingPersistence {
    private static let previousArticlesKey = "speedreader-previous-articles"
    private static let readingPositionsKey = "speedreader-reading-positions"
    private static let previousArticlesMax = 15

    static func loadPreviousArticles() -> [PreviousArticle] {
        guard
            let data = UserDefaults.standard.data(forKey: previousArticlesKey),
            let decoded = try? JSONDecoder().decode([PreviousArticle].self, from: data)
        else {
            return []
        }
        return decoded
    }

    static func savePreviousArticle(url: String, title: String) {
        var entries = loadPreviousArticles().filter { $0.url != url }
        entries.insert(PreviousArticle(url: url, title: title), at: 0)
        entries = Array(entries.prefix(previousArticlesMax))
        save(entries, forKey: previousArticlesKey)
    }

    static func loadReadingPosition(for url: String) -> Int? {
        let positions = loadPositions()
        return positions[url]
    }

    static func saveReadingPosition(for url: String, wordIndex: Int) {
        var positions = loadPositions()
        positions[url] = max(0, wordIndex)
        save(positions, forKey: readingPositionsKey)
    }

    private static func loadPositions() -> [String: Int] {
        guard
            let data = UserDefaults.standard.data(forKey: readingPositionsKey),
            let decoded = try? JSONDecoder().decode([String: Int].self, from: data)
        else {
            return [:]
        }
        return decoded
    }

    private static func save<T: Encodable>(_ value: T, forKey key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
