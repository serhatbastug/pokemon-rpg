// Avcı kulübesi bölümünün piksel çizimleri: patika, açıklık, kulübe (dış ve iç),
// yataklar, soba, ateş çukuru, odun yığını. Hepsi 4 birimlik pikselle (PX) çizilir.
// Zeminler bir kez offscreen canvas'a pişirilir; sahne yalnızca kopyalar.
// Hareketli şeyler (alev, duman, pencere ışığı) her karede ayrıca çizilir.

import { PX, newCanvas, blk, dot, hash } from '../pixel/pixelDraw.js';
import {
    TRAIL, JUNCTIONS, trailCenter, junctionArm, STUB_HALF, CABIN, YARD, YARD_DOOR, FIRE_PIT,
    WOODPILE, BARREL, POND, CABIN_IN, STOVE, TABLE, CHEST, SHELF_CRATE, PARTITIONS
} from './campLayout.js';

const GRASS = ['#14532d', '#166534', '#15803d', '#177a39', '#1a8a42'];
const GRASS_DARK = ['#0f3d22', '#123f26', '#14532d'];
const DIRT = ['#7a4d22', '#8a5a2b', '#6b4119', '#96652f'];
const DIRT_EDGE = '#5a3617';
const LEAF = ['#b45309', '#92400e', '#c2410c', '#78350f'];
const WOOD = { base: '#7a5230', hi: '#9a6c40', lo: '#523520', dark: '#3a2414' };

function grassField(ctx, w, h, salt = 0) {
    for (let y = 0; y < h; y += PX) {
        for (let x = 0; x < w; x += PX) {
            const patch = hash(Math.floor(x / 40), Math.floor(y / 40), 3 + salt);
            const palette = patch < 0.28 ? GRASS_DARK : GRASS;
            ctx.fillStyle = palette[Math.floor(hash(x, y, 1 + salt) * palette.length)];
            ctx.fillRect(x, y, PX, PX);
        }
    }
    for (let y = PX; y < h; y += PX * 2) {
        for (let x = 0; x < w; x += PX * 2) {
            if (hash(x, y, 7 + salt) > 0.05) continue;
            const light = hash(x, y, 8) > 0.5 ? '#22c55e' : '#16a34a';
            dot(ctx, x, y, light);
            dot(ctx, x, y - PX, light);
        }
    }
}

function dirtCell(ctx, x, y, edge) {
    ctx.fillStyle = edge ? DIRT_EDGE : DIRT[Math.floor(hash(x, y, 61) * DIRT.length)];
    ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX, PX);
}

// Yan patikanın ucundaki dikey devrilmiş kütük
function fallenLogV(ctx, x, y, h) {
    blk(ctx, x + PX * 5, y, PX, h, '#2a1a0c');
    blk(ctx, x, y, PX * 5, h, WOOD.base);
    blk(ctx, x, y, PX, h, WOOD.hi);
    blk(ctx, x + PX * 4, y, PX, h, WOOD.lo);
    for (let i = PX * 2; i < h - PX * 2; i += PX * 4) {
        if (hash(i, x, 5) > 0.5) blk(ctx, x + PX * 2, y + i, PX, PX * 2, WOOD.lo);
    }
    blk(ctx, x + PX, y - PX, PX * 3, PX, '#b88a58');
    blk(ctx, x + PX, y + h, PX * 3, PX, '#b88a58');
}

function signpost(ctx, x, y) {
    blk(ctx, x, y - PX * 12, PX * 2, PX * 12, WOOD.lo);
    blk(ctx, x - PX * 5, y - PX * 11, PX * 11, PX * 3, WOOD.base);
    blk(ctx, x - PX * 5, y - PX * 11, PX * 11, PX, WOOD.hi);
    blk(ctx, x - PX * 6, y - PX * 7, PX * 9, PX * 3, WOOD.hi);
    blk(ctx, x - PX * 6, y - PX * 7, PX * 9, PX, '#b88a58');
    dot(ctx, x - PX * 4, y - PX * 10, WOOD.dark);
    dot(ctx, x + PX * 2, y - PX * 6, WOOD.dark);
}

