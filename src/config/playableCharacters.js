// Elle yazılmış yetenek setleri (override).
// Bu listede olmayan Pokemonların yetenekleri, PokeAPI'deki gerçek hamle
// verisinden otomatik üretilir (services/moveAbilities.js) - böylece
// yakalanabilecek onlarca Pokemon için elle set yazmak gerekmez.
// KURAL: her yetenek o Pokemonun PokeAPI'de doğrulanmış resmi hamlesidir.
// key/code: klavye tuşu · type: projectileSprites.js sprite anahtarı
// unlockLevel: bu yeteneğin açıldığı seviye (evrimle birlikte gelenler)
// kind: 'projectile' (mermi) | 'aoe' (çevreye alan etkisi) | 'heal' (iyileşme)

const ABILITY_KEYS = [
    { key: 'K', code: 'KeyK' },
    { key: 'O', code: 'KeyO' },
    { key: 'Ş', code: 'Semicolon', altKey: 'ş' },
    { key: 'L', code: 'KeyL' },
    { key: 'P', code: 'KeyP' }
];

export const PLAYABLE = {
    // Başlangıç: Bulbasaur hattı. Evrimle iki yeni yetenek açılır.
    // (Petal Blizzard yalnızca Venusaur'un havuzunda vardır - 32. seviye)
    1: {
        starter: true,
        abilities: [
            { name: 'Razor Leaf', kind: 'projectile', moveType: 'grass', type: 'leaf', cooldown: 30, damage: 10, speed: 9, life: 55, unlockLevel: 1 },
            { name: 'Seed Bomb', kind: 'projectile', moveType: 'grass', type: 'seedbomb', cooldown: 120, damage: 25, speed: 7, life: 80, pierce: true, unlockLevel: 1 },
            { name: 'Sleep Powder', kind: 'aoe', moveType: 'grass', type: 'sleep', cooldown: 420, radius: 150, stun: 150, unlockLevel: 1 },
            // Ivysaur (16): hasar verir ve verdiği hasarın yarısını cana çevirir
            { name: 'Leech Seed', kind: 'projectile', moveType: 'grass', type: 'poison', cooldown: 180, damage: 16, speed: 6.5, life: 70, leech: 0.5, unlockLevel: 16 },
            // Venusaur (32): çevreye alan hasarı
            { name: 'Petal Blizzard', kind: 'aoe', moveType: 'grass', type: 'petal', cooldown: 300, radius: 190, damage: 30, unlockLevel: 32 }
        ]
    },

    // Golisopod: ağır zırhlı, yakın mesafede yıkıcı
    768: {
        abilities: [
            { name: 'Pin Missile', kind: 'projectile', moveType: 'bug', type: 'pinmissile', cooldown: 40, damage: 8, speed: 10, life: 50, spread: 3, unlockLevel: 1 },
            { name: 'Liquidation', kind: 'projectile', moveType: 'water', type: 'water', cooldown: 150, damage: 30, speed: 8, life: 60, unlockLevel: 1 },
            { name: 'First Impression', kind: 'dash', moveType: 'bug', cooldown: 360, distance: 220, damage: 45, unlockLevel: 1 }
        ]
    },

    // Hawlucha: çok hızlı, kırılgan, havadan saldırır
    701: {
        abilities: [
            { name: 'Aerial Ace', kind: 'projectile', moveType: 'flying', type: 'wind', cooldown: 25, damage: 9, speed: 12, life: 45, unlockLevel: 1 },
            { name: 'Flying Press', kind: 'projectile', moveType: 'fighting', type: 'focusblast', cooldown: 140, damage: 22, speed: 7, life: 65, spread: 2, unlockLevel: 1 },
            { name: 'Sky Attack', kind: 'projectile', moveType: 'flying', type: 'sky', cooldown: 400, damage: 50, speed: 9, life: 90, pierce: true, unlockLevel: 1 }
        ]
    },

    // Zarude: dengeli; tek kendini iyileştirebilen karakter
    893: {
        abilities: [
            { name: 'Power Whip', kind: 'projectile', moveType: 'grass', type: 'leaf', cooldown: 35, damage: 11, speed: 10, life: 55, spread: 3, unlockLevel: 1 },
            { name: 'Dark Pulse', kind: 'projectile', moveType: 'dark', type: 'shadowball', cooldown: 130, damage: 26, speed: 7.5, life: 70, unlockLevel: 1 },
            { name: 'Jungle Healing', kind: 'heal', moveType: 'grass', cooldown: 540, heal: 0.35, unlockLevel: 1 }
        ]
    }
};

// Elle yazılmış set varsa seviyeye göre filtreleyip döndürür, yoksa null
export function abilityOverride(characterId, level) {
    const entry = PLAYABLE[characterId];
    if (!entry) return null;
    return entry.abilities.filter(a => level >= (a.unlockLevel ?? 1));
}

// Bu seviyede yeni açılan yetenekler (seviye atlama bildirimi için)
export function abilitiesUnlockedAt(characterId, level) {
    const entry = PLAYABLE[characterId];
    if (!entry) return [];
    return entry.abilities.filter(a => a.unlockLevel === level);
}

// Yetenek listesine tuşlarını ekler (K, O, Ş, L, P sırasıyla)
export function withKeys(abilities) {
    return abilities.map((a, i) => ({ ...a, ...ABILITY_KEYS[i] }));
}
