# LynqDrop Web Sharing Architecture & Operational Guide

## Overview

LynqDrop provides a unified cross-platform file sharing ecosystem featuring three distinct sharing modalities:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        LYNQDROP SHARING MODES                          │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│         MODE A          │         MODE B          │       MODE C       │
│      App-to-App         │    Browser-to-Browser   │ App-to-Browser Web │
│  (Offline LAN / Wi-Fi)  │    (P2P WebRTC Data)    │   (Local HTTP)     │
├─────────────────────────┼─────────────────────────┼────────────────────┤
│ • Native Dart + Rust    │ • Zero-install Web app  │ • App hosts HTTP   │
│ • UDP / mDNS Discovery  │ • WebRTC DataChannel    │ • Browser uploads  │
│ • Up to 100+ MB/s LAN   │ • STUN + P2P Streaming  │ • LAN IP + PIN     │
│ • Ephemeral TLS 1.3     │ • Ephemeral 6-char room │ • QR scan on Wi-Fi │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

---

## 1. Mode A: Native Local Network Sharing (App-to-App)
- **Engine**: Native Flutter application powered by Rust core engine (`packages/core`).
- **Transport**: Direct TCP streaming with TLS 1.3 self-signed certificates and pinned fingerprint validation.
- **Discovery**: Dual-layer mDNS (multicast DNS) + UDP broadcast fallback on port 53317 (enabling discovery even across restrictive mobile tethering hotspots).
- **Line Speed**: Reaches full physical link throughput (up to 100+ MB/s over Wi-Fi 6 / 1 Gbps Ethernet).
- **Security**: Zero cloud intermediaries; traffic stays strictly on the local area network.

---

## 2. Mode B: Zero-Install Browser-to-Browser Sharing (WebRTC P2P)
- **Live URL**: `https://lynqdrop.web.app` (Permanent 301 from `https://lynqdrop-app.web.app`).
- **Target Audience**: Senders or recipients on iOS, Android, macOS, Windows, Linux, or ChromeOS who do not have the native LynqDrop application installed.
- **Protocol**:
  - `RTCPeerConnection` with STUN discovery (`stun:stun.l.google.com:19302`).
  - Binary `RTCDataChannel` with 64 KB chunk streaming and `bufferedAmountLowThreshold` flow control.
  - End-to-end encryption enforced natively by DTLS-SRTP within WebRTC.
- **Pairing Experience**:
  1. **Sender**: Selects files via drag-and-drop or file browser, clicks "Start Sharing Room".
  2. **Room Details**: System generates an ephemeral 6-digit room code (e.g., `LD-8392`), an SVG QR code, and a direct URL hash (`https://lynqdrop.web.app/#room=LD-8392`).
  3. **Recipient**: Scans the QR code with phone camera or enters the 6-digit code.
  4. **Transfer**: WebRTC DataChannel opens, files stream directly peer-to-peer, progress bar updates in real time with throughput (MB/s) and ETA, and browser triggers file downloads automatically upon completion.

---

## 3. Mode C: Local Web Portal (Native App + Web Browser)
- **Engine**: The native LynqDrop application hosts a local HTTP/HTTPS server on port 53317.
- **Pairing**: Displays a dynamic LAN URL (e.g., `http://192.168.1.42:53317`) and QR code on the desktop or mobile screen.
- **Security**: Optional 4-to-8 digit session PIN prevents unauthorized downloads on shared Wi-Fi networks.
- **Capabilities**:
  - **Browser Download**: Web client can view and download shared files individually or as a single zip archive.
  - **Browser Upload**: Web client can upload files back to the native LynqDrop device without installing the app.

---

## 4. Mobile & Desktop Browser Compatibility

| Platform | Recommended Browser | WebRTC DataChannel | Background Transfer Support |
| :--- | :--- | :---: | :---: |
| **Android** | Chrome, Firefox, Edge, Brave | ✅ Full | ✅ Yes (Screen on / active tab) |
| **iOS / iPadOS** | Safari, Chrome, Firefox | ✅ Full | ⚠️ Tab must remain foregrounded |
| **Windows** | Edge, Chrome, Firefox, Opera | ✅ Full | ✅ Full background support |
| **macOS** | Safari, Chrome, Firefox, Brave | ✅ Full | ✅ Full background support |
| **Linux** | Firefox, Chromium, Brave | ✅ Full | ✅ Full background support |
