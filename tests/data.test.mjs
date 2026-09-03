// Veri ve saf mantık testleri: tarayıcı gerektirmez, bir saniyede biter.
// Menü sahnesinin, kol okumasının, diyaloğun ve çizgi romanın tutarlılığını
// doğrular. Çalıştırma: npm run check

let passed = 0;
const failures = [];

function check(name, condition, detail = '') {
    if (condition) {
        passed++;
        return;
    }
    const line = `${name}${detail ? ` — ${detail}` : ''}`;
    failures.push(line);
    console.log(`KALDI  ${line}`);
}

// ---- Arena kadrosu ----
// Kadro artık ağdan gelmiyor: iki dövüşçü de elle çizilmiş. Kartta gösterilen
// sprite ile arenaya çıkan sprite aynı olmalı, yoksa seçtiğinden başkası çıkar.
const { FIGHTERS, fighterById } = await import('../src/game/fighters.js');
const { FIGHTER_SPRITES } = await import('../src/game/fighterArt.js');

check('kadroda üç dövüşçü var', FIGHTERS.length === 3, FIGHTERS.map(f => f.id).join(','));
check('kadro virüs, anti-virüs ve elektro-virüs',
    FIGHTERS.map(f => f.id).join(',') === 'virus,antivirus,electro');
check('dövüşçü kimlikleri benzersiz', new Set(FIGHTERS.map(f => f.id)).size === FIGHTERS.length);
check('her dövüşçünün çizimi var',
    FIGHTERS.every(f => typeof FIGHTER_SPRITES[f.id] === 'function'),
    Object.keys(FIGHTER_SPRITES).join(','));
check('çizimi olup kadroda olmayan dövüşçü yok',
    Object.keys(FIGHTER_SPRITES).every(id => FIGHTERS.some(f => f.id === id)));
check('her dövüşçünün canı ve hızı pozitif',
    FIGHTERS.every(f => f.stats.hp > 0 && f.stats.speed > 0));
check('virüs anti-virüsten dayanıklı, anti-virüs daha hızlı',
    fighterById('virus').stats.hp > fighterById('antivirus').stats.hp &&
    fighterById('antivirus').stats.speed > fighterById('virus').stats.speed);
// Elektro ortada duruyor: ne en dayanıklı ne en hızlı
const eStats = fighterById('electro').stats;
check('elektro-virüs can ve hızda ortada',
    eStats.hp < fighterById('virus').stats.hp && eStats.hp > fighterById('antivirus').stats.hp &&
    eStats.speed > fighterById('virus').stats.speed && eStats.speed < fighterById('antivirus').stats.speed,
    JSON.stringify(eStats));

// Giriş animasyonları: anti-virüs ve elektro-virüsün var, virüsün yok
const intro = await import('../src/game/fighterIntro.js');
check('kadronun üçünün de giriş animasyonu var',
    FIGHTERS.every(f => f.intro), FIGHTERS.filter(f => !f.intro).map(f => f.id).join(','));
check('her giriş anahtarının karşılığı var',
    FIGHTERS.filter(f => f.intro).every(f => intro.INTROS[f.intro]),
    Object.keys(intro.INTROS).join(','));
check('karşılığı olup kadroda kullanılmayan giriş yok',
    Object.keys(intro.INTROS).every(k => FIGHTERS.some(f => f.intro === k)));
check('her dövüşçünün girişi kendi anahtarını taşıyor',
    FIGHTERS.every(f => f.intro === f.id), FIGHTERS.map(f => `${f.id}:${f.intro}`).join(' '));
const introFrames = [intro.INTRO_FRAMES, intro.ANTIVIRUS_INTRO_FRAMES, intro.VIRUS_INTRO_FRAMES];
check('giriş animasyonları 3-6 saniye arası',
    introFrames.every(n => n >= 180 && n <= 360), introFrames.join(' / '));
