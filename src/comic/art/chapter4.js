// 4. BÖLÜM - EV
//
// Bizimkinin oturma odası, akşam. Bölüm TEK ÇEKİM: kamera hiç kıpırdamıyor.
// Bizimki koltukta gazete okurken arkadaşı (= profesör, ASLA SÖYLENMEZ)
// kapıdan içeri giriyor.
//
// ARKADAŞIN YÜZÜ BURADA DA GÖRÜNMÜYOR: kafası saçla kaplı düz bir şekil,
// göz/kaş/burun/ağız YOK. Tek işareti bileğindeki TURUNCU BANT (comicKit
// `BAND_COLOR` - 1. bölümdeki saatle, 5. bölümdeki bantla AYNI renk).
//
// Bizimkinin yüzü tam tersine AYRINTILI: bu onun çizgi romandaki İLK
// çıkışı, sonraki bölümlerde de aynı kalacak (bkz. [[menu-avatar-antivirus]]
// notundaki gibi kullanıcı ayrıntı istedi).
//
// Sohbet UZUN olduğu için bilerek çok sayıda küçük balona bölünüyor - her
// biri kendi başına havada kalıp okunacak kadar bekliyor (dialogue.js'in
// HOLD_BASE + uzunluk mekaniği zaten bunu sağlıyor), sonra oyuncu F ile
// ilerletiyor. "Katılıyorum" ile "Fakat önce bir denek bulmalıyız" araya
// bilerek AYRI birer kare olarak girdi - kullanıcının işaret ettiği kesme.

import { PX, hash } from '../../pixel/pixelDraw.js';
import {
    createCam, vignette, mix, BAND_COLOR,
    span, clamp01, easeOut, lerp
} from '../comicKit.js';

const SCENE = { w: 232, h: 122 };
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };

const CEIL_H = 8;
const FLOOR_Y = 100;

const SEAT_X = 60;         // bizimkinin koltuğu
const SEAT_Y = 84;
const STAND_X = 158;        // arkadaşın konuşurken durduğu yer
const DOOR_X = 210;         // arkadaşın girdiği kapı

// --- Renkler ---

const WALL = '#c3ae86';
const WALL_SEAM = '#a8916a';
const WALL_TRIM = '#5c4530';
const FLOOR_A = '#8a6a42';
const FLOOR_B = '#7d5f3a';
const FLOOR_SEAM = '#5f4728';

const BIZ_HAIR = '#5a3d24';
const BIZ_SKIN = '#c99a6e';
const BIZ_CARDIGAN = '#6b3232';
const BIZ_CARDIGAN_SHADE = '#4a2020';
const BIZ_SHIRT = '#d8cdb8';
const BIZ_TROUSER = '#3a4048';

const FRIEND_HAIR = '#332920';
const FRIEND_SKIN = '#caa079';
const FRIEND_COAT = '#4a5560';
const FRIEND_COAT_SHADE = '#33393f';
const FRIEND_TROUSER = '#2c2f33';

// Hücre düzleminde kalın çapraz çizgi: kol, bacak
function limbCells(ctx, cam, x0, y0, x1, y1, thick, color) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        cam.rect(ctx, x0 + dx * k - thick / 2, y0 + dy * k - thick / 2, thick, thick, color);
    }
}

function vBands(ctx, cam, x, y, w, h, from, to, steps = 8) {
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
        cam.rect(ctx, x, y + i * stepH, w, stepH + 0.6, mix(from, to, i / (steps - 1 || 1)));
    }
}

// --- Odanın parçaları ---

