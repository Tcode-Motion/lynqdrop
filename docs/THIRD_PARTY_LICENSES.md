# LynqDrop - Third-Party Open Source Software Notices

LynqDrop utilizes open-source software libraries and frameworks. This document summarizes the open-source licenses governing the components included in the application.

---

## 1. Upstream Architectural References

### Wisp
- **Upstream Repository**: https://github.com/vigov5/wisp
- **License**: MIT License
- **Copyright**: (c) 2026 Samarth Verma, Nguyen Anh Tien
- **Attribution**: Permission is hereby granted under the MIT License to use, copy, modify, merge, publish, distribute, and sublicense, subject to maintaining the copyright and permission notice.

### LocalSend
- **Upstream Repository**: https://github.com/localsend/localsend
- **License**: Apache License, Version 2.0
- **Copyright**: (c) 2022-2026 Tien Do Nam and LocalSend Contributors
- **Attribution**: Licensed under the Apache License, Version 2.0; users may obtain a copy of the License at `http://www.apache.org/licenses/LICENSE-2.0`.

---

## 2. Core Flutter & Dart Packages

| Package | License | Primary Purpose |
| :--- | :--- | :--- |
| `flutter` | BSD-3-Clause | UI Framework & cross-platform engine |
| `flutter_riverpod` | MIT | State management and dependency injection |
| `routerino` | Apache-2.0 | Declarative page navigation |
| `shelf` & `shelf_router` | BSD-3-Clause | Embedded HTTP web server engine |
| `dio` | MIT | HTTP client for network transfer streaming |
| `qr_flutter` | BSD-3-Clause | QR code generation for browser & peer pairing |
| `mobile_scanner` | MIT | Camera-based QR code scanning |
| `path_provider` | BSD-3-Clause | Platform file storage and download directories |
| `permission_handler` | MIT | Runtime Android and desktop permission workflows |
| `shared_preferences` | BSD-3-Clause | Local key-value application settings storage |
| `connectivity_plus` | BSD-3-Clause | Network interface detection and Wi-Fi state |
| `network_info_plus` | BSD-3-Clause | Local IP and gateway subnet discovery |
| `window_manager` | MIT | Desktop window controls and tray behavior |

---

## 3. Core Rust Libraries (Networking Engine)

| Crate | License | Purpose |
| :--- | :--- | :--- |
| `tokio` | MIT | Asynchronous I/O and task runtime |
| `axum` | MIT | High-performance HTTP server architecture |
| `mdns-sd` | MIT / Apache-2.0 | Zero-configuration multicast DNS service discovery |
| `ring` / `rustls` | ISC / Apache-2.0 | Modern cryptographic primitives and TLS encryption |
| `serde` & `serde_json` | MIT / Apache-2.0 | Serialization and deserialization of protocol messages |
| `tracing` | MIT | Structured logging and diagnostic instrumentation |

---

## 4. Compliance Summary

- All third-party dependencies are licensed under permissive open-source licenses (MIT, Apache-2.0, BSD-3-Clause, ISC).
- No copyleft licenses (GPL/AGPL) are included in the binary distribution.
- Full copyright notices and licenses are bundled into the application's Open Source Licenses viewer within the Settings screen.
