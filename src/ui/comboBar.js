// Arenanın altındaki kombo kümesi: her oyuncu için tek noktadan çıkan dört
// daire. Hiç kaybolmuyor - küçük ama sürekli orada.
//
// Tek nokta = KOMBO TUŞU (kolda L1, klavyede SHIFT). Dört daire ona bağlı,
// her dairenin içinde hamlenin simgesi, altında o hamleyi açan İKİNCİ tuş.
// Modifiye tuşunu dört kez yazmak yerine bağlandıkları noktaya bir kez yazmak
// hem yeri açıyor hem "bunlar hep L1 ile" bilgisini şeklin kendisi anlatıyor.
//
// Bekleme süresi dairenin içinde: dolduğu kadarı karanlık kalıyor, ortada da
// kalan saniye yazıyor.

import { PX } from '../pixel/pixelDraw.js';
import { drawPixelText } from '../pixel/pixelFont.js';
import { comboAbilities } from '../game/abilities.js';
import { keyCapLabel } from '../game/combat.js';

export const COMBO_BAR_HEIGHT = 132;

const R = 23;              // daire yarıçapı
const SPACING = 64;        // daire aralığı
const CIRCLE_Y = 44;
const ANCHOR_Y = 106;
const LABEL_Y = CIRCLE_Y + R + 8;

const BG = '#0b1220';
const RING = '#334155';
const FACE = '#111a2b';
const DIM = 'rgba(2,6,23,0.72)';
const TEXT = '#94a3b8';

// Kolda ikinci tuşun adı; klavyede oyuncunun kendi tuşu.
const PAD_LABEL = { cross: 'ÇARPI', square: 'KARE', circle: 'DAİRE', triangle: 'ÜÇGEN' };
const ARROW_LABEL = { ArrowUp: 'YUK', ArrowLeft: 'SOL', ArrowRight: 'SAĞ' };

function secondKeyLabel(player, ability) {
    if (player.onPad) return PAD_LABEL[ability.padCombo[1]] || '';
    const code = ability.keySlot === 'attack'
        ? player.actionKeys.attack
        : player.controls[ability.keySlot];
    return ARROW_LABEL[code] || keyCapLabel(code);
}

// ---- simgeler ----
// Hepsi dairenin merkezine göre, PX ızgarasında. Ok uçları düz kesik: piksel
// dilinde eğik kenar yok.

// Ok: üç basamaklı bir kama ve arkasında gövde. Uç en ince basamak.
function arrow(ctx, cx, cy, axis, sign) {
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 3; i++) {
        const t = PX * (1 + i);                       // yarı kalınlık
        const at = sign * PX * (4 - i);               // uçtan geriye
        if (axis === 'x') ctx.fillRect(cx + at, cy - t, PX, t * 2);
        else ctx.fillRect(cx - t, cy + at, t * 2, PX);
    }
    if (axis === 'x') {
        ctx.fillRect(sign < 0 ? cx - PX * 2 : cx - PX * 4, cy - PX, PX * 6, PX * 2);
    } else {
        ctx.fillRect(cx - PX, sign < 0 ? cy - PX * 2 : cy - PX * 4, PX * 2, PX * 6);
    }
}

