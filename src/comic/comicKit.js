// Çizgi roman karelerinin paylaştığı çizim araçları.
//
// Kare çizimleri (src/comic/art/*) buradan besleniyor; sayfanın kendisi
// (çerçeve, anlatıcı kutusu, başlık kartı) comicArt.js'te. Ayrı durmalarının
// sebebi dairesel içe aktarma: comicArt kareleri topluyor, kareler de
// araçlara ihtiyaç duyuyor.

import { PX, blk, hash } from '../pixel/pixelDraw.js';

// Sayfa ölçüleri (canvas 1000x560)
export const PAGE = { w: 1000, h: 560 };
export const MARGIN = PX * 7;     // sayfa kenarı ile çerçeve arası
export const INK = PX * 2;        // çerçeve kalınlığı

export const PAGE_BG = '#0a0a0c';
export const INK_COLOR = '#141210';
export const PAPER = '#f4f1e4';

// Karenin içi: kare çizimleri bu dikdörtgene çiziyor
export const AREA = {
    x: MARGIN + INK,
    y: MARGIN + INK,
    w: PAGE.w - (MARGIN + INK) * 2,
    h: PAGE.h - (MARGIN + INK) * 2
};

// --- Yumuşatma eğrileri (hareketli kareler için) ---
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeIn = (t) => t * t;
// 0..1 aralığının bir parçasını 0..1'e yayar: "şu andan şu ana kadar" demek
export const span = (t, from, to) => clamp01((t - from) / (to - from));
export const lerp = (a, b, t) => a + (b - a) * t;
// Izgaraya oturmuş ara değer: hareket eden nesneler de piksel ızgarasında kalır
export const gridLerp = (a, b, t) => Math.round(lerp(a, b, t) / PX) * PX;

// --- Kamera ---
//
// Sinematik kareler odayı HÜCRE düzleminde çiziyor: kamera hangi hücrenin
// ekranın ortasında duracağını (cx, cy) ve bir hücrenin kaç piksel olacağını
// (u) söylüyor. Yakınlaşınca pikselin KENDİSİ büyüyor - görüntü büyütülmüş
// bir resim gibi bulanıklaşmıyor, piksel dili yakın planda da duruyor.
//
//   const cam = createCam(A, { u: PX, cx: 116, cy: 61 });
//   cam.rect(ctx, 10, 20, 8, 4, '#fff');     // hücre koordinatı, hücre ölçüsü
//
// Kenarlar hep tam piksele yuvarlanıyor ve komşu dikdörtgenler aynı
// hesaptan geçtiği için aralarında ne boşluk ne binme kalıyor.
export function createCam(A, { u = PX, cx = 0, cy = 0 } = {}) {
    const unit = Math.max(0.5, u);
    const ox = Math.round(A.x + A.w / 2 - cx * unit);
    const oy = Math.round(A.y + A.h / 2 - cy * unit);
    const px = (c) => ox + Math.round(c * unit);
    const py = (c) => oy + Math.round(c * unit);
    return {
        u: unit,
        px, py,
        rect(ctx, x, y, w, h, color) {
            const x0 = px(x), y0 = py(y);
            const x1 = px(x + w), y1 = py(y + h);
            if (x1 <= x0 || y1 <= y0) return;
            ctx.fillStyle = color;
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        },
        // Işık lekesi: merkez ve yarıçap da hücre biriminde
        glow(ctx, x, y, radius, color, strength = 0.5) {
            glow(ctx, px(x), py(y), Math.max(1, radius * unit), color, strength);
        }
    };
}

// --- Zeminler ---

// Düz renk zemin
export function fill(ctx, color) {
    blk(ctx, AREA.x, AREA.y, AREA.w, AREA.h, color);
}

// Yukarıdan aşağı iki renk arası bant bant geçiş (piksel dilinde degrade)
export function bands(ctx, x, y, w, h, from, to, steps = 10) {
    const parse = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const [r1, g1, b1] = parse(from);
    const [r2, g2, b2] = parse(to);
    const bandH = Math.ceil(h / steps / PX) * PX;
    for (let i = 0; i < steps; i++) {
        const k = i / (steps - 1 || 1);
        const c = (a, b) => Math.round(a + (b - a) * k).toString(16).padStart(2, '0');
        blk(ctx, x, y + i * bandH, w, bandH, `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`);
    }
}

