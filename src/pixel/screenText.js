// Ekrana sabit yazı kartları: mekan adı ve benzeri kısa bildirimler.
// Prologda konuşma yok; anlatım çevreyle ve bu kısa yazılarla yürüyor,
// bu yüzden kart birden fazla sahnenin ortak aracı.

import { PX } from './pixelDraw.js';
import { drawPixelText, measurePixelText } from './pixelFont.js';

// Mekana girince ekranın üstünde beliren yazı. viewW ekran genişliği.
export function drawLocationTitle(ctx, text, alpha, viewW) {
    if (alpha <= 0) return;
    const scale = 4;
    const width = measurePixelText(text, scale);
    const padX = PX * 6;
    const padY = PX * 4;
    const boxW = width + padX * 2;
    const boxH = 7 * scale + padY * 2;
    const x = Math.round((viewW / 2 - boxW / 2) / PX) * PX;
    const y = PX * 10;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - PX, y - PX, boxW + PX * 2, boxH + PX * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x, y, boxW, PX);
    ctx.fillRect(x, y + boxH - PX, boxW, PX);
    drawPixelText(ctx, text, x + boxW / 2, y + padY, {
        scale,
        color: '#fef3c7',
        shadow: '#0f172a',
        align: 'center'
    });
    ctx.globalAlpha = 1;
}
