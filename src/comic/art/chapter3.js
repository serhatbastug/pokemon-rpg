// 3. BÖLÜM - SAĞLIK OCAĞI
//
// Doktorun muayene odası. Bölüm TEK ÇEKİM: hasta solda, doktor sağda, aralarında
// masa ve monitör. Kamera hiç kıpırdamıyor - TEK İSTİSNA son kare, doktorun
// uzattığı çıktıya doğru yavaşça yaklaşıyor.
//
// Doktorun bildiği her şey burada söyleniyor: yeni bir virüs (V-986), hızlı
// yayılıyor, aşısı yok, belirti vermiyor. "Nereden, nasıl" sorusuna tek
// cevabı "araştırılıyor" - kendisi de bilmiyor, bu yüzden EKRANDA hiçbir
// açıklama yok.
//
// SON KAREDEKİ FOTOĞRAF: caddede mazgaldan çıkış anı (bkz. chapter2.js
// `street`, t küçükken). Bir sokak kamerası rastlantıyla yakalamış - fotoğraf
// gri/soluk, GÜVENLİK KAMERASI çekimi gibi; ne doktor ne hasta ne olduğunu
// çözebiliyor, okuyucu tanıyor.

import { PX, hash } from '../../pixel/pixelDraw.js';
import {
    createCam, vignette, mix, ellipseCells,
    span, clamp01, easeOut, lerp
} from '../comicKit.js';

// --- Sahnenin ölçüleri (hücre) ---
// 232x122: WIDE kamerada bir hücre PX, kadrajı birebir dolduruyor (bkz.
// chapter1.js / chapter2.js aynı kural).

const SCENE = { w: 232, h: 122 };
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };

const CEIL_H = 8;
const FLOOR_Y = 100;

const PAT_X = 56;          // hasta: solda, kameraya yakın
const DOC_X = 190;         // doktor: sağda, masanın ardında
const SEAT_Y = 82;         // her iki sandalyenin oturma yüksekliği

const DESK = { x: 104, y: 76, w: 64, h: 4 };
const MON = { x: 122, y: 52, w: 26, h: 22 };     // monitör ekranı
const FOLDER = { x: 152, y: 70, w: 14, h: 8 };   // doktorun elindeki dosya

// Çıktının SON hâli: doktorun hastaya doğru tuttuğu, kameranın son karede
// yaklaştığı yer. Fotoğrafın İÇERİĞİ bu kutuya GÖRELİ konumlarla çiziliyor,
// böylece hem masadan çıkarken (küçük, kayarak) hem yakınlaşırken (büyük,
// sabit) aynı çizim işini görüyor.
const PHOTO_HELD = { x: 140, y: 46, w: 34, h: 24 };
const CLOSE = { u: PX * 4.5, cx: PHOTO_HELD.x + PHOTO_HELD.w / 2, cy: PHOTO_HELD.y + PHOTO_HELD.h / 2 };

// --- Renkler ---

const WALL = '#7c93a0';
const WALL_SEAM = '#657f8d';
const WALL_TRIM = '#5b7280';
const FLOOR_TONE = '#8f8a7a';
const FLOOR_SEAM = '#7c7768';

const DOC_COAT = '#eef1f2';
const DOC_COAT_SHADE = '#c6cfd3';
const PAT_COAT = '#4c5b52';
const PAT_COAT_SHADE = '#333f38';
const DOC_SKIN = '#c9a074';
const PAT_SKIN = '#a8825f';
const DOC_HAIR = '#3a2a1c';
const PAT_HAIR = '#241f1b';
const TROUSER = '#333a33';

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

// --- Odanın parçaları ---

