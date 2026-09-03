// Üç virüsün dövüş hamleleri. Burada YALNIZCA VERİ var - çizim ve fizik
// başka dosyalarda, çünkü bu tablo tarayıcısız test ediliyor
// (tests/data.test.mjs) ve ekrandaki kombo kümesi de buradan besleniyor.
//
// Her dövüşçünün üç kendi hamlesi var:
//   basic     - normal saldırı  (KARE / oyuncunun saldırı tuşu)
//   special   - özel saldırı    (DAİRE / özel tuşu)
//   signature - L1+ÜÇGEN ile çıkan, yalnızca o karakterde olan hamle
// Bunların yanında ÜÇÜ DE AYNI olan üç atılma var (DASHES): L1+ÇARPI yukarı,
// L1+KARE sola, L1+DAİRE sağa.
//
// Ekranın altındaki kümede dört daire duruyor: üç atılma + signature. Blok ve
// özel kombosuz oldukları için orada değil, can barının altında.
//
// Bekleme süreleri KARE cinsinden (60 kare = 1 saniye).

// Üç atılma da her karakterde aynı. Normal zıplamanın işlevsiz kalmaması için
// bekleme süresi var: atılma büyük, zıplama bedava.
export const DASHES = [
    {
        id: 'dashUp',
        name: 'YUKARI ATILMA',
        kind: 'dash',
        icon: 'dashUp',
        padCombo: ['l1', 'cross'],
        keySlot: 'up',
        cooldown: 90,
        velocity: { x: 0, y: -21 }
    },
    {
        id: 'dashLeft',
        name: 'SOLA ATILMA',
        kind: 'dash',
        icon: 'dashLeft',
        padCombo: ['l1', 'square'],
        keySlot: 'left',
        cooldown: 90,
        velocity: { x: -26, y: -5 }
    },
    {
        id: 'dashRight',
        name: 'SAĞA ATILMA',
        kind: 'dash',
        icon: 'dashRight',
        padCombo: ['l1', 'circle'],
        keySlot: 'right',
        cooldown: 90,
        velocity: { x: 26, y: -5 }
    }
];

