# LynqDrop - Production Release Verification Checklist

This checklist must be reviewed and verified prior to distributing release builds to users or publishing to app stores.

---

## 1. Application Identity & Metadata
- [x] Application ID verified as `com.app.lynqdrop` in `build.gradle` and `AndroidManifest.xml`
- [x] Application name is consistently "LynqDrop" across all platforms
- [x] Package version configured as `1.0.0+1` (Version Name: 1.0.0, Version Code: 1)
- [x] Official LynqDrop branding (squircle LD icon, wordmark, tagline) applied across all asset directories:
  - [x] Android mipmaps (`mdpi` through `xxxhdpi`)
  - [x] Windows application icon (`app_icon.ico`)
  - [x] In-app logo widgets and header branding
  - [x] Browser sharing embedded web templates (`upload.html`, `download.html`)
  - [x] Public marketing website (`website/assets/`)

---

## 2. Security & Privacy Hardening
- [x] Keystore generated with RSA 4096-bit key (`lynqdrop-release.jks`)
- [x] Release signing configured in `android/app/build.gradle` via `key.properties`
- [x] Cleartext HTTP traffic disabled by default on Android
- [x] Zero cloud analytics, crash reporters, or tracking SDKs present
- [x] No hardcoded development secrets, temporary credentials, or auth tokens in source
- [x] Ephemeral session PIN and local TLS certificate generation verified

---

## 3. Core Engine & Automated Tests
- [x] Rust networking core test suite: 19/19 tests passing (`cargo test --workspace`)
- [x] Rust FFI layer check: 0 compilation errors (`cargo check`)
- [x] Flutter static code analysis: 0 warnings, 0 errors (`flutter analyze`)
- [x] Flutter unit and widget test suite: 98/98 tests passing (`flutter test`)
- [x] Zero-install browser sharing asset integrity verified with embedded base64 SVG logo

---

## 4. Platform Builds & Distribution
- [x] Android Release APK compiled and verified
- [ ] Android App Bundle (`.aab`) compiled for Google Play Store upload
- [ ] Windows Desktop x64 Release executable compiled
- [x] Public website deployed to Firebase Hosting (`https://lynqdrop.web.app`)
- [x] Comprehensive documentation authored (`GOOGLE_PLAY_READINESS.md`, `REAL_DEVICE_TEST_MATRIX.md`, `THIRD_PARTY_LICENSES.md`)
