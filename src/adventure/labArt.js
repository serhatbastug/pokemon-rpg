// Laboratuvar sahnesinin çizimi (3/4 görünüm).
//
// Zemin + duvar bir kez çizilip saklanıyor. Eşyalar ayrı canvas'lar: dibi
// (baseY) karakterlerin ayak noktasıyla kıyaslanıp arkadan öne sırayla
// basılıyor, böylece karakter masanın arkasına geçince masa onu örtüyor.
// Kapı, kontrol paneli ve cam kapı gibi durumu değişenler her karede çiziliyor.

import { PX, newCanvas, blk, hash } from '../pixel/pixelDraw.js';
import { drawPixelText } from '../pixel/pixelFont.js';
import {
    SCENE, WALL_BASE, DOOR, DESK, WHITEBOARD, WALL_MONITOR, BENCH, WEAPON_TABLE,
    CONSOLE, CELL, CELL_DOOR, CELL_INSIDE, CRATES, PLANT, TRASH
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

// --- Zemin ve duvar ---

function bakeGround() {
    const { canvas, ctx } = newCanvas(SCENE.w, SCENE.h);

    // Duvar: açık karolu
    blk(ctx, 0, 0, SCENE.w, WALL_BASE, WALL);
    for (let y = 16; y < WALL_BASE - 12; y += 32) blk(ctx, 0, y, SCENE.w, PX, SEAM);
    for (let x = 0; x < SCENE.w; x += 48) blk(ctx, x, 16, PX, WALL_BASE - 28, SEAM);
    // Duvarın alt yarısı biraz koyu: derinlik
    blk(ctx, 0, 88, SCENE.w, 28, WALL_LO);
    for (let y = 88; y < WALL_BASE - 12; y += 28) blk(ctx, 0, y, SCENE.w, PX, SEAM);
    for (let x = 0; x < SCENE.w; x += 48) blk(ctx, x, 88, PX, 28, SEAM);
    // Tavan şeridi ve ışıklar
    blk(ctx, 0, 0, SCENE.w, 16, '#9aa4a9');
    blk(ctx, 0, 12, SCENE.w, PX, '#7c868b');
    for (const lx of [160, 420, 680, 900]) {
        blk(ctx, lx - 44, 4, 88, 8, '#f4f7f0');
        blk(ctx, lx - 44, 12, 88, PX, '#cfd8d4');
    }
    // Süpürgelik
    blk(ctx, 0, WALL_BASE - 12, SCENE.w, 12, TRIM);
    blk(ctx, 0, WALL_BASE - 12, SCENE.w, PX, '#a3adb2');

    // Zemin: karo karo, hafif kirli
    for (let y = WALL_BASE, row = 0; y < SCENE.h; y += 48, row++) {
        for (let x = 0, col = 0; x < SCENE.w; x += 48, col++) {
            const even = (row + col) % 2 === 0;
            blk(ctx, x, y, 48, 48, even ? FLOOR_A : FLOOR_B);
            blk(ctx, x, y, 48, PX, FLOOR_SEAM);
            blk(ctx, x, y, PX, 48, FLOOR_SEAM);
            // Karoda küçük lekeler
            const r = hash(col, row, 3);
            if (r > 0.7) blk(ctx, x + 8 + Math.floor(r * 20) * 1, y + 12, 8, 4, even ? '#98a1a6' : '#7d868c');
        }
    }
    // Duvarın zemine düşen gölgesi
    for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.16 - i * 0.05;
        blk(ctx, 0, WALL_BASE + i * PX, SCENE.w, PX, '#000000');
    }
    ctx.globalAlpha = 1;

    // Beyaz tahta: silah şeması
    drawWhiteboard(ctx);
    // Duvar monitörü
    drawWallMonitor(ctx);
    // Bilgisayar masasının üstündeki raf
    slab(ctx, 164, 44, 120, 8, '#79858b', '#a8b4ba', '#566268');
    const jars = ['#7fb8a4', '#d8b46a', '#a68fc4', '#8fb7d8', '#c98a7a', '#9fc48f'];
    jars.forEach((c, i) => {
        const h = 20 + (i % 2) * 8;
        blk(ctx, 172 + i * 18, 44 - h, 12, h, c);
        blk(ctx, 172 + i * 18, 44 - h, 4, h, lighten(c));
        blk(ctx, 172 + i * 18, 44 - h - 4, 12, 4, '#4a555b');
    });
    // Mikroskop tezgâhının üstündeki pano
    slab(ctx, 644, 32, 96, 48, '#e8e2cf', '#fffdf2', '#b9b39c');
    for (let i = 0; i < 4; i++) blk(ctx, 652, 40 + i * 8, 56 - (i % 2) * 12, 4, '#8a8472');
    blk(ctx, 716, 40, 16, 16, '#c8322e');

    // Cam odanın zemini hafif mavi: içerisi ayrı bir bölüm gibi
    ctx.globalAlpha = 0.32;
    blk(ctx, CELL_INSIDE.x - 12, WALL_BASE, CELL.w - 28, CELL.h - (WALL_BASE - CELL.y) - 12, '#9cc4d0');
    ctx.globalAlpha = 1;
    // Cam odanın arka duvarı: kamera ve havalandırma
    blk(ctx, 800, 40, 160, 72, '#c3cbcf');
    blk(ctx, 820, 56, 40, 28, '#4a555b');
    blk(ctx, 824, 60, 32, 20, '#1b2226');
    blk(ctx, 836, 66, 8, 8, '#c8322e');
    for (let i = 0; i < 4; i++) blk(ctx, 880, 52 + i * 12, 64, 4, '#9aa4a9');
    // Odanın içindeki yatak (sedye) ve tabure
    slab(ctx, 892, 232, 56, 28, '#e6ecee', '#ffffff', '#bcc7cb');
    slab(ctx, 892, 260, 56, 8, '#7b878d', null, '#566268');
    slab(ctx, 820, 276, 24, 12, '#a8b4ba', '#d4dde0', '#7b878d');
    blk(ctx, 824, 288, 4, 12, '#7b878d');
    blk(ctx, 836, 288, 4, 12, '#7b878d');

    return canvas;
}

