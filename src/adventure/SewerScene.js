// Prolog 3 ile 4 arasındaki geçiş: KANALİZASYON.
//
// Prologun tek otomatik koşu bölümü. Karakter kendi kendine ilerliyor;
// oyuncunun elinde üç şey var: ŞERİT (A/D - sol analog), ZIPLAMA (SHIFT -
// ÇARPI) ve KAYMA (ENTER - sağ analog aşağı). Geri gitmek yok: W/S ve
// analogun ileri/geri ekseni hiç okunmuyor.
//
// Engeller atletizm engeli değil, kanalizasyonun kendi enkazı:
//   taş yığını  -> zıpla   (kayarsan çarparsın)
//   sarkan boru -> kay     (ZIPLARSAN ÇARPARSIN - bu ikisi birbirinin aynası)
//   çöküntü     -> yalnızca şerit değiştirerek
//   lağım gölü  -> zıpla
//
// Önümüzde prolog 3'te kurtardığımız BEŞ sağlıklı koşuyor ve her engeli
// bizden önce onlar geçiyor: bir sonraki hamleyi onların yolu söylüyor.
// Hikâyede burası "yoğun maruziyet" - prolog 4'te ormanın ağzında hepsinin
// dönmesinin sebebi bu tünel.
//
// Çarpmanın cezası ölüm değil TÖKEZLEME: hız düşer, ekran sarsılır,
// öndekiler açılır. Prologda kaybedilecek bir şey yok; burada da yok.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { drawTrainer } from '../world/trainerSprite.js';
import { drawSurvivor } from './people.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { PX } from '../pixel/pixelDraw.js';
import { drawLocationTitle } from '../pixel/screenText.js';
import { drawControlHint } from '../pixel/controlHint.js';
import { ControlHint } from '../config/controls.js';
import { Cutscene, shakeOffset } from './cutscene.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { SEWER_START, SEWER_RUN, SEWER_EXIT } from './prologLines.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import {
    VIEW, CX, HORIZON, EYE, PLAYER_Z, DRAW_Z,
    COURSE, EXIT_Z, OBSTACLES, HINT_LEAD, STUMBLE_FRAMES,
    speedAt, scaleAt, hits, rows, planFor, ACT_LEAD,
    newRunner, beginJump, beginSlide, stepPerson, applyMove
} from './sewerLayout.js';
import {
    drawTunnel, drawCeilingGrates, drawObstacle, drawExitShaft, drawDrip, drawVignette
} from './sewerArt.js';

const LOCATION_NAME = 'KANALİZASYON';
const INTRO_FRAMES = 44;
const TITLE_FRAMES = 210;
const TITLE_FADE = 34;
const FADE_FRAMES = 90;

const PLAYER_SCALE = 4;
const DRIP_COUNT = 26;

// Önümüzdeki beşin bizden ne kadar önde koştuğu (dünya birimi). En yakını
// ~1 saniye önde: engeli görüp hamlesini okumaya yetiyor, ekranda da hâlâ
// tanınacak büyüklükte duruyor.
const RUNNER_OFFSETS = [250, 380, 520, 680, 860];
const RUNNER_LANES = [0, 1, 2, 1, 0];

