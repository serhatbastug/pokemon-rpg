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

    return {
        ...charClass,
        name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
        sprite: officialArtwork,
        battleSprite: data.sprites.front_default,
        types: data.types.map(t => t.type.name)
    };
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
