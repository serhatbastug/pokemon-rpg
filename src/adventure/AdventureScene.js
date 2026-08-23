// Macera modunun ilk sahnesi: şehrin kenarından ormanın girişine.
//
// Solda bildiğimiz şehir (asfalt yol, kaldırım, binalar), sağda ağaç duvarı ve
// duvarda antrenörün sığabileceği bir boşluk. Boşluktan geçilene kadar kamera
// sabit durur; geçilince ekran antrenörle birlikte sağa kayar ve dar orman
// koridoruna girilir. Ormana girişte mekan adı belirir.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { drawTrainer } from '../world/trainerSprite.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { treeSpriteFor } from '../pixel/trees.js';
import {
    WORLD, VIEW, PX, START, PLAYER_SPEED, PLAYER_SCALE, LOCATION_NAME,
    GAP, TREES, CITY, blocked, inForest
} from './adventureLayout.js';
import { bakeGround, lampSprite, drawLocationTitle } from './adventureArt.js';

const INTRO_FRAMES = 40;    // karanlıktan açılma (menüden kararmış geliyoruz)
const TITLE_FRAMES = 230;   // mekan adının ekranda kalma süresi
const TITLE_FADE = 34;

export class AdventureScene {
    constructor({ canvas, input, gamepad, onExit }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});

        this.running = false;
        this.frame = 0;
        this.intro = 0;
        this.camera = { x: 0 };
        this.cameraFollowing = false;   // boşluktan geçilince açılır
        this.titleFrames = 0;
        this.titleShown = false;
        this.enteredForest = false;

        this.player = { x: START.x, y: START.y, dir: 'right', moving: false };

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

    // Zemin ve nesneler bir kez hazırlanır; sonra yalnızca kopyalanır.
    bake() {
        if (this.ground) return;
        this.ground = bakeGround();

        const props = [];
        for (const tree of TREES) {
            const sprite = treeSpriteFor(tree);
            props.push({
                canvas: sprite.canvas,
                x: tree.x - sprite.ox,
                y: tree.y - sprite.oy,
                baseY: tree.y
            });
        }
        // Sokak lambaları: üst kaldırımın kenarında durur
        const lamp = lampSprite();
        for (const lampX of CITY.lamps) {
            props.push({
                canvas: lamp.canvas,
                x: lampX - lamp.ox,
                y: CITY.topWalk.y + CITY.topWalk.h - 4 - lamp.oy,
                baseY: CITY.topWalk.y + CITY.topWalk.h - 4
            });
        }

        props.sort((a, b) => a.baseY - b.baseY);
        this.props = props;
    }

    start() {
        this.bake();
        this.player.x = START.x;
        this.player.y = START.y;
        this.player.dir = 'right';
        this.player.moving = false;
        this.camera.x = 0;
        this.cameraFollowing = false;
        this.titleFrames = 0;
        this.titleShown = false;
        this.enteredForest = false;
        this.intro = INTRO_FRAMES;
        this.frame = 0;
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        playMusic('town');

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
        if (this.intro > 0) this.intro--;
        if (this.titleFrames > 0) this.titleFrames--;

        this.gamepad?.poll();
        this.movePlayer();
        this.checkForestEntry();
        this.updateCamera();
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

        // Eksenler ayrı denenir: duvara sürtünerek yürünebilsin
        if (!blocked(player.x + vx, player.y)) player.x += vx;
        if (!blocked(player.x, player.y + vy)) player.y += vy;

        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
    }

    // Boşluktan geçince kamera serbest kalır; koridora girince mekan adı belirir
    checkForestEntry() {
        if (!this.cameraFollowing && this.player.x > GAP.x0) {
            this.cameraFollowing = true;
        }
        if (!this.enteredForest && inForest(this.player.x)) {
            this.enteredForest = true;
            this.titleFrames = TITLE_FRAMES;
            this.titleShown = true;
            playMusic('forest');
            Sfx.badge();
        }
    }

    updateCamera() {
        const target = this.cameraFollowing
            ? Math.max(0, Math.min(WORLD.w - VIEW.w, this.player.x - VIEW.w / 2))
            : 0;
        // Yumuşak takip: boşluktan geçince ekran zıplamadan sağa kaysın
        this.camera.x += (target - this.camera.x) * 0.09;
        if (Math.abs(target - this.camera.x) < 0.4) this.camera.x = target;
    }

    // Mekan adının o karedeki saydamlığı (belirir - durur - kaybolur)
    get titleAlpha() {
        if (this.titleFrames <= 0) return 0;
        const elapsed = TITLE_FRAMES - this.titleFrames;
        if (elapsed < TITLE_FADE) return elapsed / TITLE_FADE;
        if (this.titleFrames < TITLE_FADE) return this.titleFrames / TITLE_FADE;
        return 1;
    }

    draw() {
        const { ctx, canvas, player } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const camX = Math.round(this.camera.x);
        ctx.save();
        ctx.translate(-camX, 0);

        // Zeminin yalnızca görünen dilimi kopyalanır
        const sw = Math.min(WORLD.w - camX, VIEW.w);
        ctx.drawImage(this.ground, camX, 0, sw, WORLD.h, camX, 0, sw, WORLD.h);

        // Ağaçlar ve lambalar antrenörle birlikte dip hizasına göre sıralanır
        const feet = player.y;
        const left = camX - 220;
        const right = camX + VIEW.w + 220;
        let i = 0;
        for (; i < this.props.length && this.props[i].baseY <= feet; i++) {
            this.drawProp(this.props[i], left, right);
        }
        this.drawPlayer();
        for (; i < this.props.length; i++) {
            this.drawProp(this.props[i], left, right);
        }

        ctx.restore();

        // Ekrana sabit katman: mekan adı ve karanlıktan açılma perdesi
        drawLocationTitle(ctx, LOCATION_NAME, this.titleAlpha, VIEW.w);

        if (this.intro > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${this.intro / INTRO_FRAMES})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    drawProp(prop, left, right) {
        if (prop.x + prop.canvas.width < left || prop.x > right) return;
        this.ctx.drawImage(prop.canvas, Math.round(prop.x), Math.round(prop.y));
    }

    drawPlayer() {
        const { ctx, player } = this;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#052e16';
        ctx.fillRect(Math.round((player.x - 14) / PX) * PX, Math.round((player.y + 2) / PX) * PX, PX * 7, PX * 2);
        ctx.globalAlpha = 1;

        drawTrainer(ctx, Math.round(player.x), Math.round(player.y - 26), player.dir, player.moving, PLAYER_SCALE);
    }
}
