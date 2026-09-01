// 2. BÖLÜM - ÇALIŞMA ALANI
//
// Yayılma yolunu biz buluyoruz. Anlatım yazıyla değil, DUVARDAKİ HARİTAYLA:
// vakalar tek tek iğnelenince ortaya bir hat çıkıyor, hat şehrin altındaki su
// şebekesi. Oyuncu cümleyi okumadan önce şekli görüyor.
//
// Bölümün sonunda aşı bulunuyor ve kolumuza giriyor. Aşının yalnızca
// GECİKTİRDİĞİNİ kimse bilmiyor - bu yüzden kimse söylemiyor.

import { PX, blk, hash } from '../../pixel/pixelDraw.js';
import { drawTrainer } from '../../world/trainerSprite.js';
import { drawFriend } from '../../adventure/people.js';
import {
    fill, vignette, darken, glow, tiledWall, drawJars, limb, drawArm,
    span, easeOut, gridLerp, bands, mix, BAND_COLOR
} from '../comicKit.js';

// Vakaların haritadaki yerleri: dağınık DEĞİL, bir hattın iki yanında.
// Sıra iğnelenme sırası; son ikisi hattın ucunu kapatıyor.
const CASES = [
    [0.22, 0.30], [0.31, 0.36], [0.27, 0.45], [0.38, 0.44],
    [0.45, 0.52], [0.41, 0.60], [0.52, 0.58], [0.58, 0.65],
    [0.55, 0.73], [0.66, 0.70], [0.71, 0.77], [0.78, 0.72]
];

// Duvara asılı şehir haritası: kâğıt, cadde ızgarası, nehir
function drawMapSheet(ctx, x, y, w, h) {
    blk(ctx, x - PX * 2, y - PX * 2, w + PX * 4, h + PX * 4, '#2b2f36');
    blk(ctx, x, y, w, h, '#ded6c0');
    blk(ctx, x, y, w, PX, '#f0e9d6');

    // Mahalle blokları
    for (let bx = x + PX * 4; bx < x + w - PX * 6; bx += PX * 13) {
        for (let by = y + PX * 4; by < y + h - PX * 6; by += PX * 11) {
            if (hash(bx, by, 31) < 0.22) continue;
            blk(ctx, bx, by, PX * 9, PX * 7, '#cdc4ab');
        }
    }
    // Caddeler
    for (let gx = x + PX * 13; gx < x + w; gx += PX * 13) blk(ctx, gx - PX * 2, y, PX * 2, h, '#c3b99e');
    for (let gy = y + PX * 11; gy < y + h; gy += PX * 11) blk(ctx, x, gy - PX * 2, w, PX * 2, '#c3b99e');
    // Nehir: hattın yanından geçer ama hat DEĞİL - kafa karıştırsın diye
    let rx = x + PX * 6;
    for (let ry = y; ry < y + h; ry += PX * 2) {
        rx += (hash(ry, 3, 7) - 0.45) * PX * 3;
        blk(ctx, rx, ry, PX * 3, PX * 2, '#9fb6bd');
    }
}

// Haritaya batırılmış iğne
function drawPin(ctx, x, y, fresh = false) {
    if (fresh) glow(ctx, x, y, PX * 12, 'rgba(255,255,255,ALPHA)', 0.5);
    blk(ctx, x - PX, y, PX * 2, PX * 5, '#6b2b22');
    blk(ctx, x - PX * 2, y - PX * 3, PX * 4, PX * 4, '#c8402f');
    blk(ctx, x - PX * 2, y - PX * 3, PX * 2, PX, '#e8705f');
}

