// Laboratuvar dünyasının çizimi (3/4 görünüm): ana laboratuvar, ara duvar ve
// izolasyon odası.
//
// Zemin + duvar bir kez çizilip saklanıyor. Eşyalar ayrı canvas'lar: dibi
// (baseY) karakterlerin ayak noktasıyla kıyaslanıp arkadan öne sırayla
// basılıyor, böylece karakter masanın arkasına geçince masa onu örtüyor.
// Kapılar, kontrol paneli ve izolasyon odasının perdesi her karede çiziliyor.

import { PX, newCanvas, blk, hash } from '../pixel/pixelDraw.js';
import { drawPixelText } from '../pixel/pixelFont.js';
import {
    WORLD, WALL_BASE, PARTITION, ANNEX, ANNEX_DOOR, DOOR, DESK, WHITEBOARD,
    WALL_MONITOR, BENCH, FRIDGE, SINK, WEAPON_TABLE, CENTRIFUGE, STRETCHER,
    CRATES, PLANT, TRASH, RACKS, SHOWER, BARRELS, CONSOLE, ANNEX_MONITOR,
    CELL, CELL_DOOR, CELL_INSIDE
} from './labLayout.js';

const WALL = '#cfd6d9';
const WALL_LO = '#c3cbcf';
const SEAM = '#b4bec3';
const TRIM = '#8b969c';
const FLOOR_A = '#8f989d';
const FLOOR_B = '#868f94';
const FLOOR_SEAM = '#767f85';

// Işıklı/gölgeli dikdörtgen: yüzey + üst parlama + alt gölge
function slab(ctx, x, y, w, h, fill, hi = null, lo = null) {
    blk(ctx, x, y, w, h, fill);
    if (hi) blk(ctx, x, y, w, PX, hi);
    if (lo) blk(ctx, x, y + h - PX, w, PX, lo);
}

function lighten(hex, amount = 60) {
    const n = [1, 3, 5].map(i => Math.min(255, parseInt(hex.slice(i, i + 2), 16) + amount));
    return '#' + n.map(v => v.toString(16).padStart(2, '0')).join('');
}

// =================== ZEMİN VE DUVARLAR ===================

function paintMainRoom(ctx) {
    const W = PARTITION.x;

    // Duvar: açık karolu
    blk(ctx, 0, 0, W, WALL_BASE, WALL);
    for (let y = 16; y < WALL_BASE - 12; y += 32) blk(ctx, 0, y, W, PX, SEAM);
    for (let x = 0; x < W; x += 48) blk(ctx, x, 16, PX, WALL_BASE - 28, SEAM);
    blk(ctx, 0, 88, W, 28, WALL_LO);
    for (let y = 88; y < WALL_BASE - 12; y += 28) blk(ctx, 0, y, W, PX, SEAM);
    for (let x = 0; x < W; x += 48) blk(ctx, x, 88, PX, 28, SEAM);
    // Tavan şeridi ve ışıklar
    blk(ctx, 0, 0, W, 16, '#9aa4a9');
    blk(ctx, 0, 12, W, PX, '#7c868b');
    for (const lx of [160, 420, 680, 900]) {
        blk(ctx, lx - 44, 4, 88, 8, '#f4f7f0');
        blk(ctx, lx - 44, 12, 88, PX, '#cfd8d4');
    }
    // Süpürgelik
    blk(ctx, 0, WALL_BASE - 12, W, 12, TRIM);
    blk(ctx, 0, WALL_BASE - 12, W, PX, '#a3adb2');

    // Zemin: karo karo, hafif kirli
    for (let y = WALL_BASE, row = 0; y < WORLD.h; y += 48, row++) {
        for (let x = 0, col = 0; x < W; x += 48, col++) {
            const even = (row + col) % 2 === 0;
            blk(ctx, x, y, 48, 48, even ? FLOOR_A : FLOOR_B);
            blk(ctx, x, y, 48, PX, FLOOR_SEAM);
            blk(ctx, x, y, PX, 48, FLOOR_SEAM);
            const r = hash(col, row, 3);
            if (r > 0.7) blk(ctx, x + 8 + Math.floor(r * 20), y + 12, 8, 4, even ? '#98a1a6' : '#7d868c');
        }
    }
    for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.16 - i * 0.05;
        blk(ctx, 0, WALL_BASE + i * PX, W, PX, '#000000');
    }
    ctx.globalAlpha = 1;

    // Silah masasının önünde mavi halı
    slab(ctx, 252, 344, 372, 84, '#44597a', '#5c7396', '#2c3d58');
    blk(ctx, 260, 352, 356, 4, '#8aa0c0');
    blk(ctx, 260, 416, 356, 4, '#8aa0c0');
    for (let i = 0; i < 8; i++) blk(ctx, 284 + i * 40, 368, 16, 36, '#3a4e6c');
    // Sarı-siyah dikkat bandı: kapının önü
    for (let i = 0; i < 12; i++) {
        blk(ctx, 44 + i * 16, 148, 8, 4, i % 2 ? '#d8b030' : '#2a2a2a');
    }
    // Zemindeki kablolar: bilgisayar masasından silah masasına
    blk(ctx, 252, 200, 4, 56, '#1f2528');
    blk(ctx, 252, 252, 44, 4, '#1f2528');
    blk(ctx, 656, 200, 4, 76, '#1f2528');
    blk(ctx, 600, 272, 60, 4, '#1f2528');
    // Gider kapağı ve sıvı lekesi
    slab(ctx, 780, 520, 28, 20, '#4a555b', '#6d797f');
    for (let i = 0; i < 4; i++) blk(ctx, 784, 522 + i * 4, 20, 2, '#2f3a40');
    blk(ctx, 520, 500, 24, 8, '#7fb87a');
    blk(ctx, 528, 496, 8, 4, '#7fb87a');

    // --- Duvardakiler ---
    drawWhiteboard(ctx);
    drawWallMonitor(ctx);
    // Bilgisayar masasının üstündeki raf
    slab(ctx, 164, 44, 120, 8, '#79858b', '#a8b4ba', '#566268');
    ['#7fb8a4', '#d8b46a', '#a68fc4', '#8fb7d8', '#c98a7a', '#9fc48f'].forEach((c, i) => {
        const h = 20 + (i % 2) * 8;
        blk(ctx, 172 + i * 18, 44 - h, 12, h, c);
        blk(ctx, 172 + i * 18, 44 - h, 4, h, lighten(c));
        blk(ctx, 172 + i * 18, 44 - h - 4, 12, 4, '#4a555b');
    });
    // Mikroskop tezgâhının üstündeki pano
    slab(ctx, 644, 32, 96, 48, '#e8e2cf', '#fffdf2', '#b9b39c');
    for (let i = 0; i < 4; i++) blk(ctx, 652, 40 + i * 8, 56 - (i % 2) * 12, 4, '#8a8472');
    blk(ctx, 716, 40, 16, 16, '#c8322e');
    // Duvar saati
    slab(ctx, 488, 28, 28, 28, '#f1f3ef', '#ffffff', '#b8c2b6');
    blk(ctx, 500, 32, 4, 12, '#1c1a17');
    blk(ctx, 500, 40, 10, 4, '#1c1a17');
    // Biyolojik tehlike levhası (buzdolabının üstü)
    slab(ctx, 776, 28, 48, 44, '#d8b030', '#f0cc50', '#a88818');
    blk(ctx, 796, 36, 8, 8, '#2a2a2a');
    blk(ctx, 788, 48, 8, 8, '#2a2a2a');
    blk(ctx, 804, 48, 8, 8, '#2a2a2a');
    blk(ctx, 796, 50, 8, 4, '#d8b030');
    // İlan panosu (lavabo üstü): notlar ve raptiyeler
    slab(ctx, 860, 28, 112, 52, '#9a7a4a', '#b8966a', '#6e5430');
    [[868, 36, '#f4f1e4'], [896, 36, '#ffe9a8'], [924, 40, '#f4f1e4'], [872, 56, '#ffd0d0'], [908, 56, '#f4f1e4'], [940, 54, '#cfe6f2']].forEach(([x, y, c]) => {
        slab(ctx, x, y, 20, 16, c, null, '#bdb7a2');
        blk(ctx, x + 8, y + 2, 4, 4, '#c8322e');
        blk(ctx, x + 4, y + 8, 12, 2, '#8a8472');
    });
}

