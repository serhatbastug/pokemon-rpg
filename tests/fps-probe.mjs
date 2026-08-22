// Hızlı FPS ölçümü: ana haritada 4 saniye. Tam UI paketini çalıştırmadan
// bir değişikliğin kare hızına etkisini karşılaştırmak için.
// Çalıştırma: node tests/fps-probe.mjs [etiket]
import puppeteer from 'puppeteer';

const BASE_URL = process.env.GAME_URL || 'http://localhost:8765';
const label = process.argv[2] || 'olcum';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
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
await page.keyboard.press('Digit1');
await wait(3500);   // sprite/tip istekleri otursun

const fps = await page.evaluate(() => new Promise(resolve => {
    const frames = [];
    let last = performance.now();
    const start = last;
    function tick(now) {
        frames.push(now - last);
        last = now;
        if (now - start < 4000) requestAnimationFrame(tick);
        else {
            const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
            resolve({ fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), frames: frames.length });
        }
    }
    requestAnimationFrame(tick);
}));

console.log(`${label}: ${JSON.stringify(fps)}`);
await browser.close();