function walls(ctx, cam) {
    cam.rect(ctx, 0, 0, SCENE.w, CEIL_H, '#3a3128');
    vBands(ctx, cam, 0, CEIL_H, SCENE.w, FLOOR_Y - CEIL_H - 8, mix(WALL, '#ffffff', 0.08), WALL, 6);
    for (let y = CEIL_H; y < FLOOR_Y; y += 13) cam.rect(ctx, 0, y, SCENE.w, 0.8, WALL_SEAM);
    // Çizgili duvar kağıdı: ince düşey şeritler
    for (let x = 0; x < SCENE.w; x += 6) cam.rect(ctx, x, CEIL_H, 1, FLOOR_Y - CEIL_H - 8, 'rgba(0,0,0,0.03)');
    for (let x = 0; x < SCENE.w; x += 2) {
        for (let y = CEIL_H; y < FLOOR_Y - 8; y += 3) {
            if (hash(x, y, 6) > 0.975) cam.rect(ctx, x, y, 2, 1, mix(WALL, '#000000', 0.12));
        }
    }
    cam.rect(ctx, 0, FLOOR_Y - 8, SCENE.w, 7, WALL_TRIM);
    cam.rect(ctx, 0, FLOOR_Y - 8, SCENE.w, 1, mix(WALL_TRIM, '#ffffff', 0.22));
    cam.rect(ctx, 0, FLOOR_Y - 1, SCENE.w, 1, '#3c2c1c');

    floor(ctx, cam);
}

// Ahşap parke zemin: yatay tahtalar, akşam ışığında ılık ton
function floor(ctx, cam) {
    const PLANK = 7;
    let row = 0;
    for (let y = FLOOR_Y; y < SCENE.h; y += PLANK) {
        const rowTone = row % 2 === 0 ? FLOOR_A : FLOOR_B;
        for (let x = -((row * 11) % 30); x < SCENE.w; x += 30) {
            const tone = mix(rowTone, '#000000', hash(x, row, 9) * 0.08);
            cam.rect(ctx, x, y, 29, PLANK - 0.5, tone);
            cam.rect(ctx, x, y, 29, 0.6, mix(tone, '#ffffff', 0.15));
            cam.rect(ctx, x + 28, y, 1, PLANK - 0.5, FLOOR_SEAM);
        }
        cam.rect(ctx, 0, y + PLANK - 0.5, SCENE.w, 0.6, FLOOR_SEAM);
        row++;
    }
}

// Pencere: dışarısı akşam - koyu mor-mavi, içeride perde
function windowEvening(ctx, cam) {
    const x = 18, y = 14, w = 32, h = 30;
    cam.rect(ctx, x - 3, y - 3, w + 6, h + 6, '#7a6144');
    cam.rect(ctx, x, y, w, h, '#2c2c44');
    vBands(ctx, cam, x + 2, y + 2, w - 4, h - 4, '#3a3a5c', '#1c1c30', 5);
    cam.rect(ctx, x + w * 0.62, y + h * 0.22, 3, 3, '#e8dfa0');
    cam.glow(ctx, x + w * 0.62, y + h * 0.22, 7, 'rgba(230,220,160,ALPHA)', 0.3);
    cam.rect(ctx, x + w / 2 - 1, y, 2, h, WALL_TRIM);
    cam.rect(ctx, x, y + h / 2 - 1, w, 2, WALL_TRIM);
    // Perdeler: iki yana çekilmiş
    const curtain = '#8a3b38';
    cam.rect(ctx, x - 5, y - 4, 6, h + 10, curtain);
    cam.rect(ctx, x - 5, y - 4, 2, h + 10, mix(curtain, '#ffffff', 0.18));
    cam.rect(ctx, x + w - 1, y - 4, 6, h + 10, curtain);
    cam.rect(ctx, x + w + 3, y - 4, 2, h + 10, mix(curtain, '#000000', 0.2));
    cam.rect(ctx, x - 7, y - 6, w + 14, 3, WALL_TRIM);
}