function paintPartition(ctx) {
    const { x, w } = PARTITION;
    // Ara duvar: yukarıdan aşağıya uzanan kalın çelik bölme
    blk(ctx, x, 0, w, WORLD.h, '#5f6a70');
    blk(ctx, x, 0, w, 128, '#6c777d');
    // Üst yüz (kapak): daha açık, derinlik veriyor
    blk(ctx, x, 100, w, 20, '#97a4aa');
    blk(ctx, x, 100, w, PX, '#c2ccd0');
    // Yan yüzler: ışık soldan
    blk(ctx, x, 120, PX * 2, WORLD.h - 120, '#7b878d');
    blk(ctx, x + w - PX * 2, 120, PX * 2, WORLD.h - 120, '#454f55');
    for (let y = 136; y < WORLD.h; y += 56) blk(ctx, x, y, w, PX, '#4f5a60');
    // Kapının yeri: eşik
    blk(ctx, x, ANNEX_DOOR.y, w, ANNEX_DOOR.h, '#3a444c');
}

function paintAnnex(ctx) {
    const x0 = ANNEX.x, W = ANNEX.w;
    const wallBase = '#566874', wallLo = '#4b5c68', wallSeam = '#3f4e58';

    // Arka duvar: koyu mavi-gri paneller
    blk(ctx, x0, 0, W, WALL_BASE, wallBase);
    for (let x = x0; x < x0 + W; x += 64) blk(ctx, x, 16, PX, WALL_BASE - 28, wallSeam);
    for (let y = 40; y < WALL_BASE - 12; y += 28) blk(ctx, x0, y, W, PX, wallSeam);
    blk(ctx, x0, 88, W, 28, wallLo);
    // Tavan: koyu, kırmızı uyarı şeridi
    blk(ctx, x0, 0, W, 16, '#2a343a');
    blk(ctx, x0, 12, W, PX, '#1c252a');
    for (let x = x0 + 40; x < x0 + W; x += 160) {
        blk(ctx, x, 4, 56, 8, '#c8322e');
        blk(ctx, x, 12, 56, PX, '#7a1f1c');
    }
    // Borular
    blk(ctx, x0, 56, W, 8, '#6d797f');
    blk(ctx, x0, 56, W, PX, '#97a4aa');
    for (let x = x0 + 70; x < x0 + W; x += 180) blk(ctx, x, 52, 8, 16, '#3f4e58');
    // Sarı-siyah uyarı bandı (duvar dibi)
    for (let x = x0; x < x0 + W; x += 24) {
        blk(ctx, x, 104, 12, 8, '#d8b030');
        blk(ctx, x + 12, 104, 12, 8, '#2a2a2a');
    }
    blk(ctx, x0, WALL_BASE - 12, W, 12, '#3a444c');
    blk(ctx, x0, WALL_BASE - 12, W, PX, '#6d797f');

    // Zemin: koyu çelik karolar
    for (let y = WALL_BASE, row = 0; y < WORLD.h; y += 48, row++) {
        for (let x = x0, col = 0; x < x0 + W; x += 48, col++) {
            const even = (row + col) % 2 === 0;
            blk(ctx, x, y, 48, 48, even ? '#5d686e' : '#556067');
            blk(ctx, x, y, 48, PX, '#444e54');
            blk(ctx, x, y, PX, 48, '#444e54');
            blk(ctx, x + 8, y + 8, 4, 4, '#6d797f');
            blk(ctx, x + 36, y + 36, 4, 4, '#6d797f');
        }
    }
    for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.22 - i * 0.07;
        blk(ctx, x0, WALL_BASE + i * PX, W, PX, '#000000');
    }
    ctx.globalAlpha = 1;

    // Zemin işaretleri: kapıdan hücreye sarı kesik çizgi, hücre önünde kırmızı şerit
    for (let x = x0 + 8; x < 1380; x += 32) blk(ctx, x, 340, 20, 4, '#d8b030');
    for (let y = 148; y < 560; y += 24) blk(ctx, 1384, y, 4, 12, '#c8322e');
    // Havalandırma ızgarası
    slab(ctx, 1100, 360, 40, 28, '#3a444c', '#4f5a60');
    for (let i = 0; i < 5; i++) blk(ctx, 1104, 364 + i * 4, 32, 2, '#1f2528');
    // Kablo oluğu
    blk(ctx, x0, 500, W, 12, '#2f3a40');
    blk(ctx, x0, 500, W, PX, '#4f5a60');
    for (let x = x0 + 20; x < x0 + W; x += 40) blk(ctx, x, 504, 4, 4, '#c8322e');

    // İzolasyon levhası (duvar)
    slab(ctx, 1096, 24, 176, 28, '#7a1f1c', '#b03a34', '#4a1210');
    drawPixelText(ctx, 'İZOLASYON', 1108, 32, { scale: 2, color: '#f4f1e4' });
    // Duvardaki büyük monitör: hücrenin yaşam bulguları
    drawAnnexMonitor(ctx);
    // Küçük kontrol panelleri
    [[1380, 40], [1430, 40]].forEach(([x, y]) => {
        slab(ctx, x, y, 36, 28, '#2f3a40', '#4a555b');
        blk(ctx, x + 8, y + 8, 8, 8, '#6bdc5a');
        blk(ctx, x + 20, y + 8, 8, 8, '#c8322e');
    });

    // --- Cam hücrenin içi ---
    ctx.globalAlpha = 0.28;
    blk(ctx, CELL_INSIDE.x - 8, CELL_INSIDE.y - 8, CELL_INSIDE.w + 16, CELL_INSIDE.h + 16, '#9cc4d0');
    ctx.globalAlpha = 1;
    // Arka duvar şeridi (camın ardındaki)
    slab(ctx, 1416, 216, 328, 16, '#6d797f', '#97a4aa', '#3a444c');
    // Kamera ve hoparlör
    slab(ctx, 1560, 232, 36, 20, '#2f3a40', '#4a555b');
    blk(ctx, 1572, 238, 12, 8, '#1b2226');
    blk(ctx, 1576, 240, 4, 4, '#c8322e');
    for (let i = 0; i < 4; i++) blk(ctx, 1448, 236 + i * 4, 28, 2, '#2f3a40');
    // Yatak: minder, yastık, battaniye
    slab(ctx, 1636, 252, 100, 52, '#dfe6e8', '#ffffff', '#a8b4ba');
    slab(ctx, 1640, 256, 24, 20, '#ffffff', null, '#bcc7cb');
    slab(ctx, 1668, 264, 64, 36, '#8aa0b4', '#a8bccc', '#5d7488');
    slab(ctx, 1636, 304, 100, 8, '#5f6a70', null, '#3a444c');
    // Tabure ve lavabo bloğu
    slab(ctx, 1500, 336, 28, 14, '#a8b4ba', '#d4dde0', '#7b878d');
    blk(ctx, 1504, 350, 4, 14, '#7b878d');
    blk(ctx, 1520, 350, 4, 14, '#7b878d');
    slab(ctx, 1436, 256, 52, 24, '#c9d2d6', '#ffffff', '#8b969c');
    blk(ctx, 1452, 260, 20, 10, '#6d797f');
    blk(ctx, 1460, 248, 4, 10, '#8b969c');
}

