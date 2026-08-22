// Macera modu mermi görselleri: piksel sprite değil, degrade ve parıltıyla
// çizilen yumuşak enerji efektleri. Sprite anahtarı (leaf, ember, ...) burada
// bir renk paletine ve şekle eşlenir.
// (Arena modu kendi piksel sprite'larını kullanmaya devam eder.)

// Her efekt: [çekirdek, orta, dış] renkleri + şekil
const FX = {
    leaf: { colors: ['#eaffd0', '#7bd94f', '#2f7d2f'], shape: 'blade', trail: '#7bd94f' },
    petal: { colors: ['#ffe4f2', '#f472b6', '#be185d'], shape: 'blade', trail: '#f472b6' },
    seedbomb: { colors: ['#fff2c4', '#c9a227', '#5c3a12'], shape: 'orb', trail: '#c9a227' },
    ember: { colors: ['#fff3b0', '#fb923c', '#b91c1c'], shape: 'flame', trail: '#fb923c' },
    fireblast: { colors: ['#fff7d6', '#f97316', '#991b1b'], shape: 'flame', trail: '#f97316' },
    water: { colors: ['#e0f6ff', '#38bdf8', '#0c4a6e'], shape: 'orb', trail: '#38bdf8' },
    ice: { colors: ['#ffffff', '#7dd3fc', '#0369a1'], shape: 'shard', trail: '#7dd3fc' },
    freeze: { colors: ['#ffffff', '#93c5fd', '#1e40af'], shape: 'shard', trail: '#93c5fd' },
    lightning: { colors: ['#fffbe6', '#facc15', '#a16207'], shape: 'bolt', trail: '#facc15' },
    poison: { colors: ['#f3e8ff', '#a855f7', '#4c1d95'], shape: 'orb', trail: '#a855f7' },
    shadowball: { colors: ['#e9d5ff', '#7e22ce', '#1e1b4b'], shape: 'orb', trail: '#7e22ce' },
    hypnosis: { colors: ['#f5d0fe', '#c026d3', '#4a044e'], shape: 'ring', trail: '#c026d3' },
    focusblast: { colors: ['#fff7ed', '#fb923c', '#9a3412'], shape: 'orb', trail: '#fb923c' },
    xscissor: { colors: ['#f0fdf4', '#4ade80', '#166534'], shape: 'cross', trail: '#4ade80' },
    pinmissile: { colors: ['#f7fee7', '#a3e635', '#4d7c0f'], shape: 'blade', trail: '#a3e635' },
    signalbeam: { colors: ['#fdf4ff', '#e879f9', '#86198f'], shape: 'beam', trail: '#e879f9' },
    laser: { colors: ['#ecfeff', '#22d3ee', '#0e7490'], shape: 'beam', trail: '#22d3ee' },
    sky: { colors: ['#ffffff', '#bae6fd', '#0284c7'], shape: 'blade', trail: '#bae6fd' },
    wind: { colors: ['#f0fdf4', '#86efac', '#15803d'], shape: 'blade', trail: '#86efac' },
    slash: { colors: ['#ffffff', '#e2e8f0', '#64748b'], shape: 'blade', trail: '#e2e8f0' },
    claw: { colors: ['#ecfeff', '#67e8f9', '#0e7490'], shape: 'cross', trail: '#67e8f9' },
    punch: { colors: ['#f5f3ff', '#a78bfa', '#4c1d95'], shape: 'orb', trail: '#a78bfa' },
    bite: { colors: ['#ffe4e6', '#fb7185', '#9f1239'], shape: 'cross', trail: '#fb7185' },
    magnetbomb: { colors: ['#f8fafc', '#94a3b8', '#334155'], shape: 'orb', trail: '#94a3b8' },
    trap: { colors: ['#f0fdf4', '#4ade80', '#14532d'], shape: 'ring', trail: '#4ade80' },
    storm: { colors: ['#fefce8', '#facc15', '#854d0e'], shape: 'ring', trail: '#facc15' },
    blizzard: { colors: ['#ffffff', '#bae6fd', '#0369a1'], shape: 'ring', trail: '#bae6fd' }
};

const DEFAULT_FX = { colors: ['#ffffff', '#cbd5e1', '#475569'], shape: 'orb', trail: '#cbd5e1' };

export function fxFor(type) {
    return FX[type] || DEFAULT_FX;
}

