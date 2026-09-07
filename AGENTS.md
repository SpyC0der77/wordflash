# Agent instructions

## iOS app

**Do not add reduce motion or reduce transparency settings to the iOS app.** iOS already provides these at the system level (Settings → Accessibility → Motion / Display). The app respects `@Environment(\.accessibilityReduceMotion)` for animations. Adding app-level toggles would duplicate system functionality.

## Proper-noun dwell

Extra dwell on the first instance of a proper noun is only so the reader has more time to see unusual letter patterns. Do not linger on names that are also common English words (`Will`, `May`, `Hope`). Those tokens are already familiar, so extra time does not help. Keep common English vocabulary out of the gazetteer and the local heuristic.
