// Oynanış 1. bölüm: KAPIDAKİ SES. Burada yalnızca veri var (DOM/canvas yok):
// replikler, hedef yazıları, tarama bulguları. Akışı AdventureScene.js
// yürütüyor; veri testi (tests/data.test.mjs) bu dosyayı tarayıcı açmadan
// doğruluyor.
//
// Konuşan kimlikleri: biz = Harry (oyuncu), arkadas = Fred, saglikli-0..2 =
// yardıma gelen üç sağlıklı, andrew = Andrew Stolen.

export const PLAY_ENTRIES = [
    { id: 'kapidaki-ses', title: 'KAPIDAKİ SES', label: 'OYNANIŞ' }
];

// Ekranın sol üstünde duran görev satırı
export const OBJECTIVES = {
    talkFred: 'FRED İLE KONUŞ',
    toDoor: 'KAPIYA GİT',
    openDoor: 'KAPIYI AÇ',
    toScope: 'MİKROSKOBA GİT',
    talkAndrew: 'ANDREW İLE KONUŞ',
    openAnnex: 'İZOLASYON KAPISINI AÇ',
    lock: 'CAM HÜCREYİ KİLİTLE',
    chase: 'VİRÜSTEN KAÇ VE FREDİ UYAR',
    getBattery: 'PİLİ AL',
    throwBattery: 'PİLİ FIRLAT'
};

// Kontrol ipucu: oyun açılırken kısa süre görünür
export const CONTROL_HINT = 'OKLAR / WASD YÜRÜ     F KONUŞ / ETKİLEŞİM';

// Kovalamaca ipuçları (kolda: sol çubuk yürür, sağ çubuk feneri çevirir)
export const CHASE_HINT_KEYS = 'OKLAR / WASD YÜRÜ     FENER YÜRÜDÜĞÜN YÖNE BAKAR';
export const CHASE_HINT_PAD = 'SOL ÇUBUK YÜRÜ     SAĞ ÇUBUK FENERİ ÇEVİRİR';
export const CAUGHT_CAPTION = 'YAKALANDIN. TEKRAR DENE.';
export const FRED_LOST_CAPTION = 'FRED DAYANAMADI. TEKRAR DENE.';

