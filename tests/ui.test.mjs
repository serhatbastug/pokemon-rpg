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
    check('Sayfa yuklendi', await page.title() === 'Virüs - Arena ve Prolog', await page.title());

    // Kadro ağdan gelmiyor: dördü de elle çizilmiş, kartlar anında hazır
    await page.waitForSelector('.char-card', { timeout: 10000 });
    const cardCount = await page.$$eval('.char-card', els => els.length);
    check('Bes dovuscu karti hazir', cardCount === 5, `${cardCount} kart`);
    const cardNames = await page.$$eval('.char-class', els => els.map(e => e.textContent));
    check('Kadro VIRUS, ANTI-VIRUS, ELECTRO-VIRUS, ICE-VIRUS, GOLGE-VIRUS',
        cardNames.join(',') === 'VİRÜS,ANTİ-VİRÜS,ELECTRO-VİRÜS,ICE-VİRÜS,GÖLGE-VİRÜS', cardNames.join(','));

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

    // EVET: ekran yavaşça kararır ve PROLOGUN ÇİZGİ ROMANI açılır
    // (konum yeniden atanıyor: aradaki adımlarda antrenör kemerin menzilinden
    // çıkarsa F hiçbir şey yapmaz ve test sebepsiz kalır)
    await page.evaluate(() => {
        window.__menu.player.x = 500;
        window.__menu.player.y = 250;
    });
    await page.keyboard.press('KeyF');
    await page.waitForSelector('#start-prompt:not(.hidden)', { timeout: 5000 });
    await page.click('#start-prompt-yes');
    await page.waitForSelector('#chapter-select:not(.hidden)', { timeout: 5000 });
    await page.click('#chapter-list [data-chapter="1"]');
    await page.waitForFunction(() => window.__comic && window.__comic.running, { timeout: 8000 });
    await wait(400);
    const comicOpen = await page.evaluate(() => ({
        screen: !document.getElementById('comic-screen').classList.contains('hidden'),
        menuStopped: !window.__menu.running,
        panel: window.__comic.player.panel.id,
        chapter: window.__comic.player.panel.chapter
    }));
    check('EVET prologun cizgi romanini aciyor',
        comicOpen.screen && comicOpen.menuStopped && comicOpen.chapter === 1,
        JSON.stringify(comicOpen));
    await shot('00d1-cizgi-roman');

    // --- Çizgi roman: kare ilerletme ---
    // Tek tuş: F. Balon yazılıyorsa önce yazıyı tamamlar, sonra kareyi geçer.
    const firstPanel = await page.evaluate(() => window.__comic.player.panel.id);
    await page.keyboard.press('KeyF');
    await wait(150);
    await page.keyboard.press('KeyF');
    await wait(250);
    const advanced = await page.evaluate(() => window.__comic.player.panel.id);
    check('F ile sonraki kareye geciliyor', advanced !== firstPanel, `${firstPanel} -> ${advanced}`);

    // Balon harf harf açılıyor; F yazıyı tamamlıyor (kareyi atlamıyor)
    const bubble = await page.evaluate(async () => {
        const p = window.__comic.player;
        p.enter(p.panels.findIndex(x => x.lines && x.lines.length));
        await new Promise(r => setTimeout(r, 300));
        const yarim = p.dialogue.visibleText.length;
        const kare = p.panel.id;
        p.advance();
        return { kare, yarim, tam: p.dialogue.visibleText.length, uzunluk: p.dialogue.line.text.length, ayniKare: p.panel.id === kare };
    });
    check('Balon harf harf yaziliyor, F tamamliyor',
        bubble.yarim > 0 && bubble.yarim < bubble.uzunluk && bubble.tam === bubble.uzunluk && bubble.ayniKare,
        JSON.stringify(bubble));

    // Hareketli kare: t 0'dan 1'e yürüyor
    const motion = await page.evaluate(async () => {
        const p = window.__comic.player;
        p.enter(p.panels.findIndex(x => x.motion > 0));
        await new Promise(r => setTimeout(r, 200));
        const erken = p.motionT;
        p.frame = 14 + p.panel.motion;
        return { id: p.panel.id, erken: Number(erken.toFixed(2)), gec: p.motionT };
    });
    check('Hareketli kare canlaniyor', motion.erken < 1 && motion.gec === 1, JSON.stringify(motion));

    // Dört bölümün de karesi var. Sayı bölüme göre değişiyor: 2. bölüm
    // (cadde) bilerek TEK KARE - her şey tek kadrajda kesintisiz akıyor.
    const chapters = await page.evaluate(() => {
        const p = window.__comic.player;
        return [1, 2, 3, 4].map(n => p.panels.filter(x => x.chapter === n).length);
    });
    check('Her bolumun basliktan sonra karesi var', chapters.every(n => n >= 2), chapters.join(','));

    // Eksik çizim kalmamalı: karşılığı olmayan anahtar ekrana kırmızı yazıyor
    const missingArt = await page.evaluate(async () => {
        const { PANEL_ART } = await import('/src/comic/comicArt.js');
        return window.__comic.player.panels
            .filter(p => p.art !== 'title' && !PANEL_ART[p.art])
            .map(p => p.art);
    });
    check('Her karenin cizimi var', missingArt.length === 0, missingArt.join(','));

    // Konuşanların hepsi tanınıyor: bilinmeyen konuşan sessiz balon demek
    const voices = await page.evaluate(async () => {
        const { VOICE_PITCH } = await import('/src/adventure/dialogue.js');
        const bad = new Set();
        for (const panel of window.__comic.player.panels) {
            for (const line of panel.lines || []) if (!VOICE_PITCH[line.speaker]) bad.add(line.speaker);
        }
        return [...bad];
    });
    check('Her konusanin sesi tanimli', voices.length === 0, voices.join(','));

    // Karelerin ses ipuçları: adı yanlış yazılan bir ses SESSİZCE çalmıyor
    const cues = await page.evaluate(async () => {
        const { Sfx } = await import('/src/services/audio.js');
        const bad = new Set();
        for (const panel of window.__comic.player.panels) {
            for (const cue of panel.sfx || []) if (typeof Sfx[cue.name] !== 'function') bad.add(cue.name);
        }
        return [...bad];
    });
    check('Karelerin ses ipuclari tanimli', cues.length === 0, cues.join(','));

    // Bölüm seçme: seçilen bölümün ilk karesinden başlıyor
    const jumped = await page.evaluate(() => {
        const c = window.__comic;
        c.start(4);
        return { chapter: c.player.panel.chapter, first: c.player.panel.id };
    });
    check('Bolum secme: 4. bolum 4. bolumun basindan basliyor',
        jumped.chapter === 4 && jumped.first === 'baslik-4', JSON.stringify(jumped));

    // Son kareden sonra OYNANIŞ başlıyor (laboratuvarda Harry)
    await page.evaluate(() => {
        const p = window.__comic.player;
        p.enter(p.panels.length - 1);
        for (let i = 0; i < 20 && !p.finished; i++) { p.frame = 9999; p.advance(); }
    });
    await wait(500);
    const afterComic = await page.evaluate(() => ({
        adventure: window.__adventure.running,
        comic: window.__comic.running,
        screen: !document.getElementById('adventure-screen').classList.contains('hidden'),
        phase: window.__adventure.phase
    }));
    check('Cizgi roman bitince oynanis basliyor',
        afterComic.adventure && !afterComic.comic && afterComic.screen && afterComic.phase === 'talkFred',
        JSON.stringify(afterComic));
    await wait(1200);
    await shot('00d4-oynanis-laboratuvar');

    // Oyuncu klavyeyle yürüyor ve duvara/masaya çarpıyor
    const walk = await page.evaluate(async () => {
        const a = window.__adventure;
        const y0 = a.player.y;
        return { y0 };
    });
    await hold('KeyS', 400);
    const walked = await page.evaluate(() => window.__adventure.player.y);
    check('Oynanis: S tusu Harry asagi yuruyor', walked > walk.y0, `${walk.y0} -> ${walked}`);
    await hold('KeyW', 3000);
    const blockedY = await page.evaluate(() => window.__adventure.player.y);
    check('Oynanis: Harry silah masasinin icinden gecemiyor', blockedY > 330, String(blockedY));

    // Olay akisi: Fred -> vurus -> kapi deligi -> kapi -> Andrew -> tarama -> cam oda -> final
    const flow = await page.evaluate(async () => {
        const a = window.__adventure;
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const drain = async () => {
            for (let i = 0; i < 500; i++) {
                if (a.dialogue.active) { a.dialogue.advance(); a.dialogue.advance(); }
                if (!a.seq) return true;
                await wait(40);
            }
            return false;
        };
        const log = [];
        const at = (x, y) => { a.player.x = x; a.player.y = y; };
        at(352, 214); await wait(80); a.action(); log.push(['fred', await drain(), a.phase]);
        at(84, 168); await wait(80); a.action(); await wait(200);
        log.push(['peep-overlay', a.overlay?.type]);
        log.push(['peep', await drain(), a.phase]);
        a.action(); log.push(['open', await drain(), a.phase, Math.round(a.doorOpen * 10) / 10 + '/' + a.npcs.andrew.visible + '/' + a.sampleOnBench + '/' + Math.round(a.npcs.andrew.x)]);
        at(692, 214); await wait(80); a.action();
        for (let i = 0; i < 100 && !a.scan; i++) { if (a.dialogue.active) { a.dialogue.advance(); a.dialogue.advance(); } await wait(40); }
        log.push(['scan-overlay', a.overlay?.type]);
        // Yanlis yere F: hedef sayilmaz
        a.scan.x = 100; a.scan.y = 150; a.action(); log.push(['yanlis', a.scan.found.length]);
        for (const [tx, ty] of [[220, 200], [520, 330], [780, 220]]) {
            a.scan.x = tx; a.scan.y = ty; a.action();
            for (let i = 0; i < 40 && a.dialogue.active; i++) { a.dialogue.advance(); a.dialogue.advance(); await wait(30); }
        }
        log.push(['bulunan', a.scan.found.length]);
        log.push(['scope', await drain(), a.phase]);
        at(a.npcs.andrew.x + 40, a.npcs.andrew.y); await wait(80); a.action();
        log.push(['andrew', await drain(), a.phase]);
        // Izolasyon kapisi: kapaliyken arkasi gorunmuyor, acilinca ikinci oda cikiyor
        log.push(['perde-kapali', a.annexOpen, a.camX <= 44]);
        at(950, 348); await wait(80); a.action();
        log.push(['annex', await drain(), a.phase, Math.round(a.npcs.andrew.x), Math.round(a.annexOpen * 10) / 10, a.camX > 100]);
        at(1338, 316); await wait(80); a.action();
        for (let i = 0; i < 40 && a.cellClosed < 1; i++) await wait(50);
        log.push(['cam-kapi', Math.round(a.cellClosed * 10) / 10, a.consoleState]);
        // Gece: hucrede konusma, patlama, kacis, virus Fred'i yakaliyor (uzun dizi)
        let blast = false, dark = false, morphSeen = false, chaseInfo = null;
        for (let i = 0; i < 3000 && a.phase !== 'getBattery'; i++) {
            if (a.dialogue.active) { a.dialogue.advance(); a.dialogue.advance(); }
            if (a.cellBroken) blast = true;
            if (a.lightsOut) dark = true;
            if (a.morph) morphSeen = true;
            if (a.phase === 'chase' && !chaseInfo) {
                // Kovalamaca: oynanabilir, virus yavasca yaklasiyor, fener yone bakiyor
                const vx0 = a.npcs.virus.x;
                a.input.keys.KeyA = true;
                await wait(700);
                chaseInfo = { moved: a.npcs.virus.x < vx0, aim: Math.abs(Math.abs(a.aim) - Math.PI) < 0.6, phase: a.phase };
                a.input.keys.KeyA = false;
                a.player.x = 540; a.player.y = 380;
            }
            await wait(30);
        }
        log.push(['gece', a.phase, blast, dark, a.wallBroken, a.grab?.state, a.npcs.virus.visible, Math.round(a.npcs.virus.x)]);
        log.push(['donusum', morphSeen, chaseInfo, a.fredClock > 0]);
        // Pil: once almak, sonra firlatmak
        at(262, 392); await wait(80); a.action();
        log.push(['pil-al', await drain(), a.phase, a.battery.floor]);
        a.action();
        for (let i = 0; i < 80 && !a.fredDown; i++) await wait(40);
        log.push(['pil-firlat', a.fredDown !== null, a.npcs.virus.pain, a.grab?.state]);
        for (let i = 0; i < 60 && a.revert; i++) await wait(40);
        log.push(['andrew-yerde', a.npcs.andrew.visible, a.npcs.andrew.lying, a.npcs.virus.visible]);
        for (let i = 0; i < 600 && a.running; i++) {
            if (a.dialogue.active) { a.dialogue.advance(); a.dialogue.advance(); }
            await wait(40);
        }
        return log;
    });
    const f = Object.fromEntries(flow.map(r => [r[0], r.slice(1)]));
    check('Oynanis: Fred ile konusunca kapi vurusu basliyor ve kapiya gitme gorevi geliyor',
        f.fred[0] === true && f.fred[1] === 'toDoor', JSON.stringify(f.fred));
    check('Oynanis: kapi deligi ekrani aciliyor', f['peep-overlay'][0] === 'peep');
    check('Oynanis: kapi deligi bitince kapiyi acma gorevi', f.peep[1] === 'openDoor', JSON.stringify(f.peep));
    check('Oynanis: kapi acilinca Andrew iceri giriyor', f.open[1] === 'toScope' && /\/true\/true\/7\d\d$/.test(f.open[2]), JSON.stringify(f.open));
    check('Oynanis: mikroskopta tarama ekrani aciliyor', f['scan-overlay'][0] === 'scan');
    check('Oynanis: bos yere F anomali saymiyor', f.yanlis[0] === 0);
    check('Oynanis: uc anomali bulununca tarama bitiyor', f.bulunan[0] === 3 && f.scope[1] === 'talkAndrew', JSON.stringify(f.scope));
    check('Oynanis: Andrew ile konusunca izolasyon kapisini acma gorevi', f.andrew[1] === 'openAnnex', JSON.stringify(f.andrew));
    check('Oynanis: izolasyon kapisi kapaliyken perde ve kamera sinirli', f['perde-kapali'][0] === 0 && f['perde-kapali'][1] === true);
    check('Oynanis: kapi acilinca ikinci oda cikiyor, Andrew cam hucreye yuruyor',
        f.annex[1] === 'lock' && f.annex[2] > 1500 && f.annex[3] === 1 && f.annex[4] === true, JSON.stringify(f.annex));
    check('Oynanis: cam oda kilitleniyor', f['cam-kapi'][0] === 1 && f['cam-kapi'][1] === 'locked', JSON.stringify(f['cam-kapi']));
    check('Oynanis: gece sahnesi: cam kirilir, elektrik kesilir, virus duvari yikip Fred i yakalar',
        f.gece[0] === 'getBattery' && f.gece[1] && f.gece[2] && f.gece[3] === 1 && f.gece[4] === 'swing'
        && f.gece[5] === true && f.gece[6] > 500 && f.gece[6] < 620, JSON.stringify(f.gece));
    check('Oynanis: donusum uzun suruyor, sonra kovalamaca oynaniyor, virus yavasca yaklasiyor',
        f.donusum[0] === true && f.donusum[1]?.moved === true && f.donusum[1]?.phase === 'chase' && f.donusum[2] === true, JSON.stringify(f.donusum));
    check('Oynanis: pil degince virus Andrew a donup yerde yatiyor',
        f['andrew-yerde'][0] === true && f['andrew-yerde'][1] === true && f['andrew-yerde'][2] === false, JSON.stringify(f['andrew-yerde']));
    check('Oynanis: pil alininca firlatma gorevi geliyor', f['pil-al'][1] === 'throwBattery' && f['pil-al'][2] === false, JSON.stringify(f['pil-al']));
    check('Oynanis: pil virusa carpinca Fred yere dusuyor, virus aci cekiyor',
        f['pil-firlat'][0] === true && f['pil-firlat'][1] === 1 && f['pil-firlat'][2] === 'released', JSON.stringify(f['pil-firlat']));
    await shot('00d5-oynanis-cam-oda');

    // Final: ekran kararir, araba sahnesi baslar; Esc ana menuye doner
    await page.waitForFunction(() => window.__drive.running, { timeout: 60000 });
    await wait(1500);
    check('Oynanis bitince araba sahnesi basliyor',
        await page.evaluate(() => window.__drive.running && !window.__adventure.running && window.__drive.phase === 'drive'));
    await shot('00d6-araba');
    // Cikis onayi: Esc soru sorar, oyun donar; Esc ikinci kez vazgecer (sahne kalir)
    await page.keyboard.press('Escape');
    await wait(300);
    const askOpen = await page.evaluate(() => ({
        shown: !document.getElementById('exit-confirm').classList.contains('hidden'),
        running: window.__drive.running
    }));
    await shot('00d7-cikis-onayi');
    await page.keyboard.press('Escape');
    await wait(300);
    const askCancelled = await page.evaluate(() => ({
        shown: !document.getElementById('exit-confirm').classList.contains('hidden'),
        running: window.__drive.running
    }));
    check('Cikis onayi: Esc soru soruyor, ikinci Esc vazgeciriyor, sahne kaliyor',
        askOpen.shown && askOpen.running && !askCancelled.shown && askCancelled.running, JSON.stringify({ askOpen, askCancelled }));
    await page.keyboard.press('Escape');
    await wait(300);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await wait(500);
    const afterPlay = await page.evaluate(() => ({
        menu: window.__menu.running,
        adventure: window.__adventure.running || window.__drive.running,
        screen: !document.getElementById('menu-screen').classList.contains('hidden')
    }));
    check('Araba sahnesinde Esc ana menuye donduruyor',
        afterPlay.menu && !afterPlay.adventure && afterPlay.screen, JSON.stringify(afterPlay));

    // Gercek ses efekti dosyalari (Kenney, CC0) yukleniyor mu
    const sampleCount = await page.evaluate(async () => {
        const audio = await import('/src/services/audio.js');
        audio.unlockAudio();
        for (let i = 0; i < 60; i++) {
            const [loaded, total] = audio.loadedSamples();
            if (loaded === total) break;
            await new Promise(r => setTimeout(r, 100));
        }
        return audio.loadedSamples();
    });
    check('Ses efektleri: butun gercek ses dosyalari yukleniyor', sampleCount[0] === sampleCount[1] && sampleCount[1] >= 20, JSON.stringify(sampleCount));

    // Ayarlar ekrani: L ile acilir, oyunu dondurur, ses ayarlari degisir, L ile kapanir
    await page.keyboard.press('KeyL');
    await wait(200);
    const settingsOpen = await page.evaluate(() => ({
        shown: !document.getElementById('settings').classList.contains('hidden'),
        rows: document.querySelectorAll('#settings .settings-row').length
    }));
    check('Ayarlar: L ile aciliyor, uc satir var', settingsOpen.shown && settingsOpen.rows === 3, JSON.stringify(settingsOpen));
    await shot('00e-ayarlar');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await wait(150);
    const changed = await page.evaluate(() => ({
        music: document.getElementById('settings-music-toggle').textContent,
        musicVol: document.getElementById('settings-music-vol').value,
        sfxVol: document.getElementById('settings-sfx-vol').value
    }));
    check('Ayarlar: muzik kapanir, muzik sesi azalir, efekt sesi artar',
        changed.music === 'KAPALI' && changed.musicVol === '60' && changed.sfxVol === '80', JSON.stringify(changed));
    await page.keyboard.press('Enter');   // geri ac: sonraki testler etkilenmesin
    await page.keyboard.press('KeyL');
    await wait(150);
    check('Ayarlar: L ile kapaniyor',
        await page.evaluate(() => document.getElementById('settings').classList.contains('hidden')));
    await page.evaluate(() => localStorage.removeItem('audioSettings'));
    // Ayarlar ekrani kolla: OPTIONS acar, yon tuslari gezer/ayarlar, DAIRE kapatir
    const padPress = async (index) => {
        await page.evaluate((i) => { window.__fakePad.buttons[i].pressed = true; }, index);
        await wait(120);
        await page.evaluate((i) => { window.__fakePad.buttons[i].pressed = false; }, index);
        await wait(120);
    };
    await page.evaluate(() => {
        window.__fakePad = {
            index: 0, connected: true, id: 'sahte kol', mapping: 'standard', axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
        };
        navigator.getGamepads = () => [window.__fakePad];
        window.dispatchEvent(new Event('gamepadconnected'));
    });
    await wait(300);
    await padPress(9);     // OPTIONS
    const setPadOpen = await page.evaluate(() => !document.getElementById('settings').classList.contains('hidden'));
    await padPress(13);    // asagi
    await padPress(14);    // sol
    const setPadVol = await page.evaluate(() => document.getElementById('settings-music-vol').value);
    await padPress(1);     // DAIRE
    const setPadClosed = await page.evaluate(() => document.getElementById('settings').classList.contains('hidden'));
    check('Ayarlar (kol): OPTIONS acar, yon tuslari ayarlar, DAIRE kapatir',
        setPadOpen && setPadVol === '50' && setPadClosed, JSON.stringify({ setPadOpen, setPadVol, setPadClosed }));
    await page.evaluate(() => { navigator.getGamepads = () => []; window.__fakePad = null; });


    // Bolum seciminde oynanis girisi var ve dogrudan oynanisi aciyor
    await page.evaluate(() => { window.__menu.player.x = 500; window.__menu.player.y = 250; });
    await page.keyboard.press('KeyF');
    await page.waitForSelector('#start-prompt:not(.hidden)', { timeout: 5000 });
    await page.click('#start-prompt-yes');
    await page.waitForSelector('#chapter-select:not(.hidden)', { timeout: 5000 });
    await page.click('#chapter-list [data-chapter="kapidaki-ses"]');
    await page.waitForFunction(() => window.__adventure.running, { timeout: 8000 });
    check('Bolum secme: oynanis girisi dogrudan oynanisi aciyor',
        await page.evaluate(() => !document.getElementById('adventure-screen').classList.contains('hidden')));
    // Esc + onay ile ana menuye
    await page.keyboard.press('Escape');
    await wait(300);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await wait(500);
    check('Oynanis: Esc ana menuye donduruyor',
        await page.evaluate(() => window.__menu.running && !window.__adventure.running));

    // Oyun kolu: kol yokken de sahne kolun durumunu sorunsuz tarıyor olmalı
    const padState = await page.evaluate(() => ({
        connected: window.__gamepad.connected,
        stick: window.__gamepad.stick()
    }));
    check('Kol yokken analog nötr okunuyor',
        padState.stick.x === 0 && padState.stick.y === 0 && padState.stick.magnitude === 0,
        JSON.stringify(padState));

    // GERİLEME TESTİ: 'gamepadconnected' olayı hiç gelmese bile takılı kol
    // bulunmalı. Chrome bu olayı sayfa yeniden yüklendiğinde ya da kol
    // sayfadan önce uyandırıldığında dinleyiciye ulaştırmayabiliyor; oyun
    // yalnızca olaya güvendiği sürece takılı DualSense ölü görünüyordu.
    await page.evaluate(() => {
        window.__silentPad = {
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
            connected: true
        };
        navigator.getGamepads = () => [window.__silentPad];
        // Olay BİLEREK gönderilmiyor: kolu tarama bulmalı
    });
    await wait(600);
    const silentFound = await page.evaluate(() => window.__gamepad.connected);
    check('Olay gelmese de takili kol bulunuyor', silentFound === true, 'connected ' + silentFound);

    // Sahte kol: gerçek DualSense olmadan da tarama ve tuş eşlemesi
    // uçtan uca doğrulanır (standart eşlemede eksen 0/1 sol analog, tuş 3 ÜÇGEN)
    await page.evaluate(() => {
        window.__fakePad = {
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
            connected: true
        };
        navigator.getGamepads = () => [window.__fakePad];
        // Olay taramayı erkenden başlatır; tek yol değil (yukarıdaki
        // sessiz kol testi taramanın kendi başına da bulduğunu gösteriyor)
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

    // --- Karakter seçimi kolla: imleç, ÇARPI ile aç, DAİRE ile kapat ---
    await page.waitForFunction(() => document.querySelectorAll('.char-card').length === 5, { timeout: 10000 });
    await wait(200);
    const padHintOn = await page.evaluate(() => ({
        hint: !document.getElementById('pad-hint').classList.contains('hidden'),
        focus: window.__characterSelect.focusIndex
    }));
    check('Kol takiliyken secim ekraninda kol ogretmesi ve imlec var',
        padHintOn.hint && padHintOn.focus === 0, JSON.stringify(padHintOn));

    await page.evaluate(() => { window.__fakePad.axes[0] = 1; });
    await wait(250);
    await page.evaluate(() => { window.__fakePad.axes[0] = 0; });
    const focusMoved = await page.evaluate(() => window.__characterSelect.focusIndex);
    check('Sol analog imleci yanindaki karta tasiyor', focusMoved === 1, `index ${focusMoved}`);
    await shot('01b-secim-kol-imleci');

    await page.evaluate(() => { window.__fakePad.buttons[0].pressed = true; });
    await wait(200);
    await page.evaluate(() => { window.__fakePad.buttons[0].pressed = false; });
    check('CARPI imlecteki karakterin detayini aciyor',
        await page.evaluate(() => window.__characterSelect.modalOpen));

    await page.evaluate(() => { window.__fakePad.buttons[1].pressed = true; });
    await wait(200);
    await page.evaluate(() => { window.__fakePad.buttons[1].pressed = false; });
    check('DAIRE detay penceresini kapatiyor',
        await page.evaluate(() => !window.__characterSelect.modalOpen));

    // Sağ analog sayfayı kaydırır. İki kartlık ızgara ekrana sığdığı için
    // sayfa bu ölçüm boyunca geçici olarak uzatılıyor.
    await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 0); });
    await page.evaluate(() => { window.__fakePad.axes[3] = 1; });
    await wait(400);
    const scrolledDown = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => { window.__fakePad.axes[3] = -1; });
    await wait(500);
    const scrolledUp = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => { window.__fakePad.axes[3] = 0; document.body.style.minHeight = ''; });
    check('Sag analog sayfayi kaydiriyor',
        scrolledDown > 100 && scrolledUp < scrolledDown,
        `asagi ${Math.round(scrolledDown)}px, sonra ${Math.round(scrolledUp)}px`);

    // --- İki kişilik mod: seçim akışı (P1 fareyle, P2 kolla onaylanır) ---
    await page.click('.char-card');
    await page.waitForSelector('.select-hero-btn', { visible: true });
    await shot('02-karakter-detay');
    await page.click('.select-hero-btn');
    const p1Selected = await page.$eval('.p1-status-badge', el => el.classList.contains('selected'));
    check('P1 secimi kaydedildi', p1Selected);

    const cards = await page.$$('.char-card');
    await cards[1].click();
    await page.waitForSelector('.select-hero-btn', { visible: true });
    // Pencere açıkken ÇARPI "Oyuncu 2 Olarak Seç" düğmesine basar
    await page.evaluate(() => { window.__fakePad.buttons[0].pressed = true; });
    await wait(250);
    await page.evaluate(() => { window.__fakePad.buttons[0].pressed = false; });
    const p2Selected = await page.$eval('.p2-status-badge', el => el.classList.contains('selected'));
    check('CARPI ile P2 secimi kaydedildi', p2Selected);

    const battleBtnReady = await page.$eval('#start-battle-btn', el => !el.classList.contains('not-ready'));
    check('P2 secilince 2 kisilik dugmesi aktiflesiyor', battleBtnReady);

    // Düğme ızgaranın yukarısında: iki seçim de bitince kendiliğinden görünür
    // olmalı, oyuncu elle kaydırmak zorunda kalmasın
    await wait(700);   // yumuşak kaydırma bitsin
    const startBtnVisible = await page.evaluate(() => {
        const box = document.getElementById('start-battle-btn').getBoundingClientRect();
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), h: window.innerHeight };
    });
    check('Iki secim bitince baslat dugmesi ekranda gorunuyor',
        startBtnVisible.top >= 0 && startBtnVisible.bottom <= startBtnVisible.h,
        JSON.stringify(startBtnVisible));

    // --- Savaş ekranı (kolda ÜÇGEN savaşı başlatır) ---
    await page.evaluate(() => { window.__fakePad.buttons[3].pressed = true; });
    await wait(250);
    await page.evaluate(() => { window.__fakePad.buttons[3].pressed = false; });
    check('UCGEN savasi baslatiyor',
        await page.$eval('#battle-screen', el => !el.classList.contains('hidden')));
    await wait(600);
    const battleVisible = await page.$eval('#battle-screen', el => !el.classList.contains('hidden'));
    check('Savas ekrani acildi', battleVisible);
    await shot('03-savas');

    // Arena ekrana sığmalı: sayfa kaydırılırsa arenanın ALTI (zemin ve kombo
    // kümesi) görünmüyor. Tuvalin boyu ekrana göre kısılıyor.
    const fits = await page.evaluate(() => {
        const bar = document.getElementById('comboBar').getBoundingClientRect();
        const arena = document.getElementById('battleCanvas').getBoundingClientRect();
        return {
            scrollH: document.documentElement.scrollHeight,
            viewH: window.innerHeight,
            barBottom: Math.round(bar.bottom),
            arenaW: Math.round(arena.width),
            barW: Math.round(bar.width)
        };
    });
    check('Savas ekrani ekrana sigiyor (kaydirma yok)',
        fits.scrollH <= fits.viewH + 1 && fits.barBottom <= fits.viewH, JSON.stringify(fits));
    check('Arena ile kombo seridi ayni genislikte', Math.abs(fits.arenaW - fits.barW) <= 1,
        `${fits.arenaW} / ${fits.barW}`);

    // Seçilen dövüşçünün girişi varsa önce o oynar; yürüme testi için
    // animasyonlar sona sarılıyor (girişlerin kendi testi aşağıda).
    await page.evaluate(() => {
        const g = window.__game;
        while (g.intro) { g.intro.frame = g.intro.frames; g.update(); }
        // Raunt başı donması ('RAUNT 1' -> 'BAŞLA') yürüme testini bekletmesin
        g.phaseTimer = 0;
        g.update();
    });
    await wait(150);

    // Dövüşçüler arenada duruyor ve klavyeyle yürüyor (saldırı henüz yok)
    const arenaStart = await page.evaluate(() => ({
        p1: window.__game.p1.fighter.id,
        p2: window.__game.p2.fighter.id,
        x: window.__game.p1.x
    }));
    await hold('KeyD', 350);
    const walkedX = await page.evaluate(() => window.__game.p1.x);
    check('Arenada dovuscu yuruyor', walkedX > arenaStart.x + 20,
        `x ${Math.round(arenaStart.x)} -> ${Math.round(walkedX)}`);
    check('Arenaya secilen dovusculer cikti',
        ['virus', 'antivirus'].includes(arenaStart.p1) && ['virus', 'antivirus'].includes(arenaStart.p2),
        `${arenaStart.p1} vs ${arenaStart.p2}`);


    // --- Saldırılar, blok ve kombolar ---
    // Kadro seçim ekranından geldiği için p1 virüs ya da anti-virüs; testler
    // ikisinde de geçecek biçimde yazıldı (biri yakın dövüşçü, biri menzilli).
    const clearCds = () => page.evaluate(() => {
        const g = window.__game;
        for (const p of [g.p1, g.p2]) {
            for (const id of Object.keys(p.cooldowns)) p.cooldowns[id] = 0;
            p.blockCooldown = 0;
            p.blockFrames = 0;
            p.invulnerable = false;
            p.invulnFrames = 0;
            p.action = null;
            p.hp = p.maxHp;
        }
        g.combat.reset();
        g.p1.x = 400; g.p1.y = g.p1.groundY;
        g.p2.x = 470; g.p2.y = g.p2.groundY;
    });

    await clearCds();
    await hold('KeyF', 150);
    await wait(400);
    const hit = await page.evaluate(() => ({ hp: window.__game.p2.hp, max: window.__game.p2.maxHp }));
    check('Normal saldiri rakibin canini goturuyor', hit.hp < hit.max,
        `${hit.hp} / ${hit.max}`);
    await shot('03g-saldiri');

    // Blok penceresi açıkken temel saldırı hiç geçmemeli
    await clearCds();
    await page.evaluate(() => {
        const g = window.__game;
        g.p2.startBlock();
        g.p1.useAbility('basic');
    });
    await wait(450);
    const blocked = await page.evaluate(() => ({
        hp: window.__game.p2.hp,
        max: window.__game.p2.maxHp,
        cd: window.__game.p2.blockCooldown
    }));
    check('Blok temel saldiriyi tamamen kesiyor', blocked.hp === blocked.max,
        `${blocked.hp} / ${blocked.max}`);
    check('Blok bekleme suresine giriyor', blocked.cd > 0, `${blocked.cd} kare`);

    // Bekleme dolmadan ikinci blok açılmıyor
    const secondBlock = await page.evaluate(() => {
        const p = window.__game.p2;
        p.blockFrames = 0;
        p.startBlock();
        return p.blockFrames;
    });
    check('Bekleme bitmeden ikinci blok acilmiyor', secondBlock === 0, `${secondBlock}`);

    // Özel saldırı arenaya bir şey bırakıyor ve beklemeye giriyor
    await clearCds();
    await hold('KeyG', 120);
    await wait(200);
    const special = await page.evaluate(() => {
        const g = window.__game;
        const id = window.__abilities.ABILITIES[g.p1.fighter.id].special.id;
        return {
            types: [...new Set(g.combat.entities.map(e => e.type))],
            cd: g.p1.cooldowns[id],
            strip: document.getElementById('p1-cd-special').style.width
        };
    });
    check('Ozel saldiri arenaya bir sey birakiyor', special.types.length > 0, special.types.join(','));
    check('Ozel saldiri beklemeye giriyor', special.cd > 0, `${special.cd} kare`);
    check('Ozelin beklemesi HUD serididinde gorunuyor',
        special.strip !== '100%' && special.strip !== '', special.strip);

    // SHIFT (kolda L1) + F: karakterin kendi hamlesi
    await clearCds();
    await page.keyboard.down('ShiftLeft');
    await wait(60);
    await page.keyboard.down('KeyF');
    await wait(120);
    await page.keyboard.up('KeyF');
    await page.keyboard.up('ShiftLeft');
    const signature = await page.evaluate(() => window.__game.combat.entities.map(e => e.type));
    check('SHIFT+F karakterin kendi hamlesini cikariyor', signature.length > 0,
        signature.join(',') || 'hiçbir şey');

    // SHIFT + W: yukarı atılma. Normal zıplamadan yükseğe çıkmalı ve
    // beklemeye girmeli, yoksa oyuncu normal zıplamayı hiç kullanmaz.
    await clearCds();
    await hold('KeyW', 60);
    await wait(280);
    const jumpTop = await page.evaluate(() => window.__game.p1.y);
    await page.evaluate(() => {
        const g = window.__game;
        g.p1.y = g.p1.groundY; g.p1.vy = 0;
        for (const id of Object.keys(g.p1.cooldowns)) g.p1.cooldowns[id] = 0;
    });
    await page.keyboard.down('ShiftLeft');
    await wait(60);
    await page.keyboard.down('KeyW');
    await wait(280);
    const dash = await page.evaluate(() => ({
        y: window.__game.p1.y,
        cd: window.__game.p1.cooldowns.dashUp
    }));
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    check('SHIFT+W atilmasi normal ziplamadan yukari cikiyor', dash.y < jumpTop,
        `zıplama ${Math.round(jumpTop)} / atılma ${Math.round(dash.y)}`);
    check('Atilmanin beklemesi var', dash.cd > 0, `${dash.cd} kare`);

    // --- Basamaklar ---
    // Tek yönlüler: altlarından zıplanınca üstlerine binilir, AŞAĞI tuşuyla
    // da inilir. İkisi de gerçek tuşla deneniyor.
    await clearCds();
    const ledge = await page.evaluate(() => {
        const g = window.__game;
        const low = g.ledges.reduce((a, b) => (b.y > a.y ? b : a));   // en alçak basamak
        g.p1.x = low.x + low.w / 2;
        g.p1.y = g.p1.groundY;
        g.p1.vy = 0;
        g.p1.grounded = true;
        g.p2.x = Math.min(g.canvas.width - 80, low.x + low.w + 220);  // yolumuzdan çekilsin
        return { count: g.ledges.length, top: low.y, floor: g.p1.floorFoot, foot: g.p1.footY };
    });
    check('Arenanin basamaklari var', ledge.count >= 2, `${ledge.count} basamak`);
    check('Basamak zeminin ustunde', ledge.floor - ledge.top >= 100,
        `${Math.round(ledge.floor - ledge.top)} piksel`);

    await hold('KeyW', 150);
    await wait(900);
    const onLedge = await page.evaluate(() => ({
        foot: window.__game.p1.footY,
        grounded: window.__game.p1.grounded
    }));
    check('Ziplayan oyuncu basamagin ustune biniyor',
        Math.abs(onLedge.foot - ledge.top) < 2 && onLedge.grounded,
        `ayak ${Math.round(onLedge.foot)} / basamak ${ledge.top}`);
    await shot('03i-basamak');

    await hold('KeyS', 150);
    await wait(700);
    const dropped = await page.evaluate(() => window.__game.p1.footY);
    check('ASAGI tusu basamaktan indiriyor', Math.abs(dropped - ledge.floor) < 2,
        `ayak ${Math.round(dropped)} / zemin ${ledge.floor}`);

    // Arenanın altındaki kombo kümesi: hiç kaybolmuyor
    const comboBar = await page.evaluate(() => {
        const c = document.getElementById('comboBar');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 70 || d[i + 1] > 70 || d[i + 2] > 70) lit++;
        }
        return { lit, w: c.width, h: c.height };
    });
    check('Kombo kumesi arenanin altinda ciziliyor', comboBar.lit > 500, JSON.stringify(comboBar));
    await shot('03h-kombo-kumesi');


    // Saldırı animasyonu: hamle çıkınca duruş başlıyor, süresi dolunca bitiyor
    await clearCds();
    const animLive = await page.evaluate(() => {
        const g = window.__game;
        g.p1.useAbility('basic');
        g.update();
        return { id: g.p1.anim?.id, t: g.p1.pose?.t, total: g.p1.anim?.total };
    });
    check('Saldirinca durus baslıyor',
        !!animLive.id && animLive.total > 0 && animLive.t >= 0 && animLive.t < 1,
        JSON.stringify(animLive));

    const animDone = await page.evaluate(() => {
        const g = window.__game;
        for (let i = 0; i < 200; i++) g.update();
        return { anim: g.p1.anim, pose: g.p1.pose };
    });
    check('Durus suresi dolunca bitiyor', animDone.anim === null && animDone.pose === null,
        JSON.stringify(animDone));

    // Raunt süresi geri sayıyor
    const timerBefore = await page.evaluate(() => +document.getElementById('round-timer').textContent);
    await wait(1300);
    const timerAfter = await page.evaluate(() => +document.getElementById('round-timer').textContent);
    check('Raunt suresi geri sayiyor', timerAfter < timerBefore, `${timerBefore} -> ${timerAfter}`);

    await clearCds();

    const battleFps = await measureFps(3000);
    check('Savas ekrani 50+ FPS', battleFps.fps >= 50, JSON.stringify(battleFps));

    // --- İki kol: her oyuncu kendi DualSense'iyle ---
    // İkinci sahte kol takılıyor: 1. kol 1. oyuncunun, 2. kol 2. oyuncunun.
    await page.evaluate(() => {
        window.__fakePad.index = 0;
        window.__fakePad2 = {
            index: 1,
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
            connected: true
        };
        navigator.getGamepads = () => [window.__fakePad, window.__fakePad2];
        window.dispatchEvent(new Event('gamepadconnected'));
    });
    // Yeni kolun analogu bir kez nötr okunmadan yön üretmiyor
    await wait(300);
    const padCount = await page.evaluate(() => window.__gamepad.padCount);
    check('Iki kol iki yuva olarak taniniyor', padCount === 2, `padCount ${padCount}`);

    const padControls = await page.evaluate(() => document.getElementById('p2-controls').textContent);
    check('Kolla oynayanin HUD unda kol kontrolu yaziyor',
        padControls.includes('analog'), padControls);

    // 2. kolun sol analogu yalnızca 2. oyuncuyu yürütmeli
    const posBefore = await page.evaluate(() => ({ p1: window.__game.p1.x, p2: window.__game.p2.x }));
    await page.evaluate(() => { window.__fakePad2.axes[0] = -1; });
    await wait(400);
    await page.evaluate(() => { window.__fakePad2.axes[0] = 0; });
    const posAfter = await page.evaluate(() => ({ p1: window.__game.p1.x, p2: window.__game.p2.x }));
    check('2. kolun analogu yalnizca 2. oyuncuyu yurutuyor',
        posAfter.p2 < posBefore.p2 - 20 && Math.abs(posAfter.p1 - posBefore.p1) < 1,
        `p1 ${Math.round(posBefore.p1)}->${Math.round(posAfter.p1)}, p2 ${Math.round(posBefore.p2)}->${Math.round(posAfter.p2)}`);

    // ÇARPI zıplatır: karakter zeminden kalkar
    await page.evaluate(() => { window.__fakePad2.buttons[0].pressed = true; });
    await wait(200);
    const padJumped = await page.evaluate(() => ({ y: window.__game.p2.y, vy: window.__game.p2.vy }));
    await page.evaluate(() => { window.__fakePad2.buttons[0].pressed = false; });
    check('CARPI ikinci oyuncuyu ziplatiyor', padJumped.y < 430, JSON.stringify(padJumped));
    await wait(700);   // yere insin

    // Güç tuşları yok: KARE/L1/R1 artık hiçbir şey yapmıyor, arenayı da
    // bozmamalı (basılınca hata atmamalı, oyun akmaya devam etmeli).
    await page.evaluate(() => { window.__fakePad2.buttons[2].pressed = true; });
    await wait(150);
    await page.evaluate(() => { window.__fakePad2.buttons[2].pressed = false; });
    await wait(150);
    check('Guc tuslari arenayi bozmuyor', await page.evaluate(() => window.__game.isRunning));

    await shot('03b-savas-iki-kol');

    // --- ICE-VİRÜS: kılıç, klon ve buz yolu ---
    // Sayılar data testinde; burada sınanan şey kuralların arenada İŞLEYİP
    // işlemediği. Oyun döngüsü elle adımlanıyor, girdi taklit edilmiyor.
    const iceReady = await page.evaluate(() => {
        const { FIGHTERS } = window.__fighters;
        const f = (id) => FIGHTERS.find(x => x.id === id);
        const g = window.__game;
        g.start(f('ice'), f('antivirus'));
        // Girişleri elle geçiyoruz: burada sınanan şey hamleler, giriş değil.
        for (let i = 0; i < 1200 && (g.intro || g.introQueue.length); i++) g.update();
        return { intro: !!g.intro, p1: g.p1.fighter.id, can: g.p1.maxHp };
    });
    check('Buz arenaya cikiyor', !iceReady.intro && iceReady.p1 === 'ice',
        JSON.stringify(iceReady));

    // Kılıç: vuruyor ve rakibi HAFİFÇE savuruyor. Savurma hasarın kendisi
    // kadar önemli - buz kendine bir kılıç boyu yer açıyor.
    const kilic = await page.evaluate(() => {
        const g = window.__game;
        g.combat.reset();
        g.p1.x = 500; g.p2.x = 500 + 90;
        g.p1.y = g.p1.groundY; g.p2.y = g.p2.groundY;
        g.p1.dir = 1; g.p2.vx = 0;
        const can0 = g.p2.hp;
        g.p1.cooldowns.sword = 0;
        g.p1.useAbility('basic');
        for (let i = 0; i < 20; i++) g.p1.stepAction();
        return { hasar: can0 - g.p2.hp, savurma: g.p2.vx };
    });
    check('Buz kilici vuruyor ve rakibi savuruyor',
        kilic.hasar > 0 && kilic.savurma > 0, JSON.stringify(kilic));

    // Klon: bir tane doğuyor, bekleme SONSUZ duruyor (klon yaşarken sayaç
    // işlemiyor), klon kırılınca bekleme başlıyor. "Aynı anda iki klon
    // olmaz" kuralı bunun kendiliğinden sonucu.
    const klon = await page.evaluate(() => {
        const g = window.__game;
        g.combat.reset();
        g.p1.cooldowns.clone = 0;
        g.p1.useAbility('special');
        const bir = g.combat.entities.filter(e => e.type === 'clone').length;
        const bekleme = g.p1.cooldowns.clone;
        // İkinci kez denemek yeni klon çıkarmamalı
        g.p1.useAbility('special');
        const iki = g.combat.entities.filter(e => e.type === 'clone').length;
        // Klonu kır: bekleme ancak şimdi saymaya başlamalı
        const c = g.combat.entities.find(e => e.type === 'clone');
        c.hp = 0;
        g.combat.update();
        return {
            bir, iki,
            beklemeYasarken: bekleme === Infinity,
            kalan: g.combat.entities.filter(e => e.type === 'clone').length,
            beklemeSonra: g.p1.cooldowns.clone
        };
    });
    check('Klon tek ve beklemesi ancak kirilinca basliyor',
        klon.bir === 1 && klon.iki === 1 && klon.beklemeYasarken &&
        klon.kalan === 0 && klon.beklemeSonra > 0 && klon.beklemeSonra < Infinity,
        JSON.stringify(klon));

    // Klon rakibin vuruşunu YİYOR: "hangisi asıl" sorusunun bedeli bu.
    const klonVurus = await page.evaluate(() => {
        const g = window.__game;
        g.combat.reset();
        g.p1.cooldowns.clone = 0;
        g.p1.useAbility('special');
        const c = g.combat.entities.find(e => e.type === 'clone');
        c.x = 600; c.footY = g.p2.footY;
        g.p2.x = 600 - 60; g.p2.y = g.p2.groundY; g.p2.dir = 1;
        const can0 = c.hp;
        const p2can0 = g.p1.hp;
        // Yakın dövüş hamlesi evreli: gerçek oyunda action Player'da kuruluyor
        g.p2.action = { ability: null, frame: 0 };
        g.combat.meleeHit(g.p2, { reach: 120, damage: 9 });
        // Hemen geri al: bu sahte action oyun döngüsüne kalırsa stepAction
        // bir sonraki karede null hamlenin lunge'ını okuyup patlıyor.
        g.p2.action = null;
        return { klonCan: can0 - c.hp, asilaGitmedi: g.p1.hp === p2can0 };
    });
    check('Klon rakibin vurusunu yiyor', klonVurus.klonCan > 0 && klonVurus.asilaGitmedi,
        JSON.stringify(klonVurus));

    // Buz yolu: ucu rakibe DENK GELİRSE donduruyor. Yolun ortası değil UCU -
    // yolun üstünden atlayan rakip donmuyor.
    const yol = await page.evaluate(() => {
        const g = window.__game;
        g.combat.reset();
        g.p1.x = 300; g.p2.x = 700;
        g.p1.y = g.p1.groundY; g.p2.y = g.p2.groundY;
        g.p1.dir = 1;
        g.p2.frozenFrames = 0; g.p2.freezeImmune = 0;
        g.p1.cooldowns.path = 0;
        g.p1.useAbility('signature');
        const yolVar = g.combat.entities.some(e => e.type === 'path');
        // Yol yavaş: bir karede rakibe ulaşmamalı
        g.combat.update();
        const ilkKare = g.p2.frozenFrames;
        for (let i = 0; i < 200 && g.p2.frozenFrames === 0; i++) g.combat.update();
        return { yolVar, ilkKare, donma: g.p2.frozenFrames };
    });
    check('Buz yolu uzayip rakibi donduruyor',
        yol.yolVar && yol.ilkKare === 0 && yol.donma > 0, JSON.stringify(yol));

    const donmus = await page.evaluate(() => {
        const g = window.__game;
        g.p2.frozenFrames = 60;
        g.p2.anim = null;
        g.p2.action = null;
        const x0 = g.p2.x;
        g.p2.pressed.attack = true;
        g.p2.handleActions();
        g.p2.held.left = true;
        for (let i = 0; i < 10; i++) g.p2.move();
        return { hamle: !!g.p2.anim, kayma: Math.abs(g.p2.x - x0) };
    });
    check('Donmus oyuncu ne hamle cikariyor ne yuruyor',
        !donmus.hamle && donmus.kayma < 1, JSON.stringify(donmus));

    // Bağışıklık: zincirleme donma yok.
    const bagisik = await page.evaluate(() => {
        const g = window.__game;
        g.p2.frozenFrames = 0;
        const bagisiklik = g.p2.freezeImmune;
        const dondu = g.p2.freeze();
        return { bagisiklik, dondu, donma: g.p2.frozenFrames };
    });
    check('Bagisiklik acikken tekrar donmuyor',
        bagisik.bagisiklik > 0 && !bagisik.dondu && bagisik.donma === 0,
        JSON.stringify(bagisik));

    // Rakip YÜKSEKTEYSE yol yukarı dönüyor: basamağa kaçmak tek cevap olmamalı.
    const tirmanis = await page.evaluate(() => {
        const g = window.__game;
        g.combat.reset();
        // Arena her açılışta rastgele: buzun yola çıkacağı yeri arenanın
        // İÇİNDE bırakacak bir basamak seçiliyor. Tuvalin dışından başlayan
        // yol daha ilk karede sönüyor.
        const ledge = g.ledges.find(s => s.x > 320) || g.ledges[0];
        g.p1.x = Math.max(140, ledge.x - 260);
        g.p1.y = g.p1.groundY;
        g.p1.dir = 1;
        g.p2.x = ledge.x + ledge.w / 2;
        g.p2.y = ledge.y - g.p2.height / 2;      // basamağın üstünde
        g.p2.frozenFrames = 0; g.p2.freezeImmune = 0;
        g.p1.cooldowns.path = 0;
        g.p1.useAbility('signature');
        for (let i = 0; i < 300; i++) g.combat.update();
        const e = g.combat.entities.find(x => x.type === 'path');
        return { dondu: g.p2.frozenFrames > 0, donduAmaYolBitti: !e };
    });
    check('Yol basamaktaki rakibin pesinden tirmaniyor', tirmanis.dondu,
        JSON.stringify(tirmanis));

    await page.evaluate(() => {
        const g = window.__game;
        g.combat.reset();
        g.p1.x = 420; g.p2.x = 820;
        g.p1.y = g.p1.groundY; g.p2.y = g.p2.groundY;
        g.p2.frozenFrames = 0; g.p2.freezeImmune = 0;
        g.p1.cooldowns.clone = 0; g.p1.cooldowns.path = 0;
        g.p1.dir = 1;
        g.p1.useAbility('special');
        g.p1.useAbility('signature');
        for (let i = 0; i < 30; i++) g.update();
    });
    await shot('03j-buz-klon-yol');

    // --- YAPAY ZEKÂ: ikinci oyuncuyu bilgisayar oynatıyor ---
    // Sınanan şey AI'nın iyi oynayıp oynamadığı değil (o oynanarak ayarlanır),
    // KURALLARA UYUP UYMADIĞI: tuşlara basıyor mu, klavye ondan bağımsız mı,
    // zorluk gerçekten fark ediyor mu.
    const aiMac = await page.evaluate(() => {
        const { FIGHTERS } = window.__fighters;
        const f = (id) => FIGHTERS.find(x => x.id === id);
        const g = window.__game;
        g.start(f('virus'), f('ice'), { ai: 'normal' });
        for (let i = 0; i < 1200 && (g.intro || g.introQueue.length); i++) g.update();
        g.phaseTimer = 0;

        const x0 = g.p2.x;
        const can0 = g.p1.hp;
        let hamle = 0;
        let yurudu = 0;
        let sonX = g.p2.x;
        for (let i = 0; i < 600; i++) {
            g.update();
            if (g.p2.anim) hamle++;
            if (Math.abs(g.p2.x - sonX) > 0.5) yurudu++;
            sonX = g.p2.x;
        }
        return {
            seviye: g.aiLevel,
            beyin: !!g.p2.brain,
            insanBeyni: !!g.p1.brain,
            yurudu,
            hamle,
            yaklasti: Math.abs(g.p2.x - g.p1.x) < Math.abs(x0 - g.p1.x),
            hasar: can0 - g.p1.hp
        };
    });
    check('Yapay zeka ikinci oyuncuyu oynatiyor',
        aiMac.beyin && !aiMac.insanBeyni && aiMac.seviye === 'normal', JSON.stringify(aiMac));
    check('Yapay zeka yuruyor, yaklasiyor ve vuruyor',
        aiMac.yurudu > 60 && aiMac.hamle > 20 && aiMac.yaklasti && aiMac.hasar > 0,
        JSON.stringify(aiMac));

    // AI ayrı bir yol açmıyor: TUŞA basıyor. Beyni durdurunca karakter de
    // durmalı - durmuyorsa bir yerde doğrudan hamle çağrılıyor demektir.
    const aiDurdu = await page.evaluate(() => {
        const g = window.__game;
        const beyin = g.p2.brain;
        g.p2.brain = null;
        g.p2.held = Object.fromEntries(Object.keys(g.p2.held).map(k => [k, false]));
        // Başlamış olan hamle ve atılma hızı temizleniyor: beyin alındığı an
        // devam eden bir savurma zaten vuracaktı, sınanan şey o değil.
        g.p2.action = null;
        g.p2.anim = null;
        g.p2.vx = 0;
        // Arenada yaşayan şeyler de temizleniyor: buzun klonu beyinden
        // bağımsız, kendi başına vurmaya devam ediyor (öyle de olmalı).
        g.combat.reset();
        const x0 = g.p2.x;
        const can0 = g.p1.hp;
        for (let i = 0; i < 180; i++) g.update();
        const sonuc = { kayma: Math.abs(g.p2.x - x0), hasar: can0 - g.p1.hp };
        g.p2.brain = beyin;
        return sonuc;
    });
    check('Beyin alininca yapay zeka duruyor',
        aiDurdu.kayma < 2 && aiDurdu.hasar === 0, JSON.stringify(aiDurdu));

    // Zorluk gerçekten fark etmeli: aynı karakterle zor, kolayı yenmeli.
    const zorluk = await page.evaluate(async () => {
        const { FighterAi } = await import('/src/game/ai.js');
        const { FIGHTERS } = window.__fighters;
        const f = (id) => FIGHTERS.find(x => x.id === id);
        const g = window.__game;
        let zor = 0;
        let kolay = 0;
        for (let m = 0; m < 3; m++) {
            g.start(f('virus'), f('virus'), { ai: 'zor' });
            g.p1.brain = new FighterAi(g.p1, 'kolay');
            for (let i = 0; i < 1200 && (g.intro || g.introQueue.length); i++) g.update();
            for (let i = 0; i < 3600 && !g.isGameOver; i++) g.update();
            zor += g.wins[2];
            kolay += g.wins[1];
        }
        return { zor, kolay };
    });
    check('Zor seviye kolayi yeniyor', zorluk.zor > zorluk.kolay, JSON.stringify(zorluk));

    // HUD'da tuş yerine "YAPAY ZEKÂ" yazmalı: o oyuncunun tuşu yok.
    const aiRozet = await page.evaluate(() => {
        const { FIGHTERS } = window.__fighters;
        const g = window.__game;
        g.start(FIGHTERS[0], FIGHTERS[1], { ai: 'zor' });
        g.hud.updateControlBadges(0);
        const p2 = document.getElementById('p2-controls').textContent;
        g.start(FIGHTERS[0], FIGHTERS[1]);
        g.hud.updateControlBadges(0);
        return { yapay: p2, insan: document.getElementById('p2-controls').textContent };
    });
    check('HUD yapay zekayi ve zorlugu yaziyor',
        aiRozet.yapay.includes('YAPAY ZEK') && aiRozet.yapay.includes('ZOR') &&
        !aiRozet.insan.includes('YAPAY'), JSON.stringify(aiRozet));
    // --- Giriş animasyonları: sıra ÖNCE P1, SONRA P2 ---
    // İki dövüşçünün de girişi varsa ikisi de oynar; tur ancak ikisi
    // bitince başlar ve o ana kadar kimse hareket edemez.
    await page.evaluate(() => {
        const { FIGHTERS } = window.__fighters;
        const f = (id) => FIGHTERS.find(x => x.id === id);
        window.__game.start(f('antivirus'), f('electro'));
    });
    await wait(250);
    const firstIntro = await page.evaluate(() => ({
        anahtar: window.__game.intro?.key,
        kuyruk: window.__game.introQueue.map(i => i.key),
        kare: window.__game.intro?.frame ?? -1,
        x: window.__game.p1.x
    }));
    check('Once P1 in girisi oynuyor, P2 ninki kuyrukta bekliyor',
        firstIntro.anahtar === 'antivirus' && firstIntro.kuyruk.join(',') === 'electro' && firstIntro.kare > 0,
        JSON.stringify(firstIntro));
    await shot('03d-p1-girisi');

    // Animasyon sırasında yürüme girdisi işlenmiyor
    await hold('KeyD', 250);
    const frozenX = await page.evaluate(() => window.__game.p1.x);
    check('Giris animasyonu bitene kadar oyuncu hareket etmiyor', frozenX === firstIntro.x,
        `${firstIntro.x} -> ${frozenX}`);

    // P1 in animasyonu bitince sıra P2 ye geçmeli, tur hâlâ başlamamalı
    await page.evaluate(() => { window.__game.intro.frame = window.__game.intro.frames - 1; });
    await wait(200);
    const secondIntro = await page.evaluate(() => ({
        anahtar: window.__game.intro?.key,
        kuyruk: window.__game.introQueue.length
    }));
    check('P1 bitince P2 nin girisi basliyor',
        secondIntro.anahtar === 'electro' && secondIntro.kuyruk === 0, JSON.stringify(secondIntro));
    await shot('03e-p2-girisi');

    // İkisi de bitince tur başlar
    await page.evaluate(() => { window.__game.intro.frame = window.__game.intro.frames - 1; });
    await wait(200);
    // Girişler bitti: raunt başı donmasını da geç, sonra yürümeye bak
    await page.evaluate(() => { window.__game.phaseTimer = 0; });
    await hold('KeyD', 250);
    const afterIntro = await page.evaluate(() => ({ intro: !!window.__game.intro, x: window.__game.p1.x }));
    check('Iki giris de bitince tur basliyor ve oyuncu yuruyor',
        !afterIntro.intro && afterIntro.x > firstIntro.x + 10, JSON.stringify(afterIntro));

    // --- Maç üç raunt: bir K.O. yalnızca raundu bitirir ---
    await page.evaluate(() => { window.__game.p1.takeDamage(9999); });
    await page.waitForFunction(() => window.__game.round === 2, { timeout: 8000 });
    const afterRound1 = await page.evaluate(() => ({
        raunt: window.__game.round,
        galibiyet: window.__game.wins[2],
        bitti: window.__game.isGameOver,
        can: window.__game.p1.hp,
        maxCan: window.__game.p1.maxHp
    }));
    check('Bir K.O. yalnizca raundu bitiriyor, mac surer',
        afterRound1.raunt === 2 && afterRound1.galibiyet === 1 && !afterRound1.bitti &&
        afterRound1.can === afterRound1.maxCan, JSON.stringify(afterRound1));
    await shot('03f-raunt-2');

    // --- Savaş sonu penceresi kolla: ÇARPI yeniden başlatır ---
    // İkinci raundu da alınca maç biter.
    await page.evaluate(() => { window.__game.phaseTimer = 0; });
    await page.waitForFunction(() => window.__game.phase === 'fight', { timeout: 8000 });
    await page.evaluate(() => { window.__game.p1.takeDamage(9999); });
    await page.waitForFunction(
        () => !document.getElementById('gameover-screen').classList.contains('hidden'),
        { timeout: 8000 });
    await wait(200);
    check('Savas sonu penceresinde kol ogretmesi var',
        await page.evaluate(() => !document.getElementById('gameover-pad-hint').classList.contains('hidden')));
    await shot('03c-savas-bitti');

    await page.evaluate(() => { window.__fakePad2.buttons[0].pressed = true; });
    await wait(300);
    await page.evaluate(() => { window.__fakePad2.buttons[0].pressed = false; });
    const restarted = await page.evaluate(() => ({
        kapandi: document.getElementById('gameover-screen').classList.contains('hidden'),
        calisiyor: window.__game.isRunning,
        can: window.__game.p1.hp
    }));
    check('CARPI savas sonunda yeniden baslatiyor',
        restarted.kapandi && restarted.calisiyor && restarted.can > 0, JSON.stringify(restarted));

    // --- GOLGE-VIRUS: kovalayan top, surusu, rakibin arkasina adim ---
    const golge = await page.evaluate(() => {
        const { FIGHTERS } = window.__fighters;
        const f = (id) => FIGHTERS.find(x => x.id === id);
        const g = window.__game;
        g.start(f('shadow'), f('virus'));
        for (let i = 0; i < 1500 && (g.intro || g.introQueue.length); i++) g.update();
        const out = { intro: !!g.intro, p1: g.p1.fighter.id };

        // Top: dogru ucuyor ve rakibin yuksekligine DOGRU KIVRILIYOR
        g.combat.reset();
        g.p1.x = 300; g.p2.x = 900;
        g.p1.y = g.p1.groundY; g.p2.y = g.p2.groundY - 140;
        g.p1.dir = 1;
        g.p1.cooldowns.shade = 0;
        g.p1.useAbility('basic');
        const shot = g.combat.entities.find(e => e.type === 'shot');
        const y0 = shot.y;
        for (let i = 0; i < 30; i++) g.combat.update();
        out.homing = { y0, y1: shot.y, hedefY: g.p2.y, kivrildi: shot.y < y0 - 5 };

        // Surusu: 6 kure, hepsi homing
        g.combat.reset();
        g.p1.cooldowns.swarm = 0;
        g.p1.useAbility('special');
        const kureler = g.combat.entities.filter(e => e.type === 'shot');
        out.surusu = { adet: kureler.length, homing: kureler.every(e => e.homing > 0) };

        // Gölge adımı: rakibin ARKASINA düşüyor ve vuruyor
        g.combat.reset();
        g.p1.x = 200; g.p2.x = 800; g.p2.dir = 1;     // rakip sağa bakıyor: arkası SOL
        g.p1.y = g.p1.groundY; g.p2.y = g.p2.groundY;
        const can0 = g.p2.hp;
        g.p2.invulnerable = false; g.p2.invulnFrames = 0;
        g.p1.cooldowns.shadowstep = 0;
        g.p1.useAbility('signature');
        out.adim = { x: Math.round(g.p1.x), rakipX: g.p2.x, hasar: can0 - g.p2.hp };
        return out;
    });
    check('Golge arenaya cikiyor', !golge.intro && golge.p1 === 'shadow', JSON.stringify(golge));
    check('Golge topu rakibin yuksekligine dogru kivriliyor', golge.homing.kivrildi, JSON.stringify(golge.homing));
    check('Golge surusu 6 kovalayan kure cikariyor', golge.surusu.adet === 6 && golge.surusu.homing, JSON.stringify(golge.surusu));
    check('Golge adimi rakibin arkasina dusup vuruyor',
        golge.adim.x < golge.adim.rakipX && golge.adim.rakipX - golge.adim.x < 150 && golge.adim.hasar > 0, JSON.stringify(golge.adim));
    await shot('03c-golge-virus');

    // Avci kulubesi bolumu: patikadan acikliga, kulube, yataklar, gorevler, gece, Fred yok
    const camp = await import('../src/adventure/campLayout.js');
    await page.evaluate(() => {
        window.__menu.stop();
        for (const id of ['menu-screen', 'comic-screen', 'selection-screen', 'battle-screen']) document.getElementById(id).classList.add('hidden');
        document.getElementById('adventure-screen').classList.remove('hidden');
        window.__camp.start();
    });
    const campFlush = async () => {
        for (let i = 0; i < 300; i++) {
            const busy = await page.evaluate(() => {
                const c = window.__camp;
                if (c.dialogue.active) c.dialogue.advance();
                return !!(c.seq || c.dialogue.active || c.curtain > 0.02 || c.curtainTarget > 0);
            });
            if (!busy) break;
            await wait(50);
        }
    };
    const campAt = (x, y) => page.evaluate((a) => { const c = window.__camp; c.player.x = a[0]; c.player.y = a[1]; c.action(); }, [x, y]);
    const campState = () => page.evaluate(() => {
        const c = window.__camp;
        return { area: c.area, phase: c.phase, day: c.day, felled: c.felled.size, tasks: c.tasks && Object.fromEntries(Object.entries(c.tasks).map(([k, t]) => [k, t.n])) };
    });
    const standAt = (t) => camp.treeStand(t);
    await wait(1200);
    await page.evaluate(() => { window.__camp.player.x = 760; window.__camp.player.y = 360; });
    const campTalked = await page.waitForFunction(() => window.__camp.dialogue.active, { timeout: 5000 }).then(() => true, () => false);
    check('Kulube: yol ayriminda konusma basliyor', campTalked);
    await campFlush();
    await page.evaluate(() => { window.__camp.player.x = 3170; window.__camp.player.y = 350; });
    await wait(300); await campFlush(); await wait(300);
    const atYard = await campState();
    check('Kulube: patikanin sonunda acikliga geciliyor', atYard.area === 'yard' && atYard.phase === 'toCabin', JSON.stringify(atYard));
    await campAt(camp.YARD_DOOR.x, camp.YARD_DOOR.y + 4); await wait(300); await campFlush(); await wait(300);
    check('Kulube: kapidan iceri girilince yataklari hazirla gorevi', (await campState()).phase === 'beds');
    await shot('00f-kulube-ic');
    await campAt(130, 310); await campFlush();
    await campAt(870, 310); await campFlush();
    check('Kulube: iki yatak hazirlaninca uyku gorevi', (await campState()).phase === 'sleep');
    await campAt(870, 310); await campFlush(); await wait(300);
    const day2 = await campState();
    const fredWake = await page.evaluate(() => ({ x: window.__camp.fred.x, y: window.__camp.fred.y, v: window.__camp.fred.visible }));
    check('Kulube: 2. gun gorevler ve Fred yataginin yaninda uyaniyor',
        day2.day === 2 && day2.phase === 'tasks' && day2.area === 'cabin' && fredWake.v
            && Math.abs(fredWake.x - camp.FRED_WAKE.x) < 4 && Math.abs(fredWake.y - camp.FRED_WAKE.y) < 4,
        JSON.stringify({ day2, fredWake }));
    await campAt(500, 500); await campFlush(); await wait(300);
    // Su: golet -> fici
    await campAt(camp.POND_SPOT.x, camp.POND_SPOT.y); await campFlush();
    check('Kulube: golden su alinca kova elde', await page.evaluate(() => window.__camp.carry === 'water'));
    await campAt(camp.BARREL_SPOT.x, camp.BARREL_SPOT.y); await campFlush();
    // Odun: uc agac Harry, biri Fred
    for (const i of [0, 1, 2]) { const p = standAt(camp.CHOP_TREES[i]); await campAt(p.x, p.y); await wait(1000); await campFlush(); }
    await shot('00f2-agac-devrildi');
    await page.evaluate(() => { const j = window.__camp.fredJob; j.hits = 11; j.cd = 1; });
    await page.waitForFunction(() => window.__camp.fredJob.done, { timeout: 20000 }).catch(() => {});
    await wait(1500); await campFlush(); await wait(1500);
    const evening = await campState();
    check('Kulube: odun (Fred dahil 4) + su bitince aksam, ates gorevi',
        evening.phase === 'fire' && evening.felled === 4 && evening.tasks.wood === 4 && evening.tasks.water === 1, JSON.stringify(evening));
    await campAt(camp.FIRE_PIT.x, camp.FIRE_PIT.y + 40); await campFlush(); await wait(300);
    check('Kulube: ates yakilinca eve girip uyuma gorevi', (await campState()).phase === 'toBed');
    await shot('00g-kulube-ates');
    await campAt(camp.YARD_DOOR.x, camp.YARD_DOOR.y + 4); await campFlush(); await wait(300);
    await campAt(870, 310); await campFlush(); await wait(300);
    const day3 = await campState();
    check('Kulube: 3. gun odun ve meyve gorevleri', day3.day === 3 && day3.phase === 'tasks' && day3.tasks.wood === 0 && day3.tasks.berries === 0, JSON.stringify(day3));
    await campAt(500, 500); await campFlush(); await wait(300);
    for (const i of camp.BUSHES.keys()) {
        if (i >= 3) break;
        const b = camp.BUSHES[i]; await campAt(b.x, b.y + 26); await campFlush();
    }
    for (const i of [3, 5, 6, 7, 8]) { const p = standAt(camp.CHOP_TREES[i]); await campAt(p.x, p.y); await wait(1000); await campFlush(); }
    await wait(1500); await campFlush(); await wait(1500);
    check('Kulube: 3. gun 5 odun + 3 meyve bitince aksam', (await campState()).phase === 'fire');
    await campAt(camp.FIRE_PIT.x, camp.FIRE_PIT.y + 40); await campFlush(); await wait(300);
    check('Kulube: 3. gun ates sonrasi yemek pisirme gorevi', (await campState()).phase === 'cook');
    await campAt(camp.FIRE_PIT.x, camp.FIRE_PIT.y + 40); await campFlush(); await wait(300);
    await shot('00h-kulube-yemek');
    check('Kulube: yemek pisince uyuma gorevi', (await campState()).phase === 'toBed');
    await page.evaluate(() => window.__camp.jump('night'));
    await wait(400);
    for (const sp of camp.SEARCH_SPOTS) { await campAt(sp.x, sp.y); await campFlush(); }
    check('Kulube: gece uc yer aranir, Fred yok, odasina git gorevi', (await campState()).phase === 'fredRoom');
    await campAt(camp.YARD_DOOR.x, camp.YARD_DOOR.y + 4); await wait(300); await campFlush(); await wait(300);
    await campAt(130, 310); await wait(400);
    await page.evaluate(() => { const c = window.__camp; while (c.dialogue.active) c.dialogue.advance(); });
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { const c = window.__camp; if (c.dialogue.active) c.dialogue.advance(); }); await wait(200); }
    await wait(1500);
    check('Kulube: Fred odasinda yok, bolum sona eriyor', (await campState()).phase === 'ending');
    await page.evaluate(() => { window.__camp.stop(); });

    // SAVAS BITTI penceresinde ANA MENUYE DON dugmesi: menuyu acar, pencereyi kapatir
    await page.evaluate(() => {
        const { FIGHTERS } = window.__fighters;
        window.__menu.stop();
        document.getElementById('battle-screen').classList.remove('hidden');
        window.__game.start(FIGHTERS[0], FIGHTERS[1]);
        window.__game.endGame(1);
    });
    await wait(300);
    const gameoverShown = await page.evaluate(() => !document.getElementById('gameover-screen').classList.contains('hidden'));
    await shot('03d-savas-bitti');
    await page.click('#gameover-menu-btn');
    await wait(400);
    const backToMain = await page.evaluate(() => ({
        gameover: !document.getElementById('gameover-screen').classList.contains('hidden'),
        menu: window.__menu.running,
        menuScreen: !document.getElementById('menu-screen').classList.contains('hidden')
    }));
    check('Savas bitince ANA MENUYE DON dugmesi ana menuyu aciyor',
        gameoverShown && !backToMain.gameover && backToMain.menu && backToMain.menuScreen, JSON.stringify({ gameoverShown, backToMain }));

    check('Konsol hatasi yok', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
    check('Basarisiz istek yok', failedUrls.length === 0, failedUrls.slice(0, 3).join(' | '));

    // --- Özet ---
    const passed = results.filter(r => r.passed).length;
    console.log(`\n===== ${passed}/${results.length} test gecti =====`);
    console.log('FPS ozeti:');
    console.log(`  ana menu          : ${JSON.stringify(menuFps)}`);
    console.log(`  savas ekrani      : ${JSON.stringify(battleFps)}`);

    await browser.close();
    process.exit(passed === results.length ? 0 : 1);
}

main().catch(async err => {
    console.error('TEST HATASI:', err);
    if (page) await shot('hata');
    if (browser) await browser.close();
    process.exit(1);
});
