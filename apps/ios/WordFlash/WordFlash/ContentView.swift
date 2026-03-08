//
//  ContentView.swift
//  WordFlash
//
//  Created by Carter Stach on 3/8/26.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var settings: ReaderSettingsStore
    @State private var selectedTab = 0

    var body: some View {
        GeometryReader { geometry in
            let isPhoneLandscape = UIDevice.current.userInterfaceIdiom == .phone && geometry.size.width > geometry.size.height

            Group {
                if isPhoneLandscape {
                    if selectedTab == 0 {
                        TextReaderScreen()
                    } else {
                        ArticleReaderScreen()
                    }
                } else {
                    TabView(selection: $selectedTab) {
                        TextReaderScreen()
                            .tabItem {
                                Label("Text", systemImage: "text.alignleft")
                            }
                            .tag(0)

                        ArticleReaderScreen()
                            .tabItem {
                                Label("Article", systemImage: "doc.text.magnifyingglass")
                            }
                            .tag(1)
                    }
                }
            }
        }
        .tint(settings.focalColor.color)
    }
}
