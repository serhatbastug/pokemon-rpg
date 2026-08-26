// Prolog 3 ile 4 arasındaki geçiş: KANALİZASYON.
//
// Rögardan indik, şehrin kenarındaki çıkışa kadar koşuyoruz. Bu bölüm
// prologun tek otomatik koşu parçası: karakter kendi kendine ilerliyor,
// oyuncunun işi ŞERİT seçmek, ZIPLAMAK ve KAYMAK. Geri gitmek yok - tuş da
// analog da geriye çekilince hiçbir şey olmuyor.
//
// Kamera arkadan bakıyor: önümüzde beş sağlıklı koşuyor ve engelleri bizden
// önce onlar geçiyor. İzledikleri yol bir sonraki engeli önceden okutuyor;
// hikâyede de sıra bu - "kanalizasyondaki yoğun maruziyet" onların süresini
// burada bitiriyor (prolog 4'te ormanın ağzında hepsi dönüyor).
//
// Burada DOM/canvas yok - sadece sayılar ve saf fonksiyonlar
// (tests/data.test.mjs parkurun çözülebilirliğini buradan tarıyor).
//
//   z = ileri uzaklık (dünya birimi). Oyuncu sabit z'de durur, dünya akar.
//
//   ekran                         tünel kesiti
//   +--------------------+        tavan   ^ CEIL_H
//   |       tavan        |                |
//   |   ışık     ışık    |        göz     + EYE (kamera yüksekliği)
//   |   [0]  [1]  [2]    |                |
//   +----- zemin --------+        zemin   0
//        şeritler                -HW <- 0 -> +HW

export const VIEW = { w: 1000, h: 560 };

// --- Perspektif ---
// Kaçış noktası ekranın ortasında, ufuk çizgisi hafif aşağıda: yukarıdan
// bakan bir kamera tüneli ferah gösteriyor, oysa burası BASIK olmalı.
export const CX = VIEW.w / 2;
export const HORIZON = 262;
export const FOCAL = 700;        // büyüdükçe koridor uzun ve yassı görünür
export const EYE = 300;          // kameranın zeminden yüksekliği
export const CEIL_H = 396;       // tavan yüksekliği (göz hizasına yakın = basık)
export const TUNNEL_HW = 262;    // tünelin yarı genişliği

export const DRAW_Z = 2600;      // bu uzaklıktan ötesi sisin içinde
export const RING = 110;         // duvar/zemin bandı: ilerleme hissi bundan

// --- Şeritler ---
// Üç şerit. "Ortada kal" diye bir kural yok: her şerit eşit, hangisi boşsa
// oraya geçiliyor.
export const LANE_GAP = 160;
export const LANES = [-LANE_GAP, 0, LANE_GAP];
export const LANE_COUNT = LANES.length;
export const LANE_CHANGE_FRAMES = 10;   // bir tam şerit bu kadar karede geçilir

// --- Koşu ---
export const PLAYER_Z = 90;      // oyuncunun kameradan uzaklığı
export const BASE_SPEED = 7.0;
export const MAX_SPEED = 8.6;
export const SPEED_RAMP = 0.00016;   // kat edilen yola göre hafif hızlanma
export const STUMBLE_FRAMES = 26;    // çarpınca tökezleme

export function speedAt(travelled) {
    return Math.min(MAX_SPEED, BASE_SPEED + travelled * SPEED_RAMP);
}

// --- Zıplama ve kayma ---
// Zıplama yayı: 50 kare havada, tepe ~125 birim. Taş yığınını (52) rahat
// aşıyor ama alçak boruyu (66'dan başlıyor) aşmıyor - orada KAYMAK gerek.
//
// Yay bilerek uzun: engel z boyunca da yer kapladığı için çarpışma penceresi
// ~19 kare sürüyor. Kısa bir yay bunu ucu ucuna örtüyor ve iniş anında
// engelin arka kenarına değiliyordu.
export const JUMP_V = 10.0;
export const GRAVITY = 0.40;
export const SLIDE_FRAMES = 34;

