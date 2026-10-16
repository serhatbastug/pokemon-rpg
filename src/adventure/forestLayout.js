// Orman ağzı sahnesinin yerleşimi: solda harabe şehir (asfalt yol, kaldırım,
// binalar), sağda ağaç duvarı, duvarda dar bir boşluk, ardında kıvrılan orman
// koridoru. DOM/canvas yok - yalnızca sayılar. Çizimi forestArt.js,
// sahneyi ForestMouthScene.js yürütüyor.

import { PX, mulberry32 } from '../pixel/pixelDraw.js';
import { TREE_SIZES, treeBase } from '../pixel/trees.js';


export const WORLD = { w: 2400, h: 560 };
export const VIEW = { w: 1000, h: 560 };

export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.2;
export const START = { x: 760, y: 320 };

// Mekan adı: ormana girince ekranda beliren yazı
export const LOCATION_NAME = 'FISILTILI ORMAN GİRİŞİ';

// --- Şehir ---
// Yatay şeritler: üstte ve altta bina sırası, ortada asfalt yol.
export const CITY = {
    x0: 0,
    x1: 900,
    topBuildings: { y: 0, h: 160 },
    topWalk: { y: 160, h: 40 },      // üst kaldırım
    road: { y: 200, h: 100 },        // asfalt
    bottomWalk: { y: 300, h: 40 },   // alt kaldırım
    verge: { y: 340, h: 100 },       // çim şerit (ormana bakan kenar)
    bottomEdge: { y: 440, h: 120 },      // parkın çit + çalı kenarı
    // Antrenörün yürüyebildiği bant: kaldırım + yol + çim
    walk: { top: 160, bottom: 440 },
    edgeX: 840,                      // asfaltın bittiği yer (sonrası çim)
    crosswalk: { x: 300, w: 90 },    // yaya geçidi
    lamps: [120, 460, 800]           // sokak lambası direklerinin x'i
};

// --- Ormanın girişindeki boşluk ---
// Ağaç duvarında yalnızca burası açıktır; genişliği antrenörün sığacağı kadar.
export const GAP = { x0: 900, x1: 1010, top: 300, bottom: 370 };

// --- Harabe: yolu tıkayan enkaz ---
// Şehir artık terk edilmiş. Yolda bırakılmış araçlar, çöken cephelerin
// döküntüsü ve devrilmiş karantina bariyeri birer engeldir. Hiçbiri yolu
// tamamen kapatmaz: her aracın üstünden ya da altından geçilebilir, yoksa
// oyuncu şehirde sıkışır.
// Araba sahnesinde araç yolun alt şeridinden gelip duruyor: terk edilmiş
// araçlar yolun ÜST kenarına çekilmiş.
export const WRECKS = [
    { x: 60, y: 172, w: 128, h: 56, kind: 'sedan', tone: 0 },
    { x: 700, y: 172, w: 132, h: 56, kind: 'burnt', tone: 2 }
];

// Binalar arasındaki dar sokak: sığınağa giden yardımcılar buradan girer
export const ALLEY = { x: 470, w: 96 };

// Araba bu şeritte gelir (ayak çizgisi) ve durur
export const CAR_LANE = { y: 292, stopX: 640 };

// Cephelerden kaldırıma dökülen moloz
export const RUBBLE = [
    { x: 296, y: 160, w: 92, h: 32 },
    { x: 556, y: 160, w: 72, h: 28 }
];

// Kanalizasyondan çıkılan açık rögar. Antrenör başlangıçta tam yanındadır:
// oyuna, kapağı henüz itmiş gibi başlar. Delik engeldir, içine yürünmez.
export const MANHOLE = { x: 200, y: 304, w: 44, h: 32 };

// Devrilmiş karantina bariyeri: yaya geçidinin üstüne YATMIŞ, bu yüzden
// kutusu geniş ve alçak. Asfaltın üstünde duruyor ki gri kaldırıma karışmasın.
// Üstünden geçilmez, etrafından dolaşılır.
export const BARRIER = { x: 300, y: 204, w: 112, h: 24 };

export const OBSTACLES = [...WRECKS, ...RUBBLE, MANHOLE, BARRIER];

