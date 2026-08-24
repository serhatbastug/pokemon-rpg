// Prolog 3. bölüm: ÇALIŞMA ALANI KUŞATILIYOR.
//
// Avlu içerisidir. Beş sağlıklıyla burada çalışıyoruz. Virüslüler bizi bulur;
// sağlıklıları üstteki acil çıkıştan geçiririz. Sorumlu olduğumuz için en son
// biz ve arkadaşımız kalırız. Biz geçeriz - arkadaşımız kapının yanındaki kolu
// çekmek için geri hamle yapar. Tam o sırada virüslüler içeri girer, sistem
// bunu algılayıp acil çıkışı kapatır, ekran yavaşça kararır.
//
// OYUNCU HİÇBİR ŞEYİ GÖRMEZ: ne ısırılmayı, ne dönüşümü, ne kolun çekilip
// çekilmediğini. Kapı kapanır, kararmanın içinde arkadaşımızın kola doğru
// gittiğini görürüz, o kadar. Belirsizlik bilerek bırakılıyor - oyuncu
// dönüştüğünü bilmiyor, belki de dönüşmedi.
//
// Sağlıklıların tahliyesi BETİKTE: oyuncu onları tek tek toplamıyor, işi
// kapıyı tutmak ve en son geçmek. Ateş edebiliyor (Space / KARE) ama
// parçalayıcı silah virüsü öldürmüyor, etrafa dağıtıyor: vurulanın yerinde
// kalıcı yeşil bir leke kalıyor. Kaybedilecek bir şey yok; yapılanın işe
// yaramadığı gözle görülüyor.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { drawTrainer } from '../world/trainerSprite.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { newCanvas, PX } from '../pixel/pixelDraw.js';
import { drawLocationTitle } from '../pixel/screenText.js';
import { Cutscene, shakeOffset } from './cutscene.js';
import { drawFriend, drawSurvivor } from './people.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { SIEGE_SPOTTED, SIEGE_PLAN, SIEGE_AGREE, SIEGE_CALL } from './prologLines.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import {
    WORLD, VIEW, PLAYER_SPEED, PLAYER_SCALE, LOCATION_NAME,
    STEEL_DOOR, DOOR_STAND, LEVER_STAND, FRIEND_RETURN_PATH, QUEUE_POINT, YARD,
    SURVIVOR_STARTS, SURVIVOR_PATHS, BREACH, FENCE,
    BULLET_SPEED, BULLET_LIFE, FIRE_COOLDOWN, INFECTED_SPEED, INFECTED_RADIUS,
    blocked, atDoor
} from './siegeLayout.js';
import {
    bakeGround, drawSteelDoor, drawCrowd, drawLeverArm, drawIntruder
} from './siegeArt.js';
import { drawBullet, drawSplat, drawBurst } from '../pixel/weaponFx.js';

const INTRO_FRAMES = 46;
const TITLE_FRAMES = 210;
const TITLE_FADE = 34;
const WALK_SPEED = 2.4;          // sağlıklıların yürüyüşü
const FRIEND_SPEED = 4.4;        // arkadaş koşuyor
const FADE_FRAMES = 200;         // kararma yavaş: oyuncu ne olduğunu görmesin

// Oyuncunun başlangıcı: avlunun ortası, herkesle birlikte
const START = { x: 500, y: 330 };
const FRIEND_START = { x: 566, y: 322 };

