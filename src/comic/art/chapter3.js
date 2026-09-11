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
const DOC_TROUSER = '#4a5157';

// Yukarıdan aşağı iki renk arası hücre-hücre geçiş - kamera hücre
// düzleminde olduğu için bu sahnenin tamamı buradan besleniyor (comicKit'teki
// `bands` ham piksel çizdiği için burada işe yaramıyor, kamera yakınlaşınca
// ölçek dışı kalırdı).
function vBands(ctx, cam, x, y, w, h, from, to, steps = 8) {
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
        cam.rect(ctx, x, y + i * stepH, w, stepH + 0.6, mix(from, to, i / (steps - 1 || 1)));
    }
}

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
    cam.rect(ctx, 0, CEIL_H - 1, SCENE.w, 1, '#242b31');
    vBands(ctx, cam, 0, CEIL_H, SCENE.w, FLOOR_Y - CEIL_H - 10, mix(WALL, '#ffffff', 0.06), WALL, 6);
    for (let y = CEIL_H; y < FLOOR_Y; y += 11) cam.rect(ctx, 0, y, SCENE.w, 1, WALL_SEAM);
    // Kirlenme lekeleri: düz bir alan ölü durmasın
    for (let x = 0; x < SCENE.w; x += 3) {
        for (let y = CEIL_H; y < FLOOR_Y - 10; y += 3) {
            const h1 = hash(x, y, 5);
            if (h1 > 0.975) cam.rect(ctx, x, y, 2, 1, '#8fa8b4');
            else if (h1 < 0.02) cam.rect(ctx, x, y, 2, 1, '#546874');
        }
    }
    // Alt lambri: duvarın zeminle buluştuğu koyu şerit
    cam.rect(ctx, 0, FLOOR_Y - 10, SCENE.w, 8, WALL_TRIM);
    cam.rect(ctx, 0, FLOOR_Y - 10, SCENE.w, 1, mix(WALL_TRIM, '#ffffff', 0.2));
    cam.rect(ctx, 0, FLOOR_Y - 2, SCENE.w, 2, '#4a5f6c');

    floor(ctx, cam);
}

// Klinik zemini: iki tonlu karo, aralarda derz, kenarda süpürgelik
function floor(ctx, cam) {
    const TILE = 11.6;
    let row = 0;
    for (let y = FLOOR_Y; y < SCENE.h; y += TILE) {
        let col = 0;
        for (let x = 0; x < SCENE.w; x += TILE) {
            const checker = (row + col) % 2 === 0;
            const base = checker ? FLOOR_TONE : mix(FLOOR_TONE, '#000000', 0.1);
            const tone = mix(base, '#000000', hash(col, row, 8) * 0.05);
            cam.rect(ctx, x, y, TILE, TILE, tone);
            col++;
        }
        row++;
    }
    for (let y = FLOOR_Y; y < SCENE.h; y += TILE) cam.rect(ctx, 0, y, SCENE.w, 0.6, FLOOR_SEAM);
    for (let x = 0; x < SCENE.w; x += TILE) cam.rect(ctx, x, FLOOR_Y, 0.6, SCENE.h - FLOOR_Y, FLOOR_SEAM);
    cam.rect(ctx, 0, FLOOR_Y, SCENE.w, 1.2, mix(FLOOR_TONE, '#ffffff', 0.15));
}

// Duvar saati: doktorun üstünde, sadece biçim - akrep/yelkovan okunmuyor
function clock(ctx, cam) {
    const x = 152, y = 22, r = 8;
    cam.rect(ctx, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2, WALL_TRIM);
    cam.rect(ctx, x - r, y - r, r * 2, r * 2, '#eceadd');
    cam.rect(ctx, x - r, y - r, r * 2, r * 0.4, mix('#eceadd', '#000000', 0.06));
    cam.rect(ctx, x - 0.5, y - r * 0.7, 1, r * 0.7, '#2c2a24');
    cam.rect(ctx, x - 0.5, y - r * 0.4, r * 0.5, 1, '#2c2a24');
    for (const a of [0, 1, 2, 3]) {
        const ang = (a / 4) * Math.PI * 2;
        cam.rect(ctx, x + Math.sin(ang) * (r - 1.4) - 0.4, y - Math.cos(ang) * (r - 1.4) - 0.4, 0.8, 0.8, '#8a8571');
    }
}

