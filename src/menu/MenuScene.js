// Ana menü: statik bir ekran değil, antrenörün içinde yürüdüğü piksel sahne.
//
//   sol    -> antrenörün evi (şimdilik etkileşimsiz)
//   yukarı -> MACERA KAPISI: kemerin önünde F, onay penceresi açılır
//   sağ    -> 2 KİŞİLİK OYNA portalı: açıklığından yürüyünce ekran kararır ve
//             karakter seçimine gidilir

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { drawTrainer } from '../world/trainerSprite.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { drawPixelText, measurePixelText } from './pixelFont.js';
import {
    SCENE, PX, START, PLAYER_SPEED, PLAYER_SCALE,
    TREES, ADVENTURE, VERSUS, blocked, nearAdventureGate, inVersusPortal
} from './menuLayout.js';
import {
    bakeGround, bakeHouse, bakeArch, treeSpriteFor,
    drawSmoke, drawArchSparks, drawFireflies
} from './menuArt.js';

const FADE_FRAMES = 84;   // portaldan geçince kararma süresi (~1.4 sn)
const INTRO_FRAMES = 26;  // sahneye girerken açılma süresi

// Tuş ipucundaki üçgen simgesi (kol bağlıyken F yerine bu görünür).
// 7 piksellik bir kareye içi boş üçgen sığmıyor - kenarlar "M" gibi
// okunuyordu; bu yüzden içi dolu çiziliyor.
const TRIANGLE_GLYPH = [
    '...#...',
    '..###..',
    '..###..',
    '.#####.',
    '.#####.',
    '#######',
    '.......'
];

export class MenuScene {
    constructor({ canvas, input, gamepad, onAdventureGate, onVersusPortal }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad || null;
        this.onAdventureGate = onAdventureGate || (() => {});
        this.onVersusPortal = onVersusPortal || (() => {});

        this.running = false;
        this.paused = false;      // onay penceresi açıkken sahne donar
        this.frame = 0;
        this.fade = 0;            // 0 = açık, FADE_FRAMES = tamamen siyah
        this.intro = 0;
        this.leaving = false;     // geçiş başladı, bir daha tetiklenmesin

        this.player = {
            x: START.x,
            y: START.y,
            dir: 'up',
            moving: false
        };

        // Ormanda süzülen ateşböcekleri (atmosfer)
        this.fireflies = [];
        for (let i = 0; i < 26; i++) {
            this.fireflies.push({
                x: Math.random() * SCENE.w,
                y: 120 + Math.random() * (SCENE.h - 200),
                angle: Math.random() * Math.PI * 2,
                phase: Math.random() * Math.PI * 2
            });
        }

        input.onKeyDown(e => {
            if (!this.running || this.paused || this.leaving) return;
            // Tarayıcı sesi ancak bir etkileşimden sonra açar; menü müziği de
            // bu yüzden ilk tuşa basılınca başlar (sayfa açılışında değil).
            unlockAudio();
            if (!this.musicStarted) {
                this.musicStarted = true;
                playMusic('town');
            }
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'KeyF') this.tryAdventureGate();
        });

