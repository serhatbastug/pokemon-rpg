// İki kişilik arenanın dövüşçüleri.
//
// İkisi de piksel ızgarasına (PX = 4) oturuyor, ikisi de ÖNDEN çiziliyor:
// asimetri iki karakterin de kimliği (anti-virüsün yalnız bir yanı kaplı),
// aynalanınca hangi yanın kaplı olduğu değişirdi. Bu yüzden arenada
// sprite'lar aynalanmıyor.
//
// Yönler karakterin kendi yönüdür: karakterin SAĞ yanı, önden bakıldığı için
// İZLEYİCİNİN SOLUNDA kalır. Anti-virüsün kaplı yanı ve lekeli ayağı bu
// yüzden çizimde solda duruyor.
//
// Sprite'lar bir kez çizilip saklanıyor: her karede kırk küsur satırlık
// kütleyi yeniden hesaplamanın anlamı yok.

import { PX, newCanvas, blk, dot, hash } from '../pixel/pixelDraw.js';

// --- Ortak çizim parçaları ---

// Bir satır et: gövde rengi + iki yanda kontur + solda ışık, sağda gölge.
// Işık hep soldan geliyor (prologun da kuralı bu).
function fleshRow(ctx, x0, x1, y, P) {
    if (x1 - x0 < PX * 2) return;
    blk(ctx, x0, y, x1 - x0, PX, P.body);
    blk(ctx, x0, y, PX, PX, P.outline);
    blk(ctx, x1 - PX, y, PX, PX, P.outline);
    blk(ctx, x0 + PX, y, PX * 2, PX, P.light);
    blk(ctx, x1 - PX * 3, y, PX * 2, PX, P.dark);
}

// Satır satır tanımlanan bir uzuv: merkez çizgisi ve yarı kalınlığı satırın
// fonksiyonu. Dirsek ve bilek yumruları kalınlığın kendisinden geliyor.
// seamAt: koyu ek yerinin hangi satırlara düşeceği - kolun bir boru değil
// parçalı bir kütle olduğunu okutan şey bu. Düzenli aralıklı olunca lastik
// izi gibi duruyordu, o yüzden aralık düzensiz.
function limb(ctx, top, bottom, centerAt, halfAt, P, { seamAt = null } = {}) {
    for (let row = top; row < bottom; row++) {
        const c = centerAt(row);
        const half = halfAt(row);
        if (half < 1) continue;
        const x0 = Math.round(c - half) * PX;
        const x1 = Math.round(c + half) * PX;
        fleshRow(ctx, x0, x1, row * PX, P);
        if (seamAt && seamAt(row)) {
            blk(ctx, x0 + PX, row * PX, x1 - x0 - PX * 2, PX, P.dark);
            blk(ctx, x0 + PX, row * PX, PX, PX, P.vein);
        }
    }
}

// Sarkan damla: kütle katı değil, akıyor. Ucu bir blok şişkin kalıyor.
function drip(ctx, col, top, len, P) {
    const x = col * PX;
    blk(ctx, x, top * PX, PX, len * PX, P.dark);
    blk(ctx, x, top * PX, PX, PX, P.body);
    blk(ctx, x - PX, (top + len - 1) * PX, PX * 3, PX, P.dark);
    blk(ctx, x, (top + len) * PX, PX, PX, P.outline);
}

// Üç tırnaklı pençe. col0 = elin sol kenarı (blok), w = genişliği (blok).
function claw(ctx, col0, w, top, P) {
    const fingers = [0, Math.floor(w / 2) - 1, w - 2];
    for (let i = 0; i < fingers.length; i++) {
        const fx = (col0 + fingers[i]) * PX;
        const len = i === 1 ? 4 : 3;                 // ortadaki tırnak uzun
        blk(ctx, fx, top * PX, PX * 2, len * PX, P.body);
        blk(ctx, fx, top * PX, PX, len * PX, P.outline);
        blk(ctx, fx + PX, top * PX, PX, PX, P.light);
        blk(ctx, fx, (top + len) * PX, PX * 2, PX, P.outline);
    }
}

// Çizilmiş piksellerin ÜSTÜNE doku serper. source-atop olmadan siluetin
// dışına da leke düşüyor. Tek nokta yerine ara sıra iki bloklu leke:
// hepsi tek blok olunca doku kum serpintisi gibi duruyor.
function skinTexture(ctx, w, h, P, salt) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let y = 0; y < h; y += PX) {
        for (let x = 0; x < w; x += PX) {
            const r = hash(x, y, salt);
            if (r < 0.04) blk(ctx, x, y, PX * 2, PX, P.vein);
            else if (r < 0.08) dot(ctx, x, y, P.vein);
            else if (r < 0.15) blk(ctx, x, y, PX, PX * 2, P.skin);
        }
    }
    ctx.restore();
}

// ================= VİRÜS =================
//
// Yeşil virüsün bir insana tamamen geçmiş, tam gelişmiş hâli. Hikâyede bu
// gövdenin TAMAMI erimiş durumda: insan hatları kalmadı. Bu yüzden burada
// ne boyun var, ne omuz çizgisi, ne de ayak - gövde altta bir birikintiye
// dönüşerek bitiyor.
//
// Kafa bilerek insan kafası değil: öne uzamış, sağa kaykılmış, gözleri
// farklı yükseklikte ve farklı büyüklükte, çenesi yok - yerinde etin iplik
// iplik ayrıldığı bir yarık var. İki simetrik göz + çene her seferinde bir
// insan yüzü okutuyordu.

const VIRUS_P = {
    body: '#4a7c1f',
    dark: '#2f5312',
    light: '#6ea32c',
    vein: '#8fc23a',
    skin: '#3c6618',
    eye: '#d9f65a',
    outline: '#16260a',
    drool: '#a7d84a'
};

const V_COLS = 48;
const V_ROWS = 48;
const V_CX = 24;

// Kafa: satır satır yarı genişlik (satır 0..12)
const V_HEAD = [3, 5, 6, 7, 8, 8, 8, 8, 8, 7, 6, 5, 4];
const V_SHOULDER = 11;      // omuz kafanın son satırlarıyla iç içe: boyun yok
const V_HIP = 33;
const V_POOL = 44;          // buradan sonrası ayak değil, erimiş birikinti

// Kafanın sağa kayması: simetrik bir kafa hep insan kafası gibi duruyor
const headSkew = (row) => Math.round(row * 0.3);

// Gövdenin bir satırdaki yarı genişliği (blok)
function virusHalf(row) {
    if (row < V_SHOULDER) return V_HEAD[row] ?? 0;
    if (row < 17) return 8.5 + (row - V_SHOULDER) * 0.6;
    if (row < 26) return 12;
    if (row < V_HIP) return 12 - (row - 26) * 0.3;
    return 10;
}

let virusCache = null;

export function virusSprite() {
    if (virusCache) return virusCache;

    const w = PX * V_COLS;
    const h = PX * V_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    const P = VIRUS_P;
    const cx = V_CX * PX;
    const R = (row) => row * PX;
    const B = (col) => col * PX;

    // --- 1) Kafa ---
    for (let row = 0; row < V_HEAD.length; row++) {
        const skew = B(headSkew(row));
        const half = B(V_HEAD[row]);
        fleshRow(ctx, cx - half + skew, cx + half + skew, R(row), P);
    }
    // Tepede iki sırt çıkıntısı: kemik değil, katılaşmış et
    blk(ctx, cx - B(5), R(0), B(2), R(2), P.body);
    blk(ctx, cx - B(5), R(0), PX, R(2), P.outline);
    blk(ctx, cx + B(3), -PX, B(2), R(3), P.body);
    blk(ctx, cx + B(3), -PX, PX, R(3), P.outline);

    // Kaş çıkıntısı: ortada kırılıyor, iki yarısı aynı hizada değil
    blk(ctx, cx - B(7), R(3), B(6), PX, P.outline);
    blk(ctx, cx + B(1), R(4), B(7), PX, P.outline);

    // Gözler: farklı yükseklikte, farklı büyüklükte. Üstüne şakakta küçük
    // bir üçüncü göz - kafayı insanlıktan çıkaran asıl şey bu.
    blk(ctx, cx - B(6), R(4), B(3), R(2), P.eye);
    blk(ctx, cx + B(2), R(5), B(2), R(2), P.eye);
    dot(ctx, cx - B(6), R(4), '#ffffff');
    dot(ctx, cx + B(2), R(5), '#ffffff');
    blk(ctx, cx - B(6), R(6), B(3), PX, P.outline);
    blk(ctx, cx + B(2), R(7), B(2), PX, P.outline);
    blk(ctx, cx + B(6), R(8), B(2), PX, P.eye);          // üçüncü göz, şakakta

    // Ağız: çene yok. Etin iplik iplik ayrıldığı, merkezden kaçık bir yarık.
    const mawTop = R(9);
    blk(ctx, cx - B(3), mawTop, B(11), R(3), P.outline);
    for (const col of [-2, 0, 3, 5, 7]) {
        blk(ctx, cx + B(col), mawTop, PX, R(3), P.drool);
    }
    blk(ctx, cx - B(1), mawTop + R(3), PX, R(2), P.drool);
    blk(ctx, cx + B(6), mawTop + R(3), PX, R(3), P.drool);

    // --- 2) Gövde: omuzdan kalçaya inen kütle, kenarları düzensiz ---
    for (let row = V_SHOULDER; row <= V_HIP; row++) {
        const half = B(Math.round(virusHalf(row)));
        const bumpL = hash(row, 0, 411) < 0.35 ? PX : 0;
        const bumpR = hash(row, 1, 413) < 0.35 ? PX : 0;
        fleshRow(ctx, cx - half - bumpL, cx + half + bumpR, R(row), P);
    }
    // Sol omuz sağdakinden yüksek ve daha kütleli: iki omuz aynı hizada
    // olunca gövde erimiş değil, dik duran bir insan gibi okunuyor.
    for (let row = 9; row < 20; row++) {
        const half = row < 12 ? 3 + (row - 9) : 6;
        fleshRow(ctx, cx - B(9 + half), cx - B(7), R(row), P);
    }
    // Göğüste erimiş bir oluk
    blk(ctx, cx - PX, R(15), B(2), R(9), P.dark);
    blk(ctx, cx - PX, R(15), PX, R(9), P.vein);
    // Gövdenin sağ kenarından sarkan iki damla
    drip(ctx, V_CX + 12, 24, 4, P);
    drip(ctx, V_CX - 13, 21, 3, P);

    // --- 3) Kollar: parçalı, dirsekte yumrulu, ucunda pençe ---
    // Sol kol daha uzun ve daha kalın; iki kol aynı olunca kütle donuk duruyor.
    const armCenter = (side, row, top, bottom) => {
        const t = (row - top) / (bottom - top);
        const edge = virusHalf(Math.min(row, V_HIP));
        return V_CX + side * (edge + 5 + t * 2);     // ön kol dışa açılıyor
    };
    const armHalf = (row, top, bottom) => {
        const t = (row - top) / (bottom - top);
        if (t < 0.16) return 4.5;     // omuz
        if (t < 0.32) return 5.5;     // pazı
        if (t < 0.44) return 6;       // dirsek yumrusu
        if (t < 0.58) return 4.5;     // ön kol
        if (t < 0.84) return 5;       // bileğin üstündeki şişme
        return 4;                     // bilek
    };

    const drawArm = (side, top, bottom, salt) => {
        limb(ctx, top, bottom,
            (row) => armCenter(side, row, top, bottom),
            (row) => armHalf(row, top, bottom), P,
            { seamAt: (row) => hash(row, side, salt) < 0.28 });
        const c = armCenter(side, bottom - 1, top, bottom);
        const half = armHalf(bottom - 1, top, bottom);
        claw(ctx, Math.round(c - half), Math.round(half * 2), bottom, P);
        // Koldan sarkan damlalar: kol da eriyor
        drip(ctx, Math.round(c - half) + 1, bottom - 9, 3, P);
        drip(ctx, Math.round(c + half) - 2, bottom - 6, 2, P);
    };
    drawArm(-1, 11, 40, 91);
    drawArm(1, 14, 37, 97);

    // --- 4) Bacaklar ve altındaki birikinti ---
    // Ayak yok: bacaklar aşağı indikçe yayılıp tek bir kütlede birleşiyor.
    for (const col of [-10, 2]) {
        for (let row = V_HIP; row < V_POOL; row++) {
            const grow = Math.max(0, row - (V_POOL - 5)) * 0.6;
            fleshRow(ctx, cx + B(col - grow), cx + B(col + 8 + grow), R(row), P);
        }
    }
    for (let row = V_POOL; row < V_ROWS; row++) {
        const spread = 13 + (row - V_POOL) * 2;
        fleshRow(ctx, cx - B(spread), cx + B(spread), R(row), P);
    }
    blk(ctx, cx - B(17), R(V_ROWS - 1), B(34), PX, P.outline);
    // Bacak arasından sarkan damlalar
    drip(ctx, V_CX - 1, V_HIP + 1, 4, P);
    drip(ctx, V_CX + 1, V_HIP + 3, 3, P);

    skinTexture(ctx, w, h, P, 401);

    virusCache = { canvas, ox: cx, oy: h, w, h };
    return virusCache;
}