// --- Patika zemini: 3300 geniş, üç yol ayrımı ---
export function bakeTrailGround() {
    const { canvas, ctx } = newCanvas(TRAIL.w, TRAIL.h);
    grassField(ctx, TRAIL.w, TRAIL.h);

    // Ana patika
    for (let x = 0; x < TRAIL.w; x += PX) {
        const c = trailCenter(x);
        const half = TRAIL.halfH - 4 + Math.sin(x / 90) * 4;
        for (let y = c - half; y < c + half; y += PX) {
            const edge = Math.min(y - (c - half), (c + half) - y) < 8;
            if (edge && hash(x, y, 59) < 0.4) continue;
            dirtCell(ctx, x, y, edge);
        }
    }
    // Yan patikalar: dikey bağlantı, yatay kol ve ucunda devrilmiş kütük
    for (const j of JUNCTIONS) {
        const arm = junctionArm(j);
        const half = STUB_HALF - 4;
        for (let y = arm.cy - half; y < trailCenter(j.x) - TRAIL.halfH + 12; y += PX) {
            for (let x = j.x - half; x < j.x + half; x += PX) {
                const edge = Math.min(x - (j.x - half), (j.x + half) - x) < 8;
                if (edge && hash(x, y, 63) < 0.4) continue;
                dirtCell(ctx, x, y, edge);
            }
        }
        for (let x = arm.x0 + 4; x < arm.x1 - 4; x += PX) {
            for (let y = arm.cy - half; y < arm.cy + half; y += PX) {
                const edge = Math.min(y - (arm.cy - half), (arm.cy + half) - y) < 8;
                if (edge && hash(x, y, 65) < 0.4) continue;
                dirtCell(ctx, x, y, edge);
            }
        }
        const endX = j.dir > 0 ? arm.x1 : arm.x0;
        fallenLogV(ctx, endX - (j.dir > 0 ? PX * 3 : -PX * 0), arm.cy - 44, 88);
        signpost(ctx, j.x + 52, trailCenter(j.x) - TRAIL.halfH + 6);
    }
    // Düşmüş yapraklar, taşlar ve ayak izleri
    for (let i = 0; i < 700; i++) {
        const x = hash(i, 1, 71) * TRAIL.w, y = hash(i, 2, 73) * TRAIL.h;
        dot(ctx, x, y, LEAF[Math.floor(hash(i, 3, 75) * LEAF.length)]);
    }
    for (let i = 0; i < 70; i++) {
        const x = 60 + hash(i, 4, 77) * (TRAIL.w - 120);
        const y = trailCenter(x) + (hash(i, 5, 79) - 0.5) * TRAIL.halfH * 1.4;
        dot(ctx, x, y, '#8d8f96');
        if (hash(i, 6, 81) > 0.5) dot(ctx, x + PX, y, '#6e7078');
    }
    return canvas;
}

// --- Açıklık zemini (kulübenin çevresi, 2400 geniş) ---
export function bakeYardGround() {
    const { canvas, ctx } = newCanvas(YARD.w, 560);
    grassField(ctx, YARD.w, 560, 5);
    // Çiğnenmiş toprak lekeleri: kulübenin önü, ateş çukuru, odun yığını, patika başı
    const dirtAt = (x, y, rx, ry) => {
        for (let py = y - ry; py < y + ry; py += PX) {
            for (let px = x - rx; px < x + rx; px += PX) {
                const d = Math.hypot((px - x) / rx, (py - y) / ry);
                if (d > 1 - hash(px, py, 91) * 0.25) continue;
                dirtCell(ctx, px, py, d > 0.8);
            }
        }
    };
    dirtAt(YARD_DOOR.x, 330, 190, 66);
    dirtAt(FIRE_PIT.x, FIRE_PIT.y + 8, 80, 44);
    dirtAt(WOODPILE.x + 50, WOODPILE.y + 30, 80, 38);
    dirtAt(70, 440, 60, 40);
    dirtAt(BARREL.x + 24, BARREL.y + 70, 56, 30);
    // Kulübeden iki yana giden toprak yol
    for (let x = 150; x < YARD.w - 150; x += PX) {
        const y = 392 + Math.sin(x / 150) * 10;
        for (let py = y - 18; py < y + 18; py += PX) {
            const edge = Math.min(py - (y - 18), (y + 18) - py) < 6;
            if (hash(x, py, 93) < 0.35 || (edge && hash(x, py, 95) < 0.5)) continue;
            dirtCell(ctx, x, py, edge);
        }
    }
    drawPondBase(ctx);
    for (let i = 0; i < 380; i++) {
        const x = hash(i, 1, 171) * YARD.w, y = 280 + hash(i, 2, 173) * 280;
        if (x > POND.x - 10 && x < POND.x + POND.w + 10 && y > POND.y - 10 && y < POND.y + POND.h + 10) continue;
        dot(ctx, x, y, LEAF[Math.floor(hash(i, 3, 175) * LEAF.length)]);
    }
    for (let i = 0; i < 30; i++) {
        dot(ctx, WOODPILE.x + 20 + hash(i, 4, 177) * 120, WOODPILE.y + 40 + hash(i, 5, 179) * 22, '#c9a06a');
    }
    return canvas;
}

// Gölet: kıyıda çamur ve taş, suyun içi mavi bantlı
function drawPondBase(ctx) {
    const { x, y, w, h } = POND;
    const cx = x + w / 2, cy = y + h / 2;
    for (let py = y - 16; py < y + h + 16; py += PX) {
        for (let px = x - 20; px < x + w + 20; px += PX) {
            const d = Math.hypot((px - cx) / (w / 2), (py - cy) / (h / 2));
            if (d > 1.18 - hash(px, py, 97) * 0.12) continue;
            if (d > 1.0) {
                ctx.fillStyle = hash(px, py, 99) < 0.5 ? '#5a3f26' : '#6e4e30';
                ctx.fillRect(px, py, PX, PX);
            } else {
                const band = Math.floor((py - y) / 12) % 2;
                ctx.fillStyle = d > 0.85 ? '#2c6e86' : (band ? '#2f84a2' : '#3a93b2');
                ctx.fillRect(px, py, PX, PX);
            }
        }
    }
    // Kıyı taşları
    for (let i = 0; i < 16; i++) {
        const a = hash(i, 1, 101) * Math.PI * 2;
        const rx = cx + Math.cos(a) * (w / 2 + 6), ry = cy + Math.sin(a) * (h / 2 + 4);
        blk(ctx, rx - PX, ry - PX, PX * 3, PX * 2, hash(i, 2, 103) < 0.5 ? '#7a7c84' : '#9a9ca4');
    }
}

