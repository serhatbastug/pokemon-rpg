// Oyun kolu desteği (PS5 DualSense). Tarayıcı Gamepad API'sinde tuş olayı
// yoktur; durum her karede taranır (poll) ve basılma anları burada üretilir.
//
// DualSense, Chrome'da "standard gamepad" olarak eşlenir:
//   eksen 0/1 = sol analog X/Y        eksen 2/3 = sağ analog
//   tuş 0 = Çarpı   1 = Daire   2 = Kare   3 = ÜÇGEN
//   tuş 12/13/14/15 = D-pad yukarı/aşağı/sol/sağ
//
// Sağ analogu aşağı çekmek (kanalizasyonda KAYMA) bir tuş değil, eksendir;
// bu yüzden eşiği geçtiği an sahte bir tuş adı üretiliyor: 'rstickDown'.
// Böylece kayma da diğer tuşlar gibi onButtonDown ile dinlenebiliyor.
//
// Kol tarayıcıya ancak bir tuşuna basıldıktan sonra görünür; bu yüzden
// "bağlı" durumu ilk girdide oluşur.
//
// BİRDEN FAZLA KOL: iki kişilik arenada her oyuncunun kendi kolu var. Bu
// yüzden her kol ayrı bir YUVADA (PadSlot) takip ediliyor - basılı tuş kümesi
// kola özel, yoksa iki kolun tuşları birbirine karışırdı. Yuva sırası
// tarayıcının verdiği kol numarasına göre: 0. yuva = 1. oyuncu, 1. yuva =
// 2. oyuncu. Tek kol takılıysa yalnızca 0. yuva vardır, 2. oyuncu klavyede
// kalır. Menü ve prolog sahneleri tek kolla oynandığı için 1. kolu okuyor.

import { setDevice } from './device.js';

export const BUTTONS = {
    cross: 0,
    circle: 1,
    square: 2,
    triangle: 3,
    l1: 4,
    r1: 5,
    l2: 6,
    r2: 7,
    share: 8,
    options: 9,
    dpadUp: 12,
    dpadDown: 13,
    dpadLeft: 14,
    dpadRight: 15
};

// Analog çubuğun ölü bölgesi: kol boştayken bile eksenler tam sıfır dönmez,
// bu eşiğin altı yok sayılır.
export const DEADZONE = 0.28;

// Sağ analog bu kadar aşağı çekilince "kay" sayılır. Ölü bölgeden yüksek:
// kazara değen parmak sahnenin ortasında bir çarpma demek.
export const RSTICK_TRIGGER = 0.55;

// Kol takılı değilken kaç karede bir yeniden bakılır (60 fps'te ~yarım
// saniye). Tarama ucuz ama bedava değil: her çağrı yeni bir liste ayırıyor.
export const SCAN_INTERVAL = 30;

// Kol yokken okunan sabit nötr durum. Paylaşılan bir nesne: okuyanlar bunu
// değiştirmiyor, her karede yenisini ayırmaya değmez.
const NEUTRAL = Object.freeze({ x: 0, y: 0, magnitude: 0, rx: 0, ry: 0, pressed: [] });

const BUTTON_NAMES = Object.fromEntries(Object.entries(BUTTONS).map(([name, i]) => [i, name]));

