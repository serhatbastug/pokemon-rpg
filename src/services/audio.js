// Ses motoru: tüm efektler Web Audio ile koddan üretilir, ses dosyası yoktur.
// Chiptune tarzı kare/üçgen dalgalar piksel sanatıyla uyumlu bir his verir.
//
// Tarayıcılar ses bağlamını ancak bir kullanıcı etkileşiminden sonra açar;
// bu yüzden ilk tuş/tıklamada resume() edilir.

let ctx = null;
let master = null;
let musicGain = null;
let enabled = true;
let musicTimer = null;
let currentTrack = null;

function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
    return ctx;
}

// İlk kullanıcı etkileşiminde çağrılır (tarayıcı kuralı)
export function unlockAudio() {
    const context = ensureContext();
    if (context && context.state === 'suspended') context.resume();
}

export function setAudioEnabled(value) {
    enabled = value;
    if (master) master.gain.value = value ? 0.35 : 0;
    if (!value) stopMusic();
}

export function isAudioEnabled() {
    return enabled;
}

// Tek bir nota/efekt: dalga tipi, frekans kayması ve zarf
function blip({ type = 'square', from, to = from, duration = 0.12, volume = 0.5, delay = 0, sweep = 'exponential' }) {
    const context = ensureContext();
    if (!context || !enabled) return;

    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) {
        if (sweep === 'linear') osc.frequency.linearRampToValueAtTime(to, start + duration);
        else osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    }

    // Kısa atak, üstel sönüm: chiptune "tık" hissi
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

// Gürültü tabanlı efekt (patlama, çarpma)
function noise({ duration = 0.2, volume = 0.4, filterFrom = 2000, filterTo = 200, delay = 0 }) {
    const context = ensureContext();
    if (!context || !enabled) return;

    const start = context.currentTime + delay;
    const frames = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrom, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), start + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
}

// Oyun olaylarına karşılık gelen sesler
export const Sfx = {
    hit: () => blip({ type: 'square', from: 320, to: 120, duration: 0.08, volume: 0.35 }),
    superEffective: () => {
        blip({ type: 'square', from: 520, to: 900, duration: 0.09, volume: 0.4 });
        blip({ type: 'square', from: 700, to: 1200, duration: 0.1, volume: 0.35, delay: 0.06 });
    },
    weak: () => blip({ type: 'triangle', from: 220, to: 160, duration: 0.1, volume: 0.25 }),
    playerHurt: () => {
        blip({ type: 'sawtooth', from: 260, to: 90, duration: 0.2, volume: 0.4 });
        noise({ duration: 0.15, volume: 0.2, filterFrom: 900, filterTo: 150 });
    },
    faint: () => {
        blip({ type: 'square', from: 400, to: 80, duration: 0.5, volume: 0.35 });
    },
    shoot: () => blip({ type: 'square', from: 800, to: 500, duration: 0.05, volume: 0.18 }),
    dash: () => noise({ duration: 0.16, volume: 0.22, filterFrom: 3000, filterTo: 600 }),
    jump: () => blip({ type: 'square', from: 420, to: 780, duration: 0.12, volume: 0.25 }),
    land: () => blip({ type: 'triangle', from: 200, to: 120, duration: 0.08, volume: 0.2 }),
    token: () => blip({ type: 'square', from: 900, to: 1400, duration: 0.07, volume: 0.22 }),
    ballThrow: () => blip({ type: 'triangle', from: 300, to: 600, duration: 0.12, volume: 0.25 }),
    ballWobble: () => blip({ type: 'square', from: 380, to: 340, duration: 0.1, volume: 0.2 }),
    catchSuccess: () => {
        [660, 880, 1100, 1320].forEach((f, i) =>
            blip({ type: 'square', from: f, duration: 0.12, volume: 0.3, delay: i * 0.09 }));
    },
    catchFail: () => {
        blip({ type: 'square', from: 400, to: 200, duration: 0.25, volume: 0.3 });
        noise({ duration: 0.2, volume: 0.15, filterFrom: 800, filterTo: 200, delay: 0.05 });
    },
    levelUp: () => {
        [523, 659, 784, 1047].forEach((f, i) =>
            blip({ type: 'square', from: f, duration: 0.14, volume: 0.28, delay: i * 0.07 }));
    },
    evolve: () => {
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
            blip({ type: 'square', from: f, duration: 0.3, volume: 0.3, delay: i * 0.16 }));
    },
    bossWake: () => {
        blip({ type: 'sawtooth', from: 120, to: 40, duration: 1.2, volume: 0.45 });
        noise({ duration: 1.0, volume: 0.35, filterFrom: 600, filterTo: 60 });
    },
    victory: () => {
        [523, 523, 523, 659, 784, 1047].forEach((f, i) =>
            blip({ type: 'square', from: f, duration: i === 5 ? 0.5 : 0.16, volume: 0.32, delay: i * 0.13 }));
    },
    badge: () => {
        [784, 988, 1319].forEach((f, i) =>
            blip({ type: 'triangle', from: f, duration: 0.3, volume: 0.3, delay: i * 0.12 }));
    },
    buy: () => blip({ type: 'square', from: 700, to: 1000, duration: 0.09, volume: 0.25 }),
    heal: () => {
        [660, 880].forEach((f, i) => blip({ type: 'triangle', from: f, duration: 0.2, volume: 0.25, delay: i * 0.1 }));
    },
    fieldMove: () => {
        noise({ duration: 0.3, volume: 0.35, filterFrom: 2500, filterTo: 200 });
        blip({ type: 'square', from: 200, to: 90, duration: 0.25, volume: 0.25 });
    },
    status: () => blip({ type: 'sawtooth', from: 300, to: 220, duration: 0.25, volume: 0.25 }),
    deny: () => blip({ type: 'square', from: 200, to: 140, duration: 0.14, volume: 0.25 }),

    // Konusma: dublaj yok, harf harf yazilirken cikan kisa "bit" sesi.
    // Perde konusana gore degisiyor, yoksa herkes ayni karakter gibi duyuluyor.
    talk: (pitch = 1) => blip({
        type: 'square', from: 640 * pitch, to: 540 * pitch,
        duration: 0.04, volume: 0.10
    }),

    // --- Prolog 3: kusatma ---
    siren: () => {
        blip({ type: 'sawtooth', from: 420, to: 700, duration: 0.5, volume: 0.16 });
        blip({ type: 'sawtooth', from: 700, to: 420, duration: 0.5, volume: 0.16, delay: 0.5 });
    },
    metalSlam: () => {
        noise({ duration: 0.45, volume: 0.4, filterFrom: 900, filterTo: 80 });
        blip({ type: 'square', from: 140, to: 50, duration: 0.35, volume: 0.3 });
    },
    explosion: () => {
        noise({ duration: 1.2, volume: 0.5, filterFrom: 1800, filterTo: 60 });
        blip({ type: 'sawtooth', from: 90, to: 26, duration: 1.0, volume: 0.4 });
    },
    beamFall: () => {
        noise({ duration: 0.7, volume: 0.45, filterFrom: 1400, filterTo: 120 });
        blip({ type: 'square', from: 200, to: 60, duration: 0.5, volume: 0.32 });
    },

    // --- Kanalizasyon ---
    // Kayma: betonda sürtünen bir hışırtı, sonuna doğru sönen
    slide: () => noise({ duration: 0.34, volume: 0.26, filterFrom: 1600, filterTo: 240 }),
    // Engele çarpma: tökezleme. Ölüm yok, ceza ses ve sarsıntı.
    stumble: () => {
        noise({ duration: 0.3, volume: 0.34, filterFrom: 700, filterTo: 90 });
        blip({ type: 'sawtooth', from: 180, to: 70, duration: 0.26, volume: 0.3 });
    },
    // Tavandan düşen damla: koridorun tek canlı sesi
    drip: () => blip({ type: 'sine', from: 1250, to: 620, duration: 0.09, volume: 0.09 }),
    // Ayak sesi: dar tünelde yankılanan tok vuruş
    step: () => blip({ type: 'triangle', from: 150, to: 96, duration: 0.06, volume: 0.09 }),

    // --- Prolog 1: laboratuvar ---
    // Camın çatlaması: kısa, tiz, kuru bir çıtırtı
    glassCrack: () => {
        noise({ duration: 0.09, volume: 0.22, filterFrom: 5200, filterTo: 1800 });
        blip({ type: 'square', from: 1500, to: 900, duration: 0.05, volume: 0.12 });
    },
    // Kütlenin kımıldaması: ağır, ıslak, alçak bir kayma
    ooze: () => {
        blip({ type: 'sine', from: 130, to: 62, duration: 0.55, volume: 0.20 });
        noise({ duration: 0.5, volume: 0.14, filterFrom: 500, filterTo: 90 });
    }
};