// Suyun üstünde dalgacıklar ve olta şamandırası (her karede)
export function drawPondLife(ctx, frame, bobber = null) {
    const { x, y, w, h } = POND;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.fillStyle = '#bfe4f0';
    for (let i = 0; i < 9; i++) {
        const t = (frame * 0.4 + i * 37) % 120;
        const px = cx + Math.cos(i * 2.1) * (w * 0.34), py = cy + Math.sin(i * 1.7) * (h * 0.3);
        const r = (t / 120) * 10;
        ctx.globalAlpha = 1 - t / 120;
        ctx.fillRect(Math.round((px - r) / PX) * PX, Math.round(py / PX) * PX, Math.max(PX, Math.round(r * 2 / PX) * PX), PX);
    }
    ctx.globalAlpha = 1;
    if (bobber) {
        const bob = Math.round(Math.sin(frame * 0.12) * 2 / PX) * PX;
        blk(ctx, bobber.x, bobber.y + bob, PX * 2, PX * 2, '#d8431c');
        blk(ctx, bobber.x, bobber.y + bob, PX * 2, PX, '#f4f1e4');
    }
}

// Yeşil çalı; meyveleri toplanınca bir daha görünmez
export function drawBush(ctx, x, y, berries) {
    ctx.globalAlpha = 0.3;
    blk(ctx, x - 24, y + 14, 52, PX * 2, '#000');
    ctx.globalAlpha = 1;
    const tones = ['#0a3d1d', '#14532d', '#1c7a3c', '#2a9e52'];
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
            const bx = x - 24 + c * PX * 2 + (r % 2) * PX, by = y - 12 + r * PX * 2;
            blk(ctx, bx, by, PX * 3, PX * 3, tones[(r + c) % 3 + (r === 0 ? 1 : 0)]);
        }
    }
    blk(ctx, x - 22, y - 14, 44, PX, '#3fbf6a');
    if (berries) {
        for (let i = 0; i < 7; i++) {
            blk(ctx, x - 20 + hash(i, 1, 3) * 36, y - 10 + hash(i, 2, 5) * 18, PX, PX, i % 2 ? '#7a1d6e' : '#a8328f');
        }
    }
}

export function drawBarrel(ctx, filled) {
    const { x, y, w, h } = BARREL;
    ctx.globalAlpha = 0.3;
    blk(ctx, x + PX, y + h - PX, w, PX * 2, '#000');
    ctx.globalAlpha = 1;
    blk(ctx, x + PX, y, w - PX * 2, h, WOOD.base);
    blk(ctx, x, y + PX * 3, w, h - PX * 6, WOOD.base);
    blk(ctx, x, y + PX * 3, PX, h - PX * 6, WOOD.hi);
    blk(ctx, x + w - PX, y + PX * 3, PX, h - PX * 6, WOOD.lo);
    for (const by of [y + PX * 3, y + h - PX * 5]) blk(ctx, x, by, w, PX * 2, '#3a3c44');
    blk(ctx, x + PX, y, w - PX * 2, PX * 2, filled ? '#3a93b2' : '#2a1a0c');
    blk(ctx, x + PX, y, w - PX * 2, PX, filled ? '#8fd0e6' : '#523520');
}

// Harry'nin elindeki kova (su taşırken)
export function drawBucket(ctx, x, y) {
    blk(ctx, x - PX * 2, y, PX * 5, PX * 4, '#8a6a42');
    blk(ctx, x - PX * 2, y, PX * 5, PX, '#3a93b2');
    blk(ctx, x - PX * 2, y + PX * 3, PX * 5, PX, '#3a2414');
    blk(ctx, x - PX, y - PX * 2, PX * 3, PX, '#3a3c44');
}

// Ateşin üstündeki kazan: yemek pişerken buhar çıkar
export function drawPot(ctx, x, y, frame) {
    blk(ctx, x - 20, y - 22, 40, 22, '#2a2c32');
    blk(ctx, x - 20, y - 22, 40, PX, '#555862');
    blk(ctx, x - 16, y - 20, 32, PX * 2, '#c97a3a');
    blk(ctx, x - 24, y - 20, PX, PX * 3, '#2a2c32');
    blk(ctx, x + 20, y - 20, PX, PX * 3, '#2a2c32');
    for (let i = 0; i < 4; i++) {
        const t = ((frame * 0.7 + i * 30) % 80) / 80;
        ctx.globalAlpha = 0.5 * (1 - t);
        blk(ctx, x - 12 + i * 8 + Math.sin(frame * 0.1 + i) * 3, y - 28 - t * 40, PX * 2, PX * 2, '#e4e4e8');
    }
    ctx.globalAlpha = 1;
}

