// 1. BÖLÜM - LABORATUVAR
//
// Tek oda, TEK ÇEKİM. Kareler kesme değil, aynı çekimin devamı: senaryoda
// cont: true ile işaretli oldukları için araya siyah girmiyor. Bu yüzden
// hepsi tek bir oda çiziminden (scene) besleniyor; kareler arasında değişen
// tek şey durum (profesör nerede, kapta ne kadar sıvı var, kamera nerede).
//
// Kamera hücre düzleminde: geniş planda bir hücre PX, yakınlaşınca hücrenin
// kendisi büyüyor. Böylece yakın planda da piksel dili bozulmuyor.
//
// KURAL: profesörün yüzü YOK. Uzak kamera, karanlık gövde, hiçbir yüz
// hattı çizilmiyor. Tek renkli işareti bileğindeki TURUNCU SAAT; kim olduğu
// hiçbir yerde söylenmiyor.

import { PX, hash } from '../../pixel/pixelDraw.js';
import {
    createCam, vignette, darken, mix,
    span, clamp01, easeOut, easeIn, lerp, BAND_COLOR, drawBlob, blobDrops
} from '../comicKit.js';

// --- Sahnenin ölçüleri (hücre) ---

const SCENE = { w: 232, h: 122 };                       // geniş planın tam kadrajı
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };
const CLOSE = { u: PX * 2.5, cx: 136, cy: 54 };         // cam kabın yakın planı

const CEIL_H = 8;          // tavan bandının kalınlığı
const BENCH_Y = 78;        // tezgah tablasının üstü
const BENCH_TOP = 4;       // tablanın kalınlığı
const BENCH_END = 178;     // tezgah burada bitiyor, sağı boş zemin
const FLOOR_Y = 106;       // duvarın zeminle buluştuğu çizgi

const JAR_X = 136;         // saklama kabının merkezi
const JAR_W = 18;
const JAR_TOP = 54;        // gövdenin üstü
const NECK_Y = 45;         // boynun üstü (kapak buraya oturuyor)
const CAP_REST = { x: JAR_X + 17, y: 75 };   // kapağın tezgahta beklediği yer

const PROF_X = 98;         // profesörün duruş yeri
const VENT = { x: 14, y: 12, w: 32, h: 22 };
const DOOR = { x: 206, y: 26, w: 26 };
const NOTE = { x: 150, y: 58, w: 20, h: 20 };
const LAND_X = JAR_X - 22;   // kütlenin kaptan çıkıp indiği yer (kabın solu)

// --- Renkler ---

const WALL = '#39424b';
const WALL_SEAM = '#2b333a';
const WALL_DIRT = '#333c44';
const GLASS_EDGE = '#93a9b4';
const GLASS_IN = '#434f59';      // cam SAYDAM: içi duvardan biraz açık, beyaz değil
const COAT = '#242e38';
const COAT_RIM = '#46586a';
const HEAD = '#1a222a';
const HEAD_RIM = '#3c4c5c';

// 0 -> 1 -> 0: bir anın gelip geçmesi (kafanın kağıda dönüp geri gelmesi gibi)
const bump = (t, from, to) => Math.sin(clamp01(span(t, from, to)) * Math.PI);

// Hücre düzleminde kalın çapraz çizgi: kol, çatlak, uzantı
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
    cam.rect(ctx, 0, 0, SCENE.w, CEIL_H, '#232a31');
    cam.rect(ctx, 0, CEIL_H - 1, SCENE.w, 1, '#161c22');

    cam.rect(ctx, 0, CEIL_H, SCENE.w, FLOOR_Y - CEIL_H, WALL);
    for (let y = CEIL_H; y < FLOOR_Y; y += 9) cam.rect(ctx, 0, y, SCENE.w, 1, WALL_SEAM);
    for (let x = 0; x < SCENE.w; x += 9) cam.rect(ctx, x, CEIL_H, 1, FLOOR_Y - CEIL_H, WALL_SEAM);
    // Fayans ölü düzlük olmasın: seyrek lekeler
    for (let x = 0; x < SCENE.w; x += 3) {
        for (let y = CEIL_H; y < FLOOR_Y; y += 3) {
            if (hash(x, y, 5) > 0.95) cam.rect(ctx, x, y, 2, 1, WALL_DIRT);
        }
    }

    cam.rect(ctx, 0, FLOOR_Y, SCENE.w, SCENE.h - FLOOR_Y, '#39414a');
    cam.rect(ctx, 0, FLOOR_Y, SCENE.w, 1, '#20262c');
    for (let x = 0; x < SCENE.w; x += 16) cam.rect(ctx, x, FLOOR_Y, 1, SCENE.h - FLOOR_Y, '#333b43');
}