// Saf fonksiyon: ham kol anlık görüntüsünden yön ve basılı tuşları çıkarır.
// (Tarayıcı gerektirmez, bu yüzden tests/data.test.mjs içinde test edilir.)
export function readPad(pad) {
    const axes = pad?.axes || [];
    const buttons = pad?.buttons || [];
    const isDown = (index) => !!(buttons[index]?.pressed ?? buttons[index]);

    let x = axes[0] || 0;
    let y = axes[1] || 0;
    let magnitude = Math.hypot(x, y);

    if (magnitude < DEADZONE) {
        x = 0;
        y = 0;
        magnitude = 0;
    } else {
        // Ölü bölge çıkarıldıktan sonra 0..1 aralığına yeniden ölçeklenir,
        // böylece eşiğin hemen üstünde ani sıçrama olmaz.
        const scaled = Math.min(1, (magnitude - DEADZONE) / (1 - DEADZONE));
        x = (x / magnitude) * scaled;
        y = (y / magnitude) * scaled;
        magnitude = scaled;
    }

    // D-pad analogla aynı işi görür: basılıysa yönü o belirler
    let dx = 0;
    let dy = 0;
    if (isDown(BUTTONS.dpadLeft)) dx -= 1;
    if (isDown(BUTTONS.dpadRight)) dx += 1;
    if (isDown(BUTTONS.dpadUp)) dy -= 1;
    if (isDown(BUTTONS.dpadDown)) dy += 1;
    if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        x = dx / len;
        y = dy / len;
        magnitude = 1;
    }

    // Sağ analog: yönü değil, "aşağı çekildi mi" bilgisi kullanılıyor.
    let rx = axes[2] || 0;
    let ry = axes[3] || 0;
    if (Math.hypot(rx, ry) < DEADZONE) { rx = 0; ry = 0; }

    const pressed = [];
    for (const [index, name] of Object.entries(BUTTON_NAMES)) {
        if (isDown(Number(index))) pressed.push(name);
    }
    // Eksenden üretilen sahte tuş: kayma
    if (ry >= RSTICK_TRIGGER) pressed.push('rstickDown');

    return { x, y, magnitude, rx, ry, pressed };
}

// Tek bir kolun durumu. Basılma anları burada üretiliyor: bir tuşun YENİ
// basılıp basılmadığı, O KOLUN bir önceki karedeki tuş kümesine bakılarak
// belirlenir - başka bir koldaki tuş bunu etkilemez.
export class PadSlot {
    constructor() {
        this.state = { x: 0, y: 0, magnitude: 0, rx: 0, ry: 0, pressed: [] };
        this.held = new Set();
        this.armed = false;   // analog bir kez nötre dönmeden yön üretmez
        this.seeded = false;  // ilk okuma "tuşa basıldı" saymaz
    }

    // Kolun yeni anlık görüntüsünü işler; YENİ basılan tuşların adlarını döner.
    apply(pad) {
        const reading = readPad(pad);

        // Bir kez bile nötre dönmemiş analog yön üretmez. Bozuk ya da yanlış
        // eşlenmiş bir kol ekseni sabit 1.0 raporlayabiliyor; bu koruma
        // olmadan karakter kendi kendine yürüyor.
        if (reading.magnitude === 0) this.armed = true;
        this.state = this.armed ? reading : { ...reading, x: 0, y: 0, magnitude: 0 };

        const now = new Set(this.state.pressed);

        // Kol YENİ görüldü: o andaki tuş durumu basılmış sayılmaz. Chrome kolu
        // ilk sıraladığında bir kare boyunca gerçek olmayan bir durum
        // bildirebiliyor; onu basılma saymak hem ekrandaki ipucunu kimse kola
        // dokunmadan kol simgesine çeviriyor, hem de kanalizasyonda sahne
        // açılır açılmaz kendiliğinden zıplatıyordu.
        if (!this.seeded) {
            this.seeded = true;
            this.held = now;
            return [];
        }

        const fresh = [];
        for (const name of now) if (!this.held.has(name)) fresh.push(name);
        this.held = now;
        return fresh;
    }
}

export class GamepadManager {
    constructor() {
        this.slots = [];          // takılı kollar, tarayıcı sırasına göre
        this.connected = false;
        this.handlers = [];       // (tuş) -> ...   yalnızca 1. kol
        this.slotHandlers = [];   // (yuva, tuş) -> ...   her kol

        this.scanCountdown = 0;    // kol yokken bir sonraki taramaya kalan kare

        // Kol takıldığında tarayıcı bu olayı gönderir - ama olaya GÜVENİLMEZ.
        // Sayfa yeniden yüklendiğinde ya da kol sayfa açılmadan önce
        // uyandırıldığında olay bu dinleyiciye hiç ulaşmayabiliyor; o zaman
        // kol takılı dururken oyun kolu hiç görmüyordu. Olay yalnızca
        // taramayı ERKEN başlatır, tek yol değildir (bkz. scanForPads).
        window.addEventListener('gamepadconnected', () => {
            this.connected = true;
            this.scanCountdown = 0;
        });
        window.addEventListener('gamepaddisconnected', () => {
            if (this.allPads().length === 0) this.reset();
        });
    }