        // Oyun kolu: sol analog yürütür, ÜÇGEN klavyedeki F'nin karşılığıdır
        this.gamepad?.onButtonDown(button => {
            if (!this.running || this.paused || this.leaving) return;
            unlockAudio();
            if (!this.musicStarted) {
                this.musicStarted = true;
                playMusic('town');
            }
            if (button === 'triangle') this.tryAdventureGate();
        });
    }

    // Sahnenin tüm sprite'ları bir kez hazırlanır; sonra yalnızca kopyalanır.
    bake() {
        if (this.ground) return;
        this.ground = bakeGround();

        const props = [bakeHouse(), bakeArch(ADVENTURE), bakeArch(VERSUS)];
        for (const tree of TREES) {
            const sprite = treeSpriteFor(tree);
            props.push({
                canvas: sprite.canvas,
                x: tree.x - sprite.ox,
                y: tree.y - sprite.oy,
                baseY: tree.y
            });
        }
        // Arkadan öne: dibi yukarıda olan önce çizilir
        props.sort((a, b) => a.baseY - b.baseY);
        this.props = props;
    }

    start() {
        this.bake();
        this.player.x = START.x;
        this.player.y = START.y;
        this.player.dir = 'up';
        this.player.moving = false;
        this.paused = false;
        this.leaving = false;
        this.fade = 0;
        this.intro = INTRO_FRAMES;
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        if (this.musicStarted) playMusic('town');

        // Overworld ile aynı sabit adımlı döngü
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

    // Onay penceresi açılırken/kapanırken çağrılır
    setPaused(value) {
        this.paused = value;
        if (value) this.player.moving = false;
    }

    step() {
        this.frame++;
        if (this.intro > 0) this.intro--;

        // Kolun durumu her karede taranır (Gamepad API'sinde tuş olayı yok).
        // Onay penceresi açıkken de taranır: pencere kolla kapatılabilsin.
        this.gamepad?.poll();

        // Portaldan geçiş: ekran kararır, sonunda karakter seçimine devredilir
        if (this.leaving) {
            this.fade = Math.min(FADE_FRAMES, this.fade + 1);
            if (this.fade >= FADE_FRAMES) {
                this.running = false;
                this.onVersusPortal();
            }
            return;
        }

        if (!this.paused) {
            this.movePlayer();
            this.checkVersusPortal();
        }
        this.moveFireflies();
    }

    movePlayer() {
        const { input, player } = this;
        let dx = 0;
        let dy = 0;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;

        // Klavye basılı değilse sol analog (ya da D-pad) devreye girer.
        // Analogda hız çubuğun ne kadar itildiğine göre değişir.
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

        // Çapraz giderken hız artmasın
        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;

        // Eksenler ayrı denenir: duvara sürtünerek yürünebilsin
        if (!blocked(player.x + vx, player.y)) player.x += vx;
        if (!blocked(player.x, player.y + vy)) player.y += vy;

        player.x = Math.max(0, Math.min(SCENE.w, player.x));
        player.y = Math.max(0, Math.min(SCENE.h, player.y));

        // Bakış yönü baskın eksene göre seçilir: analogda iki eksen de nadiren
        // tam sıfır olur, sabit sıra kullanılırsa karakter hep yukarı bakar.
        if (Math.abs(dy) >= Math.abs(dx)) player.dir = dy < 0 ? 'up' : 'down';
        else player.dir = dx < 0 ? 'left' : 'right';
    }

    moveFireflies() {
        for (const fly of this.fireflies) {
            fly.angle += (Math.random() - 0.5) * 0.4;
            fly.x += Math.cos(fly.angle) * 0.35;
            fly.y += Math.sin(fly.angle) * 0.35;
            if (fly.x < 20) fly.x = SCENE.w - 20;
            if (fly.x > SCENE.w - 20) fly.x = 20;
            if (fly.y < 110) fly.y = SCENE.h - 60;
            if (fly.y > SCENE.h - 40) fly.y = 110;
        }
    }

    // Antrenör iki kişilik portalın kemeri altına girdi mi?
    checkVersusPortal() {
        if (!inVersusPortal(this.player.x, this.player.y)) return;
        this.leaving = true;
        this.player.moving = false;
        Sfx.badge();
    }

    // F: macera kapısının önündeyse onay penceresini açar
    tryAdventureGate() {
        if (!nearAdventureGate(this.player.x, this.player.y)) return;
        Sfx.buy();
        this.onAdventureGate();
    }

    get hintVisible() {
        return !this.paused && !this.leaving && nearAdventureGate(this.player.x, this.player.y);
    }

    draw() {
        const { ctx, canvas, player } = this;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(this.ground, 0, 0);

        // Ev, kemerler ve ağaçlar antrenörle birlikte dip hizasına göre
        // sıralanır: arkasındaki ağaç antrenörü örter, önündeki örtmez.
        const feet = player.y;
        let i = 0;
        for (; i < this.props.length && this.props[i].baseY <= feet; i++) {
            const prop = this.props[i];
            ctx.drawImage(prop.canvas, Math.round(prop.x), Math.round(prop.y));
        }
        this.drawPlayer();
        for (; i < this.props.length; i++) {
            const prop = this.props[i];
            ctx.drawImage(prop.canvas, Math.round(prop.x), Math.round(prop.y));
        }

        // Canlanan ayrıntılar
        drawSmoke(ctx, this.frame);
        drawArchSparks(ctx, ADVENTURE, this.frame);
        drawArchSparks(ctx, VERSUS, this.frame);
        drawFireflies(ctx, this.fireflies, this.frame);

        if (this.hintVisible) this.drawHint();

        // Kararma / açılma perdesi
        const veil = this.leaving
            ? this.fade / FADE_FRAMES
            : (this.intro > 0 ? this.intro / INTRO_FRAMES : 0);
        if (veil > 0) {
            ctx.fillStyle = `rgba(2, 6, 23, ${veil})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    drawPlayer() {
        const { ctx, player } = this;
        // Ayak altındaki gölge
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#052e16';
        ctx.fillRect(Math.round((player.x - 14) / PX) * PX, Math.round((player.y + 2) / PX) * PX, PX * 7, PX * 2);
        ctx.globalAlpha = 1;

        drawTrainer(ctx, Math.round(player.x), Math.round(player.y - 26), player.dir, player.moving, PLAYER_SCALE);
    }

    // "F AÇ" ipucu antrenörün başının üstünde durur: kemerin çerçevesine ya da
    // tabelaya binmesin diye sabit bir noktaya değil, oyuncuya bağlı.
    drawHint() {
        const { ctx, player } = this;
        const bob = Math.round(Math.sin(this.frame * 0.12) * 4 / PX) * PX;
        const cap = PX * 7;
        const label = 'AÇ';
        const gap = PX * 2;
        const width = cap + gap + measurePixelText(label, 2);
        const x = Math.round((player.x - width / 2) / PX) * PX;
        const y = Math.round((player.y - 94) / PX) * PX + bob;

        // Koyu zemin: ipucu kemerin içindeki ateşin üstüne denk gelebiliyor,
        // bu olmadan yazı okunmuyor
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(x - PX * 2, y - PX * 2, width + PX * 4, cap + PX * 4);

        // Tuş kapağı: koyu çerçeve + açık yüzey + alt gölge
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - PX, y - PX, cap + PX * 2, cap + PX * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x, y, cap, cap);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x, y + cap - PX, cap, PX);

        // Kol bağlıysa F yerine ÜÇGEN simgesi gösterilir
        if (this.gamepad?.connected) {
            ctx.fillStyle = '#0f172a';
            for (let r = 0; r < TRIANGLE_GLYPH.length; r++) {
                for (let c = 0; c < TRIANGLE_GLYPH[r].length; c++) {
                    if (TRIANGLE_GLYPH[r][c] !== '#') continue;
                    ctx.fillRect(x + c * PX, y + r * PX, PX, PX);
                }
            }
        } else {
            drawPixelText(ctx, 'F', x + PX, y, { scale: 4, color: '#0f172a' });
        }

        drawPixelText(ctx, label, x + cap + gap, y + PX * 2, {
            scale: 2, color: '#fef3c7', shadow: '#0f172a'
        });
    }
}