// Havalandırma kapağı: sol üstte, bölümün son karesine kadar kimsenin
// dikkatini çekmiyor. Sonunda oradan içeri giriliyor.
function vent(ctx, cam, glint = 0) {
    const { x, y, w, h } = VENT;
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#20272e');
    cam.rect(ctx, x, y, w, h, '#4a545d');
    cam.rect(ctx, x + 2, y + 2, w - 4, h - 4, '#10161b');
    for (let i = 0; i < 4; i++) {
        const sy = y + 3 + i * 5;
        cam.rect(ctx, x + 2, sy, w - 4, 3, '#59646e');
        cam.rect(ctx, x + 2, sy + 3, w - 4, 1, '#2a323a');
    }
    for (const [sx, sy] of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) {
        cam.rect(ctx, sx, sy, 1, 1, '#818b94');
    }
    if (glint > 0) cam.glow(ctx, x + w / 2, y + h / 2, 10, 'rgba(120,220,80,ALPHA)', glint * 0.55);
}

// Sağdaki kapı boşluğu: profesör buradan çıkıyor
function doorway(ctx, cam) {
    const { x, y, w } = DOOR;
    const h = FLOOR_Y - y;
    cam.rect(ctx, x - 2, y - 2, w + 4, h + 2, '#1b2128');
    cam.rect(ctx, x, y, w, h, '#171d23');
    cam.rect(ctx, x, y, w, 2, '#2c343c');
    cam.rect(ctx, x + 3, y + 6, w - 6, h - 6, '#2a2b26');
    cam.glow(ctx, x + w / 2, y + h * 0.6, 22, 'rgba(220,200,150,ALPHA)', 0.10);
}

function lamp(ctx, cam) {
    const x = 84;
    const w = 64;
    cam.rect(ctx, x + w / 2 - 1, CEIL_H, 2, 3, '#3d464e');
    cam.rect(ctx, x, CEIL_H + 3, w, 3, '#4a545d');
    cam.rect(ctx, x + 1, CEIL_H + 6, w - 2, 2, '#fdf6d8');
    cam.glow(ctx, x + w / 2, CEIL_H + 9, 11, 'rgba(250,240,200,ALPHA)', 0.22);
}

function bench(ctx, cam) {
    cam.rect(ctx, 0, BENCH_Y, BENCH_END, BENCH_TOP, '#9aa2a8');
    cam.rect(ctx, 0, BENCH_Y, BENCH_END, 1, '#c2c9ce');
    cam.rect(ctx, 0, BENCH_Y + BENCH_TOP, BENCH_END, FLOOR_Y - BENCH_Y - BENCH_TOP, '#2e353c');
    cam.rect(ctx, 0, BENCH_Y + BENCH_TOP, BENCH_END, 1, '#1a1f24');
    for (let x = 4; x + 26 < BENCH_END; x += 30) {
        cam.rect(ctx, x, BENCH_Y + 9, 26, 13, '#39424a');
        cam.rect(ctx, x + 11, BENCH_Y + 14, 4, 1, '#7d858c');
    }
    cam.rect(ctx, BENCH_END - 1, BENCH_Y, 1, FLOOR_Y - BENCH_Y, '#20262c');
}

// Tabure: tezgahın ÖNÜNDE duruyor, kadrajın alt kenarına derinlik veriyor
function stool(ctx, cam) {
    const x = 30;
    cam.rect(ctx, x - 12, 96, 24, 4, '#454e56');
    cam.rect(ctx, x - 12, 96, 24, 1, '#5d666e');
    cam.rect(ctx, x - 2, 100, 4, 18, '#333b43');
    cam.rect(ctx, x - 11, 114, 22, 3, '#2b333a');
    cam.rect(ctx, x - 11, 117, 4, 5, '#242b32');
    cam.rect(ctx, x + 7, 117, 4, 5, '#242b32');
}

function microscope(ctx, cam) {
    const x = 52;
    cam.rect(ctx, x, BENCH_Y - 4, 20, 4, '#3f4a53');
    cam.rect(ctx, x + 2, BENCH_Y - 6, 15, 2, '#556270');
    cam.rect(ctx, x + 6, BENCH_Y - 24, 5, 18, '#4c5865');
    cam.rect(ctx, x + 4, BENCH_Y - 28, 9, 4, '#5d6a78');
    cam.rect(ctx, x + 11, BENCH_Y - 18, 6, 2, '#66737f');
}