export const LINES = {
    fredTalk: [
        { speaker: 'biz', text: 'Fred, silahın ilerlemesi nasıl?' },
        { speaker: 'arkadas', text: 'Parçalar tamam. Hedefleme kısmı hala eksik.' },
        { speaker: 'biz', text: 'Çalışmaya devam edelim. Başka çaremiz yok.' }
    ],
    fredAgain: [
        { speaker: 'arkadas', text: 'Hedefleme ayarı bitmeden hiçbir şey yapamayız.' }
    ],
    knock: [
        { speaker: 'arkadas', text: 'Bu ses ne?' },
        { speaker: 'saglikli-1', text: 'Biri kapıya vuruyor!' },
        { speaker: 'saglikli-0', text: 'Şu saatte kim olabilir...' },
        { speaker: 'biz', text: 'Kıpırdamayın. Ben bakacağım.' }
    ],
    peep: [
        { speaker: 'andrew', text: 'Lütfen! Kapıyı açın, yardıma ihtiyacım var!' },
        { speaker: 'arkadas', text: 'Enfekte biri. Açmayalım Harry.' },
        { speaker: 'biz', text: 'Hiçbir hastane açık değil Fred. En azından dinleyelim.' }
    ],
    doorStuck: [
        { speaker: 'arkadas', text: 'Harry, emin misin?' },
        { speaker: 'biz', text: 'Eminim. Açıyorum.' }
    ],
    // Andrew eşikte duruyor: içeri girmeden önce soruyor
    entryAsk: [
        { speaker: 'andrew', text: 'Girebilir miyim? Lütfen.' },
        { speaker: 'biz', text: 'Gir. Çabuk ol.' }
    ],
    entry: [
        { speaker: 'andrew', text: 'Teşekkür ederim. Buranın profesörleriyle konuşmak istiyorum.' },
        { speaker: 'biz', text: 'Biziz. Seni dinliyoruz.' }
    ],
    monologue: [
        { speaker: 'andrew', text: 'Kendimi berbat hissediyorum.' },
        { speaker: 'andrew', text: 'Biliyorum, doktor değilsiniz. Ama hiçbir hastane açık değildi.' },
        { speaker: 'andrew', text: 'Son zamanlarda çok sayıda ölüm olduğunu duydum. Açıkçası bundan endişe duyuyorum.' },
        { speaker: 'andrew', text: 'Bir de doktorum, bu virüsle ilgili bir mutasyonum olduğunu söylemişti.' },
        { speaker: 'andrew', text: 'Maalesef doktorum hayatını kaybetti.' },
        { speaker: 'andrew', text: 'Bu yüzden size yardımcı olabileceğimi düşündüm.' }
    ],
    // Zeka ipucu: virüsün hızını duyunca hesabı anında yapıyor
    mathBeat: [
        { speaker: 'arkadas', text: 'Mutasyon mu? Bu virüs hücre içinde saniyede 10 bölünme yapıyor, biliyor musun?' },
        { speaker: 'andrew', text: 'Saniyede on... Saatte otuz altı bin. Bu yüzden bu kadar acele ediyorsunuz.' },
        { speaker: 'arkadas', text: 'Hesabı nasıl bu kadar çabuk yaptın?' },
        { speaker: 'biz', text: 'Mutasyonu inceleyelim. Önce bir DNA örneği almamız lazım.' }
    ],
    // Andrew mikroskop tezgâhına yaklaşıp örneğini veriyor
    sampleAsk: [
        { speaker: 'andrew', text: 'Tabii. Kolumdan alabilirsiniz.' },
        { speaker: 'biz', text: 'Bir damla yeter. Dur biraz.' }
    ],
    sampleDone: [
        { speaker: 'biz', text: 'Aldım. Hemen mikroskoba bakıyorum.' }
    ],
    scanStart: [
        { speaker: 'biz', text: 'Dizilimi tarayalım. Üç anormallik arayacağım.' }
    ],
    scanDone: [
        { speaker: 'arkadas', text: 'Sonuncusu çok tehlikeli Harry. Onu serbest bırakamayız.' },
        { speaker: 'biz', text: 'Cam odaya alalım. Ama ona kötü davranmayacağız.' }
    ],
    andrewCell: [
        { speaker: 'biz', text: 'Andrew, seni izolasyon odasındaki cam hücreye alacağız. Güvenlik için.' },
        { speaker: 'andrew', text: 'Anlıyorum. Gerekirse beni kullanın, yeter ki bir çare bulun.' }
    ],
    annexOpen: [
        { speaker: 'biz', text: 'Yıllardır kimse girmedi buraya. Hücre hala çalışıyor.' },
        { speaker: 'biz', text: "İyi. Andrew'ı oraya alalım." }
    ],
    locked: [
        { speaker: 'arkadas', text: 'Kilitlendi.' },
        { speaker: 'biz', text: 'Deneylerimize onunla devam edeceğiz.' }
    ],
    // Gece: cam hücrede Andrew ve içindeki ses
    cellTalk: [
        { speaker: 'ses', text: 'Seni bu duruma kim düşürdü?' },
        { speaker: 'andrew', text: 'Ne? Sen de kimsin? Bu ses nereden geliyor?' },
        { speaker: 'ses', text: 'Ben seni buradan kurtarabilecek tek güçüm.' },
        { speaker: 'ses', text: 'Tabii beni kullanmayı becerebilirsen.' },
        { speaker: 'andrew', text: 'İçimde gelişen organizma... Sen bir mutasyonsun. Profesörler senden bahsetmişti.' },
        { speaker: 'andrew', text: 'Sen benim ailemi öldürdün! Yani beni bu duruma sen düşürdün!' },
        { speaker: 'ses', text: 'Seni bu duruma ben düşürmedim. Ben sadece içindeki bir canlıyım, fazlası değil.' },
        { speaker: 'ses', text: 'Bunu bu virüsü oluşturan kişi yaptı. Yani seni buraya tıkan kişi, yani Fred yaptı!' },
        { speaker: 'andrew', text: 'Bunun doğru olduğu ne malum? Belki yalan söylüyorsun.' },
        { speaker: 'andrew', text: 'Ayrıca ben sadece onlara yardım ediyorum. Eminim işleri bittiğinde beni buradan çıkaracaklar.' },
        { speaker: 'ses', text: 'Bana güvenmek zorundasın. Fred virüsü yaparken son malzemeyi yanlış ekledi.' },
        { speaker: 'ses', text: 'Bu da mutasyonu, yani beni oluşturdu. Fred hatasını ancak ertesi gün fark etti.' },
        { speaker: 'ses', text: 'Onca insan arasından bizi bulmaları oldukça zor olacaktı. Tabii sen buraya kendi isteğinle gelmeseydin.' },
        { speaker: 'andrew', text: 'Sadece yardım istemek için buraya gelmiştim.' },
        { speaker: 'andrew', text: 'Ayrıca sen neden benim buradan çıkmamı istiyorsun? Anlattıkların bir pencereden bakınca mantıklı, ama aynı zamanda saçma.' },
        { speaker: 'ses', text: 'Bu mutasyon yalnızca sende var. Bu fırsatı değerlendirmelisin Andrew.' },
        { speaker: 'ses', text: 'Ailenin gerçek katilini bulmak istemiyor musun? Yoksa burada öylece mi bekleyeceksin?' },
        { speaker: 'andrew', text: 'Ah, evet. İntikamı alacağım. Ne yapmamı istiyorsun?' },
        { speaker: 'ses', text: 'Sadece kontrolü bana bırak. Gerisini ben hallederim.' }
    ],
    // Patlama sonrası: Harry fenerle geliyor
    harryIn: [
        { speaker: 'biz', text: 'Işıklar gitti... Andrew? İyi misin?' }
    ],
    harryShock: [
        { speaker: 'biz', text: 'Bu... Bu da ne böyle?!' }
    ],
    harryWarn: [
        { speaker: 'biz', text: 'Fred! Burayı hemen terk etmeliyiz!' },
        { speaker: 'arkadas', text: 'Ne oldu? Neden bu kadar telaşlısın?' },
        { speaker: 'biz', text: 'Andrew artık Andrew değil! Hemen çıkmalıyız!' }
    ],
    wallBreak: [
        { speaker: 'arkadas', text: 'Bu ses de ne?!' }
    ],
    fredCaught: [
        { speaker: 'arkadas', text: 'Harry! Yardım et! Bırak beni!' }
    ],
    batteryTake: [
        { speaker: 'biz', text: 'Bir pil... Yeter mi bilmiyorum ama deneyeceğim.' }
    ],
    afterThrow: [
        { speaker: 'andrew', text: 'Aaah... Başım... Ne oldu bana?' },
        { speaker: 'arkadas', text: 'Aah... Harry...' },
        { speaker: 'biz', text: 'Fred! Dayan, yanındayım!' }
    ]
};

// Tarama bulguları: ekran koordinatları (1000x560) ve işaretlenince okunan satır
export const SCAN_TARGETS = [
    { id: 'zeka', x: 220, y: 200, r: 52, label: 'ZEKA ARTIŞI',
      line: { speaker: 'biz', text: 'Zeka merkezlerinde olağanüstü artış. Diğer enfektelerin tam tersi.' } },
    { id: 'guc', x: 520, y: 330, r: 52, label: 'FİZİKSEL GÜÇ ARTIŞI',
      line: { speaker: 'arkadas', text: 'Kas dokusu normalin çok üstünde. Gücü insanüstü.' } },
    { id: 'organizma', x: 780, y: 220, r: 52, label: 'İÇİNDE BAŞKA BİR ORGANİZMA',
      line: { speaker: 'biz', text: 'Bu... içinde ayrı bir organizma gelişiyor. Kendi aklı var.' } }
];

export const ENDING_CAPTION = 'ANDREW CAM ODADA.';
export const NIGHT_CAPTION = 'O GECE.';