// Kitaplık: bilim insanı havası
function bookshelf(ctx, cam) {
    const x = 122, y = FLOOR_Y - 52, w = 30, h = 52;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 1, '#3f2f1e');
    cam.rect(ctx, x, y, w, h, '#6b4a2c');
    for (const sy of [y + 3, y + h * 0.36, y + h * 0.68]) {
        cam.rect(ctx, x + 1, sy, w - 2, 1.4, '#3f2f1e');
        let bx = x + 2;
        let i = 0;
        while (bx < x + w - 3) {
            const bw = 2.6 + hash(i, sy, 3) * 2.2;
            const bh = 7 + hash(i, sy, 7) * 4;
            const tone = mix('#8a4a3a', '#3a5a6a', hash(i, sy, 11));
            cam.rect(ctx, bx, sy - bh, bw, bh, tone);
            cam.rect(ctx, bx, sy - bh, bw, 1, mix(tone, '#ffffff', 0.25));
            bx += bw + 0.6;
            i++;
        }
    }
    cam.rect(ctx, x, y + h - 1, w, 1, '#2c2014');
}

// Kapı: arkadaş buradan giriyor, koridor ışığı arkasından vuruyor
function doorway(ctx, cam, glow) {
    const x = 196, w = 28, y = CEIL_H + 2, h = FLOOR_Y - y - 8;
    cam.rect(ctx, x - 3, y - 3, w + 6, h + 4, WALL_TRIM);
    cam.rect(ctx, x, y, w, h, mix('#3a2f24', '#f0e4b8', 0.18 + glow * 0.35));
    if (glow > 0) cam.glow(ctx, x + w / 2, y + h * 0.4, 22, 'rgba(240,225,180,ALPHA)', glow * 0.3);
}

// --- Koltuk: bizimki bunun içinde oturuyor ---
function armchair(ctx, cam, x, seatY) {
    const backTop = seatY - 30;
    cam.rect(ctx, x - 15, backTop, 30, 30, '#8a3b38');
    cam.rect(ctx, x - 15, backTop, 6, 30, mix('#8a3b38', '#ffffff', 0.1));
    cam.rect(ctx, x + 9, backTop, 6, 30, mix('#8a3b38', '#000000', 0.2));
    for (let i = 0; i < 2; i++) {
        cam.rect(ctx, x - 6 + i * 9, backTop + 8, 2, 2, '#5c211f');
    }
    cam.rect(ctx, x - 18, seatY - 6, 36, 8, '#7a332f');
    cam.rect(ctx, x - 18, seatY - 6, 36, 1.4, mix('#7a332f', '#ffffff', 0.2));
    // Kol dayamaları
    for (const s of [-1, 1]) {
        cam.rect(ctx, x + s * 19 - 4, seatY - 20, 8, 20, '#7a332f');
        cam.rect(ctx, x + s * 19 - 4, seatY - 20, 8, 1.4, mix('#7a332f', '#ffffff', 0.22));
    }
    // Ayaklar
    for (const s of [-1, 1]) cam.rect(ctx, x + s * 14, seatY + 4, 3, FLOOR_Y - seatY - 4, '#3f2c1e');
}

// Yan sehpa + lamba: odanın sıcak ışık kaynağı
function sideTable(ctx, cam, x) {
    const topY = SEAT_Y - 14;
    cam.rect(ctx, x - 9, topY, 18, 2.4, '#5c4530');
    cam.rect(ctx, x - 2, topY + 2.4, 4, FLOOR_Y - topY - 2.4, '#43301e');
    cam.rect(ctx, x - 3, topY - 10, 2, 10, '#33261a');
    cam.rect(ctx, x - 6, topY - 18, 12, 9, '#d8c88a');
    cam.rect(ctx, x - 6, topY - 18, 12, 2, mix('#d8c88a', '#ffffff', 0.3));
    cam.glow(ctx, x, topY - 14, 24, 'rgba(250,225,150,ALPHA)', 0.28);
    // Fincan
    cam.rect(ctx, x + 6, topY - 2.4, 4, 2.4, '#e8e2d0');
}

