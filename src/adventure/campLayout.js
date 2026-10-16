// Avcı kulübesi bölümünün yerleşimi (DOM/canvas yok, yalnızca sayılar).
//
// Üç mekân, hepsi 3/4 görünüm:
//   trail  orman patikası: yatay kayan geniş dünya, üç yol ayrımı
//   yard   kulübenin çevresindeki geniş açıklık (2400 geniş, kayar): solda ve
//          sağda orman, ortada kulübe, sağ uçta gölet
//   cabin  kulübenin içi: Fred'in odası, ortada soba ve masa, Harry'nin odası
//
// Ayak kutusu (PLAYER_BOX) labLayout'takiyle aynı. Ağaç tacı gövde dibinden
// YUKARI uzar: kırılan ağaçlar da süs ağaçlarıyla AYNI boydadır (tall/huge).

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

// Yol ayrımları: ana patikadan yukarı bir bağlantı çıkar (len), sonra yan patika
// yatay uzar (arm; dir = 1 sağa, -1 sola) ve ucunda devrilmiş kütük var
// (girilemez). Karakterler ayrımdan geçerken konuşur.
export const JUNCTIONS = [
    { x: 900, len: 150, arm: 340, dir: 1 },
    { x: 1750, len: 130, arm: 300, dir: -1 },
    { x: 2560, len: 160, arm: 380, dir: 1 }
];
export const STUB_HALF = 34;

// Yan patikanın yatay kolu: orta çizgisi (cy) ve x aralığı
export function junctionArm(j) {
    const cy = trailCenter(j.x) - TRAIL.halfH - j.len;
    const x0 = j.dir > 0 ? j.x - STUB_HALF : j.x - j.arm;
    const x1 = j.dir > 0 ? j.x + j.arm : j.x + STUB_HALF;
    return { cy, x0, x1 };
}

export function trailWalkable(x, y) {
    if (x < 12 || x > TRAIL.w - 12 || y < 0 || y > TRAIL.h) return false;
    const c = trailCenter(x);
    if (y >= c - TRAIL.halfH && y <= c + TRAIL.halfH) return true;
    for (const j of JUNCTIONS) {
        const arm = junctionArm(j);
        // Dikey bağlantı
        if (Math.abs(x - j.x) <= STUB_HALF && y >= arm.cy - STUB_HALF && y < c - TRAIL.halfH) return true;
        // Yatay kol
        if (x >= arm.x0 && x <= arm.x1 && Math.abs(y - arm.cy) <= STUB_HALF) return true;
    }
    return false;
}

// Yan patikanın güneyinde (ana patikayla arasında) uzun ağaç durmaz: tacı yolu örter
function inJunctionShade(x, y) {
    return JUNCTIONS.some(j => {
        const arm = junctionArm(j);
        return x >= arm.x0 - 50 && x <= arm.x1 + 50
            && y > arm.cy + STUB_HALF - 8 && y < trailCenter(j.x) - TRAIL.halfH + 8;
    });
}

// --- Açıklık (kulübenin çevresi) ---
export const YARD = { w: 2400, x0: 34, y0: 276, x1: 2366, y1: 536 };
export const CABIN = { x: 1010, y: 34, w: 380, h: 244 };      // ön yüz; tabanı y = 278
export const YARD_DOOR = { x: 1200, y: 296, r: 64 };           // kapı noktası
export const FIRE_PIT = { x: 1500, y: 418 };
export const WOODPILE = { x: 860, y: 330, w: 104, h: 48 };
export const BARREL = { x: 1416, y: 304, w: 44, h: 48 };       // su fıçısı
export const BARREL_SPOT = { x: 1440, y: 372, r: 62 };
export const POND = { x: 2010, y: 380, w: 250, h: 108 };      // gölet (yürünmez)
export const POND_SPOT = { x: 2135, y: 522, r: 74 };           // suyun kenarı
export const FRED_FISH = { x: 2050, y: 506 };                  // Fred olta atarken durduğu yer
export const BUSHES = [
    { x: 430, y: 440 }, { x: 580, y: 500 }, { x: 1760, y: 500 }, { x: 1890, y: 350 }
];

