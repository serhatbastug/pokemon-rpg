// 5. BÖLÜM - BİR HAFTA SONRA
//
// Sokaklar boşalmış, kalanların kolları yeşilleniyor. Bölümün iki karesi:
// boş cadde (chapter2.js'teki streetWeek: aynı sokak, hasta insanlar) ve
// bir hastanın yeşillenen kolu.

import { PX, hash } from '../../pixel/pixelDraw.js';
import { createCam, vignette, mix, span, easeOut, lerp } from '../comicKit.js';

const SCENE = { w: 232, h: 122 };
const WIDE = { u: PX, cx: SCENE.w / 2, cy: SCENE.h / 2 };

const SKIN = '#c99a6e';
const GREEN = '#3f9a28';
const VEIN = '#1f5a16';

function limbCells(ctx, cam, x0, y0, x1, y1, thick, color) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        cam.rect(ctx, x0 + (x1 - x0) * k - thick / 2, y0 + (y1 - y0) * k - thick / 2, thick, thick, color);
    }
}

// Yatakta uzanmış bir kol: bileğe doğru ten, dirseğe doğru yeşil. t ilerledikçe
// yeşil yukarı tırmanıyor, damarlar belirginleşiyor, ateşten ter parlıyor.
function greenArm(ctx, A, t) {
    const cam = createCam(A, WIDE);
    const spread = easeOut(span(t, 0, 0.8));

    // Oda: koyu, loş; yatağın örtüsü
    for (let i = 0; i < 12; i++) {
        cam.rect(ctx, 0, i * 6, SCENE.w, 6.6, mix('#2c2a30', '#1a1a1f', i / 11));
    }
    cam.rect(ctx, 0, 76, SCENE.w, 46, '#6a5a4a');
    for (let y = 78; y < SCENE.h; y += 7) cam.rect(ctx, 0, y, SCENE.w, 0.8, '#54463a');
    for (let x = 0; x < SCENE.w; x += 3) {
        if (hash(x, 4, 2) > 0.8) cam.rect(ctx, x, 80 + hash(x, 5, 3) * 30, 6, 1, '#7a6a58');
    }

    // Kol: sağ üstten sola uzanıyor, bilek solda, dirsek sağda
    const armY0 = 42, armY1 = 70;
    const x0 = 54, x1 = 214;
    for (let x = x0; x < x1; x += 2) {
        const along = (x - x0) / (x1 - x0);            // 0 bilek ... 1 dirsek
        const reach = lerp(0.1, 1.1, spread);
        const g = Math.max(0, Math.min(1, (reach - along) * 1.6));
        const col = mix(SKIN, GREEN, 0.75 * g);
        const sag = Math.sin(along * Math.PI) * 3;
        const top = armY0 + sag - along * 4;
        const h = armY1 - armY0 - along * 3;
        cam.rect(ctx, x, top, 2.4, h, col);
        cam.rect(ctx, x, top, 2.4, 3, mix(col, '#ffffff', 0.14));
        cam.rect(ctx, x, top + h - 4, 2.4, 4, mix(col, '#000000', 0.22));
    }

    // Damarlar: yeşil bölgede koyu, dallanan çizgiler
    for (let v = 0; v < 7; v++) {
        let x = x0 + 8 + hash(v, 1, 5) * 30;
        let y = armY0 + 6 + hash(v, 2, 5) * 16;
        const len = 6 + Math.floor(hash(v, 3, 5) * 10);
        for (let i = 0; i < len; i++) {
            const along = (x - x0) / (x1 - x0);
            const g = Math.max(0, Math.min(1, (lerp(0.1, 1.1, spread) - along) * 1.6));
            if (g > 0.35) limbCells(ctx, cam, x, y, x + 4, y + (hash(v, i, 9) - 0.5) * 4, 1.2, VEIN);
            x += 4;
            y += (hash(v, i, 9) - 0.5) * 4;
            y = Math.max(armY0 + 3, Math.min(armY1 - 4, y));
        }
    }

    // El: avuç içi yukarı, parmaklar gevşek
    const hx = 30, hy = armY0 + 6;
    cam.rect(ctx, hx, hy, 22, 20, mix(SKIN, GREEN, 0.18 * spread));
    for (let i = 0; i < 4; i++) {
        cam.rect(ctx, hx - 8 + i * 0.5, hy + 2 + i * 4.6, 10, 3.2, mix(SKIN, GREEN, 0.22 * spread));
    }
    cam.rect(ctx, hx + 4, hy + 20, 14, 4, mix(SKIN, GREEN, 0.18 * spread));      // başparmak

    // Ateş teri: kolun üstünde küçük parlak damlalar
    for (let i = 0; i < 14; i++) {
        const sx = x0 + 10 + hash(i, 7, 3) * 140;
        const sy = armY0 + 4 + hash(i, 8, 3) * 20;
        const blink = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
        cam.rect(ctx, sx, sy, 1.4, 1.4, mix('#cfe6c0', '#ffffff', blink));
    }

    // Nabız: dirsek yanındaki yeşil leke atıyor
    const beat = 0.5 + 0.5 * Math.sin(t * 20);
    cam.glow(ctx, 170, 56, 22, 'rgba(120,255,110,ALPHA)', 0.1 + 0.08 * beat * spread);

    vignette(ctx, 0.5);
}

export const CHAPTER_5_ART = { greenArm };
