// Prolog 3. bölüm: ÇALIŞMA ALANI KUŞATILIYOR.
//
// AVLU İÇERİSİDİR. Diğer sağlıklılarla burada çalışıyoruz. Virüslüler bizi
// bulur; sağlıklıları üstteki ACİL ÇIKIŞ kapısından geçiririz. Sorumlu
// olduğumuz için en son biz ve arkadaşımız kalırız. Biz geçeriz; arkadaşımız
// kapının yanındaki kolu çekmek için geri hamle yapar. Tam o sırada
// virüslüler içeri girer, sistem bunu algılayıp acil çıkışı kapatır ve
// ekran yavaşça kararır.
//
// OYUNCU HİÇBİR ŞEYİ GÖRMEZ: ne ısırılmayı, ne dönüşümü, ne kolun çekilip
// çekilmediğini. Belirsizlik bilerek bırakılıyor.
//
// Kol tesisi tamamen mühürler. Tesis zaten virüslülerin kaçamayacağı şekilde
// tasarlandı; kolun çekilip çekilmediği bu yüzden şehrin kaderini belirliyor.
//
// Burada DOM/canvas yok - sadece sayılar (tests/data.test.mjs bunu kullanıyor).
//
//   0 -------------------------------------------------- 1000
//   |  CEPHE      [ ACIL CIKIS ] [KOL]                     |  0..170
//   |------------------------------------------------------|
//   |  jenerator                              [ KULE ]     |
//   |  BETON AVLU  (sagliklilar burada calisiyor)          |  170..450
//   |======== TEL ORGU ====[ YARIK ]==== TEL ORGU =========|  450..480
//   |  >>>>>>>>> VIRUSLULER <<<<<<<<<<                     |  480..560

import { PX } from '../pixel/pixelDraw.js';

export { PX };

export const WORLD = { w: 1000, h: 560 };
export const VIEW = { w: 1000, h: 560 };

export const PLAYER_BOX = { w: 28, h: 16 };
export const PLAYER_SPEED = 3.2;
export const PLAYER_SCALE = 4;

export const LOCATION_NAME = 'ÇALIŞMA ALANI';

// --- Şeritler ---
export const FACADE = { y: 0, h: 170 };
export const YARD = { top: 170, bottom: 450 };
export const FENCE = { y: 450, h: 30 };
export const CROWD = { y: 480, h: 80 };

// --- Acil çıkış ---
// Kapı sahnenin başında açıktır; sistem virüslüleri algılayınca iner.
export const STEEL_DOOR = { x: 440, y: 96, w: 120, h: 74 };
// Kapının önündeki durma noktası: geçmek için buraya gelinir
export const DOOR_STAND = { x: STEEL_DOOR.x + STEEL_DOOR.w / 2, y: 192 };
export const DOOR_REACH = 34;

export function atDoor(x, y) {
    return Math.hypot(x - DOOR_STAND.x, y - DOOR_STAND.y) <= DOOR_REACH;
}

// --- Tesisi mühürleyen kol ---
// Kapının hemen sağında, cephe duvarına monte. Arkadaşımız buraya koşuyor.
export const LEVER = { x: 604, y: 128, w: 36, h: 46 };
export const LEVER_STAND = { x: LEVER.x + LEVER.w / 2, y: 198 };

// Arkadaşımızın geri hamlesi. Kapıdan kola düz bir çizgi çok kısa: bir
// saniyede varıyor ve "kararma anında kola doğru gittiğini görüyoruz" olmuyor.
// Bu yüzden avluya iniyor, içeri dolanların arasından dolanıp kola çıkıyor.
export const FRIEND_RETURN_PATH = [
    { x: 566, y: 272 },
    { x: 720, y: 276 },
    { x: 720, y: 200 },   // sandığın sağından dolaşıyor
    LEVER_STAND
];

// --- Sabit nesneler ---
export const GENERATOR = { x: 86, y: 244, w: 104, h: 68 };
export const TOWER = { x: 826, y: 176, w: 104, h: 108 };
// Anten direği: yalnızca dekor, artık devrilmiyor (ayıran şey kapının kendisi)
export const PYLON = { x: 244, y: 176, w: 40, h: 52 };

export const CRATES = [
    { x: 300, y: 196, w: 56, h: 40 },
    { x: 646, y: 214, w: 48, h: 36 },
    { x: 232, y: 330, w: 52, h: 38 },
    { x: 590, y: 366, w: 60, h: 34 }
];

// Tel örgünün yarıldığı yer: virüslüler buradan giriyor. Kapı ve kol SAĞDA
// olduğu için yarık SOLDA: yoksa içeri girenler doğrudan kolun dibine
// yığılıyor ve kararma sırasında arkadaşımızı görmemiz imkânsızlaşıyor.
export const BREACH = { x: 180, w: 130 };
export const BREACH_CENTER = BREACH.x + BREACH.w / 2;

// --- Sağlıklılar ---
// Bizim hariç TAM BEŞ kişi. Bu sayı prolog 4'te de tutmak zorunda: ormanın
// ağzında yeşillenip vurulacak olanlar bunlar.
export const SURVIVOR_COUNT = 5;

export const SURVIVOR_STARTS = [
    { x: 238, y: 296 },
    { x: 356, y: 392 },
    { x: 700, y: 304 },
    { x: 780, y: 386 },
    { x: 176, y: 214 }
];

// Kapının önünde sıraya girdikleri nokta; tek tek buradan geçiyorlar
export const QUEUE_POINT = { x: DOOR_STAND.x, y: 236 };

// Sağlıklıların kapıya giderken izlediği yol. ELLE yazıldı: bu insanlarda yol
// bulma yok, hedefe düz gidiyorlar; jeneratörle anten direği arasında kalan
// kişi yolu kendi bulamıyordu. Test her ara noktayı ve aradaki her adımı
// yürünebilirlik açısından tarıyor.
//
// Ortak koridor y=290: jeneratörün (y<312 ama x<190) sağında ve sandıkların
// arasında kalan tek boydan boya açık şerit.
export const SURVIVOR_PATHS = [
    [{ x: 238, y: 290 }, { x: 500, y: 290 }, QUEUE_POINT],
    [{ x: 356, y: 290 }, { x: 500, y: 290 }, QUEUE_POINT],
    [{ x: 700, y: 290 }, { x: 500, y: 290 }, QUEUE_POINT],
    [{ x: 780, y: 290 }, { x: 500, y: 290 }, QUEUE_POINT],
    // Jeneratörün üstünde sıkışan kişi: önce sağa çıkıyor, sonra iniyor
    [{ x: 214, y: 214 }, { x: 214, y: 290 }, { x: 500, y: 290 }, QUEUE_POINT]
];

const STATIC_OBSTACLES = [GENERATOR, TOWER, PYLON, ...CRATES];

function inBox(box, x, y) {
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function walkableAt(x, y) {
    if (x < 16 || x > WORLD.w - 16) return false;
    if (y < YARD.top || y > YARD.bottom) return false;
    return !STATIC_OBSTACLES.some(box => inBox(box, x, y));
}

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

// --- Silah ---
// Parçalayıcı silah virüsü ÖLDÜRMEZ, etrafa dağıtır. Vurulan virüslü çöker
// ama yere kalıcı bir yeşil leke bırakır: ateş ettikçe avlu daha da kirlenir.
export const BULLET_SPEED = 9;
export const BULLET_LIFE = 70;        // kare
export const FIRE_COOLDOWN = 12;      // kare
export const INFECTED_SPEED = 0.9;    // konaksız hal yavaştır
export const INFECTED_RADIUS = 16;
