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

// Oyuncuya gösterilecek etiket
export function effectivenessLabel(multiplier) {
    if (multiplier === 0) return { text: 'ETKİSİZ!', color: '#94a3b8' };
    if (multiplier >= 2) return { text: 'SÜPER ETKİLİ!', color: '#4ade80' };
    if (multiplier <= 0.5) return { text: 'etkisi az', color: '#94a3b8' };
    return null;
}
