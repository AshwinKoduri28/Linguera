// webrtc.js - WebRTC connection logic
export let peerConnection;
export let localStream;
export function createPeerConnection(peerConfig, socket, roomId, statusMessage) {
  peerConnection = new RTCPeerConnection(peerConfig);
  peerConnection.ontrack = (event) => {
    statusMessage.textContent = 'Connected to peer';
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) socket.emit('ice-candidate', event.candidate, roomId);
  };
}
export async function createOffer(socket, roomId) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer, roomId);
}
export function closePeerConnection() {
  if (peerConnection) peerConnection.close();
  peerConnection = null;
}
export function hangup() {
  if (window.peerConnection) {
    window.peerConnection.close();
    window.peerConnection = null;
  }
  if (window.localStream) {
    window.localStream.getTracks().forEach(track => track.stop());
    window.localStream = null;
  }
}