function drawWhiteboard(ctx) {
    const { x, y, w, h } = WHITEBOARD;
    slab(ctx, x - 4, y - 4, w + 8, h + 8, '#6c777d');
    slab(ctx, x, y, w, h, '#f1f3ef', '#ffffff', '#cfd5d0');
    blk(ctx, x + 16, y + 28, 88, 12, '#4b5560');
    blk(ctx, x + 104, y + 32, 36, 4, '#4b5560');
    blk(ctx, x + 36, y + 24, 24, 4, '#4b5560');
    blk(ctx, x + 44, y + 32, 16, 4, '#3f9a28');
    blk(ctx, x + 16, y + 48, 88, 2, '#c8322e');
    blk(ctx, x + 16, y + 46, 2, 6, '#c8322e');
    blk(ctx, x + 102, y + 46, 2, 6, '#c8322e');
    blk(ctx, x + 112, y + 48, 36, 2, '#2b63b8');
    blk(ctx, x + 112, y + 44, 2, 10, '#2b63b8');
    drawPixelText(ctx, 'PROTOTİP 8', x + 12, y + 8, { scale: 2, color: '#c8322e' });
}

function drawWallMonitor(ctx) {
    const { x, y, w, h } = WALL_MONITOR;
    slab(ctx, x - 4, y - 4, w + 8, h + 8, '#1b2226');
    slab(ctx, x, y, w, h, '#0b140f');
    for (let gx = x + 12; gx < x + w - 4; gx += 16) blk(ctx, gx, y + 4, 2, h - 8, '#143018');
    for (let gy = y + 12; gy < y + h - 4; gy += 16) blk(ctx, x + 4, gy, w - 8, 2, '#143018');
    const wave = [0, 0, 0, 0, -4, -4, 0, 0, 0, 4, -28, 20, 0, 0, -4, -8, -8, -4, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < (w - 16) / PX; i++) {
        const v = Math.round(wave[i % wave.length] / PX) * PX;
        blk(ctx, x + 8 + i * PX, y + h / 2 + v - 4, PX, PX, '#6bdc5a');
    }
    blk(ctx, x + 8, y + h - 12, 24, 4, '#6bdc5a');
    blk(ctx, x + 40, y + h - 12, 16, 4, '#d8c45a');
}

function drawAnnexMonitor(ctx) {
    const { x, y, w, h } = ANNEX_MONITOR;
    slab(ctx, x - 4, y - 4, w + 8, h + 8, '#1b2226');
    slab(ctx, x, y, w, h, '#0a1210');
    // Hücrenin planı
    blk(ctx, x + 12, y + 10, 88, 2, '#2f7a3a');
    blk(ctx, x + 12, y + 52, 88, 2, '#2f7a3a');
    blk(ctx, x + 12, y + 10, 2, 44, '#2f7a3a');
    blk(ctx, x + 98, y + 10, 2, 44, '#2f7a3a');
    blk(ctx, x + 20, y + 20, 24, 12, '#2f7a3a');
    blk(ctx, x + 62, y + 28, 28, 18, '#2f7a3a');
    // Yaşam bulguları: nabız, oksijen, sıcaklık çubukları
    [['#6bdc5a', 56], ['#d8c45a', 38], ['#c8322e', 24]].forEach(([c, v], i) => {
        blk(ctx, x + 116, y + 12 + i * 16, 80, 2, '#1c3a2a');
        blk(ctx, x + 116, y + 16 + i * 16, v, 8, c);
    });
}

