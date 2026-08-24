// Macera modunun ilk sahnesi: harabe şehrin kenarından ormanın girişine.
//
// Solda salgının geçtiği ölü şehir (terk edilmiş araçlar, çöken cepheler,
// açık bir rögar), sağda ağaç duvarı ve duvarda antrenörün sığabileceği bir
// boşluk. Boşluktan geçilene kadar kamera sabit durur; geçilince ekran
// antrenörle birlikte sağa kayar ve dar orman koridoruna girilir. Ormana
// girişte mekan adı belirir.
//
// PROLOGUN 4. BÖLÜMÜ: rögardan yalnız çıkmıyoruz. Prolog 3'te acil çıkıştan
// geçirdiğimiz BEŞ sağlıklı da bizimle. Ormanın ağzına varınca onlar da
// yeşilleniyor - kanalizasyondaki yoğun maruziyet sürelerini bitirdi - ve
// hepsini vurup ormana SON SAĞLIKLI İNSAN olarak giriyoruz.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { drawTrainer } from '../world/trainerSprite.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { treeSpriteFor } from '../pixel/trees.js';
import { hash } from '../pixel/pixelDraw.js';
import { drawSurvivor } from './people.js';
import { drawBullet, drawSplat, drawBurst } from '../pixel/weaponFx.js';
import { Cutscene } from './cutscene.js';
import { Dialogue, VOICE_PITCH } from './dialogue.js';
import { CITY_HOPE, CITY_DOUBT, CITY_ONWARD, FOREST_STOPPED, FOREST_AFTER } from './prologLines.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import {
    WORLD, VIEW, PX, START, PLAYER_SPEED, PLAYER_SCALE, LOCATION_NAME,
    GAP, TREES, CITY, WRECKS, blocked, inForest,
    COMPANION_STARTS, COMPANION_STAND, FOREST_MOUTH_X,
    BULLET_SPEED, BULLET_LIFE, FIRE_COOLDOWN
} from './adventureLayout.js';
import { bakeGround, lampSprite, wreckSprite, witherCanvas } from './adventureArt.js';
import { drawLocationTitle } from '../pixel/screenText.js';

