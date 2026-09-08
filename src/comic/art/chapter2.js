// 2. BÖLÜM - CADDE
//
// Virüsün insana geçtiği yer. Bölüm TEK KARE: mazgaldan çıkışından bulaşma
// zincirine kadar her şey aynı kadrajda, kesintisiz akıyor. Oyuncu araya
// girmiyor - F yalnızca "hızlandır / bitir" işini görüyor.
//
// KAMERA HİÇ KIPIRDAMIYOR. Ne yakınlaşma ne kayma: cadde baştan sona aynı
// geniş plandan görünüyor, olan biteni bulmak seyircinin işi.
//
// TAMAMEN SESSİZ: ne anlatıcı kutusu ne balon. Kimse virüsü görmüyor,
// kimse bir şey söylemiyor.
//
// VİRÜSÜN GÖRÜNTÜSÜ: tek renk, ovalimsi, akışkan, beyaz ışıklı. Çizimi
// comicKit'te (drawBlob) - 1. bölümdeki kütleyle birebir aynı şey.
//
// İnsanlar buranın asıl işi: yüzleri, gözleri, kıyafetleri belli. Yürüme
// kalçadan dönüyor (bacak gövdeden kopmuyor) ve adım uzunluğu gerçekten
// alınan yola bağlı - yoksa yürürken kayıyorlar.

import { PX, hash, newCanvas } from '../../pixel/pixelDraw.js';
import {
    createCam, vignette, mix, drawBlob, blobDrops,
    span, clamp01, easeOut, easeIn, lerp
} from '../comicKit.js';

// --- Sahnenin ölçüleri (hücre) ---
// 232x122 tam kadraj: bir hücre PX iken sahne kareyi birebir dolduruyor.

const SCENE = { w: 232, h: 122 };
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };

const CORNICE = 20;        // üst katla dükkân arası silme
const SHOP_Y = 26;         // tentelerin bandı
const WALK_Y = 46;         // kaldırımın arka kenarı
const CURB_Y = 96;         // kaldırım yüzeyinin bittiği yer
const CURB_H = 6;          // bordür yüzü
const ROAD_Y = CURB_Y + CURB_H;
const GRATE = { x: 18, y: 105, w: 36, h: 9 };      // yağmur suyu mazgalı
const POLE_X = 214;        // kaldırım kenarındaki direk

// --- Renkler ---
// Sabah: gri ama AYDINLIK bir cadde. Gece gibi durursa kalabalık kaybolur,
// oysa bölümün derdi tam da göz önünde olan bir şeyin görülmemesi.

const HAZE = '#8d949c';            // uzaktaki her şey buna karışıyor
const WALK = '#969ca3';
const WALK_SEAM = '#878e95';
const CURB_TOP = '#aab1b8';
const CURB_FACE = '#767d84';
const ROAD = '#5c6167';
const GUTTER = '#4e535a';

const COATS = [
    '#41505f', '#6d564a', '#4c5b52', '#343d49', '#6b6052',
    '#48566a', '#5a4a55', '#3d4a42', '#7b7062', '#525c63',
    '#8a5f4a', '#3f4f66'
];
const SCARVES = ['#8c4a42', '#4a6d72', '#7a6a3a', '#5a4a68', '#6a7a52'];
const SKINS = ['#a8825f', '#c39c74', '#7d5b40', '#d0aa84', '#8f6a4c'];
const HAIRS = ['#241f1b', '#3f2c1e', '#161514', '#5a4326', '#6b6560'];
const TROUSERS = ['#2c3138', '#3b3630', '#243040', '#43392f', '#333a33'];

// Hücre düzleminde kalın çapraz çizgi (uzuv, akan hat).
// Adım başına bir kare yetiyor: kareler zaten "thick" kadar boylu, üst üste
// biniyorlar. Hücre başına iki adım atmak kalabalıkta kare sayısını ikiye
// katlıyor ve 60 FPS'i düşürüyordu.
function limbCells(ctx, cam, x0, y0, x1, y1, thick, color) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(2, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        cam.rect(ctx, x0 + dx * k - thick / 2, y0 + dy * k - thick / 2, thick, thick, color);
    }
}

// --- Cadde ---

