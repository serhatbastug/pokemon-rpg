// Macera kapısının onay penceresi. Klasik oyunlardaki diyalog kutusu gibi
// görünsün diye piksel çerçeveli, köşesiz bir modal (style.css: .pixel-modal).
// Enter/E = evet, Esc/H = hayır; fare de çalışır.
export class StartPrompt {
    constructor({ onConfirm, onCancel }) {
        this.overlay = document.getElementById('start-prompt');
        this.yesBtn = document.getElementById('start-prompt-yes');
        this.noBtn = document.getElementById('start-prompt-no');
        this.onConfirm = onConfirm || (() => {});
        this.onCancel = onCancel || (() => {});
        this.open = false;

        this.yesBtn.addEventListener('click', () => this.confirm());
        this.noBtn.addEventListener('click', () => this.cancel());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.cancel();
        });

        window.addEventListener('keydown', (e) => {
            if (!this.open) return;
            // KeyF bilerek yok: pencereyi açan F'nin aynı olayı onaya dönüşmesin
            if (e.code === 'Enter' || e.code === 'KeyE') {
                e.preventDefault();
                this.confirm();
            } else if (e.code === 'Escape' || e.code === 'KeyH') {
                e.preventDefault();
                this.cancel();
            }
        });
    }

    show() {
        this.open = true;
        this.overlay.classList.remove('hidden');
        this.yesBtn.focus();
    }

    hide() {
        this.open = false;
        this.overlay.classList.add('hidden');
    }

    confirm() {
        if (!this.open) return;
        this.hide();
        this.onConfirm();
    }

    cancel() {
        if (!this.open) return;
        this.hide();
        this.onCancel();
    }
}
