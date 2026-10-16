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
let musicEnabled = true;
try { musicEnabled = localStorage.getItem('musicOff') !== '1'; } catch (e) { /* özel pencere */ }

function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    // Müzik: daha kısık ve yumuşak (tiz kısmı kesilir); yorucu olmasın
    musicGain = ctx.createGain();
    musicGain.gain.value = musicEnabled ? 0.10 : 0;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 1300;
    musicGain.connect(soften);
    soften.connect(master);
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
        type: 'triangle', from: 520 * pitch, to: 450 * pitch,
        duration: 0.05, volume: 0.07
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
    boss: { root: 110, scale: [0, 1, 5, 6, 7], tempo: 280, wave: 'triangle', rest: 0.3 },
    town: { root: 262, scale: [0, 4, 7, 9, 11], tempo: 330, wave: 'triangle' },
    // Harabe şehir: ağır, boşluklu, uyumsuz. Notalar arası uzun sessizlik.
    ruin: { root: 131, scale: [0, 1, 5, 6, 8], tempo: 620, wave: 'triangle' },
    // Kusatma: hizli, alcak, uyumsuz
    siege: { root: 110, scale: [0, 1, 6, 7, 8], tempo: 270, wave: 'triangle', rest: 0.3 },
    // Kanalizasyon: kusatmadan da hizli ve daha alcak. Kosu durmuyor,
    // muzik de durmamali; notalar dar araliktan cikmiyor - burasi kapali.
    sewer: { root: 98, scale: [0, 1, 3, 6, 7], tempo: 240, wave: 'triangle', rest: 0.3 }
};

// Müzik her çalışta aynı beş notayı döndürmesin: parça başına sabit tohumdan
// 64 adımlık bir cümle üretilir (rastgele yürüyüş + sessiz adımlar), her turda
// başka bir yarım ton kayar. Böylece ses uzun süre dinlenince de yormaz.
function trackSeed(name) {
    let h = 7;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
}

function buildPhrase(track, name) {
    let seed = trackSeed(name);
    const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const rest = track.rest ?? 0.38;
    const notes = [];
    let idx = 0;
    for (let i = 0; i < 64; i++) {
        idx = Math.max(0, Math.min(track.scale.length - 1, idx + Math.floor(rand() * 3) - 1));
        const silent = i % 8 !== 0 && rand() < rest;
        notes.push(silent ? null : { semitone: track.scale[idx], octave: rand() < 0.25 ? 2 : 1 });
    }
    return notes;
}

const TURN_SHIFT = [0, 0, -2, 3, 0, -5];

export function setMusicEnabled(value) {
    musicEnabled = value;
    try { localStorage.setItem('musicOff', value ? '0' : '1'); } catch (e) { /* önemli değil */ }
    if (musicGain) musicGain.gain.value = value ? 0.10 : 0;
    if (fileBus) fileBus.gain.value = value ? (FILE_TRACKS[currentTrack]?.volume ?? 0.5) : 0;
}

export function isMusicEnabled() {
    return musicEnabled;
}

// M tuşu: müziği aç/kapat (efektler ve konuşma sesleri kalır)
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey) setMusicEnabled(!musicEnabled);
    });
}

// Telifsiz (CC0) gerçek müzik dosyaları: assets/audio/ (kaynaklar CREDITS.md'de).
// Dosyası olan parçalar bunlarla çalar; yüklenemezse yukarıdaki sentez müzik
// devreye girer.
const FILE_TRACKS = {
    shadow: { src: 'assets/audio/post-apocalyptic_morning_bpm80_0.ogg', volume: 0.5 },
    ruin: { src: 'assets/audio/post-apocalyptic_night_bpm80_0.ogg', volume: 0.5 },
    forest: { src: 'assets/audio/post-apocalyptic_night_bpm80_0.ogg', volume: 0.5 },
    boss: { src: 'assets/audio/Chase.ogg', volume: 0.45 },
    siege: { src: 'assets/audio/Chase.ogg', volume: 0.45 },
    sewer: { src: 'assets/audio/Chase.ogg', volume: 0.45 }
};

let fileAudio = null;
let fileNode = null;
let fileBus = null;

function stopFileMusic() {
    if (!fileAudio) return;
    const old = fileAudio;
    fileAudio = null;
    old.pause();
}

function playFileMusic(name, def) {
    const context = ensureContext();
    if (!context || typeof Audio === 'undefined') return false;
    if (!fileBus) {
        fileBus = context.createGain();
        fileBus.connect(master);
    }
    fileBus.gain.value = musicEnabled ? def.volume : 0;
    const audio = new Audio(def.src);
    audio.loop = true;
    audio.crossOrigin = 'anonymous';
    fileAudio = audio;
    audio.addEventListener('error', () => {
        // Dosya yoksa/bozuksa sentez müziğe dön
        if (fileAudio === audio && currentTrack === name) {
            fileAudio = null;
            currentTrack = null;
            playSynthMusic(name);
        }
    });
    try {
        const node = context.createMediaElementSource(audio);
        node.connect(fileBus);
        fileNode = node;
    } catch (e) {
        return false;
    }
    audio.play().catch(() => {});
    return true;
}

export function playMusic(name) {
    if (currentTrack === name) return;
    stopMusic();
    if (!ensureContext() || !enabled) return;
    const def = FILE_TRACKS[name];
    if (def) {
        currentTrack = name;
        if (playFileMusic(name, def)) return;
        currentTrack = null;
    }
    playSynthMusic(name);
}

function playSynthMusic(name) {
    if (currentTrack === name) return;
    const track = TRACKS[name];
    if (!track) return;

    currentTrack = name;
    const phrase = buildPhrase(track, name);
    let step = 0;

    const tick = () => {
        if (!enabled || currentTrack !== name) return;
        const pos = step % phrase.length;
        const turn = Math.floor(step / phrase.length);
        const note = phrase[pos];
        const shift = TURN_SHIFT[turn % TURN_SHIFT.length];

        if (note) {
            const freq = track.root * Math.pow(2, (note.semitone + shift) / 12) * note.octave;
            blipMusic(freq, track.wave, track.tempo / 1000 * 1.1, 0.22);
        }
        // Her sekiz adımda bir uzun, kısık bas
        if (pos % 8 === 0) blipMusic(track.root / 2 * Math.pow(2, shift / 12), 'triangle', track.tempo / 1000 * 3, 0.2);

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
    stopFileMusic();
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    currentTrack = null;
}
