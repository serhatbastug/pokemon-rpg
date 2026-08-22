// Macera modu mermi görselleri.
//
// İki dil desteklenir (bkz. config/renderStyle.js):
//   glow (painted/lineless) -> anime enerji efekti: koyu kontur YOK, doygun
//        renk + beyaz çekirdek + dışa sönen hale. Anime'de enerji saldırıları
//        ışıldar, siyah çizgiyle çevrelenmez.
//   outline (bold)          -> koyu konturlu cel-shading
// (Arena modu kendi piksel sprite'larını kullanmaya devam eder.)

import { style } from '../../config/renderStyle.js';

// Her efekt: [çekirdek(beyaza yakın), ana renk, kontur/koyu ton] + şekil
const FX = {
    leaf: { colors: ['#eaffd0', '#5ec94f', '#1e5427'], shape: 'blade' },
    petal: { colors: ['#ffe4f2', '#ff7fb0', '#a8285c'], shape: 'blade' },
    seedbomb: { colors: ['#fff2c4', '#d0a63a', '#5c3a12'], shape: 'orb' },
    ember: { colors: ['#fff3b0', '#ff8a3c', '#a02a15'], shape: 'flame' },
    fireblast: { colors: ['#fff7d6', '#ff6b2c', '#8a1f10'], shape: 'flame' },
    water: { colors: ['#e0f6ff', '#4aa8e0', '#12456e'], shape: 'orb' },
    ice: { colors: ['#ffffff', '#8fd4f5', '#1c5988'], shape: 'shard' },
    freeze: { colors: ['#ffffff', '#a5c8ff', '#1e3a8a'], shape: 'shard' },
    lightning: { colors: ['#fffbe6', '#ffd633', '#8a6410'], shape: 'bolt' },
    poison: { colors: ['#f3e8ff', '#b45cf0', '#4c1d95'], shape: 'orb' },
    shadowball: { colors: ['#e9d5ff', '#8b3fd4', '#241148'], shape: 'orb' },
    hypnosis: { colors: ['#f5d0fe', '#d24af0', '#4a044e'], shape: 'ring' },
    focusblast: { colors: ['#fff7ed', '#ff9a3c', '#8a3a10'], shape: 'orb' },
    xscissor: { colors: ['#f0fdf4', '#57d96b', '#166534'], shape: 'cross' },
    pinmissile: { colors: ['#f7fee7', '#aee63f', '#4d7c0f'], shape: 'blade' },
    signalbeam: { colors: ['#fdf4ff', '#f072f0', '#7a1a7a'], shape: 'beam' },
    laser: { colors: ['#ecfeff', '#33d6e8', '#0b5f70'], shape: 'beam' },
    sky: { colors: ['#ffffff', '#a8dcff', '#1f6ba8'], shape: 'blade' },
    wind: { colors: ['#f0fdf4', '#93efa8', '#15803d'], shape: 'blade' },
    slash: { colors: ['#ffffff', '#dbe3ec', '#4a5462'], shape: 'blade' },
    claw: { colors: ['#ecfeff', '#6fe3f0', '#0e7490'], shape: 'cross' },
    punch: { colors: ['#f5f3ff', '#a78bfa', '#3b1d80'], shape: 'orb' },
    bite: { colors: ['#ffe4e6', '#ff6b85', '#8f1030'], shape: 'cross' },
    magnetbomb: { colors: ['#f8fafc', '#9fb0c4', '#2b3542'], shape: 'orb' },
    trap: { colors: ['#f0fdf4', '#57d96b', '#14532d'], shape: 'ring' },
    storm: { colors: ['#fefce8', '#ffd633', '#7a5a0e'], shape: 'ring' },
    blizzard: { colors: ['#ffffff', '#a8dcff', '#1f6ba8'], shape: 'ring' }
};

const DEFAULT_FX = { colors: ['#ffffff', '#c2ccda', '#3d4652'], shape: 'orb' };

export function fxFor(type) {
    return FX[type] || DEFAULT_FX;
}