function walls(ctx, cam) {
    cam.rect(ctx, 0, 0, SCENE.w, CEIL_H, '#3c4750');
    cam.rect(ctx, 0, CEIL_H, SCENE.w, FLOOR_Y - CEIL_H, WALL);
    for (let y = CEIL_H; y < FLOOR_Y; y += 11) cam.rect(ctx, 0, y, SCENE.w, 1, WALL_SEAM);
    cam.rect(ctx, 0, FLOOR_Y - 10, SCENE.w, 2, WALL_TRIM);

    cam.rect(ctx, 0, FLOOR_Y, SCENE.w, SCENE.h - FLOOR_Y, FLOOR_TONE);
    cam.rect(ctx, 0, FLOOR_Y, SCENE.w, 1, '#655f52');
    for (let x = 0; x < SCENE.w; x += 14) cam.rect(ctx, x, FLOOR_Y, 1, SCENE.h - FLOOR_Y, FLOOR_SEAM);
    for (let x = 0; x < SCENE.w; x += 3) {
        for (let y = CEIL_H; y < FLOOR_Y; y += 3) {
            if (hash(x, y, 5) > 0.965) cam.rect(ctx, x, y, 2, 1, '#6f8794');
        }
    }
}

// Pencere: hastanın arkasında, sabah ışığı içeri vuruyor
function window_(ctx, cam) {
    const x = 20, y = 16, w = 30, h = 28;
    cam.rect(ctx, x - 2, y - 2, w + 4, h + 4, WALL_TRIM);
    cam.rect(ctx, x, y, w, h, '#cfe0e6');
    cam.rect(ctx, x, y, w, h * 0.55, '#e8f0ee');
    cam.rect(ctx, x + w / 2 - 1, y, 2, h, WALL_TRIM);
    cam.rect(ctx, x, y + h / 2 - 1, w, 2, WALL_TRIM);
    cam.glow(ctx, x + w * 0.3, y + h * 0.35, 26, 'rgba(255,250,225,ALPHA)', 0.16);
}

// Göz testi tablosu: satırlar harf değil, aşağı indikçe daralan çizgiler -
// hiçbir yakınlıkta okunmuyor (ch1'deki notla aynı kural)
function eyeChart(ctx, cam) {
    const x = 96, y = 18, w = 18, h = 30;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, WALL_TRIM);
    cam.rect(ctx, x, y, w, h, '#eceadd');
    for (let row = 0; row < 6; row++) {
        const ly = y + 3 + row * 4.4;
        const lw = Math.max(2, w - 4 - row * 2.4);
        cam.rect(ctx, x + (w - lw) / 2, ly, lw, 2, '#333a33');
    }
}

// Kırmızı artı işareti: doktorun arkasında
function crossSign(ctx, cam) {
    const x = 202, y = 20, w = 14, h = 14;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, WALL_TRIM);
    cam.rect(ctx, x, y, w, h, '#f4f1e4');
    cam.rect(ctx, x + w * 0.36, y + 2, w * 0.28, h - 4, '#a8412f');
    cam.rect(ctx, x + 2, y + h * 0.36, w - 4, h * 0.28, '#a8412f');
}

// Masa ve üstündeki monitör
function desk(ctx, cam) {
    cam.rect(ctx, DESK.x, DESK.y, DESK.w, DESK.h, '#c7cdd0');
    cam.rect(ctx, DESK.x, DESK.y, DESK.w, 1, '#e2e7e9');
    cam.rect(ctx, DESK.x, DESK.y + DESK.h, DESK.w, FLOOR_Y - DESK.y - DESK.h, '#8b959b');
    cam.rect(ctx, DESK.x, DESK.y + DESK.h, DESK.w, 1, '#6f797f');
}

// Monitör: kan tahlili ekranı. wave dalgalı bir çizgi (soyut - hiçbir yazı
// yok), dot sağ üstte yanıp sönen küçük bir uyarı.
function monitor(ctx, cam, t) {
    const { x, y, w, h } = MON;
    cam.rect(ctx, x + w / 2 - 2, DESK.y - 2, 4, 2, '#8b959b');       // stand
    cam.rect(ctx, x - 2, y - 2, w + 4, h + 4, '#2c3238');
    cam.rect(ctx, x, y, w, h, '#12181c');

    for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        const wx = x + 1 + k * (w - 2);
        const wy = y + h * 0.62 + Math.sin(k * 11 + t * 3) * h * 0.16 * Math.max(0.2, Math.sin(k * 4));
        cam.rect(ctx, wx, wy, 1.3, 1.3, '#c9463a');
    }
    for (let gy = y + 3; gy < y + h - 2; gy += 5) cam.rect(ctx, x + 1, gy, w - 2, 0.5, '#1e262c');

    if (Math.floor(t * 2) % 2 === 0) cam.rect(ctx, x + w - 4, y + 2, 2.2, 2.2, '#c9463a');
}

