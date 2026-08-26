// Prologun insanları ve virüslüleri.
//
// ARKADAŞ: bizimkinin iş arkadaşı. Hikâyede asla söylenmez ama virüsü yaratan
// profesör odur. Tek görsel ipucu KOLUNDAKİ TURUNCU BANT'tır - prologda yüzü
// görünmeyen adamın kolunda, arkadaşın kolunda ve dönüştüğü dev yaratığın
// kolunda aynı bant durur. Bu yüzden bant her duruşta görünür olmak zorunda;
// sprite'ı sadeleştirirken ilk feda edilecek şey o değil.
//
// Antrenörle aynı ızgara (12x16, ölçek 4) kullanılıyor ki yan yana
// durduklarında boyları tutsun.

import { PX, newCanvas, blk, dot, hash } from '../pixel/pixelDraw.js';

const COLORS = {
    k: '#1f2937', // kontur
    h: '#2b2119', // saç
    s: '#f6c8a0', // ten
    S: '#e0a97d', // ten gölgesi
    l: '#e6e9ec', // laboratuvar önlüğü
    L: '#bcc2c8', // önlük gölgesi
    o: '#ea7317', // TURUNCU BANT
    O: '#b85610', // bant gölgesi
    b: '#3f4756', // pantolon
    y: '#111827'  // ayakkabı
};

// Yeşillenme: ten ve önlük bu renklere doğru kayar (0 = sağlıklı, 1 = tamamen
// virüslü). Hikâyede belirti yok, önce sadece yeşillenme var.
const SICK = {
    s: '#7d9c31', S: '#5d7720',
    l: '#a7b483', L: '#7f8b5c',
    h: '#31331c'
};

// Aşağı bakan duruş
const DOWN = [
    [
        '....hhhh....',
        '...hhhhhh...',
        '..hhhhhhhh..',
        '..khhhhhhk..',
        '..kssssssk..',
        '..ksSssSsk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..llllllll..',
        '.ooLllllLss.',
        '.ooLllllLss.',
        '.ssllllllss.',
        '...bbbbbb...',
        '...bb..bb...',
        '...bb..bb...',
        '..yyy..yyy..'
    ],
    [
        '....hhhh....',
        '...hhhhhh...',
        '..hhhhhhhh..',
        '..khhhhhhk..',
        '..kssssssk..',
        '..ksSssSsk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..llllllll..',
        '.ooLllllLss.',
        '.ooLllllLss.',
        '.ssllllllss.',
        '...bbbbbb...',
        '..bb....bb..',
        '..bb....bb..',
        '.yyy......yy'
    ]
];

// Sırtı dönük duruş
const UP = [
    [
        '....hhhh....',
        '...hhhhhh...',
        '..hhhhhhhh..',
        '..khhhhhhk..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '...hhhhhh...',
        '..llllllll..',
        '.ooLllllLss.',
        '.ooLllllLss.',
        '.ssllllllss.',
        '...bbbbbb...',
        '...bb..bb...',
        '...bb..bb...',
        '..yyy..yyy..'
    ],
    [
        '....hhhh....',
        '...hhhhhh...',
        '..hhhhhhhh..',
        '..khhhhhhk..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '...hhhhhh...',
        '..llllllll..',
        '.ooLllllLss.',
        '.ooLllllLss.',
        '.ssllllllss.',
        '...bbbbbb...',
        '..bb....bb..',
        '..bb....bb..',
        '.yyy......yy'
    ]
];

// Yandan (sağa bakar; sola bakarken çizim aynalanır)
const SIDE = [
    [
        '...hhhhhh...',
        '..hhhhhhhh..',
        '..hhhhhhhhh.',
        '..khhhhhhh..',
        '..khssssss..',
        '..khsskSss..',
        '..khssssss..',
        '...kSSSSs...',
        '...llllll...',
        '..oollllll..',
        '..oollllll..',
        '..ssllllll..',
        '...bbbbb....',
        '..bb...bb...',
        '.bb.....bb..',
        'yyy.....yyy.'
    ],
    [
        '...hhhhhh...',
        '..hhhhhhhh..',
        '..hhhhhhhhh.',
        '..khhhhhhh..',
        '..khssssss..',
        '..khsskSss..',
        '..khssssss..',
        '...kSSSSs...',
        '...llllll...',
        '..oollllll..',
        '..oollllll..',
        '..ssllllll..',
        '...bbbbb....',
        '...bbbbb....',
        '...bb.bb....',
        '..yyy.yyy...'
    ]
];

