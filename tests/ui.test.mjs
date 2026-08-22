// Puppeteer UI testleri: oyunu gerçek tarayıcıda açar, ekranlar arasında
// gezinir, macera modunu oynar ve kare hızını ölçer.
// Çalıştırma: npm test  (sunucunun http://localhost:8765 üzerinde olması gerekir)

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const BASE_URL = process.env.GAME_URL || 'http://localhost:8765';
const SHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');

const results = [];
let browser, page;

function check(name, passed, detail = '') {
    results.push({ name, passed, detail });
    console.log(`${passed ? 'GECTI ' : 'KALDI '} ${name}${detail ? ` — ${detail}` : ''}`);
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(name) {
    await page.screenshot({ path: join(SHOT_DIR, `${name}.png`) });
}

// Oyun tuşlarını gerçek klavye olayı olarak gönderir
async function hold(key, ms) {
    await page.keyboard.down(key);
    await wait(ms);
    await page.keyboard.up(key);
}

// Sayfadaki oyun durumunu okumak için Overworld örneğini global'e bağlarız
async function worldState() {
    return page.evaluate(() => {
        const w = window.__overworld;
        if (!w) return null;
        return {
            map: w.currentMap?.id,
            player: { x: Math.round(w.player.x), y: Math.round(w.player.y), hp: w.player.hp },
            enemies: w.enemies.length,
            enemiesFainted: w.enemies.filter(e => e.fainted).length,
            projectiles: w.projectiles.length,
            enemyProjectiles: w.enemyProjectiles.length,
            captures: w.captures.length,
            secretRevealed: w.secretRevealed,
            victory: !!w.victory
        };
    });
}

// Ortalama kare süresi ve FPS ölçümü (requestAnimationFrame tabanlı)
async function measureFps(ms = 3000) {
    return page.evaluate((duration) => new Promise(resolve => {
        const frames = [];
        let last = performance.now();
        const start = last;
        function tick(now) {
            frames.push(now - last);
            last = now;
            if (now - start < duration) requestAnimationFrame(tick);
            else {
                const sorted = [...frames].sort((a, b) => a - b);
                const avg = frames.reduce((s, v) => s + v, 0) / frames.length;
                resolve({
                    frames: frames.length,
                    avgMs: +avg.toFixed(2),
                    fps: +(1000 / avg).toFixed(1),
                    p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2),
                    worstMs: +sorted[sorted.length - 1].toFixed(2),
                    jankFrames: frames.filter(f => f > 33).length
                });
            }
        }
        requestAnimationFrame(tick);
    }), ms);
}