// Tezgahtaki küçük şişeler
function smallJars(ctx, cam, x, count, seed) {
    for (let i = 0; i < count; i++) {
        const jx = x + i * 7;
        const h = hash(i, seed, 3) > 0.5 ? 10 : 7;
        cam.rect(ctx, jx, BENCH_Y - h, 5, h, hash(i, seed, 7) > 0.6 ? '#8a9aa2' : '#6f7d85');
        cam.rect(ctx, jx + 1, BENCH_Y - h + 1, 3, h - 2, '#aab8bf');
        cam.rect(ctx, jx + 1, BENCH_Y - 3, 3, 2, '#59636a');
    }
}

// Üstünde bir şeyler yazan kağıt: yazının NE OLDUĞU hiçbir yakınlıkta
// okunmuyor - satırlar harf değil, çizgi.
function note(ctx, cam, lit = 0) {
    const { x, y, w, h } = NOTE;
    cam.rect(ctx, x + 2, y + h, w - 4, 2, '#4b5259');          // sehpa
    cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#6f6a5e');
    cam.rect(ctx, x, y, w, h, '#d8d3c2');
    cam.rect(ctx, x, y, w, 1, '#eeeadb');
    cam.rect(ctx, x + 2, y + 3, w - 9, 2, '#6b6659');
    for (let i = 0; i < 4; i++) {
        const ly = y + 8 + i * 3;
        const lw = 5 + Math.floor(hash(i, 3, 11) * (w - 9));
        cam.rect(ctx, x + 2, ly, lw, 1, '#8a8577');
    }
    if (lit > 0) cam.glow(ctx, x + w / 2, y + h / 2, 9, 'rgba(255,245,210,ALPHA)', lit * 0.4);
}

// Cam kabın çatlakları: sabit yollar, sayısı arttıkça cam daha çok kırılıyor
const CRACKS = [
    [[3, 6], [6, 10], [4, 14], [7, 19]],
    [[14, 4], [11, 9], [13, 13], [10, 18]],
    [[8, 2], [9, 6], [6, 11], [8, 16]],
    [[1, 11], [4, 15], [2, 19], [5, 23]]
];

// Saklama kabı. dx = titreme, level = sıvı seviyesi, tone = karışımın rengi,
// cracks = çatlak sayısı, cap = kapağın yeri (null ise kapak elde/uçmuş).
function flask(ctx, cam, { dx = 0, level = 0.3, tone = 0, cracks = 0, cap = null } = {}) {
    const x = JAR_X + dx;
    const innerTop = JAR_TOP + 1;
    const innerH = BENCH_Y - innerTop - 1;

    cam.rect(ctx, x - JAR_W / 2, JAR_TOP, JAR_W, BENCH_Y - JAR_TOP, GLASS_EDGE);
    cam.rect(ctx, x - JAR_W / 2 + 1, innerTop, JAR_W - 2, innerH, GLASS_IN);
    // Omuz: tek adımda değil, kademeli daralıyor - yoksa kutu gibi duruyor
    cam.rect(ctx, x - 7, 51, 14, 4, GLASS_EDGE);
    cam.rect(ctx, x - 6, 51, 12, 4, GLASS_IN);
    cam.rect(ctx, x - 5, 48, 10, 4, GLASS_EDGE);
    cam.rect(ctx, x - 4, 48, 8, 4, GLASS_IN);
    cam.rect(ctx, x - 4, NECK_Y, 8, 4, GLASS_EDGE);
    cam.rect(ctx, x - 3, NECK_Y + 1, 6, 3, GLASS_IN);

    const liq = Math.round(innerH * clamp01(level));
    if (liq > 0) {
        cam.rect(ctx, x - JAR_W / 2 + 1, BENCH_Y - 1 - liq, JAR_W - 2, liq, mix('#2c6b34', '#4a8f2a', tone));
        cam.rect(ctx, x - JAR_W / 2 + 1, BENCH_Y - 1 - liq, JAR_W - 2, 1, mix('#57a83a', '#7fd049', tone));
    }
    // Cam parıltısı: solda geniş, sağda ince - hacim buradan okunuyor
    cam.rect(ctx, x - JAR_W / 2 + 2, JAR_TOP + 3, 2, 12, '#cfe4ea');
    cam.rect(ctx, x + JAR_W / 2 - 3, JAR_TOP + 6, 1, 16, '#7f959f');

    for (let i = 0; i < Math.min(cracks, CRACKS.length); i++) {
        const path = CRACKS[i];
        for (let k = 0; k < path.length - 1; k++) {
            limbCells(ctx, cam,
                x - JAR_W / 2 + path[k][0], JAR_TOP + path[k][1],
                x - JAR_W / 2 + path[k + 1][0], JAR_TOP + path[k + 1][1], 1, '#26323a');
        }
    }

    if (cap) drawCap(ctx, cam, cap.x, cap.y);
}

