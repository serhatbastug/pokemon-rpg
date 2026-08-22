import { TILE_SIZE } from '../config/worldMap.js';

// Tür (kind) bazlı temel istatistikler. aggroTiles: labirent yolu üzerinden
// kaç karo mesafede oyuncuyu fark eder (duvar arkasından fark etmez).
const KIND_STATS = {
    common: { hp: 35, speed: 2.2, size: 60, aggroTiles: 6 },
    // Gizli: mağarasını korur, peşinden gelmez (guardRadius dışına çıkmaz)
    hidden: { hp: 70, speed: 2.6, size: 66, aggroTiles: 5, guardRadius: 190 },
    // Boss: uyanana kadar hareketsiz uyur
    boss: { hp: 140, speed: 2.0, size: 96, aggroTiles: 8, sleeps: true }
};

// Tür bazlı menzilli saldırılar - hepsi o Pokemonun resmi hamleleri.
// type, projectileSprites.js'teki sprite anahtarıdır.
const SPECIES_ATTACKS = {
    127: { type: 'xscissor', name: 'X-Scissor', damage: 12, speed: 6.5, cooldown: 110, range: 260 },       // Pinsir
    217: { type: 'focusblast', name: 'Focus Blast', damage: 16, speed: 5.5, cooldown: 140, range: 280 },   // Ursaring
    709: { type: 'shadowball', name: 'Shadow Ball', damage: 14, speed: 5, cooldown: 120, range: 300 },     // Trevenant
    545: { type: 'poison', name: 'Sludge Bomb', damage: 16, speed: 6, cooldown: 100, range: 300 },         // Scolipede
    768: { type: 'pinmissile', name: 'Pin Missile', damage: 12, speed: 7, cooldown: 130, range: 340, spread: 3 }, // Golisopod
    // Gölgeli Derinlikler
    123: { type: 'xscissor', name: 'X-Scissor', damage: 13, speed: 7.5, cooldown: 100, range: 280 },      // Scyther
    455: { type: 'leaf', name: 'Razor Leaf', damage: 11, speed: 6.5, cooldown: 90, range: 300, spread: 2 }, // Carnivine
    553: { type: 'seedbomb', name: 'Stone Edge', damage: 17, speed: 6, cooldown: 140, range: 300 },        // Krookodile
    197: { type: 'shadowball', name: 'Shadow Ball', damage: 15, speed: 6, cooldown: 95, range: 320 },      // Umbreon
    701: { type: 'focusblast', name: 'Flying Press', damage: 15, speed: 6.5, cooldown: 120, range: 360, spread: 2 } // Hawlucha
};

const CONTACT_DAMAGE = 8;

// Haritada dolaşan düşman Pokemon. Oyuncuyu labirent yolunu izleyerek kovalar
// (akış alanı), görüş hattı açıkken resmi hamlesiyle uzaktan vurur.
// HP bitince bayılır; bayılınca Pokeball ile yakalanabilir.
export class Enemy {
    constructor({ id, kind, col, row, world }) {
        const stats = KIND_STATS[kind];
        this.id = id;
        this.kind = kind;
        this.world = world;
        this.name = `#${id}`; // PokeAPI verisi gelince gerçek isimle değişir
        this.attack = SPECIES_ATTACKS[id] || SPECIES_ATTACKS[127];

        this.x = col * TILE_SIZE + TILE_SIZE / 2;
        this.y = row * TILE_SIZE + TILE_SIZE / 2;
        this.homeX = this.x;   // gizli Pokemon buradan uzaklaşmaz
        this.homeY = this.y;
        this.guardRadius = stats.guardRadius || 0;
        this.homeArea = null;  // gizli odayı koruyanlar: sadece oda içinde saldırır
        this.asleep = !!stats.sleeps; // boss uyanana kadar uyur
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.speed = stats.speed;
        this.size = stats.size;
        this.aggroTiles = stats.aggroTiles;

        this.img = new Image();
        this.facing = -1;
        this.fainted = false;
        this.aggro = false;
        this.stunTimer = 0;
        this.attackCooldown = 0;
        this.windup = 0;         // saldırı öncesi hazırlık kareleri
        this.contactCooldown = 0;
        this.hitFlash = 0;
        this.wanderTimer = 0;
        this.wanderDir = { x: 0, y: 0 };
        this.strafePhase = Math.random() * Math.PI * 2;
    }

