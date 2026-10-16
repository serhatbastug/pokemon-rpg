// Araba sahnesinin piksel sprite'ları: araba, terk edilmiş arabalar, enkaz ve
// binalar. Hepsi ana ekrandaki gibi 4 birimlik pikselle (PX) bir kez
// offscreen canvas'a çizilir; sahne yalnızca ölçekleyip basar.
//
// Çizimde "gx, gy" piksel ızgarasıdır (1 birim = 4 ekran birimi).

import { PX, newCanvas, hash } from '../pixel/pixelDraw.js';

const g = (ctx, gx, gy, gw, gh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(gx * PX, gy * PX, gw * PX, gh * PX);
};

// Bir arabanın arkadan görünüşü. 44x32 piksel.
function paintCar(ctx, { body, hi, lo, glass, brake, van = false, wreck = false, plate = true, seed = 0 }) {
    // Yer gölgesi
    ctx.globalAlpha = 0.4;
    g(ctx, 1, 29, 42, 3, '#000');
    ctx.globalAlpha = 1;
    // Tekerlekler
    for (const gx of [3, 35]) {
        g(ctx, gx, 24, 6, 7, '#0c0c0e');
        g(ctx, gx, 24, 6, 1, '#2a2a30');
        if (wreck && gx === 35) g(ctx, gx + 1, 27, 4, 3, '#1a1a1e');
    }
    if (van) {
        // Kutu gövde
        g(ctx, 3, 2, 38, 24, body);
        g(ctx, 3, 2, 38, 2, hi);
        g(ctx, 3, 24, 38, 2, lo);
        g(ctx, 3, 2, 2, 24, hi);
        g(ctx, 39, 2, 2, 24, lo);
        // Arka kapı çizgisi ve camlar
        g(ctx, 21, 5, 2, 17, lo);
        g(ctx, 7, 6, 12, 8, glass);
        g(ctx, 25, 6, 12, 8, glass);
        g(ctx, 7, 6, 12, 1, '#ffffff22');
        g(ctx, 9, 8, 3, 1, '#ffffff22');
        g(ctx, 27, 8, 3, 1, '#ffffff22');
        g(ctx, 19, 16, 1, 3, '#2a2a30');
        g(ctx, 23, 16, 1, 3, '#2a2a30');
    } else {
        // Alt gövde
        g(ctx, 2, 15, 40, 11, body);
        g(ctx, 2, 15, 40, 1, hi);
        g(ctx, 2, 24, 40, 2, lo);
        // Kabin
        g(ctx, 8, 3, 28, 13, body);
        g(ctx, 8, 3, 28, 1, hi);
        g(ctx, 9, 2, 26, 1, hi);
        g(ctx, 8, 3, 1, 13, hi);
        g(ctx, 35, 3, 1, 13, lo);
        // Arka cam: yansıma çizgileri ve koltuk başlıkları
        g(ctx, 10, 5, 24, 9, glass);
        g(ctx, 12, 6, 6, 1, '#ffffff2a');
        g(ctx, 11, 8, 4, 1, '#ffffff2a');
        g(ctx, 15, 11, 4, 3, '#0a1118');
        g(ctx, 25, 11, 4, 3, '#0a1118');
        // Yan aynalar
        g(ctx, 5, 8, 3, 3, lo);
        g(ctx, 36, 8, 3, 3, lo);
        // Bagaj çizgisi ve kolu
        g(ctx, 12, 19, 20, 1, lo);
        g(ctx, 21, 20, 2, 1, '#aab4b8');
    }
    // Tampon
    g(ctx, 1, 25, 42, 3, '#2b3340');
    g(ctx, 1, 25, 42, 1, '#566070');
    g(ctx, 6, 27, 6, 1, '#ff3030');
    g(ctx, 32, 27, 6, 1, '#ff3030');
    // Stop lambaları
    for (const gx of [3, 33]) {
        g(ctx, gx, 16, 8, 5, brake[0]);
        g(ctx, gx + 1, 17, 6, 2, brake[1]);
        g(ctx, gx, 16, 8, 1, brake[2]);
    }
    if (plate) {
        g(ctx, 17, 21, 10, 4, '#e8e8d0');
        g(ctx, 18, 22, 1, 2, '#33333a');
        g(ctx, 20, 22, 1, 2, '#33333a');
        g(ctx, 22, 22, 2, 2, '#33333a');
        g(ctx, 25, 22, 1, 2, '#33333a');
    }
    // Egzoz
    g(ctx, 31, 28, 3, 2, '#17171a');
    if (wreck) {
        // Çatlak cam, göçük ve pas lekeleri
        g(ctx, 14, 6, 1, 1, '#9fb0b8');
        g(ctx, 15, 7, 1, 1, '#9fb0b8');
        g(ctx, 16, 8, 1, 2, '#9fb0b8');
        g(ctx, 13, 9, 3, 1, '#9fb0b8');
        for (let i = 0; i < 9; i++) {
            const gx = 3 + Math.floor(hash(seed, i, 1) * 38), gy = 15 + Math.floor(hash(seed, i, 2) * 10);
            g(ctx, gx, gy, 2, 1, '#6a4a30');
        }
        g(ctx, 36, 17, 4, 1, '#14181c');
    }
}

