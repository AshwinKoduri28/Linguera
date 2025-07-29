// app.js - Modular entry point
import { setupCall, switchToCallPanel, switchToSetupPanel, displayTranscript, displayLocalTranslation, displayRemoteTranslation } from './ui.js';
import { updateActiveMeetings } from './meetings.js';
import { generateRoomId } from './utils.js';
import { setupAudioVisualization, setupRemoteAudioVisualization, visualizeAudio, averageVolume, startLocalStream as audioStartLocalStream } from './audio.js';
import { playTranslatedAudio } from './tts.js';
import { setupSpeechRecognition } from './speech.js';
import { createPeerConnection, createOffer, closePeerConnection, hangup as webrtcHangup } from './webrtc.js';
import { setupEventHandlers } from './events.js';
import { setupSocketHandlers } from './sockets.js';

// DOM references
const roomIdInput = document.getElementById('room-id');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const setupPanel = document.getElementById('setup-panel');
const callandtranscript = document.getElementById('call-and-transcript');
const callPanel = document.getElementById('call-panel');
const roomDisplay = document.getElementById('room-display');
const statusMessage = document.getElementById('status-message');
const muteBtn = document.getElementById('mute-btn');
const hangupBtn = document.getElementById('hangup-btn');
const localVolume = document.getElementById('local-volume');
const remoteVolume = document.getElementById('remote-volume');
const remoteAudio = document.getElementById('remote-audio-visible');
const languageSelect = document.getElementById('language-select');
const roomTypeSelect = document.getElementById('room-type-select');
const activeMeetingsDiv = document.getElementById('active-meetings');

// App state
let localStream = null;
let peerConnection = null;
let roomId = null;
let isMuted = false;
let isInitiator = false;
let recognition = null;
let audioContext = null;
let localAnalyser = null;
let remoteAnalyser = null;
let lastLocalTranscript = null;

// Socket setup
const socket = io();

// State setters/getters for modular handlers
function setIsInitiator(val) { isInitiator = val; window.isInitiator = val; }
function setRoomId(val) { roomId = val; }
function setLanguageDisabled(disabled) { languageSelect.disabled = disabled; }
function setMuted(val) { isMuted = val; }
function getIsMuted() { return isMuted; }
function getRoomId() { return roomId; }

// Modular event handlers
setupEventHandlers({
  createBtn, joinBtn, muteBtn, hangupBtn, languageSelect, roomTypeSelect, roomIdInput, socket,
  generateRoomId, isInitiator, setIsInitiator, setRoomId, setLanguageDisabled,
  startLocalStream, hangup, switchToSetupPanel, isMuted, setMuted,
  getLocalStream: () => localStream
});

// Modular socket handlers
setupSocketHandlers({
  socket, isInitiator, setIsInitiator, setRoomId, setLanguageDisabled, languageSelect, recognition, lastLocalTranscript,
  displayTranscript, displayLocalTranslation, displayRemoteTranslation, playTranslatedAudio,
  updateActiveMeetings, activeMeetingsDiv, startLocalStream, createOffer, peerConnection,
  peerConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }, roomIdInput, switchToSetupPanel,
  setupCall, roomDisplay, statusMessage, setupPanel, callandtranscript
});

// Modular local stream setup
async function startLocalStream() {
  localStream = await audioStartLocalStream(localVolume);
  // Attach local stream to peer connection if needed
  if (peerConnection && localStream) {
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  }
  // Setup speech recognition
  recognition = setupSpeechRecognition(languageSelect, getIsMuted, socket, roomId, displayTranscript);
  // Setup audio visualization
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  localAnalyser = setupAudioVisualization(localStream, localVolume).localAnalyser;
}

// Modular hangup
function hangup() {
  console.log('Hangup initiated');
  // Notify server that user is leaving the room
  if (roomId) {
    socket.emit('leave', roomId);
    setRoomId(null);
  }
  // Close WebRTC connection
  webrtcHangup();
  // Stop recognition
  if (recognition) {
    try { recognition.stop(); } catch (e) { console.warn('Recognition stop error:', e); }
    recognition = null;
  }
  // Close audio context
  if (audioContext) {
    try { audioContext.close(); } catch (e) { console.warn('AudioContext close error:', e); }
    audioContext = null;
  }
  // Clear streams and connections
  if (localStream) {
    try {
      localStream.getTracks().forEach(track => track.stop());
    } catch (e) { console.warn('Error stopping localStream tracks:', e); }
  }
  localStream = null;
  peerConnection = null;
  console.log('Hangup completed, cleanup done');
}


// Expose joinMeeting for active meetings UI and for Join (Default Language) button
window.joinMeeting = (room, lang) => {
  setIsInitiator(false);
  setRoomId(room);
  roomIdInput.value = room;
  // Set the language if provided (from Quick Connect, active meetings, or default lang)
  if (lang && languageSelect) {
    languageSelect.value = lang;
  } else if (!lang && localStorage.getItem('lingueraDefaultLanguage')) {
    languageSelect.value = localStorage.getItem('lingueraDefaultLanguage');
  }
  socket.emit('join', room, { isCreator: false });
};



function startASR() {
  if (!recognition) {
    recognition = setupSpeechRecognition(
      languageSelect,
      getIsMuted,
      socket,
      roomId,
      displayTranscript
    );
  }
  if (recognition) {
    try { recognition.start(); } catch (e) {}
  }
}

// Export startASR for use in sockets.js
export { startASR, hangup };