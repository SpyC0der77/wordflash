import Foundation
import UIKit
#if canImport(Readability)
import Readability
#endif

struct ExtractedArticle: Hashable {
    let sourceURL: String
    let title: String
    let textContent: String
    let excerpt: String?
    let byline: String?
    let siteName: String?
}

enum ArticleExtractorError: LocalizedError {
    case invalidURL
    case unsupportedProtocol
    case forbiddenHost
    case requestFailed(statusCode: Int)
    case responseTooLarge
    case extractionFailed

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Please enter a valid URL."
        case .unsupportedProtocol:
            return "Only http:// and https:// URLs are supported."
        case .forbiddenHost:
            return "That host is blocked for safety reasons."
        case .requestFailed(let statusCode):
            return "Request failed with status code \(statusCode)."
        case .responseTooLarge:
            return "That page is too large to process."
        case .extractionFailed:
            return "Could not extract readable article content."
        }
    }
}

struct ArticleExtractor {
    private let maxHtmlBytes = 5 * 1024 * 1024

    private static let blockedHostnames: Set<String> = [
        "localhost",
        "localhost.localdomain",
        "localhost4",
        "localhost6",
        "ip6-localhost",
        "ip6-loopback",
        "0.0.0.0",
        "127.0.0.1",
        "::1",
        "::"
    ]

    func extract(urlString: String) async throws -> ExtractedArticle {
        guard let url = URL(string: urlString.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            throw ArticleExtractorError.invalidURL
        }

        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
            throw ArticleExtractorError.unsupportedProtocol
        }

        guard let host = url.host?.lowercased(), !host.isEmpty else {
            throw ArticleExtractorError.invalidURL
        }

        guard !Self.isBlockedHost(host) else {
            throw ArticleExtractorError.forbiddenHost
        }

        #if canImport(Readability)
        if let readableArticle = try? await extractWithReadability(from: url) {
            return readableArticle
        }
        #endif

