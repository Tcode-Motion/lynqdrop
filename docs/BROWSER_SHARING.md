# LynqDrop Browser Sharing (No-Install Experience)

## 1. Overview
LynqDrop enables seamless file exchange with devices that do not have LynqDrop installed. By launching an embedded HTTP server on the host device, any smartphone, tablet, or PC with a standard web browser can participate in transfers.

## 2. User Flow

```text
[Host Device (LynqDrop)]
          │
          ├─► 1. Taps "Share through browser"
          ├─► 2. Selects files or folders to share
          ├─► 3. Starts sharing session (binds port 53317)
          └─► 4. Displays QR Code & URL: http://192.168.1.50:53317/web

[Recipient Device (Any Web Browser)]
          │
          ├─► 1. Scans QR Code using system camera or opens link
          ├─► 2. Browser loads LynqDrop responsive web interface
          ├─► 3. Taps "Download" (streams directly from host disk)
          └─► 4. Optional: Drags & drops files to upload back to host
```

## 3. Web Client Features
- **Responsive Layout**: Designed for mobile browsers (iOS Safari, Android Chrome) and desktop viewports.
- **Direct Streaming**: Downloads stream directly from host storage without tab memory buffering limits.
- **Two-Way Transfer**: Allows both downloading files from host and uploading files to host.
- **Session Security**: Optional PIN protection prevents unintended access on public or shared Wi-Fi.
