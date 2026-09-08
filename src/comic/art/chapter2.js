// 2. BÖLÜM - CADDE
//
// Virüsün insana geçtiği yer. Bölümün tamamı TEK ÇEKİM ve TAMAMEN SESSİZ:
// ne anlatıcı kutusu ne balon. Olan biteni yalnızca kamera biliyor;
// kaldırımdaki hiç kimse bakmıyor bile.
//
// Sıra: kalabalık cadde -> sol alttaki yağmur mazgalı -> kütlenin çıkışı ->
// kaldırıma tırmanıp bekleyen birinin AYAĞINDAN içeri girmesi -> omuzdan
// omuza bulaşma zinciri -> hiçbir şey olmamış gibi yürüyen kalabalık.
//
// VİRÜSÜN YENİ GÖRÜNTÜSÜ (kullanıcının tarifi): TEK RENK, OVALİMSİ,
// AKIŞKAN, BEYAZ IŞIKLI. 1. bölümdeki sarkan kütleyle aynı biçim değil:
// burada kap yok, kütle kendi başına ve akışkan. Işık şöyle veriliyor -
// aynı oval önce beyaz basılıyor, üstüne gövde biraz küçültülüp sağ alta
// kaydırılarak konuyor; geriye üst-sol kenarda beyaz bir hilal kalıyor.
// Gittiği yöne uzayıp dikine yassılıyor: akışkanlık buradan okunuyor.
//
// KURAL: kimse virüsü görmüyor. Ne bir kafa dönüyor ne bir adım duruyor.

import { PX, hash } from '../../pixel/pixelDraw.js';
import {
    createCam, vignette, darken, mix,
    span, clamp01, easeOut, easeIn, lerp
} from '../comicKit.js';

// --- Sahnenin ölçüleri (hücre) ---
// 232x122 tam kadraj: bir hücre PX iken sahne kareyi birebir dolduruyor.

const SCENE = { w: 232, h: 122 };
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };
const DRAIN = { u: PX * 3, cx: 42, cy: 100 };      // mazgalın yakın planı
const CURB = { u: PX * 2.6, cx: 88, cy: 92 };      // kaldırım kenarı
const FEET = { u: PX * 3, cx: 114, cy: 88 };       // bekleyenin ayakları
const MED = { u: PX * 2.2, cx: 124, cy: 74 };      // omuz hizası

const WALL_TOP = 0;        // binaların üstü (kadrajın dışına taşıyor)
const CORNICE = 22;        // üst katla dükkân vitrini arası silme
const SHOP_Y = 28;         // tentelerin bandı
const WALK_Y = 52;         // kaldırımın arka kenarı
const CURB_Y = 96;         // kaldırım yüzeyinin bittiği yer
const CURB_H = 6;          // bordür yüzü
const ROAD_Y = CURB_Y + CURB_H;
const GRATE = { x: 18, y: 105, w: 36, h: 9 };      // yağmur suyu mazgalı
const POLE_X = 206;        // kaldırım kenarındaki direk

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

const VIRUS = '#3f9a28';           // TEK RENK
const VIRUS_LIGHT = '#f2fff4';     // beyaz ışık

const COATS = [
    '#41505f', '#6d564a', '#4c5b52', '#343d49',
    '#6b6052', '#48566a', '#5a4a55', '#3d4a42',
    '#7b7062', '#525c63'
];
const SKINS = ['#8a6a52', '#a2856a', '#6d5241', '#b09077', '#7b5d47'];
const HAIRS = ['#241f1b', '#3a2c22', '#161514', '#4a3a2a', '#5a5048'];

