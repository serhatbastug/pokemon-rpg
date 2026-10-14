# Virüs — Arena ve Prolog

Aynı ekranda oynanan 2 kişilik gerçek zamanlı arena (klavyede ya da her
oyuncu kendi PS5 koluyla) ve hikâyeyi anlatan çizgi roman prologu.
Saf HTML/CSS/JavaScript (ES modülleri) ile yazılmıştır; derleme adımı yoktur.
Dış veri kaynağı yoktur: bütün karakterler ve sahneler elle çizilmiş piksel
sanatıdır.

## Çalıştırma

ES modülleri `file://` üzerinden çalışmaz; yerel bir HTTP sunucusu gerekir:

```
npm start
```

Ardından tarayıcıda `http://localhost:8765` adresini açın.

## Testler

İki katman var:

| Komut | Ne yapar | Süre |
|---|---|---|
| `npm run check` | Veri ve saf mantık testleri (179 kontrol): ana menü yerleşimi (her iki kapıya da yürünebiliyor mu), arena kadrosu ve basamakları, prolog çizgi romanının senaryosu ve akışı, diyalog yürütücüsü, oyun kolu eşlemesi. Tarayıcı gerekmez. | ~1 sn |
| `npm run test:ui` | Puppeteer ile uçtan uca oynanış (74 test): ana menü sahnesi, prolog çizgi romanı (kare ilerletme, balonlar), oyun kolu (iki kol, iki yuva), ekran geçişleri, dövüşçü seçimi, arena, basamaklar, giriş animasyonları (P1 → P2 sırası) ve FPS ölçümü. | ~1 dk |
| `npm test` | İkisini sırayla çalıştırır. | |

