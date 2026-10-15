// 6. BÖLÜM - DENEY
//
// Harry ile Fred'in laboratuvarı, gündüz. Sağlıklılar yardıma geliyor, bir
// enfekte gönüllü masaya yatıyor, üç bulgu ekranlardan okunuyor ve denek
// ölüyor. Ölüm EKRANDA gösteriliyor - gizem değil.
//
// Oda ve kişiler hücre düzleminde (232x122, bir hücre PX); bulgular tam
// kadraj monitör görüntüleri. Fred'in kolunda turuncu bant yine yerinde.

import { PX, hash } from '../../pixel/pixelDraw.js';
import { drawPixelText } from '../../pixel/pixelFont.js';
import {
    createCam, vignette, mix, BAND_COLOR,
    span, clamp01, easeOut, lerp
} from '../comicKit.js';

const SCENE = { w: 232, h: 122 };
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };

const CEIL_H = 8;
const FLOOR_Y = 100;

const DOOR = { x: 4, w: 28 };         // sol: sağlıklılar buradan giriyor
const TABLE = { x: 86, w: 58, top: 74 };
const HARRY_X = 170;
const FRED_X = 194;

const GREEN = '#3f9a28';
const WALL = '#cfd6d9';
const WALL_SEAM = '#b4bec3';

// Harry: iri, geniş omuzlu, açık tenli, kumral zülüflü, gözlüklü, mavi gömlek-kravat.
// Fred: kısa, ince, esmer, simsiyah kısa dik saçlı, kirli sakallı, siyah boğazlı.
const HARRY = { coat: '#e8ecee', shade: '#b9c1c6', skin: '#e0b48c', hair: '#9a6a36', trouser: '#3a4048',
    torsoH: 32, coatW: 23, leg: 26, headW: 13.4, headH: 14, hairStyle: 'side', glasses: true, shirt: '#35507a', tie: true };
const FRED = { coat: '#e1e5e7', shade: '#aeb6bb', skin: '#a8754c', hair: '#120e0c', trouser: '#2c2f33', band: true,
    torsoH: 26, coatW: 17, leg: 22, headW: 11.2, headH: 12, hairStyle: 'spiky', stubble: true, shirt: '#1b1d20' };
const HELPERS = [
    { coat: '#6b7d5e', shade: '#4c5b42', skin: '#a8825f', hair: '#241f1b', trouser: '#3b3630', x: 76, from: -24 },
    { coat: '#5e6b8a', shade: '#444f68', skin: '#d0aa84', hair: '#5a4326', trouser: '#2c3138', x: 58, from: -46 },
    { coat: '#8a6a5e', shade: '#68493e', skin: '#8f6a4c', hair: '#161514', trouser: '#333a33', x: 40, from: -68 }
];

function limbCells(ctx, cam, x0, y0, x1, y1, thick, color) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        cam.rect(ctx, x0 + (x1 - x0) * k - thick / 2, y0 + (y1 - y0) * k - thick / 2, thick, thick, color);
    }
}

// --- Oda ---

function room(ctx, cam, flat = false) {
    // Duvar: açık, karolu
    for (let i = 0; i < 6; i++) {
        cam.rect(ctx, 0, CEIL_H + i * 15, SCENE.w, 15.6, mix('#d8dfe2', WALL, i / 5));
    }
    for (let y = CEIL_H; y < FLOOR_Y; y += 10) cam.rect(ctx, 0, y, SCENE.w, 0.8, WALL_SEAM);
    for (let x = 0; x < SCENE.w; x += 12) cam.rect(ctx, x, CEIL_H, 0.8, FLOOR_Y - CEIL_H, WALL_SEAM);
    cam.rect(ctx, 0, 0, SCENE.w, CEIL_H, '#9aa4a9');
    // Tavan ışıkları
    for (const lx of [50, 120, 190]) {
        cam.rect(ctx, lx - 12, 2, 24, 4, '#f4f7f0');
        cam.glow(ctx, lx, 8, 34, 'rgba(255,252,235,ALPHA)', 0.16);
    }
    cam.rect(ctx, 0, FLOOR_Y - 5, SCENE.w, 5, '#8b969c');

    // Zemin
    for (let y = FLOOR_Y; y < SCENE.h; y += 7) {
        for (let x = ((y / 7) % 2) * 9 - 9; x < SCENE.w; x += 18) {
            cam.rect(ctx, x, y, 17.4, 6.4, hash(x, y, 4) > 0.5 ? '#8f989d' : '#868f94');
        }
    }

    // Kapı (sol)
    cam.rect(ctx, DOOR.x - 2, CEIL_H + 4, DOOR.w + 4, FLOOR_Y - CEIL_H - 4, '#6c777d');
    cam.rect(ctx, DOOR.x, CEIL_H + 6, DOOR.w, FLOOR_Y - CEIL_H - 6, '#e9efe6');
    cam.glow(ctx, DOOR.x + DOOR.w / 2, 50, 30, 'rgba(255,255,240,ALPHA)', 0.2);

    // Sağ: tezgah + mikroskop + şişeler + raf
    benchProps(ctx, cam);

    // Masanın üstünde duvar monitörü: nabız, oksijen, tansiyon
    wallMonitor(ctx, cam, 100, 17, flat);
}

