import { TRAINER, DODGE, STATUS } from '../../config/balance.js';
import { TILE_SIZE } from '../../config/worldMap.js';
import { Sfx } from '../../services/audio.js';

// Antrenörün savaş tarafı: can, hasar, kaçınma hareketleri (zıplama ve atılım)
// ve durum etkileri. Saldırıyı Pokemon yapar, hayatta kalmak oyuncunun işidir.
// Overworld prototipine karıştırılır - bu yüzden 'this' Overworld örneğidir.
export const TrainerCombat = {
    // Antrenör şu an vurulamaz mı? (zıplama, atılım ve hasar sonrası)
    get trainerInvulnerable() {
        const p = this.player;
        if (p.invuln > 0) return true;
        if (p.dashFrames > 0 && p.dashFrames > DODGE.dashFrames - DODGE.dashInvuln) return true;
        if (p.jumpFrames > 0) {
            const elapsed = DODGE.jumpFrames - p.jumpFrames;
            return elapsed >= DODGE.jumpInvulnFrom && elapsed <= DODGE.jumpInvulnTo;
        }
        return false;
    },

    // Space: zıpla. Havadayken yerdeki mermiler altından geçer.
    jump() {
        const p = this.player;
        if (p.jumpFrames > 0 || p.jumpCooldown > 0 || p.dashFrames > 0) return;
        p.jumpFrames = DODGE.jumpFrames;
        p.jumpCooldown = DODGE.jumpFrames + DODGE.jumpCooldown;
        Sfx.jump();
    },

    // Shift: atılım. Kısa mesafe, tam dokunulmazlık, uzun bekleme.
    dash() {
        const p = this.player;
        if (p.dashFrames > 0 || p.dashCooldown > 0) return;

        const aim = this.aimVector();
        p.dashFrames = DODGE.dashFrames;
        p.dashCooldown = DODGE.dashFrames + DODGE.dashCooldown;
        p.dashDir = { x: aim.x, y: aim.y };
        this.effectsTrail(p.x, p.y);
        Sfx.dash();
    },

    // Her karede kaçınma durumlarını ilerletir
    updateDodge() {
        const p = this.player;
        if (p.jumpCooldown > 0) p.jumpCooldown--;
        if (p.dashCooldown > 0) p.dashCooldown--;
        if (p.invuln > 0) p.invuln--;

        if (p.jumpFrames > 0) {
            p.jumpFrames--;
            if (p.jumpFrames === 0) Sfx.land();
        }

        if (p.dashFrames > 0) {
            p.dashFrames--;
            const step = DODGE.dashSpeed;
            const nx = p.x + p.dashDir.x * step;
            const ny = p.y + p.dashDir.y * step;
            if (this.canMoveTo(nx, p.y)) p.x = nx;
            if (this.canMoveTo(p.x, ny)) p.y = ny;

            // Atılım izi
            if (p.dashFrames % 3 === 0) {
                this.debris.push({
                    x: p.x, y: p.y + 10,
                    vx: -p.dashDir.x * 1.5, vy: -p.dashDir.y * 1.5,
                    size: 3, color: '#93c5fd', life: 14, gravity: 0
                });
            }
        }
    },

    // Zıplama yüksekliği (çizim için)
    get trainerLift() {
        const p = this.player;
        if (p.jumpFrames <= 0) return 0;
        const t = 1 - p.jumpFrames / DODGE.jumpFrames;
        return Math.sin(t * Math.PI) * DODGE.jumpHeight;
    },

    damageTrainer(amount, moveType) {
        const p = this.player;
        if (this.trainerInvulnerable || amount <= 0) return;

        p.hp -= amount;
        p.invuln = TRAINER.hitInvuln;
        this.spawnMapText(p.x, p.y - 40, `-${Math.ceil(amount)}`, '#f87171');
        this.shake = Math.max(this.shake, 10);
        Sfx.playerHurt();

        // Saldırı tipine göre durum etkisi bulaşabilir
        this.tryApplyStatus(p, moveType);

        if (p.hp <= 0) {
            p.hp = 0;
            this.onTrainerDown();
        }
    },

    onTrainerDown() {
        const p = this.player;
        this.spawnMapText(p.x, p.y - 60, 'DAYANAMADIN!', '#ef4444');
        Sfx.faint();

        // Ekip ve antrenör toparlanır, mekan girişine dönülür
        setTimeout(() => {
            p.hp = p.maxHp;
            p.invuln = 120;
            p.status = null;
            for (const member of this.partyPokemon) {
                member.fainted = false;
                member.hp = member.maxHp;
                member.status = null;
            }
            this.recallActive(null);
            const start = this.currentMap.start;
            p.x = start.col * TILE_SIZE + TILE_SIZE / 2;
            p.y = start.row * TILE_SIZE + TILE_SIZE / 2;
            this.portalCooldown = 45;
            this.updateCamera(true);
        }, 800);
    },

    // --- Durum etkileri (zehir, yanma, felç) ---

    // Saldırı tipine göre ihtimalle durum bulaştırır
    tryApplyStatus(target, moveType) {
        if (!target || !moveType || target.status) return;

        let kind = null;
        if (moveType === 'poison' && Math.random() < STATUS.chance.poison) kind = 'poison';
        else if (moveType === 'fire' && Math.random() < STATUS.chance.fire) kind = 'burn';
        else if (moveType === 'electric' && Math.random() < STATUS.chance.electric) kind = 'paralysis';
        if (!kind) return;

        this.applyStatus(target, kind);
    },

    applyStatus(target, kind) {
        const config = STATUS[kind];
        if (!config || !target) return;

        target.status = { kind, frames: config.duration, tick: config.tickEvery || 0 };
        this.spawnMapText(target.x, target.y - 56, config.label + '!', config.color);
        Sfx.status();
    },

    // Durum etkilerini ilerletir (antrenör, sahadaki Pokemon ve düşmanlar)
    updateStatuses() {
        const targets = [this.player, this.active, ...this.enemies].filter(t => t && t.status);

        for (const target of targets) {
            const state = target.status;
            const config = STATUS[state.kind];
            state.frames--;

            if (config.damage) {
                state.tick--;
                if (state.tick <= 0) {
                    state.tick = config.tickEvery;
                    if (target === this.player) {
                        // Durum hasarı dokunulmazlıktan etkilenmez
                        this.player.hp -= config.damage;
                        this.spawnMapText(target.x, target.y - 40, `-${config.damage}`, config.color);
                        if (this.player.hp <= 0) { this.player.hp = 0; this.onTrainerDown(); }
                    } else if (typeof target.takeDamage === 'function') {
                        target.takeDamage(config.damage);
                    }
                }
            }

            if (state.frames <= 0) target.status = null;
        }
    },

    // Felç hız çarpanı
    statusSpeedFactor(target) {
        if (target?.status?.kind === 'paralysis') return 1 - STATUS.paralysis.slow;
        return 1;
    }
};
