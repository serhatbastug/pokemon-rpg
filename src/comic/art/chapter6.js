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

const HARRY = { coat: '#e8ecee', shade: '#b9c1c6', skin: '#c99a6e', hair: '#8a6238', trouser: '#3a4048' };
const FRED = { coat: '#e1e5e7', shade: '#aeb6bb', skin: '#caa079', hair: '#1c1612', trouser: '#2c2f33', band: true };
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

function room(ctx, cam) {
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

    // Sağ: tezgah + mikroskop + raf
    cam.rect(ctx, 204, 70, 32, 4, '#5f6a70');
    cam.rect(ctx, 206, 74, 28, FLOOR_Y - 74, '#79858b');
    cam.rect(ctx, 212, 56, 10, 14, '#2f3a40');
    cam.rect(ctx, 214, 52, 3, 6, '#2f3a40');
    for (let i = 0; i < 4; i++) cam.rect(ctx, 207 + i * 7, 60, 4, 10, mix('#8fb7a0', '#6a8fb7', i / 3));

    // Duvar monitörü: yeşil nabız çizgisi
    cam.rect(ctx, 44, 20, 30, 20, '#2a3237');
    cam.rect(ctx, 46, 22, 26, 16, '#0f1a14');
    for (let i = 0; i < 26; i += 2) {
        const bump = i === 10 ? -6 : i === 12 ? 4 : 0;
        cam.rect(ctx, 46 + i, 30 + bump, 2, 1, '#6bdc5a');
    }
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

// --- Hasta masada: kolu yeşil, aşağı sarkıyor ---
function patient(ctx, cam, { breath = 0, dead = false } = {}) {
    const top = TABLE.top;
    const bx = TABLE.x + 6;
    const lift = dead ? 0 : Math.sin(breath) * 0.7;
    // Yastık + baş
    cam.rect(ctx, bx, top - 5, 12, 5, '#dfe6e8');
    const skin = mix('#c99a6e', '#8aa070', dead ? 0.55 : 0.35);
    cam.rect(ctx, bx + 1, top - 12 - lift * 0.3, 10, 9, skin);
    cam.rect(ctx, bx + 1, top - 12 - lift * 0.3, 10, 3, '#3f2c1e');
    cam.rect(ctx, bx + 3, top - 8, 2, 1, dead ? '#3a4a30' : '#20242a');
    cam.rect(ctx, bx + 7, top - 8, 2, 1, dead ? '#3a4a30' : '#20242a');
    cam.rect(ctx, bx + 4, top - 4.6, 4, 1, mix(skin, '#7a3f38', 0.4));
    // Örtü
    cam.rect(ctx, bx + 12, top - 8 - lift, TABLE.w - 24, 8 + lift, '#9fb3c4');
    cam.rect(ctx, bx + 12, top - 8 - lift, TABLE.w - 24, 1, '#c3d3e0');
    // Sarkan kol (yeşil) ve ayak ucu
    const ax = bx + 20;
    limbCells(ctx, cam, ax, top - 7, ax + 3, top + (dead ? 14 : 10), 3.6, mix('#c99a6e', GREEN, 0.75));
    cam.rect(ctx, ax + 1, top + (dead ? 14 : 10), 5, 4, mix('#c99a6e', GREEN, 0.7));
    limbCells(ctx, cam, ax + 1, top - 3, ax + 2, top + 6, 1, '#1f5a16');
}

// --- Ayakta duran kişi: yüz AYRINTILI, bacaklar yürürken açılıyor ---
function stander(ctx, cam, p) {
    const { x, dir = 1, talk = 0, walk = null, band = false, sick = 0 } = p;
    const { coat, shade, skin, hair, trouser } = p;
    const skinShade = mix(skin, '#000000', 0.22);
    const hipY = FLOOR_Y - 24;
    const torsoH = 29;
    const shoulderY = hipY - torsoH;
    const coatW = 20;
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

    // Kollar: yanda sakin; Fred'in sağ bileğinde turuncu bant
    for (const s of [-1, 1]) {
        const sx = x + s * coatW * 0.42;
        const sy = shoulderY + 2 + y0;
        const ex = sx + s * 1.2;
        const ey = sy + torsoH * 0.5;
        const handX = x + s * 10.6 + swing * -s * 2;
        const handY = hipY + 1;
        limbCells(ctx, cam, sx, sy, ex, ey, 3.8, coat);
        limbCells(ctx, cam, ex, ey, handX, handY - 2, 3.4, sick ? mix(coat, GREEN, 0.6 * sick) : coat);
        cam.rect(ctx, handX - 2, handY - 2, 4, 3.6, sick ? mix(skin, GREEN, 0.65 * sick) : skin);
        if (band && s > 0) {
            cam.rect(ctx, handX - 2.1, handY - 4.6, 4.2, 2.4, BAND_COLOR);
            cam.rect(ctx, handX - 2.1, handY - 4.6, 4.2, 0.8, mix(BAND_COLOR, '#ffffff', 0.3));
        }
    }

    // Baş ve yüz
    const hx = x + dir * 1.2;
    const hy = shoulderY - 13 + y0 + sick * 1.6;
    const headW = 12.4, headH = 13;
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
    // Saç
    cam.rect(ctx, hx - headW / 2 - 0.6, hy - 0.6, headW + 1.2, headH * 0.36, hair);
    cam.rect(ctx, hx - dir * headW * 0.5 - (dir > 0 ? 0.6 : -0.6) + (dir > 0 ? 0 : -headW * 0.2), hy, headW * 0.2, headH * 0.6, hair);
    cam.rect(ctx, hx - headW * 0.05, hy - 2, headW * 0.22, 2.2, hair);
}

function scene(ctx, cam, s) {
    room(ctx, cam);
    drip(ctx, cam, TABLE.x - 6);
    table(ctx, cam);
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
        helpers: HELPERS.map(h => ({ ...h, dir: 1 })),
        patient: { breath: t * 9, dead },
        harry: {},
        fred: {}
    });
    // Duvar monitörü: ölünce düz çizgi
    if (dead) {
        cam.rect(ctx, 46, 22, 26, 16, '#0f1a14');
        cam.rect(ctx, 46, 30, 26, 1, '#6bdc5a');
    }
}

export const CHAPTER_6_ART = {
    labHelp, labArrive, labPatient, findSplit, findMitosis, findBrain, labDeath
};
