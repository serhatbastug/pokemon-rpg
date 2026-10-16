// Oynanış sahnesi: 3/4 görünümlü laboratuvarda Harry'yi yürütür.
//
// Akış bir DURUM (phase) dizisidir: oyuncu serbestçe yürür, doğru noktaya
// gelip F'ye basınca o durumun olayı oynar. Olaylar bir "dizi" (run) olarak
// yazılır: bekle / konuş / yürüt / koşula kadar bekle. Dizi sürerken oyuncu
// yürüyemez, yalnızca balonları F ile ilerletir.
//
//   talkFred -> (kapı vuruşu) -> toDoor -> (kapı deliği) -> openDoor ->
//   (Andrew izin ister, girer, konuşur) -> toScope -> (DNA taraması) ->
//   talkAndrew -> openAnnex (izolasyon kapısı açılır, ikinci oda görünür) ->
//   (Andrew cam hücreye yürür) -> lock -> (kilit) -> GECE: hücrede Andrew ile
//   içindeki ses konuşur -> patlama, elektrik kesilir, Andrew virüse dönüşür ->
//   (dönüşüm uzun sürer) -> Harry fenerle gelir, virüs onu KOVALAR (chase:
//   oynanır; sol çubuk yürür, sağ çubuk feneri çevirir) -> Fred'e varınca
//   uyarır, virüs duvarı yıkıp Fred'i yakalar -> getBattery (süre sınırlı) ->
//   throwBattery -> pil virüse değince Andrew'a döner, yerde kıvranır -> bitiş
//
// Dünya iki ekran genişliğinde; kamera Harry'yi (kesitlerde Andrew'ı) izler.
//
// Veri (replikler, bulgular) adventureScript.js'te; yerleşim labLayout.js'te.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import { hash } from '../pixel/pixelDraw.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { drawPerson } from './charSprites.js';
import { drawPortrait, PORTRAIT } from './portraits.js';
import { virusSprite } from '../game/fighterArt.js';
import {
    bakeLab, drawDoor, drawAnnexDoor, drawAnnexCover, drawCellDoor, drawConsole, drawSample,
    drawBrokenWall, drawBattery, drawDestructButton
} from './labArt.js';
import {
    PX, VIEW, START, NPCS, SPOTS, PLAYER_SPEED, PLAYER_SCALE, VIRUS_SCALE, CELL_INSIDE,
    VIRUS_CHASE_SPEED, FRED_SECONDS,
    blocked, near, cameraX
} from './labLayout.js';
import {
    LINES, OBJECTIVES, CONTROL_HINT, SCAN_TARGETS, NIGHT_CAPTION,
    CHASE_HINT_KEYS, CHASE_HINT_PAD, CAUGHT_CAPTION, FRED_LOST_CAPTION
} from './adventureScript.js';

const INTRO_FRAMES = 40;
const FADE_FRAMES = 70;
const BUBBLE_SCALE = 2;
const BUBBLE_MAX_W = 460;
const SPRITE_H = 64;
const HINT_FRAMES = 420;
const MORPH_FRAMES = 380;       // Andrew'ın virüse dönüşümü
const RELIGHT_FRAMES = 190;     // elektriğin geri gelmesi
const REVERT_FRAMES = 110;      // pilin değmesiyle Andrew'a dönüş
const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

const ANCHOR_PEEP = { andrew: [500, 150], other: [500, 520] };

// Kolda ÜÇGEN F'nin, ÇARPI da ilerletmenin karşılığı
const ACTION_BUTTONS = ['triangle', 'cross'];