check('bilinmeyen dövüşçü için null', fighterById('yok-boyle-biri') === null);
// ---- Ana menü sahnesi ----
// Menü gezilebilir bir sahne olduğu için yerleşimin iki şeyi garanti etmesi
// gerekir: antrenör başladığı yerde sıkışmamalı ve her iki kapıya da
// yürüyerek ulaşabilmeli. Bunu sahne üzerinde kaba bir BFS ile ölçüyoruz.
const menu = await import('../src/menu/menuLayout.js');
const { missingGlyphs } = await import('../src/pixel/pixelFont.js');
// Dövüşçü ADLARI piksel fontla da yazılabilmeli (açıklamalar yalnızca HTML'de
// duruyor, onlar için bu şart yok).
check('dövüşçü adlarında eksik harf yok',
    FIGHTERS.flatMap(f => missingGlyphs(f.name)).length === 0);

check('menü: başlangıç noktası boş', !menu.blocked(menu.START.x, menu.START.y));
check('menü: macera kemerinin içinden geçilemiyor', menu.blocked(500, 150));
check('menü: macera kemerinin önünde durulabiliyor', !menu.blocked(500, 250));
check('menü: portalın açıklığından geçilebiliyor', !menu.blocked(878, 250));
check('menü: portalın arkasından dışarı çıkılamıyor', menu.blocked(878, 175));
check('menü: portalın ayağından geçilemiyor', menu.blocked(828, 250));
check('menü: evin içine girilemiyor', menu.blocked(200, 180));

// Tabelalardaki yazının her harfi piksel yazı tipinde var mı?
for (const arch of [menu.ADVENTURE, menu.VERSUS]) {
    for (const line of arch.sign.lines) {
        const missing = missingGlyphs(line);
        check(`menü: "${line}" yazısı çizilebiliyor`, missing.length === 0, missing.join(','));
    }
}

// Ağaçların dibi patikaya, eve veya kapı önüne taşmamalı
const treeBases = menu.TREES.map(menu.treeBase);
const corridors = [
    { name: 'ana patika', rect: { x: 60, y: 258, w: 825, h: 64 } },
    { name: 'kemer kolu', rect: { x: 462, y: 210, w: 76, h: 90 } },
    { name: 'portal önü', rect: { x: 808, y: 190, w: 140, h: 180 } }
];
for (const corridor of corridors) {
    const clash = treeBases.filter(base => menu.rectsOverlap(base, corridor.rect));
    check(`menü: ${corridor.name} ağaçtan temiz`, clash.length === 0, `${clash.length} ağaç`);
}

// Başlangıçtan yürünerek nereye gidilebilir? (8 piksel adımlı ızgara)
const STEP = 8;
const seenCells = new Set();
const cellKey = (x, y) => `${x},${y}`;
const queue = [[Math.round(menu.START.x / STEP) * STEP, Math.round(menu.START.y / STEP) * STEP]];
seenCells.add(cellKey(queue[0][0], queue[0][1]));
let reachedGate = false;
let reachedDoor = false;

while (queue.length) {
    const [x, y] = queue.shift();
    if (menu.nearAdventureGate(x, y)) reachedGate = true;
    if (menu.inVersusPortal(x, y)) reachedDoor = true;
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx > menu.SCENE.w || ny > menu.SCENE.h) continue;
        const key = cellKey(nx, ny);
        if (seenCells.has(key) || menu.blocked(nx, ny)) continue;
        seenCells.add(key);
        queue.push([nx, ny]);
    }
}

check('menü: macera kapısının önüne yürüyerek ulaşılıyor', reachedGate);
check('menü: iki kişilik portala yürüyerek girilebiliyor', reachedDoor);
check('menü: gezilebilir alan makul büyüklükte', seenCells.size > 900, `${seenCells.size} kare`);

// ---- Oyun kolu (PS5 DualSense) ----
// readPad saf bir fonksiyon: ham kol anlık görüntüsünü yöne çevirir.
const { readPad, BUTTONS, DEADZONE } = await import('../src/core/gamepad.js');

const pad = (axes = [0, 0], down = []) => ({
    axes,
    buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: down.includes(i) }))
});

const idle = readPad(pad());
check('kol: boştayken yön sıfır', idle.x === 0 && idle.y === 0 && idle.magnitude === 0);
check('kol: boştayken basılı tuş yok', idle.pressed.length === 0);

const drift = readPad(pad([DEADZONE - 0.05, 0]));
check('kol: ölü bölge içindeki oynama yok sayılıyor', drift.magnitude === 0);

const pushed = readPad(pad([1, 0]));
check('kol: sağa itilince x pozitif', pushed.x > 0.99 && pushed.y === 0);
check('kol: tam itişte büyüklük 1', Math.abs(pushed.magnitude - 1) < 0.001);

