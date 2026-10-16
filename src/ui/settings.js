// Ayarlar ekranı: klavyede L, kolda OPTIONS ile açılır/kapanır. Üç satır var:
// müziği aç/kapat, müzik sesi, efekt sesi (tık, konuşma, vuruş). Açıkken oyun
// donar (core/pause.js) ve girdi oyuna ulaşmaz.
//
// Klavye: yukarı/aşağı satır seçer, sol/sağ ayarlar (müzik satırında aç/kapat),
// Enter müziği açıp kapatır, L / Esc kapatır. Kol: yön tuşları aynı işi görür,
// ÇARPI aç/kapat, DAİRE ve OPTIONS kapatır. Fare de çalışır.
import {
    getAudioSettings, setMusicOn, setMusicVolume, setSfxVolume, unlockAudio, Sfx
} from '../services/audio.js';
import { setPaused } from '../core/pause.js';

const STEP = 0.1;
const ROWS = ['music-on', 'music-vol', 'sfx-vol'];

export class SettingsMenu {
    constructor({ gamepad } = {}) {
        this.overlay = document.getElementById('settings');
        this.rows = ROWS.map(id => this.overlay.querySelector(`[data-row="${id}"]`));
        this.toggle = this.overlay.querySelector('#settings-music-toggle');
        this.sliders = {
            'music-vol': this.overlay.querySelector('#settings-music-vol'),
            'sfx-vol': this.overlay.querySelector('#settings-sfx-vol')
        };
        this.values = {
            'music-vol': this.overlay.querySelector('#settings-music-vol-value'),
            'sfx-vol': this.overlay.querySelector('#settings-sfx-vol-value')
        };
        this.open = false;
        this.index = 0;

        this.toggle.addEventListener('click', () => this.toggleMusic());
        this.sliders['music-vol'].addEventListener('input', (e) => this.setVolume('music-vol', e.target.value / 100));
        this.sliders['sfx-vol'].addEventListener('input', (e) => this.setVolume('sfx-vol', e.target.value / 100));
        this.overlay.querySelector('#settings-close').addEventListener('click', () => this.close());
        this.rows.forEach((row, i) => row.addEventListener('mouseenter', () => this.select(i)));

        // Yakalama evresinde dinler: açıkken tuşlar oyuna hiç ulaşmaz
        window.addEventListener('keydown', (e) => this.onKey(e), true);
        gamepad?.onRawButtonDown((slot, button) => this.onButton(button));
    }

    onKey(e) {
        if (e.code === 'KeyL' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (!this.open && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) return;
            e.preventDefault();
            e.stopPropagation();
            this.open ? this.close() : this.show();
            return;
        }
        if (!this.open) return;
        e.stopPropagation();
        const k = e.code;
        if (k === 'Escape') { e.preventDefault(); this.close(); }
        else if (k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); this.select(this.index - 1); }
        else if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); this.select(this.index + 1); }
        else if (k === 'ArrowLeft' || k === 'KeyA') { e.preventDefault(); this.adjust(-1); }
        else if (k === 'ArrowRight' || k === 'KeyD') { e.preventDefault(); this.adjust(1); }
        else if (k === 'Enter' || k === 'Space') { e.preventDefault(); if (this.index === 0) this.toggleMusic(); }
    }

    onButton(button) {
        if (button === 'options') {
            this.open ? this.close() : this.show();
            return;
        }
        if (!this.open) return;
        if (button === 'dpadUp') this.select(this.index - 1);
        else if (button === 'dpadDown') this.select(this.index + 1);
        else if (button === 'dpadLeft') this.adjust(-1);
        else if (button === 'dpadRight') this.adjust(1);
        else if (button === 'cross' && this.index === 0) this.toggleMusic();
        else if (button === 'circle') this.close();
    }

    show() {
        unlockAudio();
        this.open = true;
        setPaused(true);
        this.index = 0;
        this.overlay.classList.remove('hidden');
        this.refresh();
    }

    close() {
        this.open = false;
        setPaused(false);
        this.overlay.classList.add('hidden');
    }

    select(i) {
        this.index = (i + ROWS.length) % ROWS.length;
        this.refresh();
    }

    toggleMusic() {
        setMusicOn(!getAudioSettings().musicOn);
        this.refresh();
    }

    adjust(dir) {
        const row = ROWS[this.index];
        if (row === 'music-on') {
            this.toggleMusic();
            return;
        }
        const key = row === 'music-vol' ? 'musicVol' : 'sfxVol';
        this.setVolume(row, Math.round((getAudioSettings()[key] + dir * STEP) * 10) / 10);
    }

    setVolume(row, value) {
        if (row === 'music-vol') setMusicVolume(value);
        else {
            setSfxVolume(value);
            Sfx.token();   // efekt seviyesini duyur
        }
        this.refresh();
    }

    refresh() {
        const s = getAudioSettings();
        this.toggle.textContent = s.musicOn ? 'AÇIK' : 'KAPALI';
        this.toggle.classList.toggle('off', !s.musicOn);
        this.sliders['music-vol'].value = Math.round(s.musicVol * 100);
        this.sliders['sfx-vol'].value = Math.round(s.sfxVol * 100);
        this.values['music-vol'].textContent = `%${Math.round(s.musicVol * 100)}`;
        this.values['sfx-vol'].textContent = `%${Math.round(s.sfxVol * 100)}`;
        this.rows.forEach((row, i) => row.classList.toggle('selected', i === this.index));
    }
}
