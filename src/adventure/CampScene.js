// Avcı kulübesi bölümü: orman patikasında üç yol ayrımı, kulübe, birkaç günlük
// hayatta kalma işi (odun, su, meyve, ateş, yemek, uyku) ve gece Fred'in kaybolması.
//
//   trail -> yard (kulübenin çevresi, geniş) -> cabin (iç mekân)
//   toCabin -> beds -> sleep -> [tasks -> fire -> (cook) -> toBed] x2 gün -> search -> fredRoom -> son
//
// Oyuncu Harry'yi yürütür (3/4 görünüm). F ya da kolda ÇARPI/ÜÇGEN etkileşir.
// Fred de çalışır: 2. gün bir ağaç devirir, 3. gün gölde balık tutar.
// Olaylar laboratuvardaki gibi "dizi" (run) olarak yazılır: bekle / konuş /
// yürüt / koşula kadar bekle. Dizi sürerken oyuncu yürüyemez.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import { hash, PX } from '../pixel/pixelDraw.js';
import { treeSpriteFor } from '../pixel/trees.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { drawPerson } from './charSprites.js';
import { drawPortrait, PORTRAIT } from './portraits.js';
import { isPaused } from '../core/pause.js';
import {
    VIEW, PLAYER_SPEED, TRAIL, JUNCTIONS, TRAIL_TREES, YARD_TREES, CHOP_TREES, CABIN, YARD,
    YARD_DOOR, FIRE_PIT, WOODPILE, BARREL, BARREL_SPOT, POND, POND_SPOT, FRED_FISH, BUSHES,
    SEARCH_SPOTS, FRED_BED, HARRY_BED, STOVE, TABLE, CHEST, SHELF_CRATE, CABIN_EXIT, SPOTS_IN,
    FRED_WAKE, FRED_TREE, treeStand, trailCenter, blocked, near
} from './campLayout.js';
import {
    bakeTrailGround, bakeYardGround, bakeCabinExterior, bakeCabinInterior, CABIN_PAD,
    drawCabinGlow, drawBed, BED_TONES, drawStove, drawTable, drawChest, drawCrateProp,
    drawFirePit, drawFireGlow, drawWoodpile, drawPondLife, drawBush, drawBarrel, drawBucket,
    drawPot, drawStump, drawLyingTrunk
} from './campArt.js';
import {
    OBJECTIVES, LABELS, CAPTIONS, LINES, DAY_TASKS, TASK_NAMES, LAST_DAY
} from './campScript.js';

const INTRO_FRAMES = 40;
const FADE_FRAMES = 70;
const BUBBLE_SCALE = 2;
const BUBBLE_MAX_W = 460;
const SPRITE_H = 64;
const HINT_FRAMES = 420;
const ACTION_BUTTONS = ['triangle', 'cross'];
const FOLLOW_LAG = 46;            // Fred patikada Harry'nin bu kare gerisinden gelir
const FALL_FRAMES = 60;           // ağacın devrilme süresi
const FRED_HITS = 12;             // Fred'in ağacı devirmek için vuruş sayısı
const FRED_SWING_GAP = 80;        // iki vuruş arası kare
const FISH_FRAMES = 1500;         // balığın tutulması için gereken gündüz süresi

export class CampScene {
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

    // Zeminler bir kez hazırlanır
    bake() {
        if (this.art) return;
        this.art = {
            trail: bakeTrailGround(),
            yard: bakeYardGround(),
            cabinOut: bakeCabinExterior(),
            cabinIn: bakeCabinInterior()
        };
    }

