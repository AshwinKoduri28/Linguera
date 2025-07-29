// audio.js - Audio visualization and stream setup
// Exports: setupAudioVisualization, setupRemoteAudioVisualization, visualizeAudio, averageVolume, startLocalStream

export function setupAudioVisualization(localStream, localVolume) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const localSource = audioContext.createMediaStreamSource(localStream);
  const localAnalyser = audioContext.createAnalyser();
  localSource.connect(localAnalyser);
  localAnalyser.fftSize = 256;
  visualizeAudio(localAnalyser, null, localVolume, null);
  return { audioContext, localAnalyser };
}

export function setupRemoteAudioVisualization(audioContext, stream, remoteVolume) {
  const remoteSource = audioContext.createMediaStreamSource(stream);
  const remoteAnalyser = audioContext.createAnalyser();
  remoteSource.connect(remoteAnalyser);
  remoteAnalyser.fftSize = 256;
  visualizeAudio(null, remoteAnalyser, null, remoteVolume);
  return remoteAnalyser;
}

export function visualizeAudio(localAnalyser, remoteAnalyser, localVolume, remoteVolume) {
  const bufferLength = (localAnalyser || remoteAnalyser).frequencyBinCount;
  const localDataArray = localAnalyser ? new Uint8Array(bufferLength) : null;
  const remoteDataArray = remoteAnalyser ? new Uint8Array(bufferLength) : null;
  function update() {
    if (localAnalyser && localVolume) {
      localAnalyser.getByteFrequencyData(localDataArray);
      const localLevel = averageVolume(localDataArray);
      localVolume.style.width = `${localLevel}%`;
    }
    if (remoteAnalyser && remoteVolume) {
      remoteAnalyser.getByteFrequencyData(remoteDataArray);
      const remoteLevel = averageVolume(remoteDataArray);
      remoteVolume.style.width = `${remoteLevel}%`;
    }
    requestAnimationFrame(update);
  }
  update();
}

export function averageVolume(arr) {
  return Math.min(100, Math.max(0, arr.reduce((a, b) => a + b, 0) / arr.length * 2));
}

export async function startLocalStream(localVolume) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    window.localStream = stream;
    setupAudioVisualization(stream, localVolume);
    return stream;
  } catch (e) {
    alert('Could not access microphone.');
    throw e;
  }
}
