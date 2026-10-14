// Prologun çizgi roman sahnesi.
//
// Prolog artık oynanmıyor: ormana girene kadar olan her şey kare kare
// anlatılıyor. Bu sınıf sayfayı çizer ve oyuncunun ilerletmesini dinler;
// akışın kendisi ComicPlayer'da, senaryo comicScript.js'te, kareler
// comicArt.js + art/ altında.
//
// Kontrol tek tuş: F / SPACE / ENTER, kolda ÇARPI. Balon yazılıyorsa önce
// yazıyı tamamlar, sonra kareyi ilerletir. ESC / DAİRE prologu bırakır.

import { FRAME_RATE, SCROLL_KEYS } from '../config/settings.js';
import { Sfx, unlockAudio, playMusic, stopMusic } from '../services/audio.js';
import { VOICE_PITCH } from '../adventure/dialogue.js';
import { drawSpeechBubble, wrapPixelText } from '../pixel/speech.js';
import { PANELS, CHAPTERS } from './comicScript.js';
import { ComicPlayer } from './ComicPlayer.js';
import {
    PAGE, AREA, drawPage, drawFrameEdge, drawCaption, drawPrompt,
    drawTitleCard, drawFade, drawPanelArt
} from './comicArt.js';

const BUBBLE_SCALE = 2;
const BUBBLE_MAX_W = 520;      // balonun en fazla genişliği (piksel)

// Bölümlere göre müzik: her bölümün kendi havası var
const CHAPTER_MUSIC = { 1: 'shadow', 2: 'ruin', 3: 'siege', 4: 'sewer', 5: 'ruin', 6: 'shadow' };

export class ComicScene {
    constructor({ canvas, input, gamepad, onExit, onFinish }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gamepad = gamepad || null;
        this.onExit = onExit || (() => {});
        this.onFinish = onFinish || (() => {});

        this.running = false;
        this.frame = 0;
        this.chapter = null;         // o an çalan bölüm müziği

        this.player = new ComicPlayer(PANELS, {
            onBeep: (who) => Sfx.talk(VOICE_PITCH[who] || 1),
            onPanel: (panel) => this.onPanelEnter(panel)
        });

        input.onKeyDown(e => {
            if (!this.running) return;
            unlockAudio();
            if (SCROLL_KEYS.includes(e.code)) e.preventDefault();
            if (e.code === 'Escape') this.onExit();
            if (e.code === 'KeyF' || e.code === 'Space' || e.code === 'Enter') this.advance();
        });

        this.gamepad?.onButtonDown(button => {
            if (!this.running) return;
            unlockAudio();
            if (button === 'circle') this.onExit();
            if (button === 'cross') this.advance();
        });
    }

    advance() {
        this.player.advance();
    }

    // Kareye girildi: bölüm müziği değiştiyse yenisi başlar, karenin açılış
    // sesi varsa çalar.
    onPanelEnter(panel) {
        if (panel.chapter !== this.chapter) {
            this.chapter = panel.chapter;
            playMusic(CHAPTER_MUSIC[panel.chapter] || 'shadow');
        }
        this.fired = new Set();
    }

    // Karenin hareketine bağlı sesler: motionT eşiği geçince bir kez çalar
    fireCues() {
        const panel = this.player.panel;
        if (!panel?.sfx) return;
        const t = this.player.motionT;
        for (const cue of panel.sfx) {
            if (this.fired.has(cue.name + cue.at) || t < cue.at) continue;
            this.fired.add(cue.name + cue.at);
            Sfx[cue.name]?.();
        }
    }

    start() {
        this.frame = 0;
        this.chapter = null;
        this.fired = new Set();
        this.running = true;
        this.ctx.imageSmoothingEnabled = false;
        this.player.start();

        if (this.rafId) cancelAnimationFrame(this.rafId);
        const stepMs = 1000 / FRAME_RATE;
        let acc = 0;
        let last = performance.now();

        const loop = (now) => {
            if (!this.running) return;
            this.rafId = requestAnimationFrame(loop);
            acc += Math.min(now - last, stepMs * 3);
            last = now;
            if (acc < stepMs) return;
            while (acc >= stepMs) {
                acc -= stepMs;
                this.step();
            }
            this.draw();
        };
        this.rafId = requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
        stopMusic();
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }

    step() {
        this.frame++;
        this.gamepad?.poll();
        this.player.step();
        this.fireCues();

        if (this.player.finished) {
            this.running = false;
            this.onFinish();
        }
    }

    draw() {
        const { ctx } = this;
        const panel = this.player.panel;
        if (!panel) return;
        const t = this.player.motionT;

        if (panel.art === 'title') {
            drawTitleCard(ctx, CHAPTERS.find(c => c.n === panel.chapter), t);
        } else {
            drawPage(ctx);
            drawPanelArt(ctx, panel, t);
            drawCaption(ctx, panel.caption);
            this.drawBubble();
            drawFrameEdge(ctx);
        }

        if (this.player.ready) drawPrompt(ctx, this.frame);
        // cont: kare öncekinin devamı, aynı çekim. Araya karartma girmiyor -
        // yoksa tek çekim her karede bir kez göz kırpmış gibi oluyor.
        drawFade(ctx, panel.cont ? 1 : this.player.alpha);
    }

    drawBubble() {
        const dialogue = this.player.dialogue;
        if (!dialogue.active) return;
        const text = dialogue.visibleText;
        if (!text) return;

        const [ax, ay] = dialogue.line.at || [PAGE.w / 2, PAGE.h * 0.6];
        const lines = wrapPixelText(text, BUBBLE_MAX_W, BUBBLE_SCALE);
        drawSpeechBubble(this.ctx, ax, ay, lines, {
            scale: BUBBLE_SCALE,
            viewLeft: AREA.x,
            viewW: AREA.w
        });
    }
}
