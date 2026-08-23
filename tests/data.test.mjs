// Veri ve saf mantık testleri: tarayıcı gerektirmez, bir saniyede biter.
// Haritaların, sprite desenlerinin ve yapılandırmaların tutarlılığını doğrular.
// Çalıştırma: npm run check
import { MAPS, extractPortals, SOLID_TILES, TILE_SIZE } from '../src/config/worldMap.js';
import { REGIONS } from '../src/config/regions.js';
import { PROJECTILE_SPRITES } from '../src/game/projectileSprites.js';
import { PLAYABLE, abilityOverride, withKeys } from '../src/config/playableCharacters.js';
import { SPECIES_ATTACKS } from '../src/world/Enemy.js';
import { levelUpCost, maxHpFor, damageMultiplierFor, PARTY_SIZE } from '../src/config/progression.js';
import { FIELD_MOVES, fieldMoveForTile, hasSurf } from '../src/config/fieldMoves.js';
import { SHOP_ITEMS, itemById } from '../src/config/shopItems.js';

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
    if (condition) {
        passed++;
        return;
    }
    const line = `${name}${detail ? ` — ${detail}` : ''}`;
    failures.push(line);
    console.log(`KALDI  ${line}`);
}

// Bir haritada başlangıçtan yürünerek ulaşılabilen karolar
function reachable(map, treatHiddenSolid = false) {
    const grid = map.grid;
    const solid = (c, r) => {
        const tile = grid[r]?.[c] ?? 'T';
        return SOLID_TILES.has(tile) || (treatHiddenSolid && tile === 'H');
    };
    const seen = new Set([`${map.start.col},${map.start.row}`]);
    const queue = [[map.start.col, map.start.row]];
    while (queue.length) {
        const [c, r] = queue.shift();
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = c + dc, nr = r + dr, key = `${nc},${nr}`;
            if (seen.has(key) || solid(nc, nr)) continue;
            seen.add(key);
            queue.push([nc, nr]);
        }
    }
    return seen;
}

// ---- Haritalar ----
const BASE_TILES = new Set(['.', 'p', 'f', 'g', 's', 'h', 'H', 'T', 'W', 'R', 'M', 'b', 'A']);

for (const [id, map] of Object.entries(MAPS)) {
    const grid = map.grid;
    const width = grid[0].length;
    const valid = new Set([...BASE_TILES, ...Object.keys(map.portalDefs)]);

    check(`${id}: satırlar eşit uzunlukta`,
        grid.every(row => row.length === width),
        grid.map((r, i) => (r.length !== width ? `satır ${i}: ${r.length}` : null)).filter(Boolean).join(', '));

    const badTiles = [...new Set(grid.join('').split('').filter(ch => !valid.has(ch)))];
    check(`${id}: geçersiz karo yok`, badTiles.length === 0, badTiles.join(''));

    check(`${id}: başlangıç engel karosunda değil`, !SOLID_TILES.has(grid[map.start.row][map.start.col]));
    // Ölünce başlangıca doğulur; orası portalsa oyuncu anında haritadan atılır
    check(`${id}: başlangıç portal karosunda değil`, !map.portalDefs[grid[map.start.row][map.start.col]]);

    const seen = reachable(map);
    const portals = extractPortals(map);
    for (const portal of portals) {
        check(`${id}: "${portal.label}" portalına ulaşılabiliyor`, seen.has(`${portal.col},${portal.row}`));
        if (portal.target) {
            check(`${id} -> ${portal.target}: hedef harita var`, !!MAPS[portal.target]);
            check(`${id} -> ${portal.target}: geri dönüş portalı var`,
                !!MAPS[portal.target] && extractPortals(MAPS[portal.target]).some(back => back.target === id));
        }
    }

    for (const spawn of map.spawns || []) {
        check(`${id}: #${spawn.id} yürünebilir karoda`, !SOLID_TILES.has(grid[spawn.row][spawn.col]),
            `(${spawn.col},${spawn.row})`);
        check(`${id}: #${spawn.id} spawn noktasına ulaşılabiliyor`, seen.has(`${spawn.col},${spawn.row}`),
            `(${spawn.col},${spawn.row})`);
    }

    if (map.secretArea) {
        const area = map.secretArea;
        check(`${id}: gizli alan harita içinde`, area.col1 < width && area.row1 < grid.length);

        // Gizli çalı kapalıyken oda ulaşılamaz olmalı (asıl gizlilik garantisi)
        const withoutBush = reachable(map, true);
        let leaked = 0;
        for (let r = area.row0; r <= area.row1; r++) {
            for (let c = area.col0; c <= area.col1; c++) if (withoutBush.has(`${c},${r}`)) leaked++;
        }
        check(`${id}: gizli alan yalnızca gizli çalıdan geçiliyor`, leaked === 0, `${leaked} karo sızıyor`);

        for (const spawn of (map.spawns || []).filter(s => s.kind === 'hidden')) {
            check(`${id}: gizli Pokemon gizli alanın içinde`,
                spawn.col >= area.col0 && spawn.col <= area.col1 &&
                spawn.row >= area.row0 && spawn.row <= area.row1);
        }
    }

    if (map.bossArena) {
        const arena = map.bossArena;
        check(`${id}: boss areni harita içinde`, arena.col1 < width && arena.row1 < grid.length);
        const boss = (map.spawns || []).find(s => s.kind === 'boss' || s.kind === 'regionBoss');
        if (boss) {
            check(`${id}: boss areninin içinde`,
                boss.col >= arena.col0 && boss.col <= arena.col1 &&
                boss.row >= arena.row0 && boss.row <= arena.row1);
        }
    }
}

