import { AUTO_BATTLE } from '../../config/balance.js';
import { effectiveness } from '../../services/typeChart.js';

// Sahadaki Pokemon kendi kendine savaşır: hedef seçer, tip üstünlüğüne ve
// duruma göre hamle seçip kullanır. Oyuncu isterse tuşlarla yine müdahale
// edebilir (elle basılan hamle önceliklidir).
// Overworld prototipine karıştırılır - 'this' Overworld örneğidir.
export const AutoBattle = {
    // Bir yeteneğin şu an ne kadar isabetli/işe yarar olduğunu puanlar
    scoreAbility(ability, index, pokemon, target) {
        if (pokemon.cooldowns[index] > 0) return -1;

        // İyileşme: yalnızca canı düşükken değerli
        if (ability.kind === 'heal') {
            const ratio = pokemon.hp / pokemon.maxHp;
            return ratio < AUTO_BATTLE.healBelow ? 1000 * (1 - ratio) : -1;
        }

        // Güçlendirme: savaş başında bir kez, düşman varken
        if (ability.kind === 'buff') return target ? 40 : -1;

        if (!target) return -1;

        const distance = Math.hypot(target.x - pokemon.x, target.y - pokemon.y);

        // Alan etkisi: hedef menzilde olmalı
        if (ability.kind === 'aoe') {
            if (distance > (ability.radius || 150)) return -1;
            // Uyutma hamlesi hasar vermez ama tehlikeyi keser
            return ability.type === 'sleep' ? 120 : 200;
        }

        // Atılım: yakın mesafede güçlü
        if (ability.kind === 'dash') {
            return distance < (ability.distance || 200) ? 150 + (ability.damage || 0) : -1;
        }

        // Mermi: tip üstünlüğü ve hasar
        const multiplier = ability.moveType ? effectiveness(ability.moveType, target.types) : 1;
        if (multiplier === 0) return -1; // etkisiz hamleyi hiç kullanma

        const damage = (ability.damage || 0) * multiplier * (ability.spread || 1);
        // Uzun bekleme süresi olan hamleler biraz cezalandırılır ki hepsi
        // aynı anda boşa harcanmasın
        return damage * 10 - ability.cooldown * 0.05;
    },

    // Sahadaki Pokemon adına karar verir ve gerekirse hamle kullanır
    updateAutoBattle() {
        const pokemon = this.active;
        if (!pokemon || pokemon.fainted || this.victory || this.evolutionScene) return;

        pokemon.autoTimer = (pokemon.autoTimer || 0) - 1;
        if (pokemon.autoTimer > 0) return;
        pokemon.autoTimer = AUTO_BATTLE.decisionEvery;

        // Görüş hattı açık en yakın düşman (duvar arkasına ateş etmez)
        const target = this.autoTarget(pokemon);

        let bestIndex = -1;
        let bestScore = 0;
        pokemon.abilities.forEach((ability, index) => {
            const score = this.scoreAbility(ability, index, pokemon, target);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        });

        if (bestIndex >= 0) this.castAbility(bestIndex, target);
    },

    // Otomatik savaş için hedef: menzilde, ayakta ve görülebilen en yakın düşman
    autoTarget(pokemon) {
        let best = null;
        let bestDist = AUTO_BATTLE.scanRange;

        for (const enemy of this.enemies) {
            if (enemy.fainted || enemy.asleep) continue;
            const distance = Math.hypot(enemy.x - pokemon.x, enemy.y - pokemon.y);
            if (distance >= bestDist) continue;
            if (!this.hasLineOfSight(pokemon.x, pokemon.y, enemy.x, enemy.y)) continue;
            bestDist = distance;
            best = enemy;
        }
        return best;
    }
};