function benchProps(ctx, cam) {
    // Raf (duvarda) ve üstünde şişeler
    cam.rect(ctx, 202, 40, 30, 2, '#5f6a70');
    cam.rect(ctx, 202, 42, 30, 1, '#8b969c');
    cam.rect(ctx, 204, 42, 1.4, 4, '#5f6a70');
    cam.rect(ctx, 229, 42, 1.4, 4, '#5f6a70');
    const jars = ['#7fb8a4', '#d8b46a', '#a68fc4', '#8fb7d8', '#c98a7a'];
    for (let i = 0; i < jars.length; i++) {
        const jx = 204 + i * 5.4, jh = 6 + (i % 2) * 2;
        cam.rect(ctx, jx, 40 - jh, 4, jh, mix(jars[i], '#000000', 0.12));
        cam.rect(ctx, jx, 40 - jh, 1, jh, mix(jars[i], '#ffffff', 0.35));
        cam.rect(ctx, jx + 3, 40 - jh, 1, jh, mix(jars[i], '#000000', 0.3));
        cam.rect(ctx, jx + 0.5, 40 - jh - 1.2, 3, 1.2, '#4a555b');
        cam.rect(ctx, jx + 1, 40 - jh * 0.55, 2, 1.6, '#e8ecee');
    }
    // Tezgah: üst yüzey, çekmeceler, kapak
    cam.rect(ctx, 202, 70, 34, 4, '#4f5a60');
    cam.rect(ctx, 202, 70, 34, 1, '#9aa6ab');
    cam.rect(ctx, 206, 74, 28, FLOOR_Y - 74, '#79858b');
    cam.rect(ctx, 206, 74, 1.4, FLOOR_Y - 74, '#93a0a6');
    cam.rect(ctx, 232.6, 74, 1.4, FLOOR_Y - 74, '#5d686e');
    for (let i = 0; i < 2; i++) {
        const dy = 77 + i * 11;
        cam.rect(ctx, 208, dy, 24, 9, '#6d797f');
        cam.rect(ctx, 208, dy, 24, 1, '#8f9ba1');
        cam.rect(ctx, 208, dy + 8, 24, 1, '#566268');
        cam.rect(ctx, 217, dy + 3.6, 6, 1.4, '#c2cbcf');
    }
    cam.rect(ctx, 208, 100 - 2, 24, 0, '#566268');
    // Mikroskop: taban, kol, tüp, lens, ayna
    cam.rect(ctx, 209, 67, 12, 3, '#262f34');
    cam.rect(ctx, 209, 67, 12, 1, '#3d4a51');
    cam.rect(ctx, 217, 55, 3, 12, '#2f3a40');
    cam.rect(ctx, 217, 55, 1, 12, '#46545b');
    cam.rect(ctx, 212, 54, 6, 3, '#2f3a40');
    cam.rect(ctx, 211, 50, 3, 6, '#46545b');
    cam.rect(ctx, 210.5, 48, 4, 2.4, '#1e262a');
    cam.rect(ctx, 211, 56, 2, 4, '#7d8b92');
    cam.rect(ctx, 210.5, 60, 3, 1.4, '#c8d3d8');
    cam.rect(ctx, 213, 64, 5, 1.4, '#9cc4d4');
    cam.rect(ctx, 214, 62, 2.4, 1, '#566268');
    // Erlenmayer ve deney tüpleri
    cam.rect(ctx, 224, 66, 6, 4, '#a9d4c0');
    cam.rect(ctx, 225, 62, 4, 4, 'rgba(210,235,230,0.8)');
    cam.rect(ctx, 226, 59, 2, 3, 'rgba(210,235,230,0.8)');
    cam.rect(ctx, 224, 66, 1, 4, '#dff2ec');
    cam.rect(ctx, 224.6, 67.6, 4.8, 1, '#3f9a28');
    for (let i = 0; i < 3; i++) {
        cam.rect(ctx, 231 + i * 1.8, 64, 1.2, 6, ['#d86a5a', '#6aa0d8', '#e8d070'][i]);
        cam.rect(ctx, 231 + i * 1.8, 64, 1.2, 1, '#ffffff');
    }
    cam.rect(ctx, 230, 70, 6, 1, '#2f3a40');
}