function drawCap(ctx, cam, x, y) {
    cam.rect(ctx, x - 5, y, 10, 4, '#c86a2a');
    cam.rect(ctx, x - 5, y, 10, 1, '#e08a44');
    cam.rect(ctx, x - 5, y + 3, 10, 1, '#93481a');
}

// --- Kabın paramparça olması ---
//
// Kap çatlayıp sızdırmıyor: bir anda dağılıyor. Parçalar kabın durduğu
// noktadan dışarı savrulup kadrajdan çıkıyor, geriye cam kalıntısı DEĞİL
// yalnızca virüs kalıyor. Bu yüzden parçalar hem uzaklaşıyor hem küçülüyor;
// kırılmadan sonraki karelerde tezgahta hiç cam çizilmiyor.
//
// dx, dy = savrulma yönü, sy = parçanın kaptaki yüksekliği (0 dip, 1 boyun),
// s = parçanın boyu. cap: kapak da parçalarla birlikte gidiyor.
const SHARDS = [
    { dx: -1.00, dy: -0.30, sy: 0.62, s: 4 },
    { dx: -0.82, dy: 0.28, sy: 0.30, s: 3 },
    { dx: -0.55, dy: -0.85, sy: 0.86, s: 2 },
    { dx: -0.24, dy: -1.00, sy: 0.95, s: 3 },
    { dx: 0.30, dy: -0.92, sy: 0.90, s: 2 },
    { dx: 0.66, dy: -0.52, sy: 0.70, s: 4 },
    { dx: 0.96, dy: 0.06, sy: 0.44, s: 3 },
    { dx: 0.74, dy: 0.44, sy: 0.18, s: 2 },
    { dx: -0.40, dy: 0.62, sy: 0.10, s: 3 },
    { dx: 0.10, dy: -1.00, sy: 1.00, s: 5, cap: true }
];

// k: 0 = kırılma anı, 1 = hepsi kadrajın dışında
function shatter(ctx, cam, x, k) {
    if (k <= 0 || k >= 1) return;
    const fly = easeOut(k) * 52;              // savrulma mesafesi (hücre)
    const fall = k * k * 26;                  // yer çekimi
    for (const p of SHARDS) {
        const px = x + p.dx * fly;
        const py = lerp(BENCH_Y - 1, NECK_Y, p.sy) + p.dy * fly * 0.55 + fall;
        const s = Math.max(1, p.s * (1 - k * 0.55));
        if (p.cap) {
            cam.rect(ctx, px - s / 2, py - s / 2, s * 2, s, '#c86a2a');
            cam.rect(ctx, px - s / 2, py - s / 2, s * 2, Math.max(0.6, s * 0.3), '#e08a44');
        } else {
            cam.rect(ctx, px - s / 2, py - s / 2, s, s, GLASS_EDGE);
            cam.rect(ctx, px - s / 2, py - s / 2, Math.max(0.6, s * 0.5), Math.max(0.6, s * 0.5), '#cfe4ea');
        }
    }
}