// Doktorun elindeki dosya: kapalı, fotoğraf ondan çıkıyor
function folder(ctx, cam) {
    cam.rect(ctx, FOLDER.x, FOLDER.y, FOLDER.w, FOLDER.h, '#8a6a3a');
    cam.rect(ctx, FOLDER.x, FOLDER.y, FOLDER.w, 1, '#a68448');
    cam.rect(ctx, FOLDER.x + 1, FOLDER.y - 1, FOLDER.w - 4, 1, '#d8d3c2');
}

// --- Oturan insan ---
//
// Basit ama yüzlü: gözler, kaş, burun, ağız. dir = bakılan/oturulan yön
// (+1 sağa, -1 sola). headDown: ekrana/kağıda bakış. headTurn: karşıdaki
// kişiye dönüş. lean: öne eğilme. armRaise: jest yapan kolun kalkışı.
// holdsPhoto: true ise jest kolu PHOTO_HELD'e uzanıyor.
function seatedPerson(ctx, cam, p) {
    const {
        x, dir, headDown = 0, headTurn = 0.6, lean = 0, armRaise = 0, shrug = 0,
        holdsPhoto = false, coat, coatShade, skin, hair
    } = p;
    const skinShade = mix(skin, '#000000', 0.28);
    const mouth = mix(skin, '#7a3f38', 0.45);
    const hipX = x + dir * lean * 2;

    // --- Bacaklar: kalçadan öne, dizden aşağı ---
    for (const s of [-1, 1]) {
        const kx = hipX + dir * 13;
        const ky = SEAT_Y + s * 1.2;
        const fx = kx;
        const fy = FLOOR_Y - 1;
        limbCells(ctx, cam, hipX + s * 2, SEAT_Y, kx, ky, 4.4, TROUSER);
        limbCells(ctx, cam, kx, ky, fx, fy, 4, TROUSER);
        cam.rect(ctx, fx - 2, fy - 1, 5 + dir * 2, 2, '#1d2126');
    }

    // --- Sandalye: ayak seviyesinde basit bir tabure ---
    cam.rect(ctx, hipX - 9, SEAT_Y + 1, 18, 2, '#5b6268');
    cam.rect(ctx, hipX - 8, SEAT_Y + 3, 2, FLOOR_Y - SEAT_Y - 3, '#454b51');
    cam.rect(ctx, hipX + 6, SEAT_Y + 3, 2, FLOOR_Y - SEAT_Y - 3, '#454b51');

    // --- Gövde ---
    const torsoH = 28 - shrug * 1.5;
    const shoulderY = SEAT_Y - torsoH;
    const coatW = 21;
    cam.rect(ctx, hipX - coatW / 2, shoulderY, coatW, torsoH, coat);
    cam.rect(ctx, hipX - coatW / 2, shoulderY, coatW * 0.26, torsoH, mix(coat, '#ffffff', 0.14));
    cam.rect(ctx, hipX + coatW * 0.24, shoulderY, coatW * 0.22, torsoH, coatShade);
    cam.rect(ctx, hipX - 1.4, shoulderY + 2, 2.8, torsoH - 4, coatShade);

    // --- Kollar ---
    const idleSide = -dir;
    const idleSx = hipX + idleSide * coatW * 0.42;
    const idleSy = shoulderY + 2;
    limbCells(ctx, cam, idleSx, idleSy, idleSx + idleSide * 2, idleSy + torsoH * 0.55, 3.6, coat);
    limbCells(ctx, cam, idleSx + idleSide * 2, idleSy + torsoH * 0.55, hipX + idleSide * 5, SEAT_Y - 3, 3.2, coat);
    cam.rect(ctx, hipX + idleSide * 6, SEAT_Y - 5, 4, 3.4, skin);

    const gestSx = hipX + dir * coatW * 0.42;
    const gestSy = shoulderY + 2 - shrug * 3;
    let handX, handY;
    if (holdsPhoto) {
        handX = lerp(gestSx, PHOTO_HELD.x + PHOTO_HELD.w * 0.14, armRaise);
        handY = lerp(gestSy + torsoH * 0.5, PHOTO_HELD.y + PHOTO_HELD.h * 0.9, armRaise);
    } else {
        handX = lerp(gestSx + dir * 3, hipX + dir * 24, armRaise * 0.6);
        handY = lerp(gestSy + torsoH * 0.5, shoulderY - 2 - shrug * 2, armRaise);
    }
    const elbowX = lerp(gestSx, (gestSx + handX) / 2, 0.6);
    const elbowY = lerp(gestSy + torsoH * 0.3, (gestSy + handY) / 2, 0.6);
    limbCells(ctx, cam, gestSx, gestSy, elbowX, elbowY, 3.6, coat);
    limbCells(ctx, cam, elbowX, elbowY, handX, handY, 3.2, coat);
    cam.rect(ctx, handX - 2, handY - 1.7, 4, 3.4, skin);

    // --- Boyun ve kafa ---
    const faceShift = dir * headTurn * 3.2;
    const hx = hipX + faceShift;
    const hy = shoulderY - 12 + headDown * 3.4;
    const headW = 12.5, headH = 13;
    cam.rect(ctx, hipX - 2.6, shoulderY - 3, 5.2, 4, skinShade);
    cam.rect(ctx, hx - headW / 2, hy, headW, headH, skin);
    cam.rect(ctx, hx - headW / 2, hy, headW * 0.26, headH, skinShade);
    cam.rect(ctx, hx + headW * 0.5 - 1, hy + headH * 0.42, 1.4, headH * 0.2, skinShade);

    const eyeY = hy + headH * (0.48 + headDown * 0.1);
    const eyeW = 2.2, eyeH = 1.5, gap = 2.4;
    const fx = dir * headTurn * 1.6;
    for (const s of [-1, 1]) {
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2, eyeY - eyeH * 1.6, eyeW * 1.15, eyeH * 0.6, hair);
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2, eyeY, eyeW, eyeH * (1 - headDown * 0.4), '#20242a');
    }
    cam.rect(ctx, hx + fx + dir * 1.2, eyeY + eyeH * 1.3, eyeW * 0.7, eyeH * 1.1, skinShade);
    cam.rect(ctx, hx + fx - 1.6, eyeY + eyeH * 3.1, 3.4, eyeH * 0.8, mouth);

    cam.rect(ctx, hx - headW / 2 - 0.6, hy - 1.2, headW + 1.2, headH * 0.38, hair);
    cam.rect(ctx, hx - dir * headW * 0.5, hy + headH * 0.18, headW * 0.2, headH * 0.42, hair);

    if (p.glasses) {
        for (const s of [-1, 1]) {
            cam.rect(ctx, hx + fx + s * gap - eyeW * 0.8, eyeY - 0.6, eyeW * 1.6, eyeH * 1.5, 'rgba(230,235,238,0.28)');
        }
        cam.rect(ctx, hx + fx - gap * 0.4, eyeY, gap * 0.8, 0.6, '#2c3238');
    }
    if (p.stetho) {
        const nx = hipX, ny = shoulderY + 3;
        limbCells(ctx, cam, nx - 3, ny, nx - 4, ny + 8, 1.3, '#2b2f33');
        limbCells(ctx, cam, nx + 3, ny, nx + 4, ny + 8, 1.3, '#2b2f33');
        cam.rect(ctx, nx - 5, ny + 7, 2.4, 2.4, '#8b939b');
    }
}

