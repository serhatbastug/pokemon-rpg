// Oynanış 3. bölüm: AVCI KULÜBESİ. Yalnızca veri (DOM/canvas yok): replikler,
// görev yazıları, gün sayıları. Akışı CampScene.js yürütüyor.
//
// Konuşan kimlikleri: biz = Harry (oyuncu), arkadas = Fred.
//
// Akış: patika (üç yol ayrımı) -> kulübe -> yatakları hazırla -> uyu ->
// (2. ve 3. günde) odun topla, akşam ateş yak, uyu -> gece uyanış: Fred'i ara ->
// açıklıkta hiçbir yerde yok -> Fred'in odası boş.

// Günlük görevler: gün -> { görev: hedef }. Odun hedefine Fred'in devirdiği ağaç da
// sayılır (2. gün 4 = Harry 3 + Fred 1; 3. gün 5 = Harry 4 + Fred 1).
export const DAY_TASKS = {
    2: { wood: 4, water: 1 },
    3: { wood: 5, berries: 3 }
};
export const TASK_NAMES = { wood: 'ODUN', water: 'SU', berries: 'MEYVE' };
export const LAST_DAY = 3;

export const OBJECTIVES = {
    trail: 'PATİKADA İLERLE',
    toCabin: 'KULÜBEYE GİR',
    beds: 'YATAKLARI HAZIRLA',
    sleep: 'YATAĞINA GİR VE UYU',
    tasks: 'GÜNLÜK İŞLER',
    fire: 'ATEŞ YAK',
    cook: 'YEMEK PİŞİR',
    toBed: 'EVE GİR VE UYU',
    search: "FRED'İ ARA",
    fredRoom: "FRED'İN ODASINA GİT"
};

export const LABELS = {
    enter: 'GİR', exit: 'ÇIK', bed: 'YATAK HAZIRLA', sleep: 'UYU', chop: 'ODUN KES',
    fire: 'ATEŞ YAK', search: 'ARA', look: 'BAK', talk: 'KONUŞ',
    water: 'SU AL', pour: 'SUYU DÖK', berry: 'MEYVE TOPLA', cook: 'YEMEK PİŞİR'
};

export const CAPTIONS = {
    day2: '2. GÜN',
    day3: '3. GÜN',
    evening: 'AKŞAM OLDU.',
    night: 'GECE.',
    end: 'DEVAMI VAR...'
};