// Çerçeveli belge: ch1'deki notla aynı kural, satırlar unreadable
function certificate(ctx, cam) {
    const x = 168, y = 40, w = 16, h = 20;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#8a6a3a');
    cam.rect(ctx, x, y, w, h, '#eceadd');
    cam.rect(ctx, x + 2, y + 3, w - 4, 2, '#b5ae95');
    for (let i = 0; i < 5; i++) {
        cam.rect(ctx, x + 2, y + 8 + i * 2, w - 4 - (i % 2) * 3, 1, '#c9c3ac');
    }
    cam.rect(ctx, x + w - 6, y + h - 7, 4, 4, '#a8412f');
}

// Sağdaki dolap: doktorun arkasında, malzeme kavanozları
function cabinet(ctx, cam) {
    const x = 214, y = FLOOR_Y - 46, w = 16, h = 46;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 1, '#3f4247');
    cam.rect(ctx, x, y, w, h, '#c7cdd0');
    cam.rect(ctx, x, y, w, 1, '#e2e7e9');
    for (const sy of [y + h * 0.36, y + h * 0.68]) {
        cam.rect(ctx, x, sy, w, 1.2, '#9aa2a6');
        for (let i = 0; i < 3; i++) {
            const jx = x + 2 + i * 4.4;
            const jh = 6 + (i % 2) * 2;
            cam.rect(ctx, jx, sy - jh, 3.4, jh, hash(i, sy, 4) > 0.5 ? '#8a9aa2' : '#6f7d85');
            cam.rect(ctx, jx + 0.5, sy - jh + 0.5, 1.4, jh - 1, '#aab8bf');
        }
    }
    cam.rect(ctx, x, y + h - 1, w, 1, '#8b959b');
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

    // Çekmece: doktorun tarafında, dosyanın çıktığı yer
    const drX = DESK.x + DESK.w - 22;
    cam.rect(ctx, drX, DESK.y + DESK.h + 3, 16, 10, '#7d858c');
    cam.rect(ctx, drX + 1, DESK.y + DESK.h + 4, 14, 8, '#8b959b');
    cam.rect(ctx, drX + 6, DESK.y + DESK.h + 7, 4, 1.4, '#5a6167');

    // Klavye + fare: hastaya yakın kenarda
    const kx = DESK.x + 10;
    cam.rect(ctx, kx, DESK.y - 3, 16, 3, '#dfe3e5');
    cam.rect(ctx, kx, DESK.y - 3, 16, 0.6, '#f2f4f5');
    for (let i = 0; i < 6; i++) cam.rect(ctx, kx + 1.4 + i * 2.4, DESK.y - 2.3, 1.6, 1.6, '#c3cacd');
    cam.rect(ctx, kx + 19, DESK.y - 2.4, 3, 2.4, '#dfe3e5');

    // Kalemlik: doktora yakın kenarda
    const px = DESK.x + DESK.w - 8;
    cam.rect(ctx, px, DESK.y - 6, 4, 6, '#5a6167');
    cam.rect(ctx, px + 0.6, DESK.y - 8, 0.8, 3, '#b5453a');
    cam.rect(ctx, px + 2, DESK.y - 9, 0.8, 4, '#3a5f8a');
}

// Monitör: kan tahlili ekranı. wave dalgalı bir çizgi (soyut - hiçbir yazı
// yok), dot sağ üstte yanıp sönen küçük bir uyarı.
function monitor(ctx, cam, t) {
    const { x, y, w, h } = MON;
    cam.rect(ctx, x + w * 0.28, DESK.y - 4, w * 0.44, 4, '#9aa2a6');    // taban
    cam.rect(ctx, x + w / 2 - 2, DESK.y - 6, 4, 4, '#8b959b');          // boyun
    cam.rect(ctx, x - 2.2, y - 2.2, w + 4.4, h + 4.4, '#2c3238');
    cam.rect(ctx, x - 2.2, y - 2.2, w + 4.4, 1, '#454e55');
    cam.rect(ctx, x, y, w, h, '#12181c');

    for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        const wx = x + 1 + k * (w - 2);
        const wy = y + h * 0.62 + Math.sin(k * 11 + t * 3) * h * 0.16 * Math.max(0.2, Math.sin(k * 4));
        cam.rect(ctx, wx, wy, 1.3, 1.3, '#c9463a');
        cam.rect(ctx, wx, wy, 1.3, 0.5, mix('#c9463a', '#ffffff', 0.4));
    }
    for (let gy = y + 3; gy < y + h - 2; gy += 5) cam.rect(ctx, x + 1, gy, w - 2, 0.5, '#1e262c');

    // Cam yansıması: köşeden köşeye çapraz soluk bir şerit
    for (let i = 0; i < 8; i++) cam.rect(ctx, x + 1 + i * 0.9, y + 1 + i * 1.6, 1.4, 1.4, 'rgba(255,255,255,0.05)');

    if (Math.floor(t * 2) % 2 === 0) cam.rect(ctx, x + w - 4, y + 2, 2.2, 2.2, '#c9463a');
    for (const [cx, cy] of [[x - 1.4, y - 1.4], [x + w + 1.4, y - 1.4]]) cam.rect(ctx, cx - 0.4, cy - 0.4, 0.8, 0.8, '#454e55');
}

