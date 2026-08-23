// Oyun kolu desteği (PS5 DualSense). Tarayıcı Gamepad API'sinde tuş olayı
// yoktur; durum her karede taranır (poll) ve basılma anları burada üretilir.
//
// DualSense, Chrome'da "standard gamepad" olarak eşlenir:
//   eksen 0/1 = sol analog X/Y        eksen 2/3 = sağ analog
//   tuş 0 = Çarpı   1 = Daire   2 = Kare   3 = ÜÇGEN
//   tuş 12/13/14/15 = D-pad yukarı/aşağı/sol/sağ
//
// Kol tarayıcıya ancak bir tuşuna basıldıktan sonra görünür; bu yüzden
// "bağlı" durumu ilk girdide oluşur.

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

    const pressed = [];
    for (const [index, name] of Object.entries(BUTTON_NAMES)) {
        if (isDown(Number(index))) pressed.push(name);
    }

    return { x, y, magnitude, pressed };
}

export class GamepadManager {
    constructor() {
        this.state = { x: 0, y: 0, magnitude: 0, pressed: [] };
        this.held = new Set();
        this.connected = false;
        this.handlers = [];

        // Kol takıldığında tarayıcı bu olayı gönderir. Olay gelene kadar
        // getGamepads() hiç çağrılmaz: her karede çağırmak her seferinde yeni
        // bir liste ayırıyor ve kol yokken bunun karşılığı yok.
        window.addEventListener('gamepadconnected', () => {
            this.connected = true;
        });
        window.addEventListener('gamepaddisconnected', () => {
            if (!this.firstPad()) this.reset();
        });
    }

    reset() {
        this.connected = false;
        this.held.clear();
        this.state = { x: 0, y: 0, magnitude: 0, pressed: [] };
    }

    firstPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) if (pad && pad.connected !== false) return pad;
        return null;
    }

    // Her karede bir kez çağrılır. Yeni basılan tuşlar için kayıtlı
    // dinleyicileri tetikler (tuş bırakılmadan tekrar tetiklenmez).
    poll() {
        if (!this.connected) return;   // kol yokken tarama yapılmaz

        const pad = this.firstPad();
        if (!pad) {
            this.reset();
            return;
        }

        this.state = readPad(pad);

        const now = new Set(this.state.pressed);
        for (const name of now) {
            if (!this.held.has(name)) {
                for (const handler of this.handlers) handler(name);
            }
        }
        this.held = now;
    }

    // Sol analog / D-pad yönü: { x, y, magnitude }
    stick() {
        return this.state;
    }

    isDown(name) {
        return this.held.has(name);
    }

    // Bir tuşa basıldığı anda çağrılır (handler'a tuş adı gelir)
    onButtonDown(handler) {
        this.handlers.push(handler);
    }
}
