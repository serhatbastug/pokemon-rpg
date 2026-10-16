// Ana menü sahnesinin yerleşimi. Burada DOM/canvas yok - sadece sayılar,
// böylece çizimden bağımsız test edilebilir (tests/data.test.mjs).
//
// Sahne tek ekrandır, kamera kaymaz:
//   sol    -> antrenörün evi (şimdilik yalnızca dekor)
//   yukarı -> MACERA KAPISI: tabelalı taş kemer, yaklaşıp F ile açılır
//   sağ    -> 2 KİŞİLİK OYNA portalı: açıklığından yürüyerek geçilir
//
// Piksel birimi PX = 4: antrenör sprite'ı da 4 ölçeğiyle çizilir, böylece
// sahnedeki her şey aynı piksel ızgarasına oturur.

export { PX } from '../pixel/pixelDraw.js';
import { PX, mulberry32 } from '../pixel/pixelDraw.js';
import { TREE_SIZES, treeBase } from '../pixel/trees.js';
export { TREE_SIZES, treeBase };

export const SCENE = { w: 1000, h: 560 };

// Antrenörün ayak hizasındaki çarpışma kutusu
export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.2;
export const PLAYER_SCALE = 4;
export const START = { x: 500, y: 400 };

// Evin oturduğu alan (çatı dahil). Tamamı engeldir; kullanıcı isteği gereği
// evle şimdilik etkileşim yok.
export const HOUSE = { x: 95, y: 120, w: 240, h: 140 };

// Üstteki macera kapısı. Kemerin tamamı engeldir: içinden geçilmez, önünde
// durup F'ye basılır ve onay penceresi açılır.
export const ADVENTURE = {
    sign: { x: 408, y: 4, w: 184, h: 84, lines: ['MACERA', 'KAPISI'], scale: 4 },
    frame: { x: 426, y: 88, w: 148, h: 120 },
    pillars: [
        { x: 426, y: 88, w: 30, h: 120 },
        { x: 544, y: 88, w: 30, h: 120 }
    ],
    opening: { x: 456, y: 126, w: 88, h: 82 },
    hotspot: { x: 500, y: 236, r: 94 },
    glow: 'amber'
};

// Sağdaki iki kişilik oyun portalı. Ayakları engel, açıklığı yürünebilir:
// antrenör patikadan gelip kemerin altına girince ekran kararır.
export const VERSUS = {
    sign: { x: 786, y: 62, w: 184, h: 72, lines: ['2 KİŞİLİK', 'OYNA'], scale: 3 },
    frame: { x: 812, y: 150, w: 132, h: 150 },
    pillars: [
        { x: 812, y: 150, w: 32, h: 150 },
        { x: 912, y: 150, w: 32, h: 150 }
    ],
    opening: { x: 844, y: 190, w: 68, h: 110 },
    back: { x: 844, y: 150, w: 68, h: 40 },   // kemerin arkası: dışarı çıkılamaz
    trigger: { x: 848, y: 194, w: 60, h: 60 },
    glow: 'violet'
};

// Toprak patikalar (yalnızca görsel; üzerinde yürümek zorunlu değil)
export const PATHS = [
    { x: 55, y: 255, w: 835, h: 70 },   // evden portala uzanan ana patika
    { x: 460, y: 208, w: 80, h: 92 }    // macera kapısına çıkan kol
];

// Sahneyi çevreleyen orman duvarları: ağaçlar buraya çizilir, içinden
// geçilemez.
const WALLS = [
    { x: 0, y: 0, w: 426, h: 178 },
    { x: 574, y: 0, w: 426, h: 178 },
    { x: 0, y: 0, w: 55, h: 560 },
    { x: 985, y: 0, w: 15, h: 560 },
    { x: 0, y: 472, w: 1000, h: 88 }
];

// --- Ağaçların dağıtımı ---

