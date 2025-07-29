// events.js - Button and DOM event handlers
// Exports: setupEventHandlers

export function setupEventHandlers({
  createBtn, joinBtn, muteBtn, hangupBtn, languageSelect, roomTypeSelect, roomIdInput, socket,
  generateRoomId, isInitiator, setIsInitiator, setRoomId, setLanguageDisabled,
  startLocalStream, hangup, switchToSetupPanel, isMuted, setMuted,
  getLocalStream
}) {
  // Create button event
  createBtn.onclick = () => {
    if (!requireLoginOrRedirect("create a room")) return;
    setIsInitiator(true);
    const roomId = generateRoomId();
    setRoomId(roomId);
    roomIdInput.value = roomId;
    const roomType = roomTypeSelect.value;
    // FIX: Emit 'join' instead of 'create' for room creation
    socket.emit('join', roomId, { roomType, isCreator: true });
  };

  // Join button event
  joinBtn.onclick = () => {
    if (!requireLoginOrRedirect("join a room")) return;
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
      if (window.showToast) {
        showToast('Please enter a room ID', 'error');
      } else {
        alert('Please enter a room ID');
      }
      return;
    }
    setIsInitiator(false);
    setRoomId(roomId);
    socket.emit('join', roomId, { isCreator: false });
  };

  // Mute button event
  muteBtn.onclick = () => {
    const localStream = getLocalStream();
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
      const muteIcon = document.getElementById('mute-icon');
      if (muteIcon) {
        // Always update icon and alt text
        // Use new icon_mic_muted.svg for mute, fallback to Group 11.svg if not found
        muteIcon.src = audioTrack.enabled ? 'images/icon_mic.svg' : 'images/icon_mic_muted.svg';
        muteIcon.onerror = function() {
          muteIcon.src = 'images/Group 11.svg';
        };
        muteIcon.alt = audioTrack.enabled ? 'Unmute' : 'Mute';
        // Fallback: force reload image in case of browser cache glitch
        muteIcon.style.display = 'none';
        void muteIcon.offsetWidth; // trigger reflow
        muteIcon.style.display = '';
      } else {
        console.warn('Mute icon element not found!');
      }
    }
  };

  // Modified hangup button event with feedback modal integration
  hangupBtn.onclick = () => {
    const loggedInUser = localStorage.getItem('lingueraLoggedInUser');
    const isEmployee = loggedInUser && /@employee\.com$/i.test(loggedInUser);
    // First, execute hangup
    hangup();
    switchToSetupPanel();
    // Then show feedback modal for employees only
    if (isEmployee) {
      // Small delay to ensure hangup is complete
      setTimeout(() => {
        if (window.showEmployeeFeedbackModal) {
          const modalShown = window.showEmployeeFeedbackModal();
          if (!modalShown) {
            // If modal failed to show, redirect to index
            window.location.href = 'index.html';
          }
        } else {
          // Fallback if modal function doesn't exist
          window.location.href = 'index.html';
        }
      }, 100);
    } else {
      // For agents, redirect directly to index
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 100);
    }
  };

  // Language select event (guarded for null)
  if (languageSelect) {
    languageSelect.onchange = () => {
      if (socket && window.roomId) {
        socket.emit('language-change', window.roomId, languageSelect.value);
      }
    };
  }

  // Room type select event
  roomTypeSelect.onchange = () => {
    // Handle room type changes if needed
  };

  // Room ID input events
  roomIdInput.oninput = () => {
    // Handle room ID input changes if needed
  };

  // Helper function to check login status
  function requireLoginOrRedirect(action) {
    const loggedInUser = localStorage.getItem('lingueraLoggedInUser');
    if (!loggedInUser) {
      if (window.showToast) {
        showToast("Please log in or sign up before you can " + action + ".", 'info');
      } else {
        alert("Please log in or sign up before you can " + action + ".");
      }
      window.location.href = "home.html";
      return false;
    }
    return true;
  }
}