// --- Gazete: açık, sütunlar okunmuyor (ch1'deki notla aynı kural) ---
function newspaper(ctx, cam, x, y, w, h) {
    cam.rect(ctx, x - w / 2 - 0.6, y - 0.6, w + 1.2, h + 1.2, '#8a8168');
    cam.rect(ctx, x - w / 2, y, w, h, '#e8e2cf');
    cam.rect(ctx, x - 0.4, y, 0.8, h, '#c9c2a8');
    for (let side = 0; side < 2; side++) {
        const cx = x - w / 2 + side * w / 2;
        cam.rect(ctx, cx + w * 0.08, y + h * 0.1, w * 0.3, h * 0.14, '#a89f84');
        for (let i = 0; i < 5; i++) {
            cam.rect(ctx, cx + w * 0.08, y + h * 0.32 + i * h * 0.11, w * 0.34, h * 0.05, '#b6ad91');
        }
    }
}

// --- Oturan, gazete okuyan bizimki ---
//
// Yüzü AYRINTILI: iki parçalı kaş, ışık noktalı gözler, burun köprüsü,
// üst-alt dudak, parmak izleri - 3. bölümdeki tekniklerin aynısı.
function bizPerson(ctx, cam, p) {
    const { x, headTurn = 1, lean = 0, paperUp = 0, talk = 0 } = p;
    const skin = BIZ_SKIN, skinShade = mix(skin, '#000000', 0.24), skinLit = mix(skin, '#ffffff', 0.12);
    const mouth = mix(skin, '#7a3f38', 0.4);
    const hipX = x + lean * 2;

    // Bacaklar
    for (const s of [-1, 1]) {
        const kx = hipX + 13;
        const ky = SEAT_Y + s * 1.2;
        limbCells(ctx, cam, hipX + s * 2, SEAT_Y, kx, ky, 4.4, BIZ_TROUSER);
        limbCells(ctx, cam, kx, ky, kx, FLOOR_Y - 1, 4, BIZ_TROUSER);
        cam.rect(ctx, kx - 2, FLOOR_Y - 2, 7, 2, '#1d2126');
    }

    // Gövde: hırka + içindeki gömlek yakası
    const torsoH = 27;
    const shoulderY = SEAT_Y - torsoH;
    const coatW = 21;
    cam.rect(ctx, hipX - coatW / 2, shoulderY + 1, coatW, torsoH - 1, BIZ_CARDIGAN);
    cam.rect(ctx, hipX - coatW / 2, shoulderY + 1, coatW * 0.24, torsoH - 1, mix(BIZ_CARDIGAN, '#ffffff', 0.15));
    cam.rect(ctx, hipX + coatW * 0.26, shoulderY + 1, coatW * 0.24, torsoH - 1, BIZ_CARDIGAN_SHADE);
    cam.rect(ctx, hipX - 3.2, shoulderY + 1.4, 6.4, torsoH * 0.6, BIZ_SHIRT);
    cam.rect(ctx, hipX - 2.6, shoulderY + 3, 5.2, 3.4, skinShade);
    for (let i = 0; i < 3; i++) cam.rect(ctx, hipX + 0.6, shoulderY + 7 + i * 5.6, 1.2, 1.2, mix(BIZ_CARDIGAN, '#000000', 0.35));

    // Kollar: paperUp > 0 iken gazeteyi tutmak için yukarı kalkık
    for (const s of [-1, 1]) {
        const sx = hipX + s * coatW * 0.42;
        const sy = shoulderY + 2;
        const ex = lerp(sx + s * 4, hipX + s * 6, paperUp);
        const ey = lerp(sy + torsoH * 0.55, shoulderY - 8 - talk * 2, paperUp);
        const hx = lerp(hipX + s * 8, hipX + s * 4, paperUp);
        const hy = lerp(SEAT_Y - 5, shoulderY - 10 - talk * 2, paperUp);
        limbCells(ctx, cam, sx, sy, ex, ey, 3.6, BIZ_CARDIGAN);
        limbCells(ctx, cam, ex, ey, hx, hy, 3.2, BIZ_CARDIGAN);
        cam.rect(ctx, hx - 2, hy - 1.7, 4, 3.4, skin);
        for (let i = 0; i < 3; i++) cam.rect(ctx, hx - 1.6 + i * 1.3, hy + 1, 1, 0.8, skinShade);
    }

    // Baş
    const hx = hipX + headTurn * 1.6;
    const hy = shoulderY - 12.4;
    const headW = 12, headH = 12.6;
    cam.rect(ctx, hipX - 2.4, shoulderY - 3, 4.8, 4, skinShade);
    cam.rect(ctx, hx + headTurn * headW * 0.5 - 1, hy + headH * 0.4, 1.6, headH * 0.24, skinShade);
    cam.rect(ctx, hx - headW / 2, hy, headW, headH, skin);
    cam.rect(ctx, hx - headW / 2, hy, headW * 0.2, headH, skinShade);
    cam.rect(ctx, hx + headW * 0.34, hy, headW * 0.16, headH, skinLit);
    cam.rect(ctx, hx - headW * 0.1, hy + headH * 0.74, headW * 0.5, headH * 0.16, mix(skinShade, skin, 0.35));

    const eyeY = hy + headH * 0.46;
    const eyeW = 1.9, eyeH = 1.4, gap = 2.3;
    const fx = headTurn * 1.4;
    for (const s of [-1, 1]) {
        cam.rect(ctx, hx + fx + s * gap - eyeW * 0.6, eyeY - eyeH * 1.7, eyeW * 0.9, eyeH * 0.55, BIZ_HAIR);
        cam.rect(ctx, hx + fx + s * gap - eyeW * 0.6 + (s > 0 ? eyeW * 0.6 : -eyeW * 0.15), eyeY - eyeH * 1.5, eyeW * 0.55, eyeH * 0.4, BIZ_HAIR);
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2, eyeY, eyeW, eyeH, '#20242a');
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2 + 0.3, eyeY + 0.2, 0.6, 0.5, '#eceadd');
    }
    cam.rect(ctx, hx + fx - 0.5, eyeY - eyeH * 0.2, 1, eyeH * 1.5, mix(skin, skinShade, 0.3));
    cam.rect(ctx, hx + fx + 1.1, eyeY + eyeH * 1.1, eyeW * 0.65, eyeH * 0.6, skinShade);
    cam.rect(ctx, hx + fx - 1.5 + talk * 0.3, eyeY + eyeH * 3, 3.2 - talk * 0.6, 0.6, mix(mouth, '#000000', 0.25));
    cam.rect(ctx, hx + fx - 1.4 + talk * 0.3, eyeY + eyeH * 3.5, 3 - talk * 0.6, 1 + talk * 0.9, mouth);

    cam.rect(ctx, hx - headW / 2 - 0.8, hy - 1.6, headW + 1.6, headH * 0.34, BIZ_HAIR);
    cam.rect(ctx, hx - headW * 0.3, hy - 1.6, headW * 0.22, headH * 0.14, mix(BIZ_HAIR, '#ffffff', 0.14));
    cam.rect(ctx, hx - headW * 0.52, hy + headH * 0.1, headW * 0.2, headH * 0.5, BIZ_HAIR);
    // Dağınık bir tutam - evde rahat oturuyor
    cam.rect(ctx, hx - headW * 0.05, hy - 2.6, headW * 0.16, 2, BIZ_HAIR);

    if (paperUp > 0.1) newspaper(ctx, cam, hipX + 4, shoulderY - 26 * paperUp, 30, 22 * paperUp);
    else if (paperUp <= 0.1) newspaper(ctx, cam, hipX + 3, SEAT_Y - 9, 26, 16);
}

