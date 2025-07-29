// tts.js - Text-to-Speech (browser speech synthesis only)
export function playTranslatedAudio(text, language) {
  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  if (language.toLowerCase().startsWith('en')) {
    utter.lang = 'en-IN'; // or 'en-US'
  } else if (language.toLowerCase().startsWith('hi')) {
    utter.lang = 'hi-IN';
  } else if (language.toLowerCase().startsWith('fr')) {
    utter.lang = 'fr-FR';
  } else if (language.toLowerCase().startsWith('es')) {
    utter.lang = 'es-ES';
  } else if (language.toLowerCase().startsWith('de')) {
    utter.lang = 'de-DE';
  }
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(v => v.lang === utter.lang);
  if (match) utter.voice = match;
  window.speechSynthesis.speak(utter);
}
