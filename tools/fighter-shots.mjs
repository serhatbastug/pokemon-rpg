// Arena dövüşçülerinin ekran görüntüsünü alır.
//
// Sprite'ları gözle görmeden çizmek kör çizim oluyor; bu araç
// tools/fighters.html sayfasını açıp PNG olarak kaydeder.
//
//   node tools/fighter-shots.mjs
//
// Sunucu ayrı bir terminalde çalışıyor olmalı (npm start).

import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const only = process.argv[2] ? `?only=${process.argv[2]}` : '';
const URL = `http://localhost:8765/tools/fighters.html${only}`;
const OUT = process.env.FIGHTER_SHOT_DIR || 'tools/shots';

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('SAYFA HATASI:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('KONSOL:', m.text()); });
await page.setViewport({ width: 900, height: 560 });
await page.goto(URL, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => window.__ready === true, { timeout: 5000 });

// Canvas'ı elemandan değil kendisinden okuyoruz (bkz. comic-shots.mjs)
const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
const file = `${OUT}/dovuscu-${process.argv[2] || "ikisi"}.png`;
writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
console.log(file);

await browser.close();
