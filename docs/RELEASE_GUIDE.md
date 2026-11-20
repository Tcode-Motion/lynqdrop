# LynqDrop Release Guide

## 1. Automated GitHub Actions Release Workflow

LynqDrop employs a secure, multi-repository build and release pipeline:

```text
┌─────────────────────────────────┐
│  lynqdrop-source (PRIVATE)      │
│  - Full proprietary source code │
│  - CI/CD build matrix           │
│  - Keystore & build secrets     │
└────────────────┬────────────────┘
                 │ Builds APK & ZIP artifacts
                 ▼
┌─────────────────────────────────┐
│  lynqdrop (PUBLIC)              │
│  - Public Release Downloads     │
│  - Clean Documentation & README │
│  - Firebase Website             │
│  - ZERO private source code     │
└─────────────────────────────────┘
```

---

## 2. Triggering a Release

A release build is automatically initiated when:
1. Pushing to branch `main` in `Tcode-Motion/lynqdrop-source`.
2. Pushing a version tag matching `v*` (e.g., `git tag v1.0.0 && git push origin v1.0.0`).
3. Manually triggering the workflow via GitHub Actions `workflow_dispatch`.

---

## 3. Local Release Build Commands

### Android APK (Release)
```powershell
# From workspace root
flutter pub get

# Build APK
cd app
flutter build apk --release --android-skip-build-dependency-validation
# Output: app/build/app/outputs/flutter-apk/app-release.apk
```

### Android App Bundle (Google Play Release)
```powershell
cd app
flutter build appbundle --release --android-skip-build-dependency-validation
# Output: app/build/app/outputs/bundle/release/app-release.aab
```

### Windows Desktop (Release)
```powershell
# Enable windows desktop
flutter config --enable-windows-desktop

# Build Windows x64 Release
cd app
flutter build windows --release
# Output: app/build/windows/x64/runner/Release/
```

---

## 4. Web Deployment (Firebase Hosting)
```powershell
# Deploy public website
firebase deploy --only hosting --project lynqdrop-app
```
