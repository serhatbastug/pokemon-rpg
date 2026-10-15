// Oynanış sahnelerindeki insanlar: Harry, Fred, üç yardımcı ve Andrew.
//
// Hepsi aynı 12x16 ızgarada (menüdeki avatarla aynı boyut), 4 ölçekle
// çizilir. Silüet ortak; kişileri ayıran renk paleti ve birkaç piksellik
// ayrıntı: Harry'nin gözlüğü, Fred'in dik saçı + kirli sakalı + turuncu bandı,
// Andrew'ın dağınık saçı ve elindeki yeşil izler.
//
// Çizgi romandaki ayrıntılı yüzler bu boyda sığmıyor. Konuşurken yüzler
// balonun yanında portre olarak çizilebilir (bkz. portraits - ileride).

import { MENU_AVATAR_FRAMES } from '../world/menuAvatarSprite.js';

// Görünüşler. coat/trouser: önlük ve pantolon; stubble/glasses/spiky/band/
// messy: ayrıntı bayrakları; sick: ellerin yeşil rengine kayma oranı.
export const LOOKS = {
    harry: {
        hair: '#9a6a36', skin: '#e0b48c', skinShade: '#c0906a',
        coat: '#e8ecee', coatShade: '#b9c1c6', trouser: '#3a4048',
        glasses: true
    },
    fred: {
        hair: '#120e0c', skin: '#a8754c', skinShade: '#86593a',
        coat: '#e1e5e7', coatShade: '#aeb6bb', trouser: '#2c2f33',
        spiky: true, stubble: '#5a3f2a', band: true
    },
    saglikli0: {
        hair: '#241f1b', skin: '#a8825f', skinShade: '#86644a',
        coat: '#6b7d5e', coatShade: '#4c5b42', trouser: '#3b3630'
    },
    saglikli1: {
        hair: '#5a4326', skin: '#d0aa84', skinShade: '#ae8a64',
        coat: '#5e6b8a', coatShade: '#444f68', trouser: '#2c3138'
    },
    saglikli2: {
        hair: '#161514', skin: '#8f6a4c', skinShade: '#6f4f38',
        coat: '#8a6a5e', coatShade: '#68493e', trouser: '#333a33'
    },
    andrew: {
        hair: '#2a2220', skin: '#d9b08c', skinShade: '#b58e6c',
        coat: '#3a4a5c', coatShade: '#283442', trouser: '#22262c',
        messy: true, sick: 0.35
    }
};

const EYE = '#20242a';
const OUTLINE = '#1f2937';
const SHOE = '#111827';
const BAND = '#ea7317';
const GLASS = '#1e1a16';
const GREEN = '#6f9a2c';

// Menü avatarının silüetinden türetilmiş çerçeveler: tulum -> önlük,
// bacaklar pantolon, gözler ayrı piksel.
function derive(frames) {
    const out = {};
    for (const key of Object.keys(frames)) {
        out[key] = frames[key].map(frame => frame.map((row, r) => {
            // Satır 13: önlüğün eteği, 14: pantolon
            if (r === 14) return row.replace(/j/g, 't');
            return row.replace(/j/g, 'c').replace(/J/g, 'C');
        }));
    }
    return out;
}

const BASE = derive(MENU_AVATAR_FRAMES);

function setCell(rows, r, c, ch) {
    const row = rows[r];
    rows[r] = row.slice(0, c) + ch + row.slice(c + 1);
}

// Bir görünüş için çerçeveleri (yön -> [kare0, kare1]) hazırlar
function framesFor(look) {
    const out = {};
    for (const dir of ['down', 'up', 'side']) {
        out[dir] = BASE[dir].map(frame => {
            const rows = [...frame];
            if (dir === 'down') {
                // Gözler: menü avatarındaki gölge pikselleri ayrı göz rengi olur
                setCell(rows, 5, 4, 'e');
                setCell(rows, 5, 7, 'e');
                if (look.glasses) rows[5] = '..kgeggegk..';
                if (look.stubble) {
                    rows[6] = '..kbbbbbbk..';
                    rows[7] = '...kbbbbk...';
                }
                if (look.band) setCell(rows, 10, 1, 'o');
            } else if (dir === 'side') {
                setCell(rows, 5, 6, 'e');
                if (look.glasses) { setCell(rows, 5, 7, 'g'); setCell(rows, 5, 8, 'g'); }
                if (look.stubble) { setCell(rows, 6, 6, 'b'); setCell(rows, 6, 7, 'b'); setCell(rows, 6, 8, 'b'); setCell(rows, 7, 5, 'b'); setCell(rows, 7, 6, 'b'); setCell(rows, 7, 7, 'b'); }
                if (look.band) setCell(rows, 10, 10, 'o');
            } else if (look.band) {
                setCell(rows, 10, 10, 'o');
            }
            if (look.spiky) {
                rows[0] = '.h.h.hh.h.h.';
                rows[1] = '..hhhhhhhh..';
            }
            if (look.messy) {
                rows[0] = '..hh.hhh.hh.';
                rows[1] = '.hhhhhhhhhhh';
            }
            return rows;
        });
    }
    return out;
}

function mixColor(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

const cache = new Map();

function spriteFor(who) {
    if (cache.has(who)) return cache.get(who);
    const look = LOOKS[who];
    if (!look) throw new Error(`Bilinmeyen görünüş: ${who}`);
    const hands = look.sick ? mixColor(look.skin, GREEN, look.sick) : look.skin;
    const palette = {
        k: OUTLINE, h: look.hair, s: look.skin, S: look.skinShade,
        c: look.coat, C: look.coatShade, t: look.trouser, y: SHOE,
        e: EYE, g: GLASS, b: look.stubble || look.skinShade, o: BAND,
        // Eller ve önkol: ten (sick ise yeşile kayar)
        hand: hands
    };
    const entry = { frames: framesFor(look), palette, look };
    cache.set(who, entry);
    return entry;
}

// (x, y) = AYAK noktası. dir: 'down' | 'up' | 'left' | 'right'.
// tick: yürüme karesini seçen sayaç (sahnenin kare sayısı).
export function drawPerson(ctx, x, y, who, dir, moving, tick = 0, scale = 4, { sickBlend = null } = {}) {
    const { frames, palette } = spriteFor(who);
    const key = (dir === 'left' || dir === 'right') ? 'side' : dir;
    const set = frames[key];
    const frame = set[moving ? Math.floor(tick / 9) % 2 : 0];
    const cols = frame[0].length;
    const rows = frame.length;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    if (dir === 'left') ctx.scale(-1, 1);

    const ox = -cols * scale / 2;
    const oy = -rows * scale;
    const handColor = sickBlend !== null ? mixColor(palette.s, GREEN, sickBlend) : palette.hand;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const ch = frame[r][c];
            if (ch === '.') continue;
            let color = palette[ch];
            // Gövde yanındaki eller: ten pikselleri 8-12. satırlarda
            if (ch === 's' && r >= 8 && r <= 12) color = handColor;
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
        }
    }
    ctx.restore();
}

export const SPRITE_W = 12 * 4;
export const SPRITE_H = 16 * 4;
