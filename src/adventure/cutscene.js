// Sahne betiği yürütücüsü: prologun oynanan ama yönlendirilmiş anları için.
//
// Prologda oyuncunun kontrolü yer yer kısıtlanıyor (3. bölümde arkadaşı
// kurtaramamalı). Bunu her sahnede elle sayaç tutarak yazmak yerine, sahne
// bir "an" listesi olarak tarif ediliyor ve bu sınıf sırayla yürütüyor.
//
// Burada DOM/canvas yok - saf sayı ve geri çağırma. Böylece sahnenin akışı
// çizimden bağımsız test edilebiliyor (tests/data.test.mjs).
//
// Bir an (beat):
//   {
//     name:   'kol',                       // testte ve hata ayıklamada okunur
//     frames: 90,                          // kaç kare sürer (0 = sonsuz)
//     lock:   true,                        // oyuncu bu an boyunca hareket edemez
//     onEnter(state)                       // ana girerken bir kez
//     onStep(state, t)                     // her karede; t = 0..1 ilerleme
//     onExit(state)                        // andan çıkarken bir kez
//     until(state)                         // true dönene kadar sürer (frames yerine)
//   }
//
// `frames: 0` ve `until` birlikte kullanılınca an, until doğrulanana kadar
// sürer; ikisi de yoksa an tek karede biter.

export class Cutscene {
    constructor(beats, state = {}) {
        this.beats = beats;
        this.state = state;
        this.index = -1;
        this.frame = 0;        // suren anin kaçıncı karesindeyiz
        this.running = false;
        this.finished = false;
    }

    start() {
        this.index = -1;
        this.frame = 0;
        this.finished = false;
        this.running = true;
        this.advance();
        return this;
    }

    stop() {
        this.running = false;
    }

    get beat() {
        return this.beats[this.index] || null;
    }

    // Suren anin adi: sahne cizimi buna bakarak ne gostereceğine karar verir
    get name() {
        return this.beat ? this.beat.name : null;
    }

    // Oyuncu bu an boyunca hareket edebiliyor mu?
    get locked() {
        return this.running && !!this.beat && this.beat.lock !== false;
    }

    // Suren anin 0..1 ilerlemesi. Süresi belirsiz anlarda 0 kalır.
    get progress() {
        const beat = this.beat;
        if (!beat || !beat.frames) return 0;
        return Math.min(1, this.frame / beat.frames);
    }

    // Bir sonraki ana geç. Süresi sıfır olan anlar üst üste gelebilir, bu
    // yüzden döngü: hepsi tek karede işlenir.
    advance() {
        while (this.running) {
            const previous = this.beat;
            previous?.onExit?.(this.state);

            this.index++;
            this.frame = 0;

            if (this.index >= this.beats.length) {
                this.running = false;
                this.finished = true;
                return;
            }

            const beat = this.beat;
            beat.onEnter?.(this.state);

            // Süresi de koşulu da olmayan an tek karede biter
            if (!beat.frames && !beat.until) continue;
            return;
        }
    }

    step() {
        if (!this.running) return;

        const beat = this.beat;
        beat.onStep?.(this.state, this.progress);
        this.frame++;

        const timeUp = beat.frames > 0 && this.frame >= beat.frames;
        const conditionMet = beat.until ? beat.until(this.state) : false;
        // Hem süre hem koşul verilmişse süre bir üst sınırdır: sahne
        // koşul hiç gerçekleşmese bile takılıp kalmaz.
        if (beat.until ? (conditionMet || timeUp) : timeUp) this.advance();
    }
}

// --- Ekran efektleri ---
// Sahne betiklerinin sık kullandığı iki şey: perde (karartma/açılma) ve
// sarsıntı. İkisi de saf sayı olduğu için burada duruyor.

// Kameranın o karedeki sarsıntı kayması. strength piksel, 0 olunca durur.
export function shakeOffset(frame, strength) {
    if (strength <= 0) return { x: 0, y: 0 };
    // Sinüsler farklı periyotta: düzenli titreşim yerine düzensiz sarsıntı
    return {
        x: Math.round(Math.sin(frame * 1.7) * strength),
        y: Math.round(Math.sin(frame * 2.3 + 1.1) * strength * 0.6)
    };
}

// 0'dan 1'e ve geri: patlama parlaması gibi ani çıkıp sönen değerler için
export function flash(t) {
    if (t <= 0 || t >= 1) return 0;
    return t < 0.12 ? t / 0.12 : (1 - t) / 0.88;
}