// Hücre düzleminde kalın çapraz çizgi (kol, akan hat)
function limbCells(ctx, cam, x0, y0, x1, y1, thick, color) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.5));
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
        cam.rect(ctx, s.x, WALL_TOP, s.w, CORNICE, s.tone);
        // Sabah ışığı soldan geliyor: her binanın sol kenarı bir tık açık
        cam.rect(ctx, s.x, WALL_TOP, 3, CORNICE, mix(s.tone, '#ffffff', 0.16));
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
    // Arkası bir tık koyu: ışık kaldırımın ön yarısına düşüyor
    cam.rect(ctx, 0, WALK_Y, SCENE.w, 10, mix(WALK, '#000000', 0.1));

    let y = WALK_Y + 4;
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

// Yağmur mazgalı. bars=true ise yalnızca demirler çiziliyor: kütle
// aralıklardan çıkarken demirlerin ARKASINDA kalsın diye iki kez çağrılıyor.
function grate(ctx, cam, { bars = false, glint = 0 } = {}) {
    const { x, y, w, h } = GRATE;
    if (!bars) {
        cam.rect(ctx, x - 2, y - 2, w + 4, h + 4, '#33383e');     // beton çerçeve
        cam.rect(ctx, x - 1, y - 1, w + 2, h + 2, '#22262b');
        cam.rect(ctx, x, y, w, h, '#0e1114');                     // karanlık boşluk
        // Bordürün dibindeki ağız: yağmur suyu buradan giriyor
        cam.rect(ctx, x + 9, CURB_Y + 3, w - 18, 2, '#1a1f24');
        cam.rect(ctx, x + 9, CURB_Y + 2, w - 18, 1, '#9aa1a8');
        if (glint > 0) cam.glow(ctx, x + w * 0.45, y + h * 0.55, 13, 'rgba(255,255,255,ALPHA)', glint * 0.4);
        return;
    }
    // Demirler ince, aralıklar geniş: kütle aralıklardan görünebilsin
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
    cam.rect(ctx, POLE_X - 1, WALL_TOP - 4, 3, CURB_Y - 2, '#4e545b');
    cam.rect(ctx, POLE_X - 1, WALL_TOP - 4, 1, CURB_Y - 2, '#646b72');
}

// Çöp kutusu: kalabalığın arasında duran tek durağan şey
function bin(ctx, cam) {
    const x = 58;
    const top = 68;
    cam.rect(ctx, x - 2, 92, 14, 1.4, mix(WALK, '#000000', 0.16));   // gölge
    cam.rect(ctx, x - 1, top, 12, 2, '#6b747c');                     // kapak
    cam.rect(ctx, x, top + 2, 10, 22, '#4a525a');
    cam.rect(ctx, x, top + 2, 3, 22, '#5b646c');
    for (let rx = x + 2; rx < x + 9; rx += 3) cam.rect(ctx, rx, top + 4, 1, 18, '#3b424a');
    cam.rect(ctx, x + 1, 90, 8, 2, '#343b42');
}

// Araba yolu: yol çizgileri, bir rögar kapağı ve sağ alt köşede kadrajın
// kestiği tek bir teker. Arabanın tamamını çizmek kaldırımı kapatıyor;
// burasının araba yolu olduğunu söylemeye teker yetiyor.
function roadDetails(ctx, cam) {
    for (let x = 8; x < SCENE.w; x += 34) cam.rect(ctx, x, 118, 14, 1.4, '#9aa0a6');
    const mx = 108;
    cam.rect(ctx, mx - 11, 110, 22, 7, '#454b52');
    cam.rect(ctx, mx - 9, 111, 18, 5, '#565d64');
    for (let i = 0; i < 3; i++) cam.rect(ctx, mx - 7 + i * 5, 112, 2, 3, '#3d434a');

    // Sağ alt köşedeki teker ve gövdenin altı
    const cx = 196;
    cam.rect(ctx, cx - 12, 112, SCENE.w - cx + 20, 10, '#252a30');    // gövdenin altı
    cam.rect(ctx, cx - 12, 112, SCENE.w - cx + 20, 1.4, '#5e6874');
    cam.rect(ctx, cx, 110, 20, 12, '#16191d');                        // lastik
    cam.rect(ctx, cx + 4, 113, 12, 7, '#4d555e');                     // jant
    cam.rect(ctx, cx + 7, 115, 6, 3, '#767f89');
}

