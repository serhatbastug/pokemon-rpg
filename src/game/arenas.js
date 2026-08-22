// 4 farklı pixel art arena arka planı.
// Yeni arena eklemek için diziye { name, drawBg } kaydı ekleyin.
export const ARENAS = [
    {
        name: 'Ateş Dağı',
        drawBg: (ctx, w, h) => {
            const PX = 8; // piksel blok boyutu
            // Gök: koyu kırmızı-turuncu piksel satırları
            const skyColors = ['#1a0500','#1a0500','#200700','#280a00','#2d0a00','#350c00','#3b0e00','#3b0e00'];
            for (let row = 0; row < 8; row++) {
                ctx.fillStyle = skyColors[row];
                ctx.fillRect(0, row * (h/8), w, h/8 + 1);
            }
            // Lav damarları (arka plan hareketli)
            const t = Math.floor(Date.now() / 300);
            for (let col = 0; col < w; col += PX*4) {
                const offset = ((col/PX + t) % 6);
                if (offset < 2) {
                    ctx.fillStyle = '#7c1400';
                    ctx.fillRect(col, h*0.5, PX*3, PX);
                }
            }
            // Taş platform zemini - piksel bloklar
            const groundY = h - PX * 6;
            const groundColors = ['#3b0e00','#5c1000','#7c1400','#8b1a00'];
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < w; col += PX) {
                    const colorIdx = (Math.floor(col/PX*0.3) + row) % groundColors.length;
                    ctx.fillStyle = groundColors[colorIdx];
                    ctx.fillRect(col, groundY + row * PX, PX, PX);
                }
            }
            // Lav şeridi
            const lavColors = ['#ff4500','#ff6a00','#ff8c00'];
            for (let col = 0; col < w; col += PX) {
                const lh = Math.floor(Date.now() / 200);
                const offset = Math.abs((col/PX + lh) % 6) < 3 ? PX : 0;
                ctx.fillStyle = lavColors[(col/PX) % lavColors.length];
                ctx.fillRect(col, h - PX*2 - offset/2, PX, PX*2 + offset/2);
            }
        }
    },
    {
        name: 'Buz Diyarı',
        drawBg: (ctx, w, h) => {
            const PX = 8;
            // Gök katmanları
            const skyColors = ['#0a1628','#0c1a30','#0e2038','#0e2240','#102444','#122648','#14284c','#143055'];
            for (let row = 0; row < 8; row++) {
                ctx.fillStyle = skyColors[row];
                ctx.fillRect(0, row * (h/8), w, h/8 + 1);
            }
            // Buz sarkıtları (yukarıdan aşağı)
            for (let col = 0; col < w; col += PX*3) {
                const ht = PX * (2 + (col/PX) % 4);
                const colors = ['#38bdf8','#7dd3fc','#bae6fd'];
                for (let r = 0; r < ht/PX; r++) {
                    ctx.fillStyle = colors[r % colors.length];
                    const width = PX * Math.max(1, 3 - r);
                    ctx.fillRect(col + PX - width/2, r*PX, width, PX);
                }
            }
            // Buz zemin - parlak mavi bloklar
            const groundY = h - PX * 5;
            const iceColors = ['#0ea5e9','#38bdf8','#7dd3fc','#bae6fd'];
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < w; col += PX) {
                    const idx = ((col/PX) + row) % iceColors.length;
                    ctx.fillStyle = iceColors[idx];
                    ctx.fillRect(col, groundY + row*PX, PX, PX);
                }
            }
            // Kar tanecikleri hareketli
            const t = Date.now() / 2000;
            ctx.fillStyle = 'rgba(224,242,254,0.8)';
            for (let i = 0; i < 20; i++) {
                const px2 = Math.floor((i*73 + t*30) % (w/PX)) * PX;
                const py = Math.floor((i*47 + t*20) % ((h-PX*5)/PX)) * PX;
                ctx.fillRect(px2, py, PX, PX);
            }
        }
    },
    {
        name: 'Fırtına Arenası',
        drawBg: (ctx, w, h) => {
            const PX = 8;
            // Koyu bulutlu gök
            const skyColors = ['#0d0d1a','#0d0d1a','#0f0f20','#111124','#131328','#14142a','#16162e','#1a1a2e'];
            for (let row = 0; row < 8; row++) {
                ctx.fillStyle = skyColors[row];
                ctx.fillRect(0, row * (h/8), w, h/8 + 1);
            }
            // Bulut blokları
            const cloudColors = ['#1e1e3a','#252540','#2a2a4a'];
            [[100,30],[300,50],[600,25],[800,45]].forEach(([cx,cy]) => {
                for (let dx = -5; dx <= 5; dx++) {
                    for (let dy = -2; dy <= 0; dy++) {
                        const cIdx = Math.abs(dx+dy) % cloudColors.length;
                        ctx.fillStyle = cloudColors[cIdx];
                        ctx.fillRect(cx + dx*PX, cy + dy*PX, PX, PX);
                    }
                }
            });
            // Şimşek animasyonu
            const tf = Math.floor(Date.now() / 80);
            if (tf % 12 < 2) {
                const lx = Math.floor(Math.sin(tf)*300 + w/2);
                ctx.fillStyle = '#e0f2fe';
                for (let seg = 0; seg < 8; seg++) {
                    const offset = (seg % 2 === 0 ? PX : -PX);
                    ctx.fillRect(lx + offset, seg * (h/8), PX, h/8);
                }
            }
            // Taş zemin
            const groundY = h - PX * 5;
            const stoneColors = ['#1e2a3a','#253040','#2c3a4a','#334050'];
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < w; col += PX) {
                    const idx = ((col/PX) + row*3) % stoneColors.length;
                    ctx.fillStyle = stoneColors[idx];
                    ctx.fillRect(col, groundY + row*PX, PX, PX);
                }
            }
        }
    },
    {
        name: 'Orman Tapınağı',
        drawBg: (ctx, w, h) => {
            const PX = 8;
            // Orman göğü
            const skyColors = ['#071a07','#081e08','#09200a','#0a240a','#0c280c','#0e2c0e','#0f2e0e','#102e10'];
            for (let row = 0; row < 8; row++) {
                ctx.fillStyle = skyColors[row];
                ctx.fillRect(0, row * (h/8), w, h/8 + 1);
            }
            // Ağaç gövdeleri
            [[80,h-PX*15],[250,h-PX*18],[450,h-PX*12],[700,h-PX*17],[900,h-PX*14]].forEach(([tx,ty]) => {
                // Gövde
                ctx.fillStyle = '#4a2800';
                ctx.fillRect(tx, ty, PX*3, h-ty-PX*5);
                // Yapraklar
                const leafColors = ['#14532d','#15803d','#16a34a','#22c55e'];
                for (let lx = -4; lx <= 4; lx++) {
                    for (let ly = -5; ly <= 0; ly++) {
                        const d = Math.abs(lx)+Math.abs(ly);
                        if (d < 6) {
                            ctx.fillStyle = leafColors[d % leafColors.length];
                            ctx.fillRect(tx + PX + lx*PX, ty + ly*PX, PX, PX);
                        }
                    }
                }
            });
            // Çim zemin
            const groundY = h - PX * 5;
            const grassColors = ['#14532d','#15803d','#166534','#15803d'];
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < w; col += PX) {
                    const idx = ((col/PX) + row) % grassColors.length;
                    ctx.fillStyle = grassColors[idx];
                    ctx.fillRect(col, groundY + row*PX, PX, PX);
                }
            }
            // Otuçuklar
            ctx.fillStyle = '#4ade80';
            for (let col = PX*2; col < w; col += PX*8) {
                ctx.fillRect(col, groundY - PX, PX, PX);
                ctx.fillRect(col + PX*3, groundY - PX*2, PX, PX*2);
            }
        }
    }
];

export function randomArena() {
    return ARENAS[Math.floor(Math.random() * ARENAS.length)];
}