// Karşı cephe: üst katlar, silme, tenteler, vitrinler. Dört ayrı bina;
// tek düz duvar olunca cadde değil koridor gibi duruyor.
function facades(ctx, cam) {
    const SEGMENTS = [
        { x: -8, w: 62, tone: '#8a8177', awning: '#9b5348' },
        { x: 54, w: 54, tone: '#7c8189', awning: '#4d757a' },
        { x: 108, w: 66, tone: '#87837c', awning: '#8e7c48' },
        { x: 174, w: 66, tone: '#7a808a', awning: '#6b5f74' }
    ];

    for (const s of SEGMENTS) {
        cam.rect(ctx, s.x, 0, s.w, CORNICE, s.tone);
        // Sabah ışığı soldan geliyor: her binanın sol kenarı bir tık açık
        cam.rect(ctx, s.x, 0, 3, CORNICE, mix(s.tone, '#ffffff', 0.16));
        for (let wx = s.x + 6; wx < s.x + s.w - 8; wx += 15) {
            for (let wy = 3; wy < CORNICE - 6; wy += 12) {
                cam.rect(ctx, wx - 1, wy - 1, 11, 11, mix(s.tone, '#ffffff', 0.2));
                cam.rect(ctx, wx, wy, 9, 9, '#3b4149');
                cam.rect(ctx, wx + 1, wy + 1, 7, 7, hash(wx, wy, 3) > 0.7 ? '#9d9679' : '#4a525b');
                cam.rect(ctx, wx + 1, wy + 1, 3, 7, mix('#4a525b', '#ffffff', 0.12));
            }
        }
        cam.rect(ctx, s.x, CORNICE, s.w, 3, mix(s.tone, '#000000', 0.3));
        cam.rect(ctx, s.x, CORNICE + 3, s.w, SHOP_Y - CORNICE - 3, mix(s.tone, '#000000', 0.15));

        // Tente
        cam.rect(ctx, s.x + 3, SHOP_Y, s.w - 6, 4, s.awning);
        cam.rect(ctx, s.x + 3, SHOP_Y, s.w - 6, 1, mix(s.awning, '#ffffff', 0.22));
        for (let fx = s.x + 3; fx < s.x + s.w - 6; fx += 6) {
            cam.rect(ctx, fx, SHOP_Y + 4, 3, 2, mix(s.awning, '#000000', 0.25));
        }

        // Vitrin: içerisi loş, camda soluk yansımalar
        const gy = SHOP_Y + 7;
        const gh = WALK_Y - gy - 2;
        cam.rect(ctx, s.x + 2, gy, s.w - 4, gh, '#3a4149');
        cam.rect(ctx, s.x + 4, gy + 2, s.w - 8, gh - 3, '#48545e');
        for (let rx = s.x + 6; rx < s.x + s.w - 8; rx += 11) {
            cam.rect(ctx, rx, gy + 3, 2, gh - 6, '#5c6c78');
        }
        const dx = s.x + Math.round(s.w * 0.62);
        cam.rect(ctx, dx, gy + 2, 11, gh - 2, '#2f363d');
        cam.rect(ctx, dx + 1, gy + 3, 9, gh - 3, '#3f4952');
        cam.rect(ctx, s.x, WALK_Y - 2, s.w, 2, '#4a5158');
    }
}

// Kaldırım: YATAY BİR DÜZLEM. Karo derzleri aşağı indikçe açılıyor, dikey
// derzler yalnızca kısa çentikler - tam boy çizilince duvar örgüsü gibi
// duruyor, zemin gibi değil.
function sidewalk(ctx, cam) {
    cam.rect(ctx, 0, WALK_Y, SCENE.w, CURB_Y - WALK_Y, WALK);
    cam.rect(ctx, 0, WALK_Y, SCENE.w, 10, mix(WALK, '#000000', 0.1));

    let y = WALK_Y + 5;
    let gap = 4;
    let row = 0;
    while (y < CURB_Y) {
        cam.rect(ctx, 0, y, SCENE.w, 1, WALK_SEAM);
        const step = 16 + row * 3;
        for (let x = (row % 2 ? -8 : 0); x < SCENE.w; x += step) {
            cam.rect(ctx, x, y - Math.min(2, gap - 1), 1, Math.min(2, gap - 1), WALK_SEAM);
        }
        y += gap;
        gap += 1.4;
        row++;
    }
    for (let x = 0; x < SCENE.w; x += 3) {
        for (let sy = WALK_Y; sy < CURB_Y; sy += 3) {
            if (hash(x, sy, 9) > 0.955) cam.rect(ctx, x, sy, 2, 1, mix(WALK, '#000000', 0.08));
        }
    }
}

// Bordür ve araba yolu. Mazgal bordürün DİBİNDE: yağmur suyu oraya akıyor.
function road(ctx, cam) {
    cam.rect(ctx, 0, CURB_Y, SCENE.w, 2, CURB_TOP);
    cam.rect(ctx, 0, CURB_Y + 2, SCENE.w, CURB_H - 2, CURB_FACE);
    cam.rect(ctx, 0, CURB_Y + CURB_H - 1, SCENE.w, 1, '#464c52');
    for (let x = 6; x < SCENE.w; x += 26) cam.rect(ctx, x, CURB_Y + 2, 1, CURB_H - 2, '#6a7178');

    cam.rect(ctx, 0, ROAD_Y, SCENE.w, SCENE.h - ROAD_Y, ROAD);
    cam.rect(ctx, 0, ROAD_Y, SCENE.w, 4, GUTTER);          // oluk: suyun aktığı şerit
    cam.rect(ctx, 0, ROAD_Y + 4, SCENE.w, 1, '#454a50');
    for (let x = 0; x < SCENE.w; x += 3) {
        for (let y = ROAD_Y; y < SCENE.h; y += 3) {
            if (hash(x, y, 21) > 0.94) cam.rect(ctx, x, y, 2, 1, '#565b61');
        }
    }
}

