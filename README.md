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

Puppeteer ile uçtan uca UI testleri (32 test): ekran geçişleri, karakter seçimi,
savaş, harita gezinme, portallar, yetenekler, yakalama, gizli oda, boss uyanışı,
zafer sahnesi ve her ekranda FPS ölçümü.

```
npm start           # ayrı bir terminalde sunucu çalışıyor olmalı
npm test
```

Ekran görüntüleri `tests/screenshots/` altına yazılır (git'e dahil değil).

## Kontroller

| | Oyuncu 1 | Oyuncu 2 |
|---|---|---|
| Hareket | W A S D | Yön tuşları |
| Yetenek 1 | F | Sağ Shift |
| Yetenek 2 | Sol Shift | , (virgül) |
| Yetenek 3 (Ulti) | Space | Enter |

## Proje Yapısı

```
index.html              Uygulama iskeleti (ekranlar, HUD, canvas)
style.css               Tüm stiller
src/
  main.js               Giriş noktası; modülleri kurup birbirine bağlar
  config/
    characters.js       Karakter sınıfları ve Pokemon ID eşleşmeleri
    settings.js         Fizik sabitleri, tuş atamaları, oyuncu ayarları
    progression.js      Seviye/XP eğrisi ve stat formülleri
    playableCharacters.js  Oynanabilir karakterlerin resmi hamle setleri
    regions.js          Macera modu bölgeleri (5 bölge, portal renkleri)
    worldMap.js         Ana harita karo verisi ve portal konumları
  core/
    input.js            Klavye durumu takibi (InputManager)
  services/
    pokeapi.js          PokeAPI erişim katmanı
  game/
    Game.js             Oyun motoru: döngü, çarpışmalar, tur durumu
    Player.js           Oyuncu: hareket, fizik, can, durum etkileri
    Projectile.js       Mermiler ve çizim stilleri
    abilities.js        Sınıf bazlı yetenek tanımları
    arenas.js           Pixel art arena arka planları
    effects.js          Parçacıklar, sarsıntı, flaş, uçan yazılar
    projectileSprites.js Kare kare pixel art mermi sprite desenleri
  world/
    Overworld.js        Macera modu: kuşbakışı harita motoru
  world/
    Enemy.js            Düşman Pokemon: AI, saldırı, durum
    Progress.js         Seviye, deneyim, koleksiyon ve localStorage kaydı
  ui/
    characterSelect.js  Karakter seçim ekranı ve detay modalı
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
uyuyan ve uyanınca arenayı parçalayan boss, bossu Pokeball'a alınca zafer sahnesi.

### Seviye, evrim ve koleksiyon

- **Seviye:** Yenilen ve yakalanan Pokemonlardan XP kazanılır; seviye atlayınca
  can/hasar artar ve can tamamen dolar. 1. bölgeyi bitirmek ~16. seviyeye getirir.
- **Evrim:** Zincir PokeAPI'den alınır (elle kodlanmaz). Bulbasaur 16'da Ivysaur,
  32'de Venusaur olur; klasik evrim sahnesi (silüet geçişi + parlama) oynar.
  Her evrim yeni bir resmi hamle açar: **L Leech Seed** (16), **P Petal Blizzard** (32).
- **Oynanabilir bosslar:** Yakalanan bosslar karakter olarak seçilebilir —
  Golisopod (Pin Missile / Liquidation / First Impression),
  Hawlucha (Aerial Ace / Flying Press / Sky Attack),
  Zarude (Power Whip / Dark Pulse / Jungle Healing).
- **Kayıt:** İlerleme localStorage'a yazılır; karakter seçim ekranından sıfırlanabilir.

Sırada: 2. bölge (Ateş Dağı), Kecleon dükkanında alışveriş.

## Yeni İçerik Ekleme

- **Yeni karakter sınıfı:** `src/config/characters.js` dizisine kayıt ekleyin,
  `src/game/abilities.js` içindeki switch'e yeteneklerini yazın.
- **Yeni arena:** `src/game/arenas.js` dizisine `{ name, drawBg }` ekleyin.
- **Tuş değişikliği:** `src/config/settings.js` içindeki `PLAYERS` nesnesini düzenleyin.