    start() {
        this.bake();
        this.reset();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic('mystery');

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

    reset() {
        this.frame = 0;
        this.intro = INTRO_FRAMES;
        this.fade = 0;
        this.fadingOut = false;
        this.finished = false;
        this.shake = 0;
        this.curtain = 0;
        this.curtainTarget = 0;
        this.caption = null;
        this.seq = null;
        this.dialogue.cut();

        this.area = 'trail';
        this.phase = 'trail';
        this.day = 1;
        this.tod = 0;                 // 0 gündüz, 1 akşam, 2 gece
        this.todVis = 0;              // ekranda görünen (yumuşak geçiş)
        this.felled = new Map();      // devrilen ağaçlar: sıra -> { t, dir }
        this.chopping = null;         // Harry'nin vurduğu ağaç: { index }
        this.fredSwing = null;        // Fred'in vuruşu: { index, t }
        this.tasks = null;            // günlük işler: { ad: { n, goal } }
        this.picked = new Set();      // toplanan meyve çalıları
        this.carry = null;            // 'water' ise elde kova var
        this.barrelFilled = false;
        this.fish = false;
        this.dayFrames = 0;
        this.fredJob = null;
        this.potOn = false;
        this.pendingLines = null;
        this.fireLit = false;
        this.beds = { fred: false, harry: false };
        this.searched = new Set();
        this.junctionDone = JUNCTIONS.map(() => false);
        this.fredTalks = 0;
        this.camX = 0;
        this.hist = [];

        this.player = { x: TRAIL.startX, y: trailCenter(TRAIL.startX), dir: 'right', moving: false };
        this.fred = { x: TRAIL.startX - 40, y: trailCenter(TRAIL.startX) + 14, dir: 'right', moving: false, visible: true };
        this.snapCamera();
    }

    // --- Dizi (olay akışı): { wait } | { say } | { do } | { until } | { walk, path } | { face, dir } ---

    run(steps) {
        this.seq = { steps, i: 0, wait: 0, walking: null, talking: false };
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
            } else if (s.until) {
                if (!s.until()) return;
            } else if (s.walk) {
                const npc = this.actor(s.walk);
                if (seq.walking === null) seq.walking = 0;
                if (seq.walking < s.path.length) {
                    if (this.walkToward(npc, s.path[seq.walking], s.speed || 2.2)) seq.walking++;
                    return;
                }
                npc.moving = false;
                seq.walking = null;
            }
            seq.i++;
        }
        this.seq = null;
    }

    actor(id) {
        return id === 'player' ? this.player : this.fred;
    }

    walkToward(npc, [tx, ty], speed) {
        const dx = tx - npc.x, dy = ty - npc.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed) {
            npc.x = tx; npc.y = ty;
            return true;
        }
        npc.x += (dx / dist) * speed;
        npc.y += (dy / dist) * speed;
        npc.moving = true;
        if (Math.abs(dy) >= Math.abs(dx)) npc.dir = dy < 0 ? 'up' : 'down';
        else npc.dir = dx < 0 ? 'left' : 'right';
        return false;
    }

    // Alan değişimi: perde iner, alan/konum değişir, perde kalkar
    changeArea(area, px, py, dir, { fred = null, after = null } = {}) {
        return [
            { do: () => { this.curtainTarget = 1; } },
            { until: () => this.curtain >= 1 },
            { do: () => {
                this.area = area;
                this.player.x = px; this.player.y = py; this.player.dir = dir; this.player.moving = false;
                if (fred) Object.assign(this.fred, fred, { moving: false, visible: true });
                this.hist = [];
                this.snapCamera();
                this.updateMusic();
                if (after) after();
            } },
            { wait: 20 },
            { do: () => { this.curtainTarget = 0; } }
        ];
    }

    // Günün saatine göre müzik: patikada gizem, gündüz sakin, akşam/gece karanlık
    updateMusic() {
        if (this.area === 'trail') playMusic('mystery');
        else playMusic(this.tod >= 1 ? 'night' : 'shadow');
    }

    // --- Günlük işler ---

    setupDay(day) {
        this.day = day;
        this.tasks = {};
        for (const [key, goal] of Object.entries(DAY_TASKS[day] || {})) this.tasks[key] = { n: 0, goal };
        this.picked = new Set();
        this.carry = null;
        this.fish = false;
        this.dayFrames = 0;
        this.potOn = false;
        this.fireLit = false;
        // Fred'in günlük işi: 2. gün ağaç devirir, 3. gün gölde balık tutar
        this.fredJob = day === 2
            ? { type: 'chop', index: FRED_TREE, hits: 0, cd: FRED_SWING_GAP, done: false }
            : { type: 'fish', caught: false };
    }

    tasksDone() {
        return !!this.tasks && Object.values(this.tasks).every(t => t.n >= t.goal);
    }

    // Fred'in gündüz durduğu yer: işine göre
    fredYardPos() {
        if (this.tod === 1 && this.fireLit) return { x: FIRE_PIT.x - 58, y: FIRE_PIT.y + 40, dir: 'right' };
        const job = this.fredJob;
        if (this.tod === 0 && job?.type === 'chop' && !job.done) {
            const t = CHOP_TREES[job.index];
            return { x: t.x - 40, y: t.y + 26, dir: 'right' };
        }
        if (this.tod === 0 && job?.type === 'fish') return { x: FRED_FISH.x, y: FRED_FISH.y, dir: 'up' };
        return { x: WOODPILE.x + 130, y: WOODPILE.y + 70, dir: 'left' };
    }

    // Ağaç devrilir: yere uzanır, odun sayılır
    fell(index, dir) {
        this.felled.set(index, { t: 0, dir });
        if (this.tasks?.wood) this.tasks.wood.n++;
    }

    // --- Girdi ---

    action() {
        if (!this.running || this.fadingOut) return;
        if (this.dialogue.active) {
            this.dialogue.advance();
            return;
        }
        if (this.seq || this.curtain > 0.05) return;
        const spot = this.currentSpot();
        if (spot) this.interact(spot);
    }

    // Şu an etkileşilebilecek nokta: { id, label, ... }
    currentSpot() {
        const { x, y } = this.player;
        if (this.area === 'yard') {
            if (this.phase === 'search') {
                const s = SEARCH_SPOTS.find(sp => !this.searched.has(sp.id) && near(x, y, sp));
                if (s) return { id: 'search', label: LABELS.search, spot: s };
            }
            if (this.phase === 'tasks') {
                const t = this.tasks;
                if (t.wood && t.wood.n < t.wood.goal) {
                    const i = CHOP_TREES.findIndex((tree, k) => !this.felled.has(k)
                        && !(this.fredJob?.type === 'chop' && !this.fredJob.done && k === this.fredJob.index)
                        && near(x, y, { ...treeStand(tree), r: 66 }));
                    if (i >= 0) return { id: 'chop', label: LABELS.chop, index: i };
                }
                if (t.berries && t.berries.n < t.berries.goal) {
                    const i = BUSHES.findIndex((b, k) => !this.picked.has(k) && near(x, y, { x: b.x, y: b.y + 26, r: 58 }));
                    if (i >= 0) return { id: 'berry', label: LABELS.berry, index: i };
                }
                if (t.water && t.water.n < t.water.goal && this.carry !== 'water' && near(x, y, POND_SPOT)) {
                    return { id: 'water', label: LABELS.water };
                }
            }
            if (this.carry === 'water' && near(x, y, BARREL_SPOT)) return { id: 'pour', label: LABELS.pour };
            if (this.phase === 'fire' && near(x, y, { x: FIRE_PIT.x, y: FIRE_PIT.y + 30, r: 78 })) {
                return { id: 'fire', label: LABELS.fire };
            }
            if (this.phase === 'cook' && near(x, y, { x: FIRE_PIT.x, y: FIRE_PIT.y + 30, r: 78 })) {
                return { id: 'cook', label: LABELS.cook };
            }
            if (near(x, y, YARD_DOOR)) return { id: 'enter', label: LABELS.enter };
            if (this.tod === 0 && this.fred.visible && near(x, y, { r: 66 }, this.fred.x, this.fred.y + 10)) {
                return { id: 'fredTalk', label: LABELS.talk };
            }
        } else if (this.area === 'cabin') {
            if (this.phase === 'beds') {
                if (!this.beds.fred && near(x, y, SPOTS_IN.fredBed)) return { id: 'bedFred', label: LABELS.bed };
                if (!this.beds.harry && near(x, y, SPOTS_IN.harryBed)) return { id: 'bedHarry', label: LABELS.bed };
            }
            if ((this.phase === 'sleep' || this.phase === 'toBed') && near(x, y, SPOTS_IN.harryBed)) {
                return { id: 'sleep', label: LABELS.sleep };
            }
            if (this.phase === 'fredRoom' && near(x, y, SPOTS_IN.fredBed)) return { id: 'fredRoom', label: LABELS.look };
            if (near(x, y, CABIN_EXIT)) return { id: 'exit', label: LABELS.exit };
        }
        return null;
    }

    get objective() {
        if (this.phase === 'tasks' && this.tasks) {
            return Object.entries(this.tasks).map(([k, t]) => `${TASK_NAMES[k]} ${Math.min(t.n, t.goal)}/${t.goal}`).join('   ');
        }
        return OBJECTIVES[this.phase] || null;
    }

    // --- Olaylar ---

    interact(spot) {
        switch (spot.id) {
            case 'enter': this.enterCabin(); break;
            case 'exit': this.leaveCabin(); break;
            case 'bedFred': this.prepareBed('fred'); break;
            case 'bedHarry': this.prepareBed('harry'); break;
            case 'sleep': this.sleep(); break;
            case 'chop': this.chop(spot.index); break;
            case 'berry': this.pickBerries(spot.index); break;
            case 'water': this.takeWater(); break;
            case 'pour': this.pourWater(); break;
            case 'fire': this.lightFire(); break;
            case 'cook': this.cook(); break;
            case 'search': this.searchAt(spot.spot); break;
            case 'fredRoom': this.lookFredRoom(); break;
            case 'fredTalk': this.talkToFred(); break;
            default: break;
        }
    }

    talkToFred() {
        const job = this.fredJob;
        let lines;
        if (job?.type === 'chop' && !job.done) lines = LINES.fredJobChop;
        else if (job?.type === 'chop') lines = LINES.fredJobChopDone;
        else if (job?.type === 'fish') lines = LINES.fredJobFish;
        else lines = LINES.fredIdle[this.fredTalks++ % LINES.fredIdle.length];
        this.fred.dir = this.player.x < this.fred.x ? 'left' : 'right';
        this.run([{ say: lines }]);
    }

    // Kulübeye girerken Fred de içeride ana odada durur
    enterCabin() {
        const first = this.phase === 'toCabin';
        const steps = [
            ...this.changeArea('cabin', CABIN_EXIT.x, CABIN_EXIT.y - 40, 'up', {
                fred: this.tod === 2 ? null : { x: 590, y: 300, dir: 'left' },
                after: () => { if (this.tod === 2) this.fred.visible = false; }
            })
        ];
        if (first) {
            steps.push({ say: LINES.cabinFirst }, { do: () => { this.phase = 'beds'; } });
        }
        this.run(steps);
    }

    leaveCabin() {
        const fredAtYard = this.tod === 2 ? null : this.fredYardPos();
        this.run(this.changeArea('yard', YARD_DOOR.x, YARD_DOOR.y + 10, 'down', {
            fred: fredAtYard,
            after: () => { if (!fredAtYard) this.fred.visible = false; }
        }));
    }

    prepareBed(who) {
        this.player.dir = who === 'fred' ? 'left' : 'right';
        this.beds[who] = true;
        Sfx.token();
        const steps = [{ say: who === 'fred' ? LINES.bedFred : LINES.bedHarry }];
        if (this.beds.fred && this.beds.harry) {
            steps.push({ say: LINES.bedsDone }, { do: () => { this.phase = 'sleep'; } });
        }
        this.run(steps);
    }

    // Uyku: perde iner; gün atlanır ya da (son günde) gece uyanış gelir
    sleep() {
        const last = this.day >= LAST_DAY && this.phase === 'toBed';
        const pre = this.phase === 'sleep' ? [] : [{ say: LINES.toBed2 }];
        if (last) {
            this.run([...pre, ...this.nightWakeSteps()]);
            return;
        }
        this.run([
            ...pre,
            { do: () => { this.curtainTarget = 1; Sfx.slide(); } },
            { until: () => this.curtain >= 1 },
            { do: () => {
                this.setupDay(this.day + 1);
                this.tod = 0; this.todVis = 0;
                this.phase = 'tasks';
                this.caption = this.day === 2 ? CAPTIONS.day2 : CAPTIONS.day3;
                this.player.x = HARRY_BED.x + 64; this.player.y = HARRY_BED.y + HARRY_BED.h + 36; this.player.dir = 'down';
                // Fred sabah kendi yatağının yanında uyanır
                Object.assign(this.fred, { x: FRED_WAKE.x, y: FRED_WAKE.y, dir: 'right', visible: true, moving: false });
                this.updateMusic();
            } },
            { wait: 110 },
            { do: () => { this.caption = null; this.curtainTarget = 0; } },
            { wait: 30 },
            { say: this.day === 2 ? LINES.day2 : LINES.day3 }
        ]);
    }

    // Harry ağaca üç kez vurur; ağaç yere devrilir
    chop(index) {
        const t = CHOP_TREES[index];
        const p = this.player;
        p.dir = p.x < t.x ? 'right' : 'left';
        const fallDir = p.x < t.x ? 1 : -1;
        const first = this.tasks.wood.n === 0 && this.day === 2;
        const hit = () => ({ do: () => { this.shake = 6; Sfx.hit(); } });
        this.chopping = { index };
        const steps = [
            { wait: 8 }, hit(), { wait: 18 }, hit(), { wait: 18 }, hit(), { wait: 14 },
            { do: () => { this.chopping = null; this.fell(index, fallDir); } }
        ];
        if (first) steps.push({ say: LINES.chopFirst });
        this.run(steps);
    }

    pickBerries(index) {
        const first = this.tasks.berries.n === 0;
        this.picked.add(index);
        this.tasks.berries.n++;
        Sfx.token();
        this.player.dir = 'down';
        this.run(first ? [{ wait: 20 }, { say: LINES.berryFirst }] : [{ wait: 20 }]);
    }

    takeWater() {
        this.player.dir = 'up';
        this.carry = 'water';
        Sfx.drip();
        this.run([{ wait: 18 }, { say: LINES.waterTake }]);
    }

    pourWater() {
        this.player.dir = 'up';
        this.carry = null;
        this.barrelFilled = true;
        if (this.tasks?.water) this.tasks.water.n++;
        Sfx.drip();
        this.run([{ wait: 18 }, { say: LINES.waterPour }]);
    }

    // Tüm günlük işler bitince akşam olur, ateş görevi gelir (adım döngüsünden çağrılır)
    startEvening() {
        this.run([
            { say: LINES.woodDone },
            { do: () => { this.caption = CAPTIONS.evening; this.tod = 1; this.phase = 'fire'; this.updateMusic(); } },
            { wait: 90 },
            { do: () => { this.caption = null; } }
        ]);
    }

    lightFire() {
        const p = this.player;
        p.dir = 'up';
        this.run([
            { wait: 14 },
            { do: () => {
                Sfx.slide();
                this.fireLit = true;
                this.fish = true;
                Object.assign(this.fred, { x: FIRE_PIT.x - 58, y: FIRE_PIT.y + 40, dir: 'right', visible: true });
            } },
            { wait: 50 },
            { say: this.day === 2 ? LINES.fireLit : LINES.fireLit3 },
            { do: () => { this.phase = this.day >= 3 ? 'cook' : 'toBed'; } }
        ]);
    }

    cook() {
        this.player.dir = 'up';
        this.run([
            { say: LINES.cook },
            { do: () => { this.potOn = true; Sfx.ooze(); } },
            { wait: 90 },
            { do: () => { this.phase = 'toBed'; } }
        ]);
    }

    // Gece uyanış: kulübede kendi yatağında; Fred yok
    nightWakeSteps() {
        return [
            { do: () => { this.curtainTarget = 1; Sfx.slide(); } },
            { until: () => this.curtain >= 1 },
            { do: () => {
                this.area = 'cabin';
                this.tod = 2; this.todVis = 2;
                this.fireLit = false; this.potOn = false;
                this.phase = 'search';
                this.caption = CAPTIONS.night;
                this.player.x = HARRY_BED.x + 64; this.player.y = HARRY_BED.y + HARRY_BED.h + 36; this.player.dir = 'down';
                this.fred.visible = false;
                this.hist = [];
                this.snapCamera();
                this.updateMusic();
            } },
            { wait: 110 },
            { do: () => { this.caption = null; this.curtainTarget = 0; } },
            { wait: 40 },
            { say: LINES.nightWake }
        ];
    }

    searchAt(spot) {
        this.searched.add(spot.id);
        const steps = [{ say: LINES.search[spot.id] }];
        if (this.searched.size >= SEARCH_SPOTS.length) {
            steps.push({ say: LINES.searchDone }, { do: () => { this.phase = 'fredRoom'; } });
        }
        this.run(steps);
    }

    lookFredRoom() {
        this.player.dir = 'left';
        this.run([
            { say: LINES.fredRoom },
            { wait: 60 },
            { do: () => { this.curtainTarget = 1; stopMusic(); } },
            { until: () => this.curtain >= 1 },
            { do: () => { this.caption = CAPTIONS.end; this.phase = 'ending'; } },
            { wait: 220 },
            { do: () => { this.fadingOut = true; } }
        ]);
    }

    // Test ve geliştirme için: doğrudan bir ana atlar
    jump(stage) {
        this.seq = null;
        this.dialogue.cut();
        this.curtain = this.curtainTarget = 0;
        this.caption = null;
        const toYard = (phase, day, tod) => {
            this.area = 'yard'; this.phase = phase; this.tod = this.todVis = tod;
            this.beds = { fred: true, harry: true };
            if (day >= 2) this.setupDay(day);
            this.day = day;
            this.fireLit = false;
            Object.assign(this.player, { x: YARD_DOOR.x, y: 340, dir: 'down' });
            Object.assign(this.fred, { ...this.fredYardPos(), visible: tod < 2 });
            this.snapCamera();
            this.updateMusic();
        };
        if (stage === 'yard') toYard('toCabin', 1, 1);
        else if (stage === 'day2') toYard('tasks', 2, 0);
        else if (stage === 'day3') toYard('tasks', 3, 0);
        else if (stage === 'night') toYard('search', 3, 2);
    }

    // --- Adım ---

    step() {
        if (isPaused()) {
            this.gamepad?.poll();
            return;
        }
        this.frame++;
        if (this.intro > 0) this.intro--;
        this.gamepad?.poll();
        if (this.shake > 0) this.shake--;
        this.curtain += Math.sign(this.curtainTarget - this.curtain) * Math.min(0.03, Math.abs(this.curtainTarget - this.curtain));
        this.todVis += Math.sign(this.tod - this.todVis) * Math.min(0.012, Math.abs(this.tod - this.todVis));
        this.dialogue.step();
        this.stepSeq();

        const free = !this.seq && !this.dialogue.active && !this.fadingOut && this.intro === 0 && this.curtain < 0.05;
        if (free) this.movePlayer();
        else if (!this.seq?.walking) this.player.moving = false;

        if (this.area === 'trail') this.stepTrail(free);
        if (this.area === 'yard') this.stepYard(free);
        this.updateCamera();

        if (this.fadingOut) {
            this.fade = Math.min(FADE_FRAMES, this.fade + 1);
            if (this.fade >= FADE_FRAMES && !this.finished) {
                this.finished = true;
                this.running = false;
                this.onFinish();
            }
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
            if (stick.magnitude > 0) { dx = stick.x; dy = stick.y; speed = PLAYER_SPEED * stick.magnitude; }
        }
        player.moving = dx !== 0 || dy !== 0;
        if (!player.moving) return;
        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * speed, vy = (dy / len) * speed;
        if (!blocked(this.area, player.x + vx, player.y, this.felled)) player.x += vx;
        if (!blocked(this.area, player.x, player.y + vy, this.felled)) player.y += vy;
        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
    }

    // Patika: Fred peşinden gelir, yol ayrımlarında konuşulur, uçta açıklığa geçilir
    stepTrail(free) {
        const p = this.player, f = this.fred;
        if (p.moving || this.hist.length === 0) {
            this.hist.push({ x: p.x, y: p.y, dir: p.dir });
            if (this.hist.length > FOLLOW_LAG + 4) this.hist.shift();
        }
        const target = this.hist.length > FOLLOW_LAG ? this.hist[0] : { x: p.x - 44, y: p.y + 12, dir: p.dir };
        const moved = Math.hypot(target.x - f.x, target.y - f.y) > 1.5;
        f.moving = moved && p.moving;
        f.x += (target.x - f.x) * 0.2;
        f.y += (target.y - f.y) * 0.2;
        if (moved) f.dir = target.dir;

        if (!free) return;
        JUNCTIONS.forEach((j, i) => {
            if (this.junctionDone[i] || p.x < j.x - 170) return;
            this.junctionDone[i] = true;
            this.run([{ say: LINES.junction[i] }]);
        });
        if (p.x >= TRAIL.endX) {
            this.phase = 'transition';
            this.run([
                ...this.changeArea('yard', 60, 410, 'right', {
                    fred: { x: 30, y: 436, dir: 'right' },
                    after: () => { this.tod = this.todVis = 1; this.updateMusic(); }
                }),
                { say: LINES.yardArrive },
                { do: () => { this.phase = 'toCabin'; } }
            ]);
        }
    }

    // Açıklık: ağaçlar devrilir, Fred işini yapar, işler bitince akşam olur
    stepYard(free) {
        for (const f of this.felled.values()) {
            if (f.t < FALL_FRAMES + 20) {
                f.t++;
                if (f.t === FALL_FRAMES - 6) { this.shake = Math.max(this.shake, 8); Sfx.metalSlam(); }
            }
        }
        if (this.fredSwing && ++this.fredSwing.t > 12) this.fredSwing = null;

        // Fred'in işi (yalnızca gündüz ve oyuncu açıklıktayken ilerler)
        const job = this.fredJob;
        if (job && this.tod === 0 && this.phase === 'tasks') {
            this.dayFrames++;
            if (job.type === 'chop' && !job.done && --job.cd <= 0) {
                job.cd = FRED_SWING_GAP;
                job.hits++;
                this.fredSwing = { index: job.index, t: 0 };
                Sfx.step();
                if (job.hits >= FRED_HITS) {
                    job.done = true;
                    this.fell(job.index, 1);
                    Object.assign(this.fred, this.fredYardPos());
                    this.pendingLines = LINES.fredFelled;
                }
            }
            if (job.type === 'fish' && !job.caught && this.dayFrames >= FISH_FRAMES) {
                job.caught = true;
                this.fish = true;
            }
        }

        if (!free) return;
        if (this.pendingLines) {
            const lines = this.pendingLines;
            this.pendingLines = null;
            this.run([{ say: lines }]);
            return;
        }
        if (this.phase === 'tasks' && this.tasksDone()) this.startEvening();
    }

    updateCamera() {
        const target = this.camTarget();
        this.camX += (target - this.camX) * 0.1;
        if (Math.abs(target - this.camX) < 0.4) this.camX = target;
    }

    snapCamera() {
        this.camX = this.camTarget();
    }

    camTarget() {
        const p = this.player;
        if (this.area === 'trail') return Math.max(0, Math.min(TRAIL.w - VIEW.w, p.x - VIEW.w * 0.45));
        if (this.area === 'yard') return Math.max(0, Math.min(YARD.w - VIEW.w, p.x - VIEW.w * 0.5));
        return 0;
    }

    // --- Çizim ---

    speakerPos(speaker) {
        return speaker === 'biz' ? this.player : this.fred;
    }

    bob(id) {
        if (!this.dialogue.active || this.dialogue.finishedTyping) return 0;
        const who = this.dialogue.speaker === 'biz' ? 'player' : 'fred';
        return who === id && Math.floor(this.frame / 5) % 2 === 0 ? -PX / 2 : 0;
    }

    draw() {
        const { ctx } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, VIEW.w, VIEW.h);
        const camX = Math.round(this.camX);

        ctx.save();
        if (this.shake > 0) {
            ctx.translate(Math.round((hash(this.frame, 1, 5) - 0.5) * 6), Math.round((hash(this.frame, 2, 6) - 0.5) * 4));
        }
        ctx.translate(-camX, 0);
        if (this.area === 'trail') this.drawTrail(camX);
        else if (this.area === 'yard') this.drawYard(camX);
        else this.drawCabin();
        ctx.restore();

        this.drawLight(camX);

        if (this.curtain > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.curtain})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        }
        this.drawCaption();
        this.drawBubble(camX);
        this.drawHud();

        let veil = 0;
        if (this.fadingOut) veil = this.fade / FADE_FRAMES;
        else if (this.intro > 0) veil = this.intro / INTRO_FRAMES;
        if (veil > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${veil})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        }
    }

    shadow(x, y) {
        const { ctx } = this;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#10181c';
        ctx.fillRect(Math.round((x - 18) / PX) * PX, Math.round((y - 4) / PX) * PX, PX * 9, PX * 2);
        ctx.globalAlpha = 1;
    }

    drawHarry() {
        const p = this.player;
        this.shadow(p.x, p.y);
        drawPerson(this.ctx, p.x, p.y + this.bob('player'), 'harry', p.dir, p.moving, this.frame, 4);
        if (this.carry === 'water') drawBucket(this.ctx, p.x + (p.dir === 'left' ? -16 : 16), p.y - 22);
    }

    drawFred() {
        const f = this.fred;
        if (!f.visible) return;
        this.shadow(f.x, f.y);
        drawPerson(this.ctx, f.x, f.y + this.bob('fred'), 'fred', f.dir, f.moving, this.frame, 4);
        // Balık tutarken olta: Fred'den gölete uzanan ince çizgi
        if (this.area === 'yard' && this.fredJob?.type === 'fish' && this.tod === 0) {
            const sx = f.x + 10, sy = f.y - 44;
            const ex = FRED_FISH.x + 66, ey = POND.y + POND.h - 26;
            for (let i = 0; i <= 14; i++) {
                const u = i / 14;
                this.ctx.fillStyle = '#e8e4d0';
                this.ctx.fillRect(Math.round((sx + (ex - sx) * u) / PX) * PX, Math.round((sy + (ey - sy) * u + Math.sin(u * 3) * 4) / PX) * PX, PX, PX);
            }
        }
    }

    drawTree(tree, dx = 0) {
        const sprite = treeSpriteFor(tree);
        this.ctx.drawImage(sprite.canvas, Math.round(tree.x - sprite.ox + dx), Math.round(tree.y - sprite.oy));
    }

    // Kırılan ağaç: yatıyorsa kütük ve gövde; devriliyorsa dibinden dönerek düşer
    drawChopTree(tree, index) {
        const { ctx } = this;
        const f = this.felled.get(index);
        if (!f) {
            const swing = this.chopping?.index === index || this.fredSwing?.index === index;
            this.drawTree(tree, swing ? Math.round(Math.sin(this.frame * 1.6) * 3) : 0);
            return;
        }
        if (f.t < FALL_FRAMES) {
            const u = f.t / FALL_FRAMES;
            const sprite = treeSpriteFor(tree);
            ctx.save();
            ctx.translate(tree.x, tree.y);
            ctx.rotate(f.dir * u * u * (Math.PI / 2) * 0.96);
            ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy);
            ctx.restore();
            drawStump(ctx, tree.x, tree.y);
        } else {
            drawLyingTrunk(ctx, tree.x, tree.y, f.dir);
            drawStump(ctx, tree.x, tree.y);
        }
    }

    drawTrail(camX) {
        const { ctx } = this;
        ctx.drawImage(this.art.trail, camX, 0, VIEW.w, TRAIL.h, camX, 0, VIEW.w, TRAIL.h);
        const layers = [];
        for (const t of TRAIL_TREES) {
            if (t.x < camX - 140 || t.x > camX + VIEW.w + 140) continue;
            layers.push({ y: t.y, draw: () => this.drawTree(t) });
        }
        layers.push({ y: this.fred.y, draw: () => this.drawFred() });
        layers.push({ y: this.player.y, draw: () => this.drawHarry() });
        layers.sort((a, b) => a.y - b.y);
        for (const l of layers) l.draw();
    }

    drawYard(camX) {
        const { ctx } = this;
        ctx.drawImage(this.art.yard, camX, 0, VIEW.w, 560, camX, 0, VIEW.w, 560);
        const fishing = this.fredJob?.type === 'fish' && this.tod === 0;
        drawPondLife(ctx, this.frame, fishing ? { x: FRED_FISH.x + 62, y: POND.y + POND.h - 30 } : null);
        const visible = (x, pad = 200) => x > camX - pad && x < camX + VIEW.w + pad;
        const layers = [];
        for (const t of YARD_TREES) if (visible(t.x, 140)) layers.push({ y: t.y, draw: () => this.drawTree(t) });
        CHOP_TREES.forEach((t, i) => {
            if (visible(t.x, 260)) layers.push({ y: t.y, draw: () => this.drawChopTree(t, i) });
        });
        BUSHES.forEach((b, i) => {
            if (visible(b.x)) layers.push({ y: b.y + 16, draw: () => drawBush(ctx, b.x, b.y, !this.picked.has(i)) });
        });
        layers.push({ y: CABIN.y + CABIN.h, draw: () => {
            ctx.drawImage(this.art.cabinOut, CABIN.x, CABIN.y - CABIN_PAD);
            const glowing = this.tod >= 1 && (this.fireLit || this.phase === 'toBed' || this.phase === 'sleep');
            drawCabinGlow(ctx, this.frame, glowing ? Math.min(1, this.todVis) : 0);
        } });
        layers.push({ y: WOODPILE.y + WOODPILE.h, draw: () => drawWoodpile(ctx, this.woodForPile()) });
        layers.push({ y: BARREL.y + BARREL.h, draw: () => drawBarrel(ctx, this.barrelFilled) });
        layers.push({ y: FIRE_PIT.y + 10, draw: () => {
            drawFirePit(ctx, this.fireLit, this.frame);
            if (this.potOn) drawPot(ctx, FIRE_PIT.x, FIRE_PIT.y - 4, this.frame);
        } });
        layers.push({ y: this.fred.y, draw: () => this.drawFred() });
        layers.push({ y: this.player.y, draw: () => this.drawHarry() });
        layers.sort((a, b) => a.y - b.y);
        for (const l of layers) l.draw();
    }

    // Odun yığını: önceki günlerin artığı + bugün toplanan
    woodForPile() {
        if (this.phase === 'search' || this.tod === 2 || !this.tasks?.wood) return 2;
        return Math.min(9, 2 + this.tasks.wood.n);
    }

    drawCabin() {
        const { ctx } = this;
        ctx.drawImage(this.art.cabinIn, 0, 0);
        const layers = [];
        layers.push({ y: FRED_BED.y + FRED_BED.h, draw: () => drawBed(ctx, FRED_BED, this.beds.fred, BED_TONES.fred) });
        layers.push({ y: HARRY_BED.y + HARRY_BED.h, draw: () => drawBed(ctx, HARRY_BED, this.beds.harry, BED_TONES.harry) });
        layers.push({ y: STOVE.y + STOVE.h, draw: () => drawStove(ctx, this.fireLit, this.frame) });
        layers.push({ y: TABLE.y + TABLE.h, draw: () => drawTable(ctx) });
        layers.push({ y: CHEST.y + CHEST.h, draw: () => drawChest(ctx) });
        layers.push({ y: SHELF_CRATE.y + SHELF_CRATE.h, draw: () => drawCrateProp(ctx) });
        layers.push({ y: this.fred.y, draw: () => this.drawFred() });
        layers.push({ y: this.player.y, draw: () => this.drawHarry() });
        layers.sort((a, b) => a.y - b.y);
        for (const l of layers) l.draw();
    }

    // Akşam ışığı, gece karanlığı, ateşin hâlesi
    drawLight(camX) {
        const { ctx } = this;
        const tod = this.todVis;
        // Akşam: sıcak turuncu tül (0 -> 1), sonra geceye koyulaşır
        if (tod > 0) {
            const evening = Math.min(1, tod);
            ctx.fillStyle = `rgba(240, 120, 40, ${0.26 * evening})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
            ctx.fillStyle = `rgba(16, 12, 40, ${0.22 * evening})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        }
        if (tod > 1) this.drawNight(camX, tod - 1);

        // İçeride yanan sobanın sıcak ışığı
        if (this.area === 'cabin' && this.fireLit) {
            const flick = 0.85 + 0.15 * Math.sin(this.frame * 0.35);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(STOVE.x + STOVE.w / 2, STOVE.y + 70);
            ctx.scale(1.3, 0.8);
            const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 200);
            g.addColorStop(0, 'rgba(240, 130, 50, 0.5)');
            g.addColorStop(1, 'rgba(232, 116, 42, 0)');
            ctx.globalAlpha = flick;
            ctx.fillStyle = g;
            ctx.fillRect(-260, -260, 520, 520);
            ctx.restore();
        }

        // Ateşin hâlesi: yalnızca açıklıkta (dünya koordinatı: kamera kaydırması)
        if (this.area === 'yard' && this.fireLit) {
            ctx.save();
            ctx.translate(-camX, 0);
            drawFireGlow(ctx, this.frame, 0.6 + 0.8 * Math.min(1, tod));
            ctx.restore();
        }
    }

    // Gece: koyu mavi örtü; Harry'nin ve ateşin çevresi açık kalır
    drawNight(camX, amount) {
        if (!this.darkCanvas) {
            this.darkCanvas = document.createElement('canvas');
            this.darkCanvas.width = VIEW.w;
            this.darkCanvas.height = VIEW.h;
        }
        const d = this.darkCanvas.getContext('2d');
        d.globalCompositeOperation = 'source-over';
        d.clearRect(0, 0, VIEW.w, VIEW.h);
        d.fillStyle = `rgba(4, 8, 26, ${0.72 * amount})`;
        d.fillRect(0, 0, VIEW.w, VIEW.h);
        d.globalCompositeOperation = 'destination-out';
        const hole = (x, y, r, a) => {
            const g = d.createRadialGradient(x, y, r * 0.15, x, y, r);
            g.addColorStop(0, `rgba(0,0,0,${a})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            d.fillStyle = g;
            d.fillRect(x - r, y - r, r * 2, r * 2);
        };
        hole(this.player.x - camX, this.player.y - 30, 190, 0.9);
        if (this.fireLit && this.area === 'yard') hole(FIRE_PIT.x - camX, FIRE_PIT.y - 10, 230, 0.8);
        if (this.area === 'cabin') {
            // İçeride iki pencereden ay ışığı sızar
            for (const wx of [176, 788]) hole(wx, 120, 130, 0.35);
        }
        this.ctx.drawImage(this.darkCanvas, 0, 0);
    }

    drawBubble(camX) {
        const { dialogue, ctx } = this;
        if (!dialogue.active || !dialogue.visibleText) return;
        const who = this.speakerPos(dialogue.speaker);
        const ax = who.x - camX, ay = who.y - SPRITE_H - 6;
        const lines = wrapPixelText(dialogue.visibleText, BUBBLE_MAX_W, BUBBLE_SCALE);
        drawSpeechBubble(ctx, ax, ay, lines, { scale: BUBBLE_SCALE, viewLeft: 0, viewW: VIEW.w });
        const left = dialogue.speaker === 'biz';
        drawPortrait(ctx, dialogue.speaker, left ? 16 : VIEW.w - PORTRAIT.w - 16, VIEW.h - PORTRAIT.h - 16,
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

    drawHud() {
        const { ctx } = this;
        const objective = this.objective;
        if (objective && !this.dialogue.active && !this.seq && this.curtain < 0.3) {
            const label = `GÖREV: ${objective}`;
            const w = measurePixelText(label, 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(12, 8, w + 24, 32);
            drawPixelText(ctx, label, 24, 17, { scale: 2, color: '#fef3c7', shadow: '#0f172a' });
        }
        if (this.frame < HINT_FRAMES && this.intro === 0) {
            const text = 'OKLAR / WASD YÜRÜ     F KONUŞ / ETKİLEŞİM';
            const w = measurePixelText(text, 2);
            const x = Math.round((VIEW.w - w) / 2 / PX) * PX;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
            ctx.fillRect(x - 12, VIEW.h - 44, w + 24, 32);
            drawPixelText(ctx, text, x, VIEW.h - 36, { scale: 2, color: '#e2e8f0' });
        }
        if (!this.seq && !this.dialogue.active && this.curtain < 0.05 && !this.fadingOut) {
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
}
