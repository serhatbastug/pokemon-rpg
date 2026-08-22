import { PLAYABLE } from '../config/playableCharacters.js';
import { fetchCharacter } from '../services/pokeapi.js';

// Macera moduna başlarken karakter seçimi. Başlangıç Pokemonu her zaman
// listede olur; yakalanan bosslar da oynanabilir karakter olarak eklenir.
export class AdventurePicker {
    constructor({ progress, onStart, onReset }) {
        this.progress = progress;
        this.onStart = onStart;
        this.onReset = onReset;
        this.cache = new Map();

        this.overlay = document.getElementById('adventure-picker');
        this.list = document.getElementById('picker-list');
        this.progressLine = document.getElementById('picker-progress');

        document.getElementById('picker-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        document.getElementById('picker-reset').addEventListener('click', () => {
            if (!confirm('Kayıt silinecek: seviye, yakalananlar ve ilerleme sıfırlanacak. Emin misiniz?')) return;
            this.progress.clear();
            this.onReset();
            this.render();
        });
    }

    fetchCached(id) {
        if (!this.cache.has(id)) this.cache.set(id, fetchCharacter({ id }));
        return this.cache.get(id);
    }

    open() {
        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active');
        this.render();
    }

    close() {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('active');
    }

    render() {
        const { progress } = this;
        const ids = progress.playableCharacters;

        this.progressLine.textContent =
            `Seviye ${progress.level} · ${progress.xp}/${progress.xpNeeded} XP · ` +
            `${progress.captures.length} yakalanan · ${progress.defeatedBosses.length} mekan tamamlandı`;

        this.list.innerHTML = '';
        for (const id of ids) {
            const card = document.createElement('div');
            card.className = 'picker-item';
            if (id === progress.characterId) card.classList.add('selected');

            const isStarter = PLAYABLE[id]?.starter;
            // Başlangıç karakteri evrimleşmiş formuyla gösterilir
            const displayId = isStarter ? progress.formId : id;

            card.innerHTML = `
                <div class="picker-img-slot"><div class="picker-spinner">...</div></div>
                <div class="picker-name">Yükleniyor</div>
                <div class="picker-tag">${isStarter ? 'Başlangıç' : 'Yakalanan Boss'}</div>
            `;
            card.addEventListener('click', () => {
                progress.selectCharacter(id);
                this.close();
                this.onStart(id);
            });
            this.list.appendChild(card);

            this.fetchCached(displayId).then(character => {
                card.querySelector('.picker-img-slot').innerHTML =
                    `<img class="picker-img" src="${character.sprite}" alt="${character.name}">`;
                card.querySelector('.picker-name').textContent = character.name;
            }).catch(() => {
                card.querySelector('.picker-name').textContent = `#${displayId}`;
            });
        }
    }
}