// Yeşil nabız çizgili hasta monitörü: çerçeve, ızgara, dalga, sayılar
function wallMonitor(ctx, cam, x, y, flat = false) {
    const w = 34, h = 24;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#1b2226');
    cam.rect(ctx, x, y, w, h, '#2f3a40');
    cam.rect(ctx, x, y, w, 1, '#46545b');
    cam.rect(ctx, x + 2, y + 2, w - 4, h - 6, '#08130e');
    cam.rect(ctx, x + w - 6, y + h - 3, 1.6, 1.6, '#d04a3a');
    cam.rect(ctx, x + w - 3.6, y + h - 3, 1.6, 1.6, '#6bdc5a');
    cam.rect(ctx, x + 3, y + h - 3, 8, 1.2, '#1b2226');
    // ızgara
    for (let gx = x + 4; gx < x + w - 3; gx += 4) cam.rect(ctx, gx, y + 2, 0.5, h - 6, 'rgba(107,220,90,0.14)');
    for (let gy = y + 5; gy < y + h - 4; gy += 4) cam.rect(ctx, x + 2, gy, w - 4, 0.5, 'rgba(107,220,90,0.14)');
    // nabız dalgası (P-QRS-T)
    const base = y + 12;
    const wave = flat ? [0] : [0, 0, 0, 0, -1, -1, 0, 0, 0, 1, -7, 5, 0, 0, -1, -2, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < w - 6; i++) {
        const v = wave[i % wave.length];
        cam.rect(ctx, x + 3 + i, base + v, 1, 1, '#6bdc5a');
        cam.rect(ctx, x + 3 + i, base + v + 1, 1, 0.5, 'rgba(107,220,90,0.4)');
    }
    // alt şerit: iki küçük gösterge çubuğu
    cam.rect(ctx, x + 3, y + h - 8, 5, 1, '#6bdc5a');
    cam.rect(ctx, x + 10, y + h - 8, 3, 1, '#d8c45a');
}

// Muayene masası
function table(ctx, cam) {
    const { x, w, top } = TABLE;
    for (const lx of [x + 4, x + w - 7]) cam.rect(ctx, lx, top + 4, 3, FLOOR_Y - top - 4, '#7b878d');
    cam.rect(ctx, x, top, w, 4, '#a8b4ba');
    cam.rect(ctx, x, top, w, 1, '#d4dde0');
    cam.rect(ctx, x + 2, top + 4, w - 4, 2, '#7b878d');
}

// Serum askısı ve torba
function drip(ctx, cam, x) {
    cam.rect(ctx, x, 26, 2, FLOOR_Y - 26, '#8a959b');
    cam.rect(ctx, x - 5, 26, 12, 2, '#8a959b');
    cam.rect(ctx, x - 4, 28, 5, 9, '#d6eee8');
    cam.rect(ctx, x - 4, 28, 5, 1, '#ffffff');
    cam.rect(ctx, x - 2, 37, 1, 22, '#c8d6d2');
}

