import { PHYSICS } from '../config/settings.js';
import { newCanvas } from '../pixel/pixelDraw.js';

// 4 farklı pixel art arena arka planı.
// Yeni arena eklemek için diziye arena({ name, ledges, statik, live }) ekleyin.
//
// İKİ KATMAN: durağan olan (gök, zemin, ağaçlar, basamaklar) maç boyunca hiç
// değişmiyor, o yüzden bir kez ayrı bir tuvale çizilip her karede kopyalanıyor.
// Yalnızca canlı olan (lav, kar, şimşek) her karede yeniden çiziliyor. Arena
// 1280x640'a büyüyünce blok blok çizmek kare başına birkaç bin fillRect
// demekti; kare hızı 60'ın altına düşüyordu.
//
// BASAMAKLAR (ledges): üstüne çıkılıp dövüşülen geniş sekiler. Her arenanın
// kendi düzeni var - arena maç boyunca sabit olduğu için düzen ezberlenebilir.
// Tek yönlüler: altlarından zıplayarak üstlerine çıkılır, üstlerinden AŞAĞI
// tuşuyla inilir (bkz. Player.landingFoot).
//
// Yükseklikler ZEMİNDEN PİKSEL cinsinden, tuvalin oranıyla değil: bir
// basamağa çıkılıp çıkılamaması zıplama yüksekliğine bağlı, tuvalin boyuna
// değil. Normal zıplama ~140 piksel çıkıyor (jumpVelocity 13, gravity 0.6),
// yukarı atılma ~360.
export const LEDGE = {
    low: 120,     // zıplamayla çıkılır
    high: 250,    // ancak alt basamaktan ya da yukarı atılmayla çıkılır
    thick: 24     // kalınlık: üç piksel bloğu
};

const LPX = 8;   // arenaların piksel bloğu

// Zeminin ayak çizgisi: karakterin ayaklarının değdiği yer (çizilen zemin
// bandının biraz içi). Basamak yükseklikleri buradan ölçülüyor.
function footLine(h) {
    return h - PHYSICS.groundOffset;
}

// Bir basamak kaydı. Oranlar tuvale göre, yükseklik zemine göre.
// Kenarlar piksel ızgarasına oturuyor: yarım blok kaymış basamak "basamak"
// değil "çizgi" gibi duruyor.
function ledge(w, h, xRatio, wRatio, above) {
    const snap = (v) => Math.round(v / LPX) * LPX;
    return {
        x: snap(w * xRatio),
        y: snap(footLine(h) - above),
        w: snap(w * wRatio),
        h: LEDGE.thick
    };
}

