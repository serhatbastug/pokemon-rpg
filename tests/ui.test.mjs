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
    check('Dort dovuscu karti hazir', cardCount === 4, `${cardCount} kart`);
    const cardNames = await page.$$eval('.char-class', els => els.map(e => e.textContent));
    check('Kadro VIRUS, ANTI-VIRUS, ELECTRO-VIRUS, ICE-VIRUS',
        cardNames.join(',') === 'VİRÜS,ANTİ-VİRÜS,ELECTRO-VİRÜS,ICE-VİRÜS', cardNames.join(','));

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

    // Son kareden sonra ana menüye dönülüyor (orman henüz yok)
    await page.evaluate(() => {
        const p = window.__comic.player;
        p.enter(p.panels.length - 1);
        p.frame = 9999;
        p.advance();
    });
    await wait(400);
    const afterComic = await page.evaluate(() => ({
        menu: window.__menu.running,
        comic: window.__comic.running,
        screen: !document.getElementById('menu-screen').classList.contains('hidden')
    }));
    check('Cizgi roman bitince ana menuye donuyor',
        afterComic.menu && !afterComic.comic && afterComic.screen, JSON.stringify(afterComic));

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
    await page.waitForFunction(() => document.querySelectorAll('.char-card').length === 4, { timeout: 10000 });
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
