//
//  WordFlashApp.swift
//  WordFlash
//
//  Created by Carter Stach on 3/8/26.
//

import SwiftUI

@main
struct WordFlashApp: App {
    @StateObject private var settings = ReaderSettingsStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(settings)
                .preferredColorScheme(settings.preferredColorScheme)
        }
    }
}