const half = readPad(pad([0, -0.6]));
check('kol: yukarı itilince y negatif', half.y < 0 && half.x === 0);
check('kol: yarım itişte büyüklük 0-1 arası', half.magnitude > 0 && half.magnitude < 1);

const triangle = readPad(pad([0, 0], [BUTTONS.triangle]));
check('kol: ÜÇGEN basılı okunuyor', triangle.pressed.includes('triangle'));
check('kol: ÜÇGEN tek başına yön üretmiyor', triangle.magnitude === 0);

const dpad = readPad(pad([0, 0], [BUTTONS.dpadLeft]));
check('kol: D-pad sol yön üretiyor', dpad.x === -1 && dpad.y === 0 && dpad.magnitude === 1);

const diagonal = readPad(pad([0, 0], [BUTTONS.dpadUp, BUTTONS.dpadRight]));
check('kol: D-pad çaprazı normalize ediliyor',
    Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 0.001);

// Takılı kalmış eksen koruması: nötre dönmemiş analog yön üretmemeli
const { GamepadManager, PadSlot } = await import('../src/core/gamepad.js');
const stuckPad = pad([1, 0]);
const stuckSlot = new PadSlot();
stuckSlot.apply(stuckPad);
check('kol: nötre dönmemiş eksen yön üretmiyor', stuckSlot.state.magnitude === 0);
stuckSlot.apply(pad([0, 0]));
stuckSlot.apply(stuckPad);
check('kol: nötrü gördükten sonra analog çalışıyor', stuckSlot.state.magnitude === 1);

// İlk okuma basılma saymaz: kol yeni görüldüğünde basılı duran tuş,
// oyuncu basmış gibi işlenmemeli
const seedSlot = new PadSlot();
check('kol: ilk okumadaki basılı tuş basılma saymıyor',
    seedSlot.apply(pad([0, 0], [BUTTONS.cross])).length === 0);
check('kol: bırakılıp yeniden basılan tuş basılma sayılıyor',
    seedSlot.apply(pad([0, 0])).length === 0 &&
    seedSlot.apply(pad([0, 0], [BUTTONS.cross])).includes('cross'));

check('kol: ÜÇGEN standart eşlemede 3. tuş', BUTTONS.triangle === 3);
check('kol: Çarpı standart eşlemede 0. tuş', BUTTONS.cross === 0);

// ---- İki kol: her oyuncunun kendi kolu ----
// İki kişilik arenada tuşlar karışmamalı: 1. kolun KARE'si 1. oyuncunun,
// 2. kolun KARE'si 2. oyuncunun gücünü çalıştırır.
const twoPads = [
    { index: 0, ...pad([0, 0]) },
    { index: 1, ...pad([0, 0]) }
];
const manager = Object.create(GamepadManager.prototype);
manager.slots = [];
manager.handlers = [];
manager.slotHandlers = [];
manager.connected = true;
manager.allPads = () => twoPads;

const padEvents = [];
manager.onSlotButtonDown((slot, name) => padEvents.push(`${slot}:${name}`));
const firstPadEvents = [];
manager.onButtonDown(name => firstPadEvents.push(name));

manager.poll();   // ilk tarama yalnızca kolları tanıtır
check('kol: iki kol iki yuva açıyor', manager.padCount === 2);

twoPads[1].buttons[BUTTONS.square].pressed = true;
manager.poll();
check('kol: basılan tuş yalnızca kendi yuvasına yazılıyor',
    padEvents.length === 1 && padEvents[0] === '1:square', padEvents.join(','));
check('kol: 2. kolun tuşu 1. kol dinleyicisini tetiklemiyor',
    firstPadEvents.length === 0, firstPadEvents.join(','));
check('kol: tuş yalnızca kendi kolunda basılı görünüyor',
    manager.isDownAt(1, 'square') && !manager.isDownAt(0, 'square'));

twoPads[0].axes[0] = 1;
manager.poll();
check('kol: yuvaların analogları ayrı okunuyor',
    manager.stickAt(0).x > 0.99 && manager.stickAt(1).x === 0);
check('kol: 1. yuva stick() ile aynı', manager.stick().x === manager.stickAt(0).x);

