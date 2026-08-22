// Savaş HUD'u: isimler, can barları ve yetenek bekleme süresi göstergeleri.
export class Hud {
    constructor() {
        this.p1Name = document.getElementById('p1-name');
        this.p2Name = document.getElementById('p2-name');
        this.p1HpBar = document.getElementById('p1-hp-bar');
        this.p2HpBar = document.getElementById('p2-hp-bar');
        this.p1HpText = document.getElementById('p1-hp-text');
        this.p2HpText = document.getElementById('p2-hp-text');

        // Yetenek indeksine göre cooldown kaplamaları (oyuncu numarası -> [overlay, overlay, overlay])
        this.cdOverlays = {
            1: [1, 2, 3].map(i => document.querySelector(`#p1-cd-${i} .cd-overlay`)),
            2: [1, 2, 3].map(i => document.querySelector(`#p2-cd-${i} .cd-overlay`))
        };
    }

    setPlayers(p1, p2) {
        this.p1Name.textContent = `${p1.char.className} (${p1.char.name})`;
        this.p2Name.textContent = `${p2.char.className} (${p2.char.name})`;
    }

    updateHealth(p1, p2) {
        this.p1HpBar.style.width = `${(p1.hp / p1.maxHp) * 100}%`;
        this.p1HpText.textContent = `${Math.ceil(p1.hp)} / ${p1.maxHp}`;

        this.p2HpBar.style.width = `${(p2.hp / p2.maxHp) * 100}%`;
        this.p2HpText.textContent = `${Math.ceil(p2.hp)} / ${p2.maxHp}`;
    }

    updateCooldowns(p1, p2) {
        for (const player of [p1, p2]) {
            const overlays = this.cdOverlays[player.playerNum];
            for (let i = 0; i < overlays.length; i++) {
                const cd = player.cooldowns[i];
                const max = player.maxCooldowns[i];
                overlays[i].style.height = cd > 0 ? `${(cd / max) * 100}%` : '0%';
            }
        }
    }
}
