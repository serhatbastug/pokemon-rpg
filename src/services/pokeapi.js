// PokeAPI erişim katmanı. API ile ilgili her şey bu dosyada kalır.
// Yanıtlar apiCache üzerinden önbelleğe alınır: aynı istek iki kez atılmaz
// ve sonraki açılışlarda localStorage'dan okunur.
import { cachedJson } from './apiCache.js';

const API_BASE = 'https://pokeapi.co/api/v2';

// Tek bir sınıf tanımını PokeAPI verisiyle birleştirip oynanabilir karaktere çevirir
export async function fetchCharacter(charClass) {
    const data = await cachedJson(
        `${API_BASE}/pokemon/${charClass.id}`,
        `pokemon:${charClass.id}`,
        // Yanıtın tamamı çok büyük; yalnızca kullandığımız alanları saklarız
        (raw) => ({
            name: raw.name,
            sprites: {
                front_default: raw.sprites.front_default,
                other: { 'official-artwork': { front_default: raw.sprites.other['official-artwork'].front_default } }
            },
            types: raw.types,
            stats: raw.stats,
            moves: raw.moves.map(m => ({
                move: { name: m.move.name },
                version_group_details: m.version_group_details.map(d => ({
                    move_learn_method: { name: d.move_learn_method.name }
                }))
            }))
        })
    );

    // Kart görselleri için resmi çizim, savaş alanı için piksel sprite kullanılır
    const officialArtwork = data.sprites.other['official-artwork'].front_default || data.sprites.front_default;

    // Oyunun resmi temel statları (macera modunda seviye formüllerinde kullanılır)
    const stat = (name) => data.stats.find(s => s.stat.name === name)?.base_stat ?? 50;
    const apiStats = {
        hp: stat('hp'),
        attack: stat('attack'),
        defense: stat('defense'),
        speed: stat('speed')
    };

    return {
        ...charClass,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        sprite: officialArtwork,
        battleSprite: data.sprites.front_default,
        types: data.types.map(t => t.type.name),
        // Hamle listesi: yakalanan Pokemonların yetenek setini üretmek için
        // (services/moveAbilities.js) gereklidir
        moves: data.moves,
        apiStats,
        // İki kişilik modun elle dengelenmiş statları varsa korunur
        baseStats: charClass.baseStats ?? apiStats
    };
}

// Bir Pokemonun evrim zincirini sırayla döndürür:
// [{ id, name, minLevel }] — minLevel, o forma geçmek için gereken seviye.
// Evrimleşmeyen Pokemonlarda tek elemanlı dizi döner.
export async function fetchEvolutionChain(id) {
    const species = await cachedJson(
        `${API_BASE}/pokemon-species/${id}`,
        `species:${id}`,
        (raw) => ({ evolution_chain: raw.evolution_chain })
    );

    const { chain } = await cachedJson(
        species.evolution_chain.url,
        `chain:${species.evolution_chain.url}`,
        (raw) => ({ chain: raw.chain })
    );

    // URL'den tür numarasını çıkarır: .../pokemon-species/2/ -> 2
    const idFromUrl = (url) => Number(url.split('/').filter(Boolean).pop());

    const stages = [];
    let node = chain;
    while (node) {
        const detail = node.evolution_details?.[0];
        stages.push({
            id: idFromUrl(node.species.url),
            name: node.species.name,
            minLevel: detail?.min_level ?? null
        });
        // Dallanan zincirlerde (ör. Eevee) ilk dal izlenir
        node = node.evolves_to?.[0];
    }
    return stages;
}

// Tüm sınıfları sırayla yükler; her karakter hazır oldukça onLoaded çağrılır
export async function loadCharacters(classes, onLoaded) {
    const characters = [];
    for (const charClass of classes) {
        try {
            const character = await fetchCharacter(charClass);
            characters.push(character);
            if (onLoaded) onLoaded(character);
        } catch (error) {
            console.error(`Pokemon #${charClass.id} yüklenemedi:`, error);
        }
    }
    return characters;
}
