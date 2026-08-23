// Ana menü sahnesinin yerleşimi. Burada DOM/canvas yok - sadece sayılar,
// böylece çizimden bağımsız test edilebilir (tests/data.test.mjs).
//
// Sahne tek ekrandır, kamera kaymaz: solda antrenörün evi, sağda orman ve
// ormanın en dibinde macera kapısı, yukarıda "İKİ KİŞİLİK OYNA" tabelası ve
// altındaki geçit.
//
// Piksel birimi PX = 4: antrenör sprite'ı da 4 ölçeğiyle çizilir, böylece
// sahnedeki her şey aynı piksel ızgarasına oturur.

export const PX = 4;
export const SCENE = { w: 1000, h: 560 };

// Antrenörün ayak hizasındaki çarpışma kutusu
export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.2;
export const PLAYER_SCALE = 4;
export const START = { x: 500, y: 400 };

// Evin oturduğu alan (çatı dahil). Tamamı engeldir; kullanıcı isteği gereği
// evle şimdilik etkileşim yok.
export const HOUSE = { x: 95, y: 120, w: 240, h: 140 };

// Üstteki geçit: tabela + altından geçilen kapı. Antrenör açıklığa girince
// ekran yavaşça kararır ve karakter seçimine gidilir.
export const GATE = {
    sign: { x: 340, y: 4, w: 320, h: 84, lines: ['İKİ KİŞİLİK', 'OYNA'] },
    frame: { x: 426, y: 88, w: 148, h: 120 },
    // Çerçevenin yalnızca yan ayakları engeldir; açıklıktan geçilir
    pillars: [
        { x: 426, y: 88, w: 30, h: 120 },
        { x: 544, y: 88, w: 30, h: 120 }
    ],
    opening: { x: 456, y: 126, w: 88, h: 82 },
    trigger: { x: 460, y: 130, w: 80, h: 50 }
};

// Sağdaki macera kapısı: yaklaşıp F'ye basınca onay penceresi açılır.
// Ekran kenarına yapışmasın diye sağında bir tutam orman bırakıldı.
export const DOOR = {
    frame: { x: 848, y: 196, w: 116, h: 174 },
    opening: { x: 872, y: 228, w: 68, h: 128 },
    hotspot: { x: 866, y: 300, r: 104 }
};

// Toprak patikalar (yalnızca görsel; üzerinde yürümek zorunlu değil)
export const PATHS = [
    { x: 55, y: 255, w: 890, h: 70 },   // evden ormana uzanan ana patika
    { x: 460, y: 190, w: 80, h: 110 }   // geçide çıkan kol
];

// Sahneyi çevreleyen orman duvarları: ağaçlar buraya çizilir, içinden
// geçilemez. Geçidin açıklığı üstteki duvarda bilerek boş bırakılmıştır.
const WALLS = [
    { x: 0, y: 0, w: 426, h: 178 },
    { x: 574, y: 0, w: 426, h: 178 },
    { x: 426, y: 0, w: 148, h: 126 },   // geçidin arkası: dışarı çıkılamaz
    { x: 0, y: 0, w: 55, h: 560 },
    { x: 985, y: 0, w: 15, h: 560 },
    { x: 0, y: 472, w: 1000, h: 88 }
];

// --- Ağaçların dağıtımı ---
// Sabit tohumlu üreteç: her açılışta aynı orman çıkar (test edilebilir olsun).
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Ağaç boyları: gövde dibi (x, y) referans alınır.
export const TREE_SIZES = {
    big:   { canopyW: 112, canopyH: 116, trunkH: 48, trunkW: 20 },
    mid:   { canopyW: 88,  canopyH: 92,  trunkH: 36, trunkW: 16 },
    small: { canopyW: 64,  canopyH: 68,  trunkH: 28, trunkW: 12 }
};

// Ağaç dikilebilecek şeritler. Sıklık bilerek düşük tutuldu: taçlar üst üste
// binip tek bir yeşil kütleye dönüşünce hiçbir ağaç okunmuyor.
const BANDS = [
    { x: 0, y: -10, w: 1000, h: 156, count: 26, sizes: ['big', 'big', 'mid'] },      // üst orman
    { x: 0, y: 452, w: 1000, h: 110, count: 18, sizes: ['big', 'mid', 'mid'] },      // alt orman
    { x: 0, y: 110, w: 80, h: 370, count: 7, sizes: ['big', 'mid'] },                // sol kenar
    { x: 600, y: 120, w: 260, h: 130, count: 8, sizes: ['big', 'big', 'mid'] },      // sağ orman (üst)
    { x: 600, y: 330, w: 240, h: 140, count: 7, sizes: ['big', 'mid', 'mid'] },      // sağ orman (alt)
    { x: 60, y: 330, w: 345, h: 140, count: 8, sizes: ['mid', 'small', 'mid'] },     // evin altı
    { x: 340, y: 120, w: 90, h: 140, count: 3, sizes: ['mid', 'small'] },            // ev ile geçit arası
    { x: 578, y: 120, w: 40, h: 140, count: 2, sizes: ['mid', 'small'] }             // geçidin sağı
];

// Ağaç girmemesi gereken alanlar: patikalar, ev, kapı önü, tabela ve
// antrenörün doğduğu açıklık. Kapının çevresi geniş tutuldu - orada duran bir
// ağaç kapıyı tamamen örtüyordu.
const KEEP_OUT = [
    { x: 0, y: 238, w: 1000, h: 104 },
    { x: 414, y: 86, w: 172, h: 230 },
    { x: 80, y: 105, w: 270, h: 170 },
    { x: 806, y: 130, w: 194, h: 430 },
    { x: 370, y: 320, w: 280, h: 170 },
    { x: 330, y: 0, w: 340, h: 100 }
];

export function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Bir ağacın gövde dibindeki engel kutusu
export function treeBase(tree) {
    const size = TREE_SIZES[tree.size];
    return { x: tree.x - size.trunkW / 2 - 4, y: tree.y - 14, w: size.trunkW + 8, h: 18 };
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

// Çarpışma alan listesi: duvarlar + ev + kapı çerçeveleri + ağaç dipleri
export const SOLIDS = [
    ...WALLS,
    HOUSE,
    ...GATE.pillars,
    DOOR.frame,
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
export function nearDoor(x, y) {
    return Math.hypot(x - DOOR.hotspot.x, y - DOOR.hotspot.y) <= DOOR.hotspot.r;
}

// Antrenör üstteki geçide girdi mi?
export function inGate(x, y) {
    return inRect(x, y, GATE.trigger);
}