// ---- Bölge planı haritalarla tutarlı mı ----
for (const region of Object.values(REGIONS)) {
    for (const location of region.locations) {
        const map = MAPS[location.id];
        if (!map) continue; // haritası henüz yapılmamış mekan

        const spawnIds = new Set((map.spawns || []).map(s => s.id));
        const planned = [...location.pokemon.commons, location.pokemon.hidden, location.pokemon.boss];
        const missing = planned.filter(id => !spawnIds.has(id));
        check(`${location.name}: planlanan Pokemonların hepsi haritada`, missing.length === 0,
            missing.length ? `eksik: ${missing.join(', ')}` : '');

        const commonTypes = new Set((map.spawns || []).filter(s => s.kind === 'common').map(s => s.id));
        check(`${location.name}: 3 tür yaygın Pokemon var`, commonTypes.size === 3, `${commonTypes.size} tür`);
    }
}

// ---- Sprite desenleri ----
for (const [name, def] of Object.entries(PROJECTILE_SPRITES)) {
    const heights = def.frames.map(f => f.length);
    check(`sprite ${name}: kareler aynı yükseklikte`, new Set(heights).size === 1, heights.join('/'));

    def.frames.forEach((frame, fi) => {
        const width = frame[0].length;
        check(`sprite ${name}[${fi}]: satırlar eşit uzunlukta`, frame.every(row => row.length === width));
        const unknown = [...new Set(frame.join('').split('').filter(ch => ch !== '.' && !def.colors[ch]))];
        check(`sprite ${name}[${fi}]: tanımsız renk karakteri yok`, unknown.length === 0, unknown.join(''));
    });
}

// ---- Yetenekler sprite ve tip verisiyle tutarlı mı ----
for (const [id, entry] of Object.entries(PLAYABLE)) {
    for (const ability of entry.abilities) {
        check(`#${id} ${ability.name}: hamle tipi tanımlı`, !!ability.moveType);
        if (ability.kind === 'projectile') {
            check(`#${id} ${ability.name}: sprite tanımlı`, !!PROJECTILE_SPRITES[ability.type], ability.type);
        }
    }
    check(`#${id}: en fazla 5 yetenek (tuş sayısı kadar)`, entry.abilities.length <= 5);
}

for (const [id, attack] of Object.entries(SPECIES_ATTACKS)) {
    check(`düşman #${id} ${attack.name}: sprite tanımlı`, !!PROJECTILE_SPRITES[attack.type], attack.type);
    check(`düşman #${id} ${attack.name}: hamle tipi tanımlı`, !!attack.moveType);
}

// ---- Saf mantık ----
check('levelUpCost seviye ilerledikçe artıyor',
    levelUpCost(1) < levelUpCost(20) && levelUpCost(20) < levelUpCost(45));
