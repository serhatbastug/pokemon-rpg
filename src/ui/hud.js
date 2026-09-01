import { PLAYERS, PAD_CONTROL_LABEL } from '../config/settings.js';

// Savaş HUD'u: isimler, can barları ve hangi kontrolle oynandığı.
//
// Yetenek bekleme göstergeleri kaldırıldı: virüslerin güçleri henüz yok.
// Güçler yazılınca buraya geri gelecek.
export class Hud {
    constructor() {
        this.p1Name = document.getElementById('p1-name');
        this.p2Name = document.getElementById('p2-name');
        this.p1HpBar = document.getElementById('p1-hp-bar');
        this.p2HpBar = document.getElementById('p2-hp-bar');
        this.p1HpText = document.getElementById('p1-hp-text');
        this.p2HpText = document.getElementById('p2-hp-text');

        this.controls = {
            1: document.getElementById('p1-controls'),
            2: document.getElementById('p2-controls')
        };
        this.badgePadCount = null;   // en son hangi kontrol yazıldı
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
            const onPad = PLAYERS[num].padSlot < padCount;
            el.textContent = onPad ? PAD_CONTROL_LABEL : PLAYERS[num].keyLabel;
            el.classList.toggle('pad-badge-text', onPad);
        }
    }

    setPlayers(p1, p2) {
        this.p1Name.textContent = p1.fighter.name;
        this.p2Name.textContent = p2.fighter.name;
    }

    updateHealth(p1, p2) {
        this.p1HpBar.style.width = `${(p1.hp / p1.maxHp) * 100}%`;
        this.p1HpText.textContent = `${Math.ceil(p1.hp)} / ${p1.maxHp}`;

        this.p2HpBar.style.width = `${(p2.hp / p2.maxHp) * 100}%`;
        this.p2HpText.textContent = `${Math.ceil(p2.hp)} / ${p2.maxHp}`;
    }
}
