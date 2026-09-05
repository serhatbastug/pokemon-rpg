import { PLAYERS, PAD_CONTROL_LABEL, COMBAT, FRAME_RATE } from '../config/settings.js';
import { ABILITIES } from '../game/abilities.js';
import { drawComboBar } from './comboBar.js';

// Savaş HUD'u: isimler, can barları, raunt işaretleri, süre ve bekleme
// göstergeleri.
//
// Kombosuz iki hamlenin (BLOK, ÖZEL) beklemesi burada, can barının altında.
// Dört kombonun beklemesi arenanın altındaki kümede (comboBar.js) - orada
// zaten hangi tuşla çıktıkları da yazıyor.
export class Hud {
    constructor() {
        this.p1Name = document.getElementById('p1-name');
        this.p2Name = document.getElementById('p2-name');
        this.p1HpBar = document.getElementById('p1-hp-bar');
        this.p2HpBar = document.getElementById('p2-hp-bar');
        this.p1HpText = document.getElementById('p1-hp-text');
        this.p2HpText = document.getElementById('p2-hp-text');

        this.rounds = {
            1: document.getElementById('p1-rounds'),
            2: document.getElementById('p2-rounds')
        };
        this.timerEl = document.getElementById('round-timer');
        this.cooldownEls = {
            1: { block: document.getElementById('p1-cd-block'), special: document.getElementById('p1-cd-special') },
            2: { block: document.getElementById('p2-cd-block'), special: document.getElementById('p2-cd-special') }
        };

        this.controls = {
            1: document.getElementById('p1-controls'),
            2: document.getElementById('p2-controls')
        };
        this.badgePadCount = null;   // en son hangi kontrol yazıldı
        this.lastSeconds = null;     // saniye değişmedikçe DOM'a yazma
        this.lastCd = { 1: {}, 2: {} };

        const bar = document.getElementById('comboBar');
        this.comboCtx = bar ? bar.getContext('2d') : null;
        this.comboWidth = bar ? bar.width : 0;
    }

    // padCount: takılı kol sayısı. 1. oyuncu ilk kolu, 2. oyuncu ikinciyi alır;
    // kolu olmayan oyuncuda klavye tuşları yazmaya devam eder.
    // Her karede çağrılıyor, bu yüzden yalnızca değişince DOM'a yazıyor.
    updateControlBadges(padCount) {
        if (padCount === this.badgePadCount) return;
        this.badgePadCount = padCount;

        for (const num of [1, 2]) {
            const el = this.controls[num];
            if (!el) continue;
            // Yapay zekâ oynatıyorsa tuş yazmanın anlamı yok: o oyuncunun
            // tuşu yok. Zorluk da burada yazıyor - oyuncu kime karşı
            // oynadığını maç boyunca görebilmeli.
            const brain = this.players?.[num]?.brain;
            if (brain) {
                el.textContent = `YAPAY ZEKÂ · ${brain.level.label}`;
                el.classList.remove('pad-badge-text');
                continue;
            }
            const onPad = PLAYERS[num].padSlot < padCount;
            el.textContent = onPad ? PAD_CONTROL_LABEL : PLAYERS[num].keyLabel;
            el.classList.toggle('pad-badge-text', onPad);
        }
    }

    setPlayers(p1, p2) {
        this.p1Name.textContent = p1.fighter.name;
        this.p2Name.textContent = p2.fighter.name;
        this.players = { 1: p1, 2: p2 };
        this.badgePadCount = null;   // rozetler yeniden yazılsın
    }

    updateHealth(p1, p2) {
        this.p1HpBar.style.width = `${(p1.hp / p1.maxHp) * 100}%`;
        this.p1HpText.textContent = `${Math.ceil(p1.hp)} / ${p1.maxHp}`;

        this.p2HpBar.style.width = `${(p2.hp / p2.maxHp) * 100}%`;
        this.p2HpText.textContent = `${Math.ceil(p2.hp)} / ${p2.maxHp}`;
    }

    // wins: { 1: n, 2: n }. Kazanılan her raunt bir işareti yakıyor.
    updateRounds(wins) {
        for (const num of [1, 2]) {
            const el = this.rounds[num];
            if (!el) continue;
            [...el.children].forEach((pip, i) => pip.classList.toggle('won', i < wins[num]));
        }
    }

    updateTimer(frames) {
        if (!this.timerEl) return;
        const seconds = Math.max(0, Math.ceil(frames / FRAME_RATE));
        if (seconds === this.lastSeconds) return;
        this.lastSeconds = seconds;
        this.timerEl.textContent = `${seconds}`;
        this.timerEl.classList.toggle('urgent', seconds <= 10);
    }

    // Bekleme şeritleri: dolu = hazır, boşalan = bekliyor.
    updateCooldowns(player) {
        const els = this.cooldownEls[player.playerNum];
        if (!els) return;

        const blockMax = COMBAT.blockWindow + COMBAT.blockCooldown;
        const special = ABILITIES[player.fighter.id]?.special;
        const values = {
            block: 1 - Math.min(1, player.blockCooldown / blockMax),
            special: special
                ? 1 - Math.min(1, (player.cooldowns[special.id] || 0) / special.cooldown)
                : 1
        };

        for (const key of ['block', 'special']) {
            const pct = Math.round(values[key] * 100);
            if (this.lastCd[player.playerNum][key] === pct) continue;
            this.lastCd[player.playerNum][key] = pct;
            if (els[key]) els[key].style.width = `${pct}%`;
        }
    }

    // Arenanın altındaki kombo kümeleri. Her karede yeniden çiziliyor:
    // içlerinde geri sayan bekleme süreleri var.
    drawComboBars(p1, p2) {
        if (p1) this.updateCooldowns(p1);
        if (p2) this.updateCooldowns(p2);
        if (!this.comboCtx) return;
        drawComboBar(this.comboCtx, p1, p2, this.comboWidth);
    }
}