        return try await extractLegacy(from: url)
    }

    #if canImport(Readability)
    private func extractWithReadability(from url: URL) async throws -> ExtractedArticle {
        let readability = Readability()
        let result = try await readability.parse(url: url)

        let title = Self.normalizedNonEmpty(
            Self.reflectedString(named: "title", in: result)
        ) ?? url.host ?? "Untitled"
        let siteName = Self.normalizedNonEmpty(
            Self.reflectedString(named: "siteName", in: result)
        ) ?? url.host
        let byline = Self.normalizedNonEmpty(
            Self.reflectedString(named: "byline", in: result)
        )
        let excerpt = Self.normalizedNonEmpty(
            Self.reflectedString(named: "excerpt", in: result)
        )

        let textFromResult = Self.normalizedNonEmpty(
            Self.reflectedString(named: "textContent", in: result)
        )
        let textFromHtml = Self.normalizedNonEmpty(
            Self.decodeHTML(Self.reflectedString(named: "content", in: result) ?? "")
        )
        guard let textContent = textFromResult ?? textFromHtml, !textContent.isEmpty else {
            throw ArticleExtractorError.extractionFailed
        }

        return ExtractedArticle(
            sourceURL: url.absoluteString,
            title: title,
            textContent: textContent,
            excerpt: excerpt ?? Self.fallbackExcerpt(from: textContent),
            byline: byline,
            siteName: siteName
        )
    }
    #endif

    private func extractLegacy(from url: URL) async throws -> ExtractedArticle {
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) WordFlash/1.0",
            forHTTPHeaderField: "User-Agent"
        )

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw ArticleExtractorError.extractionFailed
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw ArticleExtractorError.requestFailed(statusCode: httpResponse.statusCode)
        }

        guard data.count <= maxHtmlBytes else {
            throw ArticleExtractorError.responseTooLarge
        }

        guard
            let html = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .isoLatin1)
        else {
            throw ArticleExtractorError.extractionFailed
        }

        let title = Self.metaContent("og:title", in: html)
            ?? Self.tagContent("title", in: html)
            ?? url.host
            ?? "Untitled"

        let siteName = Self.metaContent("og:site_name", in: html) ?? url.host
        let byline = Self.metaContent("author", in: html)
        let description = Self.metaContent("description", in: html)
            ?? Self.metaContent("og:description", in: html)

        let articleHtml = Self.tagContent("article", in: html)
            ?? Self.tagContent("main", in: html)
            ?? Self.tagContent("body", in: html)
            ?? html

        let cleanedHtml = Self.stripBlocks(articleHtml)
        let readableText = Self.normalizeWhitespace(Self.decodeHTML(cleanedHtml))

        guard !readableText.isEmpty else {
            throw ArticleExtractorError.extractionFailed
        }

        let excerpt = description ?? Self.fallbackExcerpt(from: readableText)

        return ExtractedArticle(
            sourceURL: url.absoluteString,
            title: title,
            textContent: readableText,
            excerpt: excerpt,
            byline: byline,
            siteName: siteName
        )
    }

    private static func isBlockedHost(_ host: String) -> Bool {
        if blockedHostnames.contains(host) { return true }
        if isPrivateIPv4(host) { return true }
        if isPrivateIPv6(host) { return true }
        return false
    }

    private static func isPrivateIPv4(_ host: String) -> Bool {
        let components = host.split(separator: ".")
        guard components.count == 4 else { return false }
        let octets = components.compactMap { Int($0) }
        guard octets.count == 4 else { return false }
        guard octets.allSatisfy({ 0...255 ~= $0 }) else { return false }

        let first = octets[0]
        let second = octets[1]

        if first == 10 { return true }
        if first == 127 { return true }
        if first == 169 && second == 254 { return true }
        if first == 192 && second == 168 { return true }
        if first == 172 && (16...31).contains(second) { return true }
        return false
    }

    private static func isPrivateIPv6(_ host: String) -> Bool {
        let lowercased = host.lowercased()
        if lowercased == "::1" || lowercased == "::" || lowercased == "0:0:0:0:0:0:0:1" {
            return true
        }
        if lowercased.hasPrefix("fc") || lowercased.hasPrefix("fd") { return true }
        if lowercased.hasPrefix("fe8") || lowercased.hasPrefix("fe9")
            || lowercased.hasPrefix("fea") || lowercased.hasPrefix("feb") {
            return true
        }
        return false
    }

    private static func fallbackExcerpt(from text: String) -> String? {
        guard !text.isEmpty else { return nil }
        if text.count <= 180 { return text }
        let index = text.index(text.startIndex, offsetBy: 180)
        return String(text[text.startIndex..<index]).trimmingCharacters(in: .whitespacesAndNewlines) + "..."
    }

    private static func tagContent(_ tag: String, in html: String) -> String? {
        let pattern = "<\(tag)\\b[^>]*>([\\s\\S]*?)</\(tag)>"
        return firstRegexCapture(pattern: pattern, in: html).map {
            normalizeWhitespace(decodeHTML($0))
        }
    }

    private static func metaContent(_ nameOrProperty: String, in html: String) -> String? {
        let escaped = NSRegularExpression.escapedPattern(for: nameOrProperty)
        let patterns = [
            #"<meta\s+[^>]*(?:name|property)\s*=\s*["']\#(escaped)["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>"#,
            #"<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:name|property)\s*=\s*["']\#(escaped)["'][^>]*>"#
        ]
        for pattern in patterns {
            if let value = firstRegexCapture(pattern: pattern, in: html) {
                return normalizeWhitespace(decodeHTML(value))
            }
        }
        return nil
    }

    private static func stripBlocks(_ html: String) -> String {
        var cleaned = html
        let blockTags = ["script", "style", "noscript", "svg", "nav", "aside", "footer", "header"]
        for tag in blockTags {
            let pattern = "<\(tag)\\b[^>]*>[\\s\\S]*?</\(tag)>"
            cleaned = cleaned.replacingOccurrences(
                of: pattern,
                with: " ",
                options: .regularExpression
            )
        }
        cleaned = cleaned.replacingOccurrences(of: "<[^>]+>", with: " ", options: .regularExpression)
        return cleaned
    }

    private static func decodeHTML(_ html: String) -> String {
        guard let data = html.data(using: .utf8) else { return html }
        let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [
            .documentType: NSAttributedString.DocumentType.html,
            .characterEncoding: String.Encoding.utf8.rawValue
        ]

        if let attributed = try? NSAttributedString(
            data: data,
            options: options,
            documentAttributes: nil
        ) {
            return attributed.string
        }
        return html
    }

    private static func normalizeWhitespace(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizedNonEmpty(_ text: String?) -> String? {
        guard let text else { return nil }
        let normalized = normalizeWhitespace(text)
        return normalized.isEmpty ? nil : normalized
    }

    private static func reflectedString(named key: String, in value: Any) -> String? {
        let mirror = Mirror(reflecting: value)
        guard let child = mirror.children.first(where: { $0.label == key }) else {
            return nil
        }

        if let stringValue = child.value as? String {
            return stringValue
        }

        let nested = Mirror(reflecting: child.value)
        if nested.displayStyle == .optional, let wrapped = nested.children.first?.value as? String {
            return wrapped
        }

        return nil
    }

    private static func firstRegexCapture(pattern: String, in text: String) -> String? {
        guard let regex = try? NSRegularExpression(
            pattern: pattern,
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) else {
            return nil
        }

        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, options: [], range: range) else {
            return nil
        }

        guard match.numberOfRanges > 1, let capturedRange = Range(match.range(at: 1), in: text) else {
            return nil
        }
        return String(text[capturedRange])
    }
}