// --- Fotoğraf: caddedeki mazgaldan çıkış anı, güvenlik kamerası griliğinde ---
//
// Kutunun içindeki her şey box'a GÖRELİ (0..1) veriliyor: aynı çizim hem
// masadan çıkarken (küçük) hem yakınlaşırken (büyük) doğru oranda duruyor.
function photoContent(ctx, cam, box, t) {
    const at = (fx, fy) => [box.x + fx * box.w, box.y + fy * box.h];

    cam.rect(ctx, box.x - 1.4, box.y - 1.4, box.w + 2.8, box.h + 2.8, '#d8d3c2');
    cam.rect(ctx, box.x, box.y, box.w, box.h, '#5c6167');

    // Kaldırım/yol ayrımı - chapter2'deki `street` ile aynı tonlar
    const [rx, ry] = at(0, 0.62);
    cam.rect(ctx, rx, ry, box.w, box.h * 0.38, '#4e535a');
    const [sx, sy] = at(0, 0);
    cam.rect(ctx, sx, sy, box.w, box.h * 0.62, '#8a9098');

    // Tanelenme: eski güvenlik kamerası çekimi
    for (let gx = 0; gx < box.w; gx += 1) {
        for (let gy = 0; gy < box.h; gy += 1) {
            if (hash(gx, gy, 31) > 0.95) {
                const [nx, ny] = at(gx / box.w, gy / box.h);
                cam.rect(ctx, nx, ny, 1, 1, hash(gx, gy, 37) > 0.5 ? '#efece0' : '#33383e');
            }
        }
    }

    // Mazgal: kütlenin çıktığı yer - genişçe, açıkça görünür
    const [gx0, gy0] = at(0.24, 0.60);
    cam.rect(ctx, gx0, gy0, box.w * 0.42, box.h * 0.14, '#0e1114');
    cam.rect(ctx, gx0 + box.w * 0.02, gy0 + box.h * 0.02, box.w * 0.38, box.h * 0.10, '#181c20');
    for (let i = 0; i < 4; i++) {
        cam.rect(ctx, gx0 + box.w * 0.02 + i * box.w * 0.1, gy0 + box.h * 0.02, box.w * 0.01, box.h * 0.10, '#0a0c0e');
    }

    // Kütle: tek renk yerine GRİ - fotoğraf renksiz, kimse ne olduğunu
    // çözemedi. Biçim yine de drawBlob'daki oval/akışkan aile, mazgalın
    // aralığından TAZE çıkmış - küçük ve grate'in solundan yükseliyor.
    const [bx, by] = at(0.32, 0.575);
    const r = box.h * 0.13;
    ellipseCells(ctx, cam, bx, by, r * 1.3, r, '#e7e4da', t * 6, 0.7);
    ellipseCells(ctx, cam, bx + r * 0.1, by + r * 0.1, r * 1.15, r * 0.86, '#9a9d9f', t * 6, 0.7);

    // Sol üst köşede yanıp sönen kayıt lekesi - saat NE YAZDIĞI okunmuyor
    if (Math.floor(t * 3) % 2 === 0) cam.glow(ctx, box.x + box.w * 0.08, box.y + box.h * 0.08, 3, 'rgba(200,60,50,ALPHA)', 0.7);
    for (let i = 0; i < 4; i++) {
        cam.rect(ctx, box.x + box.w * 0.7 + i * box.w * 0.06, box.y + box.h * 0.92, box.w * 0.04, box.h * 0.04, '#efece0');
    }
}