function inObstacle(x, y) {
    return OBSTACLES.some(o => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
}

// --- Dar orman koridoru ---
// Yürünebilir bant x boyunca kıvrılır ama hep dardır. Koridor bilerek ekranın
// üst yarısında: ağaç tacı gövde dibinden YUKARI doğru uzadığı için, koridorun
// altına dikilen uzun bir ağaç yolu tamamen örtüyor. Altta yalnızca alçak
// bitki örtüsüne yer var.
export const FOREST = {
    x0: 1010,
    x1: WORLD.w,
    halfHeight: 55,        // bandın yarı yüksekliği (toplam 110 piksel: dar)
    centerY: 335,
    waveAmplitude: 45,
    waveLength: 520
};

// Koridorun bir x'teki üst/alt sınırı
export function corridorAt(x) {
    const t = (x - FOREST.x0) / FOREST.waveLength;
    const center = FOREST.centerY + Math.sin(t * Math.PI * 2) * FOREST.waveAmplitude;
    return { top: center - FOREST.halfHeight, bottom: center + FOREST.halfHeight, center };
}

// Tek bir noktanın yürünebilirliği. Sahnenin bütün çarpışma mantığı budur.
function walkableAt(x, y) {
    if (x < 12 || x > WORLD.w - 12 || y < 0 || y > WORLD.h) return false;
    if (inObstacle(x, y)) return false;

    if (x < GAP.x0) return y >= CITY.walk.top && y <= CITY.walk.bottom;
    if (x < FOREST.x0) return y >= GAP.top && y <= GAP.bottom;

    const corridor = corridorAt(x);
    return y >= corridor.top && y <= corridor.bottom;
}

// Ayak kutusunun tamamı yürünebilir mi? Koridor eğri olduğu için dikdörtgen
// engel listesi yerine kutunun köşeleri ve kenar ortaları tek tek bakılır.
export function blocked(x, y) {
    const hw = PLAYER_BOX.w / 2;
    const hh = PLAYER_BOX.h / 2;
    const points = [
        [x - hw, y - hh], [x + hw, y - hh],
        [x - hw, y + hh], [x + hw, y + hh],
        [x, y - hh], [x, y + hh]
    ];
    return points.some(([px, py]) => !walkableAt(px, py));
}

// --- Ağaçlar ---

// Bir ağacın dibi yürünebilir alana taşıyor mu?
function baseBlocksPath(tree) {
    const base = treeBase(tree);
    const margin = 10;
    for (let px = base.x - margin; px <= base.x + base.w + margin; px += PX * 2) {
        for (let py = base.y - margin; py <= base.y + base.h + margin; py += PX * 2) {
            if (walkableAt(px, py)) return true;
        }
    }
    return false;
}

function buildTrees() {
    const rand = mulberry32(20260824);
    const trees = [];
    const place = (x, y, size, variant) => {
        const tree = { x: Math.round(x), y: Math.round(y), size, variant };
        if (baseBlocksPath(tree)) return false;
        const tooClose = trees.some(other => {
            const dx = other.x - tree.x;
            const dy = (other.y - tree.y) * 1.4;
            return dx * dx + dy * dy < 46 * 46;
        });
        if (tooClose) return false;
        trees.push(tree);
        return true;
    };

    // Uzun ağaçların tacı gövde dibinden ~260 piksel yukarı uzanır. Bu yüzden
    // yürünen bandın ALTINA yalnızca alçak ağaç dikilir; uzunlar hep üstte.
    const tallSize = () => (rand() < 0.45 ? 'huge' : 'tall');
    const lowSize = () => (rand() < 0.6 ? 'small' : 'mid');

    // Ağaç duvarı: şehirle ormanı ayıran sık kuşak (boşluk açık kalır)
    let wall = 0;
    for (let attempt = 0; attempt < 400 && wall < 18; attempt++) {
        const x = GAP.x0 - 50 + rand() * 200;
        const y = 70 + rand() * (GAP.top - 86);
        if (place(x, y, tallSize(), Math.floor(rand() * 4))) wall++;
    }
    for (let attempt = 0; attempt < 200 && wall < 28; attempt++) {
        const x = GAP.x0 - 50 + rand() * 200;
        const y = GAP.bottom + 70 + rand() * (WORLD.h - GAP.bottom - 86);
        if (place(x, y, lowSize(), Math.floor(rand() * 4))) wall++;
    }

    // Boşluğun iki yanına alçak ağaçlar: geçidin nerede olduğu gözle de
    // anlaşılsın, oyuncu görünmez duvara toslamasın. Bunlar boşluğa yakın
    // durduğu için pay bırakmadan, yalnızca dipleri kontrol edilerek dikilir.
    for (const [gx, gy] of [[912, 288], [958, 284], [1002, 288], [912, 440], [958, 444], [1002, 440]]) {
        const tree = { x: gx, y: gy, size: 'small', variant: (gx + gy) % 4 };
        const base = treeBase(tree);
        const solid = !walkableAt(base.x, base.y) && !walkableAt(base.x + base.w, base.y + base.h);
        if (solid) trees.push(tree);
    }

    // Koridorun üstü: yüksek ağaçlar ekranın üst yarısını doldurur
    let above = 0;
    for (let attempt = 0; attempt < 1400 && above < 88; attempt++) {
        const x = FOREST.x0 + rand() * (FOREST.x1 - FOREST.x0);
        const corridor = corridorAt(x);
        const y = 50 + rand() * (corridor.top - 66);
        if (place(x, y, tallSize(), Math.floor(rand() * 4))) above++;
    }

    // Koridorun altı: alçak bitki örtüsü, patikanın önünde çerçeve gibi durur.
    // Yola fazla yaklaşırsa antrenörü örtüyor, bu yüzden hem uzakta hem kısa.
    let below = 0;
    for (let attempt = 0; attempt < 900 && below < 32; attempt++) {
        const x = FOREST.x0 + rand() * (FOREST.x1 - FOREST.x0);
        const corridor = corridorAt(x);
        const y = corridor.bottom + 78 + rand() * Math.max(0, WORLD.h - corridor.bottom - 94);
        if (place(x, y, 'small', Math.floor(rand() * 4))) below++;
    }

    // Şehir tarafındaki park kenarında birkaç sokak ağacı
    let street = 0;
    for (let attempt = 0; attempt < 200 && street < 7; attempt++) {
        const x = 60 + rand() * (CITY.x1 - 160);
        const y = WORLD.h - 30 + rand() * 20;
        if (place(x, y, lowSize(), Math.floor(rand() * 4))) street++;
    }

    trees.sort((a, b) => a.y - b.y);
    return trees;
}

export const TREES = buildTrees();