    // Boss uyanışı: çok yaklaşınca ya da yakınında ateş edilince
    wakeUp() {
        if (!this.asleep) return;
        this.asleep = false;
        this.aggro = true;
        this.world.onBossWake(this);
    }

    update() {
        if (this.fainted) return;

        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.contactCooldown > 0) this.contactCooldown--;
        if (this.hitFlash > 0) this.hitFlash--;

        const player = this.world.player;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);

        // Uyuyan boss: yaklaşılınca uyanır, o ana kadar hareketsiz
        if (this.asleep) {
            if (dist < 150) this.wakeUp();
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            this.windup = 0;
            return;
        }

        // Fark etme: labirent yolu üzerinden mesafe (duvar arkasını görmez)
        const pathDist = this.world.tileDistAt(
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE)
        );
        if (!this.aggro) {
            if (pathDist <= this.aggroTiles) this.aggro = true;
        } else if (pathDist > this.aggroTiles + 5) {
            this.aggro = false;
            this.windup = 0;
        }

        // Gizli Pokemon bölgesini korur: oyuncu mağaradan çıkınca peşinden gitmez.
        // homeArea varsa yalnızca oyuncu odanın içindeyken saldırır.
        if (this.guardRadius || this.homeArea) {
            const outside = this.homeArea
                ? !this.world.isInsideArea(player.x, player.y, this.homeArea)
                : Math.hypot(player.x - this.homeX, player.y - this.homeY) > this.guardRadius;
            if (outside) {
                this.aggro = false;
                this.windup = 0;
                // Yuvasına dön
                const back = Math.hypot(this.homeX - this.x, this.homeY - this.y);
                if (back > 6) {
                    const hw = this.size * 0.28, hh = this.size * 0.18;
                    const sx = this.x + ((this.homeX - this.x) / back) * this.speed;
                    const sy = this.y + ((this.homeY - this.y) / back) * this.speed;
                    if (this.world.canBoxMoveTo(sx, this.y, hw, hh)) this.x = sx;
                    if (this.world.canBoxMoveTo(this.x, sy, hw, hh)) this.y = sy;
                }
                return;
            }
        }

        // Temas hasarı (oyuncu üstüne yapışırsa)
        if (dist < this.size / 2 + 22 && this.contactCooldown === 0) {
            this.world.damagePlayer(CONTACT_DAMAGE, this);
            this.contactCooldown = 60;
        }

        let dx = 0, dy = 0;

        if (this.aggro) {
            const los = this.world.hasLineOfSight(this.x, this.y, player.x, player.y);

            // Saldırı: hazırlık -> atış
            if (this.windup > 0) {
                this.windup--;
                if (this.windup === 0) this.fireAt(player);
            } else if (los && dist < this.attack.range && this.attackCooldown === 0) {
                this.windup = 18;
                this.attackCooldown = this.attack.cooldown;
            }

            if (los && dist < this.attack.range * 0.8) {
                if (dist < 110) {
                    // Fazla yaklaştı: geri çekil
                    dx = (this.x - player.x) / dist;
                    dy = (this.y - player.y) / dist;
                } else {
                    // Menzilde: hafif yana kayarak pozisyon tut
                    this.strafePhase += 0.03;
                    const px = -(player.y - this.y) / dist;
                    const py = (player.x - this.x) / dist;
                    dx = px * Math.sin(this.strafePhase) * 0.5;
                    dy = py * Math.sin(this.strafePhase) * 0.5;
                }
            } else {
                // Görüş yok ya da uzak: akış alanını izleyerek labirentte kovala
                const step = this.world.flowStepFrom(this.x, this.y);
                dx = step.x;
                dy = step.y;
            }

            if (player.x < this.x) this.facing = -1;
            if (player.x > this.x) this.facing = 1;
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
            if (dx < 0) this.facing = -1;
            if (dx > 0) this.facing = 1;
        }

        const hw = this.size * 0.28;
        const hh = this.size * 0.18;
        const nx = this.x + dx * this.speed;
        if (this.world.canBoxMoveTo(nx, this.y, hw, hh)) this.x = nx;
        const ny = this.y + dy * this.speed;
        if (this.world.canBoxMoveTo(this.x, ny, hw, hh)) this.y = ny;
    }

    fireAt(player) {
        const atk = this.attack;
        const base = Math.atan2(player.y - this.y, player.x - this.x);
        const count = atk.spread || 1;

        for (let i = 0; i < count; i++) {
            const a = base + (i - (count - 1) / 2) * 0.22;
            this.world.spawnEnemyProjectile({
                x: this.x,
                y: this.y,
                vx: Math.cos(a) * atk.speed,
                vy: Math.sin(a) * atk.speed,
                type: atk.type,
                damage: atk.damage,
                life: 90
            });
        }
    }

    takeDamage(amount) {
        if (this.fainted) return;

        this.wakeUp(); // vurulan boss uyanır
        this.hp -= amount;
        this.hitFlash = 12;
        this.aggro = true; // vurulunca uyanır
        this.world.spawnMapText(this.x, this.y - this.size / 2, `-${Math.ceil(amount)}`, '#f87171');

        if (this.hp <= 0) {
            this.hp = 0;
            this.fainted = true;
            this.windup = 0;
            this.world.spawnMapText(this.x, this.y - this.size / 2 - 14, 'BAYILDI!', '#fbbf24');
        }
    }

    draw(ctx) {
        if (!this.img.complete || this.img.naturalWidth === 0) return;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (this.fainted) {
            ctx.globalAlpha = 0.5;
        } else if (this.hitFlash > 0 && this.hitFlash % 4 < 2) {
            ctx.globalAlpha = 0.3;
        }

        const bob = (!this.fainted && this.stunTimer === 0) ? Math.sin(Date.now() / (this.asleep ? 700 : 300) + this.x) * 2 : 0;
        // Saldırı hazırlığında hafif titreme
        const shake = this.windup > 0 ? (Math.random() - 0.5) * 3 : 0;
        ctx.translate(this.x + shake, this.y + bob);
        if (this.facing === 1) ctx.scale(-1, 1);
        ctx.drawImage(this.img, -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();

        // Bayılınca başının üstünde dönen sersemlik yıldızları
        if (this.fainted) {
            ctx.save();
            const t = Date.now() / 250;
            ctx.fillStyle = '#fde047';
            for (let i = 0; i < 3; i++) {
                const a = t + (i / 3) * Math.PI * 2;
                const sx = this.x + Math.cos(a) * 16;
                const sy = this.y - this.size / 2 + Math.sin(a) * 5;
                ctx.fillRect(sx - 2, sy - 2, 4, 4);
                ctx.fillRect(sx - 1, sy - 4, 2, 8);
                ctx.fillRect(sx - 4, sy - 1, 8, 2);
            }
            ctx.restore();
        }

        // Saldırı hazırlığı uyarısı
        if (this.windup > 0) {
            ctx.save();
            ctx.font = "bold 18px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('!', this.x, this.y - this.size / 2 - 8);
            ctx.fillStyle = '#f87171';
            ctx.fillText('!', this.x, this.y - this.size / 2 - 8);
            ctx.restore();
        }

        // Uyuyan boss: yükselen "Z" baloncukları
        if (this.asleep) {
            ctx.save();
            ctx.font = "bold 20px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            for (let i = 0; i < 3; i++) {
                const t = ((Date.now() / 1200) + i / 3) % 1;
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = '#93c5fd';
                ctx.fillText('Z', this.x + 22 + t * 18, this.y - this.size / 2 - t * 34);
            }
            ctx.restore();
        }

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
            const label = this.asleep ? `${this.name} uyuyor...` : `BOSS ${this.name}`;
            ctx.strokeText(label, this.x, this.y - this.size / 2 - 18);
            ctx.fillStyle = this.asleep ? '#93c5fd' : '#f97316';
            ctx.fillText(label, this.x, this.y - this.size / 2 - 18);
            ctx.restore();
        }
    }
}
