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
//
// animFrames: hamlenin SALDIRI ANİMASYONU kaç kare sürüyor. Bekleme
// süresinden ayrı: animasyon biter ama hamle hâlâ beklemede olabilir.
// Duruşun ve uzuvun nasıl çizileceği fighterArt.js'teki POSES tablosunda.

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
        animFrames: 16,
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
        animFrames: 16,
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
        animFrames: 16,
        velocity: { x: 26, y: -5 }
    }
];

export const ABILITIES = {
    // ---- VİRÜS: tek yakın dövüşçü ----
    // İkisi de menzilli olduğu için virüsün bütün derdi mesafeyi kapatmak:
    // normal saldırısı onu ileri atıyor, özeli de kendi yerine küçük
    // virüsleri yolluyor.
    //
    // DENGE (2026-09-04, oynanarak): virüs fazla güçlü çıktı. Üç ayrı sebebi
    // vardı, üçü de ayrı ayrı düzeltildi:
    //   1) Hem en sert vuran hem en dayanıklıydı (18 hasar / 42 kare = saniyede
    //      25, üstüne 130 can). Vuruş seyreltildi, can 120'ye indi.
    //   2) Salgın izi beklemesinden UZUN yaşıyordu (480 > 300): arenada hep bir
    //      iz vardı, hatta ikisi birden. Artık yaşamı beklemesinin altında.
    //   3) Bölünme parçalarının ısırığı takeTickDamage ile gidiyor - bloğu da
    //      dokunulmazlık karelerini de deler. Kesintisiz olduğu için sayılar
    //      küçük tutulmalı.
    virus: {
        basic: {
            id: 'punch',
            name: 'SAVURMA',
            kind: 'melee',
            icon: 'punch',
            // Ağır saldırının bedeli beklemede: ıskalayan virüs açıkta kalmalı,
            // yoksa menzilliye yaklaşmanın hiçbir riski olmuyor. 32 karelik
            // animasyondan sonra 20 kare daha toparlanıyor.
            cooldown: 52,
            damage: 15,
            // Yumruk atarken karakter ileri atılıyor: ağır olduğu için
            // yürüyerek yetişemediği mesafeyi böyle kapatıyor.
            lunge: 34,
            reach: 120,
            startup: 8,
            active: 8,
            recovery: 16,
            animFrames: 32
        },
        special: {
            id: 'split',
            name: 'BÖLÜNME',
            kind: 'split',
            icon: 'split',
            cooldown: 660,
            // Kütle dörde ayrılıyor; parçalar rakibe yürüyüp yakından
            // ısırıyor. Menzilli karaktere karşı virüsün tek cevabı bu.
            // Isırık bloğu ve dokunulmazlığı DELİYOR (takeTickDamage): dört
            // parça yedi saniye boyunca 5'er vurunca tek başına bir can barını
            // götürüyordu. Süre ve sıklık kısıldı; parçalar hâlâ menzilliyi
            // yerinden kaldırıyor ama maçı tek başına bitirmiyor.
            pieces: 4,
            pieceLife: 300,
            pieceSpeed: 3.4,
            biteDamage: 4,
            biteInterval: 48,
            biteRange: 54,
            animFrames: 26
        },
        signature: {
            id: 'trail',
            name: 'SALGIN İZİ',
            kind: 'trail',
            icon: 'trail',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            // Bekleme İZDEN UZUN olmalı: tersi olduğunda iz hiç sönmüyor,
            // hatta üst üste iki iz birikiyordu - "alan tutmak" arenanın
            // tamamını tutmaya dönüşüyordu. Artık aralarda temiz zemin var.
            cooldown: 420,
            // Yere yapışkan bir birikinti bırakıyor: üstünden geçen yavaşlar.
            // Hasar vermiyor, alan tutuyor.
            life: 270,
            width: 120,
            slow: 0.55,
            animFrames: 22
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
            life: 90,
            animFrames: 14
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
            life: 110,
            animFrames: 24
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
            maxHold: 240,
            animFrames: 30
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
            thickness: 20,
            animFrames: 26
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
            massLife: 300,
            animFrames: 40
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
            margin: 90,
            animFrames: 14
        }
    },
    // ---- ICE-VİRÜS: kılıçlı, klonlu, donduran ----
    //
    // Kadronun ikinci yakın dövüşçüsü ama virüsün tersi: virüs kütlesiyle
    // vurur, buz KESER. Kimliği üç hamlenin üçünde de aynı: buz kendini
    // ÇOĞALTIR ve rakibi YERİNDE TUTAR.
    //
    // Eski hâlinde (2026-09-04) menzilli bir "üşütücü"ydü - kırık atıyor,
    // duvar dikiyor, ayaz yayıyordu. Kullanıcı hepsini beğenmedi ve karakteri
    // baştan tarif etti (2026-09-05): kılıç, klon, buz yolu.
    ice: {
        basic: {
            id: 'sword',
            name: 'BUZ KILICI',
            kind: 'melee',
            icon: 'sword',
            // Virüsün savurmasının yanında HAFİF ve HIZLI: virüs tek vuruşta
            // ağır, buz sık sık kesiyor. Sürekli hasarı yine de virüsünkinin
            // altında - buzun asıl kazancı klonla İKİ kılıç olması.
            cooldown: 38,
            damage: 10,
            // Kılıç saplanıyor, gövde çarpmıyor: virüsün 34'lük atılmasının
            // yanında buzunki yalnızca bir adım.
            lunge: 14,
            reach: 118,
            startup: 6,
            active: 7,
            recovery: 14,
            // Vuruş rakibi HAFİFÇE savuruyor. Ağır bir itiş değil - amacı
            // hasar değil, buzun kendine bir kılıç boyu yer açması.
            knockback: 11,
            animFrames: 26
        },
        special: {
            id: 'clone',
            name: 'KLON',
            kind: 'clone',
            icon: 'clone',
            // BEKLEME KLON YOK OLUNCA BAŞLIYOR (bkz. combat.spawnClone):
            // klon yaşarken sayaç sonsuz duruyor, öldüğü an buraya düşüyor.
            // Bu yüzden aynı anda iki klon olamaz - kuralın kendisi bu.
            cooldown: 300,
            // Klon GÖRSEL OLARAK AYNI: rakip hangisinin asıl olduğunu
            // vuruşundan anlıyor. Bu yüzden az vuruyor ve yalnızca normal
            // saldırı yapıyor - hile değil, ikilem.
            damage: 5,
            reach: 110,
            attackInterval: 60,
            speed: 3.4,
            hp: 34,
            // Kimse öldürmezse kendiliğinden dağılıyor: yoksa buz klonu
            // arenanın bir köşesinde saklayıp beklemeyi hiç başlatmazdı.
            life: 600,
            // Klon doğduğu an görünür şekilde AYRI durmalı: 80 pikselde iki
            // gövde üst üste binip tek bir geniş kütle gibi okunuyordu.
            spawnOffset: 130,
            animFrames: 30
        },
        signature: {
            id: 'path',
            name: 'BUZ YOLU',
            kind: 'path',
            icon: 'path',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            cooldown: 480,
            // Yol NORMAL HIZLA uzuyor: yürüyen bir oyuncu ondan kaçabilir,
            // duran oyuncu kaçamaz. Kaçırılabilir olması şart - ucu değdiği
            // yeri donduran bir hamle ışınlanma hızında olamaz.
            speed: 6,
            width: 26,
            // Arenanın tamamını (1280) geçmiyor: rakibi köşeye kadar
            // kovalayan bir yol kaçılamaz olurdu.
            maxLength: 880,
            // Rakip yüksekteyse yol onun sütununda YUKARI dönüyor; dikey
            // parça yataydan yavaş - tırmanmak zaman alır.
            climbSpeed: 4,
            // Dikey parçanın sınırı: arenanın en üst basamağını (250) aşıyor,
            // yani yukarı kaçmak yolun cevabı değil - ama sonsuz da değil.
            maxClimb: 460,
            animFrames: 26
        }
    },

    // ---- GÖLGE-VİRÜS: kovalayan toplar, rakibin arkasına düşen adım ----
    //
    // Kimliği "kaçsan da gelir": normal topu da özeli de rakibe doğru KIVRILIYOR
    // (homing), signature ise rakibin ARKASINA ışınlıyor ve oraya vuruyor.
    // Bu yüzden hepsi yumuşak: toplar yavaş, kıvrılma sınırlı (dönüş hızı
    // küçük) - zıplayan ya da bloklayan oyuncu yine de kurtulabiliyor.
    shadow: {
        basic: {
            id: 'shade',
            name: 'GÖLGE TOPU',
            kind: 'shot',
            icon: 'shade',
            cooldown: 34,
            // Anti-virüsün topundan yavaş ve biraz zayıf; karşılığında dönüyor.
            damage: 6,
            speed: 8,
            radius: 8,
            life: 110,
            homing: 0.035,
            animFrames: 16
        },
        special: {
            id: 'swarm',
            name: 'GÖLGE SÜRÜSÜ',
            kind: 'burst',
            icon: 'swarm',
            cooldown: 540,
            // Altı küçük küre her yöne açılıyor, sonra rakibe kıvrılıyor.
            // Anti'nin saçılmasının tersi: oradaki toplar düz gidiyor, boşluktan
            // geçiliyor; buradakiler sonunda rakibi buluyor ama tek tek zayıf.
            count: 6,
            damage: 5,
            speed: 6,
            radius: 8,
            life: 150,
            homing: 0.045,
            animFrames: 26
        },
        signature: {
            id: 'shadowstep',
            name: 'GÖLGE ADIMI',
            kind: 'blink',
            icon: 'shadowstep',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            cooldown: 300,
            // Elektronun ışınlanması rastgele yere düşer; buradaki rakibin
            // ARKASINA düşüyor ve orada bir kez vuruyor. Bloklayan rakip
            // vuruşu savar (takeDamage'in normal kuralı).
            target: 'enemy',
            behind: 96,
            damage: 9,
            animFrames: 16
        }
    }

};
// ---- DONMA (yalnız ICE-VİRÜS) ----
//
// Buzun tek kontrol aracı: BUZ YOLU'nun ucu rakibe değerse rakip donuyor.
// Eskiden üç üşümelik bir birikimdi; artık tek bir hamlenin sonucu, ama o
// hamle yavaş ve görünür - rakip yolun geldiğini görüyor ve kaçabiliyor.
//
// Dövüş oyununda hareketi kesen bir güç kolayca eziciye döner. İki fren:
//   - Donma bir hamle penceresi kadar: buz yaklaşıp bir iki kılıç sallar,
//     raunt kazanmaz.
//   - Donduktan sonra rakip UZUN SÜRE tekrar donmuyor. Yolun beklemesi
//     (480) bağışıklıktan uzun, yani zincirleme donma zaten mümkün değil;
//     bağışıklık ikinci fren olarak duruyor.
export const FREEZE = {
    duration: 100,   // donma ~1,7 saniye
    immune: 300      // donduktan sonra 5 saniye tekrar donmaz
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