// Kol çıkarılınca yuvası da gider; kalan kol 0. yuvaya kayar
twoPads.pop();
manager.poll();
check('kol: çıkarılan kolun yuvası siliniyor', manager.padCount === 1);
check('kol: olmayan yuva nötr okunuyor',
    manager.stickAt(1).magnitude === 0 && !manager.isDownAt(1, 'square'));

// Arena kol düzeni: ÇARPI zıplatır, sol analog yürütür. Güç tuşları YOK -
// virüslerin yetenekleri henüz yazılmadı.
const { PAD_JUMP_BUTTON, PLAYERS: ARENA_PLAYERS } = await import('../src/config/settings.js');
check('arena kolu: ÇARPI zıplatıyor', PAD_JUMP_BUTTON === 'cross');
check('arena kolu: zıplama tuşu kolda var olan bir tuş', BUTTONS[PAD_JUMP_BUTTON] !== undefined);
check('arena kolu: her oyuncuya bir kol',
    ARENA_PLAYERS[1].padSlot === 0 && ARENA_PLAYERS[2].padSlot === 1);

// ---- Diyalog ----
// Dublaj yok: yazı harf harf açılıyor, her birkaç harfte "bıt" sesi çıkıyor.
const { Dialogue, VOICE_PITCH } = await import('../src/adventure/dialogue.js');

const beeps = [];
const talk = new Dialogue({ onBeep: (who) => beeps.push(who) }).start([
    { speaker: 'biz', text: 'Merhaba dunya' },
    { speaker: 'arkadas', text: 'Evet' }
]);

check('diyalog: ilk satır girişte açılıyor', talk.active && talk.speaker === 'biz');
check('diyalog: başta hiçbir harf yazılmamış', talk.visibleText === '');
for (let i = 0; i < 6; i++) talk.step();
check('diyalog: yazı harf harf açılıyor',
    talk.visibleText.length > 0 && talk.visibleText.length < 'Merhaba dunya'.length,
    `"${talk.visibleText}"`);
check('diyalog: yazılırken ses çıkıyor', beeps.length > 0 && beeps.every(w => w === 'biz'));

talk.advance();
check('diyalog: ilk basış yazıyı tamamlıyor', talk.finishedTyping && talk.speaker === 'biz');
talk.advance();
check('diyalog: ikinci basış sonraki satıra geçiyor', talk.speaker === 'arkadas');

// Yazı bitince kendiliğinden ilerlemeli (oyuncu tuşa basmasa da)
let guard = 0;
while (talk.active && guard++ < 2000) talk.step();
check('diyalog: kendiliğinden ilerleyip bitiyor', !talk.active && guard < 2000, `${guard} kare`);

// Kesme: kapı kapanınca cümle ortasında kalmalı
const cutTalk = new Dialogue().start([{ speaker: 'biz', text: 'Yarim kalacak' }]);
cutTalk.step();
cutTalk.cut();
check('diyalog: cut() balonu anında kapatıyor', !cutTalk.active && cutTalk.visibleText === '');

// Boşlukta ses çıkmamalı, yoksa konuşma sürekli vızıltıya dönüyor
const spaceBeeps = [];
const spacey = new Dialogue({ onBeep: () => spaceBeeps.push(1) }).start([
    { speaker: 'biz', text: '          ' }
]);
for (let i = 0; i < 40; i++) spacey.step();
check('diyalog: boşluklarda ses çıkmıyor', spaceBeeps.length === 0, `${spaceBeeps.length} ses`);

// ---- Prologun konuşmaları ----
// Yazı tipi yalnızca büyük harf ve sınırlı noktalama içeriyor; bir karakter
// eksikse o harf ekranda hiç çizilmiyor ve cümlede boşluk kalıyor.
const lines = await import('../src/adventure/prologLines.js');
const allLines = Object.values(lines).flat();

check('konuşma: prologda replik var', allLines.length >= 12, `${allLines.length} replik`);

const missingInDialogue = [];
const unknownSpeakers = [];
for (const line of allLines) {
    const missing = missingGlyphs(line.text);
    if (missing.length) missingInDialogue.push(`"${line.text.slice(0, 20)}": ${missing.join('')}`);
    if (!VOICE_PITCH[line.speaker]) unknownSpeakers.push(line.speaker);
}
check('konuşma: bütün harfler yazı tipinde var', missingInDialogue.length === 0,
    missingInDialogue.slice(0, 3).join(' | '));
