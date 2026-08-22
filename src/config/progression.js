// Seviye, yetenek jetonu (skill token) ve stat büyümesi.
// XP yok: yenilen düşmanlar jeton düşürür, oyuncu jetonu istediği Pokemona yatırır.

export const MAX_LEVEL = 50;
export const PARTY_SIZE = 6;

// Yenilen düşmandan düşen jeton sayısı
export const TOKEN_DROP = {
    common: 2,
    hidden: 6,
    boss: 12,
    regionBoss: 25
};

// Bir Pokemonu (level) seviyesinden bir üste çıkarmanın jeton maliyeti.
// 1. bölge yaklaşık 120 jeton verir; bu da bir Pokemonu 16'ya (ilk evrim) taşır.
export function levelUpCost(level) {
    return 2 + Math.floor(level / 3);
}

export const STARTING_LEVEL = 5;

// Temel statlardan (PokeAPI) savaş değerleri türetilir
export function maxHpFor(baseHp, level) {
    return Math.round(baseHp * 1.6) + level * 5;
}

export function speedFor(baseSpeed) {
    return +(2.4 + baseSpeed * 0.016).toFixed(2);
}

export function damageMultiplierFor(baseAttack, level) {
    return +((0.7 + baseAttack / 170) * (1 + (level - 1) * 0.02)).toFixed(3);
}
