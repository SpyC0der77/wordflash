import SwiftUI
import UIKit

private enum CompactSection: String, CaseIterable, Identifiable {
    case reader
    case article

    var id: String { rawValue }

    var title: String {
        switch self {
        case .reader: return "Speed Reader"
        case .article: return "Article"
        }
    }
}

struct ArticleReaderScreen: View {
    @EnvironmentObject private var settings: ReaderSettingsStore
    @Environment(\.accessibilityReduceMotion) private var accessibilityReduceMotion
    @StateObject private var playback = PlaybackEngine()

    @State private var urlText = ""
    @State private var article: ExtractedArticle?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var compactSection: CompactSection = .reader
    @State private var showSettings = false
    @State private var previousArticles = ReadingPersistence.loadPreviousArticles()
    @State private var loadTask: Task<Void, Never>?

    private let extractor = ArticleExtractor()

    private var totalReadingLabel: String {
        let total = playback.totalReadingTimeMs()
        guard total > 0 else { return "" }
        return "\(SpeedReaderCore.readingTimeLabel(ms: total)) read"
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                let isPhoneLandscape = UIDevice.current.userInterfaceIdiom == .phone && geometry.size.width > geometry.size.height

                if isPhoneLandscape, article != nil {
                    ScrollView {
                        SpeedReaderPanelView(playback: playback, fillHeight: true)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                    }
                } else {
                    VStack(spacing: 14) {
                        urlBar

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.subheadline)
                                .foregroundStyle(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        if isLoading {
                            ProgressView("Extracting article...")
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
                        } else if article != nil {
                            articleLayout
                        } else {
                            ContentUnavailableView(
                                "No article loaded",
                                systemImage: "doc.text.magnifyingglass",
                                description: Text("Paste an article URL above and tap Read.")
                            )
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }
            }
            .background(settings.appBackgroundColor.ignoresSafeArea())
            .navigationTitle("Article Reader")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if previousArticles.isEmpty {
                            Text("No recent articles")
                        } else {
                            ForEach(previousArticles) { entry in
                                Button(entry.title) {
                                    urlText = entry.url
                                    loadArticle(from: entry.url)
                                }
                            }
                        }
                    } label: {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                    .accessibilityLabel("Previously loaded articles")
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Open reader settings")
                }
            }
            .sheet(isPresented: $showSettings) {
                ReaderSettingsSheet()
                    .environmentObject(settings)
                    .presentationDetents([.medium, .large])
            }
        }
        .onChange(of: playback.wordIndex) { _, newValue in
            guard let article else { return }
            ReadingPersistence.saveReadingPosition(for: article.sourceURL, wordIndex: newValue)
        }
        .onAppear {
            syncTiming()
        }
        .onChange(of: settings.wordsPerMinute) { _, _ in syncTiming() }
        .onChange(of: settings.sentenceEndDurationMs) { _, _ in syncTiming() }
        .onChange(of: settings.speechBreakDurationMs) { _, _ in syncTiming() }
        .onDisappear {
            loadTask?.cancel()
        }
    }

    private var urlBar: some View {
        HStack(spacing: 10) {
            TextField("Enter article URL...", text: $urlText)
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)

            Button {
                loadArticle(from: nil)
            } label: {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                } else {
                    Text("Read")
                        .fontWeight(.semibold)
                }
            }
            .buttonStyle(.bordered)
            .disabled(isLoading || urlText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    @ViewBuilder
    private var articleLayout: some View {
        GeometryReader { geometry in
            let isWide = geometry.size.width >= 950
            if isWide {
                HStack(alignment: .top, spacing: 16) {
                    articleContent
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                    Divider()

                    SpeedReaderPanelView(playback: playback, fillHeight: true)
                        .frame(width: min(420, geometry.size.width * 0.4))
                }
            } else {
                VStack(spacing: 12) {
                    Picker("View", selection: $compactSection) {
                        ForEach(CompactSection.allCases) { section in
                            Text(section.title).tag(section)
                        }
                    }
                    .pickerStyle(.segmented)

                    if compactSection == .reader {
                        SpeedReaderPanelView(playback: playback, fillHeight: true)
                            .frame(maxHeight: .infinity)
                    } else {
                        articleContent
                            .frame(maxHeight: .infinity)
                    }
                }
            }
        }
    }

    private var articleContent: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let article {
                        let metadata = [article.siteName, article.byline, totalReadingLabel]
                            .compactMap { $0?.isEmpty == false ? $0 : nil }
                            .joined(separator: " · ")

                        if !metadata.isEmpty {
                            Label(metadata, systemImage: "doc.text")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }

                        Text(article.title)
                            .font(.system(size: 30, weight: .bold, design: .serif))
                            .fixedSize(horizontal: false, vertical: true)

                        if let excerpt = article.excerpt, !excerpt.isEmpty {
                            Text(excerpt)
                                .font(.body)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        HStack(spacing: 10) {
                            if let sourceURL = URL(string: article.sourceURL) {
                                ShareLink(item: sourceURL) {
                                    Label("Share", systemImage: "square.and.arrow.up")
                                        .font(.subheadline)
                                }
                            }

                            Button {
                                UIPasteboard.general.string = article.sourceURL
                            } label: {
                                Label("Copy Link", systemImage: "link")
                                    .font(.subheadline)
                            }
                        }
                        .buttonStyle(.bordered)

                        Divider()

                        GeometryReader { geo in
                            WordFlowLayout(horizontalSpacing: 0, verticalSpacing: 6) {
                                ForEach(Array(playback.words.enumerated()), id: \.offset) { index, word in
                                    Text("\(word) ")
                                        .font(settings.font(size: 20))
                                        .foregroundStyle(settings.articleTextColor)
                                        .padding(.horizontal, 2)
                                        .padding(.vertical, 1)
                                        .background(
                                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                                .fill(
                                                    index == playback.wordIndex
                                                        ? settings.focalColor.color.opacity(0.24)
                                                        : Color.clear
                                                )
                                        )
                                        .id(index)
                                        .onTapGesture {
                                            playback.setWordIndex(index, pausePlayback: true)
                                            if geometryIsCompact(geo.size.width) {
                                                compactSection = .reader
                                            }
                                        }
                                }
                            }
                            .frame(width: geo.size.width, alignment: .leading)
                        }
                        .frame(minHeight: 40)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .onChange(of: playback.wordIndex) { _, newValue in
                withAnimation(accessibilityReduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    proxy.scrollTo(newValue, anchor: .center)
                }
            }
        }
    }

    private func loadArticle(from explicitURL: String?) {
        let candidate = (explicitURL ?? urlText).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !candidate.isEmpty else { return }

        loadTask?.cancel()
        isLoading = true
        errorMessage = nil
        article = nil
        playback.pause()
        playback.setWords([])

        loadTask = Task {
            do {
                let extracted = try await extractor.extract(urlString: candidate)
                let parsedWords = SpeedReaderCore.parseWords(extracted.textContent)
                let restoredWordIndex = ReadingPersistence.loadReadingPosition(for: extracted.sourceURL) ?? 0

                await MainActor.run {
                    article = extracted
                    urlText = extracted.sourceURL
                    playback.setWords(parsedWords, initialIndex: restoredWordIndex)
                    compactSection = .reader
                    ReadingPersistence.savePreviousArticle(
                        url: extracted.sourceURL,
                        title: extracted.title.isEmpty ? (URL(string: extracted.sourceURL)?.host ?? extracted.sourceURL) : extracted.title
                    )
                    previousArticles = ReadingPersistence.loadPreviousArticles()
                    isLoading = false
                }
            } catch is CancellationError {
                await MainActor.run {
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = (error as? LocalizedError)?.errorDescription ?? "Something went wrong."
                    isLoading = false
                }
            }
        }
    }

    private func geometryIsCompact(_ width: CGFloat) -> Bool {
        width < 950
    }

    private func syncTiming() {
        playback.configureTiming(
            wordsPerMinute: settings.wordsPerMinute,
            sentenceEndDurationMs: settings.sentenceEndDurationMs,
            speechBreakDurationMs: settings.speechBreakDurationMs
        )
    }
}
