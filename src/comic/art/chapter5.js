// 5. BÖLÜM - ORMANIN AĞZI
//
// Kanalizasyon, rögar, şehrin kenarı ve ormanın ağzındaki dönüş. Tünel
// "yoğun maruziyet": beşinin de sayacını bitiren yer orası. Ormanın ağzında
// hepsi yeşilleniyor, hepsini vuruyoruz ve ormana SON SAĞLIKLI olarak
// giriyoruz.
//
// Parçalayıcı silah virüsü öldürmüyor, dağıtıyor: vurulanın yerinde kalıcı
// yeşil bir leke kalıyor. Yaptığımızın işe yaramadığı gözle görülüyor.

import { PX, blk, hash } from '../../pixel/pixelDraw.js';
import { drawTrainer } from '../../world/trainerSprite.js';
import { drawSurvivor } from '../../adventure/people.js';
import {
    fill, vignette, darken, glow, bands, mix, limb,
    span, easeOut, easeIn, gridLerp, lerp
} from '../comicKit.js';

// Tünel: iç içe dikdörtgenler. Poligon kullanmak eğik kenarları yumuşatıp
// piksel dilini bozuyordu (kanalizasyon bölümünde öğrenildi).
function tunnel(ctx, A, depth = 8) {
    fill(ctx, '#0c1210');
    const cx = A.x + A.w / 2;
    const cy = A.y + A.h * 0.52;
    for (let i = depth; i >= 0; i--) {
        const k = i / depth;
        const w = A.w * (0.30 + k * 0.78);
        const h = A.h * (0.34 + k * 0.80);
        const tone = mix('#1d2b26', '#38493f', 1 - k);
        blk(ctx, cx - w / 2, cy - h / 2, w, h, tone);
        blk(ctx, cx - w / 2, cy - h / 2, w, PX * 2, mix('#16211d', '#2c3a33', 1 - k));
        blk(ctx, cx - w / 2, cy + h / 2 - PX * 2, w, PX * 2, '#101815');
    }
    // Zeminde akan su
    const waterY = cy + A.h * 0.20;
    blk(ctx, A.x, waterY, A.w, A.y + A.h - waterY, '#22332c');
    for (let x = A.x; x < A.x + A.w; x += PX * 5) {
        if (hash(x, 3, 6) < 0.4) blk(ctx, x, waterY + PX * (2 + Math.floor(hash(x, 7, 1) * 8)), PX * 3, PX, '#3c5a47');
    }
}

// Ormanın duvarı: gövdeler ve üstte kapanan tepe
function forestWall(ctx, A, top, baseY, { dark = false } = {}) {
    const trunk = dark ? '#241f1a' : '#33291f';
    const leafDark = dark ? '#12240f' : '#1d3a15';
    const leaf = dark ? '#1a3213' : '#2b5320';

    blk(ctx, A.x, top, A.w, baseY - top, leafDark);
    for (let x = A.x; x < A.x + A.w; x += PX * 6) {
        const bump = PX * (2 + Math.floor(hash(x, 5, 3) * 5));
        blk(ctx, x, top - bump, PX * 6, bump, leafDark);
        if (hash(x, 9, 2) > 0.55) blk(ctx, x, top + PX * 2, PX * 5, PX * 4, leaf);
    }
    for (let i = 0; i < 9; i++) {
        const x = A.x + PX * 8 + i * PX * 26 + Math.floor(hash(i, 4, 7) * PX * 8);
        const w = PX * (5 + Math.floor(hash(i, 2, 9) * 4));
        blk(ctx, x, top + PX * 10, w, baseY - top - PX * 10, trunk);
        blk(ctx, x, top + PX * 10, PX, baseY - top - PX * 10, '#473828');
    }
}

