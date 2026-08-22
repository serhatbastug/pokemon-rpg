// Antrenör karakterinin çizimi (PokeAPI'de antrenör görseli yok).
//
// Karakter, yuvarlak dikdörtgenlerden değil GERÇEK ANATOMİDEN kurulur:
// omuz eğimi, bele daralan gövde, etek payı açılan ceket, dirsekten kırılan
// kollar, dizden incelen bacaklar. Anime yüzü çeneye doğru sivrilir ve gözler
// iris + gözbebeği + iki parlama ile katmanlıdır. Kalitenin geldiği yer bu.
//
// Ölçü birimi u; tüm koordinatlar AYAK HİZASINDAN YUKARI doğru "u" cinsinden
// yazılır (pen yardımcısı canvas'ın ters y eksenine çevirir). Karakterin
// toplam boyu ~16u, baş ~3.6u -> anime RPG oranı olan 1:4.4.

export const H = 17.4;        // toplam boy (u)
export const W = 6.4;         // en geniş yer (u)

// Baş + şapka, gövdeye göre biraz büyük çizilir: anime RPG karakterlerinde
// yüzün okunabilmesi buna bağlıdır. Grup, baş merkezinden ölçeklenir.
const HEAD_SCALE = 1.2;
const HEAD_PIVOT = 13.74;

function headGroup(ctx, u, drawFn) {
    ctx.save();
    ctx.translate(0, -HEAD_PIVOT * u);
    ctx.scale(HEAD_SCALE, HEAD_SCALE);
    ctx.translate(0, HEAD_PIVOT * u);
    drawFn();
    ctx.restore();
}

const C = {
    skin: '#ffdcb4', skinShade: '#e8b489', skinLine: '#c78655',
    hair: '#2e2230', hairShade: '#1b1420', hairLight: '#54405a',
    cap: '#e63946', capShade: '#b4232f', capPanel: '#f6f8fb', capPanelShade: '#d5dde6',
    jacket: '#3f7fd6', jacketShade: '#2a5aa6', jacketLight: '#5f9be8',
    collar: '#eef3f9', collarShade: '#ccd7e3',
    shirt: '#f4f6f9', shirtShade: '#d2dae3',
    glove: '#37855a', gloveShade: '#256040',
    jeans: '#3d5a80', jeansShade: '#2a3f5e',
    shoe: '#f2f4f7', shoeShade: '#ccd3dc', shoeAccent: '#e63946',
    belt: '#463c4e',
    eyeWhite: '#ffffff', iris: '#6b4a2e', pupil: '#241a20',
    ink: '#241a26'
};

// Ayak hizası merkezli, y'si yukarı pozitif kalem
function pen(ctx, u) {
    const X = (x) => x * u;
    const Y = (y) => -y * u;
    return {
        begin: () => ctx.beginPath(),
        m: (x, y) => ctx.moveTo(X(x), Y(y)),
        l: (x, y) => ctx.lineTo(X(x), Y(y)),
        q: (cx, cy, x, y) => ctx.quadraticCurveTo(X(cx), Y(cy), X(x), Y(y)),
        c: (ax, ay, bx, by, x, y) => ctx.bezierCurveTo(X(ax), Y(ay), X(bx), Y(by), X(x), Y(y)),
        close: () => ctx.closePath(),
        ellipse: (x, y, rx, ry, rot = 0) => ctx.ellipse(X(x), Y(y), rx * u, ry * u, -rot, 0, Math.PI * 2),
        circle: (x, y, r) => ctx.arc(X(x), Y(y), r * u, 0, Math.PI * 2),
        X, Y
    };
}

