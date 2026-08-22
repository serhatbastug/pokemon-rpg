// Karakter seçim ekranı: kart ızgarası, detay modalı ve P1/P2 seçim sırası.
export class CharacterSelect {
    constructor() {
        this.selectionTurn = 1; // 1 = P1 seçiyor, 2 = P2 seçiyor
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
    }

    // Karakter yüklendikçe kartını ızgaraya ekler
    addCharacter(character) {
        const spinner = this.grid.querySelector('.loading-spinner');
        if (spinner) spinner.remove();

        const card = document.createElement('div');
        card.className = 'char-card';
        card.style.setProperty('--class-color', character.themeColor);
        card.setAttribute('id', `card-${character.id}`);

        card.innerHTML = `
            <div class="char-image-container">
                <img class="char-img" src="${character.sprite}" alt="${character.name}">
            </div>
            <div class="char-class">${character.className}</div>
            <div class="char-name">${character.name}</div>
            <div class="poke-tag">#${character.id}</div>
        `;

        card.addEventListener('click', () => this.showDetails(character));
        this.grid.appendChild(card);
    }

    showDetails(character) {
        const modalBody = this.overlay.querySelector('.modal-body');
        modalBody.innerHTML = `
            <div class="detail-header">
                <img class="detail-pfp" src="${character.sprite}" alt="${character.name}" style="border: 2px solid ${character.themeColor}">
                <div class="detail-titles">
                    <span class="class-tag" style="--class-color: ${character.themeColor}">${character.className}</span>
                    <h3>${character.name}</h3>
                    <span class="poke-tag">No: #${character.id}</span>
                </div>
            </div>
            <p class="char-description" style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem;">
                ${character.description}
            </p>
            <div class="stats-container">
                <h4 style="margin-bottom: 1rem; font-family: var(--font-header);">Sınıf İstatistikleri</h4>
                ${Object.entries(character.baseStats).map(([stat, val]) => `
                    <div class="stat-row" style="--class-color: ${character.themeColor}">
                        <div class="stat-label-row">
                            <span style="text-transform: capitalize;">${stat === 'speed' ? 'hız' : stat}</span>
                            <span>${val}</span>
                        </div>
                        <div class="stat-bar-bg">
                            <div class="stat-bar-fill" data-width="${stat === 'speed' ? val * 15 : val}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="select-hero-btn" style="--class-color: ${character.themeColor}">
                Oyuncu ${this.selectionTurn} Olarak Seç
            </button>
        `;

        modalBody.querySelector('.select-hero-btn').addEventListener('click', () => this.selectHero(character));

        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active');

        // Stat barları açılış animasyonu
        setTimeout(() => {
            modalBody.querySelectorAll('.stat-bar-fill').forEach(fill => {
                fill.style.width = fill.getAttribute('data-width');
            });
        }, 50);
    }

    selectHero(character) {
        const card = document.getElementById(`card-${character.id}`);

        if (this.selectionTurn === 1) {
            this.player1Selected = character;
            this.grid.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected-p1'));
            if (card) card.classList.add('selected-p1');

            this.status.querySelector('.p1-status-badge').textContent = `P1: ${character.className} (${character.name})`;
            this.status.querySelector('.p1-status-badge').classList.add('selected');

            this.selectionTurn = 2;
            this.status.querySelector('.p2-status-badge').textContent = 'Oyuncu 2: Seçim Yapıyor...';
        } else {
            this.player2Selected = character;
            this.grid.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected-p2'));
            if (card) card.classList.add('selected-p2');

            this.status.querySelector('.p2-status-badge').textContent = `P2: ${character.className} (${character.name})`;
            this.status.querySelector('.p2-status-badge').classList.add('selected');

            // İki oyuncu da seçildi: 2 kişilik mod düğmesi aktifleşir
            this.startBtn.classList.remove('not-ready');
            const hint = document.getElementById('mode-hint');
            if (hint) hint.textContent = 'Her iki oyuncu da hazır — 2 kişilik oyna!';
        }

        this.closeModal();
    }

    closeModal() {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('active');
    }

    getSelection() {
        return { p1: this.player1Selected, p2: this.player2Selected };
    }
}