// Araba yolunun işaretleri: yol çizgileri, rögar kapağı ve kadrajın kestiği
// tek bir teker. Arabanın tamamı kaldırımı kapatıyor, teker yetiyor.
function roadDetails(ctx, cam) {
    for (let x = 8; x < SCENE.w; x += 34) cam.rect(ctx, x, 118, 14, 1.4, '#9aa0a6');
    const mx = 108;
    cam.rect(ctx, mx - 11, 110, 22, 7, '#454b52');
    cam.rect(ctx, mx - 9, 111, 18, 5, '#565d64');
    for (let i = 0; i < 3; i++) cam.rect(ctx, mx - 7 + i * 5, 112, 2, 3, '#3d434a');

    const cx = 196;
    cam.rect(ctx, cx - 12, 112, SCENE.w - cx + 20, 10, '#252a30');
    cam.rect(ctx, cx - 12, 112, SCENE.w - cx + 20, 1.4, '#5e6874');
    cam.rect(ctx, cx, 110, 20, 12, '#16191d');
    cam.rect(ctx, cx + 4, 113, 12, 7, '#4d555e');
    cam.rect(ctx, cx + 7, 115, 6, 3, '#767f89');
}

// Yağmur mazgalı. bars=true ise yalnızca demirler çiziliyor: kütle
// aralıklardan çıkarken demirlerin ARKASINDA kalsın diye iki kez çağrılıyor.
function grate(ctx, cam, { bars = false, glint = 0 } = {}) {
    const { x, y, w, h } = GRATE;
    if (!bars) {
        cam.rect(ctx, x - 2, y - 2, w + 4, h + 4, '#33383e');
        cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#22262b');
        cam.rect(ctx, x, y, w, h, '#0e1114');
        cam.rect(ctx, x + 9, CURB_Y + 3, w - 18, 2, '#1a1f24');     // bordürdeki ağız
        cam.rect(ctx, x + 9, CURB_Y + 2, w - 18, 1, '#9aa1a8');
        if (glint > 0) cam.glow(ctx, x + w * 0.45, y + h * 0.55, 13, 'rgba(255,255,255,ALPHA)', glint * 0.45);
        return;
    }
    for (let i = 0; i < 4; i++) {
        const by = y + 0.8 + i * 2.4;
        cam.rect(ctx, x + 1, by, w - 2, 1, '#5a6169');
        cam.rect(ctx, x + 1, by, w - 2, 0.4, '#767e86');
    }
    cam.rect(ctx, x, y, 1.4, h, '#5a6169');
    cam.rect(ctx, x + w - 1.4, y, 1.4, h, '#5a6169');
}

// Kaldırım direği: kadrajın dışına çıkıyor, en öndeki dikey nesne
function pole(ctx, cam) {
    cam.rect(ctx, POLE_X - 2, CURB_Y - 3, 6, 3, '#454b51');
    cam.rect(ctx, POLE_X - 1, -4, 3, CURB_Y - 2, '#4e545b');
    cam.rect(ctx, POLE_X - 1, -4, 1, CURB_Y - 2, '#646b72');
}

// Çöp kutusu: kalabalığın arasında duran tek durağan şey
function bin(ctx, cam) {
    const x = 26;
    const top = 66;
    cam.rect(ctx, x - 2, 92, 14, 1.4, mix(WALK, '#000000', 0.16));
    cam.rect(ctx, x - 1, top, 12, 2, '#6b747c');
    cam.rect(ctx, x, top + 2, 10, 24, '#4a525a');
    cam.rect(ctx, x, top + 2, 3, 24, '#5b646c');
    for (let rx = x + 2; rx < x + 9; rx += 3) cam.rect(ctx, rx, top + 4, 1, 20, '#3b424a');
    cam.rect(ctx, x + 1, 90, 8, 2, '#343b42');
}

// --- Kalabalık ---
//
// Üç şerit: arkadaki küçük ve puslu, öndeki büyük ve net. Yüzler görünüyor -
// göz, kaş, burun, ağız - ama kimse kimseye bakmıyor.

const LANES = [
    { feet: 66, h: 24, dim: 0.55 },      // arka sıra: vitrinlerin önü
    { feet: 80, h: 33, dim: 0.26 },
    { feet: 96, h: 44, dim: 0.00 }       // ön sıra: bordürün kenarı
];

function anatomy(p) {
    const feet = LANES[p.lane].feet + (p.dy || 0);
    const h = p.h;
    const top = feet - h;
    return {
        feet, top, h,
        headW: h * 0.155,
        headH: h * 0.175,
        shoulderY: top + h * 0.205,
        coatW: h * 0.3,
        hipY: top + h * 0.5
    };
}

// Omzun noktası: bulaşma zinciri buraya konuyor
function shoulder(p, side) {
    const a = anatomy(p);
    return [p.x + side * a.coatW * 0.5, a.shoulderY + a.h * 0.03];
}