const CAR_COLORS = [
    { body: '#8a2f2f', hi: '#b84a4a', lo: '#5e1d1d' },
    { body: '#3f6b4c', hi: '#5f9670', lo: '#294a33' },
    { body: '#8a7430', hi: '#b8a050', lo: '#5e4e1c' },
    { body: '#57577e', hi: '#7c7ca8', lo: '#3a3a58' },
    { body: '#8a8d92', hi: '#b4b8bd', lo: '#5e6166' }
];

const DEAD_LIGHTS = ['#5a2626', '#3a1818', '#7a3a3a'];

// Oyuncunun arabası: iki hali (normal ve fren)
function bakePlayerCars() {
    const mk = (brake) => {
        const { canvas, ctx } = newCanvas(44 * PX, 32 * PX);
        paintCar(ctx, { body: '#3f6a96', hi: '#6d9bc9', lo: '#2b4a6c', glass: '#0f1822', brake });
        // Anten
        g(ctx, 34, 0, 1, 3, '#2a2a30');
        return canvas;
    };
    return {
        normal: mk(['#b02828', '#e03a3a', '#f06a5a']),
        brake: mk(['#e03030', '#ff7a6a', '#ffd0c0'])
    };
}

// Yol kenarındaki terk edilmiş arabalar: 5 renk x (araba, minibüs)
function bakeWrecks() {
    const list = [];
    CAR_COLORS.forEach((c, i) => {
        for (const van of [false, true]) {
            const { canvas, ctx } = newCanvas(44 * PX, 32 * PX);
            paintCar(ctx, { ...c, glass: '#121a22', brake: DEAD_LIGHTS, van, wreck: true, seed: i * 2 + (van ? 1 : 0) });
            list.push(canvas);
        }
    });
    return list;
}

// Enkaz yığını: yıkık beton levhalar, pas rengi demirler, toz
function bakeRubble() {
    const list = [];
    for (let v = 0; v < 3; v++) {
        const { canvas, ctx } = newCanvas(40 * PX, 22 * PX);
        ctx.globalAlpha = 0.35;
        g(ctx, 1, 19, 38, 3, '#000');
        ctx.globalAlpha = 1;
        // Levhalar: arkadan öne
        const slabs = 7 + v;
        for (let i = 0; i < slabs; i++) {
            const w = 7 + Math.floor(hash(v, i, 1) * 9);
            const h = 4 + Math.floor(hash(v, i, 2) * 8);
            const x = 2 + Math.floor(hash(v, i, 3) * (36 - w));
            const y = 18 - h - Math.floor(hash(v, i, 4) * 6) + (i > slabs / 2 ? 1 : 0);
            const lit = hash(v, i, 5) > 0.5;
            g(ctx, x, y, w, h, lit ? '#8e989e' : '#69747a');
            g(ctx, x, y, w, 1, '#b4bcc0');
            g(ctx, x, y, 1, h, '#a4adb2');
            g(ctx, x + w - 1, y, 1, h, '#454e54');
            g(ctx, x, y + h - 1, w, 1, '#3c444a');
            // Çatlak
            const cx = x + 2 + Math.floor(hash(v, i, 6) * (w - 4));
            g(ctx, cx, y + 1, 1, Math.max(1, h - 3), '#3c444a');
            // Açıkta kalmış demir
            if (hash(v, i, 7) > 0.55) {
                g(ctx, x + 1, y - 3, 1, 3, '#8a4a2a');
                g(ctx, x + 2, y - 4, 1, 2, '#6a3a22');
            }
        }
        // Küçük taş ve toz
        for (let i = 0; i < 12; i++) {
            const x = 1 + Math.floor(hash(v, i, 11) * 37);
            g(ctx, x, 18 + Math.floor(hash(v, i, 12) * 3), 2, 1, hash(v, i, 13) > 0.5 ? '#7b868c' : '#4f5a60');
        }
        ctx.globalAlpha = 0.18;
        g(ctx, 4, 12, 30, 8, '#c8c0b0');
        ctx.globalAlpha = 1;
        list.push(canvas);
    }
    return list;
}

