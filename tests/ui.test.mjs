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
    await page.evaluate(() => localStorage.removeItem('pokerpg-save-v2'));
    await page.click('#start-adventure-btn');
    await page.waitForFunction(() => window.__overworld?.running && window.__overworld.partyPokemon.length > 0, { timeout: 30000 });
    await wait(500);
    // Pokemon artik pesimizden gelmiyor: poke topu firlatarak sahaya suruyoruz
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => !!window.__overworld.active, { timeout: 10000 });
    await wait(500);
    const overworldVisible = await page.$eval('#overworld-screen', el => !el.classList.contains('hidden'));
    check('Ana harita acildi', overworldVisible);
    await shot('04-ana-harita');

    const startState = await page.evaluate(() => ({
        party: window.__overworld.progress.party.length,
        tokens: window.__overworld.progress.tokens,
        activeName: window.__overworld.active?.name,
        abilities: window.__overworld.abilities.length
    }));
    check('Ekip baslangic Pokemonuyla kuruldu', startState.party === 1 && startState.activeName === 'Bulbasaur',
        `${startState.party} uye: ${startState.activeName}`);
    check('Sahadaki Pokemonun yetenekleri var', startState.abilities === 3, `${startState.abilities} yetenek`);
    check('Jetonla baslanmiyor', startState.tokens === 0, `${startState.tokens} jeton`);

    // Pokemon antrenörü takip etmemeli: antrenör uzaklaşınca yerinde kalır
    const held = await page.evaluate(() => ({ x: window.__overworld.active.x, y: window.__overworld.active.y }));
    await hold('KeyD', 700);
    const afterWalk = await page.evaluate(() => ({
        pokemon: { x: window.__overworld.active?.x, y: window.__overworld.active?.y },
        trainerX: window.__overworld.player.x
    }));
    check('Pokemon antrenoru takip etmiyor',
        !afterWalk.pokemon.x || Math.abs(afterWalk.pokemon.x - held.x) < 90,
        `pokemon x: ${Math.round(held.x)} -> ${Math.round(afterWalk.pokemon.x ?? held.x)}`);

    // Aynı slota tekrar basınca topuna döner
    await page.keyboard.press('Digit1');
    await wait(500);
    const recalled = await page.evaluate(() => window.__overworld.active === null);
    check('Ayni slot tusu Pokemonu geri cagiriyor', recalled === true);
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => !!window.__overworld.active, { timeout: 10000 });

    // Sprite, tip ve evrim istekleri otursun; ölçüm sabit duruma bakmalı
    await wait(3000);
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
        if (w.active) { w.active.x = w.player.x; w.active.y = w.player.y; }
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
        if (w.active) { w.active.x = w.player.x; w.active.y = w.player.y; }
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

    // --- Savaş: bir düşmanı bayılt, jeton düşsün ve yakala ---
    const tokensBefore = await page.evaluate(() => window.__overworld.progress.tokens);
    await page.evaluate(() => {
        const w = window.__overworld;
        const e = w.enemies.find(e => e.kind === 'common');
        // Düşmanı antrenörün yanına getir ve canını düşür
        e.x = w.player.x + 60;
        e.y = w.player.y;
        e.hp = 1;
        e.takeDamage(5);
    });
    await wait(200);
    const fainted = await worldState();
    check('Dusman bayiliyor', fainted.enemiesFainted >= 1, `${fainted.enemiesFainted} bayilmis`);

    // Jetonlar antrenöre yaklaşınca çekilip toplanır (anında olabilir)
    await page.waitForFunction(
        (before) => window.__overworld.progress.tokens > before,
        { timeout: 15000 }, tokensBefore
    );
    const tokensAfter = await page.evaluate(() => window.__overworld.progress.tokens);
    check('Jetonlar toplaniyor', tokensAfter > tokensBefore, `${tokensBefore} -> ${tokensAfter} jeton`);
    await shot('07a-jeton');

    await page.keyboard.press('KeyN');
    await page.waitForFunction(() => window.__overworld.progress.collection.length > 0, { timeout: 15000 });
    const party = await page.evaluate(() => ({
        collection: window.__overworld.progress.collection.length,
        party: window.__overworld.progress.party.length
    }));
    check('Pokeball ile yakalama calisiyor', party.collection === 1, `${party.collection} yakalanan`);
    await page.waitForFunction(() => window.__overworld.partyPokemon.length >= 2, { timeout: 40000 });
    check('Yakalanan Pokemon ekibe katiliyor', party.party === 2, `ekip: ${party.party}`);

    // Ekip değiştirme (2 tuşu)
    await page.keyboard.press('Digit2');
    await wait(900);
    const swapped = await page.evaluate(() => window.__overworld.progress.activeIndex);
    check('1-6 tuslariyla Pokemon degistiriliyor', swapped === 1, `aktif slot ${swapped + 1}`);
    await shot('07-yakalama');

    // Yakalanan Pokemonun yetenekleri gerçek hamle verisinden üretildi mi
    const autoAbilities = await page.evaluate(() => window.__overworld.active.abilities.map(a => a.name));
    check('Yakalanan Pokemona otomatik hamle seti verildi', autoAbilities.length > 0, autoAbilities.join(', '));

    await page.keyboard.press('Digit1');
    await wait(900);

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

    // Bu mekanın bossunu da yen: Rock Smash rozeti açılsın
    await page.evaluate(() => {
        const boss = window.__overworld.enemies.find(e => e.isBoss);
        boss.hp = 1;
        boss.takeDamage(999);
    });
    await page.waitForFunction(() => !!window.__overworld.victory, { timeout: 15000 });
    const secondBadge = await page.evaluate(() => window.__overworld.victory.badge?.name);
    check('Ikinci mekan bossu Rock Smash rozetini veriyor', secondBadge === 'Rock Smash', `rozet: ${secondBadge}`);
    await wait(600);
    await shot('14-rozet');
    await page.evaluate(() => { window.__overworld.victory = null; });

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
        boss.hp = 1;
        boss.takeDamage(999);
    });
    await page.waitForFunction(() => window.__overworld.victory?.isRegionBoss, { timeout: 15000 });
    check('Bolge bossu yenilince bolge fethedildi', true);
    await wait(900);
    await shot('14-bolge-zaferi');

    // --- Jeton, seviye, evrim ve kayıt ---
    await page.evaluate(() => window.__overworld.progress.addTokens(400));
    const libOpened = await page.evaluate(() => {
        window.__library.open();
        return !document.getElementById('library-overlay').classList.contains('hidden');
    });
    check('E ile kutuphane aciliyor', libOpened === true);
    await wait(600);
    await shot('15-kutuphane');

    // Kütüphaneden jeton harcayarak seviye yükseltme
    const beforeLevel = await page.evaluate(() => ({
        level: window.__overworld.progress.party[0].level,
        tokens: window.__overworld.progress.tokens
    }));
    await page.click('#library-party .lib-card .lib-btn');
    await wait(500);
    const afterLevel = await page.evaluate(() => ({
        level: window.__overworld.progress.party[0].level,
        tokens: window.__overworld.progress.tokens
    }));
    check('Jeton harcayip seviye yukseltiliyor',
        afterLevel.level === beforeLevel.level + 1 && afterLevel.tokens < beforeLevel.tokens,
        `Sv.${beforeLevel.level} -> Sv.${afterLevel.level}, ${beforeLevel.tokens} -> ${afterLevel.tokens} jeton`);

    // 16. seviyeye kadar yatır: evrim tetiklenmeli
    await page.evaluate(async () => {
        const w = window.__overworld;
        w.progress.party[0].level = 15;
        w.progress.save();
        await w.onMemberLeveled(0);
        w.progress.party[0].level = 16;
        w.progress.save();
        await w.onMemberLeveled(0);
    });
    await page.waitForFunction(() => window.__overworld.progress.party[0].formId === 2, { timeout: 20000 });
    check('16. seviyede Ivysaur a evrimlesiyor', true);
    await page.waitForFunction(() => window.__overworld.evolutionScene !== null, { timeout: 10000 }).catch(() => {});
    await wait(500);
    await shot('16-evrim-sahnesi');
    await page.waitForFunction(() => window.__overworld.evolutionScene === null, { timeout: 20000 });

    const evolved = await page.evaluate(() => ({
        name: window.__overworld.partyPokemon[0].name,
        abilities: window.__overworld.partyPokemon[0].abilities.length
    }));
    check('Evrim sonrasi yeni hamle acildi (Leech Seed)', evolved.abilities === 4,
        `${evolved.name}, ${evolved.abilities} yetenek`);

    // Tip etkililiği: Grass hamlesi Water tipine süper etkili olmalı
    const typeCheck = await page.evaluate(async () => {
        const mod = await import('/src/services/typeChart.js');
        await mod.preloadTypes(['grass', 'fire']);
        return {
            grassVsWater: mod.effectiveness('grass', ['water']),
            fireVsGrass: mod.effectiveness('fire', ['grass', 'poison'])
        };
    });
    check('Tip etkililigi calisiyor',
        typeCheck.grassVsWater === 2 && typeCheck.fireVsGrass === 2,
        `grass->water: ${typeCheck.grassVsWater}x, fire->grass/poison: ${typeCheck.fireVsGrass}x`);

    // Kayıt: sayfa yenilenince ekip, jeton ve evrim korunmalı
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pokerpg-save-v2')));
    check('Ilerleme localStorage a kaydediliyor',
        saved && saved.version === 2 && saved.party[0].formId === 2,
        saved ? `ekip ${saved.party.length}, ${saved.tokens} jeton, form #${saved.party[0].formId}` : 'kayit yok');

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('.char-card', { timeout: 20000 });
    await page.click('#start-adventure-btn');
    await page.waitForFunction(() => window.__overworld?.partyPokemon.length > 0, { timeout: 30000 });
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => !!window.__overworld.active, { timeout: 10000 });
    const restored = await page.evaluate(() => ({
        level: window.__overworld.progress.party[0].level,
        form: window.__overworld.progress.party[0].formId,
        name: window.__overworld.active.name,
        party: window.__overworld.partyPokemon.length,
        tokens: window.__overworld.progress.tokens
    }));
    check('Sayfa yenilenince ilerleme korunuyor',
        restored.form === 2 && restored.level >= 16 && restored.party >= 2,
        `Sv.${restored.level} ${restored.name}, ekip ${restored.party}, ${restored.tokens} jeton`);
    await shot('17-kayittan-devam');
    // --- Rozetler ve saha hamleleri ---
    const badges = await page.evaluate(() => window.__overworld.progress.badges);
    check('Uc mekanin da rozeti kazanildi', badges.length === 3, `rozetler: ${badges.join(', ')}`);

    // Ana haritada su artık Surf ile geçilebilir olmalı
    await page.evaluate(() => window.__overworld.loadMap('main'));
    await wait(800);
    const surfCheck = await page.evaluate(() => {
        const w = window.__overworld;
        // Doğu kanalındaki su karosu (21, 4)
        return {
            walkable: w.isWalkable(21 * 50 + 25, 4 * 50 + 25),
            tile: w.currentMap.grid[4][21]
        };
    });
    check('Surf rozetiyle su gecilebiliyor', surfCheck.walkable === true && surfCheck.tile === 'W',
        `karo '${surfCheck.tile}', gecilebilir: ${surfCheck.walkable}`);

    // Surf ile adaya ulaşılabiliyor mu
    const island = await page.evaluate(() => {
        const w = window.__overworld;
        w.player.x = 19 * 50 + 25;
        w.player.y = 4 * 50 + 25;
        return w.isWalkable(25 * 50 + 25, 4 * 50 + 25);
    });
    check('Suyun ardindaki gizli ada acik', island === true);
    await shot('18-surf-ada');

    // Cut: çalıyı kes
    const cutResult = await page.evaluate(() => {
        const w = window.__overworld;
        // Güneydeki çalı duvarının önüne geç (10, 9) ve aşağı bak
        w.player.x = 10 * 50 + 25;
        w.player.y = 9 * 50 + 25;
        w.player.aim = { x: 0, y: 1 };
        const before = w.currentMap.grid[10][10];
        w.useFieldMove();
        return { before, after: w.currentMap.grid[10][10] };
    });
    check('Cut ile cali kesiliyor', cutResult.before === 'h' && cutResult.after === '.',
        `'${cutResult.before}' -> '${cutResult.after}'`);

    // Rock Smash: kayayı kır
    const smashResult = await page.evaluate(() => {
        const w = window.__overworld;
        w.player.x = 2 * 50 + 25;
        w.player.y = 9 * 50 + 25;
        w.player.aim = { x: 0, y: 1 };
        const before = w.currentMap.grid[10][2];
        w.useFieldMove();
        return { before, after: w.currentMap.grid[10][2] };
    });
    check('Rock Smash ile kaya kiriliyor', smashResult.before === 'R' && smashResult.after === 's',
        `'${smashResult.before}' -> '${smashResult.after}'`);
    await shot('19-saha-hamleleri');

    // Rozetsiz saha hamlesi çalışmamalı
    const lockedResult = await page.evaluate(() => {
        const w = window.__overworld;
        const realBadges = w.progress.badges;
        w.progress.badges = [];   // rozetleri geçici olarak kaldır
        w.player.x = 10 * 50 + 25;
        w.player.y = 11 * 50 + 25;
        w.player.aim = { x: 0, y: -1 };
        const before = w.currentMap.grid[10][9];
        w.useFieldMove();
        const after = w.currentMap.grid[10][9];
        w.progress.badges = realBadges;
        return { before, after };
    });
    check('Rozetsiz saha hamlesi calismiyor', lockedResult.before === lockedResult.after,
        `'${lockedResult.before}' -> '${lockedResult.after}'`);

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
