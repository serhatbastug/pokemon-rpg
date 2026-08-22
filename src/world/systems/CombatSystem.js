import { preloadTypes, effectiveness, effectivenessLabel } from '../../services/typeChart.js';
import { AIM, CATCH, DEPLOY, TOKENS, TRAINER, HIT_STOP } from '../../config/balance.js';
import { Sfx } from '../../services/audio.js';

// Harita savaşı: yetenek kullanımı, mermiler, hasar ve tip etkililiği,
// yakalama ve yetenek jetonları.
// Overworld prototipine karıştırılır (applyMixins) - bu yüzden 'this' Overworld örneğidir.
export const CombatSystem = {
    // Sahadaki Pokemona en yakın ayakta düşman (menzil içinde)
    nearestEnemy(x, y, range) {
        let best = null;
        let bestDist = range;
        for (const enemy of this.enemies) {
            if (enemy.fainted || enemy.asleep) continue;
            const dist = Math.hypot(enemy.x - x, enemy.y - y);
            if (dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }
        return best;
    },

    spawnEnemyProjectile(projectile) {
        this.enemyProjectiles.push(projectile);
    },

    updateCombat() {
        if (this.swapCooldown > 0) this.swapCooldown--;

        this.updateDeployBall();

        // Sahadaki Pokemon durduğu yeri tutar (antrenörü takip etmez)
        if (this.active) {
            this.active.hold();
            this.active.update();

            // Tasma: antrenör çok uzaklaşırsa Pokemon topuna döner
            if (Math.hypot(this.player.x - this.active.x, this.player.y - this.active.y) > DEPLOY.leashRange) {
                this.recallActive('topuna döndü');
            }
        }

        this.collectTokens();
        this.computeFlowField();
        for (const enemy of this.enemies) enemy.update();

        // Düşman mermileri: hareket, duvar ve oyuncu çarpışması
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0 || !this.isWalkable(p.x, p.y)) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Mermiler hem sahadaki Pokemona hem antrenöre isabet edebilir:
            // antrenör de hasar alır, kaçınmak oyuncunun işidir
            const pokemon = this.active;
            if (pokemon && !pokemon.fainted && Math.hypot(p.x - pokemon.x, p.y - pokemon.y) < 26) {
                this.damageActive(p.damage, p, p.moveType);
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            const trainer = this.player;
            if (!this.trainerInvulnerable &&
                Math.hypot(p.x - trainer.x, p.y - (trainer.y - this.trainerLift)) < TRAINER.hitRadius) {
                this.damageTrainer(p.damage, p.moveType);
                this.enemyProjectiles.splice(i, 1);
            }
        }

        // Mermiler: hareket, duvar ve düşman çarpışması
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            // Duvar delen hamleler engellerde durmaz
            if (p.life <= 0 || (!p.pierce && !this.isWalkable(p.x, p.y))) {
                this.projectiles.splice(i, 1);
                continue;
            }

            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < enemy.size / 2 + 10) {
                    // Tip etkililiği: Pokemonların iyi ve kötü yönleri burada belirir
                    const mult = p.moveType ? effectiveness(p.moveType, enemy.types) : 1;
                    const damage = p.damage * mult;
                    const label = effectivenessLabel(mult);
                    if (label) this.spawnMapText(enemy.x, enemy.y - 66, label.text, label.color);
                    if (mult >= 2) Sfx.superEffective();
                    else if (mult > 0 && mult < 1) Sfx.weak();
                    else if (mult > 0) Sfx.hit();

                    if (mult > 0) {
                        enemy.takeDamage(damage);
                        this.tryApplyStatus(enemy, p.moveType);
                        if (damage >= HIT_STOP.threshold) this.hitStop = HIT_STOP.frames;
                    }

                    // Leech Seed: verilen hasarın bir kısmı sahadaki Pokemonun canına döner
                    if (p.leech && this.active && mult > 0) {
                        const healed = Math.round(damage * p.leech);
                        this.active.heal(healed);
                        this.spawnMapText(this.active.x, this.active.y - 50, `+${healed}`, '#4ade80');
                    }

                    this.projectiles.splice(i, 1);
                    break;
                }
            }
        }

        // Sleep Powder sporları
        for (let i = this.spores.length - 1; i >= 0; i--) {
            const s = this.spores[i];
            s.r += 5;
            s.life--;
            if (s.life <= 0) this.spores.splice(i, 1);
        }

        // Pokeball animasyonu: uçuş -> sallanmalar -> sonuç
        if (this.ballAnim) {
            const ball = this.ballAnim;
            ball.frame++;

            if (ball.frame === CATCH.flightFrames) {
                // Topa girdi: sallanma başlar
                ball.x = ball.enemy.x;
                ball.y = ball.enemy.y;
                Sfx.ballWobble();
            }

            // Her sallanmada bir "acaba?" anı
            const wobbleStart = CATCH.flightFrames;
            const wobbleTotal = CATCH.wobbleFrames * CATCH.wobbles;
            if (ball.frame > wobbleStart && (ball.frame - wobbleStart) % CATCH.wobbleFrames === 0) {
                const wobbleIndex = (ball.frame - wobbleStart) / CATCH.wobbleFrames;
                if (wobbleIndex < CATCH.wobbles) Sfx.ballWobble();
            }

            if (ball.frame >= wobbleStart + wobbleTotal) {
                const caught = ball.enemy;
                this.ballAnim = null;

                if (ball.success) {
                    const joinedParty = this.progress.addCapture(caught.id, caught.name);
                    this.progress.markSeen(caught.id, caught.name, true);
                    this.spawnMapText(caught.x, caught.y - 30, `${caught.name} yakalandı!`, '#4ade80');
                    Sfx.catchSuccess();
                    if (!joinedParty) {
                        this.spawnMapText(caught.x, caught.y - 54, 'Ekip dolu - kütüphaneye gönderildi', '#94a3b8');
                    } else {
                        // Yeni üye ekibe katıldı: sahaya hazırlansın
                        this.buildMember(this.progress.party[this.progress.party.length - 1])
                            .then(pokemon => {
                                this.partyPokemon.push(pokemon);
                                preloadTypes(pokemon.types);
                            })
                            .catch(error => console.error('Yeni ekip üyesi hazırlanamadı:', error));
                    }
                    this.enemies = this.enemies.filter(e => e !== caught);
                } else {
                    // Kurtuldu: Pokemon topu kırıp ayağa kalkar
                    caught.fainted = false;
                    caught.hp = Math.max(1, Math.round(caught.maxHp * 0.25));
                    caught.aggro = true;
                    this.spawnMapText(caught.x, caught.y - 40, 'Kurtuldu!', '#f87171');
                    Sfx.catchFail();
                }
            }
        }

        // Boss uyanışı enkazı ve ekran sarsıntısı
        if (this.shake > 0) this.shake *= 0.9;
        if (this.shake < 0.3) this.shake = 0;
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += d.gravity;
            d.x += d.vx;
            d.y += d.vy;
            d.life--;
            if (d.life <= 0) this.debris.splice(i, 1);
        }

        // Uçan yazılar
        for (let i = this.mapTexts.length - 1; i >= 0; i--) {
            const t = this.mapTexts[i];
            t.y -= 0.8;
            t.life--;
            if (t.life <= 0) this.mapTexts.splice(i, 1);
        }
    },

    castAbility(index, autoTarget = null) {
        const caster = this.active;
        if (!caster || caster.fainted) return;

        // Yetenekler sahadaki Pokemonun konumundan çıkar
        const player = { x: caster.x, y: caster.y, aim: this.player.aim, facing: caster.facing };
        const ability = caster.abilities[index];
        if (!ability || caster.cooldowns[index] > 0) return;

        if (ability.kind === 'aoe' && ability.type === 'sleep') {
            // Sleep Powder: çevredeki düşmanları uyutur
            let hit = 0;
            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < ability.radius) {
                    enemy.stunTimer = ability.stun;
                    hit++;
                }
            }
            this.spores.push({ x: player.x, y: player.y, r: 20, life: 30, color: 'sleep' });
            if (hit > 0) this.spawnMapText(player.x, player.y - 50, `${hit} Pokemon uyudu!`, '#a78bfa');
        } else if (ability.kind === 'aoe') {
            // Petal Blizzard: çevredeki herkese alan hasarı
            const damage = ability.damage * caster.damageMultiplier * caster.damageBoost;
            let hit = 0;
            for (const enemy of this.enemies) {
                if (enemy.fainted) continue;
                if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < ability.radius) {
                    enemy.takeDamage(damage);
                    hit++;
                }
            }
            this.spores.push({ x: player.x, y: player.y, r: 20, life: 34, color: 'petal' });
            this.spawnMapText(player.x, player.y - 50, ability.name.toUpperCase() + '!', '#f472b6');
            if (hit === 0) this.spawnMapText(player.x, player.y - 74, 'Isabet yok', '#94a3b8');
        } else if (ability.kind === 'heal') {
            // Jungle Healing: canın bir kısmını yeniler
            const healed = Math.round(caster.maxHp * ability.heal);
            caster.heal(healed);
            this.spores.push({ x: player.x, y: player.y, r: 14, life: 30, color: 'heal' });
            this.spawnMapText(player.x, player.y - 50, `+${healed} CAN`, '#4ade80');
        } else if (ability.kind === 'dash') {
            // First Impression: ileri atılıp yol üstündekileri biçer
            const aim = this.aimVector();
            const damage = ability.damage * caster.damageMultiplier * caster.damageBoost;
            const steps = 14;
            let hit = false;

            // Antrenör ve Pokemon birlikte atılır
            const trainer = this.player;
            for (let i = 1; i <= steps; i++) {
                const nx = trainer.x + aim.x * (ability.distance / steps);
                const ny = trainer.y + aim.y * (ability.distance / steps);
                if (!this.canMoveTo(nx, trainer.y)) break;
                trainer.x = nx;
                if (this.canMoveTo(trainer.x, ny)) trainer.y = ny;
                caster.x = trainer.x;
                caster.y = trainer.y;

                for (const enemy of this.enemies) {
                    if (enemy.fainted || enemy.dashHit) continue;
                    if (Math.hypot(enemy.x - caster.x, enemy.y - caster.y) < enemy.size / 2 + 30) {
                        enemy.dashHit = true;
                        const mult = ability.moveType ? effectiveness(ability.moveType, enemy.types) : 1;
                        if (mult > 0) enemy.takeDamage(damage * mult);
                        hit = true;
                    }
                }
            }
            for (const enemy of this.enemies) enemy.dashHit = false;

            caster.invuln = Math.max(caster.invuln, 25); // atılım sırasında kısa dokunulmazlık
            this.effectsTrail(caster.x, caster.y);
            this.spawnMapText(caster.x, caster.y - 50, hit ? `${ability.name.toUpperCase()}!` : ability.name, '#22d3ee');
        } else {
            // Nişan: en yakın ayakta düşmanın ATIŞ ANINDAKİ konumuna kilitlenir.
            // Duvar delen hamleler (Seed Bomb) hedefi duvar arkasında da seçer.
            const target = autoTarget || this.findAimTarget(ability.pierce);
            const aim = target
                ? this.normalize(target.x - player.x, target.y - player.y)
                : this.aimVector();

            const base = Math.atan2(aim.y, aim.x);
            const count = ability.spread || 1;
            for (let i = 0; i < count; i++) {
                const a = base + (i - (count - 1) / 2) * 0.2;
                this.projectiles.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(a) * ability.speed,
                    vy: Math.sin(a) * ability.speed,
                    type: ability.type,
                    moveType: ability.moveType,
                    damage: ability.damage * caster.damageMultiplier * caster.damageBoost,
                    life: ability.life,
                    pierce: !!ability.pierce,
                    leech: ability.leech || 0
                });
            }
        }

        this.shotsFired++;
        Sfx.shoot();

        // Uyuyan bossun yakınında ateş etmek onu uyandırır
        for (const enemy of this.enemies) {
            if (enemy.asleep && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 320) {
                enemy.wakeUp();
            }
        }

        caster.cooldowns[index] = ability.cooldown;
    },

    normalize(x, y) {
        const len = Math.hypot(x, y) || 1;
        return { x: x / len, y: y / len };
    },

    // Hedef yoksa son hareket yönü (dururken bakılan yön) kullanılır
    aimVector() {
        const { aim } = this.player;
        if (aim.x === 0 && aim.y === 0) return { x: this.player.facing, y: 0 };
        return this.normalize(aim.x, aim.y);
    },

    // Atılım izi: geçilen yol boyunca kısa ömürlü parçacıklar
    effectsTrail(x, y) {
        for (let i = 0; i < 12; i++) {
            this.debris.push({
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 2,
                size: 3 + Math.random() * 3,
                color: '#67e8f9',
                life: 18 + Math.random() * 10,
                gravity: 0.1
            });
        }
    },

    // Nişan için en yakın uygun düşman. pierce false ise görüş hattı şart.
    findAimTarget(pierce) {
        const { player } = this;
        let best = null;
        let bestDist = AIM.autoTargetRange;

        for (const enemy of this.enemies) {
            if (enemy.fainted) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist >= bestDist) continue;
            if (!pierce && !this.hasLineOfSight(player.x, player.y, enemy.x, enemy.y)) continue;
            bestDist = dist;
            best = enemy;
        }
        return best;
    },

    tryCatch() {
        if (this.ballAnim) return;

        // En yakın bayılmış Pokemonu bul (bosslar yakalanamaz, yenilir)
        let target = null;
        let best = CATCH.throwRange; // maksimum atış mesafesi
        for (const enemy of this.enemies) {
            if (!enemy.fainted || !enemy.isCatchable) continue;
            const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
            if (dist < best) {
                best = dist;
                target = enemy;
            }
        }

        if (!target) {
            this.spawnMapText(this.player.x, this.player.y - 50, 'Yakında bayılmış Pokemon yok', '#94a3b8');
            return;
        }

        // Poke Ball tükenen bir kaynaktır; Kecleon'dan satın alınır.
        // Elde birden fazla tür varsa en iyisi kullanılır.
        const ball = this.progress.bestBall();
        if (!ball || !this.progress.consumeItem(ball.id)) {
            this.spawnMapText(this.player.x, this.player.y - 50, 'Poke Ball kalmadı! (Tüccar)', '#f87171');
            Sfx.deny();
            return;
        }

        // Yakalama şansı: topun gücü x türün zorluğu.
        // Gizli Pokemonlar zor, bosslar hiç yakalanmaz.
        const kindModifier = CATCH.kindModifier[target.kind] ?? 1;
        const chance = Math.min(0.95, CATCH.baseRate * ball.catchRate * kindModifier);
        const success = Math.random() < chance;

        Sfx.ballThrow();
        this.spawnMapText(this.player.x, this.player.y - 60, ball.name, ball.color);

        this.ballAnim = {
            enemy: target,
            frame: 0,
            success,
            ballColor: ball.color,
            fromX: this.player.x,
            fromY: this.player.y - 20,
            x: this.player.x,
            y: this.player.y - 20
        };
    },

    // Hasar sahadaki Pokemona gider; tip etkililiği burada uygulanır
    damageActive(amount, from, moveType) {
        const target = this.active;
        if (!target || target.fainted || target.invuln > 0) return;

        let final = amount;
        if (moveType) {
            const mult = effectiveness(moveType, target.types);
            final = amount * mult;
            const label = effectivenessLabel(mult);
            if (label) this.spawnMapText(target.x, target.y - 70, label.text, label.color);
            if (mult === 0) return;
        }

        target.takeDamage(final);
        this.spawnMapText(target.x, target.y - 46, `-${Math.ceil(final)}`, '#ff4444');
        this.tryApplyStatus(target, moveType);
        Sfx.playerHurt();
        if (final >= HIT_STOP.threshold) this.hitStop = HIT_STOP.frames;
    },

    // Eski çağrılar için: düşman teması da sahadaki Pokemona işler
    // Düşman teması: yakınındakine (Pokemon ya da antrenör) vurur
    damagePlayer(amount, from) {
        const pokemon = this.active;
        const moveType = from?.attack?.moveType;

        if (pokemon && !pokemon.fainted && from) {
            const toPokemon = Math.hypot(from.x - pokemon.x, from.y - pokemon.y);
            const toTrainer = Math.hypot(from.x - this.player.x, from.y - this.player.y);
            if (toPokemon <= toTrainer) {
                this.damageActive(amount, from, moveType);
                return;
            }
        }
        this.damageTrainer(TRAINER.contactDamage, moveType);
    },

    spawnMapText(x, y, text, color) {
        this.mapTexts.push({ x, y, text, color, life: 70 });
    },

    // Yenilen Pokemon yetenek jetonu düşürür (XP yok; seviyeyi oyuncu dağıtır)
    awardXp(enemy) {
        const amount = this.progress.tokensForEnemy(enemy.kind);
        this.spawnTokenDrop(enemy.x, enemy.y, amount);
    },

    // Yenilen düşmanlardan düşen yetenek jetonları
    spawnTokenDrop(x, y, amount) {
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 8 + Math.random() * 26;
            this.tokenDrops.push({
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                phase: Math.random() * Math.PI * 2,
                life: TOKENS.lifeFrames
            });
        }
    },

    // Antrenör jetonun üstünden geçince toplanır
    collectTokens() {
        const { player, progress } = this;
        let collected = 0;

        for (let i = this.tokenDrops.length - 1; i >= 0; i--) {
            const token = this.tokenDrops[i];
            token.life--;

            const dist = Math.hypot(token.x - player.x, token.y - player.y);
            // Yakındaki jetonlar antrenöre doğru çekilir
            if (dist < TOKENS.magnetRange) {
                token.x += (player.x - token.x) * TOKENS.magnetStrength;
                token.y += (player.y - token.y) * TOKENS.magnetStrength;
            }
            if (dist < TOKENS.pickupRange) {
                this.tokenDrops.splice(i, 1);
                collected++;
                continue;
            }
            if (token.life <= 0) this.tokenDrops.splice(i, 1);
        }

        if (collected > 0) {
            progress.addTokens(collected);
            Sfx.token();
            this.spawnMapText(player.x, player.y - 40, `+${collected} jeton`, '#fbbf24');
        }
    }
};
