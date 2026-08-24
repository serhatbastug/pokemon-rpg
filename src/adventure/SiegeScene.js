// Prolog 3. bölüm: ÇALIŞMA ALANI KUŞATILIYOR.
//
// Sahnenin akışı bir betiktir (cutscene.js). Kabaca:
//   siren -> tel örgü yarılır -> arkadaş acil durum koluna koşar ->
//   oyuncu peşinden gider, TAM YETİŞECEKKEN kule direği aralarına devrilir ->
//   arkadaş kolu çeker, çelik kapı iner, jeneratör patlar ->
//   arkadaş direğin ardında yeşillenir -> dönüşür (ekran yakınlaşır,
//   yaratık sığmaz) -> tek çıkış rögardır.
//
// Kurtaramama kuralı yerleşimle güvence altında: direk düşünce kola giden
// yol kapanıyor (tests/data.test.mjs bunu doğruluyor), oyuncuya görünmez
// duvar konmuyor.
//
// Kamera kaymaz; yalnızca dönüşümde 3 kat yakınlaşır. Yakınlaşma TAM SAYI
// ölçek ve KESME geçiş: ara ölçekler pikselleri titretiyor, kesme hem daha
// temiz hem daha sert.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { drawTrainer } from '../world/trainerSprite.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { newCanvas } from '../pixel/pixelDraw.js';
import { drawLocationTitle } from '../pixel/screenText.js';
import { Cutscene, shakeOffset, flash } from './cutscene.js';
import { drawFriend, drawCreature } from './people.js';
import {
    WORLD, VIEW, START, FRIEND_START, PLAYER_SPEED, PLAYER_SCALE, LOCATION_NAME,
    BEAM, LEVER_STAND, MANHOLE, blocked, onManhole
} from './siegeLayout.js';
import {
    bakeGround, drawSteelDoor, drawFallenBeam, drawCrowd,
    drawExplosion, drawLeverArm, drawPylonMast
} from './siegeArt.js';

const INTRO_FRAMES = 46;
const TITLE_FRAMES = 210;
const TITLE_FADE = 34;
const FRIEND_SPEED = 4.6;
const ZOOM = 4;   // yaratik ekranin neredeyse tamamini kaplasin

// Oyuncu bu çizgiyi geçince direk önüne devrilir. Direğin sağ yüzü 290'da,
// yani mast tam burnunun dibine iniyor.
const BEAM_GATE = BEAM.x + BEAM.w + 70;