// --- Arkadaş: yüzü YOK, sadece saçla kaplı düz bir kafa. Turuncu bant tek işaret ---
function friendPerson(ctx, cam, p) {
    const { x, dir = -1, armRaise = 0, talk = 0 } = p;
    const skin = FRIEND_SKIN, skinShade = mix(skin, '#000000', 0.22);
    // Bel yerden 24 hücre yukarıda: bacaklar gövdeyle orantılı uzun
    const hipY = FLOOR_Y - 24;

    for (const s of [-1, 1]) {
        const hipX = x + s * 2;
        limbCells(ctx, cam, hipX, hipY, hipX, FLOOR_Y - 1, 4.6, s > 0 ? FRIEND_TROUSER : mix(FRIEND_TROUSER, '#000000', 0.18));
        cam.rect(ctx, hipX - 2.4, FLOOR_Y - 2, 6, 2, '#0f1215');
    }

    const torsoH = 29;
    const shoulderY = hipY - torsoH;
    const coatW = 21;
    cam.rect(ctx, x - coatW / 2, shoulderY + 1, coatW, torsoH - 1, FRIEND_COAT);
    cam.rect(ctx, x - coatW / 2, shoulderY + 1, coatW * 0.24, torsoH - 1, mix(FRIEND_COAT, '#ffffff', 0.1));
    cam.rect(ctx, x + coatW * 0.26, shoulderY + 1, coatW * 0.24, torsoH - 1, FRIEND_COAT_SHADE);
    cam.rect(ctx, x - 1.2, shoulderY + 3, 2.4, torsoH - 5, mix(FRIEND_COAT_SHADE, '#000000', 0.15));

    // Kollar: biri sakin, biri konuşurken jest yapıyor - bant o kolda
    const idleSx = x - coatW * 0.42;
    const idleSy = shoulderY + 2;
    limbCells(ctx, cam, idleSx, idleSy, idleSx - 2, idleSy + torsoH * 0.55, 3.8, FRIEND_COAT);
    limbCells(ctx, cam, idleSx - 2, idleSy + torsoH * 0.55, x - 6, hipY - 3, 3.4, FRIEND_COAT);
    cam.rect(ctx, x - 8, hipY - 6, 4.4, 3.6, skin);

    const gestSx = x + coatW * 0.42;
    const gestSy = shoulderY + 2;
    const raise = clamp01(armRaise);
    const ex = lerp(gestSx + 4, gestSx + 8, raise);
    const ey = lerp(gestSy + torsoH * 0.35, gestSy + torsoH * 0.1, raise);
    const handX = lerp(x + 10, x + 16, raise);
    const handY = lerp(hipY - 4, shoulderY + torsoH * 0.15 - talk * 2, raise);
    limbCells(ctx, cam, gestSx, gestSy, ex, ey, 3.8, FRIEND_COAT);
    limbCells(ctx, cam, ex, ey, handX, handY, 3.4, FRIEND_COAT);
    cam.rect(ctx, handX - 2.2, handY - 1.8, 4.4, 3.6, skin);
    for (let i = 0; i < 3; i++) cam.rect(ctx, handX - 1.7 + i * 1.4, handY + 1.1, 1, 0.8, skinShade);
    // TURUNCU BANT: bileğin biraz yukarısında, kolun %70'inde
    const bandX = lerp(gestSx, handX, 0.68);
    const bandY = lerp(gestSy, handY, 0.68);
    cam.rect(ctx, bandX - 2.4, bandY - 1.6, 4.8, 3.2, BAND_COLOR);
    cam.rect(ctx, bandX - 2.4, bandY - 1.6, 4.8, 1, mix(BAND_COLOR, '#ffffff', 0.3));

    // Yaka
    cam.rect(ctx, x - 2.4, shoulderY, 4.8, 3, mix(FRIEND_COAT, '#000000', 0.12));

    // --- Kafa: YÜZ YOK. Sadece saçla kaplı düz bir şekil. ---
    const hx = x + dir * -1.2;
    const hy = shoulderY - 13;
    const headW = 12.4, headH = 13;
    cam.rect(ctx, x - 2.6, shoulderY - 3, 5.2, 4, skinShade);
    // Baş tamamen saçla kaplı: ten sadece boyunda, yüz diye bir şey yok
    cam.rect(ctx, hx - headW / 2, hy, headW, headH, FRIEND_HAIR);
    cam.rect(ctx, hx - headW / 2, hy + headH * 0.78, headW, headH * 0.22, mix(FRIEND_HAIR, '#000000', 0.2));
    cam.rect(ctx, hx + headW * 0.12, hy + 1, headW * 0.26, headH * 0.4, mix(FRIEND_HAIR, '#ffffff', 0.12));
    cam.rect(ctx, hx - headW * 0.08, hy - 2, headW * 0.2, 2.2, FRIEND_HAIR);
}

