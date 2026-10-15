// Konuşanın portresi: balonla birlikte ekranın köşesinde çıkan çerçeveli yüz.
//
// 20x20'lik bir ızgara, birim 5 piksel. Palet charSprites.js'teki LOOKS'tan
// gelir, böylece portre sahnedeki karakterle aynı renkte olur. Konuşurken ağız
// açılıp kapanır. İçerideki ses (ses) insan değil: yüzsüz, parlayan gözlü bir
// siluet.

import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { LOOKS } from './charSprites.js';

const U = 5;
const GRID = 20;

export const PORTRAIT = { w: GRID * U + 12, h: GRID * U + 12 + 26 };

const LOOK_OF = {
    biz: 'harry',
    arkadas: 'fred',
    andrew: 'andrew',
    'saglikli-0': 'saglikli0',
    'saglikli-1': 'saglikli1',
    'saglikli-2': 'saglikli2'
};

export const PORTRAIT_NAMES = {
    biz: 'HARRY',
    arkadas: 'FRED',
    andrew: 'ANDREW',
    ses: 'SES',
    'saglikli-0': 'YARDIMCI',
    'saglikli-1': 'YARDIMCI',
    'saglikli-2': 'YARDIMCI'
};

const EYE = '#20242a';
const BAND = '#ea7317';
const GREEN = '#6f9a2c';

// (x, y) çerçevenin sol üst köşesi
export function drawPortrait(ctx, speaker, x, y, { talking = false, tick = 0 } = {}) {
    const name = PORTRAIT_NAMES[speaker] || '';
    const isVoice = speaker === 'ses';
    const ox = x + 6, oy = y + 6;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = isVoice ? '#6bdc5a' : '#e2e8f0';
    ctx.fillRect(x, y, PORTRAIT.w, PORTRAIT.h);
    ctx.fillStyle = isVoice ? '#0b1608' : '#1b2433';
    ctx.fillRect(x + 3, y + 3, PORTRAIT.w - 6, PORTRAIT.h - 6);

    const r = (c, rw, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(ox + c * U, oy + rw * U, w * U, h * U);
    };
    // Arka plan: alt yarıda hafif aydınlık
    r(0, 0, GRID, GRID, isVoice ? '#0e1d0a' : '#26324a');
    r(0, 14, GRID, 6, isVoice ? '#122410' : '#1f2a3d');

    const mouthOpen = talking && Math.floor(tick / 5) % 2 === 0;

    if (isVoice) {
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.2);
        // Gövde ve kafa: koyu yeşil siluet, tepede sivri çıkıntılar
        r(2, 15, 16, 5, '#142a0c');
        r(8, 13, 4, 3, '#142a0c');
        r(5, 3, 10, 11, '#1a3610');
        r(5, 3, 2, 11, '#112509');
        r(4, 5, 1, 6, '#1a3610');
        r(15, 5, 1, 6, '#1a3610');
        for (const c of [5, 8, 11, 14]) r(c, 1, 1, 2, '#1a3610');
        r(7, 0, 1, 3, '#1a3610');
        r(12, 0, 1, 3, '#1a3610');
        // Gözler: parlayan, hafif eğik
        ctx.globalAlpha = 0.25 + 0.2 * pulse;
        r(5, 6, 4, 4, '#9dff6a');
        r(11, 6, 4, 4, '#9dff6a');
        ctx.globalAlpha = 1;
        r(6, 8, 3, 1, '#9dff6a');
        r(7, 7, 2, 1, '#9dff6a');
        r(11, 8, 3, 1, '#9dff6a');
        r(11, 7, 2, 1, '#9dff6a');
        // Ağız: dişli yarık
        r(6, 11, 8, mouthOpen ? 3 : 1, '#9dff6a');
        if (mouthOpen) {
            for (const c of [7, 9, 11, 13]) r(c, 11, 1, 1, '#0b1608');
        }
        // Damarlar
        r(7, 12, 1, 2, '#2f5312');
        r(12, 12, 1, 2, '#2f5312');
    } else {
        const look = LOOKS[LOOK_OF[speaker]] || LOOKS.harry;
        const { hair, skin, skinShade, coat, coatShade } = look;
        // Omuzlar, yaka, boyun
        r(2, 15, 16, 5, coat);
        r(2, 15, 16, 1, coatShade);
        r(8, 15, 4, 2, '#f4f6f7');
        r(8, 13, 4, 3, skinShade);
        // Kafa
        r(5, 3, 10, 11, skin);
        r(5, 3, 2, 11, skinShade);
        r(5, 13, 10, 1, skinShade);
        r(4, 7, 1, 3, skin);
        r(15, 7, 1, 3, skin);
        // Saç
        r(4, 2, 12, 3, hair);
        r(4, 4, 2, 3, hair);
        r(14, 4, 2, 3, hair);
        if (look.messy) {
            r(5, 1, 3, 1, hair);
            r(10, 0, 3, 2, hair);
            r(14, 1, 3, 2, hair);
            r(3, 5, 1, 3, hair);
        }
        if (look.spiky) {
            for (const c of [5, 8, 11, 14]) r(c, 0, 2, 3, hair);
        }
        // Gözler
        r(7, 7, 2, 2, '#f1f1e4');
        r(11, 7, 2, 2, '#f1f1e4');
        r(8, 7, 1, 2, EYE);
        r(12, 7, 1, 2, EYE);
        // Kaşlar
        r(7, 6, 3, 1, hair);
        r(11, 6, 3, 1, hair);
        // Burun
        r(10, 9, 1, 2, skinShade);
        // Ağız
        if (mouthOpen) {
            r(8, 11, 4, 2, '#4a1f1c');
            r(8, 11, 4, 1, '#e8e0d0');
        } else {
            r(8, 12, 4, 1, '#7a3a30');
        }
        if (look.stubble) {
            ctx.globalAlpha = 0.55;
            r(6, 10, 1, 3, look.stubble);
            r(13, 10, 1, 3, look.stubble);
            r(7, 13, 6, 1, look.stubble);
            r(8, 10, 4, 1, look.stubble);
            ctx.globalAlpha = 1;
        }
        if (look.band) r(4, 4, 12, 1, BAND);
        if (look.sick) {
            // Yüzde hafif yeşil damarlar: enfekte ama az
            r(6, 9, 1, 3, GREEN);
            r(13, 8, 1, 3, GREEN);
        }
    }

    // İsim şeridi
    ctx.fillStyle = isVoice ? '#16260a' : '#0f172a';
    ctx.fillRect(x + 3, y + PORTRAIT.h - 28, PORTRAIT.w - 6, 25);
    const w = measurePixelText(name, 2);
    drawPixelText(ctx, name, Math.round(x + (PORTRAIT.w - w) / 2), y + PORTRAIT.h - 22,
        { scale: 2, color: isVoice ? '#9dff6a' : '#fef3c7' });
    ctx.restore();
}
