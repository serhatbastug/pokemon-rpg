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
function paintFigure(ctx, ox, oy, { mode = 'electro', armRaise = 0, headTilt = 0, manPalette = 'a' } = {}) {
    const on = mode === 'electro';
    const P = ELECTRO_P;
    const H = manPalette === 'c' ? HUMAN_C : HUMAN_P;
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

// --- Dışarıya açılan yüz ---

export const FIGHTER_SPRITES = {
    virus: virusSprite,
    antivirus: antivirusSprite,
    electro: electroSprite
};

// Dövüşçüyü ayakları (x, y) noktasına gelecek şekilde çizer.
// frame: arenanın kare sayacı - yalnızca hareketli çizimler (elektrik) kullanır.
export function drawFighter(ctx, key, x, y, frame = 0) {
    const sprite = FIGHTER_SPRITES[key]?.();
    if (!sprite) return;
    ctx.drawImage(sprite.canvas, Math.round(x - sprite.ox), Math.round(y - sprite.oy));
    if (key === 'electro') drawElectroSparks(ctx, Math.round(x), Math.round(y), frame);
}
