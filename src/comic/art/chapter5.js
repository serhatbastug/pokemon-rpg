// 5. BÖLÜM - KUŞATMA
//
// Tesis avlusunun İÇİNDEYİZ. Bizim dışımızda TAM BEŞ sağlıklı - bu sayı
// 6. bölümde de tutuyor. Virüslüler tel örgüye dayanıyor, sağlıklıları acil
// çıkıştan geçiriyoruz, en son biz geçiyoruz.
//
// ARKADAŞIN DÖNÜŞÜ GÖSTERİLMİYOR: ne ısırılma, ne dönüşüm, ne kolun çekilip
// çekilmediği. Çelik kapı iniyor, cümle ortasında kesiliyor, o kadar. Ayıran
// şey kapının kendisi; belirsizlik bilerek bırakılıyor.

import { PX, blk, hash } from '../../pixel/pixelDraw.js';
import { drawTrainer } from '../../world/trainerSprite.js';
import { drawFriend, drawSurvivor } from '../../adventure/people.js';
import {
    fill, vignette, darken, glow, bands, mix, limb,
    span, easeOut, easeIn, gridLerp
} from '../comicKit.js';

const CONCRETE = ['#6e7278', '#787c83', '#63676d', '#585c62'];

// Beton avlu: dökme plakalar ve derzler (3. bölümün zemini)
function yardFloor(ctx, A, top) {
    for (let y = top; y < A.y + A.h; y += PX) {
        for (let x = A.x; x < A.x + A.w; x += PX) {
            const slabX = Math.floor(x / (PX * 22));
            const slabY = Math.floor(y / (PX * 16));
            let tone = CONCRETE[Math.floor(hash(slabX, slabY, 11) * CONCRETE.length)];
            if (hash(x, y, 13) < 0.10) tone = CONCRETE[Math.floor(hash(x, y, 17) * CONCRETE.length)];
            if (x % (PX * 22) === 0 || y % (PX * 16) === 0) tone = '#4e5258';
            blk(ctx, x, y, PX, PX, tone);
        }
    }
}

// Tesis cephesi ve üstteki ACİL ÇIKIŞ kapısı
function facade(ctx, A, top, h) {
    blk(ctx, A.x, top, A.w, h, '#6c7078');
    blk(ctx, A.x, top, A.w, PX * 2, '#858a92');
    for (let x = A.x; x < A.x + A.w; x += PX * 26) blk(ctx, x, top, PX * 2, h, '#5a5f66');
    for (let x = A.x + PX * 8; x < A.x + A.w - PX * 10; x += PX * 26) {
        blk(ctx, x, top + PX * 6, PX * 12, PX * 8, '#3b4149');
        blk(ctx, x, top + PX * 6, PX * 12, PX, '#8d939b');
    }
}

// Tel örgü: yüksek kontrastlı desen dama tahtasına dönüyor, o yüzden seyrek
function chainFence(ctx, A, top, h) {
    for (let x = A.x; x < A.x + A.w; x += PX * 4) blk(ctx, x, top, PX, h, '#8b939b');
    for (let y = top; y < top + h; y += PX * 4) blk(ctx, A.x, y, A.w, PX, '#7b838b');
    for (let x = A.x; x < A.x + A.w; x += PX * 30) blk(ctx, x, top - PX * 2, PX * 3, h + PX * 2, '#4d545b');
    blk(ctx, A.x, top - PX * 2, A.w, PX * 2, '#4d545b');
}

// Örgünün ardındaki kalabalık: düzenli aralık çit gibi duruyor, bu yüzden
// aralık/boy rastgele ve siluetler üst üste biniyor
function crowd(ctx, A, baseY, count = 26) {
    for (let i = 0; i < count; i++) {
        const x = A.x + (i / count) * A.w + (hash(i, 3, 5) - 0.5) * PX * 8;
        const h = PX * (26 + Math.floor(hash(i, 7, 2) * 12));
        const w = PX * (8 + Math.floor(hash(i, 5, 9) * 3));
        const tone = mix('#26400d', '#537f22', hash(i, 11, 4));
        blk(ctx, x, baseY - h, w, h, tone);
        blk(ctx, x + PX, baseY - h - PX * 6, w - PX * 2, PX * 6, mix('#456f19', '#3d6317', hash(i, 2, 8)));
    }
}

// İnen çelik kapı
function steelDoor(ctx, x, y, w, closed) {
    const h = Math.max(PX, closed);
    blk(ctx, x - PX * 3, y - PX * 4, w + PX * 6, PX * 4, '#3a4149');
    blk(ctx, x, y, w, h, '#8a929c');
    for (let ly = y; ly < y + h; ly += PX * 6) blk(ctx, x, ly, w, PX * 2, '#5f6873');
    blk(ctx, x, y + h - PX * 2, w, PX * 2, '#3a4149');
    // Uyarı şeridi
    for (let sx = x; sx < x + w; sx += PX * 8) blk(ctx, sx, y + h - PX * 6, PX * 4, PX * 4, '#c9a227');
}

