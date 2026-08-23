import { TILE_SIZE } from '../../config/worldMap.js';

// Zemin çizimi: karo desenleri ve haritanın offscreen canvas'a pişirilmesi.
// Overworld prototipine karıştırılır (applyMixins) - bu yüzden 'this' Overworld örneğidir.
export const TerrainRenderer = {
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
    },

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
    },

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
};
