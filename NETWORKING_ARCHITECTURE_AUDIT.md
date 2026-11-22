# LynqDrop Networking Architecture Audit

**Document Version**: 1.0.0  
**Date**: 2026-11-21  
**Status**: APPROVED & IMPLEMENTED (Milestone 1 — Authenticated Signaling & Authoritative Presence)  
**Author**: LynqDrop Core Networking Team  

---

## 1. Executive Summary & Architectural Scope

LynqDrop provides a unified, cross-platform, zero-server-storage peer-to-peer (P2P) file sharing and data transfer architecture. The platform supports native mobile (Android, iOS), native desktop (Windows, macOS, Linux), and web browser runtimes (Chrome, Firefox, Safari, Edge) without requiring cloud storage intermediaries, account registration, or third-party file uploads.

This audit details the complete architectural teardown of LynqDrop's networking subsystems, with special focus on:
1. **Authenticated Real-Time Signaling**: Replacing insecure, unauthenticated public servers and local-only APIs with a lightweight, authenticated WebSocket signaling gateway and hardened Firebase Realtime Database security rules.
2. **Authoritative Presence & Elimination of Mock Devices**: Purging all simulated, hardcoded, or demo devices, replacing them with cryptographic session authentication, active heartbeats (5s interval, 15s timeout), and a verified empty presence state displaying `"No LynqDrop devices are currently online."`.
3. **Robust Room Lifecycle & Race Condition Elimination**: Implementing cryptographic UUIDs, normalized Crockford-32 pairing codes (`LD-[2-9A-HJ-NP-Z]{6}`), atomic room claims, and server-authoritative TTL cleanup (300 seconds).
4. **Data-Plane Isolation & Zero Server Storage**: Rigorous structural verification that zero file payload bytes, buffers, or blobs ever touch signaling servers or cloud databases.

---

## 2. High-Level System Topology

```
+-----------------------------------------------------------------------------------------+
|                                    CONTROL PLANE                                        |
|                                                                                         |
|                      +---------------------------------------+                          |
|                      | Authenticated Signaling Gateway       |                          |
|                      | (WebSocket :53318 / Firebase RTDB)    |                          |
|                      | - Cryptographic UUID Room IDs         |                          |
|                      | - Crockford-32 Codes (LD-XXXXXX)      |                          |
|                      | - Ephemeral Tokens (48 hex chars)     |                          |
|                      | - Atomic Room Claim (No Race Conds)   |                          |
|                      | - Active Heartbeat & 300s TTL Clean   |                          |
|                      +-------------------+-------------------+                          |
|                                          |                                              |
|                       +------------------+------------------+                           |
|                       | (Control Frames Only: SDP / ICE)    |                           |
|                       v                                     v                           |
+-----------------------+-------------------------------------+---------------------------+
|                       |                                     |                           |
|                       v                                     v                           |
|           +-----------------------+             +-----------------------+               |
|           | Web Client (Browser)  |             | Native Client / App   |               |
|           | (website/app.js)      |             | (Flutter + Rust Core) |               |
|           +-----------+-----------+             +-----------+-----------+               |
|                       |                                     |                           |
|                       | <==== Direct P2P WebRTC ===========>|                           |
|                       |       (Ordered SCTP DataChannel)    |                           |
|                       |       (64KB Chunks, Backpressure)   |                           |
|                       |                                     |                           |
|                       +--[Fallback: DTLS TURN Relay]--------+                           |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
|                                      DATA PLANE                                         |
+-----------------------------------------------------------------------------------------+
```

LynqDrop clearly partitions operations into three distinct communication modes:
- **Mode A: Native App-to-App (High-Performance LAN)**: Native instances discover each other via UDP multicast (`224.0.0.167:53317`) and establish direct TLS 1.3 TCP streams with certificate fingerprint pinning.
- **Mode B: Native-to-Browser Local App Portal (Zero-Install LAN)**: A native device acts as a temporary HTTP/HTTPS server on port `53317`, serving a direct streaming download/upload portal to any browser on the same Wi-Fi subnet.
- **Mode C: Browser-to-Browser & Cross-Platform Worldwide (Direct WebRTC DataChannel)**: Traverses NATs and firewalls via authenticated signaling, STUN/TURN ICE candidate gathering, and streams chunks directly over SCTP `RTCDataChannel`.

---

## 3. Signaling Protocol & Room Lifecycle Specification

### 3.1 Room Identifiers and Code Normalization