export class AdventureScene {
    constructor({ canvas, input, gamepad, onExit, onFinish }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});
        this.onFinish = onFinish || (() => {});

        this.running = false;
        this.dialogue = new Dialogue({ onBeep: (who) => Sfx.talk(VOICE_PITCH[who] || 1) });

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio();
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();
            if (e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') this.action();
        });
        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') this.onExit();
            if (ACTION_BUTTONS.includes(button)) this.action();
        });
    }

    // --- Başlatma ---

    reset() {
        this.frame = 0;
        this.intro = INTRO_FRAMES;
        this.fade = 0;               // 0 açık .. FADE_FRAMES siyah
        this.fadingOut = false;
        this.dim = 0;                // sahnenin kararması (final)
        this.shake = 0;
        this.finished = false;

        this.player = { x: START.x, y: START.y, dir: START.dir, moving: false };
        this.npcs = {};
        for (const [id, def] of Object.entries(NPCS)) {
            this.npcs[id] = { id, ...def, moving: false, visible: true };
        }
        // Andrew kapı açılana kadar sahnede değil
        this.npcs.andrew = { id: 'andrew', who: 'andrew', x: 84, y: 140, dir: 'down', moving: false, visible: false };
        // Patlamadan sonra Andrew'ın yerini alan dev virüs (2 kişilik moddaki sprite)
        this.npcs.virus = { id: 'virus', kind: 'virus', x: 1580, y: 332, dir: 'left', moving: false, visible: false, grow: 1, pain: 0, alpha: 1 };

        this.annexOpen = 0;          // izolasyon kapısı: 0 kapalı .. 1 açık (perde de buna bağlı)
        this.annexTarget = 0;
        this.camX = 0;
        this.camFocus = 'player';    // kameranın izlediği: 'player' ya da NPC kimliği
        this.camOverride = null;     // verilirse kamera bu x'e bakar (kesit)
        this.doorOpen = 0;
        this.doorTarget = 0;
        this.cellClosed = 0;
        this.cellTarget = 0;
        this.consoleState = 'idle';
        this.sampleOnBench = false;  // Andrew'dan alınan DNA örneği mikroskop tezgâhında
        this.greenEyes = 0;
        this.caption = null;
        this.flash = 0;              // beyaz patlama parıltısı
        this.curtain = 0;            // zaman atlamasında siyah perde
        this.curtainTarget = 0;
        this.cellBroken = false;
        this.wallBroken = 0;
        this.lightsOut = false;
        this.flashlight = false;
        this.virusGlow = 0;          // karanlıkta virüsün çevresini aydınlatan yarıçap
        this.shards = [];
        this.debris = [];
        this.bolts = 0;              // pilin virüse çaktığı elektrik
        this.grab = null;            // virüsün Fred'i yakalaması
        this.fredDown = null;        // yere düşen Fred
        this.battery = { floor: false, projectile: null };
        this.morph = null;           // Andrew -> virüs dönüşümü
        this.revert = null;          // virüs -> Andrew (pil değince)
        this.chase = null;           // kovalamaca durumu
        this.hintUntil = 0;
        this.fredClock = 0;          // Fred'i kurtarma süresi (kare)
        this.aim = 0;                // fenerin yönü (radyan)
        this.moveAngle = 0;

        this.buttonPressed = 0;      // imha butonu
        this.collapse = null;        // laboratuvarın çöküşü
        this.relight = null;         // elektriğin geri gelişi
        this.phase = 'talkFred';
        this.overlay = null;
        this.seq = null;
        this.dialogue.cut();
        this.scan = null;
    }

    // entry: 'kapidaki-ses' (baştan) ya da 'o-gece' (kilitten sonraki gece bölümü)
    start(entry = 'kapidaki-ses') {
        if (!this.baked) this.baked = bakeLab();
        this.reset();
        this.entry = entry;
        if (entry === 'o-gece') this.beginNight();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic(entry === 'o-gece' ? 'night' : 'shadow');

        if (this.rafId) cancelAnimationFrame(this.rafId);
        const stepMs = 1000 / FRAME_RATE;
        let acc = 0;
        let last = performance.now();
        const loop = (now) => {
            if (!this.running) return;
            this.rafId = requestAnimationFrame(loop);
            acc += Math.min(now - last, stepMs * 3);
            last = now;
            if (acc < stepMs) return;
            while (acc >= stepMs) {
                acc -= stepMs;
                this.step();
            }
            this.draw();
        };
        this.rafId = requestAnimationFrame(loop);
    }

    // Bölüm 2: laboratuvar kilitlenmiş, Andrew cam hücrede; sahne karanlıkta açılır
    beginNight() {
        const { npcs } = this;
        this.annexOpen = this.annexTarget = 1;
        this.cellClosed = this.cellTarget = 1;
        this.consoleState = 'locked';
        Object.assign(npcs.andrew, { x: 1580, y: 332, dir: 'left', visible: true });
        this.curtain = this.curtainTarget = 1;
        this.phase = 'night';
        this.run([
            ...this.nightSteps(),
            { say: LINES.cellTalk },
            ...this.blastSteps()
        ]);
    }

    stop() {
        this.running = false;
        stopMusic();
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    // --- Dizi (olay akışı) ---
    //
    // Adımlar: { wait: n } | { say: [satırlar] } | { do: fn } |
    //          { walk: id, path: [[x, y], ...] } | { face: id, dir } |
    //          { until: fn } | { phase: ad }

    run(steps) {
        this.seq = { steps, i: 0, wait: 0, walking: null };
    }

    stepSeq() {
        const seq = this.seq;
        if (!seq) return;
        while (seq.i < seq.steps.length) {
            const s = seq.steps[seq.i];
            if (s.wait !== undefined) {
                if (seq.wait === 0) seq.wait = s.wait;
                seq.wait--;
                if (seq.wait > 0) return;
                seq.wait = 0;
            } else if (s.say) {
                if (!seq.talking) {
                    this.dialogue.start(s.say);
                    seq.talking = true;
                    return;
                }
                if (this.dialogue.active) return;
                seq.talking = false;
            } else if (s.do) {
                s.do();
            } else if (s.face) {
                this.actor(s.face).dir = s.dir;
            } else if (s.phase) {
                this.phase = s.phase;
            } else if (s.until) {
                if (!s.until()) return;
            } else if (s.walkAll) {
                // Birkaç kişi aynı anda yürür; hepsi varınca devam
                let done = true;
                for (const w of s.walkAll) {
                    const a = this.actor(w.id);
                    if (this.walkToward(a, w.to, w.speed || 2.6)) a.moving = false;
                    else done = false;
                }
                seq.playerWalk = true;
                if (!done) return;
                seq.playerWalk = false;
            } else if (s.walk) {
                const npc = this.actor(s.walk);
                const escort = s.escort ? this.actor(s.escort) : null;
                if (seq.walking === null) seq.walking = 0;
                seq.playerWalk = s.walk === 'player' || s.escort === 'player';
                if (seq.walking < s.path.length) {
                    this.walkToward(npc, s.path[seq.walking], s.speed || 2.2)
                        && seq.walking++;
                    if (escort) this.followBeside(escort, npc, (s.speed || 2.2) + 0.5);
                    return;
                }
                npc.moving = false;
                if (escort) escort.moving = false;
                seq.walking = null;
                seq.playerWalk = false;
            }
            seq.i++;
        }
        this.seq = null;
    }

    // Dizide 'player' Harry'yi, diğer kimlikler NPC'leri gösterir
    actor(id) {
        return id === 'player' ? this.player : this.npcs[id];
    }

    // Bir noktaya doğru adım atar; vardıysa true
    walkToward(npc, [tx, ty], speed) {
        const dx = tx - npc.x, dy = ty - npc.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed) {
            npc.x = tx;
            npc.y = ty;
            return true;
        }
        npc.x += (dx / dist) * speed;
        npc.y += (dy / dist) * speed;
        npc.moving = true;
        if (Math.abs(dy) >= Math.abs(dx)) npc.dir = dy < 0 ? 'up' : 'down';
        else npc.dir = dx < 0 ? 'left' : 'right';
        return false;
    }

    // Yürüyen birinin hemen arkasında ve yanında yürür (eşlik)
    followBeside(follower, leader, speed) {
        const tx = leader.x - 52, ty = leader.y + 12;
        if (Math.hypot(tx - follower.x, ty - follower.y) > 8) this.walkToward(follower, [tx, ty], speed);
        else follower.moving = false;
    }

    // --- Girdi ---

    action() {
        if (!this.running || this.fadingOut) return;
        // Konuşma sürüyorsa F balonu ilerletir
        if (this.dialogue.active) {
            this.dialogue.advance();
            return;
        }
        if (this.overlay?.type === 'scan') {
            this.scanPress();
            return;
        }
        if (this.seq || this.overlay) return;
        const spot = this.currentSpot();
        if (spot) this.interact(spot.id);
    }

    // Şu an etkileşilebilecek nokta (durumdan ve yakınlıktan çıkar)
    currentSpot() {
        const { x, y } = this.player;
        switch (this.phase) {
            case 'talkFred':
                return near(x, y, SPOTS.fred, this.npcs.fred.x, this.npcs.fred.y)
                    ? { id: 'fred', label: 'KONUŞ' } : null;
            case 'toDoor':
                return near(x, y, SPOTS.door) ? { id: 'peep', label: 'BAK' } : null;
            case 'openDoor':
                return near(x, y, SPOTS.door) ? { id: 'open', label: 'AÇ' } : null;
            case 'toScope':
                return near(x, y, SPOTS.microscope) ? { id: 'scope', label: 'İNCELE' } : null;
            case 'talkAndrew':
                return near(x, y, SPOTS.andrew, this.npcs.andrew.x, this.npcs.andrew.y)
                    ? { id: 'andrew', label: 'KONUŞ' } : null;
            case 'openAnnex':
                return near(x, y, SPOTS.annexDoor) ? { id: 'annex', label: 'AÇ' } : null;
            case 'lock':
                return near(x, y, SPOTS.console) ? { id: 'lock', label: 'KİLİTLE' } : null;
            case 'getBattery':
                return near(x, y, SPOTS.battery) ? { id: 'battery', label: 'PİLİ AL' } : null;
            case 'throwBattery':
                return { id: 'throw', label: 'FIRLAT' };
            default:
                return null;
        }
    }

    get objective() {
        return {
            talkFred: OBJECTIVES.talkFred,
            toDoor: OBJECTIVES.toDoor,
            openDoor: OBJECTIVES.openDoor,
            toScope: OBJECTIVES.toScope,
            talkAndrew: OBJECTIVES.talkAndrew,
            openAnnex: OBJECTIVES.openAnnex,
            lock: OBJECTIVES.lock,
            chase: OBJECTIVES.chase,
            getBattery: OBJECTIVES.getBattery,
            throwBattery: OBJECTIVES.throwBattery
        }[this.phase] || null;
    }

    // --- Olaylar ---

    interact(id) {
        const npcs = this.npcs;
        if (id === 'fred') {
            this.faceEachOther(npcs.fred);
            this.run([
                { say: LINES.fredTalk },
                { phase: 'knockWait' },
                { wait: 70 },
                ...this.knockSteps(),
                { say: LINES.knock },
                { phase: 'toDoor' }
            ]);
        } else if (id === 'peep') {
            this.run([
                { do: () => { this.overlay = { type: 'peep', t: 0 }; this.shake = 0; } },
                { wait: 40 },
                { say: LINES.peep },
                { do: () => { this.overlay = null; } },
                { phase: 'openDoor' }
            ]);
        } else if (id === 'open') {
            this.run([
                { say: LINES.doorStuck },
                { do: () => { this.doorTarget = 1; Sfx.slide(); } },
                { until: () => this.doorOpen >= 1 },
                { wait: 20 },
                { do: () => { npcs.andrew.visible = true; } },
                ...this.facing('left'),
                { say: LINES.entryAsk },
                { walk: 'andrew', path: [[84, 184], [150, 300], [214, 318]] },
                { do: () => { npcs.andrew.dir = 'right'; this.faceEachOther(npcs.andrew); } },
                { say: LINES.entry },
                { say: LINES.monologue },
                { say: LINES.mathBeat },
                // Andrew mikroskop tezgâhına yaklaşıp DNA örneğini veriyor
                { walk: 'andrew', escort: 'player', speed: 2.6, path: [[214, 358], [640, 358], [640, 236], [742, 234]] },
                { do: () => { npcs.andrew.dir = 'up'; } },
                { say: LINES.sampleAsk },
                { do: () => { this.sampleOnBench = true; Sfx.token(); } },
                { say: LINES.sampleDone },
                { do: () => { this.doorTarget = 0; Sfx.slide(); } },
                { phase: 'toScope' }
            ]);
        } else if (id === 'scope') {
            this.run([
                { say: LINES.scanStart },
                { do: () => this.beginScan() },
                { until: () => this.scan?.done },
                { wait: 30 },
                { do: () => { this.overlay = null; this.scan = null; } },
                { say: LINES.scanDone },
                { phase: 'talkAndrew' }
            ]);
        } else if (id === 'andrew') {
            this.run([
                { say: LINES.andrewCell },
                { phase: 'openAnnex' }
            ]);
        } else if (id === 'annex') {
            this.run([
                { do: () => { this.annexTarget = 1; Sfx.slide(); } },
                { until: () => this.annexOpen >= 1 },
                // Kamera izolasyon odasına kayar: içerisi ilk kez görünüyor
                { do: () => { this.camOverride = 1300; } },
                { wait: 120 },
                { say: LINES.annexOpen },
                { do: () => { this.camOverride = null; this.camFocus = 'andrew'; } },
                { walk: 'andrew', speed: 3.2, path: [[742, 358], [1040, 358], [1380, 344], [1450, 344], [1560, 332]] },
                { do: () => { npcs.andrew.dir = 'left'; this.camFocus = 'player'; this.consoleState = 'ready'; } },
                { phase: 'lock' }
            ]);
        } else if (id === 'lock') {
            this.run([
                { do: () => { this.cellTarget = 1; Sfx.metalSlam(); } },
                { until: () => this.cellClosed >= 1 },
                { do: () => { this.consoleState = 'locked'; Sfx.glassCrack(); } },
                { say: LINES.locked },
                { wait: 60 },
                { do: () => { this.fadingOut = true; } }
            ]);
        } else if (id === 'battery') {
            this.run([
                { do: () => { this.battery.floor = false; Sfx.token(); } },
                { say: LINES.batteryTake },
                { phase: 'throwBattery' }
            ]);
        } else if (id === 'throw') {
            this.run([
                { do: () => this.throwBattery() },
                { until: () => !this.battery.projectile },
                { do: () => this.hitVirus() },
                { wait: 110 },
                { say: LINES.afterThrow },
                { wait: 60 },
                ...this.exitSteps()
            ]);
        }
    }

    // Fred ayağa kalkmış halinden normal NPC'ye döner
    standFred() {
        const f = this.fredDown, fred = this.npcs.fred;
        if (f) Object.assign(fred, { x: f.x1 + 18, y: f.y1, dir: 'left', visible: true, moving: false });
        this.fredDown = null;
        this.grab = null;
    }

    // Çıkış: ışıklar gelir, yardımcılar kapıdan girer, hepsi kapıya yürür. Fred
    // kapının yanındaki imha butonuna basar, laboratuvar çökmeye başlar; hepsi
    // dışarı kaçar. Ardından araba sahnesi (DriveScene) gelir.
    exitSteps() {
        const { npcs } = this;
        const helpers = ['yardimci0', 'yardimci1', 'yardimci2'];
        const out = [84, 116];
        const hide = (...ids) => ({ do: () => ids.forEach(id => { this.actor(id).visible = false; }) });
        return [
            { say: LINES.leave },
            { do: () => {
                this.standFred();
                this.dim = 0;
                this.doorTarget = 1; Sfx.slide();
                helpers.forEach((id, i) => {
                    Object.assign(npcs[id], { x: 84 + (i - 1) * 24, y: 124 - i * 10, dir: 'down', visible: true, moving: false });
                });
            } },
            { wait: 60 },
            // Elektrik yavaşça, titreyerek geri gelir (bir anda değil)
            { do: () => { this.relight = { t: 0 }; Sfx.token(); } },
            { walkAll: [
                { id: 'yardimci0', to: [70, 250], speed: 3.2 },
                { id: 'yardimci1', to: [124, 272], speed: 3.2 },
                { id: 'yardimci2', to: [90, 300], speed: 3.2 },
                { id: 'player', to: [150, 360], speed: 2.8 },
                { id: 'fred', to: [200, 380], speed: 2.8 }
            ] },
            { walkAll: helpers.map((id, i) => ({ id, to: [out[0] + (i - 1) * 6, 112], speed: 3.0 })) },
            hide(...helpers),
            { walkAll: [
                { id: 'player', to: [84, 150], speed: 2.8 },
                { id: 'fred', to: [140, 152], speed: 2.8 }
            ] },
            { face: 'fred', dir: 'up' },
            { face: 'player', dir: 'down' },
            { wait: 20 },
            { say: LINES.destruct },
            { do: () => { this.buttonPressed = 1; this.collapse = { t: 0 }; Sfx.metalSlam(); Sfx.siren(); } },
            { wait: 60 },
            { say: LINES.collapseRun },
            { walkAll: [{ id: 'player', to: [84, 112], speed: 3.4 }] },
            hide('player'),
            { walkAll: [{ id: 'fred', to: [84, 112], speed: 3.4 }] },
            hide('fred'),
            { wait: 150 },
            { do: () => { this.fadingOut = true; } }
        ];
    }

    facing(dir) {
        return ['fred', 'yardimci0', 'yardimci1', 'yardimci2'].map(id => ({ face: id, dir }));
    }

    // Harry'ye (oyuncuya) dönük durmak
    faceEachOther(npc) {
        const dx = this.player.x - npc.x, dy = this.player.y - npc.y;
        if (Math.abs(dy) >= Math.abs(dx)) {
            npc.dir = dy < 0 ? 'up' : 'down';
            this.player.dir = dy < 0 ? 'down' : 'up';
        } else {
            npc.dir = dx < 0 ? 'left' : 'right';
            this.player.dir = dx < 0 ? 'right' : 'left';
        }
    }

    // Üç sert vuruş: ekran titriyor, herkes kapıya bakıyor
    knockSteps() {
        const hit = () => ({ do: () => { this.shake = 10; Sfx.metalSlam(); } });
        return [
            hit(), { wait: 42 }, hit(), { wait: 34 }, hit(), { wait: 50 },
            ...this.facing('left')
        ];
    }

    // Zaman atlaması: perde iner, gece olur. Yardımcılar gitmiş, Harry ve
    // Fred ana laboratuvarda; kamera cam hücredeki Andrew'da.
    nightSteps() {
        const { npcs } = this;
        return [
            { wait: 40 },
            { do: () => { this.curtainTarget = 1; } },
            { until: () => this.curtain >= 1 },
            { do: () => {
                this.caption = NIGHT_CAPTION;
                for (const id of ['yardimci0', 'yardimci1', 'yardimci2']) npcs[id].visible = false;
                this.player.x = 500; this.player.y = 380; this.player.dir = 'up';
                npcs.fred.x = 352; npcs.fred.y = 250; npcs.fred.dir = 'down';
                npcs.andrew.x = 1580; npcs.andrew.y = 332; npcs.andrew.dir = 'left';
                this.dim = 0.4;
                this.camFocus = 'andrew';
                this.snapCamera();
            } },
            { wait: 120 },
            { do: () => { this.caption = null; this.curtainTarget = 0; } },
            { wait: 70 }
        ];
    }

    // Patlama: cam paramparça, elektrik kesilir; Andrew'ın dönüşümü uzun sürer
    // (önce kıvranır, gözleri yanar, sonra virüs belirir). Ardından Harry fenerle
    // içeri girer, virüsü görür ve KOVALAMACA başlar.
    blastSteps() {
        return [
            { wait: 40 },
            { do: () => this.blast() },
            { until: () => !this.morph },
            { wait: 40 },
            { do: () => {
                this.player.x = 1004; this.player.y = 348; this.player.dir = 'right';
                this.flashlight = true;
                this.camFocus = 'player';
                Sfx.slide();
            } },
            { say: LINES.harryIn },
            { walk: 'player', speed: 2.2, path: [[1210, 348]] },
            { do: () => { this.virusGlow = 260; Sfx.ooze(); } },
            { wait: 50 },
            { say: LINES.harryShock },
            { wait: 20 },
            { do: () => this.startChase() }
        ];
    }

    startChase() {
        const { npcs } = this;
        this.phase = 'chase';
        this.chase = { stall: 0 };
        this.player.x = 1210; this.player.y = 348; this.player.dir = 'right';
        Object.assign(npcs.virus, { x: 1580, y: 332, dir: 'left', moving: true });
        this.virusGlow = 260;
        this.hintUntil = this.frame + 600;
        playMusic('boss');
    }

    // Virüs oyuncuyu yavaşça kovalar. Kapıdan geçemeyecek kadar iri: ara
    // duvarı yıkar. Oyuncu Fred'e varırsa uyarı sahnesi başlar; virüs
    // dokunursa sahne baştan.
    stepChase() {
        const v = this.npcs.virus, p = this.player, c = this.chase;
        if (c.stall > 0) {
            c.stall--;
            v.moving = false;
        } else {
            const dx = p.x - v.x, dy = Math.max(310, Math.min(390, p.y)) - v.y;
            const dist = Math.hypot(dx, dy) || 1;
            v.x += (dx / dist) * VIRUS_CHASE_SPEED;
            v.y += (dy / dist) * VIRUS_CHASE_SPEED * 0.6;
            v.dir = dx < 0 ? 'left' : 'right';
            v.moving = true;
        }
        if (!this.wallBroken && v.x <= 1100) {
            this.breakWall();
            c.stall = 60;
        }
        if (Math.abs(p.x - v.x) < 90 && Math.abs(p.y - v.y) < 48) {
            this.failScene(CAUGHT_CAPTION, () => {
                p.x = 1210; p.y = 348; p.dir = 'right';
                Object.assign(v, { x: 1580, y: 332, dir: 'left' });
                this.chase = { stall: 0 };
                this.phase = 'chase';
            });
            return;
        }
        if (p.x < 580) {
            this.phase = 'warn';
            this.chase = null;
            this.run([...this.fleeSteps(), ...this.rampageSteps()]);
        }
    }

    // Yenilgi: perde iner, yazı çıkar, sahne geri sarılır
    failScene(text, reset) {
        this.phase = 'failing';
        this.run([
            { do: () => { this.caption = text; this.curtainTarget = 1; Sfx.deny(); } },
            { until: () => this.curtain >= 1 },
            { do: reset },
            { wait: 100 },
            { do: () => { this.caption = null; this.curtainTarget = 0; } },
            { wait: 40 }
        ]);
    }

    // Harry Fred'in yanına varır, uyarır; virüs duvardan gelip Fred'i yakalar
    fleeSteps() {
        const { npcs } = this;
        return [
            { do: () => { npcs.virus.moving = false; } },
            { walk: 'player', speed: 3.4, path: [[380, 410]] },
            { do: () => { this.faceEachOther(npcs.fred); this.camOverride = 560; } },
            { say: LINES.harryWarn },
            { do: () => { if (!this.wallBroken) this.breakWall(); } },
            { do: () => { npcs.fred.dir = 'right'; this.player.dir = 'right'; } },
            { wait: 30 },
            { say: LINES.wallBreak }
        ];
    }

    // Virüs Fred'i yakalayıp yerden yere vurur; Harry'ye pil kalır
    rampageSteps() {
        return [
            { walk: 'virus', speed: 3.2, path: [[560, 350]] },
            { do: () => { this.grab = { state: 'reach', t: 0, hand: null }; this.battery.floor = true; } },
            { until: () => this.grab.state === 'swing' },
            { say: LINES.fredCaught },
            { do: () => {
                this.camOverride = null; this.camFocus = 'player'; this.player.dir = 'right';
                this.fredClock = FRED_SECONDS * FRAME_RATE;
            } },
            { phase: 'getBattery' }
        ];
    }

    // Süre dolunca Fred dayanamaz: yakalanma anına dönülür
    fredLost() {
        this.failScene(FRED_LOST_CAPTION, () => {
            const p = this.player;
            p.x = 380; p.y = 410; p.dir = 'right';
            this.battery.floor = true;
            this.battery.projectile = null;
            if (this.grab) this.grab.t = 0;
            this.fredClock = FRED_SECONDS * FRAME_RATE;
            this.phase = 'getBattery';
        });
    }

    blast() {
        const { npcs } = this;
        this.flash = 1;
        this.shake = 50;
        Sfx.explosion();
        stopMusic();
        this.cellBroken = true;
        this.lightsOut = true;
        this.dim = 0;
        this.greenEyes = 1;
        Object.assign(npcs.virus, { visible: true, x: 1580, y: 332, dir: 'left', grow: 0.5, alpha: 0 });
        npcs.andrew.alpha = 1;
        this.morph = { t: 0 };
        this.virusGlow = 120;
        for (let i = 0; i < 46; i++) {
            this.shards.push({
                x: 1430 + hash(i, 21, 1) * 300, y: 250 + hash(i, 22, 2) * 150,
                vx: (hash(i, 23, 3) - 0.5) * 9, vy: -2 - hash(i, 24, 4) * 7,
                floor: 372 + hash(i, 25, 5) * 62, s: 4 + Math.round(hash(i, 26, 6) * 2) * 2
            });
        }
    }

    breakWall() {
        this.wallBroken = 1;
        this.shake = 40;
        Sfx.explosion();
        for (let i = 0; i < 30; i++) {
            this.debris.push({
                x: 1020 + (hash(i, 31, 1) - 0.5) * 40, y: 200 + hash(i, 32, 2) * 220,
                vx: (hash(i, 33, 3) - 0.7) * 12, vy: -3 - hash(i, 34, 4) * 6,
                floor: 380 + hash(i, 35, 5) * 80, s: 8 + Math.round(hash(i, 36, 6) * 3) * 4,
                c: hash(i, 37, 7) > 0.5 ? '#9aa4a9' : '#6d797f'
            });
        }
    }

    throwBattery() {
        const p = this.player, v = this.npcs.virus;
        p.dir = 'right';
        this.battery.projectile = { t: 0, x0: p.x + 12, y0: p.y - 44, x1: v.x - 40, y1: v.y - 150 };
        Sfx.slide();
    }

    // Pil virüse çarpar: elektrik çakar, virüs Fred'i bırakır ve eriyip Andrew'a
    // döner; Andrew yerde acıyla kıvranır.
    hitVirus() {
        const v = this.npcs.virus;
        v.pain = 1;
        v.moving = false;
        this.revert = { t: 0 };
        this.phase = 'ending';
        this.bolts = 400;
        this.shake = 30;
        this.flash = 0.6;
        Sfx.metalSlam();
        Sfx.status();
        const g = this.grab;
        if (g && g.state === 'swing') {
            g.state = 'released';
            g.t = 0;
            this.fredDown = { t: 0, x0: g.hand.x, y0: g.hand.y + 32, x1: v.x - 230, y1: v.y + 18 };
        }
    }

    // --- DNA taraması ---

    beginScan() {
        this.overlay = { type: 'scan' };
        this.scan = { x: 500, y: 300, found: [], done: false, flash: 0 };
    }

    scanPress() {
        const scan = this.scan;
        if (!scan || scan.done) return;
        const hit = SCAN_TARGETS.find(t => !scan.found.includes(t.id)
            && Math.hypot(scan.x - t.x, scan.y - t.y) <= t.r);
        if (!hit) {
            Sfx.deny();
            return;
        }
        scan.found.push(hit.id);
        scan.flash = 20;
        Sfx.token();
        this.dialogue.start([hit.line]);
        if (scan.found.length === SCAN_TARGETS.length) scan.pendingDone = true;
    }

    stepScan() {
        const scan = this.scan;
        if (!scan) return;
        if (scan.flash > 0) scan.flash--;
        if (scan.pendingDone && !this.dialogue.active) scan.done = true;
        if (scan.done || this.dialogue.active) return;

        const { input } = this;
        let dx = 0, dy = 0;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;
        let speed = 6;
        if (dx === 0 && dy === 0 && this.gamepad) {
            const stick = this.gamepad.stick();
            if (stick.magnitude > 0) { dx = stick.x; dy = stick.y; speed = 6 * stick.magnitude; }
        }
        const len = Math.hypot(dx, dy) || 1;
        scan.x = Math.max(90, Math.min(910, scan.x + (dx / len) * speed));
        scan.y = Math.max(140, Math.min(470, scan.y + (dy / len) * speed));
    }

    // --- Adım ---

    step() {
        this.frame++;
        if (this.intro > 0) this.intro--;
        this.gamepad?.poll();
        if (this.shake > 0) this.shake--;

        // Kapılar yumuşakça açılıp kapanır
        this.doorOpen += Math.sign(this.doorTarget - this.doorOpen) * Math.min(0.035, Math.abs(this.doorTarget - this.doorOpen));
        this.cellClosed += Math.sign(this.cellTarget - this.cellClosed) * Math.min(0.04, Math.abs(this.cellTarget - this.cellClosed));

        this.annexOpen += Math.sign(this.annexTarget - this.annexOpen) * Math.min(0.025, Math.abs(this.annexTarget - this.annexOpen));
        this.updateCamera();
        this.stepEffects();

        if (this.overlay?.type === 'peep') this.overlay.t++;
        this.dialogue.step();
        this.stepScan();
        this.stepSeq();

        const free = !this.seq && !this.overlay && !this.dialogue.active && !this.fadingOut && this.intro === 0;
        if (free) this.movePlayer();
        else if (!this.seq?.playerWalk) this.player.moving = false;
        this.updateAim(free);

        if (free && this.phase === 'chase' && this.chase) this.stepChase();
        if (free && (this.phase === 'getBattery' || this.phase === 'throwBattery') && this.fredClock > 0) {
            if (--this.fredClock === 0) this.fredLost();
        }

        if (this.fadingOut) {
            this.fade = Math.min(FADE_FRAMES, this.fade + 1);
            if (this.fade >= FADE_FRAMES && !this.finished) {
                this.finished = true;
                this.running = false;
                this.onFinish(this.entry);
            }
        }
    }

    // Kamera: odak (Harry ya da Andrew) yatayda izlenir; kapı kapalıyken ara
    // duvarın ötesine geçemez. camOverride kesitlerde odağı sabitler.
    updateCamera() {
        const target = cameraX(this.focusX(), this.annexOpen > 0.5);
        this.camX += (target - this.camX) * 0.07;
        if (Math.abs(target - this.camX) < 0.5) this.camX = target;
    }

    focusX() {
        return this.camOverride !== null ? this.camOverride : this.actor(this.camFocus).x;
    }

    // Kamerayı kaydırmadan hemen odağa koyar (zaman atlamasında)
    snapCamera() {
        this.camX = cameraX(this.focusX(), this.annexOpen > 0.5);
    }

    // --- Gece sahnesi: parçacıklar, virüsün adımları, yakalama ---

    stepEffects() {
        if (this.flash > 0) this.flash = Math.max(0, this.flash - 0.025);
        this.curtain += Math.sign(this.curtainTarget - this.curtain) * Math.min(0.03, Math.abs(this.curtainTarget - this.curtain));
        if (this.bolts > 0) this.bolts--;
        const rl = this.relight;
        if (rl) {
            rl.t++;
            if (rl.t === 100) playMusic('ruin');
            if (rl.t >= RELIGHT_FRAMES) {
                this.relight = null;
                this.lightsOut = false;
                this.flashlight = false;
            }
        }
        const col = this.collapse;
        if (col) {
            col.t++;
            this.shake = Math.max(this.shake, 6 + Math.min(10, col.t / 20));
            if (col.t % 40 === 1) { Sfx.explosion(); }
            if (col.t % 3 === 0) {
                const i = col.t;
                this.debris.push({
                    x: this.camX + hash(i, 41, 1) * VIEW.w, y: -12,
                    vx: (hash(i, 42, 2) - 0.5) * 3, vy: 3 + hash(i, 43, 3) * 4,
                    floor: 150 + hash(i, 44, 4) * 380, s: 8 + Math.round(hash(i, 45, 5) * 3) * 4,
                    c: hash(i, 46, 6) > 0.5 ? '#9aa4a9' : '#6d797f'
                });
                if (this.debris.length > 260) this.debris.splice(0, 20);
            }
        }

        for (const list of [this.shards, this.debris]) {
            for (const p of list) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.y >= p.floor) {
                    p.y = p.floor;
                    p.vy = -Math.abs(p.vy) * 0.3;
                    p.vx *= 0.7;
                    if (Math.abs(p.vy) < 0.8) { p.vy = 0; p.vx = 0; }
                } else {
                    p.vy += 0.5;
                }
            }
        }

        const v = this.npcs.virus, a = this.npcs.andrew;
        const m = this.morph;
        if (m) {
            m.t++;
            const u = Math.min(1, m.t / MORPH_FRAMES);
            const ramp = (from, to) => Math.max(0, Math.min(1, (u - from) / (to - from)));
            v.grow = 0.5 + 0.5 * u;
            v.alpha = ramp(0.4, 0.95);
            a.alpha = 1 - ramp(0.3, 0.8);
            this.virusGlow = 120 + 140 * u;
            if (m.t % 50 === 0) { Sfx.ooze(); this.shake = Math.max(this.shake, 8 + Math.round(u * 12)); }
            if (m.t % 95 === 40) this.flash = Math.max(this.flash, 0.3);
            if (m.t >= MORPH_FRAMES) {
                this.morph = null;
                a.visible = false;
                this.greenEyes = 0;
                v.alpha = 1;
            }
        }
        const rv = this.revert;
        if (rv) {
            rv.t++;
            const u = Math.min(1, rv.t / REVERT_FRAMES);
            v.grow = 1 - 0.45 * u;
            v.alpha = 1 - u;
            a.visible = true;
            a.lying = true;
            a.x = v.x;
            a.y = v.y;
            a.alpha = u;
            this.virusGlow = 330 * (1 - u);
            if (u >= 1) {
                this.revert = null;
                v.visible = false;
                v.pain = 0;
                this.virusGlow = 0;
                a.alpha = 1;
                // Andrew bayıldı: kıpırdamıyor; Fred toparlanıp ayağa kalkıyor
                a.limp = true;
                if (this.fredDown) this.fredDown.up = 0;
            }
        }
        if (v.visible) {
            if (!m && !rv && v.grow < 1) v.grow = Math.min(1, v.grow + 0.018);
            // Dev adımlar: yer sarsılıyor
            if (v.moving && this.frame % 24 === 0) {
                this.shake = Math.max(this.shake, 5);
                Sfx.step();
            }
        }

        const pr = this.battery.projectile;
        if (pr) {
            pr.t++;
            if (pr.t >= 34) this.battery.projectile = null;
        }

        this.stepGrab();
        const fd = this.fredDown;
        if (fd) {
            fd.t++;
            if (fd.up !== undefined && fd.up < 1) fd.up = Math.min(1, fd.up + 1 / 60);
            if (fd.t === 30) {
                this.shake = Math.max(this.shake, 12);
                Sfx.metalSlam();
            }
        }
    }

    // Virüsün sol kolunun sarkık durumdaki el noktası
    restHand(v) {
        const b = PX * VIRUS_SCALE * v.grow;
        return { x: v.x - 21 * b, y: v.y - 7 * b };
    }

    stepGrab() {
        const g = this.grab;
        if (!g) return;
        const v = this.npcs.virus, fred = this.npcs.fred;
        g.t++;
        const rest = this.restHand(v);
        if (g.state === 'reach') {
            const u = Math.min(1, g.t / 40);
            const e = u * u * (3 - 2 * u);
            g.hand = { x: rest.x + (fred.x - rest.x) * e, y: rest.y + (fred.y - rest.y) * e };
            if (g.t >= 40) {
                g.state = 'swing';
                g.t = 0;
                fred.visible = false;
                Sfx.ooze();
            }
        } else if (g.state === 'swing') {
            // 80 karelik döngü: kaldır, yere çak, bekle
            const u = g.t % 80;
            const low = v.y - 70, high = v.y - 300;
            let y;
            if (u < 30) { const k = u / 30; y = low + (high - low) * (1 - (1 - k) * (1 - k)); }
            else if (u < 38) { const k = (u - 30) / 8; y = high + (low - high) * k * k; }
            else y = low;
            const base = v.x - 150;
            const x = base + (fred.x - base) * Math.max(0, 1 - g.t / 40);
            g.hand = { x, y };
            if (u === 38) {
                this.shake = Math.max(this.shake, 8);
                Sfx.metalSlam();
            }
        } else {
            g.hand = { x: rest.x + Math.sin(this.frame * 0.4) * 5, y: rest.y + Math.sin(this.frame * 0.3) * 6 };
        }
    }

    movePlayer() {
        const { input, player } = this;
        let dx = 0, dy = 0;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;

        let speed = PLAYER_SPEED;
        if (dx === 0 && dy === 0 && this.gamepad) {
            const stick = this.gamepad.stick();
            if (stick.magnitude > 0) {
                dx = stick.x;
                dy = stick.y;
                speed = PLAYER_SPEED * stick.magnitude;
            }
        }
        player.moving = dx !== 0 || dy !== 0;
        if (!player.moving) return;
        this.moveAngle = Math.atan2(dy, dx);

        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;
        const opts = { cellDoorClosed: this.cellClosed > 0.4, annexDoorClosed: this.annexOpen < 0.6 };
        if (!blocked(player.x + vx, player.y, opts)) player.x += vx;
        if (!blocked(player.x, player.y + vy, opts)) player.y += vy;

        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
    }

    // Fenerin yönü. Kovalamacada sağ çubuk (kol) feneri istediği yöne çevirir ve
    // Harry de oraya bakar; çubuk boşsa fener yürünen yöne bakar (klavyede hep
    // böyle). Diğer sahnelerde Harry'nin baktığı yöne.
    updateAim(free) {
        const p = this.player;
        let target = DIR_ANGLE[p.dir];
        if (this.phase === 'chase' && free) {
            const rs = this.gamepad?.rightStick?.() || { x: 0, y: 0 };
            if (Math.hypot(rs.x, rs.y) > 0) {
                target = Math.atan2(rs.y, rs.x);
                p.dir = Math.abs(rs.y) >= Math.abs(rs.x) ? (rs.y < 0 ? 'up' : 'down') : (rs.x < 0 ? 'left' : 'right');
            } else if (p.moving) {
                target = this.moveAngle;
            } else {
                target = this.aim;
            }
        }
        let diff = target - this.aim;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.aim += diff * 0.3;
    }

    // --- Çizim ---

    speakerPos(speaker) {
        const map = {
            biz: this.player,
            arkadas: this.npcs.fred,
            'saglikli-0': this.npcs.yardimci0,
            'saglikli-1': this.npcs.yardimci1,
            'saglikli-2': this.npcs.yardimci2,
            andrew: this.npcs.andrew,
            ses: this.npcs.andrew
        };
        // Fred yakalanınca ya da yere düşünce balonu onun bulunduğu yerde çıkar
        if (speaker === 'arkadas' && this.grab?.state === 'swing') return { x: this.grab.hand.x, y: 232 };
        if (speaker === 'arkadas' && this.fredDown) return { x: this.fredDown.x1 + 18, y: this.fredDown.y1 + 10 };
        return map[speaker] || this.player;
    }

    draw() {
        const { ctx, canvas } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.overlay?.type === 'peep') {
            this.drawPeep();
        } else if (this.overlay?.type === 'scan') {
            this.drawScan();
        } else {
            this.drawLab();
        }

        if (this.curtain > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.curtain})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        this.drawBubble();
        this.drawCaption();

        // Kararma / açılma
        let veil = 0;
        if (this.fadingOut) veil = this.fade / FADE_FRAMES;
        else if (this.intro > 0) veil = this.intro / INTRO_FRAMES;
        if (veil > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${veil})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    drawLab() {
        const { ctx } = this;
        const camX = Math.round(this.camX);
        ctx.save();
        if (this.shake > 0) {
            ctx.translate(Math.round((hash(this.frame, 1, 5) - 0.5) * 8), Math.round((hash(this.frame, 2, 6) - 0.5) * 6));
        }
        ctx.translate(-camX, 0);
        ctx.drawImage(this.baked.ground, 0, 0);
        drawDoor(ctx, this.doorOpen);
        drawAnnexDoor(ctx, this.annexOpen, this.frame);
        drawBrokenWall(ctx, this.wallBroken);
        drawDestructButton(ctx, this.buttonPressed, this.frame);

        // Arkadan öne: eşyalar ve karakterler ayak/dip hizasına göre sıralanır
        const list = [];
        for (const intact of this.baked.props) {
            // Patlamadan sonra cam hücrenin ön yüzü kırık sürümle değişir
            const prop = this.cellBroken && intact.tag === 'cellFront' ? this.baked.cellBroken : intact;
            list.push({ y: prop.baseY, draw: () => ctx.drawImage(prop.canvas, prop.x, prop.y) });
        }
        for (const npc of Object.values(this.npcs)) {
            if (!npc.visible) continue;
            list.push({ y: npc.y, draw: () => this.drawNpc(npc) });
        }
        list.push({ y: this.player.y, draw: () => this.drawHarry() });
        list.push({ y: 272, draw: () => drawConsole(ctx, this.consoleState, this.frame) });
        if (this.sampleOnBench) list.push({ y: 198, draw: () => drawSample(ctx, this.frame) });
        if (this.battery.floor) list.push({ y: SPOTS.battery.y, draw: () => drawBattery(ctx, SPOTS.battery.x, SPOTS.battery.y, this.frame) });
        if (this.grab?.state === 'swing') list.push({ y: this.npcs.virus.y + 1, draw: () => this.drawHeldFred() });
        if (this.fredDown) list.push({ y: this.fredDown.y1, draw: () => this.drawFredDown() });
        list.sort((a, b) => a.y - b.y);
        for (const item of list) item.draw();

        if (!this.cellBroken) drawCellDoor(ctx, this.cellClosed);
        this.drawGreenEyes();
        this.drawEffects();
        // İzolasyon kapısı açılana kadar ara duvarın ardı görünmez
        drawAnnexCover(ctx, this.annexOpen);
        ctx.restore();

        if (this.lightsOut) {
            // Elektrik geri gelirken karanlık azalır ve titrer
            const rl = this.relight;
            if (rl) {
                const u = rl.t / RELIGHT_FRAMES;
                const flicker = rl.t > 14 && rl.t % 26 < 7 ? 0.35 : 0;
                ctx.globalAlpha = Math.max(0, Math.min(1, (1 - u) * (1 - u) + flicker * (1 - u)));
            }
            this.drawDarkness(camX);
            ctx.globalAlpha = 1;
        }

        if (this.dim > 0) {
            ctx.fillStyle = `rgba(4, 10, 20, ${this.dim})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
            // Cam hücrenin içi aydınlık kalır
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = '#9cc4d0';
            ctx.fillRect(CELL_INSIDE.x - 12 - camX, CELL_INSIDE.y - 20, CELL_INSIDE.w + 24, CELL_INSIDE.h + 20);
            ctx.restore();
        }

        if (this.collapse) {
            const pulse = 0.5 + 0.5 * Math.sin(this.collapse.t * 0.18);
            ctx.fillStyle = `rgba(200, 30, 30, ${0.1 + 0.16 * pulse})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        }

        if (this.flash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.flash})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        }

        this.drawHud();
    }

    // Konuşanın kafası hafifçe sallanıyor
    bob(id) {
        if (!this.dialogue.active) return 0;
        const speaker = this.dialogue.speaker;
        const who = { biz: 'player', arkadas: 'fred', 'saglikli-0': 'yardimci0', 'saglikli-1': 'yardimci1', 'saglikli-2': 'yardimci2', andrew: 'andrew', ses: 'andrew' }[speaker];
        if (who !== id || this.dialogue.finishedTyping) return 0;
        return Math.floor(this.frame / 5) % 2 === 0 ? -PX / 2 : 0;
    }

    drawShadow(x, y) {
        const { ctx } = this;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#10181c';
        ctx.fillRect(Math.round((x - 18) / PX) * PX, Math.round((y - 4) / PX) * PX, PX * 9, PX * 2);
        ctx.globalAlpha = 1;
    }

    drawNpc(npc) {
        if (npc.kind === 'virus') {
            this.drawVirus(npc);
            return;
        }
        if (npc.lying) {
            this.drawLyingAndrew(npc);
            return;
        }
        const { ctx } = this;
        const morphing = npc.id === 'andrew' && this.morph;
        const jx = morphing ? (hash(this.frame, 9, 3) - 0.5) * (4 + 10 * (this.morph.t / MORPH_FRAMES)) : 0;
        ctx.save();
        ctx.globalAlpha = npc.alpha ?? 1;
        this.drawShadow(npc.x, npc.y);
        drawPerson(ctx, npc.x + jx, npc.y + this.bob(npc.id), npc.who, npc.dir, npc.moving, this.frame, PLAYER_SCALE,
            morphing ? { sickBlend: Math.min(1, this.morph.t / (MORPH_FRAMES * 0.6)) } : {});
        ctx.restore();
    }

    // Andrew yerde acı içinde kıvranıyor
    drawLyingAndrew(a) {
        const { ctx } = this;
        const wr = a.limp ? 0 : Math.sin(this.frame * 0.5) * 0.12 + Math.sin(this.frame * 1.3) * 0.05;
        const jx = a.limp ? 0 : Math.sin(this.frame * 0.9) * 2;
        ctx.save();
        ctx.globalAlpha = a.alpha ?? 1;
        this.drawShadow(a.x + 18, a.y);
        this.drawFredAt(a.x + jx, a.y - 14, Math.PI / 2 + wr, 'andrew');
        ctx.restore();
    }

    drawHarry() {
        const p = this.player;
        this.drawShadow(p.x, p.y);
        drawPerson(this.ctx, p.x, p.y + this.bob('player'), 'harry', p.dir, p.moving, this.frame, PLAYER_SCALE);
    }

    // Final: Andrew'ın gözlerinde bir an yeşil parıltı
    drawGreenEyes() {
        if (!this.greenEyes && !(this.dialogue.active && this.dialogue.speaker === 'ses')) return;
        const a = this.npcs.andrew;
        const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.35);
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.fillStyle = '#9dff6a';
        const ey = a.y - SPRITE_H + 5 * PX;
        ctx.fillRect(a.x - 14, ey, 8, 6);
        ctx.fillRect(a.x + 6, ey, 8, 6);
        ctx.globalAlpha = 0.18 * pulse;
        ctx.fillRect(a.x - 40, ey - 20, 80, 46);
        ctx.restore();
    }

    drawBubble() {
        const { dialogue, ctx } = this;
        if (!dialogue.active || !dialogue.visibleText) return;
        let ax, ay;
        if (this.overlay?.type === 'peep') {
            [ax, ay] = dialogue.speaker === 'andrew' ? ANCHOR_PEEP.andrew : ANCHOR_PEEP.other;
        } else if (this.overlay?.type === 'scan') {
            [ax, ay] = [500, 108];
        } else {
            const who = this.speakerPos(dialogue.speaker);
            ax = who.x - this.camX;
            ay = who.y - SPRITE_H - 6;
        }
        const lines = wrapPixelText(dialogue.visibleText, BUBBLE_MAX_W, BUBBLE_SCALE);
        // İçerideki organizmanın balonu yeşil: kimin konuştuğu ayırt edilsin
        const style = dialogue.speaker === 'ses' ? { fill: '#cfe8a8', border: '#16260a', text: '#16260a' } : {};
        drawSpeechBubble(ctx, ax, ay, lines, { scale: BUBBLE_SCALE, viewLeft: 0, viewW: VIEW.w, ...style });

        // Portre: Harry solda, diğerleri sağda
        const sp = dialogue.speaker;
        if (this.overlay?.type === 'peep' && sp === 'andrew') return;
        const left = sp === 'biz';
        drawPortrait(ctx, sp, left ? 16 : VIEW.w - PORTRAIT.w - 16, VIEW.h - PORTRAIT.h - 16,
            { talking: !dialogue.finishedTyping, tick: this.frame });
    }

    drawCaption() {
        if (!this.caption) return;
        const { ctx } = this;
        const w = measurePixelText(this.caption, 3);
        const x = Math.round((VIEW.w - w) / 2 / PX) * PX;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x - 16, 236, w + 32, 52);
        drawPixelText(ctx, this.caption, x, 250, { scale: 3, color: '#f4f1e4', shadow: '#0f172a' });
    }

    // Görev satırı, kontrol ipucu, etkileşim ipucu
    drawHud() {
        const { ctx } = this;
        const objective = this.objective;
        if (objective && !this.dialogue.active && !this.seq) {
            const label = `GÖREV: ${objective}`;
            const w = measurePixelText(label, 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(12, 8, w + 24, 32);
            drawPixelText(ctx, label, 24, 17, { scale: 2, color: '#fef3c7', shadow: '#0f172a' });
        }
        if (this.frame < HINT_FRAMES && this.intro === 0) {
            const w = measurePixelText(CONTROL_HINT, 2);
            const x = Math.round((VIEW.w - w) / 2 / PX) * PX;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
            ctx.fillRect(x - 12, VIEW.h - 44, w + 24, 32);
            drawPixelText(ctx, CONTROL_HINT, x, VIEW.h - 36, { scale: 2, color: '#e2e8f0' });
        }
        if (this.frame < this.hintUntil && this.phase === 'chase' && !this.dialogue.active) {
            const text = this.gamepad?.connected ? CHASE_HINT_PAD : CHASE_HINT_KEYS;
            const w = measurePixelText(text, 2);
            const x = Math.round((VIEW.w - w) / 2 / PX) * PX;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(x - 12, VIEW.h - 44, w + 24, 32);
            drawPixelText(ctx, text, x, VIEW.h - 36, { scale: 2, color: '#e2e8f0' });
        }
        if (this.fredClock > 0 && (this.phase === 'getBattery' || this.phase === 'throwBattery')) {
            const total = FRED_SECONDS * FRAME_RATE;
            const frac = this.fredClock / total;
            const bw = 240, bx = Math.round((VIEW.w - bw) / 2), by = 14;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(bx - 8, by - 6, bw + 16, 34);
            ctx.fillStyle = '#3b1d1d';
            ctx.fillRect(bx, by + 10, bw, 10);
            ctx.fillStyle = frac < 0.3 && this.frame % 20 < 10 ? '#fecaca' : '#ef4444';
            ctx.fillRect(bx, by + 10, Math.round(bw * frac), 10);
            drawPixelText(ctx, 'FRED', bx, by - 2, { scale: 2, color: '#fef3c7', shadow: '#0f172a' });
        }
        if (!this.seq && !this.overlay && !this.dialogue.active) {
            const spot = this.currentSpot();
            if (spot) this.drawActionHint(spot.label);
        }
    }

    drawActionHint(label) {
        const { ctx, player } = this;
        const bob = Math.round(Math.sin(this.frame * 0.12) * 4 / PX) * PX;
        const cap = PX * 7;
        const gap = PX * 2;
        const width = cap + gap + measurePixelText(label, 2);
        const x = Math.round((player.x - this.camX - width / 2) / PX) * PX;
        const y = Math.round((player.y - SPRITE_H - 36) / PX) * PX + bob;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x - PX * 2, y - PX * 2, width + PX * 4, cap + PX * 4);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - PX, y - PX, cap + PX * 2, cap + PX * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x, y, cap, cap);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x, y + cap - PX, cap, PX);
        if (!this.gamepad?.connected) drawPixelText(ctx, 'F', x + PX, y, { scale: 4, color: '#0f172a' });
        else {
            ctx.fillStyle = '#0f172a';
            [[3, 0], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]
                .forEach(([c, r]) => ctx.fillRect(x + c * PX, y + r * PX, PX, PX));
        }
        drawPixelText(ctx, label, x + cap + gap, y + PX * 2, { scale: 2, color: '#fef3c7', shadow: '#0f172a' });
    }

    // --- Gece sahnesi çizimi ---

    // Dev virüs: 2 kişilik moddaki sprite; sol kolu ayrı çiziliyor (Fred'i tutan kol)
    drawVirus(v) {
        const { ctx } = this;
        const sc = VIRUS_SCALE * v.grow;
        const b = PX * sc;
        const sprite = virusSprite(2);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#10181c';
        ctx.fillRect(Math.round(v.x - 120 * v.grow), Math.round(v.y - 8), Math.round(240 * v.grow), 14);
        ctx.globalAlpha = v.alpha ?? 1;

        const bob = v.moving ? Math.abs(Math.sin(this.frame * 0.16)) * -8 : Math.sin(this.frame * 0.06) * 2;
        const jitter = v.pain ? (hash(this.frame, 7, 3) - 0.5) * 14 : 0;
        ctx.translate(Math.round(v.x + jitter), Math.round(v.y + bob));
        if (v.pain) ctx.rotate(Math.sin(this.frame * 0.28) * 0.14);
        ctx.drawImage(sprite.canvas, -sprite.ox * sc, -sprite.h * sc, sprite.w * sc, sprite.h * sc);

        // Sol kol: omuzdan ele
        const shoulder = { x: -13.5 * b, y: -34 * b };
        const hand = this.grab?.hand && !v.pain
            ? { x: this.grab.hand.x - v.x, y: this.grab.hand.y - v.y - bob }
            : { x: this.restHand(v).x - v.x, y: this.restHand(v).y - v.y };
        this.drawVirusArm(shoulder, hand, b, -1);
        // Sağ kol: aynı çizim, yanda sallanıyor
        const sway = Math.sin(this.frame * (v.moving ? 0.16 : 0.07)) * 3 * b;
        this.drawVirusArm({ x: 14 * b, y: -31 * b }, { x: 20.5 * b, y: -11 * b + sway }, b, 1);

        // Elektrik çarpınca beyaz parlama
        if (v.pain && this.frame % 6 < 3) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45;
            ctx.drawImage(sprite.canvas, -sprite.ox * sc, -sprite.h * sc, sprite.w * sc, sprite.h * sc);
        }
        ctx.restore();
    }

    drawVirusArm(S, H, b, side) {
        const { ctx } = this;
        const mid = { x: (S.x + H.x) / 2 + side * 30, y: (S.y + H.y) / 2 + 12 };
        const strokes = [[S, mid, 6.5 * b], [mid, H, 5.5 * b]];
        const trace = (w, color, dx = 0) => {
            ctx.fillStyle = color;
            for (const [A, B, width] of strokes) {
                const n = Math.max(2, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 5));
                const half = (width + w) / 2;
                for (let i = 0; i <= n; i++) {
                    const x = A.x + (B.x - A.x) * i / n, y = A.y + (B.y - A.y) * i / n;
                    ctx.fillRect(Math.round(x - half + dx), Math.round(y - half), Math.round(half * 2), Math.round(half * 2));
                }
            }
        };
        trace(8, '#16260a');
        trace(0, '#4a7c1f');
        trace(-18, '#6ea32c', side * 10);
        // Dirsek yumrusu ve pençe
        ctx.fillStyle = '#16260a';
        ctx.fillRect(Math.round(mid.x - 26), Math.round(mid.y - 26), 52, 52);
        ctx.fillStyle = '#3c6618';
        ctx.fillRect(Math.round(mid.x - 21), Math.round(mid.y - 21), 42, 42);
        for (const k of [-1, 0, 1]) {
            const len = k === 0 ? 34 : 26;
            ctx.fillStyle = '#16260a';
            ctx.fillRect(Math.round(H.x + k * 17 - 8), Math.round(H.y - 6), 16, len + 6);
            ctx.fillStyle = '#6ea32c';
            ctx.fillRect(Math.round(H.x + k * 17 - 5), Math.round(H.y - 4), 10, len);
        }
    }

    // Fred'i merkezi (cx, cy) ve açısıyla çizer; 0 = ayakta, PI = baş aşağı
    drawFredAt(cx, cy, angle, who = 'fred') {
        const { ctx } = this;
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(cy));
        ctx.rotate(angle);
        drawPerson(ctx, 0, SPRITE_H / 2, who, 'down', false, this.frame, PLAYER_SCALE);
        ctx.restore();
    }

    // Virüsün elinde ayaklarından sarkan Fred
    drawHeldFred() {
        const g = this.grab;
        const angle = Math.PI + Math.sin(this.frame * 0.2) * 0.12;
        this.drawFredAt(g.hand.x + (SPRITE_H / 2) * Math.sin(angle), g.hand.y - (SPRITE_H / 2) * Math.cos(angle), angle);
    }

    // Bırakılan Fred: düşer, sonra yerde kıvranır
    drawFredDown() {
        const f = this.fredDown;
        const u = Math.min(1, f.t / 30);
        const x1 = f.x1, y1 = f.y1 - 14;
        let cx = f.x0 + (x1 - f.x0) * u, cy = f.y0 + (y1 - f.y0) * u * u;
        let angle = Math.PI + (Math.PI / 2) * u;
        if (f.up !== undefined) {
            const k = f.up * f.up * (3 - 2 * f.up);
            angle = Math.PI * 1.5 + (Math.PI / 2) * k;
            cy = (f.y1 - 14) + (-18) * k;
        } else if (f.t > 30) {
            angle += Math.sin(this.frame * 0.5) * 0.09;
            cx += Math.sin(this.frame * 0.9) * 1.5;
        }
        this.drawShadow(x1 + 18, f.y1);
        this.drawFredAt(cx, cy, angle);
    }

    // Parçacıklar, uçan pil, virüsü saran elektrik
    drawEffects() {
        const { ctx } = this;
        for (const p of this.shards) {
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#cfeef6';
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s - 2);
            ctx.fillStyle = '#8fc4d4';
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, p.s - 2);
        }
        ctx.globalAlpha = 1;
        for (const p of this.debris) {
            ctx.fillStyle = p.c;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s - 4);
        }

        const pr = this.battery.projectile;
        if (pr) {
            const u = pr.t / 34;
            const x = pr.x0 + (pr.x1 - pr.x0) * u;
            const y = pr.y0 + (pr.y1 - pr.y0) * u - Math.sin(Math.PI * u) * 90;
            ctx.save();
            ctx.translate(Math.round(x), Math.round(y));
            ctx.rotate(pr.t * 0.5);
            ctx.fillStyle = '#1f2528';
            ctx.fillRect(-18, -9, 36, 18);
            ctx.fillStyle = '#e8a030';
            ctx.fillRect(-16, -7, 13, 14);
            ctx.fillStyle = '#2f3a40';
            ctx.fillRect(-3, -7, 19, 14);
            ctx.fillStyle = '#b9c1c6';
            ctx.fillRect(18, -4, 5, 8);
            ctx.restore();
        }

        const v = this.npcs.virus;
        if (this.bolts > 0 && v.visible) {
            ctx.save();
            ctx.strokeStyle = '#fff27a';
            ctx.lineWidth = 4;
            for (let i = 0; i < 5; i++) {
                if (hash(this.frame >> 1, i, 41) < 0.35) continue;
                let x = v.x + (hash(this.frame >> 1, i, 43) - 0.5) * 300;
                let y = v.y - 300 + hash(this.frame >> 1, i, 45) * 120;
                ctx.beginPath();
                ctx.moveTo(x, y);
                for (let k = 0; k < 5; k++) {
                    x += (hash(this.frame >> 1, i * 7 + k, 47) - 0.5) * 60;
                    y += 34 + hash(this.frame >> 1, i * 7 + k, 49) * 22;
                    ctx.lineTo(Math.round(x), Math.round(y));
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // Elektrik kesikken sahne karanlık: yalnızca Harry'nin feneri, virüsün
    // parıltısı ve yerdeki pil aydınlık kalır.
    drawDarkness(camX) {
        const { ctx } = this;
        if (!this.darkCanvas) {
            this.darkCanvas = document.createElement('canvas');
            this.darkCanvas.width = VIEW.w;
            this.darkCanvas.height = VIEW.h;
        }
        const d = this.darkCanvas.getContext('2d');
        d.globalCompositeOperation = 'source-over';
        d.clearRect(0, 0, VIEW.w, VIEW.h);
        d.fillStyle = 'rgba(2, 5, 9, 0.93)';
        d.fillRect(0, 0, VIEW.w, VIEW.h);
        d.globalCompositeOperation = 'destination-out';

        const circle = (x, y, r, a) => {
            d.fillStyle = `rgba(0, 0, 0, ${a})`;
            d.beginPath();
            d.arc(x, y, r, 0, Math.PI * 2);
            d.fill();
        };

        if (this.flashlight) {
            const p = this.player;
            const px = p.x - camX, py = p.y - 36;
            const ang = this.aim;
            for (const [len, half] of [[360, 0.44], [300, 0.32], [220, 0.2]]) {
                d.fillStyle = 'rgba(0, 0, 0, 0.42)';
                d.beginPath();
                d.moveTo(px, py);
                d.lineTo(px + Math.cos(ang - half) * len, py + Math.sin(ang - half) * len);
                d.lineTo(px + Math.cos(ang + half) * len, py + Math.sin(ang + half) * len);
                d.closePath();
                d.fill();
            }
            circle(px, py + 14, 58, 0.55);
        }

        const v = this.npcs.virus;
        if (v.visible && this.virusGlow > 0) {
            const vx = v.x - camX, vy = v.y - 150 * v.grow;
            circle(vx, vy, this.virusGlow, 0.4);
            circle(vx, vy, this.virusGlow * 0.7, 0.4);
            circle(vx, vy, this.virusGlow * 0.4, 0.4);
        }
        const lying = this.npcs.andrew;
        if (lying.visible && lying.lying) circle(lying.x - camX, lying.y - 20, 150, 0.5);
        if (this.battery.floor) {
            circle(SPOTS.battery.x - camX, SPOTS.battery.y - 10, 70, 0.6);
        }
        d.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.darkCanvas, 0, 0);
    }

    // --- Kapı deliği ---

    drawPeep() {
        const { ctx } = this;
        const t = this.overlay.t;
        ctx.fillStyle = '#05080a';
        ctx.fillRect(0, 0, VIEW.w, VIEW.h);

        const cx = 500, cy = 290, R = 236, U = 8;
        const shakeX = t < 90 && Math.floor(t / 6) % 2 === 0 ? 4 : 0;

        // Dairesel görüş: satır satır genişlik
        const circle = (rad, color) => {
            ctx.fillStyle = color;
            for (let y = -rad; y < rad; y += U) {
                const half = Math.floor(Math.sqrt(rad * rad - (y + U / 2) * (y + U / 2)) / U) * U;
                ctx.fillRect(cx - half + shakeX, cy + y, half * 2, U);
            }
        };
        circle(R + 16, '#1a1f23');
        circle(R, '#aeb8ac');

        // Koridorun duvarı ve zemini
        ctx.save();
        // Kırpma: aynı basamaklı (piksel) daire
        ctx.beginPath();
        for (let y = -R; y < R; y += U) {
            const half = Math.floor(Math.sqrt(R * R - (y + U / 2) * (y + U / 2)) / U) * U;
            ctx.rect(cx - half + shakeX, cy + y, half * 2, U);
        }
        ctx.clip();
        ctx.fillStyle = '#9aa496';
        ctx.fillRect(cx - R, cy - R, R * 2, R + 140);
        ctx.fillStyle = '#6d7a70';
        ctx.fillRect(cx - R, cy + 150, R * 2, R);
        for (let x = cx - R; x < cx + R; x += 64) {
            ctx.fillStyle = '#8b958a';
            ctx.fillRect(x + shakeX, cy - R, 4, R + 150);
        }
        this.drawAndrewFace(cx + shakeX, cy, t);
        ctx.restore();

        // Görüş halkası: kenarlar kararıyor (içe doğru koyulaşan basamaklı halkalar)
        for (let i = 0; i < 4; i++) {
            const rad = R - i * U;
            ctx.fillStyle = `rgba(5, 8, 10, ${0.34 - i * 0.08})`;
            for (let y = -rad; y < rad; y += U) {
                const half = Math.floor(Math.sqrt(rad * rad - (y + U / 2) * (y + U / 2)) / U) * U;
                const inner = Math.max(0, Math.floor(Math.sqrt(Math.max(0, (rad - U) * (rad - U) - (y + U / 2) * (y + U / 2))) / U) * U);
                if (inner <= 0 || Math.abs(y + U / 2) > rad - U) ctx.fillRect(cx - half + shakeX, cy + y, half * 2, U);
                else {
                    ctx.fillRect(cx - half + shakeX, cy + y, half - inner, U);
                    ctx.fillRect(cx + inner + shakeX, cy + y, half - inner, U);
                }
            }
        }
        drawPixelText(ctx, 'KAPI DELİĞİ', 24, 20, { scale: 3, color: '#94a3b8' });
    }

    drawAndrewFace(cx, cy, t) {
        const { ctx } = this;
        const skin = '#d9b08c', shade = '#b58e6c', hair = '#2a2220', coat = '#3a4a5c';
        const U = 8;
        const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + x, cy + y, w, h); };
        // Omuzlar, boyun, kafa (balık gözü: büyük ve yakın)
        r(-150, 140, 300, 140, coat);
        r(-150, 140, 300, U, '#4c5e72');
        r(-40, 96, 80, 60, shade);
        r(-40, 96, 20, 60, '#9a7858');
        r(-84, -120, 168, 230, skin);
        r(-84, -120, 24, 230, shade);
        // Dağınık saç
        r(-100, -150, 200, 66, hair);
        r(-108, -112, 40, 70, hair);
        r(-60, -168, 40, 24, hair);
        r(20, -164, 48, 20, hair);
        r(76, -112, 32, 54, hair);
        // Kaşlar: endişeyle yukarı kıvrık
        r(-68, -52, 52, 10, hair);
        r(-76, -44, 16, 10, hair);
        r(16, -52, 52, 10, hair);
        r(60, -44, 16, 10, hair);
        // Gözler: büyük, kocaman açılmış
        const blink = Math.floor(t / 70) % 3 === 2 && t % 70 < 6;
        r(-64, -32, 44, blink ? 8 : 28, '#f1f1e4');
        r(20, -32, 44, blink ? 8 : 28, '#f1f1e4');
        if (!blink) {
            r(-48, -26, 16, 20, '#2a3a2a');
            r(36, -26, 16, 20, '#2a3a2a');
            r(-44, -24, 6, 6, '#ffffff');
            r(40, -24, 6, 6, '#ffffff');
        }
        // Burun, ağız (konuşurken açılıyor)
        r(-8, 0, 16, 40, shade);
        const speaking = this.dialogue.active && this.dialogue.speaker === 'andrew' && !this.dialogue.finishedTyping;
        const open = speaking ? 10 + (Math.floor(t / 5) % 2) * 14 : 8;
        r(-32, 70, 64, open, '#4a1f1c');
        r(-32, 70, 64, 6, '#e8e0d0');
        // Ter damlaları
        const drip = (t * 2) % 60;
        r(-98, -40 + drip, 8, 14, '#cfe6f2');
        r(94, -10 + (drip + 30) % 60, 8, 14, '#cfe6f2');
        // Yüzde hafif yeşil damarlar: enfekte ama az
        r(-70, 40, 4, 30, '#6f8a3c');
        r(64, 30, 4, 38, '#6f8a3c');
        r(-60, 66, 4, 22, '#6f8a3c');
    }

    // --- DNA taraması ---

    drawScan() {
        const { ctx, scan } = this;
        ctx.fillStyle = '#050c09';
        ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        ctx.strokeStyle = '#1c3a2a';
        ctx.lineWidth = 4;
        ctx.strokeRect(34, 84, VIEW.w - 68, 410);

        drawPixelText(ctx, 'ÖRNEK TARAMASI', 40, 24, { scale: 4, color: '#6bdc5a' });
        drawPixelText(ctx, `ANORMALLİK ${scan.found.length} / ${SCAN_TARGETS.length}`, 40, 60, { scale: 2, color: '#8fd480' });

        // Dizilim çubukları
        const cell = 12;
        const x0 = 46, y0 = 96;
        const cols = Math.floor((VIEW.w - 92) / cell), rows = Math.floor(386 / cell);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const h = hash(c, r, 9);
                const px = x0 + c * cell, py = y0 + r * cell;
                let near = 0;
                for (const t of SCAN_TARGETS) {
                    const d = Math.hypot(px + cell / 2 - t.x, py + cell / 2 - t.y);
                    if (d < t.r * 1.2) near = Math.max(near, 1 - d / (t.r * 1.2));
                }
                const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.1 + c * 0.3);
                const base = 28 + h * 40;
                const g = Math.min(255, base + near * (90 + pulse * 60));
                ctx.fillStyle = `rgb(${Math.round(18 + near * 40)}, ${Math.round(g)}, ${Math.round(40 + near * 20)})`;
                ctx.fillRect(px, py, cell - 2, cell - 2);
            }
        }

        // Bulunanlar: parlak çerçeve + etiket
        for (const t of SCAN_TARGETS) {
            if (!scan.found.includes(t.id)) continue;
            ctx.strokeStyle = '#ffe06a';
            ctx.lineWidth = 4;
            ctx.strokeRect(t.x - t.r, t.y - t.r, t.r * 2, t.r * 2);
            const w = measurePixelText(t.label, 2);
            ctx.fillStyle = 'rgba(5, 12, 9, 0.9)';
            ctx.fillRect(t.x - w / 2 - 8, t.y + t.r + 6, w + 16, 26);
            drawPixelText(ctx, t.label, t.x - w / 2, t.y + t.r + 12, { scale: 2, color: '#ffe06a' });
        }

        // Nişangâh: köşe parantezleri + merkez nokta
        const { x, y } = scan;
        const s = 30;
        ctx.strokeStyle = scan.flash > 0 ? '#ffe06a' : '#e8fff0';
        ctx.lineWidth = 4;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            ctx.beginPath();
            ctx.moveTo(x + sx * s, y + sy * (s - 12));
            ctx.lineTo(x + sx * s, y + sy * s);
            ctx.lineTo(x + sx * (s - 12), y + sy * s);
            ctx.stroke();
        }
        ctx.fillStyle = '#e8fff0';
        ctx.fillRect(x - 2, y - 2, 4, 4);

        const hint = 'OKLAR: NİŞAN ALIN     F: İŞARETLE';
        drawPixelText(ctx, hint, 40, 510, { scale: 2, color: '#8fd480' });
    }
}
