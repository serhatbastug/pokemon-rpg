// GÖLGE-VİRÜS'ün çizimi: beşinci dövüşçü.
//
// Elektro, buz gibi taşıyıcısını TAMAMEN kaplamış ama biçim dili ötekilerden
// ayrı: virüs SARKAR, elektro ÇATIRDAR, buz UZAR, gölge SÖNER. Kütle katı
// değil duman: üstte kapüşonlu bir baş, içinde yüz yok, yalnızca iki parlak
// göz; omuzdan inen iki uzun kol, ucunda soluk pençeler; beli aşağısı ayak
// yerine yırtık yırtık dumana dağılıyor ve yerin hemen üstünde süzülüyor.
//
// Palet bilerek MOR + SİYAH: yeşil (virüs), mercan (anti), sarı-lacivert
// (elektro) ve buz mavisinden ayrı. Göğsünde tek bir parlak çekirdek var -
// gölgenin içinde yanan tek şey.
//
// Elektro ve buzla AYNI ızgarada (40x52): giriş animasyonu adamı bu ızgarada
// çiziyor, dönüşüm cephesi hepsinde aynı kutuyu kesiyor.

import { PX, newCanvas, blk, hash } from '../pixel/pixelDraw.js';

export const SH_COLS = 40;
export const SH_ROWS = 52;
export const SH_CX = 20;

export const SHADOW_P = {
    void: '#04010b',      // yüzün içi
    deep: '#0b0618',      // kontur
    dark: '#1d1036',
    mid: '#32195a',
    body: '#4a2a82',
    light: '#7a4fc0',
    pale: '#b996f0',
    eye: '#f6efff',
    glow: '#c77dff'
};

const TOP = 4;
const BOTTOM = 47;
const HEAD_END = 14;          // kapüşonun son satırı
// Gövdenin yarı genişliği, satır satır (TOP..BOTTOM). ELLE yazılı: kapüşon
// yumuşak bir kubbe, omuzlarda geniş, belden aşağı dar.
const HALF = [
    3, 5, 6, 7, 7, 8, 8, 8, 8, 7, 6,        // kapüşon (satır 4-14)
    5, 5, 6,                                // boyun (15-17)
    9, 11, 12, 12, 12, 12, 11, 11, 11,      // omuz ve pelerin (18-26)
    10, 10, 10, 10, 10, 10, 9, 9, 9,        // gövde (27-35)
    8, 8, 8, 8, 7, 7, 6, 6, 5, 4, 3, 2      // etek: dumana dağılıyor (36-47)
];

const half = (row) => (row < TOP || row > BOTTOM ? 0 : HALF[row - TOP] ?? 2);

// Bir sütun satırda çizili mi? Etekte (satır 40+) kenarlar yırtık: gevşeyen
// duman parçaları, her satırda bir önceki satırdan biraz daha az dolu.
function filled(row, c) {
    const h = half(row);
    if (Math.abs(c + 0.5) > h) return false;
    if (row >= 40) {
        const drop = (row - 39) * 0.085;
        if (hash(c, row, 7) < drop + (Math.abs(c) > h - 2 ? 0.25 : 0)) return false;
    }
    return true;
}