// --- 1. Tezgahta tahliller ---
function workBench(ctx, A) {
    tiledWall(ctx, A.x, A.y, A.w, Math.round(A.h * 0.74), '#3d474f', '#2e363d');

    // Duvarda tahlil çıktıları ve bir saat
    for (let i = 0; i < 5; i++) {
        const nx = A.x + PX * 10 + i * PX * 30;
        const nh = PX * (14 + Math.floor(hash(i, 2, 9) * 8));
        blk(ctx, nx, A.y + PX * 10, PX * 20, nh, '#e6e0cd');
        for (let ly = A.y + PX * 14; ly < A.y + PX * 10 + nh - PX * 2; ly += PX * 3) {
            blk(ctx, nx + PX * 2, ly, PX * (9 + Math.floor(hash(nx, ly, 4) * 7)), PX, '#9a9484');
        }
    }
    const clockX = A.x + A.w - PX * 26;
    blk(ctx, clockX, A.y + PX * 12, PX * 16, PX * 16, '#20262c');
    blk(ctx, clockX + PX * 2, A.y + PX * 14, PX * 12, PX * 12, '#cfd6da');
    blk(ctx, clockX + PX * 7, A.y + PX * 16, PX * 2, PX * 5, '#20262c');
    blk(ctx, clockX + PX * 8, A.y + PX * 19, PX * 4, PX * 2, '#20262c');

    // İki kişi: solda biz, sağda arkadaş (kolunda bant)
    drawTrainer(ctx, 330, 372, 'down', false, 7);
    drawFriend(ctx, 700, 372, 'down', false, 7);

    // Tezgah önlerinde: bacakları kesiyor, kadraj yakın dursun
    const benchY = A.y + Math.round(A.h * 0.74 / PX) * PX;
    blk(ctx, A.x, benchY, A.w, PX * 5, '#98a0a6');
    blk(ctx, A.x, benchY + PX * 5, A.w, A.y + A.h - benchY, '#2f363d');
    blk(ctx, A.x, benchY + PX * 5, A.w, PX, '#1b2025');

    // Tezgah üstü: tüp sehpası, dosya yığını, iki tahlil kâğıdı
    drawJars(ctx, A.x + PX * 12, benchY, 6, 3);
    blk(ctx, A.x + A.w - PX * 60, benchY - PX * 8, PX * 26, PX * 8, '#e6e0cd');
    blk(ctx, A.x + A.w - PX * 58, benchY - PX * 11, PX * 26, PX * 8, '#f2ecd9');
    for (let ly = benchY - PX * 9; ly < benchY - PX * 4; ly += PX * 2) {
        blk(ctx, A.x + A.w - PX * 56, ly, PX * 18, PX, '#a49d8c');
    }

    vignette(ctx, 0.45);
}

// --- 2. Mikroskop görüntüsü: hücrenin İÇİ ---
function microscope(ctx, A) {
    fill(ctx, '#0c0f12');

    const cx = A.x + A.w / 2;
    const cy = A.y + Math.round(A.h * 0.62 / PX) * PX;
    const r = Math.round(A.h * 0.36 / PX) * PX;

    // Yuvarlak görüş alanı: piksel ızgarasına oturan daire
    for (let y = cy - r; y <= cy + r; y += PX) {
        const half = Math.round(Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))) / PX) * PX;
        if (half <= 0) continue;
        blk(ctx, cx - half, y, half * 2, PX, '#cfe0d2');
        // Doku
        for (let x = cx - half; x < cx + half; x += PX) {
            if (hash(x, y, 17) < 0.18) blk(ctx, x, y, PX, PX, '#bcd0c0');
        }
    }

    // Hücreler: yuvarlak lekeler. Biri hariç hepsi temiz.
    const CELLS = [[-0.45, -0.30], [0.25, -0.42], [0.52, 0.10], [-0.30, 0.40], [0.10, 0.05], [-0.62, 0.18]];
    CELLS.forEach(([ox, oy], i) => {
        const px = cx + ox * r;
        const py = cy + oy * r;
        const cr = PX * (7 + Math.floor(hash(i, 5, 2) * 4));
        for (let y = py - cr; y <= py + cr; y += PX) {
            const half = Math.round(Math.sqrt(Math.max(0, cr * cr - (y - py) * (y - py))) / PX) * PX;
            if (half <= 0) continue;
            blk(ctx, px - half, y, half * 2, PX, i === 4 ? '#9ab89e' : '#a8c4ac');
        }
        blk(ctx, px - PX * 2, py - PX * 2, PX * 4, PX * 4, '#7d9a83');

        // İÇİNDE olan: yeşil iplikçikler yalnızca bir hücrede
        if (i !== 4) return;
        for (let k = 0; k < 5; k++) {
            const ang = k * 1.25;
            limb(ctx, px, py, px + Math.cos(ang) * cr * 0.9, py + Math.sin(ang) * cr * 0.9, PX, '#5fbf35');
        }
        glow(ctx, px, py, cr * 2.4, 'rgba(120,220,80,ALPHA)', 0.4);
    });

    // Merceğin kenarı
    for (let y = cy - r - PX * 3; y <= cy + r + PX * 3; y += PX) {
        const half = Math.round(Math.sqrt(Math.max(0, (r + PX * 3) * (r + PX * 3) - (y - cy) * (y - cy))) / PX) * PX;
        const inner = Math.round(Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))) / PX) * PX;
        if (half <= inner) continue;
        blk(ctx, cx - half, y, half - inner, PX, '#20262b');
        blk(ctx, cx + inner, y, half - inner, PX, '#20262b');
    }
    vignette(ctx, 0.6);
}