// ================= ANTİ-VİRÜS =================
//
// Hikâyede tanışacağımız ilk FARKLI virüs. Yeşilin başka renge boyanmış hâli
// değil: mercan rengi, kabuk kabuk, sert kenarlı bambaşka bir kütle. Palette
// kırmızı AZ, mercan ÇOK - kırmızı yalnız en dipteki gölgelerde.
//
// Asıl farkı taşıyıcısını TAMAMEN kaplamaması:
//   · yalnız gövdenin SAĞ yanını, belin üstünü sarmış; bel hizasında sert bir
//     çizgiyle değil, seyrelen lekelerle bitiyor,
//   · taşıyıcının SOL kolundan yukarı girintili çıkıntılı bir boru uzanıyor,
//     ucunda anti-virüsün kendi küçük kafası var (belli belirsiz iki göz ve
//     bir ağız - fazlası bunu bir yüz yapardı),
//   · sağ ayağını saran, yalnız ayakta kalan lekeler var.

const CORAL_P = {
    body: '#f2795c',
    dark: '#c9503a',
    light: '#ff9f7e',
    vein: '#ffc4ad',
    skin: '#e0674c',
    outline: '#5e1d14',
    eye: '#ffe0d0',
    red: '#a32d22'          // kırmızı: yalnız en derin gölgelerde
};

const HUMAN_P = {
    k: '#1f2937',           // kontur
    h: '#2b2119',           // saç
    s: '#f6c8a0',           // ten
    S: '#e0a97d',           // ten gölgesi
    c: '#46505e',           // iş tulumu
    C: '#333b46',           // tulum gölgesi
    y: '#111827'            // ayakkabı
};

// İkinci taşıyıcı: elektro-virüsün adamıyla aynı kişi olmasın diye ayrı bir
// palet - açık kahve saç, haki tulum, kahve bot.
const HUMAN_B = {
    k: '#1f2937',
    h: '#4a3a2a',
    s: '#e8b98c',
    S: '#c9985f',
    c: '#5a5340',
    C: '#43402f',
    y: '#2a2118'
};

// Üçüncü taşıyıcı: yeşil virüsün girişindeki adam. Üçü de ayrı kişi olsun
// diye üçüncü bir palet - siyah saç, bordo ceket.
const HUMAN_C = {
    k: '#1f2937',
    h: '#161616',
    s: '#d9a273',
    S: '#b8834f',
    c: '#6b3030',
    C: '#4d2020',
    y: '#141414'
};

const A_COLS = 40;
const A_ROWS = 50;
const A_CX = 20;

const A_HEAD = 10;          // insan kafasının üst satırı
const A_SHOULDER = 20;
const A_WAIST = 33;
const A_HIP = 35;
const A_FOOT = 47;

// Mercan kaplamanın gövde üzerinde nereye kadar ilerlediği (merkeze göre
// blok; büyük sayı = göğsün daha çoğu kaplı). Bel hizasında sıfıra iniyor.
function coralReach(row) {
    if (row < A_SHOULDER) return 3;
    if (row < 26) return 3 - (row - A_SHOULDER) * 0.2;
    return Math.max(-6, 1.8 - (row - 26) * 0.9);
}

// Anti-virüsün TAŞIYICISI: kaplamanın altındaki adam.
//
// Ayrı bir fonksiyon çünkü giriş animasyonu bu adamı kaplamasız, üstelik
// hareketli çiziyor (sağ bacağını çekip yere vuruyor). Kaplamalı sprite ile
// animasyondaki adamın AYNI iskeletten gelmesi şart: yoksa dönüşüm sırasında
// figür bir kayıyor.
//
// legLift: karakterin SAĞ bacağı (izleyicinin solu) ne kadar yukarı çekilmiş
// headTilt: kafa karakterin kendi SAĞINA ne kadar yatık (0..1)
export function paintCarrier(ctx, ox, oy, { legLift = 0, headTilt = 0 } = {}) {
    const H = HUMAN_B;
    const X = (col) => ox + col * PX;
    const Y = (row) => oy + row * PX;
    const cx = X(A_CX);
    const B = (col) => col * PX;
    const R = (row) => row * PX;

    // Yatıklık kesme (shear) ile veriliyor: tepe satırlar dipten daha çok
    // kayıyor. Kafayı olduğu gibi yana kaydırmak "yattı" değil "kaydı"
    // gösteriyordu.
    const tiltAt = (row) => {
        const k = Math.max(0, Math.min(1, (row - A_HEAD) / 11));
        return -Math.round(headTilt * 2 * (1 - k));
    };
    // Kafa bölgesi çizimi: sütunlar MERKEZE GÖRE, her satır kendi yatıklığıyla
    const hblk = (col, row, cols, rows, color) => {
        for (let r = 0; r < rows; r++) {
            blk(ctx, cx + B(col + tiltAt(row + r)), Y(row + r), B(cols), PX, color);
        }
    };

    // --- Kafa ---
    // YÜZ: kaplama yüzün sağ yarısını yalıyor, kalan yarısı taşıyıcının hâlâ
    // insan olduğunu göstermeli - o yüzden burada gerçekten bir surat var.
    hblk(-4, A_HEAD, 8, 10, H.s);                               // yüz
    hblk(-4, A_HEAD, 1, 10, H.k);                               // sol dış hat
    hblk(3, A_HEAD, 1, 10, H.k);                                // sağ dış hat
    hblk(-4, A_HEAD + 10, 8, 1, H.k);                           // çene hattı

    hblk(-4, A_HEAD, 8, 3, H.h);                                // saç
    hblk(-5, A_HEAD + 1, 1, 6, H.h);                            // yandan saç
    hblk(4, A_HEAD + 1, 1, 3, H.h);
    hblk(1, A_HEAD + 3, 3, 1, H.h);                             // alna düşen perçem
    hblk(-2, A_HEAD + 3, 2, 1, H.h);

    hblk(4, A_HEAD + 5, 1, 2, H.S);                             // kulak
    hblk(-1, A_HEAD + 4, 4, 1, H.k);                            // kaş
    hblk(0, A_HEAD + 5, 3, 1, '#ffffff');                       // gözün akı
    hblk(1, A_HEAD + 5, 1, 1, H.k);                             // göz bebeği
    hblk(0, A_HEAD + 6, 3, 1, H.S);                             // göz altı
    hblk(-1, A_HEAD + 6, 1, 3, H.S);                            // burun sırtı
    hblk(-2, A_HEAD + 8, 1, 1, H.S);                            // burun kanadı
    hblk(-1, A_HEAD + 9, 3, 1, H.k);                            // sıkılmış ağız
    hblk(-1, A_HEAD + 10, 3, 1, H.S);                           // alt dudak/çene
    hblk(2, A_HEAD + 7, 1, 2, H.S);                             // yanağın gölgesi
    blk(ctx, cx - B(2), Y(A_HEAD + 11), B(4), R(2), H.S);       // boyun (yatmaz)
    if (headTilt > 0.3) blk(ctx, cx + B(1), Y(A_HEAD + 11), B(2), PX, H.k);

    // --- Gövde ---
    for (let row = A_SHOULDER; row < A_HIP; row++) {
        const half = row < A_SHOULDER + 2 ? 7 : 6;
        blk(ctx, cx - B(half), Y(row), B(half * 2), PX, H.c);
        blk(ctx, cx - B(half), Y(row), PX, PX, H.k);
        blk(ctx, cx + B(half) - PX, Y(row), PX, PX, H.k);
        if (row === A_WAIST - 1) blk(ctx, cx - B(half), Y(row), B(half * 2), PX, H.C);
    }
    // Taşıyıcının SOL kolu (izleyicinin sağı): sağlam kol
    for (let row = A_SHOULDER + 1; row < A_HIP - 1; row++) {
        const skin = row > A_HIP - 6;
        blk(ctx, cx + B(7), Y(row), B(3), PX, skin ? H.s : H.c);
        blk(ctx, cx + B(7), Y(row), PX, PX, H.k);
        blk(ctx, cx + B(9), Y(row), PX, PX, H.k);
    }

    // --- Bacaklar ---
    // Karakterin SAĞ bacağı (izleyicinin solu) yukarı çekilebiliyor: diz
    // kalkıyor, ayak kendine doğru içeri geliyor.
    const lift = Math.round(legLift * 7);
    const pull = Math.round(legLift * 2);
    for (const [col, up, inward] of [[-6, lift, pull], [1, 0, 0]]) {
        const c = col + inward;
        const foot = A_FOOT - up;
        blk(ctx, cx + B(c), Y(A_HIP), B(5), R(foot - A_HIP), H.c);
        blk(ctx, cx + B(c), Y(A_HIP), PX, R(foot - A_HIP), H.k);
        blk(ctx, cx + B(c + 4), Y(A_HIP), PX, R(foot - A_HIP), H.k);
        blk(ctx, cx + B(c), Y(foot), B(5), R(A_ROWS - A_FOOT), H.y);
        blk(ctx, cx + B(c), Y(foot + A_ROWS - A_FOOT - 1), B(5), PX, '#000000');
    }
}

let antivirusCache = null;