// =================== EŞYALAR (arkadan öne sıralanan canvas'lar) ===================

function prop(x, y, w, h, baseY, draw) {
    const { canvas, ctx } = newCanvas(w, h);
    draw(ctx, -x, -y);
    return { canvas, x, y, baseY };
}

function bakeDesk() {
    const { x, y, w, h } = DESK;
    return prop(x - 8, 76, w + 16, 124, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        slab(ctx, X(x), Y(152), w, 24, '#b9c3c8', '#e2e8ea');
        slab(ctx, X(x), Y(176), w, 20, '#79858b', '#93a0a6', '#566268');
        blk(ctx, X(x + 8), Y(180), 36, 12, '#6d797f');
        blk(ctx, X(x + 20), Y(184), 12, 4, '#c2cbcf');
        blk(ctx, X(x + 88), Y(180), 36, 12, '#6d797f');
        blk(ctx, X(x + 100), Y(184), 12, 4, '#c2cbcf');
        slab(ctx, X(196), Y(92), 64, 48, '#1b2226');
        slab(ctx, X(200), Y(96), 56, 36, '#0e1d14');
        for (let i = 0; i < 6; i++) blk(ctx, X(204), Y(100 + i * 5), (18 + hash(i, 1, 2) * 30) | 0, 2, '#4fb246');
        blk(ctx, X(224), Y(140), 12, 8, '#4a555b');
        blk(ctx, X(216), Y(148), 28, 4, '#4a555b');
        slab(ctx, X(204), Y(158), 44, 8, '#d8dede', '#ffffff', '#a8b0b4');
        slab(ctx, X(164), Y(158), 28, 16, '#f1f3ef', '#ffffff', '#cfd5d0');
        blk(ctx, X(168), Y(164), 20, 2, '#8a8472');
        blk(ctx, X(168), Y(168), 16, 2, '#8a8472');
        slab(ctx, X(264), Y(156), 10, 10, '#c8322e', '#e0584a');
    });
}

function bakeBench() {
    const { x, y, w, h } = BENCH;
    return prop(x - 8, 76, w + 16, 124, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        slab(ctx, X(x), Y(152), w, 24, '#b9c3c8', '#e2e8ea');
        slab(ctx, X(x), Y(176), w, 20, '#79858b', '#93a0a6', '#566268');
        blk(ctx, X(x + 12), Y(180), 88, 12, '#6d797f');
        blk(ctx, X(x + 48), Y(184), 16, 4, '#c2cbcf');
        slab(ctx, X(660), Y(146), 44, 8, '#262f34', '#46545b');
        blk(ctx, X(688), Y(104), 12, 44, '#2f3a40');
        blk(ctx, X(688), Y(104), 4, 44, '#46545b');
        blk(ctx, X(668), Y(100), 28, 12, '#2f3a40');
        blk(ctx, X(664), Y(84), 12, 24, '#46545b');
        blk(ctx, X(660), Y(76), 20, 8, '#1e262a');
        blk(ctx, X(668), Y(112), 8, 16, '#7d8b92');
        blk(ctx, X(664), Y(128), 16, 6, '#c8d3d8');
        blk(ctx, X(672), Y(140), 24, 4, '#9cc4d4');
        blk(ctx, X(712), Y(138), 16, 14, '#a9d4c0');
        blk(ctx, X(716), Y(126), 8, 14, '#d2ebe6');
        blk(ctx, X(718), Y(118), 4, 8, '#d2ebe6');
        blk(ctx, X(712), Y(144), 16, 4, '#3f9a28');
        for (let i = 0; i < 3; i++) blk(ctx, X(732 + i * 4), Y(136), 4, 16, ['#d86a5a', '#6aa0d8', '#e8d070'][i]);
    });
}

// Numune buzdolabı: duvara dayalı, uzun, kapağında ekran ve kol
function bakeFridge() {
    const { x, y, w, h } = FRIDGE;
    return prop(x - 4, 72, w + 8, 140, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        slab(ctx, X(x), Y(84), w, 120, '#dfe5e7', '#ffffff', '#9aa4a9');
        blk(ctx, X(x), Y(84), 4, 120, '#f1f5f6');
        blk(ctx, X(x + w - 4), Y(84), 4, 120, '#aab4b8');
        blk(ctx, X(x), Y(136), w, 4, '#8b969c');
        blk(ctx, X(x + w - 16), Y(100), 4, 24, '#7b878d');
        blk(ctx, X(x + w - 16), Y(148), 4, 28, '#7b878d');
        slab(ctx, X(x + 10), Y(96), 24, 12, '#0e1d14');
        blk(ctx, X(x + 14), Y(100), 16, 4, '#6bdc5a');
        blk(ctx, X(x + 10), Y(116), 12, 12, '#2b63b8');
        blk(ctx, X(x + 4), Y(196), w - 8, 8, '#6d797f');
        blk(ctx, X(x + 8), Y(152), 20, 14, '#fff1a8');
        blk(ctx, X(x + 32), Y(156), 16, 10, '#ffd0d0');
    });
}

// Lavabo tezgâhı: gömme eviye, musluk, sabun, kâğıt havlu
function bakeSink() {
    const { x, y, w, h } = SINK;
    return prop(x - 4, 84, w + 8, 120, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        slab(ctx, X(x), Y(152), w, 24, '#b9c3c8', '#e2e8ea');
        slab(ctx, X(x), Y(176), w, 20, '#79858b', '#93a0a6', '#566268');
        for (let i = 0; i < 3; i++) {
            blk(ctx, X(x + 8 + i * 40), Y(180), 32, 12, '#6d797f');
            blk(ctx, X(x + 20 + i * 40), Y(184), 8, 4, '#c2cbcf');
        }
        slab(ctx, X(x + 24), Y(156), 40, 16, '#5d686e', '#3a444c', '#8b969c');
        blk(ctx, X(x + 28), Y(160), 32, 8, '#2a3237');
        blk(ctx, X(x + 42), Y(128), 6, 28, '#b8c2c6');
        blk(ctx, X(x + 36), Y(126), 18, 6, '#b8c2c6');
        blk(ctx, X(x + 36), Y(132), 4, 6, '#b8c2c6');
        blk(ctx, X(x + 76), Y(140), 12, 16, '#6aa0d8');
        blk(ctx, X(x + 78), Y(134), 8, 6, '#e8ecee');
        slab(ctx, X(x + 96), Y(92), 24, 36, '#e8ecee', '#ffffff', '#aeb6bb');
        blk(ctx, X(x + 100), Y(118), 16, 6, '#cfd5d8');
        blk(ctx, X(x + 104), Y(122), 8, 8, '#f4f1e4');
    });
}

