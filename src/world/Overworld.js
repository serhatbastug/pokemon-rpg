import { MAPS, TILE_SIZE, extractPortals } from '../config/worldMap.js';
import { MERCHANT } from '../config/characters.js';
import { PARTY_SIZE } from '../config/progression.js';
import { fetchCharacter } from '../services/pokeapi.js';
import { preloadTypes } from '../services/typeChart.js';
import { FIELD_MOVES, fieldMoveForTile } from '../config/fieldMoves.js';
import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { TRAINER, HIT_STOP, VIEW } from '../config/balance.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { Enemy } from './Enemy.js';

// Overworld'un davranislari konu basliklarina gore ayri modullerde tutulur
// ve prototipe karistirilir; boylece bu dosya yalnizca yasam dongusu,
// harita yukleme ve girdi baglantisiyla ilgilenir.
import { PartyControls } from './systems/PartyControls.js';
import { Navigation } from './systems/Navigation.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { Scenes } from './scenes/Scenes.js';
import { TerrainRenderer } from './render/TerrainRenderer.js';
import { WorldRenderer } from './render/WorldRenderer.js';
import { TrainerCombat } from './systems/TrainerCombat.js';
import { AutoBattle } from './systems/AutoBattle.js';
import { TrainerBattles } from './systems/TrainerBattles.js';

// Kuşbakışı harita motoru: karo tabanlı pixel art haritalar, gezinen oyuncu ve
// portallar. Hedefi (target) olan portala temas haritalar arasında geçiş yapar;
// hedefi olmayan portallar görünür ama pasiftir (henüz açılmamış içerik).
export class Overworld {
    constructor({ canvas, input, onExit, progress, onOpenShop, onMerchantLoaded }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Macera modu piksel sanatı DEĞİL: yüksek çözünürlükte, yumuşatılmış çizim.
        // Mantık her zaman "mantıksal" birimlerde çalışır (viewW/viewH); canvas
        // arka planı RENDER_SCALE katı büyük tutulup CSS ile küçültülür - böylece
        // her şey keskin görünür. (Arena modu piksel tarzını korur.)
        this.viewW = VIEW.width;
        this.viewH = VIEW.height;
        this.res = VIEW.renderScale;

        canvas.width = this.viewW * this.res;
        canvas.height = this.viewH * this.res;
        canvas.style.width = '100%';
        canvas.style.maxWidth = `${this.viewW}px`;
        canvas.style.height = 'auto';
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

        // Görüntü ölçeği: 1'in üstü her şeyi büyütür (düşmanlar "minnacık"
        // görünmesin diye). Yüksek çözünürlük sayesinde bulanıklaşmaz.
        this.zoom = VIEW.zoom;

        this.currentMap = null;
        this.portals = [];
        this.shops = [];
        this.portalCooldown = 0; // haritaya girişte anında geri ışınlanmayı önler
        this.camera = { x: 0, y: 0 };
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
            aim: { x: 1, y: 0 },      // son hareket yönü; yetenekler bu yöne atılır

            // Antrenör de hasar alır; hayatta kalmak kaçınmaya bağlıdır
            maxHp: TRAINER.maxHp,
            hp: TRAINER.maxHp,
            invuln: 0,
            status: null,
            jumpFrames: 0,
            jumpCooldown: 0,
            dashFrames: 0,
            dashCooldown: 0,
            dashDir: { x: 1, y: 0 }
        };

        // Harita savaşı durumu
        this.enemies = [];
        this.projectiles = [];       // oyuncu mermileri
        this.enemyProjectiles = [];  // düşman mermileri
        this.mapTexts = [];
        this.spores = [];
        this.ballAnim = null;   // aktif Pokeball atışı animasyonu
        this.enemyDataCache = new Map(); // PokeAPI verisi (id -> Promise)
        this.flow = null;       // oyuncuya BFS mesafe alanı (labirent takibi için)
        this.fireflies = [];    // atmosfer: ateşböcekleri
        this.debris = [];       // boss uyanışında savrulan enkaz
        this.shake = 0;         // ekran sarsıntısı
        this.hitStop = 0;       // ağır vuruşlarda kısa donma
        this.npcTrainers = [];  // haritadaki NPC antrenörler
        this.arenaOpened = false;
        this.victory = null;        // boss yenildiğinde zafer sahnesi
        this.pendingVictory = null; // jetonlar toplanana kadar bekleyen zafer
        this.shotsFired = 0;        // atılan yetenek sayacı (testler ve hata ayıklama)

