import { Player } from './Player.js';
import { EffectsManager } from './effects.js';
import { randomArena } from './arenas.js';
import { PLAYERS, SCROLL_KEYS, FRAME_RATE } from '../config/settings.js';
import { introFor } from './fighterIntro.js';

// Oyun motoru: oyun döngüsü ve tur durumu.
// UI (ekran geçişleri) main.js'te; HUD güncellemeleri Hud sınıfında.
//
// Kontroller: her oyuncu ya klavyeden ya da kendi oyun kolundan oynar - ikisi
// de her zaman açık. 1. oyuncu takılan ilk kolu, 2. oyuncu ikinciyi kullanır;
// tek kol varsa 2. oyuncu klavyede kalır.
//
// SALDIRI YOK: virüslerin güçleri henüz yazılmadı, bu turda arenada yalnızca
// hareket ve zıplama var. Mermi sistemi (eski Pokemon hamleleri) kaldırıldı.
export class Game {
    constructor({ canvas, input, gamepad = null, hud, onGameOver }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad;
        this.hud = hud;
        this.onGameOver = onGameOver;

        this.effects = new EffectsManager();
        this.p1 = null;
        this.p2 = null;
        this.currentArena = null;
        this.rafId = null;
        this.isGameOver = false;
        this.frame = 0;      // hareketli çizimler (elektrik) buradan besleniyor
        this.intro = null;   // oynayan giriş animasyonu; varken tur başlamaz
        this.introQueue = [];

        input.onKeyDown(e => this.handleKeyDown(e));
    }

    get isRunning() {
        return !!(this.p1 && this.p2 && !this.isGameOver);
    }

    handleKeyDown(e) {
        if (!this.isRunning) return;
        // Oyun tuşları tarayıcıyı kaydırmasın
        if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
    }

    playerByPadSlot(slot) {
        if (this.p1?.padSlot === slot) return this.p1;
        if (this.p2?.padSlot === slot) return this.p2;
        return null;
    }

    start(fighter1, fighter2) {
        this.isGameOver = false;
        this.effects.reset();
        this.currentArena = randomArena();
        this.frame = 0;

        this.p1 = new Player({
            ...PLAYERS[1].start,
            fighter: fighter1,
            playerNum: 1,
            color: PLAYERS[1].color,
            controls: PLAYERS[1].moveKeys,
            padSlot: PLAYERS[1].padSlot,
            game: this
        });
        this.p2 = new Player({
            ...PLAYERS[2].start,
            fighter: fighter2,
            playerNum: 2,
            color: PLAYERS[2].color,
            controls: PLAYERS[2].moveKeys,
            padSlot: PLAYERS[2].padSlot,
            game: this
        });

        // Girişi olan dövüşçüler tur başında sırayla oynar: ÖNCE P1, SONRA P2.
        this.introQueue = [this.p1, this.p2]
            .map(p => introFor(p, this.canvas))
            .filter(Boolean);
        this.intro = this.introQueue.shift() || null;

        this.hud.setPlayers(this.p1, this.p2);
        this.hud.updateHealth(this.p1, this.p2);
        this.hud.updateControlBadges(this.gamepad?.padCount || 0);

        // Piksel sanatı modu
        this.ctx.imageSmoothingEnabled = false;

        // Ekran yenilemesiyle senkron döngü; mantık sabit adımla ilerler
        if (this.rafId) cancelAnimationFrame(this.rafId);
        const stepMs = 1000 / FRAME_RATE;
        let acc = 0;
        let last = performance.now();

        const loop = (now) => {
            if (this.isGameOver) return;
            this.rafId = requestAnimationFrame(loop);

            // Kolların taranması kare başına bir kez: mantık geriden gelip
            // birkaç adım birden koşsa da aynı basış iki kez sayılmasın.
            this.gamepad?.poll();

            acc += Math.min(now - last, stepMs * 3);
            last = now;
            while (acc >= stepMs) {
                acc -= stepMs;
                this.update();
            }
        };
        this.rafId = requestAnimationFrame(loop);
    }

    getEnemyOf(player) {
        return player === this.p1 ? this.p2 : this.p1;
    }

    endGame(winnerNum) {
        this.isGameOver = true;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;

        const winner = winnerNum === 1 ? this.p1 : this.p2;
        this.onGameOver(winnerNum, winner);
    }

    update() {
        if (this.isGameOver) return;

        const { ctx, canvas, effects } = this;
        this.frame++;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        // Giriş animasyonu: oynarken kimse hareket edemez, yalnızca sahne var.
        // Kamera karaktere doğru yaklaşırken ARKA PLAN da aynı ölçekle büyüyor
        // (karakterin ayakları sabit nokta). Yalnızca figürü büyütmek "kamera
        // yaklaştı" değil "karakter şişti" gibi duruyordu.
        if (this.intro) {
            const cam = this.intro.camera();
            ctx.save();
            ctx.translate(cam.x, cam.y);
            ctx.scale(cam.scale, cam.scale);
            ctx.translate(-cam.x, -cam.y);
            this.currentArena.drawBg(ctx, canvas.width, canvas.height);
            ctx.restore();

            this.intro.draw(ctx);
            if (this.intro.step()) this.intro = this.introQueue.shift() || null;
            return;
        }

        this.currentArena.drawBg(ctx, canvas.width, canvas.height);

        this.p1.update();
        this.p2.update();

        // Oyuncular her zaman birbirlerine dönük sayılır (sprite aynalanmıyor,
        // ama güçler geldiğinde yön buradan okunacak)
        this.p1.dir = (this.p2.x >= this.p1.x) ? 1 : -1;
        this.p2.dir = (this.p1.x >= this.p2.x) ? 1 : -1;

        ctx.save();
        effects.applyShake(ctx);

        effects.drawParticles(ctx);
        effects.drawDeathPixels(ctx);

        this.p1.draw(ctx);
        this.p2.draw(ctx);

        effects.drawFloatingTexts(ctx);
        ctx.restore();

        effects.drawFlash(ctx, canvas.width, canvas.height);

        // Kol tarayıcıya ancak bir tuşuna basılınca görünüyor; savaş başladıktan
        // sonra uyanan kol da HUD'daki simgeleri değiştirebilmeli.
        this.hud.updateControlBadges(this.gamepad?.padCount || 0);
    }
}