// Devrilmiş ağacın kütüğü (dipte kalan çıkıntı)
export function drawStump(ctx, x, y) {
    blk(ctx, x - PX * 4, y - PX * 3, PX * 8, PX * 4, WOOD.lo);
    blk(ctx, x - PX * 4, y - PX * 4, PX * 8, PX * 2, '#c9a06a');
    blk(ctx, x - PX * 2, y - PX * 4, PX * 4, PX, '#8a5a30');
    blk(ctx, x - PX * 5, y - PX * 2, PX, PX * 3, WOOD.dark);
    blk(ctx, x + PX * 4, y - PX * 2, PX, PX * 3, WOOD.dark);
}

// Yere uzanmış gövde (dir: 1 sağa, -1 sola); taç birkaç dal olarak kalır
export function drawLyingTrunk(ctx, x, y, dir) {
    const len = 150;
    const x0 = dir > 0 ? x + PX * 4 : x - PX * 4 - len;
    blk(ctx, x0, y - PX * 4, len, PX * 5, WOOD.base);
    blk(ctx, x0, y - PX * 4, len, PX, WOOD.hi);
    blk(ctx, x0, y, len, PX, WOOD.dark);
    for (let i = PX * 3; i < len - PX * 3; i += PX * 5) {
        if (hash(i, x, 7) > 0.45) blk(ctx, x0 + i, y - PX * 2, PX * 2, PX, WOOD.lo);
    }
    // Dallar ve yapraklar uçta
    const ex = dir > 0 ? x0 + len : x0 - PX * 14;
    for (let i = 0; i < 24; i++) {
        blk(ctx, ex + hash(i, 1, 5) * PX * 14, y - PX * 8 + hash(i, 2, 7) * PX * 8, PX * 2, PX * 2, hash(i, 3, 9) < 0.5 ? '#1c7a3c' : '#14532d');
    }
}

// --- Kulübenin dış yüzü ---
// Çizim alanı: CABIN.w x (CABIN.h + 44). 44 piksel yukarıda baca var.
export const CABIN_PAD = 44;

export function bakeCabinExterior() {
    const { canvas, ctx } = newCanvas(CABIN.w, CABIN.h + CABIN_PAD);
    const W = CABIN.w, top = CABIN_PAD;
    // Duvar: yatay kütükler, uçları çıkıntılı
    const rowH = PX * 4;
    for (let y = top + 72; y < top + CABIN.h; y += rowH) {
        const alt = Math.floor(y / rowH) % 2 === 0;
        blk(ctx, 8, y, W - 16, rowH, alt ? WOOD.base : '#6c4628');
        blk(ctx, 8, y, W - 16, PX, WOOD.hi);
        blk(ctx, 8, y + rowH - PX, W - 16, PX, WOOD.dark);
        for (let x = 20; x < W - 20; x += PX * 6) {
            if (hash(x, y, 9) > 0.55) blk(ctx, x, y + PX, PX * 3, PX, WOOD.lo);
        }
        // köşelerde çıkıntı kütük uçları
        const endTone = alt ? '#b88a58' : '#a07448';
        blk(ctx, 0, y + PX / 2, 12, rowH - PX, endTone);
        blk(ctx, W - 12, y + PX / 2, 12, rowH - PX, endTone);
    }
    // Çatı: iki kademeli taş-kiremit bandı, saçak gölgesi
    const roofTop = top + 8, roofH = 68;
    blk(ctx, 0, roofTop, W, roofH, '#3d2b20');
    for (let y = roofTop; y < roofTop + roofH; y += PX * 3) {
        const off = (Math.floor(y / (PX * 3)) % 2) * PX * 3;
        for (let x = -off; x < W; x += PX * 6) {
            blk(ctx, x, y, PX * 6 - PX, PX * 3 - PX, hash(x, y, 13) > 0.5 ? '#5a4030' : '#4a3426');
            blk(ctx, x, y, PX * 6 - PX, PX, '#6b4d3a');
        }
    }
    blk(ctx, 0, roofTop + roofH - PX * 2, W, PX * 2, '#241810');
    blk(ctx, 0, roofTop, W, PX, '#7a5a44');
    // Baca (sağ üst) taş örgü
    const cx = 292;
    blk(ctx, cx, 0, PX * 10, roofTop + PX * 4, '#6c6f78');
    for (let y = 0; y < roofTop + PX * 4; y += PX * 3) {
        for (let x = cx; x < cx + PX * 10; x += PX * 4) {
            if (hash(x, y, 17) > 0.45) blk(ctx, x, y, PX * 3, PX * 2, '#8d909a');
        }
    }
    blk(ctx, cx - PX, 0, PX * 12, PX * 2, '#3a3c44');
    // Kapı: koyu tahta, demir bant, kapı eşiği
    const dw = 64, dx = Math.round((W / 2 - dw / 2) / PX) * PX, dy = top + 112;
    blk(ctx, dx - PX, dy - PX, dw + PX * 2, CABIN.h - 112 + PX, '#2a1a0c');
    blk(ctx, dx, dy, dw, CABIN.h - 112, '#5a3a20');
    for (let x = dx + PX * 4; x < dx + dw; x += PX * 4) blk(ctx, x, dy, PX, CABIN.h - 112, '#3e2814');
    blk(ctx, dx, dy + PX * 6, dw, PX * 2, '#2f3238');
    blk(ctx, dx, dy + CABIN.h - 112 - PX * 10, dw, PX * 2, '#2f3238');
    blk(ctx, dx + dw - PX * 4, dy + 48, PX * 2, PX * 3, '#b8b8c0');
    blk(ctx, dx - PX * 2, top + CABIN.h - PX * 2, dw + PX * 4, PX * 2, '#6e6a60');
    // Pencereler (ışığı sahne ayrıca çizer)
    for (const wx of [44, W - 44 - 72]) {
        blk(ctx, wx - PX, top + 96, 72 + PX * 2, 60 + PX * 2, '#2a1a0c');
        blk(ctx, wx, top + 100, 72, 56, '#16202c');
        blk(ctx, wx + 34, top + 100, PX * 2, 56, '#2a1a0c');
        blk(ctx, wx, top + 126, 72, PX * 2, '#2a1a0c');
        blk(ctx, wx, top + 100, 72, PX, '#2c3a4a');
        blk(ctx, wx - PX * 2, top + 156 + PX, 72 + PX * 4, PX * 2, WOOD.lo);
    }
    // Duvara asılı geyik boynuzları ve kütük yığını
    const ax = W / 2;
    blk(ctx, ax - PX * 1, top + 84, PX * 2, PX * 4, '#c9b890');
    for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
            blk(ctx, ax + s * (PX * (2 + i * 2)) - (s < 0 ? PX : 0), top + 84 - i * PX, PX, PX, '#c9b890');
        }
        blk(ctx, ax + s * PX * 7 - (s < 0 ? PX : 0), top + 72, PX, PX * 3, '#c9b890');
    }
    // Zemine çalı gölgesi
    ctx.globalAlpha = 0.3;
    blk(ctx, 4, top + CABIN.h - PX, W - 8, PX, '#000');
    ctx.globalAlpha = 1;
    return canvas;
}