// --- Hasta masada: sırtüstü yatıyor, örtünün altında vücut hatları belli,
// kolu yeşil ve masanın kenarından aşağı sarkıyor ---
function patient(ctx, cam, { breath = 0, dead = false, worse = false } = {}) {
    const top = TABLE.top;
    const bx = TABLE.x + 2;
    const lift = dead ? 0 : Math.sin(breath) * 0.6;
    const gone = dead || worse;
    const skin = mix('#c99a6e', '#8aa070', gone ? 0.55 : 0.35);
    const skinShade = mix(skin, '#000000', 0.2);
    const sheet = '#9fb3c4', sheetHi = '#c3d3e0', sheetLo = '#7f95a8';

    // Şilte
    cam.rect(ctx, bx, top - 2, TABLE.w - 4, 2, '#d6dfe2');
    cam.rect(ctx, bx, top - 2, TABLE.w - 4, 0.6, '#eef3f4');

    // Yastık
    cam.rect(ctx, bx + 1, top - 5, 15, 3, '#e6ecee');
    cam.rect(ctx, bx + 1, top - 5, 15, 0.8, '#ffffff');
    cam.rect(ctx, bx + 1, top - 2.8, 15, 0.8, '#bcc7cb');

    // Baş (yastığa gömülü), kulak, saç, yüz
    const hx = bx + 3, hy = top - 13;
    cam.rect(ctx, hx, hy + 2, 11, 9, skin);
    cam.rect(ctx, hx + 1, hy + 1, 9, 1.4, skin);
    cam.rect(ctx, hx + 9, hy + 5, 1.6, 3, skinShade);
    cam.rect(ctx, hx - 0.8, hy + 5, 1.2, 3, skinShade);
    cam.rect(ctx, hx - 0.4, hy, 12, 3.4, '#3f2c1e');
    cam.rect(ctx, hx - 0.6, hy + 2, 1.8, 4, '#3f2c1e');
    cam.rect(ctx, hx + 8.6, hy + 2.6, 2.4, 2, '#3f2c1e');
    cam.rect(ctx, hx + 1, hy + 3, 7, 0.8, '#5a4026');
    const eye = dead ? '#3a4a30' : '#20242a';
    cam.rect(ctx, hx + 2, hy + 6, 2, 0.8, eye);
    cam.rect(ctx, hx + 6, hy + 6, 2, 0.8, eye);
    cam.rect(ctx, hx + 2, hy + 5, 2, 0.5, '#4a3524');
    cam.rect(ctx, hx + 6, hy + 5, 2, 0.5, '#4a3524');
    cam.rect(ctx, hx + 4.6, hy + 6.6, 0.9, 2.2, skinShade);
    cam.rect(ctx, hx + 3.6, hy + 9, 2.8, 0.8, mix(skin, '#7a3f38', 0.5));
    cam.rect(ctx, hx + 1, hy + 9.6, 8, 1.2, skinShade);
    if (gone) {
        // Yüzde belirgin yeşil damarlar
        const vein = '#2a6a1c';
        cam.rect(ctx, hx + 2.4, hy + 3.4, 0.8, 2, vein);
        cam.rect(ctx, hx + 3.2, hy + 5.2, 0.8, 1.6, vein);
        cam.rect(ctx, hx + 7.4, hy + 3.6, 0.8, 2.6, vein);
        cam.rect(ctx, hx + 6.6, hy + 7.2, 0.8, 2, vein);
        cam.rect(ctx, hx + 1.6, hy + 7.4, 0.8, 2, vein);
    }

    // Örtü altında gövde: omuz, göğüs (nefesle kalkıyor), kalça, bacaklar, ayak ucu
    const x0 = bx + 16;
    const parts = [
        { x: 0, w: 4, h: 8 },
        { x: 4, w: 10, h: 9 + lift },
        { x: 14, w: 8, h: 7 },
        { x: 22, w: 10, h: 5.4 },
        { x: 32, w: TABLE.w - 4 - 16 - 32, h: 7.4 }
    ];
    for (const p of parts) {
        cam.rect(ctx, x0 + p.x, top - 2 - p.h, p.w, p.h, sheet);
        cam.rect(ctx, x0 + p.x, top - 2 - p.h, p.w, 0.8, sheetHi);
    }
    // Örtü katları
    cam.rect(ctx, x0 + 3, top - 9, 1, 7, sheetLo);
    cam.rect(ctx, x0 + 13, top - 8, 1, 6, sheetLo);
    cam.rect(ctx, x0 + 21.4, top - 6, 1, 4, sheetLo);
    cam.rect(ctx, x0 + 4, top - 4.4, 24, 0.7, sheetLo);
    cam.rect(ctx, x0 + 2, top - 3, TABLE.w - 24, 1, sheetLo);
    // Ayak ucu iki küçük tümsek
    cam.rect(ctx, x0 + 36, top - 9.4, 2.6, 2, sheet);
    cam.rect(ctx, x0 + 39.4, top - 8.6, 2.2, 1.4, sheet);

    // Kol: omuzdan çıkıp örtünün önünden masa kenarına iniyor, sonra sarkıyor
    const green = mix('#c99a6e', GREEN, gone ? 0.95 : 0.75);
    const hang = top + (dead ? 15 : 11);
    const ax = x0 + 18;
    limbCells(ctx, cam, x0 + 5, top - 8, ax, top - 2.5, 3.2, mix('#c99a6e', GREEN, 0.5));
    limbCells(ctx, cam, ax, top - 2.5, ax + 1, hang, 3.2, green);
    // El: avuç ve parmak ucu
    cam.rect(ctx, ax - 1, hang - 1, 4.6, 3.6, mix('#c99a6e', GREEN, 0.7));
    cam.rect(ctx, ax - 0.6, hang + 2.4, 1, 1.6, mix('#c99a6e', GREEN, 0.7));
    cam.rect(ctx, ax + 1, hang + 2.6, 1, 1.8, mix('#c99a6e', GREEN, 0.7));
    cam.rect(ctx, ax + 2.4, hang + 2.4, 1, 1.4, mix('#c99a6e', GREEN, 0.7));
    // Damarlar
    limbCells(ctx, cam, ax + 0.4, top - 1.5, ax + 1, hang - 1, 0.8, '#1f5a16');
    limbCells(ctx, cam, x0 + 6, top - 7.4, ax - 1, top - 3.4, 0.8, '#2a6a1c');
    // Masa kenarındaki gölge
    cam.rect(ctx, ax - 1.4, top, 4.6, 1, 'rgba(0,0,0,0.2)');
}

