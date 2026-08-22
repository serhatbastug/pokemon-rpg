import { TILE_SIZE } from '../config/worldMap.js';

// Tür (kind) bazlı düşman istatistikleri
const KIND_STATS = {
    common: { hp: 35, speed: 2.2, damage: 10, size: 60, aggroRange: 260 },
    hidden: { hp: 70, speed: 2.6, damage: 14, size: 66, aggroRange: 300 },
    boss: { hp: 140, speed: 2.0, damage: 18, size: 96, aggroRange: 320 }
};

// Haritada dolaşan düşman Pokemon. Oyuncu menzile girince kovalar,
// temas edince hasar verir. HP bitince bayılır; bayılınca Pokeball ile
// yakalanabilir (Overworld.tryCatch).
export class Enemy {
    constructor({ id, kind, col, row, world }) {
        const stats = KIND_STATS[kind];
        this.id = id;
        this.kind = kind;
        this.world = world;
        this.name = `#${id}`; // PokeAPI verisi gelince gerçek isimle değişir

        this.x = col * TILE_SIZE + TILE_SIZE / 2;
        this.y = row * TILE_SIZE + TILE_SIZE / 2;
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.speed = stats.speed;
        this.damage = stats.damage;
        this.size = stats.size;
        this.aggroRange = stats.aggroRange;

        this.img = new Image();
        this.facing = -1;
        this.fainted = false;
        this.stunTimer = 0;
        this.attackCooldown = 0;
        this.hitFlash = 0;
        this.wanderTimer = 0;
        this.wanderDir = { x: 0, y: 0 };
    }

    update() {
        if (this.fainted) return;

        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.hitFlash > 0) this.hitFlash--;
        if (this.stunTimer > 0) {
            this.stunTimer--;
            return;
        }

        const player = this.world.player;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        let dx = 0, dy = 0;

        if (dist < this.aggroRange && dist > 1) {
            // Kovala
            dx = (player.x - this.x) / dist;
            dy = (player.y - this.y) / dist;

            // Temas saldırısı
            if (dist < this.size / 2 + 22 && this.attackCooldown === 0) {
                this.world.damagePlayer(this.damage, this);
                this.attackCooldown = 60;
            }
        } else {
            // Başıboş dolaş: ara sıra rastgele yön seç (ya da dur)
            this.wanderTimer--;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 90 + Math.floor(Math.random() * 120);
                const dirs = [[0, 0], [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
                const d = dirs[Math.floor(Math.random() * dirs.length)];
                this.wanderDir = { x: d[0], y: d[1] };
            }
            dx = this.wanderDir.x * 0.4;
            dy = this.wanderDir.y * 0.4;
        }

        if (dx < 0) this.facing = -1;
        if (dx > 0) this.facing = 1;

        const hw = this.size * 0.28;
        const hh = this.size * 0.18;
        const nx = this.x + dx * this.speed;
        if (this.world.canBoxMoveTo(nx, this.y, hw, hh)) this.x = nx;
        const ny = this.y + dy * this.speed;
        if (this.world.canBoxMoveTo(this.x, ny, hw, hh)) this.y = ny;
    }

    takeDamage(amount) {
        if (this.fainted) return;

        this.hp -= amount;
        this.hitFlash = 12;
        this.world.spawnMapText(this.x, this.y - this.size / 2, `-${Math.ceil(amount)}`, '#f87171');

        if (this.hp <= 0) {
            this.hp = 0;
            this.fainted = true;
            this.world.spawnMapText(this.x, this.y - this.size / 2 - 14, 'BAYILDI!', '#fbbf24');
        }
    }

    draw(ctx) {
        if (!this.img.complete || this.img.naturalWidth === 0) return;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (this.fainted) {
            ctx.globalAlpha = 0.45;
        } else if (this.hitFlash > 0 && this.hitFlash % 4 < 2) {
            ctx.globalAlpha = 0.3;
        }

        const bob = (!this.fainted && this.stunTimer === 0) ? Math.sin(Date.now() / 300 + this.x) * 2 : 0;
        ctx.translate(this.x, this.y + bob);
        if (this.facing === 1) ctx.scale(-1, 1);
        ctx.drawImage(this.img, -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();

        // Sersemletildi göstergesi
        if (this.stunTimer > 0 && !this.fainted) {
            ctx.save();
            ctx.font = "bold 14px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillStyle = '#a78bfa';
            const zBob = Math.sin(Date.now() / 200) * 3;
            ctx.fillText('z Z z', this.x, this.y - this.size / 2 - 6 + zBob);
            ctx.restore();
        }

        // Can barı (hasar almışsa ve ayaktaysa)
        if (!this.fainted && this.hp < this.maxHp) {
            const w = 44;
            const x0 = this.x - w / 2;
            const y0 = this.y - this.size / 2 - 10;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(x0 - 1, y0 - 1, w + 2, 6);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(x0, y0, w * (this.hp / this.maxHp), 4);
            ctx.restore();
        }

        // Boss etiketi
        if (this.kind === 'boss' && !this.fainted) {
            ctx.save();
            ctx.font = "bold 13px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            const label = `BOSS ${this.name}`;
            ctx.strokeText(label, this.x, this.y - this.size / 2 - 18);
            ctx.fillStyle = '#f97316';
            ctx.fillText(label, this.x, this.y - this.size / 2 - 18);
            ctx.restore();
        }
    }
}