export function antivirusSprite() {
    if (antivirusCache) return antivirusCache;

    const w = PX * A_COLS;
    const h = PX * A_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    const C = CORAL_P;
    const cx = A_CX * PX;
    const R = (row) => row * PX;
    const B = (col) => col * PX;

    // --- 1) Taşıyıcı: kaplamanın altındaki adam ---
    // Giriş animasyonundaki adamla aynı çizim (bkz. paintCarrier)
    paintCarrier(ctx, 0, 0);

    // --- 2) Mercan kaplama: yalnız karakterin SAĞ yanı (izleyicinin solu) ---
    //
    // Omzun üstünde bir ibik gibi yükseliyor, göğsün sağ yarısını sarıyor,
    // bele doğru inceliyor ve orada seyrelen lekelere dönüşerek bitiyor.
    // Sert bir çizgiyle kesince "boyanmış" duruyordu.
    for (let row = A_SHOULDER - 2; row < A_WAIST + 2; row++) {
        const reach = coralReach(row);
        if (reach < -5) break;
        // Kaplama gövdeyi SARIYOR, gövdenin yanına yapışmış bir levha değil:
        // dış kenarı gövdenin hattında, yer yer bir blok taşıyor.
        const jag = hash(row, 3, 77) < 0.4 ? 1 : 0;
        const x0 = cx - B(7 + jag);
        const x1 = cx + B(Math.round(reach));
        if (x1 <= x0) continue;
        blk(ctx, x0, R(row), x1 - x0, PX, C.body);
        blk(ctx, x0, R(row), PX, PX, C.outline);
        blk(ctx, x0 + PX, R(row), PX, PX, C.light);
        blk(ctx, x1 - PX, R(row), PX, PX, C.dark);
        if (hash(row, 5, 51) < 0.3) blk(ctx, x0 + B(2), R(row), B(2), PX, C.vein);
        if (hash(row, 6, 52) < 0.2) blk(ctx, x1 - B(2), R(row), PX, PX, C.red);
    }
    // Omuz ibiği: kaplamanın en kalın yeri, omzun üstünden yükseliyor
    for (let i = 0; i < 4; i++) {
        const col = -8 + i;
        const top = A_SHOULDER - 2 - (i % 2 === 0 ? 2 : 1);
        blk(ctx, cx + B(col), R(top), PX, R(A_SHOULDER - top + 1), C.body);
        blk(ctx, cx + B(col), R(top), PX, PX, C.light);
    }
    // Beli geçen son lekeler: kaplamadan kopmuş, aşağı indikçe seyreliyor
    for (let row = A_WAIST; row < A_WAIST + 8; row++) {
        const n = Math.max(0, 4 - Math.floor((row - A_WAIST) / 2));
        for (let i = 0; i < n; i++) {
            const col = -7 + Math.floor(hash(row, i, 91) * 6);
            dot(ctx, cx + B(col), R(row), hash(row, i, 13) < 0.4 ? C.dark : C.body);
        }
    }
    // Yüzün sağ yanını yalayan İNCE kabuk: kaplama yukarıda burada bitiyor.
    // Kalın çizilince yüzü tamamen kapatıp elde tutulan bir levha gibi
    // duruyordu; buranın işi yüzü örtmek değil, sınırı göstermek.
    blk(ctx, cx - B(5), R(A_HEAD + 2), B(2), R(7), C.body);
    blk(ctx, cx - B(5), R(A_HEAD + 2), PX, R(7), C.outline);
    blk(ctx, cx - B(4), R(A_HEAD + 3), PX, PX, C.light);
    blk(ctx, cx - B(4), R(A_HEAD + 5), PX, PX, C.eye);          // kabuğun altındaki göz
    blk(ctx, cx - B(3), R(A_HEAD + 6), PX, PX, C.body);         // yanağa sıçramış leke
    blk(ctx, cx - B(3), R(A_HEAD + 9), PX, PX, C.dark);
    // Boyundan omuza inen bağ: kafadaki kabuk gövdedekinden kopuk durmasın
    blk(ctx, cx - B(4), R(A_HEAD + 10), B(2), R(A_SHOULDER - A_HEAD - 10), C.body);

    // Karakterin SAĞ kolu: tamamen mercan, ucunda kısa bir kabuk pençe.
    // Gövdedeki kaplamayla ARASINDA boşluk bırakılıyor - bitişik çizilince
    // ikisi tek bir levha gibi okunuyor, kol diye bir şey kalmıyordu.
    const armCenter = (row) => 9.5 + (row - A_SHOULDER) * 0.06;
    const armHalf = (row) => {
        const t = (row - A_SHOULDER) / (A_HIP - A_SHOULDER);
        if (t < 0.2) return 3;          // omuz
        if (t < 0.45) return 2.5;       // pazı
        if (t < 0.6) return 3;          // dirsek yumrusu
        return 2;                       // ön kol
    };
    limb(ctx, A_SHOULDER + 1, A_HIP, armCenter, armHalf, C);
    for (let row = A_SHOULDER + 4; row < A_HIP; row += 4) {
        blk(ctx, B(Math.round(armCenter(row) - 1)), R(row), B(2), PX, C.dark);
    }
    // Omuz kapağı: kolu gövdeye bağlayan tek yer
    blk(ctx, B(7), R(A_SHOULDER - 1), B(7), R(3), C.body);
    blk(ctx, B(7), R(A_SHOULDER - 1), B(7), PX, C.light);
    claw(ctx, Math.round(armCenter(A_HIP) - 2), 4, A_HIP, C);

    // --- 3) OMUZDAN yukarı uzanan boru ve ucundaki küçük kafa ---
    //
    // Kökü OMUZDA: aşağıdan, kolun hizasından başlayınca elde tutulan bir
    // sopa gibi duruyordu - oysa bu, taşıyıcının omzundan çıkan bir uzantı.
    // Düz bir silindir de değil: her birkaç satırda bir şişip inceliyor.
    const TUBE_BOTTOM = A_SHOULDER + 2;
    const TUBE_TOP = 8;
    const tubeCenter = (row) => {
        const t = (TUBE_BOTTOM - row) / (TUBE_BOTTOM - TUBE_TOP);
        return A_CX + 7.5 + Math.sin(t * 2.6) * 1.6 - t * 0.8;   // kıvrılarak çıkıyor
    };
    const tubeHalf = (row) => (Math.sin(row * 0.85) > 0.3 ? 2.5 : 1.5);
    limb(ctx, TUBE_TOP, TUBE_BOTTOM, tubeCenter, tubeHalf, C);
    // Boğum halkaları: şişkin yerlerin altına koyu bir bant
    for (let row = TUBE_TOP; row < TUBE_BOTTOM; row++) {
        if (tubeHalf(row) > 2 && tubeHalf(row + 1) <= 2) {
            const c = tubeCenter(row);
            blk(ctx, Math.round(c - 2) * PX, R(row), B(4), PX, C.dark);
        }
    }
    // Kök: omzun etini kabartıp oradan çıkıyor. Omuz başını saran bir yumru,
    // altında da omuza yayılan birkaç kabuk parçası.
    blk(ctx, cx + B(5), R(A_SHOULDER - 1), B(5), R(4), C.body);
    blk(ctx, cx + B(5), R(A_SHOULDER - 1), PX, R(4), C.outline);
    blk(ctx, cx + B(9), R(A_SHOULDER - 1), PX, R(4), C.outline);
    blk(ctx, cx + B(5), R(A_SHOULDER - 1), B(3), PX, C.light);
    blk(ctx, cx + B(6), R(A_SHOULDER + 3), B(3), PX, C.dark);
    blk(ctx, cx + B(5), R(A_SHOULDER + 4), B(2), PX, C.dark);

    // Küçük kafa: belli belirsiz iki göz ve bir ağız
    const headCol = Math.round(tubeCenter(TUBE_TOP));
    const hx = (headCol - 3) * PX;
    const hy = R(TUBE_TOP - 5);
    blk(ctx, hx, hy + PX, B(6), R(4), C.body);
    blk(ctx, hx + PX, hy, B(4), R(6), C.body);
    blk(ctx, hx, hy + PX, PX, R(4), C.outline);
    blk(ctx, hx + B(5), hy + PX, PX, R(4), C.outline);
    blk(ctx, hx + PX, hy, B(4), PX, C.outline);
    blk(ctx, hx + PX, hy + PX, PX, PX, C.light);
    blk(ctx, hx + B(2), hy + R(2), PX, PX, C.eye);
    blk(ctx, hx + B(4), hy + R(2), PX, PX, C.eye);
    blk(ctx, hx + B(2), hy + R(4), B(2), PX, C.outline);         // ağız: ince yarık

    // --- 4) Sağ ayağı saran lekeler (yalnızca ayak) ---
    const footCol = -6;
    for (let i = 0; i < 10; i++) {
        const col = footCol + Math.floor(hash(i, 5, 33) * 5);
        const row = A_FOOT - 1 + Math.floor(hash(i, 6, 34) * 3);
        dot(ctx, cx + B(col), R(row), hash(i, 7, 35) < 0.35 ? C.dark : C.body);
    }
    blk(ctx, cx + B(footCol), R(A_FOOT), B(2), PX, C.body);
    blk(ctx, cx + B(footCol), R(A_FOOT), PX, PX, C.light);
    blk(ctx, cx + B(footCol + 3), R(A_FOOT + 1), B(2), PX, C.dark);

    antivirusCache = { canvas, ox: cx, oy: h, w, h };
    return antivirusCache;
}

// ================= ELECTRO-VİRÜS =================
//
// Sonradan tanışılan ikinci virüs. Taşıyıcısını TAMAMEN kaplamış: anti-virüs
// gibi yarım değil, virüs gibi erimiş de değil - insan hattı duruyor ama
// üstünde lacivert bir kabuk var. Sarı yalnız damarlarda, gözde ve ellerde.
//
// Elleri sarımsı ve normalden bir tık büyük, saçları dik, bacakları da biraz
// kalın. Etrafında ve gövdesinde elektrik HAREKET EDİYOR: kıvılcımlar
// sprite'ın parçası değil, her karede ayrı çiziliyor (bkz. drawElectroSparks).
//
// Adam ve virüs hâli AYNI iskeletten çiziliyor (paintFigure). Giriş
// animasyonundaki dönüşümün hizalanması buna bağlı: aynı satırlar, aynı
// genişlikler, yalnızca renk ve birkaç ayrıntı değişiyor.

const ELECTRO_P = {
    body: '#22306b',
    dark: '#141d47',
    light: '#3a54a3',
    outline: '#0a0f2a',
    seam: '#ffd23f',
    hand: '#f2c14e',
    handLight: '#ffe27a',
    handDark: '#b8801a',
    spark: '#fff3b0',
    eye: '#ffe680'
};

const E_COLS = 40;
const E_ROWS = 52;
const E_CX = 20;

const E_HEAD = 8;           // kafanın üst satırı
const E_NECK = 18;
const E_SHOULDER = 19;
const E_HIP = 34;
const E_KNEE = 41;
const E_FOOT = 48;

// Kaldırılmış kolun eli bu satıra kadar çıkıyor (giriş animasyonu)
const E_ARM_TOP = 4;

