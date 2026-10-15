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
//   (Andrew cam hücreye yürür) -> lock -> (kilit, final) -> bitiş
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
import { bakeLab, drawDoor, drawAnnexDoor, drawAnnexCover, drawCellDoor, drawConsole, drawSample } from './labArt.js';
import {
    PX, VIEW, START, NPCS, SPOTS, PLAYER_SPEED, PLAYER_SCALE, CELL_INSIDE,
    blocked, near, cameraX
} from './labLayout.js';
import {
    LINES, OBJECTIVES, CONTROL_HINT, SCAN_TARGETS, ENDING_CAPTION
} from './adventureScript.js';

const INTRO_FRAMES = 40;
const FADE_FRAMES = 70;
const BUBBLE_SCALE = 2;
const BUBBLE_MAX_W = 460;
const SPRITE_H = 64;
const HINT_FRAMES = 420;

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

        this.phase = 'talkFred';
        this.overlay = null;
        this.seq = null;
        this.dialogue.cut();
        this.scan = null;
    }

    start() {
        if (!this.baked) this.baked = bakeLab();
        this.reset();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic('shadow');

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
                this.npcs[s.face].dir = s.dir;
            } else if (s.phase) {
                this.phase = s.phase;
            } else if (s.until) {
                if (!s.until()) return;
            } else if (s.walk) {
                const npc = this.npcs[s.walk];
                if (seq.walking === null) seq.walking = 0;
                if (seq.walking < s.path.length) {
                    this.walkToward(npc, s.path[seq.walking], s.speed || 2.2)
                        && seq.walking++;
                    return;
                }
                npc.moving = false;
                seq.walking = null;
            }
            seq.i++;
        }
        this.seq = null;
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
            lock: OBJECTIVES.lock
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
                { walk: 'andrew', speed: 2.6, path: [[214, 358], [640, 358], [640, 236], [742, 234]] },
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
                { walk: 'andrew', speed: 3.2, path: [[214, 358], [1040, 358], [1380, 344], [1450, 344], [1560, 332]] },
                { do: () => { npcs.andrew.dir = 'left'; this.camFocus = 'player'; this.consoleState = 'ready'; } },
                { phase: 'lock' }
            ]);
        } else if (id === 'lock') {
            this.run([
                { do: () => { this.cellTarget = 1; Sfx.metalSlam(); } },
                { until: () => this.cellClosed >= 1 },
                { do: () => { this.consoleState = 'locked'; Sfx.glassCrack(); } },
                { say: LINES.locked },
                { phase: 'ending' },
                ...this.endingSteps()
            ]);
        }
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

    endingSteps() {
        return [
            { wait: 50 },
            { do: () => { this.dim = 0.5; } },
            { wait: 90 },
            { do: () => { this.caption = ENDING_CAPTION; } },
            { wait: 120 },
            { do: () => { this.greenEyes = 1; Sfx.ooze(); } },
            { wait: 150 },
            { do: () => { this.caption = null; this.fadingOut = true; } }
        ];
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

        if (this.overlay?.type === 'peep') this.overlay.t++;
        this.dialogue.step();
        this.stepScan();
        this.stepSeq();

        const free = !this.seq && !this.overlay && !this.dialogue.active && !this.fadingOut && this.intro === 0;
        if (free) this.movePlayer();
        else this.player.moving = false;

        if (this.fadingOut) {
            this.fade = Math.min(FADE_FRAMES, this.fade + 1);
            if (this.fade >= FADE_FRAMES && !this.finished) {
                this.finished = true;
                this.running = false;
                this.onFinish();
            }
        }
    }

    // Kamera: odak (Harry ya da Andrew) yatayda izlenir; kapı kapalıyken ara
    // duvarın ötesine geçemez. camOverride kesitlerde odağı sabitler.
    updateCamera() {
        let fx;
        if (this.camOverride !== null) fx = this.camOverride;
        else fx = (this.camFocus === 'player' ? this.player : this.npcs[this.camFocus]).x;
        const target = cameraX(fx, this.annexOpen > 0.5);
        this.camX += (target - this.camX) * 0.07;
        if (Math.abs(target - this.camX) < 0.5) this.camX = target;
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

        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;
        const opts = { cellDoorClosed: this.cellClosed > 0.4, annexDoorClosed: this.annexOpen < 0.6 };
        if (!blocked(player.x + vx, player.y, opts)) player.x += vx;
        if (!blocked(player.x, player.y + vy, opts)) player.y += vy;

        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
    }

    // --- Çizim ---

    speakerPos(speaker) {
        const map = {
            biz: this.player,
            arkadas: this.npcs.fred,
            'saglikli-0': this.npcs.yardimci0,
            'saglikli-1': this.npcs.yardimci1,
            'saglikli-2': this.npcs.yardimci2,
            andrew: this.npcs.andrew
        };
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

        // Arkadan öne: eşyalar ve karakterler ayak/dip hizasına göre sıralanır
        const list = [];
        for (const prop of this.baked.props) list.push({ y: prop.baseY, draw: () => ctx.drawImage(prop.canvas, prop.x, prop.y) });
        for (const npc of Object.values(this.npcs)) {
            if (!npc.visible) continue;
            list.push({ y: npc.y, draw: () => this.drawNpc(npc) });
        }
        list.push({ y: this.player.y, draw: () => this.drawHarry() });
        list.push({ y: 272, draw: () => drawConsole(ctx, this.consoleState, this.frame) });
        if (this.sampleOnBench) list.push({ y: 198, draw: () => drawSample(ctx, this.frame) });
        list.sort((a, b) => a.y - b.y);
        for (const item of list) item.draw();

        drawCellDoor(ctx, this.cellClosed);
        this.drawGreenEyes();
        // İzolasyon kapısı açılana kadar ara duvarın ardı görünmez
        drawAnnexCover(ctx, this.annexOpen);
        ctx.restore();

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

        this.drawHud();
    }

    // Konuşanın kafası hafifçe sallanıyor
    bob(id) {
        if (!this.dialogue.active) return 0;
        const speaker = this.dialogue.speaker;
        const who = { biz: 'player', arkadas: 'fred', 'saglikli-0': 'yardimci0', 'saglikli-1': 'yardimci1', 'saglikli-2': 'yardimci2', andrew: 'andrew' }[speaker];
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
        this.drawShadow(npc.x, npc.y);
        drawPerson(this.ctx, npc.x, npc.y + this.bob(npc.id), npc.who, npc.dir, npc.moving, this.frame, PLAYER_SCALE);
    }

    drawHarry() {
        const p = this.player;
        this.drawShadow(p.x, p.y);
        drawPerson(this.ctx, p.x, p.y + this.bob('player'), 'harry', p.dir, p.moving, this.frame, PLAYER_SCALE);
    }

    // Final: Andrew'ın gözlerinde bir an yeşil parıltı
    drawGreenEyes() {
        if (!this.greenEyes) return;
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
        drawSpeechBubble(ctx, ax, ay, lines, { scale: BUBBLE_SCALE, viewLeft: 0, viewW: VIEW.w });
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
