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
// TURUNCU BANT; aynı bant 4. (ev) ve 5. (kuşatma) bölümde arkadaşın
// kolundadır. Kimse söylemez.

import {
    LAB_RECIPE, LAB_LATE,
    CLINIC_RESULT, CLINIC_DETAILS, CLINIC_ORIGIN_Q, CLINIC_ORIGIN_A,
    CLINIC_LOOK_Q, CLINIC_LOOK_A,
    HOME_ASK, HOME_HEARD, HOME_DESC, HOME_WARN, HOME_PROPOSE,
    HOME_AGREE, HOME_CLOSE,
    LAB_HELP_ARRIVE, LAB_PATIENT_START, LAB_ENOUGH
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
    { n: 3, title: 'SAĞLIK OCAĞI', subtitle: 'GÜNLER SONRA' },
    { n: 4, title: 'KARANTİNA', subtitle: 'AYNI GÜNLERDE' },
    { n: 5, title: 'BİR HAFTA SONRA', subtitle: null },
    { n: 6, title: 'DENEY', subtitle: null }
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
    // Virüsün insana geçtiği yer. Başlık kartından sonra TEK KARE var:
    // mazgaldan çıkış, ayaktan giriş ve bulaşma zinciri aynı kadrajda,
    // kesintisiz akıyor. Kamera hiç kıpırdamıyor, araya ilerletme girmiyor.
    //
    // Bölümde TEK BİR YAZI YOK - ne anlatıcı kutusu ne balon. Kimse virüsü
    // görmüyor, kimse bir şey söylemiyor.

    { id: 'baslik-2', chapter: 2, art: 'title', motion: 0, hold: 90 },

    {
        id: 'cadde', chapter: 2, art: 'street',
        motion: 1200, hold: 90,
        sfx: [
            { name: 'step', at: 0.04 }, { name: 'step', at: 0.10 },
            { name: 'drip', at: 0.13 }, { name: 'ooze', at: 0.20 },
            { name: 'ooze', at: 0.27 }, { name: 'slide', at: 0.33 },
            { name: 'ooze', at: 0.40 }, { name: 'step', at: 0.46 },
            { name: 'slide', at: 0.52 }, { name: 'drip', at: 0.56 },
            { name: 'ooze', at: 0.60 }, { name: 'ooze', at: 0.66 },
            { name: 'ooze', at: 0.72 }, { name: 'ooze', at: 0.78 },
            { name: 'ooze', at: 0.83 }, { name: 'ooze', at: 0.87 },
            { name: 'ooze', at: 0.91 }, { name: 'step', at: 0.96 }
        ]
    },

    // ================= 3. BÖLÜM - SAĞLIK OCAĞI =================
    // Doktorun muayene odası. TEK KARE: kamera bölüm boyunca hiç kıpırdamıyor
    // (cont: true, karartma yok), tek istisna SON kare - doktorun uzattığı
    // çıktıya doğru yavaşça yaklaşıyor.
    //
    // Doktorun bildiği her şey burada söyleniyor; "nereden, nasıl" sorusuna
    // "araştırılıyor" dışında bir cevabı yok - kendisi de bilmiyor. Son
    // karedeki fotoğraf CADDEDEKİ mazgaldan çıkış anı (bkz. chapter2.js
    // `street`): bir sokak kamerası rastlantıyla yakalamış, kimse ne
    // olduğunu çözememiş.

    { id: 'baslik-3', chapter: 3, art: 'title', motion: 0, hold: 90 },

    {
        // HAREKETLİ: doktor ekrandaki tahlilden hastaya dönüyor
        id: 'klinik-baslangic', chapter: 3, art: 'clinicTurn',
        motion: 60, hold: 10
    },
    {
        id: 'klinik-teshis', chapter: 3, art: 'clinicResult', cont: true,
        lines: at(CLINIC_RESULT, 788, 192),
        motion: 30, hold: 20
    },
    {
        id: 'klinik-detay', chapter: 3, art: 'clinicDetails', cont: true,
        lines: at(CLINIC_DETAILS, 788, 192),
        motion: 30, hold: 20
    },
    {
        id: 'klinik-soru-nereden', chapter: 3, art: 'clinicQuestion', cont: true,
        lines: at(CLINIC_ORIGIN_Q, 268, 192),
        motion: 20, hold: 20
    },
    {
        id: 'klinik-cevap-bilinmiyor', chapter: 3, art: 'clinicUnknown', cont: true,
        lines: at(CLINIC_ORIGIN_A, 788, 192),
        motion: 20, hold: 20
    },
    {
        id: 'klinik-soru-nasil', chapter: 3, art: 'clinicQuestion', cont: true,
        lines: at(CLINIC_LOOK_Q, 268, 192),
        motion: 0, hold: 20
    },
    {
        // HAREKETLİ: çıktı çekmeceden çıkıp masaya konuyor
        id: 'klinik-fotograf', chapter: 3, art: 'clinicPhotoOut', cont: true,
        lines: at(CLINIC_LOOK_A, 788, 192),
        motion: 50, hold: 20
    },
    {
        // HAREKETLİ: kamera fotoğrafa yaklaşıyor. EKRANDA HİÇBİR YAZI YOK -
        // okuyucu neye baktığını kendisi çözsün, karakterler bilmiyor.
        id: 'klinik-yakinlasma', chapter: 3, art: 'clinicPhotoZoom', cont: true,
        motion: 200, hold: 130
    },

    // ================= 4. BÖLÜM - EV =================
    // Bizimkinin evi. TEK ÇEKİM: kamera hiç kıpırdamıyor. Bizimki koltukta
    // gazete okurken arkadaşı (= profesör, asla söylenmez) içeri giriyor.
    // Uzun sohbet BİLEREK çok sayıda küçük balona bölünüyor - her biri
    // havada kalıp okunacak kadar bekliyor, sonra oyuncu F ile ilerletiyor.

    { id: 'baslik-4', chapter: 4, art: 'title', motion: 0, hold: 90 },

    {
        // HAREKETLİ: arkadaş kapıdan giriyor, bizimki gazeteyi indiriyor
        id: 'ev-giris', chapter: 4, art: 'homeEnter',
        motion: 70, hold: 10
    },
    {
        id: 'ev-soru', chapter: 4, art: 'homeAsk', cont: true,
        lines: at(HOME_ASK, 284, 196),
        motion: 0, hold: 20
    },
    {
        id: 'ev-duydum', chapter: 4, art: 'homeHeard', cont: true,
        lines: at(HOME_HEARD, 660, 150),
        motion: 0, hold: 20
    },
    {
        id: 'ev-tarif', chapter: 4, art: 'homeDesc', cont: true,
        lines: at(HOME_DESC, 660, 150),
        motion: 0, hold: 20
    },
    {
        id: 'ev-uyari', chapter: 4, art: 'homeWarn', cont: true,
        lines: at(HOME_WARN, 660, 150),
        motion: 0, hold: 20
    },
    {
        id: 'ev-oneri', chapter: 4, art: 'homePropose', cont: true,
        lines: at(HOME_PROPOSE, 284, 196),
        motion: 0, hold: 20
    },
    {
        // Karar verildi, ama sokak umursamıyor: afişin altından akıp giden kalabalık
        id: 'ev-reddedildi', chapter: 4, art: 'streetIgnore',
        motion: 240, hold: 30
    },
    {
        id: 'ev-katilma', chapter: 4, art: 'homeAgree', cont: true,
        lines: at(HOME_AGREE, 660, 150),
        motion: 0, hold: 20
    },
    {
        id: 'ev-kapanis', chapter: 4, art: 'homeClose', cont: true,
        lines: at(HOME_CLOSE, 284, 196),
        motion: 0, hold: 90
    },

    // ================= 5. BÖLÜM - BİR HAFTA SONRA =================
    // Toplumun büyük kısmı enfekte. Kollarda yeşillenme, ateş, halsizlik.
    // Sokaklar boş; kalanlar hasta. Konuşma yok, yalnızca iki anlatıcı kutusu.

    { id: 'baslik-5', chapter: 5, art: 'title', motion: 0, hold: 90 },

    {
        // HAREKETLİ: aynı cadde, neredeyse boş. Hastalar ağır ağır yürüyor.
        id: 'hafta-sokak', chapter: 5, art: 'streetWeek',
        caption: 'SOKAKLAR BOŞALDI.',
        motion: 240, hold: 30
    },
    {
        // HAREKETLİ: yeşil kolun yukarı tırmanması
        id: 'hafta-kol', chapter: 5, art: 'greenArm',
        caption: 'ATEŞ. HALSİZLİK. KOLLARDA YEŞİL İZLER.',
        motion: 160, hold: 60
    },

    // ================= 6. BÖLÜM - DENEY =================
    // Harry ile Fred'in laboratuvarı, gündüz. Sağlıklılar yardıma geliyor,
    // gönüllü bir enfekte masaya yatıyor, üç bulgu ekranlardan okunuyor,
    // denek ölüyor. Ölüm EKRANDA - gizem değil.

    { id: 'baslik-6', chapter: 6, art: 'title', motion: 0, hold: 90 },

    {
        // HAREKETLİ: sağlıklılar kapıdan girip masanın yanına diziliyor
        id: 'deney-yardim', chapter: 6, art: 'labHelp',
        lines: [...at(LAB_HELP_ARRIVE.slice(0, 1), 316, 158), ...at(LAB_HELP_ARRIVE.slice(1), 812, 158)],
        motion: 120, hold: 20
    },
    {
        id: 'deney-denek', chapter: 6, art: 'labPatient', cont: true,
        lines: [...at(LAB_PATIENT_START.slice(0, 1), 716, 158), ...at(LAB_PATIENT_START.slice(1), 812, 158)],
        motion: 60, hold: 20
    },
    {
        // HAREKETLİ: virüs parçalanıp hücreye giriyor
        id: 'deney-bulgu-1', chapter: 6, art: 'findSplit',
        caption: 'VİRÜS PARÇALANIP HÜCRELERE YERLEŞİYOR.',
        motion: 160, hold: 40
    },
    {
        // HAREKETLİ: saniyede on bölünme
        id: 'deney-bulgu-2', chapter: 6, art: 'findMitosis',
        caption: 'HÜCRE İÇİNDE SANİYEDE 10 BÖLÜNME.',
        motion: 160, hold: 40
    },
    {
        // HAREKETLİ: beyne yayılıyor, zeka çubuğu düşüyor
        id: 'deney-bulgu-3', chapter: 6, art: 'findBrain',
        caption: 'BİR KISMI BEYNE YERLEŞİYOR. ZEKA KÖRELİYOR.',
        motion: 160, hold: 40
    },
    {
        // HAREKETLİ: nabız çizgisi düzleşiyor
        id: 'deney-olum', chapter: 6, art: 'labDeath',
        caption: 'DENEK ÖLDÜ.',
        motion: 120, hold: 60,
        sfx: [{ name: 'faint', at: 0.56 }]
    },
    {
        id: 'deney-yeter', chapter: 6, art: 'labDeath', cont: true,
        lines: [...at(LAB_ENOUGH.slice(0, 1), 812, 158), ...at(LAB_ENOUGH.slice(1), 716, 158)],
        motion: 0, hold: 90
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