// Bir mermiyi yumuşak enerji efekti olarak çizer
export function drawProjectileFx(ctx, projectile, radius = 15) {
    const fx = fxFor(projectile.type);
    const [core, mid, outer] = fx.colors;
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const t = Date.now() / 1000;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(projectile.x, projectile.y);

    // Dış parıltı (her şekil için ortak)
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.8);
    glow.addColorStop(0, hexAlpha(mid, 0.55));
    glow.addColorStop(1, hexAlpha(mid, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);

    switch (fx.shape) {
        case 'blade': {
            // İnce, uçları sivri enerji dilimi
            const g = ctx.createLinearGradient(-radius, 0, radius, 0);
            g.addColorStop(0, hexAlpha(outer, 0.2));
            g.addColorStop(0.5, mid);
            g.addColorStop(1, core);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(radius * 1.25, 0);
            ctx.quadraticCurveTo(0, -radius * 0.55, -radius * 1.1, 0);
            ctx.quadraticCurveTo(0, radius * 0.55, radius * 1.25, 0);
            ctx.fill();
            break;
        }
        case 'shard': {
            const g = ctx.createLinearGradient(-radius, -radius, radius, radius);
            g.addColorStop(0, core);
            g.addColorStop(1, outer);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(radius * 1.2, 0);
            ctx.lineTo(0, -radius * 0.7);
            ctx.lineTo(-radius, 0);
            ctx.lineTo(0, radius * 0.7);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = hexAlpha(core, 0.9);
            ctx.lineWidth = 1.5;
            ctx.stroke();
            break;
        }
        case 'flame': {
            // Titreşen alev dili
            const flicker = 1 + Math.sin(t * 22) * 0.12;
            const g = ctx.createRadialGradient(-radius * 0.2, 0, 0, 0, 0, radius * flicker);
            g.addColorStop(0, core);
            g.addColorStop(0.45, mid);
            g.addColorStop(1, hexAlpha(outer, 0.15));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(radius * 1.3 * flicker, 0);
            ctx.quadraticCurveTo(0, -radius * 0.9 * flicker, -radius * 0.9, 0);
            ctx.quadraticCurveTo(0, radius * 0.9 * flicker, radius * 1.3 * flicker, 0);
            ctx.fill();
            break;
        }
        case 'bolt': {
            ctx.strokeStyle = core;
            ctx.lineWidth = 3.5;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 14;
            ctx.shadowColor = mid;
            ctx.beginPath();
            ctx.moveTo(-radius, 0);
            ctx.lineTo(-radius * 0.2, -radius * 0.5);
            ctx.lineTo(radius * 0.15, radius * 0.35);
            ctx.lineTo(radius * 1.1, -radius * 0.15);
            ctx.stroke();
            break;
        }
        case 'cross': {
            const g = ctx.createLinearGradient(-radius, -radius, radius, radius);
            g.addColorStop(0, mid);
            g.addColorStop(0.5, core);
            g.addColorStop(1, mid);
            ctx.strokeStyle = g;
            ctx.lineWidth = radius * 0.35;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 12;
            ctx.shadowColor = outer;
            ctx.beginPath();
            ctx.moveTo(-radius * 0.8, -radius * 0.8);
            ctx.lineTo(radius * 0.8, radius * 0.8);
            ctx.moveTo(radius * 0.8, -radius * 0.8);
            ctx.lineTo(-radius * 0.8, radius * 0.8);
            ctx.stroke();
            break;
        }
        case 'beam': {
            const g = ctx.createLinearGradient(-radius * 1.6, 0, radius * 1.6, 0);
            g.addColorStop(0, hexAlpha(outer, 0));
            g.addColorStop(0.35, mid);
            g.addColorStop(0.6, core);
            g.addColorStop(1, hexAlpha(mid, 0.2));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect(-radius * 1.6, -radius * 0.32, radius * 3.2, radius * 0.64, radius * 0.32);
            ctx.fill();
            break;
        }
        case 'ring': {
            ctx.rotate(-angle); // halka dönmesin
            ctx.strokeStyle = mid;
            ctx.lineWidth = radius * 0.28;
            ctx.shadowBlur = 14;
            ctx.shadowColor = mid;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.85, t * 3, t * 3 + Math.PI * 1.5);
            ctx.stroke();
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.5, -t * 4, -t * 4 + Math.PI * 1.2);
            ctx.stroke();
            break;
        }
        default: { // orb
            const g = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
            g.addColorStop(0, core);
            g.addColorStop(0.5, mid);
            g.addColorStop(1, outer);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            // Parlama noktası
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-radius * 0.32, -radius * 0.32, radius * 0.22, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.restore();
}

// Alan etkisi halkası (uyku sporu, taç yaprağı fırtınası, şifa)
export function drawAreaFx(ctx, x, y, radius, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const g = ctx.createRadialGradient(x, y, radius * 0.25, x, y, radius);
    g.addColorStop(0, hexAlpha(color, 0));
    g.addColorStop(0.75, hexAlpha(color, 0.28));
    g.addColorStop(1, hexAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hexAlpha(color, 0.8);
    ctx.lineWidth = 3;
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

// #rrggbb -> rgba(...)
function hexAlpha(hex, alpha) {
    const value = hex.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
