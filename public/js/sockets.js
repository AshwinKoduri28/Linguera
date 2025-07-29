  // Listen for real-time agent availability updates and update UI
  socket.on('agents-online', (count) => {
    // Try to update the agent availability label if present
    const agentAvailabilityLabel = document.getElementById('agent-availability-label');
    const agentAvailabilityWrapper = document.getElementById('agent-availability-wrapper');
    const loggedInUser = localStorage.getItem('lingueraLoggedInUser');
    const isEmployee = loggedInUser && /@employee\.com$/i.test(loggedInUser);
    if (isEmployee && agentAvailabilityLabel && agentAvailabilityWrapper) {
      agentAvailabilityWrapper.style.display = 'block';
      agentAvailabilityLabel.textContent = count === 1 ? '1 Agent Available' : `${count} Agents Available`;
      agentAvailabilityLabel.style.color = count > 0 ? '#34a853' : '#d32f2f';
    }
  });
// sockets.js - Socket event handlers and socket setup
// Exports: setupSocketHandlers

import { startASR } from './app.js';

export function setupSocketHandlers({
  socket, isInitiator, setIsInitiator, setRoomId, setLanguageDisabled, languageSelect, recognition, lastLocalTranscript, updateLocalTranslation, displayTranscript, displayLocalTranslation, displayRemoteTranslation, playTranslatedAudio, updateActiveMeetings, activeMeetingsDiv, startLocalStream, createOffer, peerConnection, peerConfig, roomIdInput, switchToSetupPanel,
  setupCall, roomDisplay, statusMessage, setupPanel, callandtranscript
}) {
  socket.on('created', async (room) => {
    setRoomId(room);
    setupCall(room); // Only pass the room string
    // Clear all transcript and translation boxes when a new room is created
    clearTranscriptsAndTranslations();
    // UI setup for call (imported from ui.js)
    // Start local stream and peer connection
    await startLocalStream();
    startASR();
    socket.emit('language-selected', {
      roomId: room,
      language: languageSelect.value,
      sender: socket.id
    });
  });
  socket.on('joined', async (room) => {
    setRoomId(room);
    setupCall(room); // Only pass the room string
    // Clear all transcript and translation boxes when a new room is joined
    clearTranscriptsAndTranslations();
    await startLocalStream();
    startASR();
    if (!isInitiator) setLanguageDisabled(false);
    socket.emit('language-selected', {
      roomId: room,
      language: languageSelect.value,
      sender: socket.id
    });
    statusMessage.textContent = 'Employee connected';
    if (window.showToast) {
      showToast('You have joined the meeting.', 'success');
    } else {
      alert('You have joined the meeting.');
    }
  });
  socket.on('user-joined', async () => {
    if (isInitiator) await createOffer(socket, setRoomId());
    statusMessage.textContent = 'Employee connected';
    if (window.showToast) {
      showToast('A participant has joined the meeting.', 'success');
    } else {
      alert('A participant has joined the meeting.');
    }
  });
  socket.on('language-selected', (data) => {
    // Handle remote user language selection if needed
  });
  if (languageSelect) {
    languageSelect.addEventListener('change', () => {
      if (setRoomId()) {
        socket.emit('language-selected', {
          roomId: setRoomId(),
          language: languageSelect.value,
          sender: socket.id
        });
      }
    });
  }
  socket.on('offer', async (offer) => {
    if (!peerConnection) createPeerConnection(peerConfig, socket, setRoomId());
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer, setRoomId());
  });
  socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });
  socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });
  socket.on('user-disconnected', () => {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    if (window.showToast) {
      showToast('A participant has left the meeting.', 'info');
    } else {
      alert('A participant has left the meeting.');
    }
    // No need to emit 'get-active-meetings' here; server will broadcast updates
  });
  socket.on('no-room', (room) => {
    if (!isInitiator) {
      if (window.showToast) {
        showToast("Room doesn't exist", 'error');
      } else {
        alert("Room doesn't exist");
      }
      roomIdInput.value = '';
      setLanguageDisabled(false);
    }
  });
  // ...other handlers as needed...
  socket.on('active-meetings', (meetings) => updateActiveMeetings(meetings, activeMeetingsDiv));
  socket.emit('get-active-meetings'); // Initial fetch only
  socket.on('created', () => socket.emit('get-active-meetings'));
  socket.on('joined', () => socket.emit('get-active-meetings'));
  // Remove redundant update triggers:
  // socket.on('user-disconnected', () => socket.emit('get-active-meetings'));
  // socket.on('user-joined', () => socket.emit('get-active-meetings'));
  socket.on('transcript', async (msg) => {
    if (msg.sender !== socket.id) {
      // Prevent duplicate display in remote-combined
      const remoteCombined = document.getElementById('remote-combined');
      let transcriptExists = false;
      if (remoteCombined && remoteCombined.children) {
        transcriptExists = Array.from(remoteCombined.children).some(div => div.textContent.includes(msg.transcript));
      }
      if (!transcriptExists) {
        displayTranscript(msg, 'remote');
      }
      // --- Translation logic ---
      const localLang = languageSelect.value.split('-')[0];
      const source = (msg.language || '').split('-')[0];
      let target = null;
      if (source !== localLang) {
        // Only support en <-> hi, en <-> fr, en <-> es, en <-> de
        if ((source === 'en' && localLang === 'hi') || (source === 'hi' && localLang === 'en')) {
          target = localLang;
        } else if ((source === 'en' && localLang === 'fr') || (source === 'fr' && localLang === 'en')) {
          target = localLang;
        } else if ((source === 'en' && localLang === 'es') || (source === 'es' && localLang === 'en')) {
          target = localLang;
        } else if ((source === 'en' && localLang === 'de') || (source === 'de' && localLang === 'en')) {
          target = localLang;
        }
      }
      if (source && target) {
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: msg.transcript, source, target })
          });
          const data = await res.json();
          const translated = data.translated || '';
          if (translated) {
            // Prevent duplicate display in remote-combined for translation
            const remoteCombined = document.getElementById('remote-combined');
            let translationExists = false;
            if (remoteCombined && remoteCombined.children) {
              translationExists = Array.from(remoteCombined.children).some(div => div.textContent.includes(translated));
            }
            if (!translationExists) {
              displayRemoteTranslation(translated, target, msg.timestamp);
              playTranslatedAudio(translated, target);
            }
            // Emit translation back to sender for their local-combined box
            socket.emit('local-translation', {
              transcript: translated,
              language: target,
              timestamp: msg.timestamp,
              to: msg.sender
            });
          }
        } catch (e) {
          console.error('Translation error:', e);
        }
      }
    }
  });
  // Listen for local-translation event and display in local-combined box
  socket.on('local-translation', (data) => {
    if (data && data.transcript && data.to === socket.id) {
      // Prevent duplicate display: only show if not already present
      const container = document.getElementById('local-combined');
      let exists = false;
      if (container && container.children) {
        exists = Array.from(container.children).some(div => div.textContent.includes(data.transcript));
      }
      if (!exists) {
        displayLocalTranslation(data.transcript, data.language, data.timestamp);
      }
    }
  });
  // Helper to clear all transcript and translation boxes
  function clearTranscriptsAndTranslations() {
    const ids = ['local-combined', 'remote-combined'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }
}
