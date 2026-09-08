// Prologun çizgi roman senaryosu.
//
// Prolog artık oynanmıyor: oyuncu ormana girene kadar olan her şey kare kare
// anlatılıyor. Her kare TAM EKRAN gelir, öncekinin üstünü örter; oyuncu
// F / ÇARPI ile ilerletir.
//
// Burada DOM/canvas yok - yalnızca veri. Çizim src/comic/comicArt.js'te,
// akış src/comic/ComicPlayer.js'te. Bu ayrım sayesinde senaryonun kendisi
// (kare sırası, konuşan kimlikleri, bölüm sayıları) tarayıcı açmadan
// tests/data.test.mjs içinde doğrulanabiliyor.
//
// Bir kare:
//   {
//     id:      'lab-raf',       // testte ve hata ayıklamada okunur
//     chapter: 1,               // hangi prolog bölümü
//     art:     'labShelf',      // comicArt.js'teki çizim anahtarı
//     caption: 'ŞEHİR. GECE.',  // opsiyonel anlatıcı kutusu (üst köşe)
//     lines:   [{ speaker, text, at: [x, y] }],   // opsiyonel balonlar
//     motion:  70,              // hareketin kaç kare süreceği (0 = duruk kare)
//     hold:    40,              // balon yoksa karenin ekranda kalma payı
//     cont:    true,            // önceki karenin DEVAMI: araya karartma girmez
//     sfx:     [{ name, at }]   // hareketin şu anında bir kez çalan ses
//   }
//
// cont, tek çekimi bölmeden anlatmak için: kare değişiyor ama kamera aynı
// odada kaldığı için siyahtan açılmıyor.
//
// "at" balonun kuyruğunun gösterdiği nokta - konuşanın ağzı. 1000x560'lık
// kare düzleminde verilir.
//
// KURAL: profesörün yüzü hiçbir karede görünmez. Tek işaret kolundaki
// TURUNCU BANT; aynı bant 3. bölümde arkadaşın kolundadır. Kimse söylemez.

import {
    LAB_RECIPE, LAB_LATE,
    SIEGE_SPOTTED, SIEGE_PLAN, SIEGE_AGREE, SIEGE_CALL,
    SEWER_START, SEWER_EXIT,
    CITY_HOPE, CITY_DOUBT, CITY_ONWARD,
    FOREST_STOPPED, FOREST_AFTER
} from '../adventure/prologLines.js';

// Konuşma balonlarına konum ekler: metin prologLines.js'te tek yerde durur,
// karedeki yeri burada verilir.
const at = (lines, x, y) => lines.map(line => ({ ...line, at: [x, y] }));

// still: bölüm HENÜZ YENİDEN YAZILMADI. Kareleri duruyor ama hiçbiri
// oynamıyor - sırayla tarif edilip yeniden çizilecekler. Bitmiş bölümde
// still yok.
export const CHAPTERS = [
    { n: 1, title: 'LABORATUVAR', subtitle: 'BİR YIL ÖNCE' },
    { n: 2, title: 'CADDE', subtitle: 'ERTESİ SABAH' },
    { n: 3, title: 'KUŞATMA', subtitle: null, still: true },
    { n: 4, title: 'ORMANIN AĞZI', subtitle: null, still: true }
];

