// ui.js - UI helpers and DOM manipulation
// Only UI helpers, no socket or meeting logic
export function setupCall(room) {
  const roomDisplay = document.getElementById('room-display');
  const statusMessage = document.getElementById('status-message');
  const isInitiator = window.isInitiator;
  roomDisplay.textContent = `Room: ${room}`;
  statusMessage.textContent = 'Setting up call...';
  // Set role and language display
  const role = isInitiator ? "Creator" : "Joinee";
  // Try to get language from URL param or fallback to dropdown (for agent)
  let langLabel = '';
  const urlParams = new URLSearchParams(window.location.search);
  const langCode = urlParams.get('lang');
  const langMap = {
    'en-US': 'English (US)',
    'hi-IN': 'Hindi',
    'fr-FR': 'French',
    'es-ES': 'Spanish',
    'de-DE': 'German'
  };
  if (langCode && langMap[langCode]) {
    langLabel = langMap[langCode];
  } else {
    // Try to get from dropdown if present (for agent)
    const languageSelect = document.getElementById('language-select');
    if (languageSelect && languageSelect.options.length > 0) {
      langLabel = languageSelect.options[languageSelect.selectedIndex].text;
    } else {
      langLabel = '';
    }
  }
  document.getElementById('user-role-language').textContent = `${role} | ${langLabel}`;
  switchToCallPanel();
}
export function switchToCallPanel() {
  const setupPanel = document.getElementById('setup-panel');
  const callandtranscript = document.getElementById('call-and-transcript');
  setupPanel.classList.add('hidden');
  callandtranscript.classList.remove('hidden');
  callandtranscript.style.marginTop = "-620px";
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.updateTranscriptLabels) window.updateTranscriptLabels();
}
export function switchToSetupPanel() {
  const setupPanel = document.getElementById('setup-panel');
  const callandtranscript = document.getElementById('call-and-transcript');
  const roomIdInput = document.getElementById('room-id');
  setupPanel.classList.remove('hidden');
  callandtranscript.classList.add('hidden');
  if (roomIdInput) {
    roomIdInput.disabled = false;
    roomIdInput.value = '';
  }
}

// --- Chat Bubble Transcript/Translation Pairing Logic ---
const chatMap = new Map(); // key: timestamp, value: { sender, transcript, translation, lang, translationLang, time, speakerName }

