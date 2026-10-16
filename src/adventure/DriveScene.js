// Araba sahnesi: laboratuvar çöktükten sonra Harry arabayı sürer. Arkadan,
// eğik (yükseltilmiş) bir açıyla yola bakılır; araba sol/sağ gider, yoldaki
// engellerden (terk edilmiş arabalar, enkaz, enfekte yayalar) kaçmak oyuncuya
// kalmış. Üç can: üçüncü çarpışmada yol baştan. Yolun sonunda orman başlar;
// araba durur, diğer sağlıklılar şehirdeki sığınağa gider, Harry ile Fred
// ormana yürür.
//
//   drive -> (yol biter) stop -> exitCar -> talk -> leave -> fade
//
// Yol sahte perspektifle çizilir: z = oyuncudan uzaklık, t = 1/(1+z/F) hem
// ekran y'sini hem ölçeği verir. Engeller yol boyunca (d) önceden dizilir.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import { hash } from '../pixel/pixelDraw.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { drawPerson } from './charSprites.js';
import { drawPortrait, PORTRAIT } from './portraits.js';
import { DRIVE, DRIVE_LINES, DRIVE_TEXT, buildCourse } from './driveScript.js';

const W = 1000, H = 560;
const HORIZON = 200;
const CAR_Y = 480;               // arabanın taban çizgisi (t = 1)
const FOCAL = 260;
const ROAD_HALF_MIN = 40, ROAD_HALF_GAIN = 360;
const LANE_SCALE = 0.8;          // lat 1 = yol yarı genişliğinin %80'i
const FADE_FRAMES = 70;
const BUBBLE_SCALE = 2;
const BUBBLE_MAX_W = 460;
const INTRO_FRAMES = 40;
const ACTION_BUTTONS = ['triangle', 'cross'];

const tOf = (z) => 1 / (1 + z / FOCAL);
const yOf = (t) => HORIZON + (CAR_Y - HORIZON) * t;
const halfOf = (t) => ROAD_HALF_MIN + ROAD_HALF_GAIN * t;

