// Oynanabilir karakterlerin yetenek setleri.
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
            { name: 'Razor Leaf', kind: 'projectile', type: 'leaf', cooldown: 30, damage: 10, speed: 9, life: 55, unlockLevel: 1 },
            { name: 'Seed Bomb', kind: 'projectile', type: 'seedbomb', cooldown: 120, damage: 25, speed: 7, life: 80, pierce: true, unlockLevel: 1 },
            { name: 'Sleep Powder', kind: 'aoe', type: 'sleep', cooldown: 420, radius: 150, stun: 150, unlockLevel: 1 },
            // Ivysaur (16): hasar verir ve verdiği hasarın yarısını cana çevirir
            { name: 'Leech Seed', kind: 'projectile', type: 'poison', cooldown: 180, damage: 16, speed: 6.5, life: 70, leech: 0.5, unlockLevel: 16 },
            // Venusaur (32): çevreye alan hasarı
            { name: 'Petal Blizzard', kind: 'aoe', type: 'petal', cooldown: 300, radius: 190, damage: 30, unlockLevel: 32 }
        ]
    },

    // Golisopod: ağır zırhlı, yakın mesafede yıkıcı
    768: {
        abilities: [
            { name: 'Pin Missile', kind: 'projectile', type: 'pinmissile', cooldown: 40, damage: 8, speed: 10, life: 50, spread: 3, unlockLevel: 1 },
            { name: 'Liquidation', kind: 'projectile', type: 'water', cooldown: 150, damage: 30, speed: 8, life: 60, unlockLevel: 1 },
            { name: 'First Impression', kind: 'dash', cooldown: 360, distance: 220, damage: 45, unlockLevel: 1 }
        ]
    },

    // Hawlucha: çok hızlı, kırılgan, havadan saldırır
    701: {
        abilities: [
            { name: 'Aerial Ace', kind: 'projectile', type: 'wind', cooldown: 25, damage: 9, speed: 12, life: 45, unlockLevel: 1 },
            { name: 'Flying Press', kind: 'projectile', type: 'focusblast', cooldown: 140, damage: 22, speed: 7, life: 65, spread: 2, unlockLevel: 1 },
            { name: 'Sky Attack', kind: 'projectile', type: 'sky', cooldown: 400, damage: 50, speed: 9, life: 90, pierce: true, unlockLevel: 1 }
        ]
    },

    // Zarude: dengeli; tek kendini iyileştirebilen karakter
    893: {
        abilities: [
            { name: 'Power Whip', kind: 'projectile', type: 'leaf', cooldown: 35, damage: 11, speed: 10, life: 55, spread: 3, unlockLevel: 1 },
            { name: 'Dark Pulse', kind: 'projectile', type: 'shadowball', cooldown: 130, damage: 26, speed: 7.5, life: 70, unlockLevel: 1 },
            { name: 'Jungle Healing', kind: 'heal', cooldown: 540, heal: 0.35, unlockLevel: 1 }
        ]
    }
};

// Bir karakterin belirli seviyede kullanabildiği yetenekler (tuşlarıyla birlikte)
export function abilitiesFor(characterId, level) {
    const entry = PLAYABLE[characterId] || PLAYABLE[1];
    return entry.abilities
        .filter(a => level >= a.unlockLevel)
        .map((a, i) => ({ ...a, ...ABILITY_KEYS[i] }));
}

// Bu seviyede yeni açılan yetenekler (seviye atlama bildirimi için)
export function abilitiesUnlockedAt(characterId, level) {
    const entry = PLAYABLE[characterId] || PLAYABLE[1];
    return entry.abilities.filter(a => a.unlockLevel === level);
}

export function isPlayable(id) {
    return !!PLAYABLE[id];
}
