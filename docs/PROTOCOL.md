# LynqDrop Transfer & Discovery Protocol Specification

## 1. Overview
The LynqDrop protocol provides secure, high-throughput, local-network file and message transfer between heterogeneous devices.

## 2. Discovery Layer

LynqDrop implements a multi-channel discovery strategy:

### Channel A: UDP Multicast Discovery
- **Multicast Group**: `224.0.0.167`
- **Port**: `53317`
- **Beacon Format**: JSON payload containing `alias`, `deviceModel`, `deviceType`, `fingerprint`, `port`, `protocolVersion`.

### Channel B: Wi-Fi Hotspot Broadcast Fallback
- **Address**: `255.255.255.255`
- **Port**: `47475`
- **Purpose**: Circumvents Android OS bug dropping multicast packets when hosting a mobile Wi-Fi hotspot.

### Channel C: Offline QR Ticket Pairing
- **Format**: `lynqdrop://pair?ip=<IP>&port=<PORT>&fp=<FINGERPRINT>&token=<TOKEN>`
- **Purpose**: Enables immediate pairing without discovery delays or across complex subnet configurations.

## 3. Data Transfer Layer

- **Transport**: HTTPS over TLS 1.3
- **Certificates**: Dynamically generated self-signed X.509 certificates with SHA-256 fingerprints.
- **Payload Streaming**: HTTP/1.1 chunked transfer or HTTP/2 stream with byte-range resume support.
- **File Integrity**: Verified via streaming SHA-256 / Blake3 hashing.