function bakeWeaponTable() {
    const { x, y, w, h } = WEAPON_TABLE;
    return prop(x - 8, y - 40, w + 16, h + 56, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        for (const lx of [x + 8, x + w - 16]) {
            blk(ctx, X(lx), Y(y + h - 8), 8, 24, '#6d797f');
            blk(ctx, X(lx), Y(y + h - 8), 8, 4, '#566268');
        }
        slab(ctx, X(x), Y(y), w, 48, '#b4bfc5', '#e6ecee');
        slab(ctx, X(x), Y(y + 48), w, 28, '#7b878d', '#97a4aa', '#566268');
        blk(ctx, X(x), Y(y + 76), w, 4, '#4b5560');

        const px = x + 56, py = y + 12;
        slab(ctx, X(px), Y(py), 96, 16, '#4b5560', '#6a7682', '#2f3a40');
        slab(ctx, X(px + 96), Y(py + 4), 56, 8, '#3a444c', '#5c6872', '#222a30');
        blk(ctx, X(px + 148), Y(py + 2), 8, 12, '#2f3a40');
        blk(ctx, X(px + 24), Y(py + 4), 28, 8, '#3f9a28');
        blk(ctx, X(px + 28), Y(py + 4), 8, 4, '#a9ee86');
        blk(ctx, X(px + 8), Y(py + 16), 12, 16, '#2f3a40');
        blk(ctx, X(px + 64), Y(py - 4), 20, 4, '#9aa4a9');
        for (let i = 0; i < 4; i++) {
            blk(ctx, X(x + 12 + i * 12), Y(y + 28), 8, 8, ['#c8322e', '#d8a24a', '#9aa4a9', '#6aa0d8'][i]);
        }
        slab(ctx, X(x + w - 84), Y(y + 24), 40, 20, '#f1f3ef', '#ffffff', '#cfd5d0');
        blk(ctx, X(x + w - 80), Y(y + 30), 28, 2, '#8a8472');
        blk(ctx, X(x + w - 80), Y(y + 36), 20, 2, '#8a8472');
        blk(ctx, X(x + w - 32), Y(y + 22), 4, 24, '#6d797f');
        blk(ctx, X(x + w - 36), Y(y + 22), 12, 4, '#c8322e');
    });
}

// Santrifüj masası: rotor gövdesi, tüp sehpası, dizüstü
function bakeCentrifuge() {
    const { x, y, w, h } = CENTRIFUGE;
    return prop(x - 4, y - 44, w + 8, h + 52, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        for (const lx of [x + 6, x + w - 14]) blk(ctx, X(lx), Y(y + h - 8), 8, 12, '#6d797f');
        slab(ctx, X(x), Y(y), w, 32, '#b9c3c8', '#e2e8ea');
        slab(ctx, X(x), Y(y + 32), w, 28, '#79858b', '#93a0a6', '#566268');
        blk(ctx, X(x + 12), Y(y + 38), 60, 14, '#6d797f');
        blk(ctx, X(x + 36), Y(y + 42), 12, 4, '#c2cbcf');
        slab(ctx, X(x + 10), Y(y - 28), 56, 52, '#e8ecee', '#ffffff', '#aeb6bb');
        slab(ctx, X(x + 16), Y(y - 24), 44, 20, '#2a3237', '#4a555b');
        blk(ctx, X(x + 24), Y(y - 20), 28, 12, '#7fb8d0');
        blk(ctx, X(x + 20), Y(y + 2), 8, 6, '#6bdc5a');
        blk(ctx, X(x + 32), Y(y + 2), 24, 6, '#9aa4a9');
        slab(ctx, X(x + 84), Y(y - 6), 40, 14, '#8a6a42', '#b08a5a', '#5f4728');
        ['#d86a5a', '#6aa0d8', '#e8d070', '#a9d4c0', '#c98a7a'].forEach((c, i) => {
            blk(ctx, X(x + 88 + i * 7), Y(y - 18), 4, 14, c);
            blk(ctx, X(x + 88 + i * 7), Y(y - 18), 4, 4, '#4a555b');
        });
        slab(ctx, X(x + 126), Y(y + 4), 24, 12, '#d8dede', '#ffffff', '#a8b0b4');
        slab(ctx, X(x + 130), Y(y - 14), 20, 16, '#2a3237');
        blk(ctx, X(x + 134), Y(y - 10), 12, 8, '#4fb246');
    });
}

// Sedye: tekerlekli, korkuluklu, beyaz çarşaflı
function bakeStretcher() {
    const { x, y, w, h } = STRETCHER;
    return prop(x - 4, y - 12, w + 8, h + 24, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        for (const lx of [x + 8, x + w - 20]) {
            blk(ctx, X(lx), Y(y + 40), 6, 18, '#6d797f');
            blk(ctx, X(lx - 2), Y(y + 56), 10, 8, '#1f2528');
        }
        slab(ctx, X(x), Y(y + 28), w, 12, '#8b969c', '#c2ccd0', '#566268');
        slab(ctx, X(x + 4), Y(y), w - 8, 28, '#e6ecee', '#ffffff', '#bcc7cb');
        slab(ctx, X(x + 4), Y(y + 20), w - 8, 8, '#cfd8dc', null, '#9aa4a9');
        slab(ctx, X(x + 8), Y(y + 4), 32, 16, '#ffffff', null, '#cfd8dc');
        slab(ctx, X(x + 44), Y(y + 4), w - 56, 18, '#9fb3c4', '#c3d3e0', '#7f95a8');
        blk(ctx, X(x + 70), Y(y + 4), 4, 18, '#7f95a8');
        blk(ctx, X(x + 4), Y(y - 8), w - 8, 4, '#8b969c');
        blk(ctx, X(x + 4), Y(y - 8), 4, 12, '#8b969c');
        blk(ctx, X(x + w - 8), Y(y - 8), 4, 12, '#8b969c');
    });
}

