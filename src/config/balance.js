// Oynanış denge ayarları. Kodun içine dağılmış sihirli sayılar burada toplanır
// ki bir davranışı değiştirmek için dosya aramak gerekmesin.
// Süreler kare (frame) cinsindendir: 60 kare = 1 saniye.

export const TRAINER = {
    speed: 3.4,
    hitbox: { w: 24, h: 16 }, // ayak hizasındaki çarpışma kutusu
    spriteScale: 3,

    // Antrenör de hasar alır: kaçınma (zıplama/dash) oynanışın merkezinde
    maxHp: 60,
    hitRadius: 18,        // mermilerin antrenöre isabet yarıçapı
    hitInvuln: 70,        // hasar sonrası dokunulmazlık kareleri
    contactDamage: 6      // düşman teması antrenöre bu kadar vurur
};

// Kaçınma hareketleri
export const DODGE = {
    // Space: zıplama - havadayken yerdeki mermiler altından geçer
    jumpFrames: 34,
    jumpHeight: 26,       // piksel cinsinden görsel yükseklik
    jumpCooldown: 24,
    jumpInvulnFrom: 6,    // zıplamanın kaçıncı karesinden itibaren korunur
    jumpInvulnTo: 26,

    // Shift: atılım - kısa mesafe, tam dokunulmazlık
    dashFrames: 12,
    dashSpeed: 9.5,
    dashCooldown: 70,
    dashInvuln: 16
};

// Sahadaki Pokemonun kendi kendine savaşması
export const AUTO_BATTLE = {
    scanRange: 360,       // hedef arama menzili
    decisionEvery: 8,     // kaç karede bir karar verir
    healBelow: 0.45,      // canı bu oranın altındaysa iyileşme hamlesi kullanır
    minRange: 60          // bu kadar yakındaki hedefe de saldırır
};

// Durum etkileri (zehir, yanma, felç)
export const STATUS = {
    poison: { duration: 300, tickEvery: 60, damage: 4, color: '#a855f7', label: 'ZEHİR' },
    burn: { duration: 300, tickEvery: 60, damage: 5, color: '#f97316', label: 'YANIK' },
    paralysis: { duration: 240, slow: 0.45, color: '#facc15', label: 'FELÇ' },
    // Saldırı tipine göre uygulanma ihtimali
    chance: { poison: 0.3, fire: 0.25, electric: 0.3 }
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
    wobbleFrames: 14,     // her sallanma bir "acaba?" anıdır
    wobbles: 3,

    // Yakalama şansı: temel oran x top çarpanı x tür zorluğu.
    // Bayılmış Pokemon zaten zayıflamış sayılır, taban yüksek tutulur.
    baseRate: 0.55,
    kindModifier: { common: 1, hidden: 0.55, boss: 0, regionBoss: 0 }
};

// Düşmanların bölgeye göre güçlenmesi (2. bölge 1.'den belirgin sert olmalı)
export const REGION_SCALING = {
    1: { hp: 1, damage: 1, level: 5 },
    2: { hp: 1.6, damage: 1.35, level: 14 },
    3: { hp: 2.3, damage: 1.7, level: 24 },
    4: { hp: 3.2, damage: 2.1, level: 34 },
    5: { hp: 4.2, damage: 2.6, level: 44 }
};

// Ağır vuruşlarda oyunu birkaç kare dondurmak darbeyi ağırlaştırır
export const HIT_STOP = {
    threshold: 18,        // bu hasarın üstü "ağır" sayılır
    frames: 3
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
