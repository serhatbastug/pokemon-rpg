// Ana menü sahnesinin piksel çizimleri. Her şey PX'lik bloklarla, antrenör
// sprite'ıyla aynı ızgarada çizilir; yumuşak kenar üreten hiçbir şey yok.
//
// Ağaç, ev, geçit ve kapı birer offscreen canvas'a BİR KEZ çizilir; sahne
// her karede yalnızca hazır sprite'ları derinlik sırasına göre kopyalar.

import { PX, SCENE, PATHS, HOUSE, GATE, DOOR, TREE_SIZES } from './menuLayout.js';
import { drawPixelText } from './pixelFont.js';

// --- Küçük yardımcılar ---

function newCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
}

// Piksel ızgarasına oturtulmuş dikdörtgen
function blk(ctx, x, y, w, h, color) {
    const x0 = Math.round(x / PX) * PX;
    const y0 = Math.round(y / PX) * PX;
    const x1 = Math.round((x + w) / PX) * PX;
    const y1 = Math.round((y + h) / PX) * PX;
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// Tek piksel blok
function dot(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX, PX);
}

// Konuma göre sahte-rastgele (0..1). Aynı konum her zaman aynı değeri verir,
// böylece sahne her açılışta birebir aynı çıkar.
function hash(x, y, salt = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

// --- Zemin ---

const GRASS = ['#14532d', '#166534', '#15803d', '#177a39', '#1a8a42'];
const GRASS_DARK = ['#0f3d22', '#123f26', '#14532d'];
const DIRT = ['#7a4d22', '#8a5a2b', '#6b4119', '#96652f'];
const DIRT_EDGE = '#5a3617';

// Çim + patika: sahnenin en altındaki katman, bir kez pişirilir.
export function bakeGround() {
    const { canvas, ctx } = newCanvas(SCENE.w, SCENE.h);

    // Taban çim: blok blok ton seçimi. Alçak frekanslı ikinci bir gürültü
    // geniş koyu/açık kuşaklar üretir, zemin tek düze görünmesin.
    for (let y = 0; y < SCENE.h; y += PX) {
        for (let x = 0; x < SCENE.w; x += PX) {
            const patch = hash(Math.floor(x / 40), Math.floor(y / 40), 3);
            const palette = patch < 0.28 ? GRASS_DARK : GRASS;
            const idx = Math.floor(hash(x, y, 1) * palette.length);
            ctx.fillStyle = palette[idx];
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Çim tutamları: iki piksellik dikey yapraklar, seyrek serpiştirilir
    for (let y = PX; y < SCENE.h; y += PX * 2) {
        for (let x = 0; x < SCENE.w; x += PX * 2) {
            if (hash(x, y, 7) > 0.055) continue;
            const light = hash(x, y, 8) > 0.5 ? '#22c55e' : '#16a34a';
            dot(ctx, x, y, light);
            dot(ctx, x, y - PX, light);
            dot(ctx, x + PX, y, '#15803d');
        }
    }

    // Patikalar: kenarları düzensiz, ortası aşınmış toprak
    for (const path of PATHS) {
        const horizontal = path.w > path.h;
        for (let y = path.y - 12; y < path.y + path.h + 12; y += PX) {
            for (let x = path.x - 12; x < path.x + path.w + 12; x += PX) {
                if (x < 0 || y < 0 || x >= SCENE.w || y >= SCENE.h) continue;
                // Kenar dalgalanması: patikanın sınırı her blokta biraz kayar
                const wobble = (hash(Math.floor(x / 12), Math.floor(y / 12), 11) - 0.5) * 18;
                const inside = horizontal
                    ? y > path.y + wobble && y < path.y + path.h + wobble
                    : x > path.x + wobble && x < path.x + path.w + wobble;
                if (!inside) continue;

                const edge = horizontal
                    ? Math.min(y - path.y, path.y + path.h - y) < 10
                    : Math.min(x - path.x, path.x + path.w - x) < 10;
                if (edge && hash(x, y, 13) < 0.35) continue; // kenarda toprak seyrelir

                ctx.fillStyle = edge ? DIRT_EDGE : DIRT[Math.floor(hash(x, y, 5) * DIRT.length)];
                ctx.fillRect(x, y, PX, PX);
            }
        }
    }

    // Patikadaki çakıllar
    for (const path of PATHS) {
        for (let i = 0; i < 80; i++) {
            const x = path.x + hash(i, path.x, 17) * path.w;
            const y = path.y + hash(i, path.y, 19) * path.h;
            const tone = hash(i, 0, 23) > 0.5 ? '#a8a29e' : '#57534e';
            dot(ctx, x, y, tone);
            if (hash(i, 1, 29) > 0.7) dot(ctx, x + PX, y, tone);
        }
    }

    return canvas;
}

// --- Ağaçlar ---

// Dört yaprak paleti: orman tek tip yeşil olmasın
const LEAF_SETS = [
    ['#0a3d1d', '#14532d', '#1c7a3c', '#2a9e52', '#3fbf6a'],
    ['#08321a', '#11492a', '#186b38', '#22995a', '#31b06b'],
    ['#12401a', '#1c5a24', '#2a7a31', '#3d9c45', '#54b85c'],
    ['#0a3524', '#104733', '#166b45', '#1f9159', '#2fae6d']
];

const BARK = ['#3b2410', '#4d3016', '#2b190a', '#5c3a1c'];

// Bir ağacın taç kümeleri: boy ve varyanta göre elips demeti
function canopyClumps(size, variant) {
    const { canopyW, canopyH } = TREE_SIZES[size];
    const cx = canopyW / 2;
    const layouts = [
        [[0, 0.30, 0.62, 0.54], [-0.30, 0.52, 0.48, 0.42], [0.30, 0.50, 0.46, 0.42], [-0.10, 0.72, 0.44, 0.34], [0.16, 0.74, 0.40, 0.32]],
        [[0.04, 0.26, 0.58, 0.50], [-0.34, 0.46, 0.44, 0.44], [0.32, 0.56, 0.50, 0.40], [0, 0.70, 0.52, 0.34]],
        [[-0.06, 0.32, 0.60, 0.52], [0.30, 0.40, 0.42, 0.40], [-0.28, 0.60, 0.46, 0.38], [0.12, 0.74, 0.48, 0.30], [-0.02, 0.16, 0.36, 0.28]],
        [[0, 0.34, 0.66, 0.56], [-0.26, 0.62, 0.44, 0.36], [0.28, 0.62, 0.44, 0.36], [0.02, 0.80, 0.46, 0.28]]
    ];
    return layouts[variant % layouts.length].map(([ox, oy, rx, ry]) => ({
        x: cx + ox * canopyW,
        y: oy * canopyH,
        rx: rx * canopyW / 2,
        ry: ry * canopyH / 2
    }));
}

const treeCache = new Map();

// Ağacı sprite'a çizer. Dönen ox/oy, gövde dibinin sprite içindeki konumudur.
export function treeSpriteFor(tree) {
    const key = tree.size + '|' + tree.variant;
    const cachedSprite = treeCache.get(key);
    if (cachedSprite) return cachedSprite;

    const size = TREE_SIZES[tree.size];
    const pad = 12;
    const w = size.canopyW + pad * 2;
    const h = size.canopyH + size.trunkH + pad * 2;
    const { canvas, ctx } = newCanvas(w, h);

    const baseX = w / 2;                 // gövde dibinin yatay merkezi
    const baseY = h - pad;               // gövde dibi
    const trunkTop = baseY - size.trunkH;
    const leaves = LEAF_SETS[tree.variant % LEAF_SETS.length];
    const clumps = canopyClumps(tree.size, tree.variant);
    const canopyLeft = baseX - size.canopyW / 2;
    const canopyTop = trunkTop - size.canopyH + size.trunkH * 0.35;

    // 1) Gövde dibindeki gölge
    ctx.globalAlpha = 0.30;
    for (let y = baseY - 6; y < baseY + 10; y += PX) {
        for (let x = baseX - size.trunkW * 1.6; x < baseX + size.trunkW * 1.6; x += PX) {
            const dx = (x - baseX) / (size.trunkW * 1.6);
            const dy = (y - (baseY + 2)) / 8;
            if (dx * dx + dy * dy > 1) continue;
            ctx.fillStyle = '#052e16';
            ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX, PX);
        }
    }
    ctx.globalAlpha = 1;

    // 2) Gövde: dipte genişleyen kök payandaları, dikey kabuk damarları
    for (let y = baseY; y > trunkTop; y -= PX) {
        const t = (baseY - y) / size.trunkH;                  // 0 dip, 1 tepe
        const halfW = (size.trunkW / 2) * (1 + (1 - t) * 0.55);
        for (let x = baseX - halfW; x < baseX + halfW; x += PX) {
            const rel = (x - (baseX - halfW)) / (halfW * 2);  // 0 sol, 1 sağ
            // Işık sol üstten: solda açık, sağda gölge
            let tone = rel < 0.22 ? BARK[3] : rel > 0.72 ? BARK[2] : BARK[1];
            if (hash(x, y, 37) < 0.22) tone = BARK[0];
            if (Math.round(x / PX) % 3 === 0 && hash(x, y, 41) < 0.5) tone = BARK[2];
            ctx.fillStyle = tone;
            ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX, PX);
        }
    }
    // Kök çıkıntıları
    for (const dir of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            blk(ctx, baseX + dir * (size.trunkW / 2 + i * PX), baseY - PX * (1 + i), PX * 2, PX * (2 + i), BARK[2]);
        }
    }

    // 3) Taç: kümelerin birleşimi, tırtıklı silüet ve yönlü gölgeleme
    const nearestClump = (x, y) => {
        let best = null;
        let bestInf = -Infinity;
        for (const c of clumps) {
            const dx = (x - (canopyLeft + c.x)) / c.rx;
            const dy = (y - (canopyTop + c.y)) / c.ry;
            const d = Math.sqrt(dx * dx + dy * dy);
            const inf = 1 - d;
            if (inf > bestInf) {
                bestInf = inf;
                best = { dx, dy, d, inf };
            }
        }
        return best;
    };
    const leafAt = new Set();

    for (let y = canopyTop - 8; y < canopyTop + size.canopyH + 8; y += PX) {
        for (let x = canopyLeft - 8; x < canopyLeft + size.canopyW + 8; x += PX) {
            const hit = nearestClump(x, y);
            if (!hit) continue;
            // Kenarda sahte-rastgele tırtık: yaprak kümeleri düz elips olmasın
            if (hit.inf + (hash(x, y, 43) - 0.5) * 0.22 <= 0) continue;
            // Taç içinde seyrek boşluklar: ışık sızsın, blok gibi durmasın
            if (hit.d < 0.62 && hash(x, y, 47) < 0.025) continue;

            // Işık sol üstten geliyor: küme merkezine göre yön çarpanı.
            // Tonlar arası geçiş bilerek keskin: yumuşak geçiş, yan yana duran
            // ağaçları tek bir yeşil kütleye çeviriyor.
            const light = -(hit.dx * 0.55 + hit.dy * 0.82);
            let idx;
            if (hit.d > 0.80) idx = light > 0.45 ? 2 : 0;     // silüet kenarı koyulaşır
            else if (light > 0.55) idx = 4;
            else if (light > 0.12) idx = 3;
            else if (light > -0.34) idx = 2;
            else idx = 1;
            // Alt-sağ etek en koyu tonda kalır: komşu ağaçtan böyle ayrışır
            if (light < -0.55) idx = 0;
            if (hash(x, y, 53) < 0.08) idx = Math.max(0, Math.min(4, idx + (hash(x, y, 59) < 0.5 ? -1 : 1)));

            const bx = Math.round(x / PX) * PX;
            const by = Math.round(y / PX) * PX;
            leafAt.add(bx + '|' + by);
            ctx.fillStyle = leaves[idx];
            ctx.fillRect(bx, by, PX, PX);
        }
    }

    // 4) Silüet konturu: tacın dış sınırı en koyu tona döner. Bu olmadan yan
    // yana duran ağaçların taçları tek bir yeşil kütle gibi görünüyor.
    for (const cell of leafAt) {
        const parts = cell.split('|');
        const xs = Number(parts[0]);
        const ys = Number(parts[1]);
        const open = !leafAt.has(xs + '|' + (ys + PX))
            || !leafAt.has((xs + PX) + '|' + ys)
            || !leafAt.has((xs - PX) + '|' + ys)
            || !leafAt.has(xs + '|' + (ys - PX));
        if (!open) continue;
        ctx.fillStyle = leaves[0];
        ctx.fillRect(xs, ys, PX, PX);
    }

    // 5) Üst-sol kenar ışığı: yaprak kütlesinin tepesine ince parlak çizgi
    for (const cell of leafAt) {
        const parts = cell.split('|');
        const xs = Number(parts[0]);
        const ys = Number(parts[1]);
        if (leafAt.has(xs + '|' + (ys - PX)) && leafAt.has((xs - PX) + '|' + ys)) continue;
        if (hash(xs, ys, 61) < 0.15) continue;
        const hit = nearestClump(xs, ys);
        if (!hit || -(hit.dx * 0.55 + hit.dy * 0.82) < 0.25) continue;
        ctx.fillStyle = leaves[4];
        ctx.fillRect(xs, ys, PX, PX);
    }

    const sprite = { canvas, ox: baseX, oy: baseY };
    treeCache.set(key, sprite);
    return sprite;
}