const INTRO_FRAMES = 40;    // karanlıktan açılma (menüden kararmış geliyoruz)
const TITLE_FRAMES = 230;   // mekan adının ekranda kalma süresi
const TITLE_FADE = 34;
const ASH_COUNT = 72;       // havada süzülen kül
const FOLLOW_SPEED = 3.0;   // yanımızdakiler peşimizden geliyor
const FOLLOW_GAP = 44;      // dibimize girmesinler
const TURN_STAGGER = 70;    // yeşillenme sırayla, hep birden değil

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
            if (button === 'square') this.fire();      // KARE: ates
            if (button === 'cross') this.dialogue.advance();
        });
    }

    // Zemin ve nesneler bir kez hazırlanır; sonra yalnızca kopyalanır.
    bake() {
        if (this.ground) return;
        this.ground = bakeGround();

        const props = [];
        for (const tree of TREES) {
            const sprite = treeSpriteFor(tree);
            // Şehre yakın ağaçlar kurumuş, ormandakiler canlı. Sınır keskin
            // olmasın diye arada rastgele karışırlar.
            const witherChance = (780 - tree.x) / 260 + 1;
            const dead = hash(tree.x, tree.y, 331) < witherChance;
            props.push({
                canvas: dead ? witherCanvas(sprite.canvas) : sprite.canvas,
                x: tree.x - sprite.ox,
                y: tree.y - sprite.oy,
                baseY: tree.y
            });
        }
        // Sokak lambaları: üst kaldırımın kenarında, hepsi sönük. Bir kısmının
        // kolu aşağı sarkmış (tek numaralı çeşit).
        CITY.lamps.forEach((lampX, i) => {
            const lamp = lampSprite(i % 2);
            props.push({
                canvas: lamp.canvas,
                x: lampX - lamp.ox,
                y: CITY.topWalk.y + CITY.topWalk.h - 4 - lamp.oy,
                baseY: CITY.topWalk.y + CITY.topWalk.h - 4
            });
        });

        // Yola bırakılmış araçlar: antrenör önlerinden ve arkalarından geçer
        for (const wreck of WRECKS) {
            const sprite = wreckSprite(wreck);
            props.push({ canvas: sprite.canvas, x: sprite.x, y: sprite.y, baseY: sprite.baseY });
        }

        props.sort((a, b) => a.baseY - b.baseY);
        this.props = props;

        // Havada süzülen kül: ekrana sabit, şehirden uzaklaştıkça seyrelir
        this.ash = Array.from({ length: ASH_COUNT }, (_, i) => ({
            x: hash(i, 0, 301) * VIEW.w,
            y: hash(i, 1, 303) * VIEW.h,
            vx: -0.10 - hash(i, 2, 307) * 0.22,
            vy: 0.16 + hash(i, 3, 311) * 0.32,
            size: hash(i, 4, 313) < 0.75 ? PX : PX * 2,
            alpha: 0.16 + hash(i, 5, 317) * 0.30,
            phase: hash(i, 6, 319) * Math.PI * 2
        }));
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
        this.allDown = false;
        this.intro = INTRO_FRAMES;
        this.frame = 0;

        // Rögardan bizimle çıkan beş sağlıklı
        this.companions = COMPANION_STARTS.map((start, i) => ({
            x: start.x, y: start.y, dir: 'right', moving: false, index: i,
            greenness: 0, turning: false, down: false
        }));
        this.bullets = [];
        this.splats = [];
        this.bursts = [];
        this.cooldown = 0;
        this.dialogue.cut();
        this.script = this.buildScript();

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

    // Sahnenin akışı: yürüyüş -> ormanın ağzı -> yeşillenme -> vuruş -> orman
    buildScript() {
        const state = {};
        return new Cutscene([
            {
                // Rögar kapağından yeni çıkıldı: arkada bıraktığımız kişi
                name: 'umut', frames: 900,
                onEnter: () => this.dialogue.start(CITY_HOPE),
                until: () => !this.dialogue.active
            },
            {
                // Prolog 3'te konuşandan BAŞKASI cevap veriyor
                name: 'supheler', frames: 1600,
                onEnter: () => this.dialogue.start(CITY_DOUBT),
                until: () => !this.dialogue.active
            },
            {
                name: 'ormana', frames: 1400,
                onEnter: () => this.dialogue.start(CITY_ONWARD),
                until: () => !this.dialogue.active
            },
            {
                // Ormana doğru yürünüyor. Oyuncu serbest.
                name: 'yuruyus', frames: 0, lock: false,
                until: () => this.player.x >= FOREST_MOUTH_X
            },
            {
                // Ormanın ağzı: yanımızdakiler yerlerine dağılıyor
                name: 'orman-agzi', frames: 90, lock: false,
                onStep: () => this.spreadCompanions()
            },
            {
                // Hepsi durdu. Neden durduklarını daha bilmiyoruz.
                name: 'neden-durdunuz', frames: 900,
                onEnter: () => this.dialogue.start(FOREST_STOPPED),
                until: () => !this.dialogue.active
            },
            {
                // Yeşilleniyorlar. Sırayla: hep birden olunca kaza gibi
                // duruyor, sırayla olunca kaçınılmaz gibi.
                name: 'yesillenme', frames: TURN_STAGGER * 5 + 60, lock: false,
                onEnter: () => Sfx.status(),
                onStep: (st, t) => this.updateTurning(t)
            },
            {
                // Hepsini vuruyoruz. Yaklaşıyorlar; kaçmak bir işe yaramaz.
                name: 'vurus', frames: 0, lock: false,
                until: () => this.companions.every(c => c.down),
                onStep: () => this.updateTurned()
            },
            {
                // Vuruştan sonra bir süre balon yok: sessizlik anlatıyor.
                name: 'sessizlik', frames: 90
            },
            {
                name: 'zordu', frames: 900,
                onEnter: () => this.dialogue.start(FOREST_AFTER),
                until: () => !this.dialogue.active
            },
            {
                // Son sağlıklı insan olarak ormana giriyoruz
                name: 'orman', frames: 0, lock: false,
                onEnter: () => { this.allDown = true; }
            }
        ], state).start();
    }

    step() {
        this.frame++;
        if (this.intro > 0) this.intro--;
        if (this.titleFrames > 0) this.titleFrames--;
        if (this.cooldown > 0) this.cooldown--;

        this.gamepad?.poll();
        this.dialogue.step();
        if (!this.script.locked) this.movePlayer();
        if (this.script.name === 'yuruyus') this.followPlayer();
        this.updateBullets();
        this.updateBursts();
        this.script.step();
        this.checkForestEntry();
        this.updateCamera();
        this.updateAsh();
    }

    // --- Yanımızdaki sağlıklılar ---

    // Peşimizden geliyorlar ama dibimize girmiyorlar
    followPlayer() {
        for (const person of this.companions) {
            const targetX = this.player.x - FOLLOW_GAP - person.index * 6;
            const targetY = this.player.y + (person.index - 2) * 18;
            this.stepToward(person, targetX, targetY, FOLLOW_SPEED, 26);
        }
    }

    // Ormanın ağzında yerlerine dağılıyorlar
    spreadCompanions() {
        for (const person of this.companions) {
            const spot = COMPANION_STAND[person.index];
            this.stepToward(person, spot.x, spot.y, FOLLOW_SPEED, 3);
        }
    }

    // Sırayla yeşilleniyorlar
    updateTurning(t) {
        const elapsed = t * (TURN_STAGGER * 5 + 60);
        for (const person of this.companions) {
            const start = person.index * TURN_STAGGER;
            const progress = (elapsed - start) / TURN_STAGGER;
            if (progress <= 0) continue;
            if (!person.turning) {
                person.turning = true;
                Sfx.status();
            }
            person.greenness = Math.min(1, progress);
            person.moving = false;
        }
    }

    // Dönüşenler üstümüze geliyor. Konaksız hal yavaştır; kaçabilirsin ama
    // ormana onlarla girmiş olursun.
    updateTurned() {
        for (const person of this.companions) {
            if (person.down) continue;
            person.greenness = 1;
            this.stepToward(person, this.player.x, this.player.y, 1.1, 24);
        }
    }

    stepToward(actor, tx, ty, speed, stopAt) {
        const dx = tx - actor.x;
        const dy = ty - actor.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= stopAt) { actor.moving = false; return true; }
        const nx = actor.x + (dx / dist) * speed;
        const ny = actor.y + (dy / dist) * speed;
        if (!blocked(nx, actor.y)) actor.x = nx;
        if (!blocked(actor.x, ny)) actor.y = ny;
        actor.moving = true;
        actor.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        return false;
    }

    // --- Silah ---
    // Prolog 3'ten kalan parçalayıcı silah. Space / KARE.
    fire() {
        if (!this.running || this.cooldown > 0) return;
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
            if (bullet.x < 0 || bullet.x > WORLD.w || bullet.y < 0 || bullet.y > WORLD.h) bullet.life = 0;
            for (const person of this.companions) {
                // Yalnızca dönüşmüş olanlar vurulabiliyor: sağlıklıyken
                // ateş etmek bir işe yaramamalı.
                if (person.down || person.greenness < 1) continue;
                if (Math.hypot(bullet.x - person.x, bullet.y - (person.y - 26)) > 22) continue;
                person.down = true;
                bullet.life = 0;
                this.splats.push({
                    x: Math.round(person.x), y: Math.round(person.y),
                    radius: 20 + Math.random() * 10, seed: Math.floor(Math.random() * 1000)
                });
                this.bursts.push({ x: person.x, y: person.y - 24, t: 0 });
                Sfx.playerHurt();
            }
        }
        this.bullets = this.bullets.filter(b => b.life > 0);
    }

    updateBursts() {
        for (const burst of this.bursts) burst.t += 0.06;
        this.bursts = this.bursts.filter(b => b.t < 1);
    }

    // Kül sola-aşağı süzülür, ekranın dışına çıkınca karşı kenardan döner
    updateAsh() {
        for (const mote of this.ash) {
            mote.x += mote.vx + Math.sin((this.frame + mote.phase * 40) * 0.03) * 0.18;
            mote.y += mote.vy;
            if (mote.y > VIEW.h) { mote.y = -PX * 2; mote.x = Math.random() * VIEW.w; }
            if (mote.x < -PX * 2) mote.x = VIEW.w + PX;
        }
    }

    // Şehirden uzaklaştıkça kül seyrelir: orman hâlâ temiz
    get ashStrength() {
        return Math.min(1, Math.max(0, 1 - (this.player.x - 640) / 760));
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
        // Ormana giriş yazısı ancak hepsi vurulduktan sonra: son sağlıklı
        // insan olarak girmek sahnenin can alıcı yeri.
        if (!this.enteredForest && this.allDown && inForest(this.player.x)) {
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

        // Vurulanların yere dağılan izi: kalıcı, herkesin altında
        for (const splat of this.splats) drawSplat(ctx, splat);

        // Ağaçlar, lambalar, antrenör ve yanımızdakiler dip hizasına göre
        // tek bir sırada çizilir; yoksa biri ağacın önünde yanlış duruyor.
        const left = camX - 220;
        const right = camX + VIEW.w + 220;
        const layers = this.props
            .filter(prop => prop.x + prop.canvas.width >= left && prop.x <= right)
            .map(prop => ({ y: prop.baseY, draw: () => this.drawProp(prop, left, right) }));
        for (const person of this.companions) {
            if (person.down) continue;
            layers.push({
                y: person.y,
                draw: () => drawSurvivor(ctx, Math.round(person.x),
                    Math.round(person.y - 26) + this.bob('saglikli-' + person.index),
                    person.dir, person.moving, PLAYER_SCALE, person.index, person.greenness)
            });
        }
        layers.push({ y: player.y, draw: () => this.drawPlayer() });
        layers.sort((a, b) => a.y - b.y);
        for (const layer of layers) layer.draw();

        for (const bullet of this.bullets) drawBullet(ctx, bullet);
        for (const burst of this.bursts) drawBurst(ctx, burst.x, burst.y, burst.t);
        this.drawBubble(ctx, camX);

        ctx.restore();

        // Ekrana sabit katman: kül, mekan adı ve karanlıktan açılma perdesi
        this.drawAsh();
        drawLocationTitle(ctx, LOCATION_NAME, this.titleAlpha, VIEW.w);

        if (this.intro > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${this.intro / INTRO_FRAMES})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // --- Konuşma ---

    // Konuşanın kafası sallanır: dublaj olmadığı için "bu kişi konuşuyor"
    // bilgisini bu hareket taşıyor.
    bob(who) {
        if (this.dialogue.speaker !== who) return 0;
        return Math.floor(this.frame / 7) % 2 === 0 ? -PX : 0;
    }

    speakerActor() {
        const who = this.dialogue.speaker;
        if (!who) return null;
        if (who === 'biz') return this.player;
        const match = /^saglikli-(\d+)$/.exec(who);
        if (!match) return null;
        const person = this.companions[Number(match[1])];
        return person && !person.down ? person : null;
    }

    // camX: kamera kaydığı için balon dünya koordinatında çiziliyor ama
    // ekranın içinde kalması gerekiyor.
    drawBubble(ctx, camX) {
        if (!this.dialogue.active) return;
        const actor = this.speakerActor();
        if (!actor) return;
        const text = this.dialogue.visibleText;
        if (!text) return;

        const lines = wrapPixelText(text, 440, 2);
        drawSpeechBubble(ctx, Math.round(actor.x), Math.round(actor.y) - 58, lines, {
            scale: 2, viewLeft: camX, viewW: VIEW.w
        });
    }

    drawAsh() {
        const strength = this.ashStrength;
        if (strength <= 0.01) return;
        const { ctx } = this;
        ctx.fillStyle = '#c9c3b4';
        for (const mote of this.ash) {
            ctx.globalAlpha = mote.alpha * strength;
            ctx.fillRect(
                Math.round(mote.x / PX) * PX,
                Math.round(mote.y / PX) * PX,
                mote.size, mote.size
            );
        }
        ctx.globalAlpha = 1;
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

        drawTrainer(ctx, Math.round(player.x), Math.round(player.y - 26) + this.bob('biz'),
            player.dir, player.moving, PLAYER_SCALE);
    }
}