export class SiegeScene {
    constructor({ canvas, input, gamepad, onExit, onFinish }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});
        this.onFinish = onFinish || (() => {});

        this.running = false;
        this.frame = 0;

        // Dublaj yok: balon harf harf yazilir, her harfte kisa bir "bit" cikar
        this.dialogue = new Dialogue({
            onBeep: (who) => Sfx.talk(VOICE_PITCH[who] || 1)
        });

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio();
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();
            if (e.code === 'Space') this.fire();
            if (e.code === 'KeyF') this.dialogue.advance();
        });

        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') this.onExit();
            if (button === 'square') this.fire();      // KARE: ateş
            if (button === 'cross') this.dialogue.advance();
        });
    }

    bake() {
        if (this.ground) return;
        this.ground = bakeGround();
        const buffer = newCanvas(WORLD.w, WORLD.h);
        this.buffer = buffer.canvas;
        this.bufferCtx = buffer.ctx;
    }

    // --- Sahne betiği ---
    buildScript() {
        const s = this.state;
        const doorway = { x: DOOR_STAND.x, y: STEEL_DOOR.y + STEEL_DOOR.h - 8 };

        return new Cutscene([
            {
                name: 'giris', frames: INTRO_FRAMES,
                onEnter: () => { s.titleFrames = TITLE_FRAMES; }
            },
            {
                // Buldular. Siren çalar, kalabalık örgüye yüklenir.
                name: 'alarm', frames: 160, lock: false,
                onEnter: () => Sfx.siren(),
                onStep: (st, t) => { st.pressure = t * 0.8; }
            },
            {
                // Arkadaşımız tel örgüyü gösteriyor
                name: 'fark-ettik', frames: 900,
                onEnter: () => {
                    this.dialogue.start(SIEGE_SPOTTED);
                    this.friend.dir = 'down';
                },
                until: () => !this.dialogue.active,
                onStep: (st) => { st.pressure = 0.85; }
            },
            {
                // Planı biz söylüyoruz
                name: 'plan', frames: 1600,
                onEnter: () => this.dialogue.start(SIEGE_PLAN),
                until: () => !this.dialogue.active
            },
            {
                // Sağlıklılardan biri onaylıyor
                name: 'onay', frames: 1600,
                onEnter: () => this.dialogue.start(SIEGE_AGREE),
                until: () => !this.dialogue.active
            },
            {
                // Örgü yarılıyor
                name: 'yarik', frames: 70, lock: false,
                onEnter: () => { Sfx.metalSlam(); s.shake = 5; },
                onStep: (st, t) => { st.pressure = 0.8 + t * 0.2; st.shake = 5 * (1 - t); }
            },
            {
                // Tahliye: beş sağlıklı sırayla kapıdan geçiyor. Oyuncu
                // serbest ve ateş edebiliyor; tek tük virüslü içeri sızıyor.
                name: 'tahliye', frames: 2000, lock: false,
                onEnter: () => { s.evacuating = true; },
                until: () => s.escaped >= this.survivors.length,
                onStep: () => this.updateEvacuation(doorway)
            },
            {
                // Sıra bizde: "sorumlu olarak en son biz geçeceğiz".
                // Arkadaş kapının yanında bekliyor, oyuncu kapıya gelmeli.
                name: 'sira-bizde', frames: 1600, lock: false,
                until: () => atDoor(this.player.x, this.player.y),
                onStep: () => this.moveActorTo(this.friend, { x: DOOR_STAND.x + 50, y: DOOR_STAND.y }, WALK_SPEED)
            },
            {
                // Biz geçiyoruz: kapı boşluğunda durup geri dönüp bakıyoruz
                name: 'biz-geciyoruz', frames: 80,
                onEnter: () => this.dialogue.start(SIEGE_CALL),
                onStep: () => {
                    this.moveActorTo(this.player, doorway, 2.2, true);
                    this.player.dir = 'down';
                }
            },
            {
                // Arkadaşımız geri hamle yapıyor: kola doğru
                name: 'geri-hamle', frames: 30,
                onEnter: () => { s.friendReturning = true; },
                onStep: () => this.moveFriendBack()
            },
            {
                // Virüslüler içeri doluyor
                name: 'iceri-giriyorlar', frames: 30,
                onEnter: () => { s.flood = true; Sfx.metalSlam(); },
                onStep: () => this.moveFriendBack()
            },
            {
                // Sistem algılıyor: acil çıkış iniyor. KARARMA BURADA BAŞLIYOR -
                // arkadaşımız hâlâ yolda, oyuncu onu kola doğru giderken görüyor.
                name: 'kapi-kapaniyor', frames: 100,
                onEnter: () => {
                    s.alarmLight = true;
                    Sfx.beamFall();
                    this.dialogue.cut();       // cümle kapıyla birlikte kesilir
                },
                onStep: (st, t) => {
                    st.doorClosed = Math.min(1, t * 1.3);
                    st.shake = 6 * (1 - t);
                    st.fadeOut = t * 0.35;
                    this.moveFriendBack(0.7);
                },
                onExit: () => { s.doorClosed = 1; Sfx.metalSlam(); }
            },
            {
                // Kararma tamamlanıyor. Kolun çekilip çekilmediğini GÖRMÜYORUZ.
                name: 'kararma', frames: FADE_FRAMES,
                onStep: (st, t) => {
                    st.fadeOut = 0.35 + 0.65 * t * t;    // önce yavaş, sonra hızlı
                    this.moveFriendBack(0.7);
                },
                onExit: () => this.onFinish()
            }
        ], s).start();
    }

    start() {
        this.bake();
        this.frame = 0;
        this.player = { x: START.x, y: START.y, dir: 'down', moving: false };
        this.friend = { x: FRIEND_START.x, y: FRIEND_START.y, dir: 'down', moving: false, leg: 0 };
        this.survivors = SURVIVOR_STARTS.map((start, i) => ({
            x: start.x, y: start.y, dir: 'down', moving: false, index: i,
            leg: 0,                    // tahliye yolunda kacinci ara nokta
            state: 'bekliyor'          // bekliyor -> sirada -> geciyor -> gecti
        }));
        this.bullets = [];
        this.splats = [];
        this.bursts = [];
        this.intruders = [];
        this.cooldown = 0;
        this.dialogue.cut();

        this.state = {
            player: this.player,
            pressure: 0,
            shake: 0,
            fadeOut: 0,
            titleFrames: 0,
            doorClosed: 0,
            leverPulled: 0,
            escaped: 0,
            evacuating: false,
            friendReturning: false,
            flood: false,
            alarmLight: false
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
        if (this.cooldown > 0) this.cooldown--;

        this.gamepad?.poll();
        this.dialogue.step();
        if (!this.script.locked) this.movePlayer();
        this.updateBullets();
        this.updateIntruders();
        this.updateBursts();
        this.script.step();

        if (this.frame % 170 === 0 && !s.flood) Sfx.siren();
    }

    // --- Tahliye ---
    // Sağlıklılar tek tek sıraya gelip kapıdan geçiyor. Sıradaki yoksa
    // bekleyenlerden kapıya en yakını çağrılıyor.
    updateEvacuation(doorway) {
        const queued = this.survivors.find(p => p.state === 'sirada' || p.state === 'geciyor');
        if (!queued) {
            const waiting = this.survivors.filter(p => p.state === 'bekliyor');
            if (waiting.length) {
                waiting.sort((a, b) =>
                    Math.hypot(a.x - QUEUE_POINT.x, a.y - QUEUE_POINT.y) -
                    Math.hypot(b.x - QUEUE_POINT.x, b.y - QUEUE_POINT.y));
                waiting[0].state = 'sirada';
            }
        }

        for (const person of this.survivors) {
            if (person.state === 'sirada') {
                // Yolu elle yazılmış ara noktalardan geçiyor: yol bulma yok,
                // düz gidince jeneratörle direğin arasında sıkışıyorlardı.
                const path = SURVIVOR_PATHS[person.index];
                const target = path[person.leg] || QUEUE_POINT;
                if (this.moveActorTo(person, target, WALK_SPEED)) {
                    if (person.leg < path.length - 1) person.leg++;
                    else person.state = 'geciyor';
                }
            } else if (person.state === 'geciyor') {
                person.dir = 'up';
                if (this.moveActorTo(person, doorway, WALK_SPEED, true)) {
                    person.state = 'gecti';
                    this.state.escaped++;
                }
            }
        }
    }

    // Arkadaşımızın geri hamlesi: avluya inip dolanarak kola çıkıyor.
    // Vardığında kola uzanıp öyle kalıyor - çekip çekmediğini görmüyoruz.
    moveFriendBack(speedScale = 1) {
        const path = FRIEND_RETURN_PATH;
        const leg = this.friend.leg || 0;
        if (leg >= path.length) {
            this.friend.dir = 'up';          // kola uzanmış, sırtı bize dönük
            this.friend.moving = false;
            return;
        }
        if (this.moveActorTo(this.friend, path[leg], FRIEND_SPEED * speedScale)) {
            this.friend.leg = leg + 1;
        }
    }

    // Bir aktörü hedefe doğru yürütür; vardıysa true döner.
    // ignoreWalls: kapı boşluğu avlunun dışında kaldığı için gerekiyor.
    moveActorTo(actor, target, speed, ignoreWalls = false) {
        const dx = target.x - actor.x;
        const dy = target.y - actor.y;
        const dist = Math.hypot(dx, dy);
        if (dist < speed) {
            actor.x = target.x;
            actor.y = target.y;
            actor.moving = false;
            return true;
        }
        const nx = actor.x + (dx / dist) * speed;
        const ny = actor.y + (dy / dist) * speed;
        if (ignoreWalls || !blocked(nx, actor.y)) actor.x = nx;
        if (ignoreWalls || !blocked(actor.x, ny)) actor.y = ny;
        actor.moving = true;
        actor.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        return false;
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
        if (!blocked(player.x + vx, player.y)) player.x += vx;
        if (!blocked(player.x, player.y + vy)) player.y += vy;

        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
    }

    // --- Silah ---
    fire() {
        if (!this.running || this.script.locked || this.cooldown > 0) return;
        this.cooldown = FIRE_COOLDOWN;

        const dir = this.player.dir;
        const vx = dir === 'left' ? -BULLET_SPEED : dir === 'right' ? BULLET_SPEED : 0;
        const vy = dir === 'up' ? -BULLET_SPEED : dir === 'down' ? BULLET_SPEED : 0;
        this.bullets.push({
            x: this.player.x + vx * 2,
            y: this.player.y - 16 + vy * 2,
            vx, vy, life: BULLET_LIFE
        });
        Sfx.shoot();
    }

    updateBullets() {
        for (const bullet of this.bullets) {
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.life--;
            if (bullet.y < YARD.top - 20 || bullet.y > FENCE.y || bullet.x < 0 || bullet.x > WORLD.w) {
                bullet.life = 0;
            }
            for (const intruder of this.intruders) {
                if (intruder.dead) continue;
                if (Math.hypot(bullet.x - intruder.x, bullet.y - (intruder.y - 26)) > INFECTED_RADIUS + 8) continue;
                // Virüs ölmez, DAĞILIR: yerinde kalıcı bir leke bırakır
                intruder.dead = true;
                bullet.life = 0;
                this.splats.push({
                    x: Math.round(intruder.x), y: Math.round(intruder.y),
                    radius: 18 + Math.random() * 10, seed: Math.floor(Math.random() * 1000)
                });
                this.bursts.push({ x: intruder.x, y: intruder.y - 24, t: 0 });
                Sfx.playerHurt();
            }
        }
        this.bullets = this.bullets.filter(b => b.life > 0);
        this.intruders = this.intruders.filter(i => !i.dead);
    }

    // Avluya sızan virüslüler. Beyinleri eridiği için yönleri kaba: en yakın
    // insana doğru sürükleniyorlar ve yavaşlar (konaksız hal zayıftır).
    updateIntruders() {
        const s = this.state;
        const period = s.flood ? 10 : (s.evacuating ? 70 : 0);
        const cap = s.flood ? 18 : 4;
        if (period > 0 && this.frame % period === 0 && this.intruders.length < cap) {
            this.intruders.push({
                x: BREACH.x + Math.random() * BREACH.w,
                y: FENCE.y - 2,
                seed: Math.floor(Math.random() * 1000)
            });
        }

        for (const intruder of this.intruders) {
            const target = this.nearestPerson(intruder);
            const dx = target.x - intruder.x;
            const dy = target.y - intruder.y;
            const dist = Math.hypot(dx, dy) || 1;
            let mx = (dx / dist) * INFECTED_SPEED;
            let my = (dy / dist) * INFECTED_SPEED;

            // Birbirlerini itsinler: itme kuvveti olmadan hepsi aynı noktaya
            // yığılıp tek bir yeşil sütuna dönüşüyor ve arkasındaki kimse
            // görünmüyordu.
            for (const other of this.intruders) {
                if (other === intruder) continue;
                const ox = intruder.x - other.x;
                const oy = intruder.y - other.y;
                const gap = Math.hypot(ox, oy);
                if (gap > 34 || gap === 0) continue;
                mx += (ox / gap) * 0.6;
                my += (oy / gap) * 0.6;
            }

            // Duvarlara takılmasınlar diye yalnızca avlu sınırına bakılıyor
            intruder.x = clamp(intruder.x + mx, 20, WORLD.w - 20);
            intruder.y = clamp(intruder.y + my, YARD.top + 10, FENCE.y - 2);
        }
    }

    nearestPerson(from) {
        const people = [this.player, this.friend,
            ...this.survivors.filter(p => p.state !== 'gecti')];
        let best = people[0];
        let bestDist = Infinity;
        for (const person of people) {
            const dist = Math.hypot(person.x - from.x, person.y - from.y);
            if (dist < bestDist) { bestDist = dist; best = person; }
        }
        return best;
    }

    updateBursts() {
        for (const burst of this.bursts) burst.t += 0.06;
        this.bursts = this.bursts.filter(b => b.t < 1);
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

        const shake = shakeOffset(this.frame, s.shake);
        ctx.drawImage(this.buffer, clamp(shake.x, -12, 12), clamp(shake.y, -12, 12));

        drawLocationTitle(ctx, LOCATION_NAME, this.titleAlpha, VIEW.w);

        const dark = this.script.name === 'giris' ? 1 - this.script.progress : s.fadeOut;
        if (dark > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${Math.min(1, dark)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    drawWorld() {
        const ctx = this.bufferCtx;
        const s = this.state;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.ground, 0, 0);

        // Yere dağılan virüs: kalıcı, herkesin altında
        for (const splat of this.splats) drawSplat(ctx, splat);

        drawCrowd(ctx, this.frame, s.pressure);
        drawLeverArm(ctx, s.leverPulled);

        // Kapı kapanırken yanıp sönen kırmızı uyarı ışığı
        if (s.alarmLight && Math.sin(this.frame * 0.25) > 0) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = '#b3241f';
            ctx.fillRect(STEEL_DOOR.x - 24, STEEL_DOOR.y - 12, STEEL_DOOR.w + 48, 16);
            ctx.globalAlpha = 1;
        }

        // Herkes dip hizasına göre sıralanır
        const actors = [];
        for (const person of this.survivors) {
            if (person.state === 'gecti') continue;
            actors.push({
                y: person.y,
                draw: () => drawSurvivor(ctx, Math.round(person.x),
                    Math.round(person.y - 26) + this.bob(`saglikli-${person.index}`),
                    person.dir, person.moving, PLAYER_SCALE, person.index)
            });
        }
        for (const intruder of this.intruders) {
            actors.push({
                y: intruder.y,
                draw: () => drawIntruder(ctx, Math.round(intruder.x), Math.round(intruder.y),
                    this.frame, intruder.seed)
            });
        }
        actors.push({
            y: this.friend.y,
            draw: () => drawFriend(ctx, Math.round(this.friend.x),
                Math.round(this.friend.y - 26) + this.bob('arkadas'),
                this.friend.dir, this.friend.moving, PLAYER_SCALE, 0)
        });
        actors.push({ y: this.player.y, draw: () => this.drawPlayerActor(ctx) });
        actors.sort((a, b) => a.y - b.y);
        for (const actor of actors) actor.draw();

        // Çelik kapı aktörlerin ÜSTÜNDE: inerken ardında kalanı örtmeli
        drawSteelDoor(ctx, s.doorClosed);

        this.drawBubble(ctx);

        for (const bullet of this.bullets) drawBullet(ctx, bullet);
        for (const burst of this.bursts) drawBurst(ctx, burst.x, burst.y, burst.t);
    }

    drawPlayerActor(ctx) {
        const { player } = this;
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = '#101418';
        ctx.fillRect(Math.round(player.x - 14), Math.round(player.y + 2), 28, 8);
        ctx.globalAlpha = 1;
        drawTrainer(ctx, Math.round(player.x), Math.round(player.y - 26) + this.bob('biz'),
            player.dir, player.moving, PLAYER_SCALE);
    }

    // --- Konuşma ---

    // Konuşanın kafası sallanır: dublaj olmadığı için ağız yerine bu
    // hareket "bu kişi konuşuyor" bilgisini taşıyor.
    bob(who) {
        if (this.dialogue.speaker !== who) return 0;
        return Math.floor(this.frame / 7) % 2 === 0 ? -PX : 0;
    }

    // Konuşan kim? Balon onun tepesinde açılıyor.
    speakerActor() {
        const who = this.dialogue.speaker;
        if (!who) return null;
        if (who === 'biz') return this.player;
        if (who === 'arkadas') return this.friend;
        const match = /^saglikli-(\d+)$/.exec(who);
        if (!match) return null;
        const person = this.survivors[Number(match[1])];
        return person && person.state !== 'gecti' ? person : null;
    }

    drawBubble(ctx) {
        if (!this.dialogue.active) return;
        const actor = this.speakerActor();
        if (!actor) return;
        const text = this.dialogue.visibleText;
        if (!text) return;

        const lines = wrapPixelText(text, 440, 2);
        drawSpeechBubble(ctx, Math.round(actor.x), Math.round(actor.y) - 58, lines, {
            scale: 2, viewLeft: 0, viewW: VIEW.w
        });
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
