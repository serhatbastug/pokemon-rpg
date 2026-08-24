// Kuşatılan çalışma alanının piksel çizimleri.
//
// Zemin (cephe, beton avlu, tel örgü, sabit nesneler) bir kez offscreen
// canvas'a pişirilir. Hâli değişen şeyler - inen çelik kapı, örgünün
// ardındaki kalabalık, avluya giren virüslüler, mermiler ve yere dağılan
// yeşil lekeler - her karede üstüne çizilir.

import { PX, newCanvas, blk, dot, hash } from '../pixel/pixelDraw.js';
import {
    WORLD, FACADE, YARD, FENCE, CROWD, BREACH,
    STEEL_DOOR, GENERATOR, TOWER, LEVER, CRATES, PYLON
} from './siegeLayout.js';

// --- Paletler ---
const CONCRETE = ['#6e7278', '#787c83', '#63676d', '#585c62'];
const CONCRETE_SEAM = '#4e5258';
const FACADE_WALL = ['#7a7e86', '#6c7078', '#858a92'];
const FACADE_DARK = '#4c5057';
const STEEL = { body: '#8a929c', dark: '#5f6873', light: '#a8b0ba', edge: '#3a4149' };
const WARN = { yellow: '#c9a227', dark: '#2a2620' };
const RUST = ['#7c3a1d', '#8f4a24', '#5e2c15'];
const SOOT = ['#1b1817', '#231f1d', '#2c2724'];
// Virüslüler: örgünün ardında hareket eden yeşil siluetler
const INFECTED = { body: '#3d6317', dark: '#26400d', light: '#537f22', head: '#456f19' };

// --- Zemin ---

export function bakeGround() {
    const { canvas, ctx } = newCanvas(WORLD.w, WORLD.h);

    drawYard(ctx);
    drawFacade(ctx);
    drawFence(ctx);
    drawGenerator(ctx);
    drawTower(ctx);
    drawPylonBase(ctx);
    drawPylonMast(ctx);
    drawLever(ctx);
    for (const crate of CRATES) drawCrate(ctx, crate);
    drawGrime(ctx);
    return canvas;
}

