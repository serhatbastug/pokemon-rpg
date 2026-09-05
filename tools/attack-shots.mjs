// Saldırı animasyonlarını kare kare görmek için önizleme.
//
// Kullanım (sunucu http://localhost:8765 üzerinde açıkken):
//   node tools/attack-shots.mjs <çıktı-klasörü>
//
// Oyun döngüsünü durdurup update()'i elle adımlıyor, böylece animasyonun
// istenen karesi yakalanabiliyor. Testlerin parçası değil.

import puppeteer from 'puppeteer';

const OUT = process.argv[2] || '.';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 760 });
await page.goto('http://localhost:8765', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));

// Sahneyi kur ve döngüyü durdur: kareleri elle ilerleteceğiz
async function setup(p1, p2) {
    await page.evaluate(([a, b]) => {
        window.__menu?.stop?.();
        document.getElementById('start-prompt')?.classList.add('hidden');
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('battle-screen').classList.remove('hidden');
        const F = window.__fighters.FIGHTERS;
        const g = window.__game;
        g.start(F.find(f => f.id === a), F.find(f => f.id === b));
        while (g.intro) { g.intro.frame = g.intro.frames; g.update(); }
        g.phaseTimer = 0;
        g.update();
        cancelAnimationFrame(g.rafId);
        g.rafId = null;
        g.p1.x = 360; g.p2.x = 700;
        g.p1.y = g.p1.groundY; g.p2.y = g.p2.groundY;
        g.update();
    }, [p1, p2]);
}

// Hamleyi çıkar, n kare ilerlet, çek
async function pose(slot, frames, name) {
    await page.evaluate(([s, n]) => {
        const g = window.__game;
        g.combat.reset();
        g.effects.reset();
        for (const id of Object.keys(g.p1.cooldowns)) g.p1.cooldowns[id] = 0;
        g.p1.anim = null;
        g.p1.action = null;
        g.p1.useAbility(s);
        for (let i = 0; i < n; i++) g.update();
    }, [slot, frames]);
    await page.screenshot({
        path: `${OUT}/a-${name}.png`,
        clip: { x: 90, y: 250, width: 1000, height: 440 }
    });
}

await setup('virus', 'antivirus');
await pose('basic', 9, 'virus-savurma-hazirlik');
await pose('basic', 15, 'virus-savurma-vurus');
await pose('special', 13, 'virus-bolunme');
await pose('signature', 11, 'virus-iz');

await setup('antivirus', 'virus');
await pose('basic', 4, 'anti-top');
await pose('special', 12, 'anti-sacilma');
await pose('signature', 14, 'anti-enfekte-kol');

await setup('electro', 'antivirus');
await pose('basic', 13, 'electro-isin');
await pose('special', 22, 'electro-kure');
await pose('signature', 4, 'electro-isinlanma');

await setup('ice', 'antivirus');
await pose('basic', 8, 'buz-kilic-hazirlik');
await pose('basic', 15, 'buz-kilic-vurus');
await pose('special', 30, 'buz-klon');
await pose('signature', 40, 'buz-yolu');

await browser.close();
console.log('bitti');
