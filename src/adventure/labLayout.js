// Oynanış 1. bölümün sahnesi: Harry, Fred ve üç yardımcının silah üzerinde
// çalıştığı laboratuvar, 3/4 (yukarıdan eğik) görünüm. Burada DOM/canvas yok -
// yalnızca sayılar; böylece çizimden bağımsız test edilebilir
// (tests/data.test.mjs).
//
// Sahne tek ekrandır, kamera kaymaz. Piksel birimi PX = 4: karakter
// sprite'ları da 4 ölçeğiyle çizilir, bütün sahne aynı ızgaraya oturur.
//
//   üst duvar  -> kapı (sol), bilgisayar masası, beyaz tahta, monitör,
//                 mikroskop tezgâhı, cam oda (sağ)
//   orta       -> silah masası (Fred ve yardımcılar burada)
//   alt        -> boş zemin: Harry'nin başladığı yer

export { PX } from '../pixel/pixelDraw.js';

export const SCENE = { w: 1000, h: 560 };

// Duvarın zemine değdiği çizgi. Karakterin ayakları bunun altında durur.
export const WALL_BASE = 128;
export const FEET_MIN_Y = 148;

// Harry'nin ayak hizasındaki çarpışma kutusu (menüdekiyle aynı)
export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.0;
export const PLAYER_SCALE = 4;
export const START = { x: 430, y: 372, dir: 'up' };

export const DOOR = { x: 44, y: 32, w: 80, h: 96 };
export const DESK = { x: 156, y: 128, w: 132, h: 68 };
export const WHITEBOARD = { x: 316, y: 24, w: 160, h: 68 };
export const WALL_MONITOR = { x: 520, y: 24, w: 104, h: 64 };
export const BENCH = { x: 636, y: 128, w: 112, h: 68 };
export const WEAPON_TABLE = { x: 296, y: 256, w: 272, h: 80 };
export const CONSOLE = { x: 724, y: 224, w: 40, h: 36 };

// Cam oda: duvarın dibinde sağ köşe. Girişi sol kenarda, kapısı kapanabiliyor.
export const CELL = { x: 772, y: 128, w: 208, h: 224 };
export const CELL_DOOR = { x: 772, y: 244, w: 16, h: 80 };
export const CELL_INSIDE = { x: 800, y: 160, w: 160, h: 168 };

// Zemindeki diğer eşyalar (dekor, ama engel)
export const CRATES = { x: 48, y: 440, w: 96, h: 56 };
export const PLANT = { x: 904, y: 432, w: 40, h: 44 };
export const TRASH = { x: 600, y: 452, w: 36, h: 36 };

// Her zaman engel olan dikdörtgenler (ayak izi). Kapı kapalı/açık durumu ayrı.
export const OBSTACLES = [
    DESK, BENCH, WEAPON_TABLE, CONSOLE, CRATES, PLANT, TRASH,
    // Cam odanın duvarları: üst-sol, alt-sol, alt, sağ
    { x: 772, y: 128, w: 16, h: 116 },
    { x: 772, y: 324, w: 16, h: 28 },
    { x: 772, y: 340, w: 208, h: 12 },
    { x: 964, y: 128, w: 16, h: 224 }
];

// NPC'ler (ayak noktası). who: charSprites.js'teki görünüş anahtarı.
export const NPCS = {
    fred:  { who: 'fred',   x: 352, y: 250, dir: 'down' },
    yardimci0: { who: 'saglikli0', x: 500, y: 250, dir: 'down' },
    yardimci1: { who: 'saglikli1', x: 222, y: 218, dir: 'up' },
    yardimci2: { who: 'saglikli2', x: 596, y: 306, dir: 'left' }
};

// Etkileşim noktaları: yaklaşınca F
export const SPOTS = {
    door:       { x: 84,  y: 156, r: 64 },
    microscope: { x: 692, y: 214, r: 68 },
    console:    { x: 744, y: 284, r: 56 },
    fred:       { r: 72 },
    andrew:     { r: 72 }
};

export function inRect(x, y, rect) {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function near(x, y, spot, px, py) {
    const cx = spot.x ?? px;
    const cy = spot.y ?? py;
    return Math.hypot(x - cx, y - cy) <= spot.r;
}

// Oyuncunun ayak kutusu (x, y = ayak ortası)
export function feetBox(x, y) {
    return { x: x - PLAYER_BOX.w / 2, y: y - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h };
}

// cellDoorClosed: cam odanın kapısı kapalıysa girişi de engeller
export function blocked(x, y, { cellDoorClosed = false } = {}) {
    if (y < FEET_MIN_Y) return true;
    if (x < PLAYER_BOX.w / 2 || x > SCENE.w - PLAYER_BOX.w / 2) return true;
    if (y > SCENE.h - 4) return true;
    const box = feetBox(x, y);
    for (const rect of OBSTACLES) if (rectsOverlap(box, rect)) return true;
    if (cellDoorClosed && rectsOverlap(box, CELL_DOOR)) return true;
    return false;
}