// Yürüyüşün fazı: alınan YOLA bağlı. Zamana bağlı olursa ayaklar yerde
// kayıyor - adım atıyor gibi değil, sallanıyor gibi duruyor.
function gaitPhase(p, time) {
    if (p.still) return { swing: Math.sin(time * 1.4 + p.phase) * 0.08, bob: 0, k: 0, moving: false };
    const stride = p.h * 0.55;
    const k = (time * p.speed) / stride * Math.PI + p.phase;
    return { swing: Math.sin(k), bob: Math.abs(Math.cos(k)) * p.h * 0.012, k, moving: true };
}

function person(ctx, cam, p, time) {
    const a = anatomy(p);
    const dim = LANES[p.lane].dim;
    // Renkler kişi kurulurken bir kez karıştırılıyor: her karede yeniden
    // karıştırmak (onlarca hex ayrıştırma) kalabalıkta 60 FPS'i düşürüyor.
    const {
        coat, lit, shade, trouser, trouserLit, trouserDark,
        skin, skinShade, hair, hatBrim, scarf, scarfKnot, bag, bagLit, mouth, ground
    } = p.tones;
    const dir = p.dir || 1;

    const { swing, bob, k: gait, moving } = gaitPhase(p, time);
    const y0 = -bob;
    const px = (v) => p.x + v;

    // Yere değdiği yer: gölge olmadan kalabalık zeminin üstünde yüzüyor
    cam.rect(ctx, px(-a.coatW * 0.8), a.feet - 0.6, a.coatW * 1.6, 1.4,
        ground);

    // --- Bacaklar: KALÇADAN dönüyorlar. Gövdeden ayrı kaydırılınca
    // bacak bedenden kopmuş gibi duruyor - bütün mesele bu.
    const hipGap = a.h * 0.075;
    const legLen = a.feet - a.hipY;
    const stepX = a.h * 0.13;
    for (const s of [-1, 1]) {
        const sw = swing * s;
        // Öne SALINAN ayak yerden kesiliyor ve dizi bükülüyor. İkisi de
        // yerde kalırsa yürüme değil, ayrık duruş oluyor.
        const lift = moving ? Math.max(0, Math.cos(gait) * s) : 0;
        const hx = px(s * hipGap);
        const hy = a.hipY + y0;
        const kx = hx + sw * stepX * (0.55 + lift * 0.25) * dir;
        const ky = hy + legLen * (0.5 - lift * 0.06);
        const fx = hx + sw * stepX * dir;
        const fy = a.feet - a.h * 0.03 - lift * a.h * 0.035;
        limbCells(ctx, cam, hx, hy, kx, ky, a.h * 0.085, s * dir > 0 ? trouser : trouserDark);
        limbCells(ctx, cam, kx, ky, fx, fy, a.h * 0.075, s * dir > 0 ? trouser : trouserDark);
        if (s < 0) limbCells(ctx, cam, hx - a.h * 0.02, hy, kx - a.h * 0.02, ky, a.h * 0.02, trouserLit);
        // Ayakkabı: burnu gidilen yöne bakıyor
        cam.rect(ctx, fx - a.h * 0.035 + dir * a.h * 0.012, fy, a.h * 0.075, a.h * 0.032, '#1d2126');
        cam.rect(ctx, fx - a.h * 0.035 + dir * a.h * 0.012, fy + a.h * 0.024, a.h * 0.075, a.h * 0.008, '#0f1216');
    }

    // --- Palto
    const cw = a.coatW;
    const torsoH = a.hipY - a.shoulderY;
    const hemH = a.h * (p.longCoat ? 0.13 : 0.04);
    cam.rect(ctx, px(-cw / 2 - a.h * 0.018), a.shoulderY + y0, cw + a.h * 0.036, a.h * 0.05, coat);   // omuz
    cam.rect(ctx, px(-cw / 2), a.shoulderY + y0, cw, torsoH + hemH, coat);
    cam.rect(ctx, px(-cw / 2), a.shoulderY + y0, cw * 0.26, torsoH + hemH, lit);
    cam.rect(ctx, px(cw * 0.28), a.shoulderY + y0, cw * 0.22, torsoH + hemH, shade);
    cam.rect(ctx, px(-cw / 2), a.hipY + hemH + y0 - a.h * 0.012, cw, a.h * 0.012, shade);            // etek ucu

    // Yaka ve önün açıklığı
    cam.rect(ctx, px(-a.h * 0.012), a.shoulderY + a.h * 0.07 + y0, a.h * 0.024, torsoH + hemH - a.h * 0.07, shade);
    cam.rect(ctx, px(-cw * 0.26), a.shoulderY + a.h * 0.01 + y0, cw * 0.22, a.h * 0.075, shade);
    cam.rect(ctx, px(cw * 0.04), a.shoulderY + a.h * 0.01 + y0, cw * 0.22, a.h * 0.075, trouserDark);
    // Düğmeler
    for (let i = 0; i < 2; i++) {
        cam.rect(ctx, px(a.h * 0.022), a.shoulderY + a.h * (0.13 + i * 0.09) + y0,
            a.h * 0.022, a.h * 0.022, lit);
    }
    // Atkı: kalabalıkta renk lazım
    if (p.scarf) {

        cam.rect(ctx, px(-cw * 0.42), a.shoulderY - a.h * 0.005 + y0, cw * 0.84, a.h * 0.04, scarf);
        cam.rect(ctx, px(-cw * 0.1), a.shoulderY + a.h * 0.03 + y0, cw * 0.18, a.h * 0.1, scarfKnot);
    }

    // --- Kollar: OMUZDAN dönüyor, bacakların tersine sallanıyor
    for (const s of [-1, 1]) {
        const sw = -swing * s;
        const sx = px(s * (cw * 0.5 - a.h * 0.012));
        const sy = a.shoulderY + a.h * 0.05 + y0;
        const ex = sx + sw * stepX * 0.5 * dir;
        const ey = sy + torsoH * 0.55;
        const hx2 = ex + sw * stepX * 0.4 * dir;
        const hy2 = a.hipY + a.h * 0.06 + y0;
        const tone = s < 0 ? lit : shade;
        limbCells(ctx, cam, sx, sy, ex, ey, a.h * 0.07, tone);
        limbCells(ctx, cam, ex, ey, hx2, hy2, a.h * 0.06, tone);
        cam.rect(ctx, hx2 - a.h * 0.025, hy2, a.h * 0.05, a.h * 0.04, skin);      // el
        cam.rect(ctx, ex - a.h * 0.035, ey - a.h * 0.01, a.h * 0.07, a.h * 0.02, s < 0 ? shade : trouserDark);
    }

    // --- Boyun, kafa, YÜZ
    // Yüz hatları gidilen yöne kayık: gövde yandan, yüz dörtte üç.
    const hx = px(dir * a.h * 0.008);
    const hy = a.top + y0;
    cam.rect(ctx, px(-a.h * 0.03), a.shoulderY - a.h * 0.045 + y0, a.h * 0.06, a.h * 0.06, skinShade);   // boyun
    cam.rect(ctx, hx - a.headW / 2, hy, a.headW, a.headH, skin);
    cam.rect(ctx, hx - a.headW / 2, hy, a.headW * 0.26, a.headH, skinShade);        // yüzün gölgeli yanı
    cam.rect(ctx, hx + a.headW * 0.5 - a.h * 0.012, hy + a.headH * 0.42, a.h * 0.018, a.headH * 0.2, skinShade); // kulak

    const eyeY = hy + a.headH * 0.46;
    const eyeW = Math.max(0.8, a.headW * 0.2);
    const eyeH = Math.max(0.7, a.headH * 0.14);
    const gap = a.headW * 0.17;
    const fx = dir * a.headW * 0.06;
    for (const s of [-1, 1]) {
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2, eyeY - eyeH * 1.5, eyeW * 1.2, eyeH * 0.7, hair);  // kaş
        cam.rect(ctx, hx + fx + s * gap - eyeW / 2, eyeY, eyeW, eyeH, '#20242a');                      // göz
    }
    cam.rect(ctx, hx + fx + dir * a.headW * 0.1, eyeY + eyeH * 1.2, eyeW * 0.7, eyeH * 1.1, skinShade); // burun
    cam.rect(ctx, hx + fx - a.headW * 0.1, eyeY + eyeH * 3, a.headW * 0.28, eyeH * 0.8,
        mouth);                                                                  // ağız

    // Saç: alnın üstünde, ense hafif aşağı iniyor
    cam.rect(ctx, hx - a.headW / 2 - a.h * 0.006, hy - a.h * 0.012,
        a.headW + a.h * 0.012, a.headH * 0.4, hair);
    cam.rect(ctx, hx - dir * a.headW * 0.5, hy + a.headH * 0.2, a.headW * 0.22, a.headH * 0.45, hair);
    if (p.hat) {
        cam.rect(ctx, hx - a.headW * 0.78, hy + a.headH * 0.24, a.headW * 1.56, a.h * 0.022, hatBrim);
        cam.rect(ctx, hx - a.headW * 0.55, hy - a.h * 0.055, a.headW * 1.1, a.h * 0.07, hair);
    }

    // Çanta
    if (p.bag) {

        limbCells(ctx, cam, px(cw * 0.16), a.shoulderY + a.h * 0.03 + y0,
            px(cw * 0.5), a.hipY - a.h * 0.02 + y0, a.h * 0.018, bag);
        cam.rect(ctx, px(cw * 0.34), a.hipY - a.h * 0.02 + y0, a.h * 0.1, a.h * 0.12, bag);
        cam.rect(ctx, px(cw * 0.34), a.hipY - a.h * 0.02 + y0, a.h * 0.1, a.h * 0.02, bagLit);
    }

    // Bulaşmış olanın omzunda soluk bir iz - kimse fark etmiyor
    if (p.mark > 0) {
        const [mx, my] = shoulder(p, p.markSide || 1);
        cam.glow(ctx, mx, my + y0, a.h * 0.4, 'rgba(255,255,255,ALPHA)', 0.16 * p.mark);
        cam.rect(ctx, mx - a.h * 0.04, my - a.h * 0.01 + y0, a.h * 0.065, a.h * 0.04,
            mix(coat, '#3f9a28', 0.55 * p.mark));
    }
}

