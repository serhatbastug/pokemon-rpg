import { MAPS, TILE_SIZE, SOLID_TILES, extractPortals } from '../config/worldMap.js';
import { MERCHANT } from '../config/characters.js';
import { abilityOverride, withKeys } from '../config/playableCharacters.js';
import { PARTY_SIZE } from '../config/progression.js';
import { fetchCharacter, fetchEvolutionChain } from '../services/pokeapi.js';
import { buildAbilities } from '../services/moveAbilities.js';
import { effectiveness, effectivenessLabel, preloadTypes } from '../services/typeChart.js';
import { ActivePokemon } from './ActivePokemon.js';
import { drawTrainer } from './trainerSprite.js';
import { FIELD_MOVES, fieldMoveForTile, hasSurf, unlockedMoves } from '../config/fieldMoves.js';
import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { PROJECTILE_SPRITES, drawPixelSprite } from '../game/projectileSprites.js';
import { Enemy } from './Enemy.js';

// Kuşbakışı harita motoru: karo tabanlı pixel art haritalar, gezinen oyuncu ve
// portallar. Hedefi (target) olan portala temas haritalar arasında geçiş yapar;
// hedefi olmayan portallar görünür ama pasiftir (henüz açılmamış içerik).
export class Overworld {
    constructor({ canvas, input, onExit, progress, onOpenShop, onMerchantLoaded }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.onExit = onExit;
        this.progress = progress;
        this.onOpenShop = onOpenShop || (() => {});
        this.onMerchantLoaded = onMerchantLoaded || null;

        this.partyPokemon = [];   // ActivePokemon örnekleri (ekip sırasıyla)
        this.active = null;       // sahadaki Pokemon
        this.tokenDrops = [];     // haritada toplanmayı bekleyen jetonlar
        this.deployBall = null;   // havada olan poke top
        this.evolutionScene = null;
        this.swapCooldown = 0;

        // Görüntü ölçeği: 1 = birebir. Düşürmek haritanın daha geniş bir
        // kısmını ekrana sığdırır (her şey orantılı küçülür).
        this.zoom = 1;

        this.currentMap = null;
        this.portals = [];
        this.shops = [];
        this.portalCooldown = 0; // haritaya girişte anında geri ışınlanmayı önler
        this.camera = { x: 0, y: 0 };
        this.interval = null;
        this.running = false;

        // Tüccar (Kecleon) ilk maceraya girişte bir kez yüklenir
        this.merchantImg = new Image();
        this.merchantReady = false;
        this.merchantRequested = false;
        this.merchantLabel = 'Tüccar';

        // Antrenör: haritada gezdirdiğimiz avatar. Vurulmaz - savaşan Pokemondur.
        this.player = {
            x: 0,
            y: 0,
            speed: 3.4,
            hitbox: { w: 24, h: 16 }, // ayak hizasındaki çarpışma kutusu
            facing: 1,                // 1 = sağa, -1 = sola
            dir: 'down',              // sprite yönü
            dirX: 0,
            dirY: 1,
            moving: false,
            aim: { x: 1, y: 0 }       // son hareket yönü; yetenekler bu yöne atılır
        };

        // Harita savaşı durumu
        this.enemies = [];
        this.projectiles = [];       // oyuncu mermileri
        this.enemyProjectiles = [];  // düşman mermileri
        this.mapTexts = [];
        this.spores = [];
        this.ballAnim = null;   // aktif Pokeball atışı animasyonu
        this.captures = [];     // yakalanan Pokemonlar
        this.enemyDataCache = new Map(); // PokeAPI verisi (id -> Promise)
        this.flow = null;       // oyuncuya BFS mesafe alanı (labirent takibi için)
        this.fireflies = [];    // atmosfer: ateşböcekleri
        this.debris = [];       // boss uyanışında savrulan enkaz
        this.shake = 0;         // ekran sarsıntısı
        this.arenaOpened = false;
        this.victory = null;        // boss yenildiğinde zafer sahnesi
        this.pendingVictory = null; // jetonlar toplanana kadar bekleyen zafer
        this.shotsFired = 0;        // atılan yetenek sayacı (testler ve hata ayıklama)

        // Atmosfer: kenarları karartan vinyet (bir kez oluşturulur)
        const vg = this.ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.height * 0.45,
            canvas.width / 2, canvas.height / 2, canvas.height * 0.95
        );
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        this.vignette = vg;

