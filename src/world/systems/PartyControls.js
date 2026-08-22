import { TILE_SIZE } from '../../config/worldMap.js';
import { ActivePokemon } from '../ActivePokemon.js';
import { abilityOverride, withKeys } from '../../config/playableCharacters.js';
import { buildAbilities } from '../../services/moveAbilities.js';
import { preloadTypes } from '../../services/typeChart.js';
import { fetchCharacter } from '../../services/pokeapi.js';
import { DEPLOY, MAP } from '../../config/balance.js';

// Ekip yönetimi: Pokemon hazırlama, poke top fırlatma/geri çağırma,
// eşya kullanımı ve bayılma sonrası devreye girme.
// Overworld prototipine karıştırılır (applyMixins) - bu yüzden 'this' Overworld örneğidir.
export const PartyControls = {
    get abilities() {
        return this.active ? this.active.abilities : [];
    },

    // Düşmanların hedefi: sahadaki Pokemon (yoksa antrenörün konumu)
    get combatTarget() {
        return (this.active && !this.active.fainted) ? this.active : this.player;
    },

    // Bir ekip üyesinin verisini ve yeteneklerini hazırlar.
    // Elle yazılmış set varsa o kullanılır, yoksa gerçek hamle verisinden üretilir.
    async buildMember(member) {
        const data = await fetchCharacter({ id: member.formId });
        const override = abilityOverride(member.id, member.level);
        const abilities = withKeys(override && override.length ? override : await buildAbilities(data));
        return new ActivePokemon({ member, data, abilities, world: this });
    },

    // Ekibi kurar; sahadaki Pokemonu belirler ve tip verilerini önden yükler
    async loadParty() {
        const { progress } = this;

        this.partyPokemon = [];
        for (const member of progress.party) {
            try {
                const pokemon = await this.buildMember(member);
                this.partyPokemon.push(pokemon);
            } catch (error) {
                console.error(`Ekip üyesi yüklenemedi (#${member.formId}):`, error);
            }
        }

        if (!this.partyPokemon.length) return;

        // Pokemon kendiliğinden sahaya çıkmaz; oyuncu poke topunu fırlatır (1-6)
        this.active = null;

        // Tip etkililik tablosu: ekip ve düşman tipleri
        const types = this.partyPokemon.flatMap(p => p.types);
        preloadTypes(types);

        // Kayıttan gelen seviyeye uygun evrim formunu sessizce uygula
        for (let i = 0; i < this.partyPokemon.length; i++) this.checkEvolution(i, true);
    },

    // Kütüphaneden seviye yükseltilen üye: statları tazelenir, evrim kontrol edilir
    async onMemberLeveled(index) {
        const member = this.progress.party[index];
        const pokemon = this.partyPokemon[index];
        if (!member || !pokemon) return;

        const refreshed = await this.buildMember(member);
        refreshed.hp = Math.min(refreshed.maxHp, Math.round(pokemon.hp + (refreshed.maxHp - pokemon.maxHp)));
        refreshed.x = pokemon.x;
        refreshed.y = pokemon.y;

        const wasActive = this.active === pokemon;
        this.partyPokemon[index] = refreshed;
        if (wasActive) this.active = refreshed;

        this.spawnMapText(refreshed.x, refreshed.y - 60, `${refreshed.name} Sv. ${member.level}!`, '#facc15');
        await this.checkEvolution(index);
    },

    // Poke topu fırlatarak Pokemonu sahaya sürer. Aynı tuşa tekrar basmak
    // (ya da başka bir slot seçmek) onu geri çağırır.
    swapTo(index) {
        if (this.swapCooldown > 0 || this.deployBall) return;
        const next = this.partyPokemon[index];
        if (!next) return;

        if (next.fainted) {
            this.spawnMapText(this.player.x, this.player.y - 50, `${next.name} bayılmış!`, '#94a3b8');
            return;
        }

        // Sahadaki Pokemonun topuna tekrar basıldı: geri çağır
        if (next === this.active) {
            this.recallActive('geri döndü');
            return;
        }

        // Topun düşeceği nokta: antrenörün baktığı yönde, duvara girmeyecek şekilde
        const aim = this.aimVector();
        let tx = this.player.x + aim.x * DEPLOY.throwDistance;
        let ty = this.player.y + aim.y * DEPLOY.throwDistance;
        for (let i = 0; i < 8 && !this.canBoxMoveTo(tx, ty, 16, 12); i++) {
            tx -= aim.x * 14;
            ty -= aim.y * 14;
        }
        if (!this.canBoxMoveTo(tx, ty, 16, 12)) {
            tx = this.player.x;
            ty = this.player.y;
        }

        if (this.active) this.recallActive(null);

        this.deployBall = {
            index,
            frame: 0,
            fromX: this.player.x,
            fromY: this.player.y - 14,
            toX: tx,
            toY: ty
        };
        this.swapCooldown = DEPLOY.swapCooldown;
    },

    // Topun havada geçirdiği süre ve açılma anı
    updateDeployBall() {
        const ball = this.deployBall;
        if (!ball) return;

        ball.frame++;
        if (ball.frame < DEPLOY.flightFrames) return;

        const pokemon = this.partyPokemon[ball.index];
        this.deployBall = null;
        if (!pokemon || pokemon.fainted) return;

        pokemon.x = ball.toX;
        pokemon.y = ball.toY;
        pokemon.invuln = DEPLOY.spawnInvuln;
        this.active = pokemon;
        this.progress.setActive(ball.index);

        // Açılma parlaması
        for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            this.debris.push({
                x: ball.toX, y: ball.toY,
                vx: Math.cos(a) * 3,
                vy: Math.sin(a) * 3 - 1,
                size: 3,
                color: i % 2 === 0 ? '#f8fafc' : '#38bdf8',
                life: 22,
                gravity: 0.05
            });
        }
        this.spawnMapText(ball.toX, ball.toY - 50, `Hadi ${pokemon.name}!`, '#38bdf8');
    },

    recallActive(reason) {
        if (!this.active) return;
        const pokemon = this.active;
        this.effectsTrail(pokemon.x, pokemon.y);
        if (reason) this.spawnMapText(pokemon.x, pokemon.y - 40, `${pokemon.name} ${reason}`, '#94a3b8');
        this.active = null;
    },

    // Çantadaki eşyayı kullanır; sonucu (kısa açıklama) döndürür
    useItem(id) {
        const { progress } = this;
        if (progress.itemCount(id) <= 0) return { ok: false, message: 'Elinde yok' };

        if (id === 'potion') {
            const target = this.active || this.partyPokemon.find(p => !p.fainted && p.hp < p.maxHp);
            if (!target) return { ok: false, message: 'İyileştirilecek Pokemon yok' };
            if (target.hp >= target.maxHp) return { ok: false, message: `${target.name} zaten tam canlı` };

            const healed = Math.round(target.maxHp * 0.5);
            target.heal(healed);
            progress.consumeItem(id);
            this.spawnMapText(target.x, target.y - 50, `+${healed} CAN`, '#f472b6');
            return { ok: true, message: `${target.name} +${healed} can` };
        }

        if (id === 'revive') {
            const index = this.partyPokemon.findIndex(p => p.fainted);
            if (index < 0) return { ok: false, message: 'Bayılmış Pokemon yok' };

            const pokemon = this.partyPokemon[index];
            pokemon.fainted = false;
            pokemon.hp = Math.round(pokemon.maxHp * 0.5);
            progress.consumeItem(id);
            return { ok: true, message: `${pokemon.name} ayağa kalktı` };
        }

        if (id === 'team-tonic') {
            const hurt = this.partyPokemon.filter(p => p.fainted || p.hp < p.maxHp);
            if (!hurt.length) return { ok: false, message: 'Ekip zaten sağlıklı' };

            for (const pokemon of this.partyPokemon) {
                pokemon.fainted = false;
                pokemon.hp = pokemon.maxHp;
            }
            progress.consumeItem(id);
            this.spawnMapText(this.player.x, this.player.y - 50, 'EKİP İYİLEŞTİ!', '#4ade80');
            return { ok: true, message: 'Tüm ekip iyileşti' };
        }

        return { ok: false, message: 'Bu eşya sahada kullanılmaz' };
    },

    // Sahadaki Pokemon bayıldı: sıradaki sağlıklı Pokemon gelir
    onPokemonFainted(pokemon) {
        this.spawnMapText(pokemon.x, pokemon.y - 40, `${pokemon.name} bayıldı!`, '#ef4444');
        this.effects?.triggerShake?.(10);

        const next = this.partyPokemon.findIndex(p => !p.fainted);
        if (next >= 0) {
            setTimeout(() => this.swapTo(next), 700);
            return;
        }

        // Tüm ekip bayıldı: mekan girişine dön, ekip iyileşsin
        setTimeout(() => {
            for (const member of this.partyPokemon) {
                member.fainted = false;
                member.hp = member.maxHp;
            }
            this.active = this.partyPokemon[0];
            this.progress.setActive(0);
            const start = this.currentMap.start;
            this.player.x = start.col * TILE_SIZE + TILE_SIZE / 2;
            this.player.y = start.row * TILE_SIZE + TILE_SIZE / 2;
            this.active.x = this.player.x;
            this.active.y = this.player.y;
            this.portalCooldown = MAP.portalCooldown;
            this.updateCamera(true);
            this.spawnMapText(this.player.x, this.player.y - 60, 'Ekip bayıldı! Girişe dönüldü', '#ef4444');
        }, 900);
    }
};
