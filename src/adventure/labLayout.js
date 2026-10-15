// Oynanış 1. bölümün dünyası: Harry, Fred ve üç yardımcının silah üzerinde
// çalıştığı ANA LABORATUVAR ile kapısı kilitli İZOLASYON ODASI, 3/4 (yukarıdan
// eğik) görünüm. Burada DOM/canvas yok - yalnızca sayılar; böylece çizimden
// bağımsız test edilebilir (tests/data.test.mjs).
//
// Dünya iki ekran genişliğinde: kamera Harry'yi yatayda izler. Ana laboratuvarın
// sağ ucunda bir ara duvar var; içindeki çelik kapı açılana kadar arkasındaki
// oda GÖRÜNMEZ. Açılınca içeride, ikinci bir cam oda (hücre) çıkar.
//
//   ana lab (x < 996)   kapı, bilgisayar masası, beyaz tahta, monitör,
//                       mikroskop tezgâhı, buzdolabı, lavabo, silah masası,
//                       santrifüj masası, sedye
//   ara duvar (996-1044) çelik izolasyon kapısı
//   izolasyon odası     sunucu rafları, duş, fıçılar, kontrol paneli, cam hücre
//
// Piksel birimi PX = 4: karakter sprite'ları da 4 ölçeğiyle çizilir.

export { PX } from '../pixel/pixelDraw.js';

// Ekranda görünen alan ve bütün dünya
export const VIEW = { w: 1000, h: 560 };
export const WORLD = { w: 1800, h: 560 };

// Duvarın zemine değdiği çizgi. Karakterin ayakları bunun altında durur.
export const WALL_BASE = 128;
export const FEET_MIN_Y = 148;

// Harry'nin ayak hizasındaki çarpışma kutusu (menüdekiyle aynı)
export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.0;
export const PLAYER_SCALE = 4;
// Andrew'ın dönüştüğü virüs: 2 kişilik moddaki sprite'ın bu sahnedeki ölçeği
export const VIRUS_SCALE = 1.45;
export const START = { x: 430, y: 372, dir: 'up' };

// --- Ana laboratuvar ---
export const DOOR = { x: 44, y: 32, w: 80, h: 96 };
export const DESK = { x: 156, y: 128, w: 132, h: 68 };
export const WHITEBOARD = { x: 316, y: 24, w: 160, h: 68 };
export const WALL_MONITOR = { x: 520, y: 24, w: 104, h: 64 };
export const BENCH = { x: 636, y: 128, w: 112, h: 68 };
export const FRIDGE = { x: 768, y: 128, w: 64, h: 76 };
export const SINK = { x: 848, y: 128, w: 124, h: 68 };
export const WEAPON_TABLE = { x: 296, y: 256, w: 272, h: 80 };
export const CENTRIFUGE = { x: 176, y: 420, w: 156, h: 60 };
export const STRETCHER = { x: 700, y: 400, w: 144, h: 64 };
export const CRATES = { x: 40, y: 470, w: 96, h: 56 };
export const PLANT = { x: 928, y: 440, w: 40, h: 44 };
export const TRASH = { x: 600, y: 452, w: 36, h: 36 };

// --- Ara duvar ve izolasyon kapısı ---
export const PARTITION = { x: 996, w: 48 };
export const ANNEX_DOOR = { x: 996, y: 300, w: 48, h: 96 };

// --- İzolasyon odası ---
export const ANNEX = { x: 1044, w: 756 };
export const RACKS = { x: 1092, y: 128, w: 152, h: 72 };
export const SHOWER = { x: 1272, y: 128, w: 72, h: 80 };
export const BARRELS = { x: 1084, y: 440, w: 88, h: 56 };
export const CONSOLE = { x: 1316, y: 236, w: 40, h: 36 };
export const ANNEX_MONITOR = { x: 1488, y: 24, w: 208, h: 64 };

// İkinci cam oda (hücre): girişi sol kenarda, kapısı kapanabiliyor
export const CELL = { x: 1400, y: 200, w: 360, h: 240 };
export const CELL_DOOR = { x: 1400, y: 300, w: 16, h: 80 };
export const CELL_INSIDE = { x: 1424, y: 224, w: 320, h: 192 };

// Her zaman engel olan dikdörtgenler (ayak izi). Kapıların durumu ayrı.
export const OBSTACLES = [
    DESK, BENCH, FRIDGE, SINK, WEAPON_TABLE, CENTRIFUGE, STRETCHER, CRATES, PLANT, TRASH,
    // Ara duvar: kapı aralığının üstü ve altı
    { x: PARTITION.x, y: 100, w: PARTITION.w, h: ANNEX_DOOR.y - 100 },
    { x: PARTITION.x, y: ANNEX_DOOR.y + ANNEX_DOOR.h, w: PARTITION.w, h: 560 - (ANNEX_DOOR.y + ANNEX_DOOR.h) },
    RACKS, SHOWER, BARRELS, CONSOLE,
    // Cam hücrenin duvarları: üst, alt, sağ, sol-üst, sol-alt
    { x: 1400, y: 200, w: 360, h: 16 },
    { x: 1400, y: 424, w: 360, h: 16 },
    { x: 1744, y: 200, w: 16, h: 240 },
    { x: 1400, y: 200, w: 16, h: 100 },
    { x: 1400, y: 380, w: 16, h: 60 }
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
    door:       { x: 84,   y: 156, r: 64 },
    microscope: { x: 692,  y: 214, r: 68 },
    annexDoor:  { x: 950,  y: 348, r: 70 },
    console:    { x: 1338, y: 316, r: 60 },
    battery:    { x: 262,  y: 392, r: 56 },
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

// Kapılar kapalıysa aralıklarını da engeller: cam hücre ve izolasyon kapısı
export function blocked(x, y, { cellDoorClosed = false, annexDoorClosed = false } = {}) {
    if (y < FEET_MIN_Y) return true;
    if (x < PLAYER_BOX.w / 2 || x > WORLD.w - PLAYER_BOX.w / 2) return true;
    if (y > WORLD.h - 4) return true;
    const box = feetBox(x, y);
    for (const rect of OBSTACLES) if (rectsOverlap(box, rect)) return true;
    if (cellDoorClosed && rectsOverlap(box, CELL_DOOR)) return true;
    if (annexDoorClosed && rectsOverlap(box, ANNEX_DOOR)) return true;
    return false;
}

// Kamera: Harry'yi yatayda izler. İzolasyon kapısı kapalıyken arkası görünmez,
// bu yüzden kamera ara duvarın kenarından öteye kayamaz.
export function cameraX(focusX, annexOpen) {
    const max = annexOpen ? WORLD.w - VIEW.w : PARTITION.x + PARTITION.w - VIEW.w;
    return Math.max(0, Math.min(max, focusX - VIEW.w / 2));
}
