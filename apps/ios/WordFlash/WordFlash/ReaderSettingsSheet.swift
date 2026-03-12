import SwiftUI

struct ReaderSettingsSheet: View {
    @EnvironmentObject private var settings: ReaderSettingsStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Picker("Theme", selection: $settings.theme) {
                        ForEach(ThemeOption.allCases) { theme in
                            Text(theme.label).tag(theme)
                        }
                    }

                    Picker("Font Size", selection: $settings.fontSize) {
                        ForEach(FontSizeOption.allCases) { size in
                            Text(size.label).tag(size)
                        }
                    }

                    Picker("Font Family", selection: $settings.fontFamily) {
                        ForEach(FontFamilyOption.allCases) { family in
                            Text(family.label).tag(family)
                        }
                    }

                    Picker("Focal Color", selection: $settings.focalColor) {
                        ForEach(FocalColorOption.allCases) { color in
                            HStack(spacing: 8) {
                                Circle()
                                    .fill(color.color)
                                    .frame(width: 10, height: 10)
                                Text(color.label)
                            }
                            .tag(color)
                        }
                    }
                }

                Section("Timing") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Sentence End Duration (\(settings.sentenceEndDurationMs)ms)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Slider(
                            value: Binding(
                                get: { Double(settings.sentenceEndDurationMs) },
                                set: { settings.sentenceEndDurationMs = Int($0.rounded()) }
                            ),
                            in: 0...1000,
                            step: 50
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Speech Break Duration (\(settings.speechBreakDurationMs)ms)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        Slider(
                            value: Binding(
                                get: { Double(settings.speechBreakDurationMs) },
                                set: { settings.speechBreakDurationMs = Int($0.rounded()) }
                            ),
                            in: 0...1000,
                            step: 25
                        )
                    }
                }

                Section("Keyboard Shortcuts") {
                    LabeledContent("Play/Pause", Text("Space"))
                    LabeledContent("Restart", Text("R"))
                    LabeledContent("Previous/Next word", Text("← →"))
                    LabeledContent("Jump to start/end", Text("Home / End"))
                }

                Section {
                    Button("Reset Defaults", role: .destructive) {
                        settings.resetDefaults()
                    }
                }
            }
            .navigationTitle("Reader Settings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
