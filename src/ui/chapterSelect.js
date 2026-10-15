// Bölüm seçme penceresi: macera kapısında EVET denince açılır, prologun
// hangi bölümden başlayacağını seçtirir. Yukarı/aşağı + Enter, rakam tuşları
// (1-9), fare ve kol (yön tuşu + ÇARPI) çalışır; Esc / DAİRE vazgeçer.
import { CHAPTERS } from '../comic/comicScript.js';
import { PLAY_ENTRIES } from '../adventure/adventureScript.js';

export class ChapterSelect {
    constructor({ onPick, onCancel }) {
        this.overlay = document.getElementById('chapter-select');
        this.list = document.getElementById('chapter-list');
        this.onPick = onPick || (() => {});
        this.onCancel = onCancel || (() => {});
        this.open = false;
        this.index = 0;

        // Çizgi roman bölümleri + sonda oynanış girişleri (sıra numarası devam eder)
        this.entries = [
            ...CHAPTERS.map(chapter => ({ pick: chapter.n, key: String(chapter.n), text: `${chapter.n}. ${chapter.title}` })),
            ...PLAY_ENTRIES.map((entry, i) => ({ pick: entry.id, key: entry.id, text: `${CHAPTERS.length + i + 1}. ${entry.title} (${entry.label})` }))
        ];

        this.buttons = this.entries.map((entry, i) => {
            const btn = document.createElement('button');
            btn.className = 'pixel-btn chapter-btn';
            btn.dataset.chapter = entry.key;
            btn.textContent = entry.text;
            btn.addEventListener('click', () => this.pick(i));
            this.list.appendChild(btn);
            return btn;
        });

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.cancel();
        });

        window.addEventListener('keydown', (e) => {
            if (!this.open) return;
            if (e.code === 'ArrowDown' || e.code === 'KeyS') {
                e.preventDefault();
                this.move(1);
            } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                e.preventDefault();
                this.move(-1);
            } else if (e.code === 'Enter') {
                e.preventDefault();
                this.pick(this.index);
            } else if (e.code === 'Escape') {
                e.preventDefault();
                this.cancel();
            } else if (/^Digit[1-9]$/.test(e.code)) {
                const i = Number(e.code.slice(5)) - 1;
                if (i < this.buttons.length) this.pick(i);
            }
        });
    }

    show() {
        this.open = true;
        this.overlay.classList.remove('hidden');
        this.focus(0);
    }

    hide() {
        this.open = false;
        this.overlay.classList.add('hidden');
    }

    focus(i) {
        this.index = (i + this.buttons.length) % this.buttons.length;
        this.buttons[this.index].focus();
    }

    move(step) {
        this.focus(this.index + step);
    }

    pick(i) {
        if (!this.open) return;
        this.hide();
        this.onPick(this.entries[i].pick);
    }

    cancel() {
        if (!this.open) return;
        this.hide();
        this.onCancel();
    }
}