        // Atmosfer: kenarları karartan vinyet (bir kez oluşturulur)
        const vg = this.ctx.createRadialGradient(
            this.viewW / 2, this.viewH / 2, this.viewH * 0.45,
            this.viewW / 2, this.viewH / 2, this.viewH * 0.95
        );
        vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vg.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        this.vignette = vg;

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio(); // tarayıcı sesi ilk etkileşimde açar
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

            // Space: zıpla, Shift: atılım (kaçınma hareketleri)
            if (e.code === 'Space') this.jump();
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dash();

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
                    this.merchantImg.src = merchant.sprite || merchant.battleSprite;
                })
                .catch(error => console.error('Tüccar yüklenemedi:', error));
        }

        this.ctx.imageSmoothingEnabled = true;
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
            const enemy = new Enemy({ ...spawn, world: this, region: map.region || 1 });
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
                this.progress.markSeen(enemy.id, data.name, false, enemy.kind); // Pokedex: görüldü
                enemy.img.src = data.sprite || data.battleSprite;
                preloadTypes(enemy.types);
            }).catch(error => console.error(`Düşman #${enemy.id} yüklenemedi:`, error));
        }

        this.bakeTerrain();
        this.updateCamera(true);

        // Harita temasına göre müzik
        playMusic(map.ambience === 'shadow' ? 'shadow' : (map.spawns?.length ? 'forest' : 'town'));

        const title = document.getElementById('overworld-title');
        if (title) title.textContent = map.name;
    }

    stop() {
        stopMusic();
        this.running = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
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
        Sfx.fieldMove();
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

    fetchEnemyData(id) {
        if (!this.enemyDataCache.has(id)) {
            this.enemyDataCache.set(id, fetchCharacter({ id }));
        }
        return this.enemyDataCache.get(id);
    }

    // Oyun mantığı (sabit adım)
    step() {
        // Evrim ve zafer sahnelerinde dünya donar
        if (this.evolutionScene) {
            this.updateEvolutionScene();
            return;
        }
        if (this.victory) return;

        // Hit-stop: ağır vuruşlarda birkaç kare dünya donar, darbe ağırlaşır
        if (this.hitStop > 0) {
            this.hitStop--;
            return;
        }

        this.updateDodge();
        this.movePlayer();
        this.checkPortals();
        this.checkSecretDiscovery();
        this.updateCombat();
        this.updateAutoBattle();
        this.updateTrainerBattles();
        this.updateStatuses();
        this.updatePendingVictory();
        this.updateCamera();
    }

    draw() {
        const { ctx } = this;

        // Tüm çizim mantıksal birimlerde yapılır; buradaki ölçek onu
        // yüksek çözünürlüklü arka plana taşır.
        ctx.setTransform(this.res, 0, 0, this.res, 0, 0);
        ctx.clearRect(0, 0, this.viewW, this.viewH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Dünya, kamera kadar kaydırılarak çizilir (boss uyanışında sarsılır)
        ctx.save();
        const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.camera.x + sx, -this.camera.y + sy);

        this.drawTiles();
        this.drawPortals();
        this.drawShops();
        this.drawTrainerNpcs();
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
        // Tonlama ölçülü: üstüne bir de vinyet biniyor, fazlası haritayı
        // okunmaz hale getiriyor.
        if (this.currentMap.theme === 'dark') {
            ctx.fillStyle = shadowy ? 'rgba(8, 6, 20, 0.26)' : 'rgba(6, 18, 10, 0.09)';
            ctx.fillRect(0, 0, this.viewW, this.viewH);
        }
        if (this.currentMap.ambience) {
            ctx.fillStyle = this.vignette;
            ctx.fillRect(0, 0, this.viewW, this.viewH);
            if (shadowy) {
                // Derinlikler: ikinci kat karartma, koridorlar iyice daralır
                ctx.fillStyle = this.vignette;
                ctx.fillRect(0, 0, this.viewW, this.viewH);
            }
        }

        // Ekran sabiti arayüz (HP, seviye, yetenekler, yakalananlar)
        this.drawHud();
        this.drawVictory();
        this.drawEvolutionScene();
    }

    // ---- Harita savaşı ----

    // --- Seviye ve evrim ---

    // ---- Çizim ----

}

// Modullerdeki metotlari Overworld prototipine ekler.
// Object.assign getter'lari degerlendirip kopyalar; bu yuzden ozellik
// tanimlayicilariyla kopyaliyoruz.
function applyMixins(target, ...mixins) {
    for (const mixin of mixins) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(mixin));
    }
}

applyMixins(
    Overworld.prototype,
    PartyControls,
    Navigation,
    CombatSystem,
    Scenes,
    TerrainRenderer,
    WorldRenderer,
    TrainerCombat,
    AutoBattle,
    TrainerBattles
);