// --- Sahne ---

function scene(ctx, cam, s) {
    walls(ctx, cam);
    windowEvening(ctx, cam);
    bookshelf(ctx, cam);
    doorway(ctx, cam, s.doorGlow || 0);

    armchair(ctx, cam, SEAT_X, SEAT_Y);
    sideTable(ctx, cam, SEAT_X + 26);
    bizPerson(ctx, cam, s.biz);
    if (s.friend) friendPerson(ctx, cam, s.friend);

    vignette(ctx, 0.36);
}

const BIZ_BASE = { x: SEAT_X };
const FRIEND_BASE = { x: STAND_X, dir: -1 };

// =================== KARELER ===================

// --- 1. HAREKETLİ: arkadaş kapıdan giriyor, bizimki gazeteyi indiriyor ---
function homeEnter(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const walk = easeOut(span(t, 0.08, 0.85));
    const lower = span(t, 0.55, 0.95);
    const fx = lerp(DOOR_X, STAND_X, walk);
    scene(ctx, cam, {
        doorGlow: 1 - span(t, 0, 0.5),
        biz: { ...BIZ_BASE, paperUp: 1 - lower },
        friend: walk > 0.01 ? { ...FRIEND_BASE, x: fx } : null
    });
}

// --- 2. "Duydun mu, yeni bir virüs çıkmış." ---
function homeAsk(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0, talk: 1 },
        friend: { ...FRIEND_BASE }
    });
}

