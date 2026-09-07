import Foundation

extension Notification.Name {
    static let properNounGazetteerDidLoad = Notification.Name("properNounGazetteerDidLoad")
}

enum ProperNounGazetteer {
    static let waitTimeoutNanoseconds: UInt64 = 600_000_000
    static let url = URL(
        string: "https://cdn.jsdelivr.net/gh/SpyC0der77/speedreader@main/apps/web/public/proper-nouns.json"
    )!

    private(set) static var names: Set<String>?

    private struct Payload: Decodable {
        let version: Int?
        let names: [String]
    }

    static func load() async {
        if names != nil { return }

        if let cached = readCache() {
            names = cached
            NotificationCenter.default.post(name: .properNounGazetteerDidLoad, object: nil)
            Task { await fetchAndStore(timeoutInterval: 15) }
            return
        }

        Task { await fetchAndStore(timeoutInterval: 15) }
        try? await Task.sleep(nanoseconds: waitTimeoutNanoseconds)
    }

    private static func cacheURL() -> URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("proper-nouns-v1.json")
    }

    private static func readCache() -> Set<String>? {
        guard let url = cacheURL(),
              let data = try? Data(contentsOf: url),
              let parsed = try? JSONDecoder().decode(Payload.self, from: data)
        else { return nil }
        let set = Set(parsed.names.map { $0.lowercased() }.filter { $0.count >= 2 })
        return set.isEmpty ? nil : set
    }

    private static func fetchAndStore(timeoutInterval: TimeInterval) async {
        var request = URLRequest(url: url)
        request.timeoutInterval = timeoutInterval
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode)
            else { return }
            let parsed = try JSONDecoder().decode(Payload.self, from: data)
            let set = Set(parsed.names.map { $0.lowercased() }.filter { $0.count >= 2 })
            guard !set.isEmpty else { return }
            if let url = cacheURL() {
                try? data.write(to: url, options: .atomic)
            }
            await MainActor.run {
                names = set
                NotificationCenter.default.post(name: .properNounGazetteerDidLoad, object: nil)
            }
        } catch {
            return
        }
    }
}
