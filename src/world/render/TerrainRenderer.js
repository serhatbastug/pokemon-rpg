import { TILE_SIZE } from '../../config/worldMap.js';

// Macera modu zemini: piksel blok YOK. Karolar degrade dolgular, yumuşak
// eğriler ve gölgelerle çizilir; harita bir kez offscreen canvas'a pişirilip
// her karede tek drawImage ile ekrana kopyalanır (performans korunur).
// (Arena modu kendi piksel arka planlarını kullanmaya devam eder.)
export const TerrainRenderer = {
    // Karolara göre zemin renkleri: [taban, açık ton, koyu ton, vurgu]
    tilePalette(tile, dark) {
        const light = {
            '.': ['#2f7d3a', '#43a04c', '#215c2b', '#63c46a'],   // çim
            'p': ['#a97b4f', '#c39a68', '#8a6238', '#d8b487'],   // patika
            's': ['#c9a15c', '#e0bd7c', '#a67f44', '#f0d9a6'],   // kum
            'R': ['#6b7280', '#98a1ad', '#4b525c', '#c3cad4'],   // kaya
            'W': ['#1d4f7c', '#2f7fb8', '#12385c', '#7cc4ef'],   // su
            'b': ['#6b4a2a', '#8a6238', '#4a3220', '#a5825a']    // boss arenası
        };
        const shade = {
            '.': ['#1c4f26', '#2a6b33', '#13381b', '#3f8c47'],
            'p': ['#6f4f31', '#8a6540', '#4e3722', '#a07c53'],
            's': ['#8a6f3c', '#a98a52', '#6b552d', '#c4a870'],
            'R': ['#454b56', '#606874', '#2e333b', '#828b98'],
            'W': ['#123a5e', '#1d5c8a', '#0a2340', '#4e9ac9'],
            'b': ['#4b331d', '#654529', '#332212', '#7a5b39']
        };
        return (dark ? shade : light)[tile] || (dark ? shade['.'] : light['.']);
    },

    // Tek bir karoyu yumuşak geçişlerle çizer
    drawTile(ctx, tile, col, row, phase = 0) {
        const x0 = col * TILE_SIZE;
        const y0 = row * TILE_SIZE;
        const dark = this.currentMap.theme === 'dark';
        const size = TILE_SIZE;

        // Konuma bağlı ama rastgele görünen değer (0-1)
        const noise = (a, b) => {
            const v = Math.sin((col * 12.9898 + row * 78.233 + a * 3.17 + b * 7.31)) * 43758.5453;
            return v - Math.floor(v);
        };

        const [base, lightTone, darkTone, accent] = this.tilePalette(
            tile === 'h' || tile === 'H' || tile === 'T' || tile === 'f' || tile === 'g' || tile === 'A' ? '.' : tile,
            dark
        );

        // Zemin DÜZ tek renk: karo başına degrade kullanılırsa her karonun
        // kenarı belli olur ve harita ızgara gibi görünür. Doku, kenarlara
        // ulaşmadan sönen yumuşak lekelerle veriliyor.
        ctx.fillStyle = base;
        ctx.fillRect(x0, y0, size, size);

        // Yumuşak doku lekeleri: merkezleri karonun ortasına yakın tutulur ve
        // yarıçapları kenara varmadan biter, böylece karo sınırı görünmez.
        ctx.save();
        for (let i = 0; i < 4; i++) {
            const px = x0 + size * (0.3 + noise(i, 1) * 0.4);
            const py = y0 + size * (0.3 + noise(i, 2) * 0.4);
            const r = size * (0.16 + noise(i, 3) * 0.14);
            ctx.globalAlpha = 0.1 + noise(i, 4) * 0.1;
            const blob = ctx.createRadialGradient(px, py, 0, px, py, r);
            blob.addColorStop(0, i % 2 ? accent : (i % 3 ? lightTone : darkTone));
            blob.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = blob;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        if (tile === 'W') this.drawWater(ctx, x0, y0, phase, dark);
        if (tile === 'R') this.drawRock(ctx, x0, y0, noise, dark);
        if (tile === 'T') this.drawTree(ctx, x0, y0, noise, dark);
        if (tile === 'A') this.drawAncientTree(ctx, x0, y0, noise, phase);
        if (tile === 'f') this.drawFlowers(ctx, x0, y0, noise);
        if (tile === 'g') this.drawTallGrass(ctx, x0, y0, noise, phase, dark);
        if (tile === 'h' || tile === 'H') this.drawBush(ctx, x0, y0, noise, dark);
        if (tile === 'b') this.drawScorched(ctx, x0, y0, noise);
    },

    drawWater(ctx, x0, y0, phase, dark) {
        const size = TILE_SIZE;
        ctx.save();
        // Dalga çizgileri: yumuşak sinüs eğrileri
        ctx.strokeStyle = dark ? 'rgba(125,200,240,0.35)' : 'rgba(190,235,255,0.5)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const y = y0 + size * (0.25 + i * 0.25) + (phase ? 3 : 0);
            ctx.beginPath();
            for (let x = 0; x <= size; x += 4) {
                const wy = y + Math.sin((x / size) * Math.PI * 2 + i + phase * 1.5) * 2.4;
                if (x === 0) ctx.moveTo(x0 + x, wy);
                else ctx.lineTo(x0 + x, wy);
            }
            ctx.stroke();
        }
        // Parıltı
        ctx.globalAlpha = 0.35;
        const shine = ctx.createRadialGradient(x0 + size * 0.35, y0 + size * 0.3, 0, x0 + size * 0.35, y0 + size * 0.3, size * 0.4);
        shine.addColorStop(0, '#ffffff');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
        ctx.fillRect(x0, y0, size, size);
        ctx.restore();
    },

    drawRock(ctx, x0, y0, noise, dark) {
        const size = TILE_SIZE;
        const cx = x0 + size / 2;
        const cy = y0 + size * 0.55;

        ctx.save();
        // Gölge
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(cx, y0 + size * 0.82, size * 0.36, size * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Kaya gövdesi: yumuşak çokgen + degrade
        const body = ctx.createLinearGradient(cx - size * 0.3, cy - size * 0.3, cx + size * 0.3, cy + size * 0.3);
        body.addColorStop(0, dark ? '#8b95a3' : '#b6bfcb');
        body.addColorStop(1, dark ? '#3b414b' : '#5a626e');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.34, cy + size * 0.22);
        ctx.quadraticCurveTo(cx - size * 0.42, cy - size * 0.1, cx - size * 0.16, cy - size * 0.3);
        ctx.quadraticCurveTo(cx + size * 0.12, cy - size * 0.42, cx + size * 0.3, cy - size * 0.16);
        ctx.quadraticCurveTo(cx + size * 0.44, cy + size * 0.06, cx + size * 0.3, cy + size * 0.24);
        ctx.closePath();
        ctx.fill();

        // Üst yüzde ışık
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(cx - size * 0.06, cy - size * 0.18, size * 0.16, size * 0.08, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    drawTree(ctx, x0, y0, noise, dark) {
        const size = TILE_SIZE;
        // Konuma göre değişen boyut/konum: ağaçlar aynı mantar gibi tekrar etmesin
        const grow = 0.85 + noise(0, 51) * 0.3;
        const cx = x0 + size * (0.42 + noise(0, 52) * 0.16);
        const lift = noise(0, 53) * size * 0.06;

        ctx.save();
        ctx.translate(0, -lift);
        // Zemin gölgesi
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, y0 + size * 0.86 + lift, size * 0.34 * grow, size * 0.11, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gövde
        const trunk = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
        trunk.addColorStop(0, dark ? '#3a2412' : '#5c3a1d');
        trunk.addColorStop(0.5, dark ? '#6b4423' : '#8a5a2d');
        trunk.addColorStop(1, dark ? '#2a1a0d' : '#432a14');
        ctx.fillStyle = trunk;
        ctx.beginPath();
        ctx.moveTo(cx - 6, y0 + size * 0.85);
        ctx.quadraticCurveTo(cx - 4, y0 + size * 0.55, cx - 5, y0 + size * 0.42);
        ctx.lineTo(cx + 5, y0 + size * 0.42);
        ctx.quadraticCurveTo(cx + 4, y0 + size * 0.55, cx + 6, y0 + size * 0.85);
        ctx.closePath();
        ctx.fill();

        // Yaprak kütlesi: üst üste binen yumuşak daireler
        const leafDark = dark ? '#12401f' : '#1f6b2c';
        const leafMid = dark ? '#1c5c2b' : '#2f8f3d';
        const leafLight = dark ? '#2a7a3a' : '#4fb659';

        const blobs = [
            [cx, y0 + size * 0.3, size * 0.34 * grow, leafDark],
            [cx - size * 0.18 * grow, y0 + size * 0.36, size * 0.26 * grow, leafMid],
            [cx + size * 0.18 * grow, y0 + size * 0.34, size * 0.25 * grow, leafMid],
            [cx - size * 0.04, y0 + size * (0.18 + noise(0, 54) * 0.06), size * 0.24 * grow, leafLight]
        ];
        for (const [bx, by, r, color] of blobs) {
            const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.35, r * 0.1, bx, by, r);
            g.addColorStop(0, color);
            g.addColorStop(1, leafDark);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    drawAncientTree(ctx, x0, y0, noise, phase) {
        const size = TILE_SIZE;
        ctx.save();

        // Devasa gövde dokusu: dikey degrade + damarlar
        const bark = ctx.createLinearGradient(x0, y0, x0 + size, y0);
        bark.addColorStop(0, '#2e1b0a');
        bark.addColorStop(0.4, '#4a2c12');
        bark.addColorStop(0.7, '#5c3a1a');
        bark.addColorStop(1, '#241305');
        ctx.fillStyle = bark;
        ctx.fillRect(x0, y0, size, size);

        ctx.strokeStyle = 'rgba(20,10,4,0.55)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const x = x0 + size * (0.2 + i * 0.3 + noise(i, 5) * 0.08);
            ctx.beginPath();
            ctx.moveTo(x, y0);
            ctx.quadraticCurveTo(x + 6, y0 + size / 2, x, y0 + size);
            ctx.stroke();
        }

        // Yosun
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#2f7d3a';
        for (let i = 0; i < 2; i++) {
            const mx = x0 + noise(i, 6) * size;
            const my = y0 + noise(i, 7) * size;
            const g = ctx.createRadialGradient(mx, my, 0, mx, my, size * 0.22);
            g.addColorStop(0, '#3f9e4a');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(mx, my, size * 0.22, 0, Math.PI * 2);
            ctx.fill();
        }

        // Parlayan kadim runeler
        ctx.globalAlpha = phase === 0 ? 0.55 : 0.95;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#4ade80';
        ctx.strokeStyle = '#7dffa0';
        ctx.lineWidth = 2.5;
        const rx = x0 + size * (0.3 + noise(0, 8) * 0.4);
        const ry = y0 + size * (0.25 + noise(0, 9) * 0.4);
        ctx.beginPath();
        ctx.arc(rx, ry, size * 0.12, 0.4, 4.2);
        ctx.stroke();
        ctx.restore();
    },

    drawFlowers(ctx, x0, y0, noise) {
        const size = TILE_SIZE;
        const colors = ['#f472b6', '#fbbf24', '#f87171', '#e0f2fe', '#c084fc'];

        ctx.save();
        for (let i = 0; i < 4; i++) {
            const fx = x0 + size * (0.15 + noise(i, 11) * 0.7);
            const fy = y0 + size * (0.2 + noise(i, 12) * 0.65);
            const r = 3.2 + noise(i, 13) * 1.6;
            const color = colors[Math.floor(noise(i, 14) * colors.length) % colors.length];

            // Sap
            ctx.strokeStyle = 'rgba(40,110,50,0.8)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(fx, fy + r * 2.4);
            ctx.quadraticCurveTo(fx + 1.5, fy + r, fx, fy);
            ctx.stroke();

            // Taç yapraklar: beş yumuşak daire
            ctx.fillStyle = color;
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#fde68a';
            ctx.beginPath();
            ctx.arc(fx, fy, r * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    drawTallGrass(ctx, x0, y0, noise, phase, dark) {
        const size = TILE_SIZE;
        const sway = phase === 0 ? 0 : 3.5;

        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
            const gx = x0 + size * (0.08 + noise(i, 21) * 0.85);
            const gy = y0 + size * (0.65 + noise(i, 22) * 0.3);
            const h = size * (0.3 + noise(i, 23) * 0.28);
            const lean = (noise(i, 24) - 0.5) * 8 + sway;

            const g = ctx.createLinearGradient(gx, gy, gx, gy - h);
            g.addColorStop(0, dark ? '#14401f' : '#1f6b2c');
            g.addColorStop(1, dark ? '#2f8f3d' : '#6cd36f');
            ctx.strokeStyle = g;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.quadraticCurveTo(gx + lean * 0.4, gy - h * 0.6, gx + lean, gy - h);
            ctx.stroke();
        }
        ctx.restore();
    },

    drawBush(ctx, x0, y0, noise, dark) {
        const size = TILE_SIZE;
        const cx = x0 + size / 2;
        const cy = y0 + size * 0.55;

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(cx, y0 + size * 0.82, size * 0.34, size * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        const dark1 = dark ? '#12401f' : '#1c5f28';
        const mid = dark ? '#1c5c2b' : '#2f8f3d';
        const lightTone = dark ? '#2a7a3a' : '#57bf60';

        const blobs = [
            [cx, cy, size * 0.33, mid],
            [cx - size * 0.2, cy + size * 0.06, size * 0.24, dark1],
            [cx + size * 0.2, cy + size * 0.04, size * 0.24, dark1],
            [cx - size * 0.05, cy - size * 0.14, size * 0.22, lightTone]
        ];
        for (const [bx, by, r, color] of blobs) {
            const g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.4, r * 0.1, bx, by, r);
            g.addColorStop(0, color);
            g.addColorStop(1, dark1);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Birkaç parlak yaprak ucu
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = lightTone;
        for (let i = 0; i < 3; i++) {
            const lx = cx + (noise(i, 31) - 0.5) * size * 0.5;
            const ly = cy + (noise(i, 32) - 0.5) * size * 0.4;
            ctx.beginPath();
            ctx.ellipse(lx, ly, 4, 2.4, noise(i, 33) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    drawScorched(ctx, x0, y0, noise) {
        const size = TILE_SIZE;
        ctx.save();
        // Çatlaklar
        ctx.strokeStyle = 'rgba(28,16,6,0.7)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const sx = x0 + noise(i, 41) * size;
            const sy = y0 + noise(i, 42) * size;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (noise(i, 43) - 0.5) * size * 0.8, sy + (noise(i, 44) - 0.5) * size * 0.8);
            ctx.stroke();
        }
        // Kavrulmuş lekeler
        ctx.globalAlpha = 0.25;
        const g = ctx.createRadialGradient(x0 + size * 0.5, y0 + size * 0.5, 0, x0 + size * 0.5, y0 + size * 0.5, size * 0.5);
        g.addColorStop(0, '#1c1006');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0, size, size);
        ctx.restore();
    },

    // Zemin, harita yüklenirken iki animasyon karesi halinde offscreen canvas'a
    // bir kez çizilir; her karede tek drawImage yapılır.
    bakeTerrain() {
        const grid = this.currentMap.grid;
        const w = grid[0].length * TILE_SIZE;
        const h = grid.length * TILE_SIZE;

        // Yumuşak çizim maliyetli olduğu için karo desenleri önbelleğe alınır;
        // desen konuma bağlı olduğundan VARIANTS karoda bir tekrar eder.
        const VARIANTS = 9; // desen tekrarı seyrek görünsün
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
                pctx.imageSmoothingEnabled = true;
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
            lctx.imageSmoothingEnabled = true;

            for (let row = 0; row < grid.length; row++) {
                for (let col = 0; col < grid[row].length; col++) {
                    // Keşfedilmemiş gizli oda dışarıdan ağaçlık görünür
                    const tile = this.isHiddenTile(col, row) ? 'T' : grid[row][col];
                    lctx.drawImage(patchFor(tile, col, row, phase), col * TILE_SIZE, row * TILE_SIZE);
                }
            }
            return layer;
        });
    },

    drawTiles() {
        const { ctx, camera } = this;
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
};