        input.onKeyDown(e => {
            if (!this.running) return;
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();

            // Zafer sahnesi: bir tuşla ana haritaya dön
            if (this.victory) {
                if (this.victory.frame > 90) this.finishVictory();
                return;
            }
            if (this.evolutionScene) return; // sahnelerde oynanış durur

            // Yetenek tuşları sahadaki Pokemona göre değişir (K, O, Ş, L, P)
            const abilities = this.abilities;
            for (let i = 0; i < abilities.length; i++) {
                const ability = abilities[i];
                if (e.code === ability.code || (ability.altKey && e.key.toLowerCase() === ability.altKey)) {
                    this.castAbility(i);
                }
            }

            // 1-6: ekipteki Pokemonu değiştir
            const slot = Number(e.key);
            if (slot >= 1 && slot <= PARTY_SIZE) this.swapTo(slot - 1);

            // N: bayılmış Pokemona Pokeball at
            if (e.code === 'KeyN') this.tryCatch();

            // F: saha hamlesi (rozetle açılan Cut / Rock Smash)
            if (e.code === 'KeyF') this.useFieldMove();
        });
    }

    async start() {
        this.player.facing = 1;
        this.loadMap('main');
        await this.loadParty();

        if (!this.merchantRequested) {
            this.merchantRequested = true;
            fetchCharacter(MERCHANT)
                .then(merchant => {
                    this.merchantLabel = `Tüccar ${merchant.name}`;
                    this.onMerchantLoaded?.(merchant.name);
                    this.merchantImg.onload = () => { this.merchantReady = true; };
                    this.merchantImg.src = merchant.battleSprite || merchant.sprite;
                })
                .catch(error => console.error('Tüccar yüklenemedi:', error));
        }

        this.ctx.imageSmoothingEnabled = false;
        this.running = true;

        // Ekran yenilemesiyle senkron döngü (setInterval'dan daha akıcı);
        // mantık sabit adımla ilerler, yavaş karelerde en fazla 3 adım telafi edilir
        if (this.rafId) cancelAnimationFrame(this.rafId);
        const stepMs = 1000 / FRAME_RATE;
        let acc = 0;
        let last = performance.now();

        const loop = (now) => {
            if (!this.running) return;
            this.rafId = requestAnimationFrame(loop);

            acc += Math.min(now - last, stepMs * 3);
            last = now;
            if (acc < stepMs) return;

            while (acc >= stepMs) {
                acc -= stepMs;
                this.step();
            }
            this.draw();
        };
        this.rafId = requestAnimationFrame(loop);
    }

    get abilities() {
        return this.active ? this.active.abilities : [];
    }

    // Düşmanların hedefi: sahadaki Pokemon (yoksa antrenörün konumu)
    get combatTarget() {
        return (this.active && !this.active.fainted) ? this.active : this.player;
    }

    // Bir ekip üyesinin verisini ve yeteneklerini hazırlar.
    // Elle yazılmış set varsa o kullanılır, yoksa gerçek hamle verisinden üretilir.
    async buildMember(member) {
        const data = await fetchCharacter({ id: member.formId });
        const override = abilityOverride(member.id, member.level);
        const abilities = withKeys(override && override.length ? override : await buildAbilities(data));
        return new ActivePokemon({ member, data, abilities, world: this });
    }

    // Ekibi kurar; sahadaki Pokemonu belirler ve tip verilerini önden yükler
    async loadParty() {
        const { progress } = this;

        this.partyPokemon = [];
        for (const member of progress.party) {
            try {
                const pokemon = await this.buildMember(member);
                this.partyPokemon.push(pokemon);
            } catch (error) {
                console.error(`Ekip üyesi yüklenemedi (#${member.formId}):`, error);
            }
        }

        if (!this.partyPokemon.length) return;

        // Pokemon kendiliğinden sahaya çıkmaz; oyuncu poke topunu fırlatır (1-6)
        this.active = null;

        // Tip etkililik tablosu: ekip ve düşman tipleri
        const types = this.partyPokemon.flatMap(p => p.types);
        preloadTypes(types);

        // Kayıttan gelen seviyeye uygun evrim formunu sessizce uygula
        for (let i = 0; i < this.partyPokemon.length; i++) this.checkEvolution(i, true);
    }

    // Zafer sahnesi bitti: macera ana haritasına dön
    finishVictory() {
        this.victory = null;
        this.recallActive(null);
        this.loadMap('main');
    }

    // Kütüphaneden seviye yükseltilen üye: statları tazelenir, evrim kontrol edilir
    async onMemberLeveled(index) {
        const member = this.progress.party[index];
        const pokemon = this.partyPokemon[index];
        if (!member || !pokemon) return;

        const refreshed = await this.buildMember(member);
        refreshed.hp = Math.min(refreshed.maxHp, Math.round(pokemon.hp + (refreshed.maxHp - pokemon.maxHp)));
        refreshed.x = pokemon.x;
        refreshed.y = pokemon.y;

        const wasActive = this.active === pokemon;
        this.partyPokemon[index] = refreshed;
        if (wasActive) this.active = refreshed;

        this.spawnMapText(refreshed.x, refreshed.y - 60, `${refreshed.name} Sv. ${member.level}!`, '#facc15');
        await this.checkEvolution(index);
    }

    // Poke topu fırlatarak Pokemonu sahaya sürer. Aynı tuşa tekrar basmak
    // (ya da başka bir slot seçmek) onu geri çağırır.
    swapTo(index) {
        if (this.swapCooldown > 0 || this.deployBall) return;
        const next = this.partyPokemon[index];
        if (!next) return;

        if (next.fainted) {
            this.spawnMapText(this.player.x, this.player.y - 50, `${next.name} bayılmış!`, '#94a3b8');
            return;
        }

        // Sahadaki Pokemonun topuna tekrar basıldı: geri çağır
        if (next === this.active) {
            this.recallActive('geri döndü');
            return;
        }

        // Topun düşeceği nokta: antrenörün baktığı yönde, duvara girmeyecek şekilde
        const aim = this.aimVector();
        let tx = this.player.x + aim.x * 120;
        let ty = this.player.y + aim.y * 120;
        for (let i = 0; i < 8 && !this.canBoxMoveTo(tx, ty, 16, 12); i++) {
            tx -= aim.x * 14;
            ty -= aim.y * 14;
        }
        if (!this.canBoxMoveTo(tx, ty, 16, 12)) {
            tx = this.player.x;
            ty = this.player.y;
        }

        if (this.active) this.recallActive(null);

        this.deployBall = {
            index,
            frame: 0,
            fromX: this.player.x,
            fromY: this.player.y - 14,
            toX: tx,
            toY: ty
        };
        this.swapCooldown = 20;
    }

    // Topun havada geçirdiği süre ve açılma anı
    updateDeployBall() {
        const ball = this.deployBall;
        if (!ball) return;

        ball.frame++;
        if (ball.frame < 18) return;

        const pokemon = this.partyPokemon[ball.index];
        this.deployBall = null;
        if (!pokemon || pokemon.fainted) return;

        pokemon.x = ball.toX;
        pokemon.y = ball.toY;
        pokemon.invuln = 30;
        this.active = pokemon;
        this.progress.setActive(ball.index);

        // Açılma parlaması
        for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            this.debris.push({
                x: ball.toX, y: ball.toY,
                vx: Math.cos(a) * 3,
                vy: Math.sin(a) * 3 - 1,
                size: 3,
                color: i % 2 === 0 ? '#f8fafc' : '#38bdf8',
                life: 22,
                gravity: 0.05
            });
        }
        this.spawnMapText(ball.toX, ball.toY - 50, `Hadi ${pokemon.name}!`, '#38bdf8');
    }

    recallActive(reason) {
        if (!this.active) return;
        const pokemon = this.active;
        this.effectsTrail(pokemon.x, pokemon.y);
        if (reason) this.spawnMapText(pokemon.x, pokemon.y - 40, `${pokemon.name} ${reason}`, '#94a3b8');
        this.active = null;
    }

    // Çantadaki eşyayı kullanır; sonucu (kısa açıklama) döndürür
    useItem(id) {
        const { progress } = this;
        if (progress.itemCount(id) <= 0) return { ok: false, message: 'Elinde yok' };

        if (id === 'potion') {
            const target = this.active || this.partyPokemon.find(p => !p.fainted && p.hp < p.maxHp);
            if (!target) return { ok: false, message: 'İyileştirilecek Pokemon yok' };
            if (target.hp >= target.maxHp) return { ok: false, message: `${target.name} zaten tam canlı` };

            const healed = Math.round(target.maxHp * 0.5);
            target.heal(healed);
            progress.consumeItem(id);
            this.spawnMapText(target.x, target.y - 50, `+${healed} CAN`, '#f472b6');
            return { ok: true, message: `${target.name} +${healed} can` };
        }

        if (id === 'revive') {
            const index = this.partyPokemon.findIndex(p => p.fainted);
            if (index < 0) return { ok: false, message: 'Bayılmış Pokemon yok' };

            const pokemon = this.partyPokemon[index];
            pokemon.fainted = false;
            pokemon.hp = Math.round(pokemon.maxHp * 0.5);
            progress.consumeItem(id);
            return { ok: true, message: `${pokemon.name} ayağa kalktı` };
        }

        if (id === 'team-tonic') {
            const hurt = this.partyPokemon.filter(p => p.fainted || p.hp < p.maxHp);
            if (!hurt.length) return { ok: false, message: 'Ekip zaten sağlıklı' };

            for (const pokemon of this.partyPokemon) {
                pokemon.fainted = false;
                pokemon.hp = pokemon.maxHp;
            }
            progress.consumeItem(id);
            this.spawnMapText(this.player.x, this.player.y - 50, 'EKİP İYİLEŞTİ!', '#4ade80');
            return { ok: true, message: 'Tüm ekip iyileşti' };
        }

        return { ok: false, message: 'Bu eşya sahada kullanılmaz' };
    }

    // Sahadaki Pokemona en yakın ayakta düşman (menzil içinde)
    nearestEnemy(x, y, range) {
        let best = null;
        let bestDist = range;
        for (const enemy of this.enemies) {
            if (enemy.fainted || enemy.asleep) continue;
            const dist = Math.hypot(enemy.x - x, enemy.y - y);
            if (dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }
        return best;
    }

    // Sahadaki Pokemon bayıldı: sıradaki sağlıklı Pokemon gelir
    onPokemonFainted(pokemon) {
        this.spawnMapText(pokemon.x, pokemon.y - 40, `${pokemon.name} bayıldı!`, '#ef4444');
        this.effects?.triggerShake?.(10);

        const next = this.partyPokemon.findIndex(p => !p.fainted);
        if (next >= 0) {
            setTimeout(() => this.swapTo(next), 700);
            return;
        }

        // Tüm ekip bayıldı: mekan girişine dön, ekip iyileşsin
        setTimeout(() => {
            for (const member of this.partyPokemon) {
                member.fainted = false;
                member.hp = member.maxHp;
            }
            this.active = this.partyPokemon[0];
            this.progress.setActive(0);
            const start = this.currentMap.start;
            this.player.x = start.col * TILE_SIZE + TILE_SIZE / 2;
            this.player.y = start.row * TILE_SIZE + TILE_SIZE / 2;
            this.active.x = this.player.x;
            this.active.y = this.player.y;
            this.portalCooldown = 45;
            this.updateCamera(true);
            this.spawnMapText(this.player.x, this.player.y - 60, 'Ekip bayıldı! Girişe dönüldü', '#ef4444');
        }, 900);
    }

    loadMap(id) {
        const map = MAPS[id];
        if (!map) {
            console.error(`Harita bulunamadı: ${id}`);
            return;
        }

        this.currentMap = map;
        this.portals = extractPortals(map);
        this.shops = [];
        map.grid.forEach((rowStr, row) => {
            for (let col = 0; col < rowStr.length; col++) {
                if (rowStr[col] === 'M') this.shops.push({ col, row });
            }
        });
        this.portalCooldown = 45;
        this.player.x = map.start.col * TILE_SIZE + TILE_SIZE / 2;
        this.player.y = map.start.row * TILE_SIZE + TILE_SIZE / 2;

        // Sahadaki Pokemon antrenörle birlikte yeni haritaya geçer
        if (this.active) {
            this.active.x = this.player.x;
            this.active.y = this.player.y;
            this.active.invuln = 45;
        }
        this.deployBall = null;

        // Harita savaşı durumu sıfırlanır; düşmanlar spawn listesinden kurulur
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.mapTexts = [];
        this.spores = [];
        this.ballAnim = null;
        this.flow = null;
        this.debris = [];
        this.shake = 0;
        this.arenaOpened = false;
        this.victory = null;

        // Atmosfer zerrecikleri: ormanda ateşböceği, derinliklerde gölge zerresi
        this.fireflies = [];
        if (map.ambience === 'forest' || map.ambience === 'shadow') {
            const mapW = map.grid[0].length * TILE_SIZE;
            const mapH = map.grid.length * TILE_SIZE;
            const count = Math.round((mapW * mapH) / 40000);
            for (let i = 0; i < count; i++) {
                this.fireflies.push({
                    x: Math.random() * mapW,
                    y: Math.random() * mapH,
                    angle: Math.random() * Math.PI * 2,
                    phase: Math.random() * Math.PI * 2
                });
            }
        }
        this.secretRevealed = false;
        this.enemies = (map.spawns || []).map(spawn => {
            const enemy = new Enemy({ ...spawn, world: this });
            // Gizli odadakiler odalarını korur: dışarıdakine saldırmaz
            if (map.secretArea && this.isTileInsideArea(spawn.col, spawn.row, map.secretArea)) {
                enemy.homeArea = map.secretArea;
            }
            return enemy;
        });
        for (const enemy of this.enemies) {
            this.fetchEnemyData(enemy.id).then(data => {
                enemy.name = data.name;
                enemy.types = data.types || [];
                enemy.img.src = data.battleSprite || data.sprite;
                preloadTypes(enemy.types);
            }).catch(error => console.error(`Düşman #${enemy.id} yüklenemedi:`, error));
        }

        this.bakeTerrain();
        this.updateCamera(true);

        const title = document.getElementById('overworld-title');
        if (title) title.textContent = map.name;
    }

    // Ölçek uygulandıktan sonra ekranda görünen dünya alanı
    get viewSize() {
        return { w: this.canvas.width / this.zoom, h: this.canvas.height / this.zoom };
    }

    // Kamera oyuncuyu ortalayarak takip eder, harita kenarlarında durur.
    // Görünür alandan küçük haritalar ekranda ortalanır.
    updateCamera(snap = false) {
        const mapW = this.currentMap.grid[0].length * TILE_SIZE;
        const mapH = this.currentMap.grid.length * TILE_SIZE;
        const view = this.viewSize;

        const targetX = mapW <= view.w
            ? (mapW - view.w) / 2
            : Math.max(0, Math.min(mapW - view.w, this.player.x - view.w / 2));
        const targetY = mapH <= view.h
            ? (mapH - view.h) / 2
            : Math.max(0, Math.min(mapH - view.h, this.player.y - view.h / 2));

        if (snap) {
            this.camera.x = targetX;
            this.camera.y = targetY;
        } else {
            // Yumuşak takip
            this.camera.x += (targetX - this.camera.x) * 0.12;
            this.camera.y += (targetY - this.camera.y) * 0.12;
        }
    }

    // Hedefli bir portala yeterince yaklaşınca haritalar arası geçiş
    checkPortals() {
        if (this.portalCooldown > 0) {
            this.portalCooldown--;
            return;
        }

        for (const portal of this.portals) {
            if (!portal.target) continue;
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE + TILE_SIZE / 2;
            if (Math.hypot(this.player.x - cx, this.player.y - cy) < 24) {
                this.loadMap(portal.target);
                return;
            }
        }
    }

    stop() {
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    // (x, y) noktasındaki karo yürünebilir mi?
    // Surf rozeti varsa su karoları da geçilebilir olur.
    isWalkable(x, y) {
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);
        const rowStr = this.currentMap.grid[row];
        if (!rowStr) return false;
        const tile = rowStr[col];
        if (tile === undefined) return false;
        if (tile === 'W' && hasSurf(this.progress.badges)) return true;
        return !SOLID_TILES.has(tile);
    }

    // Antrenör tüccar tezgahının önünde mi?
    nearShop() {
        return this.shops.some(shop => {
            const cx = shop.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = shop.row * TILE_SIZE + TILE_SIZE / 2;
            return Math.hypot(this.player.x - cx, this.player.y - cy) < 80;
        });
    }

    // Antrenörün baktığı yöndeki komşu karoya saha hamlesi uygular
    // (tezgahın önündeyse önce dükkan açılır)
    useFieldMove() {
        const { player, progress } = this;

        if (this.nearShop()) {
            this.onOpenShop();
            return;
        }
        const aim = this.aimVector();
        const col = Math.floor((player.x + aim.x * TILE_SIZE * 0.8) / TILE_SIZE);
        const row = Math.floor((player.y + aim.y * TILE_SIZE * 0.8) / TILE_SIZE);

        const grid = this.currentMap.grid;
        const tile = grid[row]?.[col];
        if (tile === undefined) return;

        const move = fieldMoveForTile(tile, progress.badges);
        if (!move) {
            // Rozeti yoksa neye ihtiyacı olduğunu söyle
            const locked = FIELD_MOVES.find(m => m.tile === tile && !m.passive);
            if (locked) {
                this.spawnMapText(player.x, player.y - 50, `${locked.name} gerekiyor`, '#94a3b8');
            }
            return;
        }

        // Karoyu kalıcı olarak aç ve zemini yeniden pişir
        const rows = grid.map(r => r.split(''));
        rows[row][col] = move.becomes;
        this.currentMap = { ...this.currentMap, grid: rows.map(r => r.join('')) };
        this.flow = null;
        this.bakeTerrain();

        // Parçalanma efekti
        const px = col * TILE_SIZE + TILE_SIZE / 2;
        const py = row * TILE_SIZE + TILE_SIZE / 2;
        for (let i = 0; i < 16; i++) {
            this.debris.push({
                x: px, y: py,
                vx: (Math.random() - 0.5) * 8,
                vy: -Math.random() * 7 - 1,
                size: 3 + Math.random() * 4,
                color: move.color,
                life: 30 + Math.random() * 20,
                gravity: 0.35
            });
        }
        this.shake = 8;
        this.spawnMapText(px, py - 30, `${move.name}!`, move.color);
    }

    // Yakındaki saha hamlesi hedefi (ipucu göstermek için)
    nearbyFieldTarget() {
        const { player, progress } = this;
        const aim = this.aimVector();
        const col = Math.floor((player.x + aim.x * TILE_SIZE * 0.8) / TILE_SIZE);
        const row = Math.floor((player.y + aim.y * TILE_SIZE * 0.8) / TILE_SIZE);
        const tile = this.currentMap.grid[row]?.[col];
        if (tile === undefined) return null;

        const usable = fieldMoveForTile(tile, progress.badges);
        if (usable) return { col, row, move: usable, locked: false };

        const locked = FIELD_MOVES.find(m => m.tile === tile && !m.passive);
        return locked ? { col, row, move: locked, locked: true } : null;
    }

    // Çarpışma kutusunun dört köşesi de yürünebilirse hareket geçerli
    // (hem oyuncu hem düşmanlar kullanır)
    canBoxMoveTo(x, y, hw, hh) {
        return this.isWalkable(x - hw, y - hh)
            && this.isWalkable(x + hw, y - hh)
            && this.isWalkable(x - hw, y + hh)
            && this.isWalkable(x + hw, y + hh);
    }

    canMoveTo(x, y) {
        const { w, h } = this.player.hitbox;
        return this.canBoxMoveTo(x, y, w / 2, h / 2);
    }

    fetchEnemyData(id) {
        if (!this.enemyDataCache.has(id)) {
            this.enemyDataCache.set(id, fetchCharacter({ id }));
        }
        return this.enemyDataCache.get(id);
    }

    // Oyuncudan tüm karolara BFS mesafesi (akış alanı). Düşmanlar bu alanı
    // izleyerek labirentte duvarları dolaşıp oyuncuya ulaşır.
    computeFlowField() {
        const grid = this.currentMap.grid;
        const W = grid[0].length;
        const H = grid.length;

        const target = this.combatTarget;
        const pc = Math.floor(target.x / TILE_SIZE);
        const pr = Math.floor(target.y / TILE_SIZE);

        // Oyuncu aynı karodaysa alan değişmez; yeniden hesaplamaya gerek yok
        if (this.flow && this.flow.pc === pc && this.flow.pr === pr) return;

        // Tampon yeniden kullanılır (her karede yeni dizi ayırmamak için)
        if (!this.flowBuf || this.flowBuf.length !== W * H) {
            this.flowBuf = new Int16Array(W * H);
            this.flowQueue = new Int32Array(W * H);
        }
        const dist = this.flowBuf.fill(-1);
        const queue = this.flowQueue;

        if (pr < 0 || pr >= H || pc < 0 || pc >= W || SOLID_TILES.has(grid[pr][pc])) {
            this.flow = { dist, W, H, pc, pr };
            return;
        }

        // Dizi kaydırmadan (shift) çalışan halka kuyruk: O(n)
        let head = 0, tail = 0;
        dist[pr * W + pc] = 0;
        queue[tail++] = pr * W + pc;

        while (head < tail) {
            const idx = queue[head++];
            const c = idx % W;
            const r = (idx - c) / W;
            const d = dist[idx];

            if (c + 1 < W) { const n = idx + 1; if (dist[n] === -1 && !SOLID_TILES.has(grid[r][c + 1])) { dist[n] = d + 1; queue[tail++] = n; } }
            if (c - 1 >= 0) { const n = idx - 1; if (dist[n] === -1 && !SOLID_TILES.has(grid[r][c - 1])) { dist[n] = d + 1; queue[tail++] = n; } }
            if (r + 1 < H) { const n = idx + W; if (dist[n] === -1 && !SOLID_TILES.has(grid[r + 1][c])) { dist[n] = d + 1; queue[tail++] = n; } }
            if (r - 1 >= 0) { const n = idx - W; if (dist[n] === -1 && !SOLID_TILES.has(grid[r - 1][c])) { dist[n] = d + 1; queue[tail++] = n; } }
        }

        this.flow = { dist, W, H, pc, pr };
    }

    // (col,row) karosunun oyuncuya labirent yolu mesafesi (karo cinsinden)
    tileDistAt(col, row) {
        if (!this.flow) return Infinity;
        const { dist, W, H } = this.flow;
        if (col < 0 || col >= W || row < 0 || row >= H) return Infinity;
        const d = dist[row * W + col];
        return d === -1 ? Infinity : d;
    }

    // (x,y) konumundan oyuncuya doğru akış alanını izleyen birim adım yönü
    flowStepFrom(x, y) {
        const c = Math.floor(x / TILE_SIZE);
        const r = Math.floor(y / TILE_SIZE);
        const here = this.tileDistAt(c, r);

        if (here <= 1) {
            // Oyuncuyla aynı/komşu karoda: doğrudan üstüne yürü
            const dx = this.combatTarget.x - x;
            const dy = this.combatTarget.y - y;
            const len = Math.hypot(dx, dy) || 1;
            return { x: dx / len, y: dy / len };
        }

        let best = null;
        let bestDist = here;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const d = this.tileDistAt(c + dc, r + dr);
            if (d < bestDist) {
                bestDist = d;
                best = { c: c + dc, r: r + dr };
            }
        }
        if (!best) return { x: 0, y: 0 };

        // Seçilen karonun merkezine yönel
        const tx = best.c * TILE_SIZE + TILE_SIZE / 2;
        const ty = best.r * TILE_SIZE + TILE_SIZE / 2;
        const dx = tx - x;
        const dy = ty - y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    // İki nokta arasında duvar var mı? (düşman atışları için görüş hattı)
    hasLineOfSight(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.ceil(dist / 20));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (!this.isWalkable(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
        }
        return true;
    }

    spawnEnemyProjectile(projectile) {
        this.enemyProjectiles.push(projectile);
    }

    isTileInsideArea(col, row, area) {
        return col >= area.col0 && col <= area.col1 && row >= area.row0 && row <= area.row1;
    }

    isInsideArea(x, y, area) {
        return this.isTileInsideArea(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE), area);
    }

    // Gizli oda: içine girilene kadar haritada ağaçlık gibi görünür,
    // içindeki Pokemon da çizilmez.
    get secretArea() {
        return this.currentMap.secretArea;
    }

    isHiddenTile(col, row) {
        const area = this.secretArea;
        return !!area && !this.secretRevealed && this.isTileInsideArea(col, row, area);
    }

    checkSecretDiscovery() {
        const area = this.secretArea;
        if (!area || this.secretRevealed) return;
        if (this.isInsideArea(this.player.x, this.player.y, area)) {
            this.secretRevealed = true;
            this.bakeTerrain(); // oda artık gerçek görünümüyle çizilir
            this.spawnMapText(this.player.x, this.player.y - 60, 'GİZLİ ODA BULUNDU!', '#fbbf24');
        }
    }

    movePlayer() {
        const { input, player } = this;
        let dx = 0, dy = 0;

        // Hem WASD hem yön tuşları çalışır
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;

        player.moving = dx !== 0 || dy !== 0;
        if (!player.moving) return;

        // Çapraz harekette hızı sabit tut
        if (dx !== 0 && dy !== 0) {
            dx *= Math.SQRT1_2;
            dy *= Math.SQRT1_2;
        }
        if (dx > 0) player.facing = 1;
        if (dx < 0) player.facing = -1;

        // Sprite yönü: yatay hareket dikeye baskındır
        if (Math.abs(dx) >= Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
        else player.dir = dy > 0 ? 'down' : 'up';
        player.dirX = dx;
        player.dirY = dy;

        // Yetenekler son hareket yönüne atılır
        player.aim = { x: dx, y: dy };

        // Eksenleri ayrı dene: duvara sürtünerek kaymaya izin verir
        const nx = player.x + dx * player.speed;
        if (this.canMoveTo(nx, player.y)) player.x = nx;

        const ny = player.y + dy * player.speed;
        if (this.canMoveTo(player.x, ny)) player.y = ny;
    }

    // Oyun mantığı (sabit adım)
    step() {
        // Evrim ve zafer sahnelerinde dünya donar
        if (this.evolutionScene) {
            this.updateEvolutionScene();
            return;
        }
        if (this.victory) return;

        this.movePlayer();
        this.checkPortals();
        this.checkSecretDiscovery();
        this.updateCombat();
        this.updatePendingVictory();
        this.updateCamera();
    }

    draw() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        // Dünya, kamera kadar kaydırılarak çizilir (boss uyanışında sarsılır)
        ctx.save();
        const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        ctx.translate(-Math.round(this.camera.x) + sx, -Math.round(this.camera.y) + sy);

        this.drawTiles();
        this.drawPortals();
        this.drawShops();
        for (const enemy of this.enemies) {
            // Pokeball'a girmiş (sallanan toptaki) Pokemon görünmez
            if (this.ballAnim && this.ballAnim.enemy === enemy && this.ballAnim.frame >= 15) continue;
            // Keşfedilmemiş gizli odadaki Pokemon da görünmez
            if (this.isHiddenTile(Math.floor(enemy.x / TILE_SIZE), Math.floor(enemy.y / TILE_SIZE))) continue;
            enemy.draw(ctx);
        }
        this.drawTokenDrops();
        this.drawProjectiles();
        if (this.active) this.active.draw(ctx);
        this.drawPlayer();
        this.drawDeployBall();
        this.drawFieldHint();
        this.drawSpores();
        this.drawBallAnim();
        this.drawDebris();
        this.drawFireflies();
        this.drawPortalLabels();
        this.drawShopLabels();
        this.drawCatchHints();
        this.drawMapTexts();

        ctx.restore();

        // Atmosfer: loş tonlama + kenar karartması (ekran sabiti)
        const shadowy = this.currentMap.ambience === 'shadow';
        if (this.currentMap.theme === 'dark') {
            ctx.fillStyle = shadowy ? 'rgba(8, 6, 20, 0.34)' : 'rgba(6, 18, 10, 0.18)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (this.currentMap.ambience) {
            ctx.fillStyle = this.vignette;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (shadowy) {
                // Derinlikler: ikinci kat karartma, koridorlar iyice daralır
                ctx.fillStyle = this.vignette;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        // Ekran sabiti arayüz (HP, seviye, yetenekler, yakalananlar)
        this.drawHud();
        this.drawVictory();
        this.drawEvolutionScene();
    }

    drawDebris() {
        const { ctx } = this;
        ctx.save();
        for (const d of this.debris) {
            ctx.globalAlpha = Math.min(1, d.life / 25);
            ctx.fillStyle = d.color;
            ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
        }
        ctx.restore();
    }

    // Boss yenildi: konfeti yağmuru, zıplayan Pokemon ve zafer yazısı
    drawVictory() {
        if (!this.victory) return;
        const { ctx, canvas } = this;
        const v = this.victory;
        v.frame++;

        ctx.save();
        ctx.fillStyle = 'rgba(5, 10, 8, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Konfeti
        for (const c of v.confetti) {
            c.y += c.vy;
            c.x += c.vx;
            if (c.y > canvas.height) c.y = -c.size;
            ctx.fillStyle = c.color;
            ctx.fillRect(c.x, c.y, c.size, c.size);
        }

        // Sevinç: karakter zıplayıp dönerek kutlama yapar
        const cx = canvas.width / 2;
        const cy = canvas.height / 2 + 30;
        const jump = Math.abs(Math.sin(v.frame / 14)) * 46;
        const tilt = Math.sin(v.frame / 9) * 0.28;
        // Sahadaki Pokemon ve antrenör birlikte kutlar
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(cx, cy - jump);
        ctx.rotate(tilt);
        const winner = this.active?.img;
        if (winner && winner.complete && winner.naturalWidth > 0) {
            ctx.drawImage(winner, -60, -60, 120, 120);
        }
        ctx.restore();

        drawTrainer(ctx, cx - 110, cy - jump * 0.6, 'right', true, 3);

        // Zıplarken çevreye saçılan ışık pikselleri
        for (let i = 0; i < 8; i++) {
            const a = (v.frame / 20) + (i / 8) * Math.PI * 2;
            const r = 80 + Math.sin(v.frame / 12 + i) * 12;
            ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#4ade80';
            ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy - jump + Math.sin(a) * r * 0.6 - 1.5, 3, 3);
        }

        // Yazılar
        ctx.textAlign = 'center';
        ctx.font = "bold 46px 'Space Grotesk', sans-serif";
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        const title = v.isRegionBoss ? 'BÖLGE FETHEDİLDİ!' : 'ZAFER!';
        ctx.strokeText(title, cx, cy - 130);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(title, cx, cy - 130);

        ctx.font = "bold 20px 'Space Grotesk', sans-serif";
        ctx.lineWidth = 4;
        const sub = `${v.isRegionBoss ? 'Bölge bossu' : 'Boss'} ${v.name} yakalandı!`;
        ctx.strokeText(sub, cx, cy - 96);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(sub, cx, cy - 96);

        // Kazanılan rozet ve açılan saha hamlesi
        if (v.badge) {
            ctx.font = "bold 17px 'Space Grotesk', sans-serif";
            ctx.lineWidth = 4;
            const badgeText = `${v.badge.badgeName} kazanıldı — ${v.badge.name} açıldı!`;
            ctx.strokeText(badgeText, cx, cy + 78);
            ctx.fillStyle = v.badge.color;
            ctx.fillText(badgeText, cx, cy + 78);

            // Rozet: parlayan piksel madalya
            const bx = cx, by = cy + 46;
            ctx.fillStyle = v.badge.color;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + v.frame / 30;
                ctx.fillRect(bx + Math.cos(a) * 16 - 3, by + Math.sin(a) * 16 - 3, 6, 6);
            }
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(bx - 6, by - 6, 12, 12);
            ctx.fillStyle = v.badge.color;
            ctx.fillRect(bx - 3, by - 3, 6, 6);
        }

        ctx.font = "15px 'Space Grotesk', sans-serif";
        const foot = v.frame > 90
            ? `${v.locationName} tamamlandı — bir tuşa bas: ana haritaya dön`
            : `${v.locationName} tamamlandı`;
        ctx.strokeText(foot, cx, cy + 110);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(foot, cx, cy + 110);

        ctx.restore();
    }

    // Atmosfer: yavaşça süzülen, parlaklığı nefes alan ateşböcekleri
    drawFireflies() {
        if (!this.fireflies.length) return;
        const { ctx } = this;
        const mapW = this.currentMap.grid[0].length * TILE_SIZE;
        const mapH = this.currentMap.grid.length * TILE_SIZE;
        const t = Date.now() / 1000;

        ctx.save();
        for (const fly of this.fireflies) {
            fly.angle += (Math.random() - 0.5) * 0.15;
            fly.x += Math.cos(fly.angle) * 0.4;
            fly.y += Math.sin(fly.angle) * 0.4;
            if (fly.x < 0) fly.x = mapW;
            if (fly.x > mapW) fly.x = 0;
            if (fly.y < 0) fly.y = mapH;
            if (fly.y > mapH) fly.y = 0;

            const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + fly.phase));
            const shadowy = this.currentMap.ambience === 'shadow';
            ctx.globalAlpha = pulse * (shadowy ? 0.7 : 0.9);
            ctx.shadowBlur = 8;
            ctx.shadowColor = shadowy ? '#818cf8' : '#bef264';
            ctx.fillStyle = shadowy ? '#c7d2fe' : '#d9f99d';
            ctx.fillRect(fly.x - 1, fly.y - 1, 2, 2);
        }
        ctx.restore();
    }

    // ---- Harita savaşı ----

    updateCombat() {
        if (this.swapCooldown > 0) this.swapCooldown--;

        this.updateDeployBall();

        // Sahadaki Pokemon durduğu yeri tutar (antrenörü takip etmez)
        if (this.active) {
            this.active.hold();
            this.active.update();

            // Tasma: antrenör çok uzaklaşırsa Pokemon topuna döner
            if (Math.hypot(this.player.x - this.active.x, this.player.y - this.active.y) > 430) {
                this.recallActive('topuna döndü');
            }
        }

        this.collectTokens();
        this.computeFlowField();
        for (const enemy of this.enemies) enemy.update();

        // Düşman mermileri: hareket, duvar ve oyuncu çarpışması
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0 || !this.isWalkable(p.x, p.y)) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Düşman mermileri sahadaki Pokemona isabet eder (antrenör vurulmaz)
            const target = this.active;
            if (target && !target.fainted && Math.hypot(p.x - target.x, p.y - target.y) < 26) {
                this.damageActive(p.damage, p, p.moveType);
                this.enemyProjectiles.splice(i, 1);
            }
        }

        // Mermiler: hareket, duvar ve düşman çarpışması
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            // Duvar delen hamleler engellerde durmaz
            if (p.life <= 0 || (!p.pierce && !this.isWalkable(p.x, p.y))) {
                this.projectiles.splice(i, 1);
                continue;
            }

            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.size / 2 + 10) {
                    // Tip etkililiği: Pokemonların iyi ve kötü yönleri burada belirir
                    const mult = p.moveType ? effectiveness(p.moveType, enemy.types) : 1;
                    const damage = p.damage * mult;
                    const label = effectivenessLabel(mult);
                    if (label) this.spawnMapText(enemy.x, enemy.y - 66, label.text, label.color);

                    if (mult > 0) enemy.takeDamage(damage);

                    // Leech Seed: verilen hasarın bir kısmı sahadaki Pokemonun canına döner
                    if (p.leech && this.active && mult > 0) {
                        const healed = Math.round(damage * p.leech);
                        this.active.heal(healed);
                        this.spawnMapText(this.active.x, this.active.y - 50, `+${healed}`, '#4ade80');
                    }

                    this.projectiles.splice(i, 1);
                    break;
                }
            }
        }

        // Sleep Powder sporları
        for (let i = this.spores.length - 1; i >= 0; i--) {
            const s = this.spores[i];
            s.r += 5;
            s.life--;
            if (s.life <= 0) this.spores.splice(i, 1);
        }

        // Pokeball animasyonu
        if (this.ballAnim) {
            const ball = this.ballAnim;
            ball.frame++;
            if (ball.frame === 15) {
                // Topa girdi: sallanma başlar
                ball.x = ball.enemy.x;
                ball.y = ball.enemy.y;
            }
            if (ball.frame >= 55) {
                // Yakalandı
                const caught = ball.enemy;
                const joinedParty = this.progress.addCapture(caught.id, caught.name);
                this.captures = this.progress.collection;
                this.spawnMapText(caught.x, caught.y - 30, `${caught.name} yakalandı!`, '#4ade80');
                if (!joinedParty) {
                    this.spawnMapText(caught.x, caught.y - 54, 'Ekip dolu - kütüphaneye gönderildi', '#94a3b8');
                } else {
                    // Yeni üye ekibe katıldı: sahaya hazırlansın
                    this.buildMember(this.progress.party[this.progress.party.length - 1])
                        .then(pokemon => {
                            this.partyPokemon.push(pokemon);
                            preloadTypes(pokemon.types);
                        })
                        .catch(error => console.error('Yeni ekip üyesi hazırlanamadı:', error));
                }
                this.enemies = this.enemies.filter(e => e !== caught);
                this.ballAnim = null;
            }
        }

        // Boss uyanışı enkazı ve ekran sarsıntısı
        if (this.shake > 0) this.shake *= 0.9;
        if (this.shake < 0.3) this.shake = 0;
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += d.gravity;
            d.x += d.vx;
            d.y += d.vy;
            d.life--;
            if (d.life <= 0) this.debris.splice(i, 1);
        }

        // Uçan yazılar
        for (let i = this.mapTexts.length - 1; i >= 0; i--) {
            const t = this.mapTexts[i];
            t.y -= 0.8;
            t.life--;
            if (t.life <= 0) this.mapTexts.splice(i, 1);
        }
    }

    castAbility(index) {
        const caster = this.active;
        if (!caster || caster.fainted) return;

        // Yetenekler sahadaki Pokemonun konumundan çıkar
        const player = { x: caster.x, y: caster.y, aim: this.player.aim, facing: caster.facing };
        const ability = caster.abilities[index];
        if (!ability || caster.cooldowns[index] > 0) return;

        if (ability.kind === 'aoe' && ability.type === 'sleep') {
            // Sleep Powder: çevredeki düşmanları uyutur
            let hit = 0;
            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < ability.radius) {
                    enemy.stunTimer = ability.stun;
                    hit++;
                }
            }
            this.spores.push({ x: player.x, y: player.y, r: 20, life: 30, color: 'sleep' });
            if (hit > 0) this.spawnMapText(player.x, player.y - 50, `${hit} Pokemon uyudu!`, '#a78bfa');
        } else if (ability.kind === 'aoe') {
            // Petal Blizzard: çevredeki herkese alan hasarı
            const damage = ability.damage * caster.damageMultiplier * caster.damageBoost;
            let hit = 0;
            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < ability.radius) {
                    enemy.takeDamage(damage);
                    hit++;
                }
            }
            this.spores.push({ x: player.x, y: player.y, r: 20, life: 34, color: 'petal' });
            this.spawnMapText(player.x, player.y - 50, ability.name.toUpperCase() + '!', '#f472b6');
            if (hit === 0) this.spawnMapText(player.x, player.y - 74, 'Isabet yok', '#94a3b8');
        } else if (ability.kind === 'heal') {
            // Jungle Healing: canın bir kısmını yeniler
            const healed = Math.round(caster.maxHp * ability.heal);
            caster.heal(healed);
            this.spores.push({ x: player.x, y: player.y, r: 14, life: 30, color: 'heal' });
            this.spawnMapText(player.x, player.y - 50, `+${healed} CAN`, '#4ade80');
        } else if (ability.kind === 'dash') {
            // First Impression: ileri atılıp yol üstündekileri biçer
            const aim = this.aimVector();
            const damage = ability.damage * caster.damageMultiplier * caster.damageBoost;
            const steps = 14;
            let hit = false;

            // Antrenör ve Pokemon birlikte atılır
            const trainer = this.player;
            for (let i = 1; i <= steps; i++) {
                const nx = trainer.x + aim.x * (ability.distance / steps);
                const ny = trainer.y + aim.y * (ability.distance / steps);
                if (!this.canMoveTo(nx, trainer.y)) break;
                trainer.x = nx;
                if (this.canMoveTo(trainer.x, ny)) trainer.y = ny;
                caster.x = trainer.x;
                caster.y = trainer.y;

                for (const enemy of this.enemies) {
                    if (enemy.fainted || enemy.dashHit) continue;
                    if (Math.hypot(enemy.x - caster.x, enemy.y - caster.y) < enemy.size / 2 + 30) {
                        enemy.dashHit = true;
                        const mult = ability.moveType ? effectiveness(ability.moveType, enemy.types) : 1;
                        if (mult > 0) enemy.takeDamage(damage * mult);
                        hit = true;
                    }
                }
            }
            for (const enemy of this.enemies) enemy.dashHit = false;

            caster.invuln = Math.max(caster.invuln, 25); // atılım sırasında kısa dokunulmazlık
            this.effectsTrail(caster.x, caster.y);
            this.spawnMapText(caster.x, caster.y - 50, hit ? `${ability.name.toUpperCase()}!` : ability.name, '#22d3ee');
        } else {
            // Nişan: en yakın ayakta düşmanın ATIŞ ANINDAKİ konumuna kilitlenir.
            // Duvar delen hamleler (Seed Bomb) hedefi duvar arkasında da seçer.
            const target = this.findAimTarget(ability.pierce);
            const aim = target
                ? this.normalize(target.x - player.x, target.y - player.y)
                : this.aimVector();

            const base = Math.atan2(aim.y, aim.x);
            const count = ability.spread || 1;
            for (let i = 0; i < count; i++) {
                const a = base + (i - (count - 1) / 2) * 0.2;
                this.projectiles.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(a) * ability.speed,
                    vy: Math.sin(a) * ability.speed,
                    type: ability.type,
                    moveType: ability.moveType,
                    damage: ability.damage * caster.damageMultiplier * caster.damageBoost,
                    life: ability.life,
                    pierce: !!ability.pierce,
                    leech: ability.leech || 0
                });
            }
        }

        this.shotsFired++;

        // Uyuyan bossun yakınında ateş etmek onu uyandırır
        for (const enemy of this.enemies) {
            if (enemy.asleep && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 320) {
                enemy.wakeUp();
            }
        }

        caster.cooldowns[index] = ability.cooldown;
    }

    normalize(x, y) {
        const len = Math.hypot(x, y) || 1;
        return { x: x / len, y: y / len };
    }

    // Hedef yoksa son hareket yönü (dururken bakılan yön) kullanılır
    aimVector() {
        const { aim } = this.player;
        if (aim.x === 0 && aim.y === 0) return { x: this.player.facing, y: 0 };
        return this.normalize(aim.x, aim.y);
    }

    // Atılım izi: geçilen yol boyunca kısa ömürlü parçacıklar
    effectsTrail(x, y) {
        for (let i = 0; i < 12; i++) {
            this.debris.push({
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 2,
                size: 3 + Math.random() * 3,
                color: '#67e8f9',
                life: 18 + Math.random() * 10,
                gravity: 0.1
            });
        }
    }

    // Nişan için en yakın uygun düşman. pierce false ise görüş hattı şart.
    findAimTarget(pierce) {
        const { player } = this;
        let best = null;
        let bestDist = 420;

        for (const enemy of this.enemies) {
            if (enemy.fainted) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist >= bestDist) continue;
            if (!pierce && !this.hasLineOfSight(player.x, player.y, enemy.x, enemy.y)) continue;
            bestDist = dist;
            best = enemy;
        }
        return best;
    }

    tryCatch() {
        if (this.ballAnim) return;

        // En yakın bayılmış Pokemonu bul (bosslar yakalanamaz, yenilir)
        let target = null;
        let best = 110; // maksimum atış mesafesi
        for (const enemy of this.enemies) {
            if (!enemy.fainted || enemy.isBoss) continue;
            const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
            if (dist < best) {
                best = dist;
                target = enemy;
            }
        }

        if (!target) {
            this.spawnMapText(this.player.x, this.player.y - 50, 'Yakında bayılmış Pokemon yok', '#94a3b8');
            return;
        }

        // Poke Ball tükenen bir kaynaktır; Kecleon'dan satın alınır
        if (!this.progress.consumeItem('poke-ball')) {
            this.spawnMapText(this.player.x, this.player.y - 50, 'Poke Ball kalmadı! (Tüccar)', '#f87171');
            return;
        }

        this.ballAnim = {
            enemy: target,
            frame: 0,
            fromX: this.player.x,
            fromY: this.player.y - 20,
            x: this.player.x,
            y: this.player.y - 20
        };
    }

    // Hasar sahadaki Pokemona gider; tip etkililiği burada uygulanır
    damageActive(amount, from, moveType) {
        const target = this.active;
        if (!target || target.fainted || target.invuln > 0) return;

        let final = amount;
        if (moveType) {
            const mult = effectiveness(moveType, target.types);
            final = amount * mult;
            const label = effectivenessLabel(mult);
            if (label) this.spawnMapText(target.x, target.y - 70, label.text, label.color);
            if (mult === 0) return;
        }

        target.takeDamage(final);
        this.spawnMapText(target.x, target.y - 46, `-${Math.ceil(final)}`, '#ff4444');
    }

    // Eski çağrılar için: düşman teması da sahadaki Pokemona işler
    damagePlayer(amount, from) {
        this.damageActive(amount, from, from?.attack?.moveType);
    }

    spawnMapText(x, y, text, color) {
        this.mapTexts.push({ x, y, text, color, life: 70 });
    }

    // --- Seviye ve evrim ---

    // Yenilen Pokemon yetenek jetonu düşürür (XP yok; seviyeyi oyuncu dağıtır)
    awardXp(enemy) {
        const amount = this.progress.tokensForEnemy(enemy.kind);
        this.spawnTokenDrop(enemy.x, enemy.y, amount);
    }

    // Bir ekip üyesinin seviyesine uygun en ileri formu bulur;
    // gerekiyorsa evrim sahnesini başlatır.
    async checkEvolution(index, silent = false) {
        const { progress } = this;
        const member = progress.party[index];
        const pokemon = this.partyPokemon[index];
        if (!member || !pokemon) return;

        let chain = this.evolutionChains?.get(member.id);
        if (!chain) {
            try {
                chain = await fetchEvolutionChain(member.id);
                if (!this.evolutionChains) this.evolutionChains = new Map();
                this.evolutionChains.set(member.id, chain);
            } catch (error) {
                console.warn('Evrim zinciri alınamadı:', error);
                return;
            }
        }
        if (chain.length < 2) return;

        let target = chain[0];
        for (const stage of chain) {
            if (stage.minLevel === null || member.level >= stage.minLevel) target = stage;
            else break;
        }
        if (target.id === member.formId) return;

        const fromImg = pokemon.img.src;
        progress.setForm(index, target.id);

        try {
            const data = await fetchCharacter({ id: target.id });
            const evolved = await this.buildMember(progress.party[index]);
            evolved.hp = Math.min(evolved.maxHp, Math.round(evolved.maxHp * (pokemon.hp / pokemon.maxHp)));
            evolved.x = pokemon.x;
            evolved.y = pokemon.y;

            const wasActive = this.active === pokemon;
            this.partyPokemon[index] = evolved;
            if (wasActive) this.active = evolved;

            preloadTypes(evolved.types);
            if (!silent) this.startEvolutionScene(fromImg, pokemon.name, data);
        } catch (error) {
            console.error('Evrim formu yüklenemedi:', error);
        }
    }

    // Klasik Pokemon evrim sahnesi: karakter beyaz silüete döner, iki form
    // arasında gidip gelir, sonra parlamayla yeni form ortaya çıkar.
    startEvolutionScene(fromSrc, oldName, character) {
        const oldImg = new Image();
        oldImg.src = fromSrc;

        const newImg = new Image();
        newImg.src = character.battleSprite || character.sprite;

        this.evolutionScene = {
            frame: 0,
            oldImg,
            newImg,
            oldName,
            newName: character.name,
            applied: true, // yeni form zaten uygulandı; sahne yalnızca gösterimdir
            sparks: []
        };
    }

    updateEvolutionScene() {
        const scene = this.evolutionScene;
        scene.frame++;

        // 200. karede parlama ve kıvılcım patlaması
        if (!scene.burst && scene.frame >= 200) {
            scene.burst = true;
            for (let i = 0; i < 60; i++) {
                scene.sparks.push({
                    x: 0, y: 0,
                    angle: (i / 60) * Math.PI * 2,
                    speed: 2 + Math.random() * 4,
                    dist: 0,
                    color: ['#fef08a', '#4ade80', '#ffffff', '#86efac'][i % 4]
                });
            }
        }

        if (scene.frame > 330) this.evolutionScene = null;
    }

    drawEvolutionScene() {
        const scene = this.evolutionScene;
        if (!scene) return;
        const { ctx, canvas } = this;
        const f = scene.frame;

        ctx.save();
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2 - 10;

        // Geçiş hızlanarak artar: önce yavaş, sonra çılgınca yanıp söner
        const speed = Math.max(4, 30 - Math.floor(f / 8));
        const showNew = f >= 200 ? true : (f > 40 && Math.floor(f / speed) % 2 === 1);
        const img = showNew ? scene.newImg : scene.oldImg;
        const size = showNew ? 150 : 130;

        // Arkada büyüyen ışık halkası
        const halo = 60 + Math.min(140, f * 0.7);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#4ade80';
        for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2 + f / 40;
            ctx.fillRect(cx + Math.cos(a) * halo - 3, cy + Math.sin(a) * halo - 3, 6, 6);
        }
        ctx.globalAlpha = 1;

        // Silüet (yeni form ortaya çıkana kadar bembeyaz)
        if (img.complete && img.naturalWidth > 0) {
            if (f < 200) {
                // Beyaz silüet: sprite'ı maske olarak kullan
                const off = document.createElement('canvas');
                off.width = off.height = size;
                const octx = off.getContext('2d');
                octx.imageSmoothingEnabled = false;
                octx.drawImage(img, 0, 0, size, size);
                octx.globalCompositeOperation = 'source-in';
                octx.fillStyle = '#ffffff';
                octx.fillRect(0, 0, size, size);
                ctx.drawImage(off, cx - size / 2, cy - size / 2);
            } else {
                ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
            }
        }

        // Patlama kıvılcımları
        for (const spark of scene.sparks) {
            spark.dist += spark.speed;
            ctx.fillStyle = spark.color;
            ctx.fillRect(cx + Math.cos(spark.angle) * spark.dist - 2, cy + Math.sin(spark.angle) * spark.dist - 2, 4, 4);
        }

        // Beyaz parlama anı
        if (f >= 195 && f < 215) {
            ctx.globalAlpha = 1 - (f - 195) / 20;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
        }

        // Yazılar
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.font = "bold 26px 'Space Grotesk', sans-serif";
        if (f < 200) {
            const text = `${scene.oldName} evrimleşiyor!`;
            ctx.strokeText(text, cx, cy + 130);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(text, cx, cy + 130);
        } else {
            const text = `Tebrikler! ${scene.oldName} → ${scene.newName}`;
            ctx.strokeText(text, cx, cy + 130);
            ctx.fillStyle = '#4ade80';
            ctx.fillText(text, cx, cy + 130);
        }

        ctx.restore();
    }

    // Boss uyandı: arena bölgesindeki ağaç/çalıları paramparça edip
    // zemini bossun temasına (kavrulmuş toprak) çevirir.
    onBossWake(boss) {
        const map = this.currentMap;
        const arena = map.bossArena;
        this.shake = 26;
        this.spawnMapText(boss.x, boss.y - 70, `${boss.name} UYANDI!`, '#f97316');
        if (!arena || this.arenaOpened) return;
        this.arenaOpened = true;

        // Izgara kopyası üzerinde çalış (orijinal harita verisi bozulmasın)
        const grid = map.grid.map(row => row.split(''));
        for (let row = arena.row0; row <= arena.row1; row++) {
            for (let col = arena.col0; col <= arena.col1; col++) {
                if (!grid[row] || grid[row][col] === undefined) continue;
                const tile = grid[row][col];
                if (map.portalDefs[tile]) continue; // portallar korunur

                if (tile === 'A') continue; // kadim ağaç yıkılmaz

                // Yıkılan engellerden enkaz fışkırır
                if (tile === 'T' || tile === 'h' || tile === 'H' || tile === 'R') {
                    const px = col * TILE_SIZE + TILE_SIZE / 2;
                    const py = row * TILE_SIZE + TILE_SIZE / 2;
                    for (let i = 0; i < 5; i++) {
                        this.debris.push({
                            x: px, y: py,
                            vx: (Math.random() - 0.5) * 9,
                            vy: -Math.random() * 8 - 2,
                            size: 3 + Math.random() * 3,
                            color: tile === 'R' ? '#64748b' : (Math.random() < 0.5 ? '#14532d' : '#4a2800'),
                            life: 45 + Math.random() * 30,
                            gravity: 0.4
                        });
                    }
                }
                grid[row][col] = 'b';
            }
        }

        // Değiştirilmiş ızgarayı bu oturum için kullan
        this.currentMap = { ...map, grid: grid.map(row => row.join('')) };
        this.flow = null;
        this.bakeTerrain(); // yıkılan arena yeniden pişirilir
    }

    onBossDefeated(boss) {
        const isNew = this.progress.markBossDefeated(this.currentMap.id);

        // Rozet ve onunla açılan saha hamlesi
        const move = FIELD_MOVES.find(m => m.badge === this.currentMap.id);
        const badge = isNew && move ? move : null;

        // Bossun düşürdüğü jetonları toplamak için süre tanı; zafer ekranı
        // ancak jetonlar alındıktan (ya da süre dolduktan) sonra açılır
        this.pendingVictory = { boss, badge, wait: 420 };
        this.spawnMapText(boss.x, boss.y - 90, 'Jetonları topla!', '#fbbf24');
    }

    // Jetonlar toplanınca (ya da süre dolunca) zafer sahnesini başlat
    updatePendingVictory() {
        const pending = this.pendingVictory;
        if (!pending) return;

        pending.wait--;
        // Haritada jeton kalmadıysa beklemeye gerek yok (kısa bir tampon bırak)
        if (this.tokenDrops.length === 0 && pending.wait > 60) pending.wait = 60;
        if (pending.wait > 0) return;

        this.pendingVictory = null;
        this.startVictory(pending.boss, pending.badge);
    }

    startVictory(boss, badge) {
        this.victory = {
            frame: 0,
            name: boss.name,
            isRegionBoss: boss.kind === 'regionBoss',
            locationName: this.currentMap.name,
            badge,
            confetti: []
        };
        for (let i = 0; i < 90; i++) {
            this.victory.confetti.push({
                x: Math.random() * this.canvas.width,
                y: -Math.random() * this.canvas.height,
                vy: 1.5 + Math.random() * 3,
                vx: (Math.random() - 0.5) * 1.5,
                size: 3 + Math.random() * 3,
                color: ['#fbbf24', '#4ade80', '#60a5fa', '#f472b6', '#f8fafc'][Math.floor(Math.random() * 5)]
            });
        }
    }

    // ---- Çizim ----

    // Zemin, harita yüklenirken iki animasyon karesi halinde offscreen canvas'a
    // bir kez çizilir. Her karede binlerce fillRect yerine tek drawImage yapılır;
    // harita değişince (gizli oda açılması, boss yıkımı) yeniden pişirilir.
    bakeTerrain() {
        const grid = this.currentMap.grid;
        const w = grid[0].length * TILE_SIZE;
        const h = grid.length * TILE_SIZE;

        // Karo desenleri konuma göre değişir ama VARIANTS karoda bir tekrar eder;
        // her benzersiz desen bir kez çizilip önbelleğe alınır, sonra kopyalanır.
        // (Doğrudan çizim harita başına ~230.000 fillRect demek olurdu.)
        const VARIANTS = 6;
        const patches = new Map();
        const patchFor = (tile, col, row, phase) => {
            const vc = col % VARIANTS;
            const vr = row % VARIANTS;
            const key = `${tile}|${vc}|${vr}|${phase}`;
            let patch = patches.get(key);
            if (!patch) {
                patch = document.createElement('canvas');
                patch.width = TILE_SIZE;
                patch.height = TILE_SIZE;
                const pctx = patch.getContext('2d');
                pctx.imageSmoothingEnabled = false;
                pctx.translate(-vc * TILE_SIZE, -vr * TILE_SIZE);
                this.drawTile(pctx, tile, vc, vr, phase);
                patches.set(key, patch);
            }
            return patch;
        };

        this.terrain = [0, 1].map(phase => {
            const layer = document.createElement('canvas');
            layer.width = w;
            layer.height = h;
            const lctx = layer.getContext('2d');
            lctx.imageSmoothingEnabled = false;

            for (let row = 0; row < grid.length; row++) {
                for (let col = 0; col < grid[row].length; col++) {
                    // Keşfedilmemiş gizli oda dışarıdan ağaçlık görünür
                    const tile = this.isHiddenTile(col, row) ? 'T' : grid[row][col];
                    lctx.drawImage(patchFor(tile, col, row, phase), col * TILE_SIZE, row * TILE_SIZE);
                }
            }
            return layer;
        });
    }

    drawTiles() {
        const { ctx, canvas, camera } = this;
        if (!this.terrain) return;

        // Su/çim animasyonu: iki pişmiş kare arasında geçiş
        const layer = this.terrain[Math.floor(Date.now() / 450) % 2];

        // Yalnızca görünür bölgeyi kopyala
        const view = this.viewSize;
        const sx = Math.max(0, Math.floor(camera.x));
        const sy = Math.max(0, Math.floor(camera.y));
        const sw = Math.min(layer.width - sx, Math.ceil(view.w) + TILE_SIZE);
        const sh = Math.min(layer.height - sy, Math.ceil(view.h) + TILE_SIZE);
        if (sw <= 0 || sh <= 0) return;

        ctx.drawImage(layer, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    // Karo içi PX'lik bloklarla, karoya özgü deterministik desen çizer.
    // PX küçüldükçe piksel sanatı incelir (5 = karo başına 10x10 blok).
    // phase (0|1): su parıltısı ve çim salınımının animasyon karesi.
    drawTile(ctx, tile, col, row, phase = 0) {
        const PX = 5;
        const N = TILE_SIZE / PX; // kenardaki blok sayısı
        const x0 = col * TILE_SIZE;
        const y0 = row * TILE_SIZE;

        // Koyu temalı haritalar (derin orman) daha loş bir palet kullanır
        const dark = this.currentMap.theme === 'dark';
        const palettes = dark ? {
            '.': ['#0c3a1e', '#0f4a26', '#0d4022', '#0f4a26'],
            'p': ['#4a2c0a', '#5b370d', '#66400f', '#5b370d'],
            's': ['#6b4a08', '#7c5306', '#6b4a08', '#5b420a'],
            'R': ['#26303f', '#333e4f', '#455267', '#333e4f'],
            'W': ['#082f49', '#0a3a5c', '#0c4a6e', '#0a3a5c'],
            'b': ['#4a2f14', '#5a3a19', '#3d2610', '#523318']
        } : {
            '.': ['#14532d', '#15803d', '#166534', '#15803d'],
            'p': ['#713f12', '#854d0e', '#92400e', '#854d0e'],
            's': ['#a16207', '#ca8a04', '#a16207', '#92400e'],
            'R': ['#334155', '#475569', '#64748b', '#475569'],
            'W': ['#0c4a6e', '#075985', '#0369a1', '#075985'],
            'b': ['#5a3a19', '#6b4520', '#4a2f14', '#63401c']
        };

        // Çiçek, uzun çim, çalı ve portal karoları çim zemin üzerine çizilir
        const base = palettes[tile] || palettes['.'];

        // İnce dokulu zemin: her blok karoya özgü sahte-rastgele bir tonda
        for (let by = 0; by < N; by++) {
            for (let bx = 0; bx < N; bx++) {
                const idx = (col * 7 + row * 13 + bx * 3 + by * 5 + ((bx * by) % 3)) % base.length;
                ctx.fillStyle = base[idx];
                ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
            }
        }

        if (tile === 'W') {
            // Su: ince dalga çizgileri ve kayan parıltılar
            const t = phase * 3;
            ctx.fillStyle = dark ? '#0e5a86' : '#0ea5e9';
            for (let i = 0; i < 3; i++) {
                const wy = ((col * 3 + row * 7 + i * 3 + t) % N) * PX;
                ctx.fillRect(x0 + ((i * 3) % N) * PX, y0 + wy, PX * 3, PX);
            }
            ctx.fillStyle = '#7dd3fc';
            const sx = ((col * 3 + row * 5 + t) % N) * PX;
            const sy = ((col * 5 + row * 3 + t) % N) * PX;
            ctx.fillRect(x0 + sx, y0 + sy, PX * 2, PX);
        }

        if (tile === 'R') {
            // Kaya: ışık alan üst yüz, gölgeli alt yüz ve çatlaklar
            ctx.fillStyle = dark ? '#5b6a80' : '#94a3b8';
            for (let bx = 1; bx < N - 2; bx++) ctx.fillRect(x0 + bx * PX, y0 + PX, PX, PX);
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x0 + PX * 2, y0 + PX * 2, PX, PX);
            ctx.fillStyle = '#1e293b';
            for (let i = 0; i < 4; i++) {
                const cx = ((col * 5 + row * 3 + i * 7) % (N - 2) + 1) * PX;
                const cy = ((col * 7 + row * 5 + i * 11) % (N - 3) + 3) * PX;
                ctx.fillRect(x0 + cx, y0 + cy, PX, PX);
            }
        }

        if (tile === 'T') {
            // Ağaç: dokulu gövde + katmanlı yaprak kütlesi
            const trunk = dark ? '#2e1503' : '#451a03';
            const trunkLight = dark ? '#3f2109' : '#5c2708';
            for (let by = 6; by < N; by++) {
                ctx.fillStyle = by % 2 === 0 ? trunk : trunkLight;
                ctx.fillRect(x0 + PX * 4, y0 + by * PX, PX * 2, PX);
            }
            const leafColors = dark
                ? ['#02180b', '#052e16', '#0a3a1c', '#0d4a24']
                : ['#052e16', '#14532d', '#166534', '#16a34a'];
            // Elips biçimli taç (10x10 ızgarada)
            for (let by = 0; by < 7; by++) {
                for (let bx = 0; bx < N; bx++) {
                    const ddx = (bx - 4.5) / 4.6;
                    const ddy = (by - 3) / 3.4;
                    if (ddx * ddx + ddy * ddy > 1) continue;
                    const idx = (col * 11 + row * 17 + bx * 2 + by * 5) % leafColors.length;
                    ctx.fillStyle = leafColors[idx];
                    ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
                }
            }
            // Üstten gelen ışık vurgusu
            ctx.fillStyle = dark ? '#12602e' : '#22c55e';
            ctx.fillRect(x0 + PX * 3, y0 + PX, PX, PX);
            ctx.fillRect(x0 + PX * 4, y0, PX, PX);
        }

        if (tile === 'A') {
            // Kadim ağaç: kalın dikey kabuk damarları, yosun ve parlayan runeler
            const bark = ['#3b1f08', '#4a2a0c', '#2c1606', '#553012'];
            for (let by = 0; by < N; by++) {
                for (let bx = 0; bx < N; bx++) {
                    const idx = (bx * 2 + ((by + bx) % 3) + col * 3 + row * 5) % bark.length;
                    ctx.fillStyle = bark[idx];
                    ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
                }
            }
            // Dikey kabuk çatlakları
            ctx.fillStyle = '#1a0d03';
            for (let bx = 1; bx < N; bx += 3) {
                for (let by = 0; by < N; by++) {
                    if ((by + bx + col + row) % 4 === 0) continue;
                    ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
                }
            }
            // Yosun tutamları
            ctx.fillStyle = '#166534';
            for (let i = 0; i < 5; i++) {
                const mx = ((col * 7 + row * 11 + i * 5) % N) * PX;
                const my = ((col * 5 + row * 3 + i * 13) % N) * PX;
                ctx.fillRect(x0 + mx, y0 + my, PX, PX);
            }
            // Nefes alan kadim runeler (iki pişmiş kare arasında yanıp söner)
            ctx.globalAlpha = phase === 0 ? 0.55 : 1;
            ctx.fillStyle = '#4ade80';
            for (let i = 0; i < 3; i++) {
                const rx = ((col * 13 + row * 7 + i * 11) % (N - 2) + 1) * PX;
                const ry = ((col * 3 + row * 17 + i * 5) % (N - 3) + 1) * PX;
                ctx.fillRect(x0 + rx, y0 + ry, PX, PX);
                ctx.fillRect(x0 + rx, y0 + ry + PX, PX, PX);
                ctx.fillRect(x0 + rx + PX, y0 + ry + PX, PX, PX);
            }
            ctx.globalAlpha = 1;
        }

        if (tile === 'f') {
            // Çiçekler: 5 taçlı ince desen (artı biçimi + sarı göbek)
            const flowerColors = ['#f472b6', '#fbbf24', '#f87171', '#e0f2fe'];
            for (let i = 0; i < 4; i++) {
                const fx = ((col * 13 + row * 7 + i * 11) % (N - 3) + 1) * PX;
                const fy = ((col * 5 + row * 11 + i * 17) % (N - 3) + 1) * PX;
                ctx.fillStyle = flowerColors[(col + row + i) % flowerColors.length];
                ctx.fillRect(x0 + fx, y0 + fy - PX, PX, PX);
                ctx.fillRect(x0 + fx, y0 + fy + PX, PX, PX);
                ctx.fillRect(x0 + fx - PX, y0 + fy, PX, PX);
                ctx.fillRect(x0 + fx + PX, y0 + fy, PX, PX);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(x0 + fx, y0 + fy, PX, PX);
            }
        }

        if (tile === 'g') {
            // Uzun çim: tek piksel kalınlığında, salınan ince yapraklar
            const sway = phase === 0 ? 0 : PX;
            const bladeColors = dark ? ['#0d4a24', '#12602e', '#16a34a'] : ['#166534', '#16a34a', '#22c55e'];
            for (let i = 0; i < 7; i++) {
                const gx = ((col * 7 + row * 3 + i * 9) % (N - 1)) * PX;
                const gh = 3 + ((col + row + i) % 4); // blok cinsinden boy
                ctx.fillStyle = bladeColors[i % bladeColors.length];
                for (let b = 0; b < gh; b++) {
                    // Uca doğru bükülme
                    const bend = b >= gh - 2 ? sway : 0;
                    ctx.fillRect(x0 + gx + bend, y0 + (N - 1 - b) * PX, PX, PX);
                }
            }
        }

        if (tile === 'b') {
            // Boss arenası: çatlaklar, kavlamış toprak ve kırık dal parçaları
            const scarColors = ['#3f2a12', '#4a3218', '#2e1d0c'];
            for (let i = 0; i < 8; i++) {
                const sx = ((col * 5 + row * 11 + i * 13) % N) * PX;
                const sy = ((col * 7 + row * 3 + i * 17) % N) * PX;
                ctx.fillStyle = scarColors[(col + row + i) % scarColors.length];
                ctx.fillRect(x0 + sx, y0 + sy, PX, PX);
            }
            // Çapraz çatlak
            if ((col * 3 + row * 5) % 3 === 0) {
                ctx.fillStyle = '#1f1408';
                for (let b = 0; b < N; b++) {
                    const cy = ((b + col + row) % 3 === 0) ? b + 1 : b;
                    if (cy < N) ctx.fillRect(x0 + b * PX, y0 + cy * PX, PX, PX);
                }
            }
        }

        // Gizli çalı normal çalıyla birebir aynı çizilir (içinden geçilebilir)
        if (tile === 'h' || tile === 'H') {
            // Çalı: yuvarlak, yoğun yaprak kümesi + üstte ışık vurgusu
            const bushColors = dark ? ['#052e16', '#0d4a24', '#12602e'] : ['#14532d', '#166534', '#16a34a'];
            for (let by = 0; by < N; by++) {
                for (let bx = 0; bx < N; bx++) {
                    const ddx = (bx - 4.5) / 4.6;
                    const ddy = (by - 4.5) / 4.6;
                    if (ddx * ddx + ddy * ddy > 1) continue;
                    const idx = (col * 9 + row * 5 + bx * 3 + by * 2) % bushColors.length;
                    ctx.fillStyle = bushColors[idx];
                    ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
                }
            }
            // Üst yaprakların ışık alan noktaları
            ctx.fillStyle = dark ? '#16a34a' : '#4ade80';
            ctx.fillRect(x0 + PX * 3, y0 + PX * 2, PX, PX);
            ctx.fillRect(x0 + PX * 5, y0 + PX, PX, PX);
            ctx.fillRect(x0 + PX * 6, y0 + PX * 3, PX, PX);
        }
    }

    drawPortals() {
        const { ctx } = this;
        const t = Date.now() / 100;

        for (const portal of this.portals) {
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE + TILE_SIZE / 2;
            const [main, light, bright] = portal.colors;

            ctx.save();
            if (!portal.target) ctx.globalAlpha = 0.6; // pasif portal soluk görünür
            ctx.shadowBlur = 14;
            ctx.shadowColor = main;

            // Dönen ince piksel halka (iç içe iki tur)
            const n = 22;
            for (let i = 0; i < n; i++) {
                const a = t * 0.2 + (i / n) * Math.PI * 2;
                const r = 20 + Math.sin(t * 0.5 + i) * 2;
                ctx.fillStyle = i % 3 === 0 ? bright : (i % 3 === 1 ? light : main);
                ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r * 0.7 - 1.5, 3, 3);
            }

            // Merkez girdap
            for (let i = 0; i < 8; i++) {
                const a = -t * 0.4 + (i / 8) * Math.PI * 2;
                const r = 5 + (i % 3) * 2;
                ctx.fillStyle = i % 2 === 0 ? light : bright;
                ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r * 0.7 - 1.5, 3, 3);
            }
            ctx.fillStyle = bright;
            ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);

            ctx.restore();
        }
    }

    drawPortalLabels() {
        const { ctx } = this;
        ctx.save();
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const portal of this.portals) {
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE - 8;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(portal.label, cx, cy);
            ctx.fillStyle = portal.colors[1];
            ctx.fillText(portal.label, cx, cy);
        }

        ctx.restore();
    }

    // Tüccar tezgahı: ahşap tezgah + kırmızı-beyaz tente; Kecleon arkasında durur
    drawShops() {
        const { ctx } = this;

        for (const shop of this.shops) {
            const x0 = shop.col * TILE_SIZE;
            const y0 = shop.row * TILE_SIZE;
            const cx = x0 + TILE_SIZE / 2;

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // Tüccar (tezgahın arkasında, hafifçe sallanır)
            if (this.merchantReady) {
                const bob = Math.sin(Date.now() / 400) * 2;
                ctx.drawImage(this.merchantImg, cx - 26, y0 - 28 + bob, 52, 52);
            }

            // Ahşap tezgah (ince tahta damarlarıyla)
            ctx.fillStyle = '#78350f';
            ctx.fillRect(x0 + 2, y0 + 18, TILE_SIZE - 4, 28);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x0 + 2, y0 + 18, TILE_SIZE - 4, 3);
            ctx.fillStyle = '#a16207';
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(x0 + 4 + i * 9, y0 + 24 + (i % 2) * 6, 6, 2);
            }
            ctx.fillStyle = '#451a03';
            for (let i = 0; i < 6; i++) {
                ctx.fillRect(x0 + 5 + i * 7, y0 + 30, 2, 14);
            }

            // Tente direkleri
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x0 + 1, y0 - 34, 3, 52);
            ctx.fillRect(x0 + TILE_SIZE - 4, y0 - 34, 3, 52);

            // Kırmızı-beyaz şeritli tente (ince şeritler + fırfırlı etek)
            for (let i = 0; i < 9; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
                ctx.fillRect(x0 - 2 + i * 6, y0 - 44, 6, 9);
                ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#e2e8f0';
                ctx.fillRect(x0 - 2 + i * 6, y0 - 35, 6, 3);
                // Fırfır uçları
                ctx.fillRect(x0 - 2 + i * 6 + 1, y0 - 32, 4, 2);
            }

            ctx.restore();
        }
    }

    drawShopLabels() {
        const { ctx } = this;
        ctx.save();
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const shop of this.shops) {
            const cx = shop.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = shop.row * TILE_SIZE - 52;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(this.merchantLabel, cx, cy);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(this.merchantLabel, cx, cy);
        }

        ctx.restore();
    }

    // Antrenör (elle çizilmiş piksel sprite; vurulmaz)
    drawPlayer() {
        const { ctx, player } = this;

        // Gölge
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.fillRect(player.x - 11, player.y + 22, 22, 4);
        ctx.restore();

        drawTrainer(ctx, player.x, player.y, player.dir, player.moving, 3);
    }

    // Sahaya sürülen Pokemonun havada dönen topu
    drawDeployBall() {
        const ball = this.deployBall;
        if (!ball) return;
        const { ctx } = this;

        const t = ball.frame / 18;
        const x = ball.fromX + (ball.toX - ball.fromX) * t;
        const y = ball.fromY + (ball.toY - ball.fromY) * t - Math.sin(t * Math.PI) * 46;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(x, y);
        ctx.rotate(ball.frame * 0.45);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-6, -6, 12, 6);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-6, 0, 12, 6);
        ctx.fillStyle = '#111827';
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
    }

    // Önündeki engel saha hamlesiyle aşılabiliyorsa (ya da tezgahtaysa) ipucu göster
    drawFieldHint() {
        const { ctx } = this;

        // Tüccarın önünde: alışveriş ipucu
        if (this.nearShop()) {
            const bob = Math.sin(Date.now() / 250) * 2;
            ctx.save();
            ctx.font = "bold 13px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('F: Alışveriş', this.player.x, this.player.y - 34 + bob);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText('F: Alışveriş', this.player.x, this.player.y - 34 + bob);
            ctx.restore();
            return;
        }

        const target = this.nearbyFieldTarget();
        if (!target) return;

        const x = target.col * TILE_SIZE + TILE_SIZE / 2;
        const y = target.row * TILE_SIZE + TILE_SIZE / 2;
        const bob = Math.sin(Date.now() / 250) * 2;

        ctx.save();
        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const text = target.locked ? `${target.move.name} gerekli` : target.move.hint;
        ctx.strokeText(text, x, y - TILE_SIZE / 2 - 6 + bob);
        ctx.fillStyle = target.locked ? '#94a3b8' : target.move.color;
        ctx.fillText(text, x, y - TILE_SIZE / 2 - 6 + bob);
        ctx.restore();
    }

    // Yenilen düşmanlardan düşen yetenek jetonları
    spawnTokenDrop(x, y, amount) {
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 8 + Math.random() * 26;
            this.tokenDrops.push({
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                phase: Math.random() * Math.PI * 2,
                life: 3600 // ~1 dakika sonra kaybolur
            });
        }
    }

    // Antrenör jetonun üstünden geçince toplanır
    collectTokens() {
        const { player, progress } = this;
        let collected = 0;

        for (let i = this.tokenDrops.length - 1; i >= 0; i--) {
            const token = this.tokenDrops[i];
            token.life--;

            const dist = Math.hypot(token.x - player.x, token.y - player.y);
            // Yakındaki jetonlar antrenöre doğru çekilir
            if (dist < 70) {
                token.x += (player.x - token.x) * 0.16;
                token.y += (player.y - token.y) * 0.16;
            }
            if (dist < 22) {
                this.tokenDrops.splice(i, 1);
                collected++;
                continue;
            }
            if (token.life <= 0) this.tokenDrops.splice(i, 1);
        }

        if (collected > 0) {
            progress.addTokens(collected);
            this.spawnMapText(player.x, player.y - 40, `+${collected} jeton`, '#fbbf24');
        }
    }

    drawTokenDrops() {
        const { ctx } = this;
        const t = Date.now() / 200;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const token of this.tokenDrops) {
            const bob = Math.sin(t + token.phase) * 3;
            const x = token.x, y = token.y + bob;

            ctx.globalAlpha = token.life < 120 ? token.life / 120 : 1;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fbbf24';
            // Altın jeton: dış halka, iç dolgu ve parlama
            ctx.fillStyle = '#b45309';
            ctx.fillRect(x - 6, y - 6, 12, 12);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 4, y - 6, 8, 12);
            ctx.fillRect(x - 6, y - 4, 12, 8);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(x - 2, y - 4, 3, 3);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x - 1, y - 2, 3, 5);
        }
        ctx.restore();
    }

    drawProjectiles() {
        const { ctx } = this;
        for (const p of [...this.projectiles, ...this.enemyProjectiles]) {
            const def = PROJECTILE_SPRITES[p.type];
            if (def) {
                const opts = {};
                if (def.spin) opts.angle = (Date.now() / 1000) * def.spin;
                else if (def.directional && p.vx < 0) opts.flip = true;
                drawPixelSprite(ctx, def, p.x, p.y, opts);
            }
        }
    }

    // Alan etkileri: genişleyen piksel halkası (uyku sporu, taç yaprağı, şifa)
    drawSpores() {
        const { ctx } = this;
        const palettes = {
            sleep: ['#ddd6fe', '#a78bfa', '#c4b5fd'],
            petal: ['#fce7f3', '#f472b6', '#db2777'],
            heal: ['#dcfce7', '#4ade80', '#86efac']
        };

        for (const s of this.spores) {
            const colors = palettes[s.color] || palettes.sleep;
            ctx.save();
            ctx.globalAlpha = Math.max(0, s.life / 30) * 0.8;
            const n = 34;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + s.r * 0.02;
                ctx.fillStyle = colors[i % 3];
                ctx.fillRect(s.x + Math.cos(a) * s.r - 1.5, s.y + Math.sin(a) * s.r - 1.5, 3, 3);
            }
            ctx.restore();
        }
    }

    drawBallAnim() {
        if (!this.ballAnim) return;
        const { ctx } = this;
        const ball = this.ballAnim;

        // Uçuş: oyuncudan hedefe (ilk 15 kare), sonra hedefte sallanma
        let bx, by, tilt = 0;
        if (ball.frame < 15) {
            const t = ball.frame / 15;
            bx = ball.fromX + (ball.enemy.x - ball.fromX) * t;
            by = ball.fromY + (ball.enemy.y - ball.fromY) * t - Math.sin(t * Math.PI) * 40;
        } else {
            bx = ball.enemy.x;
            by = ball.enemy.y;
            tilt = Math.sin((ball.frame - 15) / 4) * 0.35; // sallanma
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(bx, by);
        ctx.rotate(tilt);
        // Pokeball: 16x16'lık ince piksel deseni (P kırmızı, w beyaz, k siyah)
        const BALL = [
            '....kkkkkk....',
            '..kkPPPPPPkk..',
            '.kPPPPPPPPPPk.',
            '.kPPwPPPPPPPk.',
            'kPPwPPPPPPPPPk',
            'kPPPPPPPPPPPPk',
            'kkkkkkkkkkkkkk',
            'kkkwwwwwwwwkkk',
            'kwwwkkkkkkwwwk',
            'kwwwkwwwwkwwwk',
            '.kwwkwwwwkwwk.',
            '.kwwwkkkkwwwk.',
            '..kkwwwwwwkk..',
            '....kkkkkk....'
        ];
        const BP = 1.5; // piksel boyutu
        const ballColors = { k: '#111827', P: '#dc2626', w: '#f8fafc' };
        for (let r = 0; r < BALL.length; r++) {
            for (let c = 0; c < BALL[r].length; c++) {
                const color = ballColors[BALL[r][c]];
                if (!color) continue;
                ctx.fillStyle = color;
                ctx.fillRect(-BALL[r].length * BP / 2 + c * BP, -BALL.length * BP / 2 + r * BP, BP, BP);
            }
        }
        ctx.restore();
    }

    // Bayılmış ve menzildeki Pokemonların üstünde yakalama ipucu
    drawCatchHints() {
        const { ctx, player } = this;
        ctx.save();
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const enemy of this.enemies) {
            if (!enemy.fainted) continue;
            if (this.ballAnim && this.ballAnim.enemy === enemy) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist > 110) continue;

            const bob = Math.sin(Date.now() / 250) * 3;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('N: Yakala!', enemy.x, enemy.y - enemy.size / 2 - 8 + bob);
            ctx.fillStyle = '#4ade80';
            ctx.fillText('N: Yakala!', enemy.x, enemy.y - enemy.size / 2 - 8 + bob);
        }

        ctx.restore();
    }

    drawMapTexts() {
        const { ctx } = this;
        ctx.save();
        ctx.font = "bold 15px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const t of this.mapTexts) {
            ctx.globalAlpha = Math.min(1, t.life / 30);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
        }

        ctx.restore();
    }

    // Ekran sabiti arayüz: can barı, yetenek kutuları, yakalanan sayısı
    drawHud() {
        const { ctx, canvas, player } = this;
        ctx.save();

        const { progress, active } = this;

        // Sahadaki Pokemon paneli (sol üst)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(12, 12, 232, 42);

        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'left';
        ctx.fillStyle = active ? '#f8fafc' : '#facc15';
        ctx.fillText(active ? active.name : '1-6: Poke top fırlat', 18, 26);
        if (active) {
            ctx.fillStyle = '#facc15';
            ctx.fillText(`Sv. ${active.level}`, 150, 26);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(active.types.join('/'), 186, 26);

            // Can barı
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(18, 32, 160, 10);
            ctx.fillStyle = active.hp / active.maxHp > 0.3 ? '#22c55e' : '#ef4444';
            ctx.fillRect(18, 32, 160 * Math.max(0, active.hp / active.maxHp), 10);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(`${Math.max(0, Math.ceil(active.hp))}/${active.maxHp}`, 238, 41);
        }

        // Ekip göstergesi (sol üst, panelin altında): 1-6 tuşlarıyla değişir
        ctx.textAlign = 'center';
        this.partyPokemon.forEach((pokemon, i) => {
            const x = 14 + i * 38;
            const y = 60;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(x, y, 34, 26);
            ctx.strokeStyle = pokemon === active ? '#4ade80' : (pokemon.fainted ? '#7f1d1d' : '#475569');
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 34, 26);

            ctx.font = "bold 11px 'Space Grotesk', sans-serif";
            ctx.fillStyle = pokemon.fainted ? '#7f1d1d' : '#f8fafc';
            ctx.fillText(String(i + 1), x + 9, y + 17);

            // Küçük can çubuğu
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 16, y + 10, 14, 5);
            ctx.fillStyle = pokemon.fainted ? '#7f1d1d' : '#22c55e';
            ctx.fillRect(x + 16, y + 10, 14 * Math.max(0, pokemon.hp / pokemon.maxHp), 5);
        });

        // Jeton ve koleksiyon (sağ üst)
        ctx.textAlign = 'right';
        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(canvas.width - 190, 12, 178, 44);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${progress.tokens} jeton`, canvas.width - 20, 30);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${progress.collection.length} yakalanan · E: kütüphane`, canvas.width - 20, 47);

        // Poke Ball sayacı (tükenince Kecleon'dan alınır)
        const balls = progress.itemCount('poke-ball');
        ctx.fillStyle = balls > 0 ? '#f8fafc' : '#f87171';
        ctx.fillText(`${balls}x`, canvas.width - 158, 30);
        ctx.save();
        ctx.translate(canvas.width - 176, 26);
        ctx.fillStyle = balls > 0 ? '#dc2626' : '#7f1d1d';
        ctx.fillRect(-6, -6, 12, 6);
        ctx.fillStyle = balls > 0 ? '#f8fafc' : '#475569';
        ctx.fillRect(-6, 0, 12, 6);
        ctx.fillStyle = '#111827';
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.restore();

        // Kazanılan saha hamleleri (rozetler)
        const moves = unlockedMoves(progress.badges);
        if (moves.length) {
            ctx.textAlign = 'right';
            ctx.font = "bold 11px 'Space Grotesk', sans-serif";
            moves.forEach((move, i) => {
                const x = canvas.width - 20 - i * 92;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(x - 82, 62, 84, 22);
                ctx.fillStyle = move.color;
                ctx.fillText(move.name, x - 8, 77);
                // Rozet noktası
                ctx.fillRect(x - 76, 69, 8, 8);
            });
        }

        // Yetenek kutuları (sol alt)
        const boxY = canvas.height - 58;
        this.abilities.forEach((ability, i) => {
            const boxX = 12 + i * 52;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(boxX, boxY, 44, 44);

            // Cooldown dolgusu (yukarıdan aşağı iner)
            const cd = active ? active.cooldowns[i] : 0;
            if (cd > 0) {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                ctx.fillRect(boxX, boxY, 44, 44 * (cd / ability.cooldown));
            }

            ctx.strokeStyle = cd > 0 ? '#475569' : '#4ade80';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, boxY, 44, 44);

            ctx.textAlign = 'center';
            ctx.font = "bold 18px 'Space Grotesk', sans-serif";
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(ability.key, boxX + 22, boxY + 26);
            ctx.font = "9px 'Space Grotesk', sans-serif";
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(ability.name, boxX + 22, boxY + 39);
        });

        ctx.restore();
    }
}
