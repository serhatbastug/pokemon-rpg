// Çizgi roman karelerinin ekran görüntüsünü alır.
//
// Kareleri gözle görmeden çizmek kör çizim oluyor; bu araç istenen kareyi
// istenen hareket anında yakalayıp PNG olarak kaydeder.
//
//   node tools/comic-shots.mjs                 tüm kareler (hareket ortası)
//   node tools/comic-shots.mjs lab-raf         tek kare
//   node tools/comic-shots.mjs lab-raf 0.9     kare + hareket anı (0..1)
//
// Sunucu ayrı bir terminalde çalışıyor olmalı (npm start).

import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';

const URL = 'http://localhost:8765';
const OUT = process.env.COMIC_SHOT_DIR || 'tools/shots';

const only = process.argv[2] || null;
const forcedT = process.argv[3] ? Number(process.argv[3]) : null;

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => console.error('SAYFA HATASI:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('KONSOL:', m.text()); });
await page.setViewport({ width: 1100, height: 700 });
await page.goto(URL, { waitUntil: 'networkidle2' });

// Menüyü atla: doğrudan çizgi roman ekranını aç
await page.evaluate(() => {
    window.__menu.stop();
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('comic-screen').classList.remove('hidden');
    window.__comic.start();
});

const panels = await page.evaluate(() => window.__comic.player.panels.map(p => ({
    id: p.id, chapter: p.chapter, art: p.art, motion: p.motion || 0
})));

const wanted = only ? panels.filter(p => p.id === only) : panels;
if (wanted.length === 0) {
    console.error(`kare bulunamadi: ${only}`);
    await browser.close();
    process.exit(1);
}

for (const panel of wanted) {
    const index = panels.findIndex(p => p.id === panel.id);
    // Kareyi doğrudan aç ve hareketi istenen ana sar: döngü çizmeye devam
    // ettiği için tek kare beklemek yeterli.
    const t = forcedT !== null ? forcedT : (panel.motion ? 0.62 : 1);
    await page.evaluate(({ index, t }) => {
        const player = window.__comic.player;
        player.enter(index);
        const panel = player.panel;
        player.frame = 14 + Math.round((panel.motion || 0) * t);
        // Balon varsa ilk cümle tamamen yazılmış olsun
        if (player.dialogue.active) player.dialogue.revealed = player.dialogue.line.text.length;
    }, { index, t });
    // Cizim rAF'a birakilmiyor: gizli sekmede rAF bazen hic kosmuyor ve
    // bos PNG cikiyordu. Kare elle cizdiriliyor.
    await page.evaluate(() => window.__comic.draw());
    await new Promise(r => setTimeout(r, 60));

    // Canvas'ı elemandan değil KENDİSİNDEN okuyoruz: eleman ekran görüntüsü
    // sayfa kaydırmasına takılıp bazen yanlış bölgeyi (sayfa zeminini)
    // yakalıyordu, kare çizilmiş olsa bile boş PNG çıkıyordu.
    const data = await page.evaluate(() => document.getElementById('comicCanvas').toDataURL('image/png'));
    const file = `${OUT}/${String(index).padStart(2, '0')}-${panel.id}.png`;
    writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`${file}   (bolum ${panel.chapter}, ${panel.art}, t=${t})`);
}

await browser.close();