    reset() {
        this.connected = false;
        this.slots = [];
        this.scanCountdown = 0;
    }

    // Kol var mı? 'gamepadconnected' olayı gelmediyse de bulunur. Her karede
    // aramak boşuna liste ayırmak olurdu, bu yüzden SCAN_INTERVAL karede bir.
    scanForPads() {
        if (this.scanCountdown > 0) {
            this.scanCountdown--;
            return false;
        }
        this.scanCountdown = SCAN_INTERVAL;
        if (this.allPads().length === 0) return false;
        this.connected = true;
        return true;
    }

    // Takılı kollar, tarayıcının verdiği numaraya göre sıralı. Sıranın sabit
    // olması şart: yuva sırası oyuncu sırası demek.
    allPads() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const live = [];
        for (const pad of pads) if (pad && pad.connected !== false) live.push(pad);
        return live.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    }

    firstPad() {
        return this.allPads()[0] || null;
    }

    // Kaç kol takılı (0, 1, 2, ...). Arena buna bakıp HUD'da tuş kapağı mı
    // yoksa kol simgesi mi göstereceğine karar veriyor.
    get padCount() {
        return this.slots.length;
    }

    // Her karede bir kez çağrılır. Yeni basılan tuşlar için kayıtlı
    // dinleyicileri tetikler (tuş bırakılmadan tekrar tetiklenmez).
    poll() {
        if (!this.connected && !this.scanForPads()) return;

        const pads = this.allPads();
        if (pads.length === 0) {
            this.reset();
            return;
        }

        // Yuva sayısı kol sayısını izler. Çıkarılan bir kolun yuvası silinir;
        // yerine takılan kol sıfırdan başlar - basılı tuşları devralmasın.
        while (this.slots.length < pads.length) this.slots.push(new PadSlot());
        if (this.slots.length > pads.length) this.slots.length = pads.length;

        for (let i = 0; i < pads.length; i++) {
            const slot = this.slots[i];
            const fresh = slot.apply(pads[i]);

            // Ekrandaki öğretmeler "son girdi kazanır" ile cihaz seçiyor.
            // Takılı durmak yetmez, KOLA DOKUNULMUŞ olmalı: bir tuşa yeni
            // basılmış ya da analog belirgin biçimde itilmiş olmalı
            // (sürüklenme sayılmaz).
            if (fresh.length > 0 || slot.state.magnitude > 0.4) setDevice('gamepad');

            for (const name of fresh) {
                for (const handler of this.slotHandlers) handler(i, name);
                if (i === 0) for (const handler of this.handlers) handler(name);
            }
        }
    }

    // Sol analog / D-pad yönü: { x, y, magnitude }
    stick() {
        return this.stickAt(0);
    }

    stickAt(index) {
        return this.slots[index]?.state || NEUTRAL;
    }

    // Sağ analogun ham konumu: { x, y }. Kayma bunun y'sinden üretiliyor.
    rightStick() {
        const state = this.stickAt(0);
        return { x: state.rx || 0, y: state.ry || 0 };
    }

    isDown(name) {
        return this.isDownAt(0, name);
    }

    isDownAt(index, name) {
        return !!this.slots[index]?.held.has(name);
    }

    // Bir tuşa basıldığı anda çağrılır (handler'a tuş adı gelir). Yalnızca
    // 1. kol: menü ve prolog sahneleri tek kolla oynanıyor.
    onButtonDown(handler) {
        this.handlers.push(handler);
    }

    // Hangi kolda olursa olsun bir tuşa basıldığı anda çağrılır (handler'a
    // yuva sırası ve tuş adı gelir). İki kişilik arena bunu kullanıyor.
    onSlotButtonDown(handler) {
        this.slotHandlers.push(handler);
    }
}