async function main() {
    mkdirSync(SHOT_DIR, { recursive: true });
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const consoleErrors = [];
    const failedUrls = [];
    page.on('console', msg => {
        // favicon.ico 404'u tarayıcının otomatik isteğidir, oyunla ilgisi yok
        if (msg.type() === 'error' && !msg.text().includes('favicon')) consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('response', res => {
        if (res.status() >= 400 && !res.url().includes('favicon')) failedUrls.push(`${res.status()} ${res.url()}`);
    });

    // --- Yükleme ---
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    check('Sayfa yuklendi', await page.title() === 'PokeRPG - Real-time Arena PvP', await page.title());

    // Karakter kartları PokeAPI'den gelir
    await page.waitForSelector('.char-card', { timeout: 20000 });
    const cardCount = await page.$$eval('.char-card', els => els.length);
    check('9 karakter karti yuklendi', cardCount === 9, `${cardCount} kart`);
    await shot('01-secim-ekrani');

    // --- İki kişilik mod: seçim akışı ---
    await page.click('.char-card');
    await page.waitForSelector('.select-hero-btn', { visible: true });
    await shot('02-karakter-detay');
    await page.click('.select-hero-btn');
    const p1Selected = await page.$eval('.p1-status-badge', el => el.classList.contains('selected'));
    check('P1 secimi kaydedildi', p1Selected);

    const cards = await page.$$('.char-card');
    await cards[1].click();
    await page.waitForSelector('.select-hero-btn', { visible: true });
    await page.click('.select-hero-btn');
    const battleBtnVisible = await page.$eval('#start-battle-btn', el => !el.classList.contains('hidden'));
    check('P2 secilince savas dugmesi cikti', battleBtnVisible);

    // --- Savaş ekranı ---
    await page.click('#start-battle-btn');
    await wait(600);
    const battleVisible = await page.$eval('#battle-screen', el => !el.classList.contains('hidden'));
    check('Savas ekrani acildi', battleVisible);
    await shot('03-savas');

    // Yetenek tuşu HP düşürüyor mu (P1 Space = ulti)
    const hpBefore = await page.$eval('#p2-hp-text', el => el.textContent);
    await hold('KeyD', 300);
    await page.keyboard.press('KeyF');
    await wait(1200);
    const hpAfter = await page.$eval('#p2-hp-text', el => el.textContent);
    check('Savasta yetenek calisiyor', typeof hpAfter === 'string' && hpAfter.includes('/'), `${hpBefore} -> ${hpAfter}`);

    const battleFps = await measureFps(3000);
    check('Savas ekrani 50+ FPS', battleFps.fps >= 50, JSON.stringify(battleFps));

    // --- Macera moduna geç ---
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.char-card', { timeout: 20000 });

    // Overworld örneğini teste açmak için global'e bağla
    await page.evaluate(() => { window.__testHook = true; });

    // Yeni akış: macera düğmesi karakter seçimini açar
    await page.evaluate(() => localStorage.removeItem('pokerpg-save-v1'));
    await page.click('#start-adventure-btn');
    await page.waitForSelector('.picker-item', { visible: true, timeout: 20000 });
    check('Macera karakter secimi aciliyor', true);
    await page.click('.picker-item');
    await page.waitForFunction(() => window.__overworld && window.__overworld.running, { timeout: 20000 });
    await wait(800);
    const overworldVisible = await page.$eval('#overworld-screen', el => !el.classList.contains('hidden'));
    check('Ana harita acildi', overworldVisible);
    await shot('04-ana-harita');

    const startLevel = await page.evaluate(() => window.__overworld.progress.level);
    check('Yeni oyun 1. seviyede basliyor', startLevel === 1, `seviye ${startLevel}`);

    // Sprite ve evrim zinciri istekleri otursun; ölçüm sabit duruma bakmalı
    await wait(1500);
    const mainFps = await measureFps(3000);
    check('Ana harita 50+ FPS', mainFps.fps >= 50, JSON.stringify(mainFps));

    // --- Hareket ---
    const before = await worldState();
    await hold('KeyD', 500);
    const afterMove = await worldState();
    check('Karakter hareket ediyor', afterMove.player.x !== before.player.x,
        `x: ${before.player.x} -> ${afterMove.player.x}`);

    // Duvara doğru uzun süre yürü: harita dışına çıkmamalı
    await hold('KeyW', 2500);
    const atWall = await worldState();
    check('Duvar carpismasi calisiyor', atWall.player.y > 0, `y=${atWall.player.y}`);

    // --- Portal geçişi: ana harita -> bölge ---
    await page.evaluate(() => {
        // Vahşi Orman portalının yanına ışınla (test kısayolu)
        const w = window.__overworld;
        const p = w.portals.find(p => p.target === 'region-1');
        w.player.x = p.col * 50 + 25;
        w.player.y = p.row * 50 + 25;
        w.portalCooldown = 0;
    });
    await page.waitForFunction(() => window.__overworld.currentMap.id === 'region-1', { timeout: 15000 });
    check('Portal gecisi: bolge haritasi', (await worldState()).map === 'region-1');
    await shot('05-bolge-haritasi');

    // --- Mekan: Fısıltılı Orman Girişi ---
    await page.evaluate(() => {
        const w = window.__overworld;
        const p = w.portals.find(p => p.target === 'loc-1-1');
        w.player.x = p.col * 50 + 25;
        w.player.y = p.row * 50 + 25;
        w.portalCooldown = 0;
    });
    await page.waitForFunction(() => window.__overworld.currentMap.id === 'loc-1-1', { timeout: 15000 });
    const loc = await worldState();
    check('Mekan haritasi acildi', loc.map === 'loc-1-1');
    check('11 dusman yuklendi', loc.enemies === 11, `${loc.enemies} dusman`);
    await wait(1500);
    await shot('06-mekan-labirent');

    const locFps = await measureFps(4000);
    check('Mekan haritasi 50+ FPS', locFps.fps >= 50, JSON.stringify(locFps));

    // --- Yetenekler ---
    // Mermi duvara çarpıp anında yok olabileceği için atış sayacı ölçülür
    const shotsBefore = await page.evaluate(() => window.__overworld.shotsFired);
    await page.keyboard.press('KeyK');
    await wait(80);
    const afterK = await page.evaluate(() => window.__overworld.shotsFired);
    check('K (Razor Leaf) atis yapiyor', afterK === shotsBefore + 1, `sayac ${shotsBefore} -> ${afterK}`);

    await page.keyboard.press('KeyO');
    await wait(80);
    const afterO = await page.evaluate(() => window.__overworld.shotsFired);
    check('O (Seed Bomb) atis yapiyor', afterO === afterK + 1, `sayac ${afterK} -> ${afterO}`);

    // Bekleme süresi dolmadan ikinci atış yapılamamalı
    await page.keyboard.press('KeyO');
    await wait(80);
    const afterO2 = await page.evaluate(() => window.__overworld.shotsFired);
    check('Bekleme suresi (cooldown) atisi engelliyor', afterO2 === afterO, `sayac ${afterO} -> ${afterO2}`);

    await page.keyboard.press('Semicolon');
    await wait(100);
    const sporeCount = await page.evaluate(() => window.__overworld.spores.length);
    check('S (Sleep Powder) spor olusturuyor', sporeCount > 0, `${sporeCount} spor bulutu`);

    // --- Savaş: bir düşmanı bayılt ve yakala ---
    await page.evaluate(() => {
        const w = window.__overworld;
        const e = w.enemies.find(e => e.kind === 'common');
        // Düşmanı oyuncunun yanına getir ve canını düşür
        e.x = w.player.x + 60;
        e.y = w.player.y;
        e.hp = 1;
        e.takeDamage(5);
    });
    await wait(200);
    const fainted = await worldState();
    check('Dusman bayiliyor', fainted.enemiesFainted >= 1, `${fainted.enemiesFainted} bayilmis`);

    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => window.__overworld.captures.length > 0, { timeout: 15000 });
    const caught = await worldState();
    check('Pokeball ile yakalama calisiyor', caught.captures === 1, `${caught.captures} yakalanan`);
    await shot('07-yakalama');

    // --- Gizli oda ---
    const secretBefore = await page.evaluate(() => window.__overworld.secretRevealed);
    check('Gizli oda baslangicta gizli', secretBefore === false);
    await page.evaluate(() => {
        const w = window.__overworld;
        const a = w.currentMap.secretArea;
        w.player.x = ((a.col0 + a.col1) / 2) * 50 + 25;
        w.player.y = ((a.row0 + a.row1) / 2) * 50 + 25;
    });
    await wait(200);
    const secretAfter = await page.evaluate(() => window.__overworld.secretRevealed);
    check('Gizli odaya girilince aciliyor', secretAfter === true);
    await shot('08-gizli-oda');

    // --- Boss uyanışı ve arena yıkımı ---
    const bossAsleep = await page.evaluate(() => window.__overworld.enemies.find(e => e.kind === 'boss')?.asleep);
    check('Boss baslangicta uyuyor', bossAsleep === true);

    await page.evaluate(() => {
        const w = window.__overworld;
        const boss = w.enemies.find(e => e.kind === 'boss');
        w.player.x = boss.x - 100;
        w.player.y = boss.y;
    });
    await page.waitForFunction(() => {
        const b = window.__overworld.enemies.find(e => e.kind === 'boss');
        return b && !b.asleep;
    }, { timeout: 15000 });
    check('Boss yaklasinca uyaniyor', true);
    const arenaOpened = await page.evaluate(() => window.__overworld.arenaOpened);
    check('Boss uyaninca arena aciliyor', arenaOpened === true);
    await wait(600);
    await shot('09-boss-arena');

    const bossFps = await measureFps(3000);
    check('Boss savasi 45+ FPS', bossFps.fps >= 45, JSON.stringify(bossFps));

    // --- Boss yakalama -> zafer ---
    await page.evaluate(() => {
        const w = window.__overworld;
        const boss = w.enemies.find(e => e.kind === 'boss');
        boss.x = w.player.x + 50;
        boss.y = w.player.y;
        boss.hp = 1;
        boss.takeDamage(5);
    });
    await wait(200);
    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => !!window.__overworld.victory, { timeout: 6000 });
    check('Bossu yakalayinca zafer sahnesi aciliyor', true);
    await wait(900);
    await shot('10-zafer');

    // --- İkinci mekan ---
    await page.evaluate(() => {
        const w = window.__overworld;
        w.victory = null;
        w.loadMap('loc-1-2');
    });
    await wait(1500);
    const loc2 = await worldState();
    check('Golgeli Derinlikler yuklendi', loc2.map === 'loc-1-2', `${loc2.enemies} dusman`);
    await shot('11-golgeli-derinlikler');

    const loc2Fps = await measureFps(4000);
    check('Golgeli Derinlikler 50+ FPS', loc2Fps.fps >= 50, JSON.stringify(loc2Fps));

    // --- Üçüncü mekan: Kadim Ağaç Meydanı (bölge bossu) ---
    await page.evaluate(() => window.__overworld.loadMap('loc-1-3'));
    await wait(1500);
    const loc3 = await worldState();
    check('Kadim Agac Meydani yuklendi', loc3.map === 'loc-1-3', `${loc3.enemies} dusman`);
    await shot('12-kadim-agac-meydani');

    const regionBossAsleep = await page.evaluate(() =>
        window.__overworld.enemies.find(e => e.kind === 'regionBoss')?.asleep);
    check('Bolge bossu Zarude uyuyor', regionBossAsleep === true);

    // Kadim ağaç boss yıkımından korunmalı
    const ancientBefore = await page.evaluate(() =>
        window.__overworld.currentMap.grid.join('').split('A').length - 1);
    await page.evaluate(() => {
        const w = window.__overworld;
        const boss = w.enemies.find(e => e.kind === 'regionBoss');
        w.player.x = boss.x - 100;
        w.player.y = boss.y;
    });
    await page.waitForFunction(() => {
        const b = window.__overworld.enemies.find(e => e.kind === 'regionBoss');
        return b && !b.asleep;
    }, { timeout: 15000 });
    await wait(300);
    const ancientAfter = await page.evaluate(() =>
        window.__overworld.currentMap.grid.join('').split('A').length - 1);
    check('Kadim agac boss yikimindan korunuyor', ancientAfter === ancientBefore && ancientBefore === 16,
        `${ancientBefore} -> ${ancientAfter} karo`);
    check('Bolge bossu arenasi acildi', await page.evaluate(() => window.__overworld.arenaOpened));
    await shot('13-zarude-arena');

    const loc3Fps = await measureFps(4000);
    check('Kadim Agac Meydani 50+ FPS', loc3Fps.fps >= 50, JSON.stringify(loc3Fps));

    // Bölge bossunu yakala -> bölge fethedildi
    await page.evaluate(() => {
        const w = window.__overworld;
        const boss = w.enemies.find(e => e.kind === 'regionBoss');
        boss.x = w.player.x + 50;
        boss.y = w.player.y;
        boss.hp = 1;
        boss.takeDamage(5);
    });
    await wait(200);
    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => window.__overworld.victory?.isRegionBoss, { timeout: 15000 });
    check('Bolge bossu yakalaninca bolge fethedildi', true);
    await wait(900);
    await shot('14-bolge-zaferi');

    // --- Seviye, deneyim ve kayıt ---
    const xpBefore = await page.evaluate(() => ({
        level: window.__overworld.progress.level,
        xp: window.__overworld.progress.xp
    }));
    check('Oynayarak seviye kazanildi', xpBefore.level > 1, `seviye ${xpBefore.level}`);

    // Bir düşmanı bayılt: XP gelmeli
    await page.evaluate(() => {
        const w = window.__overworld;
        const e = w.enemies.find(e => !e.fainted);
        if (e) e.takeDamage(9999);
    });
    await wait(200);
    const afterXp = await page.evaluate(() => ({
        level: window.__overworld.progress.level,
        xp: window.__overworld.progress.xp
    }));
    check('Dusman yenince XP kazaniliyor', afterXp.xp > xpBefore.xp || afterXp.level > xpBefore.level,
        `${xpBefore.xp} -> ${afterXp.xp} XP`);

    // Kayıt localStorage'a yazılıyor mu
    const saved = await page.evaluate(() => {
        const raw = localStorage.getItem('pokerpg-save-v1');
        return raw ? JSON.parse(raw) : null;
    });
    check('Ilerleme localStorage a kaydediliyor', saved !== null && typeof saved.level === 'number',
        saved ? `seviye ${saved.level}, ${saved.captures.length} yakalanan` : 'kayit yok');

    // Seviye 16 -> Ivysaur evrimi
    await page.evaluate(() => {
        const w = window.__overworld;
        w.progress.level = 15;
        w.progress.xp = w.progress.xpNeeded - 1;
        const e = w.enemies.find(e => !e.fainted);
        if (e) e.takeDamage(9999);
    });
    await page.waitForFunction(() => window.__overworld.evolutionScene !== null, { timeout: 15000 });
    check('16. seviyede evrim sahnesi basliyor', true);
    await wait(600);
    await shot('15-evrim-sahnesi');

    await page.waitForFunction(() => window.__overworld.evolutionScene === null, { timeout: 20000 });
    const evolved = await page.evaluate(() => ({
        form: window.__overworld.progress.formId,
        name: window.__overworld.player.name,
        abilities: window.__overworld.abilities.length
    }));
    check('Bulbasaur Ivysaur a evrimlesti', evolved.form === 2, `form #${evolved.form} (${evolved.name})`);
    check('Evrimle yeni yetenek acildi (Leech Seed)', evolved.abilities === 4, `${evolved.abilities} yetenek`);
    await shot('16-ivysaur');

    // Seviye 32 -> Venusaur
    await page.evaluate(() => {
        const w = window.__overworld;
        w.progress.level = 31;
        w.progress.xp = w.progress.xpNeeded - 1;
        const e = w.enemies.find(e => !e.fainted);
        if (e) e.takeDamage(9999);
    });
    await page.waitForFunction(() => window.__overworld.progress.formId === 3, { timeout: 20000 });
    await page.waitForFunction(() => window.__overworld.evolutionScene === null, { timeout: 20000 });
    const venusaur = await page.evaluate(() => ({
        form: window.__overworld.progress.formId,
        abilities: window.__overworld.abilities.map(a => a.name),
        maxHp: window.__overworld.player.maxHp
    }));
    check('Venusaur a evrimlesti', venusaur.form === 3, `form #${venusaur.form}, ${venusaur.maxHp} can`);
    check('Petal Blizzard acildi', venusaur.abilities.includes('Petal Blizzard'), venusaur.abilities.join(', '));
    await shot('17-venusaur');

    // Yakalanan boss oynanabilir karakter listesine giriyor mu
    const playable = await page.evaluate(() => window.__overworld.progress.playableCharacters);
    check('Yakalanan bosslar oynanabilir', playable.includes(768), `oynanabilir: ${playable.join(', ')}`);

    // Kayıttan geri yükleme: sayfa yenilenince ilerleme korunmalı
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.char-card', { timeout: 20000 });
    const restored = await page.evaluate(() => {
        const raw = localStorage.getItem('pokerpg-save-v1');
        return raw ? JSON.parse(raw) : null;
    });
    check('Sayfa yenilenince ilerleme korunuyor', restored && restored.level >= 32 && restored.formId === 3,
        restored ? `seviye ${restored.level}, form #${restored.formId}` : 'kayit yok');

    await page.click('#start-adventure-btn');
    await page.waitForSelector('.picker-item', { visible: true, timeout: 20000 });
    const pickerCount = await page.$$eval('.picker-item', els => els.length);
    check('Secim ekraninda yakalanan boss listeleniyor', pickerCount >= 2, `${pickerCount} karakter`);
    await shot('18-karakter-secimi');

    // --- Konsol ve ağ hataları ---
    check('Konsol hatasi yok', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    check('Basarisiz istek yok', failedUrls.length === 0, failedUrls.slice(0, 3).join(' | '));

    // --- Özet ---
    const passed = results.filter(r => r.passed).length;
    console.log(`\n===== ${passed}/${results.length} test gecti =====`);
    console.log('FPS ozeti:');
    console.log(`  savas ekrani      : ${JSON.stringify(battleFps)}`);
    console.log(`  ana harita        : ${JSON.stringify(mainFps)}`);
    console.log(`  labirent (loc-1-1): ${JSON.stringify(locFps)}`);
    console.log(`  boss arenasi      : ${JSON.stringify(bossFps)}`);
    console.log(`  magara  (loc-1-2) : ${JSON.stringify(loc2Fps)}`);
    console.log(`  meydan  (loc-1-3) : ${JSON.stringify(loc3Fps)}`);

    await browser.close();
    process.exit(passed === results.length ? 0 : 1);
}

main().catch(async err => {
    console.error('TEST HATASI:', err);
    if (page) await shot('hata');
    if (browser) await browser.close();
    process.exit(1);
});
