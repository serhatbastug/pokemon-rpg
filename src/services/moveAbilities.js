// Yakalanan Pokemonların yetenek setini GERÇEK hamle verisinden üretir.
// Böylece "sadece resmi hamleler" kuralı elle takip edilmek yerine veriyle
// garanti edilir ve 45+ Pokemon için elle set yazmak gerekmez.
//
// PokeAPI her hamle için güç, tip, sınıf (physical/special/status), isabet ve
// öncelik verir; bunları oyunun yetenek biçimine çeviririz.
const API_BASE = 'https://pokeapi.co/api/v2';

const moveCache = new Map();

// Hamle tipi -> mermi sprite'ı (projectileSprites.js anahtarları)
const TYPE_SPRITE = {
    grass: 'leaf',
    fire: 'ember',
    water: 'water',
    electric: 'lightning',
    ice: 'ice',
    poison: 'poison',
    bug: 'xscissor',
    flying: 'sky',
    ghost: 'shadowball',
    dark: 'shadowball',
    psychic: 'hypnosis',
    fighting: 'focusblast',
    steel: 'magnetbomb',
    rock: 'seedbomb',
    ground: 'seedbomb',
    dragon: 'fireblast',
    fairy: 'petal',
    normal: 'slash'
};

// Durum hamlelerinden oyunda karşılığı olanlar
const STATUS_EFFECTS = {
    'sleep-powder': { kind: 'aoe', type: 'sleep', radius: 150, stun: 150, cooldown: 420 },
    'spore': { kind: 'aoe', type: 'sleep', radius: 160, stun: 180, cooldown: 420 },
    'hypnosis': { kind: 'aoe', type: 'sleep', radius: 140, stun: 150, cooldown: 400 },
    'sing': { kind: 'aoe', type: 'sleep', radius: 140, stun: 150, cooldown: 400 },
    'synthesis': { kind: 'heal', heal: 0.3, cooldown: 500 },
    'recover': { kind: 'heal', heal: 0.35, cooldown: 520 },
    'rest': { kind: 'heal', heal: 0.5, cooldown: 700 },
    'roost': { kind: 'heal', heal: 0.35, cooldown: 520 },
    'jungle-healing': { kind: 'heal', heal: 0.35, cooldown: 540 },
    'agility': { kind: 'buff', speedBoost: 1.6, duration: 240, cooldown: 480 },
    'swords-dance': { kind: 'buff', damageBoost: 1.6, duration: 300, cooldown: 520 },
    'growth': { kind: 'buff', damageBoost: 1.4, duration: 300, cooldown: 460 }
};

async function fetchMove(name) {
    if (moveCache.has(name)) return moveCache.get(name);

    const promise = fetch(`${API_BASE}/move/${name}`)
        .then(res => (res.ok ? res.json() : null))
        .catch(() => null);

    moveCache.set(name, promise);
    return promise;
}

// Hamle verisini oynanabilir yeteneğe çevirir
function toAbility(move) {
    const type = move.type.name;
    const status = STATUS_EFFECTS[move.name];

    if (status) {
        return {
            name: prettyName(move.name),
            moveType: type,
            cooldown: status.cooldown,
            ...status
        };
    }

    if (!move.power) return null; // oyunda karşılığı olmayan durum hamlesi

    // Güç -> hasar; güçlü hamleler daha uzun beklemeli ve daha yavaş
    const power = move.power;
    const damage = Math.round(6 + power * 0.32);
    const cooldown = Math.round(25 + power * 1.6);
    const speed = +(11 - power * 0.03).toFixed(1);

    return {
        name: prettyName(move.name),
        kind: 'projectile',
        moveType: type,
        type: TYPE_SPRITE[type] || 'slash',
        damage,
        cooldown: Math.min(cooldown, 420),
        speed: Math.max(5, speed),
        life: 70,
        // Çok güçlü hamleler duvar deler, çabuk hamleler yelpaze atar
        pierce: power >= 110,
        spread: power <= 45 ? 2 : 1
    };
}

function prettyName(slug) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Bir Pokemonun (PokeAPI verisi) yetenek setini üretir: en fazla 3 hamle.
// Bir hızlı saldırı, bir ağır saldırı ve varsa bir durum/destek hamlesi seçilir.
export async function buildAbilities(pokemonData) {
    // Seviye ile öğrenilen hamleler önceliklidir (o Pokemonun "kendi" hamleleri)
    const levelUp = pokemonData.moves
        .filter(m => m.version_group_details.some(d => d.move_learn_method.name === 'level-up'))
        .map(m => m.move.name);
    // İstek sayısını sınırlı tut: 12 aday hem çeşitlilik hem hız için yeterli
    const candidates = (levelUp.length >= 4 ? levelUp : pokemonData.moves.map(m => m.move.name)).slice(0, 12);

    const moves = (await Promise.all(candidates.map(fetchMove))).filter(Boolean);
    const abilities = moves.map(toAbility).filter(Boolean);

    const attacks = abilities.filter(a => a.kind === 'projectile').sort((a, b) => a.damage - b.damage);
    const support = abilities.find(a => a.kind !== 'projectile');

    const chosen = [];
    if (attacks.length) chosen.push(attacks[0]);                       // hızlı, düşük hasar
    if (attacks.length > 1) chosen.push(attacks[attacks.length - 1]);  // ağır vuruş
    if (support) chosen.push(support);
    else if (attacks.length > 2) chosen.push(attacks[Math.floor(attacks.length / 2)]);

    // Hiç uygun hamle bulunamazsa basit bir saldırı ver (oyun kilitlenmesin)
    if (!chosen.length) {
        chosen.push({
            name: 'Tackle', kind: 'projectile', moveType: 'normal', type: 'slash',
            damage: 10, cooldown: 35, speed: 9, life: 60
        });
    }

    return chosen.slice(0, 3);
}