export const LINES = {
    // Patika: üç yol ayrımı
    junction: [
        [
            { speaker: 'arkadas', text: 'Yol ikiye ayrılıyor Harry. Hangisinden gidiyoruz?' },
            { speaker: 'biz', text: 'Ana patikadan devam edelim. Yan yollar daha derine gidiyor.' }
        ],
        [
            { speaker: 'arkadas', text: 'Bu ağaçları daha önce gördüm gibi geliyor.' },
            { speaker: 'biz', text: 'Hepsi birbirine benziyor. Gözünü açık tut.' }
        ],
        [
            { speaker: 'arkadas', text: 'Şuradaki iz... Bir yere çıkıyor olmalı.' },
            { speaker: 'biz', text: 'Duman yok, ses yok. Yine de bakalım.' }
        ]
    ],
    // Açıklığa varış
    yardArrive: [
        { speaker: 'biz', text: 'Bir kulübe... Işık yok.' },
        { speaker: 'arkadas', text: 'Eski bir avcı kulübesi gibi. İçeri bakalım mı?' }
    ],
    cabinFirst: [
        { speaker: 'biz', text: 'Kimse yok. Uzun zamandır kullanılmamış.' },
        { speaker: 'arkadas', text: 'Bize yeter. İki yatak hazırlayalım.' },
        { speaker: 'biz', text: 'Sen şu odayı al, ben öbürünü.' }
    ],
    bedFred: [{ speaker: 'biz', text: "Fred'in yatağı hazır." }],
    bedHarry: [{ speaker: 'biz', text: 'Benimki de tamam.' }],
    bedsDone: [
        { speaker: 'arkadas', text: 'Yarın ilk iş odun. Geceleri soğuk olur.' },
        { speaker: 'biz', text: 'Haklısın. İyi geceler Fred.' }
    ],
    // 2. gün
    day2: [
        { speaker: 'biz', text: 'Günaydın Fred.' },
        { speaker: 'arkadas', text: 'Günaydın. Bugün hem odun hem su lazım. Ben uzaktaki bir ağacı devireyim.' },
        { speaker: 'biz', text: 'Ben de suyu getiririm. Sonra odunu bölüşürüz.' }
    ],
    chopFirst: [{ speaker: 'biz', text: 'Balta eski ama iş görür.' }],
    woodDone: [
        { speaker: 'biz', text: 'Bu kadar yeter. Akşam oluyor, ateş yakalım.' }
    ],
    fireLit: [
        { speaker: 'arkadas', text: 'Güzel. Çok uzun zamandır bir ateş görmemiştim.' },
        { speaker: 'biz', text: 'Küçük tutalım. Bizi kimse görmesin.' }
    ],
    toBed2: [{ speaker: 'biz', text: 'Yeter bugünlük. İçeri girelim.' }],
    // 3. gün
    day3: [
        { speaker: 'arkadas', text: 'Dün gece iyi uyudum. Sanki hiçbir şey olmamış gibi.' },
        { speaker: 'arkadas', text: 'Bugün gölde balık tutacağım. Sen odun kes, biraz da yemiş topla.' },
        { speaker: 'biz', text: 'Olur. Akşam hep birlikte yemek yeriz.' }
    ],
    fireLit3: [
        { speaker: 'arkadas', text: 'Harry... Sence diğerleri iyi mi?' },
        { speaker: 'biz', text: 'Umarım. Şimdilik biz hayattayız.' }
    ],
    // Yeni görevler
    waterTake: [{ speaker: 'biz', text: 'Su soğuk ve temiz. Fıçıya götüreyim.' }],
    waterPour: [{ speaker: 'biz', text: 'Fıçı doldu. Birkaç gün yeter.' }],
    berryFirst: [{ speaker: 'biz', text: 'Bunlar yenir gibi. Birkaç tane toplayayım.' }],
    fredFelled: [{ speaker: 'arkadas', text: 'Devrildi! Sen de kendi payını kes Harry.' }],
    fredJobChop: [{ speaker: 'arkadas', text: 'Şu ağaç benim. Tam sağlam bir gövde.' }],
    fredJobChopDone: [{ speaker: 'arkadas', text: 'Dev ağacı indirdim. Sıra sende.' }],
    fredJobFish: [{ speaker: 'arkadas', text: 'Göl balık dolu. Akşama yemek çıkar, görürsün.' }],
    cook: [
        { speaker: 'arkadas', text: 'Bir balık yakaladım. Yemişlerle güzel bir çorba olur.' },
        { speaker: 'biz', text: 'Uzun zamandır sıcak yemek yemedik. Kokusu bile iyi.' },
        { speaker: 'arkadas', text: 'Afiyet olsun Harry.' }
    ],
    // Fred ile konuşma (gündüz, isteğe bağlı)
    fredIdle: [
        [{ speaker: 'arkadas', text: 'Odun yığını az kalmış. Dikkatli kullanalım.' }],
        [{ speaker: 'arkadas', text: 'Balta eski ama keskin. Sen kes, ben taşırım.' }],
        [{ speaker: 'arkadas', text: 'Burası sessiz. Fazla sessiz.' }]
    ],
    // Gece uyanış
    nightWake: [
        { speaker: 'biz', text: 'Bir ses mi geldi... Fred?' },
        { speaker: 'biz', text: 'Cevap yok. Dışarıya bakayım.' }
    ],
    search: {
        woodpile: [{ speaker: 'biz', text: 'Odun yığınının yanında yok. Fred!' }],
        fire: [{ speaker: 'biz', text: 'Ateş çoktan sönmüş. Buradan kimse geçmemiş.' }],
        trailEdge: [{ speaker: 'biz', text: 'Patikada iz yok. Fred! Duyuyor musun?' }]
    },
    searchDone: [
        { speaker: 'biz', text: 'Hiçbir yerde yok...' },
        { speaker: 'biz', text: 'Kesin uyuya kalmıştır. Gidip onu uyandırayım.' }
    ],
    fredRoom: [
        { speaker: 'biz', text: 'Fred...?' },
        { speaker: 'biz', text: 'Yatağı bomboş. Battaniye de soğumuş.' }
    ]
};