export class DriveScene {
    constructor({ canvas, input, gamepad, onExit, onFinish }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});
        this.onFinish = onFinish || (() => {});
        this.running = false;
        this.course = buildCourse();
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
        this.restart();
        this.phase = 'drive';
        this.people = [];
        this.timer = 0;
        this.dialogue.cut();
    }

    // Yolun başına dön (can bitince)
    restart() {
        this.progress = 0;
        this.speed = 0;
        this.lat = 0;              // arabanın şeridi: -1 .. 1
        this.steer = 0;            // eğim animasyonu
        this.health = DRIVE.health;
        this.hurt = 0;             // dokunulmazlık süresi
        this.hintUntil = this.frame + 420;
        this.sparks = [];
        this.smoke = [];
    }

    start() {
        this.reset();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic('siege');

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

    // --- Adım ---

    step() {
        this.frame++;
        if (this.intro > 0) this.intro--;
        this.gamepad?.poll();
        if (this.shake > 0) this.shake--;
        this.curtain += Math.sign(this.curtainTarget - this.curtain) * Math.min(0.03, Math.abs(this.curtainTarget - this.curtain));
        this.dialogue.step();

        if (this.phase === 'drive') this.stepDrive();
        else this.stepAfter();
        this.stepParticles();

        if (this.fadingOut) {
            this.fade = Math.min(FADE_FRAMES, this.fade + 1);
            if (this.fade >= FADE_FRAMES && !this.finished) {
                this.finished = true;
                this.running = false;
                this.onFinish();
            }
        }
    }

    steerInput() {
        const { input } = this;
        let dir = 0;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dir -= 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) dir += 1;
        if (dir === 0 && this.gamepad) {
            const stick = this.gamepad.stick();
            if (stick.magnitude > 0) dir = stick.x;
        }
        return dir;
    }

    stepDrive() {
        if (this.caption) {
            // Yenilgi perdesi: tamamen kararınca yol baştan
            if (this.curtain >= 1) {
                this.restart();
                this.caption = null;
                this.curtainTarget = 0;
            }
            return;
        }
        const free = this.intro === 0;
        if (free) this.speed = Math.min(DRIVE.speed, this.speed + DRIVE.speed / 70);
        const dir = free ? this.steerInput() : 0;
        this.lat = Math.max(-DRIVE.maxLat, Math.min(DRIVE.maxLat, this.lat + dir * DRIVE.steerSpeed));
        this.steer += (dir - this.steer) * 0.2;
        this.progress += this.speed;
        if (this.hurt > 0) this.hurt--;

        if (this.frame % 4 === 0) {
            this.smoke.push({ x: this.carX() + (hash(this.frame, 1, 1) - 0.5) * 30, y: CAR_Y - 10, life: 26 });
        }

        // Çarpışma
        if (this.hurt === 0) {
            for (const o of this.course.obstacles) {
                const z = o.d - this.progress;
                if (z < -DRIVE.hitBack || z > DRIVE.hitFront) continue;
                if (Math.abs(this.obstacleLat(o) - this.lat) < DRIVE.carHalf + o.half) {
                    this.crash();
                    break;
                }
            }
        }

        if (this.progress >= this.course.length) {
            this.phase = 'stop';
            this.timer = 0;
        }
    }

    crash() {
        this.health--;
        this.hurt = 90;
        this.shake = 22;
        Sfx.metalSlam();
        for (let i = 0; i < 14; i++) {
            this.sparks.push({
                x: this.carX(), y: CAR_Y - 50, vx: (hash(i, this.frame, 3) - 0.5) * 12,
                vy: -2 - hash(i, this.frame, 4) * 6, life: 24
            });
        }
        this.speed *= 0.4;
        if (this.health <= 0) {
            this.caption = DRIVE_TEXT.crashed;
            this.curtainTarget = 1;
            Sfx.deny();
        }
    }

    obstacleLat(o) {
        return o.lat + (o.kind === 'infected' ? Math.sin(this.frame * 0.03 + o.d) * 0.08 : 0);
    }

    carX() {
        const t = 1;
        return W / 2 + this.lat * halfOf(t) * LANE_SCALE;
    }

    // Yol bitti: araba yavaşça durur, herkes iner, vedalaşma, yürüyüş
    stepAfter() {
        this.timer++;
        const car = this.carX();
        if (this.phase === 'stop') {
            this.speed = Math.max(0, this.speed - 0.1);
            this.progress += this.speed;
            if (this.speed === 0 && this.timer > 30) {
                Sfx.slide();
                this.phase = 'exitCar';
                this.timer = 0;
                const mk = (who, speaker, x, tx, dir) => ({
                    who, speaker, x, y: CAR_Y + 18, tx, ty: 506, dir, moving: false
                });
                this.people = [
                    mk('saglikli0', 'saglikli-0', car - 70, car - 190, 'left'),
                    mk('saglikli1', 'saglikli-1', car - 70, car - 250, 'left'),
                    mk('saglikli2', 'saglikli-2', car - 70, car - 310, 'left'),
                    mk('harry', 'biz', car + 70, car + 190, 'right'),
                    mk('fred', 'arkadas', car + 70, car + 255, 'right')
                ];
            }
        } else if (this.phase === 'exitCar') {
            let moving = false;
            for (const p of this.people) moving = this.walkPerson(p, p.tx, p.ty, 2.2) || moving;
            if (!moving) {
                for (const p of this.people) p.dir = p.who === 'harry' || p.who === 'fred' ? 'left' : 'right';
                this.phase = 'talk';
                this.dialogue.start(DRIVE_LINES.shelter);
            }
        } else if (this.phase === 'talk') {
            if (!this.dialogue.active) {
                this.phase = 'leave';
                this.timer = 0;
            }
        } else if (this.phase === 'leave') {
            let busy = false;
            for (const p of this.people) {
                if (p.who === 'harry' || p.who === 'fred') {
                    // Yolun ucundaki ormana doğru yürürler
                    const off = p.who === 'harry' ? -24 : 24;
                    busy = this.walkPerson(p, W / 2 + off * (1 - tOf(0) * 0) * Math.max(0.25, (p.y - HORIZON) / (CAR_Y - HORIZON)), HORIZON + 14, 1.7) || busy;
                    p.dir = 'up';
                } else {
                    busy = this.walkPerson(p, -80, p.ty + 14, 2.6) || busy;
                }
            }
            if (!busy || this.timer > 600) this.fadingOut = true;
        }
    }

    // Hedefe adım atar; yürüyorsa true
    walkPerson(p, tx, ty, speed) {
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

    stepParticles() {
        for (const s of this.sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.5; s.life--; }
        this.sparks = this.sparks.filter(s => s.life > 0);
        for (const s of this.smoke) { s.y -= 1.2; s.life--; }
        this.smoke = this.smoke.filter(s => s.life > 0);
    }

    // --- Çizim ---

    curveAt(t) {
        const bend = Math.sin(this.progress / 1300) * 130;
        const k = 1 - Math.min(1, t);
        return bend * k * k;
    }

    // Derinlik z'deki yatay konum (lat birimiyle)
    screenX(lat, t) {
        return W / 2 + this.curveAt(t) + lat * halfOf(t) * LANE_SCALE;
    }

    draw() {
        const { ctx } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (this.shake > 0) ctx.translate(Math.round((hash(this.frame, 1, 5) - 0.5) * 8), Math.round((hash(this.frame, 2, 6) - 0.5) * 6));

        this.drawSky();
        this.drawRoad();
        this.drawScenery();
        this.drawHorizonForest();
        this.drawThings();
        ctx.restore();

        if (this.curtain > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.curtain})`;
            ctx.fillRect(0, 0, W, H);
        }
        this.drawHud();
        this.drawBubble();
        this.drawCaption();

        let veil = 0;
        if (this.fadingOut) veil = this.fade / FADE_FRAMES;
        else if (this.intro > 0) veil = this.intro / INTRO_FRAMES;
        if (veil > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${veil})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    drawSky() {
        const { ctx } = this;
        const bands = ['#1b1430', '#2a1a3c', '#3e2144', '#5a2a48', '#7a3a48', '#a0524a'];
        const bh = Math.ceil(HORIZON / bands.length);
        bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, W, bh + 1); });
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = '#e8e0c8';
            ctx.globalAlpha = 0.4 + 0.4 * hash(i, 5, 5);
            ctx.fillRect(Math.round(hash(i, 1, 1) * W), Math.round(hash(i, 2, 2) * 90), 3, 3);
        }
        ctx.globalAlpha = 1;
        // Uzaktaki şehir silüeti (yol kıvrıldıkça kayar)
        const shift = this.curveAt(0) * 0.4;
        const nearEnd = this.forestAmount();
        for (let i = 0; i < 26; i++) {
            const bw = 44 + Math.round(hash(i, 3, 3) * 40);
            const bx = i * 42 - 20 + shift;
            const bhh = 30 + Math.round(hash(i, 4, 4) * 80) * (1 - nearEnd);
            ctx.fillStyle = '#17112a';
            ctx.fillRect(Math.round(bx), HORIZON - bhh, bw, bhh);
            ctx.fillStyle = '#d8b050';
            for (let wy = 0; wy < bhh - 12; wy += 14) {
                if (hash(i, wy, 7) > 0.7) ctx.fillRect(Math.round(bx) + 8 + Math.round(hash(i, wy, 8) * (bw - 20)), HORIZON - bhh + 8 + wy, 4, 5);
            }
        }
        ctx.fillStyle = '#17112a';
        ctx.fillRect(0, HORIZON - 2, W, 4);
    }

    // 0 = şehir, 1 = orman (yolun son bölümünde artar)
    forestAmount() {
        const start = this.course.length - DRIVE.forestZone;
        return Math.max(0, Math.min(1, (this.progress - start) / DRIVE.forestZone));
    }

    drawRoad() {
        const { ctx } = this;
        const forest = this.forestAmount();
        const ground = forest > 0.5 ? '#16301c' : '#2b2530';
        const verge = forest > 0.5 ? '#1f4026' : '#3a3340';
        for (let y = HORIZON; y < H; y++) {
            const t = (y - HORIZON) / (CAR_Y - HORIZON);
            if (t <= 0) continue;
            const z = FOCAL * (1 / t - 1) + this.progress;
            const hw = halfOf(t);
            const cx = W / 2 + this.curveAt(t);
            const band = Math.floor(z / 70) % 2 === 0;
            ctx.fillStyle = band ? ground : verge;
            ctx.fillRect(0, y, W, 1);
            // Asfalt
            ctx.fillStyle = band ? '#4a4c52' : '#44464c';
            ctx.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1);
            // Kenar çizgileri ve bordür
            const lw = Math.max(1, Math.round(7 * t));
            ctx.fillStyle = band ? '#d8d4c4' : '#a8a498';
            ctx.fillRect(Math.round(cx - hw), y, lw * 2, 1);
            ctx.fillRect(Math.round(cx + hw - lw * 2), y, lw * 2, 1);
            // Orta şerit çizgileri
            if (Math.floor(z / 95) % 2 === 0) {
                ctx.fillStyle = '#e6c84a';
                for (const s of [-1, 1]) {
                    ctx.fillRect(Math.round(cx + s * hw * LANE_SCALE * 0.5 - lw / 2), y, lw, 1);
                }
            }
        }
    }

    // Yol kenarı: direkler, binalar, ağaçlar (derinliğe göre uzaktan yakına)
    drawScenery() {
        const { ctx } = this;
        const sp = DRIVE.sceneSpacing;
        const far = 1700;
        const first = Math.ceil(this.progress / sp);
        const last = Math.floor((this.progress + far) / sp);
        const forestFrom = this.course.length - DRIVE.forestZone;
        for (let k = last; k >= first; k--) {
            const d = k * sp;
            const z = d - this.progress;
            const t = tOf(Math.max(0, z));
            const y = yOf(t);
            if (d > this.course.length + 400) continue;
            const isForest = d > forestFrom;
            for (const side of [-1, 1]) {
                const salt = side * 7 + k;
                if (isForest) {
                    this.drawTree(this.screenX(side * (1.25 + hash(k, side, 1) * 0.55), t), y, t, hash(k, side, 2));
                } else if (k % 2 === 0) {
                    this.drawBuilding(this.screenX(side * (1.5 + hash(k, side, 3) * 0.5), t), y, t, k, side);
                } else {
                    this.drawLamp(this.screenX(side * 1.22, t), y, t, side, salt);
                }
            }
        }
    }

    drawBuilding(x, y, t, k, side) {
        const { ctx } = this;
        const bw = (150 + hash(k, side, 4) * 80) * t;
        const bh = (180 + hash(k, side, 5) * 160) * t;
        const bx = side < 0 ? x - bw : x;
        ctx.fillStyle = '#241c36';
        ctx.fillRect(Math.round(bx), Math.round(y - bh), Math.round(bw), Math.round(bh));
        ctx.fillStyle = '#322749';
        ctx.fillRect(Math.round(bx), Math.round(y - bh), Math.max(2, Math.round(6 * t)), Math.round(bh));
        const cell = Math.max(6, 22 * t);
        for (let wy = cell; wy < bh - cell; wy += cell * 1.7) {
            for (let wx = cell * 0.6; wx < bw - cell; wx += cell * 1.6) {
                if (hash(k, Math.round(wx / cell) * 17 + Math.round(wy / cell), side) > 0.62) {
                    ctx.fillStyle = '#d8b050';
                    ctx.fillRect(Math.round(bx + wx), Math.round(y - bh + wy), Math.max(2, Math.round(cell * 0.5)), Math.max(2, Math.round(cell * 0.6)));
                }
            }
        }
    }

    drawLamp(x, y, t, side) {
        const { ctx } = this;
        const h = 150 * t, w = Math.max(2, 5 * t);
        ctx.fillStyle = '#15121f';
        ctx.fillRect(Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
        ctx.fillRect(Math.round(x - (side < 0 ? -1 : 1) * 0 - w / 2 + (side < 0 ? 0 : -26 * t)), Math.round(y - h), Math.round(w + 26 * t), Math.max(2, Math.round(5 * t)));
        ctx.fillStyle = '#f0d890';
        ctx.fillRect(Math.round(x + (side < 0 ? 22 * t : -26 * t)), Math.round(y - h + 4 * t), Math.max(2, Math.round(8 * t)), Math.max(2, Math.round(5 * t)));
    }

    drawTree(x, y, t, r) {
        const { ctx } = this;
        const h = (170 + r * 110) * t, w = (70 + r * 30) * t;
        ctx.fillStyle = '#2a1a12';
        ctx.fillRect(Math.round(x - 5 * t), Math.round(y - 20 * t), Math.max(2, Math.round(10 * t)), Math.round(20 * t));
        const greens = ['#0f2a16', '#173a1e', '#1f4a26'];
        for (let i = 0; i < 3; i++) {
            const tw = w * (1 - i * 0.22), top = y - 20 * t - h * (0.35 + i * 0.3);
            ctx.fillStyle = greens[i];
            const steps = 6;
            for (let s = 0; s < steps; s++) {
                const sw = tw * ((s + 1) / steps);
                ctx.fillRect(Math.round(x - sw / 2), Math.round(top + (h * 0.4 * s) / steps), Math.round(sw), Math.ceil(h * 0.4 / steps) + 1);
            }
        }
    }

    // Yolun sonunda ufuktaki orman duvarı (ortada yol açıklığı)
    drawHorizonForest() {
        const a = this.forestAmount();
        if (a <= 0) return;
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        const cx = W / 2 + this.curveAt(0.02);
        for (let i = -2; i < 24; i++) {
            const x = i * 46 + (hash(i, 1, 9) - 0.5) * 20;
            if (Math.abs(x - cx) < 44) continue;
            const h = 70 + hash(i, 2, 9) * 70;
            ctx.fillStyle = i % 2 ? '#0f2a16' : '#173a1e';
            for (let s = 0; s < 6; s++) {
                const sw = 56 * ((s + 1) / 6);
                ctx.fillRect(Math.round(x - sw / 2), Math.round(HORIZON - h + (h * s) / 6), Math.round(sw), Math.ceil(h / 6) + 1);
            }
        }
        ctx.restore();
    }

    // Engeller, araba ve inen kişiler derinliğe göre sıralı basılır
    drawThings() {
        const { ctx } = this;
        const list = [];
        for (const o of this.course.obstacles) {
            const z = o.d - this.progress;
            if (z < -80 || z > 1500) continue;
            list.push({ z, draw: () => this.drawObstacle(o, z) });
        }
        list.push({ z: 0, draw: () => this.drawCar() });
        for (const p of this.people) list.push({ z: -(p.y - CAR_Y) / 10 - 1, draw: () => this.drawGuy(p) });
        list.sort((a, b) => b.z - a.z);
        for (const item of list) item.draw();

        // Egzoz dumanı ve kıvılcım
        for (const s of this.smoke) {
            ctx.globalAlpha = s.life / 40;
            ctx.fillStyle = '#9a9aa0';
            ctx.fillRect(Math.round(s.x), Math.round(s.y), 10, 10);
        }
        ctx.globalAlpha = 1;
        for (const s of this.sparks) {
            ctx.fillStyle = '#ffd860';
            ctx.fillRect(Math.round(s.x), Math.round(s.y), 5, 5);
        }
    }

    drawObstacle(o, z) {
        const { ctx } = this;
        const t = tOf(Math.max(0, z));
        const y = yOf(t);
        const lat = this.obstacleLat(o);
        const x = this.screenX(lat, t);
        const w = o.half * 2 * halfOf(t) * LANE_SCALE;
        if (o.kind === 'infected') {
            const scale = 4.6 * t;
            ctx.save();
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = '#8fff6a';
            ctx.fillRect(Math.round(x - w * 1.2), Math.round(y - 60 * t * 1.2), Math.round(w * 2.4), Math.round(60 * t * 1.3));
            ctx.restore();
            drawPerson(ctx, x, y, 'saglikli1', 'down', true, this.frame, scale, { sickBlend: 1 });
            return;
        }
        if (o.kind === 'car') {
            const h = w * 0.7;
            const bx = Math.round(x - w / 2), by = Math.round(y - h);
            ctx.fillStyle = '#10121a';
            ctx.fillRect(bx - 2, Math.round(y - 4 * t), Math.round(w + 4), Math.max(2, Math.round(8 * t)));
            ctx.fillStyle = o.color;
            ctx.fillRect(bx, by + Math.round(h * 0.3), Math.round(w), Math.round(h * 0.55));
            ctx.fillRect(bx + Math.round(w * 0.14), by, Math.round(w * 0.72), Math.round(h * 0.4));
            ctx.fillStyle = '#12161c';
            ctx.fillRect(bx + Math.round(w * 0.2), by + Math.round(h * 0.06), Math.round(w * 0.6), Math.round(h * 0.26));
            ctx.fillStyle = '#161616';
            ctx.fillRect(bx + Math.round(w * 0.04), by + Math.round(h * 0.8), Math.round(w * 0.2), Math.round(h * 0.2));
            ctx.fillRect(bx + Math.round(w * 0.76), by + Math.round(h * 0.8), Math.round(w * 0.2), Math.round(h * 0.2));
            ctx.fillStyle = '#6a2a2a';
            ctx.fillRect(bx + Math.round(w * 0.04), by + Math.round(h * 0.42), Math.round(w * 0.16), Math.round(h * 0.1));
            ctx.fillRect(bx + Math.round(w * 0.8), by + Math.round(h * 0.42), Math.round(w * 0.16), Math.round(h * 0.1));
            return;
        }
        // Enkaz: birbirine yaslanmış beton parçaları
        const h = w * 0.5;
        const seed = Math.round(o.d);
        for (let i = 0; i < 7; i++) {
            const pw = w * (0.2 + hash(seed, i, 1) * 0.25), ph = h * (0.35 + hash(seed, i, 2) * 0.65);
            const px = x - w / 2 + (w - pw) * hash(seed, i, 3);
            ctx.fillStyle = hash(seed, i, 4) > 0.5 ? '#8a949a' : '#5f6b72';
            ctx.fillRect(Math.round(px), Math.round(y - ph), Math.round(pw), Math.round(ph));
            ctx.fillStyle = '#3a4146';
            ctx.fillRect(Math.round(px), Math.round(y - ph), Math.max(1, Math.round(pw * 0.15)), Math.round(ph));
        }
    }

    drawGuy(p) {
        const t = Math.max(0.3, (p.y - HORIZON) / (CAR_Y - HORIZON));
        const { ctx } = this;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#10181c';
        ctx.fillRect(Math.round(p.x - 20 * t), Math.round(p.y - 4), Math.round(40 * t), 8);
        ctx.restore();
        drawPerson(ctx, p.x, p.y + this.bob(p), p.who, p.dir, p.moving, this.frame, 4.6 * Math.min(1, t));
    }

    bob(p) {
        if (!this.dialogue.active || this.dialogue.finishedTyping) return 0;
        return this.dialogue.speaker === p.speaker && Math.floor(this.frame / 5) % 2 === 0 ? -2 : 0;
    }

    drawCar() {
        const { ctx } = this;
        if (this.hurt > 0 && Math.floor(this.frame / 4) % 2 === 0) return;
        const x = Math.round(this.carX() + this.steer * 6);
        const y = CAR_Y;
        const tilt = Math.round(this.steer * 5);
        const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx + (dy < -60 ? tilt : 0), y + dy, w, h); };
        ctx.globalAlpha = 0.35;
        r(-84, -6, 168, 16, '#000');
        ctx.globalAlpha = 1;
        r(-74, -36, 22, 36, '#0e0e10');
        r(52, -36, 22, 36, '#0e0e10');
        r(-78, -66, 156, 36, '#4a6a8a');
        r(-78, -66, 156, 5, '#6d8cab');
        r(-82, -34, 164, 14, '#2b3945');
        r(-58, -108, 116, 46, '#4a6a8a');
        r(-58, -108, 116, 5, '#6d8cab');
        r(-48, -102, 96, 32, '#16222c');
        r(-48, -102, 40, 6, '#27384a');
        const brake = this.phase === 'stop' || this.phase === 'drive' && this.speed < 2 ? '#ff6a5a' : '#c83232';
        r(-74, -60, 28, 16, brake);
        r(46, -60, 28, 16, brake);
        r(-20, -50, 40, 14, '#e8e8d0');
        r(-14, -46, 6, 6, '#2a2a30');
        r(-2, -46, 6, 6, '#2a2a30');
        r(8, -46, 6, 6, '#2a2a30');
    }

    drawBubble() {
        const { dialogue, ctx } = this;
        if (!dialogue.active || !dialogue.visibleText) return;
        const sp = dialogue.speaker;
        const who = this.people.find(p => p.speaker === sp);
        const ax = who ? who.x : W / 2;
        const ay = who ? who.y - 74 : 300;
        const lines = wrapPixelText(dialogue.visibleText, BUBBLE_MAX_W, BUBBLE_SCALE);
        drawSpeechBubble(ctx, ax, ay, lines, { scale: BUBBLE_SCALE, viewLeft: 0, viewW: W });
        const left = sp === 'biz';
        drawPortrait(ctx, sp, left ? 16 : W - PORTRAIT.w - 16, H - PORTRAIT.h - 16,
            { talking: !dialogue.finishedTyping, tick: this.frame });
    }

    drawCaption() {
        if (!this.caption) return;
        const { ctx } = this;
        const w = measurePixelText(this.caption, 3);
        const x = Math.round((W - w) / 2 / 4) * 4;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x - 16, 236, w + 32, 52);
        drawPixelText(ctx, this.caption, x, 250, { scale: 3, color: '#f4f1e4', shadow: '#0f172a' });
    }

    drawHud() {
        const { ctx } = this;
        if (this.phase !== 'drive') return;
        const label = `GÖREV: ${DRIVE_TEXT.objective}`;
        const lw = measurePixelText(label, 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(12, 8, lw + 24, 32);
        drawPixelText(ctx, label, 24, 17, { scale: 2, color: '#fef3c7', shadow: '#0f172a' });

        // Can ve yol ilerlemesi
        for (let i = 0; i < DRIVE.health; i++) {
            ctx.fillStyle = i < this.health ? '#ef4444' : '#3b1d1d';
            ctx.fillRect(W - 28 - i * 28, 14, 20, 20);
        }
        const bw = 240, bx = Math.round((W - bw) / 2), by = 52;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bx - 8, by - 6, bw + 16, 26);
        ctx.fillStyle = '#24323a';
        ctx.fillRect(bx, by, bw, 14);
        ctx.fillStyle = '#6fbf6a';
        ctx.fillRect(bx, by, Math.round(bw * Math.min(1, this.progress / this.course.length)), 14);

        if (this.frame < this.hintUntil && this.intro === 0 && !this.caption) {
            const text = this.gamepad?.connected ? DRIVE_TEXT.hintPad : DRIVE_TEXT.hintKeys;
            const w = measurePixelText(text, 2);
            const x = Math.round((W - w) / 2 / 4) * 4;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(x - 12, H - 44, w + 24, 32);
            drawPixelText(ctx, text, x, H - 36, { scale: 2, color: '#e2e8f0' });
        }
    }
}