// Taşıyıcı (adam) ve elektro hâli tek bir çizimden gelir.
// ox, oy: sprite kutusunun sol üst köşesi (canvas pikseli).
// mode: 'man' | 'electro' · armRaise: 0 = kol yanda, 1 = kol tamamen havada
// hug: 0 = kollar yanda, 1 = kollar göğüste kavuşmuş (üşüyen adam - buzun
// giriş animasyonu). Buzun kendi çizimi de aynı duruşu alabiliyor, yoksa
// dönüşüm sırasında kollar yer değiştirmiş gibi görünürdü.
function paintFigure(ctx, ox, oy, { mode = 'electro', armRaise = 0, headTilt = 0, hug = 0, manPalette = 'a' } = {}) {
    const on = mode === 'electro';
    const P = ELECTRO_P;
    const H = manPalette === 'c' ? HUMAN_C : manPalette === 'd' ? HUMAN_D : HUMAN_P;
    const X = (col) => ox + col * PX;
    const Y = (row) => oy + row * PX;
    const cx = X(E_CX);

    const skin = on ? P.body : H.s;
    const shade = on ? P.dark : H.S;
    const edge = on ? P.outline : H.k;
    const cloth = on ? P.body : H.c;
    const clothDark = on ? P.dark : H.C;
    const hair = on ? P.body : H.h;
    const hand = on ? P.hand : H.s;
    const handEdge = on ? P.handDark : H.k;

    const w = (cols) => cols * PX;

    // Kafanın karakterin kendi SAĞINA yatması: kesme (shear) ile - tepe
    // satırlar dipten daha çok kayıyor. Dönüşüm anında ikisi de yapıyor.
    const tiltAt = (row) => {
        const k = Math.max(0, Math.min(1, (row - E_HEAD + 8) / 18));
        return -Math.round(headTilt * 2 * (1 - k)) * PX;
    };
    const HX = (col, row) => X(col) + tiltAt(row);
    // Kafa/saç bölgesi: her satır kendi yatıklığıyla
    const hblk = (col, row, cols, rows, color) => {
        for (let r = 0; r < rows; r++) blk(ctx, HX(col, row + r), Y(row + r), w(cols), PX, color);
    };

    // --- Saç ---
    if (on) {
        // Dik saç: tutamlar iki blok kalın, boyları farklı ve dışa doğru
        // yatık. Tek bloklu eşit tutamlar taç gibi duruyordu.
        const spikes = [[-4, 4, -1], [-3, 6, 0], [-1, 7, 0], [1, 6, 0], [2, 4, 1]];
        for (const [col, len, lean] of spikes) {
            for (let k = 0; k < len; k++) {
                const shift = Math.round((k / len) * lean);
                const row = E_HEAD - len + k;
                const x = HX(E_CX + col + shift, row);
                const thin = k < len - 3 ? 1 : 2;       // uca doğru inceliyor
                blk(ctx, x, Y(row), w(thin), PX, k < 2 ? P.seam : P.body);
                if (k >= 2) blk(ctx, x, Y(row), PX, PX, P.light);
            }
        }
    } else {
        hblk(E_CX - 4, E_HEAD - 2, 8, 2, H.h);
        hblk(E_CX - 5, E_HEAD - 1, 1, 6, H.h);
    }

    // --- Kafa ---
    hblk(E_CX - 4, E_HEAD, 8, 10, skin);
    hblk(E_CX - 4, E_HEAD, 1, 10, edge);
    hblk(E_CX + 3, E_HEAD, 1, 10, edge);
    hblk(E_CX - 4, E_HEAD + 10, 8, 1, edge);
    if (!on) hblk(E_CX - 4, E_HEAD, 8, 1, H.h);

    if (on) {
        // Gözler: iki yanan yarık. Işıkları yüzün dışına da vuruyor.
        hblk(E_CX - 3, E_HEAD + 4, 2, 1, P.eye);
        hblk(E_CX + 1, E_HEAD + 4, 2, 1, P.eye);
        hblk(E_CX - 3, E_HEAD + 3, 2, 1, P.seam);
        hblk(E_CX + 1, E_HEAD + 3, 2, 1, P.seam);
        hblk(E_CX - 1, E_HEAD + 7, 2, 1, P.dark);       // ağız yarığı
        hblk(E_CX - 3, E_HEAD + 8, 6, 1, P.dark);
        hblk(E_CX + 2, E_HEAD + 5, 1, 3, P.light);      // yanağın ışığı
    } else {
        hblk(E_CX - 3, E_HEAD + 3, 2, 1, H.h);          // kaşlar
        hblk(E_CX + 1, E_HEAD + 3, 2, 1, H.h);
        hblk(E_CX - 3, E_HEAD + 4, 2, 1, '#ffffff');
        hblk(E_CX + 1, E_HEAD + 4, 2, 1, '#ffffff');
        hblk(E_CX - 2, E_HEAD + 4, 1, 1, H.k);
        hblk(E_CX + 2, E_HEAD + 4, 1, 1, H.k);
        hblk(E_CX, E_HEAD + 6, 1, 2, H.S);              // burun
        hblk(E_CX - 1, E_HEAD + 9, 3, 1, H.S);          // ağız
    }

    // --- Boyun ve gövde ---
    blk(ctx, X(E_CX - 2), Y(E_NECK), w(4), w(1), shade);
    for (let row = E_SHOULDER; row < E_HIP; row++) {
        const half = row < E_SHOULDER + 2 ? 7 : 6;
        blk(ctx, X(E_CX - half), Y(row), w(half * 2), PX, cloth);
        blk(ctx, X(E_CX - half), Y(row), PX, PX, edge);
        blk(ctx, X(E_CX + half) - PX, Y(row), PX, PX, edge);
        if (on) {
            // Gövdeye işlemiş sarı damar: göğüsten aşağı inen bir ana hat ve
            // ondan yanlara ayrılan kısa kollar. Zikzak tek çizgi fermuar
            // gibi duruyordu.
            const k = row - E_SHOULDER;
            // Ana hat merkezden aşağı iner, kolları BASAMAK BASAMAK yana
            // kaçar: düz yatay çubuklar şema gibi duruyordu.
            blk(ctx, X(E_CX + (k % 5 === 3 ? 1 : 0)), Y(row), PX, PX, P.seam);
            if (k === 2) blk(ctx, X(E_CX - 1), Y(row), PX, PX, P.seam);
            if (k === 3) blk(ctx, X(E_CX - 2), Y(row), PX, PX, P.seam);
            if (k === 4) blk(ctx, X(E_CX - 3), Y(row), w(2), PX, P.seam);
            if (k === 7) blk(ctx, X(E_CX + 1), Y(row), PX, PX, P.seam);
            if (k === 8) blk(ctx, X(E_CX + 2), Y(row), PX, PX, P.seam);
            if (k === 9) blk(ctx, X(E_CX + 3), Y(row), w(2), PX, P.seam);
            if (k === 11) blk(ctx, X(E_CX - 1), Y(row), PX, PX, P.seam);
            if (k === 12) blk(ctx, X(E_CX - 2), Y(row), w(2), PX, P.seam);
            if (k % 4 === 1) blk(ctx, X(E_CX - half + 1), Y(row), w(2), PX, P.light);
        } else if (row === E_HIP - 1) {
            blk(ctx, X(E_CX - half), Y(row), w(half * 2), PX, clothDark);
        }
    }

    // --- Kollar ---
    // side -1 = karakterin sağ kolu (izleyicinin solu), hep yanda.
    // side +1 = karakterin SOL kolu: giriş animasyonunda havaya kalkan kol.
    // Yumruk: düz bir dikdörtgen değil - üstte parmak boğumları, altta
    // kıvrılan parmakların gölgesi, içeride başparmak. Elektro hâlinde bir
    // blok daha geniş ve bir blok daha uzun.
    const fist = (col, row, side) => {
        const fw = on ? 5 : 4;
        const fh = on ? 5 : 4;
        blk(ctx, X(col), Y(row), w(fw), w(fh), hand);
        blk(ctx, X(col), Y(row), PX, w(fh), handEdge);
        blk(ctx, X(col + fw - 1), Y(row), PX, w(fh), handEdge);
        blk(ctx, X(col), Y(row + fh - 1), w(fw), PX, handEdge);
        if (on) {
            blk(ctx, X(col + 1), Y(row), w(fw - 2), PX, P.handLight);   // boğumlar
            blk(ctx, X(col + 1), Y(row + 2), w(fw - 2), PX, P.handDark); // parmak aralığı
            const thumb = side < 0 ? col + fw - 2 : col + 1;
            blk(ctx, X(thumb), Y(row + 1), PX, w(2), P.handLight);      // başparmak
        } else {
            blk(ctx, X(col + 1), Y(row + fh - 2), w(fw - 2), PX, H.S);
        }
        return { x: X(col) + w(fw) / 2, y: Y(row) };
    };

    const drawArm = (side, raise) => {
        const armW = 4;
        const inner = side < 0 ? E_CX - 11 : E_CX + 7;
        const handCol = side < 0 ? inner - (on ? 1 : 0) : inner;

        if (hug > 0.5) {
            // Kendine sarılmış kollar: omuzdan kısa bir üst kol, sonra göğsün
            // önünden geçen ön kol. İki ön kol FARKLI satırda - aynı satıra
            // gelince tek bir çubuk oluyor, "kavuşmuş" değil "kemer" duruyor.
            const elbow = E_SHOULDER + 5;
            for (let row = E_SHOULDER + 1; row < elbow; row++) {
                blk(ctx, X(inner), Y(row), w(armW), PX, cloth);
                blk(ctx, X(inner), Y(row), PX, PX, edge);
                blk(ctx, X(inner + armW - 1), Y(row), PX, PX, edge);
            }
            const fy = elbow + (side < 0 ? 0 : 2);
            const fx = side < 0 ? inner : inner - 5;
            blk(ctx, X(fx), Y(fy), w(9), w(3), cloth);
            blk(ctx, X(fx), Y(fy), w(9), PX, on ? P.light : cloth);
            blk(ctx, X(fx), Y(fy + 2), w(9), PX, clothDark);
            // Karşı omzu kavrayan el: ön kolun uzak ucunda
            blk(ctx, X(side < 0 ? fx + 7 : fx), Y(fy), w(2), w(3), hand);
            return { x: X(fx) + w(4), y: Y(fy) };
        }

        if (raise <= 0.01) {
            for (let row = E_SHOULDER + 1; row < E_HIP; row++) {
                blk(ctx, X(inner), Y(row), w(armW), PX, cloth);
                blk(ctx, X(inner), Y(row), PX, PX, edge);
                blk(ctx, X(inner + armW - 1), Y(row), PX, PX, edge);
                const k = row - E_SHOULDER;
                if (on && (k === 3 || k === 9)) blk(ctx, X(inner + 1), Y(row), PX, PX, P.seam);
                if (on && k === 6) blk(ctx, X(inner + 2), Y(row), PX, PX, P.light);
            }
            return fist(handCol, E_HIP, side);
        }

        // Kalkan kol: omuzdan yukarı, dirsek hafif dışa açılıyor
        const top = Math.round(E_SHOULDER - (E_SHOULDER - E_ARM_TOP - 5) * raise);
        for (let row = top; row <= E_SHOULDER + 1; row++) {
            const lean = row < E_SHOULDER - 4 ? 1 : 0;
            blk(ctx, X(inner + lean), Y(row), w(armW), PX, cloth);
            blk(ctx, X(inner + lean), Y(row), PX, PX, edge);
            blk(ctx, X(inner + lean + armW - 1), Y(row), PX, PX, edge);
            if (on && (row - top) % 4 === 1) {
                blk(ctx, X(inner + lean + 1), Y(row), w(2), PX, P.seam);
            }
        }
        return fist(inner + 1, top - (on ? 5 : 4), side);
    };

    drawArm(-1, 0);
    const raisedHand = drawArm(1, armRaise);

    // --- Bacaklar ve ayaklar ---
    // Elektro hâlinde bacaklar bir tık kalın: kütle aşağıda toplanıyor.
    const legW = on ? 6 : 5;
    for (const col of [-legW - 1, 1]) {
        blk(ctx, X(E_CX + col), Y(E_HIP), w(legW), w(E_FOOT - E_HIP), cloth);
        blk(ctx, X(E_CX + col), Y(E_HIP), PX, w(E_FOOT - E_HIP), edge);
        blk(ctx, X(E_CX + col + legW - 1), Y(E_HIP), PX, w(E_FOOT - E_HIP), edge);
        if (on) {
            blk(ctx, X(E_CX + col + 1), Y(E_KNEE), w(legW - 2), PX, P.seam);
            blk(ctx, X(E_CX + col + 1), Y(E_KNEE + 1), w(2), PX, P.light);
        }
        blk(ctx, X(E_CX + col), Y(E_FOOT), w(legW), w(E_ROWS - E_FOOT), on ? P.dark : H.y);
        blk(ctx, X(E_CX + col), Y(E_ROWS - 1), w(legW), PX, '#000000');
    }

    return { hand: raisedHand };
}