// --- 3. HAREKETLİ: vakalar haritaya iğneleniyor ---
function cityMap(ctx, A, t) {
    tiledWall(ctx, A.x, A.y, A.w, A.h, '#39424b', '#2b3238');
    darken(ctx, 0.18);

    const mx = A.x + PX * 26;
    const my = A.y + PX * 22;
    const mw = A.w - PX * 52;
    const mh = A.h - PX * 44;
    drawMapSheet(ctx, mx, my, mw, mh);

    const shown = Math.floor(easeOut(t) * CASES.length + 0.001);
    for (let i = 0; i < Math.min(shown, CASES.length); i++) {
        const [fx, fy] = CASES[i];
        drawPin(ctx, mx + mw * fx, my + mh * fy, i === shown - 1 && t < 0.98);
    }

    glow(ctx, mx + mw / 2, my + mh / 2, mw * 0.55, 'rgba(250,240,210,ALPHA)', 0.10);
    vignette(ctx, 0.5);
}

// --- 4. Hat görünüyor: iğneler şebekeyi çiziyor ---
function mapLine(ctx, A) {
    tiledWall(ctx, A.x, A.y, A.w, A.h, '#39424b', '#2b3238');
    darken(ctx, 0.2);

    // Harita yakın plan: kadrajın alt üçte ikisi (üstü balona kalıyor)
    const mx = A.x + PX * 18;
    const my = A.y + Math.round(A.h * 0.30 / PX) * PX;
    const mw = A.w - PX * 36;
    const mh = A.h - (my - A.y) - PX * 14;
    drawMapSheet(ctx, mx, my, mw, mh);

    // Şebeke: iğnelerin altından geçen kesik mavi hat
    for (let i = 0; i < CASES.length - 1; i++) {
        const [ax, ay] = CASES[i];
        const [bx, by] = CASES[i + 1];
        if (i % 2 === 0) {
            limb(ctx, mx + mw * ax, my + mh * ay, mx + mw * bx, my + mh * by, PX * 3, '#3f6f8f');
        }
    }
    for (const [fx, fy] of CASES) drawPin(ctx, mx + mw * fx, my + mh * fy);

    // Hattın ucundaki rögar işareti: 4. bölümde ineceğimiz yer
    const ex = mx + mw * CASES[CASES.length - 1][0];
    const ey = my + mh * CASES[CASES.length - 1][1];
    blk(ctx, ex + PX * 4, ey - PX * 2, PX * 7, PX * 7, '#2f363d');
    blk(ctx, ex + PX * 5, ey - PX, PX * 5, PX * 5, '#4b545c');

    glow(ctx, mx + mw * 0.5, my + mh * 0.55, mw * 0.5, 'rgba(80,160,220,ALPHA)', 0.12);
    vignette(ctx, 0.55);
}

// --- 5. Aşı kuyruğu: sıra bize geliyor ---
function vaccineLine(ctx, A) {
    tiledWall(ctx, A.x, A.y, A.w, A.h, '#414a52', '#323a41');

    // Solda pencere: dışarıda kuyruk
    const wx = A.x + PX * 12;
    const wy = A.y + PX * 16;
    const ww = Math.round(A.w * 0.44 / PX) * PX;
    const wh = Math.round(A.h * 0.56 / PX) * PX;
    blk(ctx, wx - PX * 3, wy - PX * 3, ww + PX * 6, wh + PX * 6, '#232a30');
    bands(ctx, wx, wy, ww, wh, '#8e9aa6', '#c3ccd2', 6);

    // Kuyruk: sokağın ucunu dönen küçük siluetler
    const streetY = wy + wh - PX * 6;
    blk(ctx, wx, streetY, ww, PX * 6, '#5c646c');
    let qx = wx + PX * 4;
    let i = 0;
    while (qx < wx + ww - PX * 4) {
        const h = PX * (11 + Math.floor(hash(i, 6, 3) * 4));
        blk(ctx, qx, streetY - h, PX * 5, h, '#2c343c');
        blk(ctx, qx + PX, streetY - h - PX * 3, PX * 3, PX * 3, '#2c343c');
        qx += PX * (7 + Math.floor(hash(i, 9, 5) * 3));
        i++;
    }
    // Pencere çerçevesi
    blk(ctx, wx + ww / 2 - PX, wy, PX * 2, wh, '#232a30');
    blk(ctx, wx, wy + wh / 2 - PX, ww, PX * 2, '#232a30');

    // Duvarda afiş
    const px = wx + ww + PX * 10;
    blk(ctx, px, A.y + PX * 14, PX * 18, PX * 24, '#d9d2bd');
    blk(ctx, px + PX * 3, A.y + PX * 18, PX * 12, PX * 3, '#a33b2e');
    for (let ly = A.y + PX * 24; ly < A.y + PX * 34; ly += PX * 3) {
        blk(ctx, px + PX * 3, ly, PX * 12, PX, '#8d8877');
    }

    // Arkadaş: elinde şırınga, bize dönük
    drawFriend(ctx, 620, 420, 'left', false, 7);
    blk(ctx, 566, 404, PX * 9, PX * 3, '#cfd8de');
    blk(ctx, 558, 406, PX * 3, PX, '#8e9aa6');

    // Bizim kolumuz alt kenardan uzanıyor: bantsız
    drawArm(ctx, A.x + A.w - PX * 10, A.y + A.h, 520, 424, PX * 11, { band: false });

    darken(ctx, 0.12);
    vignette(ctx, 0.5);
}

