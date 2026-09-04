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
    // ---- ICE-VİRÜS: üşüten, kontrol eden ----
    //
    // Kadronun dördüncüsü ve en AZ hasar verenı. Kimliği vuruşta değil
    // BİRİKİMDE: her buz değişi rakibe bir "üşüme" ekliyor, üç üşüme rakibi
    // kısa süre DONDURUYOR (bkz. CHILL). Buzun kazanma yolu rakibi yavaşlatıp
    // bir anlığına durdurmak, sonra o boşluğu kullanmak.
    //
    // Diğer üçüyle çakışmıyor: virüs yakın döğüşçü, anti basınç kuruyor,
    // elektro alan tutuyor - hiçbiri rakibin SIRASINI kesmiyor.
    ice: {
        basic: {
            id: 'shard',
            name: 'BUZ KIRIĞI',
            kind: 'shard',
            icon: 'shard',
            cooldown: 26,
            // DENGE (2026-09-04, oynanarak): 6 hasardı, çok zayıf kaldı.
            // Yanlış hesabım: üşümeyi "değerli" sayıp vuruşu ucuzlatmıştım,
            // ama üşümenin kendisi de kısılmış olduğu için karakter iki
            // yerden birden zayıfladı. Vuruş 9'a çıktı - sürekli hasarda
            // hâlâ antinin altında (0,346 / 0,350), ama artık kavisli atışı
            // ıskalamanın bedeli maçı kaybettirmiyor.
            damage: 9,
            chill: 1,
            speed: 11,
            // Kırık YERÇEKİMİNE tabi: düz gitmiyor, kavis çiziyor. Uzaktan
            // isabet ettirmek beceri istiyor - buzun menzilli olmasının
            // bedeli bu. Antinin topu düz ve hızlı, buzunki ağır ve düşüyor;
            // iki menzilli karakter aynı şeyi yapmasın.
            gravity: 0.22,
            radius: 10,
            life: 150,
            animFrames: 20
        },
        special: {
            id: 'wall',
            name: 'BUZ DUVARI',
            kind: 'wall',
            icon: 'wall',
            cooldown: 420,
            // Kadronun tek SAVUNMA özeli: hasarı yok, kimseyi vurmuyor.
            //
            // DENGE (2026-09-04, oynanarak): duvar önce İKİ TARAFA DA
            // simetrikti - buzun kendi kırığını da durduruyordu. Sonuç:
            // özelini kullanan buz dokuz saniye boyunca hiç hasar veremiyor,
            // yani kendi özeli kendini cezalandırıyordu. Artık duvar
            // MERMİDE tek yönlü: rakibin atışını durduruyor, sahibininkini
            // geçiriyor - bu buzun büyüttüğü kendi kalkanı.
            //
            // Kamp kurmaya dönüşmesini engelleyen şey YOL: duvar iki
            // oyuncunun da yolunu kesiyor, buz da onu geçemiyor. Yani
            // arkasından atış yapmak için buz ilerlemekten vazgeçiyor, ve
            // duvar üç saniyede sönüyor.
            offset: 130,
            width: 28,
            // Zıplama 140 piksel yükseliyor (13²/2·0,6), yukarı atılma 367.
            // Duvar 180: zıplamayla AŞILAMIYOR ama L1+ÇARPI ile aşılıyor.
            // Yani duvarın cevabı oyuncuda zaten var, bekleme süresi olan
            // bir kombo - aşılamayan duvar denge değil kilit olurdu.
            height: 180,
            // Kaç mermi durdurur. Yakın dövüş vuruşu ikisini birden
            // götürüyor (bkz. combat.meleeHit), yoksa virüs duvarın
            // arkasındaki buza hiç ulaşamazdı.
            hp: 5,
            life: 180,
            animFrames: 30
        },
        signature: {
            id: 'frost',
            name: 'AYAZ',
            kind: 'frost',
            icon: 'frost',
            padCombo: ['l1', 'triangle'],
            keySlot: 'attack',
            cooldown: 240,
            // Çevreye bir anda yayılan ayaz: İKİ üşüme birden ekliyor, yani
            // bir kırıkla birleşince donma çıkıyor. Menzili kısa - donma
            // bedava olmasın, buz yaklaşmayı göze alsın.
            //
            // DENGE (2026-09-04): hasarı 3'tü, "sembolik" diye yazmıştım.
            // Oynanışta bu bir hamle değil bir jest oldu: buz kendini
            // tehlikeye atıp yaklaşıyor ve karşılığında hiçbir şey almıyordu.
            // Yakınlaşmanın riski varsa ödülü de olmalı.
            damage: 12,
            chill: 2,
            radius: 180,
            animFrames: 26
        }
    }

};
// ---- ÜŞÜME ve DONMA (yalnız ICE-VİRÜS) ----
//
// Buzun bütün kimliği burada. Her buz değişi bir üşüme ekliyor; üşümeler
// yavaşlatıyor, üçe ulaşınca rakip KISA SÜRE donuyor.
//
// Dövüş oyununda hareketi kesen bir güç kolayca eziciye dönüşür. Üç fren
// birden konuldu:
//   - Donma KISA (yarım saniye): bir hamle penceresi açar, raunt kazandırmaz.
//   - Donduktan sonra rakip UZUN SÜRE tekrar donmuyor; üşümeler yavaşlatmaya
//     devam ediyor ama zincirleme donma yok.
//   - Üşüme birikimi kendiliğinden sönüyor: buz basıncı sürdürmezse sıfırlanır.
// DENGE (2026-09-04, oynanarak): ilk hâlinde üç fren de fazla sıkıydı ve
// buz "çok güçsüz" çıktı. Üçü de gevşetildi, ama fren olarak duruyorlar:
//   - Donma yarım saniyeydi: bir hamle penceresi açmıyordu bile, buz üç
//     kırık isabet ettirip karşılığında BİR kırıklık zaman kazanıyordu.
//     Bir saniyeye çıktı - iki kırık ya da bir AYAZ sığıyor.
//   - Bağışıklık donmanın 8 katıydı, şimdi 3 katı. Zincirleme donma hâlâ
//     yok ama buz basıncı sürdürünse döngü kapanıyor.
//   - Üşüme donunca SIFIRLANIYORDU. En büyük hatam buydu: yavaşlatma en
//     yüksek değerine ulaştığı anda siliniyordu, yani %36'lık yavaşlatma
//     oyunda hiç yaşanmıyordu. Artık birikim donmadan sonra DURUYOR,
//     kendiliğinden sönene kadar rakibi yavaşlatmaya devam ediyor.
export const CHILL = {
    max: 3,               // kaç üşüme donmaya çevirir
    slowPerStack: 0.14,   // her üşüme %14 yavaşlatır (en çok %42)
    decay: 180,           // 3 sn yeni üşüme gelmezse birikim söner
    freeze: 60,           // donma bir saniye
    immune: 180           // donduktan sonra 3 sn tekrar donmaz
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