export const ABILITIES = {
    // ---- VİRÜS: tek yakın dövüşçü ----
    // İkisi de menzilli olduğu için virüsün bütün derdi mesafeyi kapatmak:
    // normal saldırısı onu ileri atıyor, özeli de kendi yerine küçük
    // virüsleri yolluyor.
    virus: {
        basic: {
            id: 'punch',
            name: 'SAVURMA',
            kind: 'melee',
            icon: 'punch',
            cooldown: 42,
            damage: 18,
            // Yumruk atarken karakter ileri atılıyor: ağır olduğu için
            // yürüyerek yetişemediği mesafeyi böyle kapatıyor.
            lunge: 34,
            reach: 86,
            startup: 8,
            active: 8,
            recovery: 16
        },
        special: {
            id: 'split',
            name: 'BÖLÜNME',
            kind: 'split',
            icon: 'split',
            cooldown: 600,
            // Kütle dörde ayrılıyor; parçalar rakibe yürüyüp yakından
            // ısırıyor. Menzilli karaktere karşı virüsün tek cevabı bu.
            pieces: 4,
            pieceLife: 420,
            pieceSpeed: 3.4,
            biteDamage: 5,
            biteInterval: 36,
            biteRange: 54
        },
        signature: {
            id: 'trail',
            name: 'SALGIN İZİ',
            kind: 'trail',
            icon: 'trail',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            cooldown: 300,
            // Yere yapışkan bir birikinti bırakıyor: üstünden geçen yavaşlar.
            // Hasar vermiyor, alan tutuyor.
            life: 480,
            width: 120,
            slow: 0.55
        }
    },

    // ---- ANTİ-VİRÜS: hızlı, ince, menzilli ----
    antivirus: {
        basic: {
            id: 'blob',
            name: 'ANTİ TOP',
            kind: 'shot',
            icon: 'blob',
            cooldown: 20,
            // Top küçük ve biçimsiz ama hızlı. Menzilli olduğu için tek
            // vuruşu az: basınç kuruyor, tek hamlede bitirmiyor.
            damage: 7,
            speed: 13,
            radius: 7,
            life: 90
        },
        special: {
            id: 'burst',
            name: 'SAÇILMA',
            kind: 'burst',
            icon: 'burst',
            cooldown: 480,
            // Her yöne eşit açılarla top. İsabet garantisi YOK: toplar
            // uzaklaştıkça araları açılıyor, uzaktaki rakip boşluktan geçiyor.
            // Bu ayrı bir kural değil, eşit açının kendiliğinden sonucu.
            count: 16,
            damage: 6,
            speed: 9,
            radius: 7,
            life: 110
        },
        signature: {
            id: 'grab',
            name: 'ENFEKTE KOL',
            kind: 'grab',
            icon: 'grab',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            // IŞKALARSA BEKLEME YOK: kol boşa gittiyse hemen tekrar atılabilir.
            // Bedeli yakalayınca ödeniyor.
            cooldown: 0,
            cooldownOnHit: 240,
            reach: 320,
            speed: 16,
            // Yakalanan aşamalı ve küçük hasar alıyor; kurtulmak için kendi
            // saldırı tuşuna ÇOK basmak gerekiyor. Hangi tuş olduğu ekranda
            // yazıyor - yakalanan oyuncunun KENDİ cihazına göre.
            tickDamage: 2,
            tickInterval: 20,
            escapePresses: 12,
            maxHold: 240
        }
    },

    // ---- ELECTRO-VİRÜS: alan tutan ----
    electro: {
        basic: {
            id: 'beam',
            name: 'IŞIN',
            kind: 'beam',
            icon: 'beam',
            cooldown: 100,
            // Antinin topundan az vuruyor ama ARENADA KALIYOR: bir kez
            // çizildikten sonra sönmesi zaman alıyor, o hat boyunca durmak
            // hasar demek. "Az vurur, etkisi kalır."
            damage: 3,
            tickInterval: 30,
            life: 180,
            thickness: 20
        },
        special: {
            id: 'orb',
            name: 'ELEKTRİK KÜRESİ',
            kind: 'orb',
            icon: 'orb',
            cooldown: 720,
            // Küre arenanın TAM ORTASINA kuruluyor (yatayda da dikeyde de).
            // Oradan üç kez, üç saniye arayla beyaz kütle yolluyor.
            volleys: 3,
            volleyInterval: 180,
            life: 3 * 180 + 60,
            // Kütleler BÜYÜK ve YAVAŞ: kaçılabilir ama arenayı daraltır.
            massDamage: 15,
            massSpeed: 2.4,
            massRadius: 34,
            massLife: 300
        },
        signature: {
            id: 'blink',
            name: 'IŞINLANMA',
            kind: 'blink',
            icon: 'blink',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            cooldown: 240,
            // Arenada rastgele bir yere. Nereye düşeceği belli değil - kaçış
            // da olabilir, rakibin kucağına düşmek de.
            margin: 90
        }
    }
};

// Bir dövüşçünün bütün hamleleri, bekleme sayaçlarının kurulacağı sırayla.
export function abilitiesOf(fighterId) {
    const set = ABILITIES[fighterId];
    if (!set) return [];
    return [set.basic, set.special, set.signature, ...DASHES];
}

export function abilityOf(fighterId, slot) {
    return ABILITIES[fighterId]?.[slot] || null;
}

// Ekranın altındaki kümede duran dört daire: üç atılma + karakterin kendi
// hamlesi. Sıra çizimdeki sıra - soldan sağa.
export function comboAbilities(fighterId) {
    const set = ABILITIES[fighterId];
    if (!set) return [];
    return [DASHES[1], DASHES[0], DASHES[2], set.signature];
}
