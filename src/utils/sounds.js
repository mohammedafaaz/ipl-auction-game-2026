// Web Audio API sound effects — no external files needed

let ctx = null;
let userInteracted = false;

// Call this on first user gesture (click/tap)
export function initAudio() {
  userInteracted = true;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  if (ctx?.state === 'suspended') ctx.resume();
}

function getCtx() {
  if (!userInteracted) return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function playTone(freq, type, duration, volume = 0.3, startTime = 0) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + startTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

function playNoise(duration, volume = 0.15, startTime = 0) {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime + startTime;
  const bufSize = c.sampleRate * duration;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  src.connect(gain);
  gain.connect(c.destination);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  src.start(t);
  src.stop(t + duration);
}

// ── Sound Effects ─────────────────────────────────────────────────────────────

// Bid placed — quick ascending tick
export function playBidSound() {
  try {
    playTone(520, 'sine', 0.08, 0.25);
    playTone(780, 'sine', 0.06, 0.18, 0.07);
  } catch {}
}

// Timer ticking urgently (last 10s) — sharp click
export function playTickSound() {
  try {
    playTone(1100, 'square', 0.04, 0.08);
  } catch {}
}

// Hammer drop — auctioneer's gavel
export function playGavelSound() {
  try {
    const c = getCtx();
    const t = c.currentTime;
    // Thud
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t);
    osc.stop(t + 0.3);
    // Wood crack noise
    playNoise(0.06, 0.3, 0);
  } catch {}
}

// Crowd cheering — uses cheer_sound.mp3 from public folder
export function playCrowdCheer() {
  try {
    const audio = new Audio('/cheer_sound.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {});
  } catch {}
}

// Big win — fanfare + cheer for when YOUR team buys a player
export function playFanfare() {
  try {
    playCrowdCheer();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      playTone(freq, 'triangle', 0.25, 0.3, i * 0.12);
    });
    [523, 659, 784].forEach(freq => {
      playTone(freq, 'sine', 0.6, 0.15, 0.55);
    });
  } catch {}
}

// Unsold — low descending tone
export function playUnsoldSound() {
  try {
    playTone(300, 'sine', 0.3, 0.2);
    playTone(220, 'sine', 0.4, 0.15, 0.25);
  } catch {}
}

// New player up — attention chime
export function playNewPlayerSound() {
  try {
    playTone(880, 'sine', 0.12, 0.2);
    playTone(1100, 'sine', 0.1, 0.15, 0.1);
  } catch {}
}