// Pencere ışığı (akşam/gece ve soba/ateş yanıkken)
export function drawCabinGlow(ctx, frame, strength) {
    if (strength <= 0) return;
    const top = CABIN.y - CABIN_PAD;
    const flick = 0.85 + 0.15 * Math.sin(frame * 0.3) * Math.sin(frame * 0.17);
    ctx.save();
    for (const wx of [44, CABIN.w - 44 - 72]) {
        ctx.globalAlpha = 0.9 * strength * flick;
        ctx.fillStyle = '#f6c05a';
        ctx.fillRect(CABIN.x + wx, top + CABIN_PAD + 100, 72, 56);
        ctx.fillStyle = '#f0a040';
        ctx.fillRect(CABIN.x + wx, top + CABIN_PAD + 130, 72, 26);
        ctx.fillStyle = '#2a1a0c';
        ctx.fillRect(CABIN.x + wx + 34, top + CABIN_PAD + 100, PX * 2, 56);
        ctx.fillRect(CABIN.x + wx, top + CABIN_PAD + 126, 72, PX * 2);
        ctx.globalAlpha = 0.14 * strength * flick;
        ctx.fillStyle = '#f6c05a';
        ctx.fillRect(CABIN.x + wx - 20, top + CABIN_PAD + 90, 112, 90);
    }
    ctx.restore();
}

