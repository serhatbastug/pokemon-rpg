import { TILE_SIZE } from '../../config/worldMap.js';
import { cel, celCircle, groundShadow } from './celShading.js';

// Macera modu zemini: ANIME (cel-shading) tarzı.
// Degrade yok - düz renk alanları, sert kenarlı gölge bantları ve koyu
// konturlar. Harita bir kez offscreen canvas'a pişirilir, her karede tek
// drawImage ile kopyalanır. (Arena modu piksel tarzını korur.)
export const TerrainRenderer = {
    // Anime paleti: her karo için [taban, gölge, ışık, kontur]
    tilePalette(tile, dark) {
        const day = {
            '.': ['#5cb856', '#3f9c46', '#7fd472', '#2a6b31'],   // çim
            'p': ['#d9b27a', '#b98f5c', '#eccb9a', '#8a6438'],                   // patika
            's': ['#f0d99a', '#d6ba76', '#fcecc0', '#a98d54'],                   // kum
            'R': ['#a8b2bd', '#7d8794', '#c9d2db', '#4f5763'],                   // kaya
            'W': ['#4aa8e0', '#2f7fbe', '#8fd4f5', '#1c5988'],                   // su
            'b': ['#a37a4a', '#7d5a34', '#c39a67', '#553a1f']                    // boss arenası
        };
        const night = {
            '.': ['#357a3c', '#25592c', '#4b9c4c', '#173d1c'],
            'p': ['#9c7c53', '#7a5e3c', '#b89a6e', '#5c4326'],
            's': ['#c0aa76', '#9c8757', '#d6c493', '#75613a'],
            'R': ['#7c8794', '#5a636e', '#9aa5b1', '#363c45'],
            'W': ['#2b7cae', '#1c5a85', '#5aa8d4', '#12405f'],
            'b': ['#7a5a36', '#5a4026', '#96754b', '#3b2814']
        };
        return (dark ? night : day)[tile] || (dark ? night['.'] : day['.']);
    },

    drawTile(ctx, tile, col, row, phase = 0) {
        const x0 = col * TILE_SIZE;
        const y0 = row * TILE_SIZE;
        const size = TILE_SIZE;
        const dark = this.currentMap.theme === 'dark';

        // Konuma bağlı ama rastgele görünen değer (0-1)
        const noise = (a, b) => {
            const v = Math.sin(col * 12.9898 + row * 78.233 + a * 3.17 + b * 7.31) * 43758.5453;
            return v - Math.floor(v);
        };

        // Nesne karolarının (ağaç, çalı, çiçek) zemini çimdir
        const groundTile = ['h', 'H', 'T', 'f', 'g', 'A'].includes(tile) ? '.' : tile;
        const [base, shadow, light] = this.tilePalette(groundTile, dark);

        // Düz taban rengi (degrade YOK)
        ctx.fillStyle = base;
        ctx.fillRect(x0, y0, size, size);

        // Zemin dokusu: anime tarzı küçük, düz lekeler ve çim çentikleri
        this.drawGroundDetail(ctx, x0, y0, groundTile, noise, shadow, light);

        if (tile === 'W') this.drawWater(ctx, x0, y0, phase, dark, noise);
        if (tile === 'R') this.drawRock(ctx, x0, y0, noise, dark);
        if (tile === 'T') this.drawTree(ctx, x0, y0, noise, dark);
        if (tile === 'A') this.drawAncientTree(ctx, x0, y0, noise, phase);
        if (tile === 'f') this.drawFlowers(ctx, x0, y0, noise);
        if (tile === 'g') this.drawTallGrass(ctx, x0, y0, noise, phase, dark);
        if (tile === 'h' || tile === 'H') this.drawBush(ctx, x0, y0, noise, dark);
        if (tile === 'b') this.drawScorched(ctx, x0, y0, noise);
    },

    // Zemin dokusu: düz lekeler + çim çentikleri (yumuşak leke değil)
    drawGroundDetail(ctx, x0, y0, tile, noise, shadow, light) {
        const size = TILE_SIZE;
        ctx.save();

        if (tile === '.') {
            // Anime çimlerde iki tonlu düz yamalar
            ctx.fillStyle = light;
            ctx.globalAlpha = 0.35;
            for (let i = 0; i < 2; i++) {
                const px = x0 + size * (0.25 + noise(i, 1) * 0.4);
                const py = y0 + size * (0.25 + noise(i, 2) * 0.4);
                ctx.beginPath();
                ctx.ellipse(px, py, size * 0.2, size * 0.11, noise(i, 3) * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            }

            // Küçük "v" çim çentikleri
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = shadow;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
                const gx = x0 + size * (0.2 + noise(i, 4) * 0.6);
                const gy = y0 + size * (0.35 + noise(i, 5) * 0.5);
                ctx.beginPath();
                ctx.moveTo(gx - 3, gy);
                ctx.lineTo(gx, gy - 4);
                ctx.lineTo(gx + 3, gy);
                ctx.stroke();
            }
        } else if (tile === 'p' || tile === 's' || tile === 'b') {
            // Patika/kum: düz çakıl lekeleri
            ctx.globalAlpha = 0.4;
            for (let i = 0; i < 3; i++) {
                ctx.fillStyle = i % 2 ? shadow : light;
                const px = x0 + size * (0.2 + noise(i, 6) * 0.6);
                const py = y0 + size * (0.2 + noise(i, 7) * 0.6);
                ctx.beginPath();
                ctx.ellipse(px, py, 3 + noise(i, 8) * 3, 2 + noise(i, 9) * 2, noise(i, 10) * 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    },

    drawWater(ctx, x0, y0, phase, dark, noise) {
        const size = TILE_SIZE;
        const [, shadow, light, outline] = this.tilePalette('W', dark);

        ctx.save();
        // Anime su: düz, yuvarlak uçlu dalga çizgileri (degrade yok)
        const offset = phase ? size * 0.12 : 0;
        ctx.strokeStyle = light;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const y = y0 + size * (0.22 + i * 0.27) + offset;
            const w = size * (0.22 + noise(i, 11) * 0.2);
            const x = x0 + size * (0.15 + noise(i, 12) * 0.45);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.stroke();
        }

        // Derinlik bandı: sert kenarlı düz gölge
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.ellipse(x0 + size * 0.72, y0 + size * 0.78, size * 0.32, size * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Beyaz köpük vurgusu
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 + size * 0.2, y0 + size * (phase ? 0.44 : 0.36));
        ctx.lineTo(x0 + size * 0.38, y0 + size * (phase ? 0.44 : 0.36));
        ctx.stroke();
        ctx.restore();
    },

    drawRock(ctx, x0, y0, noise, dark) {
        const size = TILE_SIZE;
        const [base, shadow, light, outline] = this.tilePalette('R', dark);
        const cx = x0 + size * (0.46 + noise(0, 21) * 0.08);
        const cy = y0 + size * 0.56;
        const w = size * (0.34 + noise(0, 22) * 0.06);

        groundShadow(ctx, cx, y0 + size * 0.82, w * 1.05, size * 0.1);

        // Köşeli anime kaya silueti
        const path = () => {
            ctx.beginPath();
            ctx.moveTo(cx - w, cy + size * 0.2);
            ctx.lineTo(cx - w * 0.75, cy - size * 0.12);
            ctx.lineTo(cx - w * 0.2, cy - size * 0.3);
            ctx.lineTo(cx + w * 0.55, cy - size * 0.18);
            ctx.lineTo(cx + w, cy + size * 0.14);
            ctx.lineTo(cx + w * 0.5, cy + size * 0.24);
            ctx.closePath();
        };
        cel(ctx, path, {
            base, shadow, light,
            outline, lineWidth: 2.2,
            bounds: { x: cx - w, y: cy - size * 0.3, w: w * 2, h: size * 0.55 }
        });

        // Anime çizgi detayı: kayadaki çatlak
        ctx.save();
        ctx.strokeStyle = outline;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.15, cy - size * 0.18);
        ctx.lineTo(cx + w * 0.05, cy + size * 0.05);
        ctx.stroke();
        ctx.restore();
    },

    drawTree(ctx, x0, y0, noise, dark) {
        const size = TILE_SIZE;
        // Konuma göre boyut/konum çeşitliliği: ağaçlar aynı görünmesin
        const grow = 0.88 + noise(0, 31) * 0.26;
        const cx = x0 + size * (0.44 + noise(0, 32) * 0.12);
        const baseY = y0 + size * 0.86;

        const leaf = dark
            ? { base: '#2f7a3a', shadow: '#1c4f27', light: '#4aa04f', outline: '#12321a' }
            : { base: '#54b455', shadow: '#358a41', light: '#86d977', outline: '#1e5427' };
        const wood = dark
            ? { base: '#6b4a2b', shadow: '#4a331d', light: '#8a6440', outline: '#2d1d0f' }
            : { base: '#a8794a', shadow: '#7d5732', light: '#c69a6a', outline: '#4a3018' };

        groundShadow(ctx, cx, baseY, size * 0.32 * grow, size * 0.1);

        // Gövde: düz renk + sert gölge bandı + kontur
        const trunkW = size * 0.13;
        const trunkTop = y0 + size * 0.44;
        cel(ctx, () => {
            ctx.beginPath();
            ctx.moveTo(cx - trunkW, baseY);
            ctx.lineTo(cx - trunkW * 0.75, trunkTop);
            ctx.lineTo(cx + trunkW * 0.75, trunkTop);
            ctx.lineTo(cx + trunkW, baseY);
            ctx.closePath();
        }, {
            base: wood.base, shadow: wood.shadow, light: null,
            outline: wood.outline, lineWidth: 2,
            bounds: { x: cx - trunkW, y: trunkTop, w: trunkW * 2, h: baseY - trunkTop }
        });

        // Taç: birbirine geçen yuvarlak kümeler tek bir siluet oluşturur
        const r = size * 0.3 * grow;
        const canopyY = y0 + size * 0.32;
        const lobes = [
            [cx, canopyY - r * 0.25, r],
            [cx - r * 0.75, canopyY + r * 0.2, r * 0.78],
            [cx + r * 0.75, canopyY + r * 0.18, r * 0.75],
            [cx - r * 0.2, canopyY + r * 0.5, r * 0.68]
        ];

        // Tek siluet: önce tüm loblar birleştirilmiş yol olarak çizilir
        const canopyPath = () => {
            ctx.beginPath();
            for (const [lx, ly, lr] of lobes) {
                ctx.moveTo(lx + lr, ly);
                ctx.arc(lx, ly, lr, 0, Math.PI * 2);
            }
        };
        cel(ctx, canopyPath, {
            base: leaf.base, shadow: leaf.shadow, light: null,
            outline: leaf.outline, lineWidth: 2.4,
            shadowDir: { x: 0.5, y: 0.6 },
            bounds: { x: cx - r * 1.6, y: canopyY - r * 1.3, w: r * 3.2, h: r * 2.6 }
        });

        // Anime yaprak vurgusu: üst-solda düz açık leke ve birkaç yay
        ctx.save();
        canopyPath();
        ctx.clip();
        ctx.fillStyle = leaf.light;
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.45, canopyY - r * 0.5, r * 0.42, r * 0.26, -0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = leaf.shadow;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.arc(cx + r * (0.1 + i * 0.5), canopyY + r * (0.15 + i * 0.2), r * 0.4, 2.6, 4.4);
            ctx.stroke();
        }
        ctx.restore();
    },

    drawBush(ctx, x0, y0, noise, dark) {
        const size = TILE_SIZE;
        const cx = x0 + size * 0.5;
        const cy = y0 + size * 0.58;
        const r = size * (0.28 + noise(0, 41) * 0.05);

        const leaf = dark
            ? { base: '#2a6f35', shadow: '#194a24', light: '#3f9245', outline: '#102d17' }
            : { base: '#4aa64c', shadow: '#2f7d3a', light: '#77cc6c', outline: '#1c4f26' };

        groundShadow(ctx, cx, y0 + size * 0.82, r * 1.15, size * 0.09);

        const lobes = [
            [cx, cy - r * 0.15, r * 0.85],
            [cx - r * 0.65, cy + r * 0.2, r * 0.68],
            [cx + r * 0.65, cy + r * 0.18, r * 0.66]
        ];
        const path = () => {
            ctx.beginPath();
            for (const [lx, ly, lr] of lobes) {
                ctx.moveTo(lx + lr, ly);
                ctx.arc(lx, ly, lr, 0, Math.PI * 2);
            }
        };
        cel(ctx, path, {
            base: leaf.base, shadow: leaf.shadow, light: null,
            outline: leaf.outline, lineWidth: 2.2,
            bounds: { x: cx - r * 1.5, y: cy - r, w: r * 3, h: r * 2.2 }
        });

        // Yaprak uçları: düz, sivri üçgenler (anime detayı)
        ctx.save();
        path();
        ctx.clip();
        ctx.fillStyle = leaf.light;
        for (let i = 0; i < 3; i++) {
            const lx = cx + (noise(i, 42) - 0.5) * r * 1.4;
            const ly = cy + (noise(i, 43) - 0.5) * r * 1.1;
            ctx.beginPath();
            ctx.moveTo(lx, ly - 5);
            ctx.lineTo(lx + 4, ly + 3);
            ctx.lineTo(lx - 4, ly + 3);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    },

    drawTallGrass(ctx, x0, y0, noise, phase, dark) {
        const size = TILE_SIZE;
        const sway = phase === 0 ? 0 : 3;
        const blade = dark
            ? { base: '#3f9245', outline: '#173d1c' }
            : { base: '#6cc95f', outline: '#2a6b31' };

        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
            const gx = x0 + size * (0.12 + noise(i, 51) * 0.76);
            const gy = y0 + size * (0.68 + noise(i, 52) * 0.24);
            const h = size * (0.26 + noise(i, 53) * 0.24);
            const lean = (noise(i, 54) - 0.5) * 10 + sway;

            // Kontur (kalın koyu) + üstüne düz renk: anime çim
            ctx.strokeStyle = blade.outline;
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.quadraticCurveTo(gx + lean * 0.4, gy - h * 0.6, gx + lean, gy - h);
            ctx.stroke();

            ctx.strokeStyle = blade.base;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.quadraticCurveTo(gx + lean * 0.4, gy - h * 0.6, gx + lean, gy - h);
            ctx.stroke();
        }
        ctx.restore();
    },

    drawFlowers(ctx, x0, y0, noise) {
        const size = TILE_SIZE;
        const palettes = [
            { base: '#ff7fb0', light: '#ffc2da', outline: '#b03a68' },
            { base: '#ffd24a', light: '#ffe89a', outline: '#b8862a' },
            { base: '#ff8a6b', light: '#ffc0ae', outline: '#b04a34' },
            { base: '#c79bff', light: '#e6d0ff', outline: '#7a4fb0' },
            { base: '#ffffff', light: '#ffffff', outline: '#9aa5b1' }
        ];

        for (let i = 0; i < 3; i++) {
            const fx = x0 + size * (0.2 + noise(i, 61) * 0.6);
            const fy = y0 + size * (0.3 + noise(i, 62) * 0.5);
            const r = 4 + noise(i, 63) * 1.5;
            const c = palettes[Math.floor(noise(i, 64) * palettes.length) % palettes.length];

            // Sap: düz koyu çizgi
            ctx.save();
            ctx.strokeStyle = '#2a6b31';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(fx, fy + r * 2.6);
            ctx.quadraticCurveTo(fx + 2, fy + r, fx, fy);
            ctx.stroke();
            ctx.restore();

            // Beş taç yaprak: her biri konturlu düz daire
            for (let p = 0; p < 5; p++) {
                const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
                celCircle(ctx, fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.66, {
                    base: c.base, shadow: null, light: null,
                    outline: c.outline, lineWidth: 1.2
                });
            }
            // Göbek
            celCircle(ctx, fx, fy, r * 0.42, {
                base: '#ffe066', shadow: null, light: null,
                outline: '#b8862a', lineWidth: 1.1
            });
        }
    },

    drawAncientTree(ctx, x0, y0, noise, phase) {
        const size = TILE_SIZE;

        // Kadim gövde: düz kahve + sert gölge bandı
        ctx.fillStyle = '#8a5f38';
        ctx.fillRect(x0, y0, size, size);
        ctx.fillStyle = '#5f3f22';
        ctx.fillRect(x0 + size * 0.55, y0, size * 0.45, size);

        // Kabuk damarları: düz koyu çizgiler
        ctx.save();
        ctx.strokeStyle = '#3d2712';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const x = x0 + size * (0.18 + i * 0.28 + noise(i, 71) * 0.06);
            ctx.beginPath();
            ctx.moveTo(x, y0);
            ctx.quadraticCurveTo(x + 5, y0 + size / 2, x, y0 + size);
            ctx.stroke();
        }

        // Yosun: düz yeşil lekeler
        ctx.fillStyle = '#4aa64c';
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < 2; i++) {
            const mx = x0 + size * (0.2 + noise(i, 72) * 0.6);
            const my = y0 + size * (0.2 + noise(i, 73) * 0.6);
            ctx.beginPath();
            ctx.ellipse(mx, my, size * 0.16, size * 0.1, noise(i, 74) * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Kadim rune: parlayan düz halka + kontur
        const rx = x0 + size * (0.3 + noise(0, 75) * 0.35);
        const ry = y0 + size * (0.28 + noise(0, 76) * 0.35);
        ctx.strokeStyle = phase === 0 ? '#7dffa0' : '#c9ffd8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx, ry, size * 0.13, 0.4, 4.4);
        ctx.stroke();
        ctx.restore();
    },

    drawScorched(ctx, x0, y0, noise) {
        const size = TILE_SIZE;
        ctx.save();
        // Kavrulmuş düz lekeler
        ctx.fillStyle = '#5a3a1e';
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < 2; i++) {
            const sx = x0 + size * (0.25 + noise(i, 81) * 0.5);
            const sy = y0 + size * (0.25 + noise(i, 82) * 0.5);
            ctx.beginPath();
            ctx.ellipse(sx, sy, size * 0.2, size * 0.13, noise(i, 83) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        // Çatlaklar: keskin koyu çizgiler
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#2b1a0c';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const sx = x0 + size * (0.2 + noise(i, 84) * 0.6);
            const sy = y0 + size * (0.2 + noise(i, 85) * 0.6);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (noise(i, 86) - 0.5) * size * 0.6, sy + (noise(i, 87) - 0.5) * size * 0.6);
            ctx.stroke();
        }
        ctx.restore();
    },

    // Zemin, harita yüklenirken iki animasyon karesi halinde pişirilir
    bakeTerrain() {
        const grid = this.currentMap.grid;
        const w = grid[0].length * TILE_SIZE;
        const h = grid.length * TILE_SIZE;

        // Karo desenleri önbelleğe alınır; desen konuma bağlı olduğundan
        // VARIANTS karoda bir tekrar eder.
        const VARIANTS = 9;
        const patches = new Map();
        const patchFor = (tile, col, row, phase) => {
            const vc = col % VARIANTS;
            const vr = row % VARIANTS;
            const key = `${tile}|${vc}|${vr}|${phase}`;
            let patch = patches.get(key);
            if (!patch) {
                // Nesneler karo sınırını taşabilir (ağaç tacı gibi): payı olan
                // bir tuval kullanıp taşan kısmı komşuya taşırız.
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

        const view = this.viewSize;
        const sx = Math.max(0, Math.floor(camera.x));
        const sy = Math.max(0, Math.floor(camera.y));
        const sw = Math.min(layer.width - sx, Math.ceil(view.w) + TILE_SIZE);
        const sh = Math.min(layer.height - sy, Math.ceil(view.h) + TILE_SIZE);
        if (sw <= 0 || sh <= 0) return;

        ctx.drawImage(layer, sx, sy, sw, sh, sx, sy, sw, sh);
    }
};