// Kişinin bütün renk tonları bir kez karıştırılıyor. Uzaklık (dim) şeride
// bağlı ve değişmiyor, kıyafet de değişmiyor - her karede yeniden hex
// ayrıştırmanın anlamı yok.
function bakeTones(p) {
    const dim = LANES[p.lane].dim;
    const coat = mix(p.coat, HAZE, dim);
    const trouser = mix(p.trouser, HAZE, dim * 0.7);
    const bag = mix(mix(p.coat, '#000000', 0.55), HAZE, dim);
    const hair = mix(p.hair, HAZE, dim * 0.6);
    const scarf = p.scarf ? mix(p.scarf, HAZE, dim) : null;
    p.tones = {
        coat,
        lit: mix(coat, '#ffffff', 0.16),
        shade: mix(mix(p.coat, '#000000', 0.4), HAZE, dim),
        trouser,
        trouserLit: mix(trouser, '#ffffff', 0.1),
        trouserDark: mix(trouser, '#000000', 0.18),
        skin: mix(p.skin, HAZE, dim * 0.75),
        skinShade: mix(mix(p.skin, '#000000', 0.3), HAZE, dim * 0.75),
        mouth: mix(p.skin, '#7a3f38', 0.45),
        hair,
        hatBrim: mix(hair, '#000000', 0.25),
        scarf,
        scarfKnot: scarf ? mix(scarf, '#000000', 0.15) : null,
        bag,
        bagLit: mix(bag, '#ffffff', 0.18),
        ground: mix(WALK, '#000000', 0.16 - dim * 0.08)
    };
    return p;
}

