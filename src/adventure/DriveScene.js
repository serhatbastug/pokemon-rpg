// Araba sahnesi: laboratuvar çöktükten sonra Harry arabayı sürer. Arkadan,
// eğik (yükseltilmiş) bir açıyla yola bakılır; araba sol/sağ gider, yoldaki
// engellerden (terk edilmiş arabalar, enkaz, enfekte yayalar) kaçmak oyuncuya
// kalmış. Üç can: üçüncü çarpışmada yol baştan. Yol bitince (ya da K ile atlayınca)
// araba ormanın ağzına süzülür, ekran kararır; devamı ForestMouthScene'de.
//
//   drive -> (yol biter ya da atla) enter -> fade
//
// Yol sahte perspektifle çizilir: z = oyuncudan uzaklık, t = 1/(1+z/F) hem
// ekran y'sini hem ölçeği verir. Engeller yol boyunca (d) önceden dizilir.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { hash } from '../pixel/pixelDraw.js';
import { drawPerson } from './charSprites.js';
import { treeSpriteFor } from '../pixel/trees.js';
import { driveArt } from './driveArt.js';
import { DRIVE, DRIVE_TEXT, buildCourse } from './driveScript.js';

const W = 1000, H = 560;
const HORIZON = 200;
const CAR_Y = 480;               // arabanın taban çizgisi (t = 1)
const FOCAL = 260;
const ROAD_HALF_MIN = 40, ROAD_HALF_GAIN = 360;
const LANE_SCALE = 0.8;          // lat 1 = yol yarı genişliğinin %80'i
const FADE_FRAMES = 70;
const INTRO_FRAMES = 40;
const ENTER_FRAMES = 110;         // ormanın ağzına süzülme süresi (kare)

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
        this.initLow();

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio();
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();
            if (e.code === 'KeyK') this.skip();
        });
        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') this.onExit();
            if (button === 'square') this.skip();
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
        this.timer = 0;
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

        if (this.progress >= this.course.length) this.beginEnter();
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

    // Yol bitti: araba ormanın ağzına doğru yavaşlayarak girer, ekran kararır;
    // devamı ForestMouthScene'de (araba orada durur, herkes iner)
    stepAfter() {
        this.timer++;
        this.speed = Math.max(3, this.speed - 0.03);
        this.progress += this.speed;
        this.lat += (0 - this.lat) * 0.03;
        if (this.timer === ENTER_FRAMES) this.fadingOut = true;
    }

    beginEnter() {
        this.phase = 'enter';
        this.timer = 0;
    }

    // Atlama tuşu: sürüşü geçip doğrudan orman ağzına
    skip() {
        if (this.phase !== 'drive' || this.caption || this.fadingOut) return;
        this.beginEnter();
        this.fadingOut = true;
        Sfx.token();
    }

    stepParticles() {
        for (const s of this.sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.5; s.life--; }
        this.sparks = this.sparks.filter(s => s.life > 0);
        for (const s of this.smoke) { s.y -= 1.2; s.life--; }
        this.smoke = this.smoke.filter(s => s.life > 0);
    }

    // --- Çizim ---
    //
    // Sahne, ana ekranla AYNI piksel yoğunluğu için 250x140'lık küçük bir
    // tuvale çizilir (1 piksel = 4 ekran birimi) ve 4 kat büyütülür. Dikdörtgenler
    // bu ızgaraya oturtulur; böylece yoldaki hiçbir şey ince ya da yarım piksel
    // olamaz. Yazı, balon ve arayüz büyütmeden sonra tam çözünürlükte çizilir.

    initLow() {
        this.low = document.createElement('canvas');
        this.low.width = W / 4;
        this.low.height = H / 4;
        const lc = this.low.getContext('2d');
        lc.imageSmoothingEnabled = false;
        const raw = lc.fillRect.bind(lc);
        // Dönüşüm hep sabit 1/4 ölçek; kutuları piksel ızgarasına oturtup en az
        // 1 piksel çizer.
        lc.fillRect = (x, y, w, h) => {
            let x0 = x * 0.25, x1 = (x + w) * 0.25;
            let y0 = y * 0.25, y1 = (y + h) * 0.25;
            if (x0 > x1) [x0, x1] = [x1, x0];
            if (y0 > y1) [y0, y1] = [y1, y0];
            const X0 = Math.round(x0), Y0 = Math.round(y0);
            const X1 = Math.max(Math.round(x1), x1 > x0 ? X0 + 1 : X0);
            const Y1 = Math.max(Math.round(y1), y1 > y0 ? Y0 + 1 : Y0);
            if (X1 <= X0 || Y1 <= Y0) return;
            lc.setTransform(1, 0, 0, 1, 0, 0);
            raw(X0, Y0, X1 - X0, Y1 - Y0);
            lc.setTransform(0.25, 0, 0, 0.25, 0, 0);
        };
        this.lc = lc;
        this.tmp = document.createElement('canvas');
        this.tmp.width = 12;
        this.tmp.height = 16;
        this.tctx = this.tmp.getContext('2d');
    }

    // Sprite'ı sol-üst köşesi (birim) ve genişliğiyle (birim) piksel ızgarasına basar
    lcImgAt(img, left, top, widthUnits) {
        const lc = this.lc;
        const w = Math.max(1, Math.round(widthUnits / 4));
        const h = Math.max(1, Math.round(w * img.height / img.width));
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.drawImage(img, Math.round(left / 4), Math.round(top / 4), w, h);
        lc.setTransform(0.25, 0, 0, 0.25, 0, 0);
    }

    // Ortası x, tabanı bottom (birim) olacak şekilde
    lcImg(img, cx, bottom, widthUnits) {
        const hu = widthUnits * img.height / img.width;
        this.lcImgAt(img, cx - widthUnits / 2, bottom - hu, widthUnits);
    }

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

        const lc = this.lc;
        lc.setTransform(0.25, 0, 0, 0.25, 0, 0);
        lc.clearRect(0, 0, W, H);
        this.drawSky();
        this.drawRoad();
        this.drawHorizonForest();
        this.drawScenery();
        this.drawFog();
        this.drawThings();

        ctx.save();
        if (this.shake > 0) ctx.translate(Math.round((hash(this.frame, 1, 5) - 0.5) * 8), Math.round((hash(this.frame, 2, 6) - 0.5) * 6));
        ctx.drawImage(this.low, 0, 0, W, H);
        ctx.restore();

        if (this.curtain > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${this.curtain})`;
            ctx.fillRect(0, 0, W, H);
        }
        this.drawHud();
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
        const ctx = this.lc;
        const bands = ['#1b1430', '#2a1a3c', '#3e2144', '#5a2a48', '#7a3a48', '#a0524a'];
        const bh = Math.ceil(HORIZON / bands.length / 4) * 4;
        bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, W, bh); });
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = '#e8e0c8';
            ctx.globalAlpha = 0.4 + 0.4 * hash(i, 5, 5);
            ctx.fillRect(Math.round(hash(i, 1, 1) * W), Math.round(hash(i, 2, 2) * 90), 4, 4);
        }
        ctx.globalAlpha = 1;
        // Uzaktaki şehir: iki katman silüet (yol kıvrıldıkça kayar)
        const forest = this.forestAmount();
        const layers = [
            { color: '#2a1d3e', win: '#7a6a50', step: 36, minH: 40, rangeH: 70, sx: 0.25, salt: 3 },
            { color: '#17112a', win: '#d8b050', step: 44, minH: 34, rangeH: 96, sx: 0.5, salt: 4 }
        ];
        for (const L of layers) {
            const shift = this.curveAt(0) * L.sx;
            for (let i = -1; i < W / L.step + 2; i++) {
                const bw = L.step + Math.round(hash(i, L.salt, 3) * 16);
                const bx = i * L.step + shift;
                const bhh = (L.minH + Math.round(hash(i, L.salt, 4) * L.rangeH)) * (1 - forest);
                if (bhh < 4) continue;
                ctx.fillStyle = L.color;
                ctx.fillRect(Math.round(bx), HORIZON - bhh, bw, bhh);
                if (hash(i, L.salt, 6) > 0.6) ctx.fillRect(Math.round(bx) + bw / 2 - 2, HORIZON - bhh - 12, 4, 12);
                ctx.fillStyle = L.win;
                for (let wy = 8; wy < bhh - 8; wy += 12) {
                    for (let wx = 6; wx < bw - 8; wx += 12) {
                        if (hash(i * 9 + wx, wy, L.salt) > 0.72) ctx.fillRect(Math.round(bx) + wx, HORIZON - bhh + wy, 4, 4);
                    }
                }
            }
        }
        ctx.fillStyle = '#17112a';
        ctx.fillRect(0, HORIZON - 4, W, 8);
    }

    // 0 = şehir, 1 = orman (yolun son bölümünde artar)
    forestAmount() {
        const start = this.course.length - DRIVE.forestZone;
        return Math.max(0, Math.min(1, (this.progress - start) / DRIVE.forestZone));
    }

    drawRoad() {
        const ctx = this.lc;
        const forest = this.forestAmount();
        const ground = forest > 0.5 ? '#16301c' : '#2b2530';
        const verge = forest > 0.5 ? '#1f4026' : '#332d3a';
        for (let y = HORIZON; y < H; y += 4) {
            const t = (y + 2 - HORIZON) / (CAR_Y - HORIZON);
            const z = FOCAL * (1 / t - 1) + this.progress;
            const hw = halfOf(t);
            const cx = W / 2 + this.curveAt(t);
            const band = Math.floor(z / 70) % 2 === 0;
            ctx.fillStyle = band ? ground : verge;
            ctx.fillRect(0, y, W, 4);
            // Kaldırım (sağda ve solda): döşeme bantlı
            const wk = hw * 0.34;
            if (forest < 0.5) {
                ctx.fillStyle = Math.floor(z / 140) % 2 === 0 ? '#5a5468' : '#4f4a5e';
                ctx.fillRect(Math.round(cx - hw - wk), y, wk, 4);
                ctx.fillRect(Math.round(cx + hw), y, wk, 4);
            }
            // Asfalt
            ctx.fillStyle = band ? '#4a4c52' : '#44464c';
            ctx.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 4);
            // Kenar çizgileri
            const lw = 7 * t;
            ctx.fillStyle = band ? '#d8d4c4' : '#a8a498';
            ctx.fillRect(Math.round(cx - hw), y, lw * 2, 4);
            ctx.fillRect(Math.round(cx + hw - lw * 2), y, lw * 2, 4);
            // Şerit çizgileri
            if (Math.floor(z / 95) % 2 === 0) {
                ctx.fillStyle = '#e6c84a';
                for (const s of [-1, 1]) ctx.fillRect(Math.round(cx + s * hw * LANE_SCALE * 0.5 - lw / 2), y, lw, 4);
            }
        }
    }

    // Yol kenarı: binalar ve sokak lambaları (şehir), ağaçlar (orman).
    // Uzaktan yakına çizilir.
    drawScenery() {
        const art = driveArt();
        const sp = DRIVE.sceneSpacing;
        const far = 2200;
        const first = Math.ceil(this.progress / sp);
        const last = Math.floor((this.progress + far) / sp);
        const forestFrom = this.course.length - DRIVE.forestZone;
        for (let k = last; k >= first; k--) {
            const d = k * sp;
            const z = d - this.progress;
            const t = tOf(Math.max(0, z));
            const y = yOf(t);
            if (d > this.course.length + 600) continue;
            // Şehirden ormana geçiş: ortada karışık
            const forestChance = Math.max(0, Math.min(1, (d - (forestFrom - 500)) / 700));
            for (const side of [-1, 1]) {
                if (hash(k, side, 1) < forestChance) {
                    const size = ['big', 'tall', 'huge'][Math.floor(hash(k, side, 2) * 3)];
                    const sprite = treeSpriteFor({ size, variant: Math.floor(hash(k, side, 3) * 4) });
                    const lat = side * (1.55 + hash(k, side, 4) * 1.6);
                    const x = this.screenX(lat, t);
                    this.lcImgAt(sprite.canvas, x - sprite.ox * t, y - sprite.oy * t, sprite.canvas.width * t);
                } else if (k % 2 === 0) {
                    const img = art.buildings[Math.floor(hash(k, side, 5) * art.buildings.length)];
                    const wU = img.width * t;
                    const edge = this.screenX(side * (1.78 + hash(k, side, 6) * 0.25), t);
                    this.lcImgAt(img, side < 0 ? edge - wU : edge, y - img.height * t, wU);
                } else {
                    this.drawLamp(this.screenX(side * 1.4, t), y, t, side);
                }
            }
        }
    }

    drawLamp(x, y, t, side) {
        const ctx = this.lc;
        const h = 190 * t;
        ctx.fillStyle = '#15121f';
        ctx.fillRect(Math.round(x - 4 * t), Math.round(y - h), 8 * t, h);
        const arm = 40 * t * -side;
        ctx.fillRect(Math.min(x, x + arm), Math.round(y - h), Math.abs(arm) + 8 * t, 8 * t);
        ctx.fillStyle = '#f6e6a0';
        ctx.fillRect(Math.round(x + arm - (side < 0 ? 0 : 12 * t)), Math.round(y - h + 8 * t), 16 * t, 8 * t);
        // Işık hâlesi
        ctx.globalAlpha = 0.16;
        ctx.fillRect(Math.round(x + arm - 24 * t), Math.round(y - h + 8 * t), 56 * t, 24 * t);
        ctx.globalAlpha = 1;
    }

    // Yolun sonunda ufuktaki orman duvarı (ortada yol açıklığı)
    drawHorizonForest() {
        const a = this.forestAmount();
        if (a <= 0) return;
        const ctx = this.lc;
        ctx.save();
        ctx.globalAlpha = Math.min(1, a * 1.6);
        const cx = W / 2 + this.curveAt(0.02);
        for (let i = -2; i < 26; i++) {
            const x = i * 44 + (hash(i, 1, 9) - 0.5) * 24;
            if (Math.abs(x - cx) < 40) continue;
            const sprite = treeSpriteFor({ size: i % 3 === 0 ? 'huge' : 'tall', variant: i + 4 });
            this.lcImgAt(sprite.canvas, x - sprite.ox * 0.34, HORIZON + 6 - sprite.oy * 0.34, sprite.canvas.width * 0.34);
        }
        ctx.restore();
    }

    // Ufka yakın her şey sisle sönükleşir
    drawFog() {
        const ctx = this.lc;
        for (let i = 0; i < 16; i++) {
            ctx.globalAlpha = 0.5 * (1 - i / 16);
            ctx.fillStyle = '#6a3a4a';
            ctx.fillRect(0, HORIZON - 8 + i * 4, W, 4);
        }
        ctx.globalAlpha = 1;
    }

    // Engeller, araba ve inen kişiler derinliğe göre sıralı basılır
    drawThings() {
        const ctx = this.lc;
        const list = [];
        for (const o of this.course.obstacles) {
            const z = o.d - this.progress;
            if (z < -80 || z > 1700) continue;
            list.push({ z, draw: () => this.drawObstacle(o, z) });
        }
        list.push({ z: 0, draw: () => this.drawCar() });
        list.sort((a, b) => b.z - a.z);
        for (const item of list) item.draw();

        // Egzoz dumanı ve kıvılcım
        for (const s of this.smoke) {
            ctx.globalAlpha = s.life / 40;
            ctx.fillStyle = '#9a9aa0';
            ctx.fillRect(Math.round(s.x), Math.round(s.y), 8, 8);
        }
        ctx.globalAlpha = 1;
        for (const s of this.sparks) {
            ctx.fillStyle = '#ffd860';
            ctx.fillRect(Math.round(s.x), Math.round(s.y), 4, 4);
        }
    }

    // Küçük tuvale bir kişi çizer (1 sprite pikseli = 1 piksel), sonra ölçekleyip basar
    drawSpriteGuy(x, y, who, dir, moving, scaleK, opts = {}) {
        const tctx = this.tctx;
        tctx.clearRect(0, 0, 12, 16);
        drawPerson(tctx, 6, 16, who, dir, moving, this.frame, 1, opts);
        this.lcImg(this.tmp, x, y, 48 * scaleK);
    }

    drawObstacle(o, z) {
        const ctx = this.lc;
        const art = driveArt();
        const t = tOf(Math.max(0, z));
        const y = yOf(t);
        const x = this.screenX(this.obstacleLat(o), t);
        if (o.kind === 'infected') {
            // Yeşil parıltı: birkaç yüzen piksel
            ctx.fillStyle = '#8fff6a';
            for (let i = 0; i < 4; i++) {
                ctx.globalAlpha = 0.35 + 0.4 * hash(i, Math.floor(this.frame / 8), 2);
                ctx.fillRect(Math.round(x + (hash(i, 5, 1) - 0.5) * 70 * t), Math.round(y - (20 + hash(i, Math.floor(this.frame / 8), 3) * 50) * t), 4, 4);
            }
            ctx.globalAlpha = 1;
            this.drawSpriteGuy(x, y, 'saglikli1', 'down', true, t * 1.15, { sickBlend: 1 });
            return;
        }
        if (o.kind === 'car') {
            const img = art.wrecks[o.variant % art.wrecks.length];
            this.lcImg(img, x, y + 14 * t, img.width * t);
            return;
        }
        const img = art.rubble[o.variant % art.rubble.length];
        this.lcImg(img, x, y + 8 * t, img.width * t);
    }

    drawCar() {
        if (this.hurt > 0 && Math.floor(this.frame / 4) % 2 === 0) return;
        const art = driveArt();
        const braking = this.speed < 2;
        const img = braking ? art.playerCar.brake : art.playerCar.normal;
        const x = this.carX() + Math.round(this.steer * 8);
        this.lcImg(img, x, CAR_Y + 16, img.width);
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

        const skipText = this.gamepad?.connected ? DRIVE_TEXT.skipPad : DRIVE_TEXT.skipKeys;
        const sw = measurePixelText(skipText, 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(12, H - 44, sw + 24, 32);
        drawPixelText(ctx, skipText, 24, H - 36, { scale: 2, color: '#cbd5e1' });

        if (this.frame < this.hintUntil && this.intro === 0 && !this.caption) {
            const text = this.gamepad?.connected ? DRIVE_TEXT.hintPad : DRIVE_TEXT.hintKeys;
            const w = measurePixelText(text, 2);
            const x = Math.round((W - w) / 2 / 4) * 4;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
            ctx.fillRect(x - 12, H - 88, w + 24, 32);
            drawPixelText(ctx, text, x, H - 80, { scale: 2, color: '#e2e8f0' });
        }
    }
}