export const BODY_H = 110;       // ayakta gövde yüksekliği
export const SLIDE_H = 42;       // kayarken
export const PLAYER_HW = 46;     // yanal yarı genişlik

// --- Engeller ---
// Hiçbiri atletizm engeli değil: hepsi kanalizasyonun kendi enkazı.
//   low/high : engelin kapladığı yükseklik aralığı
//   hw       : yanal yarı genişlik
//   depth    : z boyunca kapladığı derinlik
//   clear    : 'zipla' | 'kay' | null (null = yalnızca şerit değiştirilir)
export const OBSTACLES = {
    // Tavandan dökülmüş taş ve moloz yığını
    tas:   { low: 0,  high: 52,  hw: 78, depth: 70, clear: 'zipla' },
    // Patlamış, sarkan boru: altından geçilir
    boru:  { low: 66, high: 260, hw: 92, depth: 54, clear: 'kay' },
    // Çökmüş tavan bloğu: şerit boydan boya kapalı
    enkaz: { low: 0,  high: 260, hw: 86, depth: 76, clear: null },
    // Taşan lağım birikintisi ve kırık ızgara
    su:    { low: 0,  high: 34,  hw: 84, depth: 96, clear: 'zipla' }
};

export const OBSTACLE_TYPES = Object.keys(OBSTACLES);

// --- Parkur ---
// Elle yazıldı. Sıra öğretiyor: önce tek taş (zıpla), sonra tek boru (kay),
// sonra tek çöküntü (şerit). Ondan sonrası karışım. Aynı z'deki engeller bir
// SIRA oluşturuyor; her sırada geçilebilir en az bir şerit bırakmak zorunlu
// (test bunu tarıyor).
export const COURSE = [
    { z: 1350, lane: 1, type: 'tas' },                                  // ZIPLA
    { z: 1950, lane: 1, type: 'boru' },                                 // KAY
    { z: 2560, lane: 1, type: 'enkaz' },                                // ŞERİT

    { z: 3120, lane: 0, type: 'tas' },   { z: 3120, lane: 2, type: 'tas' },
    { z: 3700, lane: 1, type: 'boru' },  { z: 3700, lane: 2, type: 'boru' },
    { z: 4280, lane: 0, type: 'enkaz' }, { z: 4280, lane: 2, type: 'enkaz' },
    { z: 4840, lane: 2, type: 'su' },
    { z: 5400, lane: 0, type: 'tas' },   { z: 5400, lane: 1, type: 'boru' },
    { z: 5980, lane: 1, type: 'enkaz' }, { z: 5980, lane: 2, type: 'tas' },
    { z: 6540, lane: 0, type: 'boru' },
    { z: 7100, lane: 0, type: 'tas' },   { z: 7100, lane: 2, type: 'enkaz' },
    { z: 7660, lane: 1, type: 'su' },
    { z: 8220, lane: 0, type: 'enkaz' }, { z: 8220, lane: 2, type: 'enkaz' },
    { z: 8780, lane: 1, type: 'boru' },
    // Üçü de kapalı ama üçü de zıplanabilir: bölümün en yüklü anı
    { z: 9340, lane: 0, type: 'tas' },   { z: 9340, lane: 1, type: 'su' },
    { z: 9340, lane: 2, type: 'tas' },
    { z: 9920, lane: 0, type: 'boru' },  { z: 9920, lane: 1, type: 'enkaz' },
    { z: 10480, lane: 2, type: 'boru' }
];

// Çıkış bacası: son engelden sonra tünel burada bitiyor, merdivenle şehrin
// kenarına çıkılıyor (prolog 4 oradan başlıyor).
export const EXIT_Z = 11400;

// Tavandaki ızgaralar: tek ışık kaynağı. Aralarında karanlık uzuyor.
export const LIGHT_SPACING = 620;
export const FIRST_LIGHT = 420;

// Öğretme bu kadar önceden çıkar (birim). ~85 kare: okumaya da tepki
// vermeye de yetiyor.
export const HINT_LEAD = 640;

