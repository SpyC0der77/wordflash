import SwiftUI

private let sampleText =
    "Paste your own text below, focus on the red letter, press play, and let the words flow."

struct TextReaderScreen: View {
    @EnvironmentObject private var settings: ReaderSettingsStore
    @StateObject private var playback = PlaybackEngine()

    @State private var inputText = sampleText
    @State private var showSettings = false

    private var words: [String] {
        SpeedReaderCore.parseWords(inputText)
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                let isPhoneLandscape = UIDevice.current.userInterfaceIdiom == .phone && geometry.size.width > geometry.size.height

                Group {
                    if isPhoneLandscape {
                        ScrollView {
                            SpeedReaderPanelView(playback: playback, fillHeight: true)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                        }
                    } else {
                        ScrollView {
                            VStack(spacing: 16) {
                                SpeedReaderPanelView(playback: playback)
                                    .frame(maxWidth: 900)

                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Label("Text", systemImage: "text.quote")
                                            .font(.headline)
                                        Spacer()
                                        Text("\(words.count) words")
                                            .font(.footnote)
                                            .foregroundStyle(.secondary)
                                    }

                                    TextEditor(text: $inputText)
                                        .font(.system(size: 18, weight: .regular, design: .default))
                                        .frame(minHeight: 220)
                                        .padding(10)
                                        .background(Color(uiColor: .secondarySystemBackground))
                                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                }
                                .padding(14)
                                .background(Color(uiColor: .systemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                                        .stroke(Color.primary.opacity(0.07), lineWidth: 1)
                                )
                            }
                            .frame(maxWidth: 900)
                            .padding(.bottom, 24)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                    }
                }
            }
            .background(settings.appBackgroundColor.ignoresSafeArea())
            .navigationTitle("WordFlash")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
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
        .onAppear {
            syncTiming()
            playback.setWords(words)
        }
        .onChange(of: inputText) { _, _ in
            playback.setWords(words, initialIndex: 0)
            playback.pause()
        }
        .onChange(of: settings.wordsPerMinute) { _, _ in syncTiming() }
        .onChange(of: settings.sentenceEndDurationMs) { _, _ in syncTiming() }
        .onChange(of: settings.speechBreakDurationMs) { _, _ in syncTiming() }
    }

    private func syncTiming() {
        playback.configureTiming(
            wordsPerMinute: settings.wordsPerMinute,
            sentenceEndDurationMs: settings.sentenceEndDurationMs,
            speechBreakDurationMs: settings.speechBreakDurationMs
        )
    }
}
