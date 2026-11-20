# LynqDrop GitHub Actions CI/CD Architecture

## 1. Workflow Architecture (`.github/workflows/build-and-release.yml`)

The automation workflow executes on GitHub-hosted cloud runners (`ubuntu-latest` and `windows-latest`) in the private repository `Tcode-Motion/lynqdrop-source`.

```text
build-and-release.yml
├── Job: build-android (ubuntu-latest)
│   ├── Actions/checkout@v4
│   ├── Actions/setup-java@v4 (Temurin Hotspot JDK 17)
│   ├── Subosito/flutter-action@v2 (master channel, cache: true)
│   ├── Dtolnay/rust-toolchain@stable (Android targets: aarch64, armv7, x86_64)
│   ├── Rustup auto-self-update disable
│   ├── Nttld/setup-ndk@v1 (NDK r26b)
│   ├── flutter pub get (root workspace resolution)
│   ├── flutter build apk --release --android-skip-build-dependency-validation
│   └── Upload artifact: lynqdrop-v1.0.0-android.apk
│
├── Job: build-windows (windows-latest)
│   ├── Actions/checkout@v4
│   ├── Subosito/flutter-action@v2 (master channel, cache: true)
│   ├── Dtolnay/rust-toolchain@stable (x86_64-pc-windows-msvc)
│   ├── Rustup auto-self-update disable
│   ├── flutter config --enable-windows-desktop
│   ├── flutter pub get (root workspace resolution)
│   ├── flutter build windows --release
│   ├── Compress-Archive to lynqdrop-v1.0.0-windows.zip
│   └── Upload artifact: lynqdrop-v1.0.0-windows.zip
│
└── Job: publish-to-public-repo (ubuntu-latest)
    ├── Needs: [build-android, build-windows]
    ├── Download built artifacts
    ├── Authenticate via PUBLIC_REPO_TOKEN secret
    └── Publish GitHub Release on Tcode-Motion/lynqdrop (tag: v1.0.0)
```

---

## 2. Secrets & Permissions
- `PUBLIC_REPO_TOKEN`: GitHub Personal Access Token (PAT) with `repo` scope stored securely in `Tcode-Motion/lynqdrop-source` settings. Allows the private workflow to publish release assets directly to the public repository `Tcode-Motion/lynqdrop` without exposing any source code or repository access.
