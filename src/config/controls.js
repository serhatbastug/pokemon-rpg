// Ekranda gösterilen kontrol öğretmeleri.
//
// Oyun yeni bir tuş istediğinde ekranın üstünde "[simge] İLE ZIPLA" beliriyor.
// Simge O ANDA NE İLE OYNANDIĞINA göre değişiyor: kolda KARE/ÇARPI, klavyede
// SPACE/SHIFT. Yanlış simge gösteren bir öğretme hiç göstermemekten kötü,
// bu yüzden cihaz core/device.js'te "son girdi kazanır" ile takip ediliyor.
//
// Burada DOM/canvas yok - yalnızca veri ve sayaç (tests/data.test.mjs bunu
// kullanıyor). Çizim src/pixel/controlHint.js'te.

// key: klavye tuş kapağı (dizi verilirse birden fazla kapak çizilir)
// pad: kol simgesi adı (controlHint.js'teki PAD_GLYPHS anahtarları)
// text: simgeden sonra okunan cümle; "İLE" araya çizim sırasında giriyor
export const CONTROLS = {
    fire:  { key: 'SPACE', pad: 'square',  text: 'ATEŞ ET' },
    jump:  { key: 'SHIFT', pad: 'cross',   text: 'ZIPLA' },
    slide: { key: 'ENTER', pad: 'rstick',  text: 'KAY' },
    lane:  { key: ['A', 'D'], pad: 'lstick', text: 'ŞERİT DEĞİŞTİR' }
};

export const HINT_FADE_IN = 14;
export const HINT_FADE_OUT = 20;
export const HINT_FRAMES = 260;      // kendiliğinden kaybolma süresi

// Ekrandaki tek öğretmenin ömrü. Sahne her karede step() çağırır; oyuncu
// istenen şeyi yapınca dismiss() ile yazı hızla söner - öğrenildikten sonra
// ekranda duran yazı sahnenin önüne geçiyor.
export class ControlHint {
    constructor() {
        this.action = null;
        this.frames = 0;
        this.elapsed = 0;
        this.taught = new Set();   // bir kez öğretilen ikinci kez gösterilmez
    }

    // once: yalnızca ilk kez göster (öğretme davranışı)
    show(action, { frames = HINT_FRAMES, once = true } = {}) {
        if (!CONTROLS[action]) return false;
        if (once && this.taught.has(action)) return false;
        if (this.action === action && this.frames > 0) return false;
        this.action = action;
        this.frames = frames;
        this.elapsed = 0;
        this.taught.add(action);
        return true;
    }

    // Oyuncu istenen şeyi yaptı: yazı sönmeye başlasın
    dismiss(action = null) {
        if (!this.action) return;
        if (action && this.action !== action) return;
        this.frames = Math.min(this.frames, HINT_FADE_OUT);
    }

    step() {
        if (this.frames <= 0) return;
        this.frames--;
        this.elapsed++;
        if (this.frames <= 0) this.action = null;
    }

    get visible() {
        return this.frames > 0 && !!this.action;
    }

    get alpha() {
        if (!this.visible) return 0;
        const inAlpha = Math.min(1, this.elapsed / HINT_FADE_IN);
        const outAlpha = Math.min(1, this.frames / HINT_FADE_OUT);
        return Math.min(inAlpha, outAlpha);
    }
}
