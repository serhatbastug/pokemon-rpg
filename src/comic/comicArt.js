// Çizgi roman sayfası: kare çerçevesi, anlatıcı kutusu, ilerletme işareti,
// bölüm başlığı kartı ve kare çizimlerinin haritası.
//
// Kareler tam ekran geliyor - sayfada tek çerçeve var, içi o karenin çizimi.
// Çerçeve de PX ızgarasına oturuyor: yumuşak kenarlı tek bir çizgi bile
// karenin piksel dilini bozuyor.

import { PX, blk } from '../pixel/pixelDraw.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { PAGE, AREA, MARGIN, PAGE_BG, INK_COLOR, PAPER, fill, clamp01, easeOut } from './comicKit.js';
import { CHAPTER_1_ART } from './art/chapter1.js';
import { CHAPTER_2_ART } from './art/chapter2.js';
import { CHAPTER_3_ART } from './art/chapter3.js';
import { CHAPTER_4_ART } from './art/chapter4.js';
import { CHAPTER_5_ART } from './art/chapter5.js';

export { PAGE, AREA } from './comicKit.js';

// --- Sayfa ---

// Sayfanın zemini ve karenin çerçevesi. Kare çiziminden ÖNCE çağrılır.
export function drawPage(ctx) {
    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, PAGE.w, PAGE.h);
    blk(ctx, MARGIN, MARGIN, PAGE.w - MARGIN * 2, PAGE.h - MARGIN * 2, INK_COLOR);
}

// Çerçevenin iç hattı ve köşe çentikleri. Kare çiziminden SONRA çağrılır ki
// çizim çerçevenin üstüne taşmasın.
export function drawFrameEdge(ctx) {
    const { x, y, w, h } = AREA;
    blk(ctx, x, y, w, PX, '#0f0d0c');
    blk(ctx, x, y + h - PX, w, PX, '#0f0d0c');
    blk(ctx, x, y, PX, h, '#0f0d0c');
    blk(ctx, x + w - PX, y, PX, h, '#0f0d0c');
    for (const [cx, cy] of [[x, y], [x + w - PX * 3, y], [x, y + h - PX * 3], [x + w - PX * 3, y + h - PX * 3]]) {
        blk(ctx, cx, cy, PX * 3, PX, INK_COLOR);
        blk(ctx, cx, cy, PX, PX * 3, INK_COLOR);
    }
}

// Anlatıcı kutusu: karenin sol üstünde, kâğıt renginde, mürekkep kenarlı.
// Uzun cümle karenin genişliğini aşarsa ölçek küçülüyor - kutu taşmıyor.
export function drawCaption(ctx, text, { scale = 2 } = {}) {
    if (!text) return;
    const pad = PX * 2;
    const maxW = AREA.w - PX * 10;
    let size = scale;
    while (size > 1 && measurePixelText(text, size) + pad * 2 > maxW) size--;

    const w = measurePixelText(text, size) + pad * 2;
    const h = 7 * size + pad * 2;
    const x = AREA.x + PX * 3;
    const y = AREA.y + PX * 3;

    blk(ctx, x - PX, y - PX, w + PX * 2, h + PX * 2, INK_COLOR);
    blk(ctx, x, y, w, h, PAPER);
    drawPixelText(ctx, text, x + pad, y + pad, { scale: size, color: '#1c1a17' });
}

// İlerletme işareti: kare bitip oyuncu beklenirken sağ altta yanıp söner
export function drawPrompt(ctx, frame) {
    if (Math.floor(frame / 20) % 2 === 0) return;
    const x = AREA.x + AREA.w - PX * 9;
    const y = AREA.y + AREA.h - PX * 8;
    for (let i = 0; i < 4; i++) blk(ctx, x + i * PX, y + i * PX, PX, PX * (7 - i * 2), PAPER);
}

// Bölüm başlığı kartı: kare değil, sayfanın kendisi
export function drawTitleCard(ctx, chapter, t) {
    ctx.fillStyle = PAGE_BG;
    ctx.fillRect(0, 0, PAGE.w, PAGE.h);
    if (!chapter) return;

    const cx = PAGE.w / 2;
    const lineW = Math.round((PAGE.w * 0.46) * easeOut(clamp01(t)) / PX) * PX;
    drawPixelText(ctx, `${chapter.n}. BOLUM`, cx, 186, { scale: 3, color: '#6f6a60', align: 'center' });
    drawPixelText(ctx, chapter.title, cx, 236, { scale: 7, color: PAPER, align: 'center' });
    blk(ctx, cx - lineW / 2, 322, lineW, PX, '#3a352e');
    if (chapter.subtitle) {
        drawPixelText(ctx, chapter.subtitle, cx, 350, { scale: 2, color: '#6f6a60', align: 'center' });
    }
}

// Karenin açılma sönümü: siyahtan açılır
export function drawFade(ctx, alpha) {
    if (alpha >= 1) return;
    ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
    ctx.fillRect(0, 0, PAGE.w, PAGE.h);
}

// --- Kare çizimleri ---

export const PANEL_ART = {
    ...CHAPTER_1_ART,
    ...CHAPTER_2_ART,
    ...CHAPTER_3_ART,
    ...CHAPTER_4_ART,
    ...CHAPTER_5_ART
};

// Bir kareyi çizer. Bilinmeyen anahtar sessiz boş kare bırakmasın diye
// ortasına anahtarın adı yazılıyor (geliştirme sırasında görünür hata).
export function drawPanelArt(ctx, panel, t) {
    const art = PANEL_ART[panel.art];
    if (!art) {
        fill(ctx, '#1a1d21');
        drawPixelText(ctx, `? ${panel.art}`, AREA.x + AREA.w / 2, AREA.y + AREA.h / 2, {
            scale: 3, color: '#b04a3a', align: 'center'
        });
        return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(AREA.x, AREA.y, AREA.w, AREA.h);
    ctx.clip();
    art(ctx, AREA, t);
    ctx.restore();
}