// Hareketli elektrik. Sprite'a gömülmüyor: her karede yeniden çiziliyor,
// yoksa "hareketlensin" isteği tek bir donmuş şimşek olurdu.
// x = gövdenin merkezi, footY = ayak hizası (canvas pikseli).
// unit: bir blokun ekrandaki boyu. Giriş animasyonunda kamera büyüdüğü için
// kıvılcımlar da büyümeli, yoksa dev adamın üstünde toz gibi kalıyorlar.
export function drawElectroSparks(ctx, x, footY, frame, intensity = 1, unit = PX) {
    if (intensity <= 0) return;
    const P = ELECTRO_P;
    const u = unit;
    const put = (bx, by, bw, bh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
    };
    const h = E_ROWS * u;
    const top = footY - h;
    // Kıvılcımlar her karede değil, dört karede bir değişiyor: 60 kare/sn
    // titreşim piksel dilinde gürültü gibi duruyor, 15 kare/sn şimşek gibi.
    const tick = Math.floor(frame / 4);
    const arcs = Math.round(7 * intensity);

    for (let i = 0; i < arcs; i++) {
        const r = (salt) => hash(i * 7.3, tick, salt);
        // Yarısı gövdenin üstünde, yarısı etrafında
        const onBody = r(11) < 0.5;
        const spread = onBody ? 8 : 15;
        let px = x + Math.round((r(12) - 0.5) * spread * 2) * u;
        let py = top + Math.round(r(13) * (E_ROWS - 6)) * u;
        const len = 3 + Math.floor(r(14) * 4);
        const dir = r(15) < 0.5 ? -1 : 1;

        for (let k = 0; k < len; k++) {
            const bright = k === 0 || k === len - 1;
            put(px, py, u, u, bright ? P.spark : P.seam);
            // Zikzak: bir aşağı, bir yana - düz çizgi şimşek gibi durmuyor
            if (k % 2 === 0) px += dir * u;
            else py += (r(16 + k) < 0.5 ? -1 : 1) * u;
        }
    }

    // Ayakların dibinde ara sıra çakan yer kıvılcımı
    if (hash(tick, 3, 21) < 0.35 * intensity) {
        const gx = x + Math.round((hash(tick, 4, 22) - 0.5) * 16) * u;
        put(gx, footY - u, u * 3, u, P.seam);
        put(gx + u, footY - u * 2, u, u, P.spark);
    }
}

let electroCache = null;

export function electroSprite() {
    if (electroCache) return electroCache;
    const w = PX * E_COLS;
    const h = PX * E_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    paintFigure(ctx, 0, 0, { mode: 'electro', armRaise: 0 });
    electroCache = { canvas, ox: PX * E_CX, oy: h, w, h };
    return electroCache;
}

// Giriş animasyonunun kullandığı çizim: adam / elektro, kolu istenen kadar
// kalkmış. Doğrudan hedef tuvale çiziliyor (ölçekleme sahnede yapılıyor).
export function paintIntroFigure(ctx, x, footY, opts) {
    return paintFigure(ctx, x - PX * E_CX, footY - PX * E_ROWS, opts);
}

export const FIGURE_SIZE = { cols: E_COLS, rows: E_ROWS, cx: E_CX, px: PX };
export const CARRIER_SIZE = { cols: A_COLS, rows: A_ROWS, cx: A_CX, px: PX };
export const VIRUS_SIZE = { cols: V_COLS, rows: V_ROWS, cx: V_CX, px: PX };
// Virüsün gözleri (sprite'ın sol üstüne göre, blok): giriş animasyonunda
// dönüşümün son anında burası yanıyor.
export const VIRUS_EYES = { col: V_CX - 2, row: 5 };

// Anti-virüsün taşıyıcısını ayak hizasına göre çizer (giriş animasyonu)
export function paintIntroCarrier(ctx, x, footY, opts) {
    paintCarrier(ctx, x - PX * A_CX, footY - PX * A_ROWS, opts);
}

// ================= ICE-VİRÜS =================
//
// Dördüncü dövüşçü. Elektro gibi taşıyıcısını TAMAMEN kaplıyor ama biçim
// dili üçünden de ayrı: virüs SARKAR, elektro ÇATIRDAR, buz UZAR. Kütle
// akmıyor - omuzdan, koldan ve kafadan dışarı doğru kristal dikenler
// büyüyor, hepsi yukarı ve dışa doğru.
//
// Palet elektroyla karışmasın diye bilerek karşıt seçildi: elektro koyu
// lacivert + sarı, buz AÇIK buz mavisi + beyaz. Silueti de ayrı - elektronun
// dik saçının yerinde buzun kırık bir tacı var.
//
// Elektroyla AYNI ızgarada (E_*) çiziliyor. Bu şart: giriş animasyonunda
// adam ile buz hâli üst üste oturmalı, ayrı ölçü kullanılsa dönüşüm
// sırasında figür kayardı (anti-virüste bu tuzağa bir kez düşülmüştü).
// Gövde rengi ORTA tonda, açık değil. İlk denemede gövde de vurgular da
// açık buz mavisiydi ve karakter diğer üçünün yanında soluk kalıyordu:
// elektronun koyu lacivert + parlak sarısı gibi buzun da kendi içinde
// kontrastı olmalı. Beyaz kırıklar ancak orta tonun üstünde okunuyor.
const ICE_P = {
    body: '#5aa8c4',
    dark: '#2f6c88',
    light: '#a8e0f0',
    deep: '#1b4a63',        // kristalin içi: dış yüzeyden koyu
    outline: '#0d2836',
    frost: '#ffffff',
    eye: '#eaffff',
    glow: '#bfefff'
};

// Dördüncü adam: buzun taşıyıcısı. Üçünden de ayrı biri olmalı (elektro koyu
// saç / gri-mavi tulum, anti açık kahve / haki, virüs siyah saç / bordo).
const HUMAN_D = {
    k: '#1f2937',
    h: '#6b5233',           // kumral
    s: '#f0bd93',
    S: '#cf9668',
    c: '#3f5c63',           // deniz mavisi yağmurluk
    C: '#2d4249',
    y: '#22303a'
};

