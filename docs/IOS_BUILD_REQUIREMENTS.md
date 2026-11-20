# LynqDrop iOS Build & App Store Requirements

## 1. Prerequisites
- **Operating System**: macOS Sonoma (14.0+) or macOS Sequoia (15.0+).
- **IDE**: Xcode 15.0+ or Xcode 16.0+.
- **Flutter**: Flutter SDK 3.24+ / 3.51+.
- **Rust**: Rust toolchain with iOS targets:
  ```bash
  rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
  ```
- **CocoaPods**: CocoaPods 1.14.0+ (`sudo gem install cocoapods`).

---

## 2. Capabilities & Entitlements
LynqDrop requires the following entries in `ios/Runner/Info.plist`:
- `NSLocalNetworkUsageDescription`: "LynqDrop needs access to your local network to discover nearby devices and transfer files."
- `NSBonjourServices`:
  - `_localsend._tcp`
  - `_lynqdrop._tcp`
- `NSPhotoLibraryUsageDescription`: "LynqDrop needs photo library access to select and save photos/videos."
- `LSSupportsOpeningDocumentsInPlace`: `YES`
- `UIFileSharingEnabled`: `YES`

---

## 3. Build & Archiving Commands
```bash
# 1. Resolve workspace dependencies
flutter pub get

# 2. Install CocoaPods dependencies
cd app/ios
pod install
cd ../..

# 3. Build iOS Release Archive
cd app
flutter build ipa --release
# Output: app/build/ios/archive/Runner.xcarchive
```