// Çöküş: dönüşüm başlarken iki büklüm. Tek kare yeter, oyuncu bu duruşu
// yalnızca birkaç saniye görüyor.
const HUNCH = [
    [
        '............',
        '............',
        '............',
        '..llllllll..',
        '.oollllllss.',
        '.oollllllss.',
        '..hhhhhhhh..',
        '..khhhhhhk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..llllllll..',
        '..LllllllL..',
        '..bbbbbbbb..',
        '..bbbbbbbb..',
        '.yyybbbbyyy.',
        '.yyy....yyy.'
    ]
];

// Kayma duruşu (kanalizasyon): sırtı dönük, yere yatmış. Turuncu bant
// burada da duruyor - ipucu her duruşta görünmek zorunda.
const SLIDE = [
    [
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '....yyyy....',
        '...bbbbbb...',
        '...bbbbbb...',
        '..llllllll..',
        '.ooLllllLss.',
        '.ssllllllss.',
        '..kllllllk..',
        '...hhhhhh...'
    ],
    [
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '...yyy.yy...',
        '...bbbbbb...',
        '...bbbbbb...',
        '..llllllll..',
        '.ooLllllLss.',
        '.ssllllllss.',
        '..kllllllk..',
        '...hhhhhh...'
    ]
];

export const FRIEND_FRAMES = { down: DOWN, up: UP, side: SIDE, hunch: HUNCH, slide: SLIDE };

// İki rengi karıştır (piksel sanatında ara tonlar da ızgaraya oturmalı, bu
// yüzden karışım sonucu doğrudan kullanılıyor, dither yok).
function mix(from, to, t) {
    const parse = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const [r1, g1, b1] = parse(from);
    const [r2, g2, b2] = parse(to);
    const c = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
    return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

// Yeşillenme oranına göre renk haritası. Bant ASLA yeşillenmez: dönüşümün
// sonunda bile turuncu kalır, ipucu ancak böyle işe yarıyor.
const paletteCache = new Map();

function paletteFor(greenness) {
    const key = Math.round(greenness * 20);
    const cached = paletteCache.get(key);
    if (cached) return cached;

    const t = key / 20;
    const palette = { ...COLORS };
    for (const [letter, target] of Object.entries(SICK)) {
        palette[letter] = mix(COLORS[letter], target, t);
    }
    paletteCache.set(key, palette);
    return palette;
}

// Arkadaşı (x, y) merkezli çizer.
// pose: 'down' | 'up' | 'left' | 'right' | 'hunch'
// greenness: 0..1 yeşillenme
export function drawFriend(ctx, x, y, pose, moving, scale = 4, greenness = 0) {
    drawPerson(ctx, x, y, pose, moving, scale, paletteFor(greenness));
}

// --- Diğer sağlıklılar ---
// Bizim hariç beş kişi. Aynı ızgarayı kullanıyorlar ama TURUNCU BANTLARI YOK:
// bant yalnızca arkadaşa ait, ipucu ancak tek kişide durursa çalışıyor.
// ('o' ve 'O' harfleri önlük rengine eşleniyor, yani kol düz kalıyor.)
const SURVIVOR_TINTS = [
    { l: '#e6e9ec', L: '#bcc2c8', h: '#2b2119', b: '#3f4756' },
    { l: '#cfd6dd', L: '#a7aeb6', h: '#4a3826', b: '#39414d' },
    { l: '#dfe3e8', L: '#b3b9c0', h: '#1d1c1a', b: '#46414f' },
    { l: '#d7dde3', L: '#adb4bb', h: '#5b4630', b: '#3c4a44' },
    { l: '#e2e6ea', L: '#b8bec5', h: '#332828', b: '#4a3f3a' }
];

const survivorPalettes = SURVIVOR_TINTS.map(tint => ({
    ...COLORS, ...tint, o: tint.l, O: tint.L
}));

// Sağlıklılar da yeşillenebiliyor: prolog 4'te ormanın ağzında hepsi dönüyor.
// Her kişinin kendi rengi olduğu için palet kişi başına ayrı hesaplanıyor.
const survivorSickCache = new Map();

function survivorPalette(index, greenness) {
    const base = survivorPalettes[index % survivorPalettes.length];
    if (greenness <= 0) return base;

    const step = Math.round(greenness * 20);
    const key = `${index % survivorPalettes.length}:${step}`;
    const cached = survivorSickCache.get(key);
    if (cached) return cached;

    const t = step / 20;
    const palette = { ...base };
    for (const [letter, target] of Object.entries(SICK)) {
        if (!base[letter]) continue;
        palette[letter] = mix(base[letter], target, t);
    }
    // Kolun düz kalması için bant harfleri önlükle birlikte kayıyor
    palette.o = palette.l;
    palette.O = palette.L;
    survivorSickCache.set(key, palette);
    return palette;
}

export function drawSurvivor(ctx, x, y, pose, moving, scale = 4, index = 0, greenness = 0) {
    drawPerson(ctx, x, y, pose, moving, scale, survivorPalette(index, greenness));
}

function drawPerson(ctx, x, y, pose, moving, scale, palette) {
    const key = pose === 'left' || pose === 'right' ? 'side' : pose;
    const frames = FRIEND_FRAMES[key] || FRIEND_FRAMES.down;
    const frame = frames[moving && frames.length > 1 ? Math.floor(Date.now() / 160) % frames.length : 0];

    const cols = frame[0].length;
    const rows = frame.length;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (pose === 'left') ctx.scale(-1, 1);

    const ox = -cols * scale / 2;
    const oy = -rows * scale / 2;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const color = palette[frame[r][c]];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
        }
    }
    ctx.restore();
}

