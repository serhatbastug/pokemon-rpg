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

// Macera moduna geçiş. Macera kapısı şimdilik menüden bir yere götürmüyor
// (nereye açılacağı henüz belirlenmedi) ama motor duruyor ve test ediliyor;
// testler maceraya main.js'in açtığı giriş noktasından giriyor.
async function enterAdventureFromMenu() {
    await page.waitForFunction(() => !!window.__enterOverworld, { timeout: 15000 });
    await page.evaluate(() => window.__enterOverworld());
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
            captures: w.progress.collection.length,
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

    // Makineye takılı gerçek bir oyun kolu tarayıcıya görünüp testlere girdi
    // gönderiyor (bir koşuda antrenör kendi kendine yürüdü). Testler
    // donanımdan yalıtılsın diye kol listesi boşaltılıyor; kol davranışı
    // aşağıdaki sahte kol bölümünde ayrıca test ediliyor.
    await page.evaluateOnNewDocument(() => { navigator.getGamepads = () => []; });

    // --- Yükleme ---
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    check('Sayfa yuklendi', await page.title() === 'PokeRPG - Real-time Arena PvP', await page.title());

    // Karakter kartları PokeAPI'den gelir
    await page.waitForSelector('.char-card', { timeout: 20000 });
    const cardCount = await page.$$eval('.char-card', els => els.length);
    check('9 karakter karti yuklendi', cardCount === 9, `${cardCount} kart`);

    // --- Ana menü sahnesi ---
    // Menü artık gezilebilir bir piksel sahne; karakter seçimine ancak
    // yukarıdaki geçitten geçerek gidilir.
    const menuVisible = await page.$eval('#menu-screen', el => !el.classList.contains('hidden'));
    const selectionHidden = await page.$eval('#selection-screen', el => el.classList.contains('hidden'));
    check('Acilista ana menu sahnesi geliyor', menuVisible && selectionHidden);
    await wait(400);
    await shot('00a-ana-menu');

    const menuFps = await measureFps(2500);
    check('Ana menu 50+ FPS', menuFps.fps >= 50, JSON.stringify(menuFps));

    // Yürüyüş ve çarpışma: sola gidince evin/ormanın duvarında durmalı
    const menuBefore = await page.evaluate(() => ({ ...window.__menu.player }));
    await hold('KeyD', 350);
    const menuAfter = await page.evaluate(() => ({ ...window.__menu.player }));
    check('Antrenor menude yuruyor', menuAfter.x > menuBefore.x + 20,
        `x ${Math.round(menuBefore.x)} -> ${Math.round(menuAfter.x)}`);

    // Çarpışma: evin önünden yukarı yürünse de duvarından geçilemez
    await page.evaluate(() => {
        window.__menu.player.x = 215;
        window.__menu.player.y = 300;
    });
    await hold('KeyW', 600);
    const atHouse = await page.evaluate(() => ({ ...window.__menu.player }));
    check('Evin duvarindan gecilemiyor', atHouse.y > 264,
        `y ${Math.round(atHouse.y)} (ev dibi 260)`);

    // Macera kapısı (ortadaki kemer): yaklaş, F, onay penceresi
    await page.evaluate(() => {
        window.__menu.player.x = 500;
        window.__menu.player.y = 250;
    });
    await wait(120);
    // İpucu görünüyorsa antrenör gerçekten kemerin önünde ve dışarıda duruyor
    const hintVisible = await page.evaluate(() => window.__menu.hintVisible);
    check('Macera kapisinin onunde F ipucu goruluyor', hintVisible);
    await shot('00b-kapi-onunde');
    await page.keyboard.press('KeyF');
    await page.waitForSelector('#start-prompt:not(.hidden)', { timeout: 5000 });
    const promptText = await page.$eval('#start-prompt .pixel-text', el => el.textContent.trim());
    check('Kapida F onay penceresi aciyor', promptText.includes('başlamak istiyor'), promptText);
    await shot('00c-kapi-onayi');

    // HAYIR: pencere kapanır, sahne kaldığı yerden devam eder
    await page.click('#start-prompt-no');
    await wait(200);
    const promptClosed = await page.$eval('#start-prompt', el => el.classList.contains('hidden'));
    const menuStillRunning = await page.evaluate(() => window.__menu.running && !window.__menu.paused);
    check('HAYIR pencereyi kapatip menuye donuyor', promptClosed && menuStillRunning);

    // EVET: ekran yavaşça kararır ve PROLOG 3 (kuşatılan çalışma alanı) açılır
    // (konum yeniden atanıyor: aradaki adımlarda antrenör kemerin menzilinden
    // çıkarsa F hiçbir şey yapmaz ve test sebepsiz kalır)
    await page.evaluate(() => {
        window.__menu.player.x = 500;
        window.__menu.player.y = 250;
    });
    await page.keyboard.press('KeyF');
    await page.waitForSelector('#start-prompt:not(.hidden)', { timeout: 5000 });
    await page.click('#start-prompt-yes');
    await page.waitForFunction(() => window.__siege && window.__siege.running, { timeout: 8000 });
    await wait(700);
    const siegeOpen = await page.evaluate(() => ({
        screen: !document.getElementById('siege-screen').classList.contains('hidden'),
        menuStopped: !window.__menu.running,
        beat: window.__siege.script.name
    }));
    check('EVET prolog 3u (kusatma) aciyor',
        siegeOpen.screen && siegeOpen.menuStopped, JSON.stringify(siegeOpen));
    await shot('00d1-calisma-alani');

    // --- Prolog 3: tahliye ---
    // Beş sağlıklının HEPSİ kapıdan geçmeli. Sayı önemli: prolog 4'te ormanın
    // ağzında yeşillenip vurulacak olanlar bunlar. Biri yolda takılırsa dört
    // kişi geçiyor ve sonraki bölüm tutmuyor.
    const evac = await page.evaluate(() => {
        const s = window.__siege;
        let steps = 0;
        while (s.script.name !== 'sira-bizde' && steps < 6000 && s.script.running) { s.step(); steps++; }
        s.draw();
        return {
            beat: s.script.name,
            escaped: s.state.escaped,
            total: s.survivors.length,
            stuck: s.survivors.filter(p => p.state !== 'gecti').length
        };
    });
    check('Bes saglikli da acil cikistan geciyor',
        evac.escaped === 5 && evac.total === 5 && evac.stuck === 0, JSON.stringify(evac));

    // Silah: vurulan virüslü ölmüyor, dağılıyor - yerinde kalıcı leke kalıyor
    const weapon = await page.evaluate(() => {
        const s = window.__siege;
        // Önünde bir virüslü olsun diye elle yerleştiriliyor
        s.intruders.push({ x: 500, y: 380, seed: 1 });
        s.player.x = 500;
        s.player.y = 290;
        s.player.dir = 'down';
        const before = s.splats.length;
        s.cooldown = 0;
        s.fire();
        for (let i = 0; i < 30; i++) s.step();
        s.draw();
        return { splatsBefore: before, splatsAfter: s.splats.length };
    });
    check('Ates edilen viruslu dagiliyor ve yerde kalici leke birakiyor',
        weapon.splatsAfter > weapon.splatsBefore, JSON.stringify(weapon));
    await shot('00d2-tahliye-ve-silah');

    // En son biz geçiyoruz: oyuncu kapıya YÜRÜYEREK gelmeli
    const lastOut = await page.evaluate(() => {
        const s = window.__siege;
        s.player.x = 500;
        s.player.y = 330;
        const real = s.input.isDown.bind(s.input);
        s.input.isDown = (c) => c === 'KeyW' || real(c);
        let steps = 0;
        while (s.script.name === 'sira-bizde' && steps < 900) { s.step(); steps++; }
        s.input.isDown = real;
        s.draw();
        return { beat: s.script.name, steps };
    });
    check('Kapiya gelince biz de geciyoruz',
        lastOut.beat === 'biz-geciyoruz', JSON.stringify(lastOut));

    // Kapı kapanıyor, ekran kararıyor: arkadaşımız hâlâ kola doğru gidiyor.
    // Ne ısırılmayı ne dönüşümü görüyoruz - sahnede öyle bir an yok.
    const closing = await page.evaluate(() => {
        const s = window.__siege;
        let steps = 0;
        while (s.script.name !== 'kararma' && steps < 3000 && s.script.running) { s.step(); steps++; }
        for (let i = 0; i < 30; i++) s.step();
        s.draw();
        return {
            beat: s.script.name,
            doorClosed: s.state.doorClosed,
            fadeOut: +s.state.fadeOut.toFixed(2),
            leverPulled: s.state.leverPulled,
            friendVisible: s.friend.y > 0
        };
    });
    check('Acil cikis kapaniyor ve ekran karariyor',
        closing.doorClosed === 1 && closing.fadeOut > 0.3, JSON.stringify(closing));
    check('Kolun cekilip cekilmedigi gosterilmiyor', closing.leverPulled === 0);
    await shot('00d3-kararma');

    // Kararma bitince prolog 4 (şehrin kenarı) açılıyor
    await page.evaluate(() => {
        const s = window.__siege;
        for (let i = 0; i < 400 && s.running && s.script.running; i++) s.step();
    });
    await page.waitForFunction(() => window.__adventure && window.__adventure.running, { timeout: 8000 });
    await wait(700);
    const advOpen = await page.evaluate(() => ({
        screen: !document.getElementById('adventure-screen').classList.contains('hidden'),
        siegeStopped: !window.__siege.running,
        camera: Math.round(window.__adventure.camera.x),
        following: window.__adventure.cameraFollowing
    }));
    check('Kararmadan sonra prolog 4 (sehrin kenari) aciliyor',
        advOpen.screen && advOpen.siegeStopped && advOpen.camera === 0 && !advOpen.following,
        JSON.stringify(advOpen));
    await shot('00e-sehir-kenari');

    // --- Prolog 4: rögardan beş kişiyle çıkış ---
    // Ormanın ağzında hepsi yeşilleniyor ve hepsini vuruyoruz. Ormana ancak
    // ondan sonra girilir: "son sağlıklı insan" olmak sahnenin can alıcı yeri.
    const companions = await page.evaluate(() => ({
        count: window.__adventure.companions.length,
        beat: window.__adventure.script.name
    }));
    check('Rogardan bes saglikli bizimle cikiyor',
        companions.count === 5, JSON.stringify(companions));

    const turned = await page.evaluate(() => {
        const a = window.__adventure;
        // Rögardan çıkış konuşmaları bitene kadar bekle
        let waited = 0;
        while (a.script.name !== 'yuruyus' && waited < 4000 && a.script.running) { a.step(); waited++; }
        const real = a.input.isDown.bind(a.input);
        a.input.isDown = (c) => c === 'KeyD' || real(c);
        // Ormanın ağzına yürü, sonra yeşillenmenin bitmesini bekle
        for (let i = 0; i < 300 && a.script.name === 'yuruyus'; i++) a.step();
        a.input.isDown = real;
        let steps = 0;
        while (a.script.name !== 'vurus' && steps < 3000 && a.script.running) { a.step(); steps++; }
        return {
            beat: a.script.name,
            green: a.companions.filter(c => c.greenness >= 1).length,
            allDown: !!a.allDown
        };
    });
    check('Ormanin agzinda besi de yesilleniyor',
        turned.green === 5 && !turned.allDown, JSON.stringify(turned));

    // Sağlıklıyken ateş etmek işe yaramamalı; yalnızca dönüşenler vurulur
    const shooting = await page.evaluate(() => {
        const a = window.__adventure;
        for (let round = 0; round < 40 && a.companions.some(c => !c.down); round++) {
            const t = a.companions.find(c => !c.down);
            a.player.x = t.x - 70;
            a.player.y = t.y;
            a.player.dir = 'right';
            a.cooldown = 0;
            a.fire();
            for (let i = 0; i < 16; i++) a.step();
        }
        // Vuruştan sonra sessizlik ve "işte bu gerçekten zordu..." repliği var;
        // ormana ancak onlar bitince girilebiliyor.
        let waited = 0;
        while (!a.allDown && waited < 4000 && a.script.running) { a.step(); waited++; }
        return {
            down: a.companions.filter(c => c.down).length,
            splats: a.splats.length,
            allDown: !!a.allDown
        };
    });
    check('Besini de vuruyoruz ve yerde kalici leke kaliyor',
        shooting.down === 5 && shooting.splats === 5 && shooting.allDown,
        JSON.stringify(shooting));
    await shot('00e2-vurus');

    // --- Macera: şehirden ormanın girişine ---
    // Boşluğa kadar kamera sabit; boşluktan geçilince ekran sağa kaymalı
    await page.evaluate(() => {
        const a = window.__adventure;
        a.player.x = 760;
        a.player.y = 335;
    });
    await hold('KeyD', 2400);
    await wait(400);
    const inForest = await page.evaluate(() => ({
        x: Math.round(window.__adventure.player.x),
        camera: Math.round(window.__adventure.camera.x),
        following: window.__adventure.cameraFollowing,
        titleShown: window.__adventure.titleShown,
        titleAlpha: window.__adventure.titleAlpha
    }));
    check('Bosluktan gecince kamera saga kayiyor',
        inForest.following && inForest.camera > 60,
        JSON.stringify(inForest));
    check('Ormana girince mekan adi cikiyor',
        inForest.titleShown && inForest.titleAlpha > 0,
        `alpha ${inForest.titleAlpha.toFixed(2)}`);
    await shot('00f-orman-girisi');

    // Koridor dar: yukarı doğru yürümeye çalışınca kısa sürede ağaçlara takılır
    const beforeUp = await page.evaluate(() => Math.round(window.__adventure.player.y));
    await hold('KeyW', 900);
    const afterUp = await page.evaluate(() => Math.round(window.__adventure.player.y));
    check('Orman koridoru dar', beforeUp - afterUp < 120, `y ${beforeUp} -> ${afterUp}`);

    // ESC ana menüye döner
    await page.keyboard.press('Escape');
    await wait(300);
    const backToMenu = await page.evaluate(() => ({
        menu: window.__menu.running,
        adventure: window.__adventure.running,
        screen: !document.getElementById('menu-screen').classList.contains('hidden')
    }));
    check('ESC maceradan ana menuye donuyor',
        backToMenu.menu && !backToMenu.adventure && backToMenu.screen,
        JSON.stringify(backToMenu));

    // Oyun kolu: kol yokken de sahne kolun durumunu sorunsuz tarıyor olmalı
    const padState = await page.evaluate(() => ({
        connected: window.__gamepad.connected,
        stick: window.__gamepad.stick()
    }));
    check('Kol yokken analog nötr okunuyor',
        padState.stick.x === 0 && padState.stick.y === 0 && padState.stick.magnitude === 0,
        JSON.stringify(padState));

    // Sahte kol: gerçek DualSense olmadan da tarama ve tuş eşlemesi
    // uçtan uca doğrulanır (standart eşlemede eksen 0/1 sol analog, tuş 3 ÜÇGEN)
    await page.evaluate(() => {
        window.__fakePad = {
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
            connected: true
        };
        navigator.getGamepads = () => [window.__fakePad];
        // Tarayıcı kolu ancak bu olayla haber veriyor; oyun da taramaya
        // ondan sonra başlıyor (kol yokken her kare getGamepads çağrılmasın)
        window.dispatchEvent(new Event('gamepadconnected'));
    });
    // Analog bir kez nötr okunmadan yön üretmiyor (takılı kalmış eksen
    // koruması); kol yeni bağlandı, birkaç kare nötr geçsin
    await wait(250);

    await page.evaluate(() => {
        window.__menu.player.x = 500;
        window.__menu.player.y = 400;
        window.__fakePad.axes[0] = 1;
    });
    await wait(400);
    const padWalk = await page.evaluate(() => ({ ...window.__menu.player, connected: window.__gamepad.connected }));
    await page.evaluate(() => { window.__fakePad.axes[0] = 0; });
    check('Sol analog karakteri yurutuyor',
        padWalk.x > 520 && padWalk.dir === 'right' && padWalk.connected,
        `x 500 -> ${Math.round(padWalk.x)}, yon ${padWalk.dir}`);

    // Analog yarım itildiğinde daha yavaş yürünür
    await page.evaluate(() => {
        window.__menu.player.x = 500;
        window.__fakePad.axes[0] = 0.45;
    });
    await wait(400);
    const padSlow = await page.evaluate(() => window.__menu.player.x);
    await page.evaluate(() => { window.__fakePad.axes[0] = 0; });
    check('Analog yarim itilince daha yavas yuruyor',
        padSlow > 500 && (padSlow - 500) < (padWalk.x - 500) * 0.8,
        `yarim ${Math.round(padSlow - 500)}px, tam ${Math.round(padWalk.x - 500)}px`);

    // ÜÇGEN = F: macera kapısının önünde onay penceresini açar
    await page.evaluate(() => {
        window.__menu.player.x = 500;
        window.__menu.player.y = 250;
        window.__fakePad.buttons[3].pressed = true;
    });
    await page.waitForSelector('#start-prompt:not(.hidden)', { timeout: 5000 });
    check('UCGEN onay penceresini aciyor', true);
    await shot('00d-kol-ipucu');

    // Daire = HAYIR: pencereyi kapatır
    await page.evaluate(() => {
        window.__fakePad.buttons[3].pressed = false;
        window.__fakePad.buttons[1].pressed = true;
    });
    await wait(300);
    const padClosed = await page.evaluate(() => ({
        promptOpen: !document.getElementById('start-prompt').classList.contains('hidden'),
        menuRunning: window.__menu.running && !window.__menu.paused
    }));
    await page.evaluate(() => { window.__fakePad.buttons[1].pressed = false; });
    check('Daire onay penceresini kapatiyor', !padClosed.promptOpen && padClosed.menuRunning,
        JSON.stringify(padClosed));

    // İki kişilik portal: sağdaki kemerin altına yürüyünce ekran kararır ve
    // karakter seçimi açılır
    await page.evaluate(() => {
        window.__menu.player.x = 878;
        window.__menu.player.y = 320;
    });
    await hold('KeyW', 900);
    await page.waitForFunction(() => !document.getElementById('selection-screen').classList.contains('hidden'), { timeout: 8000 });
    const menuClosed = await page.evaluate(() => !window.__menu.running);
    check('Portaldan gecince karakter secimi aciliyor', menuClosed);
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
    const battleBtnReady = await page.$eval('#start-battle-btn', el => !el.classList.contains('not-ready'));
    check('P2 secilince 2 kisilik dugmesi aktiflesiyor', battleBtnReady);

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
    await enterAdventureFromMenu();
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
        // Ayakta olan bir düşman seçilmeli: yetenek testlerinde bayılmış olan
        // ikinci kez bayılmaz, dolayısıyla jeton da düşürmez
        const e = w.enemies.find(en => en.kind === 'common' && !en.fainted)
            || w.enemies.find(en => en.kind === 'common');
        // Düşmanı antrenörün dibine getir ve canını düşür. Mesafe bilerek
        // kısa: jetonlar düşman çevresine 34 piksele kadar saçılıyor ve
        // mıknatıs menzili 70 - uzağa konursa jetonlar menzil dışına düşüp
        // duran antrenör tarafından hiç toplanmıyor (test aralıklı kalıyordu).
        e.x = w.player.x + 24;
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

    // Yakalama artık şansa bağlı: kurtulursa Pokemon ayağa kalkar, tekrar denenir
    let attempts = 0;
    let caughtCount = 0;
    while (attempts < 10 && caughtCount === 0) {
        attempts++;
        await page.evaluate(() => {
            const w = window.__overworld;
            const e = w.enemies.find(e => e.kind === 'common');
            if (!e) return;
            e.x = w.player.x + 60;
            e.y = w.player.y;
            if (!e.fainted) { e.hp = 1; e.takeDamage(5); }
            w.progress.items['ultra-ball'] = 5; // testte zaman kazanmak için iyi top
        });
        await wait(150);
        await page.keyboard.press('KeyN');
        await page.waitForFunction(() => window.__overworld.ballAnim === null, { timeout: 15000 });
        await wait(200);
        caughtCount = await page.evaluate(() => window.__overworld.progress.collection.length);
    }

    const party = await page.evaluate(() => ({
        collection: window.__overworld.progress.collection.length,
        party: window.__overworld.progress.party.length
    }));
    check('Pokeball ile yakalama calisiyor', party.collection >= 1,
        `${party.collection} yakalanan (${attempts} deneme)`);
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
    await page.waitForFunction(() => !!window.__overworld.victory, { timeout: 20000 });
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
    await page.waitForFunction(() => !!window.__overworld.victory, { timeout: 20000 });
    const secondBadge = await page.evaluate(() => window.__overworld.victory.badge?.name);
    check('Ikinci mekan bossu Rock Smash rozetini veriyor', secondBadge === 'Rock Smash', `rozet: ${secondBadge}`);
    await wait(600);
    await shot('14-rozet');
    await page.evaluate(() => { window.__overworld.victory.frame = 200; });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__overworld.victory === null, { timeout: 10000 });

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
    await page.waitForFunction(() => window.__overworld.victory?.isRegionBoss, { timeout: 20000 });
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

    // Karakter bilgisi: tip zayıflıkları ve hamleler
    await page.click('#library-party .lib-card .lib-name');
    await page.waitForFunction(
        () => document.querySelector('#library-detail .detail-name') !== null,
        { timeout: 20000 }
    );
    await wait(400);
    const detail = await page.evaluate(() => {
        const root = document.getElementById('library-detail');
        const headings = [...root.querySelectorAll('.detail-heading')].map(h => h.textContent.trim());
        const weakRow = root.querySelector('.detail-heading.danger')?.nextElementSibling;
        return {
            name: root.querySelector('.detail-name')?.textContent.trim(),
            headings,
            weakTypes: weakRow ? [...weakRow.querySelectorAll('.type-chip')].map(c => c.textContent.trim()) : [],
            moves: [...root.querySelectorAll('.move-list li')].map(li => li.textContent.trim()),
            stats: root.querySelectorAll('.stat-line').length
        };
    });
    check('Karakter bilgisi paneli aciliyor', !!detail.name, detail.name);
    check('Zayif oldugu tipler listeleniyor', detail.weakTypes.length >= 3, detail.weakTypes.join(', '));
    // Bulbasaur (Grass/Poison): Ateş 2x, Uçan 2x, Buz 2x, Psişik 2x
    check('Bulbasaur Ates tipine zayif gosteriliyor',
        detail.weakTypes.some(t => t.startsWith('Ateş')), detail.weakTypes.join(', '));
    check('Istatistikler ve hamleler gosteriliyor',
        detail.stats === 4 && detail.moves.length >= 3, `${detail.stats} stat, ${detail.moves.length} hamle`);
    await shot('21-karakter-bilgisi');

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
    await enterAdventureFromMenu();
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

    // --- Tüccar Kecleon ---
    // Bölge haritasındaki tezgahın önüne git: alışveriş açılmalı
    await page.evaluate(() => {
        const w = window.__overworld;
        w.loadMap('region-1');
    });
    await wait(800);
    const shopNear = await page.evaluate(() => {
        const w = window.__overworld;
        const shop = w.shops[0];
        w.player.x = shop.col * 50 + 25;
        w.player.y = shop.row * 50 + 70;
        return { shops: w.shops.length, near: w.nearShop() };
    });
    check('Bolge merkezinde tuccar tezgahi var', shopNear.shops === 1 && shopNear.near === true,
        `${shopNear.shops} tezgah, yakinda: ${shopNear.near}`);

    await page.keyboard.press('KeyF');
    await wait(500);
    const shopOpen = await page.evaluate(() =>
        !document.getElementById('shop-overlay').classList.contains('hidden'));
    check('Tezgahta F ile dukkan aciliyor', shopOpen === true);
    await shot('20-dukkan');

    // Satın alma: jeton azalmalı, çantadaki adet artmalı
    const buyBefore = await page.evaluate(() => ({
        tokens: window.__overworld.progress.tokens,
        balls: window.__overworld.progress.itemCount('poke-ball')
    }));
    await page.click('#shop-list .shop-card .lib-btn');
    await wait(400);
    const buyAfter = await page.evaluate(() => ({
        tokens: window.__overworld.progress.tokens,
        balls: window.__overworld.progress.itemCount('poke-ball')
    }));
    check('Jetonla esya satin aliniyor',
        buyAfter.balls === buyBefore.balls + 5 && buyAfter.tokens === buyBefore.tokens - 4,
        `${buyBefore.balls} -> ${buyAfter.balls} top, ${buyBefore.tokens} -> ${buyAfter.tokens} jeton`);

    // Potion satın al ve kullan
    const potionResult = await page.evaluate(() => {
        const w = window.__overworld;
        w.progress.buyItem('potion');
        const before = w.progress.itemCount('potion');
        // Bir ekip üyesinin canını düşür ki iksir işe yarasın
        const target = w.active || w.partyPokemon[0];
        target.hp = Math.round(target.maxHp * 0.3);
        const hpBefore = target.hp;
        const result = w.useItem('potion');
        return { before, after: w.progress.itemCount('potion'), result, hpBefore, hpAfter: target.hp };
    });
    check('Potion kullanilinca can yeniliyor ve esya tukeniyor',
        potionResult.result.ok === true &&
        potionResult.after === potionResult.before - 1 &&
        potionResult.hpAfter > potionResult.hpBefore,
        `${potionResult.result.message} (${potionResult.hpBefore} -> ${potionResult.hpAfter} can)`);

    // Poke Ball tükenince yakalama yapılamamalı
    const noBallResult = await page.evaluate(() => {
        const w = window.__overworld;
        // Tüm top türlerini boşalt (artık Great/Ultra Ball da var)
        for (const id of ['poke-ball', 'great-ball', 'ultra-ball']) delete w.progress.items[id];
        w.loadMap('loc-1-1');
        return true;
    });
    await wait(900);
    const catchWithoutBall = await page.evaluate(() => {
        const w = window.__overworld;
        const enemy = w.enemies.find(e => e.kind === 'common');
        enemy.x = w.player.x + 40;
        enemy.y = w.player.y;
        enemy.fainted = true;
        const before = w.progress.collection.length;
        w.tryCatch();
        return { before, after: w.progress.collection.length, ball: !!w.ballAnim };
    });
    check('Poke Ball yoksa yakalama yapilamiyor',
        catchWithoutBall.ball === false && catchWithoutBall.after === catchWithoutBall.before,
        `koleksiyon ${catchWithoutBall.before} -> ${catchWithoutBall.after}`);

    // Top alınca yakalama tekrar çalışmalı
    const catchWithBall = await page.evaluate(() => {
        const w = window.__overworld;
        for (const id of ['great-ball', 'ultra-ball']) delete w.progress.items[id];
        w.progress.items['poke-ball'] = 3;
        const before = w.progress.itemCount('poke-ball');
        w.tryCatch();
        return { before, after: w.progress.itemCount('poke-ball'), ball: !!w.ballAnim };
    });
    check('Yakalama Poke Ball tuketiyor',
        catchWithBall.ball === true && catchWithBall.after === catchWithBall.before - 1,
        `${catchWithBall.before} -> ${catchWithBall.after} top`);

    // --- Konsol ve ağ hataları ---
    check('Konsol hatasi yok', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    check('Basarisiz istek yok', failedUrls.length === 0, failedUrls.slice(0, 3).join(' | '));

    // --- Özet ---
    const passed = results.filter(r => r.passed).length;
    console.log(`\n===== ${passed}/${results.length} test gecti =====`);
    console.log('FPS ozeti:');
    console.log(`  ana menu          : ${JSON.stringify(menuFps)}`);
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
