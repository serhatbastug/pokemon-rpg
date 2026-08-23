// Şehir kenarı + orman girişi sahnesinin piksel çizimleri.
// Ağaçlar ve çizim araçları src/pixel/ altında paylaşılıyor.
//
// Zemin (asfalt, kaldırım, binalar, çim, patika) dünyanın tamamı için bir kez
// offscreen canvas'a pişirilir; sahne her karede yalnızca görünen dilimi
// kopyalar.

import { PX, newCanvas, blk, dot, hash } from '../pixel/pixelDraw.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { WORLD, CITY, GAP, FOREST, corridorAt } from './adventureLayout.js';

// --- Paletler ---
const GRASS = ['#14532d', '#166534', '#15803d', '#177a39', '#1a8a42'];
const GRASS_DARK = ['#0f3d22', '#123f26', '#14532d'];
const DIRT = ['#7a4d22', '#8a5a2b', '#6b4119', '#96652f'];
const DIRT_EDGE = '#5a3617';
const ASPHALT = ['#3f3f46', '#38383f', '#45454d', '#333338'];
const PAVEMENT = ['#9ca3af', '#a8adb8', '#8f95a1'];
const CURB = '#6b7280';

// Bina cepheleri: gövde, gölge, kenar ışığı, çatı bandı
const BUILDINGS = [
    { wall: '#8a6f5a', dark: '#6b5344', light: '#a58872', roof: '#4a3a2e', glass: '#8ec5e8' },
    { wall: '#6f7d8a', dark: '#54606b', light: '#8b98a5', roof: '#2f3a44', glass: '#a5d8f0' },
    { wall: '#9a6b62', dark: '#77504a', light: '#b5847a', roof: '#4d332e', glass: '#f2d38a' },
    { wall: '#7a7f6a', dark: '#5c6050', light: '#969b84', roof: '#3b3f32', glass: '#bfe3c8' },
    { wall: '#8c7a9a', dark: '#6a5b76', light: '#a695b3', roof: '#42374c', glass: '#ffe6a3' }
];

// --- Zemin ---

export function bakeGround() {
    const { canvas, ctx } = newCanvas(WORLD.w, WORLD.h);

    // 1) Her yere çim: şehrin altındaki park şeridi ve ormanın tamamı
    for (let y = 0; y < WORLD.h; y += PX) {
        for (let x = 0; x < WORLD.w; x += PX) {
            const patch = hash(Math.floor(x / 40), Math.floor(y / 40), 3);
            const palette = patch < 0.28 ? GRASS_DARK : GRASS;
            ctx.fillStyle = palette[Math.floor(hash(x, y, 1) * palette.length)];
            ctx.fillRect(x, y, PX, PX);
        }
    }
    // Çim tutamları
    for (let y = PX; y < WORLD.h; y += PX * 2) {
        for (let x = 0; x < WORLD.w; x += PX * 2) {
            if (hash(x, y, 7) > 0.05) continue;
            const light = hash(x, y, 8) > 0.5 ? '#22c55e' : '#16a34a';
            dot(ctx, x, y, light);
            dot(ctx, x, y - PX, light);
        }
    }

    drawCity(ctx);
    drawForestPath(ctx);
    return canvas;
}