// --- Kulübenin içi ---
export function bakeCabinInterior() {
    const { canvas, ctx } = newCanvas(1000, 560);
    const backH = CABIN_IN.y0 - 24;       // arka duvarın alt kenarı
    // Zemin: tahta döşeme
    for (let y = backH; y < 560; y += PX) {
        for (let x = 0; x < 1000; x += PX) {
            // Uzun tahtalar: yatay derzler her 32 pikselde, kısa dikey derzler kademeli
            const row = Math.floor(y / 32);
            const plank = Math.floor((x + (row % 3) * 64) / 192);
            let tone = ['#9a7040', '#8d6638', '#a37846'][Math.floor(hash(plank, row, 3) * 3)];
            if (y % 32 === 0 || (x + (row % 3) * 64) % 192 === 0) tone = '#4a3018';
            else if (hash(x, y, 11) < 0.07) tone = '#7a5530';
            else if (y % 32 === PX && hash(x, row, 13) < 0.5) tone = '#b08650';
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }
    // Arka duvar: yatay kütükler
    for (let y = 0; y < backH; y += PX * 4) {
        const alt = Math.floor(y / (PX * 4)) % 2 === 0;
        blk(ctx, 0, y, 1000, PX * 4, alt ? '#6c4628' : '#7a5230');
        blk(ctx, 0, y, 1000, PX, '#8f6338');
        blk(ctx, 0, y + PX * 3, 1000, PX, '#3a2414');
        for (let x = 12; x < 1000; x += PX * 7) {
            if (hash(x, y, 19) > 0.5) blk(ctx, x, y + PX, PX * 3, PX, '#4a2f1a');
        }
    }
    blk(ctx, 0, backH - PX, 1000, PX * 2, '#2a1a0c');
    // Yan duvarlar
    for (const sx of [0, 1000 - 32]) {
        for (let y = backH; y < 560; y += PX * 4) {
            blk(ctx, sx, y, 32, PX * 4, Math.floor(y / 16) % 2 ? '#6c4628' : '#7a5230');
            blk(ctx, sx, y + PX * 3, 32, PX, '#3a2414');
        }
    }
    // Arka duvarda iki pencere (ay ışığı sahneden gelir)
    for (const wx of [128, 740]) {
        blk(ctx, wx - PX, 40, 96 + PX * 2, 76 + PX * 2, '#2a1a0c');
        blk(ctx, wx, 44, 96, 72, '#101a2a');
        blk(ctx, wx + 46, 44, PX * 2, 72, '#2a1a0c');
        blk(ctx, wx, 78, 96, PX * 2, '#2a1a0c');
        blk(ctx, wx - PX * 2, 118, 96 + PX * 4, PX * 2, WOOD.lo);
    }
    // Soba üstünde boynuz; yan odalarda raf
    blk(ctx, 478, 80, PX * 3, PX * 3, '#c9b890');
    for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) blk(ctx, 490 + s * (PX * (2 + i * 2)) - (s < 0 ? PX : 0), 80 - i * PX, PX, PX, '#c9b890');
    }
    // Halı (ortadaki oda)
    for (let y = 410; y < 500; y += PX) {
        for (let x = 380; x < 620; x += PX) {
            const border = x < 392 || x > 604 || y < 422 || y > 488;
            ctx.fillStyle = border ? '#7a2a2a' : (Math.floor((x + y) / 16) % 2 ? '#a24040' : '#8f3636');
            ctx.fillRect(x, y, PX, PX);
        }
    }
    // Oda bölmeleri: arka duvardan inen kütük duvarlar
    for (const p of PARTITIONS) {
        for (let y = p.y; y < p.y + p.h; y += PX * 4) {
            blk(ctx, p.x, y, p.w, PX * 4, Math.floor(y / 16) % 2 ? '#6c4628' : '#7a5230');
            blk(ctx, p.x, y, PX, PX * 4, '#9a6c40');
            blk(ctx, p.x + p.w - PX, y, PX, PX * 4, '#3a2414');
        }
        ctx.globalAlpha = 0.28;
        blk(ctx, p.x + p.w, p.y, PX * 4, p.h, '#000');
        ctx.globalAlpha = 1;
    }
    return canvas;
}

// Yatak: hazırlanınca battaniye ve yastık gelir
export function drawBed(ctx, bed, prepared, tone) {
    const { x, y, w, h } = bed;
    ctx.globalAlpha = 0.28;
    blk(ctx, x + PX, y + h - PX, w, PX * 2, '#000');
    ctx.globalAlpha = 1;
    blk(ctx, x, y, w, h, WOOD.dark);
    blk(ctx, x + PX, y + PX, w - PX * 2, h - PX * 2, WOOD.base);
    blk(ctx, x, y, PX * 2, h, WOOD.lo);
    blk(ctx, x + w - PX * 2, y, PX * 2, h, WOOD.lo);
    blk(ctx, x, y + h - PX * 2, w, PX * 2, WOOD.lo);
    if (!prepared) {
        // Çıplak tahta, bir köşede katlanmış eski battaniye
        blk(ctx, x + PX * 3, y + PX * 3, w - PX * 6, h - PX * 6, '#8a6a42');
        for (let yy = y + PX * 5; yy < y + h - PX * 3; yy += PX * 5) blk(ctx, x + PX * 3, yy, w - PX * 6, PX, '#6a4e2c');
        blk(ctx, x + w - PX * 12, y + h - PX * 9, PX * 9, PX * 5, '#6a6a60');
        return;
    }
    // Hazır: saman minder, battaniye, yastık
    blk(ctx, x + PX * 3, y + PX * 3, w - PX * 6, h - PX * 6, '#d8c890');
    blk(ctx, x + PX * 3, y + PX * 3, w - PX * 6, PX, '#efe0ae');
    blk(ctx, x + PX * 12, y + PX * 3, w - PX * 15, h - PX * 6, tone.base);
    blk(ctx, x + PX * 12, y + PX * 3, w - PX * 15, PX * 2, tone.hi);
    blk(ctx, x + PX * 12, y + h - PX * 5, w - PX * 15, PX * 2, tone.lo);
    for (let xx = x + PX * 16; xx < x + w - PX * 4; xx += PX * 6) blk(ctx, xx, y + PX * 5, PX, h - PX * 10, tone.lo);
    blk(ctx, x + PX * 4, y + PX * 6, PX * 7, h - PX * 12, '#f1ede0');
    blk(ctx, x + PX * 4, y + PX * 6, PX * 7, PX, '#ffffff');
}

export const BED_TONES = {
    fred: { base: '#3f6b8f', hi: '#5a8ab0', lo: '#2a4a68' },
    harry: { base: '#8f3f3f', hi: '#b05a5a', lo: '#682a2a' }
};

