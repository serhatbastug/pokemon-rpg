import { TILE_SIZE } from '../../config/worldMap.js';
import { FIELD_MOVES } from '../../config/fieldMoves.js';
import { drawTrainer } from '../trainerSprite.js';
import { preloadTypes } from '../../services/typeChart.js';
import { fetchCharacter, fetchEvolutionChain } from '../../services/pokeapi.js';
import { VICTORY } from '../../config/balance.js';
import { Sfx } from '../../services/audio.js';

// Sahneler: boss uyanışı ve arena yıkımı, zafer ekranı ve evrim sahnesi.
// Overworld prototipine karıştırılır (applyMixins) - bu yüzden 'this' Overworld örneğidir.
export const Scenes = {
    // Zafer sahnesi bitti: macera ana haritasına dön
    finishVictory() {
        this.victory = null;
        this.recallActive(null);
        this.loadMap('main');
    },

    // Boss yenildi: konfeti yağmuru, zıplayan Pokemon ve zafer yazısı
    drawVictory() {
        if (!this.victory) return;
        const { ctx, canvas } = this;
        const v = this.victory;
        v.frame++;

        ctx.save();
        ctx.fillStyle = 'rgba(5, 10, 8, 0.55)';
        ctx.fillRect(0, 0, this.viewW, this.viewH);

        // Konfeti
        for (const c of v.confetti) {
            c.y += c.vy;
            c.x += c.vx;
            if (c.y > this.viewH) c.y = -c.size;
            ctx.fillStyle = c.color;
            ctx.fillRect(c.x, c.y, c.size, c.size);
        }

        // Sevinç: karakter zıplayıp dönerek kutlama yapar
        const cx = this.viewW / 2;
        const cy = this.viewH / 2 + 30;
        const jump = Math.abs(Math.sin(v.frame / 14)) * 46;
        const tilt = Math.sin(v.frame / 9) * 0.28;
        // Sahadaki Pokemon ve antrenör birlikte kutlar
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.translate(cx, cy - jump);
        ctx.rotate(tilt);
        const winner = this.active?.img;
        if (winner && winner.complete && winner.naturalWidth > 0) {
            ctx.drawImage(winner, -60, -60, 120, 120);
        }
        ctx.restore();

        drawTrainer(ctx, cx - 120, cy - jump * 0.6 + 40, 'right', true, 5);

        // Zıplarken çevreye saçılan ışık pikselleri
        for (let i = 0; i < 8; i++) {
            const a = (v.frame / 20) + (i / 8) * Math.PI * 2;
            const r = 80 + Math.sin(v.frame / 12 + i) * 12;
            ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#4ade80';
            ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy - jump + Math.sin(a) * r * 0.6 - 1.5, 3, 3);
        }

        // Yazılar
        ctx.textAlign = 'center';
        ctx.font = "bold 46px 'Space Grotesk', sans-serif";
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        const title = v.isRegionBoss ? 'BÖLGE FETHEDİLDİ!' : 'ZAFER!';
        ctx.strokeText(title, cx, cy - 130);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(title, cx, cy - 130);

        ctx.font = "bold 20px 'Space Grotesk', sans-serif";
        ctx.lineWidth = 4;
        const sub = `${v.isRegionBoss ? 'Bölge bossu' : 'Boss'} ${v.name} yenildi!`;
        ctx.strokeText(sub, cx, cy - 96);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(sub, cx, cy - 96);

        // Kazanılan rozet ve açılan saha hamlesi
        if (v.badge) {
            ctx.font = "bold 17px 'Space Grotesk', sans-serif";
            ctx.lineWidth = 4;
            const badgeText = `${v.badge.badgeName} kazanıldı — ${v.badge.name} açıldı!`;
            ctx.strokeText(badgeText, cx, cy + 78);
            ctx.fillStyle = v.badge.color;
            ctx.fillText(badgeText, cx, cy + 78);

            // Rozet: parlayan piksel madalya
            const bx = cx, by = cy + 46;
            ctx.fillStyle = v.badge.color;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + v.frame / 30;
                ctx.fillRect(bx + Math.cos(a) * 16 - 3, by + Math.sin(a) * 16 - 3, 6, 6);
            }
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(bx - 6, by - 6, 12, 12);
            ctx.fillStyle = v.badge.color;
            ctx.fillRect(bx - 3, by - 3, 6, 6);
        }

        ctx.font = "15px 'Space Grotesk', sans-serif";
        const foot = v.frame > 90
            ? `${v.locationName} tamamlandı — bir tuşa bas: ana haritaya dön`
            : `${v.locationName} tamamlandı`;
        ctx.strokeText(foot, cx, cy + 110);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(foot, cx, cy + 110);

        ctx.restore();
    },

    // Bir ekip üyesinin seviyesine uygun en ileri formu bulur;
    // gerekiyorsa evrim sahnesini başlatır.
    async checkEvolution(index, silent = false) {
        const { progress } = this;
        const member = progress.party[index];
        const pokemon = this.partyPokemon[index];
        if (!member || !pokemon) return;

        let chain = this.evolutionChains?.get(member.id);
        if (!chain) {
            try {
                chain = await fetchEvolutionChain(member.id);
                if (!this.evolutionChains) this.evolutionChains = new Map();
                this.evolutionChains.set(member.id, chain);
            } catch (error) {
                console.warn('Evrim zinciri alınamadı:', error);
                return;
            }
        }
        if (chain.length < 2) return;

        // Zincir bu Pokemonun kendi düğümünden başlar: chain[0] mevcut formdur.
        // Yalnızca seviye şartını karşılayan sonraki formlara geçilir; taş/takas
        // gibi tetikleyicilerde minLevel null olur ve orada durulur.
        let target = chain[0];
        for (let i = 1; i < chain.length; i++) {
            const stage = chain[i];
            if (stage.minLevel !== null && member.level >= stage.minLevel) target = stage;
            else break;
        }
        if (target.id === member.formId) return;

        const fromImg = pokemon.img.src;
        progress.setForm(index, target.id);

        try {
            const data = await fetchCharacter({ id: target.id });
            const evolved = await this.buildMember(progress.party[index]);
            evolved.hp = Math.min(evolved.maxHp, Math.round(evolved.maxHp * (pokemon.hp / pokemon.maxHp)));
            evolved.x = pokemon.x;
            evolved.y = pokemon.y;

            const wasActive = this.active === pokemon;
            this.partyPokemon[index] = evolved;
            if (wasActive) this.active = evolved;

            preloadTypes(evolved.types);
            if (!silent) this.startEvolutionScene(fromImg, pokemon.name, data);
        } catch (error) {
            console.error('Evrim formu yüklenemedi:', error);
        }
    },

    // Klasik Pokemon evrim sahnesi: karakter beyaz silüete döner, iki form
    // arasında gidip gelir, sonra parlamayla yeni form ortaya çıkar.
    startEvolutionScene(fromSrc, oldName, character) {
        const oldImg = new Image();
        oldImg.src = fromSrc;

        const newImg = new Image();
        newImg.src = character.sprite || character.battleSprite;

        Sfx.evolve();
        this.evolutionScene = {
            frame: 0,
            oldImg,
            newImg,
            oldName,
            newName: character.name,
            applied: true, // yeni form zaten uygulandı; sahne yalnızca gösterimdir
            sparks: []
        };
    },

    updateEvolutionScene() {
        const scene = this.evolutionScene;
        scene.frame++;

        // 200. karede parlama ve kıvılcım patlaması
        if (!scene.burst && scene.frame >= 200) {
            scene.burst = true;
            for (let i = 0; i < 60; i++) {
                scene.sparks.push({
                    x: 0, y: 0,
                    angle: (i / 60) * Math.PI * 2,
                    speed: 2 + Math.random() * 4,
                    dist: 0,
                    color: ['#fef08a', '#4ade80', '#ffffff', '#86efac'][i % 4]
                });
            }
        }

        if (scene.frame > 330) this.evolutionScene = null;
    },

    drawEvolutionScene() {
        const scene = this.evolutionScene;
        if (!scene) return;
        const { ctx, canvas } = this;
        const f = scene.frame;

        ctx.save();
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.imageSmoothingEnabled = true;

        const cx = this.viewW / 2;
        const cy = this.viewH / 2 - 10;

        // Geçiş hızlanarak artar: önce yavaş, sonra çılgınca yanıp söner
        const speed = Math.max(4, 30 - Math.floor(f / 8));
        const showNew = f >= 200 ? true : (f > 40 && Math.floor(f / speed) % 2 === 1);
        const img = showNew ? scene.newImg : scene.oldImg;
        const size = showNew ? 150 : 130;

        // Arkada büyüyen ışık halkası
        const halo = 60 + Math.min(140, f * 0.7);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#4ade80';
        for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2 + f / 40;
            ctx.fillRect(cx + Math.cos(a) * halo - 3, cy + Math.sin(a) * halo - 3, 6, 6);
        }
        ctx.globalAlpha = 1;

        // Silüet (yeni form ortaya çıkana kadar bembeyaz)
        if (img.complete && img.naturalWidth > 0) {
            if (f < 200) {
                // Beyaz silüet: sprite'ı maske olarak kullan
                const off = document.createElement('canvas');
                off.width = off.height = size;
                const octx = off.getContext('2d');
                octx.imageSmoothingEnabled = true;
                octx.drawImage(img, 0, 0, size, size);
                octx.globalCompositeOperation = 'source-in';
                octx.fillStyle = '#ffffff';
                octx.fillRect(0, 0, size, size);
                ctx.drawImage(off, cx - size / 2, cy - size / 2);
            } else {
                ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
            }
        }

        // Patlama kıvılcımları
        for (const spark of scene.sparks) {
            spark.dist += spark.speed;
            ctx.fillStyle = spark.color;
            ctx.fillRect(cx + Math.cos(spark.angle) * spark.dist - 2, cy + Math.sin(spark.angle) * spark.dist - 2, 4, 4);
        }

        // Beyaz parlama anı
        if (f >= 195 && f < 215) {
            ctx.globalAlpha = 1 - (f - 195) / 20;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, this.viewW, this.viewH);
            ctx.globalAlpha = 1;
        }

        // Yazılar
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 5;
        ctx.font = "bold 26px 'Space Grotesk', sans-serif";
        if (f < 200) {
            const text = `${scene.oldName} evrimleşiyor!`;
            ctx.strokeText(text, cx, cy + 130);
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(text, cx, cy + 130);
        } else {
            const text = `Tebrikler! ${scene.oldName} → ${scene.newName}`;
            ctx.strokeText(text, cx, cy + 130);
            ctx.fillStyle = '#4ade80';
            ctx.fillText(text, cx, cy + 130);
        }

        ctx.restore();
    },

    // Boss uyandı: arena bölgesindeki ağaç/çalıları paramparça edip
    // zemini bossun temasına (kavrulmuş toprak) çevirir.
    onBossWake(boss) {
        const map = this.currentMap;
        const arena = map.bossArena;
        this.shake = 26;
        Sfx.bossWake();
        this.spawnMapText(boss.x, boss.y - 70, `${boss.name} UYANDI!`, '#f97316');
        if (!arena || this.arenaOpened) return;
        this.arenaOpened = true;

        // Izgara kopyası üzerinde çalış (orijinal harita verisi bozulmasın)
        const grid = map.grid.map(row => row.split(''));
        for (let row = arena.row0; row <= arena.row1; row++) {
            for (let col = arena.col0; col <= arena.col1; col++) {
                if (!grid[row] || grid[row][col] === undefined) continue;
                const tile = grid[row][col];
                if (map.portalDefs[tile]) continue; // portallar korunur

                if (tile === 'A') continue; // kadim ağaç yıkılmaz

                // Yıkılan engellerden enkaz fışkırır
                if (tile === 'T' || tile === 'h' || tile === 'H' || tile === 'R') {
                    const px = col * TILE_SIZE + TILE_SIZE / 2;
                    const py = row * TILE_SIZE + TILE_SIZE / 2;
                    for (let i = 0; i < 5; i++) {
                        this.debris.push({
                            x: px, y: py,
                            vx: (Math.random() - 0.5) * 9,
                            vy: -Math.random() * 8 - 2,
                            size: 3 + Math.random() * 3,
                            color: tile === 'R' ? '#64748b' : (Math.random() < 0.5 ? '#14532d' : '#4a2800'),
                            life: 45 + Math.random() * 30,
                            gravity: 0.4
                        });
                    }
                }
                grid[row][col] = 'b';
            }
        }

        // Değiştirilmiş ızgarayı bu oturum için kullan
        this.currentMap = { ...map, grid: grid.map(row => row.join('')) };
        this.flow = null;
        this.bakeTerrain(); // yıkılan arena yeniden pişirilir
    },

    onBossDefeated(boss) {
        const isNew = this.progress.markBossDefeated(this.currentMap.id);
        this.progress.markDefeated(boss.id, boss.name, boss.kind);

        // Rozet ve onunla açılan saha hamlesi
        const move = FIELD_MOVES.find(m => m.badge === this.currentMap.id);
        const badge = isNew && move ? move : null;

        // Bossun düşürdüğü jetonları toplamak için süre tanı; zafer ekranı
        // ancak jetonlar alındıktan (ya da süre dolduktan) sonra açılır
        this.pendingVictory = { boss, badge, wait: VICTORY.tokenGraceFrames };
        if (badge) Sfx.badge();
        this.spawnMapText(boss.x, boss.y - 90, 'Jetonları topla!', '#fbbf24');
    },

    // Jetonlar toplanınca (ya da süre dolunca) zafer sahnesini başlat
    updatePendingVictory() {
        const pending = this.pendingVictory;
        if (!pending) return;

        pending.wait--;
        // Haritada jeton kalmadıysa beklemeye gerek yok (kısa bir tampon bırak)
        if (this.tokenDrops.length === 0 && pending.wait > VICTORY.minGraceFrames) pending.wait = VICTORY.minGraceFrames;
        if (pending.wait > 0) return;

        this.pendingVictory = null;
        this.startVictory(pending.boss, pending.badge);
    },

    startVictory(boss, badge) {
        Sfx.victory();
        this.victory = {
            frame: 0,
            name: boss.name,
            isRegionBoss: boss.kind === 'regionBoss',
            locationName: this.currentMap.name,
            badge,
            confetti: []
        };
        for (let i = 0; i < 90; i++) {
            this.victory.confetti.push({
                x: Math.random() * this.viewW,
                y: -Math.random() * this.viewH,
                vy: 1.5 + Math.random() * 3,
                vx: (Math.random() - 0.5) * 1.5,
                size: 3 + Math.random() * 3,
                color: ['#fbbf24', '#4ade80', '#60a5fa', '#f472b6', '#f8fafc'][Math.floor(Math.random() * 5)]
            });
        }
    }
};