// Yürüyen kalabalık: sayılar hash'ten geliyor, sahne her açılışta aynı
function buildCrowd() {
    const list = [];
    const counts = [11, 9, 6];
    counts.forEach((count, lane) => {
        for (let i = 0; i < count; i++) {
            const r = (s) => hash(lane * 17 + i, s, 11);
            list.push(bakeTones({
                lane,
                x0: -24 + (i + r(1) * 0.8) * ((SCENE.w + 56) / count),
                dir: r(2) > 0.46 ? 1 : -1,
                speed: 20 + r(3) * 14,
                h: LANES[lane].h * (0.87 + r(4) * 0.28),
                coat: COATS[Math.floor(r(5) * COATS.length)],
                trouser: TROUSERS[Math.floor(r(12) * TROUSERS.length)],
                skin: SKINS[Math.floor(r(8) * SKINS.length)],
                hair: HAIRS[Math.floor(r(9) * HAIRS.length)],
                scarf: r(13) > 0.68 ? SCARVES[Math.floor(r(14) * SCARVES.length)] : null,
                longCoat: r(15) > 0.55,
                // Şerit birebir düz olmasın: sıra çizgi gibi durmasın diye
                dy: (r(10) - 0.5) * 3,
                phase: r(6) * 6.3,
                bag: r(7) > 0.74,
                hat: r(11) > 0.8,
                mark: 0
            }));
        }
    });
    return list;
}

const CROWD = buildCrowd();

// Bordürde bekleyenler: virüsün girdiği kişi ve zincirin halkaları.
// HİÇBİRİ YÜRÜMÜYOR - karşıya geçmeyi bekliyorlar. Yürüselerdi kütle
// yetişemez, giriş anında adam kadrajdan kaçardı.
function stander(x, lane, opts) {
    return bakeTones({
        x, lane, still: true, dir: opts.dir || 1,
        h: LANES[lane].h * (opts.s || 1),
        dy: opts.dy || 0,
        coat: opts.coat, trouser: opts.trouser || TROUSERS[0],
        skin: opts.skin, hair: opts.hair,
        scarf: opts.scarf || null, longCoat: opts.longCoat || false,
        phase: opts.phase || 0, bag: opts.bag || false, hat: opts.hat || false,
        speed: 0, mark: 0
    });
}

