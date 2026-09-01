import { FIGHTERS, fighterSprite } from '../game/fighters.js';

// Karakter seçim ekranı: kadro kartları, detay penceresi ve P1/P2 seçim sırası.
//
// Kadro artık bir ağdan gelmiyor: iki dövüşçü de elle çizilmiş, kartta
// gördüğün sprite arenaya çıkan sprite'ın ta kendisi. Bu yüzden yükleme
// beklemesi de yok.
//
// Ekran fareyle de kolla da kullanılabiliyor. Kol imleci ayrı bir yol açmıyor:
// odaklı kartın click()'i çağrılıyor, yani kol da farenin gittiği yerden
// gidiyor - iki ayrı seçim mantığı olsa biri diğerinden sapardı.
export class CharacterSelect {
    constructor() {
        this.selectionTurn = 1; // 1 = P1 seçiyor, 2 = P2 seçiyor
        this.focusIndex = -1;   // kol imleci (-1 = imleç yok)
        this.player1Selected = null;
        this.player2Selected = null;

        this.grid = document.getElementById('character-grid');
        this.status = document.getElementById('selection-status');
        this.overlay = document.getElementById('detail-overlay');
        this.startBtn = document.getElementById('start-battle-btn');

        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.closeModal();
        });

        this.grid.innerHTML = '';
        for (const fighter of FIGHTERS) this.addFighter(fighter);
    }

    // Dövüşçünün sprite'ını karta sığacak ölçekte çizen bir tuval üretir
    previewCanvas(fighter, boxH) {
        const sprite = fighterSprite(fighter.id);
        const canvas = document.createElement('canvas');
        if (!sprite) return canvas;

        const scale = boxH / sprite.h;
        canvas.width = Math.round(sprite.w * scale);
        canvas.height = Math.round(boxH);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite.canvas, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    addFighter(fighter) {
        const card = document.createElement('div');
        card.className = 'char-card';
        card.style.setProperty('--class-color', fighter.themeColor);
        card.setAttribute('id', `card-${fighter.id}`);

        const box = document.createElement('div');
        box.className = 'char-image-container';
        box.appendChild(this.previewCanvas(fighter, 150));

        const name = document.createElement('div');
        name.className = 'char-class';
        name.textContent = fighter.name;

        card.append(box, name);
        card.addEventListener('click', () => this.showDetails(fighter));
        this.grid.appendChild(card);
    }

    showDetails(fighter) {
        const modalBody = this.overlay.querySelector('.modal-body');
        modalBody.innerHTML = `
            <div class="detail-header">
                <div class="detail-pfp-box" style="border: 2px solid ${fighter.themeColor}"></div>
                <div class="detail-titles">
                    <span class="class-tag" style="--class-color: ${fighter.themeColor}">${fighter.name}</span>
                </div>
            </div>
            <p class="char-description">${fighter.description}</p>
            <div class="stats-container">
                <div class="stat-row" style="--class-color: ${fighter.themeColor}">
                    <div class="stat-label-row"><span>can</span><span>${fighter.stats.hp}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill" data-width="${fighter.stats.hp * 0.7}%"></div></div>
                </div>
                <div class="stat-row" style="--class-color: ${fighter.themeColor}">
                    <div class="stat-label-row"><span>hız</span><span>${fighter.stats.speed}</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill" data-width="${fighter.stats.speed * 15}%"></div></div>
                </div>
            </div>
            <button class="select-hero-btn" style="--class-color: ${fighter.themeColor}">
                Oyuncu ${this.selectionTurn} Olarak Seç
            </button>
        `;
        modalBody.querySelector('.detail-pfp-box').appendChild(this.previewCanvas(fighter, 90));
        modalBody.querySelector('.select-hero-btn').addEventListener('click', () => this.selectHero(fighter));

        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active');

        // Stat barları açılış animasyonu
        setTimeout(() => {
            modalBody.querySelectorAll('.stat-bar-fill').forEach(fill => {
                fill.style.width = fill.getAttribute('data-width');
            });
        }, 50);
    }

    selectHero(fighter) {
        const card = document.getElementById(`card-${fighter.id}`);

        if (this.selectionTurn === 1) {
            this.player1Selected = fighter;
            this.grid.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected-p1'));
            if (card) card.classList.add('selected-p1');

            const badge = this.status.querySelector('.p1-status-badge');
            badge.textContent = `P1: ${fighter.name}`;
            badge.classList.add('selected');

            this.selectionTurn = 2;
            this.status.querySelector('.p2-status-badge').textContent = 'Oyuncu 2: Seçim Yapıyor...';
        } else {
            this.player2Selected = fighter;
            this.grid.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected-p2'));
            if (card) card.classList.add('selected-p2');

            const badge = this.status.querySelector('.p2-status-badge');
            badge.textContent = `P2: ${fighter.name}`;
            badge.classList.add('selected');

            // İki oyuncu da seçildi: 2 kişilik mod düğmesi aktifleşir
            this.startBtn.classList.remove('not-ready');
            const hint = document.getElementById('mode-hint');
            if (hint) hint.textContent = 'Her iki oyuncu da hazır — 2 kişilik oyna!';
            this.startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        this.closeModal();
    }

    closeModal() {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('active');
    }

    // ---- Kol imleci ----

    get cards() {
        return [...this.grid.querySelectorAll('.char-card')];
    }

    get modalOpen() {
        return !this.overlay.classList.contains('hidden');
    }

    focusCard(index) {
        const cards = this.cards;
        if (cards.length === 0) return;

        const i = Math.max(0, Math.min(cards.length - 1, index));
        for (const card of cards) card.classList.remove('pad-focus');
        cards[i].classList.add('pad-focus');
        cards[i].scrollIntoView({ block: 'nearest' });
        this.focusIndex = i;
    }

    clearFocus() {
        for (const card of this.cards) card.classList.remove('pad-focus');
        this.focusIndex = -1;
    }

    // Izgaranın sütun sayısı ekran genişliğine göre değişiyor (CSS auto-fill),
    // bu yüzden sabit bir sayı yazılamaz: ilk satırda kaç kart varsa o kadar.
    columnCount() {
        const cards = this.cards;
        if (cards.length < 2) return 1;

        const firstTop = cards[0].offsetTop;
        let columns = 0;
        while (columns < cards.length && cards[columns].offsetTop === firstTop) columns++;
        return Math.max(1, columns);
    }

    // dx/dy: -1, 0, +1. Izgaranın kenarında imleç takılı kalır (başa sarmaz -
    // sarsaydı aşağı basan oyuncu kendini listenin tepesinde bulurdu).
    moveFocus(dx, dy) {
        const cards = this.cards;
        if (cards.length === 0) return;
        if (this.focusIndex < 0) {
            this.focusCard(0);
            return;
        }

        const next = this.focusIndex + dx + dy * this.columnCount();
        if (next < 0 || next >= cards.length) return;
        this.focusCard(next);
    }

    // İmleçteki kartın detayını açar (farenin tıkladığı yolun aynısı)
    openFocused() {
        const card = this.cards[this.focusIndex];
        if (card) card.click();
        else this.focusCard(0);
    }

    // Detay penceresindeki "Oyuncu N Olarak Seç" düğmesine basar
    confirmModal() {
        this.overlay.querySelector('.select-hero-btn')?.click();
    }

    getSelection() {
        return { p1: this.player1Selected, p2: this.player2Selected };
    }
}
