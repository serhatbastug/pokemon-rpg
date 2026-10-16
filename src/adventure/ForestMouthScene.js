// Orman ağzı: araba sürüşünün bitişi. Harabe şehrin kenarında araba yolun alt
// şeridinden gelir ve durur; Harry, Fred ve üç sağlıklı iner. Sağlıklılar
// (aynı konuşmayla) binaların arasındaki dar sokaktan şehirdeki sığınağa
// gider; Harry ile Fred ağaç duvarındaki boşluktan ormana girer.
//
//   arrive -> park -> talk -> helpersLeave -> forest -> (fade)
//
// Zemin, ağaçlar ve yerleşim eski "şehir kenarı -> orman girişi" sahnesinden
// (forestLayout.js / forestArt.js). Dünya 2400 geniş; kamera ormana girilince
// Harry'yi izler.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { isPaused } from '../core/pause.js';
import { treeSpriteFor } from '../pixel/trees.js';
import { hash, PX } from '../pixel/pixelDraw.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import { drawLocationTitle } from '../pixel/screenText.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { drawPerson } from './charSprites.js';
import { drawPortrait, PORTRAIT } from './portraits.js';
import { driveArt } from './driveArt.js';
import { DRIVE_LINES } from './driveScript.js';
import {
    WORLD, VIEW, LOCATION_NAME, CITY, GAP, TREES, WRECKS, ALLEY, CAR_LANE, corridorAt, FOREST
} from './forestLayout.js';
import { bakeGround, lampSprite, wreckSprite, witherCanvas } from './forestArt.js';

const INTRO_FRAMES = 40;
const FADE_FRAMES = 70;
const TITLE_FRAMES = 230;
const TITLE_FADE = 34;
const BUBBLE_SCALE = 2;
const BUBBLE_MAX_W = 460;
const CAR_SPEED = 6;
const SPRITE_H = 64;
const ACTION_BUTTONS = ['triangle', 'cross'];
const CAR_W = 192;                 // arabanın ekran genişliği (48 piksel)

