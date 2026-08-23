// Ağaç çizimi: hem ana menü sahnesi hem macera sahneleri bunu kullanır.
// Her ağaç bir kez offscreen canvas'a çizilip önbelleğe alınır; sahneler
// yalnızca hazır sprite'ı kopyalar.

import { PX, newCanvas, blk, dot, hash } from './pixelDraw.js';

// Ağaç boyları: gövde dibi (x, y) referans alınır.
// tall/huge ormanın içi için: ana menüdekilerden belirgin şekilde uzunlar,
// gövde boyu taç yüksekliğine yaklaştıkça ağaç "orman ağacı" gibi duruyor.
export const TREE_SIZES = {
    small: { canopyW: 64,  canopyH: 68,  trunkH: 28,  trunkW: 12 },
    mid:   { canopyW: 88,  canopyH: 92,  trunkH: 36,  trunkW: 16 },
    big:   { canopyW: 112, canopyH: 116, trunkH: 48,  trunkW: 20 },
    tall:  { canopyW: 132, canopyH: 148, trunkH: 96,  trunkW: 26 },
    huge:  { canopyW: 164, canopyH: 178, trunkH: 124, trunkW: 32 }
};

// Bir ağacın gövde dibindeki engel kutusu
export function treeBase(tree) {
    const size = TREE_SIZES[tree.size];
    return { x: tree.x - size.trunkW / 2 - 4, y: tree.y - 14, w: size.trunkW + 8, h: 18 };
}

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