// --- Basit döngüsel müzik ---
// Her bölge/mekan için kısa bir bas + arpej dizisi; nota nota zamanlanır.
const TRACKS = {
    forest: { root: 196, scale: [0, 3, 5, 7, 10], tempo: 300, wave: 'triangle' },
    shadow: { root: 147, scale: [0, 2, 3, 7, 8], tempo: 360, wave: 'triangle' },
    boss: { root: 110, scale: [0, 1, 5, 6, 7], tempo: 200, wave: 'square' },
    town: { root: 262, scale: [0, 4, 7, 9, 11], tempo: 330, wave: 'triangle' },
    // Harabe şehir: ağır, boşluklu, uyumsuz. Notalar arası uzun sessizlik.
    ruin: { root: 131, scale: [0, 1, 5, 6, 8], tempo: 620, wave: 'triangle' },
    // Kusatma: hizli, alcak, uyumsuz
    siege: { root: 110, scale: [0, 1, 6, 7, 8], tempo: 190, wave: 'square' },
    // Kanalizasyon: kusatmadan da hizli ve daha alcak. Kosu durmuyor,
    // muzik de durmamali; notalar dar araliktan cikmiyor - burasi kapali.
    sewer: { root: 98, scale: [0, 1, 3, 6, 7], tempo: 150, wave: 'square' }
};

export function playMusic(name) {
    if (currentTrack === name) return;
    stopMusic();
    const track = TRACKS[name];
    if (!track || !ensureContext() || !enabled) return;

    currentTrack = name;
    let step = 0;

    const tick = () => {
        if (!enabled || currentTrack !== name) return;
        const semitone = track.scale[step % track.scale.length];
        const octave = step % 8 < 4 ? 1 : 2;
        const freq = track.root * Math.pow(2, semitone / 12) * octave;

        // Melodi
        blipMusic(freq, track.wave, track.tempo / 1000 * 0.9, 0.28);
        // Her dört adımda bir bas
        if (step % 4 === 0) blipMusic(track.root / 2, 'square', track.tempo / 1000 * 1.6, 0.22);

        step++;
    };

    tick();
    musicTimer = setInterval(tick, track.tempo);
}

function blipMusic(freq, type, duration, volume) {
    const context = ensureContext();
    if (!context) return;

    const start = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

export function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    currentTrack = null;
}
