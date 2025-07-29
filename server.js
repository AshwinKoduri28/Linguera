// Use Google Translate for hi<->en
async function googleTranslate(text, source, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  const data = await response.json();
  return Array.isArray(data) && data[0]?.[0]?.[0] || '';
}
const express = require('express');
const app = express();
// --- LIVE STATS API ENDPOINT ---
app.get('/api/live-stats', (req, res) => {
  // Count live calls (rooms with at least 1 participant)
  let liveCalls = 0;
  let agentSet = new Set();
  for (const [roomId, room] of rooms.entries()) {
    if (room.participants && room.participants.length > 0) {
      liveCalls++;
    }
    // Track agents online (any socket in any room that is not an employee)
    if (room.participants) {
      for (const socketId of room.participants) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.handshake && socket.handshake.auth && socket.handshake.auth.email) {
          const email = socket.handshake.auth.email;
          if (!/@employee\.com$/i.test(email)) {
            agentSet.add(email);
          }
        } else if (socket && socket.data && socket.data.email) {
          // fallback if using socket.data
          const email = socket.data.email;
          if (!/@employee\.com$/i.test(email)) {
            agentSet.add(email);
          }
        }
      }
    }
  }
  res.json({ liveCalls, agentsOnline: agentSet.size });
});
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const axios = require("axios");
const cors = require("cors");
const ExcelJS = require('exceljs');
const hiToEngMap = require('./hitoen');
const { pipeline } = require('@xenova/transformers');
const langMapNLLB = {
  en: 'eng_Latn',
  hi: 'hin_Deva',
  fr: 'fra_Latn',
  es: 'spa_Latn',
  de: 'deu_Latn',
  ta: 'tam_Taml',
  te: 'tel_Telu',
  mr: 'mar_Deva',
  gu: 'guj_Gujr',
  bn: 'ben_Beng',
  ur: 'urd_Arab',
  zh: 'zho_Hans',
  ja: 'jpn_Jpan',
  ko: 'kor_Hang',
  // Add more as needed
};

function getNLLBCode(code) {
  return langMapNLLB[code] || null;
}

function normalizeText(text) {
  return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}


const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(express.json());


// --- ENTERPRISE DICTIONARY MANAGEMENT ---
let excludedWords = [];
const EXCLUDED_WORDS_FILE = path.join(__dirname, 'excludedWords.json');

function loadExcludedWords() {
  try {
    if (fs.existsSync(EXCLUDED_WORDS_FILE)) {
      excludedWords = JSON.parse(fs.readFileSync(EXCLUDED_WORDS_FILE, 'utf8'));
      console.log(`Loaded ${excludedWords.length} excluded words`);
    }
  } catch (error) {
    console.error('Error loading excluded words:', error);
    excludedWords = [];
  }
}

function saveExcludedWords() {
  try {
    fs.writeFileSync(EXCLUDED_WORDS_FILE, JSON.stringify(excludedWords, null, 2), 'utf8');
    console.log(`Saved ${excludedWords.length} excluded words`);
  } catch (error) {
    console.error('Error saving excluded words:', error);
  }
}

function applyWordReplacements(text, targetLang) {
  if (!text || typeof text !== 'string') return text;
  let processedText = text;
  try {
    const validEntries = excludedWords.filter(entry => {
      const hasTargetLang = entry[targetLang]?.trim();
      const hasEnglish = entry.en?.trim();
      return hasTargetLang && hasEnglish;
    });
    // Sort by length descending
    const sortedWords = validEntries.sort((a, b) =>
      b[targetLang].trim().length - a[targetLang].trim().length
    );
    sortedWords.forEach((wordEntry) => {
      const targetWord = wordEntry[targetLang].trim();
      const englishWord = wordEntry.en.trim();
      const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Strict word-boundary match
      const boundaryRegex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
      if (boundaryRegex.test(processedText)) {
        processedText = processedText.replace(boundaryRegex, englishWord);
      } else {
        // Loose match
        const looseRegex = new RegExp(escapedWord, 'gi');
        processedText = processedText.replace(looseRegex, englishWord);
      }
    });
  } catch (error) {
    console.error('Error in word replacement:', error);
  }
  return processedText;
}

const rooms = new Map();
const transcripts = new Map();
// --- ENTERPRISE DICTIONARY ROUTES ---
app.get('/api/dictionary', (req, res) => {
  res.json(excludedWords);
});

app.post('/api/dictionary', (req, res) => {
  try {
    const wordEntry = req.body;
    if (!wordEntry.en) {
      return res.status(400).json({ error: 'English word is required' });
    }
    const existingIndex = excludedWords.findIndex(word =>
      word.en?.toLowerCase() === wordEntry.en.toLowerCase()
    );
    if (existingIndex !== -1) {
      excludedWords[existingIndex] = { ...excludedWords[existingIndex], ...wordEntry };
    } else {
      excludedWords.push(wordEntry);
    }
    saveExcludedWords();
    res.json({ message: 'Word added successfully', wordCount: excludedWords.length });
  } catch (error) {
    console.error('Error adding word:', error);
    res.status(500).json({ error: 'Failed to add word' });
  }
});

