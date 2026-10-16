// Avcı kulübesi bölümünün yerleşimi (DOM/canvas yok, yalnızca sayılar).
//
// Üç mekân, hepsi 3/4 görünüm:
//   trail  orman patikası: yatay kayan geniş dünya, üç yol ayrımı
//   yard   kulübenin önündeki açıklık: odun ağaçları, ateş çukuru, odun yığını
//   cabin  kulübenin içi: Fred'in odası, ortada soba ve masa, Harry'nin odası
//
// Ayak kutusu (PLAYER_BOX) labLayout'takiyle aynı. Ağaç tacı gövde dibinden
// YUKARI uzar: yürünen bandın altına yalnızca alçak ağaç dikilir.

import { PX, mulberry32 } from '../pixel/pixelDraw.js';
import { treeBase } from '../pixel/trees.js';

export const VIEW = { w: 1000, h: 560 };
export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.0;

// --- Patika ---
export const TRAIL = {
    w: 3300, h: 560,
    startX: 90, endX: 3160,
    halfH: 64, centerY: 350, amp: 36, wave: 600
};

export function trailCenter(x) {
    return TRAIL.centerY + Math.sin((x / TRAIL.wave) * Math.PI * 2) * TRAIL.amp;
}

// Yol ayrımları: ana patikadan yukarı kısa bir yan patika çıkar, ucunda devrilmiş
// kütük var (girilemez). Karakterler ayrımdan geçerken konuşur.
export const JUNCTIONS = [
    { x: 900, len: 150 },
    { x: 1750, len: 120 },
    { x: 2560, len: 170 }
];
const STUB_HALF = 34;

export function trailWalkable(x, y) {
    if (x < 12 || x > TRAIL.w - 12 || y < 0 || y > TRAIL.h) return false;
    const c = trailCenter(x);
    if (y >= c - TRAIL.halfH && y <= c + TRAIL.halfH) return true;
    for (const j of JUNCTIONS) {
        if (Math.abs(x - j.x) <= STUB_HALF && y >= trailCenter(j.x) - TRAIL.halfH - j.len && y < c - TRAIL.halfH) return true;
    }
    return false;
}

// --- Açıklık (kulübenin önü) ---
export const YARD = { x0: 34, y0: 276, x1: 966, y1: 536 };
export const CABIN = { x: 310, y: 34, w: 380, h: 244 };      // ön yüz; tabanı y = 278
export const YARD_DOOR = { x: 500, y: 296, r: 64 };           // kapı noktası
export const FIRE_PIT = { x: 790, y: 418 };
export const WOODPILE = { x: 150, y: 330, w: 104, h: 48 };
export const CHOP_TREES = [
    { x: 118, y: 486, size: 'mid', variant: 0 },
    { x: 330, y: 516, size: 'mid', variant: 1 },
    { x: 636, y: 506, size: 'mid', variant: 2 },
    { x: 884, y: 492, size: 'mid', variant: 3 },
    { x: 902, y: 352, size: 'mid', variant: 1 }
];
const FIRE_BOX = { x: FIRE_PIT.x - 30, y: FIRE_PIT.y - 12, w: 60, h: 28 };

// Geceleyin aranan yerler (Fred'i ararken)
export const SEARCH_SPOTS = [
    { id: 'woodpile', x: 210, y: 396, r: 64 },
    { id: 'fire', x: 790, y: 460, r: 64 },
    { id: 'trailEdge', x: 96, y: 440, r: 60 }
];

// --- Kulübenin içi ---
export const CABIN_IN = { x0: 30, y0: 176, x1: 970, y1: 536 };
export const FRED_BED = { x: 66, y: 188, w: 128, h: 80 };
export const HARRY_BED = { x: 806, y: 188, w: 128, h: 80 };
export const STOVE = { x: 432, y: 168, w: 104, h: 64 };
export const TABLE = { x: 400, y: 352, w: 168, h: 64 };
export const CHEST = { x: 222, y: 204, w: 52, h: 46 };
export const SHELF_CRATE = { x: 722, y: 204, w: 52, h: 46 };
// Oda bölmeleri: arka duvardan aşağı iner, altı açık (odalar girinti gibi)
export const PARTITIONS = [
    { x: 300, y: 150, w: 16, h: 196 },
    { x: 684, y: 150, w: 16, h: 196 }
];
export const CABIN_EXIT = { x: 500, y: 516, r: 72 };
export const SPOTS_IN = {
    fredBed: { x: 130, y: 306, r: 70 },
    harryBed: { x: 870, y: 306, r: 70 }
};

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function feetBox(x, y) {
    return { x: x - PLAYER_BOX.w / 2, y: y - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h };
}

// Açıklıkta engeller: kulübe, odun yığını, ateş çukuru, odun ağaçlarının dipleri
function yardObstacles() {
    return [
        CABIN, WOODPILE, FIRE_BOX,
        ...CHOP_TREES.map(t => treeBase(t))
    ];
}
const YARD_OBSTACLES = yardObstacles();