check('konuşma: her konuşanın ses perdesi tanımlı', unknownSpeakers.length === 0,
    [...new Set(unknownSpeakers)].join(','));

// Tek balona sığmayacak kadar uzun replik okunmuyor
const tooLong = allLines.filter(line => line.text.length > 150);
check('konuşma: hiçbir replik balona sığmayacak kadar uzun değil',
    tooLong.length === 0, tooLong.map(l => l.text.length).join(','));

// ---- Prologun insanları ----
// Arkadaşın sprite'ında turuncu bant hikâyenin tek ipucu; bir duruşta bile
// düşerse ipucu kırılır. Bu yüzden ızgara tutarlılığıyla birlikte test edilir.
const { FRIEND_FRAMES } = await import('../src/adventure/people.js');

const FRIEND_LETTERS = new Set(['k', 'h', 's', 'S', 'l', 'L', 'o', 'O', 'b', 'y', '.']);
let friendGridOk = true;
let friendLetterOk = true;
const bandMissing = [];

for (const [pose, frames] of Object.entries(FRIEND_FRAMES)) {
    frames.forEach((frame, i) => {
        if (frame.length !== 16) friendGridOk = false;
        if (frame.some(row => row.length !== 12)) friendGridOk = false;
        if (frame.some(row => [...row].some(ch => !FRIEND_LETTERS.has(ch)))) friendLetterOk = false;
        if (!frame.some(row => row.includes('o'))) bandMissing.push(`${pose}[${i}]`);
    });
}

check('arkadaş: bütün kareler 12x16 ızgarada', friendGridOk);
check('arkadaş: tanımsız renk harfi yok', friendLetterOk);
check('arkadaş: turuncu bant her duruşta görünüyor', bandMissing.length === 0, bandMissing.join(','));

// ---- Kontrol öğretmeleri ----
const controls = await import('../src/config/controls.js');
const { missingGlyphs: missing } = await import('../src/pixel/pixelFont.js');

const hintProblems = [];
for (const [action, control] of Object.entries(controls.CONTROLS)) {
    if (!control.key || !control.pad || !control.text) hintProblems.push(`${action}: eksik alan`);
    const labels = Array.isArray(control.key) ? control.key : [control.key];
    for (const text of [`İLE ${control.text}`, ...labels]) {
        const gone = missing(text);
        if (gone.length) hintProblems.push(`${action}: "${text}" -> ${gone.join('')}`);
    }
}
check('öğretme: her kontrolün klavye ve kol karşılığı var, harfleri yazı tipinde',
    hintProblems.length === 0, hintProblems.slice(0, 3).join(' | '));

check('öğretme: kanalizasyonun üç hamlesi de tanımlı',
    ['jump', 'slide', 'lane'].every(a => controls.CONTROLS[a]));
check('öğretme: ateş etme tanımlı (prolog 3, ilk silah)', !!controls.CONTROLS.fire);

// Öğretme bir kez gösterilir: aynı tuş her engelde tekrar yazılırsa sahnenin
// önüne geçiyor.
const hint = new controls.ControlHint();
check('öğretme: ilk çağrı gösteriyor', hint.show('jump') === true && hint.visible);
check('öğretme: aynı öğretme ikinci kez gösterilmiyor', hint.show('jump') === false);
check('öğretme: tanımsız eylem gösterilmiyor', hint.show('yok-boyle-bir-sey') === false);

for (let i = 0; i < controls.HINT_FADE_IN; i++) hint.step();
check('öğretme: açılınca tam görünür', hint.alpha > 0.99, String(hint.alpha));

hint.dismiss('jump');
check('öğretme: yapılınca sönmeye başlıyor', hint.frames <= controls.HINT_FADE_OUT);
for (let i = 0; i < controls.HINT_FADE_OUT + 2; i++) hint.step();
check('öğretme: sönünce ekrandan kalkıyor', !hint.visible && hint.alpha === 0);

const otherHint = new controls.ControlHint();
otherHint.show('slide');
otherHint.dismiss('jump');
check('öğretme: başka eylemin dismiss()i ekrandakini söndürmüyor',
    otherHint.frames > controls.HINT_FADE_OUT);