// --- Dev yeşil yaratık ---
// Virüs konağı tamamen tüketince ortaya çıkan hal. Karakter haritası yerine
// blokla çiziliyor: simetriyi ve kütleyi elle harf dizerek tutturmak zor.
// Kolunda hâlâ ARKADAŞIN TURUNCU BANDI var - sahnenin bütün ağırlığı orada.

const CREATURE = {
    body: '#4a7c1f',
    dark: '#2f5312',
    light: '#6ea32c',
    vein: '#8fc23a',
    skin: '#3c6618',
    eye: '#d9f65a',
    outline: '#16260a',
    band: '#ea7317',
    bandDark: '#b85610'
};

let creatureCache = null;

// Siluet goril mantığıyla kuruluyor: KÜÇÜK bir baş, ondan çok daha geniş ve
// eğimli omuzlar, gövdenin dışında sarkan KALIN kollar, kısa bacaklar.
// Denenip bırakılanlar: başı omuzların arasına gömmek (gövdeye oyulmuş bir
// ekran gibi duruyor) ve kolları ince çizmek (cılız değnek gibi duruyor).

const HEAD_ROWS = [2, 8];      // baş: satır 2-8, yarı genişlik 4
const SHOULDER_ROW = 8;
const HIP_ROW = 28;

// Gövdenin bir satırdaki yarı genişliği (blok)
function bodyHalfBlocks(row) {
    if (row < SHOULDER_ROW) return 0;
    if (row < 13) return 6 + (row - SHOULDER_ROW) * 1.2;   // omuzlar açılıyor
    if (row < 18) return 11;                                // en geniş yer
    if (row < HIP_ROW) return 11 - (row - 18) * 0.3;
    return 8;
}

// Kolun bir satırdaki genişliği (blok): omuzda kalın, ön kolda biraz ince
function armWidthBlocks(row, top, bottom) {
    const t = (row - top) / (bottom - top);
    if (t < 0.35) return 6;
    if (t < 0.7) return 5;
    return 4;
}

