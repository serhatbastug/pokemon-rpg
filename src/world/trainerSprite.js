// Antrenör sprite'ı: çizim src/world/trainer/trainerArt.js içinde, burada
// yalnızca önbellekleme ve yürüyüş döngüsü var.
//
// PERFORMANS: karakter yüzlerce bezier + clip ile çizilir; bunu her karede
// yapmak kare hızını düşürür. Her (yön, kare, ölçek, stil) birleşimi BİR KEZ
// offscreen canvas'a çizilip saklanır, sonra tek drawImage ile kopyalanır.

import { style, renderStyleName } from '../config/renderStyle.js';
import { paintTrainer, makeBrush, H, W } from './trainer/trainerArt.js';

const SUPER = 3;              // önbellek çözünürlüğü (keskinlik için)
const FRAMES = 4;             // yürüyüş döngüsü: 0 duruş, 1 sağ, 2 duruş, 3 sol
const SWING = [0, 1, 0, -1];  // adım salınımı
const cache = new Map();

// (yön, kare, ölçek, stil) için hazır sprite
function trainerSprite(dir, frame, scale) {
    const key = `${renderStyleName()}|${dir}|${frame}|${scale}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const u = scale;
    const width = u * W;
    const height = u * (H + 0.6);
    const anchorX = width / 2;
    const anchorY = height - u * 0.3;   // ayak hizası

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * SUPER);
    canvas.height = Math.ceil(height * SUPER);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.scale(SUPER, SUPER);
    ctx.translate(anchorX, anchorY);

    // Sola bakış, sağa bakışın aynasıdır
    if (dir === 'left') ctx.scale(-1, 1);

    const s = style().trainer;
    const brush = makeBrush(ctx, u, s.lineWidth, s.tinted);
    paintTrainer(ctx, dir === 'left' ? 'right' : dir, SWING[frame], u, brush);

    const sprite = { canvas, width, height, anchorX, anchorY };
    cache.set(key, sprite);
    return sprite;
}

// Antrenörü (x, y) ayak hizasında merkezleyerek çizer.
// dir: 'down' | 'up' | 'left' | 'right'
export function drawTrainer(ctx, x, y, dir, moving, scale = 5) {
    const frame = moving ? Math.floor(Date.now() / 120) % FRAMES : 0;
    // Adım karelerinde gövde hafifçe yükselir
    const bob = moving && frame % 2 === 1 ? -scale * 0.18 : 0;
    const sprite = trainerSprite(dir, frame, scale);

    ctx.drawImage(
        sprite.canvas,
        x - sprite.anchorX,
        y - sprite.anchorY + bob,
        sprite.width,
        sprite.height
    );
}