export class SiegeScene {
    constructor({ canvas, input, gamepad, onExit, onFinish }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});
        this.onFinish = onFinish || (() => {});   // rögardan aşağı: sonraki bölüm

        this.running = false;
        this.frame = 0;

        this.player = { x: START.x, y: START.y, dir: 'down', moving: false };
        this.friend = { x: FRIEND_START.x, y: FRIEND_START.y, dir: 'down', moving: false };

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio();
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();
        });

        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') this.onExit();
        });
    }

    bake() {
        if (this.ground) return;
        this.ground = bakeGround();
        // Dünya önce bu tampona çizilir, sonra ekrana (yakınlaşma için)
        const buffer = newCanvas(WORLD.w, WORLD.h);
        this.buffer = buffer.canvas;
        this.bufferCtx = buffer.ctx;
    }

    // --- Sahne betiği ---
    buildScript() {
        const s = this.state;
        return new Cutscene([
            {
                name: 'giris', frames: INTRO_FRAMES,
                onEnter: () => { s.titleFrames = TITLE_FRAMES; }
            },
            {
                // Siren çalar, kalabalık örgüye yüklenir. Oyuncu serbest.
                name: 'baski', frames: 190, lock: false,
                onEnter: () => Sfx.siren(),
                onStep: (st, t) => { st.pressure = t * 0.75; }
            },
            {
                // Örgü yarılır: baskı tavana vurur
                name: 'yarik', frames: 90, lock: false,
                onEnter: () => { Sfx.metalSlam(); s.shake = 4; },
                onStep: (st, t) => { st.pressure = 0.75 + t * 0.25; st.shake = 4 * (1 - t); }
            },
            {
                // Arkadaş kola koşar. Oyuncu peşinden gidebilir.
                name: 'kosu', frames: 260, lock: false,
                until: () => s.friendAtLever,
                onStep: () => this.moveFriendToLever()
            },
            {
                // Ayrılık anı: oyuncu yaklaşınca direk düşer. Yaklaşmazsa
                // süre üst sınırı devreye girer, sahne takılmaz.
                name: 'ayrilik', frames: 300, lock: false,
                until: () => s.beamDown
            },
            {
                name: 'devrilme', frames: 54,
                onEnter: () => { this.dropBeam(); },
                onStep: (st, t) => { st.beamFall = Math.min(1, t * 1.6); st.shake = 7 * (1 - t); }
            },
            {
                // Arkadaş kolu çeker; çelik kapı iner
                name: 'kolu-cek', frames: 80, lock: false,
                onEnter: () => { s.friend.dir = 'left'; },
                onStep: (st, t) => {
                    st.leverPulled = Math.min(1, t * 2);
                    st.doorClosed = Math.max(0, (t - 0.35) / 0.65);
                },
                onExit: () => Sfx.metalSlam()
            },
            {
                name: 'patlama', frames: 120, lock: false,
                onEnter: () => { Sfx.explosion(); s.doorClosed = 1; },
                onStep: (st, t) => {
                    st.explosion = t;
                    st.flash = flash(t * 2);
                    st.shake = 10 * Math.max(0, 1 - t * 1.6);
                }
            },
            {
                // Yeşillenme: oyuncu direğin ardından izliyor. Uzaktan.
                name: 'yesillenme', frames: 260, lock: false,
                onEnter: () => { s.friend.pose = 'hunch'; },
                onStep: (st, t) => { st.greenness = t; }
            },
            {
                // Dönüşüm: parlama, ardından KESME ile 3 kat yakınlaşma.
                // Yaratık ekrana sığmıyor; kalkan kolunda turuncu bant var.
                name: 'donusum', frames: 150,
                onEnter: () => { s.greenness = 1; Sfx.bossWake(); },
                onStep: (st, t) => {
                    st.flash = t < 0.1 ? 1 : Math.max(0, 0.5 - t);
                    if (t >= 0.1) st.zoom = ZOOM;
                    st.creature = t >= 0.1;
                    st.shake = t < 0.5 ? 6 : 0;
                }
            },
            {
                // Geri çekilme: yine kesme
                name: 'geri', frames: 70,
                onEnter: () => { s.zoom = 1; }
            },
            {
                // Tek çıkış rögar. Oyuncu üstüne basınca sahne biter.
                name: 'kacis', frames: 0, lock: false,
                until: () => onManhole(s.player.x, s.player.y)
            },
            {
                name: 'cikis', frames: 46,
                onStep: (st, t) => { st.fadeOut = t; },
                onExit: () => this.onFinish()
            }
        ], s).start();
    }

    start() {
        this.bake();
        this.player = { x: START.x, y: START.y, dir: 'down', moving: false };
        this.friend = { x: FRIEND_START.x, y: FRIEND_START.y, dir: 'down', moving: false, pose: null };
        this.frame = 0;

        this.state = {
            player: this.player,
            friend: this.friend,
            pressure: 0,
            shake: 0,
            flash: 0,
            fadeOut: 0,
            zoom: 1,
            beamDown: false,
            beamFall: 0,
            friendAtLever: false,
            leverPulled: 0,
            doorClosed: 0,
            explosion: 0,
            greenness: 0,
            creature: false,
            titleFrames: 0
        };

        this.script = this.buildScript();
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

    step() {
        this.frame++;
        const s = this.state;
        if (s.titleFrames > 0) s.titleFrames--;

        this.gamepad?.poll();
        if (!this.script.locked) this.movePlayer();
        this.checkBeamGate();
        this.script.step();

        // Siren betik boyunca aralıklı çalar
        if (this.frame % 150 === 0 && !s.beamDown) Sfx.siren();
    }

    // Direk, oyuncu arkadaşa doğru koşup çizgiyi geçtiği anda devrilir.
    // Arkadaş direğin bölgesini geçmeden tetiklenmez: yoksa arkadaş yanlış
    // tarafta kalıyor ve sahne anlamını kaybediyor.
    checkBeamGate() {
        const s = this.state;
        if (s.beamDown || this.friend.x > BEAM.x) return;
        if (this.player.x < BEAM_GATE) this.dropBeam();
    }

    dropBeam() {
        const s = this.state;
        if (s.beamDown) return;
        s.beamDown = true;
        s.shake = 7;
        Sfx.beamFall();
    }

    moveFriendToLever() {
        const s = this.state;
        const dx = LEVER_STAND.x - this.friend.x;
        const dy = LEVER_STAND.y - this.friend.y;
        const dist = Math.hypot(dx, dy);
        if (dist < FRIEND_SPEED) {
            this.friend.x = LEVER_STAND.x;
            this.friend.y = LEVER_STAND.y;
            this.friend.moving = false;
            s.friendAtLever = true;
            return;
        }
        this.friend.x += (dx / dist) * FRIEND_SPEED;
        this.friend.y += (dy / dist) * FRIEND_SPEED;
        this.friend.moving = true;
        this.friend.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    }

    movePlayer() {
        const { input, player } = this;
        let dx = 0;
        let dy = 0;
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
        const beamDown = this.state.beamDown;

        if (!blocked(player.x + vx, player.y, beamDown)) player.x += vx;
        if (!blocked(player.x, player.y + vy, beamDown)) player.y += vy;

        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
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
        const s = this.state;
        this.drawWorld();

        const { ctx, canvas } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Tamponu ekrana aktar: yakınlaşma ve sarsıntı burada uygulanır
        const zoom = s.zoom;
        const vw = Math.round(VIEW.w / zoom);
        const vh = Math.round(VIEW.h / zoom);
        // Yakın planda odak yaratığın GÖVDE ORTASI: ayaklarına odaklanınca
        // baş kadrajın dışında kalıyor ve gözler hiç görünmüyor.
        const focus = zoom > 1
            ? { x: this.friend.x, y: this.friend.y - 50 }
            : { x: WORLD.w / 2, y: WORLD.h / 2 };
        const shake = shakeOffset(this.frame, s.shake);
        const sx = clamp(Math.round(focus.x - vw / 2) + shake.x, 0, WORLD.w - vw);
        const sy = clamp(Math.round(focus.y - vh / 2) + shake.y, 0, WORLD.h - vh);
        ctx.drawImage(this.buffer, sx, sy, vw, vh, 0, 0, VIEW.w, VIEW.h);

        // Ekrana sabit katmanlar
        drawLocationTitle(ctx, LOCATION_NAME, this.titleAlpha, VIEW.w);

        if (s.flash > 0) {
            ctx.fillStyle = `rgba(255, 246, 214, ${Math.min(1, s.flash)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const dark = this.script.name === 'giris'
            ? 1 - this.script.progress
            : s.fadeOut;
        if (dark > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${Math.min(1, dark)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Dünyayı tampona çizer (kamera/yakınlaşma uygulanmadan, 1:1)
    drawWorld() {
        const ctx = this.bufferCtx;
        const s = this.state;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.ground, 0, 0);

        drawCrowd(ctx, this.frame, s.pressure);
        drawSteelDoor(ctx, s.doorClosed);
        // Anten direği ayaktayken cephenin önünde yükselir; devrilince
        // yerini avluya düşen gövdesine (drawFallenBeam) bırakır.
        drawPylonMast(ctx, !s.beamDown);
        drawLeverArm(ctx, s.leverPulled);

        // Arkadaş ve oyuncu dip hizasına göre sıralanır
        const actors = [
            { y: this.friend.y, draw: () => this.drawFriendActor(ctx) },
            { y: this.player.y, draw: () => this.drawPlayerActor(ctx) }
        ].sort((a, b) => a.y - b.y);
        for (const actor of actors) actor.draw();

        // Devrilen direk aktörlerden SONRA: yere düşerken önlerinden geçiyor
        drawFallenBeam(ctx, s.beamFall);
        drawExplosion(ctx, s.explosion);
    }

    drawFriendActor(ctx) {
        const s = this.state;
        if (s.creature) {
            drawCreature(ctx, this.friend.x, this.friend.y + 8);
            return;
        }
        const pose = this.friend.pose || this.friend.dir;
        drawFriend(ctx, Math.round(this.friend.x), Math.round(this.friend.y - 26),
            pose, this.friend.moving, PLAYER_SCALE, s.greenness);
    }

    drawPlayerActor(ctx) {
        const { player } = this;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#101418';
        ctx.fillRect(Math.round(player.x - 14), Math.round(player.y + 2), 28, 8);
        ctx.globalAlpha = 1;
        drawTrainer(ctx, Math.round(player.x), Math.round(player.y - 26),
            player.dir, player.moving, PLAYER_SCALE);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
