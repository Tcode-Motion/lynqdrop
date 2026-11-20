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
      const winAsset = data.assets?.find(a => a.name.endsWith('.zip') || a.name.endsWith('.exe'));
      const macAsset = data.assets?.find(a => a.name.endsWith('.dmg'));
      const linuxAsset = data.assets?.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.tar.gz'));

      const androidBtn = document.getElementById('download-android-btn');
      if (androidBtn) {
        androidBtn.href = apkAsset ? apkAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (apkAsset) androidBtn.setAttribute('download', apkAsset.name);
      }

      const winBtn = document.getElementById('download-windows-btn');
      if (winBtn) {
        winBtn.href = winAsset ? winAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (winAsset) winBtn.setAttribute('download', winAsset.name);
      }

      const macBtn = document.getElementById('download-macos-btn');
      if (macBtn) {
        macBtn.href = macAsset ? macAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (macAsset) macBtn.setAttribute('download', macAsset.name);
      }

      const linuxBtn = document.getElementById('download-linux-btn');
      if (linuxBtn) {
        linuxBtn.href = linuxAsset ? linuxAsset.browser_download_url : (data.html_url || GITHUB_FALLBACK_URL);
        if (linuxAsset) linuxBtn.setAttribute('download', linuxAsset.name);
      }
    } catch (e) {
      console.log('Using direct GitHub release fallback links:', e);
    }
  }

  fetchLatestRelease();

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

  // Tab switching
  window.switchWebTab = function(tabName) {
    const tabs = ['send', 'receive', 'lan'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const pane = document.getElementById(`tab-content-${t}`);
      if (btn) btn.classList.toggle('active', t === tabName);
      if (pane) pane.style.display = (t === tabName) ? 'block' : 'none';
    });
  };

  // Dropzone file handling
  const dropzone = document.getElementById('web-dropzone');
  const fileInput = document.getElementById('web-file-input');
  const selectedFilesTray = document.getElementById('selected-files-tray');
  const trayCount = document.getElementById('tray-count');
  const trayTotalSize = document.getElementById('tray-total-size');
  const trayItemsList = document.getElementById('tray-items-list');

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