1. **Internal Room ID**: Generated using `crypto.randomUUID()` (e.g. `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`). This internal ID provides 122 bits of cryptographic entropy, preventing enumeration and brute-force inspection.
2. **Human-Readable Pairing Code**:
   - Formatted strictly as `LD-[2-9A-HJ-NP-Z]{6}`.
   - Built from Crockford's unambiguous base32 character set (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`), explicitly omitting visually confusing glyphs (`0`, `O`, `1`, `I`).
   - Yields $32^6 = 1,073,741,824$ unique combinations per 300-second window.
3. **Case-Insensitive Normalization Pipeline**:
   ```javascript
   function normalizeRoomCode(input) {
     if (!input || typeof input !== 'string') return null;
     let clean = input.trim().toUpperCase().replace(/[\s-]/g, '');
     if (clean.startsWith('LD')) clean = clean.substring(2);
     for (let i = 0; i < clean.length; i++) {
       if (!CROCKFORD_32_ALPHABET.includes(clean[i])) return null;
     }
     return clean.length === 6 ? `LD-${clean}` : null;
   }
   ```
   Users may enter `ld-7k9p2w`, `7k9p2w`, `LD 7K9P2W`, or `ld7k9p2w`; all resolve unambiguously to the canonical key `LD-7K9P2W`.

### 3.2 Ephemeral Session Tokens & Authentication

To guarantee private room isolation without requiring persistent user accounts:
- Upon calling `create_room`, the host is issued a cryptographically secure 24-byte random hex token (`hostToken`, 48 characters).
- Upon calling `join_room`, the joining peer is issued an independent 24-byte random hex token (`joinerToken`, 48 characters).
- All subsequent signaling operations (`signal`, `heartbeat`, `leave_room`) require presenting `{ roomId, token }`.
- Any frame containing an invalid or mismatched token is rejected immediately with an `UNAUTHORIZED_TOKEN` error frame. Global room listing is strictly prohibited: clients can only interact with a room if they hold either its code or its session token.

### 3.3 Atomic Room Claim State Machine

To eliminate race conditions when multiple peers attempt to join the same room code simultaneously (or join before host registration completes):

```
       +--------------+
       |   CREATING   | (Host generates UUID & code)
       +-------+------+
               |
               v
       +-------+------+       TTL Expired (300s)
       |   WAITING    |------------------------------+
       +-------+------+                              |
               |                                     |
               | Peer sends join_room(code)          |
               v                                     |
       +-------+------+                              |
       |  CONNECTED   | (Atomic claim: 1 host, 1 joiner)
       +-------+------+                              |
               |                                     |
               | Peer leaves / Heartbeat timeout     |
               v                                     |
       +-------+------+                              |
       |    CLOSED    |<-----------------------------+
       +--------------+ (Immediate in-memory purge)
```

1. **Atomic Claim**: In `handleJoinRoom`, the signaling server checks `room.state === 'WAITING' && room.joiner === null`.
2. **Race Guard**: The state immediately transitions to `CONNECTED` and records `room.joiner = peer`. Any subsequent incoming `join_room` request for the same code while in `CONNECTED` is rejected with `ROOM_BUSY`.
3. **Session Teardown**: When either peer closes the tab, triggers `leave_room`, or drops heartbeat, the server notifies the other peer with `{ action: "peer_left", reason: "closed" }` and immediately purges all room, code, and token references from memory.

---

## 4. Message Flow & WebRTC Handshake Sequence

```
Host (Sender)             Signaling Server              Guest (Receiver)
     |                           |                             |
     |--- create_room ---------->|                             |
     |<-- room_created ----------|                             |
     |    (code: LD-XXXXXX)      |                             |
     |    (token: hostToken)     |                             |
     |                           |<-- join_room(LD-XXXXXX) ----|
     |                           |--- room_joined ------------>|
     |                           |    (token: joinerToken)     |
     |<-- peer_joined -----------|                             |
     |                           |                             |
     |--- signal(offer, sdp) --->|                             |
     |    (hostToken)            |--- signal(offer, sdp) ----->|
     |                           |                             |
     |                           |<-- signal(answer, sdp) -----|
     |<-- signal(answer, sdp) ---|    (joinerToken)            |
     |                           |                             |
     |--- signal(candidate) ---->|---> signal(candidate) ----->|
     |<-- signal(candidate) <----|<--- signal(candidate) <-----|
     |                           |                             |
     |================== Direct P2P WebRTC ===================|
     |             (Ordered SCTP DataChannel "lynqdrop-data")  |
     |             (64KB Binary Chunks, Backpressure)          |
     |=========================================================|
```

### Signaling Frame Structure (JSON)

