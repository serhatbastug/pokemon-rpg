import { Player } from './Player.js';
import { EffectsManager } from './effects.js';
import { randomArena } from './arenas.js';
import { PLAYERS, SCROLL_KEYS, FRAME_RATE, PAD_ABILITY_BUTTONS } from '../config/settings.js';

// Oyun motoru: oyun döngüsü, çarpışmalar ve tur durumu.
// UI (ekran geçişleri) main.js'te; HUD güncellemeleri Hud sınıfında.
//
// Kontroller: her oyuncu ya klavyeden ya da kendi oyun kolundan oynar - ikisi
// de her zaman açık. 1. oyuncu takılan ilk kolu, 2. oyuncu ikinciyi kullanır;
// tek kol varsa 2. oyuncu klavyede kalır.
export class Game {
    constructor({ canvas, input, gamepad = null, hud, onGameOver }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.gamepad = gamepad;
        this.hud = hud;
        this.onGameOver = onGameOver;

        this.effects = new EffectsManager();
        this.projectiles = [];
        this.p1 = null;
        this.p2 = null;
        this.currentArena = null;
        this.rafId = null;
        this.isGameOver = false;

        input.onKeyDown(e => this.handleKeyDown(e));
        gamepad?.onSlotButtonDown((slot, button) => this.handlePadButton(slot, button));
    }

    get isRunning() {
        return !!(this.p1 && this.p2 && !this.isGameOver);
    }

    handleKeyDown(e) {
        if (!this.isRunning) return;

        // Oyun tuşları tarayıcıyı kaydırmasın
        if (SCROLL_KEYS.includes(e.code)) e.preventDefault();

        const p1Index = PLAYERS[1].abilityKeys[e.code];
        if (p1Index !== undefined) this.p1.useAbility(p1Index);

        const p2Index = PLAYERS[2].abilityKeys[e.code];
        if (p2Index !== undefined) this.p2.useAbility(p2Index);

        // Farklı klavye düzenlerinde virgül farklı fiziksel tuşta olabilir
        if (e.code !== 'Comma' && e.key === ',') this.p2.useAbility(1);
    }

    // Kolda güç tuşuna basıldı. Hangi oyuncunun gücü olduğunu KOLUN YUVASI
    // belirliyor: 0. yuva 1. oyuncunun, 1. yuva 2. oyuncunun.
    handlePadButton(slot, button) {
        if (!this.isRunning) return;

        const index = PAD_ABILITY_BUTTONS[button];
        if (index === undefined) return;

        const player = this.playerByPadSlot(slot);
        player?.useAbility(index);
    }

    playerByPadSlot(slot) {
        if (this.p1?.padSlot === slot) return this.p1;
        if (this.p2?.padSlot === slot) return this.p2;
        return null;
    }

    start(char1, char2) {
        this.isGameOver = false;
        this.projectiles = [];
        this.effects.reset();
        this.currentArena = randomArena();

        this.p1 = new Player({
            ...PLAYERS[1].start,
            char: char1,
            playerNum: 1,
            color: PLAYERS[1].color,
            controls: PLAYERS[1].moveKeys,
            padSlot: PLAYERS[1].padSlot,
            game: this
        });
        this.p2 = new Player({
            ...PLAYERS[2].start,
            char: char2,
            playerNum: 2,
            color: PLAYERS[2].color,
            controls: PLAYERS[2].moveKeys,
            padSlot: PLAYERS[2].padSlot,
            game: this
        });

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

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        this.currentArena.drawBg(ctx, canvas.width, canvas.height);

        this.p1.update();
        this.p2.update();

        // Oyuncular her zaman birbirlerine dönük olsun
        this.p1.dir = (this.p2.x >= this.p1.x) ? 1 : -1;
        this.p2.dir = (this.p1.x >= this.p2.x) ? 1 : -1;

        ctx.save();
        effects.applyShake(ctx);

        this.updateProjectiles();

        effects.drawParticles(ctx);
        effects.drawDeathPixels(ctx);

        this.p1.draw(ctx);
        this.p2.draw(ctx);

        effects.drawFloatingTexts(ctx);
        ctx.restore();

        effects.drawFlash(ctx, canvas.width, canvas.height);

        this.hud.updateCooldowns(this.p1, this.p2);
        // Kol tarayıcıya ancak bir tuşuna basılınca görünüyor; savaş başladıktan
        // sonra uyanan kol da HUD'daki simgeleri değiştirebilmeli.
        this.hud.updateControlBadges(this.gamepad?.padCount || 0);
    }

    updateProjectiles() {
        const { ctx, effects } = this;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this);
            p.draw(ctx);

            // İsabet kontrolü
            const target = p.owner === 1 ? this.p2 : this.p1;
            const dist = Math.hypot(p.x - target.x, p.y - target.y);

            if (dist < target.width/2 + p.radius) {
                this.applyStatusEffect(p, target);

                target.takeDamage(p.dmg);
                effects.createExplosion(p.x, p.y, p.color);
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.duration <= 0) {
                // Tohum bombası isabet etmese de zeminde patlar
                if (p.type === 'seedbomb') effects.createExplosion(p.x, p.y, '#65a30d');
                this.projectiles.splice(i, 1);
            }
        }
    }

    // İsabet anındaki özel durum etkileri (hipnoz, dondurma, zehir)
    applyStatusEffect(projectile, target) {
        const { effects } = this;

        if (projectile.type === 'hypnosis') {
            target.frozen = true;
            effects.spawnText(target.x, target.y - 90, 'HİPNOZ!', '#a855f7', true);
            setTimeout(() => target.frozen = false, 1500);
        } else if (projectile.type === 'freeze') {
            target.frozen = true;
            effects.spawnText(target.x, target.y - 90, 'DONDU!', '#38bdf8', true);
            setTimeout(() => target.frozen = false, 2000);
        } else if (projectile.type === 'poison') {
            let ticks = 0;
            effects.spawnText(target.x, target.y - 90, 'ZEHİRLENDİ!', '#10b981', true);
            const poisonInterval = setInterval(() => {
                if (this.isGameOver) {
                    clearInterval(poisonInterval);
                    return;
                }
                target.takeDamage(3);
                ticks++;
                if (ticks >= 4) clearInterval(poisonInterval);
            }, 1000);
        }
    }
}
