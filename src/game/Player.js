import { castAbility } from './abilities.js';
import { PHYSICS, PLAYER_SIZE, PAD_JUMP_BUTTON } from '../config/settings.js';

// Arenadaki bir oyuncu: hareket, fizik, can, kalkan, durum etkileri ve yetenekler.
export class Player {
    constructor({ x, y, char, playerNum, color, controls, padSlot = null, game }) {
        this.x = x;
        this.y = y;
        this.width = PLAYER_SIZE.width;
        this.height = PLAYER_SIZE.height;
        this.char = char;
        this.playerNum = playerNum;
        this.color = color;
        this.controls = controls;
        this.padSlot = padSlot;   // bu oyuncunun kolu (yoksa klavye)
        this.game = game;

        this.maxHp = char.baseStats.hp;
        this.hp = this.maxHp;
        this.speed = char.baseStats.speed;
        this.dir = playerNum === 1 ? 1 : -1; // 1 = sağa, -1 = sola bakıyor
        this.vy = 0; // dikey hız (yerçekimi ve zıplama için)

        this.img = new Image();
        this.img.src = char.battleSprite || char.sprite;

        // Bekleme süreleri (kare cinsinden; yaklaşık 2s, 4s, 10s)
        this.cooldowns = [0, 0, 0];
        this.maxCooldowns = [120, 240, 600];
        if (char.className === 'Okçu') this.maxCooldowns = [120, 200, 540];

        // Dinamik güçlendirme/zayıflatma durumları
        this.invulnerable = false;
        this.frozen = false;
        this.damageMultiplier = 1.0;
        this.speedMultiplier = 1.0;
        this.flashFrames = 0;
        this.isDead = false;
    }

    draw(ctx) {
        if (this.isDead) return; // ölü karakter çizilmez, piksel patlaması devralır

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Hasar alınca yanıp sönme
        if (this.flashFrames > 0) {
            this.flashFrames--;
            if (this.flashFrames % 4 < 2) {
                ctx.globalAlpha = 0.25;
            }
        }

        // Donma efekti
        if (this.frozen) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#38bdf8';
            ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.fillRect(this.x - this.width/2 - 5, this.y - this.height/2 - 5, this.width + 10, this.height + 10);
        }

        // Sprite
        ctx.translate(this.x, this.y);
        if (this.dir === 1) {
            ctx.scale(-1, 1);
        }
        ctx.drawImage(this.img, -this.width/2, -this.height/2, this.width, this.height);

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
        // Klavyede iki yön birden basılıysa birbirini götürür (eskisi gibi);
        // kolda analog yarım itilirse karakter daha yavaş yürür.
        let dx = 0;
        if (input.isDown(this.controls.left)) dx -= 1;
        if (input.isDown(this.controls.right)) dx += 1;
        if (dx === 0) dx = this.padStick().x;

        if (dx !== 0) {
            this.x = Math.min(
                canvas.width - this.width/2,
                Math.max(this.width/2, this.x + dx * moveSpeed)
            );
        }

        // Yerçekimi ve zıplama fiziği (uçmayı engeller)
        const groundY = canvas.height - this.height/2 - PHYSICS.groundOffset;

        const jumping = input.isDown(this.controls.up) || this.padDown(PAD_JUMP_BUTTON);
        if (jumping && this.y >= groundY) {
            this.vy = PHYSICS.jumpVelocity;
        }

        this.vy += PHYSICS.gravity;
        this.y += this.vy;

        // Yere çarpma kontrolü
        if (this.y >= groundY) {
            this.y = groundY;
            this.vy = 0;
        }
    }

    useAbility(index) {
        if (this.frozen || this.cooldowns[index] > 0) return;

        castAbility(this, index, this.game);
        this.cooldowns[index] = this.maxCooldowns[index];
    }

    takeDamage(amount) {
        if (this.invulnerable || this.game.isGameOver || this.isDead) return;

        const { effects, hud } = this.game;

        this.flashFrames = 20;
        effects.triggerShake(8);

        const dmg = Math.ceil(amount);
        let color = '#ff4444';
        let txt = `-${dmg}`;
        const isCrit = amount > 20;

        if (isCrit) {
            txt = `KRİTİK! -${dmg}`;
            color = '#fbbf24';
            effects.triggerFlash('rgba(255, 255, 255, 0.25)', 4);
        }

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
        effects.spawnDeathPixels(this.x, this.y, [this.color, '#ffffff', '#ffff00', '#ff8800']);

        // 1.5 saniye sonra oyun biter
        setTimeout(() => {
            this.game.endGame(winnerNum);
        }, 1500);
    }

    update() {
        this.move();

        for (let i = 0; i < this.cooldowns.length; i++) {
            if (this.cooldowns[i] > 0) {
                this.cooldowns[i]--;
            }
        }
    }
}
