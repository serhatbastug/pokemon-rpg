// Seslendirme: assets/voice/<id>.mp3 dosyası varsa satırı o okur, yoksa
// diyalogdaki "bıt" sesi çalışmaya devam eder.
//
// Satır -> dosya eşlemesi assets/voice/lines.json'da (konuşan + metin = anahtar).
// Dosyası olan satırlar `voiced: true` işaretli (tools/voice-manifest.mjs).

const DIR = 'assets/voice/';
const key = (speaker, text) => speaker + '|' + text;

let ids = null;          // anahtar -> dosya kimliği
let audio = null;
let playing = false;

async function loadIds() {
    try {
        const res = await fetch(DIR + 'lines.json');
        const list = await res.json();
        ids = new Map(list.filter(l => l.voiced).map(l => [key(l.speaker, l.text), l.id]));
    } catch {
        ids = new Map();
    }
}
loadIds();

function stop() {
    playing = false;
    if (audio) { audio.pause(); audio = null; }
}

function play(line) {
    stop();
    const id = ids?.get(key(line.speaker, line.text));
    if (!id) return;
    const a = new Audio(DIR + id + '.mp3');
    audio = a;
    playing = true;
    // Dosya yoksa ya da çalamazsa bıt sesine dön
    a.addEventListener('error', () => { if (audio === a) playing = false; });
    a.addEventListener('ended', () => { if (audio === a) playing = false; });
    a.play().catch(() => { if (audio === a) playing = false; });
}

// Dialogue'a verilecek bağlantılar: Dialogue({ onBeep, ...Voice.hooks })
export const Voice = {
    hooks: { onLine: play, onStop: stop, voiceActive: () => playing }
};