// --- Profesör ---
//
// Uzaktan bakılan karanlık bir gövde. Yüz hattı çizilmiyor: kafa tek parça
// karaltı. Kapıdan gelen ışık sağ kenarına vuruyor, o kadar.
//
// arm: 'idle' iki kol yanda | 'pour' sağ kol tezgaha uzanıyor (kol tezgahtan
// SONRA çiziliyor, bkz. scene) | 'watch' sol kol göğsün önüne kalkıyor.
function professor(ctx, cam, p) {
    const x = p.x;
    const swing = Math.sin(p.walk * Math.PI * 2);

    // Bacaklar: tezgahın arkasında görünmüyor, tezgah bitince ortaya çıkıyor
    cam.rect(ctx, x - 7 + swing * 3, 80, 6, 22, '#1b232c');
    cam.rect(ctx, x + 1 - swing * 3, 80, 6, 22, '#1b232c');
    cam.rect(ctx, x - 8 + swing * 3, 100, 8, 3, '#12181e');
    cam.rect(ctx, x - swing * 3, 100, 8, 3, '#12181e');

    // Gövde (önlük): omuzdan bele hafif daralıyor
    cam.rect(ctx, x - 11, 50, 22, 5, COAT);
    cam.rect(ctx, x - 10, 55, 20, 27, COAT);
    cam.rect(ctx, x + 8, 51, 2, 31, COAT_RIM);        // kapıdan gelen kenar ışığı
    cam.rect(ctx, x - 11, 50, 22, 1, '#2f3b47');
    cam.rect(ctx, x - 1, 56, 2, 26, '#161d24');       // önlüğün açıklığı
    cam.rect(ctx, x - 4, 49, 8, 2, '#2f3b47');        // yaka

    // Boyun ve kafa. headTurn: 0 karşıya, 1 sağdaki kağıda dönük.
    cam.rect(ctx, x - 2, 46, 4, 4, '#151c23');
    const hx = x - 5 + Math.round(p.headTurn * 5);
    const hy = 33 + Math.round(p.headDown * 3);
    cam.rect(ctx, hx, hy + 2, 11, 11, HEAD);
    cam.rect(ctx, hx + 1, hy, 9, 3, '#12181e');       // saç
    cam.rect(ctx, hx + 8, hy + 4, 2, 7, HEAD_RIM);
    if (p.headTurn > 0.6) cam.rect(ctx, hx + 11, hy + 6, 1, 3, HEAD);   // profil çıkıntısı

    // Kameraya göre soldaki kol: hep yanda
    arm(ctx, cam, x - 10, 53, x - 15, 66, x - 16, 76);

    if (p.arm === 'watch') {
        // Kol göğsün önüne kalkıyor: bilek gözün hizasında
        const rise = easeOut(p.armK);
        const wristX = lerp(x + 15, x + 2, rise);
        const wristY = lerp(74, 47, rise);
        arm(ctx, cam, x + 10, 53, lerp(x + 16, x + 11, rise), lerp(64, 55, rise), wristX, wristY);
        cam.rect(ctx, wristX - 3, wristY - 2, 6, 4, '#161d24');          // el
        // TURUNCU SAAT: kadrajdaki tek sıcak renk
        cam.rect(ctx, wristX - 3, wristY + 2, 6, 3, BAND_COLOR);
        cam.rect(ctx, wristX - 2, wristY + 2, 4, 2, '#f0a55a');
        if (rise > 0.7) cam.glow(ctx, wristX, wristY + 3, 5, 'rgba(240,150,60,ALPHA)', 0.32);
    } else if (p.arm !== 'pour') {
        arm(ctx, cam, x + 10, 53, x + 15, 66, x + 16, 76);
    }
}

// Dirsekten kırılan kol: tek düz çizgi kol gibi değil, kütle gibi duruyordu
function arm(ctx, cam, sx, sy, ex, ey, hx, hy) {
    limbCells(ctx, cam, sx, sy, ex, ey, 4, COAT);
    limbCells(ctx, cam, ex, ey, hx, hy, 3.4, COAT);
    cam.rect(ctx, sx - 2, sy - 1, 4, 3, COAT);
}

// Dökme kolu: tezgahtan SONRA çiziliyor, çünkü el tezgahın ÜSTÜNDE.
// holds: 'bottle' küçük şişe | 'cap' kapak | null boş el
function pourArm(ctx, cam, p, hand) {
    const ex = lerp(p.x + 12, hand.x, 0.45);
    const ey = lerp(56, hand.y, 0.35);
    arm(ctx, cam, p.x + 10, 53, ex, ey, hand.x - 3, hand.y + 4);
    cam.rect(ctx, hand.x - 4, hand.y + 2, 7, 5, '#161d24');

    if (hand.holds === 'bottle') {
        // Dökerken şişe eğiliyor: gövde sağa kaçıyor, ağzı sola-aşağı bakıyor
        const tip = hand.tilt;
        const bx = hand.x + Math.round(tip * 3);
        const by = hand.y - 9 + Math.round(tip * 3);
        cam.rect(ctx, bx - 3, by, 7, 9, '#4f6c76');
        cam.rect(ctx, bx - 2, by + 1, 5, 7, '#87a9b3');
        cam.rect(ctx, bx - 2, by + 2, 2, 5, '#b7d6de');
        // Ağız: eğim arttıkça aşağı-sola kayıyor
        cam.rect(ctx, bx - 4 - Math.round(tip * 2), by + 7 + Math.round(tip * 2), 4, 3, '#4f6c76');
    } else if (hand.holds === 'cap') {
        drawCap(ctx, cam, hand.x, hand.y - 5);
    }
}

