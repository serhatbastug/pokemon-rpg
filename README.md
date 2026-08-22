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
  ui/
    characterSelect.js  Karakter seçim ekranı ve detay modalı
    hud.js              Can barları ve cooldown göstergeleri
    screens.js          Ekranlar arası geçişler
```

## Macera Modu (geliştirme aşamasında)

Undertale tarzı, kuşbakışı tek kişilik mod. Plan: 5 bölge x 3 mekan x 5 Pokemon
(3 yaygın + 1 boss + 1 gizli) = 75 karakter. Yetenekler o Pokemonun resmi
hamlelerinden seçilir. Maceraya Bulbasaur (#1) ile başlanır.

Şu an: ana harita, 1. bölge (Vahşi Orman) ve ilk mekan (Fısıltılı Orman Girişi)
gezilebilir; portallar haritalar arasında geçiş yapar, açılmamış içeriğin
portalları soluk/pasif görünür. 1. bölgenin tüm Pokemon listeleri regions.js'te.
Sırada: haritada Pokemon karşılaşmaları, harita üzerinde savaş, evrim mekaniği.

## Yeni İçerik Ekleme

- **Yeni karakter sınıfı:** `src/config/characters.js` dizisine kayıt ekleyin,
  `src/game/abilities.js` içindeki switch'e yeteneklerini yazın.
- **Yeni arena:** `src/game/arenas.js` dizisine `{ name, drawBg }` ekleyin.
- **Tuş değişikliği:** `src/config/settings.js` içindeki `PLAYERS` nesnesini düzenleyin.
