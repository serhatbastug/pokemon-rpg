// Arenaların ve basamakların önizlemesi: dört arenayı da tek tek çizip çeker.
//
// Kullanım (sunucu http://localhost:8765 üzerinde açıkken):
//   node tools/arena-shots.mjs <çıktı-klasörü>
//
// Testlerin parçası değil.

import puppeteer from 'puppeteer';

const OUT = process.argv[2] || '.';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto('http://localhost:8765', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));

await page.evaluate(() => {
    window.__menu?.stop?.();
    document.getElementById('start-prompt')?.classList.add('hidden');
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('battle-screen').classList.remove('hidden');
    const F = window.__fighters.FIGHTERS;
    const g = window.__game;
    g.start(F[0], F[1]);
    while (g.intro) { g.intro.frame = g.intro.frames; g.update(); }
    g.phaseTimer = 0;
    g.update();
    cancelAnimationFrame(g.rafId);
    g.rafId = null;
});

const names = await page.evaluate(async () => {
    const A = await import('/src/game/arenas.js');
    window.__arenas = A;
    return A.ARENAS.map(a => a.name);
});

for (let i = 0; i < names.length; i++) {
    await page.evaluate((idx) => {
        const g = window.__game;
        g.currentArena = window.__arenas.ARENAS[idx];
        g.ledges = window.__arenas.ledgesOf(g.currentArena, g.canvas.width, g.canvas.height);
        // Bir dövüşçü alt basamağın üstünde, biri zeminde: ölçek belli olsun
        const low = g.ledges.reduce((a, b) => (b.y > a.y ? b : a));
        g.p1.x = low.x + low.w / 2;
        g.p1.y = low.y - g.p1.height / 2;
        g.p1.vy = 0;
        g.p1.grounded = true;
        g.p2.x = g.canvas.width * 0.62;
        g.p2.y = g.p2.groundY;
        g.update();
    }, i);
    const file = `${OUT}/arena-${i + 1}.png`;
    const el = await page.$('#battleCanvas');
    await el.screenshot({ path: file });
    console.log(`${names[i]} -> ${file}`);
}

await browser.close();
