// Çıkış onayı: oynarken yanlışlıkla DAİRE'ye (ya da Esc'ye) basılınca ana menüye
// atılmasın. "Emin misin?" penceresi açılır, oyun donar. Varsayılan seçim HAYIR:
// DAİRE'ye ikinci kez basmak da vazgeçmek demektir.
//
// Klavye: sol/sağ seçer, Enter seçileni onaylar, Esc / H vazgeçer.
// Kol: sol/sağ yön tuşu seçer, ÇARPI onaylar, DAİRE vazgeçer. Fare de çalışır.
import { currentModal, setModal } from '../core/pause.js';

export class ExitConfirm {
    constructor({ gamepad } = {}) {
        this.overlay = document.getElementById('exit-confirm');
        this.yesBtn = document.getElementById('exit-confirm-yes');
        this.noBtn = document.getElementById('exit-confirm-no');
        this.open = false;
        this.index = 1;               // 0 evet, 1 hayır
        this.onYes = null;

        this.yesBtn.addEventListener('click', () => this.answer(true));
        this.noBtn.addEventListener('click', () => this.answer(false));
        window.addEventListener('keydown', (e) => this.onKey(e), true);
        gamepad?.onRawButtonDown((slot, button) => this.onButton(button));
    }

    // Çağıran: "çıkılsın mı?" diye sorar; evet denirse onYes çalışır
    ask(onYes) {
        if (this.open || currentModal()) return;
        this.onYes = onYes;
        this.open = true;
        setModal('exit');
        this.index = 1;
        this.overlay.classList.remove('hidden');
        this.refresh();
    }

    onKey(e) {
        if (!this.open) return;
        e.stopPropagation();
        const k = e.code;
        if (k === 'ArrowLeft' || k === 'KeyA') { e.preventDefault(); this.index = 0; this.refresh(); }
        else if (k === 'ArrowRight' || k === 'KeyD') { e.preventDefault(); this.index = 1; this.refresh(); }
        else if (k === 'Enter' || k === 'KeyE' || k === 'Space') { e.preventDefault(); this.answer(this.index === 0); }
        else if (k === 'Escape' || k === 'KeyH') { e.preventDefault(); this.answer(false); }
    }

    onButton(button) {
        if (!this.open) return;
        if (button === 'dpadLeft') { this.index = 0; this.refresh(); }
        else if (button === 'dpadRight') { this.index = 1; this.refresh(); }
        else if (button === 'cross') this.answer(this.index === 0);
        else if (button === 'circle') this.answer(false);
    }

    answer(yes) {
        if (!this.open) return;
        this.open = false;
        this.overlay.classList.add('hidden');
        const onYes = this.onYes;
        this.onYes = null;
        // Duraklama bir sonraki karede kalkar: aynı basış sahneye ulaşıp yeniden sormasın
        setTimeout(() => {
            setModal(null);
            if (yes && onYes) onYes();
        }, 0);
    }

    refresh() {
        this.yesBtn.classList.toggle('ghost', this.index !== 0);
        this.noBtn.classList.toggle('ghost', this.index !== 1);
        (this.index === 0 ? this.yesBtn : this.noBtn).focus();
    }
}
