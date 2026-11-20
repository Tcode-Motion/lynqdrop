# LynqDrop - Google Play Store Readiness & Compliance Audit

This document details the compliance posture of **LynqDrop** (`com.app.lynqdrop`) against current Google Play developer policies and technical requirements.

---

## 1. Target SDK & Platform API Level
- **Target SDK Version**: 37 (Exceeds Google Play requirement of API 35+)
- **Compile SDK Version**: 36
- **Minimum SDK Version**: 21 (Android 5.0 Lollipop)
- **Status**: **Fully Compliant**

---

## 2. Release Artifacts & App Bundle (AAB)
- **Artifact Format**: Android App Bundle (`.aab`) with split APKs generated via Play Feature Delivery / bundletool.
- **Signing Keystore**:
  - Alias: `lynqdrop`
  - Algorithm: RSA 4096-bit
  - Validity: 10,000 days
  - Signature Schemes: v2, v3, and v4 enabled
- **Play App Signing**: Ready for Google Play App Signing enrollment.

---

## 3. Privacy & Data Safety Declarations

LynqDrop operates on a strict **Zero-Cloud, Peer-to-Peer** privacy model. All transfers occur over local Wi-Fi or ad-hoc hotspot connections.

| Data Safety Category | Collected? | Shared? | Explanation |
| :--- | :--- | :--- | :--- |
| **Location** | No | No | Not collected. Fine/Coarse location is requested only on Android 11 and lower as required by Android OS for Wi-Fi SSID discovery. |
| **Personal Info** | No | No | No accounts, emails, phone numbers, or user IDs exist in the app. |
| **Financial Info** | No | No | No purchases, payment gateways, or financial data. |
| **Health & Fitness** | No | No | Not applicable. |
| **Messages & Photos** | No | No | Transferred files stream directly device-to-device via TLS over local network. No external servers receive file content. |
| **Audio / Video** | No | No | Streaming is purely local P2P. |
| **App Activity** | No | No | No analytics SDKs (no Firebase Analytics, Mixpanel, Segment, etc.). |
| **Device or Other IDs** | No | No | Ephemeral random UUID generated locally for peer session identification; never exfiltrated. |

---

## 4. Android Permission Usage & Justifications

Every declared permission in `AndroidManifest.xml` has a concrete functional justification:

1. `INTERNET` & `ACCESS_NETWORK_STATE`:
   - *Justification*: Required to establish local TCP/UDP sockets for mDNS multicast discovery and HTTP/HTTPS file transfer. No external internet servers are accessed.
2. `ACCESS_WIFI_STATE` & `CHANGE_WIFI_MULTICAST_STATE`:
   - *Justification*: Required to listen for multicast UDP packets (mDNS) announcing peer LynqDrop instances on the subnet.
3. `NEARBY_WIFI_DEVICES` (`android:usesPermissionFlags="neverForLocation"`):
   - *Justification*: Required on Android 13+ (API 33+) to discover local Wi-Fi peers without accessing physical device location.
4. `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_DATA_SYNC`:
   - *Justification*: Required on Android 14+ (API 34+) to maintain active high-speed file transfers when the user navigates away from the application.
5. `POST_NOTIFICATIONS`:
   - *Justification*: Required on Android 13+ (API 33+) to display persistent progress notifications and allow transfer cancellation from the notification shade.
6. `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`:
   - *Justification*: Granular Android 13+ media permissions used strictly when selecting files to send.
7. `VIBRATE`:
   - *Justification*: Haptic feedback upon transfer completion or peer connection request.

---

## 5. Security & Network Security Config
- **Cleartext Traffic**: Disabled by default (`android:usesCleartextTraffic="false"`).
- **TLS/HTTPS**: All device-to-device transfers and browser sharing sessions utilize TLS encryption with peer certificate verification or secure ephemeral PIN tokens.
- **Local Web Server**: Binds to local network interfaces only; unauthenticated requests outside local subnet are rejected.
