import { maxHpFor, speedFor, damageMultiplierFor } from '../config/progression.js';
import { ACTIVE_POKEMON } from '../config/balance.js';

// Sahadaki Pokemon: poke topla sahaya sürülür, yetenekleri o kullanır ve
// hasarı o alır. Antrenör vurulmaz - kanonda olduğu gibi savaşan Pokemondur.
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
        this.size = ACTIVE_POKEMON.size;
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

    // Sahaya sürülen Pokemon durduğu yeri tutar; düşmana dönüp hafifçe
    // yana kayar ama antrenörü takip etmez.
    hold() {
        const enemy = this.world.nearestEnemy(this.x, this.y, 340);
        if (enemy) {
            this.facing = enemy.x > this.x ? 1 : -1;

            // Çok yakınsa geri çekil, uzaksa hafifçe yaklaş
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            let dx = 0, dy = 0;
            if (dist < ACTIVE_POKEMON.retreatRange) {
                dx = (this.x - enemy.x) / dist;
                dy = (this.y - enemy.y) / dist;
            } else if (dist > ACTIVE_POKEMON.advanceRange) {
                dx = (enemy.x - this.x) / dist;
                dy = (enemy.y - this.y) / dist;
            }

            if (dx || dy) {
                const step = this.followSpeed * this.speedBoost * ACTIVE_POKEMON.holdSpeedFactor;
                const hw = this.size * 0.24;
                const hh = this.size * 0.16;
                if (this.world.canBoxMoveTo(this.x + dx * step, this.y, hw, hh)) this.x += dx * step;
                if (this.world.canBoxMoveTo(this.x, this.y + dy * step, hw, hh)) this.y += dy * step;
            }
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
        this.invuln = ACTIVE_POKEMON.hitInvuln;
        this.flash = ACTIVE_POKEMON.hitFlash;

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