// Buz hâli. ox, oy: sprite kutusunun sol üst köşesi (canvas pikseli).
// hug: 0 = kollar yanda, 1 = kollar göğüste kavuşmuş (giriş animasyonunda
// üşüyen adamın duruşu; buz hâli de aynı duruşu almalı, yoksa dönüşüm
// sırasında kollar yer değiştirmiş gibi görünür).
function paintIce(ctx, ox, oy, { headTilt = 0, hug = 0 } = {}) {
    const P = ICE_P;
    const X = (col) => ox + col * PX;
    const Y = (row) => oy + row * PX;
    const w = (cols) => cols * PX;

    const tiltAt = (row) => {
        const k = Math.max(0, Math.min(1, (row - E_HEAD + 8) / 18));
        return -Math.round(headTilt * 2 * (1 - k)) * PX;
    };
    const HX = (col, row) => X(col) + tiltAt(row);
    const hblk = (col, row, cols, rows, color) => {
        for (let r = 0; r < rows; r++) blk(ctx, HX(col, row + r), Y(row + r), w(cols), PX, color);
    };

    // Dışarı büyüyen kristal diken: kökten uca doğru inceliyor. Basamak
    // basamak gidiyor - düz bir üçgen "buz" değil "cam parçası" okunuyordu.
    const spike = (col, row, len, dx, dy, thick = 3) => {
        for (let i = 0; i < len; i++) {
            const t = Math.max(1, Math.round(thick * (1 - i / len)));
            const c = Math.round(col + dx * i);
            const r = Math.round(row + dy * i);
            blk(ctx, X(c), Y(r), w(t), PX, i >= len - 2 ? P.light : P.body);
            blk(ctx, X(c), Y(r), PX, PX, P.outline);
            if (t > 1) blk(ctx, X(c) + w(t) - PX, Y(r), PX, PX, P.dark);
        }
    };

    // --- Kafanın üstündeki kırık taç ---
    // Üç diken, boyları ve açıları farklı. Eşit boyda üç diken taç değil
    // tarak gibi duruyordu (elektronun dik saçında da aynı ders çıkmıştı).
    spike(E_CX - 5, E_HEAD - 1, 5, -0.35, -1, 4);
    spike(E_CX - 1, E_HEAD - 2, 7, 0, -1, 4);
    spike(E_CX + 3, E_HEAD - 1, 4, 0.5, -1, 3);

    // --- Kafa: köşeli bir miğfer ---
    hblk(E_CX - 4, E_HEAD, 8, 10, P.body);
    hblk(E_CX - 4, E_HEAD, 1, 10, P.outline);
    hblk(E_CX + 3, E_HEAD, 1, 10, P.outline);
    hblk(E_CX - 4, E_HEAD + 10, 8, 1, P.outline);
    hblk(E_CX - 4, E_HEAD, 8, 1, P.outline);
    hblk(E_CX - 3, E_HEAD + 1, 2, 9, P.light);       // sol yanak: ışık soldan
    hblk(E_CX + 1, E_HEAD + 2, 2, 8, P.dark);        // sağ yanak gölgede
    // Yüzeyi bölen kırılma hattı. Tam ORTADAN geçirmiştim: iki gözün arasına
    // düşüp yüzü ikiye bölüyor, gözleri de yutuyordu. Yana kaçık ve kısa
    // olunca hem hat okunuyor hem yüz duruyor.
    hblk(E_CX + 2, E_HEAD + 1, 1, 4, P.frost);

    // Gözler: önce KOYU OYUK, sonra oyuğun içinde yanan yarık. Doğrudan
    // parlak yazınca gözler açık yüzeyde kaybolup kafa boş bir blok
    // duruyordu - yanan şeyin arkasında karanlık olmalı.
    hblk(E_CX - 3, E_HEAD + 4, 2, 2, P.deep);
    hblk(E_CX + 1, E_HEAD + 4, 2, 2, P.deep);
    hblk(E_CX - 3, E_HEAD + 5, 2, 1, P.eye);
    hblk(E_CX + 1, E_HEAD + 5, 2, 1, P.eye);
    // Kaş hizasında çıkıntı: gözlerin üstünü gölgeleyip bakışı sertleştiriyor
    hblk(E_CX - 3, E_HEAD + 3, 6, 1, P.dark);
    // Ağız YOK - yerinde kırağı tutmuş TEK bir çatlak var. Önce iki çatlak
    // ve bir gölge vardı, yüz karalama gibi okunuyordu.
    hblk(E_CX - 2, E_HEAD + 8, 4, 1, P.frost);
    // Çenenin daralması: kafanın alt satırı iki blok dar. Dört köşe bir blok
    // "kafa" değil "kutu" okunuyordu.
    hblk(E_CX - 4, E_HEAD + 9, 1, 1, P.outline);
    hblk(E_CX + 3, E_HEAD + 9, 1, 1, P.outline);

    // --- Boyun ve gövde ---
    blk(ctx, X(E_CX - 2), Y(E_NECK), w(4), PX, P.deep);
    for (let row = E_SHOULDER; row < E_HIP; row++) {
        const half = row < E_SHOULDER + 2 ? 8 : 7;
        blk(ctx, X(E_CX - half), Y(row), w(half * 2), PX, P.body);
        blk(ctx, X(E_CX - half), Y(row), PX, PX, P.outline);
        blk(ctx, X(E_CX + half) - PX, Y(row), PX, PX, P.outline);
        blk(ctx, X(E_CX - half + 1), Y(row), w(2), PX, P.light);   // sol kenar ışığı
        blk(ctx, X(E_CX + half - 3), Y(row), w(2), PX, P.dark);    // sağ kenar gölgesi

        // Faseler: düz dolgu buzu "plastik" gösteriyordu, kütlenin yüzeyi
        // kırık kırık olmalı. hash konuma bağlı olduğu için desen her
        // açılışta AYNI - yoksa kütle her karede kaynardı.
        for (let c = -half + 3; c < half - 3; c++) {
            const r = hash(c, row, 51);
            if (r < 0.09) blk(ctx, X(E_CX + c), Y(row), PX, PX, P.light);
            else if (r < 0.17) blk(ctx, X(E_CX + c), Y(row), PX, PX, P.dark);
        }

        // Kristalin İÇİ: göğsün ortasında ELMAS biçimli koyu bir çekirdek.
        // Dikdörtgen çizince gövdede pencere gibi bir delik duruyordu; uçları
        // daralınca kütlenin içindeki bir kristal okunuyor.
        const k = row - E_SHOULDER;
        if (k >= 3 && k <= 11) {
            const cc = Math.max(1, Math.round(3 - Math.abs(k - 7) * 0.5));
            blk(ctx, X(E_CX - cc), Y(row), w(cc * 2), PX, P.deep);
            blk(ctx, X(E_CX - cc), Y(row), PX, PX, P.glow);
            // Çekirdeğin içinde yanan damar: koyu elmas tek başına gövdede
            // oyuk gibi duruyordu, içinde bir şey olmalı.
            if (k >= 5 && k <= 9) blk(ctx, X(E_CX), Y(row), PX, PX, P.frost);
        }
        // Yüzey kırıkları: kısa beyaz hatlar. Elektronun sarı damarı gövdeyi
        // DOLAŞIR, buzunki gövdeyi KESER - biri canlı, biri kırık.
        if (k === 1 || k === 6 || k === 11) {
            blk(ctx, X(E_CX - half + 2), Y(row), w(3), PX, P.frost);
            blk(ctx, X(E_CX + half - 5), Y(row + (k === 6 ? 1 : 0)), w(3), PX, P.frost);
        }
    }

    // Omuzlardan yukarı-dışarı büyüyen iki büyük diken: buzun silueti.
    // Uzaktan bakınca karakteri elektrodan ayıran şey bu ikisi, o yüzden
    // KALIN olmalı - ince çizilince kol değil tel gibi duruyorlardı.
    // --- Kollar ---
    // side -1 = karakterin sağı (izleyicinin solu).
    const iceFist = (col, row) => {
        // Yumruk değil BUZ PENÇESİ: üç sarkıt, ortadaki uzun.
        blk(ctx, X(col), Y(row), w(5), w(4), P.body);
        blk(ctx, X(col), Y(row), PX, w(4), P.outline);
        blk(ctx, X(col + 4), Y(row), PX, w(4), P.outline);
        blk(ctx, X(col + 1), Y(row), w(3), PX, P.light);
        for (let i = 0; i < 3; i++) {
            const len = i === 1 ? 4 : 3;
            blk(ctx, X(col + i * 2), Y(row + 4), PX, w(len), P.light);
            blk(ctx, X(col + i * 2), Y(row + 4 + len), PX, PX, P.outline);
        }
        return { x: X(col) + w(5) / 2, y: Y(row) };
    };

    const drawIceArm = (side) => {
        const armW = 4;
        const inner = side < 0 ? E_CX - 11 : E_CX + 7;

        if (hug > 0.5) {
            // Kavuşmuş kollar: omuzdan kısa bir üst kol, sonra göğsün önünden
            // geçen ön kol. İki ön kol FARKLI satırda - aynı satıra gelince
            // tek bir çubuk gibi okunuyor, "kavuşmuş" değil "kemer" duruyor.
            const elbow = E_SHOULDER + 5;
            for (let row = E_SHOULDER + 1; row < elbow; row++) {
                blk(ctx, X(inner), Y(row), w(armW), PX, P.body);
                blk(ctx, X(inner), Y(row), PX, PX, P.outline);
                blk(ctx, X(inner + armW - 1), Y(row), PX, PX, P.outline);
            }
            const fy = elbow + (side < 0 ? 0 : 2);
            const fx = side < 0 ? inner : inner - 5;
            blk(ctx, X(fx), Y(fy), w(9), w(3), P.body);
            blk(ctx, X(fx), Y(fy), w(9), PX, P.light);
            blk(ctx, X(fx), Y(fy + 2), w(9), PX, P.outline);
            return { x: X(fx) + w(4), y: Y(fy) };
        }

        for (let row = E_SHOULDER + 1; row < E_HIP; row++) {
            blk(ctx, X(inner), Y(row), w(armW), PX, P.body);
            blk(ctx, X(inner), Y(row), PX, PX, P.outline);
            blk(ctx, X(inner + armW - 1), Y(row), PX, PX, P.outline);
            blk(ctx, X(inner + 1), Y(row), PX, PX, P.light);
            const k = row - E_SHOULDER;
            if (k === 4 || k === 9) blk(ctx, X(inner + 1), Y(row), w(3), PX, P.frost);
            if (k === 6 || k === 7) blk(ctx, X(inner + 2), Y(row), w(2), PX, P.deep);
        }
        // Ön koldan GERİYE doğru çıkan diken: kol düz bir boru kalmasın.
        spike(side < 0 ? inner - 3 : inner + armW, E_SHOULDER + 9, 5, side < 0 ? -0.6 : 0.6, -1, 3);
        return iceFist(inner, E_HIP);
    };

    drawIceArm(-1);
    const rightHand = drawIceArm(1);

    // Omuzlardan yukarı-dışarı büyüyen buz. Kollardan SONRA çiziliyor:
    // önce çizince kolun üst satırları apuletin üstünü kesip yarısını
    // yutuyordu.
    //
    // ASİMETRİK: karakterin SAĞ omzunda (izleyicinin solunda) kalın bir
    // apulet var, sol omzunda yalnız ince bir diken. Anti-virüsün yalnız bir
    // yanının kaplı olması gibi - simetrik bir kütle heykel gibi duruyor,
    // kimliği olmuyor. Sprite aynalanmadığı için bu yan hep aynı yerde kalır.
    for (let r = 0; r < 6; r++) {
        const wide = 8 - r;
        blk(ctx, X(E_CX - 12), Y(E_SHOULDER - 1 + r), w(wide), PX, P.body);
        blk(ctx, X(E_CX - 12), Y(E_SHOULDER - 1 + r), PX, PX, P.outline);
        blk(ctx, X(E_CX - 11), Y(E_SHOULDER - 1 + r), PX, PX, P.light);
        blk(ctx, X(E_CX - 12 + wide - 1), Y(E_SHOULDER - 1 + r), PX, PX, P.dark);
        if (r === 2) blk(ctx, X(E_CX - 10), Y(E_SHOULDER - 1 + r), w(3), PX, P.frost);
    }
    spike(E_CX - 12, E_SHOULDER - 1, 8, -0.25, -1, 6);
    spike(E_CX - 8, E_SHOULDER - 2, 5, 0.1, -1, 3);
    spike(E_CX + 7, E_SHOULDER + 2, 5, 0.4, -1, 4);

    // --- Bacaklar ---
    const legW = 6;
    for (const col of [-legW - 1, 1]) {
        blk(ctx, X(E_CX + col), Y(E_HIP), w(legW), w(E_FOOT - E_HIP), P.body);
        blk(ctx, X(E_CX + col), Y(E_HIP), PX, w(E_FOOT - E_HIP), P.outline);
        blk(ctx, X(E_CX + col + legW - 1), Y(E_HIP), PX, w(E_FOOT - E_HIP), P.outline);
        blk(ctx, X(E_CX + col + 1), Y(E_HIP), PX, w(E_FOOT - E_HIP), P.light);
        blk(ctx, X(E_CX + col + legW - 2), Y(E_HIP), PX, w(E_FOOT - E_HIP), P.dark);
        blk(ctx, X(E_CX + col + 1), Y(E_KNEE), w(legW - 2), PX, P.frost);
        blk(ctx, X(E_CX + col + 2), Y(E_KNEE + 2), w(2), PX, P.deep);
        // Bacakta da fase: gövdeyle aynı yüzey dili
        for (let row = E_HIP; row < E_FOOT; row++) {
            for (let c = 2; c < legW - 2; c++) {
                const r = hash(col + c, row, 52);
                if (r < 0.10) blk(ctx, X(E_CX + col + c), Y(row), PX, PX, P.light);
                else if (r < 0.18) blk(ctx, X(E_CX + col + c), Y(row), PX, PX, P.deep);
            }
        }
        // Dizden dışa çıkan küçük diken
        spike(E_CX + col + (col < 0 ? -1 : legW), E_KNEE - 1, 3, col < 0 ? -0.6 : 0.6, -0.6, 2);
        // Ayak: buzun kendi kaidesi. Kütle yerde bitmiyor, yere YAPIŞIYOR.
        blk(ctx, X(E_CX + col), Y(E_FOOT), w(legW), w(E_ROWS - E_FOOT), P.dark);
        blk(ctx, X(E_CX + col), Y(E_ROWS - 1), w(legW), PX, P.outline);
    }
    // İki ayağın altında birleşen kırağı tabanı
    blk(ctx, X(E_CX - 9), Y(E_ROWS - 1), w(18), PX, P.light);

    return { hand: rightHand };
}

// Buzun kırağısı. Elektronun kıvılcımı gibi sprite'a gömülmüyor: her karede
// yeniden çiziliyor. Ama RİTMİ bilerek farklı - elektro 4 karede bir çatırdar,
// buz süzülür. Aynı hızda olsalar iki karakter de "titriyor" gibi okunurdu;
// buz titremiyor, üşütüyor.
export function drawFrostMotes(ctx, x, footY, frame, intensity = 1, unit = PX) {
    if (intensity <= 0) return;
    const P = ICE_P;
    const u = unit;
    const put = (bx, by, bw, bh, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw), Math.round(bh));
    };
    const h = E_ROWS * u;
    const top = footY - h;
    const motes = Math.round(9 * intensity);

    for (let i = 0; i < motes; i++) {
        // x zerreye bağlı ve SABİT, yalnızca y akıyor: x de zıplayınca zerre
        // süzülmüyor, her an başka yerde yeniden doğuyor gibi duruyor.
        const mx = x + Math.round((hash(i * 5.1, 0, 31) - 0.5) * 28) * u;
        const fall = (frame / 3 + i * 9 + hash(i, 1, 32) * 40) % (E_ROWS - 3);
        put(mx, top + Math.round(fall) * u, u, u, hash(i, 2, 33) < 0.35 ? P.frost : P.glow);
    }

    // Nefes: üç saniyede bir kafanın önünde biriken ve dağılan buhar
    const breath = (frame % 180) / 180;
    if (breath < 0.3) {
        const k = breath / 0.3;
        put(x + u * 3, top + Math.round(10 - k * 2) * u,
            Math.round(2 + k * 5) * u, u * 2, `rgba(223, 244, 251, ${(0.55 * (1 - k)).toFixed(2)})`);
    }

    // Ayakların dibinde tutan kırağı
    put(x - u * 8, footY - u, u * 16, u, 'rgba(255, 255, 255, 0.30)');
}

let iceCache = null;