// --- 3. "V-986 virüsünü mü diyorsun? Evet, duydum onu." ---
function homeHeard(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0 },
        friend: { ...FRIEND_BASE, armRaise: 0.4, talk: 1 }
    });
}

// --- 4. "Çok hızlı yayılıyormuş, aşısı da yokmuş." ---
function homeDesc(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const raise = 0.4 + easeOut(span(t, 0, 0.6)) * 0.4;
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0 },
        friend: { ...FRIEND_BASE, armRaise: raise, talk: 1 }
    });
}

// --- 5. "Belirtisi olmaması kötü yanı, ama önemli olabilir diye konuşuluyor." ---
function homeWarn(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0 },
        friend: { ...FRIEND_BASE, armRaise: 0.85, talk: 1 }
    });
}

// --- 6. Bizimkinin önerisi: çalışmalıyız, uyarabilmeliyiz ---
function homePropose(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const lean = easeOut(span(t, 0, 0.6)) * 0.4;
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0, lean, talk: 1 },
        friend: { ...FRIEND_BASE, armRaise: 0.1 }
    });
}

// --- 7. "Katılıyorum." ---
function homeAgree(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0, lean: 0.4 },
        friend: { ...FRIEND_BASE, armRaise: 0.2, talk: 1 }
    });
}

// --- 8. Kapanış: "Ben de bilgi toplayayım." ---
function homeClose(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, {
        biz: { ...BIZ_BASE, paperUp: 0, lean: 0.2, talk: 1 },
        friend: { ...FRIEND_BASE, armRaise: 0.15 }
    });
}

export const CHAPTER_4_ART = {
    homeEnter,
    homeAsk,
    homeHeard,
    homeDesc,
    homeWarn,
    homePropose,
    homeAgree,
    homeClose
};
