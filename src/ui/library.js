import { PARTY_SIZE } from '../config/progression.js';
import { fetchCharacter } from '../services/pokeapi.js';

// Pokemon kütüphanesi: ekip, koleksiyon ve jeton harcama ekranı.
// Jetonlar burada istenen Pokemona yatırılıp seviye yükseltilir.
export class Library {
    constructor({ progress, onLevelUp, onPartyChange }) {
        this.progress = progress;
        this.onLevelUp = onLevelUp;
        this.onPartyChange = onPartyChange;
        this.cache = new Map();

        this.overlay = document.getElementById('library-overlay');
        this.tokenLine = document.getElementById('library-tokens');
        this.partyList = document.getElementById('library-party');
        this.collectionList = document.getElementById('library-collection');

        document.getElementById('library-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    get isOpen() {
        return !this.overlay.classList.contains('hidden');
    }

    sprite(id) {
        if (!this.cache.has(id)) this.cache.set(id, fetchCharacter({ id }));
        return this.cache.get(id);
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active'); // görünürlük ve tıklanabilirlik
        this.render();
    }

    close() {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('active');
    }

    render() {
        const { progress } = this;
        this.tokenLine.textContent =
            `${progress.tokens} yetenek jetonu · Ekip ${progress.party.length}/${PARTY_SIZE} · ` +
            `${progress.collection.length} yakalanan · ${progress.badges.length} mekan tamamlandı`;

        // --- Ekip ---
        this.partyList.innerHTML = '';
        progress.party.forEach((member, index) => {
            const cost = progress.costToLevel(index);
            const affordable = cost !== null && progress.tokens >= cost;

            const card = document.createElement('div');
            card.className = 'lib-card';
            if (index === progress.activeIndex) card.classList.add('active');
            card.innerHTML = `
                <div class="lib-img-slot"></div>
                <div class="lib-name">${member.name}</div>
                <div class="lib-level">Seviye ${member.level}</div>
                <button class="lib-btn ${affordable ? '' : 'disabled'}">
                    ${cost === null ? 'Maks. seviye' : `Seviye atlat (${cost} jeton)`}
                </button>
                ${index > 0 ? '<button class="lib-remove">Ekipten çıkar</button>' : '<div class="lib-tag">Başlangıç</div>'}
            `;

            const levelBtn = card.querySelector('.lib-btn');
            levelBtn.addEventListener('click', () => {
                if (!progress.spendOnLevel(index)) return;
                this.onLevelUp(index);
                this.render();
            });

            const removeBtn = card.querySelector('.lib-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (!progress.removeFromParty(index)) return;
                    this.onPartyChange();
                    this.render();
                });
            }

            this.partyList.appendChild(card);
            this.fillSprite(card, member.formId);
        });

        // --- Koleksiyon (ekipte olmayanlar) ---
        this.collectionList.innerHTML = '';
        const partyIds = new Set(progress.party.map(p => p.id));
        const benched = progress.collection
            .map((entry, i) => ({ ...entry, index: i }))
            .filter(entry => !partyIds.has(entry.id));

        if (!benched.length) {
            this.collectionList.innerHTML = '<p class="lib-empty">Ekip dışında Pokemon yok. Yabani Pokemonları bayıltıp N ile yakalayın.</p>';
            return;
        }

        for (const entry of benched) {
            const card = document.createElement('div');
            card.className = 'lib-card small';
            card.innerHTML = `
                <div class="lib-img-slot"></div>
                <div class="lib-name">${entry.name}</div>
                <button class="lib-btn ${progress.partyFull ? 'disabled' : ''}">
                    ${progress.partyFull ? 'Ekip dolu' : 'Ekibe al'}
                </button>
            `;
            card.querySelector('.lib-btn').addEventListener('click', () => {
                if (!progress.swapIntoParty(entry.index)) return;
                this.onPartyChange();
                this.render();
            });
            this.collectionList.appendChild(card);
            this.fillSprite(card, entry.id);
        }
    }

    fillSprite(card, id) {
        this.sprite(id).then(data => {
            const slot = card.querySelector('.lib-img-slot');
            if (slot) slot.innerHTML = `<img class="lib-img" src="${data.sprite}" alt="${data.name}">`;
        }).catch(() => {});
    }
}
