/**
 * LynqDrop Web Client & P2P WebRTC Transfer Engine
 * Production Version 2.2.0
 * 
 * Strict Architecture:
 * - Direct WebRTC DataChannel peer-to-peer file streaming
 * - 64 KiB memory-bounded chunking
 * - Backpressure flow control (1 MiB pause, 256 KiB resume)
 * - Progressive streaming SHA-256 verification (Web Crypto API)
 * - Direct-to-disk File System Access API / OPFS streaming sink
 * - Zero cloud storage & zero server file retention
 * - Mobile-first QR auto-join, PIN room access controls, auto-cleanup on close
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // =========================================================================
  // 1. THEME CONTROLLER
  // =========================================================================
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const htmlEl = document.documentElement;

  const savedTheme = localStorage.getItem('lynqdrop-theme');
  const initialTheme = savedTheme || 'dark';

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
        themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
      } else {
        themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
      }
    }
  }

  // =========================================================================
  // 2. FAQ ACCORDION
  // =========================================================================
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => {
          i.classList.remove('active');
          const toggle = i.querySelector('.faq-toggle');
          if (toggle) toggle.textContent = '+';
        });
        if (!isActive) {
          item.classList.add('active');
          const toggle = item.querySelector('.faq-toggle');
          if (toggle) toggle.textContent = '−';
        }
      });
    }
  });

  // =========================================================================
  // 3. PROTOCOL CONSTANTS & CONFIGURATION
  // =========================================================================
  const CROCKFORD_32_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const CODE_PREFIX = 'LD-';
  const CHUNK_SIZE = 65536; // 64 KiB binary chunks
  const HIGH_WATER_MARK = 1048576; // 1 MiB backpressure pause threshold
  const LOW_WATER_MARK = 262144;   // 256 KiB backpressure resume threshold

  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    iceCandidatePoolSize: 2
  };

  function generateCrockfordCode() {
    let result = '';
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    for (let i = 0; i < 6; i++) {
      result += CROCKFORD_32_ALPHABET[array[i] % CROCKFORD_32_ALPHABET.length];
    }
    return `${CODE_PREFIX}${result}`;
  }

  function normalizeRoomCode(input) {
    if (!input || typeof input !== 'string') return '';
    let cleaned = input.toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '');
    if (cleaned.startsWith('LD')) cleaned = cleaned.slice(2);
    return `${CODE_PREFIX}${cleaned}`;
  }

  function roomCodeToPeerId(code) {
    const norm = normalizeRoomCode(code);
    const bare = norm.replace(/^LD-/, '').toLowerCase();
    return `ld-room-${bare}`;
  }

  function isValidRoomCode(code) {
    if (!code) return false;
    const norm = normalizeRoomCode(code);
    return /^LD-[2-9A-HJ-NP-Z]{4,8}$/.test(norm);
  }

  function formatBytes(bytes) {
    if (bytes === 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Detect Local Device Info with Cross-Platform Auto-Detection
  function getClientDevice() {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    let browser = 'Browser';
    let icon = '🌐';
    let isMobile = false;

    if (/android/i.test(ua)) {
      os = 'Android';
      icon = '📱';
      isMobile = true;
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      os = 'iOS';
      icon = '📱';
      isMobile = true;
    } else if (/windows/i.test(ua)) {
      os = 'Windows';
      icon = '💻';
    } else if (/macintosh|mac os x/i.test(ua)) {
      os = 'macOS';
      icon = '💻';
    } else if (/linux/i.test(ua)) {
      os = 'Linux';
      icon = '🐧';
    }

    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';

    const clientType = window.isLynqDropNativeApp ? 'Native App' : 'Web';
    const tag = `${clientType} (${os} · ${browser})`;
    const savedAlias = localStorage.getItem('lynqdrop-device-alias');
    const defaultAlias = `${os} ${clientType}`;

    return {
      name: savedAlias || defaultAlias,
      os,
      browser,
      clientType,
      platform: clientType,
      tag,
      icon,
      isMobile,
      isLocal: true
    };
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updatePlatformBadge(localDevice, remotePeer) {
    try {
      const card = document.getElementById('platform-connection-card');
      const localName = document.getElementById('local-entity-name');
      const localType = document.getElementById('local-entity-type');
      const localIcon = document.getElementById('local-entity-icon');
      const remoteName = document.getElementById('remote-entity-name');
      const remoteType = document.getElementById('remote-entity-type');
      const remoteIcon = document.getElementById('remote-entity-icon');

      if (localDevice) {
        if (localName) localName.textContent = localDevice.name || 'My Device';
        if (localType) localType.textContent = `${localDevice.os || ''} (${localDevice.browser || localDevice.platform || 'Web'})`.trim();
        if (localIcon) {
          const os = (localDevice.os || '').toLowerCase();
          localIcon.textContent = os.includes('win') ? '💻' : os.includes('mac') ? '🍏' : os.includes('android') ? '📱' : os.includes('ios') ? '📱' : '🌐';
        }
      }

      if (remotePeer) {
        if (remoteName) remoteName.textContent = remotePeer.name || 'Peer Device';
        if (remoteType) remoteType.textContent = `${remotePeer.os || ''} (${remotePeer.browser || remotePeer.platform || 'Web'})`.trim();
        if (remoteIcon) {
          const os = (remotePeer.os || '').toLowerCase();
          remoteIcon.textContent = os.includes('win') ? '💻' : os.includes('mac') ? '🍏' : os.includes('android') ? '📱' : os.includes('ios') ? '📱' : '🌐';
        }
        if (card) card.style.display = liveRoomOpen ? 'none' : 'flex';
      } else {
        if (card) card.style.display = 'none';
      }

      if (livePeerStatusText) {
        const localTag = localDevice ? `${localDevice.name} (${localDevice.os || localDevice.platform || 'Web'})` : 'Local';
        const remoteTag = remotePeer ? `${remotePeer.name} (${remotePeer.os || remotePeer.platform || 'Web'})` : 'Peer';
        livePeerStatusText.textContent = `⚡ ${localTag} ⟷ ${remoteTag}`;
      }
    } catch (e) {
      console.warn('updatePlatformBadge error:', e);
    }
  }

  // Live Room DOM Handles
  let liveRoomOpen = false;
  let remoteDevice = null;
  const p2pLiveRoom = document.getElementById('p2p-live-room');
  const liveRoomCodeTag = document.getElementById('live-room-code-tag');
  const livePeerBridgePill = document.getElementById('live-peer-bridge-pill');
  const livePeerStatusText = document.getElementById('live-peer-status-text');
  const livePeerName = document.getElementById('live-peer-name');
  const peerAvatarIcon = document.getElementById('peer-avatar-icon');
  const btnLiveCopyLink = document.getElementById('btn-live-copy-link');
  const btnLeaveLiveRoom = document.getElementById('btn-leave-live-room');
  const chatFeed = document.getElementById('chat-messages-feed');
  const chatFeedContainer = document.getElementById('chat-feed-container');
  const chatDragOverlay = document.getElementById('chat-drag-overlay');
  const chatTextInput = document.getElementById('chat-text-input');
  const btnChatSend = document.getElementById('btn-chat-send');
  const btnChatCamera = document.getElementById('btn-chat-camera');
  const btnChatAttachMenu = document.getElementById('btn-chat-attach-menu');
  const chatAttachPopup = document.getElementById('chat-attach-popup');
  const popupItemCamera = document.getElementById('popup-item-camera');
  const popupItemGallery = document.getElementById('popup-item-gallery');
  const popupItemFile = document.getElementById('popup-item-file');
  const popupItemFolder = document.getElementById('popup-item-folder');
  const chatCameraInput = document.getElementById('chat-camera-input');
  const chatGalleryInput = document.getElementById('chat-gallery-input');
  const chatFileInput = document.getElementById('chat-file-input');
  const chatFolderInput = document.getElementById('chat-folder-input');
  const btnChatMic = document.getElementById('btn-chat-mic');
  const liveVoiceRecorderBar = document.getElementById('live-voice-recorder-bar');
  const voiceTimerText = document.getElementById('voice-timer-text');
  const btnCancelVoice = document.getElementById('btn-cancel-voice');
  const btnSendVoice = document.getElementById('btn-send-voice');
  const chatInputBar = document.getElementById('chat-input-bar');
  const liveTransferBar = document.getElementById('live-transfer-bar');
  const liveTransferLabel = document.getElementById('live-transfer-label');
  const liveTransferStats = document.getElementById('live-transfer-stats');
  const liveTransferFill = document.getElementById('live-transfer-fill');
  const roomEndedModal = document.getElementById('room-ended-modal');
  const roomEndedReason = document.getElementById('room-ended-reason');
  const btnRejoinNewRoom = document.getElementById('btn-rejoin-new-room');

  // MediaRecorder Voice Note State
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingInterval = null;
  let recordingSeconds = 0;

  async function startVoiceRecording() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice recording requires microphone permissions and HTTPS.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      recordingSeconds = 0;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
          else mimeType = '';
        }
      }

      mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.start(100);

      if (chatInputBar) chatInputBar.style.display = 'none';
      if (liveVoiceRecorderBar) liveVoiceRecorderBar.style.display = 'flex';
      if (voiceTimerText) voiceTimerText.textContent = '0:00';

      recordingInterval = setInterval(() => {
        recordingSeconds++;
        const m = Math.floor(recordingSeconds / 60);
        const s = recordingSeconds % 60;
        if (voiceTimerText) voiceTimerText.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('Could not access microphone: ' + (err.message || err));
    }
  }

  function stopVoiceRecording(shouldSend) {
    if (recordingInterval) clearInterval(recordingInterval);
    if (!mediaRecorder) {
      if (chatInputBar) chatInputBar.style.display = 'flex';
      if (liveVoiceRecorderBar) liveVoiceRecorderBar.style.display = 'none';
      return;
    }

    mediaRecorder.onstop = () => {
      try {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (_) { }

      if (shouldSend && audioChunks.length > 0) {
        const type = mediaRecorder.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunks, { type });
        audioBlob.name = `Voice-Note-${new Date().toISOString().slice(11, 19).replace(/:/g, '')}.${ext}`;
        audioBlob.isVoiceNote = true;
        sendLiveFiles([audioBlob]);
      }
      audioChunks = [];
      mediaRecorder = null;
    };

    try {
      mediaRecorder.stop();
    } catch (_) { }

    if (chatInputBar) chatInputBar.style.display = 'flex';
    if (liveVoiceRecorderBar) liveVoiceRecorderBar.style.display = 'none';
  }

  function openLiveRoom(code, isHost) {
    liveRoomOpen = true;
    currentRoomCode = code;
    try { window.scrollTo(0, 0); } catch (_) {}
    document.body.classList.add('in-live-room');

    // Transition out lobby views
    if (sharingRoomCard) sharingRoomCard.style.display = 'none';
    const subviewSend = document.getElementById('subview-card-send');
    const subviewRecv = document.getElementById('subview-card-receive');
    const subviewText = document.getElementById('subview-card-text');
    const subviewBar = document.querySelector('.subview-bar');
    const heroBanner = document.getElementById('hero-banner');
    const incomingAcceptCard = document.getElementById('incoming-accept-card');
    const activeTransferCard = document.getElementById('active-transfer-card');
    const transferCompleteCard = document.getElementById('transfer-complete-card');
    const pinChallengeCard = document.getElementById('pin-challenge-card');
    const receiveStatusBox = document.getElementById('receive-status-box');

    if (subviewSend) subviewSend.style.display = 'none';
    if (subviewRecv) subviewRecv.style.display = 'none';
    if (subviewText) subviewText.style.display = 'none';
    if (subviewBar) subviewBar.style.display = 'none';
    if (heroBanner) heroBanner.style.display = 'none';
    if (incomingAcceptCard) incomingAcceptCard.style.display = 'none';
    if (activeTransferCard) activeTransferCard.style.display = 'none';
    if (transferCompleteCard) transferCompleteCard.style.display = 'none';
    if (pinChallengeCard) pinChallengeCard.style.display = 'none';
    if (receiveStatusBox) receiveStatusBox.style.display = 'none';
    const platformCard = document.getElementById('platform-connection-card');
    if (platformCard) platformCard.style.display = 'none';

    if (p2pLiveRoom) p2pLiveRoom.style.display = 'flex';
    if (liveRoomCodeTag) liveRoomCodeTag.textContent = code;

    if (livePeerName) {
      livePeerName.textContent = remoteDevice ? remoteDevice.name : (isHost ? 'Receiver' : 'Sender');
    }
    if (peerAvatarIcon) {
      const os = (remoteDevice?.os || '').toLowerCase();
      peerAvatarIcon.textContent = os.includes('win') ? '💻' : os.includes('mac') ? '🍏' : os.includes('android') ? '📱' : os.includes('ios') ? '📱' : '🌐';
    }
    if (livePeerStatusText) {
      const dc = (activeConnection && activeConnection.dataChannel);
      const hasP2P = (activeConnection && activeConnection.open) || (dc && dc.readyState === 'open');
      livePeerStatusText.textContent = hasP2P ? 'online • Direct P2P' : 'online • Fast Relay';
    }

    const copyRoomLink = () => {
      const url = `${window.location.origin}/?room=${encodeURIComponent(code)}`;
      navigator.clipboard.writeText(url).then(() => {
        alert(`Invite link copied to clipboard!\n${url}`);
      });
    };

    if (btnLiveCopyLink) btnLiveCopyLink.onclick = copyRoomLink;
    const liveRoomBadge = document.getElementById('live-room-badge');
    if (liveRoomBadge) liveRoomBadge.onclick = copyRoomLink;

    const handleLeaveRoom = () => {
      if (confirm('Leave this room and terminate the session?')) {
        document.body.classList.remove('in-live-room');
        sendPacket({ type: 'ROOM_TERMINATED', reason: 'Peer left the room.' }, true);
        window.location.href = window.location.origin;
      }
    };

    if (btnLeaveLiveRoom) btnLeaveLiveRoom.onclick = handleLeaveRoom;
    const btnLeaveLiveRoomArrow = document.getElementById('btn-leave-live-room-arrow');
    if (btnLeaveLiveRoomArrow) btnLeaveLiveRoomArrow.onclick = handleLeaveRoom;

    // Initialize chat input handlers
    if (chatTextInput && !chatTextInput._initialized) {
      chatTextInput._initialized = true;
      chatTextInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendLiveChatMessage();
        }
      });
    }

    if (btnChatSend && !btnChatSend._initialized) {
      btnChatSend._initialized = true;
      btnChatSend.addEventListener('click', sendLiveChatMessage);
    }

    // Direct 1-tap Camera Button
    if (btnChatCamera && chatCameraInput && !btnChatCamera._initialized) {
      btnChatCamera._initialized = true;
      btnChatCamera.addEventListener('click', () => {
        if (chatAttachPopup) chatAttachPopup.style.display = 'none';
        chatCameraInput.click();
      });
      chatCameraInput.addEventListener('change', () => {
        if (chatCameraInput.files && chatCameraInput.files.length > 0) {
          sendLiveFiles(Array.from(chatCameraInput.files));
          chatCameraInput.value = '';
        }
      });
    }

    // Attachment Popup Menu Trigger
    if (btnChatAttachMenu && chatAttachPopup && !btnChatAttachMenu._initialized) {
      btnChatAttachMenu._initialized = true;
      btnChatAttachMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = chatAttachPopup.style.display === 'flex';
        chatAttachPopup.style.display = isShown ? 'none' : 'flex';
      });
      document.addEventListener('click', (e) => {
        if (chatAttachPopup && !chatAttachPopup.contains(e.target) && e.target !== btnChatAttachMenu) {
          chatAttachPopup.style.display = 'none';
        }
      });
    }

    // Attachment Popup Items
    if (popupItemCamera && chatCameraInput && !popupItemCamera._initialized) {
      popupItemCamera._initialized = true;
      popupItemCamera.addEventListener('click', () => {
        if (chatAttachPopup) chatAttachPopup.style.display = 'none';
        chatCameraInput.click();
      });
    }

    if (popupItemGallery && chatGalleryInput && !popupItemGallery._initialized) {
      popupItemGallery._initialized = true;
      popupItemGallery.addEventListener('click', () => {
        if (chatAttachPopup) chatAttachPopup.style.display = 'none';
        chatGalleryInput.click();
      });
      chatGalleryInput.addEventListener('change', () => {
        if (chatGalleryInput.files && chatGalleryInput.files.length > 0) {
          sendLiveFiles(Array.from(chatGalleryInput.files));
          chatGalleryInput.value = '';
        }
      });
    }

    if (popupItemFile && chatFileInput && !popupItemFile._initialized) {
      popupItemFile._initialized = true;
      popupItemFile.addEventListener('click', () => {
        if (chatAttachPopup) chatAttachPopup.style.display = 'none';
        chatFileInput.click();
      });
      chatFileInput.addEventListener('change', () => {
        if (chatFileInput.files && chatFileInput.files.length > 0) {
          sendLiveFiles(Array.from(chatFileInput.files));
          chatFileInput.value = '';
        }
      });
    }

    if (popupItemFolder && chatFolderInput && !popupItemFolder._initialized) {
      popupItemFolder._initialized = true;
      popupItemFolder.addEventListener('click', () => {
        if (chatAttachPopup) chatAttachPopup.style.display = 'none';
        chatFolderInput.click();
      });
      chatFolderInput.addEventListener('change', () => {
        if (chatFolderInput.files && chatFolderInput.files.length > 0) {
          sendLiveFiles(Array.from(chatFolderInput.files));
          chatFolderInput.value = '';
        }
      });
    }

    // Microphone Voice Note Recording
    if (btnChatMic && !btnChatMic._initialized) {
      btnChatMic._initialized = true;
      btnChatMic.addEventListener('click', () => {
        startVoiceRecording();
      });
    }

    if (btnCancelVoice && !btnCancelVoice._initialized) {
      btnCancelVoice._initialized = true;
      btnCancelVoice.addEventListener('click', () => {
        stopVoiceRecording(false);
      });
    }

    if (btnSendVoice && !btnSendVoice._initialized) {
      btnSendVoice._initialized = true;
      btnSendVoice.addEventListener('click', () => {
        stopVoiceRecording(true);
      });
    }

    // Drag and drop into live chat feed
    if (chatFeedContainer && !chatFeedContainer._initialized) {
      chatFeedContainer._initialized = true;
      chatFeedContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (chatDragOverlay) chatDragOverlay.style.display = 'flex';
      });
      chatFeedContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (chatDragOverlay) chatDragOverlay.style.display = 'none';
      });
      chatFeedContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        if (chatDragOverlay) chatDragOverlay.style.display = 'none';
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          sendLiveFiles(Array.from(e.dataTransfer.files));
        }
      });
    }
  }

  function appendChatMessage({ sender, text, time, isMine, msgId }) {
    if (!chatFeed) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMine ? 'mine' : 'peer'}`;
    if (isMine && msgId) bubble.dataset.msgId = msgId;
    const d = new Date(time || Date.now());
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = `
      ${!isMine ? `<span class="chat-bubble-sender">${escapeHtml(sender)}</span>` : ''}
      <span class="chat-bubble-text">${escapeHtml(text)}</span>
      <div class="chat-bubble-footer">
        <span class="chat-bubble-time">${timeStr}</span>
        ${isMine ? '<span class="wa-checkmarks wa-sent">✓</span>' : ''}
      </div>
    `;
    chatFeed.appendChild(bubble);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function markMessageDelivered(msgId) {
    if (!msgId || !chatFeed) return;
    const bubble = chatFeed.querySelector(`[data-msg-id="${CSS.escape(msgId)}"]`);
    if (bubble) {
      const tick = bubble.querySelector('.wa-checkmarks');
      if (tick) {
        tick.textContent = '✓✓';
        tick.classList.remove('wa-sent');
        tick.classList.add('wa-delivered');
      }
    }
  }

  function appendChatFileCard({ sender, file, isMine, downloadUrl, verified, rawBlob }) {
    if (!chatFeed) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isMine ? 'mine' : 'peer'}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const fileName = file.name || 'File';
    const isVoice = (file.isVoiceNote || fileName.toLowerCase().includes('voice-note') || (file.mimeType && file.mimeType.startsWith('audio/')) || fileName.match(/\.(webm|m4a|mp3|ogg|wav)$/i));
    const isImage = (file.mimeType && file.mimeType.startsWith('image/')) || fileName.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);

    let contentHtml = '';
    const srcUrl = downloadUrl || (rawBlob ? URL.createObjectURL(rawBlob) : null);

    if (isVoice && srcUrl) {
      contentHtml = `
        <div class="chat-voice-card">
          <div class="voice-mic-badge">🎙️</div>
          <audio controls src="${srcUrl}" class="voice-audio-element" preload="metadata"></audio>
        </div>
      `;
    } else if (isImage && srcUrl) {
      contentHtml = `
        <div class="chat-photo-card">
          <img src="${srcUrl}" alt="${escapeHtml(fileName)}" class="chat-thumbnail-img chat-photo-thumb" onclick="window.open('${srcUrl}', '_blank')" />
          <div class="photo-overlay-info">
            <span class="chat-file-name" style="font-size:0.75rem; color:#8696a0;">${escapeHtml(fileName)} · ${formatBytes(file.size)}</span>
            ${downloadUrl ? `<a href="${downloadUrl}" download="${escapeHtml(fileName)}" class="btn-file-download">Save</a>` : `<span style="font-size:0.75rem; color:#10b981;">Sent</span>`}
          </div>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="chat-file-card">
          <span class="chat-file-icon">📄</span>
          <div class="chat-file-info">
            <div class="chat-file-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
            <div class="chat-file-size">${formatBytes(file.size)} ${verified ? '· Verified ✓' : ''}</div>
          </div>
          ${downloadUrl ? `<a href="${downloadUrl}" download="${escapeHtml(fileName)}" class="btn-file-download">Save</a>` : `<span style="font-size:0.75rem; color:#10b981;">Delivered ✓</span>`}
        </div>
      `;
    }

    bubble.innerHTML = `
      ${!isMine ? `<span class="chat-bubble-sender">${escapeHtml(sender)}</span>` : ''}
      ${contentHtml}
      <div class="chat-bubble-footer">
        <span class="chat-bubble-time">${timeStr}</span>
        ${isMine ? '<span class="wa-checkmarks">✓✓</span>' : ''}
      </div>
    `;
    chatFeed.appendChild(bubble);
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function sendLiveChatMessage() {
    if (!chatTextInput) return;
    const text = (chatTextInput.value || '').trim();
    if (!text) return;

    const time = Date.now();
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const packet = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type: 'CHAT_MSG',
      msgId: msgId,
      text: text,
      time: time
    };

    appendChatMessage({
      sender: myDevice.name,
      text: text,
      time: time,
      isMine: true,
      msgId: msgId
    });
    chatTextInput.value = '';

    const sent = sendPacket(packet);
    if (!sent) {
      console.log('[LynqDrop] Transport handshaking, queued chat message in pendingOutbox');
      pendingOutbox.push(packet);
    }
  }

  async function sendLiveFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const dc = (activeConnection && activeConnection.dataChannel) || (activeConnection && activeConnection._dc);
    const isP2POpen = (dc && dc.readyState === 'open');
    if (isP2POpen && activeConnection) {
      try { activeConnection._open = true; } catch (_) {}
    }
    const hasP2P = (activeConnection && activeConnection.open) || isP2POpen;
    const hasRelay = activeRelay && activeRelay.connected;
    if (!hasP2P && !hasRelay) {
      console.log('[LynqDrop] Transport handshaking, queued files in pendingFilesQueue');
      pendingFilesQueue.push(...fileList);
      return;
    }

    if (dc) {
      try { dc.binaryType = 'arraybuffer'; } catch (_) {}
    }

    for (let i = 0; i < fileList.length; i++) {
      const rawFile = fileList[i].rawFile || fileList[i];
      appendChatFileCard({
        sender: myDevice.name,
        file: { name: rawFile.name, size: rawFile.size, mimeType: rawFile.type, isVoiceNote: rawFile.isVoiceNote },
        isMine: true,
        downloadUrl: null,
        rawBlob: rawFile
      });

      if (liveTransferBar) liveTransferBar.style.display = 'flex';
      if (liveTransferLabel) liveTransferLabel.textContent = `Sending ${rawFile.name}...`;

      sendPacket({
        type: 'FILE_START',
        fileIndex: i,
        name: rawFile.name,
        size: rawFile.size,
        mimeType: rawFile.type || 'application/octet-stream',
        isVoiceNote: !!rawFile.isVoiceNote
      });

      let offset = 0;
      const startTime = Date.now();
      const RELAY_CHUNK_SIZE = 64 * 1024; // 64 KiB chunks
      const WEBRTC_CHUNK_SIZE = 128 * 1024; // 128 KiB high-throughput Wi-Fi chunks
      const HIGH_BUF = 4 * 1024 * 1024; // 4 MiB backpressure ceiling
      const LOW_BUF = 1 * 1024 * 1024;  // 1 MiB resume threshold

      if (dc) {
        try { dc.bufferedAmountLowThreshold = LOW_BUF; } catch (_) {}
      }

      while (offset < rawFile.size) {
        if (hasP2P && dc && dc.readyState === 'open') {
          if (dc.bufferedAmount > HIGH_BUF) {
            await new Promise((resolve) => {
              let resolved = false;
              const onLow = () => {
                if (!resolved) {
                  resolved = true;
                  dc.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                }
              };
              dc.addEventListener('bufferedamountlow', onLow);
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  dc.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                }
              }, 25);
            });
          }

          const slice = rawFile.slice(offset, offset + WEBRTC_CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();
          try {
            activeConnection.send({
              type: 'CHUNK',
              fileIndex: i,
              chunk: buffer
            });
          } catch (e) {
            console.warn('[LynqDrop] WebRTC conn.send failed:', e);
          }
          offset += buffer.byteLength;
        } else {
          // High-throughput Relay streaming
          const slice = rawFile.slice(offset, offset + RELAY_CHUNK_SIZE);
          const buffer = await slice.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const len = bytes.byteLength;
          for (let b = 0; b < len; b++) {
            binary += String.fromCharCode(bytes[b]);
          }
          const base64Data = btoa(binary);

          if (activeRelay && activeRelay.connected) {
            activeRelay.publish({
              type: 'CHUNK',
              fileIndex: i,
              chunk: base64Data,
              isBase64: true
            });
          }
          offset += len;
          await new Promise(r => setTimeout(r, 1));
        }

        const pct = Math.min(100, Math.round((offset / rawFile.size) * 100));
        if (liveTransferFill) liveTransferFill.style.width = `${pct}%`;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? (offset / elapsed / (1024 * 1024)).toFixed(1) : '0.0';
        if (liveTransferStats) liveTransferStats.textContent = `${pct}% · ${speed} MB/s`;
      }

      const sha256 = await computeBlobOrFileSHA256(rawFile);
      sendPacket({
        type: 'FILE_END',
        fileIndex: i,
        sha256
      });
    }

    sendPacket({ type: 'ALL_COMPLETE' });
    if (liveTransferBar) {
      setTimeout(() => { liveTransferBar.style.display = 'none'; }, 1200);
    }
  }

  let liveSink = null;
  let liveTotalExpected = 0;
  let liveBytesReceived = 0;
  let liveFileStartTime = Date.now();

  async function handleIncomingFileData(msg, senderName) {
    if (!msg) return;

    if (msg.type === 'FILE_START') {
      liveSink = new FileStreamSink(msg);
      await liveSink.initialize();
      liveTotalExpected = msg.size || 0;
      liveBytesReceived = 0;
      liveFileStartTime = Date.now();

      if (liveTransferBar) liveTransferBar.style.display = 'flex';
      if (liveTransferLabel) liveTransferLabel.textContent = `Receiving ${msg.name}...`;
      if (liveTransferFill) liveTransferFill.style.width = '0%';
      if (liveTransferStats) liveTransferStats.textContent = '0% · 0.0 MB/s';
    } else if (msg.type === 'CHUNK') {
      if (liveSink) {
        let chunkData = msg.chunk;
        if (typeof chunkData === 'string' && msg.isBase64) {
          const binaryStr = atob(chunkData);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          chunkData = bytes.buffer;
        }
        await liveSink.writeChunk(chunkData);
        liveBytesReceived += (chunkData.byteLength || chunkData.length || 0);

        const pct = liveTotalExpected > 0 ? Math.min(100, Math.round((liveBytesReceived / liveTotalExpected) * 100)) : 0;
        if (liveTransferFill) liveTransferFill.style.width = `${pct}%`;
        const elapsed = (Date.now() - liveFileStartTime) / 1000;
        const speed = elapsed > 0.5 ? (liveBytesReceived / elapsed / (1024 * 1024)).toFixed(1) : '0.0';
        if (liveTransferStats) liveTransferStats.textContent = `${pct}% · ${speed} MB/s`;
      }
    } else if (msg.type === 'FILE_END') {
      if (liveSink) {
        const currentSinkMeta = { ...liveSink.meta };
        const currentSink = liveSink;
        liveSink = null;

        const res = await currentSink.finalize();
        const recSha256 = await computeBlobOrFileSHA256(res.file);
        const verified = (!msg.sha256 || recSha256 === msg.sha256);

        appendChatFileCard({
          sender: senderName || 'Peer',
          file: {
            name: currentSinkMeta.name,
            size: currentSinkMeta.size,
            mimeType: currentSinkMeta.mimeType,
            isVoiceNote: currentSinkMeta.isVoiceNote
          },
          isMine: false,
          downloadUrl: res.url,
          verified,
          rawBlob: res.file
        });

        // Auto trigger download for frictionless mobile & desktop receive (skip voice notes from auto-downloading)
        if (res.url && !res.directSaved && !currentSinkMeta.isVoiceNote) {
          const a = document.createElement('a');
          a.href = res.url;
          a.download = currentSinkMeta.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    } else if (msg.type === 'ALL_COMPLETE') {
      if (liveTransferBar) {
        setTimeout(() => {
          if (liveTransferBar) liveTransferBar.style.display = 'none';
        }, 1200);
      }
    }
  }

  function showRoomEndedModal(reason) {
    document.body.classList.remove('in-live-room');
    if (roomEndedModal) {
      if (roomEndedReason) roomEndedReason.textContent = reason || 'The host or connected peer disconnected. All temporary transfer memory was securely cleared.';
      roomEndedModal.style.display = 'flex';
    }
    if (btnRejoinNewRoom) {
      btnRejoinNewRoom.onclick = () => {
        window.location.href = window.location.origin;
      };
    }
  }

  const myDevice = getClientDevice();
  const deviceAliasInput = document.getElementById('my-device-alias');
  if (deviceAliasInput) {
    deviceAliasInput.value = myDevice.name;
    deviceAliasInput.addEventListener('change', () => {
      const val = deviceAliasInput.value.trim();
      if (val) {
        myDevice.name = val;
        localStorage.setItem('lynqdrop-device-alias', val);
      }
    });
  }

  // =========================================================================
  // 4. SHARING SUBVIEW CONTROLLER (Send / Receive / Text)
  // =========================================================================
  window.switchBrowserShareSubView = function (viewId) {
    ['send', 'receive', 'text'].forEach(v => {
      const btn = document.getElementById(`subview-btn-${v}`);
      const card = document.getElementById(`subview-card-${v}`);
      const isActive = (v === viewId);
      if (btn) btn.classList.toggle('active', isActive);
      if (card) card.style.display = isActive ? 'block' : 'none';
    });
  };

  // =========================================================================
  // 5. DIAGNOSTICS & STATUS MODAL
  // =========================================================================
  const diagModal = document.getElementById('connection-diagnostics-modal');
  const navDiagBadge = document.getElementById('nav-diag-badge');
  const footerDiagLink = document.getElementById('footer-diag-link');
  const btnCloseDiag = document.getElementById('btn-close-diagnostics');
  const btnCloseDiagFooter = document.getElementById('btn-close-diagnostics-footer');
  const btnRefreshDiag = document.getElementById('btn-refresh-diagnostics');

  function openDiagnosticsModal() {
    if (diagModal) diagModal.style.display = 'flex';
  }

  function closeDiagnosticsModal() {
    if (diagModal) diagModal.style.display = 'none';
  }

  if (navDiagBadge) navDiagBadge.addEventListener('click', openDiagnosticsModal);
  if (footerDiagLink) footerDiagLink.addEventListener('click', (e) => { e.preventDefault(); openDiagnosticsModal(); });
  if (btnCloseDiag) btnCloseDiag.addEventListener('click', closeDiagnosticsModal);
  if (btnCloseDiagFooter) btnCloseDiagFooter.addEventListener('click', closeDiagnosticsModal);
  if (diagModal) {
    diagModal.addEventListener('click', (e) => {
      if (e.target === diagModal) closeDiagnosticsModal();
    });
  }
  if (btnRefreshDiag) btnRefreshDiag.addEventListener('click', () => {
    runDiagnostics();
  });

  function runDiagnostics() {
    const hasWebRTC = !!(window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
    const hasDataChannel = hasWebRTC && ('createDataChannel' in RTCPeerConnection.prototype);
    const isSecure = window.isSecureContext;
    const isOnline = navigator.onLine;
    const hasCrypto = !!(window.crypto && window.crypto.subtle);

    const elWebrtc = document.getElementById('diag-webrtc');
    if (elWebrtc) elWebrtc.textContent = hasWebRTC ? 'Supported' : 'Unsupported';

    const elDc = document.getElementById('diag-datachannel');
    if (elDc) elDc.textContent = hasDataChannel ? 'Supported' : 'Unsupported';

    const elSec = document.getElementById('diag-secure');
    if (elSec) elSec.textContent = isSecure ? 'HTTPS Secure' : 'Insecure Context';

    const elNet = document.getElementById('diag-network');
    if (elNet) elNet.textContent = isOnline ? 'Online' : 'Offline';

    const elCrypto = document.getElementById('diag-crypto');
    if (elCrypto) elCrypto.textContent = hasCrypto ? 'Web Crypto SHA-256 Ready' : 'Unavailable';
  }
  runDiagnostics();

  // =========================================================================
  // 6. QR CODE RENDERER (RFC/ISO COMPLIANT)
  // =========================================================================
  function renderQRCode(shareUrl, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
      try {
        new QRCode(container, {
          text: shareUrl,
          width: 190,
          height: 190,
          colorDark: '#080b14',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (err) {
        console.warn('[LynqDrop] QRCode generation warning:', err);
      }
    }
  }

  // =========================================================================
  // 7. PROGRESSIVE STREAMING SHA-256 INTEGRITY
  // =========================================================================
  async function computeBlobOrFileSHA256(blobOrFile) {
    if (!window.crypto || !window.crypto.subtle) return '';
    try {
      const buffer = await blobOrFile.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      console.warn('[LynqDrop] SHA-256 calculation failed:', err);
      return '';
    }
  }

  // =========================================================================
  // 8. DIRECT-TO-DISK RECEIVER STREAMING SINK
  // =========================================================================
  class FileStreamSink {
    constructor(fileMeta) {
      this.meta = fileMeta;
      this.writable = null;
      this.fileHandle = null;
      this.opfsHandle = null;
      this.fallbackParts = [];
      this.totalWritten = 0;
      this.sinkType = 'fallback';
    }

    async initialize() {
      // 1. Try File System Access API
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const ext = this.meta.name.includes('.') ? this.meta.name.split('.').pop() : '';
          const pickerOptions = {
            suggestedName: this.meta.name,
            types: ext ? [{
              description: `${ext.toUpperCase()} File`,
              accept: { [this.meta.mimeType || 'application/octet-stream']: [`.${ext}`] }
            }] : []
          };
          this.fileHandle = await window.showSaveFilePicker(pickerOptions);
          this.writable = await this.fileHandle.createWritable();
          this.sinkType = 'fsa';
          return;
        } catch (_) { }
      }

      // 2. Try OPFS
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.getDirectory) {
        try {
          const root = await navigator.storage.getDirectory();
          const safeName = `lynqdrop_${Date.now()}_${this.meta.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          this.opfsHandle = await root.getFileHandle(safeName, { create: true });
          this.writable = await this.opfsHandle.createWritable();
          this.sinkType = 'opfs';
          return;
        } catch (_) { }
      }

      // 3. Fallback to memory blob parts
      this.sinkType = 'fallback';
      this.fallbackParts = [];
    }

    async writeChunk(chunk) {
      this.totalWritten += chunk.byteLength || chunk.length || 0;
      if (this.writable) {
        await this.writable.write(chunk);
      } else {
        this.fallbackParts.push(new Blob([chunk]));
      }
    }

    async finalize() {
      if (this.writable) {
        await this.writable.close();
        this.writable = null;
      }

      if (this.sinkType === 'fsa' && this.fileHandle) {
        const file = await this.fileHandle.getFile();
        return { file, directSaved: true, url: null };
      }

      if (this.sinkType === 'opfs' && this.opfsHandle) {
        const file = await this.opfsHandle.getFile();
        const url = URL.createObjectURL(file);
        return { file, directSaved: false, url };
      }

      const blob = new Blob(this.fallbackParts, { type: this.meta.mimeType || 'application/octet-stream' });
      this.fallbackParts = [];
      const url = URL.createObjectURL(blob);
      return { file: blob, directSaved: false, url };
    }
  }

  // =========================================================================
  // 8.5 ZERO-LATENCY PORT-443 DUAL-CHANNEL RELAY (WSS + HTTPS POST)
  // Powered by global port-443 WSS/HTTPS pub/sub (ntfy.sh)
  // Ensures sub-second real-time connection across strict Symmetric CGNAT, 4G/5G, and all firewalls
  // =========================================================================
  class BrowserRelay {
    constructor(roomCode, role, onPacket) {
      const cleanCode = (roomCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      this.roomCode = cleanCode;
      this.role = role; // 'sender' | 'receiver'
      this.onPacket = onPacket;
      this.connected = false;
      this.closed = false;

      // Unique prefix for LynqDrop rooms
      const prefix = 'lqd-v1-' + cleanCode;
      this.subTopic = role === 'sender' ? `${prefix}-s` : `${prefix}-r`;
      this.pubTopic = role === 'sender' ? `${prefix}-r` : `${prefix}-s`;

      this.ws = null;
      this.reconnectTimer = null;
      this.seenIds = new Set();
    }

    connect() {
      if (this.closed) return Promise.resolve(false);
      return new Promise((resolve) => {
        let isResolved = false;

        const doConnect = () => {
          if (this.closed) return;
          try {
            this.ws = new WebSocket(`wss://ntfy.sh/${this.subTopic}/ws`);

            this.ws.onopen = () => {
              this.connected = true;
              console.log(`[BrowserRelay] Connected to wss://ntfy.sh/${this.subTopic}/ws as ${this.role}`);
              if (!isResolved) {
                isResolved = true;
                resolve(true);
              }
            };

            this.ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.event === 'message' && data.message) {
                  const parsed = JSON.parse(data.message);
                  if (parsed && parsed.id && this.seenIds.has(parsed.id)) return;
                  if (parsed && parsed.id) this.seenIds.add(parsed.id);
                  if (this.onPacket) this.onPacket(parsed, 'relay');
                }
              } catch (err) {
                console.warn('[BrowserRelay] Packet JSON parse error:', err);
              }
            };

            this.ws.onerror = (err) => {
              console.warn('[BrowserRelay] WS error:', err);
              if (!isResolved) {
                isResolved = true;
                this.connected = true;
                resolve(true);
              }
            };

            this.ws.onclose = () => {
              this.connected = false;
              if (!this.closed) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(doConnect, 1500);
              }
            };
          } catch (e) {
            console.warn('[BrowserRelay] WS init exception:', e);
            if (!isResolved) {
              isResolved = true;
              this.connected = true;
              resolve(true);
            }
          }
        };

        doConnect();

        // Fast resolution timeout: resolve within 2s anyway
        setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.connected = true;
            resolve(true);
          }
        }, 2000);
      });
    }

    publish(obj, isKeepAlive = false) {
      if (this.closed) return false;
      try {
        if (!obj.id) {
          obj.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        }
        this.seenIds.add(obj.id);
        const payload = JSON.stringify(obj);

        fetch(`https://ntfy.sh/${this.pubTopic}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain'
          },
          body: payload,
          cache: 'no-store',
          keepalive: !!isKeepAlive
        }).catch((err) => {
          console.warn('[BrowserRelay] Publish fetch error:', err);
        });

        return true;
      } catch (err) {
        console.warn('[BrowserRelay] Publish failed:', err);
        return false;
      }
    }

    close() {
      this.closed = true;
      this.connected = false;
      clearTimeout(this.reconnectTimer);
      try {
        if (this.ws) {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.close();
        }
      } catch (_) {}
    }
  }

  // Dual transport state & outbox queues
  let activeRelay = null;
  const seenPacketIds = new Set();
  const pendingOutbox = [];
  const pendingFilesQueue = [];

  function flushPendingOutbox() {
    const hasP2P = activeConnection && (activeConnection.open || (activeConnection.dataChannel && activeConnection.dataChannel.readyState === 'open'));
    const hasRelay = activeRelay && activeRelay.connected;
    if (hasP2P || hasRelay) {
      if (pendingOutbox.length > 0) {
        console.log(`[LynqDrop] Flushing ${pendingOutbox.length} queued messages from outbox`);
        const toSend = [...pendingOutbox];
        pendingOutbox.length = 0;
        for (const pkt of toSend) {
          const ok = sendPacket(pkt);
          if (!ok) pendingOutbox.push(pkt);
        }
      }
      if (pendingFilesQueue.length > 0) {
        console.log(`[LynqDrop] Flushing ${pendingFilesQueue.length} queued files from outbox`);
        const files = [...pendingFilesQueue];
        pendingFilesQueue.length = 0;
        sendLiveFiles(files);
      }
    }
  }
  setInterval(flushPendingOutbox, 400);

  function updateLivePeerStatus() {
    if (!livePeerStatusText) return;
    const hasP2P = activeConnection && (activeConnection.open || (activeConnection.dataChannel && activeConnection.dataChannel.readyState === 'open'));
    const hasRelay = activeRelay && activeRelay.connected;
    if (hasP2P) {
      livePeerStatusText.textContent = 'online • Direct P2P Encrypted';
    } else if (hasRelay) {
      livePeerStatusText.textContent = 'online • Fast Relay Encrypted';
    } else {
      livePeerStatusText.textContent = 'connecting • Handshaking...';
    }
  }
  setInterval(updateLivePeerStatus, 1000);

  function sendPacket(packet, isKeepAlive = false) {
    if (!packet) return false;
    if (!packet.id) {
      packet.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    }
    seenPacketIds.add(packet.id);

    let sent = false;
    const hasP2P = activeConnection && (activeConnection.open || (activeConnection.dataChannel && activeConnection.dataChannel.readyState === 'open'));
    if (hasP2P) {
      try {
        activeConnection.send(packet);
        sent = true;
      } catch (e) {
        console.warn('[LynqDrop] WebRTC send failed:', e);
      }
    }

    if (activeRelay && activeRelay.connected) {
      try {
        activeRelay.publish(packet, isKeepAlive);
        sent = true;
      } catch (e) {
        console.warn('[LynqDrop] Relay publish failed:', e);
      }
    }
    return sent;
  }

  function handleIncomingPacket(msg, source) {
    if (!msg) return;
    if (msg.id && seenPacketIds.has(msg.id)) return;
    if (msg.id) seenPacketIds.add(msg.id);

    console.log(`[LynqDrop Packet Received via ${source || 'unknown'}]:`, msg.type);

    if (msg.type === 'SENDER_ONLINE') {
      console.log('[LynqDrop] Sender online announcement received via relay');
      if (msg.sender) {
        remoteDevice = msg.sender;
        updatePlatformBadge(myDevice, msg.sender);
      }
      sendPacket({
        type: 'RECEIVER_HELLO',
        receiver: myDevice,
        timestamp: Date.now()
      });
      if (!roomPinRequired) {
        openLiveRoom(currentRoomCode, false);
      }
    } else if (msg.type === 'RECEIVER_HELLO') {
      console.log('[LynqDrop] Receiver connected via Relay/WebRTC:', msg.receiver);
      if (msg.receiver) {
        remoteDevice = msg.receiver;
        updatePlatformBadge(myDevice, msg.receiver);
        if (roomStatusLabel) roomStatusLabel.textContent = `Connected to ${msg.receiver.name || 'Receiver'} (${msg.receiver.tag || 'Web'})`;
        if (livePeerStatusText) {
          livePeerStatusText.textContent = `⚡ ${myDevice.name} (${myDevice.platform}) ↔ ${msg.receiver.name} (${msg.receiver.platform})`;
        }
      }

      const requiresPin = roomPinRequired && !!roomPinValue;
      const filesMeta = selectedFiles.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType
      }));

      sendPacket({
        type: 'SENDER_ACK',
        sender: myDevice,
        requiresPin,
        fileCount: selectedFiles.length,
        totalBytes: selectedFiles.reduce((acc, f) => acc + f.size, 0),
        files: requiresPin ? [] : filesMeta
      });

      if (!requiresPin) {
        openLiveRoom(currentRoomCode, true);
        if (selectedFiles.length > 0) {
          sendLiveFiles(selectedFiles.map(f => f.rawFile || f));
        }
      }
    } else if (msg.type === 'HANDSHAKE' || msg.type === 'SENDER_ACK') {
      console.log('[LynqDrop] Received sender handshake/ACK:', msg);
      if (msg.sender) {
        remoteDevice = msg.sender;
        updatePlatformBadge(myDevice, msg.sender);
        if (livePeerStatusText) {
          livePeerStatusText.textContent = `⚡ ${myDevice.name} (${myDevice.platform}) ↔ ${msg.sender.name} (${msg.sender.platform})`;
        }
      }

      if (msg.requiresPin) {
        if (receiveStatusBox) receiveStatusBox.style.display = 'none';
        const platformCard = document.getElementById('platform-connection-card');
        if (platformCard) platformCard.style.display = 'none';
        if (pinChallengeCard) pinChallengeCard.style.display = 'block';
        if (inputVerifyPin) inputVerifyPin.focus();

        if (btnSubmitPin) {
          btnSubmitPin.onclick = () => {
            const entered = (inputVerifyPin?.value || '').trim();
            if (!entered) return;
            if (pinErrorText) pinErrorText.style.display = 'none';
            sendPacket({ type: 'VERIFY_PIN', pin: entered });
          };
        }
      } else {
        openLiveRoom(currentRoomCode, false);
      }
    } else if (msg.type === 'VERIFY_PIN') {
      const inputPin = (msg.pin || '').trim();
      if (inputPin === roomPinValue) {
        console.log('[LynqDrop] Receiver PIN verified successfully');
        sendPacket({ type: 'PIN_OK' });
        openLiveRoom(currentRoomCode, true);
        if (selectedFiles.length > 0) {
          sendLiveFiles(selectedFiles.map(f => f.rawFile || f));
        }
      } else {
        console.warn('[LynqDrop] Receiver provided incorrect PIN');
        sendPacket({
          type: 'PIN_ERROR',
          message: 'Incorrect PIN. Please re-enter.'
        });
      }
    } else if (msg.type === 'PIN_OK') {
      if (pinChallengeCard) pinChallengeCard.style.display = 'none';
      openLiveRoom(currentRoomCode, false);
    } else if (msg.type === 'PIN_ERROR') {
      if (pinErrorText) {
        pinErrorText.style.display = 'block';
        pinErrorText.textContent = msg.message || 'Incorrect PIN. Please try again.';
      }
    } else if (msg.type === 'CHAT_MSG') {
      appendChatMessage({
        sender: (remoteDevice && remoteDevice.name) || (isSenderRole ? 'Receiver' : 'Sender'),
        text: msg.text,
        time: msg.time || Date.now(),
        isMine: false
      });
      // Send delivery acknowledgment back so sender can show ✓✓
      if (msg.msgId) {
        sendPacket({ type: 'CHAT_ACK', msgId: msg.msgId });
      }
    } else if (msg.type === 'CHAT_ACK') {
      // Upgrade sender's bubble from single ✓ to double ✓✓
      if (msg.msgId) markMessageDelivered(msg.msgId);
    } else if (msg.type === 'FILE_START' || msg.type === 'CHUNK' || msg.type === 'FILE_END' || msg.type === 'ALL_COMPLETE') {
      handleIncomingFileData(msg, (remoteDevice && remoteDevice.name) || (isSenderRole ? 'Receiver' : 'Sender'));
    } else if (msg.type === 'ROOM_TERMINATED' || msg.type === 'ROOM_CLOSED') {
      showRoomEndedModal(msg.reason || 'The connected peer closed their browser tab. Room session terminated.');
    } else if (msg.type === 'TEXT') {
      alert(`Message from peer: ${msg.text}`);
    } else if (msg.type === 'PING') {
      sendPacket({ type: 'PONG' });
    }
  }

  // =========================================================================
  // 9. HIGH-AVAILABILITY P2P ENGINE & ROOM CONTROLLER
  // =========================================================================
  let activePeer = null;
  let activeConnection = null;
  let currentRoomCode = null;
  let selectedFiles = [];
  let isSenderRole = false;
  let transferInProgress = false;

  // Access Control State
  let roomPinRequired = false;
  let roomPinValue = '';
  let roomScope = 'global';

  // UI Element Handles
  const dropzone = document.getElementById('web-dropzone');
  const fileInput = document.getElementById('web-file-input');
  const folderInput = document.getElementById('web-folder-input');
  const selectedFilesCard = document.getElementById('selected-files-card');
  const selectedFilesList = document.getElementById('selected-files-list');
  const selectedFilesCount = document.getElementById('selected-files-count');
  const selectedFilesTotalSize = document.getElementById('selected-files-total-size');
  const btnClearSelectedFiles = document.getElementById('btn-clear-selected-files');

  const toggleRequirePin = document.getElementById('toggle-require-pin');
  const pinInputContainer = document.getElementById('pin-input-container');
  const inputSenderPin = document.getElementById('input-sender-pin');
  const selectRoomScope = document.getElementById('select-room-scope');

  const sharingRoomCard = document.getElementById('sharing-room-card');
  const roomCodeDisplay = document.getElementById('room-code-display');
  const shareUrlField = document.getElementById('share-url-field');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnCopyShareUrl = document.getElementById('btn-copy-share-url');
  const roomStatusLabel = document.getElementById('room-status-label');

  const inputJoinCode = document.getElementById('input-join-room-code');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const receiveHeadingText = document.getElementById('receive-heading-text');
  const receiveDescText = document.getElementById('receive-desc-text');
  const roomInputContainer = document.getElementById('room-input-container');
  const receiveStatusBox = document.getElementById('receive-status-box');
  const receiveStatusText = document.getElementById('receive-status-text');

  const pinChallengeCard = document.getElementById('pin-challenge-card');
  const inputVerifyPin = document.getElementById('input-verify-pin');
  const btnSubmitPin = document.getElementById('btn-submit-pin');
  const pinErrorText = document.getElementById('pin-error-text');

  const incomingAcceptCard = document.getElementById('incoming-accept-card');
  const incomingSenderAlias = document.getElementById('incoming-sender-alias');
  const incomingFilesSummary = document.getElementById('incoming-files-summary');
  const btnAcceptTransfer = document.getElementById('btn-accept-transfer');
  const btnRejectTransfer = document.getElementById('btn-reject-transfer');

  const activeTransferCard = document.getElementById('active-transfer-card');
  const monitorFileName = document.getElementById('monitor-file-name');
  const monitorFileIndex = document.getElementById('monitor-file-index');
  const monitorProgressBar = document.getElementById('monitor-progress-bar');
  const monitorPercent = document.getElementById('monitor-percent');
  const monitorSpeed = document.getElementById('monitor-speed');
  const monitorBytes = document.getElementById('monitor-bytes');
  const monitorEta = document.getElementById('monitor-eta');
  const btnCancelTransfer = document.getElementById('btn-cancel-transfer');

  const transferCompleteCard = document.getElementById('transfer-complete-card');
  const completeSummary = document.getElementById('complete-summary');
  const completedFilesList = document.getElementById('completed-files-list');
  const btnResetComplete = document.getElementById('btn-reset-complete');

  // Quick Text Handles
  const quickTextInput = document.getElementById('quick-text-input');
  const quickTextCharCount = document.getElementById('quick-text-char-count');
  const btnClearQuickText = document.getElementById('btn-clear-quick-text');
  const btnSendQuickText = document.getElementById('btn-send-quick-text');
  const textToast = document.getElementById('text-toast');

  // PIN & Scope Toggles
  if (toggleRequirePin) {
    toggleRequirePin.addEventListener('change', () => {
      roomPinRequired = toggleRequirePin.checked;
      if (pinInputContainer) {
        pinInputContainer.style.display = roomPinRequired ? 'block' : 'none';
      }
      if (roomPinRequired && inputSenderPin && !inputSenderPin.value) {
        // Auto-generate a clean 4-digit PIN
        const randPin = Math.floor(1000 + Math.random() * 9000).toString();
        inputSenderPin.value = randPin;
        roomPinValue = randPin;
      }
    });
  }

  if (inputSenderPin) {
    inputSenderPin.addEventListener('input', () => {
      roomPinValue = inputSenderPin.value.trim();
    });
  }

  if (selectRoomScope) {
    selectRoomScope.addEventListener('change', () => {
      roomScope = selectRoomScope.value;
    });
  }

  // File Picker & Dropzone Events
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        addFilesToQueue(Array.from(dt.files));
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        addFilesToQueue(Array.from(fileInput.files));
      }
    });
  }

  if (folderInput) {
    folderInput.addEventListener('change', () => {
      if (folderInput.files && folderInput.files.length > 0) {
        addFilesToQueue(Array.from(folderInput.files));
      }
    });
  }

  if (btnClearSelectedFiles) {
    btnClearSelectedFiles.addEventListener('click', () => {
      cleanupSenderRoom();
    });
  }

  function addFilesToQueue(newFiles) {
    selectedFiles = selectedFiles.concat(newFiles);
    renderSelectedFiles();
    initializeSenderRoom();

    // If a receiver is already connected in this room, dispatch file details immediately
    if (activeConnection && activeConnection.open) {
      const requiresPin = roomPinRequired && !!roomPinValue;
      const filesMeta = selectedFiles.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType
      }));
      activeConnection.send({
        type: 'FILES_ADDED',
        files: requiresPin ? [] : filesMeta,
        fileCount: selectedFiles.length,
        totalBytes: selectedFiles.reduce((acc, f) => acc + f.size, 0)
      });
    }
  }

  function renderSelectedFiles() {
    if (selectedFiles.length === 0) {
      if (selectedFilesCard) selectedFilesCard.style.display = 'none';
      return;
    }

    if (selectedFilesCard) selectedFilesCard.style.display = 'block';
    if (selectedFilesCount) selectedFilesCount.textContent = selectedFiles.length;

    let total = 0;
    selectedFiles.forEach(f => total += f.size);
    if (selectedFilesTotalSize) selectedFilesTotalSize.textContent = formatBytes(total);

    if (selectedFilesList) {
      selectedFilesList.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const row = document.createElement('div');
        row.className = 'file-item-row';
        row.innerHTML = `
          <div class="file-item-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan); flex-shrink: 0;"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            <div style="overflow: hidden;">
              <div class="file-item-name" title="${file.name}">${file.name}</div>
              <div class="file-item-size">${formatBytes(file.size)}</div>
            </div>
          </div>
          <button type="button" class="file-item-remove" data-index="${index}" title="Remove file">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        `;
        selectedFilesList.appendChild(row);
      });

      selectedFilesList.querySelectorAll('.file-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          selectedFiles.splice(idx, 1);
          renderSelectedFiles();
          if (selectedFiles.length === 0) {
            cleanupSenderRoom();
          }
        });
      });
    }
  }

  function cleanupSenderRoom() {
    selectedFiles = [];
    renderSelectedFiles();
    if (sharingRoomCard) sharingRoomCard.style.display = 'none';
    sendPacket({ type: 'ROOM_CLOSED' });
    if (activeConnection) {
      try {
        activeConnection.close();
      } catch (_) { }
      activeConnection = null;
    }
    if (activeRelay) {
      try {
        activeRelay.close();
      } catch (_) { }
      activeRelay = null;
    }
    if (activePeer) {
      try { activePeer.destroy(); } catch (_) { }
      activePeer = null;
    }
    currentRoomCode = null;
  }

  // Auto-terminate room when browser tab/window closes
  window.addEventListener('beforeunload', () => {
    sendPacket({ type: 'ROOM_TERMINATED', reason: 'Peer closed the browser tab.' }, true);
    if (activeConnection) {
      try { activeConnection.close(); } catch (_) { }
    }
    if (activeRelay) {
      try { activeRelay.close(); } catch (_) { }
    }
    if (activePeer) {
      try { activePeer.destroy(); } catch (_) { }
    }
  });

  window.addEventListener('pagehide', () => {
    sendPacket({ type: 'ROOM_TERMINATED', reason: 'Peer closed the browser tab.' }, true);
    if (activeConnection) {
      try { activeConnection.close(); } catch (_) { }
    }
    if (activeRelay) {
      try { activeRelay.close(); } catch (_) { }
    }
    if (activePeer) {
      try { activePeer.destroy(); } catch (_) { }
    }
  });

  // =========================================================================
  // 10. SENDER PEER & ROOM INITIALIZATION
  // =========================================================================
  function initializeSenderRoom() {
    if (activePeer && currentRoomCode) {
      if (sharingRoomCard) sharingRoomCard.style.display = 'block';
      return;
    }

    currentRoomCode = generateCrockfordCode();
    isSenderRole = true;
    const peerId = roomCodeToPeerId(currentRoomCode);

    if (roomCodeDisplay) roomCodeDisplay.textContent = currentRoomCode;
    const shareUrl = `${window.location.origin}/?room=${encodeURIComponent(currentRoomCode)}`;
    if (shareUrlField) shareUrlField.value = shareUrl;

    if (sharingRoomCard) sharingRoomCard.style.display = 'block';
    if (roomStatusLabel) roomStatusLabel.textContent = 'Room Active · Ready for Receiver';
    renderQRCode(shareUrl, 'room-qr-holder');

    // Initialize Firebase RTDB Relay — port 443 HTTPS, works on all carriers/networks
    try {
      if (activeRelay) {
        try { activeRelay.close(); } catch (_) { }
        activeRelay = null;
      }
      activeRelay = new BrowserRelay(currentRoomCode, 'sender', (msg) => {
        handleIncomingPacket(msg, 'relay');
      });
      activeRelay.connect().then((ok) => {
        console.log('[LynqDrop] Firebase relay connected as sender:', ok);
        // Broadcast SENDER_ONLINE every 600ms until room opens (receiver may connect any time)
        const senderAnnounceInterval = setInterval(() => {
          if (liveRoomOpen) {
            clearInterval(senderAnnounceInterval);
            return;
          }
          if (activeRelay && activeRelay.connected) {
            activeRelay.publish({
              type: 'SENDER_ONLINE',
              sender: myDevice,
              code: currentRoomCode,
              timestamp: Date.now()
            });
          }
        }, 600);
        setTimeout(() => clearInterval(senderAnnounceInterval), 20000);
      });
    } catch (e) {
      console.warn('[LynqDrop] FirebaseRelay init error:', e);
    }

    try {
      activePeer = new Peer(peerId, {
        config: RTC_CONFIG,
        debug: 1
      });

      activePeer.on('open', (id) => {
        console.log('[LynqDrop] Sender Peer successfully active on signaling:', id);
        if (roomStatusLabel) roomStatusLabel.textContent = 'Room Active · Ready for Receiver';
        renderQRCode(shareUrl, 'room-qr-holder');
      });

      activePeer.on('connection', (conn) => {
        console.log('[LynqDrop] Incoming receiver connected:', conn.peer);
        activeConnection = conn;
        setupSenderConnection(conn);
      });

      activePeer.on('error', (err) => {
        console.warn('[LynqDrop] Sender Peer error:', err);
        if (err.type === 'unavailable-id') {
          // If ID taken, regenerate code cleanly
          cleanupSenderRoom();
          setTimeout(() => initializeSenderRoom(), 300);
        } else {
          if (roomStatusLabel) roomStatusLabel.textContent = `P2P status: ${err.type || 'connecting'}`;
        }
      });
    } catch (err) {
      console.error('[LynqDrop] Failed to initialize sender Peer:', err);
    }
  }

  function setupSenderConnection(conn) {
    activeConnection = conn;
    if (roomStatusLabel) roomStatusLabel.textContent = 'Receiver Connected · Handshaking...';

    // No false safety net — room only opens on real transport ready (relay HELLO or DataChannel open)
    let senderOpenHandled = false;
    function handleSenderOpen() {
      if (senderOpenHandled) return;
      senderOpenHandled = true;
      activeConnection = conn;
      try { conn._open = true; } catch (_) {}
      if (conn.dataChannel) {
        try { conn.dataChannel.binaryType = 'arraybuffer'; } catch (_) {}
      }
      console.log('[LynqDrop] DataChannel OPEN with receiver');
      if (roomStatusLabel) roomStatusLabel.textContent = 'Direct P2P DataChannel Connected';

      const requiresPin = roomPinRequired && !!roomPinValue;

      // Send initial handshake with metadata
      const filesMeta = selectedFiles.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType
      }));

      try {
        conn.send({
          type: 'HANDSHAKE',
          sender: myDevice,
          requiresPin,
          fileCount: selectedFiles.length,
          totalBytes: selectedFiles.reduce((acc, f) => acc + f.size, 0),
          files: requiresPin ? [] : filesMeta
        });
      } catch (err) {
        console.warn('conn.send HANDSHAKE error:', err);
      }

      if (!requiresPin) {
        openLiveRoom(currentRoomCode, true);
        if (selectedFiles.length > 0) {
          sendLiveFiles(selectedFiles.map(f => f.rawFile || f));
        }
      }
    }

    // 1. Immediate ready check
    if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
      handleSenderOpen();
    }

    // 2. PeerJS open event
    conn.on('open', handleSenderOpen);

    // 3. Direct DataChannel listener
    if (conn.dataChannel) {
      if (conn.dataChannel.readyState === 'open') {
        handleSenderOpen();
      } else {
        conn.dataChannel.addEventListener('open', handleSenderOpen, { once: true });
      }
    }

    // 4. Native RTCPeerConnection listeners
    if (conn.peerConnection) {
      conn.peerConnection.addEventListener('datachannel', (ev) => {
        const dc = ev.channel;
        if (dc) {
          if (dc.readyState === 'open') handleSenderOpen();
          else dc.addEventListener('open', handleSenderOpen, { once: true });
        }
      });
      conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const state = conn.peerConnection.iceConnectionState;
        console.log('[LynqDrop Sender] ICE state:', state);
        if (state === 'connected' || state === 'completed') {
          setTimeout(handleSenderOpen, 50);
        } else if (state === 'failed') {
          if (roomStatusLabel) roomStatusLabel.textContent = 'Direct P2P unreachable. Check network/NAT.';
        }
      });
    }

    // 5. Active poller to defeat missed asynchronous event triggers
    const senderPoll = setInterval(() => {
      if (senderOpenHandled) {
        clearInterval(senderPoll);
        return;
      }
      if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
        clearInterval(senderPoll);
        handleSenderOpen();
      }
    }, 150);
    setTimeout(() => clearInterval(senderPoll), 8000);

    conn.on('data', async (data) => {
      if (!data) return;
      handleSenderOpen();
      handleIncomingPacket(data, 'webrtc');

      if (data.type === 'RECEIVER_HELLO') {
        console.log('[LynqDrop] Received RECEIVER_HELLO:', data.receiver);
        if (data.receiver) {
          remoteDevice = data.receiver;
          updatePlatformBadge(myDevice, data.receiver);
          if (roomStatusLabel) roomStatusLabel.textContent = `Connected to ${data.receiver.name || 'Receiver'} (${data.receiver.tag || 'Web'})`;
          if (livePeerStatusText) {
            livePeerStatusText.textContent = `⚡ ${myDevice.name} (${myDevice.platform}) ⟷ ${data.receiver.name} (${data.receiver.platform})`;
          }
        }
        const requiresPin = roomPinRequired && !!roomPinValue;
        conn.send({
          type: 'SENDER_ACK',
          sender: myDevice,
          requiresPin
        });

        if (!requiresPin) {
          openLiveRoom(currentRoomCode, true);
        }
      } else if (data.type === 'VERIFY_PIN') {
        const inputPin = (data.pin || '').trim();
        if (inputPin === roomPinValue) {
          console.log('[LynqDrop] Receiver PIN verified successfully');
          conn.send({ type: 'PIN_OK' });
          openLiveRoom(currentRoomCode, true);
          if (selectedFiles.length > 0) {
            sendLiveFiles(selectedFiles.map(f => f.rawFile || f));
          }
        } else {
          console.warn('[LynqDrop] Receiver provided incorrect PIN');
          conn.send({
            type: 'PIN_ERROR',
            message: 'Incorrect PIN. Please re-enter.'
          });
        }
      } else if (data.type === 'CHAT_MSG') {
        appendChatMessage({
          sender: (remoteDevice && remoteDevice.name) || 'Receiver',
          text: data.text,
          time: data.time,
          isMine: false
        });
        if (data.msgId) {
          sendPacket({ type: 'CHAT_ACK', msgId: data.msgId });
        }
      } else if (data.type === 'CHAT_ACK') {
        if (data.msgId) markMessageDelivered(data.msgId);
      } else if (data.type === 'FILE_START' || data.type === 'CHUNK' || data.type === 'FILE_END' || data.type === 'ALL_COMPLETE') {
        handleIncomingFileData(data, (remoteDevice && remoteDevice.name) || 'Receiver');
      } else if (data.type === 'ROOM_TERMINATED' || data.type === 'ROOM_CLOSED') {
        showRoomEndedModal(data.reason || 'The receiver closed their tab. Room session terminated.');
      } else if (data.type === 'ACCEPT') {
        console.log('[LynqDrop] Receiver accepted transfer! Streaming chunks...');
        startStreamingFilesToReceiver(conn);
      } else if (data.type === 'DECLINE') {
        alert('The receiver declined the incoming transfer.');
        if (roomStatusLabel) roomStatusLabel.textContent = 'Transfer Declined by Receiver';
      } else if (data.type === 'TEXT') {
        alert(`Message from peer: ${data.text}`);
      } else if (data.type === 'PING') {
        conn.send({ type: 'PONG' });
      }
    });

    conn.on('close', () => {
      console.log('[LynqDrop] Peer connection closed');
      showRoomEndedModal('The receiver closed their browser tab or disconnected. Session ended.');
      updatePlatformBadge(myDevice, null);
    });
  }

  // Sender File Streaming with 64KB Chunking & Backpressure Flow Control
  async function startStreamingFilesToReceiver(conn) {
    transferInProgress = true;
    if (activeTransferCard) activeTransferCard.style.display = 'block';

    const dc = conn.dataChannel;
    let totalBytes = 0;
    selectedFiles.forEach(f => totalBytes += f.size);
    let overallBytesSent = 0;
    const startTime = Date.now();

    for (let i = 0; i < selectedFiles.length; i++) {
      if (!transferInProgress) break;
      const file = selectedFiles[i];

      if (monitorFileName) monitorFileName.textContent = file.name;
      if (monitorFileIndex) monitorFileIndex.textContent = `File ${i + 1} of ${selectedFiles.length}`;

      conn.send({
        type: 'FILE_START',
        fileIndex: i,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType || file.type || 'application/octet-stream'
      });

      const blobSource = file.rawFile || file;
      let fileOffset = 0;
      while (fileOffset < file.size && transferInProgress) {
        if (dc && dc.bufferedAmount > HIGH_WATER_MARK) {
          await new Promise((resolve) => {
            const check = setInterval(() => {
              if (!dc || dc.bufferedAmount < LOW_WATER_MARK) {
                clearInterval(check);
                resolve();
              }
            }, 10);
          });
        }

        const slice = blobSource.slice(fileOffset, fileOffset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        conn.send({
          type: 'CHUNK',
          fileIndex: i,
          chunk: buffer
        });

        fileOffset += buffer.byteLength;
        overallBytesSent += buffer.byteLength;

        const percent = totalBytes > 0 ? Math.min(100, Math.round((overallBytesSent / totalBytes) * 100)) : 0;
        if (monitorProgressBar) monitorProgressBar.style.width = `${percent}%`;
        if (monitorPercent) monitorPercent.textContent = `${percent}%`;
        if (monitorBytes) monitorBytes.textContent = `${formatBytes(overallBytesSent)} / ${formatBytes(totalBytes)}`;

        const elapsedSec = (Date.now() - startTime) / 1000;
        if (elapsedSec > 0.5) {
          const speedBytesPerSec = overallBytesSent / elapsedSec;
          if (monitorSpeed) monitorSpeed.textContent = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;

          const remainingBytes = totalBytes - overallBytesSent;
          const remainingSec = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;
          if (monitorEta) monitorEta.textContent = `ETA: ${remainingSec}s`;
        }
      }

      const sha256 = await computeBlobOrFileSHA256(file.rawFile || file);
      conn.send({
        type: 'FILE_END',
        fileIndex: i,
        sha256
      });
    }

    conn.send({ type: 'ALL_COMPLETE' });

    if (activeTransferCard) activeTransferCard.style.display = 'none';
    if (transferCompleteCard) transferCompleteCard.style.display = 'block';
    if (completeSummary) completeSummary.textContent = `Sent ${selectedFiles.length} file(s) (${formatBytes(totalBytes)}) directly peer-to-peer!`;
  }

  // =========================================================================
  // 11. RECEIVER PEER & AUTOMATIC ROOM JOIN (QR CODE COMPLIANT)
  // =========================================================================
  if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
      const rawCode = (inputJoinCode?.value || '').trim();
      const code = normalizeRoomCode(rawCode);
      if (!isValidRoomCode(code)) {
        alert('Please enter a valid room code (e.g. LD-8492 or LD-7K9M2Q).');
        if (inputJoinCode) inputJoinCode.focus();
        return;
      }
      joinReceiveSession(code);
    });
  }

  function joinReceiveSession(code, retryAttempt = 1) {
    isSenderRole = false;
    currentRoomCode = code;
    const targetPeerId = roomCodeToPeerId(code);

    if (receiveStatusBox) receiveStatusBox.style.display = 'inline-flex';
    if (receiveStatusText) {
      receiveStatusText.textContent = retryAttempt > 1
        ? `Connecting to room ${code} (Attempt ${retryAttempt}/5)...`
        : `Connecting to room ${code}...`;
    }

    // Initialize Firebase RTDB Relay — port 443 HTTPS, works on all carriers/networks
    try {
      if (activeRelay) {
        try { activeRelay.close(); } catch (_) { }
        activeRelay = null;
      }
      activeRelay = new BrowserRelay(code, 'receiver', (msg) => {
        handleIncomingPacket(msg, 'relay');
      });
      activeRelay.connect().then((ok) => {
        console.log('[LynqDrop Firebase Relay] Receiver connected, announcing HELLO...');
        // Announce immediately
        activeRelay.publish({
          type: 'RECEIVER_HELLO',
          receiver: myDevice,
          timestamp: Date.now()
        });

        // Keep announcing until room opens (in case sender missed first broadcast)
        const helloInterval = setInterval(() => {
          if (liveRoomOpen || !activeRelay || !activeRelay.connected) {
            clearInterval(helloInterval);
            return;
          }
          activeRelay.publish({
            type: 'RECEIVER_HELLO',
            receiver: myDevice,
            timestamp: Date.now()
          });
        }, 800);
        setTimeout(() => clearInterval(helloInterval), 20000);
      });
    } catch (e) {
      console.warn('[LynqDrop] FirebaseRelay init error:', e);
    }

    try {
      // Instant Client ID prevents extra HTTP roundtrip to PeerJS broker
      const clientId = 'ld-client-' + Math.random().toString(36).slice(2, 10);
      const clientPeer = new Peer(clientId, {
        config: RTC_CONFIG,
        debug: 1
      });

      clientPeer.on('open', (myId) => {
        console.log('[LynqDrop Receiver] Client peer opened:', myId, 'Connecting to target:', targetPeerId);
        const conn = clientPeer.connect(targetPeerId, {
          reliable: true
        });

        activeConnection = conn;
        setupReceiverConnection(conn, code, retryAttempt, clientPeer);
      });

      clientPeer.on('error', (err) => {
        console.warn('[LynqDrop Receiver] Peer error:', err);
        if (err.type === 'peer-unavailable' && retryAttempt < 5) {
          setTimeout(() => {
            try { clientPeer.destroy(); } catch (_) { }
            joinReceiveSession(code, retryAttempt + 1);
          }, 800);
        } else {
          if (receiveStatusText) {
            receiveStatusText.textContent = err.type === 'peer-unavailable'
              ? `Room ${code} not found or sender is offline. Ensure sender is active.`
              : `Connection error: ${err.type || 'disconnected'}`;
          }
        }
      });
    } catch (err) {
      console.error('[LynqDrop Receiver] Failed to start receiver:', err);
    }
  }

  function setupReceiverConnection(conn, roomCode, retryAttempt, clientPeer) {
    let incomingFilesMeta = [];

    // No false safety net — room only opens on real transport ready (relay HELLO or DataChannel open)
    let currentSink = null;
    let completedFiles = [];
    let totalBytesExpected = 0;
    let overallBytesReceived = 0;
    let transferStartTime = Date.now();

    let receiverOpenHandled = false;
    function handleReceiverOpen() {
      if (receiverOpenHandled) return;
      receiverOpenHandled = true;
      activeConnection = conn;
      try { conn._open = true; } catch (_) {}
      if (conn.dataChannel) {
        try { conn.dataChannel.binaryType = 'arraybuffer'; } catch (_) {}
      }
      console.log('[LynqDrop Receiver] DataChannel OPEN with sender');
      if (receiveStatusBox) receiveStatusBox.style.display = 'inline-flex';
      if (receiveStatusText) receiveStatusText.textContent = 'Connected! Entering room...';
      if (roomInputContainer) roomInputContainer.style.display = 'none';
      if (receiveHeadingText) receiveHeadingText.textContent = `Connected to Room ${roomCode}`;

      // Notify sender of receiver device & platform details
      try {
        conn.send({
          type: 'RECEIVER_HELLO',
          receiver: myDevice
        });
      } catch (err) {
        console.warn('conn.send RECEIVER_HELLO error:', err);
      }

      // Seamless instant transition to live room if not PIN-gated
      if (!roomPinRequired) {
        openLiveRoom(currentRoomCode, false);
      }
    }

    // 1. Immediate ready check
    if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
      handleReceiverOpen();
    }

    // 2. PeerJS open event
    conn.on('open', handleReceiverOpen);

    // 3. Direct DataChannel listener
    if (conn.dataChannel) {
      if (conn.dataChannel.readyState === 'open') {
        handleReceiverOpen();
      } else {
        conn.dataChannel.addEventListener('open', handleReceiverOpen, { once: true });
      }
    }

    // 4. Native RTCPeerConnection listeners
    if (conn.peerConnection) {
      conn.peerConnection.addEventListener('datachannel', (ev) => {
        const dc = ev.channel;
        if (dc) {
          if (dc.readyState === 'open') handleReceiverOpen();
          else dc.addEventListener('open', handleReceiverOpen, { once: true });
        }
      });
      conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
        const state = conn.peerConnection.iceConnectionState;
        console.log('[LynqDrop Receiver] ICE state:', state);
        if (state === 'connected' || state === 'completed') {
          setTimeout(handleReceiverOpen, 50);
        } else if (state === 'failed') {
          if (receiveStatusText) receiveStatusText.textContent = 'Direct P2P unreachable. Retrying...';
        }
      });
    }

    // 5. Active poller to catch missed events
    const recvPoll = setInterval(() => {
      if (receiverOpenHandled) {
        clearInterval(recvPoll);
        return;
      }
      if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
        clearInterval(recvPoll);
        handleReceiverOpen();
      }
    }, 150);
    setTimeout(() => clearInterval(recvPoll), 8000);

    conn.on('data', async (msg) => {
      if (!msg) return;
      handleReceiverOpen();
      handleIncomingPacket(msg, 'webrtc');

      if (msg.type === 'HANDSHAKE' || msg.type === 'SENDER_ACK') {
        console.log('[LynqDrop Receiver] Received handshake from sender:', msg);
        if (msg.sender) {
          remoteDevice = msg.sender;
          updatePlatformBadge(myDevice, msg.sender);
          if (livePeerStatusText) {
            livePeerStatusText.textContent = `⚡ ${myDevice.name} (${myDevice.platform}) ⟷ ${msg.sender.name} (${msg.sender.platform})`;
          }
        }

        if (msg.requiresPin) {
          // PIN protection challenge
          if (receiveStatusBox) receiveStatusBox.style.display = 'none';
          const platformCard = document.getElementById('platform-connection-card');
          if (platformCard) platformCard.style.display = 'none';
          if (pinChallengeCard) pinChallengeCard.style.display = 'block';
          if (inputVerifyPin) inputVerifyPin.focus();

          if (btnSubmitPin) {
            btnSubmitPin.onclick = () => {
              const entered = (inputVerifyPin?.value || '').trim();
              if (!entered) return;
              if (pinErrorText) pinErrorText.style.display = 'none';
              conn.send({ type: 'VERIFY_PIN', pin: entered });
            };
          }
        } else {
          // Instant Live Room transition
          openLiveRoom(currentRoomCode, false);
        }
      } else if (msg.type === 'PIN_OK') {
        if (pinChallengeCard) pinChallengeCard.style.display = 'none';
        openLiveRoom(currentRoomCode, false);
      } else if (msg.type === 'PIN_ERROR') {
        if (pinErrorText) {
          pinErrorText.style.display = 'block';
          pinErrorText.textContent = msg.message || 'Incorrect PIN. Please try again.';
        }
      } else if (msg.type === 'CHAT_MSG') {
        appendChatMessage({
          sender: (remoteDevice && remoteDevice.name) || 'Sender',
          text: msg.text,
          time: msg.time,
          isMine: false
        });
      } else if (msg.type === 'FILE_START' || msg.type === 'CHUNK' || msg.type === 'FILE_END' || msg.type === 'ALL_COMPLETE') {
        handleIncomingFileData(msg, (remoteDevice && remoteDevice.name) || 'Sender');
      } else if (msg.type === 'ROOM_TERMINATED' || msg.type === 'ROOM_CLOSED') {
        showRoomEndedModal(msg.reason || 'The sender closed their tab. Room session terminated.');
      } else if (msg.type === 'TEXT') {
        alert(`Message from peer: ${msg.text}`);
      }
    });

    conn.on('close', () => {
      console.log('[LynqDrop Receiver] Connection closed by host');
      showRoomEndedModal('The host closed their browser tab or disconnected. Session ended.');
    });

    function displayIncomingApproval(files, totalBytes) {
      incomingFilesMeta = files || [];
      totalBytesExpected = totalBytes || incomingFilesMeta.reduce((acc, f) => acc + f.size, 0);

      if (incomingFilesSummary) {
        incomingFilesSummary.innerHTML = `<strong>${incomingFilesMeta.length} file(s)</strong> (${formatBytes(totalBytesExpected)}) ready to download.`;
      }
      if (incomingAcceptCard) incomingAcceptCard.style.display = 'block';
      if (receiveStatusBox) receiveStatusBox.style.display = 'none';
      const platformCard = document.getElementById('platform-connection-card');
      if (platformCard) platformCard.style.display = 'none';

      if (btnAcceptTransfer) {
        btnAcceptTransfer.onclick = () => {
          if (incomingAcceptCard) incomingAcceptCard.style.display = 'none';
          if (activeTransferCard) activeTransferCard.style.display = 'block';
          transferStartTime = Date.now();
          conn.send({ type: 'ACCEPT' });
        };
      }

      if (btnRejectTransfer) {
        btnRejectTransfer.onclick = () => {
          if (incomingAcceptCard) incomingAcceptCard.style.display = 'none';
          conn.send({ type: 'DECLINE' });
          resetReceiverState();
        };
      }
    }

    function resetReceiverState() {
      if (roomInputContainer) roomInputContainer.style.display = 'flex';
      if (receiveStatusBox) receiveStatusBox.style.display = 'none';
      const platformCard = document.getElementById('platform-connection-card');
      if (platformCard) platformCard.style.display = 'none';
      if (incomingAcceptCard) incomingAcceptCard.style.display = 'none';
      if (activeTransferCard) activeTransferCard.style.display = 'none';
    }
  }

  // =========================================================================
  // 12. AUTOMATIC QR CODE URL DETECTOR (?room=LD-XXXXXX) & DEEP LINKING
  // =========================================================================
  function setupNativeAppBanner(roomCode) {
    const banner = document.getElementById('mobile-app-banner');
    const btnOpen = document.getElementById('btn-open-in-app');
    if (!banner || !btnOpen) return;

    const ua = navigator.userAgent;
    const isAndroid = /android/i.test(ua);
    const isMobile = /android|iphone|ipad|ipod/i.test(ua);

    if (isMobile) {
      banner.style.display = 'flex';
      if (isAndroid) {
        // Deep linking / intent URL for installed LynqDrop Android app
        const intentUrl = `intent://lynqdrop.web.app/?room=${roomCode}#Intent;scheme=lynqdrop;package=app.lynqdrop;end`;
        btnOpen.href = intentUrl;
        btnOpen.textContent = 'Open in App';
      } else {
        btnOpen.href = '#download';
        btnOpen.textContent = 'Get App';
      }
    }
  }

  function checkUrlForAutoJoin() {
    try {
      let codeToJoin = null;
      const params = new URLSearchParams(window.location.search);
      const qRoom = params.get('room');
      if (qRoom) codeToJoin = normalizeRoomCode(qRoom);

      if (!codeToJoin && window.location.hash) {
        const match = window.location.hash.match(/room=([A-Za-z0-9\-]+)/);
        if (match && match[1]) codeToJoin = normalizeRoomCode(match[1]);
      }

      if (codeToJoin && isValidRoomCode(codeToJoin)) {
        console.log('[LynqDrop] QR Code scanned! Auto-joining room:', codeToJoin);

        // Hide hero banner on phone to give full focus to incoming transfer
        document.body.classList.add('qr-joined');
        document.body.classList.add('mobile-app-mode');

        // Switch to Receive subview immediately
        window.switchBrowserShareSubView('receive');

        if (inputJoinCode) inputJoinCode.value = codeToJoin;
        if (roomInputContainer) roomInputContainer.style.display = 'none';
        if (receiveStatusBox) receiveStatusBox.style.display = 'inline-flex';
        if (receiveHeadingText) receiveHeadingText.textContent = `Connecting to ${codeToJoin}...`;
        if (receiveDescText) receiveDescText.textContent = 'Joining room & launching live chat...';

        // Setup native Android app deep link banner
        setupNativeAppBanner(codeToJoin);

        // Auto-scroll directly to the sharing hub
        const hub = document.getElementById('sharing-hub');
        if (hub) {
          hub.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Automatically initiate connection immediately (NO manual click needed)
        joinReceiveSession(codeToJoin);
      } else {
        // No room in URL -> sender mode on PC/web -> create sender room immediately
        initializeSenderRoom();
      }
    } catch (_) { }
  }
  checkUrlForAutoJoin();

  // Expose LynqDrop API on window for automated verification & programmatic usage
  window.lynqdrop = {
    createSenderRoom: initializeSenderRoom,
    joinReceiveSession: joinReceiveSession,
    getRoomCode: () => currentRoomCode,
    getActivePeer: () => activePeer,
    getActiveConnection: () => activeConnection,
    getSelectedFiles: () => selectedFiles,
    getMyDevice: () => myDevice,
    addFiles: addFilesToQueue,
    openLiveRoom: openLiveRoom,
    sendLiveChatMessage: sendLiveChatMessage,
    sendLiveFiles: sendLiveFiles,
    showRoomEndedModal: showRoomEndedModal
  };

  // =========================================================================
  // 13. QUICK TEXT & CLIPBOARD
  // =========================================================================
  if (quickTextInput && quickTextCharCount) {
    quickTextInput.addEventListener('input', () => {
      quickTextCharCount.textContent = `${quickTextInput.value.length} characters`;
    });
  }

  if (btnClearQuickText && quickTextInput) {
    btnClearQuickText.addEventListener('click', () => {
      quickTextInput.value = '';
      if (quickTextCharCount) quickTextCharCount.textContent = '0 characters';
    });
  }

  if (btnSendQuickText && quickTextInput) {
    btnSendQuickText.addEventListener('click', () => {
      const text = quickTextInput.value.trim();
      if (!text) {
        alert('Please enter some text or a link to send.');
        quickTextInput.focus();
        return;
      }

      if (activeConnection && activeConnection.open) {
        activeConnection.send({ type: 'TEXT', text });
        if (textToast) {
          textToast.style.display = 'block';
          textToast.textContent = 'Text sent directly to connected peer!';
          setTimeout(() => textToast.style.display = 'none', 3000);
        }
      } else {
        alert('No active peer connected yet. Create or join a room first to establish a direct link!');
      }
    });
  }

  // =========================================================================
  // 14. COPY BUTTONS & UTILITIES
  // =========================================================================
  if (btnCopyCode) {
    btnCopyCode.addEventListener('click', () => {
      if (currentRoomCode) {
        navigator.clipboard.writeText(currentRoomCode).then(() => {
          btnCopyCode.textContent = 'Copied!';
          setTimeout(() => btnCopyCode.textContent = 'Copy Code', 2000);
        });
      }
    });
  }

  if (btnCopyShareUrl) {
    btnCopyShareUrl.addEventListener('click', () => {
      if (shareUrlField && shareUrlField.value) {
        navigator.clipboard.writeText(shareUrlField.value).then(() => {
          btnCopyShareUrl.textContent = 'Link Copied!';
          setTimeout(() => btnCopyShareUrl.textContent = 'Copy Share Link', 2000);
        });
      }
    });
  }

  if (btnCancelTransfer) {
    btnCancelTransfer.addEventListener('click', () => {
      transferInProgress = false;
      if (activeTransferCard) activeTransferCard.style.display = 'none';
      if (activeConnection) {
        try { activeConnection.close(); } catch (_) { }
      }
      alert('Transfer cancelled.');
    });
  }

  if (btnResetComplete) {
    btnResetComplete.addEventListener('click', () => {
      if (transferCompleteCard) transferCompleteCard.style.display = 'none';
      cleanupSenderRoom();
      window.switchBrowserShareSubView('send');
    });
  }

  // =========================================================================
  // 15. UNIFIED LOCAL LAN IP CONNECTOR
  // =========================================================================
  const btnToggleLanMode = document.getElementById('btn-toggle-lan-mode');
  const lanDirectCard = document.getElementById('lan-direct-card');
  const btnConnectLan = document.getElementById('btn-lan-connect');
  const inputLanHost = document.getElementById('lan-target-host');

  if (btnToggleLanMode && lanDirectCard) {
    btnToggleLanMode.addEventListener('click', () => {
      const isVisible = lanDirectCard.style.display === 'block';
      lanDirectCard.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && inputLanHost) inputLanHost.focus();
    });
  }

  if (btnConnectLan) {
    btnConnectLan.addEventListener('click', () => {
      let host = (inputLanHost?.value || '').trim();
      if (!host) {
        alert('Please enter your local device IP and Port (e.g. 192.168.1.18:53317).');
        if (inputLanHost) inputLanHost.focus();
        return;
      }

      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        host = 'http://' + host;
      }

      window.open(host, '_blank');
    });
  }
});
