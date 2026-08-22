// Mermiler için kare kare pixel art sprite tanımları.
// Her sprite: frames (desen dizileri), colors (karakter -> renk haritası),
// scale (piksel boyutu), frameMs (kare süresi), glow (neon parlaması),
// spin (kendi etrafında dönme hızı, rad/sn), directional (sola giderken aynalanır).
// Desenlerde '.' boş pikseldir; diğer karakterler colors haritasından renk alır.

export const PROJECTILE_SPRITES = {
    // Şövalye: Razor Leaf - dönen yaprak
    leaf: {
        scale: 3,
        spin: 6,
        glow: { color: '#22c55e', blur: 8 },
        colors: { g: '#16a34a', G: '#4ade80', w: '#dcfce7' },
        frames: [
            [
                '...gg...',
                '..gGGg..',
                '.gGGGGg.',
                'gGGwwGGg',
                '.gGGGGg.',
                '..gGGg..',
                '...gg...',
            ],
            [
                '...gg...',
                '..gGGg..',
                '.gGwwGg.',
                'gGGGGGGg',
                '.gGwwGg.',
                '..gGGg..',
                '...gg...',
            ],
        ],
    },

    // Büyücü: Ember - kor topu
    ember: {
        scale: 3,
        glow: { color: '#ff6a00', blur: 14 },
        colors: { r: '#ef4444', o: '#fb923c', y: '#fde047' },
        frames: [
            [
                '...rr...',
                '..royr..',
                '.royyor.',
                'royyyyor',
                'royyyyor',
                '.royyor.',
                '..roor..',
                '...rr...',
            ],
            [
                '...rr...',
                '..roor..',
                '.royyor.',
                'royyyyor',
                'royyyyor',
                '.royyor.',
                '..royr..',
                '...rr...',
            ],
        ],
    },

    // Büyücü: Fire Blast - dev ateş küresi
    fireblast: {
        scale: 4,
        frameMs: 100,
        glow: { color: '#ff2200', blur: 24 },
        colors: { r: '#dc2626', o: '#f97316', y: '#fde047', w: '#fff7ed' },
        frames: [
            [
                '....rrrr....',
                '..rroooorr..',
                '.rrooyyoorr.',
                '.royyyyyyor.',
                'rroyywwyyorr',
                'rooyywwyyoor',
                'rooyywwyyoor',
                'rroyywwyyorr',
                '.royyyyyyor.',
                '.rrooyyoorr.',
                '..rroooorr..',
                '....rrrr....',
            ],
            [
                '....rrrr....',
                '..rroyyorr..',
                '.rroyyyyorr.',
                '.royywwyyor.',
                'rroywwwwyorr',
                'rooywwwwyoor',
                'rooywwwwyoor',
                'rroywwwwyorr',
                '.royywwyyor.',
                '.rroyyyyorr.',
                '..rroyyorr..',
                '....rrrr....',
            ],
        ],
    },

    // Okçu: rüzgar dilimi
    wind: {
        scale: 3,
        frameMs: 80,
        directional: true,
        glow: { color: '#86efac', blur: 12 },
        colors: { G: '#86efac', w: '#f0fdf4' },
        frames: [
            [
                '.GG..GG..',
                'GGGwwGGG.',
                'wwwwwwwww',
                'GGGwwGGG.',
                '.GG..GG..',
            ],
            [
                '..GG..GG.',
                '.GGGwwGGG',
                'wwwwwwwww',
                '.GGGwwGGG',
                '..GG..GG.',
            ],
        ],
    },

    // Suikastçı: Shadow Punch - gölge yumruğu
    punch: {
        scale: 3,
        glow: { color: '#a855f7', blur: 16 },
        colors: { p: '#7e22ce', P: '#c084fc', w: '#f3e8ff' },
        frames: [
            [
                'p...p...p',
                '.p..P..p.',
                '..pPPPp..',
                '.PPwwwPP.',
                'p.PwwwP.p',
                '.PPwwwPP.',
                '..pPPPp..',
                '.p..P..p.',
                'p...p...p',
            ],
            [
                '..p.p.p..',
                '.p.PPP.p.',
                'p.PPwPP.p',
                '.PPwwwPP.',
                '.PwwwwwP.',
                '.PPwwwPP.',
                'p.PPwPP.p',
                '.p.PPP.p.',
                '..p.p.p..',
            ],
        ],
    },

    // Vampir: Bite - kapanan çene
    bite: {
        scale: 3,
        frameMs: 140,
        directional: true,
        glow: { color: '#e11d48', blur: 10 },
        colors: { r: '#e11d48', R: '#fb7185', w: '#ffe4e6' },
        frames: [
            [
                'rrrrrrrr',
                'w.w.w.w.',
                '........',
                '........',
                '........',
                '.w.w.w.w',
                'RRRRRRRR',
                '........',
            ],
            [
                '........',
                'rrrrrrrr',
                'w.w.w.w.',
                '.w.w.w.w',
                'RRRRRRRR',
                '........',
                '........',
                '........',
            ],
        ],
    },

    // Vampir: Toxic Fang - zehir balonu
    poison: {
        scale: 3,
        glow: { color: '#10b981', blur: 12 },
        colors: { d: '#064e3b', g: '#10b981', G: '#34d399', w: '#d1fae5' },
        frames: [
            [
                '..ddd..',
                '.dgggd.',
                'dgGGwgd',
                'dgGwwgd',
                'dggggGd',
                '.dgggd.',
                '..ddd..',
            ],
            [
                '..ddd..',
                '.dgggd.',
                'dgwwGgd',
                'dgGGGgd',
                'dgggggd',
                '.dgGgd.',
                '..ddd..',
            ],
        ],
    },

    // Ninja: Slash - hız çizgisi
    slash: {
        scale: 3,
        frameMs: 70,
        directional: true,
        glow: { color: '#94a3b8', blur: 8 },
        colors: { w: '#f8fafc', s: '#94a3b8' },
        frames: [
            [
                '.......ws',
                '......ws.',
                '.....ws..',
                '....ws...',
                '...ws....',
                '..ws.....',
                '.ws......',
                'ws.......',
                's........',
            ],
            [
                '......wws',
                '.....wws.',
                '....wws..',
                '...wws...',
                '..wws....',
                '.wws.....',
                'wws......',
                'ws.......',
                's........',
            ],
        ],
    },

    // Buz Şövalyesi: Ice Shard - buz kristali
    ice: {
        scale: 3,
        glow: { color: '#38bdf8', blur: 12 },
        colors: { b: '#0ea5e9', B: '#7dd3fc', w: '#e0f2fe' },
        frames: [
            [
                '...b...',
                '..bBb..',
                '.bBwBb.',
                'bBwwwBb',
                '.bBwBb.',
                '..bBb..',
                '...b...',
            ],
            [
                '...b...',
                '..bwb..',
                '.bBBBb.',
                'bwBwBwb',
                '.bBBBb.',
                '..bwb..',
                '...b...',
            ],
        ],
    },

    // Buz Şövalyesi: Sheer Cold - büyük dondurucu kristal
    freeze: {
        scale: 4,
        glow: { color: '#38bdf8', blur: 18 },
        colors: { b: '#0ea5e9', B: '#7dd3fc', w: '#e0f2fe' },
        frames: [
            [
                '....b....',
                '...bBb...',
                '.b.bBb.b.',
                '..bBwBb..',
                'bBBwwwBBb',
                '..bBwBb..',
                '.b.bBb.b.',
                '...bBb...',
                '....b....',
            ],
            [
                '....w....',
                '...bBb...',
                '.w.bBb.w.',
                '..bBBBb..',
                'wBBwwwBBw',
                '..bBBBb..',
                '.w.bBb.w.',
                '...bBb...',
                '....w....',
            ],
        ],
    },

    // Şövalye: Seed Bomb - filizli tohum bombası
    seedbomb: {
        scale: 3,
        glow: { color: '#65a30d', blur: 10 },
        colors: { b: '#78350f', B: '#a16207', g: '#22c55e', w: '#fef9c3' },
        frames: [
            [
                '...w...',
                '..gg...',
                '.bBBb..',
                'bBBBBb.',
                'bBBbBb.',
                'bBBBBb.',
                '.bbbb..',
            ],
            [
                '..g....',
                '..gg...',
                '.bBBb..',
                'bBBBBb.',
                'bBbBBb.',
                'bBBBBb.',
                '.bbbb..',
            ],
        ],
    },

    // Mecha: Magnet Bomb - kutuplu çelik küre
    magnetbomb: {
        scale: 3,
        frameMs: 100,
        glow: { color: '#94a3b8', blur: 12 },
        colors: { s: '#64748b', S: '#e2e8f0', r: '#ef4444', u: '#3b82f6', w: '#ffffff' },
        frames: [
            [
                'w.rrrr..',
                '.rssssr.',
                'ssssSSss',
                'sSSSSSss',
                'ssSSSSss',
                'ssssssss',
                '.ussssu.',
                '..uuuu.w',
            ],
            [
                '..rrrr.w',
                '.rssssr.',
                'ssSSssss',
                'sSSSSsss',
                'ssSSSsss',
                'ssssssss',
                '.ussssu.',
                'w.uuuu..',
            ],
        ],
    },

    // Ninja: X-Scissor - X biçimli enerji kesiği
    xscissor: {
        scale: 3,
        frameMs: 90,
        glow: { color: '#22c55e', blur: 14 },
        colors: { g: '#22c55e', G: '#86efac', w: '#ffffff' },
        frames: [
            [
                'Gg.....gG',
                'gGg...gGg',
                '.gGg.gGg.',
                '..gGwGg..',
                '...www...',
                '..gGwGg..',
                '.gGg.gGg.',
                'gGg...gGg',
                'Gg.....gG',
            ],
            [
                'Gw.....wG',
                'wGg...gGw',
                '.gGw.wGg.',
                '..wGwGw..',
                '...www...',
                '..wGwGw..',
                '.gGw.wGg.',
                'wGg...gGw',
                'Gw.....wG',
            ],
        ],
    },

    // Mecha: Signal Beam - böcek tipi sinyal ışını
    signalbeam: {
        scale: 3,
        frameMs: 70,
        directional: true,
        glow: { color: '#ec4899', blur: 14 },
        colors: { p: '#ec4899', g: '#84cc16', w: '#ffffff' },
        frames: [
            [
                '.pp.gg.pp.',
                'pggpwwpggp',
                'wwwwwwwwww',
                'pggpwwpggp',
                '.pp.gg.pp.',
            ],
            [
                'pp.gg.pp.g',
                'ggpwwpggpw',
                'wwwwwwwwww',
                'ggpwwpggpw',
                'pp.gg.pp.g',
            ],
        ],
    },
};

// Deseni (x, y) merkezli çizer. opts.angle döndürür, opts.flip yatay aynalar.
export function drawPixelSprite(ctx, def, x, y, opts = {}) {
    const frames = def.frames;
    const frame = frames[Math.floor(Date.now() / (def.frameMs || 120)) % frames.length];
    const scale = def.scale || 3;
    const rows = frame.length;
    const cols = frame[0].length;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (opts.angle) ctx.rotate(opts.angle);
    if (opts.flip) ctx.scale(-1, 1);
    if (def.glow) {
        ctx.shadowBlur = def.glow.blur;
        ctx.shadowColor = def.glow.color;
    }

    const ox = -cols * scale / 2;
    const oy = -rows * scale / 2;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const color = def.colors[frame[r][c]];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
        }
    }

    ctx.restore();
}