// --- 1. HAREKETLİ: tünelde koşu ---
function sewerRun(ctx, A, t) {
    tunnel(ctx, A);

    const cy = A.y + A.h * 0.52;
    // Önümüzde koşan beş kişi: uzaktakiler küçük
    const runners = [
        { x: -0.22, s: 4, i: 0 }, { x: 0.10, s: 4, i: 1 }, { x: -0.05, s: 5, i: 2 },
        { x: 0.24, s: 5, i: 3 }, { x: -0.30, s: 6, i: 4 }
    ];
    runners.forEach((r, k) => {
        const bob = Math.sin(t * 18 + k) * PX;
        drawSurvivor(ctx, A.x + A.w / 2 + r.x * A.w, cy + PX * 24 + r.s * PX * 3 + bob, 'up', true, r.s, r.i);
    });

    // Biz en yakındayız: alt kenarda, sırtı dönük
    drawTrainer(ctx, A.x + A.w / 2 + PX * 6, A.y + A.h - PX * 26 + Math.sin(t * 20) * PX, 'up', true, 8);

    // Tavandaki ızgaradan düşen ışık
    const gx = A.x + A.w * 0.5 + Math.sin(t * 3) * PX * 10;
    glow(ctx, gx, A.y + PX * 20, PX * 60, 'rgba(180,210,190,ALPHA)', 0.12);

    darken(ctx, 0.15);
    vignette(ctx, 0.75);
}

// --- 2. Çıkış bacası: merdiven yukarı ---
function sewerLadder(ctx, A) {
    fill(ctx, '#101a16');
    // Baca: yukarı doğru daralan boşluk, tepesinde gündüz
    const sx = A.x + Math.round(A.w * 0.52 / PX) * PX;
    const sw = PX * 44;
    blk(ctx, sx - PX * 6, A.y, sw + PX * 12, A.h, '#1b2a24');
    blk(ctx, sx, A.y, sw, A.h * 0.72, '#25352d');
    blk(ctx, sx, A.y, sw, PX * 10, '#b9c6b4');
    glow(ctx, sx + sw / 2, A.y + PX * 12, PX * 70, 'rgba(220,235,210,ALPHA)', 0.28);

    // Merdiven basamakları
    for (let y = A.y + PX * 12; y < A.y + A.h - PX * 10; y += PX * 8) {
        blk(ctx, sx + PX * 8, y, sw - PX * 16, PX * 3, '#6b7a72');
        blk(ctx, sx + PX * 8, y, PX * 3, PX * 3, '#8b9a92');
    }
    blk(ctx, sx + PX * 6, A.y, PX * 3, A.h - PX * 8, '#57655e');
    blk(ctx, sx + sw - PX * 9, A.y, PX * 3, A.h - PX * 8, '#57655e');

    // Tünel zemini ve duran figürler
    const floorY = A.y + Math.round(A.h * 0.78 / PX) * PX;
    blk(ctx, A.x, floorY, A.w, A.y + A.h - floorY, '#1d2b25');
    blk(ctx, A.x, floorY, A.w, PX * 2, '#2c3d34');

    drawSurvivor(ctx, 620, floorY - PX * 12, 'up', false, 7, 1);
    drawSurvivor(ctx, 700, floorY + PX * 6, 'left', false, 6, 2);
    drawSurvivor(ctx, 540, floorY + PX * 10, 'up', false, 6, 3);
    drawTrainer(ctx, 420, floorY + PX * 8, 'right', false, 7);

    darken(ctx, 0.12);
    vignette(ctx, 0.7);
}

