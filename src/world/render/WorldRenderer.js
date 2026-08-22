import { TILE_SIZE } from '../../config/worldMap.js';
import { unlockedMoves } from '../../config/fieldMoves.js';
import { PROJECTILE_SPRITES, drawPixelSprite } from '../../game/projectileSprites.js';
import { drawTrainer } from '../trainerSprite.js';

// Dünya ve arayüz çizimi: portallar, tüccar, oyuncu, mermiler, efektler ve HUD.
// Overworld prototipine karıştırılır (applyMixins) - bu yüzden 'this' Overworld örneğidir.
export const WorldRenderer = {
    drawDebris() {
        const { ctx } = this;
        ctx.save();
        for (const d of this.debris) {
            ctx.globalAlpha = Math.min(1, d.life / 25);
            ctx.fillStyle = d.color;
            ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
        }
        ctx.restore();
    },

    // Atmosfer: yavaşça süzülen, parlaklığı nefes alan ateşböcekleri
    drawFireflies() {
        if (!this.fireflies.length) return;
        const { ctx } = this;
        const mapW = this.currentMap.grid[0].length * TILE_SIZE;
        const mapH = this.currentMap.grid.length * TILE_SIZE;
        const t = Date.now() / 1000;

        ctx.save();
        for (const fly of this.fireflies) {
            fly.angle += (Math.random() - 0.5) * 0.15;
            fly.x += Math.cos(fly.angle) * 0.4;
            fly.y += Math.sin(fly.angle) * 0.4;
            if (fly.x < 0) fly.x = mapW;
            if (fly.x > mapW) fly.x = 0;
            if (fly.y < 0) fly.y = mapH;
            if (fly.y > mapH) fly.y = 0;

            const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + fly.phase));
            const shadowy = this.currentMap.ambience === 'shadow';
            ctx.globalAlpha = pulse * (shadowy ? 0.7 : 0.9);
            ctx.shadowBlur = 8;
            ctx.shadowColor = shadowy ? '#818cf8' : '#bef264';
            ctx.fillStyle = shadowy ? '#c7d2fe' : '#d9f99d';
            ctx.fillRect(fly.x - 1, fly.y - 1, 2, 2);
        }
        ctx.restore();
    },

    drawPortals() {
        const { ctx } = this;
        const t = Date.now() / 100;

        for (const portal of this.portals) {
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE + TILE_SIZE / 2;
            const [main, light, bright] = portal.colors;

            ctx.save();
            if (!portal.target) ctx.globalAlpha = 0.6; // pasif portal soluk görünür
            ctx.shadowBlur = 14;
            ctx.shadowColor = main;

            // Dönen ince piksel halka (iç içe iki tur)
            const n = 22;
            for (let i = 0; i < n; i++) {
                const a = t * 0.2 + (i / n) * Math.PI * 2;
                const r = 20 + Math.sin(t * 0.5 + i) * 2;
                ctx.fillStyle = i % 3 === 0 ? bright : (i % 3 === 1 ? light : main);
                ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r * 0.7 - 1.5, 3, 3);
            }

            // Merkez girdap
            for (let i = 0; i < 8; i++) {
                const a = -t * 0.4 + (i / 8) * Math.PI * 2;
                const r = 5 + (i % 3) * 2;
                ctx.fillStyle = i % 2 === 0 ? light : bright;
                ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r * 0.7 - 1.5, 3, 3);
            }
            ctx.fillStyle = bright;
            ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);

            ctx.restore();
        }
    },

    drawPortalLabels() {
        const { ctx } = this;
        ctx.save();
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const portal of this.portals) {
            const cx = portal.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = portal.row * TILE_SIZE - 8;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(portal.label, cx, cy);
            ctx.fillStyle = portal.colors[1];
            ctx.fillText(portal.label, cx, cy);
        }

        ctx.restore();
    },

    // Tüccar tezgahı: ahşap tezgah + kırmızı-beyaz tente; Kecleon arkasında durur
    drawShops() {
        const { ctx } = this;

        for (const shop of this.shops) {
            const x0 = shop.col * TILE_SIZE;
            const y0 = shop.row * TILE_SIZE;
            const cx = x0 + TILE_SIZE / 2;

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            // Tüccar (tezgahın arkasında, hafifçe sallanır)
            if (this.merchantReady) {
                const bob = Math.sin(Date.now() / 400) * 2;
                ctx.drawImage(this.merchantImg, cx - 26, y0 - 28 + bob, 52, 52);
            }

            // Ahşap tezgah (ince tahta damarlarıyla)
            ctx.fillStyle = '#78350f';
            ctx.fillRect(x0 + 2, y0 + 18, TILE_SIZE - 4, 28);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x0 + 2, y0 + 18, TILE_SIZE - 4, 3);
            ctx.fillStyle = '#a16207';
            for (let i = 0; i < 5; i++) {
                ctx.fillRect(x0 + 4 + i * 9, y0 + 24 + (i % 2) * 6, 6, 2);
            }
            ctx.fillStyle = '#451a03';
            for (let i = 0; i < 6; i++) {
                ctx.fillRect(x0 + 5 + i * 7, y0 + 30, 2, 14);
            }

            // Tente direkleri
            ctx.fillStyle = '#451a03';
            ctx.fillRect(x0 + 1, y0 - 34, 3, 52);
            ctx.fillRect(x0 + TILE_SIZE - 4, y0 - 34, 3, 52);

            // Kırmızı-beyaz şeritli tente (ince şeritler + fırfırlı etek)
            for (let i = 0; i < 9; i++) {
                ctx.fillStyle = i % 2 === 0 ? '#dc2626' : '#f8fafc';
                ctx.fillRect(x0 - 2 + i * 6, y0 - 44, 6, 9);
                ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#e2e8f0';
                ctx.fillRect(x0 - 2 + i * 6, y0 - 35, 6, 3);
                // Fırfır uçları
                ctx.fillRect(x0 - 2 + i * 6 + 1, y0 - 32, 4, 2);
            }

            ctx.restore();
        }
    },

    drawShopLabels() {
        const { ctx } = this;
        ctx.save();
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const shop of this.shops) {
            const cx = shop.col * TILE_SIZE + TILE_SIZE / 2;
            const cy = shop.row * TILE_SIZE - 52;

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(this.merchantLabel, cx, cy);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(this.merchantLabel, cx, cy);
        }

        ctx.restore();
    },

    // Antrenör (elle çizilmiş piksel sprite; vurulmaz)
    drawPlayer() {
        const { ctx, player } = this;

        // Gölge
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.fillRect(player.x - 11, player.y + 22, 22, 4);
        ctx.restore();

        drawTrainer(ctx, player.x, player.y, player.dir, player.moving, 3);
    },

    // Sahaya sürülen Pokemonun havada dönen topu
    drawDeployBall() {
        const ball = this.deployBall;
        if (!ball) return;
        const { ctx } = this;

        const t = ball.frame / 18;
        const x = ball.fromX + (ball.toX - ball.fromX) * t;
        const y = ball.fromY + (ball.toY - ball.fromY) * t - Math.sin(t * Math.PI) * 46;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(x, y);
        ctx.rotate(ball.frame * 0.45);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-6, -6, 12, 6);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-6, 0, 12, 6);
        ctx.fillStyle = '#111827';
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
    },

    // Önündeki engel saha hamlesiyle aşılabiliyorsa (ya da tezgahtaysa) ipucu göster
    drawFieldHint() {
        const { ctx } = this;

        // Tüccarın önünde: alışveriş ipucu
        if (this.nearShop()) {
            const bob = Math.sin(Date.now() / 250) * 2;
            ctx.save();
            ctx.font = "bold 13px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('F: Alışveriş', this.player.x, this.player.y - 34 + bob);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText('F: Alışveriş', this.player.x, this.player.y - 34 + bob);
            ctx.restore();
            return;
        }

        const target = this.nearbyFieldTarget();
        if (!target) return;

        const x = target.col * TILE_SIZE + TILE_SIZE / 2;
        const y = target.row * TILE_SIZE + TILE_SIZE / 2;
        const bob = Math.sin(Date.now() / 250) * 2;

        ctx.save();
        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        const text = target.locked ? `${target.move.name} gerekli` : target.move.hint;
        ctx.strokeText(text, x, y - TILE_SIZE / 2 - 6 + bob);
        ctx.fillStyle = target.locked ? '#94a3b8' : target.move.color;
        ctx.fillText(text, x, y - TILE_SIZE / 2 - 6 + bob);
        ctx.restore();
    },

    drawTokenDrops() {
        const { ctx } = this;
        const t = Date.now() / 200;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const token of this.tokenDrops) {
            const bob = Math.sin(t + token.phase) * 3;
            const x = token.x, y = token.y + bob;

            ctx.globalAlpha = token.life < 120 ? token.life / 120 : 1;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fbbf24';
            // Altın jeton: dış halka, iç dolgu ve parlama
            ctx.fillStyle = '#b45309';
            ctx.fillRect(x - 6, y - 6, 12, 12);
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(x - 4, y - 6, 8, 12);
            ctx.fillRect(x - 6, y - 4, 12, 8);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(x - 2, y - 4, 3, 3);
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x - 1, y - 2, 3, 5);
        }
        ctx.restore();
    },

    drawProjectiles() {
        const { ctx } = this;
        for (const p of [...this.projectiles, ...this.enemyProjectiles]) {
            const def = PROJECTILE_SPRITES[p.type];
            if (def) {
                const opts = {};
                if (def.spin) opts.angle = (Date.now() / 1000) * def.spin;
                else if (def.directional && p.vx < 0) opts.flip = true;
                drawPixelSprite(ctx, def, p.x, p.y, opts);
            }
        }
    },

    // Alan etkileri: genişleyen piksel halkası (uyku sporu, taç yaprağı, şifa)
    drawSpores() {
        const { ctx } = this;
        const palettes = {
            sleep: ['#ddd6fe', '#a78bfa', '#c4b5fd'],
            petal: ['#fce7f3', '#f472b6', '#db2777'],
            heal: ['#dcfce7', '#4ade80', '#86efac']
        };

        for (const s of this.spores) {
            const colors = palettes[s.color] || palettes.sleep;
            ctx.save();
            ctx.globalAlpha = Math.max(0, s.life / 30) * 0.8;
            const n = 34;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + s.r * 0.02;
                ctx.fillStyle = colors[i % 3];
                ctx.fillRect(s.x + Math.cos(a) * s.r - 1.5, s.y + Math.sin(a) * s.r - 1.5, 3, 3);
            }
            ctx.restore();
        }
    },

    drawBallAnim() {
        if (!this.ballAnim) return;
        const { ctx } = this;
        const ball = this.ballAnim;

        // Uçuş: oyuncudan hedefe (ilk 15 kare), sonra hedefte sallanma
        let bx, by, tilt = 0;
        if (ball.frame < 15) {
            const t = ball.frame / 15;
            bx = ball.fromX + (ball.enemy.x - ball.fromX) * t;
            by = ball.fromY + (ball.enemy.y - ball.fromY) * t - Math.sin(t * Math.PI) * 40;
        } else {
            bx = ball.enemy.x;
            by = ball.enemy.y;
            tilt = Math.sin((ball.frame - 15) / 4) * 0.35; // sallanma
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(bx, by);
        ctx.rotate(tilt);
        // Pokeball: 16x16'lık ince piksel deseni (P kırmızı, w beyaz, k siyah)
        const BALL = [
            '....kkkkkk....',
            '..kkPPPPPPkk..',
            '.kPPPPPPPPPPk.',
            '.kPPwPPPPPPPk.',
            'kPPwPPPPPPPPPk',
            'kPPPPPPPPPPPPk',
            'kkkkkkkkkkkkkk',
            'kkkwwwwwwwwkkk',
            'kwwwkkkkkkwwwk',
            'kwwwkwwwwkwwwk',
            '.kwwkwwwwkwwk.',
            '.kwwwkkkkwwwk.',
            '..kkwwwwwwkk..',
            '....kkkkkk....'
        ];
        const BP = 1.5; // piksel boyutu
        const ballColors = { k: '#111827', P: '#dc2626', w: '#f8fafc' };
        for (let r = 0; r < BALL.length; r++) {
            for (let c = 0; c < BALL[r].length; c++) {
                const color = ballColors[BALL[r][c]];
                if (!color) continue;
                ctx.fillStyle = color;
                ctx.fillRect(-BALL[r].length * BP / 2 + c * BP, -BALL.length * BP / 2 + r * BP, BP, BP);
            }
        }
        ctx.restore();
    },

    // Bayılmış ve menzildeki Pokemonların üstünde yakalama ipucu
    drawCatchHints() {
        const { ctx, player } = this;
        ctx.save();
        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const enemy of this.enemies) {
            if (!enemy.fainted) continue;
            if (this.ballAnim && this.ballAnim.enemy === enemy) continue;
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist > 110) continue;

            const bob = Math.sin(Date.now() / 250) * 3;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText('N: Yakala!', enemy.x, enemy.y - enemy.size / 2 - 8 + bob);
            ctx.fillStyle = '#4ade80';
            ctx.fillText('N: Yakala!', enemy.x, enemy.y - enemy.size / 2 - 8 + bob);
        }

        ctx.restore();
    },

    drawMapTexts() {
        const { ctx } = this;
        ctx.save();
        ctx.font = "bold 15px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'center';

        for (const t of this.mapTexts) {
            ctx.globalAlpha = Math.min(1, t.life / 30);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
        }

        ctx.restore();
    },

    // Ekran sabiti arayüz: can barı, yetenek kutuları, yakalanan sayısı
    drawHud() {
        const { ctx, canvas, player } = this;
        ctx.save();

        const { progress, active } = this;

        // Sahadaki Pokemon paneli (sol üst)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(12, 12, 232, 42);

        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.textAlign = 'left';
        ctx.fillStyle = active ? '#f8fafc' : '#facc15';
        ctx.fillText(active ? active.name : '1-6: Poke top fırlat', 18, 26);
        if (active) {
            ctx.fillStyle = '#facc15';
            ctx.fillText(`Sv. ${active.level}`, 150, 26);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(active.types.join('/'), 186, 26);

            // Can barı
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(18, 32, 160, 10);
            ctx.fillStyle = active.hp / active.maxHp > 0.3 ? '#22c55e' : '#ef4444';
            ctx.fillRect(18, 32, 160 * Math.max(0, active.hp / active.maxHp), 10);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(`${Math.max(0, Math.ceil(active.hp))}/${active.maxHp}`, 238, 41);
        }

        // Ekip göstergesi (sol üst, panelin altında): 1-6 tuşlarıyla değişir
        ctx.textAlign = 'center';
        this.partyPokemon.forEach((pokemon, i) => {
            const x = 14 + i * 38;
            const y = 60;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(x, y, 34, 26);
            ctx.strokeStyle = pokemon === active ? '#4ade80' : (pokemon.fainted ? '#7f1d1d' : '#475569');
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 34, 26);

            ctx.font = "bold 11px 'Space Grotesk', sans-serif";
            ctx.fillStyle = pokemon.fainted ? '#7f1d1d' : '#f8fafc';
            ctx.fillText(String(i + 1), x + 9, y + 17);

            // Küçük can çubuğu
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(x + 16, y + 10, 14, 5);
            ctx.fillStyle = pokemon.fainted ? '#7f1d1d' : '#22c55e';
            ctx.fillRect(x + 16, y + 10, 14 * Math.max(0, pokemon.hp / pokemon.maxHp), 5);
        });

        // Jeton ve koleksiyon (sağ üst)
        ctx.textAlign = 'right';
        ctx.font = "bold 12px 'Space Grotesk', sans-serif";
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(canvas.width - 190, 12, 178, 44);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${progress.tokens} jeton`, canvas.width - 20, 30);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${progress.collection.length} yakalanan · E: kütüphane`, canvas.width - 20, 47);

        // Poke Ball sayacı (tükenince Kecleon'dan alınır)
        const balls = progress.itemCount('poke-ball');
        ctx.fillStyle = balls > 0 ? '#f8fafc' : '#f87171';
        ctx.fillText(`${balls}x`, canvas.width - 158, 30);
        ctx.save();
        ctx.translate(canvas.width - 176, 26);
        ctx.fillStyle = balls > 0 ? '#dc2626' : '#7f1d1d';
        ctx.fillRect(-6, -6, 12, 6);
        ctx.fillStyle = balls > 0 ? '#f8fafc' : '#475569';
        ctx.fillRect(-6, 0, 12, 6);
        ctx.fillStyle = '#111827';
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.restore();

        // Kazanılan saha hamleleri (rozetler)
        const moves = unlockedMoves(progress.badges);
        if (moves.length) {
            ctx.textAlign = 'right';
            ctx.font = "bold 11px 'Space Grotesk', sans-serif";
            moves.forEach((move, i) => {
                const x = canvas.width - 20 - i * 92;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(x - 82, 62, 84, 22);
                ctx.fillStyle = move.color;
                ctx.fillText(move.name, x - 8, 77);
                // Rozet noktası
                ctx.fillRect(x - 76, 69, 8, 8);
            });
        }

        // Yetenek kutuları (sol alt)
        const boxY = canvas.height - 58;
        this.abilities.forEach((ability, i) => {
            const boxX = 12 + i * 52;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(boxX, boxY, 44, 44);

            // Cooldown dolgusu (yukarıdan aşağı iner)
            const cd = active ? active.cooldowns[i] : 0;
            if (cd > 0) {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
                ctx.fillRect(boxX, boxY, 44, 44 * (cd / ability.cooldown));
            }

            ctx.strokeStyle = cd > 0 ? '#475569' : '#4ade80';
            ctx.lineWidth = 2;
            ctx.strokeRect(boxX, boxY, 44, 44);

            ctx.textAlign = 'center';
            ctx.font = "bold 18px 'Space Grotesk', sans-serif";
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(ability.key, boxX + 22, boxY + 26);
            ctx.font = "9px 'Space Grotesk', sans-serif";
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(ability.name, boxX + 22, boxY + 39);
        });

        ctx.restore();
    }
};