// --- 1. Avlu, sakin: altı kişi iş başında ---
function yardCalm(ctx, A) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.22), '#7d8794', '#9aa4b0', 5);
    const fenceTop = A.y + Math.round(A.h * 0.16 / PX) * PX;
    const yardTop = A.y + Math.round(A.h * 0.46 / PX) * PX;

    facade(ctx, A, A.y, Math.round(A.h * 0.16));
    chainFence(ctx, A, fenceTop, yardTop - fenceTop);
    yardFloor(ctx, A, yardTop);

    // Solda jeneratör ve acil durum kolu, aralarında kablo
    const gx = A.x + PX * 10;
    blk(ctx, gx, yardTop - PX * 22, PX * 30, PX * 22, '#4a5158');
    blk(ctx, gx, yardTop - PX * 22, PX * 30, PX * 2, '#626a72');
    blk(ctx, gx + PX * 6, yardTop - PX * 16, PX * 8, PX * 6, '#2d333a');
    const lx = gx + PX * 46;
    blk(ctx, lx, yardTop - PX * 16, PX * 5, PX * 16, '#3f464d');
    blk(ctx, lx - PX * 3, yardTop - PX * 22, PX * 4, PX * 8, '#b04a3a');
    limb(ctx, gx + PX * 30, yardTop - PX * 4, lx, yardTop - PX * 4, PX * 2, '#23282d');

    // Sağda gözetleme kulesi ve rögar
    const tx = A.x + A.w - PX * 40;
    blk(ctx, tx, A.y + PX * 6, PX * 6, yardTop - A.y + PX * 10, '#555c63');
    blk(ctx, tx + PX * 18, A.y + PX * 6, PX * 6, yardTop - A.y + PX * 10, '#555c63');
    blk(ctx, tx - PX * 4, A.y + PX * 2, PX * 32, PX * 8, '#454c53');
    const mhx = A.x + A.w - PX * 30;
    blk(ctx, mhx, A.y + A.h - PX * 22, PX * 18, PX * 8, '#4b545c');
    blk(ctx, mhx + PX * 2, A.y + A.h - PX * 20, PX * 14, PX * 4, '#5c666e');

    // Sandıklar
    for (let i = 0; i < 3; i++) {
        const cx = A.x + PX * 92 + i * PX * 22;
        blk(ctx, cx, yardTop + PX * 6, PX * 18, PX * 14, '#7a5a34');
        blk(ctx, cx, yardTop + PX * 6, PX * 18, PX * 2, '#96703f');
        blk(ctx, cx + PX * 7, yardTop + PX * 6, PX * 4, PX * 14, '#5f4728');
    }

    // Altı kişi: biz + BEŞ sağlıklı
    drawSurvivor(ctx, A.x + PX * 40, yardTop + PX * 34, 'down', false, 6, 0);
    drawSurvivor(ctx, A.x + PX * 74, yardTop + PX * 26, 'right', false, 6, 1);
    drawSurvivor(ctx, A.x + PX * 150, yardTop + PX * 40, 'left', false, 6, 2);
    drawSurvivor(ctx, A.x + PX * 186, yardTop + PX * 22, 'down', false, 6, 3);
    drawSurvivor(ctx, A.x + PX * 120, yardTop + PX * 14, 'up', false, 6, 4);
    drawFriend(ctx, A.x + PX * 62, yardTop + PX * 52, 'down', false, 6);
    drawTrainer(ctx, A.x + PX * 106, yardTop + PX * 50, 'down', false, 6);

    vignette(ctx, 0.4);
}

// --- 2. Örgüye dayanan kalabalık ---
function fenceCrowd(ctx, A) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.30), '#6f7885', '#8e97a3', 5);
    const fenceTop = A.y + PX * 10;
    const yardTop = A.y + Math.round(A.h * 0.62 / PX) * PX;

    crowd(ctx, A, yardTop - PX * 6, 30);
    chainFence(ctx, A, fenceTop, yardTop - fenceTop);
    yardFloor(ctx, A, yardTop);

    // Örgüyü iten eller: parmakları teller arasından geçiyor
    for (let i = 0; i < 7; i++) {
        const hx = A.x + PX * 20 + i * PX * 32 + Math.floor(hash(i, 4, 6) * PX * 10);
        const hy = yardTop - PX * (30 + Math.floor(hash(i, 8, 3) * 16));
        blk(ctx, hx, hy, PX * 7, PX * 5, '#537f22');
        for (let f = 0; f < 3; f++) blk(ctx, hx + f * PX * 3, hy - PX * 3, PX * 2, PX * 3, '#5e8f28');
    }

    // Arkadaş: örgüye bakıyor, kolunda bant
    drawFriend(ctx, 300, 396, 'up', false, 7);
    drawTrainer(ctx, 470, 420, 'up', false, 7);

    darken(ctx, 0.12);
    vignette(ctx, 0.5);
}

