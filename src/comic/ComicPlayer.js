// Çizgi roman yürütücüsü: kareleri sırayla açar, hareketi ve balonları
// yürütür, oyuncunun ilerletmesini bekler.
//
// Burada DOM/canvas yok - saf sayı ve metin. Çizim ComicScene.js'te; akış
// böylece tarayıcı açmadan test edilebiliyor.
//
// Bir karenin ömrü:
//   1. GİRİŞ    (IN_FRAMES kare)  kare karartmadan açılır
//   2. HAREKET  (panel.motion)    çizim t = 0..1 ile canlanır
//   3. BALONLAR (varsa)           harf harf yazılır, hareketle AYNI ANDA akar
//   4. BEKLEME  (panel.hold)      okuma payı
//   5. HAZIR                      köşede ilerletme işareti; F / ÇARPI
//
// F / ÇARPI her an basılabilir: balon yazılıyorsa önce yazıyı tamamlar,
// balon bittiyse sonraki kareye geçer. Sinematik akış oyuncunun elinde.

import { Dialogue } from '../adventure/dialogue.js';

export const IN_FRAMES = 14;      // karenin açılma süresi

export class ComicPlayer {
    // onBeep(speaker): konuşma sesi   onPanel(panel): kareye girildi (ses/efekt)
    constructor(panels, { onBeep, onPanel } = {}) {
        this.panels = panels;
        this.onPanel = onPanel || (() => {});
        this.dialogue = new Dialogue({ onBeep });
        this.index = -1;
        this.frame = 0;
        this.running = false;
        this.finished = false;
    }

    start() {
        this.index = -1;
        this.frame = 0;
        this.finished = false;
        this.running = true;
        this.enter(0);
        return this;
    }

    stop() {
        this.running = false;
    }

    enter(index) {
        this.index = index;
        this.frame = 0;
        const panel = this.panel;
        if (!panel) return;
        if (panel.lines?.length) this.dialogue.start(panel.lines);
        else this.dialogue.cut();
        this.onPanel(panel);
    }

    get panel() {
        return this.panels[this.index] || null;
    }

    // Karenin açılma sönümü: 0 (siyah) -> 1 (tam görünür)
    get alpha() {
        return Math.min(1, this.frame / IN_FRAMES);
    }

    // Hareketin ilerlemesi 0..1. Duruk karelerde her zaman 1 - çizim
    // fonksiyonları t'ye bakarak "bitmiş hâli" çizsin diye.
    get motionT() {
        const panel = this.panel;
        if (!panel || !panel.motion) return 1;
        return Math.min(1, Math.max(0, (this.frame - IN_FRAMES) / panel.motion));
    }

    // Oyuncu ilerletebilir mi? (köşedeki işaret bunu gösteriyor)
    get ready() {
        const panel = this.panel;
        if (!panel || !this.running) return false;
        if (this.dialogue.active) return false;
        return this.frame >= IN_FRAMES + (panel.motion || 0) + (panel.hold || 0);
    }

    // F / ÇARPI. Balon yazılıyorsa hızlandırır, bittiyse sonraki kareye geçer.
    advance() {
        if (!this.running) return;
        if (this.dialogue.active) {
            this.dialogue.advance();
            return;
        }
        // Kare henüz açılıyorsa ya da hareketi sürüyorsa: önce onu tamamla.
        // Sabırsız oyuncu sahneyi atlamış olmasın, hızlandırmış olsun.
        const panel = this.panel;
        const motionEnd = IN_FRAMES + (panel?.motion || 0);
        if (this.frame < motionEnd) {
            this.frame = motionEnd;
            return;
        }
        this.next();
    }

    next() {
        if (this.index + 1 >= this.panels.length) {
            this.running = false;
            this.finished = true;
            return;
        }
        this.enter(this.index + 1);
    }

    step() {
        if (!this.running) return;
        this.frame++;
        this.dialogue.step();

        // Kesilen cümle: kapı kapanınca balon cümlenin ortasında susar.
        // Hareketsiz karede kesme yok - motionT hep 1 olduğu için cümle
        // daha başlamadan susardı.
        const panel = this.panel;
        if (panel?.cut && panel.motion && this.dialogue.active && this.motionT >= panel.cut) {
            const last = this.dialogue.index >= panel.lines.length - 1;
            if (last) this.dialogue.cut();
        }
    }
}