const HOST = stander(76, 2, {
    coat: '#41505f', skin: '#a8825f', hair: '#241f1b', trouser: '#2c3138',
    longCoat: true, phase: 1.2, dir: 1
});
const CATCHERS = [
    stander(96, 2, { coat: '#6d564a', skin: '#c39c74', hair: '#3f2c1e', trouser: '#3b3630', bag: true, phase: 2.4, dir: -1, s: 0.95 }),
    stander(112, 1, { coat: '#4c5b52', skin: '#7d5b40', hair: '#161514', trouser: '#243040', scarf: '#8c4a42', phase: 0.6, dir: 1 }),
    stander(132, 2, { coat: '#48566a', skin: '#d0aa84', hair: '#5a4326', trouser: '#333a33', longCoat: true, phase: 3.1, dir: -1, s: 0.92 }),
    stander(56, 1, { coat: '#7b7062', skin: '#8f6a4c', hair: '#241f1b', trouser: '#43392f', hat: true, phase: 1.9, dir: 1, s: 1.05 }),
    stander(150, 1, { coat: '#5a4a55', skin: '#a8825f', hair: '#6b6560', trouser: '#2c3138', phase: 4.2, dir: -1 }),
    stander(168, 2, { coat: '#3d4a42', skin: '#c39c74', hair: '#3f2c1e', trouser: '#243040', scarf: '#4a6d72', phase: 5.1, dir: 1, s: 0.9 }),
    stander(192, 1, { coat: '#8a5f4a', skin: '#7d5b40', hair: '#161514', trouser: '#3b3630', bag: true, phase: 2.8, dir: -1 }),
    stander(210, 2, { coat: '#3f4f66', skin: '#d0aa84', hair: '#5a4326', trouser: '#333a33', phase: 0.3, dir: 1, s: 0.94 })
];
const STANDING = [HOST, ...CATCHERS];

// Bulaşma zinciri. Dallanıyor: bir kişiden iki kişiye de geçiyor, çünkü
// yayılma sıra sıra değil. [kaynak, hedef, hangi omuzdan, ne zaman]
const CHAIN = [
    { from: HOST, to: CATCHERS[0], side: 1, at: [0.575, 0.63] },
    { from: HOST, to: CATCHERS[3], side: -1, at: [0.60, 0.66] },      // dal: sola
    { from: CATCHERS[0], to: CATCHERS[1], side: 1, at: [0.65, 0.705] },
    { from: CATCHERS[1], to: CATCHERS[2], side: 1, at: [0.70, 0.76] },
    { from: CATCHERS[2], to: CATCHERS[4], side: 1, at: [0.755, 0.815] },
    { from: CATCHERS[4], to: CATCHERS[5], side: 1, at: [0.805, 0.86] },
    { from: CATCHERS[5], to: CATCHERS[6], side: 1, at: [0.85, 0.905] },
    { from: CATCHERS[6], to: CATCHERS[7], side: 1, at: [0.89, 0.945] }
];

// Kime ne zaman bulaştığı: zincirin varış anları
const MARK_AT = [0.55, ...CATCHERS.map((c) => {
    const link = CHAIN.find(l => l.to === c);
    return link ? link.at[1] : 1.1;
})];

function walkerAt(p, time) {
    const width = SCENE.w + 56;
    let x = p.x0 + p.dir * p.speed * time;
    x = ((x + 28) % width + width) % width - 28;
    return { ...p, x };
}

// Kalabalık arkadan öne çiziliyor; bekleyenler kendi şeritlerinde araya
// giriyor ki öndeki arkadakini örtsün.
function crowd(ctx, cam, time, marks) {
    STANDING.forEach((p, i) => { p.mark = marks[i] || 0; });
    for (let lane = 0; lane < LANES.length; lane++) {
        for (const p of CROWD) {
            if (p.lane === lane) person(ctx, cam, walkerAt(p, time), time);
        }
        for (const p of STANDING) {
            if (p.lane === lane) person(ctx, cam, p, time);
        }
    }
}

// --- Sahne ---
//
// Çizim sırası derinlik sırası: cephe -> kaldırım -> bordür/yol -> mazgal ->
// kalabalık (arkadan öne) -> virüs -> mazgal demirleri -> direk.
// Kamera hiç kıpırdamadığı için caddenin kendisi HER KAREDE AYNI: bir kez
// çizilip saklanıyor, sonra tek seferde basılıyor. Kalabalık zaten kare
// başına birkaç bin dikdörtgen; arka planı da her karede yeniden çizmek
// 60 FPS'i düşürüyordu.
let backdrop = null;

function background(ctx, cam, A) {
    if (!backdrop || backdrop.w !== A.w || backdrop.h !== A.h) {
        const { canvas, ctx: c } = newCanvas(A.x + A.w, A.y + A.h);
        facades(c, cam);
        sidewalk(c, cam);
        bin(c, cam);
        road(c, cam);
        roadDetails(c, cam);
        grate(c, cam, {});
        backdrop = { canvas, w: A.w, h: A.h };
    }
    ctx.drawImage(backdrop.canvas, 0, 0);
}

function scene(ctx, cam, s) {
    background(ctx, cam, s.area);
    if (s.glint > 0) {
        cam.glow(ctx, GRATE.x + GRATE.w * 0.45, GRATE.y + GRATE.h * 0.55, 13,
            'rgba(255,255,255,ALPHA)', s.glint * 0.45);
    }
    crowd(ctx, cam, s.time, s.marks);
    if (s.draw) s.draw(ctx, cam);
    grate(ctx, cam, { bars: true });
    pole(ctx, cam);
    vignette(ctx, 0.28);
}