// --- Ayakta duran kişi: yüz AYRINTILI, bacaklar yürürken açılıyor ---
function stander(ctx, cam, p) {
    const { x, dir = 1, talk = 0, walk = null, band = false, sick = 0, work = null } = p;
    const { coat, shade, skin, hair, trouser } = p;
    const skinShade = mix(skin, '#000000', 0.22);
    const { torsoH = 29, coatW = 20, leg = 24, headW = 12.4, headH = 13, hairStyle = 'plain',
        glasses = false, stubble = false, shirt = null, tie = false } = p;
    const hipY = FLOOR_Y - leg;
    const shoulderY = hipY - torsoH;
    const swing = walk === null ? 0 : Math.sin(walk);
    const bob = walk === null ? 0 : Math.abs(Math.cos(walk)) * 0.8;
    const y0 = -bob;

    for (const s of [-1, 1]) {
        const lx = x + s * 2.4 + swing * s * 3;
        const col = s > 0 ? trouser : mix(trouser, '#000000', 0.18);
        cam.rect(ctx, lx - 3, hipY + 2 + y0, 6, 7, col);
        cam.rect(ctx, lx - 2.6, hipY + 9 + y0, 5.2, 9, col);
        cam.rect(ctx, lx - 2.3, hipY + 18 + y0, 4.6, FLOOR_Y - hipY - 19 - y0, col);
        cam.rect(ctx, lx - 2.8 + dir * 0.6, FLOOR_Y - 2, 6, 2, '#0f1215');
    }

    // Önlük: dizin üstüne iniyor
    cam.rect(ctx, x - coatW / 2, shoulderY + 1 + y0, coatW, torsoH + 8, coat);
    cam.rect(ctx, x - coatW / 2, shoulderY + 1 + y0, coatW * 0.24, torsoH + 8, mix(coat, '#ffffff', 0.18));
    cam.rect(ctx, x + coatW * 0.26, shoulderY + 1 + y0, coatW * 0.24, torsoH + 8, shade);
    cam.rect(ctx, x - 0.6, shoulderY + 3 + y0, 1.2, torsoH + 6, shade);
    // Önlüğün açıklığından görünen gömlek / boğazlı
    if (shirt) {
        cam.rect(ctx, x - 2.6, shoulderY + 1 + y0, 5.2, torsoH * 0.55, shirt);
        cam.rect(ctx, x - 2.6, shoulderY + 1 + y0, 5.2, 1.4, mix(shirt, '#ffffff', 0.25));
        if (tie) cam.rect(ctx, x - 0.7, shoulderY + 3 + y0, 1.4, torsoH * 0.4, '#8a2a2e');
    }
    // Cep ve yaka
    cam.rect(ctx, x + coatW * 0.12, shoulderY + 13 + y0, 4, 1, shade);
    cam.rect(ctx, x + coatW * 0.12, shoulderY + 12 + y0, 4, 0.6, mix(coat, '#ffffff', 0.3));

    // Kollar: yanda sakin; Fred'in sağ bileğinde turuncu bant
    for (const s of [-1, 1]) {
        const sx = x + s * coatW * 0.42;
        const sy = shoulderY + 2 + y0;
        const ex = sx + s * 1.2;
        const ey = sy + torsoH * 0.5;
        let handX = x + s * 10.6 + swing * -s * 2;
        let handY = hipY + 1;
        let elbowX = ex, elbowY = ey;
        if (work && s === dir) {
            // Ön kol tezgâha uzanıyor: dirsek öne, el tezgâh üstünde çalışıyor
            elbowX = sx + s * 6;
            elbowY = sy + torsoH * 0.34;
            handX = x + s * 15;
            handY = work.y + 3;
        }
        limbCells(ctx, cam, sx, sy, elbowX, elbowY, 3.8, coat);
        limbCells(ctx, cam, elbowX, elbowY, handX, handY - 2, 3.4, sick ? mix(coat, GREEN, 0.6 * sick) : coat);
        cam.rect(ctx, handX - 2, handY - 2, 4, 3.6, sick ? mix(skin, GREEN, 0.65 * sick) : skin);
        if (band && s > 0) {
            cam.rect(ctx, handX - 2.1, handY - 4.6, 4.2, 2.4, BAND_COLOR);
            cam.rect(ctx, handX - 2.1, handY - 4.6, 4.2, 0.8, mix(BAND_COLOR, '#ffffff', 0.3));
        }
    }

    // Baş ve yüz
    const hx = x + dir * 1.2;
    const hy = shoulderY - 13 + y0 + sick * 1.6;
    cam.rect(ctx, x - 2.6, shoulderY - 3 + y0, 5.2, 4, skinShade);
    cam.rect(ctx, hx - headW / 2, hy, headW, headH, skin);
    cam.rect(ctx, hx - dir * headW * 0.5 + (dir > 0 ? 0 : -headW * 0.18), hy + headH * 0.55, headW * 0.18, headH * 0.45, skinShade);
    const eyeY = hy + headH * 0.46;
    const fx = dir * 1.6;
    for (const s of [-1, 1]) {
        const ex = hx + fx + s * 2.3;
        cam.rect(ctx, ex - 1, eyeY - 2.3, 2, 0.7, hair);
        cam.rect(ctx, ex - 0.95, eyeY, 1.9, 1.4, '#20242a');
        cam.rect(ctx, ex - 0.65, eyeY + 0.2, 0.6, 0.5, '#eceadd');
    }
    const mouthTone = mix(skin, '#7a3f38', 0.4);
    cam.rect(ctx, hx + fx - 0.5, eyeY, 1, 2.4, mix(skin, skinShade, 0.4));
    cam.rect(ctx, hx + fx + dir * 0.9 - 0.6, eyeY + 2, 1.4, 0.7, skinShade);
    cam.rect(ctx, hx + fx - 1.5, eyeY + 4.2, 3, 0.6, mix(mouthTone, '#000000', 0.25));
    cam.rect(ctx, hx + fx - 1.4, eyeY + 4.7, 2.8, 0.9 + talk * 0.9, mouthTone);
    if (stubble) {
        const st = mix(skin, hair, 0.45);
        cam.rect(ctx, hx - headW / 2 + 0.6, hy + headH * 0.62, headW - 1.2, headH * 0.36, st);
        cam.rect(ctx, hx + fx - 1.5, eyeY + 4.2, 3, 1.6, mouthTone);
    }
    if (glasses) {
        const frame = '#1e1a16';
        for (const s of [-1, 1]) {
            const ex = hx + fx + s * 2.3;
            cam.rect(ctx, ex - 2, eyeY - 1, 4, 0.6, frame);
            cam.rect(ctx, ex - 2, eyeY + 2, 4, 0.6, frame);
            cam.rect(ctx, ex - 2, eyeY - 1, 0.6, 3.6, frame);
            cam.rect(ctx, ex + 1.4, eyeY - 1, 0.6, 3.6, frame);
            cam.rect(ctx, ex - 1.4, eyeY - 0.4, 1, 0.6, 'rgba(255,255,255,0.45)');
        }
        cam.rect(ctx, hx + fx - 0.5, eyeY, 1, 0.6, frame);
    }
    // Saç
    if (hairStyle === 'side') {
        // Yan ayrık, alnın bir kısmını örten uzun perçem, kulak üstü dolgun
        cam.rect(ctx, hx - headW / 2 - 0.8, hy - 1.2, headW + 1.6, headH * 0.34, hair);
        cam.rect(ctx, hx - headW / 2 - 0.8, hy, headW * 0.2, headH * 0.36, hair);
        cam.rect(ctx, hx + headW / 2 - headW * 0.14, hy, headW * 0.22, headH * 0.62, hair);
        // Yüze doğru sarkan perçem sağ tarafta
        cam.rect(ctx, hx + headW * 0.06, hy, headW * 0.44, headH * 0.44, hair);
        cam.rect(ctx, hx - headW * 0.1, hy - 2.4, headW * 0.5, 1.4, mix(hair, '#ffffff', 0.18));
    } else if (hairStyle === 'spiky') {
        // Çok kısa, dik, kenarları traşlı
        cam.rect(ctx, hx - headW / 2 - 0.2, hy - 0.4, headW + 0.4, headH * 0.26, hair);
        for (let i = 0; i < 4; i++) cam.rect(ctx, hx - headW * 0.36 + i * headW * 0.22, hy - 2.4 - (i % 2) * 0.8, headW * 0.14, 2.4, hair);
        cam.rect(ctx, hx - headW / 2 - 0.2, hy, headW * 0.1, headH * 0.34, hair);
        cam.rect(ctx, hx + headW / 2 - headW * 0.06, hy, headW * 0.1, headH * 0.34, hair);
    } else {
        cam.rect(ctx, hx - headW / 2 - 0.6, hy - 0.6, headW + 1.2, headH * 0.36, hair);
        cam.rect(ctx, hx - dir * headW * 0.5 - (dir > 0 ? 0.6 : -0.6) + (dir > 0 ? 0 : -headW * 0.2), hy, headW * 0.2, headH * 0.6, hair);
        cam.rect(ctx, hx - headW * 0.05, hy - 2, headW * 0.22, 2.2, hair);
    }
}