// --- Perspektif dönüşümleri ---
// scale: z'deki bir şeyin ekran ölçeği. z = 0'da 1, uzaklaştıkça küçülür.
export function scaleAt(z) {
    return FOCAL / (FOCAL + z);
}

// Ekran ölçeğinden z'ye dönüş (satır/sütun tarayan çizim bunu kullanıyor)
export function zAtScale(scale) {
    return FOCAL * (1 - scale) / scale;
}

export function groundY(z) {
    return HORIZON + EYE * scaleAt(z);
}

export function ceilingY(z) {
    return HORIZON - (CEIL_H - EYE) * scaleAt(z);
}

export function screenX(worldX, z) {
    return CX + worldX * scaleAt(z);
}

export function laneX(lane) {
    return LANES[Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane)))];
}

// --- Çarpışma ---
// Gövdenin dikey aralığı: duruşa ve zıplama yüksekliğine göre.
export function bodySpan(pose, height) {
    const low = Math.max(0, height);
    return { low, high: low + (pose === 'kay' ? SLIDE_H : BODY_H) };
}

// Bir engel bu gövdeyi durdurur mu? (yalnızca yükseklik; şerit ve z ayrı)
export function blocksBody(type, pose, height) {
    const box = OBSTACLES[type];
    if (!box) return false;
    const body = bodySpan(pose, height);
    return body.low < box.high && body.high > box.low;
}

// Engel bu karede oyuncuya değiyor mu?
//   rel : engelin oyuncuya göre z uzaklığı (obs.z - travelled)
//   x   : oyuncunun yanal konumu (şerit arasındayken ara değer)
export function hits(obstacle, { rel, x, pose, height }) {
    const box = OBSTACLES[obstacle.type];
    if (!box) return false;
    if (rel > PLAYER_Z + 22) return false;              // henüz önümüzde
    if (rel + box.depth < PLAYER_Z - 22) return false;  // geride kaldı
    if (Math.abs(x - laneX(obstacle.lane)) >= PLAYER_HW + box.hw) return false;
    return blocksBody(obstacle.type, pose, height);
}

// --- Parkuru okuma ---
// Aynı z'de duran engeller bir sıra. Sıralar z'ye göre sıralı geliyor.
export function rows(course = COURSE) {
    const byZ = new Map();
    for (const obstacle of course) {
        if (!byZ.has(obstacle.z)) byZ.set(obstacle.z, []);
        byZ.get(obstacle.z).push(obstacle);
    }
    return [...byZ.entries()].sort((a, b) => a[0] - b[0])
        .map(([z, items]) => ({ z, items }));
}

// Bir sırada şeritte ne var?
export function obstacleInLane(row, lane) {
    return row.items.find(item => item.lane === lane) || null;
}

// Koşucunun bir sonraki sırada ne yapması gerektiği. Hem oyuncunun önündeki
// sağlıklılar hem de testin çözülebilirlik taraması bunu kullanıyor.
// Döner: 'zipla' | 'kay' | 'sol' | 'sag' | null
export function planFor(row, lane) {
    const here = obstacleInLane(row, lane);
    if (!here) return null;
    if (OBSTACLES[here.type].clear) return OBSTACLES[here.type].clear;

    // Şerit değiştirmek gerekiyor: geçilebilir en yakın şeride
    const options = [];
    for (let i = 0; i < LANE_COUNT; i++) {
        if (i === lane) continue;
        const other = obstacleInLane(row, i);
        if (other && !OBSTACLES[other.type].clear) continue;
        options.push(i);
    }
    if (!options.length) return null;
    options.sort((a, b) => {
        const busyA = obstacleInLane(row, a) ? 1 : 0;
        const busyB = obstacleInLane(row, b) ? 1 : 0;
        if (busyA !== busyB) return busyA - busyB;             // boş şerit yeğ
        return Math.abs(a - lane) - Math.abs(b - lane);
    });
    return options[0] < lane ? 'sol' : 'sag';
}