function bakeCrates() {
    const { x, y, w, h } = CRATES;
    return prop(x - 4, y - 32, w + 8, h + 36, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        const crate = (cx, cy, cw, ch) => {
            slab(ctx, X(cx), Y(cy), cw, ch, '#8a6a42', '#b08a5a', '#5f4728');
            blk(ctx, X(cx), Y(cy + ch / 2 - 2), cw, 4, '#6e5434');
            blk(ctx, X(cx + 4), Y(cy + 4), 4, ch - 8, '#6e5434');
            blk(ctx, X(cx + cw - 8), Y(cy + 4), 4, ch - 8, '#6e5434');
        };
        crate(x, y, 48, 56);
        crate(x + 52, y + 12, 44, 44);
        crate(x + 8, y - 28, 36, 28);
        blk(ctx, X(x + 14), Y(y - 20), 16, 8, '#c8322e');
    });
}

function bakePlant() {
    const { x, y, w, h } = PLANT;
    return prop(x - 8, y - 48, w + 16, h + 52, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        slab(ctx, X(x + 4), Y(y + 20), 32, 24, '#a8624a', '#c98468', '#6f3e2e');
        for (let i = 0; i < 7; i++) {
            const lx = x + 4 + (i * 5) % 30, ly = y - 8 + (i % 3) * 8 - 20 * ((i + 1) % 2);
            blk(ctx, X(lx), Y(ly), 12, 28, i % 2 ? '#4a8a3a' : '#5fa04a');
            blk(ctx, X(lx), Y(ly), 4, 28, '#7fc064');
        }
        blk(ctx, X(x + 12), Y(y + 12), 16, 12, '#3f7a2e');
    });
}

function bakeTrash() {
    const { x, y, w, h } = TRASH;
    return prop(x - 4, y - 4, w + 8, h + 8, y + h, (ctx, ox, oy) => {
        slab(ctx, x + ox, y + oy, w, h, '#4a555b', '#6d797f', '#2f3a40');
        blk(ctx, x - 2 + ox, y - 4 + oy, w + 4, 4, '#8b969c');
        blk(ctx, x + 8 + ox, y + 8 + oy, 4, h - 16, '#3a444c');
        blk(ctx, x + w - 12 + ox, y + 8 + oy, 4, h - 16, '#3a444c');
    });
}

// --- İzolasyon odası eşyaları ---

// Sunucu rafları: üç dolap, ışıklar
function bakeRacks() {
    const { x, y, w, h } = RACKS;
    return prop(x - 4, 60, w + 8, 144, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        for (let k = 0; k < 3; k++) {
            const rx = x + k * 52;
            slab(ctx, X(rx), Y(72), 48, 132, '#2f3a40', '#4a555b', '#1b2226');
            for (let r = 0; r < 7; r++) {
                blk(ctx, X(rx + 6), Y(82 + r * 16), 36, 10, '#1b2226');
                blk(ctx, X(rx + 8), Y(84 + r * 16), 8, 4, hash(k, r, 7) > 0.5 ? '#6bdc5a' : '#d8c45a');
                blk(ctx, X(rx + 20), Y(84 + r * 16), 8, 4, hash(k, r, 9) > 0.6 ? '#c8322e' : '#2f7a22');
                blk(ctx, X(rx + 32), Y(88 + r * 16), 8, 2, '#4a555b');
            }
        }
    });
}

// Dekontaminasyon duşu: cam kabin, duş başlığı
function bakeShower() {
    const { x, y, w, h } = SHOWER;
    return prop(x - 4, 76, w + 8, 140, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        slab(ctx, X(x), Y(84), w, 124, '#4a5b66', '#6d8290', '#2f3e48');
        ctx.globalAlpha = 0.42;
        blk(ctx, X(x + 8), Y(92), w - 16, 108, '#bfe4ee');
        ctx.globalAlpha = 1;
        blk(ctx, X(x + 8), Y(92), 4, 108, '#e0f3f8');
        blk(ctx, X(x + 30), Y(96), 12, 8, '#9aa4a9');
        blk(ctx, X(x + 34), Y(88), 4, 8, '#9aa4a9');
        for (let i = 0; i < 4; i++) blk(ctx, X(x + 28 + i * 6), Y(108 + (i % 2) * 6), 2, 10, '#a8d8e8');
        blk(ctx, X(x + w - 16), Y(150), 8, 8, '#c8322e');
        slab(ctx, X(x), Y(200), w, 8, '#2f3a40', '#4a555b');
    });
}

// Tehlikeli madde fıçıları
function bakeBarrels() {
    const { x, y, w, h } = BARRELS;
    return prop(x - 4, y - 36, w + 8, h + 40, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        const barrel = (bx, by, c) => {
            slab(ctx, X(bx), Y(by), 36, 48, c, lighten(c, 40), '#1f2528');
            blk(ctx, X(bx), Y(by + 12), 36, 4, '#2a2a2a');
            blk(ctx, X(bx), Y(by + 32), 36, 4, '#2a2a2a');
            blk(ctx, X(bx + 10), Y(by + 18), 16, 12, '#d8b030');
            blk(ctx, X(bx + 16), Y(by + 20), 4, 4, '#2a2a2a');
            blk(ctx, X(bx + 4), Y(by - 4), 28, 4, '#8b969c');
        };
        barrel(x, y, '#3f9a28');
        barrel(x + 44, y + 8, '#3f9a28');
        barrel(x + 22, y - 24, '#b8b030');
    });
}