export function iceSprite() {
    if (iceCache) return iceCache;
    const w = PX * E_COLS;
    const h = PX * E_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    paintIce(ctx, 0, 0, {});
    iceCache = { canvas, ox: PX * E_CX, oy: h, w, h };
    return iceCache;
}

// Giriş animasyonunun kullandığı çizim (ölçekleme sahnede yapılıyor)
export function paintIntroIce(ctx, x, footY, opts) {
    return paintIce(ctx, x - PX * E_CX, footY - PX * E_ROWS, opts);
}

// --- Dışarıya açılan yüz ---

export const FIGHTER_SPRITES = {
    virus: virusSprite,
    antivirus: antivirusSprite,
    electro: electroSprite,
    ice: iceSprite
};

// ================= SALDIRI ANİMASYONLARI =================
//
// Sprite'lar bir kez çizilip saklanıyor. Her hamle için ayrı sprite üretmek
// yerine iki şey yapılıyor:
//   1) GÖVDE kaydırılıyor - satır satır, üst satırlar daha çok. Yaslanma ve
//      öne düşme bundan çıkıyor. ctx.scale KULLANILMIYOR: piksel ızgarasını
//      titretiyor (giriş animasyonlarında da aynı tuzağa düşülmüştü).
//   2) SALDIRAN UZUV üstüne ayrıca çiziliyor - virüsün savurduğu kol,
//      elektronun ileri uzattığı el, anti-virüsün borusundaki parlama.
//
// Duruşlar t = 0..1 ile tanımlı (hamlenin animasyonunun ne kadarı geçti);
// süreler abilities.js'teki animFrames'ten geliyor.

// dir çarpanı olanlar karakterin baktığı yöne göre eğilir; atılmalar dünya
// yönünde olduğu için çarpılmaz.
const DIR_POSES = new Set(['punch', 'blob', 'grab', 'beam', 'shard']);

// Sıfırdan bire çıkıp geri inen yumuşak eğri: uzuvun uzayıp toplanması.
const swell = (t) => Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);

// Bir alt aralığın kendi içindeki ilerlemesi (0..1)
const phase = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

const POSES = {
    // Savurma: önce geriye yaslanıp toplanıyor, sonra bütün kütle öne
    // düşüyor. Ağırlık hissi geri çekilmenin uzunluğundan geliyor.
    punch: (t) => ({
        lean: t < 0.28 ? -PX * 3 * phase(t, 0, 0.28)
            : t < 0.5 ? PX * (-3 + 10 * phase(t, 0.28, 0.5))
            : PX * 7 * (1 - phase(t, 0.5, 1)),
        dy: t > 0.28 && t < 0.62 ? PX : 0
    }),
    // Bölünme: kütle ortadan ikiye açılıp geri kapanıyor
    split: (t) => ({ gap: Math.round(swell(t) * 7) * PX }),
    // Salgın izi: kütle çöküp yere yayılıyor
    trail: (t) => ({ dy: Math.round(swell(t) * 3) * PX }),
    // Top atarken gövde geri tepiyor
    blob: (t) => ({ lean: -PX * 2 * swell(t) }),
    // Saçılma: karakter kasılıyor, sonra her yöne açılıyor
    burst: (t) => ({ dy: Math.round(swell(phase(t, 0, 0.35)) * 2) * PX, flash: phase(t, 0.3, 0.5) * (1 - phase(t, 0.5, 1)) }),
    // Kolu fırlatırken öne uzanma
    grab: (t) => ({ lean: PX * 5 * swell(t) }),
    // Işını verirken öne dayanma
    beam: (t) => ({ lean: PX * 3 * swell(t) }),
    // Küreyi kurarken gövde yükseliyor
    orb: (t) => ({ dy: -PX * 2 * swell(t) }),
    // Işınlanma: yeni yerde sönük belirip yerine oturuyor
    blink: (t) => ({ fade: t }),
    // Buz kırığı: kolu geriye alıp savuruyor. Antinin topu gövdeyi geri
    // teptiriyor (namludan çıkıyor), buzunki gövdeyi ÖNE atıyor (elle
    // atılıyor) - iki menzilli karakterin duruşu birbirine benzemesin.
    shard: (t) => ({
        lean: t < 0.4 ? -PX * 4 * phase(t, 0, 0.4) : PX * 5 * swell(phase(t, 0.4, 1))
    }),
    // Buz duvarı: gövde çöküp iki elini yere basıyor
    wall: (t) => ({ dy: Math.round(swell(t) * 4) * PX }),
    // Ayaz: önce kasılıyor, sonra bir anda çevreye açılıyor
    frost: (t) => ({
        dy: -Math.round(swell(phase(t, 0, 0.4)) * 2) * PX,
        flash: phase(t, 0.35, 0.5) * (1 - phase(t, 0.5, 1))
    }),
    dashUp: (t) => ({ dy: -PX * 2 * (1 - t) }),
    dashLeft: (t) => ({ lean: -PX * 6 * (1 - t) }),
    dashRight: (t) => ({ lean: PX * 6 * (1 - t) })
};

// --- gövdenin çizimi ---

// Karakterin beyaz silueti: parlama için. Sprite gibi bir kez üretilip
// saklanıyor - her karede yeniden boyamanın anlamı yok.
const silhouettes = new Map();
function silhouetteOf(key, sprite) {
    const cached = silhouettes.get(key);
    if (cached) return cached;
    const { canvas, ctx } = newCanvas(sprite.w, sprite.h);
    ctx.drawImage(sprite.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sprite.w, sprite.h);
    silhouettes.set(key, canvas);
    return canvas;
}

// Satır satır kaydırma: en üst satır tam, ayaklar sabit. Kaydırma PX'in
// katına yuvarlanıyor, yoksa gövde kendi içinde titriyor.
function drawLeaning(ctx, sprite, px, py, lean) {
    for (let row = 0; row < sprite.h; row += PX) {
        const k = 1 - row / sprite.h;
        const off = Math.round((lean * k * k) / PX) * PX;
        ctx.drawImage(sprite.canvas, 0, row, sprite.w, PX, px + off, py + row, sprite.w, PX);
    }
}

// Bölünme: kütle ortadan ayrılıyor. İki yarım aynı sprite'tan geliyor,
// aradaki boşluk kütlenin ayrıldığını gösteriyor.
function drawSplit(ctx, sprite, px, py, gap) {
    const half = Math.round(sprite.w / 2 / PX) * PX;
    ctx.drawImage(sprite.canvas, 0, 0, half, sprite.h, px - gap, py, half, sprite.h);
    ctx.drawImage(sprite.canvas, half, 0, sprite.w - half, sprite.h,
        px + half + gap, py, sprite.w - half, sprite.h);
}

// --- saldıran uzuvlar ---

// Virüsün savurduğu kol: omuzdan çıkıp ileri uzanan kalın bir kütle, ucunda
// yumru bir pençe. Kolun kendisi sprite'ta yok - savurma anında var oluyor,
// çünkü kütlenin sabit bir kolu yok, uzatınca oluyor.
function virusPunchArm(ctx, x, footY, t, dir) {
    const reach = swell(phase(t, 0.2, 0.8));
    if (reach <= 0.02) return;

    const P = VIRUS_P;
    const cols = 10 + Math.round(reach * 26);
    const shoulderY = footY - PX * 36;
    const step = dir > 0 ? PX : -PX;
    const rootX = x + dir * PX * 6;

    // Kol SÜTUN SÜTUN çiziliyor: uca doğru hem inceliyor hem SARKIYOR.
    // Gergin dik bir boru bu kütlenin dili değil - kendi ağırlığıyla düşen
    // bir uzantı (prologdaki virüsün biçim kuralı).
    let tipX = rootX;
    let tipY = shoulderY;
    for (let c = 0; c < cols; c++) {
        const p = c / (cols - 1);
        const cy = shoulderY + Math.round(p * p * 3) * PX;
        const half = Math.max(2, Math.round(4.5 - p * 1.5));
        const cx = rootX + c * step;
        blk(ctx, cx, cy - half * PX, PX, half * 2 * PX, P.body);
        blk(ctx, cx, cy - half * PX, PX, PX, P.outline);
        blk(ctx, cx, cy + (half - 1) * PX, PX, PX, P.outline);
        blk(ctx, cx, cy - (half - 1) * PX, PX, PX, P.light);
        if (c % 5 === 3) blk(ctx, cx, cy, PX, PX * 2, P.dark);   // ek yeri
        tipX = cx;
        tipY = cy;
    }

    // Yumru pençe: üç kısa tırnak ileri bakıyor
    const fx = dir > 0 ? tipX : tipX - PX * 4;
    blk(ctx, fx, tipY - PX * 4, PX * 5, PX * 8, P.body);
    blk(ctx, fx, tipY - PX * 4, PX * 5, PX, P.light);
    blk(ctx, fx, tipY + PX * 3, PX * 5, PX, P.outline);
    blk(ctx, fx, tipY - PX * 4, PX, PX * 8, P.outline);
    for (let i = 0; i < 3; i++) {
        const ty = tipY - PX * 3 + PX * (i * 3);
        const tx = dir > 0 ? fx + PX * 5 : fx - PX * 3;
        blk(ctx, tx, ty, PX * 3, PX * 2, P.body);
        blk(ctx, tx, ty, PX * 3, PX, P.light);
        blk(ctx, dir > 0 ? tx + PX * 2 : tx, ty, PX, PX * 2, P.outline);
    }
    // Kütle akarken damlıyor
    if (reach > 0.5) drip(ctx, Math.round((rootX + tipX) / 2 / PX), Math.round((tipY + PX * 3) / PX), 2, P);
}

// Anti-virüsün omzundaki borunun ucundaki küçük kafa topu buradan atıyor:
// ağzının önünde kısa bir parlama ve birkaç serpinti.
function coralMuzzle(ctx, x, footY, t) {
    const f = swell(phase(t, 0, 0.55));
    if (f <= 0.05) return;
    const P = CORAL_P;
    const mx = x + PX * 8;
    const my = footY - PX * 45;
    const r = Math.round(f * 3) * PX;
    if (r <= 0) return;

    blk(ctx, mx - r, my - r, r * 2, r * 2, P.dark);
    blk(ctx, mx - r + PX, my - r + PX, r * 2 - PX * 2, r * 2 - PX * 2, P.light);
    blk(ctx, mx - PX, my - PX, PX * 2, PX * 2, P.vein);
    for (let i = 0; i < 3; i++) {
        blk(ctx, mx + PX * (2 + i * 2), my + PX * (i - 1), PX, PX, P.body);
    }
}

// Saçılma: gövdeden her yöne fırlayan kısa mercan dikenleri. Topların
// kendisi combat.js'te; bu, onların çıktığı andaki kasılma.
function coralBurstSpikes(ctx, x, footY, t) {
    const f = phase(t, 0.15, 0.75);
    if (f <= 0 || f >= 1) return;
    const P = CORAL_P;
    const cy = footY - PX * 25;
    for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const d = PX * (4 + f * 12);
        const bx = Math.round((x + Math.cos(a) * d) / PX) * PX;
        const by = Math.round((cy + Math.sin(a) * d) / PX) * PX;
        blk(ctx, bx, by, PX * 2, PX * 2, i % 2 ? P.body : P.light);
    }
}

