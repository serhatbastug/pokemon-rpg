// Oynanış denge ayarları. Kodun içine dağılmış sihirli sayılar burada toplanır
// ki bir davranışı değiştirmek için dosya aramak gerekmesin.
// Süreler kare (frame) cinsindendir: 60 kare = 1 saniye.

export const TRAINER = {
    speed: 3.4,
    hitbox: { w: 24, h: 16 }, // ayak hizasındaki çarpışma kutusu
    spriteScale: 3
};

export const DEPLOY = {
    throwDistance: 120,  // topun antrenörden ne kadar öteye düştüğü
    flightFrames: 18,    // topun havada kalma süresi
    swapCooldown: 20,    // ardışık fırlatmalar arası bekleme
    leashRange: 430,     // bu mesafeyi aşarsa Pokemon topuna döner
    spawnInvuln: 30      // sahaya çıkışta kısa dokunulmazlık
};

export const ACTIVE_POKEMON = {
    size: 62,
    hitInvuln: 45,       // hasar sonrası dokunulmazlık
    hitFlash: 20,
    retreatRange: 90,    // düşman bu kadar yaklaşırsa geri çekilir
    advanceRange: 240,   // bu kadar uzaklaşırsa biraz yaklaşır
    holdSpeedFactor: 0.5 // yerini tutarken hız çarpanı
};

export const ENEMY = {
    contactDamage: 8,
    contactCooldown: 60,
    windupFrames: 18,     // saldırı öncesi telegraf (ünlem + titreme)
    retreatRange: 110,    // oyuncuya bu kadar yaklaşınca geri çekilir
    aggroDropTiles: 5,    // fark etme mesafesine eklenen bırakma payı
    wakeRange: 150,       // uyuyan bossun uyanma mesafesi
    wakeShotRange: 320    // yakınında ateş edilince uyanma mesafesi
};

export const CATCH = {
    throwRange: 110,      // bayılmış Pokemona en fazla bu mesafeden atılır
    flightFrames: 15,
    totalFrames: 55       // uçuş + sallanma
};

export const TOKENS = {
    magnetRange: 70,      // jetonlar bu mesafeden antrenöre çekilir
    pickupRange: 22,
    lifeFrames: 3600,     // ~1 dakika sonra kaybolur
    magnetStrength: 0.16
};

export const AIM = {
    autoTargetRange: 420  // yeteneklerin kendiliğinden nişan aldığı menzil
};

export const MAP = {
    portalCooldown: 45,   // haritaya girişte portala tekrar düşmeyi engeller
    portalRange: 24,      // portalın tetiklenme yarıçapı
    shopRange: 80         // tezgahın önünde sayılma mesafesi
};

export const VICTORY = {
    tokenGraceFrames: 420, // boss jetonlarını toplamak için tanınan süre
    minGraceFrames: 60,    // jetonlar erken toplanırsa kalan kısa bekleme
    dismissAfter: 90       // bu kareden sonra tuşla kapatılabilir
};
