# LynqDrop - Comprehensive Real-Device Test Matrix & Protocol

This document outlines the test scenarios, network conditions, hardware configurations, and edge cases verified for the **LynqDrop** file sharing engine.

---

## 1. Test Environments & Devices

| Device Type | Model / OS Version | Role | Network Interface |
| :--- | :--- | :--- | :--- |
| **Android Flagship** | Google Pixel / Android 14+ | Sender / Receiver | Wi-Fi 6 (802.11ax), 5 GHz |
| **Android Legacy** | Samsung Galaxy / Android 11 | Receiver / Hotspot Host | Wi-Fi 2.4 GHz & Hotspot AP |
| **Desktop Windows** | Windows 11 Pro (x64) | Host / Receiver | Gigabit Ethernet & Wi-Fi |
| **Mobile Browser** | Chrome Mobile / Safari iOS | Zero-Install Receiver | Cellular & Local Wi-Fi |
| **Desktop Browser** | Chrome / Edge / Firefox (x64) | Web Sharing Client | Local Subnet Wi-Fi |

---

## 2. Test Execution Matrix

### A. Local Network & Discovery Tests

| Test ID | Test Scenario | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| **NET-01** | mDNS Peer Announcement on same 5 GHz Wi-Fi subnet | Device appears in Nearby Devices list within 1.5 seconds | **PASS** |
| **NET-02** | UDP Broadcast fallback when router blocks multicast | Peer discovered via broadcast probe within 3 seconds | **PASS** |
| **NET-03** | Android Portable Hotspot (isolated subnet, no WAN) | Receiver discovers sender IP via gateway broadcast | **PASS** |
| **NET-04** | Windows Defender Firewall active (Public/Private profiles) | App prompts firewall rule; incoming TCP 53317 allowed | **PASS** |
| **NET-05** | Multiple concurrent devices on subnet (4+ peers) | Discovered peers list dynamically updates without UI lag | **PASS** |

---

### B. Device-to-Device Transfer Reliability

| Test ID | Test Scenario | File Payload | Expected Result | Result |
| :--- | :--- | :--- | :--- | :--- |
| **TRF-01** | Single Small File (Photo) | 3.5 MB JPEG | Instantaneous stream (< 200 ms), checksum match | **PASS** |
| **TRF-02** | Multi-File Batch | 120 files (Mix of PDFs & PNGs) | Sequential chunked streaming, 100% integrity | **PASS** |
| **TRF-03** | Large Video File | 4.2 GB 4K MP4 | Continuous memory-efficient stream, sustained >45 MB/s | **PASS** |
| **TRF-04** | Folder Structure Preservation | Nested folder with 30 items | Subdirectories recreated accurately on target | **PASS** |
| **TRF-05** | Duplicate Filename Collision | File with identical name | Auto-renamed with `(1)` suffix, no overwrite | **PASS** |
| **TRF-06** | Transfer Cancellation | Aborted at 50% by Sender | Receiver cleans partial `.tmp` buffer; UI updates | **PASS** |
| **TRF-07** | Network Interruption | Wi-Fi disabled mid-stream | Socket error caught gracefully; retry button available | **PASS** |

---

### C. Zero-Install Browser Sharing Tests

| Test ID | Test Scenario | Client Environment | Expected Result | Result |
| :--- | :--- | :--- | :--- | :--- |
| **WEB-01** | QR Code Scan & Connect | Mobile Safari / Chrome | Navigates to local HTTPS URL with session token | **PASS** |
| **WEB-02** | Browser File Download | Desktop Edge / Chrome | Streams file directly from LynqDrop desktop node | **PASS** |
| **WEB-03** | Browser File Upload | Mobile Browser to Desktop | Uploads file through multipart POST into receive queue | **PASS** |
| **WEB-04** | Mobile Browser Responsiveness | 375px viewport (iPhone) | Clean UI layout, touch-friendly upload dropzone | **PASS** |
| **WEB-05** | Session Termination | Host ends sharing session | Web client shows clean "Session Expired" screen | **PASS** |

---

### D. System & Lifecycle Edge Cases

| Test ID | Test Scenario | Expected Result | Result |
| :--- | :--- | :--- | :--- |
| **SYS-01** | App Backgrounding during 2 GB transfer | Foreground service keeps transfer active at full speed | **PASS** |
| **SYS-02** | Screen lock during active transfer | CPU partial wake lock prevents sleep until transfer completes | **PASS** |
| **SYS-03** | Low Storage Space Warning | Prevents transfer start if free disk space < payload size | **PASS** |
| **SYS-04** | Permission Denial (Notifications) | Core transfer still succeeds with in-app banner fallback | **PASS** |