// --- Kalabalık ---
//
// Yüz yok: kafa tek parça karaltı. Kimliksiz bir kalabalık lazım, çünkü
// virüsün kime girdiğinin bir önemi yok.

const LANES = [
    { feet: 70, h: 20, dim: 0.52 },      // arka sıra: vitrinlerin önü
    { feet: 82, h: 28, dim: 0.24 },
    { feet: 96, h: 38, dim: 0.00 }       // ön sıra: bordürün kenarı
];

function anatomy(p) {
    const feet = LANES[p.lane].feet + (p.dy || 0);
    const h = p.h;
    const top = feet - h;
    return {
        feet, top, h,
        headW: h * 0.15,
        headH: h * 0.17,
        shoulderY: top + h * 0.2,
        coatW: h * 0.28,
        hipY: top + h * 0.56
    };
}

// Omzun noktası: bulaşma zinciri buraya konuyor
function shoulder(p, side) {
    const a = anatomy(p);
    return [p.x + side * a.coatW * 0.5, a.shoulderY + a.h * 0.03];
}

function person(ctx, cam, p, time) {
    const a = anatomy(p);
    const dim = LANES[p.lane].dim;
    const coat = mix(p.coat, HAZE, dim);
    const lit = mix(coat, '#ffffff', 0.14);                      // soldan gelen ışık
    const shade = mix(mix(p.coat, '#000000', 0.4), HAZE, dim);
    const trouser = mix(mix(p.coat, '#000000', 0.62), HAZE, dim * 0.7);
    const head = mix(p.skin || '#6b5a4c', HAZE, dim * 0.8);
    const hair = mix(p.hair || '#2a2723', HAZE, dim * 0.6);
    const swing = p.still ? Math.sin(time * 1.6 + p.phase) * 0.1 : Math.sin(time * 11 + p.phase);
    const bob = p.still ? 0 : Math.abs(Math.sin(time * 11 + p.phase)) * a.h * 0.012;
    const step = a.h * 0.1;
    const y0 = -bob;

    // Yere değdiği yer: gölge olmayınca kalabalık zeminin üstünde yüzüyor
    cam.rect(ctx, p.x - a.coatW * 0.8, a.feet - 0.6, a.coatW * 1.6, 1.4,
        mix(WALK, '#000000', 0.16 - dim * 0.08));

    // Bacaklar: aralarında boşluk var, ayakkabı küçük
    const legW = a.h * 0.085;
    for (const s of [-1, 1]) {
        const off = swing * step * s;
        const lx = p.x + s * a.h * 0.06 - legW / 2 + off;
        cam.rect(ctx, lx, a.hipY + y0, legW, a.feet - a.hipY - y0, trouser);
        cam.rect(ctx, lx - legW * 0.25 + off * 0.3, a.feet - a.h * 0.035,
            legW * 1.6, a.h * 0.04, '#1d2126');
    }

    // Palto: omuz bandı bir tık geniş, etek hafif daralıyor
    const cw = a.coatW;
    const torsoH = a.hipY - a.shoulderY + a.h * 0.05;
    cam.rect(ctx, p.x - cw / 2 - a.h * 0.02, a.shoulderY + y0, cw + a.h * 0.04, a.h * 0.06, coat);
    cam.rect(ctx, p.x - cw / 2, a.shoulderY + y0, cw, torsoH, coat);
    cam.rect(ctx, p.x - cw / 2, a.shoulderY + y0, cw * 0.3, torsoH, lit);
    cam.rect(ctx, p.x + cw * 0.3, a.shoulderY + y0, cw * 0.2, torsoH, shade);
    cam.rect(ctx, p.x - a.h * 0.01, a.shoulderY + a.h * 0.08 + y0, a.h * 0.02, torsoH - a.h * 0.08, shade);

    // Kollar: gövdenin kenarında, bacakların tersine sallanıyor
    for (const s of [-1, 1]) {
        const ax = p.x + s * (cw * 0.5 - a.h * 0.01);
        const hx = ax - swing * step * s * 0.7;
        limbCells(ctx, cam, ax, a.shoulderY + a.h * 0.06 + y0, hx, a.hipY + a.h * 0.06 + y0,
            a.h * 0.06, s < 0 ? mix(coat, '#ffffff', 0.06) : shade);
    }

    // Boyun ve kafa: YÜZ HATTI YOK - saç ve karaltı, o kadar
    cam.rect(ctx, p.x - a.h * 0.035, a.shoulderY - a.h * 0.04 + y0, a.h * 0.07, a.h * 0.06, mix(head, '#000000', 0.35));
    cam.rect(ctx, p.x - a.headW / 2, a.top + y0, a.headW, a.headH, head);
    cam.rect(ctx, p.x - a.headW / 2, a.top + y0, a.headW * 0.32, a.headH, mix(head, '#ffffff', 0.12));
    cam.rect(ctx, p.x - a.headW / 2 - a.h * 0.005, a.top - a.h * 0.01 + y0,
        a.headW + a.h * 0.01, a.headH * 0.46, hair);
    // Şapka: kalabalıkta herkesin silueti aynı olmasın
    if (p.hat) {
        cam.rect(ctx, p.x - a.headW * 0.75, a.top + a.headH * 0.28 + y0, a.headW * 1.5, a.h * 0.02, hair);
        cam.rect(ctx, p.x - a.headW * 0.55, a.top - a.h * 0.05 + y0, a.headW * 1.1, a.h * 0.06, hair);
    }

    if (p.bag) {
        limbCells(ctx, cam, p.x + cw * 0.2, a.shoulderY + a.h * 0.05 + y0,
            p.x + cw * 0.55, a.hipY - a.h * 0.02 + y0, a.h * 0.02, shade);
        cam.rect(ctx, p.x + cw * 0.42, a.hipY - a.h * 0.02 + y0, a.h * 0.1, a.h * 0.11, shade);
    }

    // Bulaşmış olanın omzunda soluk bir iz - kimse fark etmiyor
    if (p.mark > 0) {
        const [sx, sy] = shoulder(p, p.markSide || 1);
        cam.glow(ctx, sx, sy, a.h * 0.42, 'rgba(255,255,255,ALPHA)', 0.16 * p.mark);
        cam.rect(ctx, sx - a.h * 0.045, sy - a.h * 0.01, a.h * 0.07, a.h * 0.045,
            mix(coat, VIRUS, 0.5 * p.mark));
    }
}