// Bir rengi koyulaştırır (anime "renkli iz" konturu için)
function darken(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.round(((n >> 16) & 255) * f)}, ${Math.round(((n >> 8) & 255) * f)}, ${Math.round((n & 255) * f)})`;
}

export function makeBrush(ctx, u, lineWidth, tinted) {
    // Dolgu + ince kontur
    const ink = (pathFn, fill, weight = 1) => {
        pathFn();
        ctx.fillStyle = fill;
        ctx.fill();
        if (lineWidth > 0) {
            ctx.strokeStyle = tinted ? darken(fill, 0.52) : C.ink;
            ctx.lineWidth = u * lineWidth * weight;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    };

    // Sadece dolgu (kontursuz iç detay)
    const fill = (pathFn, color) => {
        pathFn();
        ctx.fillStyle = color;
        ctx.fill();
    };

    // Şeklin içine gölge: clipFn ile sınırlanır
    const shade = (clipFn, pathFn, color) => {
        ctx.save();
        clipFn();
        ctx.clip();
        pathFn();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    };

    // Detay çizgisi (fermuar, dikiş, kıvrım)
    const line = (pathFn, color, weight = 0.6) => {
        pathFn();
        ctx.strokeStyle = color;
        ctx.lineWidth = u * Math.max(lineWidth, 0.1) * weight;
        ctx.lineCap = 'round';
        ctx.stroke();
    };

    return { ink, fill, shade, line };
}

// ---------------------------------------------------------------------------
// ÖN GÖRÜNÜM
// ---------------------------------------------------------------------------
function drawFront(ctx, u, brush, swing) {
    const p = pen(ctx, u);
    const { ink, fill, shade, line } = brush;
    const stride = swing * 0.9;      // -1..1

    // --- Bacaklar: kalçadan dize, dizden bileğe incelir ---
    const leg = (side, fwd, color) => {
        const x = side * 0.78;
        const lean = fwd * 0.42;
        ink(() => {
            p.begin();
            p.m(x - 0.66, 6.35);
            p.c(x - 0.72, 4.9, x - 0.7 + lean * 0.5, 3.9, x - 0.58 + lean, 3.1);   // uyluk -> diz
            p.c(x - 0.54 + lean * 1.2, 2.2, x - 0.5 + lean * 1.4, 1.6, x - 0.48 + lean * 1.5, 1.15);
            p.l(x + 0.48 + lean * 1.5, 1.15);
            p.c(x + 0.5 + lean * 1.4, 1.7, x + 0.56 + lean * 1.2, 2.4, x + 0.6 + lean, 3.1);
            p.c(x + 0.72, 4.0, x + 0.7, 5.2, x + 0.66, 6.35);
            p.close();
        }, color, 0.85);

        // Diz kıvrımı
        line(() => {
            p.begin();
            p.m(x - 0.34 + lean, 3.05);
            p.q(x + lean, 2.86, x + 0.36 + lean, 3.05);
        }, darken(color, 0.7), 0.5);
    };
    leg(-1, -stride, C.jeansShade);
    leg(1, stride, C.jeans);

    // --- Ayakkabılar: burnu geniş, tabanı ayrı ---
    const shoe = (side, fwd) => {
        const x = side * 0.78 + fwd * 0.63;
        ink(() => {
            p.begin();
            p.m(x - 0.62, 1.25);
            p.l(x + 0.62, 1.25);
            p.c(x + 0.74, 0.85, x + 0.8, 0.5, x + 0.72, 0.26);
            p.l(x - 0.66, 0.26);
            p.c(x - 0.74, 0.5, x - 0.72, 0.9, x - 0.62, 1.25);
            p.close();
        }, C.shoe, 0.8);

        // Taban
        ink(() => {
            p.begin();
            p.m(x - 0.68, 0.3);
            p.l(x + 0.74, 0.3);
            p.c(x + 0.78, 0.12, x + 0.72, 0.02, x + 0.6, 0.02);
            p.l(x - 0.56, 0.02);
            p.c(x - 0.7, 0.02, x - 0.74, 0.14, x - 0.68, 0.3);
            p.close();
        }, C.shoeShade, 0.6);

        // Kırmızı bant
        fill(() => {
            p.begin();
            p.m(x - 0.6, 0.72);
            p.l(x + 0.68, 0.72);
            p.l(x + 0.66, 0.5);
            p.l(x - 0.6, 0.5);
            p.close();
        }, C.shoeAccent);
    };
    shoe(-1, -stride);
    shoe(1, stride);

    // --- Gövde: omuzdan bele daralır, etekte hafif açılır ---
    const torso = () => {
        p.begin();
        p.m(-1.42, 11.35);                                  // sol omuz üstü
        p.c(-2.06, 11.2, -2.32, 10.72, -2.36, 10.05);       // omuz başı
        p.c(-2.3, 9.0, -2.02, 8.1, -1.88, 7.5);             // kola giden yan
        p.c(-1.98, 6.9, -2.04, 6.5, -1.96, 6.1);            // etek payı
        p.l(1.96, 6.1);
        p.c(2.04, 6.5, 1.98, 6.9, 1.88, 7.5);
        p.c(2.02, 8.1, 2.3, 9.0, 2.36, 10.05);
        p.c(2.32, 10.72, 2.06, 11.2, 1.42, 11.35);
        p.close();
    };
    ink(torso, C.jacket, 1);

    // Gövde gölgesi: sağ yan
    shade(torso, () => {
        p.begin();
        p.m(0.62, 11.4);
        p.c(0.72, 9.5, 0.9, 7.6, 0.86, 6.0);
        p.l(2.6, 6.0);
        p.l(2.6, 11.4);
        p.close();
    }, C.jacketShade);

    // Tişört: ceket yakadan V açılır, göğüs altında kapanır. Boydan boya
    // beyaz şerit bırakmak ceketi tulum gibi gösteriyordu.
    const vNeck = () => {
        p.begin();
        p.m(-0.56, 11.3);
        p.l(0.56, 11.3);
        p.l(0.08, 8.7);
        p.l(-0.08, 8.7);
        p.close();
    };
    fill(vNeck, C.shirt);
    fill(() => {
        p.begin();
        p.m(0.1, 11.3);
        p.l(0.56, 11.3);
        p.l(0.08, 8.7);
        p.l(0.02, 8.7);
        p.close();
    }, C.shirtShade);

    // Fermuar: V'nin ucundan eteğe tek hat
    line(() => {
        p.begin();
        p.m(-0.56, 11.3);
        p.l(-0.06, 8.72);
        p.l(0.06, 8.72);
        p.l(0.56, 11.3);
        p.m(0, 8.7);
        p.l(0, 6.25);
    }, darken(C.jacket, 0.45), 0.7);

    // Kemer + toka
    ink(() => {
        p.begin();
        p.m(-1.9, 6.5);
        p.l(1.9, 6.5);
        p.l(1.94, 6.02);
        p.l(-1.94, 6.02);
        p.close();
    }, C.belt, 0.5);
    ink(() => { p.begin(); p.circle(0, 6.26, 0.34); }, C.capPanel, 0.45);
    fill(() => {
        p.begin();
        ctx.arc(0, -6.26 * u, 0.34 * u, Math.PI, Math.PI * 2);
        ctx.closePath();
    }, C.cap);

    // --- Kollar: omuz -> dirsek -> bilek ---
    const arm = (side, sw, color) => {
        const s = side;
        const el = sw * 0.3;   // dirsek salınımı
        ink(() => {
            p.begin();
            p.m(s * 1.5, 11.3);
            p.c(s * 2.2, 11.15, s * 2.5, 10.6, s * 2.54, 9.9);          // omuz dışı
            p.c(s * 2.62, 9.1 + el, s * 2.6, 8.3 + el, s * 2.5, 7.55 + el * 1.4);
            p.c(s * 2.46, 7.2 + el * 1.5, s * 2.1, 7.15 + el * 1.5, s * 1.98, 7.5 + el * 1.4);
            p.c(s * 1.9, 8.3 + el, s * 1.86, 9.2 + el, s * 1.82, 10.0);
            p.c(s * 1.78, 10.5, s * 1.7, 10.95, s * 1.5, 11.3);
            p.close();
        }, color, 0.8);

        // Manşet
        ink(() => {
            p.begin();
            p.m(s * 2.52, 7.6 + el * 1.4);
            p.c(s * 2.48, 7.25 + el * 1.5, s * 2.08, 7.2 + el * 1.5, s * 1.96, 7.55 + el * 1.4);
            p.l(s * 2.0, 7.15 + el * 1.4);
            p.c(s * 2.12, 6.85 + el * 1.5, s * 2.46, 6.9 + el * 1.5, s * 2.5, 7.2 + el * 1.4);
            p.close();
        }, C.collar, 0.5);

        // Eldiven
        // El: parmaksız eldiven -> bilekte yeşil bant, el teni görünür.
        // Yekpare yeşil top, koldan kopuk bir leke gibi duruyordu.
        ink(() => {
            p.begin();
            p.ellipse(s * 2.22, 7.02 + el * 1.4, 0.3, 0.19);
        }, C.glove, 0.5);
        ink(() => {
            p.begin();
            p.ellipse(s * 2.2, 6.62 + el * 1.4, 0.33, 0.4);
        }, C.skin, 0.5);
    };
    arm(-1, -swing, C.jacketShade);
    arm(1, swing, C.jacketLight);

    // --- Yaka ---
    ink(() => {
        p.begin();
        p.m(-1.42, 11.35);
        p.c(-0.9, 11.5, -0.4, 11.42, -0.24, 11.2);
        p.l(0.24, 11.2);
        p.c(0.4, 11.42, 0.9, 11.5, 1.42, 11.35);
        p.c(1.1, 11.75, -1.1, 11.75, -1.42, 11.35);
        p.close();
    }, C.collar, 0.6);

    // --- Boyun ---
    ink(() => {
        p.begin();
        p.m(-0.52, 11.5);
        p.l(-0.52, 12.28);
        p.l(0.52, 12.28);
        p.l(0.52, 11.5);
        p.close();
    }, C.skinShade, 0.55);

    // --- Baş: çeneye doğru sivrilen anime yüzü ---
    headGroup(ctx, u, () => {
    const head = () => {
        p.begin();
        p.m(-1.58, 14.5);
        p.c(-1.66, 13.66, -1.44, 12.98, -1.02, 12.56);   // sol yanak -> çene hattı
        p.c(-0.62, 12.16, 0.62, 12.16, 1.02, 12.56);     // çene
        p.c(1.44, 12.98, 1.66, 13.66, 1.58, 14.5);       // sağ yanak
        p.c(1.5, 15.32, -1.5, 15.32, -1.58, 14.5);       // kafatası
        p.close();
    };
    ink(head, C.skin, 0.9);

    // Yüz gölgesi: sağ yan + şapka altı
    shade(head, () => {
        p.begin();
        p.m(0.5, 15.4);
        p.c(0.72, 14.2, 0.78, 13.2, 0.5, 12.3);
        p.l(2.0, 12.3);
        p.l(2.0, 15.4);
        p.close();
    }, C.skinShade);
    shade(head, () => {
        p.begin();
        p.m(-1.8, 14.9);
        p.c(-0.9, 14.45, 0.9, 14.45, 1.8, 14.9);
        p.l(1.8, 15.6);
        p.l(-1.8, 15.6);
        p.close();
    }, C.skinShade);

    // --- Saç: şapkanın altından çıkan sivri tutamlar ---
    const hairTufts = () => {
        p.begin();
        // sol yan tutam
        p.m(-1.62, 14.75);
        p.c(-1.9, 14.2, -1.86, 13.6, -1.6, 13.15);
        p.c(-1.52, 13.7, -1.4, 14.05, -1.24, 14.3);
        p.close();
        // sağ yan tutam
        p.m(1.62, 14.75);
        p.c(1.9, 14.2, 1.86, 13.6, 1.6, 13.15);
        p.c(1.52, 13.7, 1.4, 14.05, 1.24, 14.3);
        p.close();
    };
    ink(hairTufts, C.hair, 0.55);

    // Kâkül: alnın üstünde üç sivri uç
    const bangs = () => {
        p.begin();
        p.m(-1.52, 14.62);
        p.c(-1.3, 14.15, -1.0, 13.95, -0.72, 14.05);
        p.c(-0.86, 14.3, -0.84, 14.5, -0.7, 14.62);
        p.c(-0.42, 14.1, -0.08, 13.88, 0.2, 14.0);
        p.c(0.06, 14.28, 0.1, 14.5, 0.26, 14.66);
        p.c(0.6, 14.2, 0.98, 14.05, 1.3, 14.2);
        p.c(1.2, 14.42, 1.24, 14.6, 1.42, 14.74);
        p.c(0.8, 14.98, -0.9, 14.98, -1.52, 14.62);
        p.close();
    };
    ink(bangs, C.hair, 0.55);

    // --- Gözler: iris + gözbebeği + iki parlama ---
    const eye = (ex) => {
        const ey = 13.42;
        // göz akı
        fill(() => { p.begin(); p.ellipse(ex, ey, 0.4, 0.48); }, C.eyeWhite);
        // iris
        fill(() => { p.begin(); p.ellipse(ex, ey - 0.05, 0.3, 0.4); }, C.iris);
        // gözbebeği
        fill(() => { p.begin(); p.ellipse(ex, ey - 0.04, 0.15, 0.25); }, C.pupil);
        // büyük parlama (üst-dış)
        fill(() => { p.begin(); p.circle(ex - Math.sign(ex) * 0.11, ey + 0.19, 0.13); }, '#ffffff');
        // küçük parlama (alt-iç)
        ctx.globalAlpha = 0.75;
        fill(() => { p.begin(); p.circle(ex + Math.sign(ex) * 0.13, ey - 0.24, 0.07); }, '#ffffff');
        ctx.globalAlpha = 1;
        // üst kirpik hattı: anime gözünün en kalın çizgisi
        line(() => {
            p.begin();
            p.m(ex - 0.44, ey + 0.3);
            p.q(ex, ey + 0.74, ex + 0.44, ey + 0.32);
        }, C.pupil, 1.5);
        // alt kapak
        line(() => {
            p.begin();
            p.m(ex - 0.3, ey - 0.44);
            p.q(ex, ey - 0.56, ex + 0.3, ey - 0.42);
        }, C.skinLine, 0.5);
    };
    eye(-0.72);
    eye(0.72);

    // Kaşlar
    line(() => {
        p.begin();
        p.m(-1.1, 14.16);
        p.q(-0.72, 14.34, -0.36, 14.2);
        p.m(0.36, 14.2);
        p.q(0.72, 14.34, 1.1, 14.16);
    }, C.hairShade, 0.85);

    // Burun ve ağız
    line(() => {
        p.begin();
        p.m(0.06, 12.94);
        p.l(0.2, 12.8);
    }, C.skinLine, 0.6);
    line(() => {
        p.begin();
        p.m(-0.22, 12.56);
        p.q(0, 12.42, 0.22, 12.56);
    }, C.skinLine, 0.7);

    // --- Şapka ---
    const crown = () => {
        p.begin();
        p.m(-1.72, 14.62);
        p.c(-1.82, 15.6, -1.0, 16.28, 0, 16.28);
        p.c(1.0, 16.28, 1.82, 15.6, 1.72, 14.62);
        p.c(0.9, 14.9, -0.9, 14.9, -1.72, 14.62);
        p.close();
    };
    ink(crown, C.cap, 0.9);

    // Şapkanın ön beyaz paneli
    shade(crown, () => {
        p.begin();
        p.m(-1.06, 14.72);
        p.c(-1.1, 15.5, -0.6, 15.94, 0, 15.94);
        p.c(0.6, 15.94, 1.1, 15.5, 1.06, 14.72);
        p.c(0.6, 14.86, -0.6, 14.86, -1.06, 14.72);
        p.close();
    }, C.capPanel);

    // Şapka gölgesi (sağ)
    shade(crown, () => {
        p.begin();
        p.m(1.06, 16.4);
        p.c(1.4, 15.8, 1.5, 15.2, 1.44, 14.6);
        p.l(2.0, 14.6);
        p.l(2.0, 16.4);
        p.close();
    }, C.capShade);

    // Panel amblemi: pokeball
    fill(() => { p.begin(); p.circle(0, 15.34, 0.34); }, C.capPanelShade);
    fill(() => {
        p.begin();
        ctx.arc(0, -15.34 * u, 0.34 * u, Math.PI, Math.PI * 2);
        ctx.closePath();
    }, C.cap);
    line(() => {
        p.begin();
        p.m(-0.34, 15.34);
        p.l(0.34, 15.34);
    }, C.ink, 0.5);
    fill(() => { p.begin(); p.circle(0, 15.34, 0.12); }, C.capPanel);

    // Siperlik: öne doğru çıkıntı. Alt kenarı gözlerin ÜSTÜNDE kalmalı,
    // aksi halde yüz şapkanın altında kaybolur.
    ink(() => {
        p.begin();
        p.m(-1.8, 14.72);
        p.c(-1.66, 14.24, -0.9, 14.0, 0, 14.0);
        p.c(0.9, 14.0, 1.66, 14.24, 1.8, 14.72);
        p.c(0.9, 14.44, -0.9, 14.44, -1.8, 14.72);
        p.close();
    }, C.capShade, 0.8);
    });
}

// ---------------------------------------------------------------------------
// YAN GÖRÜNÜM (sağa bakış; sol, aynası olarak çizilir)
// ---------------------------------------------------------------------------
function drawSide(ctx, u, brush, swing) {
    const p = pen(ctx, u);
    const { ink, fill, shade, line } = brush;
    const stride = swing * 1.3;

    // Arka bacak
    const leg = (fwd, color) => {
        ink(() => {
            p.begin();
            p.m(-0.66 + fwd * 0.2, 6.35);
            p.c(-0.8 + fwd * 0.7, 4.8, -0.72 + fwd * 1.1, 3.8, -0.6 + fwd * 1.5, 3.05);
            p.c(-0.56 + fwd * 1.7, 2.2, -0.5 + fwd * 1.9, 1.6, -0.5 + fwd * 2.0, 1.2);
            p.l(0.52 + fwd * 2.0, 1.2);
            p.c(0.56 + fwd * 1.8, 1.8, 0.64 + fwd * 1.3, 2.4, 0.68 + fwd * 1.4, 3.05);
            p.c(0.78 + fwd * 0.9, 4.0, 0.72 + fwd * 0.3, 5.2, 0.7 + fwd * 0.2, 6.35);
            p.close();
        }, color, 0.85);
    };
    leg(-stride, C.jeansShade);
    leg(stride, C.jeans);

    // Ayakkabılar: yandan burnu uzun
    const shoe = (fwd) => {
        const x = fwd * 2.0;
        ink(() => {
            p.begin();
            p.m(x - 0.5, 1.3);
            p.l(x + 0.52, 1.3);
            p.c(x + 0.9, 1.0, x + 1.14, 0.6, x + 1.06, 0.28);
            p.l(x - 0.6, 0.28);
            p.c(x - 0.68, 0.6, x - 0.6, 1.0, x - 0.5, 1.3);
            p.close();
        }, C.shoe, 0.8);
        ink(() => {
            p.begin();
            p.m(x - 0.62, 0.32);
            p.l(x + 1.08, 0.32);
            p.c(x + 1.14, 0.12, x + 1.04, 0.02, x + 0.9, 0.02);
            p.l(x - 0.5, 0.02);
            p.c(x - 0.66, 0.02, x - 0.7, 0.14, x - 0.62, 0.32);
            p.close();
        }, C.shoeShade, 0.6);
        fill(() => {
            p.begin();
            p.m(x - 0.46, 0.78);
            p.l(x + 0.86, 0.78);
            p.l(x + 0.78, 0.56);
            p.l(x - 0.46, 0.56);
            p.close();
        }, C.shoeAccent);
    };
    shoe(-stride);
    shoe(stride);

    // Gövde: yandan daha dar, sırtta hafif kambur
    const torso = () => {
        p.begin();
        p.m(-1.1, 11.3);
        p.c(-1.5, 11.1, -1.62, 10.5, -1.56, 9.8);
        p.c(-1.5, 8.6, -1.34, 7.2, -1.4, 6.1);
        p.l(1.34, 6.1);
        p.c(1.4, 7.3, 1.5, 8.8, 1.52, 9.9);
        p.c(1.56, 10.6, 1.4, 11.15, 1.02, 11.3);
        p.close();
    };
    ink(torso, C.jacket, 1);
    shade(torso, () => {
        p.begin();
        p.m(-1.7, 11.4);
        p.c(-1.5, 9.0, -1.4, 7.4, -1.46, 6.0);
        p.l(-0.5, 6.0);
        p.c(-0.6, 7.6, -0.7, 9.4, -0.66, 11.4);
        p.close();
    }, C.jacketShade);

    // Kemer
    ink(() => {
        p.begin();
        p.m(-1.4, 6.5);
        p.l(1.36, 6.5);
        p.l(1.4, 6.02);
        p.l(-1.44, 6.02);
        p.close();
    }, C.belt, 0.5);

    // Öndeki kol (salınımlı)
    ink(() => {
        const sw = swing * 0.75;
        p.begin();
        p.m(0.5, 11.2);
        p.c(1.16, 11.05, 1.42, 10.5, 1.42, 9.8);
        p.c(1.46 + sw, 9.0, 1.44 + sw * 1.4, 8.2, 1.36 + sw * 1.8, 7.5);
        p.c(1.3 + sw * 1.9, 7.15, 0.92 + sw * 1.9, 7.12, 0.82 + sw * 1.8, 7.45);
        p.c(0.76 + sw * 1.4, 8.3, 0.66 + sw, 9.4, 0.6, 10.2);
        p.close();
    }, C.jacketLight, 0.8);
    ink(() => {
        const sw = swing * 0.75;
        p.begin();
        p.ellipse(1.08 + sw * 1.9, 7.02, 0.3, 0.18);
    }, C.glove, 0.5);
    ink(() => {
        const sw = swing * 0.75;
        p.begin();
        p.ellipse(1.06 + sw * 1.9, 6.62, 0.32, 0.4);
    }, C.skin, 0.5);

    // Yaka + boyun
    ink(() => {
        p.begin();
        p.m(-1.06, 11.32);
        p.c(-0.6, 11.6, 0.6, 11.6, 1.02, 11.3);
        p.c(0.7, 11.8, -0.7, 11.8, -1.06, 11.32);
        p.close();
    }, C.collar, 0.6);
    ink(() => {
        p.begin();
        p.m(-0.42, 11.5);
        p.l(-0.42, 12.3);
        p.l(0.5, 12.3);
        p.l(0.5, 11.5);
        p.close();
    }, C.skinShade, 0.55);

    // --- Baş: profil (burun ve çene belirgin) ---
    headGroup(ctx, u, () => {
    const head = () => {
        p.begin();
        p.m(-1.5, 14.6);
        p.c(-1.6, 13.7, -1.42, 13.0, -1.0, 12.6);       // ense -> çene altı
        p.c(-0.5, 12.16, 0.55, 12.2, 0.94, 12.62);      // çene
        p.c(1.16, 12.86, 1.28, 13.06, 1.34, 13.24);     // çene ucu
        p.c(1.52, 13.3, 1.66, 13.42, 1.62, 13.56);      // BURUN
        p.c(1.58, 13.7, 1.42, 13.76, 1.3, 13.78);
        p.c(1.4, 14.2, 1.5, 14.4, 1.5, 14.66);
        p.c(1.42, 15.34, -1.42, 15.34, -1.5, 14.6);
        p.close();
    };
    ink(head, C.skin, 0.9);
    shade(head, () => {
        p.begin();
        p.m(-1.7, 14.9);
        p.c(-0.9, 14.5, 0.9, 14.5, 1.7, 14.9);
        p.l(1.7, 15.6);
        p.l(-1.7, 15.6);
        p.close();
    }, C.skinShade);

    // Ense saçı
    ink(() => {
        p.begin();
        p.m(-1.5, 14.7);
        p.c(-1.86, 14.1, -1.82, 13.4, -1.5, 12.95);
        p.c(-1.36, 13.5, -1.18, 13.9, -0.98, 14.2);
        p.c(-1.2, 14.42, -1.36, 14.56, -1.5, 14.7);
        p.close();
    }, C.hair, 0.55);

    // Kâkül (profilde öne düşer)
    ink(() => {
        p.begin();
        p.m(-1.44, 14.68);
        p.c(-0.9, 14.22, -0.2, 14.02, 0.42, 14.08);
        p.c(0.3, 14.32, 0.36, 14.5, 0.56, 14.62);
        p.c(0.9, 14.2, 1.2, 14.06, 1.44, 14.2);
        p.c(1.36, 14.44, 1.4, 14.62, 1.52, 14.76);
        p.c(0.8, 15.0, -0.8, 15.0, -1.44, 14.68);
        p.close();
    }, C.hair, 0.55);

    // Profil gözü
    const ey = 13.5;
    fill(() => { p.begin(); p.ellipse(0.82, ey, 0.3, 0.44); }, C.eyeWhite);
    fill(() => { p.begin(); p.ellipse(0.9, ey - 0.04, 0.22, 0.36); }, C.iris);
    fill(() => { p.begin(); p.ellipse(0.94, ey - 0.02, 0.11, 0.22); }, C.pupil);
    fill(() => { p.begin(); p.circle(0.78, ey + 0.18, 0.1); }, '#ffffff');
    line(() => {
        p.begin();
        p.m(0.52, ey + 0.3);
        p.q(0.9, ey + 0.66, 1.14, ey + 0.24);
    }, C.pupil, 1.4);
    line(() => {
        p.begin();
        p.m(0.56, 14.22);
        p.q(0.9, 14.38, 1.2, 14.24);
    }, C.hairShade, 0.85);

    // Ağız (profilde kısa)
    line(() => {
        p.begin();
        p.m(1.0, 12.96);
        p.q(1.14, 12.86, 1.24, 12.94);
    }, C.skinLine, 0.7);

    // Şapka: siperlik öne uzanır
    const crown = () => {
        p.begin();
        p.m(-1.62, 14.6);
        p.c(-1.72, 15.6, -0.9, 16.28, 0.1, 16.28);
        p.c(1.1, 16.28, 1.72, 15.6, 1.6, 14.6);
        p.c(0.8, 14.9, -0.8, 14.9, -1.62, 14.6);
        p.close();
    };
    ink(crown, C.cap, 0.9);
    shade(crown, () => {
        p.begin();
        p.m(0.3, 16.4);
        p.c(0.7, 15.7, 0.9, 15.1, 0.86, 14.5);
        p.l(2.0, 14.5);
        p.l(2.0, 16.4);
        p.close();
    }, C.capShade);
    // Ayar tokası (arkada)
    fill(() => {
        p.begin();
        p.m(-1.66, 14.9);
        p.l(-1.9, 14.86);
        p.l(-1.88, 14.56);
        p.l(-1.64, 14.6);
        p.close();
    }, C.capPanel);
    // Siperlik
    ink(() => {
        p.begin();
        p.m(0.9, 14.78);
        p.c(1.6, 14.74, 2.32, 14.52, 2.5, 14.2);
        p.c(2.2, 14.04, 1.4, 14.14, 0.86, 14.36);
        p.close();
    }, C.capShade, 0.8);
    });
}

// ---------------------------------------------------------------------------
// ARKA GÖRÜNÜM
// ---------------------------------------------------------------------------
function drawBack(ctx, u, brush, swing) {
    const p = pen(ctx, u);
    const { ink, fill, shade, line } = brush;
    const stride = swing * 0.9;

    const leg = (side, fwd, color) => {
        const x = side * 0.78;
        const lean = fwd * 0.42;
        ink(() => {
            p.begin();
            p.m(x - 0.66, 6.35);
            p.c(x - 0.72, 4.9, x - 0.7 + lean * 0.5, 3.9, x - 0.58 + lean, 3.1);
            p.c(x - 0.54 + lean * 1.2, 2.2, x - 0.5 + lean * 1.4, 1.6, x - 0.48 + lean * 1.5, 1.15);
            p.l(x + 0.48 + lean * 1.5, 1.15);
            p.c(x + 0.5 + lean * 1.4, 1.7, x + 0.56 + lean * 1.2, 2.4, x + 0.6 + lean, 3.1);
            p.c(x + 0.72, 4.0, x + 0.7, 5.2, x + 0.66, 6.35);
            p.close();
        }, color, 0.85);
    };
    leg(-1, -stride, C.jeansShade);
    leg(1, stride, C.jeans);

    const shoe = (side, fwd) => {
        const x = side * 0.78 + fwd * 0.63;
        ink(() => {
            p.begin();
            p.m(x - 0.6, 1.25);
            p.l(x + 0.6, 1.25);
            p.l(x + 0.66, 0.24);
            p.l(x - 0.66, 0.24);
            p.close();
        }, C.shoe, 0.8);
        ink(() => {
            p.begin();
            p.m(x - 0.68, 0.28);
            p.l(x + 0.68, 0.28);
            p.l(x + 0.62, 0.02);
            p.l(x - 0.62, 0.02);
            p.close();
        }, C.shoeShade, 0.6);
    };
    shoe(-1, -stride);
    shoe(1, stride);

    // Sırt: ceket düz, ortada dikiş
    const torso = () => {
        p.begin();
        p.m(-1.42, 11.35);
        p.c(-2.06, 11.2, -2.32, 10.72, -2.36, 10.05);
        p.c(-2.3, 9.0, -2.02, 8.1, -1.88, 7.5);
        p.c(-1.98, 6.9, -2.04, 6.5, -1.96, 6.1);
        p.l(1.96, 6.1);
        p.c(2.04, 6.5, 1.98, 6.9, 1.88, 7.5);
        p.c(2.02, 8.1, 2.3, 9.0, 2.36, 10.05);
        p.c(2.32, 10.72, 2.06, 11.2, 1.42, 11.35);
        p.close();
    };
    ink(torso, C.jacket, 1);
    shade(torso, () => {
        p.begin();
        p.m(0.62, 11.4);
        p.c(0.72, 9.5, 0.9, 7.6, 0.86, 6.0);
        p.l(2.6, 6.0);
        p.l(2.6, 11.4);
        p.close();
    }, C.jacketShade);
    line(() => {
        p.begin();
        p.m(0, 11.3);
        p.l(0, 6.2);
    }, darken(C.jacket, 0.5), 0.6);

    // Sırtta pokeball logosu
    fill(() => { p.begin(); p.circle(0, 9.3, 0.7); }, C.capPanel);
    fill(() => {
        p.begin();
        ctx.arc(0, -9.3 * u, 0.7 * u, Math.PI, Math.PI * 2);
        ctx.closePath();
    }, C.cap);
    line(() => { p.begin(); p.m(-0.7, 9.3); p.l(0.7, 9.3); }, C.ink, 0.5);
    fill(() => { p.begin(); p.circle(0, 9.3, 0.24); }, C.capPanel);

    // Kollar
    const arm = (side, sw, color) => {
        const s = side;
        const el = sw * 0.3;
        ink(() => {
            p.begin();
            p.m(s * 1.5, 11.3);
            p.c(s * 2.2, 11.15, s * 2.5, 10.6, s * 2.54, 9.9);
            p.c(s * 2.62, 9.1 + el, s * 2.6, 8.3 + el, s * 2.5, 7.55 + el * 1.4);
            p.c(s * 2.46, 7.2 + el * 1.5, s * 2.1, 7.15 + el * 1.5, s * 1.98, 7.5 + el * 1.4);
            p.c(s * 1.9, 8.3 + el, s * 1.86, 9.2 + el, s * 1.82, 10.0);
            p.c(s * 1.78, 10.5, s * 1.7, 10.95, s * 1.5, 11.3);
            p.close();
        }, color, 0.8);
        // El: parmaksız eldiven -> bilekte yeşil bant, el teni görünür.
        // Yekpare yeşil top, koldan kopuk bir leke gibi duruyordu.
        ink(() => {
            p.begin();
            p.ellipse(s * 2.22, 7.02 + el * 1.4, 0.3, 0.19);
        }, C.glove, 0.5);
        ink(() => {
            p.begin();
            p.ellipse(s * 2.2, 6.62 + el * 1.4, 0.33, 0.4);
        }, C.skin, 0.5);
    };
    arm(-1, -swing, C.jacketShade);
    arm(1, swing, C.jacketLight);

    // Baş arkası: tamamı saç
    headGroup(ctx, u, () => {
    const head = () => {
        p.begin();
        p.m(-1.58, 14.5);
        p.c(-1.66, 13.66, -1.44, 12.98, -1.02, 12.62);
        p.c(-0.62, 12.3, 0.62, 12.3, 1.02, 12.62);
        p.c(1.44, 12.98, 1.66, 13.66, 1.58, 14.5);
        p.c(1.5, 15.32, -1.5, 15.32, -1.58, 14.5);
        p.close();
    };
    ink(head, C.hair, 0.9);
    shade(head, () => {
        p.begin();
        p.m(0.5, 15.4);
        p.c(0.72, 14.2, 0.78, 13.2, 0.5, 12.4);
        p.l(2.0, 12.4);
        p.l(2.0, 15.4);
        p.close();
    }, C.hairShade);
    // Saç parlaması
    ctx.globalAlpha = 0.55;
    fill(() => { p.begin(); p.ellipse(-0.4, 14.35, 0.62, 0.16); }, C.hairLight);
    ctx.globalAlpha = 1;
    // Ense uçları
    ink(() => {
        p.begin();
        p.m(-1.1, 12.72);
        p.c(-0.86, 12.3, -0.5, 12.16, -0.2, 12.28);
        p.c(-0.34, 12.5, -0.3, 12.66, -0.16, 12.8);
        p.c(0.16, 12.36, 0.6, 12.22, 0.92, 12.4);
        p.c(0.8, 12.62, 0.86, 12.76, 1.02, 12.88);
        p.close();
    }, C.hair, 0.5);

    // Şapka (arkadan: ayar tokası görünür)
    const crown = () => {
        p.begin();
        p.m(-1.72, 14.62);
        p.c(-1.82, 15.6, -1.0, 16.28, 0, 16.28);
        p.c(1.0, 16.28, 1.82, 15.6, 1.72, 14.62);
        p.c(0.9, 14.9, -0.9, 14.9, -1.72, 14.62);
        p.close();
    };
    ink(crown, C.cap, 0.9);
    shade(crown, () => {
        p.begin();
        p.m(1.06, 16.4);
        p.c(1.4, 15.8, 1.5, 15.2, 1.44, 14.6);
        p.l(2.0, 14.6);
        p.l(2.0, 16.4);
        p.close();
    }, C.capShade);
    // Ayar bandı
    ink(() => {
        p.begin();
        p.m(-0.46, 14.78);
        p.l(0.46, 14.78);
        p.l(0.46, 14.5);
        p.l(-0.46, 14.5);
        p.close();
    }, C.capPanel, 0.45);
    line(() => {
        p.begin();
        p.m(0, 14.78);
        p.l(0, 14.5);
    }, C.capShade, 0.6);
    });
}

// dir: 'down' | 'up' | 'right'  ('left' çağıran tarafta aynalanır)
export function paintTrainer(ctx, dir, swing, u, brush) {
    if (dir === 'up') drawBack(ctx, u, brush, swing);
    else if (dir === 'down') drawFront(ctx, u, brush, swing);
    else drawSide(ctx, u, brush, swing);
}