check('maxHpFor seviyeyle artıyor', maxHpFor(45, 5) < maxHpFor(45, 20));
check('maxHpFor temel canla artıyor', maxHpFor(45, 5) < maxHpFor(105, 5));
check('damageMultiplierFor saldırıyla artıyor', damageMultiplierFor(49, 5) < damageMultiplierFor(120, 5));
check('ekip boyutu 6', PARTY_SIZE === 6);

// Yetenekler seviyeye göre açılıyor
check('Bulbasaur 5. seviyede 3 yeteneğe sahip', abilityOverride(1, 5).length === 3);
check('Bulbasaur 16. seviyede 4 yeteneğe sahip', abilityOverride(1, 16).length === 4);
check('Bulbasaur 32. seviyede 5 yeteneğe sahip', abilityOverride(1, 32).length === 5);
check('tanımsız Pokemon için elle yazılmış set yok', abilityOverride(9999, 50) === null);

const keyed = withKeys(abilityOverride(1, 32));
check('yeteneklere K O Ş L P tuşları sırayla atanıyor',
    keyed.map(a => a.key).join('') === 'KOŞLP', keyed.map(a => a.key).join(''));

// Saha hamleleri rozete bağlı
check('rozetsizken Cut çalışmıyor', fieldMoveForTile('h', []) === null);
check('rozetle Cut çalışıyor', fieldMoveForTile('h', ['loc-1-1'])?.name === 'Cut');
check('Rock Smash kaya karosuna bağlı', fieldMoveForTile('R', ['loc-1-2'])?.name === 'Rock Smash');
check('Surf pasif: F ile kullanılmaz', fieldMoveForTile('W', ['loc-1-3']) === null);
check('Surf rozeti tanınıyor', hasSurf(['loc-1-3']) && !hasSurf([]));
check('her saha hamlesinin rozeti gerçek bir mekana bağlı',
    FIELD_MOVES.every(move => !!MAPS[move.badge]),
    FIELD_MOVES.filter(m => !MAPS[m.badge]).map(m => m.badge).join(', '));

// Dükkan
check('eşya kimlikleri benzersiz', new Set(SHOP_ITEMS.map(i => i.id)).size === SHOP_ITEMS.length);
check('tüm eşya fiyatları pozitif', SHOP_ITEMS.every(i => i.price > 0));
check('itemById bilinmeyen kimlik için null', itemById('yok-boyle-bir-sey') === null);
check('karo boyutu 50', TILE_SIZE === 50);

// ---- İlerleme mantığı (Progress) ----
// Progress localStorage kullanır; node için basit bir taklit yeterli.
globalThis.localStorage = {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null; },
    setItem(key, value) { this.store.set(key, String(value)); },
    removeItem(key) { this.store.delete(key); },
    key(i) { return [...this.store.keys()][i] ?? null; },
    get length() { return this.store.size; }
};

const { Progress } = await import('../src/world/Progress.js');
const progress = new Progress();
progress.clear();

// Aynı türden ikinci yakalama koleksiyonu şişirmemeli
const first = progress.addCapture(127, 'Pinsir');
const second = progress.addCapture(127, 'Pinsir');
check('ilk yakalama koleksiyona ekleniyor', first.added === true && first.joinedParty === true);
check('aynı türden ikinci yakalama tekrar eklenmiyor',
    second.duplicate === true && progress.collection.filter(e => e.id === 127).length === 1,
    `${progress.collection.length} koleksiyon girdisi`);
check('aynı tür ekibe ikinci kez katılmıyor',
    progress.party.filter(m => m.id === 127).length === 1);

// Yakalanan Pokemon Pokedex'te "yakalandı" olmalı
check('yakalanan Pokemon Pokedex\'te yakalandı olarak işaretli',
    progress.dex[127]?.caught === true);

// Bosslar Pokedex'te ayrı: yakalanmaz, yenilir
progress.markSeen(768, 'Golisopod', false, 'boss');
check('boss görüldüğünde yakalanmadı olarak işaretli',
    progress.dex[768]?.caught === false && progress.dex[768]?.kind === 'boss');
progress.markDefeated(768, 'Golisopod', 'boss');
check('boss yenildiğinde yenildi olarak işaretleniyor',
    progress.dex[768]?.defeated === true && progress.dex[768]?.caught === false);

// Eski kayıtlarda Pokedex boş olabilir: ekip ve koleksiyonla uyumlanmalı
progress.dex = {};
progress.reconcileDex();
check('Pokedex ekip ve koleksiyonla uyumlanıyor',
    progress.dex[1]?.caught === true && progress.dex[127]?.caught === true,
    Object.keys(progress.dex).join(', '));