app.delete('/api/dictionary/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= excludedWords.length) {
      return res.status(404).json({ error: 'Word not found' });
    }
    excludedWords.splice(index, 1);
    saveExcludedWords();
    res.json({ message: 'Word deleted successfully', wordCount: excludedWords.length });
  } catch (error) {
    console.error('Error deleting word:', error);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

app.delete('/api/dictionary', (req, res) => {
  try {
    excludedWords = [];
    saveExcludedWords();
    res.json({ message: 'Dictionary cleared successfully' });
  } catch (error) {
    console.error('Error clearing dictionary:', error);
    res.status(500).json({ error: 'Failed to clear dictionary' });
  }
});


// Track agent availability: { [email]: true/false }
const agentAvailability = {};

io.on('connection', (socket) => {
  // Respond to explicit agent count requests from employees
  socket.on('get-agents-online', () => {
    // Defensive: log and always emit
    let availableCount = 0;
    for (const email in agentAvailability) {
      if (agentAvailability[email]) availableCount++;
    }
    console.log(`[get-agents-online] Emitting agents-online:`, availableCount);
    socket.emit('agents-online', availableCount);
  });
  console.log('User connected:', socket.id);
  // Only emit agent count to employees (not agents) on connect
  setTimeout(() => {
    let availableCount = 0;
    for (const email in agentAvailability) {
      if (agentAvailability[email]) availableCount++;
    }
    socket.emit('agents-online', availableCount);
  }, 500);
  // Handle agent availability toggle
  socket.on('agent-availability-changed', (data) => {
    // data: { email, available }
    if (data && data.email) {
      agentAvailability[data.email] = !!data.available;
      emitAgentsOnline();
    }
  });

  // Handle explicit room creation
  socket.on('createRoom', (roomId, lang) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('createRoomResult', { success: false, error: 'Invalid roomId' });
      return;
    }
    if (rooms.has(roomId)) {
      socket.emit('createRoomResult', { success: false, error: 'Room already exists' });
      return;
    }
    // Store language in the room object for future use if needed
    rooms.set(roomId, { participants: [], isPublic: true, lang });
    socket.emit('createRoomResult', { success: true, roomId });
  });

  socket.on('join', (roomId, opts = {}) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('error', 'Invalid roomId');
      return;
    }
    if (!rooms.has(roomId)) {
      if (opts.isCreator) {
        rooms.set(roomId, { participants: [socket.id], isPublic: opts.isPublic !== false });
        socket.join(roomId);
        socket.emit('created', roomId);
      } else {
        socket.emit('no-room', roomId);
      }
      return;
    }
    const room = rooms.get(roomId);
    if ((room.participants || []).length >= 2) {
      socket.emit('full', roomId);
      return;
    }
    socket.join(roomId);
    room.participants.push(socket.id);
    rooms.set(roomId, room);
    if (room.participants.length === 1) {
      socket.emit('created', roomId);
    } else if (room.participants.length === 2) {
      socket.emit('joined', roomId);
      io.to(room.participants[0]).emit('user-joined');
    }
    emitActiveMeetings();
  });

  socket.on('offer', (offer, roomId) => forwardToOther(roomId, socket.id, 'offer', offer));
  socket.on('answer', (answer, roomId) => forwardToOther(roomId, socket.id, 'answer', answer));
  socket.on('ice-candidate', (candidate, roomId) => forwardToOther(roomId, socket.id, 'ice-candidate', candidate));

  socket.on('transcript', (msg) => {
    if (!msg?.roomId || !transcripts.has(msg.roomId)) {
      transcripts.set(msg.roomId, []);
    }
    transcripts.get(msg.roomId).push({ ...msg, timestamp: msg.timestamp || Date.now() });
    if (!msg.type || msg.type !== 'translation') {
      const other = rooms.get(msg.roomId)?.participants?.find(id => id !== socket.id);
      if (other) io.to(other).emit('transcript', msg);
    }
  });

  socket.on('local-translation', (data) => {
    if (data.to) io.to(data.to).emit('local-translation', { ...data, timestamp: data.timestamp || Date.now() });
  });

  socket.on('leave', (roomId) => {
    handleLeave(socket, roomId);
    const room = rooms.get(roomId);
    if (!room?.participants?.length) {
      rooms.delete(roomId);
      transcripts.delete(roomId);
    }
    emitActiveMeetings();
  });


  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomId) => roomId !== socket.id && handleLeave(socket, roomId));
  });

  socket.on('disconnect', () => {
    emitActiveMeetings();
    emitAgentsOnline();
    console.log('User disconnected:', socket.id);
  });