// Şişeden kaba inen sıvı: kesintisiz bir hat, akarken hafifçe kıvrılıyor
function stream(ctx, cam, fromX, fromY, phase) {
    const steps = Math.max(1, Math.round(NECK_Y - fromY));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const y = fromY + i;
        const x = lerp(fromX, JAR_X, easeIn(k)) + Math.sin((i + phase) * 0.8) * 0.6;
        cam.rect(ctx, x - 1, y, 2, 1.2, i % 5 === 0 ? '#a7e772' : '#7fd049');
    }
    cam.rect(ctx, JAR_X - 3, NECK_Y, 6, 2, '#a7e772');
    cam.glow(ctx, JAR_X, NECK_Y + 1, 5, 'rgba(150,230,110,ALPHA)', 0.4);
}

// --- Virüs ---
//
// TEK RENK, OVALİMSİ, AKIŞKAN, BEYAZ IŞIKLI (kullanıcının 2026-09-08'deki
// kararı; önceki "serbest bırakılmış el" gibi sarkan, uzantılı kütle bu
// biçimle değiştirildi). Çizimin kendisi comicKit'te: caddedeki kütleyle
// birebir aynı şey olmalı, iki yerde ayrı durursa ayrışıyorlar.
//
// x, y = kütlenin OTURDUĞU nokta (alt orta). w, h kaba ölçüler; form 0 =
// kabın dibindeki yayvan gölcük, 1 = toparlanmış oval. tendrils artık
// uzantı değil, kütlenin ne kadar kıpırdadığı.
function ooze(ctx, cam, { x, y, w, h, form = 1, wob = 0, tendrils = 1 }) {
    // Biçimsizken yayvan ve alçak, toparlandıkça dikleşiyor
    const ry = Math.max(0.4, h * 0.5 * lerp(0.6, 1, form));
    const rx = Math.max(0.4, w * 0.6 * lerp(1.5, 1, form));

    blobDrops(ctx, cam, x, y - ry * 0.5, 0, 1, ry * 0.4, tendrils * 0.3);
    drawBlob(ctx, cam, {
        x, y: y - ry, r: ry, wide: rx / ry,
        wob,
        stretch: Math.sin(wob) * 0.05 * tendrils,
        dirX: 1, dirY: 0,
        light: 0.75 + 0.25 * tendrils
    });
}

// --- Sahne ---
//
// Bütün kareler buradan geçiyor: sıra occlusion sırası. Profesör tezgahın
// ARKASINDA duruyor (tezgahtan önce çiziliyor), uzanan kolu tezgahın
// ÜSTÜNDE (tezgahtan sonra).
function scene(ctx, cam, s) {
    walls(ctx, cam);
    vent(ctx, cam, s.ventGlint || 0);
    doorway(ctx, cam);
    lamp(ctx, cam);
    if (s.prof) professor(ctx, cam, s.prof);
    bench(ctx, cam);
    microscope(ctx, cam);
    smallJars(ctx, cam, 78, 4, 3);
    note(ctx, cam, s.noteLit || 0);
    // jar null ise kap ARTIK YOK: kırıldıktan sonraki karelerde tezgahta
    // cam çizilmiyor, o noktada duran tek şey virüs.
    if (s.jar) flask(ctx, cam, s.jar);
    if (s.stream) stream(ctx, cam, s.stream.x, s.stream.y, s.stream.phase);
    if (s.hand && s.prof) pourArm(ctx, cam, s.prof, s.hand);
    if (s.shards) shatter(ctx, cam, s.shards.x, s.shards.k);
    if (s.blob) ooze(ctx, cam, s.blob);
    // Izgaradan içeri girerken kütle kapağın ARKASINA geçiyor: panjurlar
    // üstüne binmezse içeri girmiş değil, üstüne yapışmış gibi duruyor.
    if (s.ventFront) vent(ctx, cam, s.ventGlint || 0);
    stool(ctx, cam);
    vignette(ctx, 0.5);
    if (s.dim) darken(ctx, s.dim);
}

// Kabın içindeki karışımın kaç kez beslendiğine göre seviye ve renk
function mixState(t, pours) {
    let level = 0.24;
    let tone = 0;
    let pouring = null;
    pours.forEach(([a, b], i) => {
        const k = span(t, a, b);
        level += 0.15 * k;
        tone += k / pours.length;
        if (t >= a && t <= b) pouring = { k, i };
    });
    return { level, tone, pouring };
}