// --- 3. Şehrin kenarı: rögardan çıkış ---
function ruinedCity(ctx, A) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.52), '#6b6257', '#9c9384', 6);
    const streetY = A.y + Math.round(A.h * 0.52 / PX) * PX;

    // Harabe silüeti: kırık kat çizgileri, is lekeleri
    let bx = A.x;
    while (bx < A.x + A.w) {
        const w = PX * (16 + Math.floor(hash(bx, 5, 2) * 10));
        const h = PX * (24 + Math.floor(hash(bx, 8, 6) * 22));
        const broken = hash(bx, 2, 3) > 0.5;
        blk(ctx, bx, streetY - h, w, h, mix('#4a443d', '#6a635a', hash(bx, 1, 4)));
        if (broken) {
            blk(ctx, bx + w / 2, streetY - h, w / 2, PX * 6, '#7c746a');
            blk(ctx, bx, streetY - h + PX * 4, w / 2, PX * 3, '#7c746a');
        }
        for (let wy = streetY - h + PX * 6; wy < streetY - PX * 5; wy += PX * 7) {
            for (let wx = bx + PX * 3; wx < bx + w - PX * 5; wx += PX * 7) {
                blk(ctx, wx, wy, PX * 4, PX * 4, hash(wx, wy, 11) > 0.5 ? '#20242a' : '#33383f');
                if (hash(wx, wy, 21) > 0.85) blk(ctx, wx, wy - PX * 3, PX * 4, PX * 3, '#1b1917');
            }
        }
        bx += w + PX * 2;
    }

    // Sağda uzaktaki orman: gidilecek yer
    forestWall(ctx, { x: A.x + A.w - PX * 60, y: A.y, w: PX * 60, h: A.h }, streetY - PX * 40, streetY);

    // Asfalt, moloz, açık rögar
    blk(ctx, A.x, streetY, A.w, A.y + A.h - streetY, '#59554e');
    blk(ctx, A.x, streetY, A.w, PX * 2, '#6d685f');
    for (let i = 0; i < 22; i++) {
        const rx = A.x + Math.floor(hash(i, 3, 9) * A.w);
        const ry = streetY + PX * (4 + Math.floor(hash(i, 7, 5) * 34));
        blk(ctx, rx, ry, PX * (2 + Math.floor(hash(i, 9, 1) * 4)), PX * 2, '#6b665d');
    }
    const mhx = A.x + PX * 40;
    const mhy = streetY + PX * 44;
    blk(ctx, mhx, mhy, PX * 22, PX * 8, '#2a2825');
    blk(ctx, mhx + PX * 24, mhy - PX * 2, PX * 12, PX * 4, '#4b4740');

    // Grup: biz solda, cevap veren sağda, diğerleri arkada
    drawTrainer(ctx, 380, 402, 'right', false, 7);
    drawSurvivor(ctx, 700, 404, 'left', false, 7, 1);
    drawSurvivor(ctx, 610, 380, 'down', false, 6, 2);
    drawSurvivor(ctx, 800, 386, 'left', false, 6, 3);
    drawSurvivor(ctx, 500, 372, 'right', false, 6, 0);
    drawSurvivor(ctx, 870, 404, 'down', false, 6, 4);

    vignette(ctx, 0.45);
}

// --- 4. Ormanın ağzı: hepsi duruyor ---
function forestMouth(ctx, A) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.30), '#7b7565', '#a49b88', 5);
    const groundY = A.y + Math.round(A.h * 0.62 / PX) * PX;
    forestWall(ctx, A, A.y + Math.round(A.h * 0.16), groundY);

    // Ormanın ağzı: ortada koyu bir boşluk
    const mx = A.x + Math.round(A.w * 0.52 / PX) * PX;
    blk(ctx, mx - PX * 26, A.y + Math.round(A.h * 0.24), PX * 52, groundY - A.y - Math.round(A.h * 0.24), '#0c1408');

    // Toprak
    blk(ctx, A.x, groundY, A.w, A.y + A.h - groundY, '#5d5140');
    blk(ctx, A.x, groundY, A.w, PX * 2, '#6d6049');
    for (let i = 0; i < 26; i++) {
        const gx = A.x + Math.floor(hash(i, 5, 3) * A.w);
        const gy = groundY + PX * (3 + Math.floor(hash(i, 8, 2) * 30));
        blk(ctx, gx, gy, PX * (2 + Math.floor(hash(i, 2, 6) * 5)), PX * 2, '#4e4436');
    }

    // Beşi önümüzde durmuş, sırtları dönük; biz arkadayız
    drawSurvivor(ctx, 560, groundY + PX * 8, 'up', false, 7, 0);
    drawSurvivor(ctx, 640, groundY + PX * 2, 'up', false, 7, 1);
    drawSurvivor(ctx, 700, groundY + PX * 12, 'up', false, 7, 2);
    drawSurvivor(ctx, 790, groundY + PX * 4, 'up', false, 7, 3);
    drawSurvivor(ctx, 860, groundY + PX * 14, 'up', false, 7, 4);
    drawTrainer(ctx, 400, groundY + PX * 20, 'right', false, 8);

    vignette(ctx, 0.5);
}