function drawCity(ctx) {
    const road = CITY.road;
    const roadBottom = road.y + road.h;

    // Kaldırımlar: plaka derzli, kenarında bordür
    const pavement = (y0, h) => {
        for (let y = y0; y < y0 + h; y += PX) {
            for (let x = 0; x < CITY.edgeX; x += PX) {
                const slabX = Math.floor(x / (PX * 9));
                const slabY = Math.floor(y / (PX * 6));
                let tone = PAVEMENT[Math.floor(hash(slabX, slabY, 11) * PAVEMENT.length)];
                if (x % (PX * 9) === 0 || y % (PX * 6) === 0) tone = '#7b8290';   // derz
                if (hash(x, y, 13) < 0.05) tone = '#7b8290';                       // leke
                ctx.fillStyle = tone;
                ctx.fillRect(x, y, PX, PX);
            }
        }
    };
    pavement(CITY.topWalk.y, CITY.topWalk.h);
    pavement(CITY.bottomWalk.y, CITY.bottomWalk.h);

    // Asfalt
    for (let y = road.y; y < roadBottom; y += PX) {
        for (let x = 0; x < CITY.edgeX; x += PX) {
            let tone = ASPHALT[Math.floor(hash(x, y, 17) * ASPHALT.length)];
            if (hash(x, y, 19) < 0.03) tone = '#2a2a30';        // yağ lekesi
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }
    // Asfalttaki çatlaklar
    for (let i = 0; i < 26; i++) {
        let cx = hash(i, 0, 23) * CITY.edgeX;
        let cy = road.y + 10 + hash(i, 1, 29) * (road.h - 20);
        for (let step = 0; step < 10; step++) {
            dot(ctx, cx, cy, '#2a2a30');
            cx += (hash(i, step, 31) - 0.35) * 10;
            cy += (hash(i, step, 37) - 0.5) * 8;
        }
    }

    // Bordürler: yolun iki kenarında açık şerit + koyu gölge
    blk(ctx, 0, road.y - PX * 2, CITY.edgeX, PX * 2, CURB);
    blk(ctx, 0, road.y, CITY.edgeX, PX, '#2a2a30');
    blk(ctx, 0, roadBottom, CITY.edgeX, PX * 2, CURB);
    blk(ctx, 0, roadBottom - PX, CITY.edgeX, PX, '#2a2a30');

    // Kenar çizgileri ve orta kesikli çizgi
    blk(ctx, 0, road.y + PX * 2, CITY.edgeX, PX, '#d4d4d8');
    blk(ctx, 0, roadBottom - PX * 3, CITY.edgeX, PX, '#d4d4d8');
    const midY = road.y + road.h / 2 - PX / 2;
    for (let x = 0; x < CITY.edgeX; x += PX * 14) {
        // Yaya geçidinin üstünden geçmesin
        if (x + PX * 8 > CITY.crosswalk.x && x < CITY.crosswalk.x + CITY.crosswalk.w) continue;
        blk(ctx, x, midY, PX * 8, PX, '#fbbf24');
    }

    // Yaya geçidi: yola dik beyaz şeritler
    for (let x = CITY.crosswalk.x; x < CITY.crosswalk.x + CITY.crosswalk.w; x += PX * 6) {
        blk(ctx, x, road.y + PX * 4, PX * 3, road.h - PX * 8, '#e4e4e7');
    }

    // Rögar kapakları
    for (const mx of [200, 620]) {
        blk(ctx, mx, road.y + PX * 6, PX * 6, PX * 5, '#52525b');
        blk(ctx, mx + PX, road.y + PX * 7, PX * 4, PX * 3, '#3f3f46');
    }

    // Yolun sonu: sarı-siyah çizgili bariyer. Bu olmadan asfalt ile çim
    // arasında keskin bir dikey kesik kalıyor ve şehir yarım kesilmiş duruyor.
    const barrierX = CITY.edgeX - PX * 3;
    for (let y = road.y - PX * 2; y < roadBottom + PX * 2; y += PX) {
        const stripe = Math.floor(y / (PX * 3)) % 2 === 0;
        blk(ctx, barrierX, y, PX * 3, PX, stripe ? '#fbbf24' : '#27272a');
    }
    blk(ctx, barrierX - PX, road.y - PX * 4, PX * 5, PX * 2, '#52525b');
    blk(ctx, barrierX - PX, roadBottom + PX * 2, PX * 5, PX * 2, '#52525b');

    // Binaların arkası ve aralarındaki dar sokaklar: uzaktaki şehir gölgesi.
    // Bu olmadan cephelerin üstünde çim görünüyor.
    for (let y = 0; y < CITY.topBuildings.h; y += PX) {
        for (let x2 = 0; x2 < CITY.edgeX; x2 += PX) {
            ctx.fillStyle = hash(x2, y, 83) < 0.2 ? '#1a1e26' : '#232833';
            ctx.fillRect(x2, y, PX, PX);
        }
    }

    // Binalar: üst şeritte sıra sıra cepheler
    let x = -20;
    let index = 0;
    while (x < CITY.edgeX) {
        const style = BUILDINGS[index % BUILDINGS.length];
        const w = 120 + Math.floor(hash(index, 0, 41) * 4) * 20;
        const top = 8 + Math.floor(hash(index, 1, 43) * 5) * 8;
        drawBuilding(ctx, x, top, Math.min(w, CITY.edgeX - x + 20), CITY.topBuildings.h - top, style, index);
        x += w + 8;
        index++;
    }

    // Parkın kenarı: alçak çit + çalı sırası (ormana bakan taraf)
    const edgeY = CITY.bottomEdge.y;
    for (let fx = 0; fx < CITY.edgeX; fx += PX * 6) {
        blk(ctx, fx, edgeY, PX, PX * 5, '#4b5563');            // dikme
        blk(ctx, fx, edgeY + PX, PX * 6, PX, '#6b7280');       // yatay kuşak
        blk(ctx, fx, edgeY + PX * 4, PX * 6, PX, '#6b7280');
    }
    for (let bx = 0; bx < CITY.edgeX; bx += PX * 5) {
        const h = PX * (4 + Math.floor(hash(bx, 0, 47) * 3));
        for (let by = 0; by < h; by += PX) {
            for (let bw = 0; bw < PX * 5; bw += PX) {
                const tone = hash(bx + bw, by, 53) < 0.3 ? '#14532d' : (by < PX * 2 ? '#22c55e' : '#166534');
                ctx.fillStyle = tone;
                ctx.fillRect(bx + bw, edgeY + PX * 6 + by, PX, PX);
            }
        }
    }

    // Çim şeritten ormanın boşluğuna giden toprak patika: kaldırımdan ayrılıp
    // boşluğun ortasına doğru daralarak gider
    const pathStartX = 560;
    const pathStartY = CITY.verge.y + CITY.verge.h / 2;
    const gapCenterY = (GAP.top + GAP.bottom) / 2;
    for (let px = pathStartX; px < GAP.x1; px += PX) {
        const t = Math.min(1, (px - pathStartX) / 260);
        const cy = pathStartY + (gapCenterY - pathStartY) * t;
        const half = 30 - t * 6;
        for (let py = cy - half; py < cy + half; py += PX) {
            if (py < CITY.walk.top || py > WORLD.h) continue;
            const edge = Math.min(py - (cy - half), (cy + half) - py) < 8;
            if (edge && hash(px, py, 59) < 0.4) continue;
            ctx.fillStyle = edge ? DIRT_EDGE : DIRT[Math.floor(hash(px, py, 61) * DIRT.length)];
            ctx.fillRect(px, Math.round(py / PX) * PX, PX, PX);
        }
    }
}

// Tek bir bina cephesi: duvar, pencere ızgarası, giriş, saçak ve çatı bandı
function drawBuilding(ctx, x0, y0, w, h, style, seed) {
    const x1 = x0 + w;
    const y1 = y0 + h;

    for (let y = y0; y < y1; y += PX) {
        for (let x = Math.max(0, x0); x < x1; x += PX) {
            const rel = (x - x0) / w;
            let tone = style.wall;
            if (rel < 0.06) tone = style.light;
            else if (rel > 0.9) tone = style.dark;
            if (hash(x, y, 67) < 0.10) tone = style.dark;
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Çatı bandı ve saçak gölgesi
    blk(ctx, Math.max(0, x0 - PX), y0 - PX * 2, w + PX * 2, PX * 3, style.roof);
    blk(ctx, Math.max(0, x0), y1 - PX * 2, w, PX * 2, style.roof);

    // Pencereler: satır satır, bazıları yanıyor
    const cols = Math.max(2, Math.floor((w - 24) / 32));
    const rows = Math.max(2, Math.floor((h - 40) / 30));
    const winW = PX * 5;
    const winH = PX * 4;
    const gapX = (w - cols * winW) / (cols + 1);
    const gapY = (h - 30 - rows * winH) / (rows + 1);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const wx = x0 + gapX + c * (winW + gapX);
            const wy = y0 + 10 + gapY + r * (winH + gapY);
            if (wx < 0) continue;
            const lit = hash(seed * 7 + c, r, 71) < 0.45;
            blk(ctx, wx - PX, wy - PX, winW + PX * 2, winH + PX * 2, style.roof);
            blk(ctx, wx, wy, winW, winH, lit ? style.glass : '#2b3440');
            if (lit) blk(ctx, wx, wy, winW, PX, '#ffffff');
            else dot(ctx, wx + PX, wy + PX, '#3d4756');
        }
    }

    // Giriş: koyu kapı + üstünde tabela bandı
    const doorW = PX * 8;
    const doorX = x0 + w / 2 - doorW / 2;
    if (doorX > 0) {
        blk(ctx, doorX - PX, y1 - PX * 9, doorW + PX * 2, PX * 9, style.roof);
        blk(ctx, doorX, y1 - PX * 8, doorW, PX * 8, '#2b2b33');
        blk(ctx, doorX + PX, y1 - PX * 7, doorW - PX * 2, PX * 3, '#4b5563');
        blk(ctx, doorX - PX * 2, y1 - PX * 12, doorW + PX * 4, PX * 3, style.glass);
    }
}

// Ormandaki dar patika: koridorun ortasında kıvrılan toprak şerit
function drawForestPath(ctx) {
    for (let x = GAP.x0; x < WORLD.w; x += PX) {
        const corridor = x < FOREST.x0
            ? { center: (GAP.top + GAP.bottom) / 2 }
            : corridorAt(x);
        const half = 26 + Math.sin(x * 0.02) * 4;
        for (let y = corridor.center - half; y < corridor.center + half; y += PX) {
            const edge = Math.min(y - (corridor.center - half), (corridor.center + half) - y) < 8;
            if (edge && hash(x, y, 73) < 0.4) continue;
            ctx.fillStyle = edge ? DIRT_EDGE : DIRT[Math.floor(hash(x, y, 79) * DIRT.length)];
            ctx.fillRect(x, Math.round(y / PX) * PX, PX, PX);
        }
    }
}

// --- Sokak lambası (derinlik sırasına giren nesne) ---

let lampCache = null;

export function lampSprite() {
    if (lampCache) return lampCache;
    const w = PX * 12;
    const h = PX * 26;
    const { canvas, ctx } = newCanvas(w, h);
    const baseX = w / 2;

    // Direk: dipte kaide, yukarı doğru incelen gövde
    blk(ctx, baseX - PX * 3, h - PX * 3, PX * 6, PX * 3, '#3f3f46');
    blk(ctx, baseX - PX * 2, h - PX * 4, PX * 4, PX, '#52525b');
    for (let y = h - PX * 4; y > PX * 4; y -= PX) {
        blk(ctx, baseX - PX, y, PX, PX, '#6b7280');   // ışık alan sol yüz
        blk(ctx, baseX, y, PX, PX, '#3f3f46');
    }
    // Kol ve lamba başı
    blk(ctx, baseX - PX, PX * 4, PX * 5, PX, '#52525b');
    blk(ctx, baseX + PX * 3, PX * 4, PX * 3, PX * 3, '#3f3f46');
    blk(ctx, baseX + PX * 3, PX * 6, PX * 3, PX, '#fde68a');

    lampCache = { canvas, ox: baseX, oy: h };
    return lampCache;
}

// --- Mekan adı kartı ---

// Ormana girince ekranın üstünde beliren yazı. viewW ekran genişliği.
export function drawLocationTitle(ctx, text, alpha, viewW) {
    if (alpha <= 0) return;
    const scale = 4;
    const width = measurePixelText(text, scale);
    const padX = PX * 6;
    const padY = PX * 4;
    const boxW = width + padX * 2;
    const boxH = 7 * scale + padY * 2;
    const x = Math.round((viewW / 2 - boxW / 2) / PX) * PX;
    const y = PX * 10;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - PX, y - PX, boxW + PX * 2, boxH + PX * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x, y, boxW, PX);
    ctx.fillRect(x, y + boxH - PX, boxW, PX);
    drawPixelText(ctx, text, x + boxW / 2, y + padY, {
        scale,
        color: '#fef3c7',
        shadow: '#0f172a',
        align: 'center'
    });
    ctx.globalAlpha = 1;
}