// ---- Kol: sağ analog (kayma) ----
// Kayma bir tuş değil eksen; readPad eşiği geçince sahte tuş üretiyor.
const { RSTICK_TRIGGER } = await import('../src/core/gamepad.js');
const padWithRight = (ry) => ({ axes: [0, 0, 0, ry], buttons: [] });

check('kol: sağ analog nötrken kayma yok',
    !readPad(padWithRight(0)).pressed.includes('rstickDown'));
check('kol: sağ analog hafif eğikken kayma yok',
    !readPad(padWithRight(RSTICK_TRIGGER - 0.1)).pressed.includes('rstickDown'));
check('kol: sağ analog aşağı çekilince kayma tetikleniyor',
    readPad(padWithRight(1)).pressed.includes('rstickDown'));
check('kol: sağ analog YUKARI çekilince kayma tetiklenmiyor',
    !readPad(padWithRight(-1)).pressed.includes('rstickDown'));
check('kol: sağ analog sol analogun yönünü bozmuyor',
    readPad(padWithRight(1)).magnitude === 0);

// ---- Prologun çizgi romanı ----
// Prolog oynanmıyor, kare kare anlatılıyor. Senaryonun güvenceleri: her
// bölümde yeterince kare olmalı, her karenin bir çizimi olmalı, her konuşanın
// sesi tanımlı olmalı ve ekrandaki her harf yazı tipinde bulunmalı.
const comic = await import('../src/comic/comicScript.js');
const { ComicPlayer, IN_FRAMES } = await import('../src/comic/ComicPlayer.js');

check('çizgi roman: kare kimlikleri benzersiz',
    new Set(comic.PANELS.map(p => p.id)).size === comic.PANELS.length);

check('çizgi roman: dört bölümün de kareleri var',
    comic.CHAPTERS.every(c => comic.panelsOfChapter(c.n).length >= 5),
    comic.CHAPTERS.map(c => comic.panelsOfChapter(c.n).length).join(','));

check('çizgi roman: her bölüm bir başlık kartıyla açılıyor',
    comic.CHAPTERS.every(c => comic.panelsOfChapter(c.n)[0].art === 'title'));

// Yazılmış bölümde en az bir HAREKETLİ kare olmalı: önemli anlar hareketle
// anlatılıyor (dökme, saate bakış, camın çatlaması, doğuş, tırmanış).
check('çizgi roman: yazılmış bölümde hareketli kare var',
    comic.CHAPTERS.filter(c => !c.still).every(c => comic.panelsOfChapter(c.n).some(p => p.motion > 0)),
    comic.CHAPTERS.map(c => comic.panelsOfChapter(c.n).filter(p => p.motion > 0).length).join(','));

// Bekleyen bölümlerde HİÇBİR ŞEY oynamamalı: sırayla yeniden tarif edilip
// çizilecekler, o güne kadar duruk duruyorlar.
check('çizgi roman: bekleyen bölümlerde hareket yok',
    comic.CHAPTERS.filter(c => c.still).every(c => comic.panelsOfChapter(c.n).every(p => !p.motion)),
    comic.CHAPTERS.filter(c => c.still).map(c => c.n).join(','));

// Tek çekim: devam eden kareler siyahtan açılmıyor. İlk kare devam OLAMAZ.
check('çizgi roman: ilk kare devam karesi değil', !comic.PANELS[0].cont);
check('çizgi roman: devam kareleri kendi bölümünün içinde',
    comic.PANELS.every((p, i) => !p.cont || (i > 0 && comic.PANELS[i - 1].chapter === p.chapter)));

const comicText = [
    ...comic.PANELS.filter(p => p.caption).map(p => p.caption),
    ...comic.PANELS.flatMap(p => (p.lines || []).map(l => l.text)),
    ...comic.CHAPTERS.flatMap(c => [c.title, c.subtitle].filter(Boolean))
];
const comicMissing = comicText.flatMap(t => missingGlyphs(t));
check('çizgi roman: bütün yazılar piksel yazı tipinde çizilebiliyor',
    comicMissing.length === 0, comicMissing.join(''));

const comicSpeakers = [...new Set(comic.PANELS.flatMap(p => (p.lines || []).map(l => l.speaker)))];
check('çizgi roman: her konuşanın ses perdesi tanımlı',
    comicSpeakers.every(s => VOICE_PITCH[s]), comicSpeakers.join(','));

