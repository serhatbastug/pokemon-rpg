import { TILE_SIZE } from '../../config/worldMap.js';
import { SOLID_TILES } from '../../config/worldMap.js';
import { hasSurf } from '../../config/fieldMoves.js';

// Hareket ve harita gezinme: yürünebilirlik, çarpışma, kamera, portallar,
// gizli alan keşfi ve düşmanların yol bulması için akış alanı (BFS).
// Overworld prototipine karıştırılır (applyMixins) - bu yüzden 'this' Overworld örneğidir.
export const Navigation = {
    // Ölçek uygulandıktan sonra ekranda görünen dünya alanı
    get viewSize() {
        return { w: this.canvas.width / this.zoom, h: this.canvas.height / this.zoom };
    },

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
    },

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
    },

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
    },

    // Çarpışma kutusunun dört köşesi de yürünebilirse hareket geçerli
    // (hem oyuncu hem düşmanlar kullanır)
    canBoxMoveTo(x, y, hw, hh) {
        return this.isWalkable(x - hw, y - hh)
            && this.isWalkable(x + hw, y - hh)
            && this.isWalkable(x - hw, y + hh)
            && this.isWalkable(x + hw, y + hh);
    },

    canMoveTo(x, y) {
        const { w, h } = this.player.hitbox;
        return this.canBoxMoveTo(x, y, w / 2, h / 2);
    },

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
    },

    // (col,row) karosunun oyuncuya labirent yolu mesafesi (karo cinsinden)
    tileDistAt(col, row) {
        if (!this.flow) return Infinity;
        const { dist, W, H } = this.flow;
        if (col < 0 || col >= W || row < 0 || row >= H) return Infinity;
        const d = dist[row * W + col];
        return d === -1 ? Infinity : d;
    },

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
    },

    // İki nokta arasında duvar var mı? (düşman atışları için görüş hattı)
    hasLineOfSight(x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.ceil(dist / 20));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (!this.isWalkable(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
        }
        return true;
    },

    isTileInsideArea(col, row, area) {
        return col >= area.col0 && col <= area.col1 && row >= area.row0 && row <= area.row1;
    },

    isInsideArea(x, y, area) {
        return this.isTileInsideArea(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE), area);
    },

    // Gizli oda: içine girilene kadar haritada ağaçlık gibi görünür,
    // içindeki Pokemon da çizilmez.
    get secretArea() {
        return this.currentMap.secretArea;
    },

    isHiddenTile(col, row) {
        const area = this.secretArea;
        return !!area && !this.secretRevealed && this.isTileInsideArea(col, row, area);
    },

    checkSecretDiscovery() {
        const area = this.secretArea;
        if (!area || this.secretRevealed) return;
        if (this.isInsideArea(this.player.x, this.player.y, area)) {
            this.secretRevealed = true;
            this.bakeTerrain(); // oda artık gerçek görünümüyle çizilir
            this.spawnMapText(this.player.x, this.player.y - 60, 'GİZLİ ODA BULUNDU!', '#fbbf24');
        }
    },

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
};
