import { MAPS, TILE_SIZE, SOLID_TILES, extractPortals } from '../config/worldMap.js';
import { MERCHANT } from '../config/characters.js';
import { fetchCharacter } from '../services/pokeapi.js';
import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';

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
            img: new Image()
        };

        input.onKeyDown(e => {
            if (!this.running) return;
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();
        });
    }

    start(character) {
        this.player.img.src = character.battleSprite || character.sprite;
        this.player.facing = 1;
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
    canMoveTo(x, y) {
        const { w, h } = this.player.hitbox;
        return this.isWalkable(x - w / 2, y - h / 2)
            && this.isWalkable(x + w / 2, y - h / 2)
            && this.isWalkable(x - w / 2, y + h / 2)
            && this.isWalkable(x + w / 2, y + h / 2);
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

        // Eksenleri ayrı dene: duvara sürtünerek kaymaya izin verir
        const nx = player.x + dx * player.speed;
        if (this.canMoveTo(nx, player.y)) player.x = nx;

        const ny = player.y + dy * player.speed;
        if (this.canMoveTo(player.x, ny)) player.y = ny;
    }

    update() {
        this.movePlayer();
        this.checkPortals();
        this.updateCamera();

        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        // Dünya, kamera kadar kaydırılarak çizilir
        ctx.save();
        ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        this.drawTiles();
        this.drawPortals();
        this.drawShops();
        this.drawPlayer();
        this.drawPortalLabels();
        this.drawShopLabels();

        ctx.restore();
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
                this.drawTile(ctx, grid[row][col], col, row);
            }
        }
    }

    // Karo içi 10px bloklarla, karoya özgü deterministik desen çizer
    drawTile(ctx, tile, col, row) {
        const PX = 10;
        const x0 = col * TILE_SIZE;
        const y0 = row * TILE_SIZE;

        const palettes = {
            '.': ['#14532d', '#15803d', '#166534', '#15803d'],
            'p': ['#713f12', '#854d0e', '#92400e', '#854d0e'],
            's': ['#a16207', '#ca8a04', '#a16207', '#92400e'],
            'R': ['#334155', '#475569', '#64748b', '#475569'],
            'W': ['#0c4a6e', '#075985', '#0369a1', '#075985']
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
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x0 + PX * 2, y0 + PX * 3, PX, PX * 2);
            const leafColors = ['#052e16', '#14532d', '#166534', '#16a34a'];
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

        if (tile === 'h') {
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

        // Yürürken hafif zıplama
        const bob = player.moving ? Math.sin(Date.now() / 90) * 3 : 0;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(player.x, player.y - player.size / 4 + bob);
        if (player.facing === 1) ctx.scale(-1, 1);
        ctx.drawImage(player.img, -player.size / 2, -player.size / 2, player.size, player.size);
        ctx.restore();
    }
}
