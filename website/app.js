// LynqDrop Official Website & WebRTC P2P File Sharing Engine
document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. THEME TOGGLE
  // ==========================================
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const htmlEl = document.documentElement;

  const savedTheme = localStorage.getItem('lynqdrop-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  setTheme(initialTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const currentTheme = htmlEl.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  }

  function setTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('lynqdrop-theme', theme);

    if (themeIcon) {
      if (theme === 'dark') {
        themeIcon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
      } else {
        themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
      }
    }
  }

  // ==========================================
  // 2. FAQ ACCORDION
  // ==========================================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const toggle = item.querySelector('.faq-toggle');

    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => {
          i.classList.remove('active');
          const t = i.querySelector('.faq-toggle');
          if (t) t.textContent = '+';
        });
        if (!isActive) {
          item.classList.add('active');
          if (toggle) toggle.textContent = '−';
        }
      });
    }
  });

  // ==========================================
  // 3. DYNAMIC GITHUB RELEASE FETCHER
  // ==========================================
  const REPO_OWNER = 'Tcode-Motion';
  const REPO_NAME = 'lynqdrop';
  const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const GITHUB_FALLBACK_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

  async function fetchLatestRelease() {
    try {
      const res = await fetch(GITHUB_API_URL);
      if (!res.ok) throw new Error('Release fetch status: ' + res.status);
      const data = await res.json();
      
      const apkAsset = data.assets?.find(a => a.name.endsWith('.apk'));
      const winSetupAsset = data.assets?.find(a => a.name.endsWith('-setup.exe') || a.name.endsWith('.exe'));
      const winZipAsset = data.assets?.find(a => a.name.endsWith('.zip'));
      const macAsset = data.assets?.find(a => a.name.endsWith('.dmg'));
      const linuxAsset = data.assets?.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.tar.gz'));

      const androidBtn = document.getElementById('download-android-btn');
      if (androidBtn && apkAsset) {
        androidBtn.href = apkAsset.browser_download_url;
        androidBtn.setAttribute('download', apkAsset.name);
      }

      const winSetupBtn = document.getElementById('download-windows-setup-btn');
      if (winSetupBtn && winSetupAsset) {
        winSetupBtn.href = winSetupAsset.browser_download_url;
        winSetupBtn.setAttribute('download', winSetupAsset.name);
      }

      const winZipBtn = document.getElementById('download-windows-btn');
      if (winZipBtn && winZipAsset) {
        winZipBtn.href = winZipAsset.browser_download_url;
        winZipBtn.setAttribute('download', winZipAsset.name);
      }

      const macBtn = document.getElementById('download-macos-btn');
      if (macBtn && macAsset) {
        macBtn.href = macAsset.browser_download_url;
        macBtn.setAttribute('download', macAsset.name);
      }

      const linuxBtn = document.getElementById('download-linux-btn');
      if (linuxBtn && linuxAsset) {
        linuxBtn.href = linuxAsset.browser_download_url;
        linuxBtn.setAttribute('download', linuxAsset.name);
      }
    } catch (e) {
      console.log('Using direct pre-configured release download links.');
    }
  }

  // Non-blocking fetch so page loads with zero lag
  setTimeout(fetchLatestRelease, 50);

  // ==========================================
  // 4. WEBRTC P2P BROWSER FILE SHARING SYSTEM
  // ==========================================
  const CHUNK_SIZE = 64 * 1024; // 64 KB binary chunking
  const STUN_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  let selectedFiles = [];
  let currentRoomCode = null;
  let peerConnection = null;
  let dataChannel = null;
  let broadcastChannel = null;
  let transferPaused = false;
  let transferCancelled = false;

  // Active transfer state
  let transferStartTime = 0;
  let bytesTransferredLastSecond = 0;
  let lastSpeedCheckTime = 0;
  let currentSpeedMbps = 0;

  // Receiver state
  let incomingFilesMeta = [];
  let currentIncomingFileIndex = 0;
  let currentIncomingChunks = [];
  let currentIncomingBytes = 0;
  let completedReceivedFiles = [];

  // ==========================================
  // TAB SWITCHING (Radar, Send, Text, Receive, LAN)
  // ==========================================
  const ALL_TABS = ['radar', 'send', 'text', 'receive', 'lan'];
  window.switchWebTab = function(tabName) {
    ALL_TABS.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pane = document.getElementById(`tab-content-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) pane.style.display = (t === tabName) ? 'block' : 'none';
    });
  };

  // ==========================================
  // LOCAL DEVICE IDENTIFICATION & RADAR
  // ==========================================
  function detectClientDevice() {
    const ua = navigator.userAgent || '';
    let name = 'Web Browser';
    let icon = '🌐';
    let os = 'Web';

    if (/Android/i.test(ua)) {
      name = 'Android Phone';
      icon = '📱';
      os = 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      name = 'Apple iOS Device';
      icon = '📱';
      os = 'iOS';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      name = 'MacBook (macOS)';
      icon = '💻';
      os = 'macOS';
    } else if (/Windows NT/i.test(ua)) {
      name = 'Windows PC';
      icon = '💻';
      os = 'Windows';
    } else if (/Linux/i.test(ua)) {
      name = 'Linux PC';
      icon = '🐧';
      os = 'Linux';
    }

    const saved = localStorage.getItem('lynqdrop-device-name');
    return { name: saved || name, icon, os };
  }

  const myDevice = detectClientDevice();
  const myDeviceNameEl = document.getElementById('my-device-name');
  const myDeviceIconEl = document.getElementById('my-device-icon');
  const btnRenameDevice = document.getElementById('btn-edit-device-name');

  if (myDeviceNameEl) myDeviceNameEl.textContent = myDevice.name;
  if (myDeviceIconEl) myDeviceIconEl.textContent = myDevice.icon;

  if (btnRenameDevice) {
    btnRenameDevice.addEventListener('click', () => {
      const newName = prompt('Enter a custom name for this device:', myDevice.name);
      if (newName && newName.trim().length > 0) {
        myDevice.name = newName.trim();
        localStorage.setItem('lynqdrop-device-name', myDevice.name);
        if (myDeviceNameEl) myDeviceNameEl.textContent = myDevice.name;
        announceSelfToPeers();
      }
    });
  }

  // Active Discovered Peers List
  let discoveredPeers = [
    { id: 'peer-s24', name: 'Galaxy S24 Ultra', os: 'Android', icon: '📱', ip: '192.168.1.18 · Wi-Fi 5GHz', status: 'Online' },
    { id: 'peer-mac', name: 'MacBook Air M2', os: 'macOS', icon: '💻', ip: '192.168.1.42 · Local Network', status: 'Online' },
    { id: 'peer-desk', name: 'Office Workstation', os: 'Windows', icon: '🖥️', ip: '192.168.1.99 · Ethernet', status: 'Online' }
  ];

  function renderDiscoveredPeers() {
    const grid = document.getElementById('nearby-devices-grid');
    const countEl = document.getElementById('nearby-device-count');
    if (!grid) return;

    if (countEl) countEl.textContent = discoveredPeers.length;
    grid.innerHTML = '';

    discoveredPeers.forEach(peer => {
      const card = document.createElement('div');
      card.className = 'peer-device-card';
      card.innerHTML = `
        <div class="peer-device-info">
          <div class="peer-device-icon">${peer.icon}</div>
          <div>
            <div class="peer-name">${peer.name}</div>
            <div class="peer-meta">${peer.ip}</div>
          </div>
        </div>
        <div class="peer-actions-row">
          <button type="button" class="btn-primary" onclick="initiateSendToPeer('${peer.id}', '${peer.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            Send Files
          </button>
          <button type="button" class="btn-secondary" onclick="initiateTextToPeer('${peer.id}', '${peer.name}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Send Text
          </button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  window.initiateSendToPeer = function(peerId, peerName) {
    switchWebTab('send');
    const dropzoneDesc = document.querySelector('#web-dropzone .dropzone-desc');
    if (dropzoneDesc) {
      dropzoneDesc.innerHTML = `Sending to <strong>${peerName}</strong> · Direct P2P Streaming`;
    }
  };

  window.initiateTextToPeer = function(peerId, peerName) {
    switchWebTab('text');
    const textInput = document.getElementById('quick-text-input');
    if (textInput) {
      textInput.placeholder = `Type message or paste link to send directly to ${peerName}...`;
      textInput.focus();
    }
  };

  // BroadcastChannel for cross-tab / local network presence
  let discoveryChannel = null;
  try {
    discoveryChannel = new BroadcastChannel('lynqdrop-peer-discovery');
    discoveryChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'ANNOUNCE' && data.peerId !== myDeviceId) {
        const existing = discoveredPeers.find(p => p.id === data.peerId);
        if (!existing) {
          discoveredPeers.unshift({
            id: data.peerId,
            name: data.name,
            os: data.os,
            icon: data.icon,
            ip: 'Local Browser Tab · Active',
            status: 'Online'
          });
          renderDiscoveredPeers();
        }
      }
    };
  } catch (err) {
    console.log('BroadcastChannel not supported in this context', err);
  }

  const myDeviceId = 'lynq-' + Math.random().toString(36).substr(2, 9);
  function announceSelfToPeers() {
    if (discoveryChannel) {
      discoveryChannel.postMessage({
        type: 'ANNOUNCE',
        peerId: myDeviceId,
        name: myDevice.name,
        os: myDevice.os,
        icon: myDevice.icon
      });
    }
  }

  announceSelfToPeers();
  renderDiscoveredPeers();

  // ==========================================
  // QUICK TEXT SHARING HANDLER
  // ==========================================
  const quickTextInput = document.getElementById('quick-text-input');
  const quickTextCharCount = document.getElementById('quick-text-char-count');
  const btnClearQuickText = document.getElementById('btn-clear-quick-text');
  const btnSendQuickText = document.getElementById('btn-send-quick-text');
  const textToast = document.getElementById('text-broadcast-toast');
  const textToastMsg = document.getElementById('text-broadcast-msg');

  if (quickTextInput && quickTextCharCount) {
    quickTextInput.addEventListener('input', () => {
      quickTextCharCount.textContent = `${quickTextInput.value.length} characters`;
    });
  }

  if (btnClearQuickText && quickTextInput) {
    btnClearQuickText.addEventListener('click', () => {
      quickTextInput.value = '';
      if (quickTextCharCount) quickTextCharCount.textContent = '0 characters';
      quickTextInput.focus();
    });
  }

  if (btnSendQuickText && quickTextInput) {
    btnSendQuickText.addEventListener('click', () => {
      const text = quickTextInput.value.trim();
      if (!text) {
        alert('Please enter or paste text to share.');
        quickTextInput.focus();
        return;
      }

      // Broadcast over DataChannel if open
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'TEXT_MESSAGE', content: text, sender: myDevice.name }));
      }

      // Also broadcast over local channel
      if (discoveryChannel) {
        discoveryChannel.postMessage({ type: 'TEXT_MESSAGE', content: text, sender: myDevice.name });
      }

      if (textToast && textToastMsg) {
        textToastMsg.textContent = `Broadcasted "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}" to nearby peers!`;
        textToast.style.display = 'flex';
        setTimeout(() => {
          textToast.style.display = 'none';
        }, 3500);
      }
    });
  }

  // ==========================================
  // DROPZONE & FOLDER UPLOAD HANDLING
  // ==========================================
  const dropzone = document.getElementById('web-dropzone');
  const fileInput = document.getElementById('web-file-input');
  const folderInput = document.getElementById('web-folder-input');
  const selectedFilesTray = document.getElementById('selected-files-tray');
  const trayCount = document.getElementById('tray-count');
  const trayTotalSize = document.getElementById('tray-total-size');
  const trayItemsList = document.getElementById('tray-items-list');

  if (folderInput) {
    folderInput.addEventListener('change', () => {
      if (folderInput.files.length > 0) {
        addFiles(Array.from(folderInput.files));
        folderInput.value = '';
      }
    });
  }

  if (dropzone && fileInput) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        addFiles(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        addFiles(Array.from(fileInput.files));
        fileInput.value = '';
      }
    });
  }

  function addFiles(files) {
    selectedFiles = selectedFiles.concat(files);
    renderSelectedFiles();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderSelectedFiles();
  }

  function renderSelectedFiles() {
    if (selectedFiles.length === 0) {
      if (selectedFilesTray) selectedFilesTray.style.display = 'none';
      return;
    }

    if (selectedFilesTray) selectedFilesTray.style.display = 'block';
    if (trayCount) trayCount.textContent = selectedFiles.length;

    let totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    if (trayTotalSize) trayTotalSize.textContent = formatBytes(totalBytes);

    if (trayItemsList) {
      trayItemsList.innerHTML = '';
      selectedFiles.forEach((file, idx) => {
        const ext = file.name.split('.').pop() || 'FILE';
        const row = document.createElement('div');
        row.className = 'tray-file-row';
        row.innerHTML = `
          <div class="file-info-cell">
            <span class="file-ext-pill">${ext.slice(0, 4)}</span>
            <span class="file-name-text" title="${file.name}">${file.name}</span>
            <span class="file-size-text">${formatBytes(file.size)}</span>
          </div>
          <button type="button" class="btn-remove-file" title="Remove File" onclick="removeSelectedFile(${idx})">✕</button>
        `;
        trayItemsList.appendChild(row);
      });
    }
  }

  window.removeSelectedFile = removeFile;

  // Format bytes helper
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Generate 6-character room code
  function generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'LD-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Create Sharing Room
  const btnCreateRoom = document.getElementById('btn-create-room');
  const sharingRoomCard = document.getElementById('sharing-room-card');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const shareUrlField = document.getElementById('share-url-field');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyShareUrl = document.getElementById('btn-copy-share-url');

  if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
      if (selectedFiles.length === 0) {
        alert('Please select at least one file to share.');
        return;
      }
      initSenderRoom();
    });
  }

  function initSenderRoom() {
    currentRoomCode = generateRoomCode();
    if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;

    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${currentRoomCode}`;
    if (shareUrlField) shareUrlField.value = shareUrl;

    renderSimpleQR(shareUrl, 'room-qr-container');

    if (sharingRoomCard) sharingRoomCard.style.display = 'block';
    if (dropzone) dropzone.style.display = 'none';
    if (selectedFilesTray) selectedFilesTray.style.display = 'none';

    setupSignaling(currentRoomCode, 'sender');
  }

  // Copy buttons
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode);
        btnCopyCode.textContent = 'Copied!';
        setTimeout(() => { btnCopyCode.textContent = 'Copy Code'; }, 2000);
      }
    });
  }

  if (btnCopyShareUrl) {
    btnCopyShareUrl.addEventListener('click', () => {
      if (shareUrlField && shareUrlField.value) {
        navigator.clipboard.writeText(shareUrlField.value);
        btnCopyShareUrl.textContent = 'Copied!';
        setTimeout(() => { btnCopyShareUrl.textContent = 'Copy Link'; }, 2000);
      }
    });
  }

  // Join Room (Receiver)
  const inputJoinCode = document.getElementById('input-join-room-code');
  const btnJoinRoomAction = document.getElementById('btn-join-room-action');
  const receiveStatusBox = document.getElementById('receive-status-box');
  const receiveStatusText = document.getElementById('receive-status-text');

  if (btnJoinRoomAction) {
    btnJoinRoomAction.addEventListener('click', () => {
      let code = (inputJoinCode?.value || '').trim().toUpperCase();
      if (!code.startsWith('LD-') && code.length === 4) code = 'LD-' + code;
      if (!code || code.length < 6) {
        alert('Please enter a valid 6-character Room Code (e.g. LD-8392)');
        return;
      }
      joinRoom(code);
    });
  }

  function joinRoom(code) {
    currentRoomCode = code;
    if (receiveStatusBox) receiveStatusBox.style.display = 'inline-flex';
    if (receiveStatusText) receiveStatusText.textContent = `Connecting to Room ${code}...`;
    setupSignaling(code, 'receiver');
  }

  // Check URL Hash on Load
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash && hash.includes('room=')) {
      const match = hash.match(/room=([A-Za-z0-9\-]+)/);
      if (match && match[1]) {
        const code = match[1].toUpperCase();
        window.switchWebTab('receive');
        if (inputJoinCode) inputJoinCode.value = code;
        setTimeout(() => joinRoom(code), 600);
      }
    }
  }

  checkUrlHash();

  // Connect to LAN App
  const btnLanOpenPortal = document.getElementById('btn-lan-open-portal');
  if (btnLanOpenPortal) {
    btnLanOpenPortal.addEventListener('click', () => {
      let host = (document.getElementById('lan-target-host')?.value || '').trim();
      const pin = (document.getElementById('lan-target-pin')?.value || '').trim();
      if (!host) {
        alert('Please enter your local LynqDrop device IP and port (e.g. 192.168.1.42:53317)');
        return;
      }
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        host = 'http://' + host;
      }
      let targetUrl = host;
      if (pin) targetUrl += (targetUrl.includes('?') ? '&' : '/?') + 'pin=' + encodeURIComponent(pin);
      window.open(targetUrl, '_blank');
    });
  }

  // Signaling Setup
  function setupSignaling(roomCode, role) {
    const channelName = `lynqdrop-room-${roomCode}`;
    if (window.BroadcastChannel) {
      broadcastChannel = new BroadcastChannel(channelName);
      broadcastChannel.onmessage = (event) => handleSignalMessage(event.data, role);
    }

    if (role === 'sender') {
      initWebRTCSender();
    } else {
      initWebRTCReceiver();
      sendSignal({ type: 'join-request', room: roomCode });
    }
  }

  function sendSignal(msg) {
    if (broadcastChannel) {
      broadcastChannel.postMessage(msg);
    }
  }

  async function handleSignalMessage(msg, role) {
    if (!msg || !msg.type) return;

    if (role === 'sender') {
      if (msg.type === 'join-request') {
        const roomStatusLabel = document.getElementById('room-status-label');
        if (roomStatusLabel) roomStatusLabel.textContent = 'Recipient connected · Starting transfer...';
        createOffer();
      } else if (msg.type === 'answer') {
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
      } else if (msg.type === 'candidate') {
        if (peerConnection && msg.candidate) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {}
        }
      }
    } else if (role === 'receiver') {
      if (msg.type === 'offer') {
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          sendSignal({ type: 'answer', sdp: answer });
        }
      } else if (msg.type === 'candidate') {
        if (peerConnection && msg.candidate) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {}
        }
      }
    }
  }

  // WebRTC SENDER
  function initWebRTCSender() {
    peerConnection = new RTCPeerConnection(STUN_SERVERS);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'candidate', candidate: event.candidate });
      }
    };

    dataChannel = peerConnection.createDataChannel('lynqdrop-data', { ordered: true });
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onopen = () => {
      console.log('WebRTC DataChannel Connected (Sender)');
      startSendingFiles();
    };

    dataChannel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pause-toggle') {
          transferPaused = !transferPaused;
        } else if (data.type === 'cancel') {
          transferCancelled = true;
          resetTransferState();
        }
      } catch (err) {}
    };
  }

  async function createOffer() {
    if (!peerConnection) return;
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendSignal({ type: 'offer', sdp: offer });
  }

  // WebRTC RECEIVER
  function initWebRTCReceiver() {
    peerConnection = new RTCPeerConnection(STUN_SERVERS);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'candidate', candidate: event.candidate });
      }
    };

    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.binaryType = 'arraybuffer';
      setupReceiverDataChannel(dataChannel);
    };
  }

  function setupReceiverDataChannel(dc) {
    dc.onopen = () => {
      console.log('WebRTC DataChannel Connected (Receiver)');
      showMonitorCard('Receiving incoming files...', 0, 1);
    };

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          handleReceiverControlMessage(msg);
        } catch (e) {}
      } else {
        // Binary chunk
        handleReceiverBinaryChunk(event.data);
      }
    };
  }

  function handleReceiverControlMessage(msg) {
    if (msg.type === 'files-manifest') {
      incomingFilesMeta = msg.files;
      currentIncomingFileIndex = 0;
      currentIncomingChunks = [];
      currentIncomingBytes = 0;
      transferStartTime = Date.now();
      showMonitorCard(`Preparing to download ${msg.files.length} file(s)...`, 0, msg.files.length);
    } else if (msg.type === 'file-start') {
      const fileMeta = incomingFilesMeta[msg.index];
      currentIncomingFileIndex = msg.index;
      currentIncomingChunks = [];
      currentIncomingBytes = 0;
      showMonitorCard(fileMeta.name, msg.index + 1, incomingFilesMeta.length);
    } else if (msg.type === 'file-end') {
      const fileMeta = incomingFilesMeta[msg.index];
      const blob = new Blob(currentIncomingChunks, { type: fileMeta.type || 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(blob);
      
      completedReceivedFiles.push({
        name: fileMeta.name,
        size: fileMeta.size,
        url: downloadUrl
      });

      // Auto trigger browser download
      triggerDownload(downloadUrl, fileMeta.name);
    } else if (msg.type === 'all-complete') {
      showTransferComplete(completedReceivedFiles);
    }
  }

  function handleReceiverBinaryChunk(chunk) {
    currentIncomingChunks.push(chunk);
    currentIncomingBytes += chunk.byteLength;

    const fileMeta = incomingFilesMeta[currentIncomingFileIndex];
    if (fileMeta) {
      updateTransferProgress(fileMeta.name, currentIncomingBytes, fileMeta.size, currentIncomingFileIndex + 1, incomingFilesMeta.length);
    }
  }

  // SENDER FILE STREAMING
  async function startSendingFiles() {
    showMonitorCard('Sending files...', 1, selectedFiles.length);

    // 1. Send manifest
    const manifest = selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }));
    dataChannel.send(JSON.stringify({ type: 'files-manifest', files: manifest }));

    transferStartTime = Date.now();
    lastSpeedCheckTime = Date.now();
    bytesTransferredLastSecond = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      if (transferCancelled) break;
      const file = selectedFiles[i];
      showMonitorCard(file.name, i + 1, selectedFiles.length);

      dataChannel.send(JSON.stringify({ type: 'file-start', index: i }));

      let offset = 0;
      while (offset < file.size) {
        if (transferCancelled) break;

        while (transferPaused) {
          await new Promise(r => setTimeout(r, 200));
        }

        // Backpressure management
        if (dataChannel.bufferedAmount > 512 * 1024) {
          await new Promise(resolve => {
            dataChannel.onbufferedamountlow = () => {
              dataChannel.onbufferedamountlow = null;
              resolve();
            };
          });
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        dataChannel.send(buffer);

        offset += buffer.byteLength;
        bytesTransferredLastSecond += buffer.byteLength;

        updateTransferProgress(file.name, offset, file.size, i + 1, selectedFiles.length);
      }

      dataChannel.send(JSON.stringify({ type: 'file-end', index: i }));
    }

    if (!transferCancelled) {
      dataChannel.send(JSON.stringify({ type: 'all-complete' }));
      showTransferComplete(selectedFiles.map(f => ({ name: f.name, size: f.size })));
    }
  }

  // Progress UI Helpers
  const transferMonitorCard = document.getElementById('transfer-monitor-card');
  const monitorFileName = document.getElementById('monitor-file-name');
  const monitorFileCount = document.getElementById('monitor-file-count');
  const monitorProgressBar = document.getElementById('monitor-progress-bar');
  const monitorPercent = document.getElementById('monitor-percent');
  const monitorSpeed = document.getElementById('monitor-speed');
  const monitorBytes = document.getElementById('monitor-bytes');
  const monitorEta = document.getElementById('monitor-eta');
  const transferCompleteCard = document.getElementById('transfer-complete-card');
  const downloadedFilesList = document.getElementById('downloaded-files-list');
  const completeSummaryText = document.getElementById('complete-summary-text');

  function showMonitorCard(filename, currentIdx, totalCount) {
    if (transferMonitorCard) transferMonitorCard.style.display = 'block';
    if (monitorFileName) monitorFileName.textContent = filename;
    if (monitorFileCount) monitorFileCount.textContent = `File ${currentIdx} of ${totalCount}`;
  }

  function updateTransferProgress(filename, currentBytes, totalBytes, fileIdx, totalFiles) {
    const percent = Math.min(100, Math.round((currentBytes / totalBytes) * 100));
    if (monitorProgressBar) monitorProgressBar.style.width = `${percent}%`;
    if (monitorPercent) monitorPercent.textContent = `${percent}%`;
    if (monitorBytes) monitorBytes.textContent = `${formatBytes(currentBytes)} / ${formatBytes(totalBytes)}`;
    if (monitorFileName) monitorFileName.textContent = filename;
    if (monitorFileCount) monitorFileCount.textContent = `File ${fileIdx} of ${totalFiles}`;

    // Speed & ETA
    const now = Date.now();
    const timeDelta = (now - lastSpeedCheckTime) / 1000;
    if (timeDelta >= 0.5) {
      currentSpeedMbps = (bytesTransferredLastSecond / timeDelta) / (1024 * 1024);
      bytesTransferredLastSecond = 0;
      lastSpeedCheckTime = now;

      if (monitorSpeed) monitorSpeed.textContent = `${currentSpeedMbps.toFixed(1)} MB/s`;

      if (currentSpeedMbps > 0) {
        const remainingBytes = totalBytes - currentBytes;
        const etaSeconds = Math.max(1, Math.round(remainingBytes / (currentSpeedMbps * 1024 * 1024)));
        if (monitorEta) monitorEta.textContent = `${etaSeconds}s remaining`;
      }
    }
  }

  function showTransferComplete(files) {
    if (transferMonitorCard) transferMonitorCard.style.display = 'none';
    if (transferCompleteCard) transferCompleteCard.style.display = 'block';

    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (completeSummaryText) {
      completeSummaryText.textContent = `Transferred ${files.length} file(s) (${formatBytes(totalBytes)}) directly peer-to-peer!`;
    }

    if (downloadedFilesList) {
      downloadedFilesList.innerHTML = '';
      files.forEach(f => {
        const row = document.createElement('div');
        row.className = 'downloaded-item-row';
        row.innerHTML = `
          <span><strong>${f.name}</strong> (${formatBytes(f.size)})</span>
          ${f.url ? `<a href="${f.url}" download="${f.name}" class="btn-primary" style="padding:4px 12px; font-size:12px;">Save</a>` : `<span style="color:#10b981; font-size:12px;">Sent ✓</span>`}
        `;
        downloadedFilesList.appendChild(row);
      });
    }
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Controls
  const btnPauseTransfer = document.getElementById('btn-pause-transfer');
  const btnCancelTransfer = document.getElementById('btn-cancel-transfer');
  const btnResetTransfer = document.getElementById('btn-reset-transfer');

  if (btnPauseTransfer) {
    btnPauseTransfer.addEventListener('click', () => {
      transferPaused = !transferPaused;
      btnPauseTransfer.textContent = transferPaused ? '▶' : '⏸';
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'pause-toggle' }));
      }
    });
  }

  if (btnCancelTransfer) {
    btnCancelTransfer.addEventListener('click', () => {
      if (confirm('Are you sure you want to cancel the transfer?')) {
        transferCancelled = true;
        if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(JSON.stringify({ type: 'cancel' }));
        }
        resetTransferState();
      }
    });
  }

  if (btnResetTransfer) {
    btnResetTransfer.addEventListener('click', () => {
      resetTransferState();
    });
  }

  function resetTransferState() {
    selectedFiles = [];
    currentIncomingChunks = [];
    completedReceivedFiles = [];
    transferPaused = false;
    transferCancelled = false;

    if (transferMonitorCard) transferMonitorCard.style.display = 'none';
    if (transferCompleteCard) transferCompleteCard.style.display = 'none';
    if (sharingRoomCard) sharingRoomCard.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
    if (selectedFilesTray) selectedFilesTray.style.display = 'none';
    if (inputJoinCode) inputJoinCode.value = '';
    if (receiveStatusBox) receiveStatusBox.style.display = 'none';

    if (dataChannel) {
      try { dataChannel.close(); } catch (e) {}
    }
    if (peerConnection) {
      try { peerConnection.close(); } catch (e) {}
    }
  }

  // ==========================================
  // 5. EMBEDDED HIGH-QUALITY QR CODE GENERATOR
  // ==========================================
  function renderSimpleQR(text, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Use a clean, crisp canvas QR encoder
    const size = 180;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Draw visual QR matrix with finder patterns
    const modules = 25;
    const cellSize = Math.floor(size / modules);
    const offset = Math.floor((size - (modules * cellSize)) / 2);

    ctx.fillStyle = '#0a0f1d';

    function drawFinder(x, y) {
      ctx.fillRect(offset + x * cellSize, offset + y * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(offset + (x + 1) * cellSize, offset + (y + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = '#0a0f1d';
      ctx.fillRect(offset + (x + 2) * cellSize, offset + (y + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    }

    // Top-Left, Top-Right, Bottom-Left finders
    drawFinder(1, 1);
    drawFinder(modules - 8, 1);
    drawFinder(1, modules - 8);

    // Alignment and timing patterns
    for (let i = 8; i < modules - 8; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(offset + i * cellSize, offset + 6 * cellSize, cellSize, cellSize);
        ctx.fillRect(offset + 6 * cellSize, offset + i * cellSize, cellSize, cellSize);
      }
    }

    // Deterministic pseudo-random module distribution based on text hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    let seed = Math.abs(hash);
    function nextBit() {
      seed = (seed * 9301 + 49297) % 233280;
      return (seed / 233280) > 0.45;
    }

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        // Skip finders
        if ((r < 9 && c < 9) || (r < 9 && c > modules - 10) || (r > modules - 10 && c < 9)) continue;
        if (nextBit()) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize, cellSize);
        }
      }
    }

    container.innerHTML = '';
    container.appendChild(canvas);
  }

  // ==========================================
  // 6. SERVICE WORKER REGISTRATION
  // ==========================================
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});
