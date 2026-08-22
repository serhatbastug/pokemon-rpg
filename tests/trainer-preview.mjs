// Antrenör çizimini büyük boyda basar: dört yön + yürüyüş kareleri.
// Çalıştırma: node tests/trainer-preview.mjs
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const BASE_URL = process.env.GAME_URL || 'http://localhost:8765';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'screenshots', 'styles');
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${BASE_URL}/?style=painted`, { waitUntil: 'networkidle2' });

const png = await page.evaluate(async () => {
    const mod = await import('/src/world/trainerSprite.js');
    const scale = 13;
    const c = document.createElement('canvas');
    c.width = 1180; c.height = 560;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;

    // Zemin: iki yarı, açık ve koyu (kontur okunurluğunu iki tonda görmek için)
    x.fillStyle = '#d8e4cd'; x.fillRect(0, 0, c.width, 280);
    x.fillStyle = '#2c3a2a'; x.fillRect(0, 280, c.width, 280);

    x.fillStyle = '#5a6b55';
    x.font = '16px sans-serif';
    ['Asagi (on)', 'Saga (yan)', 'Yukari (arka)', 'Sola (yan)'].forEach((t, i) => {
        x.fillText(t, 40 + i * 250, 30);
    });
    x.fillStyle = '#9fb097';
    x.fillText('Yuruyus kareleri (asagi bakis)', 40, 310);

    // Üst sıra: dört yön, duruş karesi
    ['down', 'right', 'up', 'left'].forEach((dir, i) => {
        mod.drawTrainer(x, 100 + i * 250, 260, dir, false, scale);
    });

    // Alt sıra: yürüyüş döngüsünün dört karesi
    for (let f = 0; f < 4; f++) {
        // moving=true olduğunda kare zamandan seçilir; kareyi zorlamak için
        // Date.now'u geçici olarak sabitleriz
        const real = Date.now;
        Date.now = () => f * 120;
        mod.drawTrainer(x, 100 + f * 250, 540, 'down', true, scale);
        Date.now = real;
    }
    return c.toDataURL('image/png').split(',')[1];
});

writeFileSync(join(OUT, 'ANTRENOR-yeni.png'), Buffer.from(png, 'base64'));
console.log(errors.length ? `HATA: ${errors.join(' | ')}` : 'antrenor onizlemesi yazildi');
await browser.close();
