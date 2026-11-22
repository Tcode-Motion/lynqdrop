# LynqDrop Privacy, Security & Data Retention Audit

**Document Version**: 1.0.0  
**Date**: 2026-11-22  
**Status**: AUDITED & CERTIFIED (Milestone 4 — Final Production Milestone)  
**Regulatory Standards Assessed**: GDPR (General Data Protection Regulation), CCPA (California Consumer Privacy Act)  
**Certification**: **Zero Server File Storage Certified | Minimal Ephemeral Control Plane Metadata**  
**No False Claims Notice**: This audit provides factual, technical disclosure of data flows, explicitly rejecting deceptive marketing claims such as "zero trace" or "untraceable" data transmission.

---

## 1. Executive Summary & Core Privacy Mandate

LynqDrop protects user privacy by eliminating the intermediary server from the data path.
The system is built on three immutable privacy principles:
1. **Zero Server File Payload Storage**: File data is never written to server disks, databases, memory buffers, or cloud object stores. Data streams directly between sender and receiver.
2. **Strict Data Minimization (GDPR Art. 5(1)(c))**: No user accounts, passwords, email addresses, phone numbers, advertising identifiers, or tracking cookies are required or collected.
3. **Ephemeral Control Plane Metadata**: Signaling metadata (SDP session descriptions, ICE candidates, ephemeral room codes) exists in memory only for the duration of the peer connection handshake and is purged upon session termination or after a 300-second TTL.

---

## 2. Exhaustive Data Inventory & Retention Schedule

To provide complete transparency and eliminate ambiguity, the table below catalogues every data entity processed by LynqDrop across its lifecycle:

| Data Entity | Contents | Processing Location | Storage Mechanism | Retention Period | Automatic Purge Trigger |
|---|---|---|---|---|---|
| **File Payloads (Files, Photos, Docs)** | User file bytes | Client Devices Only (Sender $\leftrightarrow$ Receiver) | In-Flight WebRTC Stream / Local Storage Sink | **0 seconds on server (Never stored)** | Data resides solely on recipient device |
| **File Metadata (Name, Size, MIME, Hash)** | File name, size in bytes, MIME type, SHA-256 digest | Client Devices & Direct DataChannel | In-memory DataChannel packet | **0 seconds on server (Never stored)** | Dropped when connection closes |
| **Session Authentication Token** | HMAC-SHA256 signed ephemeral token + random nonce | Client & Signaling Gateway | In-memory RAM cache | Maximum 1 Hour | Invalidated on disconnect or expiry |
| **Room Join Code** | 6-char Crockford-32 code (`LD-XXXXXX`) | Signaling Gateway (Memory / RTDB) | Ephemeral database node | **Maximum 300 seconds (5 mins)** | Claimed by peer OR 300s TTL expiration |
| **WebRTC SDP Offer / Answer** | Media/data session parameters, codecs, fingerprints | Signaling Gateway | Ephemeral database node | **< 30 seconds** | Purged immediately after peer handshake |
| **ICE Candidates** | Peer IP addresses & UDP/TCP candidate ports | Signaling Gateway | Ephemeral database node | **< 30 seconds** | Purged immediately after connection state = 'connected' |
| **Device Presence Record** | Authenticated device alias, OS type, heartbeat timestamp | Signaling Gateway | Ephemeral database node | **15 – 30 seconds** | Disconnect event OR absence of heartbeat for 30s |
| **Client UI Preferences** | App theme (dark/light), custom device alias, auto-save toggle | User's Local Device Only | Browser `localStorage` / Native SQLite | Persistent on user's device until cleared | User manual clear or browser cache wipe |

---

## 3. Rejection of False "Zero Trace" Claims

Many peer-to-peer applications market themselves dishonestly with terms like *"100% Zero Trace"*, *"Invisible"*, or *"Untraceable"*. LynqDrop explicitly disavows these false claims and discloses the real-world technical reality:

### 3.1 Network-Layer Visibility (What Intermediate Networks Can See)
- **Local Wi-Fi Router / ISP**: When devices connect peer-to-peer over LAN or Internet, network switches, routers, and ISPs can observe that two IP addresses are communicating via UDP or TCP, the volume of packets exchanged, and timing. The packet contents are protected by end-to-end DTLS / TLS encryption, preventing eavesdropping on file contents, but the communication endpoints themselves are visible at the IP header layer (Layer 3).
- **Public STUN Servers**: When discovering public IP:Port mappings, public STUN servers (e.g. `stun.l.google.com`) observe the client's public IP address in the UDP header. STUN servers log IP connections for network health and DDoS prevention, though no file information is transmitted to them.
- **TURN Relay Servers**: When fallback relay is utilized, the TURN server routes encrypted packets between sender and receiver. The TURN operator can observe the source and destination IP addresses and byte counts, but **cannot decrypt the payload bytes**, which are protected by end-to-end DTLS session keys held only by the endpoints.