// ox, oy: sprite kutusunun sol üst köşesi. headTilt: giriş animasyonunda baş
// yatıyor (kesme: tepe satırlar dipten çok kayıyor).
export function paintShadow(ctx, ox, oy, { headTilt = 0 } = {}) {
    const P = SHADOW_P;
    const X = (col) => ox + col * PX;
    const Y = (row) => oy + row * PX;
    const tiltAt = (row) => {
        const k = Math.max(0, Math.min(1, (row - TOP + 8) / 18));
        return -Math.round(headTilt * 2 * (1 - k)) * PX;
    };
    const cell = (row, c, color) => blk(ctx, X(SH_CX + c) + tiltAt(row), Y(row), PX, PX, color);

    for (let row = TOP; row <= BOTTOM; row++) {
        const h = half(row);
        for (let c = -h; c < h; c++) {
            if (!filled(row, c)) continue;
            const edge = !filled(row, c - 1) || !filled(row, c + 1) || !filled(row - 1, c) || !filled(row + 1, c);
            // Işık sol üstten: sol kenar ve kapüşon kenarı açık, sağ alt koyu
            const lit = c < -h * 0.35 && row < 32;
            let color = lit ? P.body : P.mid;
            if (row > 34) color = hash(c, row, 11) < 0.5 ? P.mid : P.dark;
            if (hash(c, row, 3) < 0.13) color = lit ? P.light : P.dark;
            if (edge) color = row > 38 && hash(c, row, 5) < 0.5 ? P.dark : P.deep;
            cell(row, c, color);
        }
    }

    // Kapüşonun sol kenarında ince açık hat: kubbe okunsun
    for (let row = TOP + 1; row <= 9; row++) {
        const h = half(row);
        if (filled(row, -h)) cell(row, -h + 1, P.light);
    }

    // Yüz: kapüşonun içi bomboş; iki parlak göz ve üstlerinde sönük bir parıltı
    for (let row = 9; row <= 13; row++) {
        for (let c = -5; c < 5; c++) {
            const inner = Math.abs(c + 0.5) <= half(row) - 2 && row >= 9 && row <= 13;
            if (inner && !(row === 13 && Math.abs(c + 0.5) > 3)) cell(row, c, P.void);
        }
    }
    for (const c of [-4, -3, 2, 3]) {
        cell(11, c, P.eye);
        cell(12, c, Math.abs(c + 0.5) < 3.5 ? P.glow : P.eye);
        cell(10, c, P.glow);
    }

    // Kollar: omuzdan inen iki uzun kol. Gövdeden bir sütun boşlukla ayrılıyor
    // (derin hat), uçları pençeye dönüyor.
    for (const s of [-1, 1]) {
        const edgeC = (row) => (s < 0 ? -half(row) : half(row) - 1);
        for (let row = 20; row <= 36; row++) {
            const inner = edgeC(row) - s * 3;
            cell(row, inner, P.deep);
            cell(row, inner + s, P.dark);
        }
        // Pençeler: üç ince parmak, açık renkte
        const hx = edgeC(36) - s * 1;
        for (let f = 0; f < 3; f++) {
            const len = 3 + (f === 1 ? 1 : 0);
            for (let k = 0; k < len; k++) cell(37 + k, hx - s * f * 1 + (k > 1 ? s * f : 0), k === len - 1 ? P.pale : P.light);
        }
    }

    // Göğüs çekirdeği: gölgenin içinde yanan tek şey
    for (const [dr, dc, col] of [[0, 0, P.eye], [0, -1, P.glow], [-1, -1, P.glow], [-1, 0, P.glow], [1, -1, P.light], [1, 0, P.light], [0, 1, P.light], [0, -2, P.light], [-2, 0, P.light], [2, -1, P.mid]]) {
        cell(25 + dr, dc, col);
    }
}

const caches = new Map();

export function shadowSprite() {
    const cached = caches.get('main');
    if (cached) return cached;
    const w = PX * SH_COLS;
    const h = PX * SH_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    paintShadow(ctx, 0, 0);
    const sprite = { canvas, ox: PX * SH_CX, oy: h, w, h };
    caches.set('main', sprite);
    return sprite;
}

// Giriş animasyonunun kullandığı çizim (ölçekleme sahnede yapılıyor)
export function paintIntroShadow(ctx, x, footY, opts) {
    return paintShadow(ctx, x - PX * SH_CX, footY - PX * SH_ROWS, opts);
}

// Gövdeden yükselen koyu duman parçaları: kütle yerinde durmuyor, sürekli
// dağılıyor. Elektronun kıvılcımı gibi her karede çiziliyor (sprite'a
// işlenmiyor, çünkü hareket ediyorlar).
export function drawShadowWisps(ctx, x, footY, frame, intensity = 1, unit = PX) {
    const count = Math.round(14 * intensity);
    ctx.save();
    for (let i = 0; i < count; i++) {
        const life = 70;
        const t = ((frame * 0.9 + i * (life / count) * 3.1) % life) / life;
        const baseX = (hash(i, 1, 31) - 0.5) * 18;
        const sway = Math.sin(frame * 0.05 + i * 1.7) * 3;
        const px = Math.round((x + (baseX + sway) * unit / PX * 0.6) / unit) * unit;
        const py = Math.round((footY - unit * (6 + t * 44)) / unit) * unit;
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = hash(i, 2, 33) < 0.35 ? SHADOW_P.light : SHADOW_P.mid;
        ctx.fillRect(px, py, unit, unit);
        if (hash(i, 3, 35) < 0.3) ctx.fillRect(px + unit, py + unit, unit, unit);
    }
    ctx.restore();
}