// Ağaç dikilebilecek şeritler. Sıklık bilerek düşük tutuldu: taçlar üst üste
// binip tek bir yeşil kütleye dönüşünce hiçbir ağaç okunmuyor.
const BANDS = [
    { x: 0, y: -10, w: 1000, h: 156, count: 26, sizes: ['big', 'big', 'mid'] },      // üst orman
    { x: 0, y: 452, w: 1000, h: 110, count: 18, sizes: ['big', 'mid', 'mid'] },      // alt orman
    { x: 0, y: 110, w: 80, h: 370, count: 7, sizes: ['big', 'mid'] },                // sol kenar
    { x: 596, y: 120, w: 156, h: 130, count: 6, sizes: ['big', 'big', 'mid'] },      // sağ orman (üst)
    { x: 596, y: 330, w: 156, h: 140, count: 5, sizes: ['big', 'mid', 'mid'] },      // sağ orman (alt)
    { x: 60, y: 330, w: 345, h: 140, count: 8, sizes: ['mid', 'small', 'mid'] },     // evin altı
    { x: 340, y: 120, w: 72, h: 140, count: 2, sizes: ['mid', 'small'] }             // ev ile kemer arası
];

// Ağaç girmemesi gereken alanlar: patikalar, ev, iki kemerin çevresi, tabelalar
// ve antrenörün doğduğu açıklık. Kemerlerin çevresi geniş tutuldu - önünde
// duran bir ağaç kapıyı tamamen örtüyordu.
const KEEP_OUT = [
    { x: 0, y: 238, w: 1000, h: 104 },
    { x: 414, y: 86, w: 172, h: 240 },
    { x: 80, y: 105, w: 270, h: 170 },
    { x: 760, y: 40, w: 240, h: 440 },
    { x: 370, y: 320, w: 280, h: 170 },
    { x: 396, y: 0, w: 208, h: 100 }
];

export function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildTrees() {
    const rand = mulberry32(20260823);
    const trees = [];

    for (const band of BANDS) {
        let placed = 0;
        // Deneme sayısı sınırlı: sıkışan şerit sonsuz döngüye girmesin
        for (let attempt = 0; attempt < band.count * 40 && placed < band.count; attempt++) {
            const x = Math.round(band.x + rand() * band.w);
            const y = Math.round(band.y + rand() * band.h);
            const size = band.sizes[Math.floor(rand() * band.sizes.length)];
            const tree = { x, y, size, variant: Math.floor(rand() * 4) };
            const base = treeBase(tree);

            if (KEEP_OUT.some(zone => rectsOverlap(base, zone))) continue;
            // Gövdeler üst üste binmesin (taçlar bilerek örtüşür, orman sıklaşır)
            const tooClose = trees.some(other => {
                const dx = other.x - x, dy = (other.y - y) * 1.6;
                return dx * dx + dy * dy < 34 * 34;
            });
            if (tooClose) continue;

            trees.push(tree);
            placed++;
        }
    }

    // Arkadan öne çizim için gövde dibine göre sıralanır
    trees.sort((a, b) => a.y - b.y);
    return trees;
}

export const TREES = buildTrees();

// Çarpışma alan listesi. Macera kemerinin tamamı engel (F ile açılır),
// portalda ise yalnızca ayaklar ve arka duvar engel - açıklıktan geçilir.
export const SOLIDS = [
    ...WALLS,
    HOUSE,
    ADVENTURE.frame,
    ...VERSUS.pillars,
    VERSUS.back,
    ...TREES.map(treeBase)
];

// (x, y) merkezli ayak kutusu bir engele giriyor mu?
export function blocked(x, y) {
    const box = {
        x: x - PLAYER_BOX.w / 2,
        y: y - PLAYER_BOX.h / 2,
        w: PLAYER_BOX.w,
        h: PLAYER_BOX.h
    };
    return SOLIDS.some(solid => rectsOverlap(box, solid));
}

export function inRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// Antrenör macera kapısının önünde mi? (F ipucu ve onay penceresi için)
export function nearAdventureGate(x, y) {
    return Math.hypot(x - ADVENTURE.hotspot.x, y - ADVENTURE.hotspot.y) <= ADVENTURE.hotspot.r;
}

// Antrenör iki kişilik oyun portalının altına girdi mi?
export function inVersusPortal(x, y) {
    return inRect(x, y, VERSUS.trigger);
}