function lighten(hex) {
    const n = [1, 3, 5].map(i => Math.min(255, parseInt(hex.slice(i, i + 2), 16) + 60));
    return '#' + n.map(v => v.toString(16).padStart(2, '0')).join('');
}

function drawWhiteboard(ctx) {
    const { x, y, w, h } = WHITEBOARD;
    slab(ctx, x - 4, y - 4, w + 8, h + 8, '#6c777d');
    slab(ctx, x, y, w, h, '#f1f3ef', '#ffffff', '#cfd5d0');
    // Silah şeması: gövde, namlu, çekirdek, ölçü çizgileri
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

// --- Eşyalar (arkadan öne sıralanan canvas'lar) ---

function prop(x, y, w, h, baseY, draw) {
    const { canvas, ctx } = newCanvas(w, h);
    draw(ctx, -x, -y);
    return { canvas, x, y, baseY };
}

function bakeDesk() {
    const { x, y, w, h } = DESK;
    return prop(x - 8, 76, w + 16, 124, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        // Masa: üst yüzey ve ön yüz
        slab(ctx, X(x), Y(152), w, 24, '#b9c3c8', '#e2e8ea');
        slab(ctx, X(x), Y(176), w, 20, '#79858b', '#93a0a6', '#566268');
        blk(ctx, X(x + 8), Y(180), 36, 12, '#6d797f');
        blk(ctx, X(x + 20), Y(184), 12, 4, '#c2cbcf');
        blk(ctx, X(x + 88), Y(180), 36, 12, '#6d797f');
        blk(ctx, X(x + 100), Y(184), 12, 4, '#c2cbcf');
        // Monitör: ekran, çerçeve, ayak
        slab(ctx, X(196), Y(92), 64, 48, '#1b2226');
        slab(ctx, X(200), Y(96), 56, 36, '#0e1d14');
        for (let i = 0; i < 6; i++) blk(ctx, X(204), Y(100 + i * 5), 18 + hash(i, 1, 2) * 30 | 0, 2, '#4fb246');
        blk(ctx, X(224), Y(140), 12, 8, '#4a555b');
        blk(ctx, X(216), Y(148), 28, 4, '#4a555b');
        // Klavye ve kâğıtlar
        slab(ctx, X(204), Y(158), 44, 8, '#d8dede', '#ffffff', '#a8b0b4');
        slab(ctx, X(164), Y(158), 28, 16, '#f1f3ef', '#ffffff', '#cfd5d0');
        blk(ctx, X(168), Y(164), 20, 2, '#8a8472');
        blk(ctx, X(168), Y(168), 16, 2, '#8a8472');
        // Kupa
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
        // Mikroskop: taban, kol, tüp, mercek, tabla
        slab(ctx, X(660), Y(146), 44, 8, '#262f34', '#46545b');
        blk(ctx, X(688), Y(104), 12, 44, '#2f3a40');
        blk(ctx, X(688), Y(104), 4, 44, '#46545b');
        blk(ctx, X(668), Y(100), 28, 12, '#2f3a40');
        blk(ctx, X(664), Y(84), 12, 24, '#46545b');
        blk(ctx, X(660), Y(76), 20, 8, '#1e262a');
        blk(ctx, X(668), Y(112), 8, 16, '#7d8b92');
        blk(ctx, X(664), Y(128), 16, 6, '#c8d3d8');
        blk(ctx, X(672), Y(140), 24, 4, '#9cc4d4');
        // Erlenmayer + tüpler + kapsül tepsisi
        blk(ctx, X(712), Y(138), 16, 14, '#a9d4c0');
        blk(ctx, X(716), Y(126), 8, 14, '#d2ebe6');
        blk(ctx, X(718), Y(118), 4, 8, '#d2ebe6');
        blk(ctx, X(712), Y(144), 16, 4, '#3f9a28');
        for (let i = 0; i < 3; i++) blk(ctx, X(732 + i * 4), Y(136), 4, 16, ['#d86a5a', '#6aa0d8', '#e8d070'][i]);
    });
}