// =================== KARELER ===================

// --- 1. Uzak plan: sıvılar kaba dökülüyor, arada kağıda bakılıyor ---
function labMix(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const pours = [[0.08, 0.24], [0.34, 0.50], [0.60, 0.76]];
    const { level, tone, pouring } = mixState(t, pours);

    // Dökümler arasında kafa sağdaki kağıda dönüyor
    const reading = Math.max(bump(t, 0.24, 0.34), bump(t, 0.50, 0.60));
    const headTurn = 0.25 + reading * 0.75;

    // Kapağı kabın ağzına koyma: karenin son çeyreği. Kapak önce tezgahta
    // duruyor, sonra elde, sonunda kabın boynunda.
    const capping = span(t, 0.84, 0.98);
    const capX = lerp(CAP_REST.x, JAR_X, easeOut(capping));
    const capY = lerp(CAP_REST.y, NECK_Y - 4, easeOut(capping));

    // El: dökerken kabın ağzının üstünde, okurken gövdeye yakın
    const out = pouring ? 1 : lerp(0.45, 0.55, reading);
    const hand = {
        x: Math.round(lerp(PROF_X + 18, JAR_X + 2, out)),
        y: Math.round(lerp(58, 30, out)),
        holds: capping > 0 && capping < 1 ? 'cap' : 'bottle',
        tilt: pouring ? Math.sin(clamp01(pouring.k) * Math.PI) : 0
    };
    if (capping > 0 && capping < 1) {
        hand.x = Math.round(capX);
        hand.y = Math.round(capY + 6);
    }

    scene(ctx, cam, {
        prof: { x: PROF_X, headTurn, headDown: reading * 0.6, walk: 0, arm: 'pour', armK: 0 },
        hand,
        noteLit: reading,
        stream: pouring && pouring.k > 0.15 && pouring.k < 0.9
            ? {
                x: hand.x - 3 - Math.round(hand.tilt * 2) + 1,
                y: hand.y + Math.round(hand.tilt * 3) + 1,
                phase: t * 40
            } : null,
        jar: {
            level, tone,
            cap: capping <= 0 ? { x: CAP_REST.x, y: CAP_REST.y }
                : capping >= 1 ? { x: JAR_X, y: NECK_Y - 4 } : null
        }
    });
}

// Kapağın kapalı hâli: 2-4. karelerde kabın boynunda duruyor
const CAP_ON = { x: JAR_X, y: NECK_Y - 4 };

// --- 2. Doğruluyor: "tarifteki ile aynı yaptım" ---
function labSaid(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const back = easeOut(span(t, 0, 0.6));
    scene(ctx, cam, {
        prof: {
            x: PROF_X, headTurn: 0.35 * (1 - back), headDown: 0,
            walk: 0, arm: 'idle', armK: 0
        },
        jar: { level: 0.69, tone: 1, cap: CAP_ON }
    });
}

// --- 3. Koldaki turuncu saate bakıyor: "saat oldukça geç olmuş" ---
function labWatch(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const rise = span(t, 0.05, 0.55);
    scene(ctx, cam, {
        prof: {
            x: PROF_X, headTurn: 0, headDown: easeOut(rise),
            walk: 0, arm: 'watch', armK: rise
        },
        jar: { level: 0.69, tone: 1, cap: CAP_ON }
    });
}

// --- 4. Kadrajdan çıkıyor. Kamera onu İZLEMİYOR: kap yerinde duruyor ---
function labLeave(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const go = span(t, 0.12, 0.92);
    const x = Math.round(lerp(PROF_X, 252, go));
    const walking = go > 0 && go < 1;

    scene(ctx, cam, {
        prof: {
            x, headTurn: 0, headDown: 0,
            walk: walking ? t * 9 : 0, arm: 'idle', armK: 0
        },
        jar: { level: 0.69, tone: 1, cap: CAP_ON }
    });
}

// --- 5. HAREKETLİ: kamera yavaşça kaba yaklaşıyor, cam oynayıp çatlıyor ---
function labCloseIn(ctx, A, t) {
    const k = easeOut(span(t, 0, 0.86));
    const cam = createCam(A, {
        u: lerp(WIDE.u, CLOSE.u, k),
        cx: lerp(WIDE.cx, CLOSE.cx, k),
        cy: lerp(WIDE.cy, CLOSE.cy, k)
    });

    // Kap t=0.45'ten sonra oynamaya, 0.62'den sonra çatlamaya başlıyor
    const life = span(t, 0.45, 1);
    const shake = life > 0 ? Math.round(Math.sin(t * 90) * life * 1.6) : 0;
    const cracks = Math.floor(span(t, 0.62, 1) * 3.99);

    scene(ctx, cam, {
        jar: {
            dx: shake, level: 0.69, tone: 1, cracks,
            cap: { x: JAR_X + shake, y: NECK_Y - 4 - (life > 0.5 ? Math.min(1, Math.abs(shake)) : 0) }
        }
    });
}

