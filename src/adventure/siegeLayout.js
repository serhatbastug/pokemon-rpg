// Prolog 3. bölüm: ÇALIŞMA ALANI KUŞATILIYOR.
//
// Kapalı bir araştırma binasının beton avlusu. Yukarıda bina cephesi ve çelik
// kapı, aşağıda tel örgü; örgünün ardında virüslüler birikiyor. Arkadaş acil
// durum kolunu çekmek için avlunun soluna koşar, oyuncu peşinden gider ve tam
// yetişecekken kule direği aralarına devrilir. Kurtaramaz.
//
// Burada DOM/canvas yok - sadece sayılar (tests/data.test.mjs bunu kullanıyor).
//
//   0 -------------------------------------------------- 1000
//   |  ARASTIRMA BINASI CEPHESI        [ CELIK KAPI ]      |  0..170
//   |------------------------------------------------------|
//   |  jenerator                              [ KULE ]     |
//   |  BETON AVLU                                          |  170..450
//   |  [KOL]                          rogar (o)            |
//   |======== TEL ORGU ================ TEL ORGU ==========|  450..480
//   |  >>>>>>>>> VIRUSLULER <<<<<<<<<<                     |  480..560
//
// Sahne tek ekran: kamera kaymaz. Dönüşümün son anında ekran 2 kat
// yakınlaşır (tam sayı ölçek, piksel bozulmasın diye kesme geçişle).

import { PX } from '../pixel/pixelDraw.js';

export { PX };

export const WORLD = { w: 1000, h: 560 };
export const VIEW = { w: 1000, h: 560 };

export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.2;
export const PLAYER_SCALE = 4;

export const LOCATION_NAME = 'ÇALIŞMA ALANI';

// Oyuncu çelik kapıdan yeni çıkmış halde başlar; arkadaş yanındadır.
export const START = { x: 520, y: 210 };
export const FRIEND_START = { x: 466, y: 210 };

// --- Şeritler ---
export const FACADE = { y: 0, h: 170 };          // bina cephesi (tamamı engel)
export const YARD = { top: 170, bottom: 450 };   // yürünebilir beton avlu
export const FENCE = { y: 450, h: 30 };          // tel örgü (engel)
export const CROWD = { y: 480, h: 80 };          // örgünün ardındaki kalabalık

// --- Sabit nesneler ---
// Çelik kapı: sahnenin başında açık, kol çekilince iner. Cephe zaten engel
// olduğu için kapının kendisi çarpışmaya girmiyor; yalnızca çizim değişiyor.
export const STEEL_DOOR = { x: 440, y: 96, w: 120, h: 74 };

export const GENERATOR = { x: 86, y: 244, w: 104, h: 68 };
export const TOWER = { x: 826, y: 176, w: 104, h: 108 };
export const LEVER = { x: 112, y: 372, w: 40, h: 46 };

// Anten direği: avlunun sol üstünde, kaidesi betona civatalı. Gövdesi cephenin
// üstüne kadar yükselir ve kuşatma sırasında DEVRİLİR - BEAM tam bunun düştüğü
// yer. (Sağdaki gözetleme kulesi dekor; oradan bir şey düşmüyor.)
export const PYLON = { x: 244, y: 176, w: 40, h: 52 };
export const MANHOLE = { x: 748, y: 386, w: 44, h: 32 };

// Avluya dağılmış sandık ve kum torbası yığınları
export const CRATES = [
    { x: 300, y: 196, w: 56, h: 40 },
    { x: 646, y: 214, w: 48, h: 36 },
    { x: 232, y: 330, w: 52, h: 38 },
    { x: 590, y: 366, w: 60, h: 34 }
];

// Tel örgünün yarıldığı yer: kalabalık buradan bastırıyor. Yürünebilir
// değil - oyuncu dışarı çıkamaz, yalnızca baskıyı görür.
export const BREACH = { x: 620, w: 130 };

// Kulenin devrilen direği: sahnenin ortasında düşer ve avlunun sol üçte
// birini kapatır. Düşene kadar engel DEĞİLDİR (bakınız beamDown).
export const BEAM = { x: 236, y: 178, w: 54, h: 268 };

// Rögar bu sahnede ENGEL DEĞİL: kapağı henüz kapalı ve sahnenin çıkışı orası,
// oyuncunun üstüne basabilmesi gerekiyor. (Şehir sahnesindeki rögar açık
// olduğu için engeldi - aynı nesne, farklı hâl.)
const STATIC_OBSTACLES = [GENERATOR, TOWER, LEVER, PYLON, ...CRATES];

function inBox(box, x, y) {
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

// Sahnenin çarpışma mantığı. beamDown, direğin düşüp düşmediğini söyler:
// aynı yerleşim iki hâlde kullanılıyor, ayrı bir harita tutmaya gerek yok.
export function walkableAt(x, y, beamDown = false) {
    if (x < 16 || x > WORLD.w - 16) return false;
    if (y < YARD.top || y > YARD.bottom) return false;
    if (STATIC_OBSTACLES.some(box => inBox(box, x, y))) return false;
    if (beamDown && inBox(BEAM, x, y)) return false;
    return true;
}

export function blocked(x, y, beamDown = false) {
    const hw = PLAYER_BOX.w / 2;
    const hh = PLAYER_BOX.h / 2;
    const points = [
        [x - hw, y - hh], [x + hw, y - hh],
        [x - hw, y + hh], [x + hw, y + hh],
        [x, y - hh], [x, y + hh]
    ];
    return points.some(([px, py]) => !walkableAt(px, py, beamDown));
}

// Kolun önünde durulacak nokta: arkadaş buraya koşar
export const LEVER_STAND = { x: LEVER.x + LEVER.w + 26, y: LEVER.y + 10 };

// Direk düştükten sonra oyuncunun arkadaşa yaklaşabildiği en yakın nokta
// buranın sağında kalır. Sahne bu mesafeyi "yarı yarıya" anlatım için
// kullanıyor: yeşillenme buradan izleniyor, dönüşümde ekran yakınlaşıyor.
export const BLOCKED_STAND = { x: BEAM.x + BEAM.w + 20, y: 320 };

// Oyuncu arkadaşa "neredeyse yetişti" sayılır mı? Direk tam bu anda düşer.
export const REACH_DISTANCE = 96;

export function nearFriend(playerX, playerY, friendX, friendY) {
    return Math.hypot(playerX - friendX, playerY - friendY) <= REACH_DISTANCE;
}

// Rögarın üstünde mi? (sahnenin çıkışı)
export function onManhole(x, y) {
    const cx = MANHOLE.x + MANHOLE.w / 2;
    const cy = MANHOLE.y + MANHOLE.h / 2;
    return Math.hypot(x - cx, y - cy) < 40;
}
