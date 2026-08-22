import { maxHpFor, speedFor, damageMultiplierFor } from '../config/progression.js';

// Sahadaki Pokemon: antrenörü takip eder, yetenekleri o kullanır ve hasarı o alır.
// Antrenör vurulmaz — kanonda olduğu gibi savaşan Pokemondur.
export class ActivePokemon {
    constructor({ member, data, abilities, world }) {
        this.member = member;       // Progress'teki kayıt { id, formId, level, name }
        this.world = world;
        this.abilities = abilities;
        this.types = data.types || [];
        this.name = data.name;
        this.level = member.level;

        this.img = new Image();
        this.img.src = data.battleSprite || data.sprite;

        this.baseStats = data.baseStats;
        this.maxHp = maxHpFor(data.baseStats.hp, member.level);
        this.hp = this.maxHp;
        this.followSpeed = speedFor(data.baseStats.speed);
        this.damageMultiplier = damageMultiplierFor(data.baseStats.attack, member.level);

        this.x = 0;
        this.y = 0;
        this.size = 62;
        this.facing = 1;
        this.cooldowns = abilities.map(() => 0);
        this.invuln = 0;
        this.fainted = false;
        this.flash = 0;

        // Geçici güçlendirmeler (buff hamleleri)
        this.damageBoost = 1;
        this.speedBoost = 1;
        this.boostTimer = 0;
    }

    // Antrenörün biraz gerisinde, yumuşak takip
    follow(trainer) {
        const offsetX = -trainer.dirX * 34;
        const offsetY = -trainer.dirY * 30 + 6;
        const targetX = trainer.x + offsetX;
        const targetY = trainer.y + offsetY;

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 4) {
            const step = Math.min(dist, this.followSpeed * this.speedBoost * 1.5);
            const nx = this.x + (dx / dist) * step;
            const ny = this.y + (dy / dist) * step;
            const hw = this.size * 0.24;
            const hh = this.size * 0.16;
            if (this.world.canBoxMoveTo(nx, this.y, hw, hh)) this.x = nx;
            if (this.world.canBoxMoveTo(this.x, ny, hw, hh)) this.y = ny;
            if (Math.abs(dx) > 6) this.facing = dx > 0 ? 1 : -1;
        }

        // Çok geride kalırsa (duvara takıldıysa) antrenörün yanına ışınlanır
        if (Math.hypot(trainer.x - this.x, trainer.y - this.y) > 220) {
            this.x = trainer.x;
            this.y = trainer.y;
        }
    }

    update() {
        for (let i = 0; i < this.cooldowns.length; i++) {
            if (this.cooldowns[i] > 0) this.cooldowns[i]--;
        }
        if (this.invuln > 0) this.invuln--;
        if (this.flash > 0) this.flash--;
        if (this.boostTimer > 0) {
            this.boostTimer--;
            if (this.boostTimer === 0) {
                this.damageBoost = 1;
                this.speedBoost = 1;
            }
        }
    }

    takeDamage(amount) {
        if (this.fainted || this.invuln > 0) return;

        this.hp -= amount;
        this.invuln = 45;
        this.flash = 20;

        if (this.hp <= 0) {
            this.hp = 0;
            this.fainted = true;
            this.world.onPokemonFainted(this);
        }
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    draw(ctx) {
        if (this.fainted) return;
        if (!this.img.complete || this.img.naturalWidth === 0) return;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (this.invuln > 0 && this.invuln % 8 < 4) ctx.globalAlpha = 0.4;

        const bob = Math.sin(Date.now() / 260) * 2;
        ctx.translate(this.x, this.y + bob);
        if (this.facing === 1) ctx.scale(-1, 1);
        ctx.drawImage(this.img, -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();

        // Güçlendirme halkası
        if (this.boostTimer > 0) {
            ctx.save();
            const t = Date.now() / 120;
            for (let i = 0; i < 8; i++) {
                const a = t + (i / 8) * Math.PI * 2;
                ctx.fillStyle = this.damageBoost > 1 ? '#f87171' : '#38bdf8';
                ctx.fillRect(this.x + Math.cos(a) * 30 - 2, this.y + Math.sin(a) * 22 - 2, 4, 4);
            }
            ctx.restore();
        }
    }
}