// --- 5. HAREKETLİ: beşi de yeşilleniyor ---
function greening(ctx, A, t) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.24), '#6a6455', '#8d8574', 5);
    const groundY = A.y + Math.round(A.h * 0.66 / PX) * PX;
    forestWall(ctx, A, A.y + Math.round(A.h * 0.10), groundY, { dark: true });
    blk(ctx, A.x, groundY, A.w, A.y + A.h - groundY, '#544936');
    blk(ctx, A.x, groundY, A.w, PX * 2, '#63563f');

    // Yakın plan: beşi bize DÖNMÜŞ, yüzleri yavaşça yeşilleniyor
    const g = easeIn(t);
    const spots = [0, 1, 2, 3, 4].map(i => [A.x + A.w * (0.20 + i * 0.15), i]);
    spots.forEach(([x, i], k) => {
        const sway = Math.sin(t * 6 + k) * PX * (g > 0.5 ? 1 : 0);
        drawSurvivor(ctx, x + sway, groundY + PX * 4, 'down', false, 9, i, Math.min(1, g * (0.7 + hash(i, 3, 2) * 0.6)));
    });

    if (g > 0.35) {
        for (const [x] of spots) glow(ctx, x, groundY - PX * 20, PX * 40, 'rgba(120,220,80,ALPHA)', (g - 0.35) * 0.30);
    }

    darken(ctx, g * 0.20);
    vignette(ctx, 0.55);
}

// --- 6. HAREKETLİ: vuruş ---
function shots(ctx, A, t) {
    const groundY = A.y + Math.round(A.h * 0.68 / PX) * PX;
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.20), '#4f4a3f', '#6d6657', 5);
    forestWall(ctx, A, A.y + Math.round(A.h * 0.08), groundY, { dark: true });
    blk(ctx, A.x, groundY, A.w, A.y + A.h - groundY, '#4b4132');
    blk(ctx, A.x, groundY, A.w, PX * 2, '#5a4e3b');

    // Beş hedef: sırayla vuruluyor, yerlerinde yeşil leke kalıyor
    const targets = [0, 1, 2, 3, 4].map(i => [A.x + A.w * (0.30 + i * 0.15), i]);
    const downCount = Math.floor(span(t, 0.12, 0.92) * 5.999);
    targets.forEach(([x, i], k) => {
        if (k < downCount) {
            // Dağıldı: yerde kalıcı leke
            glow(ctx, x, groundY - PX * 6, PX * 30, 'rgba(120,220,80,ALPHA)', 0.16);
            blk(ctx, x - PX * 14, groundY - PX * 3, PX * 28, PX * 5, '#3d7522');
            blk(ctx, x - PX * 9, groundY - PX * 7, PX * 18, PX * 4, '#4a8f2a');
            for (let s = 0; s < 5; s++) {
                const sx = x + (hash(k, s, 3) - 0.5) * PX * 40;
                blk(ctx, sx, groundY - PX * (2 + Math.floor(hash(k, s, 7) * 8)), PX * 3, PX * 2, '#4a8f2a');
            }
            return;
        }
        drawSurvivor(ctx, x, groundY + PX * 4, 'down', false, 9, i, 1);
    });

    // Namlu ateşi: her hedefte bir patlama
    const flashK = span(t, 0.12, 0.92) * 5.999;
    const flashing = flashK - Math.floor(flashK) < 0.45;
    const px = A.x + PX * 24;
    const py = groundY + PX * 6;
    drawTrainer(ctx, px, py, 'right', false, 9);
    blk(ctx, px + PX * 10, py - PX * 8, PX * 16, PX * 5, '#3c434a');
    if (flashing && downCount < 5) {
        const tx = targets[Math.min(downCount, 4)][0];
        glow(ctx, px + PX * 28, py - PX * 6, PX * 26, 'rgba(255,240,180,ALPHA)', 0.7);
        blk(ctx, px + PX * 26, py - PX * 10, PX * 8, PX * 8, '#ffe9a8');
        limb(ctx, px + PX * 32, py - PX * 7, tx - PX * 10, groundY - PX * 20, PX * 2, '#fff3c8');
    }

    vignette(ctx, 0.6);
}

