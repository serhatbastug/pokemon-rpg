import { Projectile } from './Projectile.js';

// Sınıf bazlı yetenekler. Her sınıfın 3 yeteneği vardır (index 0, 1, 2).
// Yeni sınıf eklerken buraya bir case, characters.js'e bir kayıt eklemek yeterli.
export function castAbility(player, index, game) {
    const enemy = game.getEnemyOf(player);
    const { projectiles, effects, canvas } = game;

    switch (player.char.className) {
        case 'Şövalye':
            if (index === 0) { // Razor Leaf
                projectiles.push(new Projectile(player.x, player.y, player.dir * 10, 0, 10, 10, player.color, 'leaf', player.playerNum));
            } else if (index === 1) { // Seed Bomb (Ivysaur'un orijinal hamlesi)
                // Yerçekimiyle kavis çizen, zemine çarpınca patlayan tohum bombası
                projectiles.push(new Projectile(player.x, player.y - 20, player.dir * 7, -8, 12, 18, player.color, 'seedbomb', player.playerNum));
            } else if (index === 2) { // Solar Beam
                createSolarBeam(player, game);
            }
            break;

        case 'Büyücü':
            if (index === 0) { // Ember
                projectiles.push(new Projectile(player.x, player.y, player.dir * 9, (Math.random() - 0.5) * 2, 8, 12, player.color, 'ember', player.playerNum));
            } else if (index === 1) { // Dragon Dance
                player.speedMultiplier = 1.5;
                player.damageMultiplier = 1.5;
                effects.createPulse(player.x, player.y, '#eab308');
                setTimeout(() => {
                    player.speedMultiplier = 1.0;
                    player.damageMultiplier = 1.0;
                }, 4000);
            } else if (index === 2) { // Fire Blast
                projectiles.push(new Projectile(player.x, player.y, player.dir * 7, 0, 25, 30, player.color, 'fireblast', player.playerNum));
            }
            break;

        case 'Suikastçı':
            if (index === 0) { // Shadow Punch
                projectiles.push(new Projectile(player.x + player.dir * 40, player.y, player.dir * 2, 0, 15, 12, player.color, 'punch', player.playerNum, 15));
            } else if (index === 1) { // Hypnosis
                projectiles.push(new Projectile(player.x, player.y, player.dir * 4, 0, 12, 0, '#a855f7', 'hypnosis', player.playerNum, 120));
            } else if (index === 2) { // Dream Eater
                // Rakibin arkasına ışınlan
                const destX = enemy.x - enemy.dir * 60;
                effects.createPulse(player.x, player.y, player.color);
                player.x = Math.max(30, Math.min(canvas.width - 30, destX));
                player.dir = enemy.dir;
                effects.createPulse(player.x, player.y, player.color);

                // Anlık ağır vuruş + can çalma
                const damage = 25 * player.damageMultiplier;
                enemy.takeDamage(damage);
                player.hp = Math.min(player.maxHp, player.hp + damage * 0.5);
                effects.createExplosion(enemy.x, enemy.y, player.color);
            }
            break;

        case 'Okçu':
            if (index === 0) { // Air Slash
                projectiles.push(new Projectile(player.x, player.y, player.dir * 12, 0, 8, 12, player.color, 'wind', player.playerNum));
            } else if (index === 1) { // Acrobatics
                // Geriye sıçra
                player.x = Math.max(30, Math.min(canvas.width - 30, player.x - player.dir * 150));
                effects.createPulse(player.x, player.y, player.color);
                // Eski konuma rüzgar tuzağı bırak
                projectiles.push(new Projectile(player.x + player.dir * 150, player.y, 0, 0, 12, 5, player.color, 'trap', player.playerNum, 300));
            } else if (index === 2) { // Fury Cutter
                // Ardışık 5 rüzgar oku fırlat
                let count = 0;
                const fireInterval = setInterval(() => {
                    if (game.isGameOver) {
                        clearInterval(fireInterval);
                        return;
                    }
                    projectiles.push(new Projectile(player.x, player.y, player.dir * 14, (Math.random() - 0.5) * 3, 6, 8, player.color, 'wind', player.playerNum));
                    count++;
                    if (count >= 5) clearInterval(fireInterval);
                }, 100);
            }
            break;

        case 'Elementalist':
            if (index === 0) { // Thunder Shock
                projectiles.push(new Projectile(player.x, player.y, player.dir * 10, 0, 10, 14, player.color, 'lightning', player.playerNum));
            } else if (index === 1) { // Rain Dance
                effects.createPulse(player.x, player.y, '#3b82f6');
                projectiles.push(new Projectile(player.x, player.y, player.dir * 2, 0, 40, 8, player.color, 'storm', player.playerNum, 120));
            } else if (index === 2) { // Thunder
                // Rakibin konumuna yıldırım düşür
                createThunder(enemy.x, enemy.y, player.playerNum, game);
            }
            break;

        case 'Vampir':
            if (index === 0) { // Bite
                projectiles.push(new Projectile(player.x + player.dir * 40, player.y, player.dir * 2, 0, 12, 10, player.color, 'bite', player.playerNum, 15));
            } else if (index === 1) { // Toxic Fang
                projectiles.push(new Projectile(player.x, player.y, player.dir * 6, 0, 12, 5, '#10b981', 'poison', player.playerNum));
            } else if (index === 2) { // Leech Life
                // İleri atıl
                const oldX = player.x;
                player.x = Math.max(30, Math.min(canvas.width - 30, player.x + player.dir * 200));

                // Atılma yolu üzerinde çarpışma kontrolü
                if (Math.abs(player.y - enemy.y) < 60 && ((oldX < enemy.x && player.x > enemy.x) || (oldX > enemy.x && player.x < enemy.x))) {
                    enemy.takeDamage(20);
                    player.hp = Math.min(player.maxHp, player.hp + 20);
                    effects.createExplosion(enemy.x, enemy.y, player.color);
                }
            }
            break;

        case 'Mecha':
            if (index === 0) { // Signal Beam (Genesect'in orijinal hamlesi) - uzak menzilli ışın
                projectiles.push(new Projectile(player.x, player.y, player.dir * 13, 0, 9, 12, player.color, 'signalbeam', player.playerNum));
            } else if (index === 1) { // Magnet Bomb (Genesect'in orijinal hamlesi)
                // Rakibi takip eden manyetik bomba
                projectiles.push(new Projectile(player.x, player.y, player.dir * 5, 0, 11, 16, player.color, 'magnetbomb', player.playerNum, 180));
            } else if (index === 2) { // Techno Blast
                projectiles.push(new Projectile(player.x, player.y, player.dir * 15, 0, 45, 40, player.color, 'laser', player.playerNum));
            }
            break;

        case 'Ninja':
            if (index === 0) { // Slash
                projectiles.push(new Projectile(player.x + player.dir * 40, player.y, player.dir * 4, 0, 10, 10, player.color, 'slash', player.playerNum, 10));
            } else if (index === 1) { // X-Scissor (Ninjask'in orijinal hamlesi)
                // Hızla ilerleyen X biçimli enerji kesiği
                projectiles.push(new Projectile(player.x, player.y, player.dir * 12, 0, 13, 16, player.color, 'xscissor', player.playerNum));
            } else if (index === 2) { // Giga Impact
                // İleri atılıp ezme
                let count = 0;
                const rushInterval = setInterval(() => {
                    if (game.isGameOver) {
                        clearInterval(rushInterval);
                        return;
                    }
                    player.x = Math.max(30, Math.min(canvas.width - 30, player.x + player.dir * 40));
                    effects.createPulse(player.x, player.y, player.color);

                    // İsabet kontrolü
                    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
                    if (dist < 50) {
                        enemy.takeDamage(30);
                        effects.createExplosion(enemy.x, enemy.y, player.color);
                        clearInterval(rushInterval);
                    }

                    count++;
                    if (count >= 10) clearInterval(rushInterval);
                }, 30);
            }
            break;

        case 'Buz Şövalyesi':
            if (index === 0) { // Ice Shard
                projectiles.push(new Projectile(player.x, player.y, player.dir * 11, 0, 10, 11, player.color, 'ice', player.playerNum));
            } else if (index === 1) { // Hail
                // Oyuncunun çevresinde alan etkili kar fırtınası
                projectiles.push(new Projectile(player.x, player.y, 0, 0, 120, 2, player.color, 'blizzard', player.playerNum, 120));
            } else if (index === 2) { // Sheer Cold
                projectiles.push(new Projectile(player.x, player.y, player.dir * 9, 0, 20, 25, '#38bdf8', 'freeze', player.playerNum));
            }
            break;
    }
}