// --- Sahne ---

function scene(ctx, cam, s) {
    walls(ctx, cam);
    window_(ctx, cam);
    eyeChart(ctx, cam);
    crossSign(ctx, cam);

    seatedPerson(ctx, cam, s.patient);
    desk(ctx, cam);
    monitor(ctx, cam, s.t);
    folder(ctx, cam);
    seatedPerson(ctx, cam, s.doctor);

    if (s.photo) photoContent(ctx, cam, s.photo, s.t);

    vignette(ctx, 0.32);
}

const PAT_BASE = { x: PAT_X, dir: 1, coat: PAT_COAT, coatShade: PAT_COAT_SHADE, skin: PAT_SKIN, hair: PAT_HAIR };
const DOC_BASE = {
    x: DOC_X, dir: -1, coat: DOC_COAT, coatShade: DOC_COAT_SHADE, skin: DOC_SKIN, hair: DOC_HAIR,
    glasses: true, stetho: true
};

// =================== KARELER ===================

// --- 1. HAREKETLİ: doktor ekrandaki tahlilden hastaya dönüyor ---
function clinicTurn(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const k = easeOut(span(t, 0.1, 0.9));
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 0.5, headDown: 0.1 },
        doctor: { ...DOC_BASE, headTurn: k, headDown: 1 - k, armRaise: 0.1 }
    });
}