// Cam hücrenin ÖN yüzü ve yan sütunları: yarı saydam cam, çerçeve. Hücrenin
// içindekiler cama göre ARKADA kaldığı için baseY hücrenin alt kenarında.
// broken: patlamadan sonra - cam yok, çerçevede diş diş kalıntılar, yerde kırıntılar
function bakeCellFront(broken = false) {
    const { x, y, w, h } = CELL;
    const front = prop(x - 4, y, w + 8, h + 4, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        if (!broken) {
            ctx.globalAlpha = 0.3;
            blk(ctx, X(x + 16), Y(y + h - 52), w - 32, 44, '#bfe4ee');
            ctx.globalAlpha = 1;
            for (let gx = x + 48; gx < x + w - 24; gx += 72) blk(ctx, X(gx), Y(y + h - 52), 2, 44, '#dff2f6');
            blk(ctx, X(x + 60), Y(y + h - 44), 24, 4, '#ffffff');
            blk(ctx, X(x + 180), Y(y + h - 28), 16, 4, '#ffffff');
        } else {
            // Çerçevede kalan sivri cam dişleri
            ctx.globalAlpha = 0.34;
            for (let gx = x + 16; gx < x + w - 16; gx += 12) {
                const th = 4 + Math.round(hash(gx, 11, 5) * 5) * 4;
                blk(ctx, X(gx), Y(y + h - 8 - th), 8, th, '#bfe4ee');
            }
            ctx.globalAlpha = 1;
            // Yere dökülen kırıntılar
            for (let i = 0; i < 46; i++) {
                const sx = x + 24 + hash(i, 12, 7) * (w - 48);
                const sy = y + h - 8 + hash(i, 13, 9) * 14;
                const ss = 4 + Math.round(hash(i, 14, 3) * 2) * 2;
                blk(ctx, X(Math.round(sx / 2) * 2), Y(Math.round(sy / 2) * 2), ss, ss - 2, i % 3 ? '#cfeef6' : '#8fc4d4');
            }
        }
        slab(ctx, X(x), Y(y + h - 56), w, 8, '#5f6a70', '#8b969c', '#3a444c');
        slab(ctx, X(x), Y(y + h - 12), w, 12, '#4a555b', '#6d797f', '#2f3a40');
        slab(ctx, X(x + w - 16), Y(y), 16, h, '#5f6a70', '#8b969c');
        slab(ctx, X(x), Y(y), 16, CELL_DOOR.y - y, '#5f6a70', '#8b969c');
        slab(ctx, X(x), Y(CELL_DOOR.y + CELL_DOOR.h), 16, y + h - (CELL_DOOR.y + CELL_DOOR.h), '#5f6a70', '#8b969c');
        slab(ctx, X(x), Y(y), w, 8, '#5f6a70', '#8b969c', '#3a444c');
    });
    front.tag = broken ? 'cellBroken' : 'cellFront';
    return front;
}

export function bakeLab() {
    const { canvas: ground, ctx } = newCanvas(WORLD.w, WORLD.h);
    paintMainRoom(ctx);
    paintAnnex(ctx);
    paintPartition(ctx);
    const props = [
        bakeDesk(), bakeBench(), bakeFridge(), bakeSink(), bakeWeaponTable(), bakeCentrifuge(),
        bakeStretcher(), bakeCrates(), bakePlant(), bakeTrash(),
        bakeRacks(), bakeShower(), bakeBarrels(), bakeCellFront()
    ];
    props.sort((a, b) => a.baseY - b.baseY);
    return { ground, props, cellBroken: bakeCellFront(true) };
}

// =================== DURUMU DEĞİŞENLER ===================

// Giriş kapısı (ana laboratuvarın duvarında). open: 0 kapalı, 1 sonuna kadar açık.
export function drawDoor(ctx, open) {
    const { x, y, w, h } = DOOR;
    slab(ctx, x - 4, y - 4, w + 8, h + 4, '#6c777d');
    if (open > 0) {
        blk(ctx, x, y, w, h, '#2a3036');
        blk(ctx, x + 8, y + 8, w - 16, h - 8, '#dfe6d8');
        blk(ctx, x + 8, y + 8, w - 16, 8, '#f4f7ee');
        blk(ctx, x + 8, y + h - 8, w - 16, 8, '#a9b3a4');
        const pw = Math.max(0, Math.round((w * (1 - open)) / PX) * PX);
        if (pw > 0) slab(ctx, x, y, pw, h, '#e9efe6', '#ffffff', '#b8c2b6');
        ctx.globalAlpha = 0.22 * open;
        blk(ctx, x + 4, WALL_BASE, w - 8, 40, '#f4f7ee');
        ctx.globalAlpha = 1;
    } else {
        slab(ctx, x, y, w, h, '#e9efe6', '#ffffff', '#b8c2b6');
        blk(ctx, x + 8, y + 12, w - 16, 28, '#bcd0d6');
        blk(ctx, x + 8, y + 12, w - 16, 4, '#dfeef2');
        blk(ctx, x + w - 16, y + 56, 8, 12, '#8b969c');
        blk(ctx, x + 8, y + h - 20, w - 16, 4, '#c9d2c7');
    }
    blk(ctx, x + 16, y - 20, 48, 12, '#2a2018');
    blk(ctx, x + 20, y - 16, 40, 4, '#c8322e');
}

// İzolasyon odasının çelik kapısı (ara duvarda). open: 0 kapalı .. 1 açık.
// İki yarı, dikey eksende birbirinden ayrılarak açılır.
export function drawAnnexDoor(ctx, open, frame) {
    const { x, y, w, h } = ANNEX_DOOR;
    const half = h / 2;
    const slide = Math.round((half * open) / PX) * PX;
    blk(ctx, x, y, w, h, '#2a3237');
    for (let i = 0; i < w; i += 16) blk(ctx, x + i, y + h / 2 - 2, 8, 4, '#d8b030');
    const panel = (py, ph, up) => {
        if (ph <= 0) return;
        slab(ctx, x, py, w, ph, '#7b868c', '#aab4b8', '#4a555b');
        blk(ctx, x + 4, py + 6, w - 8, 4, '#2a3237');
        for (let i = 0; i < w; i += 16) {
            blk(ctx, x + i, up ? py + ph - 10 : py + 2, 8, 8, '#d8b030');
            blk(ctx, x + i + 8, up ? py + ph - 10 : py + 2, 8, 8, '#2a2a2a');
        }
    };
    panel(y - slide, half, true);
    panel(y + half + slide, half, false);
    if (open < 1) {
        const blink = Math.floor(frame / 30) % 2 === 0;
        blk(ctx, x + w / 2 - 6, y + half - 6, 12, 12, blink ? '#e0584a' : '#7a1f1c');
        blk(ctx, x + 6, y + half - 16, w - 12, 6, '#7a1f1c');
    }
}

// Kapalı izolasyon odasının üstündeki perde: açılana kadar içerisi görünmez.
// reveal: 0 tamamen karanlık .. 1 görünür. Ara duvarın sağındaki bütün bölge.
export function drawAnnexCover(ctx, reveal) {
    if (reveal >= 1) return;
    ctx.save();
    ctx.globalAlpha = 1 - reveal;
    ctx.fillStyle = '#05080a';
    ctx.fillRect(PARTITION.x + PARTITION.w, 0, WORLD.w - PARTITION.x - PARTITION.w, WORLD.h);
    ctx.restore();
}

