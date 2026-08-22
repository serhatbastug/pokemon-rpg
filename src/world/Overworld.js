import { MAIN_MAP, TILE_SIZE, SOLID_TILES, PLAYER_START, extractPortals } from '../config/worldMap.js';
import { REGIONS } from '../config/regions.js';
import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';

// Kuşbakışı ana harita motoru: karo tabanlı pixel art harita, gezinen oyuncu
// ve bölge portalları. Portallar şimdilik görseldir; temas bir şey tetiklemez.
// (Plan: portaldan mekan haritalarına geçiş, savaşların harita üzerinde başlaması.)
export class Overworld {
    constructor({ canvas, input, onExit }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.onExit = onExit;

        this.map = MAIN_MAP;
        this.portals = extractPortals(this.map);
        this.interval = null;
        this.running = false;

        // Oyuncu durumu
        this.player = {
            x: 0,
            y: 0,
            speed: 3.5,
            size: 56,        // çizim boyutu
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
        this.player.x = PLAYER_START.col * TILE_SIZE + TILE_SIZE / 2;
        this.player.y = PLAYER_START.row * TILE_SIZE + TILE_SIZE / 2;
        this.player.facing = 1;

        this.ctx.imageSmoothingEnabled = false;
        this.running = true;

        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.update(), 1000 / FRAME_RATE);
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
        const rowStr = this.map.grid[row];
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

        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        this.drawTiles();
        this.drawPortals();
        this.drawPlayer();
        this.drawPortalLabels();
    }

    // ---- Çizim ----

    drawTiles() {
        const { ctx } = this;
        const grid = this.map.grid;

        for (let row = 0; row < grid.length; row++) {
            for (let col = 0; col < grid[row].length; col++) {
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
            'R': ['#334155', '#475569', '#64748b', '#475569'],
            'W': ['#0c4a6e', '#075985', '#0369a1', '#075985']
        };

        // Portal karoları ve ağaç altı çim zemin kullanır
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
    }

    drawPortals() {
        const { ctx } = this;
        const t = Date.now() / 100;

        for (const portal of this.portals) {
            const region = REGIONS[portal.region];
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE + TILE_SIZE / 2;
            const [main, light, bright] = region.colors;

            ctx.save();
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
            const region = REGIONS[portal.region];
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE - 8;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(region.name, cx, cy);
            ctx.fillStyle = region.colors[1];
            ctx.fillText(region.name, cx, cy);
        }

        ctx.restore();
    }

    drawPlayer() {
        const { ctx, player } = this;

        // Yürürken hafif zıplama
        const bob = player.moving ? Math.sin(Date.now() / 90) * 3 : 0;

        // Gölge
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#000000';
        ctx.fillRect(player.x - 14, player.y + player.size / 2 - 8, 28, 6);
        ctx.restore();

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(player.x, player.y - player.size / 4 + bob);
        if (player.facing === 1) ctx.scale(-1, 1);
        ctx.drawImage(player.img, -player.size / 2, -player.size / 2, player.size, player.size);
        ctx.restore();
    }
}