// Masanın yanında küçük çelik araba: hap şişesi ve iki kapsül
function pillTrolley(ctx, cam) {
    const x = 148, y = 78;
    for (const lx of [x + 1, x + 12]) cam.rect(ctx, lx, y + 2, 1.4, FLOOR_Y - y - 2, '#7b878d');
    cam.rect(ctx, x, y, 15, 2, '#a8b4ba');
    cam.rect(ctx, x, y, 15, 0.6, '#d4dde0');
    cam.rect(ctx, x + 1, y + 12, 13, 1.2, '#8a959b');
    // şişe
    cam.rect(ctx, x + 2, y - 7, 5, 7, '#d8a24a');
    cam.rect(ctx, x + 2, y - 7, 1, 7, '#efc77a');
    cam.rect(ctx, x + 2.4, y - 9, 4.2, 2, '#e8ecee');
    cam.rect(ctx, x + 3, y - 4.6, 3, 2.4, '#f4f1e4');
    // kapsüller
    cam.rect(ctx, x + 9, y - 2, 3, 1.6, '#c8322e');
    cam.rect(ctx, x + 11, y - 2, 2, 1.6, '#f4f1e4');
    cam.rect(ctx, x + 10, y - 3.6, 3, 1.6, '#c8322e');
    cam.rect(ctx, x + 12, y - 3.6, 2, 1.6, '#f4f1e4');
}