export class SewerScene {
    constructor({ canvas, input, gamepad, onExit, onFinish }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});
        this.onFinish = onFinish || (() => {});

        this.running = false;
        this.frame = 0;

        this.hint = new ControlHint();
        this.dialogue = new Dialogue({
            onBeep: (who) => Sfx.talk(VOICE_PITCH[who] || 1)
        });

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio();
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') { this.onExit(); return; }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.jump();
            else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.slide();
            else if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.changeLane(-1);
            else if (e.code === 'KeyD' || e.code === 'ArrowRight') this.changeLane(1);
            else if (e.code === 'KeyF') this.dialogue.advance();
        });

        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') { this.onExit(); return; }
            if (button === 'cross') this.jump();                 // ÇARPI: zıpla
            else if (button === 'rstickDown') this.slide();      // sağ analog aşağı: kay
            else if (button === 'dpadLeft') this.changeLane(-1);
            else if (button === 'dpadRight') this.changeLane(1);
            else if (button === 'triangle') this.dialogue.advance();
        });
    }

    // --- Sahne betiği ---
    buildScript() {
        const s = this.state;
        return new Cutscene([
            {
                // Karanlıktan açılma: rögardan yeni indik
                name: 'giris', frames: INTRO_FRAMES,
                onEnter: () => { s.titleFrames = TITLE_FRAMES; s.speedScale = 0.45; },
                onStep: (st, t) => { st.speedScale = 0.45 + t * 0.55; }
            },
            {
                // İlk engele kadar boş koşu: kontrolü tanıma payı
                name: 'ilk-koridor', frames: 120, lock: false,
                onEnter: () => { s.speedScale = 1; this.dialogue.start(SEWER_START); }
            },
            {
                // Parkur. Çıkış bacası görünene kadar sürüyor.
                name: 'kosu', frames: 0, lock: false,
                until: () => this.travelled + PLAYER_Z >= EXIT_Z - 260,
                onStep: () => {
                    if (this.travelled > 900 && !s.runLineSaid) {
                        s.runLineSaid = true;
                        this.dialogue.start(SEWER_RUN);
                    }
                }
            },
            {
                // Merdiven: koşu yavaşlıyor, kimse artık engelle uğraşmıyor
                name: 'cikis', frames: 96, lock: false,
                onEnter: () => this.dialogue.start(SEWER_EXIT),
                onStep: (st, t) => { st.speedScale = Math.max(0, 1 - t); }
            },
            {
                // Yukarı çıkıyoruz: ekran kararıyor, prolog 4 açılıyor
                name: 'kararma', frames: FADE_FRAMES,
                onEnter: () => { s.speedScale = 0; this.dialogue.cut(); },
                onStep: (st, t) => { st.fadeOut = t * t; },
                onExit: () => this.onFinish()
            }
        ], s).start();
    }

    start() {
        this.frame = 0;
        this.travelled = 0;

        this.player = newRunner(1);

        this.runners = RUNNER_OFFSETS.map((offset, i) => ({
            ...newRunner(RUNNER_LANES[i]),
            index: i,
            offset,
            handledZ: null
        }));

        // Parkur kopyalanıyor: "çarpıldı" işareti modül sabitine yazılırsa
        // sahne ikinci kez açıldığında engeller ölü geliyor.
        this.obstacles = COURSE.map(o => ({ ...o, hit: false }));
        this.rows = rows(this.obstacles);

        // Öğretmelerin çıkacağı yerler: her hamlenin İLK örneği
        this.hintZ = {
            jump: this.firstZWhere(o => OBSTACLES[o.type].clear === 'zipla'),
            slide: this.firstZWhere(o => OBSTACLES[o.type].clear === 'kay'),
            lane: this.firstZWhere(o => OBSTACLES[o.type].clear === null)
        };

        this.drips = Array.from({ length: DRIP_COUNT }, (_, i) => this.newDrip(i * 90));
        this.hint = new ControlHint();
        this.dialogue.cut();
        this.stickLatch = 0;

        this.state = {
            speedScale: 0,
            fadeOut: 0,
            shake: 0,
            titleFrames: 0,
            stumble: 0,
            crashes: 0,
            runLineSaid: false
        };

        this.script = this.buildScript();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic('sewer');

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

    firstZWhere(predicate) {
        const match = this.obstacles.filter(predicate).sort((a, b) => a.z - b.z)[0];
        return match ? match.z : Infinity;
    }

    newDrip(z) {
        return {
            z: this.travelled + z + Math.random() * 260,
            x: (Math.random() - 0.5) * 420,
            h: 300 + Math.random() * 90,
            vy: 3.4 + Math.random() * 2.6
        };
    }

    // --- Adım ---
    step() {
        this.frame++;
        const s = this.state;
        if (s.titleFrames > 0) s.titleFrames--;
        if (s.shake > 0) s.shake = Math.max(0, s.shake - 0.5);

        this.gamepad?.poll();
        this.readStick();
        this.dialogue.step();
        this.hint.step();

        // Otomatik koşu: ileri gitmek oyuncunun elinde değil. Tökezleme
        // hızı geçici olarak kesiyor, sonra kendiliğinden toparlıyor.
        let scale = s.speedScale;
        if (s.stumble > 0) {
            s.stumble--;
            scale *= 0.25 + 0.75 * (1 - s.stumble / STUMBLE_FRAMES);
        }
        this.travelled += speedAt(this.travelled) * scale;

        stepPerson(this.player);
        this.updateRunners();
        this.checkHits();
        this.updateHints();
        this.updateDrips();

        // Ayak sesi: tünelde yankılanıyor, koşunun hızını kulakla da veriyor
        if (scale > 0.4 && this.player.pose === 'kosu' && this.frame % 11 === 0) Sfx.step();

        this.script.step();
    }

    // Sol analog yatayda bir tam şerit değiştirir; kolu yatık tutmak
    // şeritleri ardı ardına geçirmesin diye nötre dönmeden ikinci kez
    // tetiklenmiyor. Dikey eksen hiç okunmuyor: geri gitmek yok.
    readStick() {
        if (!this.gamepad) return;
        const x = this.gamepad.stick().x;
        if (Math.abs(x) < 0.4) { this.stickLatch = 0; return; }
        const dir = x < 0 ? -1 : 1;
        if (this.stickLatch === dir) return;
        this.stickLatch = dir;
        this.changeLane(dir);
    }

    // --- Kontroller ---
    changeLane(direction) {
        if (!this.canAct()) return;
        if (!applyMove(this.player, direction < 0 ? 'sol' : 'sag')) return;
        this.hint.dismiss('lane');
        Sfx.dash();
    }

    jump() {
        if (!this.canAct()) return;
        if (!beginJump(this.player)) return;
        this.hint.dismiss('jump');
        Sfx.jump();
    }

    slide() {
        if (!this.canAct()) return;
        beginSlide(this.player);
        this.hint.dismiss('slide');
        Sfx.slide();
    }

    canAct() {
        return this.running && this.state.speedScale > 0 && this.state.stumble <= 0;
    }

    // --- Öndeki beş sağlıklı ---
    // Çarpışmaları hesaplanmıyor: onlar HER ZAMAN geçiyor. İşleri oyuncuya
    // bir sonraki hamleyi göstermek; tökezleyen bir öndeki bunu bozardı.
    updateRunners() {
        for (const runner of this.runners) {
            const myZ = this.travelled + PLAYER_Z + runner.offset;
            const row = this.rows.find(r => r.z > myZ);
            if (row && runner.handledZ !== row.z) {
                const move = planFor(row, runner.lane);
                if (move && row.z - myZ <= ACT_LEAD[move]) {
                    runner.handledZ = row.z;
                    applyMove(runner, move);
                }
            }
            stepPerson(runner);
        }
    }

    // --- Çarpışma ---
    checkHits() {
        const s = this.state;
        if (s.stumble > 0 || s.speedScale <= 0) return;

        for (const obstacle of this.obstacles) {
            if (obstacle.hit) continue;
            const rel = obstacle.z - this.travelled;
            if (rel > PLAYER_Z + 200) break;          // parkur z'ye göre sıralı
            if (rel < -260) continue;
            if (!hits(obstacle, {
                rel, x: this.player.x,
                pose: this.player.pose, height: this.player.height
            })) continue;

            obstacle.hit = true;
            s.stumble = STUMBLE_FRAMES;
            s.crashes++;
            s.shake = 7;
            this.player.pose = 'kosu';
            this.player.height = 0;
            this.player.vy = 0;
            this.player.slideLeft = 0;
            Sfx.stumble();
            break;
        }
    }

    // Yeni bir hamle isteyen ilk engelden önce ekranın üstünde öğretme
    // beliriyor. Bir kez öğretilen ikinci kez gösterilmiyor (ControlHint
    // bunu kendi tutuyor).
    updateHints() {
        const ahead = this.travelled + HINT_LEAD;
        if (ahead >= this.hintZ.jump) this.hint.show('jump');
        if (ahead >= this.hintZ.slide) this.hint.show('slide');
        if (ahead >= this.hintZ.lane) this.hint.show('lane');
    }

    // Damla düşer, zemine varınca ya da kameranın gerisinde kalınca ileride
    // yeniden doğar. Ses her damlada değil: yirmi altı damlanın hepsi ses
    // çıkarınca tünel yağmur gibi duyuluyor.
    updateDrips() {
        for (const drip of this.drips) {
            drip.h -= drip.vy;
            const rel = drip.z - this.travelled;
            if (drip.h > 0 && rel > 0) continue;
            if (drip.h <= 0 && rel > 0 && rel < 700 && Math.random() < 0.2) Sfx.drip();
            Object.assign(drip, this.newDrip(600 + Math.random() * 900));
        }
    }

    get titleAlpha() {
        const frames = this.state.titleFrames;
        if (frames <= 0) return 0;
        const elapsed = TITLE_FRAMES - frames;
        if (elapsed < TITLE_FADE) return elapsed / TITLE_FADE;
        if (frames < TITLE_FADE) return frames / TITLE_FADE;
        return 1;
    }

    // --- Çizim ---
    draw() {
        const { ctx, canvas } = this;
        const s = this.state;
        ctx.imageSmoothingEnabled = false;

        const shake = shakeOffset(this.frame, s.shake);
        ctx.save();
        ctx.translate(Math.max(-10, Math.min(10, shake.x)), Math.max(-8, Math.min(8, shake.y)));

        drawTunnel(ctx, this.travelled);
        drawCeilingGrates(ctx, this.travelled);
        drawExitShaft(ctx, this.travelled);

        // Uzaktan yakına: perspektifte sıralama boyama sırasıyla yapılıyor
        const actors = [];
        for (const obstacle of this.obstacles) {
            const rel = obstacle.z - this.travelled;
            if (rel < -200 || rel > DRAW_Z) continue;
            actors.push({ z: rel, draw: () => drawObstacle(ctx, obstacle, rel) });
        }
        for (const runner of this.runners) {
            const rel = PLAYER_Z + runner.offset;
            actors.push({ z: rel, draw: () => this.drawPerson(ctx, runner, rel, runner.index) });
        }
        actors.push({ z: PLAYER_Z, draw: () => this.drawPerson(ctx, this.player, PLAYER_Z, -1) });
        actors.sort((a, b) => b.z - a.z);
        for (const actor of actors) actor.draw();

        for (const drip of this.drips) drawDrip(ctx, drip, this.travelled);

        drawVignette(ctx);
        this.drawBubble(ctx);
        ctx.restore();

        drawLocationTitle(ctx, LOCATION_NAME, this.titleAlpha, VIEW.w);
        drawControlHint(ctx, this.hint, VIEW.w);

        const dark = this.script.name === 'giris' ? 1 - this.script.progress : s.fadeOut;
        if (dark > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${Math.min(1, dark)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Kişinin ekrandaki yeri: z ölçeğine göre küçülüyor, ayakları zemine
    // basıyor. index -1 ise oyuncu (antrenör sprite'ı).
    personScreen(person, z) {
        const scale = scaleAt(z);
        return {
            scale,
            x: CX + person.x * scale,
            foot: HORIZON + (EYE - person.height) * scale
        };
    }

    drawPerson(ctx, person, z, index) {
        const { scale, x, foot } = this.personScreen(person, z);
        const sprite = Math.max(2, Math.round(PLAYER_SCALE * scale));
        const cx = Math.round(x);
        const cy = Math.round(foot) - (16 * sprite) / 2;
        const pose = person.pose === 'kay' ? 'slide' : 'up';

        // Zemindeki gölge: zıplarken küçülüp koyulaşıyor, yükseklik ancak
        // böyle okunuyor
        const shadowW = Math.max(PX, Math.round((52 - person.height * 0.16) * scale));
        if (shadowW > 0) {
            ctx.save();
            ctx.globalAlpha = Math.max(0.12, 0.34 - person.height * 0.0016);
            ctx.fillStyle = '#000000';
            ctx.fillRect(cx - shadowW / 2, Math.round(HORIZON + EYE * scale) - PX, shadowW, PX * 2);
            ctx.restore();
        }

        const bob = this.bob(index < 0 ? 'biz' : `saglikli-${index}`);
        if (index < 0) drawTrainer(ctx, cx, cy + bob, pose, true, sprite);
        else drawSurvivor(ctx, cx, cy + bob, pose, true, sprite, index);
    }

    // --- Konuşma ---
    bob(who) {
        if (this.dialogue.speaker !== who) return 0;
        return Math.floor(this.frame / 7) % 2 === 0 ? -PX : 0;
    }

    speakerActor() {
        const who = this.dialogue.speaker;
        if (!who) return null;
        if (who === 'biz') return { person: this.player, z: PLAYER_Z };
        const match = /^saglikli-(\d+)$/.exec(who);
        if (!match) return null;
        const runner = this.runners[Number(match[1])];
        if (!runner) return null;
        return { person: runner, z: PLAYER_Z + runner.offset };
    }

    drawBubble(ctx) {
        if (!this.dialogue.active) return;
        const actor = this.speakerActor();
        if (!actor) return;
        const text = this.dialogue.visibleText;
        if (!text) return;

        const { x, foot, scale } = this.personScreen(actor.person, actor.z);
        const lines = wrapPixelText(text, 460, 2);
        // Uzaktaki konuşanın balonu sprite'ıyla birlikte küçülmüyor: yazı
        // okunaklı kalmalı, yalnızca kuyruk konuşana iniyor.
        const anchorY = Math.max(PX * 22, Math.round(foot - 74 * scale));
        drawSpeechBubble(ctx, Math.round(x), anchorY, lines, {
            scale: 2, viewLeft: 0, viewW: VIEW.w
        });
    }
}
