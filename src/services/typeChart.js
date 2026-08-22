// Tip etkililik tablosu. Veriler PokeAPI'den alınır (elle kodlanmaz),
// bir kez indirilip önbelleğe alınır.
import { cachedJson } from './apiCache.js';

const API_BASE = 'https://pokeapi.co/api/v2';

const cache = new Map();       // tip adı -> { double, half, none } (Set)
const pending = new Map();

async function fetchType(name) {
    if (cache.has(name)) return cache.get(name);
    if (pending.has(name)) return pending.get(name);

    const promise = cachedJson(
        `${API_BASE}/type/${name}`,
        `type:${name}`,
        (raw) => ({ damage_relations: raw.damage_relations })
    )
        .then(data => {
            const rel = data.damage_relations;
            const entry = {
                double: new Set(rel.double_damage_to.map(t => t.name)),
                half: new Set(rel.half_damage_to.map(t => t.name)),
                none: new Set(rel.no_damage_to.map(t => t.name))
            };
            cache.set(name, entry);
            return entry;
        })
        .catch(error => {
            console.warn(`Tip verisi alınamadı (${name}):`, error);
            const empty = { double: new Set(), half: new Set(), none: new Set() };
            cache.set(name, empty);
            return empty;
        });

    pending.set(name, promise);
    return promise;
}

// Oyunda kullanılan tipleri önden yükler (savaş sırasında bekleme olmasın)
export async function preloadTypes(types) {
    await Promise.all([...new Set(types)].map(fetchType));
}

// Saldıran tipin savunan tiplere karşı çarpanı (0, 0.25, 0.5, 1, 2, 4).
// Veri henüz gelmediyse 1 döner (savaş takılmaz).
export function effectiveness(attackType, defenderTypes = []) {
    const entry = cache.get(attackType);
    if (!entry || !defenderTypes.length) return 1;

    let multiplier = 1;
    for (const defType of defenderTypes) {
        if (entry.none.has(defType)) return 0;
        if (entry.double.has(defType)) multiplier *= 2;
        else if (entry.half.has(defType)) multiplier *= 0.5;
    }
    return multiplier;
}

// Pokemon oyunlarındaki 18 tip
export const ALL_TYPES = [
    'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
    'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

// Türkçe tip adları (arayüzde gösterim için)
export const TYPE_NAMES_TR = {
    normal: 'Normal', fire: 'Ateş', water: 'Su', electric: 'Elektrik', grass: 'Bitki',
    ice: 'Buz', fighting: 'Dövüş', poison: 'Zehir', ground: 'Toprak', flying: 'Uçan',
    psychic: 'Psişik', bug: 'Böcek', rock: 'Kaya', ghost: 'Hayalet', dragon: 'Ejderha',
    dark: 'Karanlık', steel: 'Çelik', fairy: 'Peri'
};

export const TYPE_COLORS = {
    normal: '#a8a878', fire: '#f97316', water: '#3b82f6', electric: '#facc15',
    grass: '#22c55e', ice: '#7dd3fc', fighting: '#dc2626', poison: '#a855f7',
    ground: '#ca8a04', flying: '#93c5fd', psychic: '#ec4899', bug: '#84cc16',
    rock: '#a16207', ghost: '#7e22ce', dragon: '#6366f1', dark: '#475569',
    steel: '#94a3b8', fairy: '#f472b6'
};

// Bir Pokemonun savunma profili: hangi tiplere zayıf, hangilerine dayanıklı.
// Tüm tipler önceden yüklenmiş olmalıdır (preloadTypes(ALL_TYPES)).
export function defensiveProfile(defenderTypes = []) {
    const weakTo = [];
    const resists = [];
    const immune = [];

    for (const attackType of ALL_TYPES) {
        const multiplier = effectiveness(attackType, defenderTypes);
        if (multiplier === 0) immune.push({ type: attackType, multiplier });
        else if (multiplier > 1) weakTo.push({ type: attackType, multiplier });
        else if (multiplier < 1) resists.push({ type: attackType, multiplier });
    }

    // Önce en tehlikeli/en faydalı olanlar
    weakTo.sort((a, b) => b.multiplier - a.multiplier);
    resists.sort((a, b) => a.multiplier - b.multiplier);
    return { weakTo, resists, immune };
}

// Pokemonun kendi hamlelerinin hangi tiplere üstün olduğu
export function offensiveProfile(moveTypes = []) {
    const strongAgainst = new Map();

    for (const moveType of new Set(moveTypes)) {
        for (const defenderType of ALL_TYPES) {
            const multiplier = effectiveness(moveType, [defenderType]);
            if (multiplier > 1) {
                const existing = strongAgainst.get(defenderType);
                if (!existing || multiplier > existing.multiplier) {
                    strongAgainst.set(defenderType, { type: defenderType, multiplier, via: moveType });
                }
            }
        }
    }
    return [...strongAgainst.values()];
}

// Oyuncuya gösterilecek etiket
export function effectivenessLabel(multiplier) {
    if (multiplier === 0) return { text: 'ETKİSİZ!', color: '#94a3b8' };
    if (multiplier >= 2) return { text: 'SÜPER ETKİLİ!', color: '#4ade80' };
    if (multiplier <= 0.5) return { text: 'etkisi az', color: '#94a3b8' };
    return null;
}