export function drawStove(ctx, lit, frame) {
    const { x, y, w, h } = STOVE;
    // Baca borusu duvara
    blk(ctx, x + w / 2 - PX * 2, y - PX * 10, PX * 4, PX * 10, '#2a2c32');
    blk(ctx, x + w / 2 - PX * 2, y - PX * 10, PX, PX * 10, '#4a4c54');
    ctx.globalAlpha = 0.3;
    blk(ctx, x + PX, y + h - PX, w, PX * 2, '#000');
    ctx.globalAlpha = 1;
    blk(ctx, x, y + PX * 2, w, h - PX * 2, '#2f3238');
    blk(ctx, x, y + PX * 2, w, PX * 2, '#555862');
    blk(ctx, x, y + h - PX * 3, w, PX * 3, '#1a1c20');
    // Ocak ağzı
    const ox = x + PX * 8, oy = y + PX * 8, ow = w - PX * 16, oh = PX * 5;
    blk(ctx, ox - PX, oy - PX, ow + PX * 2, oh + PX * 2, '#1a1c20');
    if (lit) {
        const flick = Math.floor(frame / 5) % 3;
        blk(ctx, ox, oy, ow, oh, '#7a2410');
        blk(ctx, ox + PX, oy + PX - (flick === 2 ? PX / 2 : 0), ow - PX * 2, oh - PX, '#e8742a');
        blk(ctx, ox + PX * 3, oy + PX * 2 - (flick === 1 ? PX / 2 : 0), ow - PX * 6, oh - PX * 2, '#f6c05a');
    } else {
        blk(ctx, ox, oy, ow, oh, '#262628');
    }
    blk(ctx, x + w - PX * 5, y + PX * 4, PX * 2, PX * 2, '#aab0b8');
}

export function drawTable(ctx) {
    const { x, y, w, h } = TABLE;
    ctx.globalAlpha = 0.28;
    blk(ctx, x + PX * 2, y + h - PX, w, PX * 2, '#000');
    ctx.globalAlpha = 1;
    blk(ctx, x + PX * 2, y + h - PX * 8, PX * 3, PX * 8, WOOD.lo);
    blk(ctx, x + w - PX * 5, y + h - PX * 8, PX * 3, PX * 8, WOOD.lo);
    blk(ctx, x, y, w, h - PX * 6, WOOD.base);
    blk(ctx, x, y, w, PX * 2, WOOD.hi);
    blk(ctx, x, y + h - PX * 8, w, PX * 2, WOOD.lo);
    for (let xx = x + PX * 6; xx < x + w - PX * 4; xx += PX * 9) blk(ctx, xx, y + PX * 3, PX * 4, PX, WOOD.lo);
    // Üstünde fener ve tabak
    blk(ctx, x + w - PX * 13, y + PX * 2, PX * 5, PX * 6, '#2a2c32');
    blk(ctx, x + w - PX * 12, y + PX * 3, PX * 3, PX * 4, '#f6c05a');
    blk(ctx, x + PX * 8, y + PX * 4, PX * 6, PX * 3, '#d8d8d0');
    blk(ctx, x + PX * 17, y + PX * 5, PX * 3, PX * 3, '#8a5a3a');
}

function drawCrate(ctx, r, tone) {
    const { x, y, w, h } = r;
    ctx.globalAlpha = 0.28;
    blk(ctx, x + PX, y + h - PX, w, PX * 2, '#000');
    ctx.globalAlpha = 1;
    blk(ctx, x, y, w, h, tone.base);
    blk(ctx, x, y, w, PX, tone.hi);
    blk(ctx, x, y + h - PX, w, PX, tone.lo);
    blk(ctx, x, y + h / 2 - PX / 2, w, PX, tone.lo);
    blk(ctx, x + w / 2 - PX / 2, y, PX, h, tone.lo);
}

export function drawChest(ctx) {
    drawCrate(ctx, CHEST, { base: '#6c4628', hi: '#8f6338', lo: '#3a2414' });
    blk(ctx, CHEST.x + CHEST.w / 2 - PX, CHEST.y + PX * 5, PX * 2, PX * 2, '#c8b060');
}

export function drawCrateProp(ctx) {
    drawCrate(ctx, SHELF_CRATE, { base: '#7a5a30', hi: '#9a7a48', lo: '#4a3418' });
}

// --- Dışarısı: ateş çukuru, odun yığını, kesilmiş odunlar ---

