// Bölüm seçme penceresi: macera kapısında EVET denince açılır, prologun
// hangi bölümden başlayacağını seçtirir. Yukarı/aşağı + Enter, rakam tuşları
// (1-9), fare ve kol (yön tuşu + ÇARPI) çalışır; Esc / DAİRE vazgeçer.
import { CHAPTERS } from '../comic/comicScript.js';

export class ChapterSelect {
    constructor({ onPick, onCancel }) {
        this.overlay = document.getElementById('chapter-select');
        this.list = document.getElementById('chapter-list');
        this.onPick = onPick || (() => {});
        this.onCancel = onCancel || (() => {});
        this.open = false;
        this.index = 0;

        this.buttons = CHAPTERS.map((chapter, i) => {
            const btn = document.createElement('button');
            btn.className = 'pixel-btn chapter-btn';
            btn.dataset.chapter = String(chapter.n);
            btn.textContent = `${chapter.n}. ${chapter.title}`;
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
        this.onPick(CHAPTERS[i].n);
    }

    cancel() {
        if (!this.open) return;
        this.hide();
        this.onCancel();
    }
}