// Doktorun elindeki dosya: kapalı, fotoğraf ondan çıkıyor. Altında ikinci
// bir dosya var - masanın üstü boş durmasın.
function folder(ctx, cam) {
    cam.rect(ctx, FOLDER.x - 1, FOLDER.y + 1.5, FOLDER.w + 2, FOLDER.h * 0.6, '#6b7278');
    cam.rect(ctx, FOLDER.x, FOLDER.y, FOLDER.w, FOLDER.h, '#8a6a3a');
    cam.rect(ctx, FOLDER.x, FOLDER.y, FOLDER.w, 1, '#a68448');
    cam.rect(ctx, FOLDER.x + 1, FOLDER.y - 1, FOLDER.w - 4, 1, '#d8d3c2');
    cam.rect(ctx, FOLDER.x + FOLDER.w - 5, FOLDER.y + 1, 3, FOLDER.h - 2, '#78592e');
}

// Sandalye: 'stool' hastanın basit taburesi, 'office' doktorun tekerlekli
// koltuğu (sırtlığı gövdeden ÖNCE çizilip arkada kalıyor).
function chairBack(ctx, cam, hipX, seatY, kind, dir) {
    if (kind !== 'office') return;
    const bx = hipX - dir * 9;
    cam.rect(ctx, bx - 1.5, seatY - 24, 3, 25, '#454b51');
    cam.rect(ctx, bx - 1.5, seatY - 24, 1.5, 25, 'rgba(0,0,0,0.15)');
    cam.rect(ctx, bx - 2.1, seatY - 25, 4.2, 4, '#525960');
}