// Bu şeritteki koşucu tek hamleyle kurtulabiliyor mu? Şeridin kendisi
// zıplanabilir/kayılabilirse evet; değilse bitişik şeritlerden biri
// geçilebilir olmak zorunda. Üç şeritte iki geçilmez engel varsa boş şerit
// ORTADA olmalı - test bunu tarıyor.
export function laneHasEscape(row, lane) {
    const here = obstacleInLane(row, lane);
    if (!here || OBSTACLES[here.type].clear) return true;
    for (const side of [lane - 1, lane + 1]) {
        if (side < 0 || side >= LANE_COUNT) continue;
        const other = obstacleInLane(row, side);
        if (!other || OBSTACLES[other.type].clear) return true;
    }
    return false;
}

// Sıra hiç geçilemiyor mu? (parkur testi bunu arıyor)
export function rowIsPassable(row) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
        const item = obstacleInLane(row, lane);
        if (!item || OBSTACLES[item.type].clear) return true;
    }
    return false;
}

// Şeridi bir adım değiştirmenin hedefi (sınırın dışına taşmaz)
export function laneAfter(lane, move) {
    if (move === 'sol') return Math.max(0, lane - 1);
    if (move === 'sag') return Math.min(LANE_COUNT - 1, lane + 1);
    return lane;
}

// --- Koşucunun hali ---
// Oyuncu da öndeki beş sağlıklı da aynı gövdeyi kullanıyor.
export function newRunner(lane) {
    const x = laneX(lane);
    return {
        lane, x, fromX: x, toX: x, laneT: 1,
        height: 0, vy: 0, pose: 'kosu', slideLeft: 0
    };
}

export function beginLaneChange(person, lane) {
    person.fromX = person.x;
    person.toX = laneX(lane);
    person.laneT = 0;
    person.lane = lane;
}

export function beginJump(person) {
    if (person.height > 0) return false;      // havada ikinci zıplama yok
    person.vy = JUMP_V;
    person.pose = 'zipla';
    person.slideLeft = 0;
    return true;
}

export function beginSlide(person) {
    person.slideLeft = SLIDE_FRAMES;
    person.pose = 'kay';
    // Havadayken kayma tuşu yere çeker: inişi beklemek zorunda kalmak
    // borunun altına girmeyi imkânsız kılıyordu.
    if (person.height > 0) person.vy = Math.min(person.vy, -JUMP_V * 0.8);
    return true;
}

// Bir karelik gövde hareketi: şerit geçişi, zıplama yayı ve kayma sayacı.
// Saf sayı - testler parkuru bununla oynuyor.
export function stepPerson(person) {
    if (person.laneT < 1) {
        person.laneT = Math.min(1, person.laneT + 1 / LANE_CHANGE_FRAMES);
        person.x = person.fromX + (person.toX - person.fromX) * person.laneT;
    } else {
        person.x = person.toX;
    }

    if (person.height > 0 || person.vy !== 0) {
        person.height += person.vy;
        person.vy -= GRAVITY;
        if (person.height <= 0) {
            person.height = 0;
            person.vy = 0;
            if (person.slideLeft <= 0) person.pose = 'kosu';
        }
    }

    if (person.slideLeft > 0) {
        person.slideLeft--;
        person.pose = person.height > 0 ? 'zipla' : 'kay';
        if (person.slideLeft === 0 && person.height <= 0) person.pose = 'kosu';
    } else if (person.height > 0) {
        person.pose = 'zipla';
    } else {
        person.pose = 'kosu';
    }
}

// Hamleler engelden ne kadar önce başlatılıyor (dünya birimi). Zıplama en
// erken: 42 karelik yayın tepesi engelin üstüne denk gelmeli. Hem öndeki
// sağlıklılar hem de testin ideal oyuncusu bu mesafeleri kullanıyor.
export const ACT_LEAD = { zipla: 190, kay: 128, sol: 260, sag: 260 };

// Bir hamleyi gövdeye uygula
export function applyMove(person, move) {
    if (move === 'zipla') return beginJump(person);
    if (move === 'kay') return beginSlide(person);
    if (move === 'sol' || move === 'sag') {
        const target = laneAfter(person.lane, move);
        if (target === person.lane) return false;
        beginLaneChange(person, target);
        return true;
    }
    return false;
}
