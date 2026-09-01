// ELECTRO-VİRÜS giriş animasyonunun karelerini yakalar.
//
//   node tools/intro-shots.mjs electro         altı an
//   node tools/intro-shots.mjs antivirus 0.46   tek an (0..1)
//
// Sunucu ayrı bir terminalde çalışıyor olmalı (npm start).

import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const OUT = process.env.INTRO_SHOT_DIR || 'tools/shots';
const who = process.argv[2] || 'electro';
const only = process.argv[3] ? [Number(process.argv[3])] : [0.12, 0.35, 0.46, 0.55, 0.72, 0.92];
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('SAYFA HATASI:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('KONSOL:', m.text()); });
await page.setViewport({ width: 1280, height: 900 });
await page.evaluateOnNewDocument(() => { navigator.getGamepads = () => []; });
await page.goto('http://localhost:8765', { waitUntil: 'networkidle2' });
await page.waitForSelector('.char-card');

// Elektro-virüsü 1. oyuncuya, virüsü 2. oyuncuya seçip arenayı aç
await page.evaluate(async (who) => {
    window.__introWho = who;
    const cs = window.__characterSelect;
    const card = (id) => document.getElementById(`card-${id}`);
    card(window.__introWho).click(); document.querySelector('.select-hero-btn').click();
    card('virus').click(); document.querySelector('.select-hero-btn').click();
    document.getElementById('start-battle-btn').click();
    await new Promise(r => setTimeout(r, 200));
}, who);

for (const t of only) {
    const info = await page.evaluate((t) => {
        const g = window.__game;
        g.intro.frame = Math.round(g.intro.frames * t);
        g.update();
        return { frame: g.intro?.frame ?? -1 };
    }, t);
    const data = await page.evaluate(() => document.getElementById('battleCanvas').toDataURL('image/png'));
    const file = `${OUT}/giris-${who}-${String(Math.round(t * 100)).padStart(2, '0')}.png`;
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${file}   (t=${t}, kare ${info.frame})`);
}

await browser.close();