const CABIN_OBSTACLES = [FRED_BED, HARRY_BED, STOVE, TABLE, CHEST, SHELF_CRATE, ...PARTITIONS];

// Alan (area) içinde (x, y) ayak noktası engelli mi?
export function blocked(area, x, y) {
    const box = feetBox(x, y);
    if (area === 'trail') {
        const pts = [
            [x - 14, y - 16], [x + 14, y - 16], [x - 14, y], [x + 14, y], [x, y - 16], [x, y]
        ];
        return pts.some(([px, py]) => !trailWalkable(px, py));
    }
    if (area === 'yard') {
        if (x < YARD.x0 || x > YARD.x1 || y < YARD.y0 + PLAYER_BOX.h || y > YARD.y1) return true;
        return YARD_OBSTACLES.some(r => rectsOverlap(box, r));
    }
    if (x < CABIN_IN.x0 || x > CABIN_IN.x1 || y < CABIN_IN.y0 + PLAYER_BOX.h || y > CABIN_IN.y1) return true;
    return CABIN_OBSTACLES.some(r => rectsOverlap(box, r));
}

export function near(x, y, spot, px, py) {
    return Math.hypot(x - (spot.x ?? px), y - (spot.y ?? py)) <= spot.r;
}

// --- Patikanın ağaçları (sabit tohum: her açılışta aynı orman) ---
function baseBlocksPath(tree) {
    const base = treeBase(tree);
    const margin = 12;
    for (let px = base.x - margin; px <= base.x + base.w + margin; px += PX * 2) {
        for (let py = base.y - margin; py <= base.y + base.h + margin; py += PX * 2) {
            if (trailWalkable(px, py)) return true;
        }
    }
    return false;
}

function buildTrailTrees() {
    const rand = mulberry32(20261016);
    const trees = [];
    const place = (x, y, size) => {
        const tree = { x: Math.round(x), y: Math.round(y), size, variant: Math.floor(rand() * 4) };
        if (baseBlocksPath(tree)) return false;
        const tooClose = trees.some(o => {
            const dx = o.x - tree.x, dy = (o.y - tree.y) * 1.4;
            return dx * dx + dy * dy < 46 * 46;
        });
        if (tooClose) return false;
        trees.push(tree);
        return true;
    };
    // Üstte yüksek ağaçlar (taçları ekranın üst yarısını doldurur)
    for (let attempt = 0, n = 0; attempt < 6000 && n < 200; attempt++) {
        const x = 20 + rand() * (TRAIL.w - 40);
        const top = trailCenter(x) - TRAIL.halfH;
        const y = 50 + rand() * Math.max(10, top - 66);
        if (place(x, y, rand() < 0.45 ? 'huge' : 'tall')) n++;
    }
    // Altta yalnızca alçak bitki örtüsü
    for (let attempt = 0, n = 0; attempt < 3000 && n < 90; attempt++) {
        const x = 20 + rand() * (TRAIL.w - 40);
        const bottom = trailCenter(x) + TRAIL.halfH;
        const y = bottom + 78 + rand() * Math.max(0, TRAIL.h - bottom - 94);
        if (place(x, y, rand() < 0.6 ? 'small' : 'mid')) n++;
    }
    trees.sort((a, b) => a.y - b.y);
    return trees;
}

export const TRAIL_TREES = buildTrailTrees();

// --- Açıklığın çevresindeki dekor ağaçlar (yürünmez alanın dışında) ---
function buildYardTrees() {
    const rand = mulberry32(20261017);
    const trees = [];
    const place = (x, y, size) => trees.push({ x: Math.round(x), y: Math.round(y), size, variant: Math.floor(rand() * 4) });
    // Üst kenar: kulübenin iki yanında yüksek ağaçlar
    for (let x = 30; x < 300; x += 52 + rand() * 20) place(x, 210 + rand() * 50, rand() < 0.5 ? 'huge' : 'tall');
    for (let x = 720; x < 980; x += 52 + rand() * 20) place(x, 210 + rand() * 50, rand() < 0.5 ? 'huge' : 'tall');
    for (let x = 36; x < 300; x += 60) place(x + rand() * 20, 120 + rand() * 40, 'huge');
    for (let x = 724; x < 980; x += 60) place(x + rand() * 20, 120 + rand() * 40, 'huge');
    // Alt kenar: alçak çalılar, odun ağaçlarının arası
    for (let x = 20; x < 990; x += 70 + rand() * 30) {
        if (CHOP_TREES.some(t => Math.abs(t.x - x) < 70)) continue;
        place(x, 556, 'small');
    }
    trees.sort((a, b) => a.y - b.y);
    return trees;
}

export const YARD_TREES = buildYardTrees();