// --- Binalar ---

const FACADES = [
    { wall: '#2e2447', lo: '#241b38', hi: '#3d3160', trim: '#4a3c70', roof: '#1c1530' },
    { wall: '#3a2a3a', lo: '#2c202c', hi: '#4c3a4c', trim: '#5a4658', roof: '#221822' },
    { wall: '#24304a', lo: '#1a2438', hi: '#32415f', trim: '#41537a', roof: '#141c2c' },
    { wall: '#3d3446', lo: '#2e2736', hi: '#4f445a', trim: '#605470', roof: '#241e2c' },
    { wall: '#2c3a3a', lo: '#202c2c', hi: '#3c4e4e', trim: '#4c6262', roof: '#182222' },
    { wall: '#4a3228', lo: '#382620', hi: '#5e4538', trim: '#725546', roof: '#2a1c16' }
];

function paintBuilding(ctx, v, cols, rows) {
    const f = FACADES[v % FACADES.length];
    const wallTop = 6;                        // çatı payı
    const wallH = rows - wallTop;
    // Duvar
    g(ctx, 0, wallTop, cols, wallH, f.wall);
    g(ctx, 0, wallTop, 2, wallH, f.hi);
    g(ctx, cols - 2, wallTop, 2, wallH, f.lo);
    // Tuğla/panel dokusu
    for (let y = wallTop + 1; y < rows - 12; y += 3) {
        for (let x = 2; x < cols - 2; x++) {
            if (hash(x, y, v) > 0.8) g(ctx, x, y, 1, 1, f.lo);
            else if (hash(x, y, v + 9) > 0.93) g(ctx, x, y, 1, 1, f.hi);
        }
    }
    // Pencere ızgarası: katlar arasında silme (kornişe)
    const floorH = 7;
    const winW = 4, winH = 4, gapX = 3;
    const perRow = Math.floor((cols - 6) / (winW + gapX));
    const padX = Math.floor((cols - (perRow * (winW + gapX) - gapX)) / 2);
    let fl = 0;
    for (let y = wallTop + 3; y + floorH < rows - 12; y += floorH, fl++) {
        for (let i = 0; i < perRow; i++) {
            const x = padX + i * (winW + gapX);
            const r = hash(i, fl, v * 3 + 1);
            let color, frame = f.lo;
            if (r > 0.62) color = hash(i, fl, 77) > 0.28 ? '#f2cc66' : '#9fe0ee';
            else if (r > 0.12) color = '#120d22';
            else color = '#3a2a22';          // tahta çakılı pencere
            g(ctx, x - 1, y - 1, winW + 2, winH + 2, frame);
            g(ctx, x, y, winW, winH, color);
            if (color === '#f2cc66' || color === '#9fe0ee') {
                g(ctx, x, y, winW, 1, '#ffffff55');
                if (hash(i, fl, 91) > 0.6) g(ctx, x + 1, y + 1, 2, 3, '#00000044');   // perde
            } else if (color === '#3a2a22') {
                g(ctx, x, y, winW, 1, '#5a4030');
                g(ctx, x, y + 2, winW, 1, '#5a4030');
            } else {
                g(ctx, x, y, 2, 1, '#2a2048');   // cam yansıması
            }
            // Pencere önü
            g(ctx, x - 1, y + winH + 1, winW + 2, 1, f.trim);
        }
        // Kat silmesi
        g(ctx, 0, y + floorH - 2, cols, 1, f.trim);
        g(ctx, 0, y + floorH - 1, cols, 1, f.lo);
    }
    // Yanık lekeleri ve sarkan kablolar
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 2; i++) {
        const sx = Math.floor(hash(v, i, 31) * (cols - 14)) + 3, sy = wallTop + 4 + Math.floor(hash(v, i, 32) * (wallH - 30));
        g(ctx, sx, sy, 8, 12, '#000');
    }
    ctx.globalAlpha = 1;
    // Zemin kat: dükkân vitrini, tente, kapı, neon tabela
    const shopY = rows - 11;
    g(ctx, 0, shopY, cols, 11, f.lo);
    g(ctx, 0, shopY, cols, 1, f.trim);
    const awn = ['#b83a3a', '#e8e0d0'];
    const shopW = Math.min(cols - 8, 36);
    const sx = 3 + Math.floor(hash(v, 5, 5) * (cols - shopW - 6));
    for (let x = 0; x < shopW; x += 2) g(ctx, sx + x, shopY + 1, 2, 3, awn[(x / 2) % 2]);
    g(ctx, sx, shopY + 4, shopW, 1, '#00000055');
    g(ctx, sx + 1, shopY + 5, shopW - 12, 5, '#0f1a22');
    g(ctx, sx + 1, shopY + 5, shopW - 12, 1, '#2a4a58');
    // Vitrinde ışık
    g(ctx, sx + 3, shopY + 7, 3, 2, '#f2cc66');
    // Kapı
    g(ctx, sx + shopW - 9, shopY + 5, 5, 6, '#14100c');
    g(ctx, sx + shopW - 9, shopY + 5, 5, 1, '#5a4030');
    // Neon
    const neon = ['#ff5aa8', '#5ae0ff', '#a0ff7a'][v % 3];
    g(ctx, sx + 2, shopY - 2, 10, 2, '#0c0c14');
    g(ctx, sx + 3, shopY - 2, 8, 1, neon);
    // Çatı: korkuluk, su deposu, antenler, klima
    g(ctx, 0, wallTop - 1, cols, 2, f.trim);
    g(ctx, 0, wallTop - 1, cols, 1, f.hi);
    g(ctx, 1, wallTop - 2, cols - 2, 1, f.roof);
    const kind = v % 3;
    if (kind === 0) {
        // Su deposu
        const tx = 4 + Math.floor(hash(v, 8, 8) * (cols - 16));
        g(ctx, tx, 0, 8, 4, '#4a3a2c');
        g(ctx, tx, 0, 8, 1, '#6a5640');
        g(ctx, tx + 1, 4, 1, 2, '#2a2018');
        g(ctx, tx + 6, 4, 1, 2, '#2a2018');
    } else if (kind === 1) {
        // Anten ve kırmızı uyarı ışığı
        const tx = 4 + Math.floor(hash(v, 9, 9) * (cols - 8));
        g(ctx, tx, -0, 1, 5, '#1c1c24');
        g(ctx, tx - 2, 2, 5, 1, '#1c1c24');
        g(ctx, tx, 0, 1, 1, '#ff3a3a');
    } else {
        // Klima üniteleri
        const tx = 3 + Math.floor(hash(v, 7, 7) * (cols - 16));
        g(ctx, tx, 2, 5, 3, '#7a8590');
        g(ctx, tx, 2, 5, 1, '#9aa5ae');
        g(ctx, tx + 7, 3, 4, 2, '#68737d');
    }
}

function bakeBuildings() {
    const sizes = [[56, 110], [64, 130], [52, 150], [72, 120], [60, 170], [80, 140]];
    return sizes.map(([cols, rows], v) => {
        const { canvas, ctx } = newCanvas(cols * PX, rows * PX);
        paintBuilding(ctx, v, cols, rows);
        return canvas;
    });
}

let cache = null;
export function driveArt() {
    if (!cache) {
        cache = {
            playerCar: bakePlayerCars(),
            wrecks: bakeWrecks(),
            rubble: bakeRubble(),
            buildings: bakeBuildings()
        };
    }
    return cache;
}
