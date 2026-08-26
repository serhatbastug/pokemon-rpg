// Kolla menü gezinme: karakter seçimi ve "SAVAŞ BİTTİ" penceresi.
//
// Bu iki ekranda çizen bir sahne yok - menü sahnesi durmuş, savaş döngüsü
// bitmiş - yani kolu kimse taramıyor. Bu yüzden burada küçük bir döngü açılıyor
// ve yalnızca bu ekranlar açıkken çalışıyor. Aynı anda iki yerden poll()
// çağrılmıyor: menü, savaş ve bu döngü birbirini dışlıyor.
//
// Kol farenin gittiği yerden gidiyor: her şey gerçek düğmelerin click()'ini
// çağırıyor, ayrı bir "kol yolu" yok.

// Analog bu kadar itilince yön sayılır. Kart ızgarasında ölü bölge eşiği
// yetmiyor: az itiş kazara kart atlatıyordu.
const STICK_THRESHOLD = 0.5;

// Analog itili tutulunca imlecin kaymaya başlaması ve sonraki adımlar (kare)
const REPEAT_FIRST = 22;
const REPEAT_NEXT = 9;

// Sağ analog tam itildiğinde sayfanın kare başına kaydığı piksel
const SCROLL_SPEED = 16;

export class PadMenu {
    constructor({ gamepad, characterSelect, onStart, onBack, onRestart }) {
        this.gamepad = gamepad;
        this.select = characterSelect;
        this.onStart = onStart;
        this.onBack = onBack;
        this.onRestart = onRestart;

        this.mode = null;     // null | 'selection' | 'gameover'
        this.rafId = null;
        this.repeat = 0;      // bir sonraki imleç adımına kalan kare
        this.moved = false;   // analog itilip tutuluyor mu

        this.padHint = document.getElementById('pad-hint');
        this.gameoverHint = document.getElementById('gameover-pad-hint');
        this.hintText = null;

        gamepad?.onSlotButtonDown((slot, button) => this.handleButton(slot, button));
    }

    get running() {
        return !!this.mode;
    }

    start(mode) {
        this.mode = mode;
        this.repeat = 0;
        this.moved = false;
        this.updateHints();

        if (this.rafId) return;
        const loop = () => {
            this.rafId = requestAnimationFrame(loop);
            this.step();
        };
        this.rafId = requestAnimationFrame(loop);
    }

    stop() {
        this.mode = null;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.select.clearFocus();
        this.updateHints();
    }

    // Sırası gelen oyuncu kendi koluyla seçer: 1. oyuncu ilk kolla, 2. oyuncu
    // ikinciyle. O oyuncunun kolu takılı değilse (tek kol var) hangi kol olursa
    // olsun kabul edilir - yoksa 2. oyuncu seçim yapamadan ekran kilitlenirdi.
    accepts(slot) {
        const turnSlot = this.select.selectionTurn - 1;
        if (turnSlot >= (this.gamepad?.padCount || 0)) return true;
        return slot === turnSlot;
    }

    handleButton(slot, button) {
        if (!this.mode) return;

        if (this.mode === 'gameover') {
            if (button === 'cross') this.onRestart?.();
            return;
        }

        if (!this.accepts(slot)) return;

        // Detay penceresi açıkken ÇARPI seçer, DAİRE kapatır
        if (this.select.modalOpen) {
            if (button === 'cross') this.select.confirmModal();
            else if (button === 'circle') this.select.closeModal();
            return;
        }

        if (button === 'cross') this.select.openFocused();
        else if (button === 'circle') this.onBack?.();
        else if (button === 'triangle') this.onStart?.();
    }

    step() {
        if (!this.mode) return;

        this.gamepad?.poll();
        const pads = this.gamepad?.padCount || 0;
        this.updateHints(pads);

        // "SAVAŞ BİTTİ" penceresinde gezinecek bir şey yok, tek tuş var
        if (this.mode !== 'selection' || pads === 0) return;
        // Detay penceresi açıkken imleç ızgarada gezmez
        if (this.select.modalOpen) return;

        this.scrollWithRightStick(pads);

        if (this.select.focusIndex < 0) this.select.focusCard(0);

        // Kabul edilen kolların en çok itilmiş ekseni
        let ax = 0;
        let ay = 0;
        for (let slot = 0; slot < pads; slot++) {
            if (!this.accepts(slot)) continue;
            const stick = this.gamepad.stickAt(slot);
            if (Math.abs(stick.x) > Math.abs(ax)) ax = stick.x;
            if (Math.abs(stick.y) > Math.abs(ay)) ay = stick.y;
        }

        let dx = Math.abs(ax) > STICK_THRESHOLD ? Math.sign(ax) : 0;
        let dy = Math.abs(ay) > STICK_THRESHOLD ? Math.sign(ay) : 0;

        // Çapraz itişte tek yön: baskın eksen kazanır. (D-pad çaprazında iki
        // eksen eşit gelir; o zaman yatay seçilir.)
        if (dx !== 0 && dy !== 0) {
            if (Math.abs(ax) >= Math.abs(ay)) dy = 0;
            else dx = 0;
        }

        if (dx === 0 && dy === 0) {
            this.repeat = 0;
            this.moved = false;
            return;
        }

        if (this.repeat > 0) {
            this.repeat--;
            return;
        }

        this.select.moveFocus(dx, dy);
        this.repeat = this.moved ? REPEAT_NEXT : REPEAT_FIRST;
        this.moved = true;
    }

    // Sağ analog sayfayı kaydırır: kart ızgarası ekrandan uzun, "2 KİŞİLİK
    // OYNA" düğmesi yukarıda kalıyor. İmleci sırası gelen oyuncu gezdirir ama
    // ekranı hangi kol olursa olsun kaydırabilir - bakmak sıra beklemez.
    scrollWithRightStick(pads) {
        let ry = 0;
        for (let slot = 0; slot < pads; slot++) {
            const stick = this.gamepad.stickAt(slot);
            if (Math.abs(stick.ry || 0) > Math.abs(ry)) ry = stick.ry;
        }
        if (!ry) return;
        window.scrollBy(0, ry * SCROLL_SPEED);
    }

    // Ekrandaki kol öğretmesi: yalnızca kol takılıyken görünür, sırası gelen
    // oyuncunun numarasını yazar.
    updateHints(pads = this.gamepad?.padCount || 0) {
        const onSelection = this.mode === 'selection' && pads > 0;
        const onGameOver = this.mode === 'gameover' && pads > 0;

        this.padHint?.classList.toggle('hidden', !onSelection);
        this.gameoverHint?.classList.toggle('hidden', !onGameOver);

        if (!onSelection || !this.padHint) return;
        const text = `Kol - Oyuncu ${this.select.selectionTurn} seçiyor: sol analog gez · sağ analog kaydır · ÇARPI seç · DAİRE geri · ÜÇGEN başlat`;
        if (text !== this.hintText) {
            this.padHint.textContent = text;
            this.hintText = text;
        }
    }
}