function scene(ctx, cam, s) {
    room(ctx, cam, s.flat);
    drip(ctx, cam, TABLE.x - 6);
    table(ctx, cam);
    if (s.pill) pillTrolley(ctx, cam);
    if (s.patient) patient(ctx, cam, s.patient);
    for (const h of s.helpers || []) stander(ctx, cam, h);
    stander(ctx, cam, { ...HARRY, x: HARRY_X, dir: -1, ...(s.harry || {}) });
    stander(ctx, cam, { ...FRED, x: FRED_X, dir: -1, ...(s.fred || {}) });
    vignette(ctx, 0.3);
}

// =================== KARELER ===================

// Sağlıklılar kapıdan giriyor, masanın yanına diziliyor
function labHelp(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const helpers = HELPERS.map((h, i) => {
        const k = easeOut(span(t, i * 0.08, 0.75 + i * 0.08));
        const x = lerp(h.from + 20, h.x, k);
        const moving = k > 0 && k < 1;
        return { ...h, x, dir: 1, walk: moving ? t * 44 + i : null };
    });
    scene(ctx, cam, { helpers, fred: { talk: 1 } });
}

// Gönüllü kapıda: sağlıklılar dönmüş ona bakıyor
const VOLUNTEER = { coat: '#7a6a58', shade: '#5a4c3e', skin: '#c99a6e', hair: '#3f2c1e', trouser: '#3b3630', sick: 1 };

function labArrive(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const k = easeOut(span(t, 0, 0.8));
    const x = lerp(-8, 16, k);
    const helpers = HELPERS.map(h => ({ ...h, dir: -1 }));
    helpers.push({ ...VOLUNTEER, x, dir: 1, walk: k < 1 ? t * 40 : null, talk: 1 });
    scene(ctx, cam, { helpers, fred: { talk: 1 } });
}

// Gönüllü masada, sağlıklılar çevresinde
function labPatient(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const helpers = HELPERS.map(h => ({ ...h, dir: 1 }));
    scene(ctx, cam, { helpers, patient: { breath: t * 9 }, harry: { talk: 1 } });
}

// Hap hazır: denek masada, Harry ile Fred konuşuyor, masanın yanında hap arabası
function labPill(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, { pill: true, patient: { breath: t * 9 }, harry: { talk: 1 } });
}

// Zamanla: denek çok kötü, yüzde damarlar, kol tamamen yeşil
function labWorse(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, { pill: true, patient: { breath: t * 5, worse: true }, harry: { sick: 0 } });
}

// Tezgâhta hap tepsisi: kapsüller sıralı
function pillTray(ctx, cam) {
    cam.rect(ctx, 223, 68.6, 11, 1.4, '#c2cbcf');
    for (let i = 0; i < 4; i++) {
        cam.rect(ctx, 224 + i * 2.6, 67, 1.6, 1.6, '#c8322e');
        cam.rect(ctx, 225.4 + i * 2.6, 67, 1.2, 1.6, '#f4f1e4');
    }
}

// Harry tek başına, çalışma tezgâhında hap üzerinde çalışıyor (denek ve Fred yok)
function labSolo(ctx, A, t) {
    const cam = createCam(A, WIDE);
    room(ctx, cam);
    pillTray(ctx, cam);
    const stir = Math.sin(t * 14) * 1.2;
    stander(ctx, cam, { ...HARRY, x: 188, dir: 1, talk: Math.sin(t * 8) > 0 ? 1 : 0,
        work: { y: 66 + stir } });
    // Pipetten sarkan damla
    const k = (t * 3) % 1;
    cam.rect(ctx, 205.4, 70.6 + k * 4, 1.2, 1.6, '#e8d070');
    vignette(ctx, 0.3);
}

// Ölümden sonra: Harry yüzünü Fred'e çevirmiş, ikisi tartışıyor
function labQuarrel(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const who = Math.floor(t * 4) % 2;
    scene(ctx, cam, {
        patient: { breath: 0, dead: true },
        flat: true,
        harry: { dir: 1, talk: who === 0 ? 1 : 0 },
        fred: { dir: -1, talk: who === 1 ? 1 : 0 }
    });
}

// --- Monitör kareleri: tam kadraj ---

function screenFrame(ctx, cam) {
    cam.rect(ctx, 0, 0, SCENE.w, SCENE.h, '#12181a');
    cam.rect(ctx, 6, 6, SCENE.w - 12, SCENE.h - 12, '#0a1411');
    for (let y = 8; y < SCENE.h - 8; y += 3) cam.rect(ctx, 8, y, SCENE.w - 16, 0.5, 'rgba(120,255,140,0.05)');
}

function cellCircle(ctx, cam, cx, cy, r, color, fillColor) {
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d <= r && d > r - 1.6) cam.rect(ctx, cx + x, cy + y, 1, 1, color);
            else if (d <= r - 1.6 && fillColor) cam.rect(ctx, cx + x, cy + y, 1, 1, fillColor);
        }
    }
}

