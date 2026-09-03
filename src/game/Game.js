import { Player } from './Player.js';
import { EffectsManager } from './effects.js';
import { Combat } from './combat.js';
import { randomArena, ledgesOf } from './arenas.js';
import { PLAYERS, SCROLL_KEYS, FRAME_RATE, COMBAT } from '../config/settings.js';
import { introFor } from './fighterIntro.js';
import { drawPixelText } from '../pixel/pixelFont.js';

// Oyun motoru: oyun döngüsü ve maç durumu.
// UI (ekran geçişleri) main.js'te; HUD güncellemeleri Hud sınıfında.
//
// Kontroller: her oyuncu ya klavyeden ya da kendi oyun kolundan oynar - ikisi
// de her zaman açık. 1. oyuncu takılan ilk kolu, 2. oyuncu ikinciyi kullanır;
// tek kol varsa 2. oyuncu klavyede kalır.
//
// MAÇ ÜÇ RAUNT: iki raundu alan kazanır, üçüncüye gerek kalmayabilir. Her
// raundun süre sınırı var - blok yüzünden şart, yoksa iki oyuncu da bekleyip
// birbirine hiç yaklaşmayabilir. Süre biterse canı fazla olan raundu alır.
//
// Aşamalar: 'intro' (giriş animasyonları) -> her raunt için 'ready' (kısa
// donma, "RAUNT n") -> 'fight' -> 'roundOver' -> sonraki raunt ya da maç sonu.
export class Game {
    constructor({ canvas, input, gamepad = null, hud, onGameOver }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad;
        this.hud = hud;
        this.onGameOver = onGameOver;

        this.effects = new EffectsManager();
        this.combat = new Combat(this);
        this.p1 = null;
        this.p2 = null;
        this.currentArena = null;
        // Arenanın basamakları: maç boyunca değişmiyor, bir kez hesaplanıp
        // burada duruyor. Oyuncular her karede buradan okuyor.
        this.ledges = [];
        this.rafId = null;
        this.isGameOver = false;
        this.frame = 0;      // hareketli çizimler (elektrik) buradan besleniyor
        this.intro = null;   // oynayan giriş animasyonu; varken maç başlamaz
        this.introQueue = [];

        this.round = 1;
        this.wins = { 1: 0, 2: 0 };
        this.phase = 'intro';
        this.phaseTimer = 0;
        this.roundTimer = COMBAT.roundFrames;
        this.banner = null;

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
        this.combat.reset();
        // Arena maç boyunca SABİT: raunt başına değiştirmek, basamakları
        // ezberleyen oyuncunun emeğini her raunt sıfırlar.
        this.currentArena = randomArena();
        this.ledges = ledgesOf(this.currentArena, this.canvas.width, this.canvas.height);
        this.frame = 0;
        this.round = 1;
        this.wins = { 1: 0, 2: 0 };
        this.banner = null;

        this.p1 = new Player({
            ...PLAYERS[1].start,
            fighter: fighter1,
            playerNum: 1,
            color: PLAYERS[1].color,
            controls: PLAYERS[1].moveKeys,
            actionKeys: PLAYERS[1].actionKeys,
            padSlot: PLAYERS[1].padSlot,
            game: this
        });
        this.p2 = new Player({
            ...PLAYERS[2].start,
            fighter: fighter2,
            playerNum: 2,
            color: PLAYERS[2].color,
            controls: PLAYERS[2].moveKeys,
            actionKeys: PLAYERS[2].actionKeys,
            padSlot: PLAYERS[2].padSlot,
            game: this
        });

        // Girişi olan dövüşçüler maç başında sırayla oynar: ÖNCE P1, SONRA P2.
        this.introQueue = [this.p1, this.p2]
            .map(p => introFor(p, this.canvas))
            .filter(Boolean);
        this.intro = this.introQueue.shift() || null;
        this.phase = this.intro ? 'intro' : 'ready';
        this.phaseTimer = COMBAT.roundStartFreeze;

        this.hud.setPlayers(this.p1, this.p2);
        this.hud.updateHealth(this.p1, this.p2);
        this.hud.updateRounds(this.wins);
        this.hud.updateTimer(COMBAT.roundFrames);
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

    startRound(n) {
        this.round = n;
        this.combat.reset();
        this.effects.reset();
        this.p1.resetForRound();
        this.p2.resetForRound();
        this.roundTimer = COMBAT.roundFrames;
        this.phase = 'ready';
        this.phaseTimer = COMBAT.roundStartFreeze;
        this.banner = { text: `RAUNT ${n}`, color: '#f8fafc' };
        this.hud.updateHealth(this.p1, this.p2);
        this.hud.updateTimer(this.roundTimer);
    }

    // winnerNum 0 = beraberlik (süre bitti, canlar eşit)
    endRound(winnerNum) {
        if (this.phase !== 'fight') return;
        this.phase = 'roundOver';
        this.phaseTimer = COMBAT.intermissionFrames;

        if (winnerNum) {
            this.wins[winnerNum]++;
            const winner = winnerNum === 1 ? this.p1 : this.p2;
            this.banner = { text: `RAUNT ${this.round}: ${winner.fighter.name}`, color: winner.color };
        } else {
            this.banner = { text: 'BERABERE', color: '#cbd5e1' };
        }
        this.hud.updateRounds(this.wins);
    }

    // Maç bitti mi, bittiyse kim aldı? Maçı bitiren şey iki raunt kazanmak;
    // üç raunt dolduğu hâlde kimse ikiye ulaşamadıysa (beraberlik olduysa)
    // çok raunt alan, o da eşitse canı oranca fazla olan kazanır.
    matchWinner() {
        if (this.wins[1] >= COMBAT.roundsToWin) return 1;
        if (this.wins[2] >= COMBAT.roundsToWin) return 2;
        if (this.round < COMBAT.maxRounds) return 0;
        if (this.wins[1] !== this.wins[2]) return this.wins[1] > this.wins[2] ? 1 : 2;
        return (this.p1.hp / this.p1.maxHp) >= (this.p2.hp / this.p2.maxHp) ? 1 : 2;
    }

    endGame(winnerNum) {
        this.isGameOver = true;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;

        const winner = winnerNum === 1 ? this.p1 : this.p2;
        this.onGameOver(winnerNum, winner);
    }

    stepPhase() {
        if (this.phaseTimer > 0) this.phaseTimer--;

        if (this.phase === 'ready' && this.phaseTimer <= 0) {
            this.phase = 'fight';
            this.banner = { text: 'BAŞLA', color: '#fbbf24', life: 40 };
            return;
        }

        if (this.phase === 'roundOver' && this.phaseTimer <= 0) {
            const winner = this.matchWinner();
            if (winner) this.endGame(winner);
            else this.startRound(this.round + 1);
            return;
        }

        if (this.phase === 'fight') {
            this.roundTimer--;
            this.hud.updateTimer(this.roundTimer);
            if (this.roundTimer <= 0) {
                // Süre bitti: canı fazla olan raundu alır.
                const r1 = this.p1.hp / this.p1.maxHp;
                const r2 = this.p2.hp / this.p2.maxHp;
                this.endRound(r1 === r2 ? 0 : (r1 > r2 ? 1 : 2));
            }
        }
    }

    drawBanner(ctx) {
        if (!this.banner) return;
        if (this.banner.life !== undefined) {
            if (--this.banner.life <= 0) { this.banner = null; return; }
        }
        drawPixelText(ctx, this.banner.text, this.canvas.width / 2, 70, {
            scale: 6, color: this.banner.color, shadow: '#020617', align: 'center'
        });
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
            if (this.intro.step()) {
                this.intro = this.introQueue.shift() || null;
                if (!this.intro) {
                    this.phase = 'ready';
                    this.phaseTimer = COMBAT.roundStartFreeze;
                    this.banner = { text: 'RAUNT 1', color: '#f8fafc' };
                }
            }
            return;
        }

        this.currentArena.drawBg(ctx, canvas.width, canvas.height);

        this.stepPhase();

        // Raunt başında ve raunt arasında kimse oynamaz: hamleler ekranda
        // kalmasın, "BAŞLA" yazmadan vuruş başlamasın.
        const live = this.phase === 'fight';
        this.p1.frozen = !live;
        this.p2.frozen = !live;

        this.p1.update();
        this.p2.update();

        // Oyuncular her zaman birbirlerine dönük sayılır (sprite aynalanmıyor,
        // ama hamlelerin yönü buradan okunuyor)
        this.p1.dir = (this.p2.x >= this.p1.x) ? 1 : -1;
        this.p2.dir = (this.p1.x >= this.p2.x) ? 1 : -1;

        if (live) this.combat.update();

        ctx.save();
        effects.applyShake(ctx);

        effects.drawParticles(ctx);
        effects.drawDeathPixels(ctx);

        this.combat.draw(ctx);
        this.p1.draw(ctx);
        this.p2.draw(ctx);

        effects.drawFloatingTexts(ctx);
        this.combat.drawGrabPrompt(ctx);
        ctx.restore();

        this.drawBanner(ctx);
        effects.drawFlash(ctx, canvas.width, canvas.height);

        // Kol tarayıcıya ancak bir tuşuna basılınca görünüyor; savaş başladıktan
        // sonra uyanan kol da HUD'daki simgeleri değiştirebilmeli.
        this.hud.updateControlBadges(this.gamepad?.padCount || 0);
        this.hud.drawComboBars(this.p1, this.p2);
    }
}
