import SwiftUI
import Combine

enum ThemeOption: String, CaseIterable, Identifiable {
    case light
    case black
    case gray
    case system

    var id: String { rawValue }

    var label: String {
        switch self {
        case .light: return "Light"
        case .black: return "Black"
        case .gray: return "Gray"
        case .system: return "System"
        }
    }
}

enum FontSizeOption: String, CaseIterable, Identifiable {
    case sm
    case md
    case lg
    case xl

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sm: return "Small"
        case .md: return "Medium"
        case .lg: return "Large"
        case .xl: return "Extra Large"
        }
    }

    var pointSize: CGFloat {
        switch self {
        case .sm: return 40
        case .md: return 52
        case .lg: return 64
        case .xl: return 76
        }
    }
}

enum FontFamilyOption: String, CaseIterable, Identifiable {
    case sans
    case serif
    case mono

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sans: return "Sans"
        case .serif: return "Serif"
        case .mono: return "Mono"
        }
    }
}

enum FocalColorOption: String, CaseIterable, Identifiable {
    case rose
    case blue
    case green
    case amber

    var id: String { rawValue }

    var label: String {
        switch self {
        case .rose: return "Rose"
        case .blue: return "Blue"
        case .green: return "Green"
        case .amber: return "Amber"
        }
    }

    var color: Color {
        switch self {
        case .rose: return Color(red: 0.95, green: 0.32, blue: 0.44)
        case .blue: return .blue
        case .green: return .green
        case .amber: return .orange
        }
    }
}

@MainActor
final class ReaderSettingsStore: ObservableObject {
    private enum Keys {
        static let theme = "speedreader-theme"
        static let fontSize = "speedreader-font-size"
        static let fontFamily = "speedreader-font-family"
        static let focalColor = "speedreader-focal-color"
        static let sentenceEndDuration = "speedreader-sentence-end-duration"
        static let speechBreakDuration = "speedreader-speech-break-duration"
        static let wordsPerMinute = "speedreader-words-per-minute"
    }

    private let defaults: UserDefaults

    @Published var theme: ThemeOption { didSet { persist() } }
    @Published var fontSize: FontSizeOption { didSet { persist() } }
    @Published var fontFamily: FontFamilyOption { didSet { persist() } }
    @Published var focalColor: FocalColorOption { didSet { persist() } }
    @Published var sentenceEndDurationMs: Int {
        didSet {
            let clamped = Self.clamp(sentenceEndDurationMs, min: 0, max: 1000)
            if clamped != sentenceEndDurationMs {
                sentenceEndDurationMs = clamped
                return
            }
            persist()
        }
    }
    @Published var speechBreakDurationMs: Int {
        didSet {
            let clamped = Self.clamp(speechBreakDurationMs, min: 0, max: 1000)
            if clamped != speechBreakDurationMs {
                speechBreakDurationMs = clamped
                return
            }
            persist()
        }
    }
    @Published var wordsPerMinute: Int {
        didSet {
            let clamped = Self.clamp(wordsPerMinute, min: 50, max: 1200)
            if clamped != wordsPerMinute {
                wordsPerMinute = clamped
                return
            }
            persist()
        }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.theme = ThemeOption(rawValue: defaults.string(forKey: Keys.theme) ?? "") ?? .black
        self.fontSize = FontSizeOption(rawValue: defaults.string(forKey: Keys.fontSize) ?? "") ?? .md
        self.fontFamily = FontFamilyOption(rawValue: defaults.string(forKey: Keys.fontFamily) ?? "") ?? .serif
        self.focalColor = FocalColorOption(rawValue: defaults.string(forKey: Keys.focalColor) ?? "") ?? .rose
        self.sentenceEndDurationMs = Self.clamp(defaults.object(forKey: Keys.sentenceEndDuration) as? Int ?? 500, min: 0, max: 1000)
        self.speechBreakDurationMs = Self.clamp(defaults.object(forKey: Keys.speechBreakDuration) as? Int ?? 250, min: 0, max: 1000)
        self.wordsPerMinute = Self.clamp(defaults.object(forKey: Keys.wordsPerMinute) as? Int ?? 300, min: 50, max: 1200)
    }

    var preferredColorScheme: ColorScheme? {
        switch theme {
        case .light: return .light
        case .black, .gray: return .dark
        case .system: return nil
        }
    }

    var appBackgroundColor: Color {
        switch theme {
        case .light: return Color(uiColor: .systemBackground)
        case .black: return Color.black
        case .gray: return Color(uiColor: .systemGray6).opacity(0.16)
        case .system: return Color(uiColor: .systemBackground)
        }
    }

    var panelBackgroundColor: Color {
        switch theme {
        case .light: return Color(uiColor: .secondarySystemBackground)
        case .black: return Color(red: 0.12, green: 0.12, blue: 0.14)
        case .gray: return Color(red: 0.18, green: 0.18, blue: 0.2)
        case .system: return Color(uiColor: .secondarySystemBackground)
        }
    }

    var articleTextColor: Color {
        switch preferredColorScheme {
        case .some(.dark): return Color.white.opacity(0.9)
        default: return Color.primary
        }
    }

    func font(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        switch fontFamily {
        case .sans:
            return .system(size: size, weight: weight, design: .default)
        case .serif:
            return .system(size: size, weight: weight, design: .serif)
        case .mono:
            return .system(size: size, weight: weight, design: .monospaced)
        }
    }

    func resetDefaults() {
        theme = .black
        fontSize = .md
        fontFamily = .serif
        focalColor = .rose
        sentenceEndDurationMs = 500
        speechBreakDurationMs = 250
        wordsPerMinute = 300
    }

    private func persist() {
        defaults.set(theme.rawValue, forKey: Keys.theme)
        defaults.set(fontSize.rawValue, forKey: Keys.fontSize)
        defaults.set(fontFamily.rawValue, forKey: Keys.fontFamily)
        defaults.set(focalColor.rawValue, forKey: Keys.focalColor)
        defaults.set(sentenceEndDurationMs, forKey: Keys.sentenceEndDuration)
        defaults.set(speechBreakDurationMs, forKey: Keys.speechBreakDuration)
        defaults.set(wordsPerMinute, forKey: Keys.wordsPerMinute)
    }

    private static func clamp(_ value: Int, min minValue: Int, max maxValue: Int) -> Int {
        Swift.max(minValue, Swift.min(maxValue, value))
    }
}