// Elektronun ileri uzattığı el: ışın buradan çıkıyor. Kol lacivert, el sarı
// ve normalden bir tık büyük - karakterin kendi kuralı.
function electroBeamArm(ctx, x, footY, t, dir) {
    const reach = swell(phase(t, 0.1, 0.9));
    if (reach <= 0.02) return;
    const P = ELECTRO_P;
    const len = Math.round((PX * 4 + reach * PX * 7) / PX) * PX;
    const top = footY - PX * 32;
    const x0 = dir > 0 ? x + PX * 3 : x - PX * 3 - len;

    blk(ctx, x0, top, len, PX * 4, P.body);
    blk(ctx, x0, top, len, PX, P.light);
    blk(ctx, x0, top + PX * 3, len, PX, P.outline);
    blk(ctx, x0 + PX * 2, top + PX, PX * 2, PX, P.seam);

    // El: uçta, biraz daha büyük
    const hx = dir > 0 ? x0 + len : x0 - PX * 5;
    blk(ctx, hx, top - PX, PX * 5, PX * 6, P.hand);
    blk(ctx, hx, top - PX, PX * 5, PX, P.handLight);
    blk(ctx, hx, top + PX * 4, PX * 5, PX, P.handDark);
    // Avucun önünde toplanan yük
    if (reach > 0.6) {
        const gx = dir > 0 ? hx + PX * 5 : hx - PX * 3;
        blk(ctx, gx, top, PX * 3, PX * 4, P.spark);
    }
}

// Küreyi kurarken iki el birden havada
function electroOrbArms(ctx, x, footY, t) {
    const raise = swell(phase(t, 0.05, 0.95));
    if (raise <= 0.02) return;
    const P = ELECTRO_P;
    const shoulder = footY - PX * 32;
    const len = Math.round((PX * 4 + raise * PX * 9) / PX) * PX;

    for (const side of [-1, 1]) {
        // Kollar OMUZ HİZASINDA, gövdenin dışında: ortaya yakın çizilince
        // kaldırılan eller karakterin kafasını örtüyordu.
        const ax = side > 0 ? x + PX * 7 : x - PX * 11;
        blk(ctx, ax, shoulder - len, PX * 4, len, P.body);
        blk(ctx, ax, shoulder - len, PX, len, P.light);
        blk(ctx, ax + PX * 3, shoulder - len, PX, len, P.outline);
        blk(ctx, ax - PX, shoulder - len - PX * 5, PX * 6, PX * 5, P.hand);
        blk(ctx, ax - PX, shoulder - len - PX * 5, PX * 6, PX, P.handLight);
        blk(ctx, ax - PX, shoulder - len - PX, PX * 6, PX, P.handDark);
    }
    // İki elin arasında biriken yük
    if (raise > 0.5) {
        blk(ctx, x - PX * 2, shoulder - len - PX * 4, PX * 4, PX * 3, P.spark);
    }
}

// Buzun atış kolu: kırığı avucunda BÜYÜTÜP savuruyor. Elektronun ışın kolu
// düz uzanıyor, buzunki bir yay çiziyor - biri boşaltma, biri fırlatma.
function iceThrowArm(ctx, x, footY, t, dir) {
    const P = ICE_P;
    const shoulder = footY - PX * 33;
    // Kol geriden öne bir yay çiziyor: -0.8 rad'dan +0.5 rad'a
    const k = phase(t, 0.1, 0.75);
    const a = -0.9 + k * 1.5;
    const len = PX * 11;
    const hx = x + dir * Math.round((Math.cos(a) * len) / PX) * PX;
    const hy = shoulder + Math.round((Math.sin(a) * len) / PX) * PX;

    // Üst kol: omuzdan ele doğru sütun sütun
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
        const p = i / steps;
        const px = Math.round((x + (hx - x) * p) / PX) * PX;
        const py = Math.round((shoulder + (hy - shoulder) * p) / PX) * PX;
        const half = Math.max(1, Math.round(2.5 - p));
        blk(ctx, px - half * PX, py - half * PX, half * 2 * PX, half * 2 * PX, P.body);
        blk(ctx, px - half * PX, py - half * PX, PX, half * 2 * PX, P.outline);
        blk(ctx, px - half * PX + PX, py - half * PX, PX, PX, P.light);
    }

    // Avuçtaki kırık: t 0.55'te ELDEN AYRILIYOR (combat.js'te de mermi o
    // civarda doğuyor). Ayrılmadan önce büyüyor, sonra el boş kalıyor.
    const grow = phase(t, 0.1, 0.55);
    if (t < 0.6 && grow > 0.05) {
        const r = Math.round(1 + grow * 2) * PX;
        blk(ctx, hx - r, hy - r, r * 2, r * 2, P.body);
        blk(ctx, hx - r, hy - r, r * 2, PX, P.light);
        blk(ctx, hx - r, hy + r - PX, r * 2, PX, P.outline);
        blk(ctx, hx - PX, hy - PX, PX * 2, PX * 2, P.frost);
    } else {
        // Savurmadan sonra elde kalan kırağı
        blk(ctx, hx - PX * 2, hy - PX * 2, PX * 4, PX * 4, P.light);
        blk(ctx, hx - PX * 2, hy - PX * 2, PX * 4, PX, P.frost);
    }
}

// Duvarı kurarken iki el yerde: avuçlardan öne doğru yayılan kırağı.
function iceWallPalms(ctx, x, footY, t) {
    const P = ICE_P;
    const k = swell(t);
    if (k <= 0.05) return;
    const top = footY - PX * 16;

    for (const side of [-1, 1]) {
        const ax = x + side * PX * 7 - (side < 0 ? PX * 4 : 0);
        blk(ctx, ax, top, PX * 4, PX * 14, P.body);
        blk(ctx, ax, top, PX, PX * 14, P.outline);
        blk(ctx, ax + PX, top, PX, PX * 14, P.light);
        // Avuç: yere yapışmış
        blk(ctx, ax - PX, footY - PX * 3, PX * 6, PX * 3, P.light);
        blk(ctx, ax - PX, footY - PX, PX * 6, PX, P.outline);
    }

    // Yerden yükselen kırağı dalgası
    const reach = Math.round(k * 10);
    for (let i = 0; i < reach; i++) {
        const h = Math.round(Math.sin((i / reach) * Math.PI) * 3) + 1;
        blk(ctx, x - PX * 20 + i * PX * 4, footY - h * PX, PX * 3, h * PX, i % 2 ? P.frost : P.light);
    }
}

// Ayaz: karakterin çevresine bir anda açılan soğuk halka. Vuruşun kendisi
// combat.js'te; bu, halkanın karakterden çıktığı an.
function frostBurst(ctx, x, footY, t) {
    const P = ICE_P;
    const k = phase(t, 0.3, 1);
    if (k <= 0 || k >= 1) return;
    const cy = footY - PX * 24;
    const fade = 1 - k;

    for (let i = 0; i < 14; i++) {
        const a = (Math.PI * 2 * i) / 14;
        const d = PX * (5 + k * 30);
        const bx = Math.round((x + Math.cos(a) * d) / PX) * PX;
        const by = Math.round((cy + Math.sin(a) * d * 0.75) / PX) * PX;
        const s = fade > 0.5 ? PX * 2 : PX;
        ctx.globalAlpha = 0.35 + fade * 0.65;
        blk(ctx, bx, by, s, s, i % 3 ? P.light : P.frost);
    }
    ctx.globalAlpha = 1;
}

const OVERLAYS = {
    punch: (ctx, x, footY, t, dir) => virusPunchArm(ctx, x, footY, t, dir),
    blob: (ctx, x, footY, t) => coralMuzzle(ctx, x, footY, t),
    burst: (ctx, x, footY, t) => coralBurstSpikes(ctx, x, footY, t),
    beam: (ctx, x, footY, t, dir) => electroBeamArm(ctx, x, footY, t, dir),
    orb: (ctx, x, footY, t) => electroOrbArms(ctx, x, footY, t),
    shard: (ctx, x, footY, t, dir) => iceThrowArm(ctx, x, footY, t, dir),
    wall: (ctx, x, footY, t) => iceWallPalms(ctx, x, footY, t),
    frost: (ctx, x, footY, t) => frostBurst(ctx, x, footY, t)
};

// Hamlenin arenaya çıktığı nokta: anti-virüsün topu omzundaki borunun
// ucundan, elektronun ışını ileri uzanan elinden çıkmalı - ikisi de
// gövdenin ortasından çıkarsa hamlenin kimden geldiği okunmuyor.
// dx AYNALANMIYOR: boru karakterin hangi yanındaysa orada kalır.
export const MUZZLES = {
    antivirus: { dx: PX * 8, dy: -PX * 45 },
    electro: { dx: PX * 12, dy: -PX * 30, mirror: true },
    virus: { dx: 0, dy: -PX * 34, mirror: true },
    // Buzun kırığı SAVURAN ELDEN çıkıyor: kol yay çizdiği için el, atış
    // anında (t≈0.55) omuzun bir tık önünde ve altında oluyor.
    ice: { dx: PX * 10, dy: -PX * 30, mirror: true }
};

export function muzzleOf(key, x, footY, dir = 1) {
    const m = MUZZLES[key];
    if (!m) return { x, y: footY - 100 };
    return { x: x + (m.mirror ? dir * m.dx : m.dx), y: footY + m.dy };
}

// Dövüşçüyü ayakları (x, y) noktasına gelecek şekilde çizer.
// frame: arenanın kare sayacı - yalnızca hareketli çizimler (elektrik) kullanır.
// pose: { id, t, dir } - oynayan saldırı animasyonu (yoksa null).
export function drawFighter(ctx, key, x, y, frame = 0, pose = null) {
    const sprite = FIGHTER_SPRITES[key]?.();
    if (!sprite) return;

    const shape = pose && POSES[pose.id] ? POSES[pose.id](pose.t) : null;
    const dir = pose?.dir ?? 1;
    const lean = (shape?.lean || 0) * (pose && DIR_POSES.has(pose.id) ? dir : 1);
    const px = Math.round(x - sprite.ox);
    const py = Math.round(y - sprite.oy) + Math.round((shape?.dy || 0) / PX) * PX;

    ctx.save();
    if (shape?.fade !== undefined) ctx.globalAlpha *= Math.min(1, 0.25 + shape.fade);

    if (shape?.gap) drawSplit(ctx, sprite, px, py, shape.gap);
    else if (Math.abs(lean) >= PX) drawLeaning(ctx, sprite, px, py, lean);
    else ctx.drawImage(sprite.canvas, px, py);

    // Kasılma parlaması: karakterin BEYAZ SİLUETİ üstüne biniyor.
    // 'source-atop' ile beyaz basmak burada işe yaramıyor - arena tuvalinde
    // arka plan zaten opak, beyaz sahnenin üstüne kutu gibi düşüyor.
    if (shape?.flash > 0.02) {
        ctx.globalAlpha *= Math.min(0.6, shape.flash);
        ctx.drawImage(silhouetteOf(key, sprite), px, py);
    }
    ctx.restore();

    if (key === 'electro') {
        // Hamle sırasında elektrik çoğalıyor: yük boşalmadan duramayan
        // karakterin saldırısı sessiz olamaz.
        const boost = pose && (pose.id === 'beam' || pose.id === 'orb' || pose.id === 'blink') ? 2.4 : 1;
        drawElectroSparks(ctx, Math.round(x), Math.round(y), frame, boost);
    }

    if (key === 'ice') {
        // Hamle sırasında kırağı yoğunlaşıyor - ama elektrodaki kadar değil:
        // buzun saldırısı patlamıyor, soğuğu artıyor.
        const boost = pose && (pose.id === 'frost' || pose.id === 'wall') ? 1.9 : 1;
        drawFrostMotes(ctx, Math.round(x), Math.round(y), frame, boost);
    }

    if (pose && OVERLAYS[pose.id]) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        OVERLAYS[pose.id](ctx, Math.round(x), Math.round(y), pose.t, dir);
        ctx.restore();
    }
}