// Dönen sprite: {canvas, ox, oy} - ox/oy ayak hizasına göre çizim kaydırması
export function creatureSprite() {
    if (creatureCache) return creatureCache;

    const cols = 28;
    const rows = 34;
    const w = PX * cols;   // 112 piksel: antrenörün (48) iki katından fazla
    const h = PX * rows;   // 136 piksel
    const { canvas, ctx } = newCanvas(w, h);
    const cx = Math.round(cols / 2) * PX;
    const C = CREATURE;
    const R = (row) => row * PX;

    // Bir satır et: gövde rengi + iki yanda kontur + sol ışık, sağ gölge
    const flesh = (x0, x1, y) => {
        if (x1 - x0 < PX * 2) return;
        blk(ctx, x0, y, x1 - x0, PX, C.body);
        blk(ctx, x0, y, PX, PX, C.outline);
        blk(ctx, x1 - PX, y, PX, PX, C.outline);
        blk(ctx, x0 + PX, y, PX * 2, PX, C.light);
        blk(ctx, x1 - PX * 3, y, PX * 2, PX, C.dark);
    };

    // 1) Baş: küçük, omuzların ÜSTÜNDE. Yüz yok, iki ayrı parlak göz var.
    for (let row = HEAD_ROWS[0]; row < HEAD_ROWS[1]; row++) {
        const half = (row === HEAD_ROWS[0] ? 3 : 4) * PX;
        flesh(cx - half, cx + half, R(row));
    }
    blk(ctx, cx - PX * 3, R(HEAD_ROWS[0] - 1), PX * 6, PX, C.outline);
    // Gözler: aralarında iki bloklu boşluk kalmalı, bitişik olunca tek bir
    // parlak şerit gibi görünüyorlar.
    blk(ctx, cx - PX * 3, R(4), PX * 2, PX * 2, C.eye);
    blk(ctx, cx + PX, R(4), PX * 2, PX * 2, C.eye);
    dot(ctx, cx - PX * 3, R(4), '#ffffff');
    dot(ctx, cx + PX, R(4), '#ffffff');
    // Çene: ağız değil, etin ayrıldığı koyu yarık
    blk(ctx, cx - PX * 3, R(7), PX * 6, PX, C.outline);

    // 2) Gövde: omuzlardan kalçaya inen kütle, kenarlarda düzensiz çıkıntılar
    for (let row = SHOULDER_ROW; row <= HIP_ROW; row++) {
        const half = Math.round(bodyHalfBlocks(row)) * PX;
        const bumpL = hash(row, 0, 411) < 0.30 ? PX : 0;
        const bumpR = hash(row, 1, 413) < 0.30 ? PX : 0;
        flesh(cx - half - bumpL, cx + half + bumpR, R(row));
    }
    // Sol omuzda fazladan bir ur: simetri kırılsın
    blk(ctx, cx - PX * 13, R(11), PX * 3, PX * 5, C.body);
    blk(ctx, cx - PX * 14, R(11), PX, PX * 5, C.outline);
    blk(ctx, cx - PX * 13, R(11), PX * 2, PX, C.light);

    // 3) Kollar: gövdenin dışında, omuzda kalın, dizlerin altına iner
    const drawArm = (side, top, bottom, banded) => {
        for (let row = top; row < bottom; row++) {
            const width = armWidthBlocks(row, top, bottom) * PX;
            const bodyEdge = Math.round(bodyHalfBlocks(row)) * PX;
            const x0 = side < 0 ? cx - bodyEdge - width : cx + bodyEdge;
            flesh(x0, x0 + width, R(row));
        }
        // Pençe: uçta koyu tırnaklar
        const endWidth = armWidthBlocks(bottom - 1, top, bottom) * PX;
        const endEdge = Math.round(bodyHalfBlocks(bottom - 1)) * PX;
        const ex = side < 0 ? cx - endEdge - endWidth : cx + endEdge;
        blk(ctx, ex, R(bottom), endWidth, PX, C.outline);
        blk(ctx, ex + PX, R(bottom) + PX, PX, PX, C.outline);
        blk(ctx, ex + endWidth - PX * 2, R(bottom) + PX, PX, PX, C.outline);
        return { x: ex, width: endWidth };
    };
    const leftArm = drawArm(-1, 10, 31, true);    // bantlı kol daha uzun
    drawArm(1, 11, 29, false);

    // 4) Bacaklar: kısa, kalın, ayrık
    const legTop = R(HIP_ROW);
    for (const dx of [-PX * 8, PX * 3]) {
        blk(ctx, cx + dx, legTop, PX * 5, R(rows) - legTop, C.body);
        blk(ctx, cx + dx, legTop, PX, R(rows) - legTop, C.outline);
        blk(ctx, cx + dx + PX * 4, legTop, PX, R(rows) - legTop, C.outline);
        blk(ctx, cx + dx + PX, legTop, PX, R(rows) - legTop, C.light);
        blk(ctx, cx + dx, R(rows) - PX, PX * 5, PX, C.outline);
    }

    // 5) Deri dokusu: yalnızca ÇİZİLMİŞ pikseller üzerine. source-atop
    //    olmadan boşluğa da nokta atıyor ve siluetin dışında leke kalıyor.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let y = 0; y < h; y += PX) {
        for (let x = 0; x < w; x += PX) {
            const r = hash(x, y, 401);
            if (r < 0.05) dot(ctx, x, y, C.vein);
            else if (r < 0.10) dot(ctx, x, y, C.skin);
        }
    }
    ctx.restore();

    // 6) TURUNCU BANT: sol ön kolda. En son çizilir, doku onu yemesin.
    const bandY = R(26);
    blk(ctx, leftArm.x, bandY, leftArm.width, PX * 2, C.band);
    blk(ctx, leftArm.x, bandY + PX * 2, leftArm.width, PX, C.bandDark);
    blk(ctx, leftArm.x, bandY, PX, PX * 3, C.bandDark);
    dot(ctx, leftArm.x + PX, bandY, '#ffb066');

    creatureCache = { canvas, ox: cx, oy: h };
    return creatureCache;
}

// Yaratığı ayakları (x, y) noktasına gelecek şekilde çizer
export function drawCreature(ctx, x, y) {
    const sprite = creatureSprite();
    ctx.drawImage(sprite.canvas, Math.round(x - sprite.ox), Math.round(y - sprite.oy));
}