// Şövalye ulti: ekran boyunca hasar veren güneş ışını
function createSolarBeam(player, game) {
    const { effects, canvas } = game;
    const startX = player.x + player.dir * 30;
    const endX = player.dir === 1 ? canvas.width : 0;
    const beamY = player.y;
    const dir = player.dir;

    let frame = 0;
    const beamInterval = setInterval(() => {
        if (game.isGameOver) {
            clearInterval(beamInterval);
            return;
        }

        // Işın hattındaki rakibe tik hasarı
        const enemy = game.getEnemyOf(player);
        if (Math.abs(enemy.y - beamY) < 50) {
            if ((dir === 1 && enemy.x > startX) || (dir === -1 && enemy.x < startX)) {
                enemy.takeDamage(1.5);
            }
        }

        effects.pushParticle({
            x: startX + Math.random() * (endX - startX),
            y: beamY + (Math.random() - 0.5) * 40,
            vx: dir * 5,
            vy: 0,
            radius: Math.random() * 8 + 4,
            color: '#eab308',
            alpha: 0.8,
            life: 15
        });

        frame++;
        if (frame >= 40) clearInterval(beamInterval);
    }, 30);
}

// Elementalist ulti: hedefe yukarıdan inen yıldırım
function createThunder(tx, ty, owner, game) {
    const { effects } = game;
    let ly = 0;
    const enemy = owner === 1 ? game.p2 : game.p1;

    const lightningInterval = setInterval(() => {
        if (game.isGameOver) {
            clearInterval(lightningInterval);
            return;
        }

        effects.pushParticle({
            x: tx + (Math.random() - 0.5) * 20,
            y: ly,
            vx: 0, vy: 0,
            radius: 8,
            color: '#facc15',
            alpha: 1,
            life: 20
        });

        ly += 30;
        if (ly >= ty) {
            clearInterval(lightningInterval);
            effects.createExplosion(tx, ty, '#facc15');

            if (Math.hypot(enemy.x - tx, enemy.y - ty) < 70) {
                enemy.takeDamage(28);
            }
        }
    }, 15);
}
