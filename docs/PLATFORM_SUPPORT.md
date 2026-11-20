# LynqDrop Platform Support & Architecture Matrix

## 1. Supported Platforms Matrix

| Target Platform | Package Format | Architecture | Discovery Support | Background Transfers |
| :--- | :--- | :--- | :--- | :--- |
| **Android** | `.apk`, `.aab` | `arm64-v8a`, `armeabi-v7a`, `x86_64` | mDNS + UDP Broadcast + Hotspot | ✅ Foreground Service + Notification |
| **Windows** | `.zip` (Portable), MSIX / EXE | `x64` | mDNS + UDP Broadcast | ✅ Full System Tray Integration |
| **macOS** | `.dmg` | `x64`, `Apple Silicon (arm64)` | mDNS + UDP Broadcast | ✅ Menu Bar App |
| **Linux** | `.AppImage`, `.tar.gz` | `x64` | mDNS + UDP Broadcast | ✅ Desktop Notification |
| **iOS** | `.ipa` (App Store / Ad-Hoc) | `arm64` | mDNS + Local Network Permission | ⚠️ Limited by iOS background limits |
| **Web** | Web PWA (`lynqdrop.web.app`) | Universal Browser | WebRTC Signaling + STUN | ⚠️ Active tab required |

---

## 2. Platform Specific Implementations

### Android (`android/`)
- **Application ID**: `com.app.lynqdrop`
- **Minimum SDK**: 21 (Android 5.0 Lollipop)
- **Target SDK**: 35 (Android 15)
- **Native Core**: `lynqdrop_core.so` compiled via NDK r26b across ARM64, ARMv7, and x86_64.
- **Permissions**:
  - `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`
  - `NEARBY_WIFI_DEVICES` (Android 13+) with `neverForLocation` assertion
  - `POST_NOTIFICATIONS` (Android 13+)
  - `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC` (Android 14+)
  - Scoped Storage support via Android Storage Access Framework (`ACTION_OPEN_DOCUMENT_TREE`).

### Windows (`windows/`)
- **Architecture**: Native C++ Win32 runner + `rust_lib_localsend_app.dll` via Cargokit.
- **Features**:
  - Windows System Tray icon with minimize-to-tray behavior.
  - Native Windows File Dialogs (`file_selector_windows`).
  - Dark mode auto-detection syncing with Windows accent colors.

### Web (`website/`)
- **Hosting**: Firebase Hosting (`https://lynqdrop.web.app`).
- **PWA Ready**: `manifest.webmanifest`, service worker caching, adaptive theme support.
- **Direct P2P**: Zero server storage of user files; WebRTC DataChannel connection.