check('çizgi roman: her balonun karede bir yeri var',
    comic.PANELS.flatMap(p => p.lines || []).every(l => Array.isArray(l.at) && l.at.length === 2));

// Yürütücü: kareler sırayla geçmeli, balon bitmeden kare atlanmamalı
const player = new ComicPlayer(comic.PANELS).start();
check('çizgi roman: ilk kare başlıkla açılıyor', player.panel.id === comic.PANELS[0].id);

// Hareketli kare: F önce hareketi sonuna sarar, kareyi ATLAMAZ
const motionIndex = comic.PANELS.findIndex(p => p.motion > 0);
player.enter(motionIndex);
const motionId = player.panel.id;
player.advance();
check('çizgi roman: F hareketli kareyi atlamıyor, sonuna sarıyor',
    player.panel.id === motionId && player.motionT === 1);
player.advance();
check('çizgi roman: hareket bitince F sonraki kareye geçiyor', player.panel.id !== motionId);

// Balonlu kare: F önce yazıyı tamamlar
const talkIndex = comic.PANELS.findIndex(p => p.lines && p.lines.length > 1);
player.enter(talkIndex);
const talkId = player.panel.id;
for (let i = 0; i < 6; i++) player.step();
player.advance();
check('çizgi roman: F önce balonu tamamlıyor',
    player.panel.id === talkId && player.dialogue.finishedTyping);

// Kare açılırken sönüm: ilk karede siyah, IN_FRAMES sonra tam görünür
player.enter(1);
check('çizgi roman: kare siyahtan açılıyor', player.alpha === 0);
for (let i = 0; i < IN_FRAMES; i++) player.step();
check('çizgi roman: açılma sönümü bitiyor', player.alpha === 1);

// Son kareden sonra biter (sonsuz döngü yok)
player.enter(comic.PANELS.length - 1);
player.frame = 99999;
player.advance();
check('çizgi roman: son kareden sonra bitiyor', player.finished && !player.running);

// ---- Dövüş hamleleri ----
// Üç dövüşçünün de üç kendi hamlesi (normal, özel, L1+ÜÇGEN) ve üç ortak
// atılması var. Ekranın altındaki kümenin dört dairesi buradan besleniyor.
const ab = await import('../src/game/abilities.js');
const { COMBAT: CFG, PLAYERS: PL } = await import('../src/config/settings.js');

check('her dövüşçünün normal, özel ve kendi hamlesi var',
    FIGHTERS.every(f => ab.ABILITIES[f.id]?.basic && ab.ABILITIES[f.id]?.special && ab.ABILITIES[f.id]?.signature),
    FIGHTERS.filter(f => !ab.ABILITIES[f.id]).map(f => f.id).join(','));
check('hamlesi olup kadroda olmayan dövüşçü yok',
    Object.keys(ab.ABILITIES).every(id => FIGHTERS.some(f => f.id === id)));

const allAbilities = FIGHTERS.flatMap(f => ab.abilitiesOf(f.id));
check('her hamlenin kimliği, adı ve simgesi var',
    allAbilities.every(a => a.id && a.name && a.icon && a.kind),
    allAbilities.filter(a => !(a.id && a.name && a.icon && a.kind)).map(a => a.id).join(','));
check('bir dövüşçünün hamle kimlikleri benzersiz',
    FIGHTERS.every(f => {
        const ids = ab.abilitiesOf(f.id).map(a => a.id);
        return new Set(ids).size === ids.length;
    }));
check('bekleme süreleri negatif değil', allAbilities.every(a => a.cooldown >= 0));

// Enfekte kol ıskalarsa bekleme YOK, yakalayınca var: bedeli tutunca ödeniyor
const grab = ab.ABILITIES.antivirus.signature;
check('enfekte kol ıskalayınca beklemesiz, yakalayınca beklemeli',
    grab.cooldown === 0 && grab.cooldownOnHit > 0,
    `${grab.cooldown} / ${grab.cooldownOnHit}`);
check('yakalanan kurtulmak için birden çok kez basıyor', grab.escapePresses > 1);
check('yakalamanın kendiliğinden bırakma süresi var', grab.maxHold > 0);

