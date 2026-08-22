// Anime (cel-shading) çizim yardımcıları.
//
// Anime tarzının teknik özü: degrade YOK. Bir şekil düz renkle doldurulur,
// içine SERT KENARLI bir gölge bandı ve bir ışık lekesi yerleştirilir, sonra
// şeklin çevresi koyu bir konturla çizilir. Yumuşak degradeler görüntüyü
// "plastik/yapay" gösterirken, bu yöntem çizgi film hissi verir.

// Bir yolu cel-shading ile doldurur.
// pathFn: ctx üzerinde yolu çizen fonksiyon (fill/stroke çağırmaz)
export function cel(ctx, pathFn, {
    base,
    shadow,
    light,
    outline = 'rgba(20, 24, 20, 0.75)',
    lineWidth = 2,
    // Gölge/ışık lekesinin şekil içinde nereye düşeceği (-1..1)
    shadowDir = { x: 0.55, y: 0.55 },
    lightDir = { x: -0.45, y: -0.5 },
    bounds // { x, y, w, h } - gölge/ışık büyüklüğü için
}) {
    ctx.save();

    // 1) Düz taban rengi
    pathFn();
    ctx.fillStyle = base;
    ctx.fill();

    // 2) Şeklin içine sert kenarlı gölge ve ışık
    if (bounds && (shadow || light)) {
        pathFn();
        ctx.clip();

        const r = Math.max(bounds.w, bounds.h);
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;

        if (shadow) {
            ctx.fillStyle = shadow;
            ctx.beginPath();
            // Şeklin bir yanını kaplayan büyük daire: kesişim sert kenar verir
            ctx.arc(cx + shadowDir.x * r, cy + shadowDir.y * r, r * 0.95, 0, Math.PI * 2);
            ctx.fill();
        }
        if (light) {
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.ellipse(cx + lightDir.x * bounds.w * 0.45, cy + lightDir.y * bounds.h * 0.45,
                bounds.w * 0.3, bounds.h * 0.22, -0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    // 3) Kontur: anime hissinin belkemiği
    if (outline) {
        ctx.save();
        pathFn();
        ctx.strokeStyle = outline;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }
}

// Daire için kısayol
export function celCircle(ctx, x, y, radius, options) {
    cel(ctx, () => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
    }, { ...options, bounds: { x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 } });
}

// Elips için kısayol
export function celEllipse(ctx, x, y, rx, ry, options) {
    cel(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, options.rotation || 0, 0, Math.PI * 2);
    }, { ...options, bounds: { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 } });
}

// Yere düşen düz gölge (anime tarzı: yumuşak değil, hafif saydam düz elips)
export function groundShadow(ctx, x, y, rx, ry, alpha = 0.22) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#10240f';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
