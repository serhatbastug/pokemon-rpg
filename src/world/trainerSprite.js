// Antrenör karakteri (PokeAPI'de antrenör görseli yok, elle çiziyoruz).
// ANIME tarzı: degrade yok - düz renk alanları, sert kenarlı gölge bantları
// ve koyu konturlar.
//
// PERFORMANS: cel-shading çok sayıda fill/stroke/clip gerektirir; bunu her
// karede yapmak kare hızını düşürür. Bu yüzden her (yön, yürüyüş karesi)
// birleşimi BİR KEZ offscreen canvas'a çizilip önbelleğe alınır, sonra tek
// drawImage ile ekrana kopyalanır - klasik sprite sheet mantığı.

const C = {
    outline: '#241a2e',
    skin: '#ffd7ae', skinShade: '#e0ab7d',
    hair: '#3a2415',
    cap: '#ef4444', capShade: '#b91c1c', capFront: '#f8fafc',
    jacket: '#3b82f6', jacketShade: '#1d4ed8', jacketTrim: '#f8fafc',
    jeans: '#2f4f7a', jeansShade: '#22385a',
    shoe: '#e5e7eb', shoeShade: '#9ca3af'
};

const SUPER = 2;              // önbellek çözünürlüğü (keskinlik için)
const FRAMES = 2;             // yürüyüş döngüsü kare sayısı
const cache = new Map();

// Düz dolgu + koyu kontur (anime temel birimi)
function shape(ctx, pathFn, fill, lineWidth) {
    pathFn();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
}

// Şeklin içine sert kenarlı gölge bandı
function shadeInside(ctx, pathFn, color, x, y, w, h) {
    ctx.save();
    pathFn();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
}

