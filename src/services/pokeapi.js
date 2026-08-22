// PokeAPI erişim katmanı. API ile ilgili her şey bu dosyada kalır.
const API_BASE = 'https://pokeapi.co/api/v2';

// Tek bir sınıf tanımını PokeAPI verisiyle birleştirip oynanabilir karaktere çevirir
export async function fetchCharacter(charClass) {
    const response = await fetch(`${API_BASE}/pokemon/${charClass.id}`);
    if (!response.ok) {
        throw new Error(`PokeAPI ${response.status}: pokemon/${charClass.id}`);
    }
    const data = await response.json();

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
    const speciesRes = await fetch(`${API_BASE}/pokemon-species/${id}`);
    if (!speciesRes.ok) throw new Error(`PokeAPI ${speciesRes.status}: pokemon-species/${id}`);
    const species = await speciesRes.json();

    const chainRes = await fetch(species.evolution_chain.url);
    if (!chainRes.ok) throw new Error(`PokeAPI ${chainRes.status}: evolution-chain`);
    const { chain } = await chainRes.json();

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