// Cam hücrenin kapısı. closed: 0 açık, 1 kapalı
export function drawCellDoor(ctx, closed) {
    const { x, y, w, h } = CELL_DOOR;
    blk(ctx, x - 4, y, 4, h, '#3a444c');
    if (closed > 0) {
        const ph = Math.round((h * closed) / PX) * PX;
        ctx.globalAlpha = 0.72;
        blk(ctx, x, y, w, ph, '#bfe4ee');
        ctx.globalAlpha = 1;
        blk(ctx, x, y + ph / 2 - 2, w, 4, '#5f6a70');
        slab(ctx, x, y, w, 6, '#5f6a70');
        blk(ctx, x, y + ph - 6, w, 6, '#5f6a70');
        blk(ctx, x + 4, y + ph / 2 - 8, 4, 16, '#c8322e');
        blk(ctx, x + 4, y + 4, 2, ph - 8, '#ffffff');
    }
}

// Virüsün yıktığı ara duvar: açılan gedik, kırık kenarlar, yerdeki enkaz.
// t: 0 sağlam (hiçbir şey çizilmez) .. 1 yıkık.
export function drawBrokenWall(ctx, t) {
    if (t <= 0) return;
    const x = PARTITION.x, w = PARTITION.w;
    blk(ctx, x + 4, 152, w - 8, 312, '#12171a');
    for (let y = 140; y < 476; y += 12) {
        const l = Math.round(hash(y, 1, 71) * 3) * PX;
        const r = Math.round(hash(y, 2, 73) * 3) * PX;
        blk(ctx, x + 4, y, l + PX, 12, '#cfd6d9');
        blk(ctx, x + w - 8 - r, y, r + PX, 12, '#b4bec3');
    }
    for (let i = 0; i < 28; i++) {
        const rx = x - 60 + hash(i, 3, 77) * 160;
        const ry = 396 + hash(i, 4, 79) * 70;
        const sz = 8 + Math.round(hash(i, 5, 81) * 3) * 4;
        blk(ctx, Math.round(rx / PX) * PX, Math.round(ry / PX) * PX, sz, sz - 4, i % 3 ? '#9aa4a9' : '#6d797f');
    }
}

// Yerde duran pil: sarı parıltılı, alınabilir olduğu belli
export function drawBattery(ctx, x, y, frame) {
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12);
    ctx.globalAlpha = 0.14 + 0.12 * pulse;
    blk(ctx, x - 32, y - 30, 64, 40, '#ffe06a');
    ctx.globalAlpha = 1;
    blk(ctx, x - 18, y - 16, 36, 16, '#1f2528');
    blk(ctx, x - 16, y - 14, 32, 12, '#2f3a40');
    blk(ctx, x - 16, y - 14, 12, 12, '#e8a030');
    blk(ctx, x - 14, y - 12, 4, 8, '#ffd878');
    blk(ctx, x - 2, y - 10, 14, 4, '#6bdc5a');
    blk(ctx, x + 18, y - 11, 4, 8, '#b9c1c6');
}

// Mikroskop tezgâhında Andrew'dan alınan DNA örneği: yeşil sıvılı tüp, hafif parıltı
export function drawSample(ctx, frame) {
    const x = 740, y = 128;
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.08);
    ctx.globalAlpha = 0.18 + 0.12 * pulse;
    blk(ctx, x - 12, y - 4, 32, 40, '#9dff6a');
    ctx.globalAlpha = 1;
    slab(ctx, x - 4, y + 22, 16, 6, '#4a555b', '#6d797f');          // tüp yuvası
    blk(ctx, x, y, 8, 26, '#d2ebe6');                               // cam
    blk(ctx, x, y + 10, 8, 16, '#3f9a28');                          // sıvı
    blk(ctx, x + 4, y + 10, 4, 16, '#2f7a22');
    blk(ctx, x, y - 4, 8, 4, '#c8322e');                            // kapak
    blk(ctx, x, y, 4, 22, '#eef8f4');
}

// Hücre kapısının yanındaki kilit paneli. state: 'idle' | 'ready' | 'locked'
export function drawConsole(ctx, state, frame) {
    const { x, y, w, h } = CONSOLE;
    slab(ctx, x, y + 8, w, h - 8, '#4a555b', '#6d797f', '#2f3a40');
    slab(ctx, x + 4, y, w - 8, 12, '#2f3a40', '#4a555b');
    const blink = Math.floor(frame / 24) % 2 === 0;
    const light = state === 'locked' ? '#c8322e' : (state === 'ready' ? (blink ? '#6bdc5a' : '#2f7a22') : '#6d797f');
    blk(ctx, x + 12, y + 16, 16, 8, '#0f1a14');
    blk(ctx, x + 16, y + 18, 8, 4, light);
    if (state === 'ready') {
        ctx.globalAlpha = 0.3;
        blk(ctx, x - 4, y - 4, w + 8, h + 8, '#6bdc5a');
        ctx.globalAlpha = 1;
    }
}

// Kapının yanındaki İMHA butonu: duvarda kırmızı kapaklı bir pano. pressed
// 0..1: basılınca kapak açılır ve ışık yanıp söner.
export const DESTRUCT_BUTTON = { x: 128, y: 52, w: 28, h: 44 };

export function drawDestructButton(ctx, pressed, frame) {
    const { x, y, w, h } = DESTRUCT_BUTTON;
    blk(ctx, x - PX, y - PX, w + PX * 2, h + PX * 2, '#2a2a2a');
    blk(ctx, x, y, w, h, '#d8b030');
    blk(ctx, x, y, w, PX, '#f0d060');
    blk(ctx, x + PX, y + PX * 2, w - PX * 2, h - PX * 3, '#3a3f44');
    const blink = pressed > 0 && Math.floor(frame / 8) % 2 === 0;
    const pushed = pressed > 0 ? PX / 2 : 0;
    blk(ctx, x + PX * 2, y + PX * 3 + pushed, w - PX * 4, w - PX * 4, blink ? '#ff8a80' : '#c8322e');
    blk(ctx, x + PX * 2, y + PX * 3 + pushed, w - PX * 4, PX / 2, '#ff9a90');
    drawPixelText(ctx, 'İMHA', x + 2, y + h - PX * 4, { scale: 1, color: '#2a2a2a' });
}