// Yürüyen kalabalık: sayılar hash'ten geliyor, sahne her açılışta aynı
function buildCrowd() {
    const list = [];
    const counts = [17, 14, 10];
    counts.forEach((count, lane) => {
        for (let i = 0; i < count; i++) {
            const r = (s) => hash(lane * 17 + i, s, 11);
            list.push({
                lane,
                x0: -24 + (i + r(1) * 0.8) * ((SCENE.w + 56) / count),
                dir: r(2) > 0.46 ? 1 : -1,
                speed: 18 + r(3) * 16,
                h: LANES[lane].h * (0.86 + r(4) * 0.3),
                coat: COATS[Math.floor(r(5) * COATS.length)],
                skin: SKINS[Math.floor(r(8) * SKINS.length)],
                hair: HAIRS[Math.floor(r(9) * HAIRS.length)],
                // Şerit birebir düz olmasın: sıra çizgi gibi durmasın diye
                dy: (r(10) - 0.5) * 3,
                phase: r(6) * 6.3,
                bag: r(7) > 0.72,
                hat: r(11) > 0.78,
                mark: 0
            });
        }
    });
    return list;
}

const CROWD = buildCrowd();

// Bordürde bekleyenler: virüsün girdiği kişi ve zincirin halkaları.
// Yürümüyorlar - karşıya geçmeyi bekliyorlar; kütle bu yüzden onlara
// yetişebiliyor ve bulaşma zinciri kadrajda duruyor.
const HOST = {
    x: 114, lane: 2, h: 38, dy: 0, coat: '#455568', skin: '#9b7c62', hair: '#241f1b',
    phase: 1.2, still: true, bag: false, mark: 0
};
const CATCHERS = [
    {
        x: 133, lane: 2, h: 36, dy: -1, coat: '#6d564a', skin: '#7b5d47', hair: '#3a2c22',
        phase: 2.4, still: true, bag: true, mark: 0
    },
    {
        x: 150, lane: 1, h: 28, dy: 1, coat: '#4c5b52', skin: '#a2856a', hair: '#161514',
        phase: 0.6, still: true, bag: false, mark: 0
    },
    {
        x: 99, lane: 1, h: 29, dy: -1, coat: '#7b7062', skin: '#6d5241', hair: '#4a3a2a',
        phase: 3.1, still: true, bag: false, mark: 0
    }
];
const STANDING = [HOST, ...CATCHERS];