// Yükleme sırasında eski kayıttaki tekrarlar temizlenmeli
progress.collection.push({ id: 127, name: 'Pinsir' }); // eski kayıttan gelen tekrar
progress.save();
const reloaded = new Progress();
check('kayıt yüklenirken koleksiyondaki tekrarlar temizleniyor',
    reloaded.collection.filter(e => e.id === 127).length === 1,
    `${reloaded.collection.length} girdi`);

// En iyi top seçimi
progress.items = { 'poke-ball': 2, 'ultra-ball': 1 };
check('elde varken en güçlü top kullanılıyor', progress.bestBall()?.id === 'ultra-ball');
progress.items = { 'poke-ball': 2 };
check('ultra yoksa poke ball kullanılıyor', progress.bestBall()?.id === 'poke-ball');
progress.items = {};
check('hiç top yoksa null dönüyor', progress.bestBall() === null);

progress.clear();

// ---- Ana menü sahnesi ----
// Menü gezilebilir bir sahne olduğu için yerleşimin iki şeyi garanti etmesi
// gerekir: antrenör başladığı yerde sıkışmamalı ve her iki kapıya da
// yürüyerek ulaşabilmeli. Bunu sahne üzerinde kaba bir BFS ile ölçüyoruz.
const menu = await import('../src/menu/menuLayout.js');
const { missingGlyphs } = await import('../src/menu/pixelFont.js');

check('menü: başlangıç noktası boş', !menu.blocked(menu.START.x, menu.START.y));
check('menü: geçidin arkasından dışarı çıkılamıyor', menu.blocked(500, 110));
check('menü: macera kapısının içinden geçilemiyor', menu.blocked(930, 300));
check('menü: evin içine girilemiyor', menu.blocked(200, 180));

// Tabeladaki yazının her harfi piksel yazı tipinde var mı?
for (const line of menu.GATE.sign.lines) {
    const missing = missingGlyphs(line);
    check(`menü: "${line}" yazısı çizilebiliyor`, missing.length === 0, missing.join(','));
}

// Ağaçların dibi patikaya, eve veya kapı önüne taşmamalı
const treeBases = menu.TREES.map(menu.treeBase);
const corridors = [
    { name: 'ana patika', rect: { x: 60, y: 258, w: 930, h: 64 } },
    { name: 'geçit kolu', rect: { x: 468, y: 180, w: 64, h: 110 } },
    { name: 'kapı önü', rect: { x: 850, y: 240, w: 120, h: 100 } }
];
for (const corridor of corridors) {
    const clash = treeBases.filter(base => menu.rectsOverlap(base, corridor.rect));
    check(`menü: ${corridor.name} ağaçtan temiz`, clash.length === 0, `${clash.length} ağaç`);
}

// Başlangıçtan yürünerek nereye gidilebilir? (8 piksel adımlı ızgara)
const STEP = 8;
const seenCells = new Set();
const cellKey = (x, y) => `${x},${y}`;
const queue = [[Math.round(menu.START.x / STEP) * STEP, Math.round(menu.START.y / STEP) * STEP]];
seenCells.add(cellKey(queue[0][0], queue[0][1]));
let reachedGate = false;
let reachedDoor = false;

while (queue.length) {
    const [x, y] = queue.shift();
    if (menu.inGate(x, y)) reachedGate = true;
    if (menu.nearDoor(x, y)) reachedDoor = true;
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx > menu.SCENE.w || ny > menu.SCENE.h) continue;
        const key = cellKey(nx, ny);
        if (seenCells.has(key) || menu.blocked(nx, ny)) continue;
        seenCells.add(key);
        queue.push([nx, ny]);
    }
}

check('menü: geçide yürüyerek ulaşılıyor', reachedGate);
check('menü: macera kapısının önüne yürüyerek ulaşılıyor', reachedDoor);
check('menü: gezilebilir alan makul büyüklükte', seenCells.size > 900, `${seenCells.size} kare`);

// ---- Özet ----
console.log(`\n===== ${passed}/${passed + failures.length} veri testi geçti =====`);
if (failures.length) {
    console.log('\nBaşarısız olanlar:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
}