// Emit the number of agents online to all clients
function emitAgentsOnline() {
  // Only count agents who are marked available
  let availableCount = 0;
  for (const email in agentAvailability) {
    if (agentAvailability[email]) availableCount++;
  }
  io.emit('agents-online', availableCount);
}

  socket.on('get-active-meetings', () => {
    const meetings = Array.from(rooms.entries())
      .filter(([_, room]) => room.isPublic && room.participants.length > 0)
      .map(([roomId, room]) => ({ roomId, participants: room.participants.length }));
    socket.emit('active-meetings', meetings);
  });
});

function forwardToOther(roomId, senderId, event, payload) {
  const other = rooms.get(roomId)?.participants?.find(id => id !== senderId);
  if (other) io.to(other).emit(event, payload);
}

function handleLeave(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room?.participants) return;
  room.participants = room.participants.filter(id => id !== socket.id);
  rooms.set(roomId, room);
  socket.to(roomId).emit('user-disconnected');
  if (room.participants.length === 0) {
    saveTranscript(roomId).catch(console.error);
    rooms.delete(roomId);
    transcripts.delete(roomId);
  }
}

async function saveTranscript(roomId) {
  const log = transcripts.get(roomId) || [];
  if (!log.length) return;

  const dirPath = path.join(__dirname, 'transcripts');
  fs.mkdirSync(dirPath, { recursive: true });

  const filePath = path.join(dirPath, `${roomId}-${Date.now()}.txt`);
  const content = log.map(m =>
    `[${new Date(m.timestamp).toLocaleString()}] ${m.type === 'translation' ? '[TRANSLATED] ' : ''}${m.sender}: ${m.transcript}`
  ).join('\n');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Transcript saved to ${filePath}`);
}

let nllbTranslator;
(async () => {
  nllbTranslator = await pipeline('translation', 'Xenova/nllb-200-distilled-600M');
  console.log('✅ NLLB translation model loaded');
})();


app.post('/api/translate', async (req, res) => {
  try {
    const { text, source = 'auto', target = 'en' } = req.body;
    const sl = source.split('-')[0];
    const tl = target.split('-')[0];

    const srcLang = getNLLBCode(sl);
    const tgtLang = getNLLBCode(tl);

    if (!srcLang || !tgtLang) {
      return res.status(400).json({ error: `Unsupported language pair (${sl} -> ${tl})` });
    }

    const sentences = text.match(/[^.!?\u0964]+[.!?\u0964]?/g) || [text];
    const output = [];

    for (const sentence of sentences) {
      const trimmed = normalizeText(sentence);
      if (!trimmed) continue;

      const translated = await nllbTranslator(trimmed, {
        src_lang: srcLang,
        tgt_lang: tgtLang
      });

      let translatedText = translated[0]?.translation_text || '';

      // Apply dictionary replacements (if needed)
      translatedText = applyWordReplacements(translatedText, tl);

      output.push(translatedText);
    }

    res.json({ translated: output.join(' ') });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});


app.post('/api/feedback', async (req, res) => {
  try {
    const feedback = req.body;
    const dirPath = path.join(__dirname, 'feedback_response');
    fs.mkdirSync(dirPath, { recursive: true });
    const timestamp = Date.now();
    fs.writeFileSync(path.join(dirPath, `feedback-${timestamp}.json`), JSON.stringify(feedback, null, 2), 'utf8');

    const excelPath = path.join(dirPath, 'employee_feedback.xlsx');
    const workbook = new ExcelJS.Workbook();
    let worksheet;
    if (fs.existsSync(excelPath)) {
      await workbook.xlsx.readFile(excelPath);
      worksheet = workbook.getWorksheet('Feedback') || workbook.worksheets[0];
    } else {
      worksheet = workbook.addWorksheet('Feedback');
      worksheet.columns = [
        { header: 'Timestamp', key: 'timestamp', width: 24 },
        { header: 'Employee', key: 'employee', width: 24 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Rating', key: 'rating', width: 10 },
        { header: 'Comments', key: 'comments', width: 40 }
      ];
    }
    worksheet.addRow({
      timestamp: new Date(timestamp).toLocaleString(),
      employee: feedback.employee || feedback.email || feedback.userEmail || '',
      type: feedback.type || '',
      rating: feedback.rating || '',
      comments: feedback.comments || feedback.feedback || ''
    });
    await workbook.xlsx.writeFile(excelPath);
    res.status(200).json({ message: 'Feedback saved successfully' });
  } catch (err) {
    console.error('Error saving feedback:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

function emitActiveMeetings() {
  const meetings = Array.from(rooms.entries())
    .filter(([_, room]) => room.isPublic && room.participants.length > 0)
    .map(([roomId, room]) => ({ roomId, participants: room.participants.length }));
  io.emit('active-meetings', meetings);
}

// Load dictionary on startup
loadExcludedWords();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});