function chairBase(ctx, cam, hipX, seatY, kind) {
    cam.rect(ctx, hipX - 9, seatY + 1, 18, 2.2, kind === 'office' ? '#454b51' : '#5b6268');
    cam.rect(ctx, hipX - 9, seatY + 1, 18, 0.8, mix(kind === 'office' ? '#454b51' : '#5b6268', '#ffffff', 0.18));
    if (kind === 'office') {
        cam.rect(ctx, hipX - 2, seatY + 3, 4, 7, '#3a4046');
        for (const s of [-1, 1]) {
            cam.rect(ctx, hipX + s * 9 - 1.6, FLOOR_Y - 2.4, 3.2, 2.4, '#2b2f33');
            limbCells(ctx, cam, hipX, seatY + 9, hipX + s * 9, FLOOR_Y - 2, 1.6, '#3a4046');
        }
    } else {
        cam.rect(ctx, hipX - 8, seatY + 3, 2, FLOOR_Y - seatY - 3, '#454b51');
        cam.rect(ctx, hipX + 6, seatY + 3, 2, FLOOR_Y - seatY - 3, '#454b51');
        cam.rect(ctx, hipX - 8, FLOOR_Y - 10, 16, 1.6, '#3a4046');
    }
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
        holdsPhoto = false, coat, coatShade, skin, hair, trouser = TROUSER,
        chair: chairKind = 'stool', buttons = false
    } = p;
    const skinShade = mix(skin, '#000000', 0.24);
    const skinLit = mix(skin, '#ffffff', 0.12);
    const mouth = mix(skin, '#7a3f38', 0.4);
    const hipX = x + dir * lean * 2;

    chairBack(ctx, cam, hipX, SEAT_Y, chairKind, dir);

    // --- Bacaklar: kalçadan öne, dizden aşağı ---
    for (const s of [-1, 1]) {
        const kx = hipX + dir * 13;
        const ky = SEAT_Y + s * 1.2;
        const fx = kx;
        const fy = FLOOR_Y - 1;
        const tone = s * dir > 0 ? trouser : mix(trouser, '#000000', 0.2);
        limbCells(ctx, cam, hipX + s * 2, SEAT_Y, kx, ky, 4.4, tone);
        limbCells(ctx, cam, kx, ky, fx, fy, 4, tone);
        cam.rect(ctx, fx - 2, fy - 1, 5 + dir * 2, 2, '#1d2126');
        cam.rect(ctx, fx - 2, fy - 1, 5 + dir * 2, 0.7, '#3a4046');
    }

    chairBase(ctx, cam, hipX, SEAT_Y, chairKind);

    // --- Gövde ---
    const torsoH = 28 - shrug * 1.5;
    const shoulderY = SEAT_Y - torsoH;
    const coatW = 21;
    cam.rect(ctx, hipX - coatW / 2, shoulderY + 1, coatW, torsoH - 1, coat);
    cam.rect(ctx, hipX - coatW / 2, shoulderY + 1, coatW * 0.24, torsoH - 1, mix(coat, '#ffffff', 0.15));
    cam.rect(ctx, hipX + coatW * 0.26, shoulderY + 1, coatW * 0.24, torsoH - 1, coatShade);
    cam.rect(ctx, hipX - 1.2, shoulderY + 3, 2.4, torsoH - 5, mix(coatShade, '#000000', 0.15));
    // Omuz: köşeli değil, hafif yuvarlatılmış hissi için kenar kırpması
    cam.rect(ctx, hipX - coatW / 2 - 1, shoulderY + 3, 1, torsoH * 0.4, coat);
    cam.rect(ctx, hipX + coatW / 2, shoulderY + 3, 1, torsoH * 0.4, coatShade);
    // Yaka: göğüs açıklığına inen V
    cam.rect(ctx, hipX - 2.4, shoulderY, 4.8, 3, mix(coat, '#000000', 0.1));
    cam.rect(ctx, hipX - 1.4, shoulderY + 2, 2.8, 3.4, skinShade);
    if (buttons) {
        for (let i = 0; i < 3; i++) {
            cam.rect(ctx, hipX + 0.6, shoulderY + 7 + i * 5.4, 1.3, 1.3, mix(coat, '#000000', 0.3));
        }
    }

    // --- Kollar ---
    const idleSide = -dir;
    const idleSx = hipX + idleSide * coatW * 0.42;
    const idleSy = shoulderY + 2;
    limbCells(ctx, cam, idleSx, idleSy, idleSx + idleSide * 2, idleSy + torsoH * 0.55, 3.6, coat);
    limbCells(ctx, cam, idleSx + idleSide * 2, idleSy + torsoH * 0.55, hipX + idleSide * 5, SEAT_Y - 3, 3.2, coat);
    cam.rect(ctx, hipX + idleSide * 6, SEAT_Y - 5, 4, 3.4, skin);
    cam.rect(ctx, hipX + idleSide * 6, SEAT_Y - 5, 4, 1, skinLit);
    for (let i = 0; i < 3; i++) cam.rect(ctx, hipX + idleSide * 6 + i * 1.3, SEAT_Y - 2.6, 1, 0.8, skinShade);

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
    for (let i = 0; i < 3; i++) cam.rect(ctx, handX - 1.6 + i * 1.3, handY + 1, 1, 0.8, skinShade);

    // --- Boyun ve kafa ---
    const faceShift = dir * headTurn * 3.2;
    const hx = hipX + faceShift;
    const hy = shoulderY - 12.4 + headDown * 3.4;
    const headW = 12, headH = 12.6;
    cam.rect(ctx, hipX - 2.4, shoulderY - 3, 4.8, 4, skinShade);
    cam.rect(ctx, hx + dir * headW * 0.5 - 1, hy + headH * 0.4, 1.6, headH * 0.24, skinShade);   // kulak

    cam.rect(ctx, hx - headW / 2, hy, headW, headH, skin);
    cam.rect(ctx, hx - headW / 2, hy, headW * 0.22, headH, skinShade);            // gölgeli yan
    cam.rect(ctx, hx + headW * 0.32, hy, headW * 0.18, headH, skinLit);           // aydınlık yan
    cam.rect(ctx, hx - headW * 0.1, hy + headH * 0.74, headW * 0.5, headH * 0.16, mix(skinShade, skin, 0.4)); // çene golgesi

    const eyeY = hy + headH * (0.46 + headDown * 0.1);
    const eyeW = 1.9, eyeH = 1.4, gap = 2.3;
    const fx = dir * headTurn * 1.6;
    for (const s of [-1, 1]) {
        // Kaş: düz blok değil, dışa doğru incelen iki parça
        cam.rect(ctx, hx + fx + s * gap - eyeW * 0.6, eyeY - eyeH * 1.7, eyeW * 0.9, eyeH * 0.55, hair);
        cam.rect(ctx, hx + fx + s * gap - eyeW * 0.6 + (s > 0 ? eyeW * 0.6 : -eyeW * 0.15), eyeY - eyeH * 1.5, eyeW * 0.55, eyeH * 0.4, hair);
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2, eyeY, eyeW, eyeH * (1 - headDown * 0.4), '#20242a');
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2 + 0.3, eyeY + 0.2, 0.6, 0.5, '#eceadd');   // ışık noktası
    }
    // Burun: köprüden uca inen ince şerit, ucu hafif gölgeli
    cam.rect(ctx, hx + fx - 0.5, eyeY - eyeH * 0.2, 1, eyeH * 1.5, mix(skin, skinShade, 0.3));
    cam.rect(ctx, hx + fx + dir * 1.1, eyeY + eyeH * 1.1, eyeW * 0.65, eyeH * 0.6, skinShade);
    // Ağız: ince üst çizgi + dolgun alt dudak
    cam.rect(ctx, hx + fx - 1.5, eyeY + eyeH * 3, 3.2, 0.6, mix(mouth, '#000000', 0.25));
    cam.rect(ctx, hx + fx - 1.4, eyeY + eyeH * 3.5, 3, 1, mouth);

    cam.rect(ctx, hx - headW / 2 - 0.6, hy - 1.2, headW + 1.2, headH * 0.36, hair);
    cam.rect(ctx, hx - headW * 0.3, hy - 1.2, headW * 0.22, headH * 0.14, mix(hair, '#ffffff', 0.12)); // tepe parıltısı
    cam.rect(ctx, hx - dir * headW * 0.5, hy + headH * 0.16, headW * 0.2, headH * 0.44, hair);

    if (p.glasses) {
        for (const s of [-1, 1]) {
            cam.rect(ctx, hx + fx + s * gap - eyeW * 0.8, eyeY - 0.6, eyeW * 1.6, eyeH * 1.5, 'rgba(230,235,238,0.28)');
            cam.rect(ctx, hx + fx + s * gap - eyeW * 0.8, eyeY - 0.6, eyeW * 1.6, 0.5, 'rgba(255,255,255,0.35)');
        }
        cam.rect(ctx, hx + fx - gap * 0.4, eyeY, gap * 0.8, 0.6, '#2c3238');
    }
    if (p.stetho) {
        const nx = hipX, ny = shoulderY + 3;
        limbCells(ctx, cam, nx - 3, ny, nx - 4, ny + 8, 1.3, '#2b2f33');
        limbCells(ctx, cam, nx + 3, ny, nx + 4, ny + 8, 1.3, '#2b2f33');
        cam.rect(ctx, nx - 5, ny + 7, 2.4, 2.4, '#8b939b');
        cam.rect(ctx, nx - 5, ny + 7, 2.4, 0.8, '#c3cacd');
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
    clock(ctx, cam);
    certificate(ctx, cam);
    crossSign(ctx, cam);
    cabinet(ctx, cam);

    seatedPerson(ctx, cam, s.patient);
    desk(ctx, cam);
    monitor(ctx, cam, s.t);
    folder(ctx, cam);
    seatedPerson(ctx, cam, s.doctor);

    if (s.photo) photoContent(ctx, cam, s.photo, s.t);

    vignette(ctx, 0.32);
}

const PAT_BASE = {
    x: PAT_X, dir: 1, coat: PAT_COAT, coatShade: PAT_COAT_SHADE, skin: PAT_SKIN, hair: PAT_HAIR,
    trouser: TROUSER, chair: 'stool', buttons: true
};
const DOC_BASE = {
    x: DOC_X, dir: -1, coat: DOC_COAT, coatShade: DOC_COAT_SHADE, skin: DOC_SKIN, hair: DOC_HAIR,
    trouser: DOC_TROUSER, chair: 'office', glasses: true, stetho: true
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
