// Dövüşçülerin giriş animasyonları.
//
// Tur başlarken oynarlar ve karaktere aittirler. İkisinin de iskeleti aynı:
// ekranda sıradan bir adam durur, kamera ona doğru büyür, adam bir şey yapar
// ve yavaş yavaş virüse dönüşür.
//
//   ELECTRO-VİRÜS · sol elini havaya kaldırır, elinin ucunda yeşil virüs
//     belirir, ele şimşek çakar, dönüşüm YUKARIDAN (kalkan elden) aşağı iner.
//   ANTİ-VİRÜS    · BAŞKA bir adam; sağ bacağını kendine çekip hızla yere
//     vurur, kaplama AŞAĞIDAN (vuran ayaktan) yukarı çıkar.
//   VİRÜS         · ÜÇÜNCÜ bir adam; kendi eline bakar, yeşil elden yukarı
//     yürür, adam olduğu yere ERİR ve birikintiden çok daha iri bir kütle
//     yükselir. Burada dönüşüm örtme değil çöküş: taşıyıcı geriye kalmıyor.
//
// İkisinde de kaplanma sırasında karakter kafasını kendi SAĞINA hafifçe
// yatırır, dönüşüm tamamlanınca kafasını geri alır.
//
// İki oyuncunun da girişi varsa sırayla oynarlar: önce P1, sonra P2 (kuyruk
// Game'de tutulur).
//
// Piksel kalsın diye kamera ölçeği ÇEYREK adımlara yuvarlanır ve figür önce
// kendi tuvaline gerçek boyunda çizilip sonra büyütülerek basılır; doğrudan
// ctx.scale ile çizmek ızgarayı kaydırıp pikselleri titretiyordu.

import { PX, newCanvas, blk, hash } from '../pixel/pixelDraw.js';
import {
    paintIntroFigure, paintIntroCarrier, drawElectroSparks,
    antivirusSprite, virusSprite,
    FIGURE_SIZE, CARRIER_SIZE, VIRUS_SIZE, VIRUS_EYES
} from './fighterArt.js';

export const INTRO_FRAMES = 260;              // ELECTRO-VİRÜS
export const ANTIVIRUS_INTRO_FRAMES = 240;
export const VIRUS_INTRO_FRAMES = 270;

const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;

// Kamera geri açılırken kullanılan ortak pencere
const ZOOM_OUT = [0.90, 1.00];

// --- Ortak iskelet ---
//
// Alt sınıflar dört şey verir: süre, o andaki duruş (state), adamın ve
// virüsün çizimi, bir de figürün üstüne binen efektler (overlay).
class BaseIntro {
    constructor({ x, footY, canvas, size, reveal }) {
        this.x = x;
        this.footY = footY;
        this.canvas = canvas;
        this.reveal = reveal;         // 'top' = yukarıdan iner · 'bottom' = aşağıdan çıkar
        this.frame = 0;

        this.figW = size.cols * size.px;
        this.figH = size.rows * size.px;
        const off = newCanvas(this.figW, this.figH);
        this.off = off.canvas;
        this.offCtx = off.ctx;
    }

    get done() {
        return this.frame >= this.frames;
    }

    // Bir kare ilerletir; bittiyse true döner
    step() {
        this.frame++;
        return this.done;
    }

    // Kamera: karakter YERİNDE durur, sahne onun AYAKLARINI sabit tutarak
    // büyür. Önceden figür ekranın ortasına doğru kayıyordu; o "kamera
    // yaklaştı" değil "karakter ortaya yürüdü" gibi duruyordu.
    //
    // Ölçek çeyrek adımlara yuvarlanıyor ve 2'yi geçmiyor: figür 200 küsur
    // piksel, daha fazlası arena tuvaline sığmıyor.
    camera() {
        const t = this.frame / this.frames;
        const zoomK = easeOut(span(t, 0, 0.28)) - easeOut(span(t, ZOOM_OUT[0], ZOOM_OUT[1]));
        return {
            scale: Math.max(1, Math.round((1 + zoomK) * 4) / 4),
            x: this.x,
            y: Math.min(this.footY, this.canvas.height - 12)
        };
    }