// =================== TEK KARE ===================
//
// Bölümün tamamı burada. Kamera sabit; anlatımı taşıyan tek şey kütlenin
// caddede aldığı yol.
//
//   0.00-0.16  kalabalık akıyor, mazgalın karanlığında bir kıpırtı
//   0.16-0.30  kütle demirlerin arasından çıkıyor
//   0.30-0.42  olukta akıp bordürü tırmanıyor
//   0.42-0.55  ayakların arasından geçip bekleyene varıyor ve DURMADAN
//              ayakkabısının dibinden içeri giriyor
//   0.55-0.90  omuzdan omuza, dallanarak dokuz kişiye
//   0.90-1.00  cadde yürümeye devam ediyor

const GX = GRATE.x + GRATE.w * 0.45;      // kütlenin çıktığı aralık
const SLOT = GRATE.y + 5;

function street(ctx, A, t) {
    const cam = createCam(A, WIDE);

    const rise = span(t, 0.16, 0.3);
    const gutter = span(t, 0.3, 0.365);
    const climb = span(t, 0.365, 0.425);
    const cross = span(t, 0.425, 0.52);
    // Giriş: yaklaşmanın DEVAMI, araya duraklama girmiyor. Duraklayınca
    // hem kütle zemine giriyormuş gibi duruyor hem de bekleyiş uzuyor.
    const enter = span(t, 0.5, 0.565);

    const shoeX = HOST.x - HOST.h * 0.062 - HOST.h * 0.02;
    const shoeY = LANES[2].feet - HOST.h * 0.03;

    const marks = MARK_AT.map(a => clamp01(span(t, a - 0.02, a + 0.03)));

    scene(ctx, cam, {
        area: A,
        time: t * 22,
        glint: Math.max(span(t, 0.06, 0.16) * 0.8, (rise < 1 ? rise : 0) * 0.4),
        marks,
        draw: (c, m) => {
            // --- Mazgaldan çıkış
            if (rise > 0 && enter < 1) {
                const e = easeOut(rise);
                let x = GX;
                let y = SLOT - lerp(0, 5.5, e);
                let r = lerp(0.9, 4.6, e);
                let wide = lerp(2.1, 1.3, e);
                let dirX = 1;
                let dirY = 0;
                let stretch = 0.3 * (1 - e);

                if (gutter > 0) {                       // olukta sağa akıyor
                    x = lerp(GX, shoeX - 22, easeIn(gutter));
                    y = SLOT - 5.5;
                    stretch = 0.5;
                }
                if (climb > 0) {                        // bordürü tırmanıyor
                    x = lerp(shoeX - 22, shoeX - 18, climb);
                    y = lerp(SLOT - 5.5, CURB_Y - 1.5, easeOut(climb));
                    dirX = 0.2;
                    dirY = -1;
                    stretch = 0.65;
                }
                if (cross > 0) {                        // kaldırımda ayaklara doğru
                    x = lerp(shoeX - 18, shoeX - 1.5, easeIn(cross));
                    y = CURB_Y - 1.5;
                    dirX = 1;
                    dirY = 0;
                    stretch = 0.5;
                }
                if (enter > 0) {                        // ayakkabının dibinden içeri
                    r *= 1 - easeIn(enter) * 0.96;
                    stretch = 0.75;
                    const feed = Math.max(0.4, 1.8 * (1 - enter));
                    limbCells(c, m, x, shoeY - 0.4, shoeX + 0.8, shoeY - 0.4, feed, '#3f9a28');
                    m.glow(c, shoeX, shoeY - 0.6, 5, 'rgba(255,255,255,ALPHA)', 0.3 * (1 - enter));
                }
                if (r > 0.15) {
                    blobDrops(c, m, x, y, dirX, dirY, r, gutter > 0 && enter <= 0 ? 0.7 : 0.25);
                    drawBlob(c, m, { x, y, r, wide, wob: t * 40, stretch, dirX, dirY, light: rise });
                }
            }

            // --- Omuzdan omuza
            for (const link of CHAIN) {
                const k = span(t, link.at[0], link.at[1]);
                if (k <= 0 || k >= 1) continue;
                const [sx, sy] = shoulder(link.from, link.side);
                const [ex, ey] = shoulder(link.to, -link.side);
                const e = easeOut(k);
                const x = lerp(sx, ex, e);
                // Yay: parça omuzdan omuza düz gitmiyor, yukarıdan atlıyor
                const y = lerp(sy, ey, e) - Math.sin(k * Math.PI) * 3.4;
                const dx = ex > sx ? 1 : -1;
                const r = lerp(3, 2.4, k);
                blobDrops(c, m, x, y, dx, 0, r, 0.7);
                drawBlob(c, m, {
                    x, y, r,
                    wob: t * 44,
                    stretch: Math.sin(k * Math.PI) * 0.8,
                    dirX: dx, dirY: 0, light: 1
                });
            }
        }
    });
}

export const CHAPTER_2_ART = { street };
