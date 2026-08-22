import { TILE_SIZE } from '../../config/worldMap.js';
import { trainersFor } from '../../config/trainers.js';
import { Enemy } from '../Enemy.js';
import { Sfx } from '../../services/audio.js';
import { drawTrainer } from '../trainerSprite.js';
import { TRAINER } from '../../config/balance.js';
import { preloadTypes } from '../../services/typeChart.js';

// NPC antrenör savaşları: haritada duran rakipler görüş alanına girince
// meydan okur ve ekibindeki Pokemonları sırayla sahaya sürer. Sıradaki
// yalnızca öncekini yendikten sonra çıkar.
// Overworld prototipine karıştırılır - 'this' Overworld örneğidir.
export const TrainerBattles = {
    // Haritaya girildiğinde NPC antrenörleri kurar
    setupTrainers(map) {
        this.npcTrainers = trainersFor(map.id)
            .filter(def => !this.progress.beatenTrainers.includes(def.id))
            .map(def => ({
                ...def,
                x: def.col * TILE_SIZE + TILE_SIZE / 2,
                y: def.row * TILE_SIZE + TILE_SIZE / 2,
                engaged: false,
                sentIndex: -1,
                current: null
            }));
    },

    updateTrainerBattles() {
        for (const npc of this.npcTrainers) {
            // Meydan okuma: görüş alanına girince
            if (!npc.engaged) {
                const dist = Math.hypot(this.player.x - npc.x, this.player.y - npc.y);
                if (dist < npc.sightRange && this.hasLineOfSight(npc.x, npc.y, this.player.x, this.player.y)) {
                    this.engageTrainer(npc);
                }
                continue;
            }

            // Sahadaki Pokemonu yenildiyse sıradakini gönder
            if (npc.current && npc.current.fainted) {
                npc.current = null;
                this.sendNextTrainerPokemon(npc);
            }
        }
    },

    engageTrainer(npc) {
        npc.engaged = true;
        this.spawnMapText(npc.x, npc.y - 50, `${npc.name}: ${npc.taunt}`, '#fbbf24');
        Sfx.badge();
        this.shake = 8;
        this.sendNextTrainerPokemon(npc);
    },

    sendNextTrainerPokemon(npc) {
        npc.sentIndex++;

        // Ekibi bitti: antrenör yenildi
        if (npc.sentIndex >= npc.party.length) {
            this.defeatTrainer(npc);
            return;
        }

        const id = npc.party[npc.sentIndex];
        const enemy = new Enemy({
            id,
            kind: 'trainer',
            col: Math.floor(npc.x / TILE_SIZE),
            row: Math.floor(npc.y / TILE_SIZE),
            world: this,
            region: this.currentMap.region || 1
        });
        enemy.owner = npc;
        enemy.aggro = true;
        // Antrenörün önünde belirsin
        enemy.x = npc.x + 40;
        enemy.y = npc.y + 20;

        this.enemies.push(enemy);
        npc.current = enemy;

        this.fetchEnemyData(id).then(data => {
            enemy.name = data.name;
            enemy.types = data.types || [];
            this.progress.markSeen(id, data.name);
            enemy.img.src = data.sprite || data.battleSprite;
            preloadTypes(enemy.types);
            this.spawnMapText(npc.x, npc.y - 34, `Hadi ${data.name}!`, '#f87171');
        }).catch(error => console.error(`Antrenör Pokemonu yüklenemedi (#${id}):`, error));
    },

    defeatTrainer(npc) {
        this.progress.beatTrainer(npc.id);
        this.progress.addTokens(npc.reward);
        this.spawnMapText(npc.x, npc.y - 50, `${npc.name}: ${npc.defeated}`, '#4ade80');
        this.spawnMapText(npc.x, npc.y - 74, `+${npc.reward} jeton`, '#fbbf24');
        Sfx.victory();
        npc.beaten = true;
    },

    // Haritadaki NPC antrenörler (yenilenler solgun durur)
    drawTrainerNpcs() {
        const { ctx } = this;

        for (const npc of this.npcTrainers) {
            ctx.save();
            if (npc.beaten) ctx.globalAlpha = 0.45;

            // Gölge
            ctx.globalAlpha *= 0.9;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(npc.x, npc.y - 2, TRAINER.spriteScale * 3.5, TRAINER.spriteScale * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            if (npc.beaten) ctx.globalAlpha = 0.45;
            // Rakip antrenör oyuncuya bakar
            const dir = this.player.x > npc.x ? 'right' : 'left';
            drawTrainer(ctx, npc.x, npc.y, dir, false, TRAINER.spriteScale);
            ctx.restore();

            // İsim ve durum
            ctx.save();
            ctx.font = "bold 12px 'Space Grotesk', sans-serif";
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            const label = npc.beaten ? `${npc.name} (yenildi)` : npc.name;
            ctx.strokeText(label, npc.x, npc.y - TRAINER.spriteScale * 11);
            ctx.fillStyle = npc.beaten ? '#94a3b8' : '#fbbf24';
            ctx.fillText(label, npc.x, npc.y - TRAINER.spriteScale * 11);

            // Kalan Pokemon sayısı
            if (npc.engaged && !npc.beaten) {
                const remaining = npc.party.length - npc.sentIndex;
                for (let i = 0; i < npc.party.length; i++) {
                    ctx.fillStyle = i < remaining ? '#f87171' : '#334155';
                    ctx.fillRect(npc.x - npc.party.length * 5 + i * 10, npc.y - TRAINER.spriteScale * 9, 7, 7);
                }
            }
            ctx.restore();
        }
    }
};
