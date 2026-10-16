// Araba sahnesinin verisi (DOM/canvas yok): sayılar, replikler ve yol dizilimi.
// Akışı DriveScene.js yürütüyor; veri testi bu dosyayı tarayıcısız doğruluyor.

export const DRIVE = {
    health: 3,            // çarpışma hakkı; bitince yol baştan
    speed: 6.5,           // kare başına yol birimi
    steerSpeed: 0.036,    // kare başına şerit değiştirme
    maxLat: 0.9,
    carHalf: 0.2,         // arabanın yarı genişliği (şerit birimi)
    hitFront: 22,         // çarpışma penceresi (z)
    hitBack: 16,
    sceneSpacing: 150,    // yol kenarı nesnelerin aralığı
    forestZone: 2400      // yolun son bölümü orman
};

export const DRIVE_TEXT = {
    objective: 'ENGELLERDEN KAÇ VE ORMANA ULAŞ',
    hintKeys: 'A D / OKLAR ARABAYI YÖNLENDİRİR',
    hintPad: 'SOL ÇUBUK ARABAYI YÖNLENDİRİR',
    crashed: 'ARABA PARÇALANDI. TEKRAR DENE.',
    skipKeys: 'K: ARABAYI ATLA',
    skipPad: 'KARE: ARABAYI ATLA'
};

export const DRIVE_LINES = {
    shelter: [
        { speaker: 'saglikli-0', text: 'Şehirde gizli bir sığınak var. Biz oraya gidiyoruz.' },
        { speaker: 'saglikli-1', text: 'Orada bizim gibi başka sağlıklı insanlar da var.' },
        { speaker: 'saglikli-2', text: 'Kendinize dikkat edin.' },
        { speaker: 'biz', text: 'Siz gidin. Fred ile ben ormana gidiyoruz.' },
        { speaker: 'arkadas', text: 'Umarım yolumuz yeniden kesişir.' }
    ]
};

// Yolun uzunluğu ve engel dizilimi. Deterministik: her satırda 1-2 engel,
// en az bir şerit hep boş kalır.
const LANES = [-0.66, 0, 0.66];
const KINDS = [
    { kind: 'car', half: 0.26 },
    { kind: 'rubble', half: 0.22 },
    { kind: 'infected', half: 0.1 }
];

function rnd(i, salt) {
    const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
    return v - Math.floor(v);
}

export function buildCourse() {
    const length = 15000;
    const obstacles = [];
    let d = 1100;
    let row = 0;
    while (d < length - 900) {
        const free = Math.floor(rnd(row, 1) * 3);
        const count = rnd(row, 2) > 0.55 ? 2 : 1;
        const lanes = [0, 1, 2].filter(l => l !== free);
        const picked = count === 2 ? lanes : [lanes[Math.floor(rnd(row, 3) * lanes.length)]];
        picked.forEach((lane, k) => {
            const kindDef = KINDS[Math.floor(rnd(row + k, 4) * KINDS.length)];
            // Yayalar şeridin ortasında değil, biraz kayık durur
            const offset = kindDef.kind === 'infected' ? (rnd(row, 5) - 0.5) * 0.3 : (rnd(row, 6) - 0.5) * 0.12;
            obstacles.push({
                d, lat: LANES[lane] + offset, ...kindDef,
                variant: Math.floor(rnd(row + k, 7) * 10)
            });
        });
        d += 330 - Math.min(110, row * 3);
        row++;
    }
    return { length, obstacles };
}