// --- 3. Plan: ormana kaçıyoruz ---
function yardPlan(ctx, A) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.26), '#67707d', '#89929e', 5);
    const yardTop = A.y + Math.round(A.h * 0.40 / PX) * PX;
    facade(ctx, A, A.y, Math.round(A.h * 0.26));
    yardFloor(ctx, A, yardTop);

    // Üstte ACİL ÇIKIŞ: açık, ışığı yanıyor
    const doorX = A.x + Math.round(A.w * 0.44 / PX) * PX;
    const doorW = PX * 40;
    const doorTop = A.y + Math.round(A.h * 0.26 / PX) * PX - PX * 30;
    blk(ctx, doorX - PX * 3, doorTop, doorW + PX * 6, PX * 32, '#3a4149');
    blk(ctx, doorX, doorTop + PX * 2, doorW, PX * 28, '#2a3038');
    blk(ctx, doorX + PX * 4, doorTop + PX * 6, doorW - PX * 8, PX * 20, '#c7d2a8');
    glow(ctx, doorX + doorW / 2, doorTop + PX * 16, PX * 40, 'rgba(200,220,160,ALPHA)', 0.22);

    // Biz: elimizde parçalayıcı silah
    drawTrainer(ctx, 380, 392, 'right', false, 7);
    blk(ctx, 412, 384, PX * 12, PX * 4, '#3c434a');
    blk(ctx, 424, 386, PX * 5, PX * 2, '#22272c');

    // Cevap veren sağlıklı ve arkasındaki diğerleri
    drawSurvivor(ctx, 720, 402, 'left', false, 7, 0);
    drawSurvivor(ctx, 800, 380, 'left', false, 6, 1);
    drawSurvivor(ctx, 856, 404, 'down', false, 6, 2);
    drawSurvivor(ctx, 640, 370, 'down', false, 6, 3);
    drawFriend(ctx, 560, 412, 'right', false, 6);

    vignette(ctx, 0.45);
}

// --- 4. HAREKETLİ: yarıktan içeri doluyorlar ---
function breach(ctx, A, t) {
    bands(ctx, A.x, A.y, A.w, Math.round(A.h * 0.24), '#5c6470', '#7c8593', 5);
    const yardTop = A.y + Math.round(A.h * 0.38 / PX) * PX;
    facade(ctx, A, A.y, Math.round(A.h * 0.24));
    yardFloor(ctx, A, yardTop);

    // Soldaki yarık: örgü yırtılmış
    blk(ctx, A.x, yardTop - PX * 34, PX * 40, PX * 34, '#3f464e');
    for (let i = 0; i < 6; i++) {
        limb(ctx, A.x + PX * 34, yardTop - PX * (30 - i * 5), A.x + PX * (18 + i * 3), yardTop - PX * (34 - i * 6), PX * 2, '#98a1a9');
    }

    // İçeri girenler: soldan sağa ilerliyorlar
    const march = easeOut(t);
    for (let i = 0; i < 7; i++) {
        const lead = hash(i, 3, 2);
        const x = A.x + PX * 10 + march * (PX * 70 + lead * PX * 60) + i * PX * 12;
        const y = yardTop + PX * 10 + Math.floor(hash(i, 9, 4) * PX * 26);
        const h = PX * 30;
        blk(ctx, x, y - h, PX * 10, h, mix('#26400d', '#537f22', lead));
        blk(ctx, x + PX, y - h - PX * 7, PX * 8, PX * 7, '#456f19');
        // Vurulanın yerinde kalıcı yeşil leke
        if (t > 0.5 && lead > 0.6) {
            blk(ctx, x - PX * 4, y, PX * 16, PX * 3, '#3d7522');
        }
    }

    // Üstteki acil çıkış: sağlıklılar sırayla geçiyor
    const doorX = A.x + Math.round(A.w * 0.56 / PX) * PX;
    blk(ctx, doorX - PX * 3, A.y + PX * 30, PX * 46, PX * 30, '#3a4149');
    blk(ctx, doorX, A.y + PX * 32, PX * 40, PX * 26, '#c7d2a8');
    const passed = Math.floor(span(t, 0.1, 0.9) * 5);
    for (let i = passed; i < 5; i++) {
        drawSurvivor(ctx, doorX + PX * 20 + (i - passed) * PX * 4, yardTop + PX * 26 + (i - passed) * PX * 16, 'up', true, 6, i);
    }

    // Biz: kapıyı tutuyoruz, ateş ediyoruz
    const px = doorX - PX * 26;
    const py = yardTop + PX * 30;
    drawTrainer(ctx, px, py, 'left', false, 7);
    const flash = Math.sin(t * 40) > 0.4;
    blk(ctx, px - PX * 14, py - PX * 4, PX * 12, PX * 4, '#3c434a');
    if (flash) {
        glow(ctx, px - PX * 18, py - PX * 2, PX * 20, 'rgba(255,240,180,ALPHA)', 0.6);
        blk(ctx, px - PX * 20, py - PX * 5, PX * 6, PX * 6, '#ffe9a8');
    }

    darken(ctx, 0.08);
    vignette(ctx, 0.5);
}

