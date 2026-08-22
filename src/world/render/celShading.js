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

// ---------------------------------------------------------------------------
// BOYAMA (painted) katmanı
//
// Anime'de arka planlar (背景) guaj boyayla elle boyanır ve KONTURU YOKTUR.
// Kontur yalnızca karakter çiziminde bulunur. Bu yüzden zemin/ağaç/kaya için
// aşağıdaki yol kullanılır: düz taban rengi + yumuşak kenarlı ton bantları,
// çizgi yok. Yumuşaklık ctx.filter ile verilir; zemin bir kez pişirildiği
// için maliyeti kare hızını etkilemez.
// ---------------------------------------------------------------------------

// Boyanmış şekil: kontur yok, iki-üç ton bandı yumuşak kenarlarla
export function paint(ctx, pathFn, {
    base,
    shadow,
    light,
    bounds,
    softness = 0.18,          // bulanıklık, şeklin boyutuna oranla
    shadowAlpha = 1,
    lightAlpha = 1,
    shadowDir = { x: 0.55, y: 0.6 },
    lightDir = { x: -0.4, y: -0.45 }
}) {
    ctx.save();

    pathFn();
    ctx.fillStyle = base;
    ctx.fill();

    if (bounds && (shadow || light)) {
        pathFn();
        ctx.clip();

        const span = Math.max(bounds.w, bounds.h);
        const blur = Math.max(1.5, span * softness);
        const cx = bounds.x + bounds.w / 2;
        const cy = bounds.y + bounds.h / 2;

        // Gölge bandı: şeklin ALT-SAĞ yanına oturan kütle. Yarıçapı küçük
        // tutulur, aksi halde tüm şekli kaplayıp görüntüyü karartır.
        if (shadow) {
            ctx.globalAlpha = shadowAlpha;
            ctx.filter = `blur(${blur.toFixed(2)}px)`;
            ctx.fillStyle = shadow;
            ctx.beginPath();
            ctx.arc(cx + shadowDir.x * span, cy + shadowDir.y * span, span * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Işık: üst-solda geniş, yumuşak leke
        if (light) {
            ctx.globalAlpha = lightAlpha;
            ctx.filter = `blur(${(blur * 1.2).toFixed(2)}px)`;
            ctx.fillStyle = light;
            ctx.beginPath();
            ctx.ellipse(
                cx + lightDir.x * bounds.w * 0.4,
                cy + lightDir.y * bounds.h * 0.4,
                bounds.w * 0.38, bounds.h * 0.3, -0.5, 0, Math.PI * 2
            );
            ctx.fill();
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// Yaprak silueti: daire değil, kenarı yaprak kümeleriyle tırtıklı bir kütle.
// Anime arka planlarında ağaç tacı böyle çizilir; düz daire "mantar" gibi
// durur, bulanık leke ise çizim değil kir gibi görünür.
// bumpFn(i) 0-1 arası bir değer döndürerek her kümenin boyunu değiştirir.
export function foliagePath(ctx, cx, cy, r, bumps, bumpFn) {
    ctx.beginPath();
    const inner = r * 0.82;
    for (let i = 0; i < bumps; i++) {
        const a0 = (i / bumps) * Math.PI * 2;
        const a1 = ((i + 1) / bumps) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        // Çıkıntı ölçülü tutulur: fazlası tacı yıldıza çevirir
        const out = r * (0.98 + bumpFn(i) * 0.14);
        const x0 = cx + Math.cos(a0) * inner;
        const y0 = cy + Math.sin(a0) * inner * 0.88;
        if (i === 0) ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(
            cx + Math.cos(am) * out * 1.16, cy + Math.sin(am) * out * 1.04,
            cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner * 0.88
        );
    }
    ctx.closePath();
}

// Boyama tarzı fırça darbesi (yaprak kümesi, yosun, doku lekesi)
export function brush(ctx, pathFn, color, blur = 3, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = color;
    pathFn();
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
}

// Yere düşen boyalı gölge: kenarı yumuşak
export function paintedShadow(ctx, x, y, rx, ry, alpha = 0.26) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${Math.max(2, ry * 0.9).toFixed(1)}px)`;
    ctx.fillStyle = '#16301a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
}