function renderChatBox() {
  const box = document.getElementById('chat-combined');
  if (!box) return;
  box.innerHTML = '';
  const entries = Array.from(chatMap.values()).sort((a, b) => a.timestamp - b.timestamp);

  // Determine roles for local and remote
  const loggedInUser = localStorage.getItem('lingueraLoggedInUser');
  let localRole = 'Agent';
  let remoteRole = 'Employee';
  if (loggedInUser && /@employee\.com$/i.test(loggedInUser)) {
    localRole = 'Employee';
    remoteRole = 'Agent';
  }

  for (const entry of entries) {
    const alignClass = entry.sender === 'local' ? 'local' : 'remote';
    const speakerName = entry.sender === 'local' ? localRole : remoteRole;
    const roleClass = speakerName.toLowerCase(); // 'employee' or 'agent'

    // Avatar image (customer-service.png for agent, customer.jpg for employee)
    const avatar = document.createElement('img');
    avatar.className = 'chat-avatar';
    avatar.style.width = '36px';
    avatar.style.height = '36px';
    avatar.style.objectFit = 'cover';
    avatar.style.borderRadius = '50%';
    if (speakerName === 'Agent') {
      avatar.src = 'images/customer-service.png';
      avatar.alt = 'Agent';
    } else {
      avatar.src = 'images/customer.jpg';
      avatar.alt = 'Employee';
    }

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${alignClass} ${roleClass}`;
    bubble.style.display = 'flex';
    bubble.style.flexDirection = 'column';
    bubble.style.justifyContent = 'center';

    // Use a two-column layout for label and content
    const transcriptRow = document.createElement('div');
    transcriptRow.style.display = 'flex';
    transcriptRow.style.alignItems = 'flex-start';
    transcriptRow.style.gap = '8px';
    const transcriptLabel = document.createElement('span');
    transcriptLabel.style.fontWeight = 'bold';
    transcriptLabel.style.whiteSpace = 'nowrap';
    transcriptLabel.textContent = `${speakerName} Transcript [${entry.lang} ${entry.time}]:`;
    const transcriptContent = document.createElement('span');
    transcriptContent.textContent = entry.transcript;
    transcriptRow.appendChild(transcriptLabel);
    transcriptRow.appendChild(transcriptContent);
    bubble.appendChild(transcriptRow);

    if (entry.translation) {
      const translationRow = document.createElement('div');
      translationRow.className = 'bubble-translation';
      translationRow.style.display = 'flex';
      translationRow.style.alignItems = 'flex-start';
      translationRow.style.gap = '8px';
      const translationLabel = document.createElement('span');
      translationLabel.style.fontWeight = 'bold';
      translationLabel.style.whiteSpace = 'nowrap';
      translationLabel.textContent = `${speakerName} Translation [${entry.translationLang} ${entry.time}]:`;
      const translationContent = document.createElement('span');
      translationContent.textContent = entry.translation;
      translationRow.appendChild(translationLabel);
      translationRow.appendChild(translationContent);
      bubble.appendChild(translationRow);
    }

    // Row container for avatar and bubble
    const row = document.createElement('div');
    row.className = `chat-message-row ${roleClass} ${alignClass}`;
    row.style.display = 'flex';
    row.style.alignItems = 'flex-end';
    row.style.marginBottom = '12px';
    if (alignClass === 'local') {
      row.style.flexDirection = 'row-reverse';
    } else {
      row.style.flexDirection = 'row';
    }
    row.appendChild(avatar);
    row.appendChild(bubble);
    box.appendChild(row);
  }
}

// Accept speakerName in displayTranscript and translation functions
export function displayTranscript({ transcript, timestamp, language, speakerName }, sender) {
  const time = new Date(timestamp).toLocaleTimeString();
  const key = sender + '_' + timestamp;
  chatMap.set(key, {
    sender,
    transcript,
    timestamp,
    lang: language,
    time,
    speakerName, // Store speaker name
    translation: chatMap.get(key)?.translation || null,
    translationLang: chatMap.get(key)?.translationLang || null
  });
  renderChatBox();
}
export function displayLocalTranslation(translated, language, timestamp, speakerName) {
  const time = new Date(timestamp).toLocaleTimeString();
  const key = 'local_' + timestamp;
  const entry = chatMap.get(key) || { sender: 'local', transcript: '', timestamp, lang: '', time };
  entry.translation = translated;
  entry.translationLang = language;
  if (speakerName) entry.speakerName = speakerName;
  chatMap.set(key, entry);
  renderChatBox();
}
export function displayRemoteTranslation(translated, language, timestamp, speakerName) {
  const time = new Date(timestamp).toLocaleTimeString();
  const key = 'remote_' + timestamp;
  const entry = chatMap.get(key) || { sender: 'remote', transcript: '', timestamp, lang: '', time };
  entry.translation = translated;
  entry.translationLang = language;
  if (speakerName) entry.speakerName = speakerName;
  chatMap.set(key, entry);
  renderChatBox();
}

// Patch: updateTranscriptLabels for new combined headings (robust and correct)
window.updateTranscriptLabels = function updateTranscriptLabels() {
  const localCombined = document.querySelector('h3[for-local-combined]');
  const remoteCombined = document.querySelector('h3[for-remote-combined]');
  if (!localCombined && !remoteCombined) return; // No headings, do nothing
  const loggedInUser = localStorage.getItem('lingueraLoggedInUser');
  let role = 'agent';
  if (loggedInUser && /@employee\.com$/i.test(loggedInUser)) role = 'employee';
  // Local
  if (localCombined) {
    localCombined.textContent =
      role === 'employee' ? 'Employee Transcript & Translation' : 'Agent Transcript & Translation';
  }
  // Remote
  if (remoteCombined) {
    remoteCombined.textContent =
      role === 'employee' ? 'Agent Transcript & Translation' : 'Employee Transcript & Translation';
  }
};