// --- 6. HAREKETLİ: sıvı biçim kazanıyor ve kaptan çıkıyor (yazı YOK) ---
function labBirth(ctx, A, t) {
    // Kamera yerinde duruyor, yalnızca kütleyle birlikte hafifçe aşağı
    // kayıyor: tezgah kadrajın altından çıkmasın, kütle nereye indiği
    // görünsün.
    const push = easeOut(t);
    const cam = createCam(A, {
        u: CLOSE.u,
        cx: CLOSE.cx,
        cy: lerp(CLOSE.cy, CLOSE.cy + 5, push)
    });

    // Kap boynundan sızmıyor: son bir kez sarsılıyor ve BİR ANDA dağılıyor.
    const BREAK = 0.22;                           // kırılma anı
    const before = t < BREAK;
    const shake = before ? Math.round(Math.sin(t * 130) * span(t, 0, BREAK) * 3) : 0;
    const burst = span(t, BREAK, 0.62);           // parçalar kadrajdan çıkıyor
    const grow = span(t, BREAK, 0.66);            // kalan kütle biçim kazanıyor
    const walk = span(t, 0.68, 0.92);             // kabın yerinden sola yürüyor
    const settle = span(t, 0.90, 1);

    // Kap kırılana kadar sıvı yerinde; kırıldıktan sonra kap YOK.
    const blobW = lerp(7, 15, easeOut(grow));
    const blobH = lerp(4, 22, easeOut(grow));
    // Kütle kırılan kabın yerinden yoluna devam ediyor: soldaki
    // havalandırmaya doğru. Sağında kağıt duruyor, oraya gitmiyor.
    const blobX = lerp(JAR_X, LAND_X, easeIn(walk));

    scene(ctx, cam, {
        jar: before
            ? {
                dx: shake, level: 0.69, tone: 1, cracks: 4,
                cap: { x: JAR_X + shake, y: NECK_Y - 4 }
            }
            : null,
        shards: before ? null : { x: JAR_X, k: burst },
        blob: before ? null : {
            x: blobX, y: BENCH_Y, w: blobW, h: blobH,
            form: clamp01(span(t, BREAK, 0.72)),
            wob: t * 8,
            tendrils: clamp01(span(t, 0.34, 0.86)) * (0.6 + settle * 0.4)
        }
    });
}

// --- 7. HAREKETLİ: kamera açılıyor, duvara tırmanıp havalandırmaya giriyor ---
function labVent(ctx, A, t) {
    const back = easeOut(span(t, 0, 0.32));
    const cam = createCam(A, {
        u: lerp(CLOSE.u, WIDE.u, back),
        cx: lerp(CLOSE.cx, WIDE.cx, back),
        cy: lerp(CLOSE.cy + 5, WIDE.cy, back)
    });

    const crawl = span(t, 0.26, 0.56);        // tezgahta sola yürüyor
    const climb = span(t, 0.56, 0.86);        // duvara tırmanıyor
    const enter = span(t, 0.86, 1);           // ızgaradan içeri

    const targetX = VENT.x + VENT.w / 2;
    let x = lerp(LAND_X, targetX + 4, easeOut(crawl));
    let y = BENCH_Y;
    if (climb > 0) {
        x = lerp(targetX + 4, targetX, climb);
        y = lerp(BENCH_Y, VENT.y + VENT.h - 1, easeIn(climb));
    }
    const shrink = 1 - enter;

    scene(ctx, cam, {
        jar: null,                                // kap bir önceki karede dağıldı
        ventGlint: enter > 0 ? enter : (climb > 0.7 ? 0.2 : 0),
        ventFront: enter > 0,
        blob: shrink > 0.02 ? {
            x, y, w: 15 * shrink, h: 22 * shrink,
            form: 1,
            wob: t * 10 + (climb > 0 ? Math.sin(t * 30) : 0),
            tendrils: 1
        } : null
    });
}

export const CHAPTER_1_ART = {
    labMix,
    labSaid,
    labWatch,
    labLeave,
    labCloseIn,
    labBirth,
    labVent
};
