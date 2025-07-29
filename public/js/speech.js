// speech.js - Speech recognition and transcript handling
export function setupSpeechRecognition(languageSelect, isMuted, socket, roomId, displayTranscript, updateLocalTranslation) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = SpeechRecognition ? new SpeechRecognition() : null;
  if (!recognition) return null;
  recognition.continuous = true;
  recognition.interimResults = true;
  function startRecognition() {
    recognition.lang = languageSelect.value;
    try { recognition.start(); } catch (e) {}
  }
  recognition.onresult = (e) => {
    if (isMuted()) return;
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
    }
    const selectedLang = recognition.lang;
    let isValid = false;
    if (selectedLang.startsWith('hi')) {
      isValid = /[\u0900-\u097F]/.test(final);
    } else if (selectedLang.startsWith('en')) {
      isValid = /^[A-Za-z0-9\s.,?!'"-]+$/.test(final);
    } else if (selectedLang.startsWith('fr')) {
      isValid = /[a-zA-Zàâçéèêëîïôûùüÿñæœ]/i.test(final);
    } else if (selectedLang.startsWith('es')) {
      isValid = /[a-zA-Záéíóúüñ¿¡]/i.test(final);
    } else if (selectedLang.startsWith('de')) {
      isValid = /[a-zA-ZäöüßÄÖÜẞ]/i.test(final);
    }
    if (final.trim() && isValid) {
      const message = {
        roomId,
        sender: socket.id,
        transcript: final,
        timestamp: new Date().toISOString(),
        language: recognition.lang
      };
      displayTranscript(message, 'local');
      socket.emit('transcript', message);
      // Only call updateLocalTranslation if the recognized language is different from the UI's selected language
      const userLang = languageSelect.value.split('-')[0];
      const recLang = recognition.lang.split('-')[0];
      if (recLang !== userLang) {
        updateLocalTranslation(final, recognition.lang, message.timestamp);
      }
    }
  };
  recognition.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      alert('Microphone access denied.');
    }
  };
  recognition.onend = () => {
    startRecognition();
  };
  startRecognition();
  return recognition;
}