export const PANELS = [

    // ================= 1. BÖLÜM - LABORATUVAR =================
    // Başlık kartından sonrası TEK ÇEKİM: kamera bölüm boyunca aynı odada,
    // kareler arasında karartma yok (cont: true). Kadraj yalnızca sonlara
    // doğru kaba yaklaşıp geri açılıyor.
    //
    // Anlatıcı kutusu YOK. Söylenen her şey profesörün kendi kendine
    // konuşması; kim olduğu ne söyleniyor ne gösteriliyor.

    { id: 'baslik-1', chapter: 1, art: 'title', motion: 0, hold: 90 },

    {
        // HAREKETLİ: uzak plan. Sıvılar tek tek kaba dökülüyor, dökümler
        // arasında yandaki kağıda bakılıyor, sonunda kapak kapanıyor.
        id: 'lab-karisim', chapter: 1, art: 'labMix',
        motion: 280, hold: 40,
        sfx: [
            { name: 'drip', at: 0.12 }, { name: 'drip', at: 0.19 },
            { name: 'drip', at: 0.38 }, { name: 'drip', at: 0.45 },
            { name: 'drip', at: 0.64 }, { name: 'drip', at: 0.71 },
            { name: 'land', at: 0.97 }
        ]
    },
    {
        // Doğruluyor ve kendi kendine konuşuyor
        id: 'lab-tarif', chapter: 1, art: 'labSaid', cont: true,
        lines: at(LAB_RECIPE, 428, 168),
        motion: 46, hold: 20
    },
    {
        // HAREKETLİ: kol kalkıyor, bileğindeki TURUNCU SAAT görünüyor
        id: 'lab-saat', chapter: 1, art: 'labWatch', cont: true,
        lines: at(LAB_LATE, 428, 168),
        motion: 60, hold: 20
    },
    {
        // HAREKETLİ: yavaşça kadrajdan çıkıyor. Kamera onu İZLEMİYOR -
        // odak kabın üstünde kalıyor.
        id: 'lab-cikis', chapter: 1, art: 'labLeave', cont: true,
        motion: 210, hold: 50,
        sfx: [
            { name: 'step', at: 0.18 }, { name: 'step', at: 0.30 },
            { name: 'step', at: 0.42 }, { name: 'step', at: 0.54 },
            { name: 'step', at: 0.66 }, { name: 'step', at: 0.78 }
        ]
    },
    {
        // HAREKETLİ: kamera yavaşça kaba yaklaşıyor; cam oynamaya ve
        // çatlamaya başlıyor.
        id: 'lab-yakinlasma', chapter: 1, art: 'labCloseIn', cont: true,
        motion: 300, hold: 20,
        sfx: [
            { name: 'hit', at: 0.47 }, { name: 'glassCrack', at: 0.64 },
            { name: 'glassCrack', at: 0.78 }, { name: 'glassCrack', at: 0.90 }
        ]
    },
    {
        // HAREKETLİ: kap paramparça oluyor, geriye yalnızca virüs kalıyor.
        // Bu karede EKRANDA HİÇBİR YAZI YOK - ne kutu ne balon.
        id: 'lab-dogus', chapter: 1, art: 'labBirth', cont: true,
        motion: 260, hold: 40,
        sfx: [
            { name: 'glassCrack', at: 0.22 }, { name: 'glassCrack', at: 0.26 },
            { name: 'ooze', at: 0.40 }, { name: 'ooze', at: 0.70 },
            { name: 'land', at: 0.92 }
        ]
    },
    {
        // HAREKETLİ: kamera geri açılıyor, sol üstteki havalandırma kapağı
        // ortaya çıkıyor; duvara tırmanıp içeri giriyor ve kayboluyor.
        id: 'lab-havalandirma', chapter: 1, art: 'labVent', cont: true,
        motion: 300, hold: 70,
        sfx: [
            { name: 'ooze', at: 0.30 }, { name: 'ooze', at: 0.60 },
            { name: 'slide', at: 0.90 }
        ]
    },

    // ================= 2. BÖLÜM - CADDE =================
    // Virüsün insana geçtiği yer. Başlık kartından sonrası yine TEK ÇEKİM:
    // kamera kalabalık caddeden sol alttaki yağmur mazgalına iniyor, oradan
    // bir ayakkabının dibine, oradan omuz hizasına çıkıyor.
    //
    // Bölümde TEK BİR YAZI YOK - ne anlatıcı kutusu ne balon. Kimse virüsü
    // görmüyor, kimse bir şey söylemiyor; anlatan tek şey kamera.

    { id: 'baslik-2', chapter: 2, art: 'title', motion: 0, hold: 90 },

    {
        // HAREKETLİ: kalabalık kaldırımdan akıyor. Sol altta mazgal duruyor;
        // sonunda karanlığında bir kez beyaz bir şey kıpırdıyor.
        id: 'cadde-kalabalik', chapter: 2, art: 'streetCrowd',
        motion: 300, hold: 50,
        sfx: [
            { name: 'step', at: 0.08 }, { name: 'step', at: 0.21 },
            { name: 'step', at: 0.34 }, { name: 'step', at: 0.47 },
            { name: 'step', at: 0.60 }, { name: 'step', at: 0.73 },
            { name: 'drip', at: 0.88 }
        ]
    },
    {
        // HAREKETLİ: kamera mazgala iniyor, kütle demirlerin arasından çıkıyor
        id: 'cadde-mazgal', chapter: 2, art: 'drainMouth', cont: true,
        motion: 320, hold: 30,
        sfx: [
            { name: 'drip', at: 0.30 }, { name: 'ooze', at: 0.58 },
            { name: 'ooze', at: 0.78 }, { name: 'slide', at: 0.92 }
        ]
    },
    {
        // HAREKETLİ: olukta akıp bordürü tırmanıyor, ayakların arasına giriyor
        id: 'cadde-tirmanis', chapter: 2, art: 'drainCrawl', cont: true,
        motion: 320, hold: 20,
        sfx: [
            { name: 'ooze', at: 0.10 }, { name: 'slide', at: 0.44 },
            { name: 'ooze', at: 0.66 }, { name: 'step', at: 0.80 }
        ]
    },
    {
        // HAREKETLİ: bekleyenin ayakkabısının dibinden içeri akıyor.
        // Kişi kıpırdamıyor; olan bitenin farkında değil.
        id: 'cadde-giris', chapter: 2, art: 'footEntry', cont: true,
        motion: 340, hold: 40,
        sfx: [
            { name: 'ooze', at: 0.35 }, { name: 'ooze', at: 0.58 },
            { name: 'slide', at: 0.74 }, { name: 'drip', at: 0.90 }
        ]
    },
    {
        // HAREKETLİ: omuzdan omuza. Üç geçiş, üç yeni konak.
        id: 'cadde-bulasma', chapter: 2, art: 'shoulderChain', cont: true,
        motion: 380, hold: 40,
        sfx: [
            { name: 'ooze', at: 0.26 }, { name: 'ooze', at: 0.50 },
            { name: 'ooze', at: 0.74 }
        ]
    },
    {
        // Kamera açılıyor: kalabalık yürümeye devam ediyor. Hiçbir şey
        // olmamış gibi - ki zaten kimse bir şey görmedi.
        id: 'cadde-sonra', chapter: 2, art: 'streetAfter', cont: true,
        motion: 280, hold: 120,
        sfx: [
            { name: 'step', at: 0.30 }, { name: 'step', at: 0.52 },
            { name: 'step', at: 0.74 }
        ]
    },

    // ================= BEKLEYEN BÖLÜMLER =================
    // 3 ve 4. bölümler sırayla yeniden tarif edilip yeniden çizilecek.
    // O güne kadar hiçbiri OYNAMIYOR: hepsinin motion'ı 0, kareler bitmiş
    // hâllerini duruk gösteriyor. Aralarındaki "HAREKETLİ" notları eski
    // hareketi anlatıyor, yenisi yazılınca geri gelecekler.

    // ================= 3. BÖLÜM - KUŞATMA =================
    // Tesis avlusu. Bizim dışımızda TAM BEŞ sağlıklı - bu sayı 4. bölümde de
    // tutmak zorunda. Arkadaşın dönüştüğü GÖSTERİLMİYOR: ayıran şey kapı.

    { id: 'baslik-3', chapter: 3, art: 'title', motion: 0, hold: 90 },

    {
        id: 'kusatma-avlu', chapter: 3, art: 'yardCalm',
        caption: 'TESİS. AYAKTA KALAN ALTI KİŞİ.',
        motion: 0, hold: 80
    },
    {
        id: 'kusatma-orgu', chapter: 3, art: 'fenceCrowd',
        lines: at(SIEGE_SPOTTED, 300, 300),
        motion: 0
    },
    {
        id: 'kusatma-plan', chapter: 3, art: 'yardPlan',
        lines: [...at(SIEGE_PLAN, 380, 320), ...at(SIEGE_AGREE, 720, 330)],
        motion: 0
    },
    {
        // HAREKETLİ: yarıktan içeri doluyorlar, biz kapıyı tutuyoruz
        id: 'kusatma-yarik', chapter: 3, art: 'breach',
        motion: 0, hold: 40
    },
    {
        // HAREKETLİ: çelik kapı iniyor, cümle ortasında kesiliyor
        id: 'kusatma-kapi', chapter: 3, art: 'doorClosing',
        lines: at(SIEGE_CALL, 560, 340),
        motion: 0, hold: 30
    },
    {
        id: 'kusatma-kapali', chapter: 3, art: 'doorShut',
        caption: 'KAPI BİR DAHA AÇILMADI.',
        motion: 0, hold: 110
    },

    // ================= 4. BÖLÜM - ORMANIN AĞZI =================
    // Kanalizasyon, rögar, şehrin kenarı ve ormanın ağzındaki dönüş.
    // Tünel "yoğun maruziyet": beşinin sayacını bitiren yer orası.

    { id: 'baslik-4', chapter: 4, art: 'title', motion: 0, hold: 90 },

    {
        id: 'orman-tunel', chapter: 4, art: 'sewerRun',
        lines: at(SEWER_START, 480, 300),
        motion: 0
    },
    {
        id: 'orman-merdiven', chapter: 4, art: 'sewerLadder',
        lines: at(SEWER_EXIT, 620, 300),
        motion: 0
    },
    {
        id: 'orman-sehir', chapter: 4, art: 'ruinedCity',
        caption: 'ŞEHRİN KENARI.',
        lines: [...at(CITY_HOPE, 380, 330), ...at(CITY_DOUBT, 700, 330), ...at(CITY_ONWARD, 380, 330)],
        motion: 0
    },
    {
        id: 'orman-durus', chapter: 4, art: 'forestMouth',
        lines: at(FOREST_STOPPED, 400, 320),
        motion: 0
    },
    {
        // HAREKETLİ: beşinin de yüzü yavaşça yeşilleniyor
        id: 'orman-donus', chapter: 4, art: 'greening',
        motion: 0, hold: 60
    },
    {
        // HAREKETLİ: parçalayıcı silah. Öldürmüyor, dağıtıyor.
        id: 'orman-vurus', chapter: 4, art: 'shots',
        motion: 0, hold: 40
    },
    {
        id: 'orman-sonra', chapter: 4, art: 'aftermath',
        lines: at(FOREST_AFTER, 420, 330),
        motion: 0
    },
    {
        // Kolunda ilk yeşil damar: oyunun sayacı burada başlıyor
        id: 'orman-giris', chapter: 4, art: 'intoForest',
        caption: 'SON SAĞLIKLI İNSAN.',
        motion: 0, hold: 120
    }
];

// Bir bölümün kareleri (başlık kartı dahil)
export function panelsOfChapter(n) {
    return PANELS.filter(panel => panel.chapter === n);
}

// Senaryoda geçen tüm çizim anahtarları - comicArt.js'in karşılaması gereken küme
export function artKeys() {
    return [...new Set(PANELS.map(panel => panel.art))];
}
