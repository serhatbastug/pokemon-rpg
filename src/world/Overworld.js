import { MAPS, TILE_SIZE, SOLID_TILES, extractPortals } from '../config/worldMap.js';
import { MERCHANT, STARTER_ABILITIES } from '../config/characters.js';
import { fetchCharacter } from '../services/pokeapi.js';
import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { PROJECTILE_SPRITES, drawPixelSprite } from '../game/projectileSprites.js';
import { Enemy } from './Enemy.js';

// Kuşbakışı harita motoru: karo tabanlı pixel art haritalar, gezinen oyuncu ve
// portallar. Hedefi (target) olan portala temas haritalar arasında geçiş yapar;
// hedefi olmayan portallar görünür ama pasiftir (henüz açılmamış içerik).
export class Overworld {
    constructor({ canvas, input, onExit }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.onExit = onExit;

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

        // Oyuncu durumu
        this.player = {
            x: 0,
            y: 0,
            speed: 3.5,
            size: 72,        // çizim boyutu
            hitbox: { w: 30, h: 20 }, // ayak hizasındaki çarpışma kutusu
            facing: 1,       // 1 = sağa, -1 = sola
            moving: false,
            img: new Image(),
            name: '',
            // Savaş durumu
            maxHp: 100,
            hp: 100,
            cooldowns: STARTER_ABILITIES.map(() => 0),
            invuln: 0,               // hasar sonrası dokunulmazlık kareleri
            aim: { x: 1, y: 0 }      // son hareket yönü; yetenekler bu yöne atılır
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
        this.victory = null;    // boss yakalandığında zafer sahnesi

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
            if (this.victory) return; // zafer sahnesinde oynanış durur

            // Yetenekler: K, O, Ş (Ş Türkçe klavyede Semicolon konumundadır)
            if (e.code === 'KeyK') this.castAbility(0);
            if (e.code === 'KeyO') this.castAbility(1);
            if (e.code === 'Semicolon' || e.key === 'ş' || e.key === 'Ş') this.castAbility(2);

            // N: bayılmış Pokemona Pokeball at
            if (e.code === 'KeyN') this.tryCatch();
        });
    }

    start(character) {
        this.player.img.src = character.battleSprite || character.sprite;
        this.player.name = character.name || '';
        this.player.facing = 1;
        this.player.hp = this.player.maxHp;
        this.player.cooldowns = STARTER_ABILITIES.map(() => 0);
        this.player.invuln = 0;
        this.captures = [];
        this.loadMap('main');

        if (!this.merchantRequested) {
            this.merchantRequested = true;
            fetchCharacter(MERCHANT)
                .then(merchant => {
                    this.merchantLabel = `Tüccar ${merchant.name}`;
                    this.merchantImg.onload = () => { this.merchantReady = true; };
                    this.merchantImg.src = merchant.battleSprite || merchant.sprite;
                })
                .catch(error => console.error('Tüccar yüklenemedi:', error));
        }

        this.ctx.imageSmoothingEnabled = false;
        this.running = true;

        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.update(), 1000 / FRAME_RATE);
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
                enemy.img.src = data.battleSprite || data.sprite;
            }).catch(error => console.error(`Düşman #${enemy.id} yüklenemedi:`, error));
        }

        this.updateCamera(true);

        const title = document.getElementById('overworld-title');
        if (title) title.textContent = map.name;
    }

    // Kamera oyuncuyu ortalayarak takip eder, harita kenarlarında durur.
    // Ekrandan küçük/eşit haritalarda kamera sabit kalır.
    updateCamera(snap = false) {
        const mapW = this.currentMap.grid[0].length * TILE_SIZE;
        const mapH = this.currentMap.grid.length * TILE_SIZE;
        const targetX = Math.max(0, Math.min(mapW - this.canvas.width, this.player.x - this.canvas.width / 2));
        const targetY = Math.max(0, Math.min(mapH - this.canvas.height, this.player.y - this.canvas.height / 2));

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
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    // (x, y) noktasındaki karo yürünebilir mi?
    isWalkable(x, y) {
        const col = Math.floor(x / TILE_SIZE);
        const row = Math.floor(y / TILE_SIZE);
        const rowStr = this.currentMap.grid[row];
        if (!rowStr) return false;
        const tile = rowStr[col];
        if (tile === undefined) return false;
        return !SOLID_TILES.has(tile);
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
        const dist = new Int16Array(W * H).fill(-1);

        const pc = Math.floor(this.player.x / TILE_SIZE);
        const pr = Math.floor(this.player.y / TILE_SIZE);
        if (pr < 0 || pr >= H || pc < 0 || pc >= W || SOLID_TILES.has(grid[pr][pc])) {
            this.flow = { dist, W, H };
            return;
        }

        dist[pr * W + pc] = 0;
        const queue = [[pc, pr]];
        while (queue.length) {
            const [c, r] = queue.shift();
            const d = dist[r * W + c];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
                if (dist[nr * W + nc] !== -1 || SOLID_TILES.has(grid[nr][nc])) continue;
                dist[nr * W + nc] = d + 1;
                queue.push([nc, nr]);
            }
        }
        this.flow = { dist, W, H };
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
            const dx = this.player.x - x;
            const dy = this.player.y - y;
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

        // Yetenekler son hareket yönüne atılır
        player.aim = { x: dx, y: dy };

        // Eksenleri ayrı dene: duvara sürtünerek kaymaya izin verir
        const nx = player.x + dx * player.speed;
        if (this.canMoveTo(nx, player.y)) player.x = nx;

        const ny = player.y + dy * player.speed;
        if (this.canMoveTo(player.x, ny)) player.y = ny;
    }

    update() {
        // Zafer sahnesinde dünya donar, sadece kutlama oynar
        if (!this.victory) {
            this.movePlayer();
            this.checkPortals();
            this.checkSecretDiscovery();
            this.updateCombat();
            this.updateCamera();
        }

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
        this.drawProjectiles();
        this.drawPlayer();
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

        // Ekran sabiti arayüz (HP, yetenekler, yakalananlar)
        this.drawHud();
        this.drawVictory();
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

    // Boss yakalandı: konfeti yağmuru, zıplayan karakter ve zafer yazısı
    drawVictory() {
        if (!this.victory) return;
        const { ctx, canvas, player } = this;
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
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(cx, cy - jump);
        ctx.rotate(tilt);
        ctx.drawImage(player.img, -60, -60, 120, 120);
        ctx.restore();

        // Zıplarken çevreye saçılan ışık pikselleri
        for (let i = 0; i < 8; i++) {
            const a = (v.frame / 20) + (i / 8) * Math.PI * 2;
            const r = 80 + Math.sin(v.frame / 12 + i) * 12;
            ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#4ade80';
            ctx.fillRect(cx + Math.cos(a) * r - 3, cy - jump + Math.sin(a) * r * 0.6 - 3, 6, 6);
        }

        // Yazılar
        ctx.textAlign = 'center';
        ctx.font = "bold 46px 'Space Grotesk', sans-serif";
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText('ZAFER!', cx, cy - 130);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('ZAFER!', cx, cy - 130);

        ctx.font = "bold 20px 'Space Grotesk', sans-serif";
        ctx.lineWidth = 4;
        const sub = `Boss ${v.name} yakalandı!`;
        ctx.strokeText(sub, cx, cy - 96);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(sub, cx, cy - 96);

        ctx.font = "15px 'Space Grotesk', sans-serif";
        ctx.strokeText('Fısıltılı Orman Girişi tamamlandı — ESC ile menüye dön', cx, cy + 110);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Fısıltılı Orman Girişi tamamlandı — ESC ile menüye dön', cx, cy + 110);

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
            ctx.fillRect(fly.x - 2, fly.y - 2, 4, 4);
        }
        ctx.restore();
    }

    // ---- Harita savaşı ----

    updateCombat() {
        const { player } = this;

        for (let i = 0; i < player.cooldowns.length; i++) {
            if (player.cooldowns[i] > 0) player.cooldowns[i]--;
        }
        if (player.invuln > 0) player.invuln--;

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

            if (Math.hypot(p.x - player.x, p.y - player.y) < 26) {
                this.damagePlayer(p.damage, p);
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
                    enemy.takeDamage(p.damage);
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
                this.captures.push({ id: caught.id, name: caught.name });
                this.spawnMapText(caught.x, caught.y - 30, `${caught.name} yakalandı!`, '#4ade80');
                this.enemies = this.enemies.filter(e => e !== caught);
                this.ballAnim = null;

                // Bossu yakalamak mekanı tamamlar: zafer sahnesi
                if (caught.kind === 'boss') this.onBossCaptured(caught);
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
        const { player } = this;
        const ability = STARTER_ABILITIES[index];
        if (!ability || player.cooldowns[index] > 0) return;

        if (ability.type === 'sleep') {
            // Sleep Powder: çevredeki düşmanları uyutur
            let hit = 0;
            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < ability.radius) {
                    enemy.stunTimer = ability.stun;
                    hit++;
                }
            }
            this.spores.push({ x: player.x, y: player.y, r: 20, life: 30 });
            if (hit > 0) this.spawnMapText(player.x, player.y - 50, `${hit} Pokemon uyudu!`, '#a78bfa');
        } else {
            // Nişan: en yakın ayakta düşmanın ATIŞ ANINDAKİ konumuna kilitlenir.
            // Duvar delen hamleler (Seed Bomb) hedefi duvar arkasında da seçer.
            let ax, ay;
            const target = this.findAimTarget(ability.pierce);
            if (target) {
                ax = target.x - player.x;
                ay = target.y - player.y;
            } else {
                ax = player.aim.x;
                ay = player.aim.y;
                if (ax === 0 && ay === 0) ax = player.facing;
            }
            const len = Math.hypot(ax, ay) || 1;
            this.projectiles.push({
                x: player.x,
                y: player.y,
                vx: (ax / len) * ability.speed,
                vy: (ay / len) * ability.speed,
                type: ability.type,
                damage: ability.damage,
                life: ability.life,
                pierce: !!ability.pierce
            });
        }

        // Uyuyan bossun yakınında ateş etmek onu uyandırır
        for (const enemy of this.enemies) {
            if (enemy.asleep && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 320) {
                enemy.wakeUp();
            }
        }

        player.cooldowns[index] = ability.cooldown;
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

        // En yakın bayılmış Pokemonu bul
        let target = null;
        let best = 110; // maksimum atış mesafesi
        for (const enemy of this.enemies) {
            if (!enemy.fainted) continue;
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

        this.ballAnim = {
            enemy: target,
            frame: 0,
            fromX: this.player.x,
            fromY: this.player.y - 20,
            x: this.player.x,
            y: this.player.y - 20
        };
    }

    damagePlayer(amount, from) {
        const { player } = this;
        if (player.invuln > 0) return;

        player.hp -= amount;
        player.invuln = 60;
        this.spawnMapText(player.x, player.y - 50, `-${amount}`, '#ff4444');

        // Saldırandan hafif geri itme
        if (from) {
            const dist = Math.hypot(player.x - from.x, player.y - from.y) || 1;
            const kx = player.x + ((player.x - from.x) / dist) * 30;
            const ky = player.y + ((player.y - from.y) / dist) * 30;
            if (this.canMoveTo(kx, player.y)) player.x = kx;
            if (this.canMoveTo(player.x, ky)) player.y = ky;
        }

        if (player.hp <= 0) {
            // Bayıldın: mekan girişinde tam canla yeniden doğ
            player.hp = player.maxHp;
            player.invuln = 90;
            const start = this.currentMap.start;
            player.x = start.col * TILE_SIZE + TILE_SIZE / 2;
            player.y = start.row * TILE_SIZE + TILE_SIZE / 2;
            this.updateCamera(true);
            this.spawnMapText(player.x, player.y - 60, 'BAYILDIN!', '#ef4444');
        }
    }

    spawnMapText(x, y, text, color) {
        this.mapTexts.push({ x, y, text, color, life: 70 });
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

                // Yıkılan engellerden enkaz fışkırır
                if (tile === 'T' || tile === 'h' || tile === 'H' || tile === 'R') {
                    const px = col * TILE_SIZE + TILE_SIZE / 2;
                    const py = row * TILE_SIZE + TILE_SIZE / 2;
                    for (let i = 0; i < 5; i++) {
                        this.debris.push({
                            x: px, y: py,
                            vx: (Math.random() - 0.5) * 9,
                            vy: -Math.random() * 8 - 2,
                            size: 6 + Math.random() * 6,
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
    }

    onBossCaptured(boss) {
        this.victory = { frame: 0, name: boss.name, confetti: [] };
        for (let i = 0; i < 90; i++) {
            this.victory.confetti.push({
                x: Math.random() * this.canvas.width,
                y: -Math.random() * this.canvas.height,
                vy: 1.5 + Math.random() * 3,
                vx: (Math.random() - 0.5) * 1.5,
                size: 5 + Math.random() * 6,
                color: ['#fbbf24', '#4ade80', '#60a5fa', '#f472b6', '#f8fafc'][Math.floor(Math.random() * 5)]
            });
        }
    }

    // ---- Çizim ----

    drawTiles() {
        const { ctx, canvas, camera } = this;
        const grid = this.currentMap.grid;

        // Yalnızca görünür karo aralığını çiz
        const colStart = Math.max(0, Math.floor(camera.x / TILE_SIZE));
        const colEnd = Math.min(grid[0].length - 1, Math.ceil((camera.x + canvas.width) / TILE_SIZE));
        const rowStart = Math.max(0, Math.floor(camera.y / TILE_SIZE));
        const rowEnd = Math.min(grid.length - 1, Math.ceil((camera.y + canvas.height) / TILE_SIZE));

        for (let row = rowStart; row <= rowEnd; row++) {
            for (let col = colStart; col <= colEnd; col++) {
                // Keşfedilmemiş gizli oda dışarıdan ağaçlık görünür
                const tile = this.isHiddenTile(col, row) ? 'T' : grid[row][col];
                this.drawTile(ctx, tile, col, row);
            }
        }
    }

    // Karo içi 10px bloklarla, karoya özgü deterministik desen çizer
    drawTile(ctx, tile, col, row) {
        const PX = 10;
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

        for (let by = 0; by < TILE_SIZE / PX; by++) {
            for (let bx = 0; bx < TILE_SIZE / PX; bx++) {
                const idx = (col * 7 + row * 13 + bx * 3 + by * 5) % base.length;
                ctx.fillStyle = base[idx];
                ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
            }
        }

        if (tile === 'W') {
            // Su parıltısı (hareketli)
            const t = Math.floor(Date.now() / 400);
            ctx.fillStyle = '#38bdf8';
            const sx = ((col * 3 + row * 5 + t) % 4) * PX;
            const sy = ((col * 5 + row * 3 + t) % 4) * PX;
            ctx.fillRect(x0 + sx, y0 + sy, PX, PX / 2);
        }

        if (tile === 'R') {
            // Kaya vurgusu
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(x0 + PX, y0 + PX, PX, PX);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x0 + TILE_SIZE - PX * 2, y0 + TILE_SIZE - PX * 2, PX, PX);
        }

        if (tile === 'T') {
            // Ağaç: gövde + yaprak yığını
            ctx.fillStyle = dark ? '#2e1503' : '#451a03';
            ctx.fillRect(x0 + PX * 2, y0 + PX * 3, PX, PX * 2);
            const leafColors = dark
                ? ['#02180b', '#052e16', '#0a3a1c', '#0d4a24']
                : ['#052e16', '#14532d', '#166534', '#16a34a'];
            for (let by = 0; by < 3; by++) {
                for (let bx = 0; bx < 5; bx++) {
                    const d = Math.abs(bx - 2) + by;
                    if (d > 3) continue;
                    const idx = (col * 11 + row * 17 + bx + by * 7) % leafColors.length;
                    ctx.fillStyle = leafColors[idx];
                    ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
                }
            }
        }

        if (tile === 'f') {
            // Çiçekler: karoya özgü sabit konumlarda renkli taç + sarı merkez
            const flowerColors = ['#f472b6', '#fbbf24', '#f87171', '#e0f2fe'];
            for (let i = 0; i < 3; i++) {
                const fx = ((col * 13 + row * 7 + i * 11) % 4) * PX + PX / 2;
                const fy = ((col * 5 + row * 11 + i * 17) % 4) * PX + PX / 2;
                ctx.fillStyle = flowerColors[(col + row + i) % flowerColors.length];
                ctx.fillRect(x0 + fx - 3, y0 + fy - 3, 6, 6);
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(x0 + fx - 1, y0 + fy - 1, 3, 3);
            }
        }

        if (tile === 'g') {
            // Uzun çim: hafifçe salınan koyu yeşil demetler
            const sway = Math.floor(Date.now() / 500) % 2 === 0 ? 0 : 2;
            const bladeColors = ['#166534', '#16a34a', '#22c55e'];
            for (let i = 0; i < 5; i++) {
                const gx = ((col * 7 + row * 3 + i * 9) % 4) * PX + PX / 2;
                const gy = ((col * 3 + row * 5 + i * 13) % 3) * PX + PX * 1.5;
                ctx.fillStyle = bladeColors[i % bladeColors.length];
                ctx.fillRect(x0 + gx + sway, y0 + gy - PX, 4, PX * 1.6);
                ctx.fillRect(x0 + gx - 4, y0 + gy - PX / 2, 4, PX * 1.1);
            }
        }

        if (tile === 'b') {
            // Boss arenası: parçalanmış zemin, kırık dallar ve kavlamış toprak
            const scarColors = ['#3f2a12', '#4a3218', '#2e1d0c'];
            for (let i = 0; i < 4; i++) {
                const sx = ((col * 5 + row * 11 + i * 13) % 4) * PX;
                const sy = ((col * 7 + row * 3 + i * 17) % 4) * PX;
                ctx.fillStyle = scarColors[(col + row + i) % scarColors.length];
                ctx.fillRect(x0 + sx, y0 + sy, PX, PX);
            }
            // Yerdeki kırık dal parçaları
            if ((col * 3 + row * 5) % 4 === 0) {
                ctx.fillStyle = '#1f1408';
                ctx.fillRect(x0 + PX, y0 + PX * 3, PX * 3, 4);
            }
        }

        // Gizli çalı normal çalıyla birebir aynı çizilir (içinden geçilebilir)
        if (tile === 'h' || tile === 'H') {
            // Çalı: yuvarlak hatlı yoğun yaprak kümesi
            const bushColors = ['#14532d', '#166534', '#16a34a'];
            for (let by = 0; by < 5; by++) {
                for (let bx = 0; bx < 5; bx++) {
                    const d = Math.abs(bx - 2) + Math.abs(by - 2);
                    if (d > 3) continue;
                    const idx = (col * 9 + row * 5 + bx * 3 + by) % bushColors.length;
                    ctx.fillStyle = bushColors[idx];
                    ctx.fillRect(x0 + bx * PX, y0 + by * PX, PX, PX);
                }
            }
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(x0 + PX, y0 + PX, PX / 2, PX / 2);
            ctx.fillRect(x0 + PX * 3, y0 + PX * 2, PX / 2, PX / 2);
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

            // Dönen piksel halka
            const n = 12;
            for (let i = 0; i < n; i++) {
                const a = t * 0.2 + (i / n) * Math.PI * 2;
                const r = 20 + Math.sin(t * 0.5 + i) * 2;
                ctx.fillStyle = i % 3 === 0 ? bright : (i % 3 === 1 ? light : main);
                ctx.fillRect(cx + Math.cos(a) * r - 3, cy + Math.sin(a) * r * 0.7 - 3, 6, 6);
            }

            // Merkez girdap
            for (let i = 0; i < 4; i++) {
                const a = -t * 0.4 + (i / 4) * Math.PI * 2;
                const r = 7;
                ctx.fillStyle = light;
                ctx.fillRect(cx + Math.cos(a) * r - 2, cy + Math.sin(a) * r * 0.7 - 2, 5, 5);
            }
            ctx.fillStyle = bright;
            ctx.fillRect(cx - 2, cy - 2, 4, 4);

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

            // Ahşap tezgah
            ctx.fillStyle = '#78350f';
            ctx.fillRect(x0 + 2, y0 + 18, TILE_SIZE - 4, 28);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x0 + 2, y0 + 18, TILE_SIZE - 4, 6);
            ctx.fillStyle = '#451a03';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(x0 + 6 + i * 11, y0 + 28, 3, 16);
            }

            // Tente direkleri
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x0 + 1, y0 - 34, 4, 52);
            ctx.fillRect(x0 + TILE_SIZE - 5, y0 - 34, 4, 52);

            // Kırmızı-beyaz şeritli tente
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
                ctx.fillRect(x0 - 2 + i * 11, y0 - 44, 11, 10);
            }
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#e2e8f0';
                ctx.fillRect(x0 - 2 + i * 11, y0 - 34, 11, 4);
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

    drawPlayer() {
        const { ctx, player } = this;

        // Hasar sonrası dokunulmazlıkta yanıp sönme
        if (player.invuln > 0 && player.invuln % 8 < 4) return;

        // Yürürken hafif zıplama
        const bob = player.moving ? Math.sin(Date.now() / 90) * 3 : 0;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(player.x, player.y - player.size / 4 + bob);
        if (player.facing === 1) ctx.scale(-1, 1);
        ctx.drawImage(player.img, -player.size / 2, -player.size / 2, player.size, player.size);
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

    // Sleep Powder: genişleyen mor spor halkası
    drawSpores() {
        const { ctx } = this;
        for (const s of this.spores) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, s.life / 30) * 0.8;
            const n = 16;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + s.r * 0.02;
                ctx.fillStyle = i % 2 === 0 ? '#a78bfa' : '#c4b5fd';
                ctx.fillRect(s.x + Math.cos(a) * s.r - 3, s.y + Math.sin(a) * s.r - 3, 6, 6);
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
        // Pokeball pikselleri: üst kırmızı, alt beyaz, bant ve merkez düğme
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-8, -8, 16, 8);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-8, 0, 16, 8);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-8, -2, 16, 4);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-3, -3, 6, 6);
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

        // Can barı (sol üst)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(12, 12, 216, 30);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(18, 24, 160, 12);
        ctx.fillStyle = player.hp > 30 ? '#22c55e' : '#ef4444';
        ctx.fillRect(18, 24, 160 * (player.hp / player.maxHp), 12);
        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(player.name || 'Oyuncu', 18, 21);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, 222, 34);

        // Yakalananlar (sağ üst)
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(canvas.width - 150, 12, 138, 26);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`Yakalanan: ${this.captures.length}`, canvas.width - 20, 30);

        // Yetenek kutuları (sol alt)
        const boxY = canvas.height - 58;
        STARTER_ABILITIES.forEach((ability, i) => {
            const boxX = 12 + i * 52;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(boxX, boxY, 44, 44);

            // Cooldown dolgusu (yukarıdan aşağı iner)
            const cd = player.cooldowns[i];
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