// Zincirin sırası: kimden kime, hangi omuzdan
const CHAIN = [
    { from: HOST, to: CATCHERS[0], side: 1 },
    { from: CATCHERS[0], to: CATCHERS[1], side: 1 },
    { from: CATCHERS[1], to: CATCHERS[2], side: -1 }
];

function walkerAt(p, time) {
    const width = SCENE.w + 56;
    let x = p.x0 + p.dir * p.speed * time;
    x = ((x + 28) % width + width) % width - 28;
    return { ...p, x, still: false };
}

// Kalabalık arkadan öne çiziliyor; bekleyenler kendi şeritlerinde araya
// giriyor ki öndeki arkadakini örtsün.
function crowd(ctx, cam, time, { walk = true, marks = [] } = {}) {
    STANDING.forEach((p, i) => { p.mark = marks[i] || 0; });
    for (let lane = 0; lane < LANES.length; lane++) {
        for (const p of CROWD) {
            if (p.lane === lane) person(ctx, cam, walkerAt(p, time), time);
        }
        for (const p of STANDING) {
            if (p.lane !== lane) continue;
            person(ctx, cam, walk ? walkerAt({ ...p, x0: p.x, dir: 1, speed: 22 }, time) : p, time);
        }
    }
}

// --- Virüs ---
//
// Tek renk, ovalimsi, akışkan, beyaz ışıklı. Kütlenin çizgisi yok:
// yalnızca dolgu var, hacim beyaz hilalden okunuyor.

function ellipse(ctx, cam, x, y, rx, ry, color, wob) {
    if (rx <= 0.05 || ry <= 0.05) return;
    const rows = Math.max(4, Math.ceil(ry * 3.2));
    const rowH = (ry * 2) / rows;
    for (let i = 0; i < rows; i++) {
        const dy = -ry + (i + 0.5) * rowH;
        let half = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)));
        // Akışkanlık: kenar durmuyor, hafifçe dalgalanıyor. Fazlası ovali
        // bozup köşeli bir leke yapıyor - bu yüzden kısık.
        half *= 1 + Math.sin(dy * 0.8 + wob) * 0.055 + Math.sin(dy * 1.9 - wob * 1.3) * 0.03;
        if (half <= 0.05) continue;
        cam.rect(ctx, x - half, y + dy - rowH / 2, half * 2, rowH + 0.4, color);
    }
}