function bakeWeaponTable() {
    const { x, y, w, h } = WEAPON_TABLE;
    return prop(x - 8, y - 40, w + 16, h + 56, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        // Ayaklar
        for (const lx of [x + 8, x + w - 16]) {
            blk(ctx, X(lx), Y(y + h - 8), 8, 24, '#6d797f');
            blk(ctx, X(lx), Y(y + h - 8), 8, 4, '#566268');
        }
        // Üst yüzey (derinlik) ve ön yüz
        slab(ctx, X(x), Y(y), w, 48, '#b4bfc5', '#e6ecee');
        slab(ctx, X(x), Y(y + 48), w, 28, '#7b878d', '#97a4aa', '#566268');
        blk(ctx, X(x), Y(y + 76), w, 4, '#4b5560');

        // Silah prototipi: gövde, namlu, yeşil çekirdek, tutacak
        const px = x + 56, py = y + 12;
        slab(ctx, X(px), Y(py), 96, 16, '#4b5560', '#6a7682', '#2f3a40');
        slab(ctx, X(px + 96), Y(py + 4), 56, 8, '#3a444c', '#5c6872', '#222a30');
        blk(ctx, X(px + 148), Y(py + 2), 8, 12, '#2f3a40');
        blk(ctx, X(px + 24), Y(py + 4), 28, 8, '#3f9a28');
        blk(ctx, X(px + 28), Y(py + 4), 8, 4, '#a9ee86');
        blk(ctx, X(px + 8), Y(py + 16), 12, 16, '#2f3a40');
        blk(ctx, X(px + 64), Y(py - 4), 20, 4, '#9aa4a9');
        // Çevrede parçalar, aletler, kâğıt
        for (let i = 0; i < 4; i++) {
            blk(ctx, X(x + 12 + i * 12), Y(y + 28), 8, 8, ['#c8322e', '#d8a24a', '#9aa4a9', '#6aa0d8'][i]);
        }
        slab(ctx, X(x + w - 84), Y(y + 24), 40, 20, '#f1f3ef', '#ffffff', '#cfd5d0');
        blk(ctx, X(x + w - 80), Y(y + 30), 28, 2, '#8a8472');
        blk(ctx, X(x + w - 80), Y(y + 36), 20, 2, '#8a8472');
        blk(ctx, X(x + w - 32), Y(y + 22), 4, 24, '#6d797f');   // tornavida
        blk(ctx, X(x + w - 36), Y(y + 22), 12, 4, '#c8322e');
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

// Cam odanın ön yüzü: yarı saydam cam, çerçeve. Odanın içindekiler cama göre
// ARKADA kaldığı için baseY odanın alt kenarında; içerideki karakterler bu
// eşyadan önce çizilir ve camın ardından görünür.
function bakeCellFront() {
    const { x, y, w, h } = CELL;
    return prop(x - 4, y, w + 8, h + 4, y + h, (ctx, ox, oy) => {
        const X = (v) => v + ox, Y = (v) => v + oy;
        // Alt cam bandı (ön yüz)
        ctx.globalAlpha = 0.28;
        blk(ctx, X(x + 12), Y(y + h - 76), w - 24, 64, '#bfe4ee');
        ctx.globalAlpha = 1;
        for (let gx = x + 28; gx < x + w - 24; gx += 40) blk(ctx, X(gx), Y(y + h - 76), 2, 64, '#dff2f6');
        // Parıltı çizgileri
        blk(ctx, X(x + 40), Y(y + h - 68), 20, 4, '#ffffff');
        blk(ctx, X(x + 100), Y(y + h - 52), 12, 4, '#ffffff');
        // Metal çerçeve
        slab(ctx, X(x), Y(y + h - 80), w, 8, '#5f6a70', '#8b969c', '#3a444c');
        slab(ctx, X(x), Y(y + h - 12), w, 12, '#4a555b', '#6d797f', '#2f3a40');
        slab(ctx, X(x), Y(y), 16, h, '#5f6a70', '#8b969c');
        slab(ctx, X(x + w - 16), Y(y), 16, h, '#5f6a70', '#8b969c');
    });
}

export function bakeLab() {
    const props = [bakeDesk(), bakeBench(), bakeWeaponTable(), bakeCrates(), bakePlant(), bakeTrash(), bakeCellFront()];
    props.sort((a, b) => a.baseY - b.baseY);
    return { ground: bakeGround(), props };
}

// --- Durumu değişenler ---

// Giriş kapısı (duvarda). open: 0 kapalı, 1 sonuna kadar açık.
export function drawDoor(ctx, open, frame) {
    const { x, y, w, h } = DOOR;
    // Çerçeve
    slab(ctx, x - 4, y - 4, w + 8, h + 4, '#6c777d');
    if (open > 0) {
        // Açıklık: dışarıdaki koridorun ışığı
        blk(ctx, x, y, w, h, '#2a3036');
        blk(ctx, x + 8, y + 8, w - 16, h - 8, '#dfe6d8');
        blk(ctx, x + 8, y + 8, w - 16, 8, '#f4f7ee');
        blk(ctx, x + 8, y + h - 8, w - 16, 8, '#a9b3a4');
        // Açılan kanat: kenara doğru daralıyor
        const pw = Math.max(0, Math.round((w * (1 - open)) / PX) * PX);
        if (pw > 0) {
            slab(ctx, x, y, pw, h, '#e9efe6', '#ffffff', '#b8c2b6');
        }
        // Işık hüzmesi yere sızıyor
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
    // Üstte kapı levhası
    blk(ctx, x + 16, y - 20, 48, 12, '#2a2018');
    blk(ctx, x + 20, y - 16, 40, 4, '#c8322e');
}

// Cam odanın kapısı. closed: 0 açık, 1 kapalı
export function drawCellDoor(ctx, closed) {
    const { x, y, w, h } = CELL_DOOR;
    // Kapı yolu (zeminde ray)
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

// Kapının yanındaki kilit paneli. state: 'idle' | 'ready' | 'locked'
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