// 1. Virüs parçalanıp hücrenin içine giriyor
function findSplit(ctx, A, t) {
    const cam = createCam(A, WIDE);
    screenFrame(ctx, cam);
    const cx = 150, cy = 61, r = 38;
    cellCircle(ctx, cam, cx, cy, r, '#6bdc5a', 'rgba(60,140,70,0.10)');
    cam.rect(ctx, cx - 6, cy - 6, 12, 12, 'rgba(30,70,40,0.5)');           // çekirdek
    // Soldaki bütün virüs: parçalanıyor, parçalar hücreye akıyor
    const split = span(t, 0.1, 0.5);
    const enter = span(t, 0.4, 0.95);
    const vx = 50;
    if (split < 1) cellCircle(ctx, cam, vx, cy, Math.round(12 * (1 - split * 0.6)), '#3f9a28', '#2f7a22');
    for (let i = 0; i < 14; i++) {
        const a = hash(i, 1, 2) * 6.28;
        const spread = easeOut(split) * 16;
        const sx = vx + Math.cos(a) * spread;
        const sy = cy + Math.sin(a) * spread;
        const tx = cx - r + 8 + hash(i, 2, 2) * (r * 1.4);
        const ty = cy - r * 0.6 + hash(i, 3, 2) * (r * 1.2);
        const k = easeOut(clamp01((enter - hash(i, 4, 2) * 0.3) / 0.7));
        if (split > 0) cam.rect(ctx, lerp(sx, tx, k), lerp(sy, ty, k), 2.4, 2.4, '#8aff70');
    }
    drawPixelText(ctx, 'HÜCRE İÇİ', cam.px(10), cam.py(8), { scale: 2, color: '#6bdc5a' });
    vignette(ctx, 0.35);
}

// 2. Hücre içinde saniyede on bölünme
function findMitosis(ctx, A, t) {
    const cam = createCam(A, WIDE);
    screenFrame(ctx, cam);
    const n = 1 + Math.floor(t * 9.99);
    const k = (t * 9.99) % 1;
    const cols = Math.min(5, n);
    for (let i = 0; i < n * 2 && i < 20; i++) {
        const col = i % 5, row = Math.floor(i / 5);
        const cx = 62 + col * 26;
        const cy = 40 + row * 22;
        const pop = i >= n ? easeOut(k) : 1;
        cellCircle(ctx, cam, cx, cy, Math.round(8 * pop), '#6bdc5a', 'rgba(60,140,70,0.25)');
        cam.rect(ctx, cx - 2, cy - 2, 4, 4, '#8aff70');
    }
    drawPixelText(ctx, `${Math.min(10, n)} / SN`, cam.px(160), cam.py(96), { scale: 4, color: '#8aff70' });
    vignette(ctx, 0.35);
}

// 3. Beyindeki iz yayılıyor, zeka çubuğu düşüyor
function findBrain(ctx, A, t) {
    const cam = createCam(A, WIDE);
    screenFrame(ctx, cam);
    const spread = easeOut(span(t, 0, 0.9));
    for (const side of [-1, 1]) {
        const cx = 98 + side * 26, cy = 62;
        for (let y = -26; y <= 26; y++) {
            for (let x = -30; x <= 30; x++) {
                if ((x * x) / 900 + (y * y) / 676 > 1) continue;
                const edge = (x * x) / 900 + (y * y) / 676 > 0.86;
                const wob = hash(Math.round((cx + x) / 3), Math.round((cy + y) / 3), 7);
                const infected = hash(Math.round((cx + x) / 4), Math.round((cy + y) / 4), 9) < spread * 0.6;
                const col = edge ? '#6bdc5a' : infected ? mix('#2f7a22', '#8aff70', wob) : mix('#1c3a2a', '#2c5a40', wob);
                cam.rect(ctx, cx + x, cy + y, 1, 1, col);
            }
        }
    }
    // Zeka çubuğu
    drawPixelText(ctx, 'ZEKA', cam.px(176), cam.py(18), { scale: 2, color: '#6bdc5a' });
    cam.rect(ctx, 176, 28, 12, 70, '#1c3a2a');
    const level = 1 - spread * 0.7;
    cam.rect(ctx, 177, 28 + 68 * (1 - level), 10, 68 * level, '#6bdc5a');
    vignette(ctx, 0.35);
}

// Denek ölüyor: nabız çizgisi düzleşiyor, ışıklar aynı
function labDeath(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const dead = t > 0.55;
    scene(ctx, cam, {
        patient: { breath: t * 9, dead },
        flat: dead,
        harry: {},
        fred: {}
    });
}

export const CHAPTER_6_ART = {
    labHelp, labArrive, labPatient, labPill, labWorse, labSolo, labQuarrel, findSplit, findMitosis, findBrain, labDeath
};