// --- Ev ---

const STONE = ['#6b7280', '#4b5563', '#9ca3af', '#374151'];
const WOOD = ['#8b5a30', '#a97142', '#7a4c28', '#c08552'];
const ROOF = ['#8f3a2c', '#a44a38', '#6d2b22', '#c05e46'];

export function bakeHouse() {
    const pad = 16;
    const { canvas, ctx } = newCanvas(HOUSE.w + pad * 2, HOUSE.h + pad * 2 + 16);
    const ox = pad;
    const oy = pad;
    const W = HOUSE.w;
    const H = HOUSE.h;

    // Yere düşen gölge
    ctx.globalAlpha = 0.28;
    blk(ctx, ox + 8, oy + H - 4, W - 16, 14, '#052e16');
    ctx.globalAlpha = 1;

    // Taş temel
    for (let y = oy + H - 26; y < oy + H; y += PX) {
        for (let x = ox + 6; x < ox + W - 6; x += PX) {
            const row = Math.floor((y - oy) / (PX * 2));
            const brick = Math.floor((x - ox + (row % 2) * PX * 3) / (PX * 6));
            let tone = STONE[Math.floor(hash(brick, row, 67) * 3)];
            // Derz çizgileri
            if ((y - oy) % (PX * 2) === 0 || (x - ox + (row % 2) * PX * 3) % (PX * 6) === 0) tone = STONE[3];
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Ahşap duvar: dikey kalaslar
    const wallTop = oy + 64;
    const wallBottom = oy + H - 26;
    for (let y = wallTop; y < wallBottom; y += PX) {
        for (let x = ox + 14; x < ox + W - 14; x += PX) {
            const plank = Math.floor((x - ox) / (PX * 5));
            let tone = WOOD[plank % 2 === 0 ? 0 : 1];
            if (hash(x, y, 71) < 0.16) tone = WOOD[2];
            if ((x - ox) % (PX * 5) === 0) tone = '#5f3a1c';         // kalas aralığı
            if (y < wallTop + PX * 2) tone = '#4a2c12';              // saçak gölgesi
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }
    // Budaklar
    for (let i = 0; i < 7; i++) {
        const x = ox + 24 + hash(i, 3, 73) * (W - 60);
        const y = wallTop + 12 + hash(i, 5, 79) * (wallBottom - wallTop - 24);
        dot(ctx, x, y, '#5f3a1c');
        dot(ctx, x + PX, y, '#4a2c12');
    }

    // Baca (çatının arkasından çıkar)
    const chX = ox + W - 74;
    for (let y = oy + 4; y < oy + 64; y += PX) {
        for (let x = chX; x < chX + 28; x += PX) {
            const row = Math.floor((y - oy) / (PX * 2));
            const isMortar = (y - oy) % (PX * 2) === 0 || (x - chX + (row % 2) * PX * 2) % (PX * 4) === 0;
            ctx.fillStyle = isMortar ? '#5b2318' : (x < chX + 10 ? '#9c4a38' : '#7d3728');
            ctx.fillRect(x, y, PX, PX);
        }
    }
    blk(ctx, chX - PX, oy, 28 + PX * 2, PX * 2, '#4b5563'); // baca kapağı

    // Çatı: iki eğimli yüzey, sıra sıra kiremit
    const ridgeY = oy + 8;
    const eaveY = oy + 66;
    const ridgeHalf = 26;
    const eaveHalf = W / 2 + 10;
    for (let y = ridgeY; y < eaveY; y += PX) {
        const t = (y - ridgeY) / (eaveY - ridgeY);
        const half = ridgeHalf + (eaveHalf - ridgeHalf) * t;
        const cx = ox + W / 2;
        for (let x = cx - half; x < cx + half; x += PX) {
            const row = Math.floor((y - ridgeY) / (PX * 3));
            const shingle = Math.floor((x - cx + (row % 2) * PX * 3) / (PX * 6));
            let tone = ROOF[Math.floor(hash(shingle, row, 83) * 3)];
            // Sol yüz ışık alır, sağ yüz gölgede
            if (x < cx - half * 0.25) tone = hash(shingle, row, 89) > 0.6 ? ROOF[3] : ROOF[1];
            else if (x > cx + half * 0.35) tone = ROOF[2];
            if ((y - ridgeY) % (PX * 3) === 0) tone = '#5b201a';   // kiremit sırası çizgisi
            ctx.fillStyle = tone;
            ctx.fillRect(Math.round(x / PX) * PX, y, PX, PX);
        }
    }
    // Mahya ve saçak
    blk(ctx, ox + W / 2 - ridgeHalf - PX, ridgeY - PX, ridgeHalf * 2 + PX * 2, PX * 2, '#5b201a');
    blk(ctx, ox + W / 2 - eaveHalf, eaveY - PX, eaveHalf * 2, PX * 2, '#4a1a14');

    // Kapı: koyu ahşap kalaslar, demir bantlar, tokmak
    const dW = 46;
    const dH = 60;
    const dX = ox + W / 2 - dW / 2;
    const dY = oy + H - 26 - dH;
    blk(ctx, dX - PX, dY - PX, dW + PX * 2, dH + PX, '#3f2a12');   // söve
    for (let y = dY; y < dY + dH; y += PX) {
        for (let x = dX; x < dX + dW; x += PX) {
            const plank = Math.floor((x - dX) / (PX * 4));
            ctx.fillStyle = (x - dX) % (PX * 4) === 0 ? '#2a1808' : (plank % 2 ? '#5c3a18' : '#6b4520');
            ctx.fillRect(x, y, PX, PX);
        }
    }
    blk(ctx, dX, dY + PX * 2, dW, PX, '#2a1808');
    blk(ctx, dX, dY + dH - PX * 3, dW, PX, '#2a1808');
    dot(ctx, dX + dW - PX * 3, dY + dH / 2, '#fbbf24');
    // Kapı önü taş basamak
    blk(ctx, dX - PX * 2, oy + H - 26, dW + PX * 4, PX * 3, '#9ca3af');
    blk(ctx, dX - PX * 2, oy + H - 26 + PX * 3, dW + PX * 4, PX, '#4b5563');

    // Pencereler: sıcak ışık, haç bölme, denizlik
    for (const wx of [ox + 34, ox + W - 34 - 44]) {
        const wy = wallTop + 20;
        const wW = 44;
        const wH = 36;
        blk(ctx, wx - PX, wy - PX, wW + PX * 2, wH + PX * 2, '#4a2c12');
        for (let y = wy; y < wy + wH; y += PX) {
            for (let x = wx; x < wx + wW; x += PX) {
                const warm = hash(x, y, 97) < 0.25 ? '#fde68a' : '#fcd34d';
                ctx.fillStyle = (y < wy + PX * 2) ? '#b8860b' : warm;
                ctx.fillRect(x, y, PX, PX);
            }
        }
        blk(ctx, wx + wW / 2 - PX / 2, wy, PX, wH, '#4a2c12');
        blk(ctx, wx, wy + wH / 2 - PX / 2, wW, PX, '#4a2c12');
        blk(ctx, wx - PX * 2, wy + wH, wW + PX * 4, PX * 2, '#7a4c28');
    }

    // Kapının yanında fener
    blk(ctx, dX - PX * 5, dY + PX * 3, PX * 3, PX * 4, '#4b5563');
    dot(ctx, dX - PX * 4, dY + PX * 4, '#fde68a');

    // x, y: sprite'in dunyadaki cizim konumu; baseY: derinlik siralamasi icin dip
    return { canvas, x: HOUSE.x - pad, y: HOUSE.y - pad, baseY: HOUSE.y + HOUSE.h };
}

// --- Geçit (iki kişilik oyna) + tabela ---

export function bakeGate() {
    const pad = 24;
    const left = GATE.sign.x - pad;
    const top = GATE.sign.y - pad;
    const w = GATE.sign.w + pad * 2;
    const h = (GATE.frame.y + GATE.frame.h) - GATE.sign.y + pad * 2;
    const { canvas, ctx } = newCanvas(w, h);
    const toX = (x) => x - left;
    const toY = (y) => y - top;

    const f = GATE.frame;
    const o = GATE.opening;

    // Kemerin gölgesi
    ctx.globalAlpha = 0.30;
    blk(ctx, toX(f.x + 6), toY(f.y + f.h - 4), f.w - 12, 12, '#052e16');
    ctx.globalAlpha = 1;

    // Açıklık: karanlık boşluk + mor geçit parıltısı (taban katman)
    for (let y = o.y; y < o.y + o.h; y += PX) {
        for (let x = o.x; x < o.x + o.w; x += PX) {
            const dy = (y - o.y) / o.h;
            const n = hash(x, y, 101);
            let tone = '#0b1020';
            if (n < 0.10 + dy * 0.16) tone = '#2e1065';
            if (n < 0.035 + dy * 0.06) tone = '#6d28d9';
            ctx.fillStyle = tone;
            ctx.fillRect(toX(x), toY(y), PX, PX);
        }
    }
    // Açıklığın içindeki basamaklar (perspektif: aşağı indikçe genişler)
    for (let i = 0; i < 3; i++) {
        const sy = o.y + o.h - PX * (3 - i) * 2;
        const inset = (2 - i) * PX * 2;
        blk(ctx, toX(o.x + inset), toY(sy), o.w - inset * 2, PX * 2, i === 2 ? '#94a3b8' : '#64748b');
        blk(ctx, toX(o.x + inset), toY(sy + PX * 2), o.w - inset * 2, PX, '#334155');
    }

    // Taş ayaklar ve lento: derz çizgili blok örgü, sol yüz ışıklı
    const drawStone = (rx, ry, rw, rh) => {
        for (let y = ry; y < ry + rh; y += PX) {
            for (let x = rx; x < rx + rw; x += PX) {
                const row = Math.floor((y - ry) / (PX * 4));
                const brick = Math.floor((x - rx + (row % 2) * PX * 4) / (PX * 8));
                const rel = (x - rx) / rw;
                let tone = STONE[Math.floor(hash(brick, row, 103) * 2)];
                if (rel < 0.28) tone = STONE[2];
                else if (rel > 0.74) tone = STONE[3];
                if ((y - ry) % (PX * 4) === 0 || (x - rx + (row % 2) * PX * 4) % (PX * 8) === 0) tone = '#1f2937';
                ctx.fillStyle = tone;
                ctx.fillRect(toX(x), toY(y), PX, PX);
            }
        }
    };
    // Ayaklar çarpışma kutularıyla birebir aynı genişlikte çizilir; ikisi
    // ayrışırsa aradaki boşluktan orman sızıyor.
    for (const pillar of GATE.pillars) drawStone(pillar.x, pillar.y, pillar.w, pillar.h);
    drawStone(f.x, f.y, f.w, o.y - f.y);

    // Lentonun üst yüzü: kalınlık hissi veren açık şerit
    blk(ctx, toX(f.x) - PX, toY(f.y) - PX * 2, f.w + PX * 2, PX * 2, '#cbd5e1');
    blk(ctx, toX(f.x) - PX, toY(f.y), f.w + PX * 2, PX, '#94a3b8');

    // Ayakların dibindeki taş taban
    blk(ctx, toX(f.x - PX), toY(f.y + f.h - PX * 2), f.w + PX * 2, PX * 3, '#475569');

    // Kemer içi üst gölge: açıklığın tepesi koyulaşır, derinlik hissi
    blk(ctx, toX(o.x), toY(o.y), o.w, PX * 2, '#020617');

    // Parlayan runeler (ayakların ortasında)
    for (const rx of [f.x + 8, f.x + f.w - 18]) {
        for (let i = 0; i < 3; i++) {
            dot(ctx, toX(rx), toY(f.y + 46 + i * PX * 3), '#a78bfa');
            dot(ctx, toX(rx + PX), toY(f.y + 46 + i * PX * 3 + PX), '#7c3aed');
        }
    }

    // --- Tabela ---
    const s = GATE.sign;
    // Direkler: kemerin iki yanında toprağa saplanır
    for (const postX of [s.x + 28, s.x + s.w - 40]) {
        for (let y = s.y + s.h - PX * 2; y < f.y + 40; y += PX) {
            for (let x = postX; x < postX + 12; x += PX) {
                const rel = (x - postX) / 12;
                ctx.fillStyle = rel < 0.34 ? '#a97142' : rel > 0.66 ? '#5f3a1c' : '#8b5a30';
                ctx.fillRect(toX(x), toY(y), PX, PX);
            }
        }
    }

    // Tahta pano: yatay kalaslar, koyu çerçeve, köşe çivileri
    blk(ctx, toX(s.x - PX), toY(s.y - PX), s.w + PX * 2, s.h + PX * 2, '#3f2a12');
    for (let y = s.y; y < s.y + s.h; y += PX) {
        for (let x = s.x; x < s.x + s.w; x += PX) {
            const plank = Math.floor((y - s.y) / (PX * 6));
            let tone = plank % 2 === 0 ? '#a97142' : '#96612f';
            if (hash(x, y, 107) < 0.14) tone = '#8b5a30';
            if ((y - s.y) % (PX * 6) === 0) tone = '#6b4520';
            ctx.fillStyle = tone;
            ctx.fillRect(toX(x), toY(y), PX, PX);
        }
    }
    for (const cx of [s.x + PX * 2, s.x + s.w - PX * 3]) {
        for (const cy of [s.y + PX * 2, s.y + s.h - PX * 3]) dot(ctx, toX(cx), toY(cy), '#d6d3d1');
    }

    // Yazı: iki satır, ortalanmış
    const scale = 4;
    const lineH = 7 * scale + 8;
    const startY = s.y + (s.h - (s.lines.length * lineH - 8)) / 2;
    s.lines.forEach((line, i) => {
        drawPixelText(ctx, line, toX(s.x + s.w / 2), toY(startY + i * lineH), {
            scale,
            color: '#fef3c7',
            shadow: '#4a2c12',
            align: 'center'
        });
    });

    return { canvas, x: left, y: top, baseY: GATE.frame.y + GATE.frame.h };
}

// --- Macera kapısı (sağ orman) ---

// Kapı, düz bir dikdörtgen değil: derinliği dört ayrı ipucundan okunuyor.
//   1) Lentonun ve sövelerin üstünde kalınlık gösteren açık şeritler
//   2) Açıklığın içinde sağa doğru kaçan yan duvar
//   3) Zemine düşen, arkaya doğru daralan sıcak ışık yamuğu
//   4) Öne doğru aralanmış, dikey kalaslı kapı kanadı
export function bakeDoor() {
    const pad = 48;
    const left = DOOR.frame.x - pad;
    const top = DOOR.frame.y - pad;
    const { canvas, ctx } = newCanvas(DOOR.frame.w + pad * 2, DOOR.frame.h + pad * 2);
    const toX = (x) => x - left;
    const toY = (y) => y - top;

    const f = DOOR.frame;
    const o = DOOR.opening;
    const DEPTH = 20;                 // açıklığın içeri kaçtığı derinlik

    // Yere düşen gölge
    ctx.globalAlpha = 0.30;
    blk(ctx, toX(f.x - 6), toY(f.y + f.h - 8), f.w + 12, 16, '#052e16');
    ctx.globalAlpha = 1;

    // 1) Açıklığın içi: karanlık oda
    blk(ctx, toX(o.x), toY(o.y), o.w, o.h, '#0d0906');

    // 2) İçeri kaçan sağ yan duvar (perspektif): açıklığın sağ kenarından
    // içeri doğru daralan bir şerit. Işık kapıdan girdiği için soluk aydınlık.
    for (let y = o.y; y < o.y + o.h; y += PX) {
        const t = Math.min(1, Math.abs(y - (o.y + o.h / 2)) / (o.h / 2));
        const depth = Math.round((DEPTH * (1 - t * 0.35)) / PX) * PX;
        for (let d = 0; d < depth; d += PX) {
            const shade = d / depth;
            ctx.fillStyle = shade < 0.35 ? '#3f3a35' : shade < 0.7 ? '#2b2723' : '#1a1714';
            ctx.fillRect(toX(o.x + o.w - depth + d), toY(y), PX, PX);
        }
    }

    // 3) İçerideki zemin: arkaya doğru daralan sıcak ışık yamuğu. Kapı
    // aralığından giren ışık burayı aydınlatıyor - ton bilerek soluk, parlak
    // turuncu bir leke lav gibi duruyordu.
    const floorTop = o.y + o.h - 34;
    for (let y = floorTop; y < o.y + o.h; y += PX) {
        const t = (y - floorTop) / (o.y + o.h - floorTop);   // 0 arka, 1 ön
        const halfW = (o.w / 2) * (0.26 + t * 0.52);
        const cx = o.x + o.w / 2 - 4;
        for (let x = cx - halfW; x < cx + halfW; x += PX) {
            const warm = hash(x, y, 109);
            ctx.fillStyle = t > 0.6
                ? (warm < 0.28 ? '#8a5a24' : '#6b451c')
                : (warm < 0.28 ? '#4e3113' : '#33200c');
            ctx.fillRect(Math.round(toX(x) / PX) * PX, toY(y), PX, PX);
        }
    }

    // 4) Taş çerçeve: söveler, lento ve eşik. rel, ışığın geldiği yöne göre
    // ton seçer (sol üstten aydınlık).
    const drawStone = (rx, ry, rw, rh, lightAxis) => {
        for (let y = ry; y < ry + rh; y += PX) {
            for (let x = rx; x < rx + rw; x += PX) {
                const row = Math.floor((y - ry) / (PX * 4));
                const brick = Math.floor((x - rx + (row % 2) * PX * 3) / (PX * 7));
                const rel = lightAxis === 'x' ? (x - rx) / rw : (y - ry) / rh;
                let tone = ['#a8a29e', '#8b857f'][Math.floor(hash(brick, row, 137) * 2)];
                if (rel < 0.32) tone = '#d6d3d1';
                else if (rel > 0.70) tone = '#57534e';
                if ((y - ry) % (PX * 4) === 0 || (x - rx + (row % 2) * PX * 3) % (PX * 7) === 0) tone = '#3f3a35';
                ctx.fillStyle = tone;
                ctx.fillRect(toX(x), toY(y), PX, PX);
            }
        }
    };
    drawStone(f.x, f.y, o.x - f.x, f.h, 'x');                                  // sol söve
    drawStone(o.x + o.w, f.y, f.x + f.w - (o.x + o.w), f.h, 'x');              // sağ söve
    drawStone(f.x, f.y, f.w, o.y - f.y, 'y');                                  // lento
    drawStone(f.x, o.y + o.h, f.w, f.y + f.h - (o.y + o.h), 'y');              // eşik

    // Lentonun ve sövelerin kalınlığı: taşın üstünde ve iç kenarında açık şerit
    blk(ctx, toX(f.x - PX), toY(f.y - PX * 2), f.w + PX * 2, PX * 2, '#e7e5e4');
    blk(ctx, toX(f.x - PX), toY(f.y), f.w + PX * 2, PX, '#a8a29e');
    blk(ctx, toX(o.x - PX), toY(o.y), PX, o.h, '#57534e');                     // sol sövenin iç yüzü
    blk(ctx, toX(o.x), toY(o.y - PX), o.w, PX, '#292524');                     // lentonun iç yüzü (gölge)

    // Eşiğin önündeki basamak: öne doğru genişleyen iki sıra taş
    for (let i = 0; i < 2; i++) {
        const sy = f.y + f.h + i * PX * 2;
        const grow = (i + 1) * PX * 3;
        blk(ctx, toX(f.x - grow), toY(sy), f.w + grow * 2, PX * 2, i === 0 ? '#b8b2ab' : '#8b857f');
        blk(ctx, toX(f.x - grow), toY(sy + PX * 2), f.w + grow * 2, PX, '#44403c');
    }

    // 5) Aralanmış kapı kanadı. Menteşe sol sövede; kanat öne (sola) açılmış.
    // Dış kenar izleyiciye daha yakın olduğu için biraz daha uzun çizilir -
    // perspektif hissi buradan geliyor.
    const hingeX = o.x;
    const outerX = o.x - 40;
    const hingeTop = o.y;
    const hingeBottom = o.y + o.h;
    const outerTop = o.y - 8;
    const outerBottom = o.y + o.h + 12;

    // Sütun sınırları piksel ızgarasına oturtulur; oturmazsa kanadın üst ve
    // alt kenarı tırtıklı, yırtık gibi çıkıyor.
    const columns = [];
    for (let x = outerX; x <= hingeX; x += PX) {
        const t = (x - outerX) / (hingeX - outerX);          // 0 dış kenar, 1 menteşe
        columns.push({
            x,
            t,
            top: Math.round((outerTop + (hingeTop - outerTop) * t) / PX) * PX,
            bottom: Math.round((outerBottom + (hingeBottom - outerBottom) * t) / PX) * PX
        });
    }

    for (const col of columns) {
        const plank = Math.round((col.x - outerX) / PX);
        // Dış kenar ışık alır, menteşeye doğru gölgeye girer
        const base = col.t < 0.16 ? '#b07a45' : col.t < 0.48 ? '#8b5a30' : col.t < 0.78 ? '#6b4520' : '#54371a';
        for (let y = col.top; y < col.bottom; y += PX) {
            let tone = base;
            if (plank % 4 === 0) tone = '#33200c';           // kalas aralığı
            else if (hash(col.x, y, 139) < 0.14) tone = '#4a2c12';
            ctx.fillStyle = tone;
            ctx.fillRect(toX(col.x), toY(y), PX, PX);
        }
        // Kanadın üst ve alt kenarındaki koyu kontur
        dot(ctx, toX(col.x), toY(col.top), '#2a1808');
        dot(ctx, toX(col.x), toY(col.bottom - PX), '#2a1808');
    }

    // Kanadın demir bantları ve halka tokmağı
    for (const rel of [0.22, 0.78]) {
        for (const col of columns) {
            const by = Math.round((col.top + (col.bottom - col.top) * rel) / PX) * PX;
            dot(ctx, toX(col.x), toY(by), '#3f3f46');
            dot(ctx, toX(col.x), toY(by + PX), '#27272a');
        }
    }
    const knobY = Math.round((o.y + o.h / 2) / PX) * PX;
    dot(ctx, toX(outerX + PX * 2), toY(knobY), '#fbbf24');
    dot(ctx, toX(outerX + PX * 2), toY(knobY + PX), '#b45309');
    dot(ctx, toX(outerX + PX * 3), toY(knobY), '#fde68a');

    return { canvas, x: left, y: top, baseY: DOOR.frame.y + DOOR.frame.h + 12 };
}

// --- Karede canlanan küçük efektler ---

// Bacadan tüten duman
export function drawSmoke(ctx, frame) {
    const chimneyX = HOUSE.x + HOUSE.w - 60;
    const chimneyY = HOUSE.y + 4;
    for (let i = 0; i < 7; i++) {
        const t = ((frame * 0.6 + i * 26) % 180) / 180;
        const y = chimneyY - t * 74;
        const x = chimneyX + Math.sin(t * 4 + i) * 14 + t * 10;
        const size = PX * (1 + Math.floor(t * 3));
        ctx.globalAlpha = 0.42 * (1 - t);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, size, size);
    }
    ctx.globalAlpha = 1;
}

// Geçidin içindeki mor parıltı
export function drawGatePortal(ctx, frame) {
    const o = GATE.opening;
    for (let i = 0; i < 14; i++) {
        const t = ((frame * 0.8 + i * 30) % 120) / 120;
        const x = o.x + PX * 2 + hash(i, 0, 149) * (o.w - PX * 4);
        const y = o.y + o.h - t * (o.h - PX * 2);
        ctx.globalAlpha = 0.65 * Math.sin(t * Math.PI);
        ctx.fillStyle = i % 3 === 0 ? '#c4b5fd' : '#8b5cf6';
        ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX, PX);
    }
    ctx.globalAlpha = 1;
}

// Kapının içindeki ateş ışığının titremesi: zemindeki sıcak yamuk nefes alır
export function drawDoorGlow(ctx, frame) {
    const o = DOOR.opening;
    const flicker = 0.5 + Math.sin(frame * 0.11) * 0.28 + Math.sin(frame * 0.37) * 0.14;
    ctx.globalAlpha = 0.16 * flicker;
    ctx.fillStyle = '#fbbf24';
    const floorTop = o.y + o.h - 44;
    for (let y = floorTop; y < o.y + o.h; y += PX) {
        const t = (y - floorTop) / (o.y + o.h - floorTop);
        const halfW = Math.round(((o.w / 2) * (0.30 + t * 0.62)) / PX) * PX;
        ctx.fillRect(Math.round((o.x + o.w / 2 - 4 - halfW) / PX) * PX, y, halfW * 2, PX);
    }
    ctx.globalAlpha = 1;
}

// Ormanda süzülen ateşböcekleri
export function drawFireflies(ctx, flies, frame) {
    for (const fly of flies) {
        const glow = 0.35 + Math.sin(frame * 0.06 + fly.phase) * 0.35;
        if (glow <= 0.08) continue;
        ctx.globalAlpha = glow;
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(Math.round(fly.x / PX) * PX, Math.round(fly.y / PX) * PX, PX, PX);
    }
    ctx.globalAlpha = 1;
}