// Beton avlu: büyük dökme plakalar, derzler, çatlaklar, boyalı şeritler
function drawYard(ctx) {
    for (let y = YARD.top; y <= YARD.bottom; y += PX) {
        for (let x = 0; x < WORLD.w; x += PX) {
            const slabX = Math.floor(x / (PX * 22));
            const slabY = Math.floor(y / (PX * 16));
            let tone = CONCRETE[Math.floor(hash(slabX, slabY, 11) * CONCRETE.length)];
            if (hash(x, y, 13) < 0.12) tone = CONCRETE[Math.floor(hash(x, y, 17) * CONCRETE.length)];
            if (x % (PX * 22) === 0 || y % (PX * 16) === 0) tone = CONCRETE_SEAM;
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Sarı uyarı şeridi: avlunun ortasından geçen yükleme hattı
    for (let x = 0; x < WORLD.w; x += PX * 2) {
        if (hash(x, 0, 19) < 0.18) continue;                 // boyası aşınmış
        blk(ctx, x, 300, PX * 2, PX, '#9b8324');
    }
    // Zemine boyanmış tehlike üçgeni (kapının önü)
    for (let i = 0; i < 9; i++) {
        blk(ctx, 470 + i * PX, 200 + i * PX, PX * (18 - i * 2), PX, i % 2 ? '#9b8324' : '#5c5c5f');
    }

    // Yağmur suyu ızgarası
    for (const gx of [340, 690]) {
        blk(ctx, gx, 420, PX * 8, PX * 5, '#4a4e54');
        for (let i = 0; i < 4; i++) blk(ctx, gx + PX + i * PX * 2, 424, PX, PX * 3, '#2b2f34');
    }
}

// Araştırma binasının cephesi: kaba beton, dar yüksek pencereler, çelik kapı
// boşluğu. Kapının kendisi her karede ayrıca çiziliyor (iniyor).
function drawFacade(ctx) {
    for (let y = 0; y < FACADE.h; y += PX) {
        for (let x = 0; x < WORLD.w; x += PX) {
            const panel = Math.floor(x / (PX * 26));
            let tone = FACADE_WALL[Math.floor(hash(panel, Math.floor(y / 40), 23) * FACADE_WALL.length)];
            if (x % (PX * 26) === 0) tone = FACADE_DARK;                 // panel derzi
            if (hash(x, y, 29) < 0.10) tone = FACADE_DARK;
            if (hash(x, y, 31) < 0.04) tone = SOOT[Math.floor(hash(x, y, 37) * SOOT.length)];
            ctx.fillStyle = tone;
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Dar yüksek pencereler: içerisi karanlık, kimi kırık
    for (let x = 40; x < WORLD.w - 40; x += 96) {
        if (x > STEEL_DOOR.x - 70 && x < STEEL_DOOR.x + STEEL_DOOR.w + 20) continue;
        const wy = 36;
        blk(ctx, x - PX, wy - PX, PX * 7, PX * 14, '#3d4249');
        blk(ctx, x, wy, PX * 5, PX * 12, '#161b21');
        // camdaki soluk yansıma
        blk(ctx, x + PX, wy + PX, PX, PX * 5, '#2f3b47');
        if (hash(x, 0, 41) < 0.4) {
            for (let i = 0; i < 5; i++) dot(ctx, x + PX * (i % 5), wy + PX * (2 + i), '#59636e');
        }
    }

    // Cephenin dibi: koyu bir kaide bandı, avluya oturan gölge
    blk(ctx, 0, FACADE.h - PX * 4, WORLD.w, PX * 4, '#4a4e55');
    blk(ctx, 0, FACADE.h - PX, WORLD.w, PX, '#33373c');
    ctx.globalAlpha = 0.25;
    blk(ctx, 0, FACADE.h, WORLD.w, PX * 3, '#000000');
    ctx.globalAlpha = 1;

    // Kapının kasası ve üstündeki uyarı lambası
    const d = STEEL_DOOR;
    blk(ctx, d.x - PX * 2, d.y - PX * 3, d.w + PX * 4, PX * 3, STEEL.dark);
    blk(ctx, d.x - PX * 2, d.y, PX * 2, d.h, STEEL.dark);
    blk(ctx, d.x + d.w, d.y, PX * 2, d.h, STEEL.dark);
    // Kapı boşluğu: kapı yukarıdayken içerisi görünür
    blk(ctx, d.x, d.y, d.w, d.h, '#12161b');
    blk(ctx, d.x, d.y + d.h - PX * 2, d.w, PX * 2, '#1d2229');
}

// Tel örgü: direkler, kafes deseni ve yarılan bölüm
function drawFence(ctx) {
    const y0 = FENCE.y;
    const y1 = FENCE.y + FENCE.h;

    // Örgünün ardındaki karanlık: kalabalık oraya çiziliyor
    for (let y = y1; y < WORLD.h; y += PX) {
        for (let x = 0; x < WORLD.w; x += PX) {
            ctx.fillStyle = hash(x, y, 43) < 0.25 ? '#14181d' : '#1a1f25';
            ctx.fillRect(x, y, PX, PX);
        }
    }

    // Kafes: koyu zemin üzerine SOLUK çapraz tel. Yüksek kontrastlı desen
    // uzaktan dama tahtasına benziyor, tel örgüye değil.
    blk(ctx, 0, y0, WORLD.w, FENCE.h, '#272c33');
    for (let x = 0; x < WORLD.w; x += PX) {
        const breached = x > BREACH.x && x < BREACH.x + BREACH.w;
        for (let y = y0; y < y1; y += PX) {
            if (breached && hash(x, y, 47) < 0.8) continue;       // yırtılmış bölüm
            const gx = Math.floor(x / PX);
            const gy = Math.floor(y / PX);
            if ((gx + gy) % 3 === 0) dot(ctx, x, y, hash(x, y, 53) < 0.15 ? RUST[2] : '#5d666f');
            else if ((gx - gy) % 3 === 0) dot(ctx, x, y, '#4a525a');
        }
    }
    // Üst ve alt kuşak
    blk(ctx, 0, y0, WORLD.w, PX, '#6e7681');
    blk(ctx, 0, y1 - PX, WORLD.w, PX, '#5a626c');
    // Direkler
    for (let x = 0; x < WORLD.w; x += 120) {
        blk(ctx, x, y0 - PX * 2, PX * 2, FENCE.h + PX * 2, '#4e5563');
        blk(ctx, x, y0 - PX * 2, PX, FENCE.h + PX * 2, '#6a7280');
    }
    // Yarığın kenarında dışa kıvrılmış tel
    for (let i = 0; i < 10; i++) {
        const x = BREACH.x + hash(i, 0, 59) * BREACH.w;
        dot(ctx, x, y0 + PX * (1 + Math.floor(hash(i, 1, 61) * 4)), '#a8b0ba');
    }
}

// Jeneratör: sac kutu, havalandırma ızgarası, kablolar
function drawGenerator(ctx) {
    const g = GENERATOR;
    blk(ctx, g.x, g.y, g.w, g.h, '#5f6873');
    blk(ctx, g.x, g.y, g.w, PX * 2, '#7d8792');
    blk(ctx, g.x, g.y + g.h - PX * 3, g.w, PX * 3, '#3a4149');
    blk(ctx, g.x, g.y, PX, g.h, '#8a929c');
    blk(ctx, g.x + g.w - PX, g.y, PX, g.h, '#3a4149');
    // Izgara
    for (let i = 0; i < 6; i++) {
        blk(ctx, g.x + PX * 3, g.y + PX * 3 + i * PX * 2, g.w - PX * 8, PX, '#2f353c');
    }
    // Uyarı şeridi ve pas
    for (let x = g.x; x < g.x + g.w; x += PX * 3) {
        blk(ctx, x, g.y + g.h - PX * 6, PX * 3, PX * 2,
            Math.floor(x / (PX * 3)) % 2 ? WARN.yellow : WARN.dark);
    }
    for (let y = g.y; y < g.y + g.h; y += PX) {
        for (let x = g.x; x < g.x + g.w; x += PX) {
            if (hash(x, y, 67) < 0.05) dot(ctx, x, y, RUST[Math.floor(hash(x, y, 71) * RUST.length)]);
        }
    }
    // Kablo: jeneratörden duvar dibine, oradan kola. Avluyu boydan boya
    // kesmesin diye iki düz parça halinde gidiyor; kolun neye bağlı olduğu
    // yine gözle anlaşılıyor.
    const railY = FACADE.h + PX;
    for (let y = g.y; y > railY; y -= PX) {
        dot(ctx, g.x + g.w / 2, y, '#23262b');
        dot(ctx, g.x + g.w / 2 + PX, y, '#15181c');
    }
    for (let x = g.x + g.w / 2; x < LEVER.x + LEVER.w / 2; x += PX) {
        dot(ctx, x, railY, '#23262b');
        dot(ctx, x, railY + PX, '#15181c');
        if (hash(x, 0, 193) < 0.08) blk(ctx, x, railY - PX, PX, PX * 3, '#3a4149');   // kelepçe
    }
    for (let y = railY; y > LEVER.y + LEVER.h; y -= PX) {
        dot(ctx, LEVER.x + LEVER.w / 2, y, '#23262b');
    }
}

// Gözetleme kulesi: beton kaide, merdiven ve üstünde çelik direk. Dekor.
function drawTower(ctx) {
    const t = TOWER;
    blk(ctx, t.x, t.y, t.w, t.h, '#6a6e75');
    blk(ctx, t.x, t.y, t.w, PX * 2, '#83878e');
    blk(ctx, t.x, t.y + t.h - PX * 3, t.w, PX * 3, '#474b51');
    blk(ctx, t.x + t.w - PX, t.y, PX, t.h, '#474b51');
    // Merdiven
    for (let i = 0; i < 9; i++) {
        blk(ctx, t.x + PX * 2, t.y + PX * 3 + i * PX * 3, PX * 6, PX, '#4e5563');
    }
    blk(ctx, t.x + PX * 2, t.y, PX, t.h - PX * 3, '#4e5563');
    blk(ctx, t.x + PX * 7, t.y, PX, t.h - PX * 3, '#4e5563');
    // Ayakta duran direğin dibi (gövdesi cephenin önünde yükseliyor)
    blk(ctx, t.x + PX * 11, t.y - PX * 30, PX * 5, t.h + PX * 30, '#79818c');
    blk(ctx, t.x + PX * 11, t.y - PX * 30, PX, t.h + PX * 30, '#9aa2ad');
    blk(ctx, t.x + PX * 15, t.y - PX * 30, PX, t.h + PX * 30, '#4e5563');
    // Direğin tepesindeki siren
    blk(ctx, t.x + PX * 10, t.y - PX * 34, PX * 7, PX * 4, '#4a4f57');
    blk(ctx, t.x + PX * 11, t.y - PX * 33, PX * 5, PX * 2, '#b3241f');
}

// Anten direğinin kaidesi: betona civatalı çelik ayak.
function drawPylonBase(ctx) {
    const p = PYLON;
    blk(ctx, p.x, p.y, p.w, p.h, '#5f6873');
    blk(ctx, p.x, p.y, p.w, PX * 2, '#8a929c');
    blk(ctx, p.x, p.y + p.h - PX * 3, p.w, PX * 3, '#3a4149');
    blk(ctx, p.x + p.w - PX, p.y, PX, p.h, '#3a4149');
    // Civatalı taban plakası
    blk(ctx, p.x - PX * 2, p.y + p.h - PX * 2, p.w + PX * 4, PX * 2, '#4a5058');
    for (let i = 0; i < 5; i++) dot(ctx, p.x - PX + i * PX * 2.5, p.y + p.h - PX, '#8a929c');
    // Gergi halatlarının bağlandığı kulaklar
    blk(ctx, p.x - PX * 3, p.y + PX * 4, PX * 3, PX * 2, '#4a5058');
    blk(ctx, p.x + p.w, p.y + PX * 4, PX * 3, PX * 2, '#4a5058');
    for (let y = p.y; y < p.y + p.h; y += PX) {
        for (let x = p.x; x < p.x + p.w; x += PX) {
            if (hash(x, y, 181) < 0.06) dot(ctx, x, y, RUST[Math.floor(hash(x, y, 191) * RUST.length)]);
        }
    }
}

// Anten direği: kaideden yukarı, cephenin üstüne kadar. Yalnızca dekor -
// artık devrilmiyor, oyuncuyu arkadaşından ayıran şey acil çıkış kapısı.
function drawPylonMast(ctx) {
    const p = PYLON;
    const x = p.x + PX * 3;
    const w = p.w - PX * 6;
    blk(ctx, x, 0, w, p.y, '#79818c');
    blk(ctx, x, 0, PX * 2, p.y, '#9aa2ad');
    blk(ctx, x + w - PX * 2, 0, PX * 2, p.y, '#4e5563');
    // Kafes kaburgaları
    for (let y = 0; y < p.y; y += PX * 5) {
        blk(ctx, x, y, w, PX, '#5f6873');
        dot(ctx, x + PX * 2, y + PX * 2, '#4e5563');
    }
    // Tepedeki kırmızı uyarı ışığı ve antenler
    blk(ctx, x - PX, 0, w + PX * 2, PX * 3, '#4a4f57');
    blk(ctx, x + PX, PX, PX * 3, PX, '#b3241f');
    // Gergi halatları: kaideden yanlara açılır
    for (let i = 0; i < 26; i++) {
        dot(ctx, x - i * 2.4, p.y - PX * 6 - i * 1.6, '#3f454d');
        dot(ctx, x + w + i * 2.4, p.y - PX * 6 - i * 1.6, '#3f454d');
    }
}

// Acil durum kolu: duvara sabit kutu, içinde aşağı çekilen kırmızı kol
function drawLever(ctx) {
    const l = LEVER;
    blk(ctx, l.x, l.y, l.w, l.h, '#4e5563');
    blk(ctx, l.x + PX, l.y + PX, l.w - PX * 2, l.h - PX * 2, '#2f353c');
    blk(ctx, l.x, l.y, l.w, PX, '#7d8792');
    // Sarı-siyah uyarı bandı
    for (let x = l.x; x < l.x + l.w; x += PX * 2) {
        blk(ctx, x, l.y + l.h - PX * 2, PX * 2, PX * 2,
            Math.floor(x / (PX * 2)) % 2 ? WARN.yellow : WARN.dark);
    }
    // Kolun kendisi bu sahnede hareket ediyor: drawLeverArm çiziyor
}

// Kolun kolçağı. pulled 0..1: 0 yukarıda, 1 aşağı çekilmiş.
export function drawLeverArm(ctx, pulled) {
    const l = LEVER;
    const baseX = l.x + l.w / 2 - PX;
    const topY = l.y + PX * 2;
    const travel = PX * 5;
    const y = topY + Math.round(pulled * travel / PX) * PX;
    blk(ctx, baseX, y, PX * 2, PX * 6, '#b3241f');
    blk(ctx, baseX, y, PX * 2, PX, '#e04a45');
    blk(ctx, baseX - PX, y, PX, PX * 6, '#7d1815');
}

// Sandık / kum torbası yığını
function drawCrate(ctx, c) {
    blk(ctx, c.x, c.y, c.w, c.h, '#6b5a3c');
    blk(ctx, c.x, c.y, c.w, PX, '#8a7550');
    blk(ctx, c.x, c.y + c.h - PX * 2, c.w, PX * 2, '#4a3d29');
    blk(ctx, c.x, c.y, PX, c.h, '#8a7550');
    blk(ctx, c.x + c.w - PX, c.y, PX, c.h, '#4a3d29');
    // Çapraz kuşak
    for (let i = 0; i < c.w / PX; i++) {
        dot(ctx, c.x + i * PX, c.y + PX * 2 + (i % 3) * PX, '#54452e');
    }
    ctx.globalAlpha = 0.25;
    blk(ctx, c.x - PX, c.y + c.h, c.w + PX * 2, PX, '#000000');
    ctx.globalAlpha = 1;
}

// Avlunun geneline is, yağ ve ayak izi kiri
function drawGrime(ctx) {
    for (let y = YARD.top; y <= YARD.bottom; y += PX) {
        for (let x = 0; x < WORLD.w; x += PX) {
            if (hash(x, y, 79) < 0.03) dot(ctx, x, y, '#4c5056');
        }
    }
    // Kapının önünden örgüye giden ayak izi yolu: buradan çok geçilmiş
    for (let t = 0; t <= 1; t += 0.01) {
        const px = 500 + (BREACH.x + 40 - 500) * t;
        const py = YARD.top + 20 + (FENCE.y - 40 - YARD.top - 20) * t;
        for (let i = 0; i < 14; i++) {
            const ox = (hash(t * 100, i, 83) - 0.5) * 44;
            const oy = (hash(t * 100, i, 89) - 0.5) * 16;
            if (hash(t * 100, i, 97) > 0.2) continue;
            dot(ctx, px + ox, py + oy, '#565a60');
        }
    }
}

// --- Hâli değişen çizimler (her karede) ---

// Çelik kapı. closed 0..1: 0 tamamen yukarıda, 1 tamamen inmiş.
export function drawSteelDoor(ctx, closed) {
    const d = STEEL_DOOR;
    const h = Math.round((d.h * closed) / PX) * PX;
    if (h <= 0) return;
    blk(ctx, d.x, d.y, d.w, h, STEEL.body);
    // Yatay kaburgalar
    for (let y = d.y; y < d.y + h; y += PX * 4) {
        blk(ctx, d.x, y, d.w, PX, STEEL.dark);
        blk(ctx, d.x, y + PX, d.w, PX, STEEL.light);
    }
    blk(ctx, d.x, d.y + h - PX * 2, d.w, PX * 2, STEEL.edge);
    // İnerken alt kenarında sarı-siyah şerit
    for (let x = d.x; x < d.x + d.w; x += PX * 3) {
        blk(ctx, x, d.y + h - PX, PX * 3, PX,
            Math.floor(x / (PX * 3)) % 2 ? WARN.yellow : WARN.dark);
    }
}

// Örgünün ardında biriken virüslüler. Sayı olarak tehdit ediyorlar, tek tek
// karakter değiller - yalnızca siluet.
//
// Düzenli aralıklarla dizilince çit gibi görünüyorlardı; bu yüzden aralık,
// boy ve en tek tek rastgele ve ÜST ÜSTE BİNECEK kadar sık. Arka sıralar
// koyu ve alçak, ön sıra açık ve iri: kalabalık ancak böyle derinlik kazanıyor.
export function drawCrowd(ctx, frame, pressure) {
    const ranks = 4;
    for (let rank = 0; rank < ranks; rank++) {
        const depth = (ranks - 1 - rank) / (ranks - 1);    // 1 = en arkadaki
        const baseY = CROWD.y + 2 + rank * 17 - pressure * 16 * (1 - depth);
        let x = -24 + hash(rank, 0, 127) * 30;
        let i = 0;
        while (x < WORLD.w + 24) {
            const seed = rank * 211 + i;
            const bob = Math.sin(frame * 0.06 + hash(seed, 1, 131) * 6.3) * (1 + pressure * 3);
            drawInfected(ctx, x, baseY + bob, depth, seed, frame, pressure);
            x += 16 + hash(seed, 2, 137) * 18;             // düzensiz aralık
            i++;
        }
    }
}

function drawInfected(ctx, x, y, depth, seed, frame, pressure) {
    const u = PX;
    const shade = depth > 0.66 ? INFECTED.dark : depth > 0.33 ? INFECTED.body : INFECTED.light;
    const wide = 2 + Math.floor(hash(seed, 3, 139) * 2);          // 2-3 blok yarı en
    const tall = 5 + Math.floor(hash(seed, 4, 149) * 4) - Math.round(depth * 2);
    const lean = Math.round(hash(seed, 5, 151) * 2 - 1) * u;      // omuz kayması

    // Gövde
    blk(ctx, x - u * wide + lean, y, u * wide * 2, u * tall, shade);
    // Baş: gövdeye göre biraz kaymış, hepsi aynı hizada olmasın
    const headX = x - u + Math.round(hash(seed, 6, 157) * 2 - 1) * u;
    blk(ctx, headX, y - u * 3, u * 3, u * 3, INFECTED.head);
    blk(ctx, headX, y - u * 3, u * 3, u, shade);

    // Örgüye uzanan kollar: baskı arttıkça yukarı kalkar
    const reach = Math.round(pressure * 3) * u;
    if (reach > 0 && hash(seed, 7, 163) > 0.35) {
        blk(ctx, x - u * (wide + 1) + lean, y - reach, u, u * 3 + reach, shade);
    }
    if (reach > 0 && hash(seed, 8, 167) > 0.5) {
        blk(ctx, x + u * wide + lean, y - reach + u, u, u * 3 + reach, shade);
    }

    // Gözler: yalnızca en öndeki sırada ve hepsinde değil
    if (depth <= 0.34 && hash(seed, 9, 173) > 0.45 && Math.sin(frame * 0.1 + seed) > -0.5) {
        dot(ctx, headX, y - u * 2, '#c2e04a');
        dot(ctx, headX + u * 2, y - u * 2, '#c2e04a');
    }
}

// Patlama: jeneratörün olduğu yerde alev ve kıvılcım. t 0..1
export function drawExplosion(ctx, t) {
    if (t <= 0 || t >= 1) return;
    const g = GENERATOR;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    const radius = 30 + t * 150;

    for (let i = 0; i < 200; i++) {
        const angle = hash(i, 0, 137) * Math.PI * 2;
        const dist = radius * (0.35 + hash(i, 1, 139) * 0.65);
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist * 0.7;
        const heat = 1 - dist / radius;
        const color = heat > 0.7 ? '#fff4c2' : heat > 0.45 ? '#f7a53b' : heat > 0.2 ? '#c9481c' : '#4a3128';
        ctx.globalAlpha = Math.max(0, 1 - t) * (0.4 + heat * 0.6);
        dot(ctx, px, py, color);
    }
    ctx.globalAlpha = 1;

    // Yükselen duman
    for (let i = 0; i < 70; i++) {
        const px = cx + (hash(i, 2, 141) - 0.5) * 90;
        const py = cy - t * 190 * (0.4 + hash(i, 3, 143) * 0.6);
        ctx.globalAlpha = Math.max(0, 0.6 - t * 0.5);
        dot(ctx, px, py, hash(i, 4, 149) < 0.5 ? '#3b3a40' : '#2a292f');
    }
    ctx.globalAlpha = 1;
}

// --- Avluya giren virüslü ---
// Örgünün ardındaki siluetlerden farkı: bu yakında, oyuncu boyunda ve
// vurulabiliyor. Yine yüz yok - beyinleri eridiği için yön duygusu da yok,
// sadece en yakın sıcaklığa doğru sürükleniyorlar.
export function drawIntruder(ctx, x, y, frame, seed) {
    const u = PX;
    const sway = Math.round(Math.sin(frame * 0.09 + seed) * 1) * u;

    ctx.globalAlpha = 0.3;
    blk(ctx, x - u * 4, y, u * 8, u * 2, '#000000');
    ctx.globalAlpha = 1;

    // Bacaklar
    blk(ctx, x - u * 3, y - u * 5, u * 2, u * 5, INFECTED.dark);
    blk(ctx, x + u, y - u * 5, u * 2, u * 5, INFECTED.dark);
    // Gövde
    blk(ctx, x - u * 4 + sway, y - u * 13, u * 8, u * 8, INFECTED.body);
    blk(ctx, x - u * 4 + sway, y - u * 13, u * 2, u * 8, INFECTED.light);
    blk(ctx, x + u * 2 + sway, y - u * 13, u * 2, u * 8, INFECTED.dark);
    // Sarkan kollar
    blk(ctx, x - u * 6 + sway, y - u * 12, u * 2, u * 9, INFECTED.dark);
    blk(ctx, x + u * 4 + sway, y - u * 11, u * 2, u * 9, INFECTED.dark);
    // Baş: omuzlara gömülü
    blk(ctx, x - u * 2 + sway, y - u * 17, u * 4, u * 4, INFECTED.head);
    blk(ctx, x - u * 2 + sway, y - u * 17, u * 4, u, INFECTED.light);
    dot(ctx, x - u * 2 + sway, y - u * 15, '#c2e04a');
    dot(ctx, x + u + sway, y - u * 15, '#c2e04a');
    // Kabarcıklar
    for (let i = 0; i < 6; i++) {
        const px = x - u * 4 + Math.floor(hash(seed, i, 401) * 8) * u + sway;
        const py = y - u * 13 + Math.floor(hash(seed, i, 409) * 8) * u;
        dot(ctx, px, py, hash(seed, i, 419) < 0.5 ? '#6f9a24' : '#2a4a0e');
    }
}