    draw(ctx) {
        const t = this.frame / this.frames;
        const { canvas } = this;
        const s = this.state(t);

        // Sahne kararır: dikkat adamda kalsın
        const dark = Math.min(0.6, span(t, 0, 0.25) * 0.6) * (1 - span(t, ZOOM_OUT[0], ZOOM_OUT[1]));
        if (dark > 0) {
            ctx.fillStyle = `rgba(4, 6, 14, ${dark})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const { scale, x: drawX, y: drawFootY } = this.camera();

        // Figür kendi tuvaline gerçek boyunda çiziliyor
        const octx = this.offCtx;
        octx.clearRect(0, 0, this.figW, this.figH);
        const man = this.paintMan(octx, s);

        // Dönüşüm: virüs hâli kırpılarak açılıyor
        if (s.turn > 0) {
            const cut = Math.round((this.figH * s.turn) / PX) * PX;
            const top = this.reveal === 'top' ? 0 : this.figH - cut;
            octx.save();
            octx.beginPath();
            octx.rect(0, top, this.figW, cut);
            octx.clip();
            this.paintVirus(octx, s);
            octx.restore();
            if (s.turn < 1) this.paintFront(octx, this.reveal === 'top' ? cut : top);
        }

        // Vuruş sarsıntısı: kamera değil, figürün kendisi titriyor
        const shake = s.shake ? Math.round(Math.sin(this.frame * 2.2) * s.shake * 3) : 0;

        const dw = Math.round(this.figW * scale);
        const dh = Math.round(this.figH * scale);
        const dx = Math.round(drawX - dw / 2) + shake;
        const dy = Math.round(drawFootY - dh);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.off, dx, dy, dw, dh);

        this.overlay(ctx, s, { dx, dy, scale, drawX, drawFootY, man, unit: PX * scale });
    }

    // Dönüşüm cephesi: yalnızca ÇİZİLMİŞ piksellerin üstüne düşsün. Düz
    // çizilince figürün iki yanındaki boşluğa da uzanıyor ve adamın önünden
    // geçen bir çubuk gibi duruyordu. Kenarı da düz değil: her karede
    // kıpırdayan bir blok, cepheyi akan bir sınır gibi gösteriyor.
    paintFront(octx, y) {
        octx.save();
        octx.globalCompositeOperation = 'source-atop';
        for (let x = 0; x < this.figW; x += PX) {
            const wob = hash(x, Math.floor(this.frame / 3), 9) < 0.4 ? PX : 0;
            blk(octx, x, y - PX + wob, PX, PX, this.frontColors[0]);
            blk(octx, x, y + wob, PX, PX, this.frontColors[1]);
        }
        octx.restore();
    }

    overlay() {}
}

// ================= ELECTRO-VİRÜS =================

const E_RAISE = [0.26, 0.42];
const E_BLOB = [0.42, 0.60];
const E_STRIKE = [0.58, 0.66];
const E_MORPH = [0.62, 0.90];

// Yeşil virüsün parmak ucunda beliren küçük hâli: gevşek, sarkan bir kütle
function virusBlob(ctx, x, y, size, u) {
    if (size < 1) return;
    const put = (bx, by, bw, bh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
    };
    const rows = Math.max(1, Math.round(size));
    for (let i = 0; i < rows; i++) {
        const k = i / rows;
        const half = Math.max(1, Math.round((1 - k * 0.35) * size * 0.55));
        const cxo = x + Math.round(Math.sin(k * 3) * 1) * u;
        put(cxo - half * u, y - (rows - i) * u, half * 2 * u, u, '#4a7c1f');
        put(cxo - half * u, y - (rows - i) * u, u, u, '#16260a');
        put(cxo + (half - 1) * u, y - (rows - i) * u, u, u, '#2f5312');
        if (i === 1) put(cxo - u, y - (rows - i) * u, u * 2, u, '#8fc23a');
    }
    // Parmaktan sarkan iki damla
    put(x - u * 2, y - u, u, u * 2, '#2f5312');
    put(x + u, y - u, u, u * 3, '#2f5312');
}

// Ekranın üstünden ele inen şimşek. Her karede yeniden kırılıyor.
function bolt(ctx, x, y, frame, u) {
    let px = x;
    let py = 0;
    const step = u * 3;
    const width = u * 3;
    while (py < y) {
        const r = hash(py, Math.floor(frame / 2), 5);
        const jag = Math.round((r - 0.5) * 5) * u;
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(Math.round(px), Math.round(py), Math.round(width), Math.round(step));
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(Math.round(px + u), Math.round(py), Math.round(width - u * 2), Math.round(step));
        px += jag;
        py += step;
    }
}

export class ElectroIntro extends BaseIntro {
    constructor(opts) {
        super({ ...opts, size: FIGURE_SIZE, reveal: 'top' });
        this.key = 'electro';
        this.frontColors = ['#ffd23f', '#fff3b0'];
    }

    get frames() {
        return INTRO_FRAMES;
    }

    state(t) {
        return {
            t,
            armRaise: span(t, E_RAISE[0], E_RAISE[1]) - span(t, ZOOM_OUT[0], ZOOM_OUT[1]),
            turn: easeOut(span(t, E_MORPH[0], E_MORPH[1])),
            // Kaplanma başlarken kafa yana yatıyor, dönüşüm bitince düzeliyor
            headTilt: span(t, E_MORPH[0], E_MORPH[0] + 0.06) - span(t, 0.82, 0.90),
            blob: span(t, E_BLOB[0], E_BLOB[1]) * (1 - span(t, E_STRIKE[0], E_STRIKE[1])),
            strike: span(t, E_STRIKE[0], E_STRIKE[1]),
            shake: 0
        };
    }

    paintMan(octx, s) {
        return paintIntroFigure(octx, this.figW / 2, this.figH,
            { mode: 'man', armRaise: s.armRaise, headTilt: s.headTilt });
    }

    paintVirus(octx, s) {
        paintIntroFigure(octx, this.figW / 2, this.figH,
            { mode: 'electro', armRaise: s.armRaise, headTilt: s.headTilt });
    }

    overlay(ctx, s, geo) {
        const handX = Math.round(geo.dx + geo.man.hand.x * geo.scale);
        const handY = Math.round(geo.dy + geo.man.hand.y * geo.scale);

        // Parmak ucunda beliren yeşil virüs
        if (s.blob > 0.02) virusBlob(ctx, handX, handY, 3 + s.blob * 5, geo.unit);

        // Şimşek ve beyaz patlama
        if (s.strike > 0 && s.strike < 1) {
            bolt(ctx, handX, handY, this.frame, geo.unit);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * (1 - s.strike) ** 2})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Dönüşüm ilerledikçe elektrik kuvvetleniyor
        if (s.turn > 0.05) {
            drawElectroSparks(ctx, geo.drawX, geo.drawFootY, this.frame, s.turn, geo.unit);
        }
    }
}

// ================= ANTİ-VİRÜS =================

const A_LIFT = [0.30, 0.44];      // sağ bacak kendine doğru çekiliyor
const A_SLAM = [0.44, 0.475];     // hızla yere iniyor
const A_COVER = [0.50, 0.90];     // kaplama vuran ayaktan yukarı çıkıyor

// Ayağın yere vurduğu an: tabandan iki yana açılan toz ve mercan kırıntısı
function stomp(ctx, x, y, k, u) {
    if (k <= 0 || k >= 1) return;
    const put = (bx, by, bw, bh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
    };
    const reach = easeOut(k) * 11;
    const fade = 1 - k;
    for (const dir of [-1, 1]) {
        for (let i = 1; i <= 4; i++) {
            const d = reach * (i / 4);
            const lift = Math.round(Math.sin((i / 4) * Math.PI) * 2 * fade) * u;
            put(x + dir * d * u, y - u - lift, u * 2, u, i > 2 ? '#c9503a' : '#f2795c');
        }
    }
    // Tabanın altında yassılan toz
    put(x - Math.round(reach * 0.6) * u, y - u, Math.round(reach * 1.2) * u, u, '#5e1d14');
}

export class AntivirusIntro extends BaseIntro {
    constructor(opts) {
        super({ ...opts, size: CARRIER_SIZE, reveal: 'bottom' });
        this.key = 'antivirus';
        this.frontColors = ['#c9503a', '#ff9f7e'];
    }

    get frames() {
        return ANTIVIRUS_INTRO_FRAMES;
    }

    state(t) {
        // Bacak yavaş kalkıyor, sonra bir anda düşüyor: vuruşun sertliği bu
        // iki hız arasındaki farktan geliyor.
        const legLift = easeOut(span(t, A_LIFT[0], A_LIFT[1])) * (1 - span(t, A_SLAM[0], A_SLAM[1]));
        return {
            t,
            legLift,
            // Kaplama AŞAĞIDAN çıkıyor; easeIn ile kafa en sona kalıyor,
            // böylece yatık kafa daha kaplanmadan düzelmiş oluyor.
            turn: easeIn(span(t, A_COVER[0], A_COVER[1])),
            headTilt: span(t, A_COVER[0], A_COVER[0] + 0.08) - span(t, 0.78, 0.86),
            stomp: span(t, A_SLAM[1], A_SLAM[1] + 0.09),
            shake: 1 - span(t, A_SLAM[1], A_SLAM[1] + 0.05)
        };
    }

    paintMan(octx, s) {
        paintIntroCarrier(octx, this.figW / 2, this.figH,
            { legLift: s.legLift, headTilt: s.headTilt });
        return { hand: { x: this.figW / 2, y: this.figH } };
    }

    paintVirus(octx) {
        // Bitmiş hâl doğrudan sprite'ın kendisi: taşıyıcı ikisinde de aynı
        // çizimden (paintCarrier) geldiği için birebir hizalanıyor.
        octx.drawImage(antivirusSprite().canvas, 0, 0);
    }

    overlay(ctx, s, geo) {
        if (s.stomp > 0 && s.stomp < 1) {
            // Vuran ayak karakterin sağı, yani izleyicinin solunda
            const footX = geo.drawX - CARRIER_SIZE.px * 4 * geo.scale;
            stomp(ctx, footX, geo.drawFootY, s.stomp, geo.unit);
        }
    }
}

// ================= VİRÜS =================
//
// Diğer ikisi KAPLANMA: taşıyıcı ayakta kalır, üstü örtülür. Yeşil virüsün
// hikâyesi bu değil - onda insanın kendisi gider. Bu yüzden burada dönüşüm
// bir örtme değil, bir ÇÖKÜŞ:
//
//   üçüncü bir adam elini kaldırıp kendi eline bakar → yeşil deriden yukarı
//   yürür → adam ayakta duramaz, olduğu yere ERİR → yerde büyüyen birikintiden
//   virüs YÜKSELİR, adamdan çok daha iri → gözleri en son yanar.
//
// Bu yüzden iskelet eşleşmesi de gerekmiyor: adam yok olurken virüs ayrı bir
// çizim olarak aşağıdan büyüyor. Tuval ikisini de alacak kadar geniş.

const V_LOOK = [0.22, 0.36];      // elini kaldırıp bakıyor
const V_SPREAD = [0.30, 0.54];    // yeşil elden yukarı yürüyor
const V_MELT = [0.46, 0.62];      // ayakta duramıyor, eriyor
const V_RISE = [0.62, 0.88];      // birikintiden yükseliyor
const V_WAKE = [0.86, 0.94];      // gözler yanıyor

const V_INTRO_SIZE = { cols: VIRUS_SIZE.cols, rows: FIGURE_SIZE.rows, cx: VIRUS_SIZE.cols / 2, px: PX };

// Erirken etrafa savrulan damlalar: kütlenin katı olmadığını burada da söylüyor
function splash(ctx, x, y, k, u, frame) {
    if (k <= 0 || k >= 1) return;
    const put = (bx, by, bw, bh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
    };
    for (let i = 0; i < 10; i++) {
        const dir = i % 2 ? 1 : -1;
        const speed = 6 + hash(i, 0, 71) * 10;
        const d = easeOut(k) * speed;
        // Yerçekimi: damla önce yükseliyor, sonra düşüyor
        const rise = Math.sin(k * Math.PI) * (3 + hash(i, 1, 72) * 5);
        put(x + dir * d * u, y - rise * u, u * (hash(i, 2, 73) < 0.4 ? 2 : 1), u,
            hash(i, 3, 74) < 0.4 ? '#2f5312' : '#4a7c1f');
    }
    // Tabanda genişleyen halka
    const ring = Math.round(easeOut(k) * 16);
    put(x - ring * u, y - u, ring * 2 * u, u, '#2f5312');
    if (frame % 4 < 2) put(x - ring * u, y - u * 2, u * 2, u, '#8fc23a');
}

export class VirusIntro extends BaseIntro {
    constructor(opts) {
        super({ ...opts, size: V_INTRO_SIZE, reveal: 'bottom' });
        this.key = 'virus';
        this.frontColors = ['#2f5312', '#8fc23a'];
    }

    get frames() {
        return VIRUS_INTRO_FRAMES;
    }

    state(t) {
        return {
            t,
            // Kolunu yarıya kadar kaldırıyor: havaya değil, kendi eline bakıyor
            armRaise: span(t, V_LOOK[0], V_LOOK[1]) * 0.45 * (1 - span(t, V_MELT[0], V_MELT[0] + 0.08)),
            green: span(t, V_SPREAD[0], V_SPREAD[1]),
            headTilt: span(t, 0.44, 0.50) - span(t, 0.58, 0.64),
            sink: easeIn(span(t, V_MELT[0], V_MELT[1])),
            pool: span(t, V_MELT[0] - 0.02, V_RISE[0]),
            splash: span(t, V_MELT[1] - 0.10, V_MELT[1] + 0.06),
            turn: easeOut(span(t, V_RISE[0], V_RISE[1])),
            wake: span(t, V_WAKE[0], V_WAKE[1]),
            shake: span(t, V_MELT[1] - 0.06, V_MELT[1]) * (1 - span(t, V_MELT[1], V_MELT[1] + 0.06))
                + span(t, V_WAKE[0], V_WAKE[0] + 0.02) * (1 - span(t, V_WAKE[0] + 0.02, V_WAKE[1]))
        };
    }

    paintMan(octx, s) {
        // Adam eriyor: aşağı kayıyor, tuvalin dibinden taşan kısmı kırpılıyor.
        // Yani siluet tepeden kısalıyor - yere gömülüyor gibi.
        const drop = Math.round((s.sink * this.figH) / PX) * PX;
        octx.save();
        octx.translate(0, drop);
        const man = paintIntroFigure(octx, this.figW / 2, this.figH,
            { mode: 'man', armRaise: s.armRaise, headTilt: s.headTilt, manPalette: 'c' });
        octx.restore();

        // Yeşillenme: elden başlayıp yukarı yürüyen damarlar, sonra tenin
        // tamamına inen yeşil. source-atop olmadan adamın dışına da düşüyor.
        if (s.green > 0.02) {
            octx.save();
            octx.globalCompositeOperation = 'source-atop';
            const reach = this.figH * s.green;
            for (let i = 0; i < 26; i++) {
                const gx = Math.round(hash(i, 0, 61) * V_INTRO_SIZE.cols) * PX;
                const gy = this.figH - Math.round(hash(i, 1, 62) * (reach / PX)) * PX + drop;
                blk(octx, gx, gy, PX, PX * (hash(i, 2, 63) < 0.4 ? 2 : 1), '#4a7c1f');
            }
            octx.fillStyle = `rgba(74, 124, 31, ${0.55 * s.green})`;
            octx.fillRect(0, 0, this.figW, this.figH);
            octx.restore();
        }

        // Ayakların dibinde büyüyen birikinti
        if (s.pool > 0.02) {
            const rows = Math.max(1, Math.round(s.pool * 7));
            for (let i = 0; i < rows; i++) {
                const half = Math.round(s.pool * 21 * (1 - i * 0.12));
                if (half < 1) continue;
                blk(octx, this.figW / 2 - half * PX, this.figH - (i + 1) * PX,
                    half * 2 * PX, PX, i === 0 ? '#2f5312' : '#4a7c1f');
            }
        }

        return { hand: { x: man.hand.x, y: man.hand.y + drop } };
    }

    paintVirus(octx) {
        // Virüs sprite'ı tuvalin dibine, ortaya oturuyor. Adamdan iri olması
        // yükselişin bütün numarası: aynı yerden çok daha büyük bir şey çıkıyor.
        const sprite = virusSprite();
        octx.drawImage(sprite.canvas, Math.round(this.figW / 2 - sprite.ox), this.figH - sprite.oy);
    }

    overlay(ctx, s, geo) {
        if (s.splash > 0 && s.splash < 1) {
            splash(ctx, geo.drawX, geo.drawFootY, s.splash, geo.unit, this.frame);
        }

        // Gözler en son yanıyor: dönüşümün "tamam" dediği an
        if (s.wake > 0 && s.wake < 1) {
            const sprite = virusSprite();
            const eyeX = geo.dx + (this.figW / 2 - sprite.ox + VIRUS_EYES.col * PX) * geo.scale;
            const eyeY = geo.dy + (this.figH - sprite.oy + VIRUS_EYES.row * PX) * geo.scale;
            const glow = (1 - s.wake) ** 2;
            ctx.fillStyle = `rgba(217, 246, 90, ${0.9 * glow})`;
            ctx.fillRect(Math.round(eyeX - geo.unit), Math.round(eyeY - geo.unit / 2),
                Math.round(geo.unit * 10), Math.round(geo.unit * 3));
            ctx.fillStyle = `rgba(140, 220, 70, ${0.28 * glow})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// Kadrodaki 'intro' anahtarının karşılığı. Ayrı bir kayıt olarak duruyor ki
// tarayıcısız veri testi de anahtarların karşılığı var mı diye bakabilsin
// (sınıfın kendisi tuval istiyor, node'da kurulamıyor).
export const INTROS = {
    virus: VirusIntro,
    electro: ElectroIntro,
    antivirus: AntivirusIntro
};

// Bu oyuncunun girişi varsa örneğini üretir
export function introFor(player, canvas) {
    const Intro = INTROS[player.fighter.intro];
    return Intro ? new Intro({ x: player.x, footY: player.footY, canvas }) : null;
}