// --- 2. "Tahlillerinde bir şey çıktı. Yeni bir virüs, V-986." ---
function clinicResult(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const raise = 0.2 + easeOut(span(t, 0, 0.7)) * 0.3;
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 0.8, lean: span(t, 0, 1) * 0.3 },
        doctor: { ...DOC_BASE, headTurn: 1, armRaise: raise }
    });
}

// --- 3. "Hızlı yayılıyor, aşısı yok, belirti vermiyor." ---
function clinicDetails(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const raise = 0.5 + easeOut(span(t, 0, 0.7)) * 0.35;
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 0.8, lean: 0.3 },
        doctor: { ...DOC_BASE, headTurn: 1, armRaise: raise }
    });
}

// --- 4. Hastanın sorduğu an (hem "nereden" hem "neye benziyor" burayı kullanıyor) ---
function clinicQuestion(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const lean = 0.3 + easeOut(span(t, 0, 0.8)) * 0.55;
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 1, lean, armRaise: easeOut(span(t, 0.15, 0.85)) * 0.5 },
        doctor: { ...DOC_BASE, headTurn: 1, armRaise: 0.15 }
    });
}

// --- 5. "Henüz bilinmiyor, hâlâ araştırılıyor." - omuz silkme ---
function clinicUnknown(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const shrug = Math.sin(clamp01(span(t, 0.1, 0.6)) * Math.PI) * 0.7;
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 1, lean: 0.6 },
        doctor: { ...DOC_BASE, headTurn: 1, shrug, armRaise: shrug * 0.6 }
    });
}

// --- 6. HAREKETLİ: çıktı dosyadan çıkıp yukarı kalkıyor ---
function clinicPhotoOut(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const out = easeOut(span(t, 0.1, 0.95));
    const w = lerp(8, PHOTO_HELD.w, out);
    const h = lerp(6, PHOTO_HELD.h, out);
    const photo = {
        x: lerp(FOLDER.x, PHOTO_HELD.x, out),
        y: lerp(FOLDER.y - 2, PHOTO_HELD.y, out),
        w, h
    };
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 1, lean: 0.5 },
        doctor: { ...DOC_BASE, headTurn: 1, armRaise: out, holdsPhoto: true },
        photo: out > 0.04 ? photo : null
    });
}

// --- 7. HAREKETLİ: kamera fotoğrafa yaklaşıyor. YAZI YOK ---
function clinicPhotoZoom(ctx, A, t) {
    const k = easeOut(span(t, 0, 0.9));
    const cam = createCam(A, {
        u: lerp(WIDE.u, CLOSE.u, k),
        cx: lerp(WIDE.cx, CLOSE.cx, k),
        cy: lerp(WIDE.cy, CLOSE.cy, k)
    });
    scene(ctx, cam, {
        t,
        patient: { ...PAT_BASE, headTurn: 1, lean: 0.5 },
        doctor: { ...DOC_BASE, headTurn: 1, armRaise: 1, holdsPhoto: true },
        photo: PHOTO_HELD
    });
}

export const CHAPTER_3_ART = {
    clinicTurn,
    clinicResult,
    clinicDetails,
    clinicQuestion,
    clinicUnknown,
    clinicPhotoOut,
    clinicPhotoZoom
};