// Kırılabilen ağaçlar: süs ağaçlarıyla aynı boy (tall/huge). Dipleri yürünebilir
// bandın üst kenarında; tacı yukarı uzar. 10 ağaç: 2. gün 4, 3. gün 5 odun.
export const CHOP_TREES = [
    { x: 130, y: 294, size: 'huge', variant: 0 },
    { x: 270, y: 306, size: 'tall', variant: 1 },
    { x: 410, y: 296, size: 'huge', variant: 2 },
    { x: 560, y: 308, size: 'tall', variant: 3 },
    { x: 700, y: 298, size: 'huge', variant: 1 },
    { x: 1720, y: 300, size: 'tall', variant: 2 },
    { x: 1860, y: 294, size: 'huge', variant: 0 },
    { x: 2000, y: 306, size: 'tall', variant: 3 },
    { x: 2140, y: 296, size: 'huge', variant: 1 },
    { x: 2280, y: 304, size: 'tall', variant: 2 }
];
// Ağacın dibinde durulacak yer (oyuncu bu noktadan ağaca vurur)
export const treeStand = (t) => ({ x: t.x, y: t.y + 22 });
// Fred 2. gün bu ağacı devirir
export const FRED_TREE = 4;

const FIRE_BOX = { x: FIRE_PIT.x - 30, y: FIRE_PIT.y - 12, w: 60, h: 28 };

// Geceleyin aranan yerler (Fred'i ararken)
export const SEARCH_SPOTS = [
    { id: 'woodpile', x: WOODPILE.x + 52, y: WOODPILE.y + 68, r: 66 },
    { id: 'fire', x: FIRE_PIT.x, y: FIRE_PIT.y + 44, r: 66 },
    { id: 'trailEdge', x: 96, y: 440, r: 64 }
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
// Sabah Fred yatağının yanında uyanır
export const FRED_WAKE = { x: FRED_BED.x + 150, y: FRED_BED.y + FRED_BED.h + 38 };

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function feetBox(x, y) {
    return { x: x - PLAYER_BOX.w / 2, y: y - PLAYER_BOX.h, w: PLAYER_BOX.w, h: PLAYER_BOX.h };
}

// Açıklıkta her zaman duran engeller
const YARD_STATIC = [
    CABIN, WOODPILE, FIRE_BOX, BARREL, POND,
    ...BUSHES.map(b => ({ x: b.x - 22, y: b.y - 6, w: 44, h: 24 }))
];
const CHOP_BASES = CHOP_TREES.map(t => treeBase(t));

const CABIN_OBSTACLES = [FRED_BED, HARRY_BED, STOVE, TABLE, CHEST, SHELF_CRATE, ...PARTITIONS];

// Alan (area) içinde (x, y) ayak noktası engelli mi? felled: devrilmiş ağaç
// sayıları (dipleri artık engel değil).
export function blocked(area, x, y, felled = null) {
    const box = feetBox(x, y);
    if (area === 'trail') {
        const pts = [
            [x - 14, y - 16], [x + 14, y - 16], [x - 14, y], [x + 14, y], [x, y - 16], [x, y]
        ];
        return pts.some(([px, py]) => !trailWalkable(px, py));
    }
    if (area === 'yard') {
        if (x < YARD.x0 || x > YARD.x1 || y < YARD.y0 + PLAYER_BOX.h || y > YARD.y1) return true;
        if (YARD_STATIC.some(r => rectsOverlap(box, r))) return true;
        return CHOP_BASES.some((r, i) => !(felled && felled.has(i)) && rectsOverlap(box, r));
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
        if ((size === 'tall' || size === 'huge') && inJunctionShade(tree.x, tree.y)) return false;
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

// --- Açıklığın süs ağaçları: iki sıra yüksek orman, altta alçak çalılar ---
function buildYardTrees() {
    const rand = mulberry32(20261017);
    const trees = [];
    const inCabin = (x) => x > CABIN.x - 50 && x < CABIN.x + CABIN.w + 50;
    const place = (x, y, size) => trees.push({ x: Math.round(x), y: Math.round(y), size, variant: Math.floor(rand() * 4) });
    // Arka sıra (kulübenin ardında kalanlar atlanır)
    for (let x = 30; x < YARD.w - 20; x += 52 + rand() * 22) {
        if (!inCabin(x)) place(x, 110 + rand() * 54, 'huge');
    }
    // Ön sıra: kırılan ağaçların arkasında, tacı onların arasından görünür
    for (let x = 60; x < YARD.w - 40; x += 62 + rand() * 24) {
        if (inCabin(x) || CHOP_TREES.some(t => Math.abs(t.x - x) < 56)) continue;
        place(x, 196 + rand() * 56, rand() < 0.5 ? 'huge' : 'tall');
    }
    // Alt kenar: alçak çalılar
    // (Gölün önü açık kalır: Harry ve Fred orada durur, çalı örtmesin)
    for (let x = 20; x < YARD.w - 10; x += 66 + rand() * 30) {
        if (x > POND.x - 90 && x < POND.x + POND.w + 60) continue;
        place(x, 556, 'small');
    }
    trees.sort((a, b) => a.y - b.y);
    return trees;
}

export const YARD_TREES = buildYardTrees();
