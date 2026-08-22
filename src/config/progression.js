// Seviye, deneyim ve stat büyümesi. Tüm formüller tek yerde toplanır ki
// denge ayarı yaparken başka dosyaya dokunmak gerekmesin.

export const MAX_LEVEL = 50;

// Bir sonraki seviyeye gereken XP (seviye ilerledikçe artar).
// 1. bölgeyi tamamlamak oyuncuyu ~16. seviyeye, yani ilk evrime getirir.
export function xpToNext(level) {
    return 40 + level * 20;
}

// Düşman türüne göre verilen deneyim
export const XP_REWARD = {
    common: 45,
    hidden: 150,
    boss: 350,
    regionBoss: 600
};

// Yakalamak, sadece bayıltmaya göre ek ödül verir
export const CAPTURE_XP_BONUS = 0.5;

// Temel statlardan (PokeAPI) oyuncu değerleri türetilir
export function maxHpFor(baseHp, level) {
    return Math.round(baseHp * 2) + (level - 1) * 4;
}

export function speedFor(baseSpeed) {
    return +(2.6 + baseSpeed * 0.018).toFixed(2);
}

export function damageMultiplierFor(baseAttack, level) {
    return +((0.7 + baseAttack / 160) * (1 + (level - 1) * 0.02)).toFixed(3);
}