const ICONS = {
    dashLeft: (ctx, cx, cy) => arrow(ctx, cx, cy, 'x', -1),
    dashRight: (ctx, cx, cy) => arrow(ctx, cx, cy, 'x', 1),
    dashUp: (ctx, cx, cy) => arrow(ctx, cx, cy, 'y', -1),

    // Salgın izi: yere yayılmış birikinti
    trail: (ctx, cx, cy) => {
        ctx.fillStyle = '#3f5f16';
        ctx.fillRect(cx - PX * 5, cy + PX, PX * 10, PX * 3);
        ctx.fillStyle = '#6ea32c';
        ctx.fillRect(cx - PX * 4, cy + PX * 2, PX * 8, PX * 2);
        ctx.fillStyle = '#87c33a';
        ctx.fillRect(cx - PX * 3, cy - PX, PX * 2, PX * 2);
        ctx.fillRect(cx + PX * 2, cy - PX * 2, PX * 2, PX * 3);
    },

    // Enfekte kol: girintili çıkıntılı bir uzuv, ucunda küçük kafa
    grab: (ctx, cx, cy) => {
        ctx.fillStyle = '#7f2a20';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(cx - PX * 6 + i * PX * 2, cy - PX + (i % 2 ? PX : 0), PX * 2, PX * 2);
        }
        ctx.fillStyle = '#f2795c';
        ctx.fillRect(cx + PX * 2, cy - PX * 2, PX * 4, PX * 4);
        ctx.fillStyle = '#1b0d0a';
        ctx.fillRect(cx + PX * 3, cy - PX, PX, PX);
        ctx.fillRect(cx + PX * 5, cy - PX, PX, PX);
    },

    // Işınlanma: kaybolan gövde ve kıvılcımlar
    blink: (ctx, cx, cy) => {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(cx - PX, cy - PX * 4, PX * 2, PX * 3);
        ctx.fillRect(cx - PX, cy, PX * 2, PX * 3);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(cx - PX * 5, cy - PX, PX * 2, PX * 2);
        ctx.fillRect(cx + PX * 3, cy - PX, PX * 2, PX * 2);
        ctx.fillRect(cx - PX * 3, cy - PX * 4, PX, PX);
        ctx.fillRect(cx + PX * 2, cy + PX * 2, PX, PX);
    },

    // Buz yolu: zeminde ilerleyen bir şerit, ucunda büyüyen kristal. Diğer
    // üç simge bir NESNE gösteriyor (birikinti, kol, gövde); bu bir YÖN
    // gösteriyor - hamlenin kendisi zaten "bir yere doğru uzamak".
    path: (ctx, cx, cy) => {
        ctx.fillStyle = '#2f7fc4';
        ctx.fillRect(cx - PX * 6, cy + PX, PX * 10, PX * 2);
        ctx.fillStyle = '#8fd4f5';
        ctx.fillRect(cx - PX * 6, cy + PX, PX * 10, PX);
        // Şeridin üstünde büyüyen kırıklar: uca doğru yükseliyorlar
        ctx.fillStyle = '#c9ecff';
        ctx.fillRect(cx - PX * 4, cy, PX, PX);
        ctx.fillRect(cx - PX, cy - PX, PX, PX * 2);
        // Uç: dondurmanın olduğu yer
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + PX * 2, cy - PX * 4, PX * 2, PX * 5);
        ctx.fillRect(cx + PX, cy - PX * 2, PX * 4, PX);
    }
};

function drawCircle(ctx, player, ability, cx) {
    const cy = CIRCLE_Y;
    const cd = player.cooldowns[ability.id] || 0;
    const ratio = ability.cooldown > 0 ? Math.min(1, cd / ability.cooldown) : 0;

    // Halka
    ctx.fillStyle = RING;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = FACE;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ICONS[ability.icon]?.(ctx, Math.round(cx), cy);
    ctx.restore();

    // Bekleme: aşağıdan yukarı karartma
    if (ratio > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = DIM;
        ctx.fillRect(cx - R, cy + R - ratio * R * 2, R * 2, ratio * R * 2);
        ctx.restore();
        drawPixelText(ctx, `${Math.ceil(cd / 60)}`, cx, cy - 6, {
            scale: 2, color: '#f8fafc', shadow: '#020617', align: 'center'
        });
    }

    drawPixelText(ctx, secondKeyLabel(player, ability), cx, LABEL_Y, {
        scale: 1, color: TEXT, align: 'center'
    });
}

// Bir oyuncunun kümesi. cx: kümenin yatay ortası.
export function drawComboCluster(ctx, player, cx) {
    const abilities = comboAbilities(player.fighter.id);
    if (abilities.length !== 4) return;

    const xs = abilities.map((_, i) => cx + (i - 1.5) * SPACING);

    // Bağlantı çizgileri: hepsi tek noktaya iniyor
    ctx.strokeStyle = RING;
    ctx.lineWidth = 2;
    for (const x of xs) {
        ctx.beginPath();
        ctx.moveTo(cx, ANCHOR_Y);
        ctx.lineTo(x, CIRCLE_Y + R);
        ctx.stroke();
    }

    for (let i = 0; i < abilities.length; i++) drawCircle(ctx, player, abilities[i], xs[i]);

    // Noktanın kendisi = kombo tuşu
    const label = player.onPad ? 'L1' : 'SHIFT';
    const w = label.length * 12 + 16;
    ctx.fillStyle = RING;
    ctx.fillRect(cx - w / 2 - 2, ANCHOR_Y - 2, w + 4, 22);
    ctx.fillStyle = player.color;
    ctx.fillRect(cx - w / 2, ANCHOR_Y, w, 18);
    drawPixelText(ctx, label, cx, ANCHOR_Y + 5, {
        scale: 2, color: '#0b1220', align: 'center'
    });
}

export function drawComboBar(ctx, p1, p2, width) {
    ctx.clearRect(0, 0, width, COMBO_BAR_HEIGHT);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, COMBO_BAR_HEIGHT);
    if (p1) drawComboCluster(ctx, p1, width * 0.24);
    if (p2) drawComboCluster(ctx, p2, width * 0.76);
}
