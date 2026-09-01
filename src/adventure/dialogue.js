// Diyalog yürütücüsü: sırayla balon açar, yazıyı harf harf ortaya çıkarır.
//
// Dublaj yok. Konuşma hissi üç şeyden geliyor:
//   1. yazı harf harf yazılıyor,
//   2. her birkaç harfte kısa bir "bıt" sesi çıkıyor (konuşana göre perde),
//   3. konuşanın kafası sallanıyor (sahne `speaker` alanına bakarak yapıyor).
//
// Burada DOM/canvas yok - saf sayı ve metin, bu yüzden data testinde
// doğrulanabiliyor.

const CHARS_PER_FRAME = 0.5;    // iki karede bir harf
const BEEP_EVERY = 2;           // her iki harfte bir ses
const HOLD_BASE = 46;           // yazı bitince ekranda kalma süresi (kare)
const HOLD_PER_CHAR = 1.1;

export class Dialogue {
    constructor({ onBeep } = {}) {
        this.onBeep = onBeep || (() => {});
        this.lines = [];
        this.index = -1;
        this.revealed = 0;
        this.hold = 0;
        this.running = false;
    }

    // lines: [{ speaker: 'biz' | 'arkadas' | 'saglikli-0'..., text: '...' }]
    start(lines) {
        this.lines = lines;
        this.index = -1;
        this.running = true;
        this.next();
        return this;
    }

    next() {
        this.index++;
        this.revealed = 0;
        this.hold = 0;
        if (this.index >= this.lines.length) {
            this.running = false;
            this.line = null;
        } else {
            this.line = this.lines[this.index];
        }
    }

    // Balonu anında kes (kapı kapanınca cümlenin ortasında kalması gibi)
    cut() {
        this.running = false;
        this.line = null;
    }

    get active() {
        return this.running && !!this.line;
    }

    get speaker() {
        return this.active ? this.line.speaker : null;
    }

    // O ana kadar yazılmış kısım
    get visibleText() {
        if (!this.active) return '';
        return this.line.text.slice(0, Math.floor(this.revealed));
    }

    get finishedTyping() {
        return this.active && this.revealed >= this.line.text.length;
    }

    // Oyuncu okumayı hızlandırmak isterse: önce yazıyı tamamla, sonra geç
    advance() {
        if (!this.active) return;
        if (!this.finishedTyping) this.revealed = this.line.text.length;
        else this.next();
    }

    step() {
        if (!this.active) return;

        if (!this.finishedTyping) {
            const before = Math.floor(this.revealed);
            this.revealed = Math.min(this.line.text.length, this.revealed + CHARS_PER_FRAME);
            const after = Math.floor(this.revealed);
            // Boşlukta ses çıkmasın: konuşma sürekli bir vızıltıya dönüyor
            if (after > before && after % BEEP_EVERY === 0) {
                const ch = this.line.text[after - 1];
                if (ch && ch !== ' ') this.onBeep(this.line.speaker);
            }
            return;
        }

        this.hold++;
        if (this.hold >= HOLD_BASE + this.line.text.length * HOLD_PER_CHAR) this.next();
    }
}

// Konuşana göre ses perdesi: herkes aynı perdede "bıt"larsa hepsi aynı
// karakter gibi duyuluyor.
export const VOICE_PITCH = {
    // Profesör: kimliği hiç açılmıyor, en kalın perde onun
    profesor: 0.72,
    biz: 1.0,
    arkadas: 0.8,
    'saglikli-0': 1.22,
    'saglikli-1': 0.92,
    'saglikli-2': 1.1,
    'saglikli-3': 0.86,
    'saglikli-4': 1.3
};