// Basamağın çizimi: gövde arenanın kendi taşından, üst kenarı aydınlık
// (basılan çizgi belli olsun), altında da gölge - havada durduğu okunsun.
function drawLedges(ctx, ledges, body, top) {
    for (const s of ledges) {
        for (let row = 0; row * LPX < s.h; row++) {
            for (let col = 0; col < s.w; col += LPX) {
                ctx.fillStyle = body[(Math.floor(col / LPX) + row * 2) % body.length];
                ctx.fillRect(s.x + col, s.y + row * LPX, LPX, LPX);
            }
        }
        ctx.fillStyle = top;
        ctx.fillRect(s.x, s.y, s.w, LPX / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(s.x, s.y + s.h, s.w, LPX);
    }
}

// --- arenaların basamak düzenleri ---
// Hepsi SİMETRİK: iki oyuncu da aynı arenayı görüyor, kimse avantajlı doğmuyor.

// Ateş Dağı: iki yanda geniş alt seki, ortada yüksek bir seki.
const fireLedges = (w, h) => [
    ledge(w, h, 0.05, 0.26, LEDGE.low),
    ledge(w, h, 0.69, 0.26, LEDGE.low),
    ledge(w, h, 0.35, 0.30, LEDGE.high)
];

// Buz Diyarı: ortada çok geniş bir alt seki, iki yanda yüksek sekiler.
const iceLedges = (w, h) => [
    ledge(w, h, 0.30, 0.40, LEDGE.low),
    ledge(w, h, 0.04, 0.20, LEDGE.high),
    ledge(w, h, 0.76, 0.20, LEDGE.high)
];

// Fırtına: yalnızca iki geniş alt seki - üstü boş, inen şimşek görünsün.
const stormLedges = (w, h) => [
    ledge(w, h, 0.09, 0.28, LEDGE.low),
    ledge(w, h, 0.63, 0.28, LEDGE.low)
];

// Orman Tapınağı: iki yanda merdiven - önce alt, sonra üst seki.
const forestLedges = (w, h) => [
    ledge(w, h, 0.04, 0.24, LEDGE.low),
    ledge(w, h, 0.72, 0.24, LEDGE.low),
    ledge(w, h, 0.22, 0.20, LEDGE.high),
    ledge(w, h, 0.58, 0.20, LEDGE.high)
];

// Durağan katmanı önbelleğe alan sarmalayıcı. Tuval boyu değişirse (ya da
// arena ilk kez çizilirse) yeniden çiziliyor.
function arena({ name, ledges, statik, live }) {
    let cache = null;
    return {
        name,
        ledges,
        drawBg(ctx, w, h) {
            if (!cache || cache.width !== w || cache.height !== h) {
                const off = newCanvas(w, h);
                statik(off.ctx, w, h);
                cache = off.canvas;
            }
            ctx.drawImage(cache, 0, 0);
            if (live) live(ctx, w, h);
        }
    };
}

// Sekiz katmanlı gök: bütün arenalarda aynı iş
function sky(ctx, w, h, colors) {
    for (let row = 0; row < 8; row++) {
        ctx.fillStyle = colors[row];
        ctx.fillRect(0, row * (h / 8), w, h / 8 + 1);
    }
}

// Uzaktaki yanardağ: tepeye doğru daralan bir siluet, ağzından aşağı lav.
// Arena boyu büyüyünce göğün ortası bomboş kalıyordu.
function volcano(ctx, cx, baseY, height, width, body, lava) {
    const rows = Math.round(height / LPX);
    const top = baseY - height;
    for (let r = 0; r < rows; r++) {
        const t = r / rows;                                    // 0 tepe, 1 taban
        const half = Math.round((width / 2) * (0.14 + t * 0.86) / LPX) * LPX;
        ctx.fillStyle = body;
        ctx.fillRect(cx - half, top + r * LPX, half * 2, LPX);
    }
    ctx.fillStyle = lava;
    for (let r = 0; r < rows * 0.45; r++) {
        ctx.fillRect(cx + ((r % 3) - 1) * LPX, top + r * LPX, LPX, LPX);
    }
}

// Blok bulut: merkezinden dışa doğru incelen üç sıra
function cloud(ctx, cx, cy, rad, colors) {
    for (let dx = -rad; dx <= rad; dx++) {
        const tall = Math.abs(dx) > rad - 2 ? 1 : 3;
        for (let dy = 0; dy < tall; dy++) {
            ctx.fillStyle = colors[Math.abs(dx + dy) % colors.length];
            ctx.fillRect(cx + dx * LPX, cy - dy * LPX, LPX, LPX);
        }
    }
}

// Ağaç: gövde ve tepesindeki yaprak kütlesi
function tree(ctx, tx, ty, bottom, leafColors) {
    ctx.fillStyle = '#4a2800';
    ctx.fillRect(tx, ty, LPX * 3, bottom - ty);
    // Yaprak kütlesi: gövde uzayınca tepe de büyümeli, yoksa ağaç değil
    // sırığın ucundaki top gibi duruyor.
    for (let lx = -8; lx <= 8; lx++) {
        for (let ly = -11; ly <= 2; ly++) {
            const d = Math.abs(lx) + Math.abs(ly * 0.8);
            if (d >= 11) continue;
            ctx.fillStyle = leafColors[Math.floor(d) % leafColors.length];
            ctx.fillRect(tx + LPX + lx * LPX, ty + ly * LPX, LPX, LPX);
        }
    }
}

export const ARENAS = [
    arena({
        name: 'Ateş Dağı',
        ledges: fireLedges,
        statik: (ctx, w, h) => {
            const PX = LPX;
            // Gök: koyu kırmızı-turuncu piksel satırları
            sky(ctx, w, h, ['#1a0500','#1a0500','#200700','#280a00','#2d0a00','#350c00','#3b0e00','#3b0e00']);
            // Uzaktaki yanardağlar: ortadaki büyük, yanlarda ikisi geride
            const base = h - PX * 6;
            volcano(ctx, w * 0.20, base, h * 0.34, w * 0.26, '#140300', '#7c1400');
            volcano(ctx, w * 0.82, base, h * 0.30, w * 0.22, '#140300', '#7c1400');
            volcano(ctx, w * 0.50, base, h * 0.52, w * 0.40, '#1e0500', '#a52a00');
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
            // Basamaklar: kızgın taş, üst kenarı akkor
            drawLedges(ctx, fireLedges(w, h), groundColors, '#ff8c00');
        },
        live: (ctx, w, h) => {
            const PX = LPX;
            // Lav damarları
            const t = Math.floor(Date.now() / 300);
            for (let col = 0; col < w; col += PX*4) {
                const offset = ((col/PX + t) % 6);
                if (offset < 2) {
                    ctx.fillStyle = '#7c1400';
                    ctx.fillRect(col, h*0.5, PX*3, PX);
                }
            }
            // Lav şeridi
            const lavColors = ['#ff4500','#ff6a00','#ff8c00'];
            const lh = Math.floor(Date.now() / 200);
            for (let col = 0; col < w; col += PX) {
                const offset = Math.abs((col/PX + lh) % 6) < 3 ? PX : 0;
                ctx.fillStyle = lavColors[(col/PX) % lavColors.length];
                ctx.fillRect(col, h - PX*2 - offset/2, PX, PX*2 + offset/2);
            }
        }
    }),
    arena({
        name: 'Buz Diyarı',
        ledges: iceLedges,
        statik: (ctx, w, h) => {
            const PX = LPX;
            sky(ctx, w, h, ['#0a1628','#0c1a30','#0e2038','#0e2240','#102444','#122648','#14284c','#143055']);
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
            // Basamaklar: buz kütlesi, üstü karla parlak
            drawLedges(ctx, iceLedges(w, h), ['#0369a1','#0ea5e9','#38bdf8','#0284c7'], '#e0f2fe');
        },
        live: (ctx, w, h) => {
            const PX = LPX;
            // Kar tanecikleri
            const t = Date.now() / 2000;
            ctx.fillStyle = 'rgba(224,242,254,0.8)';
            for (let i = 0; i < 20; i++) {
                const px2 = Math.floor((i*73 + t*30) % (w/PX)) * PX;
                const py = Math.floor((i*47 + t*20) % ((h-PX*5)/PX)) * PX;
                ctx.fillRect(px2, py, PX, PX);
            }
        }
    }),
    arena({
        name: 'Fırtına Arenası',
        ledges: stormLedges,
        statik: (ctx, w, h) => {
            const PX = LPX;
            // Koyu bulutlu gök
            sky(ctx, w, h, ['#0d0d1a','#0d0d1a','#0f0f20','#111124','#131328','#14142a','#16162e','#1a1a2e']);
            // Bulut bankı: üst şerit boydan boya kapalı, altında dağılan
            // birkaç bulut daha - fırtına yukarıda toplanmış görünsün.
            const cloudColors = ['#1e1e3a','#252540','#2a2a4a'];
            const far = ['#171730','#1c1c38','#212140'];
            [[110,56,6],[300,40,5],[520,64,7],[760,44,5],[980,60,6],[1180,40,5]]
                .forEach(([cx,cy,rad]) => cloud(ctx, cx, cy, rad, cloudColors));
            [[200,150,4],[640,180,6],[1050,160,4]]
                .forEach(([cx,cy,rad]) => cloud(ctx, cx, cy, rad, far));
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
            // Basamaklar: aynı taş, üstü şimşek ışığında
            drawLedges(ctx, stormLedges(w, h), stoneColors, '#94a3b8');
        },
        live: (ctx, w, h) => {
            const PX = LPX;
            // Yağmur: eğik kısa çizgiler, arenanın ortasındaki boşluğu dolduruyor
            const rt = Date.now() / 90;
            ctx.fillStyle = 'rgba(148,180,220,0.45)';
            for (let i = 0; i < 40; i++) {
                const rx = (i * 137 + Math.floor(rt) * 3) % w;
                const ry = (i * 211 + Math.floor(rt) * 26) % (h - PX * 5);
                ctx.fillRect(rx, ry, PX / 2, PX * 3);
            }
            // Şimşek: gökten iniyor, zemine varmadan kesiliyor
            const tf = Math.floor(Date.now() / 80);
            if (tf % 12 >= 2) return;
            const lx = Math.floor(Math.sin(tf)*300 + w/2);
            const stop = h - PX * 5;
            ctx.fillStyle = '#e0f2fe';
            for (let seg = 0; seg < 8 && (seg + 1) * (h/8) < stop; seg++) {
                const offset = (seg % 2 === 0 ? PX : -PX);
                ctx.fillRect(lx + offset, seg * (h/8), PX, h/8);
            }
        }
    }),
    arena({
        name: 'Orman Tapınağı',
        ledges: forestLedges,
        statik: (ctx, w, h) => {
            const PX = LPX;
            // Orman göğü
            sky(ctx, w, h, ['#071a07','#081e08','#09200a','#0a240a','#0c280c','#0e2c0e','#0f2e0e','#102e10']);
            // Arkadaki orman duvarı: tepede kapanan koyu yaprak şeridi
            const backLeaves = ['#0a2c14','#0d3a1a','#10461f'];
            for (let cx = 0; cx <= w; cx += PX * 9) {
                cloud(ctx, cx, PX * 4 + (cx / (PX * 9) % 3) * PX, 6, backLeaves);
            }
            // Ağaçlar: arenanın boyu arttı, gövdeler de yukarı uzuyor
            const leafColors = ['#14532d','#15803d','#16a34a','#22c55e'];
            const bottom = h - PX * 5;
            [[80, h-PX*38],[250, h-PX*30],[450, h-PX*44],[700, h-PX*33],
             [900, h-PX*40],[1120, h-PX*31]].forEach(([tx, ty]) => {
                tree(ctx, tx, ty, bottom, leafColors);
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
            // Basamaklar: tapınağın taş merdivenleri, üstü yosunlu
            drawLedges(ctx, forestLedges(w, h), ['#3f4a35','#4b5540','#59634c','#454f3a'], '#4ade80');
        }
    })
];

// Bir arenanın basamakları. Arena kaydında yoksa boş: basamaksız arena da
// geçerli (çarpışma kodu boş diziyle çalışıyor).
export function ledgesOf(arena, w, h) {
    return arena?.ledges ? arena.ledges(w, h) : [];
}

export function randomArena() {
    return ARENAS[Math.floor(Math.random() * ARENAS.length)];
}