// Bir mermiyi enerji efekti olarak çizer
export function drawProjectileFx(ctx, projectile, radius = 15) {
    const fx = fxFor(projectile.type);
    const [core, main, outline] = fx.colors;
    const useOutline = style().fx.outline;
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const t = Date.now() / 1000;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(projectile.x, projectile.y);

    if (useOutline) {
        // Düz yarı saydam halka
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = main;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    } else {
        // Anime halesi: dışa doğru sönen katmanlar (degrade maliyeti yok)
        ctx.fillStyle = main;
        for (const [scale, alpha] of [[1.9, 0.1], [1.55, 0.16], [1.25, 0.24]]) {
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    ctx.rotate(angle);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Şeklin kenarı: bold'da koyu kontur, anime'de parlak ışık kenarı
    const rim = (width = 2.6) => {
        if (useOutline) {
            ctx.strokeStyle = outline;
            ctx.lineWidth = width;
        } else {
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = core;
            ctx.lineWidth = width * 0.55;
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    };

    // Çok katmanlı çizgi efektlerinde (şimşek, çapraz kesik) en alttaki katman
    const backLayer = useOutline ? outline : main;
    const backAlpha = useOutline ? 1 : 0.4;

    switch (fx.shape) {
        case 'blade': {
            const bladePath = (scale) => {
                ctx.beginPath();
                ctx.moveTo(radius * 1.3 * scale, 0);
                ctx.quadraticCurveTo(0, -radius * 0.6 * scale, -radius * 1.1 * scale, 0);
                ctx.quadraticCurveTo(0, radius * 0.6 * scale, radius * 1.3 * scale, 0);
            };
            bladePath(1);
            ctx.fillStyle = main;
            ctx.fill();
            rim();
            bladePath(0.5);
            ctx.fillStyle = core;
            ctx.fill();
            break;
        }
        case 'shard': {
            const shardPath = (scale) => {
                ctx.beginPath();
                ctx.moveTo(radius * 1.2 * scale, 0);
                ctx.lineTo(0, -radius * 0.7 * scale);
                ctx.lineTo(-radius * scale, 0);
                ctx.lineTo(0, radius * 0.7 * scale);
                ctx.closePath();
            };
            shardPath(1);
            ctx.fillStyle = main;
            ctx.fill();
            rim();
            shardPath(0.5);
            ctx.fillStyle = core;
            ctx.fill();
            break;
        }
        case 'flame': {
            const flicker = 1 + Math.sin(t * 22) * 0.12;
            const flamePath = (scale) => {
                ctx.beginPath();
                ctx.moveTo(radius * 1.35 * flicker * scale, 0);
                ctx.quadraticCurveTo(0, -radius * 0.95 * flicker * scale, -radius * 0.9 * scale, 0);
                ctx.quadraticCurveTo(0, radius * 0.95 * flicker * scale, radius * 1.35 * flicker * scale, 0);
            };
            flamePath(1);
            ctx.fillStyle = main;
            ctx.fill();
            rim();
            flamePath(0.55);
            ctx.fillStyle = core;
            ctx.fill();
            break;
        }
        case 'bolt': {
            const boltPath = () => {
                ctx.beginPath();
                ctx.moveTo(-radius, 0);
                ctx.lineTo(-radius * 0.2, -radius * 0.5);
                ctx.lineTo(radius * 0.15, radius * 0.35);
                ctx.lineTo(radius * 1.1, -radius * 0.15);
            };
            ctx.globalAlpha = backAlpha;
            ctx.strokeStyle = backLayer;
            ctx.lineWidth = 7;
            boltPath();
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = main;
            ctx.lineWidth = 4.2;
            boltPath();
            ctx.stroke();
            ctx.strokeStyle = core;
            ctx.lineWidth = 1.6;
            boltPath();
            ctx.stroke();
            break;
        }
        case 'cross': {
            const arms = () => {
                ctx.beginPath();
                ctx.moveTo(-radius * 0.85, -radius * 0.85);
                ctx.lineTo(radius * 0.85, radius * 0.85);
                ctx.moveTo(radius * 0.85, -radius * 0.85);
                ctx.lineTo(-radius * 0.85, radius * 0.85);
            };
            ctx.globalAlpha = backAlpha;
            ctx.strokeStyle = backLayer;
            ctx.lineWidth = radius * 0.5;
            arms();
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = main;
            ctx.lineWidth = radius * 0.34;
            arms();
            ctx.stroke();
            ctx.strokeStyle = core;
            ctx.lineWidth = radius * 0.12;
            arms();
            ctx.stroke();
            break;
        }
        case 'beam': {
            ctx.fillStyle = main;
            ctx.beginPath();
            ctx.roundRect(-radius * 1.7, -radius * 0.34, radius * 3.4, radius * 0.68, radius * 0.34);
            ctx.fill();
            rim(2.4);
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.roundRect(-radius * 1.4, -radius * 0.13, radius * 2.8, radius * 0.26, radius * 0.13);
            ctx.fill();
            break;
        }
        case 'ring': {
            ctx.rotate(-angle); // halka yön değiştirmesin
            const spin = t * 3;
            const ringArc = (r, from, to) => {
                ctx.beginPath();
                ctx.arc(0, 0, r, from, to);
                ctx.stroke();
            };
            ctx.globalAlpha = backAlpha;
            ctx.strokeStyle = backLayer;
            ctx.lineWidth = radius * 0.4;
            ringArc(radius * 0.85, spin, spin + Math.PI * 1.5);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = main;
            ctx.lineWidth = radius * 0.26;
            ringArc(radius * 0.85, spin, spin + Math.PI * 1.5);
            ctx.strokeStyle = core;
            ctx.lineWidth = radius * 0.1;
            ringArc(radius * 0.5, -spin, -spin + Math.PI * 1.2);
            break;
        }
        default: { // orb
            ctx.fillStyle = main;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            rim();
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.arc(-radius * 0.14, -radius * 0.14, radius * 0.48, 0, Math.PI * 2);
            ctx.fill();
            // Parlama lekesi
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-radius * 0.4, -radius * 0.4, radius * 0.2, radius * 0.12, -0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

// Alan etkisi halkası (uyku sporu, taç yaprağı fırtınası, şifa)
export function drawAreaFx(ctx, x, y, radius, color, alpha = 1) {
    const useOutline = style().fx.outline;
    ctx.save();

    // Düz yarı saydam dolgu
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (useOutline) {
        // Koyu kontur + düz renk halka
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = 'rgba(20, 24, 30, 0.55)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        // Anime: dışa sönen ışıklı halka
        ctx.strokeStyle = color;
        for (const [width, a] of [[7, 0.2], [4, 0.45], [2, 0.95]]) {
            ctx.globalAlpha = alpha * a;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.restore();
}