// --- 7. Sonrası: yerde lekeler, ayakta bir kişi ---
function aftermath(ctx, A) {
    const groundY = A.y + Math.round(A.h * 0.62 / PX) * PX;
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.22), '#4a453b', '#67604f', 5);
    forestWall(ctx, A, A.y + Math.round(A.h * 0.12), groundY, { dark: true });
    blk(ctx, A.x, groundY, A.w, A.y + A.h - groundY, '#4b4132');
    blk(ctx, A.x, groundY, A.w, PX * 2, '#5a4e3b');

    // Beş leke
    for (const x of [0, 1, 2, 3, 4].map(i => A.x + A.w * (0.42 + i * 0.12))) {
        glow(ctx, x, groundY + PX * 14, PX * 26, 'rgba(120,220,80,ALPHA)', 0.12);
        blk(ctx, x - PX * 13, groundY + PX * 12, PX * 26, PX * 5, '#3d7522');
        blk(ctx, x - PX * 8, groundY + PX * 8, PX * 16, PX * 4, '#4a8f2a');
    }

    // Biz: silah aşağıda
    drawTrainer(ctx, A.x + A.w * 0.16, groundY + PX * 16, 'right', false, 9);
    blk(ctx, A.x + A.w * 0.16 + PX * 7, groundY + PX * 24, PX * 14, PX * 4, '#3c434a');

    darken(ctx, 0.15);
    vignette(ctx, 0.6);
}

// --- 8. HAREKETLİ: ormana giriyoruz ---
function intoForest(ctx, A, t) {
    const groundY = A.y + Math.round(A.h * 0.70 / PX) * PX;
    fill(ctx, '#0a1207');
    forestWall(ctx, A, A.y, groundY, { dark: true });
    blk(ctx, A.x, groundY, A.w, A.y + A.h - groundY, '#2f2a1f');

    // Ormanın içine giden patika
    const pathTop = A.y + Math.round(A.h * 0.30 / PX) * PX;
    for (let y = groundY; y > pathTop; y -= PX * 2) {
        const k = (groundY - y) / (groundY - pathTop);
        const w = lerp(PX * 40, PX * 6, k);
        blk(ctx, A.x + A.w * 0.5 - w / 2, y, w, PX * 2, mix('#3a3325', '#141a0e', k));
    }

    // Sırtı dönük, ormana yürüyor: t ilerledikçe uzaklaşıyor ve küçülüyor
    const walk = easeOut(t);
    const scale = Math.max(4, Math.round(lerp(10, 5, walk)));
    const y = gridLerp(groundY + PX * 20, groundY - PX * 30, walk);
    drawTrainer(ctx, A.x + A.w * 0.5, y, 'up', true, scale);

    // Kolunda ilk yeşil damar: oyunun sayacı burada başlıyor
    if (t > 0.25) {
        const ax = A.x + A.w * 0.5 - scale * 5;
        blk(ctx, ax, y - scale, PX, PX * 3, '#4a8f2a');
        blk(ctx, ax - PX, y + PX * 2, PX, PX * 2, '#3d7522');
        glow(ctx, ax, y, PX * 10, 'rgba(120,220,80,ALPHA)', span(t, 0.25, 1) * 0.25);
    }

    darken(ctx, span(t, 0.5, 1) * 0.35);
    vignette(ctx, 0.7);
}

export const CHAPTER_5_ART = {
    sewerRun,
    sewerLadder,
    ruinedCity,
    forestMouth,
    greening,
    shots,
    aftermath,
    intoForest
};