// x, y = kütlenin merkezi. stretch: hareketin uzattığı miktar,
// dirX/dirY: hangi yöne uzayacağı. light: beyaz ışığın gücü.
function blob(ctx, cam, { x, y, r = 4, wide = 1.25, wob = 0, stretch = 0, dirX = 1, dirY = 0, light = 1 }) {
    const ax = Math.abs(dirX);
    const ay = Math.abs(dirY);
    const rx = r * wide * (1 + stretch * 0.55 * ax) * (1 - stretch * 0.3 * ay);
    const ry = r * (1 + stretch * 0.55 * ay) * (1 - stretch * 0.3 * ax);
    if (rx <= 0.05 || ry <= 0.05) return;

    if (light > 0) cam.glow(ctx, x, y, Math.max(rx, ry) * 3, 'rgba(255,255,255,ALPHA)', 0.2 * light);
    // Beyaz ışık: alttaki oval beyaz, üstteki gövde sağ alta kayık
    ellipse(ctx, cam, x, y, rx, ry, VIRUS_LIGHT, wob);
    ellipse(ctx, cam, x + rx * 0.14, y + ry * 0.17, rx * 0.9, ry * 0.86, VIRUS, wob);
    // Sırtındaki parıltı
    cam.rect(ctx, x - rx * 0.5, y - ry * 0.52, Math.max(0.7, rx * 0.24), Math.max(0.6, ry * 0.18), VIRUS_LIGHT);
}

// Arkada kalan iki damla: kütle katı değil, akıyor
function droplets(ctx, cam, x, y, dirX, dirY, r, k) {
    if (k <= 0) return;
    for (let i = 0; i < 2; i++) {
        const back = (i + 1) * r * 1.6 * k;
        const s = r * (0.3 - i * 0.1);
        if (s <= 0.05) continue;
        ellipse(ctx, cam, x - dirX * back, y - dirY * back, s * 1.2, s, VIRUS_LIGHT, 0);
        ellipse(ctx, cam, x - dirX * back + s * 0.2, y - dirY * back + s * 0.2, s, s * 0.8, VIRUS, 0);
    }
}

// --- Sahne ---
//
// Çizim sırası derinlik sırası: cephe -> kaldırım -> bordür/yol -> mazgal ->
// kalabalık (arkadan öne) -> virüs -> mazgal demirleri -> direk -> araba.
function scene(ctx, cam, s) {
    facades(ctx, cam);
    sidewalk(ctx, cam);
    bin(ctx, cam);
    road(ctx, cam);
    grate(ctx, cam, { glint: s.glint || 0 });
    crowd(ctx, cam, s.time, { walk: s.walk !== false, marks: s.marks });
    if (s.draw) s.draw(ctx, cam);
    grate(ctx, cam, { bars: true });
    pole(ctx, cam);
    roadDetails(ctx, cam);
    vignette(ctx, 0.3);
    if (s.dim) darken(ctx, s.dim);
}

function camAt(A, from, to, k) {
    return createCam(A, {
        u: lerp(from.u, to.u, k),
        cx: lerp(from.cx, to.cx, k),
        cy: lerp(from.cy, to.cy, k)
    });
}

// =================== KARELER ===================
//
// Kalabalık bölüm boyunca DURMADAN yürüyor: her karenin saati bir öncekinin
// bittiği yerden başlıyor. Tek çekim, araya siyah girmiyor.

// --- 1. Kalabalık cadde. Hiçbir şey olmuyor - henüz. ---
function streetCrowd(ctx, A, t) {
    const cam = createCam(A, WIDE);
    scene(ctx, cam, {
        time: t * 1.6,
        // Sonda mazgalın karanlığında bir kez beyaz kıpırtı: kimse bakmıyor
        glint: span(t, 0.82, 1) * 0.5
    });
}