// --- 5. HAREKETLİ: çelik kapı iniyor, arkadaş geri dönüyor ---
function doorClosing(ctx, A, t) {
    // Kamera kapıya DÖNÜK: inen kapı karenin kendisi kadar büyük olmalı,
    // yoksa bölümün ayıran anı tavandaki bir çıtaya dönüyor.
    const floorY = A.y + Math.round(A.h * 0.76 / PX) * PX;
    blk(ctx, A.x, A.y, A.w, floorY - A.y, '#5b636c');
    facade(ctx, A, A.y, Math.round(A.h * 0.14));
    for (let x = A.x; x < A.x + A.w; x += PX * 30) blk(ctx, x, A.y, PX * 2, floorY - A.y, '#4d545c');
    yardFloor(ctx, A, floorY);

    const doorX = A.x + Math.round(A.w * 0.20 / PX) * PX;
    const doorW = Math.round(A.w * 0.44 / PX) * PX;
    const doorTop = A.y + Math.round(A.h * 0.14 / PX) * PX;
    const doorH = floorY - doorTop;

    // Kapı boşluğu: ardı karanlık
    blk(ctx, doorX - PX * 5, doorTop - PX * 4, doorW + PX * 10, doorH + PX * 4, '#2b3138');
    blk(ctx, doorX, doorTop, doorW, doorH, '#12161a');
    blk(ctx, doorX, floorY - PX * 4, doorW, PX * 4, '#1c2126');

    // Kapının ardında: arkadaş kola doğru gidiyor. Işık azalıyor, ne
    // ısırılma ne dönüşüm görülüyor - yalnızca uzaklaşan bir siluet.
    const back = easeIn(span(t, 0.05, 0.85));
    const fx = gridLerp(doorX + doorW * 0.62, doorX + PX * 10, back);
    glow(ctx, doorX + PX * 8, doorTop + doorH * 0.5, PX * 40, 'rgba(190,170,120,ALPHA)', 0.22 * (1 - back * 0.7));
    drawFriend(ctx, fx, doorTop + doorH * 0.72, 'left', true, 6);

    // Kapı iniyor
    const closed = gridLerp(PX * 6, doorH, easeIn(t));
    steelDoor(ctx, doorX, doorTop, doorW, closed);

    // Biz: dışarıda, kapıya dönük, ön planda iri
    drawTrainer(ctx, doorX + doorW + PX * 40, floorY + PX * 6, 'left', false, 9);

    darken(ctx, easeIn(span(t, 0.6, 1)) * 0.3);
    vignette(ctx, 0.55);
}

// --- 6. Kapalı kapı ---
function doorShut(ctx, A) {
    // Bir önceki karenin aynı kadrajı, kapı tamamen inmiş hâli: değişen tek
    // şey kapı ve önünde kalan tek kişi.
    const floorY = A.y + Math.round(A.h * 0.76 / PX) * PX;
    blk(ctx, A.x, A.y, A.w, floorY - A.y, '#4d545d');
    facade(ctx, A, A.y, Math.round(A.h * 0.14));
    for (let x = A.x; x < A.x + A.w; x += PX * 30) blk(ctx, x, A.y, PX * 2, floorY - A.y, '#434a52');
    yardFloor(ctx, A, floorY);

    const doorX = A.x + Math.round(A.w * 0.20 / PX) * PX;
    const doorW = Math.round(A.w * 0.44 / PX) * PX;
    const doorTop = A.y + Math.round(A.h * 0.14 / PX) * PX;
    blk(ctx, doorX - PX * 5, doorTop - PX * 4, doorW + PX * 10, floorY - doorTop + PX * 4, '#2b3138');
    steelDoor(ctx, doorX, doorTop, doorW, floorY - doorTop);

    // Kapının önünde tek kişi: biz. Sırtı bize dönük, kapıya bakıyor.
    drawTrainer(ctx, doorX + doorW / 2, floorY + PX * 12, 'up', false, 9);

    darken(ctx, 0.3);
    vignette(ctx, 0.7);
}

export const CHAPTER_5_ART = {
    yardCalm,
    fenceCrowd,
    yardPlan,
    breach,
    doorClosing,
    doorShut
};