// Tek bir kareyi çizer. Kaynak (0,0) ayakların ortasıdır.
function paintTrainer(ctx, dir, frame, u) {
    const swing = frame === 0 ? 0 : 1;      // 2 karelik yürüyüş döngüsü
    const stride = swing ? u * 0.8 : 0;
    const armSwing = swing ? u * 0.7 : 0;
    const side = dir === 'left' || dir === 'right';
    const back = dir === 'up';

    ctx.lineJoin = 'round';

    // --- Bacaklar ---
    const legY = -u * 3.4;
    const legH = u * 3.1;
    for (const [lx, offset, color] of [
        [-u * 1.35, -stride * 0.3, C.jeansShade],
        [u * 0.25, stride * 0.3, C.jeans]
    ]) {
        shape(ctx, () => {
            ctx.beginPath();
            ctx.roundRect(lx + offset, legY, u * 1.1, legH, u * 0.28);
        }, color, u * 0.36);
    }

    // Ayakkabılar
    for (const [sx, offset] of [[-u * 1.5, -stride * 0.3], [u * 0.15, stride * 0.3]]) {
        const shoePath = () => {
            ctx.beginPath();
            ctx.roundRect(sx + offset, -u * 0.62, u * 1.45, u * 0.72, u * 0.3);
        };
        shape(ctx, shoePath, C.shoe, u * 0.34);
        shadeInside(ctx, shoePath, C.shoeShade, sx + offset, -u * 0.25, u * 1.5, u * 0.4);
    }

    // --- Gövde (ceket) ---
    const torsoY = -u * 7.6;
    const torsoH = u * 4.4;
    const torsoPath = () => {
        ctx.beginPath();
        ctx.roundRect(-u * 1.95, torsoY, u * 3.9, torsoH, [u * 1.2, u * 1.2, u * 0.5, u * 0.5]);
    };
    shape(ctx, torsoPath, C.jacket, u * 0.4);
    shadeInside(ctx, torsoPath, C.jacketShade, u * 0.35, torsoY, u * 2, torsoH);

    // Ceket önü: beyaz düz bant
    if (!back) {
        shadeInside(ctx, torsoPath, C.jacketTrim, -u * 0.32, torsoY, u * 0.64, torsoH);
        ctx.strokeStyle = C.outline;
        ctx.lineWidth = u * 0.16;
        ctx.beginPath();
        ctx.moveTo(0, torsoY + u * 0.4);
        ctx.lineTo(0, torsoY + torsoH - u * 0.3);
        ctx.stroke();
    }

    // --- Kollar ---
    for (const [ax, sw, color] of [
        [-u * 2.85, -armSwing * 0.5, C.jacketShade],
        [u * 1.85, armSwing * 0.5, C.jacket]
    ]) {
        shape(ctx, () => {
            ctx.beginPath();
            ctx.roundRect(ax, torsoY + u * 0.7 + sw, u * 1, u * 2.9, u * 0.45);
        }, color, u * 0.34);
    }

    // Eller
    for (const [hx, sw] of [[-u * 2.35, -armSwing * 0.5], [u * 2.35, armSwing * 0.5]]) {
        ctx.beginPath();
        ctx.arc(hx, torsoY + u * 3.5 + sw, u * 0.52, 0, Math.PI * 2);
        ctx.fillStyle = C.skin;
        ctx.fill();
        ctx.strokeStyle = C.outline;
        ctx.lineWidth = u * 0.3;
        ctx.stroke();
    }

    // --- Baş ---
    const headY = -u * 9.5;
    const headR = u * 1.85;

    ctx.fillStyle = C.skinShade;
    ctx.fillRect(-u * 0.45, headY + headR * 0.55, u * 0.9, u * 0.9);

    const headPath = () => {
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
    };
    shape(ctx, headPath, C.skin, u * 0.4);
    shadeInside(ctx, headPath, C.skinShade, headR * 0.35, headY - headR, headR * 1.2, headR * 2);

    // Saç: düz koyu kütle
    ctx.save();
    headPath();
    ctx.clip();
    ctx.fillStyle = C.hair;
    if (back) {
        ctx.fillRect(-headR, headY - headR, headR * 2, headR * 2);
    } else {
        ctx.beginPath();
        ctx.moveTo(-headR, headY + headR * 0.1);
        ctx.quadraticCurveTo(-headR * 0.5, headY - headR * 0.7, 0, headY - headR * 0.55);
        ctx.quadraticCurveTo(headR * 0.6, headY - headR * 0.75, headR, headY + headR * 0.05);
        ctx.lineTo(headR, headY - headR);
        ctx.lineTo(-headR, headY - headR);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();

    // Anime gözleri
    if (!back) {
        const eyeR = u * 0.26;
        ctx.fillStyle = '#1f2430';
        if (side) {
            ctx.beginPath();
            ctx.ellipse(headR * 0.45, headY + headR * 0.1, eyeR * 0.8, eyeR * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            for (const ex of [-headR * 0.4, headR * 0.4]) {
                ctx.fillStyle = '#1f2430';
                ctx.beginPath();
                ctx.ellipse(ex, headY + headR * 0.1, eyeR * 0.85, eyeR * 1.25, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(ex + eyeR * 0.3, headY - eyeR * 0.2, eyeR * 0.28, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.strokeStyle = '#8a4a3a';
            ctx.lineWidth = u * 0.18;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-headR * 0.15, headY + headR * 0.5);
            ctx.lineTo(headR * 0.15, headY + headR * 0.5);
            ctx.stroke();
        }
    }

    // --- Şapka ---
    const capY = headY - headR * 0.3;
    const capPath = () => {
        ctx.beginPath();
        ctx.arc(0, capY, headR * 1.05, Math.PI, Math.PI * 2);
        ctx.closePath();
    };
    shape(ctx, capPath, C.cap, u * 0.4);
    shadeInside(ctx, capPath, C.capShade, headR * 0.3, capY - headR * 1.2, headR * 1.2, headR * 1.3);

    // Siperlik
    shape(ctx, () => {
        ctx.beginPath();
        if (back) ctx.ellipse(0, capY - headR * 0.55, headR * 0.9, headR * 0.28, 0, 0, Math.PI * 2);
        else if (side) ctx.ellipse(headR * 0.9, capY + u * 0.1, headR * 0.9, headR * 0.26, 0.08, 0, Math.PI * 2);
        else ctx.ellipse(0, capY + u * 0.22, headR * 1.2, headR * 0.32, 0, 0, Math.PI * 2);
    }, C.capShade, u * 0.34);

    // Şapka amblemi: küçük pokeball
    if (!back) {
        const ex = side ? headR * 0.3 : 0;
        const ey = capY - headR * 0.45;
        const emblemPath = () => {
            ctx.beginPath();
            ctx.arc(ex, ey, u * 0.45, 0, Math.PI * 2);
        };
        shape(ctx, emblemPath, C.capFront, u * 0.22);
        shadeInside(ctx, emblemPath, C.cap, ex - u * 0.5, ey - u * 0.5, u, u * 0.5);
    }
}

// (yön, kare, ölçek) için hazır sprite; ilk istekte çizilip saklanır
function trainerSprite(dir, frame, scale) {
    const key = `${dir}|${frame}|${scale}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const u = scale;
    const width = u * 8;
    const height = u * 13;
    const anchorX = width / 2;
    const anchorY = height - u * 1.2; // ayak hizası

    const canvas = document.createElement('canvas');
    canvas.width = width * SUPER;
    canvas.height = height * SUPER;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.scale(SUPER, SUPER);
    ctx.translate(anchorX, anchorY);

    // Sola bakış, sağa bakışın aynası olarak çizilir
    if (dir === 'left') ctx.scale(-1, 1);
    paintTrainer(ctx, dir, frame, u);

    const sprite = { canvas, width, height, anchorX, anchorY };
    cache.set(key, sprite);
    return sprite;
}

// Antrenörü (x, y) ayak hizasında merkezleyerek çizer.
// dir: 'down' | 'up' | 'left' | 'right'
export function drawTrainer(ctx, x, y, dir, moving, scale = 5) {
    const frame = moving ? Math.floor(Date.now() / 150) % FRAMES : 0;
    const bob = moving && frame === 1 ? -scale * 0.3 : 0;
    const sprite = trainerSprite(dir, frame, scale);

    ctx.drawImage(
        sprite.canvas,
        x - sprite.anchorX,
        y - sprite.anchorY + bob,
        sprite.width,
        sprite.height
    );
}