// Menzilli normal saldırılar yakın dövüşten az vurmalı: virüs mesafeyi
// kapatmak zorunda olduğu için tek vuruşu ağır.
check('virüsün yakın vuruşu menzillilerden sert',
    ab.ABILITIES.virus.basic.damage > ab.ABILITIES.antivirus.basic.damage &&
    ab.ABILITIES.virus.basic.damage > ab.ABILITIES.electro.basic.damage);
check('elektronun ışını antinin topundan az vuruyor',
    ab.ABILITIES.electro.basic.damage < ab.ABILITIES.antivirus.basic.damage);
check('elektronun ışını arenada kalıyor', ab.ABILITIES.electro.basic.life > 60);
check('küre üç el ateş ediyor ve kütleler büyük, yavaş',
    ab.ABILITIES.electro.special.volleys === 3 &&
    ab.ABILITIES.electro.special.massSpeed < ab.ABILITIES.antivirus.basic.speed &&
    ab.ABILITIES.electro.special.massRadius > ab.ABILITIES.antivirus.basic.radius);
check('küre üç el bitene kadar yaşıyor',
    ab.ABILITIES.electro.special.life >= ab.ABILITIES.electro.special.volleys *
        ab.ABILITIES.electro.special.volleyInterval);
check('saçılma her yöne yeterince top atıyor', ab.ABILITIES.antivirus.special.count >= 8);
check('bölünme birden çok parça çıkarıyor', ab.ABILITIES.virus.special.pieces > 1);
check('salgın izi yavaşlatıyor ama hasar vermiyor',
    ab.ABILITIES.virus.signature.slow > 0 && ab.ABILITIES.virus.signature.slow < 1 &&
    ab.ABILITIES.virus.signature.damage === undefined);

// Kümedeki dört daire: üç atılma + karakterin kendi hamlesi
for (const f of FIGHTERS) {
    const combos = ab.comboAbilities(f.id);
    check(`${f.id}: kümede dört daire var`, combos.length === 4, `${combos.length}`);
    check(`${f.id}: her dairenin kombo tuşu ve klavye yuvası var`,
        combos.every(c => c.padCombo?.length === 2 && c.keySlot));
    check(`${f.id}: kombolar hep L1 ile başlıyor`, combos.every(c => c.padCombo[0] === 'l1'));
    const second = combos.map(c => c.padCombo[1]);
    check(`${f.id}: kombolar aynı tuşa düşmüyor`, new Set(second).size === 4, second.join(','));
    const slots = combos.map(c => c.keySlot);
    check(`${f.id}: klavye komboları da aynı tuşa düşmüyor`, new Set(slots).size === 4, slots.join(','));
}
check('atılmaların beklemesi var: normal zıplama işlevsiz kalmasın',
    ab.DASHES.every(d => d.cooldown > 0));
check('atılmalar zıplamadan güçlü', ab.DASHES[0].velocity.y < -13);

// ---- Maç ve blok ayarları ----
check('maç üç raunt, iki raundu alan kazanıyor',
    CFG.maxRounds === 3 && CFG.roundsToWin === 2);
check('raunt süre sınırı var', CFG.roundFrames > 0);
check('blok basılı tutulmuyor: pencere kısa, bekleme uzun',
    CFG.blockWindow > 0 && CFG.blockCooldown > CFG.blockWindow);
check('blok özelleri yarı geçiriyor, temeli tamamen kesiyor',
    CFG.blockLeak > 0 && CFG.blockLeak < 1);

// İki oyuncu tek klavyede: hiçbir tuş iki kişide birden olmamalı
const keysOf = (n) => [...Object.values(PL[n].moveKeys), ...Object.values(PL[n].actionKeys)];
const p1Keys = keysOf(1);
const p2Keys = keysOf(2);
check('bir oyuncunun tuşları kendi içinde çakışmıyor',
    new Set(p1Keys).size === p1Keys.length && new Set(p2Keys).size === p2Keys.length);
check('iki oyuncunun tuşları birbirine karışmıyor',
    p1Keys.every(k => !p2Keys.includes(k)), p1Keys.filter(k => p2Keys.includes(k)).join(','));


// ---- Özet ----
console.log(`\n===== ${passed}/${passed + failures.length} veri testi geçti =====`);
if (failures.length) {
    console.log('\nBaşarısız olanlar:');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
}
