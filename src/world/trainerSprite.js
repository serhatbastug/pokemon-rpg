// Antrenör karakteri (PokeAPI'de antrenör görseli yok, elle çiziyoruz).
// Macera modu piksel sanatı değil: yumuşak eğriler, degradeler ve gölgelerle
// çizilir. Boyut `scale` ile ayarlanır (1 birim ≈ 4 piksel gövde yüksekliği).

const SKIN = { light: '#f8cfa6', mid: '#e8b184', dark: '#c98f63' };
const CAP = { light: '#ef4444', mid: '#c81e1e', dark: '#8f1414' };
const JACKET = { light: '#e5484d', mid: '#bb2d33', dark: '#7f1d1d' };
const JEANS = { light: '#3b6fd4', mid: '#2a4fa8', dark: '#1b3a78' };
const HAIR = '#3b2412';
const SHOE = '#1f2937';

// Dikey degrade yardımcı
function shade(ctx, x, y, w, h, top, bottom) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
}

// Yuvarlak köşeli gövde parçası
function limb(ctx, x, y, w, h, color, radius = w / 2) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
}

// Antrenörü (x, y) ayak hizasında merkezleyerek çizer.
// dir: 'down' | 'up' | 'left' | 'right'
export function drawTrainer(ctx, x, y, dir, moving, scale = 4) {
    const u = scale;                    // temel birim
    const bob = moving ? Math.sin(Date.now() / 130) * u * 0.35 : 0;
    const stride = moving ? Math.sin(Date.now() / 130) * u * 0.9 : 0;
    const side = dir === 'left' || dir === 'right';
    const back = dir === 'up';

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.translate(x, y + bob);
    if (dir === 'left') ctx.scale(-1, 1);

    // --- Bacaklar ---
    limb(ctx, -u * 1.5, -u * 3.2, u * 1.3, u * 3.4, shade(ctx, 0, -u * 3.2, 0, u * 3.4, JEANS.light, JEANS.dark));
    limb(ctx, u * 0.2 + stride * 0.3, -u * 3.2, u * 1.3, u * 3.4,
        shade(ctx, 0, -u * 3.2, 0, u * 3.4, JEANS.mid, JEANS.dark));

    // Ayakkabılar
    limb(ctx, -u * 1.6, -u * 0.5, u * 1.5, u * 0.7, SHOE, u * 0.3);
    limb(ctx, u * 0.1 + stride * 0.3, -u * 0.5, u * 1.5, u * 0.7, SHOE, u * 0.3);

    // --- Gövde (ceket) ---
    const torsoY = -u * 7.4;
    const torsoH = u * 4.4;
    ctx.fillStyle = shade(ctx, 0, torsoY, 0, torsoH, JACKET.light, JACKET.dark);
    ctx.beginPath();
    ctx.roundRect(-u * 2, torsoY, u * 4, torsoH, [u * 1.4, u * 1.4, u * 0.6, u * 0.6]);
    ctx.fill();

    // Ceket fermuarı / sırt dikişi
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = Math.max(1, u * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, torsoY + u * 0.5);
    ctx.lineTo(0, torsoY + torsoH - u * 0.4);
    ctx.stroke();

    // Omuz ışığı
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-u * 0.8, torsoY + u * 0.8, u * 1, u * 0.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // --- Kollar ---
    const armSwing = moving ? Math.sin(Date.now() / 130) * u * 0.8 : 0;
    limb(ctx, -u * 2.9, torsoY + u * 0.6 - armSwing * 0.4, u * 1.1, u * 3,
        shade(ctx, 0, torsoY, 0, u * 3, JACKET.mid, JACKET.dark));
    limb(ctx, u * 1.8, torsoY + u * 0.6 + armSwing * 0.4, u * 1.1, u * 3,
        shade(ctx, 0, torsoY, 0, u * 3, JACKET.light, JACKET.mid));

    // Eller
    ctx.fillStyle = SKIN.mid;
    ctx.beginPath();
    ctx.arc(-u * 2.35, torsoY + u * 3.5 - armSwing * 0.4, u * 0.55, 0, Math.PI * 2);
    ctx.arc(u * 2.35, torsoY + u * 3.5 + armSwing * 0.4, u * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // --- Baş ---
    const headY = -u * 9.3;
    const headR = u * 1.75;

    // Boyun
    limb(ctx, -u * 0.5, headY + headR * 0.5, u * 1, u * 1, SKIN.dark, u * 0.4);

    // Yüz
    const face = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.3, headR * 0.2, 0, headY, headR);
    face.addColorStop(0, SKIN.light);
    face.addColorStop(1, SKIN.mid);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // Saç (arkadan bakışta tüm kafa saç)
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    if (back) {
        ctx.arc(0, headY, headR * 0.98, 0, Math.PI * 2);
    } else {
        ctx.arc(0, headY, headR * 0.98, Math.PI * 1.05, Math.PI * 2.05);
        ctx.closePath();
    }
    ctx.fill();

    // Yüz hatları (öne ve yana bakışta)
    if (!back) {
        ctx.fillStyle = '#2b2b33';
        if (side) {
            ctx.beginPath();
            ctx.arc(headR * 0.45, headY + headR * 0.05, u * 0.22, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(-headR * 0.38, headY + headR * 0.05, u * 0.22, 0, Math.PI * 2);
            ctx.arc(headR * 0.38, headY + headR * 0.05, u * 0.22, 0, Math.PI * 2);
            ctx.fill();
            // Ağız
            ctx.strokeStyle = 'rgba(120,60,40,0.7)';
            ctx.lineWidth = Math.max(1, u * 0.16);
            ctx.beginPath();
            ctx.arc(0, headY + headR * 0.35, headR * 0.3, 0.25, Math.PI - 0.25);
            ctx.stroke();
        }
    }

    // --- Şapka ---
    const capY = headY - headR * 0.35;
    ctx.fillStyle = shade(ctx, 0, capY - headR, 0, headR * 1.2, CAP.light, CAP.dark);
    ctx.beginPath();
    ctx.arc(0, capY, headR * 1.02, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    // Şapka bandı
    ctx.fillStyle = CAP.dark;
    ctx.beginPath();
    ctx.roundRect(-headR, capY - u * 0.15, headR * 2, u * 0.45, u * 0.2);
    ctx.fill();

    // Siperlik (bakış yönüne göre)
    ctx.fillStyle = CAP.mid;
    ctx.beginPath();
    if (back) {
        ctx.ellipse(0, capY - headR * 0.5, headR * 0.9, headR * 0.3, 0, 0, Math.PI * 2);
    } else if (side) {
        ctx.ellipse(headR * 0.85, capY + u * 0.1, headR * 0.85, headR * 0.28, 0.1, 0, Math.PI * 2);
    } else {
        ctx.ellipse(0, capY + u * 0.25, headR * 1.15, headR * 0.34, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Şapkanın önündeki beyaz amblem
    if (!back) {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(side ? headR * 0.35 : 0, capY - headR * 0.42, u * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CAP.mid;
        ctx.beginPath();
        ctx.arc(side ? headR * 0.35 : 0, capY - headR * 0.42, u * 0.18, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}