export class ForestMouthScene {
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
            if (e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') this.dialogue.advance();
        });
        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') this.onExit();
            if (ACTION_BUTTONS.includes(button)) this.dialogue.advance();
        });
    }

    // Zemin ve nesneler bir kez hazırlanır
    bake() {
        if (this.ground) return;
        this.ground = bakeGround();
        const props = [];
        for (const tree of TREES) {
            const sprite = treeSpriteFor(tree);
            // Şehre yakın ağaçlar kurumuş, ormandakiler canlı
            const witherChance = (780 - tree.x) / 260 + 1;
            const dead = hash(tree.x, tree.y, 331) < witherChance;
            props.push({
                canvas: dead ? witherCanvas(sprite.canvas) : sprite.canvas,
                x: tree.x - sprite.ox, y: tree.y - sprite.oy, baseY: tree.y
            });
        }
        CITY.lamps.forEach((lampX, i) => {
            const lamp = lampSprite(i % 2);
            props.push({
                canvas: lamp.canvas,
                x: lampX - lamp.ox, y: CITY.topWalk.y + CITY.topWalk.h - 4 - lamp.oy,
                baseY: CITY.topWalk.y + CITY.topWalk.h - 4
            });
        });
        for (const wreck of WRECKS) {
            const sprite = wreckSprite(wreck);
            props.push({ canvas: sprite.canvas, x: sprite.x, y: sprite.y, baseY: sprite.baseY });
        }
        props.sort((a, b) => a.baseY - b.baseY);
        this.props = props;
    }

    start() {
        this.bake();
        this.frame = 0;
        this.intro = INTRO_FRAMES;
        this.fade = 0;
        this.fadingOut = false;
        this.finished = false;
        this.camX = 0;
        this.following = false;
        this.titleFrames = 0;
        this.titleShown = false;
        this.dust = [];
        this.phase = 'arrive';
        this.timer = 0;
        this.car = { x: -CAR_W, y: CAR_LANE.y, speed: CAR_SPEED };
        const mk = (who, speaker, tx, ty) => ({ who, speaker, x: 0, y: 0, tx, ty, dir: 'down', moving: false, visible: false });
        const stand = CAR_LANE.stopX;
        this.people = [
            mk('saglikli0', 'saglikli-0', stand - 130, 330),
            mk('saglikli1', 'saglikli-1', stand - 80, 334),
            mk('saglikli2', 'saglikli-2', stand - 30, 330),
            mk('harry', 'biz', stand + 70, 332),
            mk('fred', 'arkadas', stand + 124, 334)
        ];
        this.dialogue.cut();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic('ruin');

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

    person(who) {
        return this.people.find(p => p.who === who);
    }

    // --- Adım ---

    step() {
        if (isPaused()) return;
        this.frame++;
        if (this.intro > 0) this.intro--;
        this.dialogue.step();
        this.timer++;
        this.stepPhase();
        this.stepCamera();
        this.dust = this.dust.filter(d => --d.life > 0);
        for (const d of this.dust) { d.x += d.vx; d.y -= 0.4; }

        if (this.fadingOut) {
            this.fade = Math.min(FADE_FRAMES, this.fade + 1);
            if (this.fade >= FADE_FRAMES && !this.finished) {
                this.finished = true;
                this.running = false;
                this.onFinish();
            }
        }
    }

    walk(p, tx, ty, speed) {
        const dx = tx - p.x, dy = ty - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed) {
            p.x = tx; p.y = ty; p.moving = false;
            return false;
        }
        p.x += (dx / dist) * speed;
        p.y += (dy / dist) * speed;
        p.moving = true;
        if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? 'left' : 'right';
        else p.dir = dy < 0 ? 'up' : 'down';
        return true;
    }

    stepPhase() {
        const car = this.car;
        if (this.phase === 'arrive') {
            if (this.intro > 0) return;
            // Duruşa doğru yavaşlar
            const left = CAR_LANE.stopX - car.x;
            car.speed = Math.max(0.8, Math.min(CAR_SPEED, left * 0.045));
            car.x += car.speed;
            if (this.frame % 3 === 0) {
                this.dust.push({ x: car.x - CAR_W / 2 + 6, y: car.y - 6, vx: -0.8 - Math.random() * 0.6, life: 22 });
            }
            if (car.x >= CAR_LANE.stopX - 0.5) {
                car.x = CAR_LANE.stopX;
                car.speed = 0;
                Sfx.slide();
                this.phase = 'park';
                this.timer = 0;
            }
        } else if (this.phase === 'park') {
            // Kapılar açılır, sırayla inerler
            this.people.forEach((p, i) => {
                if (this.timer === 40 + i * 22) {
                    p.visible = true;
                    p.x = CAR_LANE.stopX - 40 + i * 20;
                    p.y = car.y + 6;
                    Sfx.step();
                }
            });
            let moving = false;
            this.people.forEach((p, i) => {
                if (p.visible && this.timer > 40 + i * 22) moving = this.walk(p, p.tx, p.ty, 2.2) || moving;
            });
            if (this.timer > 40 + this.people.length * 22 && !moving) {
                for (const p of this.people) p.dir = p.who === 'harry' || p.who === 'fred' ? 'left' : 'right';
                this.phase = 'talk';
                this.dialogue.start(DRIVE_LINES.shelter);
            }
        } else if (this.phase === 'talk') {
            if (!this.dialogue.active) {
                this.phase = 'helpersLeave';
                this.timer = 0;
                this.leave = { step: 0 };
            }
        } else if (this.phase === 'helpersLeave') {
            // Sağlıklılar yolun ucundan sokağa girer, Harry ile Fred onları izler
            const alleyX = ALLEY.x + ALLEY.w / 2;
            const helpers = ['saglikli0', 'saglikli1', 'saglikli2'].map(w => this.person(w));
            let busy = false;
            helpers.forEach((p, i) => {
                const wait = i * 18;
                if (this.timer < wait) return;
                if (!p.hidden) {
                    const route = [
                        [alleyX - 40 + i * 30, 322],
                        [alleyX - 40 + i * 30, 214],
                        [alleyX - 12 + i * 12, 176],
                        [alleyX - 12 + i * 12, 86]
                    ];
                    p.route = p.route ?? 0;
                    if (this.walk(p, route[p.route][0], route[p.route][1], 2.4)) busy = true;
                    else if (p.route < route.length - 1) { p.route++; busy = true; }
                    else { p.visible = false; p.hidden = true; }
                }
            });
            if (!busy && this.timer > 30) {
                this.phase = 'forest';
                this.timer = 0;
                this.person('harry').dir = 'right';
                this.person('fred').dir = 'right';
            }
        } else if (this.phase === 'forest') {
            const harry = this.person('harry'), fred = this.person('fred');
            // Yolu: çim şeritten boşluğa, oradan koridorun ortasına
            const hx = harry.x + 2.1;
            const targetY = hx < GAP.x0 ? (GAP.top + GAP.bottom) / 2 : hx < FOREST.x0 ? (GAP.top + GAP.bottom) / 2 : corridorAt(hx).center;
            harry.x = hx;
            harry.y += (targetY + 6 - harry.y) * 0.05;
            harry.dir = 'right'; harry.moving = true;
            fred.x += (harry.x - 62 - fred.x) * 0.08 + (harry.x - 62 > fred.x ? 0.3 : 0);
            fred.y += (targetY + 12 - fred.y) * 0.05;
            fred.dir = 'right'; fred.moving = true;
            if (!this.following && harry.x > GAP.x0) this.following = true;
            if (!this.titleShown && harry.x > FOREST.x0 + 40) {
                this.titleShown = true;
                this.titleFrames = TITLE_FRAMES;
                playMusic('forest');
            }
            if (harry.x > FOREST.x0 + 520 && !this.fadingOut) this.fadingOut = true;
        }
    }

    stepCamera() {
        const harry = this.person('harry');
        const target = this.following
            ? Math.max(0, Math.min(WORLD.w - VIEW.w, harry.x - VIEW.w * 0.45))
            : 0;
        this.camX += (target - this.camX) * 0.09;
        if (Math.abs(target - this.camX) < 0.4) this.camX = target;
        if (this.titleFrames > 0) this.titleFrames--;
    }

    // --- Çizim ---

    draw() {
        const { ctx } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, VIEW.w, VIEW.h);
        const camX = Math.round(this.camX);
        ctx.save();
        ctx.translate(-camX, 0);
        const sw = Math.min(WORLD.w - camX, VIEW.w);
        ctx.drawImage(this.ground, camX, 0, sw, WORLD.h, camX, 0, sw, WORLD.h);

        const layers = [];
        for (const prop of this.props) {
            if (prop.x > camX + VIEW.w + 200 || prop.x + prop.canvas.width < camX - 200) continue;
            layers.push({ y: prop.baseY, draw: () => ctx.drawImage(prop.canvas, Math.round(prop.x), Math.round(prop.y)) });
        }
        layers.push({ y: this.car.y, draw: () => this.drawCar() });
        for (const p of this.people) {
            if (p.visible) layers.push({ y: p.y, draw: () => this.drawGuy(p) });
        }
        layers.sort((a, b) => a.y - b.y);
        for (const l of layers) l.draw();

        for (const d of this.dust) {
            ctx.globalAlpha = d.life / 34;
            ctx.fillStyle = '#9a8f80';
            ctx.fillRect(Math.round(d.x), Math.round(d.y), PX * 2, PX * 2);
        }
        ctx.globalAlpha = 1;
        this.drawBubble(camX);
        ctx.restore();

        this.drawPortrait();
        const alpha = this.titleFrames > TITLE_FRAMES - TITLE_FADE
            ? (TITLE_FRAMES - this.titleFrames) / TITLE_FADE
            : Math.min(1, this.titleFrames / TITLE_FADE);
        drawLocationTitle(ctx, LOCATION_NAME, Math.max(0, alpha), VIEW.w);

        let veil = 0;
        if (this.fadingOut) veil = this.fade / FADE_FRAMES;
        else if (this.intro > 0) veil = this.intro / INTRO_FRAMES;
        if (veil > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${veil})`;
            ctx.fillRect(0, 0, VIEW.w, VIEW.h);
        }
    }

    drawCar() {
        const { ctx } = this;
        const img = driveArt().sideCar;
        const x = Math.round(this.car.x - CAR_W / 2);
        const h = img.height * (CAR_W / img.width);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#10181c';
        ctx.fillRect(x + 8, Math.round(this.car.y - 8), CAR_W - 16, 12);
        ctx.globalAlpha = 1;
        ctx.drawImage(img, x, Math.round(this.car.y - h + 6), CAR_W, h);
    }

    bob(p) {
        if (!this.dialogue.active || this.dialogue.finishedTyping) return 0;
        return this.dialogue.speaker === p.speaker && Math.floor(this.frame / 5) % 2 === 0 ? -PX / 2 : 0;
    }

    drawGuy(p) {
        const { ctx } = this;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#10181c';
        ctx.fillRect(Math.round((p.x - 18) / PX) * PX, Math.round((p.y - 4) / PX) * PX, PX * 9, PX * 2);
        ctx.globalAlpha = 1;
        drawPerson(ctx, p.x, p.y + this.bob(p), p.who, p.dir, p.moving, this.frame, 4);
    }

    drawBubble(camX) {
        const { dialogue, ctx } = this;
        if (!dialogue.active || !dialogue.visibleText) return;
        const who = this.people.find(p => p.speaker === dialogue.speaker) || this.person('harry');
        const lines = wrapPixelText(dialogue.visibleText, BUBBLE_MAX_W, BUBBLE_SCALE);
        drawSpeechBubble(ctx, Math.round(who.x), Math.round(who.y) - SPRITE_H - 6, lines, {
            scale: BUBBLE_SCALE, viewLeft: camX, viewW: VIEW.w
        });
    }

    drawPortrait() {
        const { dialogue, ctx } = this;
        if (!dialogue.active || !dialogue.visibleText) return;
        const sp = dialogue.speaker;
        drawPortrait(ctx, sp, sp === 'biz' ? 16 : VIEW.w - PORTRAIT.w - 16, VIEW.h - PORTRAIT.h - 16,
            { talking: !dialogue.finishedTyping, tick: this.frame });
    }
}
