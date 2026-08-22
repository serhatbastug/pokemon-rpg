# PokeRPG — Gerçek Zamanlı Arena PvP

2 kişilik, aynı klavyede oynanan gerçek zamanlı Pokemon arena savaş oyunu.
Saf HTML/CSS/JavaScript (ES modülleri) ile yazılmıştır; derleme adımı yoktur.
Karakter verileri [PokeAPI](https://pokeapi.co)'den çekilir.

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
| `npm run check` | Veri ve saf mantık testleri (335 kontrol): harita geçerliliği, portal ulaşılabilirliği, gizli alanların yalnızca gizli çalıdan geçilmesi, spawn noktaları, sprite desenleri, yetenek/sprite/tip tutarlılığı, seviye ve saha hamlesi mantığı. Tarayıcı gerekmez. | ~1 sn |
| `npm run test:ui` | Puppeteer ile uçtan uca oynanış (71 test): ekran geçişleri, savaş, harita gezinme, poke top fırlatma, yakalama, jetonlar, evrim, kayıt, rozetler, saha hamleleri, tüccar ve her ekranda FPS ölçümü. | ~2 dk |
| `npm test` | İkisini sırayla çalıştırır. | |

UI testleri için sunucunun ayrı bir terminalde çalışıyor olması gerekir (`npm start`).
Ekran görüntüleri `tests/screenshots/` altına yazılır (git'e dahil değil).
GitHub Actions yapılandırması `.github/workflows/ci.yml` içindedir.

## Kontroller

| | Oyuncu 1 | Oyuncu 2 |
|---|---|---|
| Hareket | W A S D | Yön tuşları |
| Yetenek 1 | F | Sağ Shift |
| Yetenek 2 | Sol Shift | , (virgül) |
| Yetenek 3 (Ulti) | Space | Enter |

**Macera modu:** WASD hareket · K O Ş L P yetenek · **Space zıpla** · **Shift atıl** ·
1-6 poke top fırlat/geri çağır · N Pokeball · F saha hamlesi / dükkan · E kütüphane

## Proje Yapısı

```
index.html              Uygulama iskeleti (ekranlar, HUD, canvas)
style.css               Tüm stiller
src/
  main.js               Giriş noktası; modülleri kurup birbirine bağlar
  config/
    characters.js       Karakter sınıfları ve Pokemon ID eşleşmeleri
    settings.js         Fizik sabitleri, tuş atamaları, oyuncu ayarları
    balance.js          Oynanış denge ayarları (menzil, süre, hasar sabitleri)
    fieldMoves.js       Rozetler ve saha hamleleri (Cut / Rock Smash / Surf)
    shopItems.js        Kecleon dükkanının eşyaları (toplar, iksirler)
    trainers.js         Haritalardaki NPC antrenörler
    progression.js      Seviye/XP eğrisi ve stat formülleri
    playableCharacters.js  Oynanabilir karakterlerin resmi hamle setleri
    regions.js          Macera modu bölgeleri (5 bölge, portal renkleri)
    worldMap.js         Ana harita karo verisi ve portal konumları
  core/
    input.js            Klavye durumu takibi (InputManager)
  services/
    pokeapi.js          PokeAPI erişim katmanı
    apiCache.js         API yanıtları için bellek + localStorage önbelleği
    typeChart.js        Tip etkililik tablosu (PokeAPI kaynaklı)
    moveAbilities.js    Gerçek hamle verisinden yetenek üretimi
    audio.js            Web Audio ile üretilen ses efektleri ve müzik
  game/
    Game.js             Oyun motoru: döngü, çarpışmalar, tur durumu
    Player.js           Oyuncu: hareket, fizik, can, durum etkileri
    Projectile.js       Mermiler ve çizim stilleri
    abilities.js        Sınıf bazlı yetenek tanımları
    arenas.js           Pixel art arena arka planları
    effects.js          Parçacıklar, sarsıntı, flaş, uçan yazılar
    projectileSprites.js Kare kare pixel art mermi sprite desenleri
  world/
    Overworld.js        Macera motoru: yaşam döngüsü, harita yükleme, girdi
    ActivePokemon.js    Sahadaki Pokemon: statlar, hasar, tutuş davranışı
    Enemy.js            Düşman Pokemon: AI, saldırı, durum
    Progress.js         Ekip, koleksiyon, jeton, rozet ve localStorage kaydı
    trainerSprite.js    Elle çizilmiş antrenör piksel sprite'ı
    systems/            Overworld davranışları (prototipe karıştırılır)
      PartyControls.js  Ekip, poke top fırlatma/geri çağırma, eşya kullanımı
      Navigation.js     Yürünebilirlik, kamera, portallar, akış alanı (BFS)
      CombatSystem.js   Yetenekler, mermiler, hasar, yakalama, jetonlar
      TrainerCombat.js  Antrenörün canı, zıplama/atılım ve durum etkileri
      AutoBattle.js     Sahadaki Pokemonun kendi kendine savaşması
      TrainerBattles.js NPC antrenör savaşları
    scenes/Scenes.js    Boss uyanışı, zafer ve evrim sahneleri
    render/
      TerrainRenderer.js  Karo desenleri ve zemin pişirme
      WorldRenderer.js    Portallar, tüccar, oyuncu, efektler ve HUD
  ui/
    characterSelect.js  Karakter seçim ekranı ve detay modalı
    library.js          Pokemon kütüphanesi (ekip, koleksiyon, jeton harcama)
    shop.js             Kecleon dükkanı ve çanta
    hud.js              Can barları ve cooldown göstergeleri
    screens.js          Ekranlar arası geçişler
```

## Macera Modu (geliştirme aşamasında)

Undertale tarzı, kuşbakışı tek kişilik mod. Plan: 5 bölge x 3 mekan x 5 Pokemon
(3 yaygın + 1 boss + 1 gizli) = 75 karakter. Yetenekler o Pokemonun resmi
hamlelerinden seçilir. Maceraya Bulbasaur (#1) ile başlanır.

**1. Bölge (Vahşi Orman) tamamlandı** — üç mekanın da haritası, Pokemonları ve
boss savaşı hazır; her mekan farklı bir harita tarzında:

| Mekan | Tarz | Yaygınlar | Gizli | Boss |
|---|---|---|---|---|
| Fısıltılı Orman Girişi | labirent (40x20) | Pinsir, Ursaring, Trevenant | Scolipede | Golisopod |
| Gölgeli Derinlikler | organik mağara (46x22) | Scyther, Carnivine, Krookodile | Umbreon | Hawlucha |
| Kadim Ağaç Meydanı | tapınak meydanı (48x24) | Gyarados, Hydreigon, Slaking | Snorlax | **Zarude** (bölge bossu) |

Her mekanda: gizli çalının ardında keşfedilene kadar görünmeyen gizli oda,
uyuyan ve uyanınca arenayı parçalayan boss, bossu yenince rozet ve zafer sahnesi.

### Görsel: iki mod, iki tarz

Oyunun iki modu bilinçli olarak **farklı görsel dile** sahip:

| | 2 Kişilik Arena | Tek Kişilik Macera |
|---|---|---|
| Tarz | Pixel art (korundu) | **Anime / cel-shading** |
| Çözünürlük | 1000x500 | 1000x560 mantıksal, **2x** arka plan (2000x1120) |
| Pokemon görseli | Piksel sprite | Yüksek çözünürlüklü resmi çizim |
| Zemin | Piksel bloklar | Düz renk alanları, sert gölge bantları, koyu konturlar |
| Mermiler | Piksel desenler | Anime enerji efektleri (düz renk + kontur + beyaz çekirdek) |
| Antrenör | — | Elle çizilmiş cel-shading karakter (önbelleğe alınmış sprite) |
| Kamera | Sabit | 1.55x yakınlaştırma (karakterler büyük görünür) |

Anime tarzının teknik özü **degrade kullanmamaktır**: bir şekil düz renkle
doldurulur, içine sert kenarlı bir gölge bandı konur ve çevresine koyu bir
kontur çizilir (`render/celShading.js`). Yumuşak degradeler görüntüyü plastik
gösterirken bu yöntem çizgi film hissi verir.

Karakterler belirgin şekilde büyük: sahadaki Pokemon 96px, bosslar 140-168px.
Performans için zemin harita başına bir kez, antrenör de yön/kare başına bir kez
offscreen canvas'a çizilip önbelleğe alınır - bu yüzden 4 kat piksele ve
cel-shading maliyetine rağmen tüm ekranlar 60 FPS.

Bu ayrım `npm run check` ile korunuyor: arena dosyaları piksel çizimi
kapatmamalı, macera dosyaları da piksel moduna dönmemeli.

### Antrenör, ekip ve ilerleme

- **Antrenör:** Haritada gezdirdiğiniz karakter bir antrenördür (elle çizilmiş
  piksel sprite). Saldırıyı Pokemonunuz yapar ama **antrenör de hasar alır** —
  hayatta kalmak sizin işiniz: **Space** ile zıplayıp mermileri altınızdan
  geçirir, **Shift** ile atılıp tam dokunulmazlıkla sıyrılırsınız.
- **Otomatik savaş:** Sahadaki Pokemon kendi kendine savaşır — hedef seçer,
  tip üstünlüğüne göre hamlesini belirler, canı azalınca iyileşir. K/O/Ş/L/P
  ile istediğiniz an siz de müdahale edebilirsiniz.
- **Poke top fırlatma:** Pokemonlar peşinizden gelmez. **1-6** tuşlarıyla o
  ekip üyesinin topunu baktığınız yöne fırlatırsınız; Pokemon orada açılır ve
  o noktayı tutarak savaşır. Aynı tuşa tekrar basmak onu topuna geri çağırır.
  Antrenör çok uzaklaşırsa Pokemon kendiliğinden döner.
- **6 kişilik ekip:** Sahadaki Pokemon bayılırsa sıradaki gelir; hepsi
  bayılırsa mekan girişine dönülür.
- **Yakalama:** Yalnızca yabani (yaygın/gizli) Pokemonlar yakalanır. **Bosslar
  yakalanmaz, yenilir** — mekanı tamamlamanın yolu onları alt etmektir.
  Her yakalama bir **Poke Ball** harcar; toplar Kecleon'dan satın alınır.
- **Yetenek jetonu:** Yenilen her düşman haritaya altın jeton düşürür; antrenör
  yaklaşınca toplanır. Jetonlar kütüphanede istenen Pokemona yatırılıp seviye
  yükseltilir — XP grindi yok, gelişimi siz yönlendirirsiniz.
- **Pokemon kütüphanesi (E):** Ekip ve koleksiyon burada yönetilir, jetonlar
  burada harcanır.
- **Tip etkililiği:** Her Pokemonun iyi ve kötü yönü tip tablosundan gelir
  (PokeAPI'den indirilir). Grass hamleniz Water'a 2x vurur, Fire size 2x vurur.
- **Yetenekler:** Elle yazılmış set yoksa, yakalanan Pokemonun yetenekleri
  **gerçek hamle verisinden** üretilir (güç → hasar, tip → sprite). Böylece
  "sadece resmi hamleler" kuralı veriyle garanti edilir.
- **Evrim:** Zincir PokeAPI'den alınır. Jetonla 16. seviyeye çıkardığınızda
  Bulbasaur → Ivysaur, 32'de Venusaur olur; klasik evrim sahnesi oynar ve yeni
  resmi hamle açılır: **L Leech Seed** (16), **P Petal Blizzard** (32).
- **Kayıt:** Ekip, koleksiyon, jetonlar ve rozetler localStorage'a yazılır.

### Rozetler ve saha hamleleri

Her mekanın bossunu yenmek bir rozet ve onunla bir **saha hamlesi** açar:

| Rozet | Mekan / Boss | Saha hamlesi | Etkisi |
|---|---|---|---|
| Yaprak Rozeti | Fısıltılı Orman Girişi / Golisopod | **Cut** (F) | Çalıları keser |
| Gölge Rozeti | Gölgeli Derinlikler / Hawlucha | **Rock Smash** (F) | Kayaları kırar |
| Kadim Rozet | Kadim Ağaç Meydanı / Zarude | **Surf** | Suyun üstünden geçilir |

Ana harita bu hamleler düşünülerek genişletildi (28x14): doğudaki su kanalı
Surf ile geçilen bir adaya, güneydeki kaya ve çalı duvarları Rock Smash ve Cut
ile açılan gizli köşelere çıkar. Yani eski haritalar sonradan tekrar ziyaret
edilmeye değer hâle gelir.

### Tüccar Kecleon

Bölge merkezindeki tezgahın önünde **F** ile dükkan açılır. Para birimi yetenek
jetonudur — yani her jeton için "Pokemon seviyesi mi, eşya mı?" kararı verirsiniz.

| Eşya | Fiyat | Etkisi |
|---|---|---|
| Poke Ball (5 adet) | 4 jeton | Yakalama için gerekli |
| Potion | 10 jeton | Sahadaki Pokemonun canının yarısını yeniler |
| Revive | 25 jeton | Bayılmış bir üyeyi yarı canla kaldırır |
| Ekip Toniği | 45 jeton | Tüm ekibi tamamen iyileştirir |

Çanta da aynı ekranda: alınan eşyalar oradan kullanılır. Oyuna 8 Poke Ball ile
başlanır, bitince Kecleon'a uğramak gerekir.

### Ses, durum etkileri ve diğerleri

- **Ses:** Tüm efektler ve müzik Web Audio ile koddan üretilir (ses dosyası yok):
  vuruş, süper etkili, yakalama, seviye, evrim fanfarı, boss uyanışı ve her
  haritaya göre değişen chiptune melodi.
- **Durum etkileri:** Zehir ve yanık zamanla can götürür, felç yavaşlatır.
  Zehir/ateş/elektrik tipli saldırılar ihtimalle bulaştırır; Kecleon'dan alınan
  **Panzehir** temizler.
- **Yakalama artık şansa bağlı:** Poke Ball / Great Ball / Ultra Ball farklı
  başarı oranlarına sahip; kurtulan Pokemon topu kırıp tekrar savaşır.
  Gizli Pokemonlar belirgin şekilde zor yakalanır.
- **NPC antrenör savaşları:** Her mekanda görüş alanına girince meydan okuyan
  bir antrenör var; ekibindeki Pokemonları sırayla gönderir, yenince jeton verir.
- **Pokedex:** Kütüphanede görülen/yakalanan takibi (bosslar ayrı: yakalanmaz, yenilir). Bir Pokemona tıklayınca
  **karakter bilgisi** açılır: istatistikler, hamleleri ve tipleriyle birlikte
  **hangi tiplere zayıf, hangilerine dayanıklı, hamlelerinin neye üstün olduğu**.
- **Bölge ölçeklendirmesi:** Düşmanların canı ve hasarı bölgeye göre artar
  (config/balance.js), böylece yeni bölgeler gerçekten zorlaşır.
- **Hit-stop:** Ağır vuruşlarda oyun birkaç kare donar, darbe ağırlaşır.

Sırada: 2. bölge (Ateş Dağı).

## Yeni İçerik Ekleme

- **Yeni karakter sınıfı:** `src/config/characters.js` dizisine kayıt ekleyin,
  `src/game/abilities.js` içindeki switch'e yeteneklerini yazın.
- **Yeni arena:** `src/game/arenas.js` dizisine `{ name, drawBg }` ekleyin.
- **Tuş değişikliği:** `src/config/settings.js` içindeki `PLAYERS` nesnesini düzenleyin.