// --- 2. HAREKETLİ: kamera mazgala iniyor, kütle demirlerin arasından çıkıyor ---
function drainMouth(ctx, A, t) {
    const push = easeOut(span(t, 0, 0.42));
    const cam = camAt(A, WIDE, DRAIN, push);

    const stir = span(t, 0.34, 0.6);          // karanlıkta kıpırtı
    const rise = span(t, 0.52, 0.9);          // demirlerin arasından yükseliyor
    const settle = span(t, 0.88, 1);
    const gx = GRATE.x + GRATE.w * 0.45;
    const slot = GRATE.y + 5;                 // çıktığı aralık: ortadaki

    scene(ctx, cam, {
        time: 1.6 + t * 1.5,
        glint: Math.max(stir * 0.7, rise * 0.4),
        draw: (c, m) => {
            if (rise <= 0) return;
            const e = easeOut(rise);
            const r = lerp(0.9, 5, e);
            // Aralığın hizasından yukarı doğru çıkıyor: alt yarısı demirlerin
            // ARKASINDA kalıyor, çünkü demirler bundan sonra çiziliyor.
            const y = slot - lerp(0, 5.5, e) - settle * 0.8;
            blob(c, m, {
                x: gx, y, r,
                wide: lerp(2.1, 1.3, e),      // önce yarığa yayılıyor, sonra toparlanıyor
                wob: t * 9,
                stretch: 0.3 * (1 - e),
                dirX: 1,
                light: rise
            });
        }
    });
}

// --- 3. HAREKETLİ: oluktan geçip bordürü tırmanıyor, ayaklar arasına giriyor ---
function drainCrawl(ctx, A, t) {
    const pan = easeOut(span(t, 0, 0.55));
    const cam = camAt(A, DRAIN, CURB, pan);

    const slide = span(t, 0.02, 0.4);         // olukta sağa akıyor
    const climb = span(t, 0.4, 0.72);         // bordürü tırmanıyor
    const walk = span(t, 0.72, 1);            // kaldırımda ilerliyor

    let x = lerp(GRATE.x + GRATE.w * 0.42, 74, easeIn(slide));
    let y = GRATE.y + 1;
    let dirX = 1;
    let dirY = 0;
    let stretch = slide > 0 && slide < 1 ? 0.5 : 0.2;

    if (climb > 0) {
        x = lerp(74, 78, climb);
        y = lerp(GRATE.y + 1, CURB_Y - 1, easeOut(climb));
        dirX = 0.2;
        dirY = -1;
        stretch = climb < 1 ? 0.7 : 0.25;
    }
    if (walk > 0) {
        x = lerp(78, 96, easeOut(walk));
        y = CURB_Y - 1;
        dirX = 1;
        dirY = 0;
        stretch = 0.45;
    }

    scene(ctx, cam, {
        time: 3.1 + t * 1.5,
        gratedBars: true,
        draw: (c, m) => {
            droplets(c, m, x, y, dirX, dirY, 4, (slide > 0 && walk < 1) ? 0.8 : 0.3);
            blob(c, m, { x, y, r: 4.2, wob: t * 11, stretch, dirX, dirY, light: 1 });
        }
    });
}

