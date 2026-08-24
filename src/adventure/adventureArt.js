// Şehir kenarı + orman girişi sahnesinin piksel çizimleri.
// Ağaçlar ve çizim araçları src/pixel/ altında paylaşılıyor.
//
// Şehir artık HARABE: salgın geçmiş, kimse kalmamış. Aynı yerleşim sayıları
// (adventureLayout.js) duruyor, yalnızca bu çizim katmanı değişti. Yola
// bırakılmış araçlar, çöken cepheler, kararmış camlar, yırtık afişler, ölü ot
// ve virüsün bıraktığı yeşil izler. Sağa doğru gidildikçe kir azalır; orman
// hâlâ canlıdır.
//
// Zemin (asfalt, kaldırım, binalar, çim, patika) dünyanın tamamı için bir kez
// offscreen canvas'a pişirilir; sahne her karede yalnızca görünen dilimi
// kopyalar.

import { PX, newCanvas, blk, dot, hash } from '../pixel/pixelDraw.js';

import {
    WORLD, CITY, GAP, FOREST, corridorAt,
    RUBBLE, MANHOLE, BARRIER
} from './adventureLayout.js';

// --- Paletler ---
const GRASS = ['#14532d', '#166534', '#15803d', '#177a39', '#1a8a42'];
const GRASS_DARK = ['#0f3d22', '#123f26', '#14532d'];
// Şehir tarafındaki ot ölmüş: sarıya çalan, çiğnenmiş
const DEAD_GRASS = ['#5f5c33', '#6e6a3d', '#4a4728', '#7a7449', '#3d3b21'];
const DIRT = ['#7a4d22', '#8a5a2b', '#6b4119', '#96652f'];
const DIRT_EDGE = '#5a3617';
const ASPHALT = ['#3a3a41', '#333339', '#40404a', '#2c2c33'];
const PAVEMENT = ['#83868f', '#8e929c', '#767a85'];
const CURB = '#5c6270';
const SOOT = ['#1b1817', '#231f1d', '#2c2724'];
const RUST = ['#7c3a1d', '#8f4a24', '#5e2c15'];
// Virüsün bıraktığı iz: safra yeşili, ıslak parlak
const VIRUS = ['#6a8622', '#546d14', '#7d9d2c'];
const VIRUS_HI = '#a6c73c';

// Bina cepheleri: gövde, gölge, kenar ışığı, çatı bandı.
// Renkler harabeye uygun: isli, soluk. Cam artık ışık vermiyor.
const BUILDINGS = [
    { wall: '#6f5a4a', dark: '#4e4038', light: '#87705d', roof: '#332821' },
    { wall: '#5b6570', dark: '#414a54', light: '#727d89', roof: '#232b32' },
    { wall: '#7b564f', dark: '#5b3f3a', light: '#93695f', roof: '#382520' },
    { wall: '#636856', dark: '#484c3e', light: '#7b806a', roof: '#2c2f26' },
    { wall: '#6f6178', dark: '#524859', light: '#877792', roof: '#332b3b' }
];

// Binaların arkasındaki kararmış gökyüzü tonu (çöken çatılarda da kullanılır)
function skyTone(x, y) {
    return hash(x, y, 83) < 0.2 ? '#100f14' : '#171820';
}

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

    // 2) Şehir tarafında ot ölmüş. Ormana yaklaştıkça yeşile döner: sınır
    //    keskin olmasın, şehir çürürken orman ayakta kalmış gibi dursun.
    const deadEnd = FOREST.x0 + 220;
    for (let y = 0; y < WORLD.h; y += PX) {
        for (let x = 0; x < deadEnd; x += PX) {
            const t = Math.min(1, Math.max(0, (x - 640) / (deadEnd - 640)));
            const deadness = 1 - t;
            if (hash(x, y, 91) > deadness * 0.92) continue;
            ctx.fillStyle = DEAD_GRASS[Math.floor(hash(x, y, 93) * DEAD_GRASS.length)];
            ctx.fillRect(x, y, PX, PX);
        }
    }

    drawCity(ctx);
    drawForestPath(ctx);
    drawVirusTrail(ctx);
    gradeCity(ctx);
    return canvas;
}