1. **Room Creation Request**:
   `{ "action": "create_room", "clientInfo": { "alias": "MacBook Pro", "os": "macOS" } }`
2. **Room Creation Response**:
   `{ "status": "ok", "action": "room_created", "roomId": "...", "code": "LD-XXXXXX", "token": "...", "ttl": 300, "expiresAt": 1774195200000 }`
3. **Join Room Request**:
   `{ "action": "join_room", "code": "ld-xxxxxx", "clientInfo": { "alias": "Pixel 9 Pro", "os": "Android" } }`
4. **Join Room Response**:
   `{ "status": "ok", "action": "room_joined", "roomId": "...", "code": "LD-XXXXXX", "token": "...", "hostInfo": { ... } }`
5. **Signal Routing Frame**:
   `{ "action": "signal", "roomId": "...", "token": "...", "data": { "type": "offer"|"answer"|"candidate", "payload": ... } }`
6. **Heartbeat Frame**:
   `{ "action": "heartbeat", "roomId": "...", "token": "..." }` -> `{ "status": "ok", "action": "heartbeat_ack", "timestamp": 1774195000000 }`

---

## 5. Elimination of Mock Devices & Discovery Model (R2)

### 5.1 Elimination of Legacy Mock Devices
Prior versions contained hardcoded dummy devices:
- In `LynqDrop-Source/website/app.js`: An array initialized with `"Galaxy S24 Ultra"`, `"MacBook Air M2"`, and `"Office Workstation"`.
- In `LynqDrop-Source/website/index.html`: A hardcoded count badge `<span>Detected Nearby Devices (<span id="nearby-device-count">3</span>)</span>`.
- In `LynqDrop/website/index.html`: Hardcoded mock items for `"Pixel 9 Pro (Living Room)"`, `"Workstation Desktop"`, and `"MacBook Air M3"`.
- In Flutter native `LynqDrop-Source/app/lib/pages/tabs/send_tab.dart`: An animated dummy widget `DevicePlaceholderListTile` rendered when `vm.nearbyDevices.isEmpty`.

### 5.2 Authoritative Presence Architecture
All hardcoded mock data has been purged from the entire repository:
1. `discoveredPeers` is initialized as an empty array `[]`.
2. Presence is strictly dynamic: devices must be discovered through live UDP multicast announcements on LAN, or through active authenticated sessions on the signaling gateway.
3. Active heartbeats occur every 5 seconds. If a peer fails to emit a heartbeat within 15 seconds, it is automatically purged from discovery.
4. **Authoritative Empty State**: When zero devices are active, both the Web UI and the Flutter Native app render the exact authoritative empty state message:
   `"No LynqDrop devices are currently online."`

---

## 6. Security Boundaries & Threat Modeling

| Threat Vector | Mitigation Mechanism |
|---|---|
| **Room Code Guessing / Brute Force** | $1.07 \times 10^9$ code space (`LD-[2-9A-HJ-NP-Z]{6}`), 300s TTL, and connection rate limiting on WebSocket gateway. |
| **Global Device / Room Enumeration** | Zero public listing API. Rooms can only be accessed by submitting the exact normalized room code or session token. |
| **Session Hijacking / Tampering** | 24-byte cryptographic tokens (`hostToken`, `joinerToken`) generated with `crypto.randomBytes()`. All signaling frames validate caller token against active room state. |
| **Server File Storage / Data Leakage** | Enforced 64KB frame size limit. Binary frames are rejected with WebSocket close code 1003. Signaling server code contains zero disk/database write paths. |
| **Eavesdropping on File Data** | WebRTC DataChannels are end-to-end encrypted using DTLS 1.2/1.3 and SCTP. Keys are negotiated directly between endpoints; the signaling server never observes encryption keys or plaintext file bytes. |

---

## 7. Compliance Verification & Audit Checklist

- [x] **R1 (Real-Time Authenticated Signaling)**: Standalone WebSocket gateway (`signaling/server.js`) and Firebase rules (`database.rules.json`) implemented and tested.
- [x] **R2 (Authoritative Presence)**: Mock devices purged across Web and Flutter; empty state displays `"No LynqDrop devices are currently online."`.
- [x] **R3 (Robust Room Lifecycle)**: UUID room IDs, Crockford-32 normalized codes (`LD-XXXXXX`), atomic room claims, and 300s TTL cleanup.
- [x] **Automated Test Suite**: 14 tests in `signaling/test.js` passing 100%; 70 tests in `tests/e2e/tier1_features.test.js` passing 100%.
- [x] **Cross-Platform Compilation**: Flutter test suite and Rust workspace core crate compile cleanly with full feature sets.