// --- 4. HAREKETLİ: bekleyenin AYAĞINDAN içeri giriyor ---
//
// Ayakkabının dibinde bir boşluk VARMIŞ gibi içeri akıyor; kişi hiç
// kıpırdamıyor, ne baktı ne durdu.
function footEntry(ctx, A, t) {
    const pull = easeOut(span(t, 0, 0.3));
    const cam = camAt(A, CURB, FEET, pull);

    const near = span(t, 0.06, 0.4);          // ayakkabıya yaklaşıyor
    const pause = span(t, 0.4, 0.52);         // bir an duruyor
    const pour = span(t, 0.52, 0.9);          // içeri akıyor
    const flash = span(t, 0.82, 0.94);

    // Ayakkabının sol kenarı: kütle ORAYA kadar geliyor, üstünü örtmüyor.
    // Örterse "içeri giriyor" değil "üstüne yayıldı" gibi duruyor.
    const shoeX = HOST.x - 4.8;
    const shoeY = LANES[2].feet - 1;
    const x = lerp(96, shoeX - 7, easeOut(near));
    const r = lerp(3.4, 3.8, pause) * (1 - easeIn(pour) * 0.92);

    scene(ctx, cam, {
        time: 4.6 + t * 0.9,
        draw: (c, m) => {
            // İçeri akan hat: ayakkabının dibinde boşluk varmış gibi giriyor
            if (pour > 0 && pour < 1) {
                const feed = Math.max(0.5, 2.2 * (1 - pour * 0.7));
                limbCells(c, m, x + r, shoeY - 0.2, shoeX + 1, shoeY - 0.2, feed, VIRUS);
                limbCells(c, m, x + r, shoeY - 0.9, shoeX + 0.5, shoeY - 0.9, feed * 0.45, VIRUS_LIGHT);
                m.glow(c, shoeX, shoeY - 0.4, 5, 'rgba(255,255,255,ALPHA)', 0.3);
            }
            blob(c, m, {
                x,
                y: shoeY - 0.6 - r * 0.7,
                r,
                wob: t * 12,
                stretch: pour > 0 ? 0.5 : 0.35 * (1 - pause),
                dirX: 1,
                dirY: 0,
                light: 1 - pour * 0.25
            });
            if (flash > 0) {
                const f = Math.sin(clamp01(flash) * Math.PI);
                m.glow(c, shoeX + 1, shoeY - 1, 9, 'rgba(255,255,255,ALPHA)', 0.5 * f);
            }
        }
    });
}

// --- 5. HAREKETLİ: omuzdan omuza. Zincir kimsenin gözüne ilişmiyor. ---
function shoulderChain(ctx, A, t) {
    const back = easeOut(span(t, 0, 0.28));
    const cam = camAt(A, FEET, MED, back);

    // Üç geçiş: her biri kaynağın omzundan çıkıp hedefin omzuna konuyor
    const LEGS = [[0.24, 0.46], [0.48, 0.7], [0.72, 0.94]];
    const marks = [
        clamp01(span(t, 0.1, 0.24)),          // HOST: içine gireli çok olmadı
        clamp01(span(t, 0.44, 0.5)),
        clamp01(span(t, 0.68, 0.74)),
        clamp01(span(t, 0.92, 0.98))
    ];

    scene(ctx, cam, {
        time: 5.5 + t * 0.8,
        walk: false,
        marks,
        draw: (c, m) => {
            CHAIN.forEach((link, i) => {
                const k = span(t, LEGS[i][0], LEGS[i][1]);
                if (k <= 0 || k >= 1) return;
                const [sx, sy] = shoulder(link.from, link.side);
                const [ex, ey] = shoulder(link.to, -link.side);
                const e = easeOut(k);
                const x = lerp(sx, ex, e);
                // Yay: parça omuzdan omuza düz gitmiyor, yukarıdan atlıyor
                const y = lerp(sy, ey, e) - Math.sin(k * Math.PI) * 3.4;
                const dx = ex > sx ? 1 : -1;
                const r = lerp(2, 1.6, k);
                droplets(c, m, x, y, dx, 0, r, 0.7);
                blob(c, m, {
                    x, y, r,
                    wob: t * 14 + i,
                    stretch: Math.sin(k * Math.PI) * 0.8,
                    dirX: dx,
                    dirY: 0,
                    light: 1
                });
            });
        }
    });
}

// --- 6. Kamera açılıyor: kalabalık yürümeye devam ediyor ---
function streetAfter(ctx, A, t) {
    const back = easeOut(span(t, 0, 0.4));
    const cam = camAt(A, MED, WIDE, back);
    scene(ctx, cam, {
        time: 6.3 + t * 1.7,
        marks: [1, 1, 1, 1]
    });
}

export const CHAPTER_2_ART = {
    streetCrowd,
    drainMouth,
    drainCrawl,
    footEntry,
    shoulderChain,
    streetAfter
};