function drawCity(ctx) {
    const road = CITY.road;
    const roadBottom = road.y + road.h;

    // Kaldırımlar: plakalar çatlamış, derzlerden ot fışkırmış, lekeli
    const pavement = (y0, h) => {
        for (let y = y0; y < y0 + h; y += PX) {
            for (let x = 0; x < CITY.edgeX; x += PX) {
                const slabX = Math.floor(x / (PX * 9));
                const slabY = Math.floor(y / (PX * 6));
                const seam = x % (PX * 9) === 0 || y % (PX * 6) === 0;
                let tone = PAVEMENT[Math.floor(hash(slabX, slabY, 11) * PAVEMENT.length)];
                if (seam) tone = '#63676f';
                if (hash(x, y, 13) < 0.10) tone = '#63676f';
                if (hash(x, y, 101) < 0.05) tone = SOOT[Math.floor(hash(x, y, 103) * SOOT.length)];
                if (seam && hash(x, y, 107) < 0.20) {
                    tone = hash(x, y, 109) < 0.5 ? '#4d5a24' : '#3f4a1e';   // derzden çıkan ot
                }
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
            if (hash(x, y, 19) < 0.06) tone = '#232329';        // yağ/kir lekesi
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Yol çizgileri: solmuş, yer yer silinmiş
    blk(ctx, 0, road.y + PX * 2, CITY.edgeX, PX, '#8b8b86');
    blk(ctx, 0, roadBottom - PX * 3, CITY.edgeX, PX, '#8b8b86');
    const midY = road.y + road.h / 2 - PX / 2;
    for (let x = 0; x < CITY.edgeX; x += PX * 14) {
        if (x + PX * 8 > CITY.crosswalk.x && x < CITY.crosswalk.x + CITY.crosswalk.w) continue;
        if (hash(x, 0, 111) < 0.25) continue;
        blk(ctx, x, midY, PX * 8, PX, '#9a7f2a');
    }
    // Çizgilerin üstünden geçen aşınma
    for (let y = road.y; y < roadBottom; y += PX) {
        for (let x = 0; x < CITY.edgeX; x += PX) {
            if (hash(x, y, 113) >= 0.04) continue;
            ctx.fillStyle = ASPHALT[Math.floor(hash(x, y, 17) * ASPHALT.length)];
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Yaya geçidi: şeritler solmuş ve parça parça
    for (let x = CITY.crosswalk.x; x < CITY.crosswalk.x + CITY.crosswalk.w; x += PX * 6) {
        for (let y = road.y + PX * 4; y < roadBottom - PX * 4; y += PX) {
            if (hash(x, y, 117) < 0.35) continue;
            blk(ctx, x, y, PX * 3, PX, '#a3a39d');
        }
    }

    // Bordürler
    blk(ctx, 0, road.y - PX * 2, CITY.edgeX, PX * 2, CURB);
    blk(ctx, 0, road.y, CITY.edgeX, PX, '#232329');
    blk(ctx, 0, roadBottom, CITY.edgeX, PX * 2, CURB);
    blk(ctx, 0, roadBottom - PX, CITY.edgeX, PX, '#232329');

    // Asfalttaki derin çatlaklar
    for (let i = 0; i < 40; i++) {
        let cx = hash(i, 0, 23) * CITY.edgeX;
        let cy = road.y + 10 + hash(i, 1, 29) * (road.h - 20);
        for (let step = 0; step < 16; step++) {
            dot(ctx, cx, cy, '#1e1e23');
            if (hash(i, step, 121) < 0.3) dot(ctx, cx, cy + PX, '#2a2a30');
            cx += (hash(i, step, 31) - 0.35) * 10;
            cy += (hash(i, step, 37) - 0.5) * 8;
        }
    }
    // Çukurlar
    for (const [px, py, r] of [[170, 262, 16], [520, 214, 12], [806, 276, 12]]) {
        for (let y = py - r; y <= py + r; y += PX) {
            for (let x = px - r; x <= px + r; x += PX) {
                const d = Math.hypot(x - px, (y - py) * 1.6);
                if (d > r * (0.7 + hash(x, y, 127) * 0.5)) continue;
                dot(ctx, x, y, d < r * 0.5 ? '#141418' : '#22222a');
            }
        }
    }

    // Yanık izleri: patlamanın ardından kalan is halkaları
    for (const [px, py, r] of [[300, 240, 60], [700, 250, 46]]) {
        for (let y = py - r; y <= py + r; y += PX) {
            for (let x = px - r; x <= px + r; x += PX) {
                if (x < 0 || x > CITY.edgeX) continue;
                const d = Math.hypot(x - px, (y - py) * 1.4) / r;
                if (d > 1) continue;
                if (hash(x, y, 131) < 1 - d * d) {
                    dot(ctx, x, y, SOOT[Math.floor(hash(x, y, 133) * SOOT.length)]);
                }
            }
        }
    }

    // Rögarlar: soldaki kapalı, sağdaki AÇIK - buradan çıkıldı
    blk(ctx, 200, road.y + PX * 6, PX * 6, PX * 5, '#4a4a52');
    blk(ctx, 200 + PX, road.y + PX * 7, PX * 4, PX * 3, '#35353c');
    drawOpenManhole(ctx);

    // Devrilmiş karantina bariyeri
    drawFallenBarrier(ctx);

    // Yolun sonundaki bariyer: paslanmış, boyası dökülmüş
    const barrierX = CITY.edgeX - PX * 3;
    for (let y = road.y - PX * 2; y < roadBottom + PX * 2; y += PX) {
        const stripe = Math.floor(y / (PX * 3)) % 2 === 0;
        let tone = stripe ? '#9a7f2a' : '#231f1d';
        if (hash(barrierX, y, 137) < 0.3) tone = RUST[Math.floor(hash(barrierX, y, 139) * RUST.length)];
        blk(ctx, barrierX, y, PX * 3, PX, tone);
    }
    blk(ctx, barrierX - PX, road.y - PX * 4, PX * 5, PX * 2, '#45454d');
    blk(ctx, barrierX - PX, roadBottom + PX * 2, PX * 5, PX * 2, '#45454d');

    // Binaların arkası: is ve duman yüzünden kararmış gökyüzü
    for (let y = 0; y < CITY.topBuildings.h; y += PX) {
        for (let x2 = 0; x2 < CITY.edgeX; x2 += PX) {
            ctx.fillStyle = skyTone(x2, y);
            ctx.fillRect(x2, y, PX, PX);
        }
    }
    // Uzaktan yükselen duman sütunları
    for (const smokeX of [90, 380, 700]) {
        for (let y = 0; y < CITY.topBuildings.h; y += PX) {
            const spread = 8 + (CITY.topBuildings.h - y) * 0.22;
            for (let x = smokeX - spread; x < smokeX + spread; x += PX) {
                if (x < 0 || x > CITY.edgeX) continue;
                const d = Math.abs(x - smokeX) / spread;
                if (hash(x, y, 141) > (1 - d) * 0.45) continue;
                dot(ctx, x, y, hash(x, y, 143) < 0.5 ? '#2b2a33' : '#232128');
            }
        }
    }

    // Binalar: üst şeritte sıra sıra yıkık cepheler
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

    // Cephelerden kaldırıma dökülen moloz
    for (const pile of RUBBLE) drawRubble(ctx, pile);

    // Parkın kenarı: çit kırılmış, boşluklar var, çalıların yarısı kurumuş
    const edgeY = CITY.bottomEdge.y;
    for (let fx = 0; fx < CITY.edgeX; fx += PX * 6) {
        if (hash(fx, 0, 147) < 0.22) continue;                 // sökülmüş bölüm
        const lean = hash(fx, 1, 149) < 0.2 ? PX : 0;          // yana yatmış dikme
        blk(ctx, fx + lean, edgeY, PX, PX * 5, '#3d4450');
        blk(ctx, fx, edgeY + PX, PX * 6, PX, '#565d6b');
        if (hash(fx, 2, 151) > 0.25) blk(ctx, fx, edgeY + PX * 4, PX * 6, PX, '#565d6b');
    }
    for (let bx = 0; bx < CITY.edgeX; bx += PX * 5) {
        const h = PX * (4 + Math.floor(hash(bx, 0, 47) * 3));
        const dryness = Math.max(0, 1 - bx / CITY.edgeX) * 0.8 + 0.2;
        for (let by = 0; by < h; by += PX) {
            for (let bw = 0; bw < PX * 5; bw += PX) {
                const dry = hash(bx + bw, by, 153) < dryness;
                let tone;
                if (dry) tone = hash(bx + bw, by, 157) < 0.4 ? '#4a3f22' : '#5c5230';
                else tone = hash(bx + bw, by, 53) < 0.3 ? '#14532d' : (by < PX * 2 ? '#22c55e' : '#166534');
                ctx.fillStyle = tone;
                ctx.fillRect(bx + bw, edgeY + PX * 6 + by, PX, PX);
            }
        }
    }

    // Çim şeritten ormanın boşluğuna giden toprak patika
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

    // Kaçarken sokağa bırakılanlar
    drawLitter(ctx);
}

// Kanalizasyondan çıkılan açık rögar: kapak yana itilmiş, delik kapkaranlık,
// içeride merdiven basamağı görünüyor. Antrenör oyuna tam yanında başlar.
function drawOpenManhole(ctx) {
    const { x, y, w, h } = MANHOLE;
    for (let py = y; py < y + h; py += PX) {
        for (let px = x; px < x + w; px += PX) {
            const d = Math.hypot((px - (x + w / 2)) / (w / 2), (py - (y + h / 2)) / (h / 2));
            if (d > 1) continue;
            ctx.fillStyle = d > 0.82 ? '#4a4a52' : (d > 0.7 ? '#2a2a30' : '#08080b');
            ctx.fillRect(px, py, PX, PX);
        }
    }
    // İçerideki merdivenin en üst basamağı
    blk(ctx, x + w / 2 - PX * 2, y + h - PX * 5, PX * 4, PX, '#5c6270');
    // Delikten dışarı taşan ıslak iz
    for (let py = y + h - PX * 2; py < y + h + PX * 5; py += PX) {
        for (let px = x - PX * 2; px < x + w + PX * 2; px += PX) {
            if (hash(px, py, 161) > 0.22) continue;
            dot(ctx, px, py, '#2f3a2a');
        }
    }
    // Yana itilmiş kapak
    const cx = x - PX * 13;
    const cy = y + PX * 3;
    for (let py = cy; py < cy + PX * 7; py += PX) {
        for (let px = cx; px < cx + PX * 10; px += PX) {
            const d = Math.hypot((px - (cx + PX * 5)) / (PX * 5), (py - (cy + PX * 3.5)) / (PX * 3.5));
            if (d > 1) continue;
            ctx.fillStyle = d > 0.85 ? '#3a3a42' : (hash(px, py, 163) < 0.3 ? '#4a4a52' : '#55555e');
            ctx.fillRect(px, py, PX, PX);
        }
    }
    blk(ctx, cx + PX * 2, cy + PX * 3, PX * 6, PX, '#35353c');
}

// Devrilmiş karantina bariyeri: yere YATMIŞ demir çit. Üstten bakıldığı için
// çerçeve yatay, dikmeler aralıklı; ayakları yanlara devrilmiş. Ucundan kopmuş
// sarı-siyah bant yola doğru sürükleniyor.
function drawFallenBarrier(ctx) {
    const { x, y, w, h } = BARRIER;

    // Yerdeki gölge: yattığını asıl bu anlatıyor
    ctx.globalAlpha = 0.28;
    blk(ctx, x + PX, y + h - PX, w - PX * 2, PX * 2, '#000000');
    ctx.globalAlpha = 1;

    // Üst ve alt kuşak: asfaltta seçilsin diye açık çelik
    blk(ctx, x, y, w, PX * 2, '#98a0ac');
    blk(ctx, x, y + h - PX * 3, w, PX * 2, '#7d8592');
    // Aralıklı dikmeler
    for (let px = x + PX * 2; px < x + w - PX * 2; px += PX * 4) {
        const rusty = hash(px, y, 167) < 0.35;
        blk(ctx, px, y + PX * 2, PX, h - PX * 5, rusty ? RUST[1] : '#5f6875');
    }
    // Devrilmiş ayaklar: iki uçta yana çıkan kısa parçalar
    blk(ctx, x - PX * 2, y - PX, PX * 3, PX, '#7d8592');
    blk(ctx, x + w - PX, y + h - PX * 2, PX * 3, PX, '#7d8592');
    // Dış hat
    blk(ctx, x, y, PX, h - PX, '#22262e');
    blk(ctx, x + w - PX, y, PX, h - PX, '#22262e');
    blk(ctx, x, y - PX, w, PX, '#22262e');
    blk(ctx, x, y + h - PX, w, PX, '#22262e');

    // Ucundan kopup yola sürüklenmiş bant
    for (let t = 0; t < 90; t++) {
        const bx = x + w + t * PX * 0.9;
        const by = y + h + Math.sin(t * 0.22) * PX * 6 + t * 0.4;
        if (bx > x + w + PX * 26) break;
        if (hash(bx, by, 169) < 0.12) continue;
        const light = Math.floor(t / 2) % 2 === 0;
        dot(ctx, bx, by, light ? '#b08a1e' : '#1c1917');
        dot(ctx, bx, by + PX, light ? '#8c6d17' : '#231f1d');
    }
}

// Çöken cepheden dökülen moloz yığını
function drawRubble(ctx, pile) {
    const { x, y, w, h } = pile;
    for (let py = y; py < y + h; py += PX) {
        for (let px = x; px < x + w; px += PX) {
            const t = (py - y) / h;
            const halfW = (w / 2) * (1 - t * 0.35);
            if (Math.abs(px - (x + w / 2)) > halfW) continue;
            if (hash(px, py, 171) < 0.12) continue;
            const r = hash(px, py, 173);
            ctx.fillStyle = r < 0.3 ? '#59524a' : r < 0.6 ? '#6d6459' : r < 0.85 ? '#807668' : '#3f3a34';
            ctx.fillRect(px, py, PX, PX);
        }
    }
    // Molozun içinden çıkan demir çubuklar
    for (let i = 0; i < 3; i++) {
        const bx = x + PX * 2 + hash(i, 0, 177) * (w - PX * 4);
        const by = y + h - PX;
        const dir = hash(i, 1, 179) < 0.5 ? 1 : -1;
        for (let s = 0; s < 5; s++) {
            dot(ctx, bx + s * PX * dir, by - s * PX * 2, '#7a6a52');
        }
    }
}

// Kaçarken sokağa bırakılanlar: bavul, kutu, çanta, devrilmiş sandalye
function drawLitter(ctx) {
    const items = [
        { x: 96, y: 318, w: PX * 7, h: PX * 5, body: '#6b4a2f', trim: '#3f2b1b' },
        { x: 352, y: 176, w: PX * 6, h: PX * 5, body: '#8a7350', trim: '#5c4c33' },
        { x: 606, y: 322, w: PX * 6, h: PX * 4, body: '#4a5568', trim: '#2f3745' },
        { x: 470, y: 172, w: PX * 5, h: PX * 6, body: '#7a3f3f', trim: '#4d2727' }
    ];
    for (const it of items) {
        ctx.globalAlpha = 0.25;
        blk(ctx, it.x - PX, it.y + it.h, it.w + PX * 2, PX, '#000000');
        ctx.globalAlpha = 1;
        blk(ctx, it.x, it.y, it.w, it.h, it.body);
        blk(ctx, it.x, it.y, it.w, PX, it.trim);
        blk(ctx, it.x, it.y + it.h - PX, it.w, PX, it.trim);
        blk(ctx, it.x + it.w / 2 - PX, it.y - PX, PX * 2, PX, it.trim);
    }
    // Savrulmuş kağıtlar: yerdeki duyurular, tahlil kağıtları
    for (let i = 0; i < 46; i++) {
        const px = hash(i, 0, 181) * CITY.edgeX;
        const py = CITY.walk.top + hash(i, 1, 183) * (CITY.walk.bottom - CITY.walk.top);
        dot(ctx, px, py, '#b8b2a4');
        if (hash(i, 2, 187) < 0.5) dot(ctx, px + PX, py, '#9d978a');
    }
}

// Virüsün izi: rögardan çıkıp ormana giden ıslak yeşil lekeler ve duvar
// dibinde kurumuş salgı. Yazı yok - hikâye yalnızca burada duruyor.
function drawVirusTrail(ctx) {
    const from = { x: MANHOLE.x + MANHOLE.w / 2, y: MANHOLE.y + MANHOLE.h };
    const to = { x: GAP.x0 + 40, y: (GAP.top + GAP.bottom) / 2 };
    for (let t = 0; t <= 1; t += 0.006) {
        const cx = from.x + (to.x - from.x) * t + Math.sin(t * 9) * 14;
        const cy = from.y + (to.y - from.y) * t + Math.cos(t * 7) * 10;
        const r = 10 - t * 4;
        for (let y = cy - r; y <= cy + r; y += PX) {
            for (let x = cx - r; x <= cx + r; x += PX) {
                if (Math.hypot(x - cx, (y - cy) * 1.5) > r) continue;
                if (hash(x, y, 191) > 0.16) continue;
                dot(ctx, x, y, VIRUS[Math.floor(hash(x, y, 193) * VIRUS.length)]);
                if (hash(x, y, 197) < 0.06) dot(ctx, x, y - PX, VIRUS_HI);
            }
        }
    }
    // Duvar diplerinde kurumuş salgı birikintileri
    for (const [bx, by, r] of [[240, 168, 26], [520, 166, 20], [176, 296, 18]]) {
        for (let y = by - r; y <= by + r; y += PX) {
            for (let x = bx - r; x <= bx + r; x += PX) {
                const d = Math.hypot((x - bx) / r, (y - by) / (r * 0.6));
                if (d > 1 || hash(x, y, 199) > 0.5 - d * 0.35) continue;
                dot(ctx, x, y, VIRUS[Math.floor(hash(x, y, 211) * VIRUS.length)]);
            }
        }
    }
}

// Şehrin üstüne is perdesi: solda ağır, ormana doğru açılır. Sahnenin
// "burası ölü, orası hâlâ canlı" duygusu buradan geliyor.
function gradeCity(ctx) {
    const end = FOREST.x0 + 160;
    for (let x = 0; x < end; x += PX * 2) {
        const t = Math.min(1, Math.max(0, (x - 220) / (end - 220)));
        const alpha = 0.30 * (1 - t);
        if (alpha <= 0.005) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#0b1020';
        ctx.fillRect(x, 0, PX * 2, WORLD.h);
    }
    ctx.globalAlpha = 1;
}

// Tek bir yıkık bina cephesi: çatlak duvar, kırık/tahtalanmış camlar, is
// izleri, çöken çatı köşesi ve yırtık duyuru afişleri.
function drawBuilding(ctx, x0, y0, w, h, style, seed) {
    const x1 = x0 + w;
    const y1 = y0 + h;

    for (let y = y0; y < y1; y += PX) {
        for (let x = Math.max(0, x0); x < x1; x += PX) {
            const rel = (x - x0) / w;
            let tone = style.wall;
            if (rel < 0.06) tone = style.light;
            else if (rel > 0.9) tone = style.dark;
            if (hash(x, y, 67) < 0.14) tone = style.dark;
            if (hash(x, y, 213) < 0.05) tone = SOOT[Math.floor(hash(x, y, 217) * SOOT.length)];
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Duvar çatlakları: üstten aşağı inen ince kırıklar
    for (let i = 0; i < 3; i++) {
        let cx = x0 + PX * 3 + hash(seed, i, 219) * (w - PX * 6);
        let cy = y0;
        const len = 10 + hash(seed, i, 221) * 18;
        for (let s = 0; s < len; s++) {
            if (cy > y1) break;
            if (cx > 0) {
                dot(ctx, cx, cy, style.dark);
                if (hash(cx, cy, 223) < 0.4) dot(ctx, cx + PX, cy, SOOT[0]);
            }
            cx += (hash(seed, s, 227) - 0.5) * 6;
            cy += PX * 1.5;
        }
    }

    // Çatı bandı ve saçak gölgesi
    blk(ctx, Math.max(0, x0 - PX), y0 - PX * 2, w + PX * 2, PX * 3, style.roof);
    blk(ctx, Math.max(0, x0), y1 - PX * 2, w, PX * 2, style.roof);

    // Bazı binaların üst köşesi çökmüş: çatı hattından bir ısırık alınır ve
    // kırık kenarda çentikli beton kalır.
    if (hash(seed, 0, 229) < 0.5) {
        const fromLeft = hash(seed, 1, 231) < 0.5;
        const biteW = PX * (7 + Math.floor(hash(seed, 2, 233) * 7));
        for (let i = 0; i < biteW; i += PX) {
            const bx = fromLeft ? x0 + i : x1 - biteW + i;
            if (bx < 0) continue;
            const ramp = fromLeft ? 1 - i / biteW : i / biteW;
            const depth = PX * 3 + Math.round(ramp * (4 + hash(bx, 0, 237) * 5)) * PX;
            for (let y = y0 - PX * 2; y < y0 + depth; y += PX) {
                ctx.fillStyle = skyTone(bx, y);
                ctx.fillRect(bx, y, PX, PX);
            }
            dot(ctx, bx, y0 + depth, style.dark);
            if (hash(bx, 1, 239) < 0.4) dot(ctx, bx, y0 + depth - PX, style.light);
        }
    }

    // Pencereler: kırık, tahtalanmış ya da kapkaranlık. Işık yok - şehirde
    // elektrik kalmadı. Nadiren camın ardında hastalıklı yeşil bir parıltı var.
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
            const roll = hash(seed * 7 + c, r, 71);
            blk(ctx, wx - PX, wy - PX, winW + PX * 2, winH + PX * 2, style.roof);
            blk(ctx, wx, wy, winW, winH, '#14161c');

            if (roll < 0.36) {
                // Kırık cam: kenarlarda kalan sivri parçalar + is izi
                for (let x = wx; x < wx + winW; x += PX) {
                    if (hash(x, wy, 241) < 0.55) dot(ctx, x, wy, '#5b6570');
                    if (hash(x, wy, 243) < 0.35) dot(ctx, x, wy + winH - PX, '#454e57');
                }
                dot(ctx, wx, wy + PX, '#5b6570');
                dot(ctx, wx + winW - PX, wy + PX * 2, '#5b6570');
                for (let y = wy - PX; y > wy - PX * 5; y -= PX) {
                    for (let x = wx; x < wx + winW; x += PX) {
                        if (hash(x, y, 247) > 0.35) continue;
                        dot(ctx, x, y, SOOT[Math.floor(hash(x, y, 251) * SOOT.length)]);
                    }
                }
            } else if (roll < 0.62) {
                // Tahtalanmış: içeriden çakılmış kalaslar
                for (let i = 0; i < winW; i += PX * 3) {
                    blk(ctx, wx + i, wy, PX * 2, winH, '#5a452c');
                }
                blk(ctx, wx - PX, wy + winH / 2 - PX, winW + PX * 2, PX * 2, '#6b5334');
            } else if (roll < 0.68) {
                // Hasta yeşil parıltı
                blk(ctx, wx, wy, winW, winH, '#2c3a1e');
                blk(ctx, wx + PX, wy + PX, winW - PX * 2, winH - PX * 2, '#4a6320');
                dot(ctx, wx + PX * 2, wy + PX, VIRUS[0]);
            } else {
                dot(ctx, wx + PX, wy + PX, '#1e222a');
            }
        }
    }

    // Giriş: kapı kırılmış, kanadı yana yatmış, tabelası sönmüş
    const doorW = PX * 8;
    const doorX = x0 + w / 2 - doorW / 2;
    if (doorX > 0) {
        blk(ctx, doorX - PX, y1 - PX * 9, doorW + PX * 2, PX * 9, style.roof);
        blk(ctx, doorX, y1 - PX * 8, doorW, PX * 8, '#0e0e12');
        blk(ctx, doorX + doorW, y1 - PX * 6, PX * 3, PX * 6, '#4a3a28');
        blk(ctx, doorX - PX * 2, y1 - PX * 12, doorW + PX * 4, PX * 3, '#3a3f4a');
        dot(ctx, doorX + PX, y1 - PX * 11, '#5b6570');
    }

    // Yırtık afişler: kan tahlili çağrısı ve aşı kuyruğu duyurusu. Okunmaz,
    // yalnızca kırmızı haç ve şerit halinde metin görünür.
    if (hash(seed, 3, 253) < 0.75) {
        const px = x0 + PX * (3 + Math.floor(hash(seed, 4, 257) * 6));
        const py = y1 - PX * 17;
        if (px > 0) drawPoster(ctx, px, py, hash(seed, 5, 259) < 0.5);
    }
}

// Duvara yapıştırılmış, alt kenarı yırtılmış duyuru afişi
function drawPoster(ctx, x, y, cross) {
    const w = PX * 7;
    const h = PX * 9;
    // Kağıt aylardır orada: sararmış, islenmiş, yer yer kabarmış
    for (let py = y; py < y + h; py += PX) {
        const tornRow = py > y + h - PX * 3;
        for (let px = x; px < x + w; px += PX) {
            if (tornRow && hash(px, py, 261) < 0.5) continue;
            const r = hash(px, py, 263);
            ctx.fillStyle = r < 0.18 ? '#6f6a5c' : r < 0.42 ? '#8d8776' : '#a49d8a';
            ctx.fillRect(px, py, PX, PX);
        }
    }
    if (cross) {
        blk(ctx, x + PX * 3, y + PX, PX, PX * 5, '#8f2020');
        blk(ctx, x + PX, y + PX * 3, PX * 5, PX, '#8f2020');
    } else {
        // Duyuru metni: okunmaz, kopuk şeritler halinde
        for (let i = 0; i < 3; i++) {
            const rowY = y + PX + i * PX * 2;
            const inset = PX * (i === 1 ? 2 : 1);
            blk(ctx, x + inset, rowY, w - inset * 2, PX, '#3f4650');
        }
    }
    blk(ctx, x, y + PX * 6, w, PX, '#5e594e');
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

// --- Kurumuş ağaç ---
// Şehrin park şeridindeki ağaçlar da ölmüş. Ayrı bir ağaç çizimi yazmak yerine
// hazır sprite'ın yeşilleri kuru sarı-kahveye çevrilir; böylece src/pixel/trees.js
// ortak kalır. Kaynak canvas başına bir kez hesaplanır.
const witherCache = new Map();

export function witherCanvas(source) {
    const cached = witherCache.get(source);
    if (cached) return cached;

    const { canvas, ctx } = newCanvas(source.width, source.height);
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (g > r + 8 && g > b + 8) {
            // Yaprak yeşili -> ölü kahve. Sonbahar sarısı OLMAMALI: ağaç
            // renk değiştirmiş değil, kurumuş.
            d[i] = Math.round(g * 0.42 + 16);
            d[i + 1] = Math.round(g * 0.33 + 10);
            d[i + 2] = Math.round(g * 0.16);
        } else {                                      // gövde ve gölge: kararsın
            d[i] = Math.round(r * 0.70);
            d[i + 1] = Math.round(g * 0.68);
            d[i + 2] = Math.round(b * 0.72);
        }
    }
    ctx.putImageData(image, 0, 0);
    witherCache.set(source, canvas);
    return canvas;
}

// --- Sokak lambası (derinlik sırasına giren nesne) ---
// Harabede lambalar sönük: gövde paslı, kimi kol aşağı sarkmış, ampul kırık.

const lampCache = {};

export function lampSprite(variant = 0) {
    if (lampCache[variant]) return lampCache[variant];
    const w = PX * 12;
    const h = PX * 26;
    const { canvas, ctx } = newCanvas(w, h);
    const baseX = w / 2;
    const bent = variant % 2 === 1;

    blk(ctx, baseX - PX * 3, h - PX * 3, PX * 6, PX * 3, '#33333a');
    blk(ctx, baseX - PX * 2, h - PX * 4, PX * 4, PX, '#45454d');
    for (let y = h - PX * 4; y > PX * 4; y -= PX) {
        const rust = hash(baseX, y, 267) < 0.25;
        blk(ctx, baseX - PX, y, PX, PX, rust ? RUST[0] : '#5c6270');
        blk(ctx, baseX, y, PX, PX, rust ? RUST[2] : '#33333a');
    }
    if (bent) {
        // Kol aşağı sarkmış, lamba başı kırık
        blk(ctx, baseX - PX, PX * 4, PX * 4, PX, '#45454d');
        blk(ctx, baseX + PX * 2, PX * 5, PX, PX * 3, '#45454d');
        blk(ctx, baseX + PX * 2, PX * 8, PX * 3, PX * 2, '#26262c');
        dot(ctx, baseX + PX * 3, PX * 10, '#5c6270');
    } else {
        blk(ctx, baseX - PX, PX * 4, PX * 5, PX, '#45454d');
        blk(ctx, baseX + PX * 3, PX * 4, PX * 3, PX * 3, '#33333a');
        blk(ctx, baseX + PX * 3, PX * 6, PX * 3, PX, '#3f3f2a');   // sönmüş ampul
    }

    lampCache[variant] = { canvas, ox: baseX, oy: h };
    return lampCache[variant];
}

// --- Terk edilmiş araçlar ---
// Aracın (x,y,w,h) kutusu yerdeki ayak izidir; sprite bunun üstüne gövdeyi
// çizer. Dönen x/y sahnedeki çizim köşesi, baseY derinlik sırası içindir.

const wreckCache = {};

export function wreckSprite(wreck) {
    const key = `${wreck.kind}:${wreck.x}`;
    if (wreckCache[key]) return wreckCache[key];

    const w = wreck.w;
    const bodyH = wreck.kind === 'van' ? PX * 13 : PX * 10;
    const h = wreck.h + bodyH;
    const { canvas, ctx } = newCanvas(w, h);
    const burnt = wreck.kind === 'burnt';

    const paints = [
        { body: '#8f3f3a', dark: '#5f2926', light: '#b0554e' },
        { body: '#3f5a8f', dark: '#2a3c60', light: '#5a78ad' },
        // Yanmış: boyası gitmiş, çıplak sac. Asfalttan ayrışacak kadar açık
        // olmalı, yoksa yol üstünde tanımsız bir leke gibi duruyor.
        { body: '#635b51', dark: '#39342f', light: '#7d7368' }
    ];
    const paint = burnt ? paints[2] : paints[wreck.tone % 2];

    const groundY = h - PX * 2;
    const bodyY = groundY - bodyH;
    const cabinH = PX * 5;

    // Yerdeki gölge: ince tutulur. Kalın olunca araç asfaltta bir çukurun
    // üstünde duruyormuş gibi görünüyor.
    ctx.globalAlpha = 0.22;
    blk(ctx, PX * 2, groundY + PX, w - PX * 4, PX, '#000000');
    ctx.globalAlpha = 1;

    // Gövde
    blk(ctx, 0, bodyY + cabinH, w, bodyH - cabinH, paint.body);
    blk(ctx, 0, bodyY + cabinH, w, PX, paint.light);
    blk(ctx, 0, groundY - PX * 2, w, PX * 2, paint.dark);

    // Kabin: sedanda ortada, minibüste geniş ve yüksek
    const cabX = wreck.kind === 'van' ? PX * 4 : PX * 7;
    const cabW = wreck.kind === 'van' ? w - PX * 8 : w - PX * 16;
    blk(ctx, cabX, bodyY, cabW, cabinH + PX, paint.body);
    blk(ctx, cabX, bodyY, cabW, PX, paint.light);

    // Camlar: hepsi kırık - içerisi karanlık, kenarda cam parçaları
    blk(ctx, cabX + PX, bodyY + PX, cabW - PX * 2, cabinH - PX, '#0e0f12');
    for (let x = cabX + PX; x < cabX + cabW - PX; x += PX) {
        if (hash(x, bodyY, 271) < 0.45) dot(ctx, x, bodyY + PX, '#5b6570');
        if (hash(x, bodyY, 273) < 0.30) dot(ctx, x, bodyY + cabinH - PX, '#454e57');
    }

    // Farlar ve kapı çizgisi
    blk(ctx, w - PX * 2, bodyY + cabinH + PX * 2, PX * 2, PX * 2, burnt ? '#2a2724' : '#9aa0a8');
    blk(ctx, 0, bodyY + cabinH + PX * 2, PX * 2, PX * 2, burnt ? '#2a2724' : '#7a2a24');
    blk(ctx, cabX + cabW / 2, bodyY + cabinH, PX, bodyH - cabinH - PX * 2, paint.dark);

    // Pas, is ve kir. Serpiştirme seyrek: yoğunlaşınca kaporta konfetiye
    // dönüyor ve aracın şekli kayboluyor.
    for (let y = bodyY; y < groundY; y += PX) {
        for (let x = 0; x < w; x += PX) {
            const r = hash(x, y, 277);
            if (burnt) {
                if (r < 0.07) dot(ctx, x, y, SOOT[Math.floor(hash(x, y, 279) * SOOT.length)]);
                else if (r < 0.12) dot(ctx, x, y, RUST[Math.floor(hash(x, y, 281) * RUST.length)]);
                else if (r < 0.20) dot(ctx, x, y, paint.dark);
            } else if (r < 0.08) {
                dot(ctx, x, y, RUST[Math.floor(hash(x, y, 283) * RUST.length)]);
            } else if (r < 0.12) {
                dot(ctx, x, y, paint.dark);
            }
        }
    }

    // Yanmış araçta tavanın ön ucu çökmüş (ince bir bant, tümü değil)
    if (burnt) {
        for (let x = cabX; x < cabX + cabW / 2; x += PX) {
            if (hash(x, 0, 287) < 0.5) blk(ctx, x, bodyY, PX, PX, '#0e0f12');
        }
    }

    // Dış hat en son çizilir: kir yemesin. Asfalt da koyu olduğu için araç
    // bu çerçeve olmadan zemine yapışıyor.
    const outline = '#131315';
    blk(ctx, 0, bodyY + cabinH, PX, bodyH - cabinH, outline);
    blk(ctx, w - PX, bodyY + cabinH, PX, bodyH - cabinH, outline);
    blk(ctx, 0, groundY - PX, w, PX, outline);
    blk(ctx, cabX, bodyY, PX, cabinH + PX, outline);
    blk(ctx, cabX + cabW - PX, bodyY, PX, cabinH + PX, outline);
    blk(ctx, cabX, bodyY, cabW, PX, outline);

    // Tekerlekler en sonda: eşiğin altından taşsınlar, yoksa gövde örtüyor.
    // Yanmış araçta arka lastik patlamış, o köşe yere oturmuş.
    [PX * 3, w - PX * 9].forEach((wx, i) => {
        const flat = burnt && i === 1;
        const top = groundY - (flat ? PX : PX * 3);
        const height = flat ? PX * 3 : PX * 5;
        blk(ctx, wx, top, PX * 6, height, '#26262c');
        blk(ctx, wx, top, PX * 6, PX, '#3d3d46');          // lastiğin üst kenarı
        if (flat) return;
        blk(ctx, wx + PX * 2, top + PX * 2, PX * 2, PX * 2, '#6a6a76');   // jant
    });

    const sprite = { canvas, x: wreck.x, y: wreck.y + wreck.h - h, baseY: wreck.y + wreck.h };
    wreckCache[key] = sprite;
    return sprite;
}

// Mekan adı kartı artık ortak: src/pixel/screenText.js
