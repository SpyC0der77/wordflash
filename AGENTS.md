# Agent instructions

## iOS app

**Do not add reduce motion or reduce transparency settings to the iOS app.** iOS already provides these at the system level (Settings → Accessibility → Motion / Display). The app respects `@Environment(\.accessibilityReduceMotion)` for animations. Adding app-level toggles would duplicate system functionality.
