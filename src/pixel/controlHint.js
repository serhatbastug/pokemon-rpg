// Kontrol öğretmesinin çizimi: ekranın üstünde "[simge] İLE ZIPLA".
//
// Simgeler de piksel: kolun KARE/ÇARPI'sı ve klavyenin tuş kapağı aynı
// ızgaraya oturuyor. Yazı tipiyle çizilmiş bir "X" harfi kolun çarpısı gibi
// okunmuyor - bu yüzden şekiller elle desen olarak yazıldı.

import { PX } from './pixelDraw.js';
import { drawPixelText, measurePixelText } from './pixelFont.js';
import { CONTROLS } from '../config/controls.js';
import { lastDevice } from '../core/device.js';

// PlayStation tuşları ve analoglar. '#' dolu piksel.
const PAD_GLYPHS = {
    square: {
        color: '#f0a8de',
        rows: [
            '...........',
            '.#########.',
            '.#########.',
            '.##.....##.',
            '.##.....##.',
            '.##.....##.',
            '.##.....##.',
            '.##.....##.',
            '.#########.',
            '.#########.',
            '...........'
        ]
    },
    cross: {
        color: '#8ab4f8',
        rows: [
            '...........',
            '.##.....##.',
            '.###...###.',
            '..###.###..',
            '...#####...',
            '....###....',
            '...#####...',
            '..###.###..',
            '.###...###.',
            '.##.....##.',
            '...........'
        ]
    },
    triangle: {
        color: '#7ddba6',
        rows: [
            '.....#.....',
            '....###....',
            '....###....',
            '...##.##...',
            '...##.##...',
            '..##...##..',
            '..##...##..',
            '.##.....##.',
            '.#########.',
            '.#########.',
            '...........'
        ]
    },
    circle: {
        color: '#f28b82',
        rows: [
            '...........',
            '...#####...',
            '..##...##..',
            '.##.....##.',
            '.##.....##.',
            '.##.....##.',
            '.##.....##.',
            '.##.....##.',
            '..##...##..',
            '...#####...',
            '...........'
        ]
    },
    // Sağ analog aşağı: başlık, gövde ve aşağı ok
    rstick: {
        color: '#cbd5e1',
        rows: [
            '...#####...',
            '..#######..',
            '.#########.',
            '..#######..',
            '...#####...',
            '.....#.....',
            '.....#.....',
            '..#######..',
            '...#####...',
            '....###....',
            '.....#.....'
        ]
    },
    // Sol analog sağa/sola
    lstick: {
        color: '#cbd5e1',
        rows: [
            '...............',
            '.....#####.....',
            '....#######....',
            '..#.#######.#..',
            '.##.#######.##.',
            '###.#######.###',
            '.##.#######.##.',
            '..#.#######.#..',
            '....#######....',
            '.....#####.....',
            '...............'
        ]
    }
};

const GLYPH_PX = 4;             // simgenin piksel boyu (11 satır -> 44 px)
const TEXT_SCALE = 3;           // "hafif büyük": mekan adından küçük, HUD'dan büyük
const CAP_TEXT_SCALE = 2;       // tuş kapağının içindeki yazı
const GAP = PX * 4;

const BOX = '#0b1220';
const BORDER = '#334155';
const TEXT = '#e2e8f0';
const CAP_FACE = '#e2e8f0';
const CAP_SIDE = '#94a3b8';
const CAP_TEXT = '#111827';

function glyphSize(name) {
    const glyph = PAD_GLYPHS[name];
    if (!glyph) return { w: 0, h: 0 };
    return { w: glyph.rows[0].length * GLYPH_PX, h: glyph.rows.length * GLYPH_PX };
}

function drawPadGlyph(ctx, name, x, y) {
    const glyph = PAD_GLYPHS[name];
    if (!glyph) return 0;
    ctx.fillStyle = glyph.color;
    glyph.rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            if (row[c] !== '#') continue;
            ctx.fillRect(x + c * GLYPH_PX, y + r * GLYPH_PX, GLYPH_PX, GLYPH_PX);
        }
    });
    return glyph.rows[0].length * GLYPH_PX;
}

function capSize(label) {
    return {
        w: measurePixelText(label, CAP_TEXT_SCALE) + PX * 5,
        h: 7 * CAP_TEXT_SCALE + PX * 4
    };
}

// Klavye tuş kapağı: gövdesi açık, altında koyu bir kalınlık
function drawKeyCap(ctx, label, x, y) {
    const { w, h } = capSize(label);
    ctx.fillStyle = CAP_SIDE;
    ctx.fillRect(x, y + PX, w, h);
    ctx.fillStyle = CAP_FACE;
    ctx.fillRect(x, y, w, h - PX);
    drawPixelText(ctx, label, x + w / 2, y + PX * 2, {
        scale: CAP_TEXT_SCALE, color: CAP_TEXT, align: 'center'
    });
    return w;
}

// Öğretmenin toplam genişliği (kutu ortalanabilsin diye önce ölçülüyor)
function measureHint(control, device) {
    const caption = `İLE ${control.text}`;
    const textW = measurePixelText(caption, TEXT_SCALE);
    if (device === 'gamepad') {
        return { iconW: glyphSize(control.pad).w, textW, caption };
    }
    const labels = Array.isArray(control.key) ? control.key : [control.key];
    const iconW = labels.reduce((sum, label) => sum + capSize(label).w, 0)
        + (labels.length - 1) * PX * 2;
    return { iconW, textW, caption, labels };
}

// Ekranın üstündeki öğretme. hint: config/controls.js'teki ControlHint.
export function drawControlHint(ctx, hint, viewW, { y = PX * 26, device = null } = {}) {
    if (!hint || !hint.visible) return;
    const control = CONTROLS[hint.action];
    if (!control) return;

    const which = device || lastDevice();
    const { iconW, textW, caption, labels } = measureHint(control, which);

    const contentW = iconW + GAP + textW;
    const padX = PX * 5;
    const padY = PX * 3;
    const iconH = which === 'gamepad' ? glyphSize(control.pad).h : capSize('A').h + PX;
    const boxH = Math.max(iconH, 7 * TEXT_SCALE) + padY * 2;
    const boxW = contentW + padX * 2;
    const x = Math.round((viewW / 2 - boxW / 2) / PX) * PX;

    ctx.save();
    ctx.globalAlpha = hint.alpha;

    ctx.fillStyle = BORDER;
    ctx.fillRect(x - PX, y - PX, boxW + PX * 2, boxH + PX * 2);
    ctx.fillStyle = BOX;
    ctx.fillRect(x, y, boxW, boxH);

    const midY = y + boxH / 2;
    let cursor = x + padX;

    if (which === 'gamepad') {
        cursor += drawPadGlyph(ctx, control.pad, cursor, Math.round((midY - iconH / 2) / PX) * PX);
    } else {
        for (const label of labels) {
            cursor += drawKeyCap(ctx, label, cursor, Math.round((midY - iconH / 2) / PX) * PX) + PX * 2;
        }
        cursor -= PX * 2;
    }

    drawPixelText(ctx, caption, cursor + GAP, Math.round((midY - 7 * TEXT_SCALE / 2) / PX) * PX, {
        scale: TEXT_SCALE, color: TEXT, shadow: '#020617'
    });

    ctx.restore();
}

export { PAD_GLYPHS };