// --- 6. Geç kalındı: aynı sokak, kimse yok ---
function tooLate(ctx, A) {
    bands(ctx, A.x, A.y, Math.round(A.h * 0.52), A.w, '#6b6f74', '#8d9298', 6);
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.52), '#5d646c', '#7f8790', 6);

    const streetY = A.y + Math.round(A.h * 0.52 / PX) * PX;

    // Karşı sıra binalar
    let bx = A.x;
    while (bx < A.x + A.w) {
        const w = PX * (14 + Math.floor(hash(bx, 5, 2) * 10));
        const h = PX * (26 + Math.floor(hash(bx, 8, 6) * 18));
        blk(ctx, bx, streetY - h, w, h, mix('#4a5058', '#6a7178', hash(bx, 1, 4)));
        for (let wy = streetY - h + PX * 5; wy < streetY - PX * 5; wy += PX * 7) {
            for (let wx = bx + PX * 3; wx < bx + w - PX * 5; wx += PX * 7) {
                blk(ctx, wx, wy, PX * 4, PX * 4, hash(wx, wy, 11) > 0.7 ? '#2a3038' : '#39414a');
            }
        }
        bx += w + PX * 2;
    }

    // Asfalt
    blk(ctx, A.x, streetY, A.w, A.y + A.h - streetY, '#5a6167');
    blk(ctx, A.x, streetY, A.w, PX * 2, '#6d757c');
    for (let dx = A.x + PX * 6; dx < A.x + A.w; dx += PX * 16) blk(ctx, dx, streetY + PX * 30, PX * 8, PX * 2, '#767e85');

    // Devrilmiş bariyer, dağılmış kâğıtlar, tek ayakkabı
    blk(ctx, A.x + PX * 30, streetY + PX * 14, PX * 34, PX * 4, '#b04a3a');
    blk(ctx, A.x + PX * 30, streetY + PX * 18, PX * 34, PX * 3, '#d9d2bd');
    blk(ctx, A.x + PX * 36, streetY + PX * 22, PX * 4, PX * 10, '#7a3227');
    for (let i = 0; i < 9; i++) {
        const px = A.x + PX * (20 + Math.floor(hash(i, 3, 8) * 200));
        const py = streetY + PX * (8 + Math.floor(hash(i, 7, 2) * 26));
        blk(ctx, px, py, PX * 6, PX * 4, '#ded7c2');
        blk(ctx, px, py, PX * 6, PX, '#f0e9d6');
    }
    blk(ctx, A.x + A.w - PX * 62, streetY + PX * 30, PX * 9, PX * 4, '#2f2a26');

    // Ve asfaltta tek bir yeşil leke
    const sx = A.x + A.w * 0.62;
    const sy = streetY + PX * 20;
    glow(ctx, sx, sy, PX * 26, 'rgba(120,220,80,ALPHA)', 0.20);
    blk(ctx, sx - PX * 7, sy, PX * 15, PX * 4, '#4a8f2a');
    blk(ctx, sx - PX * 4, sy + PX * 4, PX * 9, PX * 2, '#3d7522');
    blk(ctx, sx - PX * 9, sy - PX * 2, PX * 5, PX * 2, '#4a8f2a');

    darken(ctx, 0.1);
    vignette(ctx, 0.5);
}

export const CHAPTER_2_ART = {
    workBench,
    microscope,
    cityMap,
    mapLine,
    vaccineLine,
    tooLate
};