// İki rengi karıştır
export function mix(from, to, t) {
    const parse = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const [r1, g1, b1] = parse(from);
    const [r2, g2, b2] = parse(to);
    const c = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
    return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

// Karanlık köşeler: karenin ortasına bakılsın diye
export function vignette(ctx, strength = 0.55) {
    const { x, y, w, h } = AREA;
    const grad = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.32, x + w / 2, y + h / 2, h * 0.95);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
}

// Kareyi karart (ışık sönmesi, gece): 0 = dokunma, 1 = tamamen siyah
export function darken(ctx, amount) {
    if (amount <= 0) return;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, amount)})`;
    ctx.fillRect(AREA.x, AREA.y, AREA.w, AREA.h);
}

// Yumuşak ışık lekesi. color içindeki ALPHA yerine güç konuyor:
//   glow(ctx, x, y, 90, 'rgba(120,220,80,ALPHA)', 0.5)
export function glow(ctx, x, y, radius, color, strength = 0.5) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color.replace('ALPHA', String(strength)));
    grad.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = grad;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// --- Virüsün biçimi ---
//
// TEK RENK, OVALİMSİ, AKIŞKAN, BEYAZ IŞIKLI. Kullanıcının tarifi bu; hem
// laboratuvarda kaptan çıkan kütle hem caddede mazgaldan çıkan kütle aynı
// şey, o yüzden çizim tek yerde duruyor.
//
// Işık şöyle veriliyor: aynı oval önce BEYAZ basılıyor, üstüne gövde biraz
// küçültülüp sağ alta kaydırılarak konuyor. Geriye üst-sol kenarda beyaz bir
// hilal kalıyor - hacim oradan okunuyor. Gövdenin ayrıca dış hattı yok.

export const VIRUS_COLOR = '#3f9a28';
export const VIRUS_LIGHT = '#f2fff4';

// Hücre düzleminde oval. wob: kenarın dalgalanması (akışkanlık).
export function ellipseCells(ctx, cam, x, y, rx, ry, color, wob = 0) {
    if (rx <= 0.05 || ry <= 0.05) return;
    const rows = Math.max(4, Math.ceil(ry * 3.2));
    const rowH = (ry * 2) / rows;
    for (let i = 0; i < rows; i++) {
        const dy = -ry + (i + 0.5) * rowH;
        const k = dy / ry;
        let half = rx * Math.sqrt(Math.max(0, 1 - k * k));
        // Dalga sayısı kütlenin boyundan BAĞIMSIZ: mutlak dy ile hesaplanınca
        // büyük kütlede kenar tırtıklı bir çentik dizisine dönüyor.
        // Genlik de kısık: fazlası ovali köşeli bir lekeye çeviriyor.
        half *= 1 + Math.sin(k * 2.4 + wob) * 0.05 + Math.sin(k * 5.1 - wob * 1.3) * 0.025;
        if (half <= 0.05) continue;
        cam.rect(ctx, x - half, y + dy - rowH / 2, half * 2, rowH + 0.4, color);
    }
}

// x, y = kütlenin MERKEZİ. r taban yarıçap, wide yatay genişleme,
// stretch/dirX/dirY hareketin uzattığı yön, light beyaz ışığın gücü.
export function drawBlob(ctx, cam, {
    x, y, r = 4, wide = 1.25, wob = 0, stretch = 0, dirX = 1, dirY = 0, light = 1
}) {
    const ax = Math.abs(dirX);
    const ay = Math.abs(dirY);
    const rx = r * wide * (1 + stretch * 0.55 * ax) * (1 - stretch * 0.3 * ay);
    const ry = r * (1 + stretch * 0.55 * ay) * (1 - stretch * 0.3 * ax);
    if (rx <= 0.05 || ry <= 0.05) return;

    if (light > 0) cam.glow(ctx, x, y, Math.max(rx, ry) * 3, 'rgba(255,255,255,ALPHA)', 0.2 * light);
    ellipseCells(ctx, cam, x, y, rx, ry, VIRUS_LIGHT, wob);
    ellipseCells(ctx, cam, x + rx * 0.1, y + ry * 0.13, rx * 0.93, ry * 0.89, VIRUS_COLOR, wob);
    cam.rect(ctx, x - rx * 0.5, y - ry * 0.52, Math.max(0.7, rx * 0.22), Math.max(0.6, ry * 0.16), VIRUS_LIGHT);
}

// Akarken arkada kalan damlalar: kütle katı değil
export function blobDrops(ctx, cam, x, y, dirX, dirY, r, k = 1) {
    if (k <= 0) return;
    for (let i = 0; i < 2; i++) {
        const back = (i + 1) * r * 1.6 * k;
        const s = r * (0.3 - i * 0.1);
        if (s <= 0.05) continue;
        ellipseCells(ctx, cam, x - dirX * back, y - dirY * back, s * 1.2, s, VIRUS_LIGHT, 0);
        ellipseCells(ctx, cam, x - dirX * back + s * 0.2, y - dirY * back + s * 0.2, s, s * 0.8, VIRUS_COLOR, 0);
    }
}

// --- Ortak nesneler ---

// Fayans duvar: laboratuvarın ve çalışma alanının arka planı
export function tiledWall(ctx, x, y, w, h, tone = '#3b4249', seam = '#2b3137') {
    blk(ctx, x, y, w, h, tone);
    const tile = PX * 9;
    for (let ty = y; ty < y + h; ty += tile) blk(ctx, x, ty, w, PX, seam);
    for (let tx = x; tx < x + w; tx += tile) blk(ctx, tx, y, PX, h, seam);
    for (let sx = x; sx < x + w; sx += PX) {
        for (let sy = y; sy < y + h; sy += PX) {
            if (hash(sx, sy, 5) < 0.05) blk(ctx, sx, sy, PX, PX, seam);
        }
    }
}

// Kolundaki TURUNCU BANT: profesörün tek işareti, asla söylenmez
export const BAND_COLOR = '#d2691e';

// Cam kap: prologun nesnesi.
//   level  0..1 sıvı seviyesi      cracks 0..4 çatlak sayısı
//   leak   0..1 kenarından inen sızıntı
export function drawFlask(ctx, x, y, unit = PX, { level = 0.6, cracks = 0, leak = 0, glassTop = true } = {}) {
    const u = unit;
    const w = u * 7;
    const h = u * 10;
    const gx = Math.round((x - w / 2) / PX) * PX;
    const gy = Math.round((y - h) / PX) * PX;

    if (glassTop) {
        blk(ctx, gx + u * 2, gy - u * 3, u * 3, u * 3, '#9fb3bd');   // boyun
        blk(ctx, gx + u * 2, gy - u * 4, u * 3, u, '#c86a2a');       // kapak
    }
    blk(ctx, gx, gy, w, h, '#8fa6b1');                               // cam kenarı
    blk(ctx, gx + u, gy + u, w - u * 2, h - u * 2, '#c3d6de');       // cam içi

    const liquidH = Math.round((h - u * 3) * level / u) * u;
    if (liquidH > 0) {
        blk(ctx, gx + u, gy + h - u - liquidH, w - u * 2, liquidH, '#4a8f2a');
        blk(ctx, gx + u, gy + h - u - liquidH, w - u * 2, u, '#7fd049');
    }
    blk(ctx, gx + u, gy + u * 2, u, u * 4, '#eaf4f7');               // parıltı

    // Çatlaklar sabit yerlerde: sayısı arttıkça cam daha çok kırılıyor.
    // Kalınlık kabın biriminden BAĞIMSIZ: hücre hücre doldurulunca yakın
    // planda çatlak değil koca blok oluyordu.
    const CRACKS = [
        [[2, 3], [3, 4], [3, 5], [4, 7]],
        [[5, 2], [5, 3], [4, 4], [4, 6]],
        [[1, 5], [2, 6], [2, 7], [3, 9]],
        [[4, 7], [5, 8], [6, 9], [6, 10]]
    ];
    const crackW = Math.max(PX, Math.round(u / 4 / PX) * PX);
    for (let i = 0; i < Math.min(cracks, CRACKS.length); i++) {
        const path = CRACKS[i];
        for (let k = 0; k < path.length - 1; k++) {
            limb(ctx, gx + path[k][0] * u, gy + path[k][1] * u,
                gx + path[k + 1][0] * u, gy + path[k + 1][1] * u, crackW, '#26323a');
        }
    }

    if (leak > 0) {
        const runH = Math.round(u * 16 * leak / u) * u;
        blk(ctx, gx + u * 2, gy + h, u, runH, '#4a8f2a');
        blk(ctx, gx + u, gy + h + runH, u * 3, u, '#7fd049');
    }
    return { x: gx, y: gy, w, h };
}

// Önlüklü kol: (x, y) sol üst köşe, aşağı doğru uzanır. Eldiven ucunda.
// band=true ise turuncu bant kolun üst ucunda.
// Izgaraya oturan kalın çapraz çizgi: kol, çatlak, kablo gibi eğik şeyler
// poligonla çizilince kenarları yumuşuyor ve piksel dili bozuluyor. Bunun
// yerine uzun eksen boyunca blok blok yürünüyor.
export function limb(ctx, x0, y0, x1, y1, thickness, color) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / PX));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        blk(ctx, x0 + dx * k - thickness / 2, y0 + dy * k, thickness, PX * 2, color);
    }
}

// Önlüklü kol: (x0, y0) omuzdan (x1, y1) ele. Ucunda eldiven, istenirse
// bileğin yukarısında TURUNCU BANT - kadrajın içinde kalsın diye kolun
// %35'ine oturuyor.
export function drawArm(ctx, x0, y0, x1, y1, thickness, {
    band = false, bandAt = 0.72, glove = '#eef2f5', sleeve = '#dfe3e8',
    shade = '#b9c0c6', outline = '#7d858c'
} = {}) {
    limb(ctx, x0, y0, x1, y1, thickness + PX * 2, outline);       // mürekkep kenarı
    limb(ctx, x0, y0, x1, y1, thickness, sleeve);
    limb(ctx, x0 - thickness / 2 + PX, y0, x1 - thickness / 2 + PX, y1, PX, shade);

    // Bant bileğe yakın: kadrajın ortasında, ele bakan gözün göreceği yerde
    if (band) {
        const bx = lerp(x0, x1, bandAt);
        const by = lerp(y0, y1, bandAt);
        blk(ctx, bx - thickness / 2 - PX, by, thickness + PX * 2, PX * 5, BAND_COLOR);
        blk(ctx, bx - thickness / 2 - PX, by, thickness + PX * 2, PX, '#a04d15');
    }
}

// Kavrayan el: cam kabı tutan parmaklar. (x, y) elin merkezi, dir -1 sol / +1 sağ
export function drawGrip(ctx, x, y, dir, unit = PX, glove = '#eef2f5') {
    const u = unit;
    blk(ctx, x - u * 3, y - u * 4, u * 6, u * 9, '#7d858c');           // mürekkep kenarı
    blk(ctx, x - u * 2, y - u * 3, u * 4, u * 7, glove);
    // Parmaklar kabın üstüne biniyor: el nesneyi TUTUYOR görünsün
    for (let i = 0; i < 3; i++) {
        const fy = y - u * 2 + i * u * 3;
        blk(ctx, x + dir * u * 2, fy - u, dir * u * 5, u * 3, '#7d858c');
        blk(ctx, x + dir * u * 2, fy, dir * u * 4, u * 2, glove);
    }
    blk(ctx, x - u * 2, y - u * 3, u * 4, u, '#c6ced4');
}

// Raf: laboratuvarın duvarındaki üç katlı çelik raf
export function drawShelfUnit(ctx, x, y, w, h, shelves = 3) {
    blk(ctx, x, y, w, h, '#2f353b');
    blk(ctx, x, y, PX * 2, h, '#454d55');
    blk(ctx, x + w - PX * 2, y, PX * 2, h, '#454d55');
    const gap = Math.round(h / shelves / PX) * PX;
    const levels = [];
    for (let i = 1; i <= shelves; i++) {
        const sy = y + gap * i - PX * 2;
        blk(ctx, x, sy, w, PX * 2, '#6b757e');
        blk(ctx, x, sy + PX * 2, w, PX, '#252a2f');
        levels.push(sy);
    }
    return levels;      // rafların üst yüzeyleri (nesne buraya oturuyor)
}

// Küçük şişe/kavanoz sırası: rafları doldurmak için
export function drawJars(ctx, x, y, count, seed = 0) {
    for (let i = 0; i < count; i++) {
        const jx = x + i * PX * 7;
        const tall = hash(i, seed, 3) > 0.5;
        const h = tall ? PX * 9 : PX * 6;
        const tone = hash(i, seed, 7) > 0.6 ? '#8a9aa2' : '#6f7d85';
        blk(ctx, jx, y - h, PX * 5, h, tone);
        blk(ctx, jx + PX, y - h + PX, PX * 3, h - PX * 2, '#aab8bf');
        blk(ctx, jx + PX, y - PX * 3, PX * 3, PX * 2, '#59636a');
    }
}
