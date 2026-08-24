// Konuşma balonu.
//
// Dublaj yok: karakterler konuşurken harf harf yazılan bir balon açılıyor,
// her harfte kısa bir "bıt" sesi çıkıyor ve konuşanın kafası sallanıyor.
// Üçü birlikte konuşma hissini veriyor.
//
// Balon piksel ızgarasına oturur ve ekran dışına taşmaz: uzun cümle çok
// satıra bölünür, kenara yakın konuşan için balon içeri kaydırılır.

import { PX, blk } from './pixelDraw.js';
import { drawPixelText, measurePixelText } from './pixelFont.js';

const PAD = PX * 3;          // balon kenarı ile yazı arası
const LINE_GAP = PX * 2;
const GLYPH_H = 7;
const TAIL_H = PX * 3;

// Metni verilen genişliğe sığacak satırlara böler
export function wrapPixelText(text, maxWidth, scale) {
    const words = text.split(' ').filter(Boolean);
    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && measurePixelText(candidate, scale) > maxWidth) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
}

// Balonun kaplayacağı kutu. Konumlandırma sahne tarafında yapılabilsin diye
// çizimden ayrı hesaplanıyor.
export function measureBubble(lines, scale) {
    const textW = Math.max(...lines.map(line => measurePixelText(line, scale)));
    const w = textW + PAD * 2;
    const h = lines.length * GLYPH_H * scale + (lines.length - 1) * LINE_GAP + PAD * 2;
    return { w: Math.ceil(w / PX) * PX, h: Math.ceil(h / PX) * PX };
}

// Balonu (anchorX, anchorY) noktasının ÜSTÜNE çizer; kuyruk aşağı bakar.
// viewW / viewLeft verilirse balon ekranın içinde kalacak şekilde kaydırılır.
export function drawSpeechBubble(ctx, anchorX, anchorY, lines, {
    scale = 2,
    viewLeft = 0,
    viewW = null,
    fill = '#f4f1e4',
    border = '#1c1a17',
    text = '#1c1a17'
} = {}) {
    const { w, h } = measureBubble(lines, scale);
    let x = Math.round((anchorX - w / 2) / PX) * PX;
    const y = Math.round((anchorY - h - TAIL_H) / PX) * PX;

    if (viewW !== null) {
        const min = viewLeft + PX * 2;
        const max = viewLeft + viewW - w - PX * 2;
        x = Math.max(min, Math.min(max, x));
    }

    // Gövde: koyu kenarlık + açık iç
    blk(ctx, x - PX, y - PX, w + PX * 2, h + PX * 2, border);
    blk(ctx, x, y, w, h, fill);
    // Köşeler yuvarlansın diye dört köşeden birer blok silinir
    blk(ctx, x - PX, y - PX, PX, PX, fill);
    blk(ctx, x + w, y - PX, PX, PX, fill);
    blk(ctx, x - PX, y + h, PX, PX, fill);
    blk(ctx, x + w, y + h, PX, PX, fill);

    // Kuyruk: konuşana doğru inen üçgen
    const tailX = Math.round(Math.max(x + PX * 3, Math.min(x + w - PX * 5, anchorX - PX * 2)) / PX) * PX;
    for (let i = 0; i < 3; i++) {
        blk(ctx, tailX + i * PX, y + h + i * PX, PX * (3 - i), PX, border);
        if (i < 2) blk(ctx, tailX + i * PX, y + h + i * PX, PX * (2 - i), PX, fill);
    }

    // Yazı
    lines.forEach((line, i) => {
        drawPixelText(ctx, line, x + PAD, y + PAD + i * (GLYPH_H * scale + LINE_GAP), {
            scale, color: text
        });
    });

    return { x, y, w, h };
}
