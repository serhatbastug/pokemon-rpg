import { PHYSICS, PAD_JUMP_BUTTON } from '../config/settings.js';
import { drawFighter, FIGHTER_SPRITES } from './fighterArt.js';

// Arenadaki bir oyuncu: hareket, fizik, can ve durum etkileri.
//
// SALDIRI YOK: virüslerin güçleri henüz yazılmadı. takeDamage/ölüm yolu
// duruyor çünkü güçler geldiğinde bağlanacak yer orası.
export class Player {
    constructor({ x, y, fighter, playerNum, color, controls, padSlot = null, game }) {
        this.x = x;
        this.y = y;
        this.fighter = fighter;
        this.playerNum = playerNum;
        this.color = color;
        this.controls = controls;
        this.padSlot = padSlot;   // bu oyuncunun kolu (yoksa klavye)
        this.game = game;

        // Çarpışma kutusu sprite'ın kendi ölçüsü: virüs anti-virüsten hem
        // daha geniş hem daha kütleli, ikisini aynı kutuya sokmak yanlış olur.
        const sprite = FIGHTER_SPRITES[fighter.id]?.();
        this.width = sprite ? sprite.w * 0.55 : 80;
        this.height = sprite ? sprite.h : 160;

        this.maxHp = fighter.stats.hp;
        this.hp = this.maxHp;
        this.speed = fighter.stats.speed;
        this.dir = playerNum === 1 ? 1 : -1;
        this.vy = 0;

        this.invulnerable = false;
        this.frozen = false;
        this.damageMultiplier = 1.0;
        this.speedMultiplier = 1.0;
        this.flashFrames = 0;
        this.isDead = false;
    }

    // Ayakların değdiği çizgi: sprite ayak hizasından çiziliyor
    get footY() {
        return this.y + this.height / 2;
    }

    draw(ctx) {
        if (this.isDead) return; // ölü karakter çizilmez, piksel patlaması devralır

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Hasar alınca yanıp sönme
        if (this.flashFrames > 0) {
            this.flashFrames--;
            if (this.flashFrames % 4 < 2) ctx.globalAlpha = 0.25;
        }

        // Sprite AYNALANMIYOR: iki karakterin de kimliği asimetrisinde
        // (anti-virüsün kaplı yanı, virüsün yüksek omzu). Aynalayınca hangi
        // yanın kaplı olduğu karaktere değil, rakibin yerine bağlı olurdu.
        drawFighter(ctx, this.fighter.id, this.x, this.footY, this.game.frame);

        ctx.restore();
    }

    // Bu oyuncunun kolunun sol analogu. Kolu yoksa nötr döner.
    padStick() {
        if (this.padSlot === null) return { x: 0, y: 0, magnitude: 0 };
        return this.game.gamepad?.stickAt(this.padSlot) || { x: 0, y: 0, magnitude: 0 };
    }

    // Bu oyuncunun kolunda bir tuş basılı mı
    padDown(button) {
        if (this.padSlot === null) return false;
        return !!this.game.gamepad?.isDownAt(this.padSlot, button);
    }

    move() {
        if (this.frozen) return;

        const { input, canvas } = this.game;
        const moveSpeed = this.speed * this.speedMultiplier;

        // Yatay hareket: klavye tuşları ile kolun sol analogu aynı işi görür.
        // Klavyede iki yön birden basılıysa birbirini götürür; kolda analog
        // yarım itilirse karakter daha yavaş yürür.
        let dx = 0;
        if (input.isDown(this.controls.left)) dx -= 1;
        if (input.isDown(this.controls.right)) dx += 1;
        if (dx === 0) dx = this.padStick().x;

        if (dx !== 0) {
            this.x = Math.min(
                canvas.width - this.width / 2,
                Math.max(this.width / 2, this.x + dx * moveSpeed)
            );
        }

        // Yerçekimi ve zıplama (uçmayı engeller)
        const groundY = canvas.height - this.height / 2 - PHYSICS.groundOffset;

        const jumping = input.isDown(this.controls.up) || this.padDown(PAD_JUMP_BUTTON);
        if (jumping && this.y >= groundY) {
            this.vy = PHYSICS.jumpVelocity;
        }

        this.vy += PHYSICS.gravity;
        this.y += this.vy;

        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = 0;
        }
    }

    takeDamage(amount) {
        if (this.invulnerable || this.game.isGameOver || this.isDead) return;

        const { effects, hud } = this.game;

        this.flashFrames = 20;
        effects.triggerShake(8);

        const dmg = Math.ceil(amount);
        const isCrit = amount > 20;
        const txt = isCrit ? `KRİTİK! -${dmg}` : `-${dmg}`;
        const color = isCrit ? '#fbbf24' : '#ff4444';
        if (isCrit) effects.triggerFlash('rgba(255, 255, 255, 0.25)', 4);

        this.hp -= amount;
        effects.spawnText(this.x, this.y - 60, txt, color, isCrit);

        if (this.hp <= 0) {
            this.hp = 0;
            hud.updateHealth(this.game.p1, this.game.p2);
            this.triggerDeathAnimation(this.playerNum === 1 ? 2 : 1);
            return;
        }

        hud.updateHealth(this.game.p1, this.game.p2);
    }

    triggerDeathAnimation(winnerNum) {
        const { effects } = this.game;

        this.isDead = true;
        this.invulnerable = true;
        effects.triggerShake(20);
        effects.triggerFlash('rgba(255,255,255,0.7)', 8);

        effects.spawnText(this.x, this.y - 80, 'K.O.!', '#ff0000', true);
        effects.spawnDeathPixels(this.x, this.y, [this.fighter.themeColor, '#ffffff', '#ffff00']);

        setTimeout(() => this.game.endGame(winnerNum), 1500);
    }

    update() {
        this.move();
    }
}