// Ateş çukuru: taş halka, kütükler; yanıyorsa alev ve kıvılcım
export function drawFirePit(ctx, lit, frame) {
    const { x, y } = FIRE_PIT;
    ctx.globalAlpha = 0.3;
    blk(ctx, x - 32, y + 8, 64, PX * 2, '#000');
    ctx.globalAlpha = 1;
    // Taş halka
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const sx = x + Math.cos(a) * 28, sy = y + Math.sin(a) * 11;
        blk(ctx, sx - PX * 2, sy - PX, PX * 4, PX * 3, i % 2 ? '#6e7078' : '#8d8f96');
        blk(ctx, sx - PX * 2, sy - PX, PX * 4, PX, '#a8aab2');
    }
    blk(ctx, x - 20, y - 4, 40, 12, lit ? '#2a1008' : '#26211e');
    // Kütükler
    blk(ctx, x - 20, y - PX, 40, PX * 3, WOOD.lo);
    blk(ctx, x - 16, y - PX * 3, 32, PX * 2, WOOD.base);
    if (!lit) {
        for (let i = 0; i < 12; i++) dot(ctx, x - 16 + hash(i, 1, 3) * 32, y - 2 + hash(i, 2, 5) * 8, '#4a4846');
        return;
    }
    // Alev: üç katman, her karede titreşir
    const f = frame;
    const flame = (cx, base, h, w, color) => {
        const wob = Math.round(Math.sin(f * 0.4 + cx) * 2 / PX) * PX;
        blk(ctx, cx - w / 2 + wob, base - h, w, h, color);
        blk(ctx, cx - w / 2 + wob + PX, base - h - PX * 2, w - PX * 2, PX * 2, color);
    };
    flame(x - 8, y - 2, 20 + (Math.floor(f / 4) % 3) * 4, 12, '#d8431c');
    flame(x + 8, y - 2, 18 + (Math.floor(f / 5) % 3) * 4, 12, '#d8431c');
    flame(x, y - 2, 30 + (Math.floor(f / 3) % 3) * 4, 16, '#ea7a24');
    flame(x - 2, y - 2, 20 + (Math.floor(f / 4) % 3) * 4, 8, '#f6c05a');
    flame(x + 3, y - 2, 12 + (Math.floor(f / 6) % 2) * 4, 6, '#fff0b0');
    // Kıvılcımlar
    for (let i = 0; i < 6; i++) {
        const t = ((f * 0.8 + i * 23) % 70) / 70;
        const sx = x + Math.sin(i * 7 + f * 0.05) * 14 + (hash(i, 3, 5) - 0.5) * 20;
        ctx.globalAlpha = 1 - t;
        blk(ctx, sx, y - 20 - t * 56, PX, PX, '#f6c05a');
    }
    ctx.globalAlpha = 1;
}

// Işık hâlesi: ateşin çevresini aydınlatır (karanlık katmanının üstüne eklenir)
export function drawFireGlow(ctx, frame, scale = 1) {
    const { x, y } = FIRE_PIT;
    const flick = 0.85 + 0.15 * Math.sin(frame * 0.35) * Math.sin(frame * 0.21);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Elips biçiminde yumuşak ışık: yarıçap 1'e normalleştirilmiş radyal degrade
    ctx.translate(x, y - 4);
    ctx.scale(1.25, 0.75);
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 230);
    grad.addColorStop(0, 'rgba(240, 130, 50, 0.55)');
    grad.addColorStop(0.35, 'rgba(232, 116, 42, 0.22)');
    grad.addColorStop(1, 'rgba(232, 116, 42, 0)');
    ctx.globalAlpha = Math.min(1, flick * scale);
    ctx.fillStyle = grad;
    ctx.fillRect(-300, -300, 600, 600);
    ctx.restore();
}

// Odun yığını: count kadar kütük, yığın büyüdükçe yükselir (0..6)
export function drawWoodpile(ctx, count) {
    const { x, y, w, h } = WOODPILE;
    ctx.globalAlpha = 0.3;
    blk(ctx, x + PX, y + h - PX, w, PX * 2, '#000');
    ctx.globalAlpha = 1;
    // Kütüklerin dayandığı iki direk
    blk(ctx, x, y - PX * 3, PX * 2, h + PX * 3, WOOD.dark);
    blk(ctx, x + w - PX * 2, y - PX * 3, PX * 2, h + PX * 3, WOOD.dark);
    const perRow = 6;
    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const lx = x + PX * 3 + col * (PX * 5 + 1), ly = y + h - PX * 6 - row * PX * 6;
        blk(ctx, lx, ly, PX * 4, PX * 5, WOOD.base);
        blk(ctx, lx, ly, PX * 4, PX, WOOD.hi);
        blk(ctx, lx + PX, ly + PX, PX * 2, PX * 3, '#c9a06a');
        blk(ctx, lx + PX * 2 - PX / 2, ly + PX * 2, PX, PX, '#8a5a30');
    }
    // Üzerine eski bir balta saplanmış
    blk(ctx, x + w - PX * 6, y + PX * 2, PX, PX * 9, '#6c4628');
    blk(ctx, x + w - PX * 8, y + PX * 2, PX * 4, PX * 3, '#9a9ca4');
}

// Kesilmiş ağacın yanına bırakılan kütük
export function drawChoppedLog(ctx, x, y) {
    blk(ctx, x - PX * 3, y - PX * 3, PX * 8, PX * 4, WOOD.base);
    blk(ctx, x - PX * 3, y - PX * 3, PX * 8, PX, WOOD.hi);
    blk(ctx, x - PX * 4, y - PX * 2, PX, PX * 2, '#c9a06a');
    for (let i = 0; i < 5; i++) dot(ctx, x + (hash(i, 1, 3) - 0.5) * 36, y + hash(i, 2, 4) * 8, '#c9a06a');
}