UI testleri için sunucunun ayrı bir terminalde çalışıyor olması gerekir (`npm start`).
Ekran görüntüleri `tests/screenshots/` altına yazılır (git'e dahil değil).
GitHub Actions yapılandırması `.github/workflows/ci.yml` içindedir.

## Ana Menü

Oyun bir düğme listesiyle değil, **antrenörün içinde yürüdüğü piksel bir sahneyle**
açılır (`src/menu/`). Sahne tek ekrandır, kamera kaymaz:

| Nerede | Ne var | Nasıl |
|---|---|---|
| Sol | Antrenörün evi | Şimdilik yalnızca dekor, etkileşim yok |
| Orta | "MACERA KAPISI" tabelalı taş kemer | Önüne gelip **F** / **ÜÇGEN**: "Oyuna başlamak istiyor musunuz?" penceresi açılır |
| Sağ | "2 KİŞİLİK OYNA" tabelalı portal | Kemerin **altına yürüyün**: ekran yavaşça kararır, karakter seçimi açılır |

EVET denince ekran yavaşça kararır ve **prologun çizgi romanı** açılır
(aşağıya bakın). Oyunun oynanan kısmı prolog bitince, ormanda başlayacak.

> Eski Pokemon macera modu (portallı ana harita, yakalama, jetonlar, dükkan,
> kütüphane) tamamen kaldırıldı. Macera kapısı prologun çizgi romanını açıyor;
> oynanan kısım ormanda başlayacak.

Sahne ekranı tamamen kaplar (canvas 1000x560, object-fit: contain).
Ev, ağaç gövdeleri ve kemer ayakları engeldir; yerleşimin tutarlılığı (her iki
kapıya da yürüyerek ulaşılabilmesi dahil) `npm run check` içinde BFS ile test
edilir.

### Oyun kolu (PS5 DualSense)

Kol Bluetooth ile bağlandıktan sonra **bir tuşuna basılınca** tarayıcı onu
görür (Gamepad API kuralı). Ana menüde:

| | Klavye | Kol |
|---|---|---|
| Yürüme | W A S D / yön tuşları | Sol analog (veya D-pad) |
| Macera kapısını aç | F | **ÜÇGEN** |
| Onay penceresi: evet | Enter | **ÇARPI** |
| Onay penceresi: hayır | Esc | **DAİRE** |

Analog ne kadar itilirse antrenör o kadar hızlı yürür. Kol bağlıyken kapı
ipucundaki **F** simgesi yerine **üçgen** görünür. Eşleme `src/core/gamepad.js`
içinde; ham kol verisini yöne çeviren `readPad` saf fonksiyon olduğu için
`npm run check` içinde test edilir.

Menü ve prolog sahneleri tek kolla oynanır (ilk kol). İki kişilik arenada ise
**her oyuncunun kendi kolu** vardır - [Kontroller](#kontroller) bölümüne bakın.

## Prolog — Çizgi Roman (`src/comic/`)

Prolog **oynanmıyor**: oyuncunun eline kontrol ormana girdiğinde geçiyor,
ondan öncesi kare kare anlatılıyor. Her kare tam ekran gelir, öncekinin
üstünü örter; oyuncu **F / SPACE / ENTER**, kolda **ÇARPI** ile ilerletir.
**ESC / DAİRE** prologu bırakır.

Şimdilik altı bölüm var; 5. bölümden itibaren hikâye yeni senaryoya göre
yazılacak (karantina, bir hafta sonra, deney, hap, şehirden kaçış, orman):

| Bölüm | Ne anlatılıyor |
|---|---|
| 1. LABORATUVAR | Fred sıvıyı karıştırıyor, kap paramparça oluyor. |
| 2. CADDE | Tek kare, sabit kamera: virüs dokuz kişiye bulaşıyor. |
| 3. SAĞLIK OCAĞI | Doktor hastaya V-986'yı anlatıyor. |
| 4. KARANTİNA | Harry ve Fred birbirlerine adıyla seslenerek haberi konuşuyor, karantina çağrısı reddediliyor, virüsü tanımaya karar veriyorlar. |
| 5. BİR HAFTA SONRA | Boşalan cadde, kolları yeşillenen hastalar, ateşli yeşil bir kol. |
| 6. DENEY | Sağlıklılar yardıma geliyor, gönüllü enfekte masada, üç bulgu (parçalanma, saniyede 10 bölünme, beyin), denek ölüyor. |

Kurallar:

- **Profesörün yüzü hiçbir karede görünmez.** Tek işaret kolundaki turuncu
  bant; aynı bant 3. bölümde arkadaşın kolundadır. Kimse söylemez.
- **Arkadaşın dönüşümü gösterilmez**: ne ısırılma, ne dönüşüm, ne kolun
  çekilip çekilmediği. Ayıran şey kapının kendisi.
- Önemli anlar **kısa hareketle** anlatılır (şişenin rafa konması, kapının
  inmesi, yeşillenme, vuruş): her bölümde en az bir hareketli kare vardır.
- Konuşmalar `prologLines.js`'te tek yerde durur; balon harf harf yazılır ve
  her birkaç harfte konuşana göre perdesi değişen bir "bıt" sesi çıkar.

Dosyalar:

```
src/comic/
  comicScript.js      Senaryo: kareler, anlatıcı kutuları, balonlar - DOM'suz
  ComicPlayer.js      Akış: kare sırası, hareket, balon, ilerletme - DOM'suz
  ComicScene.js       Canvas, girdi, ses, döngü
  comicArt.js         Sayfa: çerçeve, anlatıcı kutusu, başlık kartı, çizim haritası
  comicKit.js         Karelerin paylaştığı çizim araçları (kol, cam kap, ışık)
  art/chapter1..6.js  Kare çizimleri, bölüm bölüm
```

Kareleri gözle görmek için: `node tools/comic-shots.mjs` (tümü),
`node tools/comic-shots.mjs lab-raf 0.9` (tek kare, hareketin belli bir anı).
Görüntüler `tools/shots/` altına düşer, sunucunun açık olması gerekir.

> Kuşatma, kanalizasyon ve ormanın ağzı bölümleri yeni senaryo nedeniyle silindi;
> eski hâlleri git geçmişinde duruyor.


## Kontroller

| | Oyuncu 1 | Oyuncu 2 | Kol (her ikisi) |
|---|---|---|---|
| Hareket | W A S D | Yön tuşları | Sol analog / D-pad |
| Zıplama | W | Yukarı ok | **ÇARPI** |
| Basamaktan inme | S | Aşağı ok | Sol analog aşağı |
| Saldırı · Özel · Blok | F · G · V | , · . · / | **KARE · DAİRE · R1** |
| Kombo tuşu | SHIFT | SHIFT (sağ) | **L1** |

Hamleler, kombolar ve basamaklar için [Arena](#arena) bölümüne bakın.

**İki kişilik arena, iki kolla:** her oyuncunun kendi DualSense'i olur.
Takılan **ilk kol 1. oyuncuyu**, ikinci kol 2. oyuncuyu oynatır (kol sırası
tarayıcının verdiği numaraya göre). Tek kol takılıysa 2. oyuncu klavyede
kalır; klavye her zaman açık, kol takılıyken bile çalışır. Kolla oynayan
oyuncunun HUD'unda klavye tuşları yerine **Sol analog · ÇARPI** yazar.

Her kol ayrı bir *yuvada* takip edilir (`PadSlot`), yoksa iki kolun basılı
tuşları birbirine karışırdı: 2. kolun analogu yalnızca 2. oyuncuyu yürütür.

**Menüler de kolla:** karakter seçimi ve "SAVAŞ BİTTİ" penceresi fare
istemez (`src/ui/padMenu.js`):

| | Kol |
|---|---|
| Kartlar arasında gez | Sol analog / D-pad |
| Sayfayı kaydır | **Sağ analog** |
| Dövüşçüyü aç, sonra seç | **ÇARPI** |
| Pencereyi kapat / ana menü | **DAİRE** |
| Savaşı başlat | **ÜÇGEN** |
| Savaş sonu: yeniden oyna | **ÇARPI** |

İki seçim de bitince "2 KİŞİLİK OYNA" düğmesi kendiliğinden ekrana kaydırılır -
düğme ızgaranın yukarısında kalıyor, aşağıdan seçen oyuncu onu görmüyordu.

Sırası gelen oyuncu kendi koluyla seçer (1. oyuncu ilk kolla, 2. oyuncu
ikinciyle); o oyuncunun kolu yoksa hangi kol iterse imleç onunla gezer. Bu iki
ekranda çizen bir sahne olmadığı için kolu tarayan da yoktur - `PadMenu` kendi
küçük döngüsünü açar ve yalnızca bu ekranlar açıkken çalışır. Tuşlar gerçek
düğmelerin `click()`'ini çağırır, yani kol farenin gittiği yerden gider.


## Arena

Arena tuvali **1280x640** (`index.html`), altında ayrı bir şeritte kombo
kümesi.

**Ekrana sığma.** Tuvalin çözünürlüğü sabit; gösterildiği boy hem genişliğe
hem **yüksekliğe** göre kısılıyor (`#battle-screen` içindeki `--arena-en-boy`
ve `--ust-alan`). Sayfa hiç kaydırılmamalı: kaydırılırsa arenanın **altı**
(zemin ve kombo kümesi) ekran dışında kalıyor. Ölçü savaş ekranının
kendisinde duruyor ki HUD ile arena aynı genişlikte kalsın - HUD boydan boya
uzayınca arena ekranın soluna sıkışmış gibi duruyordu. `npm run test:ui`
sayfanın kaydırılmadığını ve iki tuvalin aynı genişlikte olduğunu
doğruluyor.

**Basamaklar.** Her arenanın kendi seki düzeni var (`src/game/arenas.js`,
`LEDGE`); arena maç boyunca sabit olduğu için düzen ezberlenebilir. Sekiler
**tek yönlü**: altlarından zıplayarak üstlerine çıkılır, **AŞAĞI** tuşuyla
inilir.

- Alt seki zeminden **120 piksel**: normal zıplama (~140) yetiyor.
- Üst seki **250 piksel**: oraya ancak alt sekiden zıplayarak ya da
  **yukarı atılmayla** (~360) çıkılır.
- Yükseklikler tuvale oranla değil, **piksel** cinsinden yazılıyor: bir
  basamağa çıkılıp çıkılamaması zıplama yüksekliğine bağlı, tuvalin boyuna
  değil. `npm run check` bu ilişkiyi doğruluyor.
- Düzenler simetrik: iki oyuncu da aynı arenayı görüyor.

Arka planlar **iki katman**: durağan olan (gök, zemin, ağaçlar, basamaklar)
bir kez ayrı bir tuvale çizilip her karede kopyalanıyor, yalnızca canlı olan
(lav, kar, yağmur, şimşek) her karede yeniden çiziliyor. Tuval büyüyünce blok
blok çizmek kare başına binlerce `fillRect` demekti ve kare hızı 60'ın altına
düşüyordu.

Arenaları gözle görmek için:

```
node tools/arena-shots.mjs <klasör>    # dördü de, basamakların üstünde dövüşçüyle
```

## Proje Yapısı

```
index.html              Uygulama iskeleti (ekranlar, HUD, canvas)
style.css               Tüm stiller
src/
  main.js               Giriş noktası; modülleri kurup birbirine bağlar
  config/
    settings.js         Fizik sabitleri, tuş atamaları, oyuncu ayarları
    controls.js         Kontrol öğretmeleri (hangi tuş neyi yapıyor)
  core/
    input.js            Klavye durumu takibi (InputManager)
    gamepad.js          Oyun kolu (PS5 DualSense): analog yön ve tuş eşlemesi
  services/
    audio.js            Web Audio ile üretilen ses efektleri ve müzik
  game/
    Game.js             Oyun motoru: döngü ve tur durumu
    Player.js           Oyuncu: hareket, fizik, can, durum etkileri
    fighters.js         Arena kadrosu (VİRÜS, ANTİ-VİRÜS, ELECTRO-VİRÜS)
    fighterArt.js       Dövüşçülerin piksel çizimleri ve elektrik efekti
    fighterIntro.js     Giriş animasyonları (adam -> virüs), P1 ve P2 sırayla
    arenas.js           Pixel art arena arka planları ve basamakları
    effects.js          Parçacıklar, sarsıntı, flaş, uçan yazılar
  world/
    trainerSprite.js    Elle çizilmiş antrenör piksel sprite'ı
  pixel/
    pixelDraw.js        Ortak piksel araçları: PX ızgarası, blok, gürültü
    trees.js            Ağaç sprite'ları (small..huge), sahneler arası paylaşılır
    pixelFont.js        5x7 piksel bitmap yazı tipi (tabelalar, mekan adı)
    speech.js           Konuşma balonu çizimi
    screenText.js       Ekran yazısı yardımcıları
    controlHint.js      Ekranın üstündeki kontrol öğretmesi
    weaponFx.js         Parçalayıcı silahın görsel etkileri
  menu/
    MenuScene.js        Ana menü sahnesi: yürüyüş, çarpışma, kapı ve portal
    menuLayout.js       Sahne yerleşimi (ev, kemerler, patikalar, ağaçlar) - DOM'suz
    menuArt.js          Sahnenin piksel çizimleri (zemin, ev, taş kemerler)
  adventure/
    people.js           Arkadaş ve sağlıklıların sprite'ları (turuncu bant, yeşillenme)
    prologLines.js      Prologun konuşmaları - tek yerde
    dialogue.js         Balon yürütücüsü: harf harf yazı, 'bıt' sesi
  comic/
    comicScript.js      Prologun çizgi roman senaryosu - DOM'suz
    ComicPlayer.js      Kare akışı - DOM'suz
    ComicScene.js       Canvas, girdi, ses
    comicArt.js         Sayfa çerçevesi, anlatıcı kutusu, başlık kartı
    comicKit.js         Karelerin paylaştığı çizim araçları
    art/                Kare çizimleri (bölüm bölüm)
  ui/
    characterSelect.js  Dövüşçü seçim ekranı ve detay penceresi
    padMenu.js          Seçim ekranı ve savaş sonu penceresinde kolla gezinme
    startPrompt.js      Macera kapısının piksel onay penceresi
    hud.js              Can barları ve kontrol yazısı
    screens.js          Ekranlar arası geçişler
tools/
  comic-shots.mjs       Çizgi roman karelerinin PNG'sini alır
  fighter-shots.mjs     Arena dövüşçülerinin PNG'sini alır
  intro-shots.mjs       Giriş animasyonlarının karelerini alır
  arena-shots.mjs       Dört arenayı basamaklarıyla çeker
  fighters.html         Dövüşçü önizleme sayfası
```

## Arena Kadrosu

Eski Pokemon kadrosu (PokeAPI'den çekilen dokuz sınıf, poke top fırlatma,
yakalama, jetonlar, dükkan, kütüphane, ana harita) **tamamen kaldırıldı**.
Yerine hikâyenin kendi yaratıkları geldi:

| Dövüşçü | Ne | Görünüş |
|---|---|---|
| **VİRÜS** | Yeşil virüsün bir insana tamamen geçmiş, tam gelişmiş hâli | Gövdenin tamamı erimiş: boyun ve ayak yok, altta birikinti; kafa insan kafası değil (öne uzamış, üç göz, çene yerine iplik iplik açılan bir yarık); kollar parçalı ve pençeli |
| **ANTİ-VİRÜS** | Tanışılan ilk farklı virüs; mercan renkli, kabuklu | Taşıyıcısını tamamen kaplamıyor: yalnız gövdenin **sağ** yanını, belin üstünü sarmış (bel hizasında seyrelen lekelerle biter). **OMUZDAN** yukarı uzanan girintili çıkıntılı borunun ucunda kendi küçük kafası var (belli belirsiz iki göz, bir ağız). Sağ ayağını saran lekeler. Açıkta kalan yüz yarısında kaş, göz, burun ve ağız çizilidir |
| **ELECTRO-VİRÜS** | Sonradan tanışılan ikinci virüs; sarı-lacivert (ağırlık lacivert) | Taşıyıcısını **tamamen** kaplamış. Dik saçlar, yanan gözler, kabuğun altından geçen sarı damarlar; elleri sarımsı ve bir tık büyük, bacakları biraz kalın. Etrafındaki ve gövdesindeki elektrik **her karede yeniden çizilir** - sprite'a gömülü değildir |

Çizimler `src/game/fighterArt.js` içinde, elle, PX = 4 ızgarasında yapılır ve
bir kez çizilip saklanır. Kartta gösterilen sprite arenaya çıkan sprite'ın ta
kendisidir. Tek istisna elektro-virüsün kıvılcımları: onlar sprite'ın parçası
değil, `drawElectroSparks` ile her karede yeniden çizilir.

### Giriş animasyonları

Üçünün de iskeleti aynı (`src/game/fighterIntro.js`): arenada sıradan bir
adam durur, **kamera ona doğru yaklaşır** ve sahne kararır, adam bir şey
yapar, sonra virüse dönüşür. Karakter yerinden kıpırdamaz; yakınlaşmanın
sabit noktası onun ayaklarıdır ve arka plan da aynı ölçekle büyür - yalnızca
figürü büyütmek "kamera yaklaştı" değil "karakter şişti" gibi duruyordu. Üç adam da **ayrı kişilerdir** (ayrı paletler).
**Birden fazla oyuncunun girişi varsa sırayla oynarlar: önce P1, sonra P2.**
Animasyonlar bitene kadar kimse hareket edemez.

| | **VİRÜS** (~4,5 sn) | **ANTİ-VİRÜS** (~4 sn) | **ELECTRO-VİRÜS** (~4,3 sn) |
|---|---|---|---|
| Adam | Siyah saçlı, bordo ceketli | Açık kahve saçlı, haki tulumlu | Koyu saçlı, gri-mavi |
| Hareket | Elini kaldırıp **kendi eline bakar**; yeşil elden yukarı yürür | **Sağ** bacağını kendine çeker, hızla yere vurur | **Sol** elini havaya kaldırır; ucunda **yeşil virüs** belirir, ele **şimşek** çakar |
| Dönüşüm | **Çöküş:** adam olduğu yere erir, yerde bir birikinti kalır, oradan çok daha iri bir kütle yükselir; **gözleri en son yanar** | Kaplama **aşağıdan** (vuran ayaktan) yukarı çıkar | Kaplama **yukarıdan** (kalkan elden) aşağı iner |

Kaplanma sırasında karakter kafasını **kendi sağına** hafifçe yatırır, dönüşüm
tamamlanınca kafasını geri alır.

Anti-virüs ve elektroda adam ile virüs hâli **aynı iskeletten** çizilir
(`paintCarrier` / `paintFigure`); dönüşümün hizalanması buna bağlıdır.
Virüste böyle bir şart yok: taşıyıcı geriye kalmıyor, gidiyor - o yüzden
adam yok olurken virüs ayrı bir çizim olarak aşağıdan büyür.

Karelerini gözle görmek için:

```
node tools/intro-shots.mjs virus              # altı an
node tools/intro-shots.mjs antivirus 0.46     # tek an (0..1)
```

**Sprite'lar aynalanmıyor.** İki karakterin de kimliği asimetrisinde: anti-virüsün
hangi yanının kaplı olduğu karaktere ait bir şey, rakibin nerede durduğuna bağlı
değil. `Player.dir` yine hesaplanıyor (güçler geldiğinde yön oradan okunacak)
ama çizimi etkilemiyor.

Üçünün de hamleleri `src/game/abilities.js` içinde: normal saldırı, özel,
karaktere özel hamle ve üç atılma. Arena düzeni için [Arena](#arena)
bölümüne bakın.

Çizimi gözle görmek için:

```
node tools/fighter-shots.mjs            # ikisi yan yana
node tools/fighter-shots.mjs antivirus  # tek dövüşçü, büyütülmüş
```

## Yeni İçerik Ekleme

- **Yeni dövüşçü:** `src/game/fighterArt.js` içine çizimini yazıp
  `FIGHTER_SPRITES`'a ekleyin, sonra `src/game/fighters.js` kadrosuna kayıt
  girin. `npm run check` ikisinin eşleştiğini doğrular.
- **Yeni arena:** `src/game/arenas.js` dizisine `arena({ name, ledges, statik, live })` ekleyin.
- **Tuş değişikliği:** `src/config/settings.js` içindeki `PLAYERS` nesnesini düzenleyin.