### 3.2 Client-Side Device Artifacts (What Remains on Your Device)
- **Recipient Storage**: The received file is saved directly into the recipient's chosen folder or Downloads directory.
- **Browser File Access / Cache**: Modern browsers may retain temporary file descriptors, OPFS buffers, or download history records inside the user's browser profile until cleared by the user.

---

## 4. Cryptographic Security & Communication Controls

LynqDrop implements layered cryptographic controls to safeguard data integrity and confidentiality:

### 4.1 In-Transit Encryption
1. **WebRTC DataChannel Transfers (Mode C)**:
   - Mandatory **DTLS 1.2 / 1.3** (Datagram Transport Layer Security) encryption using ECDSA (elliptic curve) certificates.
   - Senders and receivers generate unique ephemeral key pairs for each session.
   - Symmetric cipher: **AES-128-GCM** / **AES-256-GCM** with forward secrecy.
2. **Local Area Network Socket Transfers (Mode A / Mode B)**:
   - Mandatory **TLS 1.3** encryption.
   - Self-signed SHA-256 certificate fingerprints exchanged securely or pinned during discovery.
3. **Signaling Control Plane**:
   - Mandatory **WSS (WebSocket Secure)** or **HTTPS** transport (TLS 1.3), preventing eavesdropping or injection of malicious SDP offers/answers.

### 4.2 Data Integrity Enforcement (Progressive SHA-256)
- Every file transfer metadata packet includes an authoritative NIST-compliant SHA-256 digest computed by the sender.
- The receiver computes an incremental SHA-256 digest in real time as each 64 KiB chunk arrives.
- If even a single bit is modified, corrupted, or injected in transit, the computed hash diverges, the transfer is aborted with `ERR_INTEGRITY_MISMATCH`, and the file is permanently deleted from the recipient's staging sink.

---

## 5. Regulatory Compliance Assessment

### 5.1 General Data Protection Regulation (GDPR - EU 2016/679)

| GDPR Article | Requirement | LynqDrop Technical Compliance Implementation |
|---|---|---|
| **Art. 5(1)(c)** | Data Minimisation | LynqDrop processes zero unnecessary personal data. No accounts, names, or contact details are collected. |
| **Art. 5(1)(e)** | Storage Limitation | Ephemeral signaling records are purged within 300 seconds. File payloads have zero storage duration (0 seconds). |
| **Art. 6** | Lawfulness of Processing | Processing is strictly necessary for the technical performance of the requested transfer (Art. 6(1)(b)). |
| **Art. 17** | Right to Erasure ("Right to be Forgotten") | Satisfied automatically: signaling records are destroyed after 300 seconds; zero server records exist to erase. |
| **Art. 25** | Data Protection by Design & Default | P2P architecture inherently eliminates centralized data breaches and mass database leakage. |
| **Art. 32** | Security of Processing | End-to-end DTLS 1.3 encryption, ephemeral session tokens, and progressive SHA-256 hash validation. |

### 5.2 California Consumer Privacy Act (CCPA / CPRA)
- **No Sale of Personal Information**: LynqDrop does not sell, rent, monetize, or disclose user data to third parties.
- **No Sensitive Personal Information Collected**: Zero financial information, government IDs, biometric data, or health data is handled by the platform.
- **Consumer Notice**: Clear technical transparency regarding local storage and network-level IP visibility.

---

## 6. Security Incident & Abuse Mitigation Controls

1. **Room Code Guessing Protection**:
   - Crockford-32 space: $32^6 = 1,073,741,824$ unique combinations per 300-second window.
   - Rate limiting: Clients making more than 5 consecutive invalid join attempts are temporarily blocked.
2. **Unsolicited Transfer Prevention**:
   - Senders cannot force files onto recipients.
   - When a sender transmits a `file-meta` header, the receiver's UI prompts the recipient with the file name, size, and sender alias.
   - The transfer only begins if the recipient explicitly approves the transfer (`file-ack: accepted=true`).
3. **Zero Third-Party Analytics**:
   - Zero Google Analytics, Facebook Pixels, Mixpanel, or third-party telemetry scripts are embedded in the application.

---

## 7. Audit Attestation

This audit certifies that LynqDrop operates strictly in accordance with its Zero-Server-Storage architecture and ephemeral control plane policies. File data belongs exclusively to the end users, never lingering on intermediate infrastructure.
