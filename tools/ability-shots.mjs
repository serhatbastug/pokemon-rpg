// Hamlelerin arenadaki görüntüsünü gözle kontrol etmek için önizleme:
// ışın, elektrik küresi ve kütlesi, saçılma, enfekte kol, bölünme.
//
// Kullanım (sunucu http://localhost:8765 üzerinde açıkken):
//   node tools/ability-shots.mjs <çıktı-klasörü>
//
// Testlerin bir parçası değil - ekran görüntüleri bakmak için, dosyalar
// x-<hamle>.png adıyla yazılıyor.
import puppeteer from 'puppeteer';

const OUT = process.argv[2] || '.';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto('http://localhost:8765', { waitUntil: 'networkidle2' });
await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

const setup = async (p1, p2) => page.evaluate(([a, b]) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('battle-screen').classList.remove('hidden');
    const F = window.__fighters.FIGHTERS;
    const g = window.__game;
    g.start(F.find(f => f.id === a), F.find(f => f.id === b));
    while (g.intro) { g.intro.frame = g.intro.frames; g.update(); }
    g.phaseTimer = 0;
    g.update();
}, [p1, p2]);

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// --- Elektro: ışın ve küre ---
await setup('electro', 'antivirus');
await wait(300);
await page.evaluate(() => {
    const g = window.__game;
    g.p1.x = 260; g.p2.x = 760;
    g.p1.useAbility('basic');
});
await wait(500);
await page.screenshot({ path: `${OUT}/x-electro-isin.png` });

await page.evaluate(() => { window.__game.p1.useAbility('special'); });
await wait(1500);
await page.screenshot({ path: `${OUT}/x-electro-kure.png` });

// --- Anti-virüs: saçılma ve enfekte kol ---
await setup('antivirus', 'virus');
await wait(300);
await page.evaluate(() => {
    const g = window.__game;
    g.p1.x = 400; g.p2.x = 620;
    g.p1.useAbility('special');
});
await wait(350);
await page.screenshot({ path: `${OUT}/x-anti-sacilma.png` });

await setup('antivirus', 'virus');
await wait(300);
await page.evaluate(() => {
    const g = window.__game;
    g.p1.x = 380; g.p2.x = 560;
    g.combat.reset();
    g.p1.useAbility('signature');
});
await wait(600);
await page.screenshot({ path: `${OUT}/x-anti-kol.png` });

// --- Virüs: bölünme ve salgın izi ---
await setup('virus', 'antivirus');
await wait(300);
await page.evaluate(() => {
    const g = window.__game;
    g.p1.x = 300; g.p2.x = 780;
    g.p1.useAbility('special');
    g.p1.useAbility('signature');
});
await wait(900);
await page.screenshot({ path: `${OUT}/x-virus-bolunme.png` });

await browser.close();
console.log('bitti');
