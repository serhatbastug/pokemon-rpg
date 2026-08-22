// Görsel stil karşılaştırması: aynı sahneleri üç çizim dilinde çeker ve
// karşılaştırma sayfaları üretir.
//   painted  -> boyanmış arka plan + ince renkli iz (anime'ye en sadık)
//   lineless -> tamamen çizgisiz
//   bold     -> kalın kontur (önceki hâli)
// Çalıştırma: node tests/style-compare.mjs  (sunucu http://localhost:8765)

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

const BASE_URL = process.env.GAME_URL || 'http://localhost:8765';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'screenshots', 'styles');
mkdirSync(OUT, { recursive: true });

const STYLES = [
    { id: 'painted', label: 'A - Boyali arka plan + ince cizgi' },
    { id: 'lineless', label: 'B - Tamamen cizgisiz' },
    { id: 'bold', label: 'C - Kalin kontur (mevcut)' }
];

const SCENES = ['ana-harita', 'orman-mekani', 'savas', 'antrenor'];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Haritaya ışınlanma test kısayolu
async function teleport(page, target) {
    await page.evaluate((t) => {
        const w = window.__overworld;
        const p = w.portals.find(p => p.target === t);
        w.player.x = p.col * 50 + 25;
        w.player.y = p.row * 50 + 25;
        if (w.active) { w.active.x = w.player.x; w.active.y = w.player.y; }
        w.portalCooldown = 0;
    }, target);
    await page.waitForFunction((t) => window.__overworld.currentMap.id === t, { timeout: 20000 }, target);
    await wait(1800);
}

async function captureStyle(browser, style) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    await page.goto(`${BASE_URL}/?style=${style.id}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.char-card', { timeout: 20000 });
    await page.evaluate(() => {
        window.__testHook = true;
        localStorage.removeItem('pokerpg-save-v2');
    });
    await page.click('#start-adventure-btn');
    await page.waitForFunction(
        () => window.__overworld?.running && window.__overworld.partyPokemon.length > 0,
        { timeout: 40000 }
    );
    await wait(600);
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => !!window.__overworld.active, { timeout: 15000 });

    // Doğrulama: seçili stil gerçekten uygulanmış mı
    const applied = await page.evaluate(() => window.__renderStyle || null);
    await wait(2500);

    const canvas = await page.$('#worldCanvas');

    // 1) Ana harita
    await canvas.screenshot({ path: join(OUT, `${style.id}-ana-harita.png`) });

    // 2) Orman mekanı (labirent, ağaç yoğun)
    await teleport(page, 'region-1');
    await teleport(page, 'loc-1-1');
    await canvas.screenshot({ path: join(OUT, `${style.id}-orman-mekani.png`) });

    // 3) Savaş: mermiler havadayken
    await page.evaluate(() => {
        const w = window.__overworld;
        const e = w.enemies.find(en => !en.fainted);
        if (e && w.active) {
            w.player.x = e.x - 150; w.player.y = e.y;
            w.active.x = e.x - 130; w.active.y = e.y;
        }
    });
    await wait(400);
    await page.keyboard.press('KeyK');
    await wait(120);
    await page.keyboard.press('KeyO');
    await wait(160);
    await canvas.screenshot({ path: join(OUT, `${style.id}-savas.png`) });

    // 4) Antrenör yakın plan: çizgi farkı ancak büyütünce görülür
    const trainerPng = await page.evaluate(async () => {
        const mod = await import('/src/world/trainerSprite.js');
        const c = document.createElement('canvas');
        c.width = 560; c.height = 300;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.fillStyle = '#cfe0c4';
        x.fillRect(0, 0, c.width, c.height);
        ['down', 'right', 'up'].forEach((dir, i) => {
            mod.drawTrainer(x, 110 + i * 170, 272, dir, false, 17);
        });
        return c.toDataURL('image/png').split(',')[1];
    });
    writeFileSync(join(OUT, `${style.id}-antrenor.png`), Buffer.from(trainerPng, 'base64'));

    console.log(`${style.id}: 4 kare cekildi (uygulanan stil: ${applied})`);
    await page.close();
}

// Üç varyantı üst üste, etiketli tek sayfada birleştirir
async function buildSheet(browser, scene) {
    const rows = STYLES.map(s => {
        const file = join(OUT, `${s.id}-${scene}.png`);
        const b64 = readFileSync(file).toString('base64');
        return `<figure><figcaption>${s.label}</figcaption>
                <img src="data:image/png;base64,${b64}"></figure>`;
    }).join('\n');

    const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; background: #14161c; font-family: Segoe UI, sans-serif; }
  figure { margin: 0 0 6px; }
  figcaption { color: #f2f4f8; background: #262b36; font-size: 22px;
               padding: 8px 16px; letter-spacing: .5px; }
  img { display: block; width: 100%; }
</style>${rows}`;

    const file = join(OUT, `_sheet-${scene}.html`);
    writeFileSync(file, html);

    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 900 });
    await page.goto(`file://${file.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await wait(300);
    await page.screenshot({ path: join(OUT, `KARSILASTIRMA-${scene}.png`), fullPage: true });
    await page.close();
    console.log(`karsilastirma sayfasi: KARSILASTIRMA-${scene}.png`);
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
    for (const style of STYLES) await captureStyle(browser, style);
    for (const scene of SCENES) await buildSheet(browser, scene);
    console.log(`\nTamamlandi -> ${OUT}`);
} finally {
    await browser.close();
}
