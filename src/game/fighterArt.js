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
function paintFigure(ctx, ox, oy, { mode = 'electro', armRaise = 0, headTilt = 0, hug = 0, manPalette = 'a', hideArm = 0 } = {}) {
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

    // hideArm: o kol sprite'ta çizilmiyor - hamlede üstüne çizilecek
    // (bkz. electroSprite). 2 = ikisi birden (küreyi iki elle kuruyor).
    if (hideArm !== -1 && hideArm !== 2) drawArm(-1, 0);
    const raisedHand = (hideArm !== 1 && hideArm !== 2)
        ? drawArm(1, armRaise)
        : { x: X(E_CX + 9), y: Y(E_HIP) };

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

// Sprite'lar bir kez çizilip saklanıyor, ama artık TEK bir hâl değil:
// saldıran uzuv üstüne ayrıca çizildiği için (bkz. OVERLAYS) o uzvun
// sprite'taki hâli gizlenmeli, yoksa karakterin o yanında iki kol oluyor -
// biri yerinde asılı duran, biri savuran.
//
// Uzvu her karede yeniden boyamak da olurdu (paintFigure zaten açı alıyor),
// ama arenada iki oyuncu + klon var; figür başına kare başına iki bin küsur
// fillRect demek. Saklanan tuvali DÖNDÜRMEK de olmuyor: ctx.rotate piksel
// ızgarasını kaydırıyor (ctx.scale ile aynı tuzak). Kalan yol bu: gizlenmiş
// hâli AYRI BİR TUVAL olarak saklamak - kare başına ek maliyet sıfır.
const electroCaches = new Map();

// hideArm: 0 yok · -1 karakterin sağ kolu · 1 sol kolu · 2 ikisi birden
export function electroSprite(hideArm = 0) {
    const cached = electroCaches.get(hideArm);
    if (cached) return cached;
    const w = PX * E_COLS;
    const h = PX * E_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    paintFigure(ctx, 0, 0, { mode: 'electro', armRaise: 0, hideArm });
    const sprite = { canvas, ox: PX * E_CX, oy: h, w, h };
    electroCaches.set(hideArm, sprite);
    return sprite;
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
// Palet doğrudan tasarım sayfasından: koyu lacivertten beyaza giden bir buz
// merdiveni, üstüne tek bir soğuk mor. Gövde ORTA tonda - açık mavi bir
// gövdenin üstünde beyaz kırıklar okunmuyor, karakter soluk kalıyor.
// Palet doğrudan tasarım sayfasından: koyu laciverten beyaza giden bir buz
// merdiveni, üstüne tek bir soğuk mor. Gövde ORTA tonda - açık mavi bir
// gövdenin üstünde beyaz kırıklar okunmuyor, karakter soluk kalıyor.
const ICE_P = {
    deep: '#0a1e3c',        // kontur ve göz oyuğu
    dark: '#1b4c8f',        // gölgede kalan yüzler, göz maskesi
    mid: '#2d7fd0',
    body: '#4aa8ea',
    light: '#8fd0f7',
    pale: '#cfeaff',
    frost: '#ffffff',
    eye: '#e6feff',
    glow: '#6ee8ff',
    lilac: '#8f9ce8'        // paletteki tek kırık renk: birkaç fase
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

// Gövdenin yarı genişliği (sütun cinsinden), satır satır. FORMÜLLE DEĞİL
// ELLE yazılı: tasarım sayfasındaki biçim bir kalp/kalkan - üstte iki
// yuvarlak omuz, ortada bir çentik, altta sivri uç. Sinüs eğrisi bunu
// vermiyor, düzgün bir damla veriyor ve karakter "yumurta" gibi duruyordu.
const ICE_TOP = 17;
const ICE_BOTTOM = 38;
const ICE_HALF = [
    6, 8, 10, 11, 11, 11, 11, 10, 10, 9, 9, 8, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1
];
// Üstteki çentik: ilk üç satırda gövdenin ORTASI boş. Tepedeki kristal
// oradan çıkıyor - kütle kristali "takmış" değil, kristal kütleden BÜYÜMÜŞ.
const ICE_NOTCH = 3;

function iceHalf(row) {
    if (row < ICE_TOP || row > ICE_BOTTOM) return 0;
    return ICE_HALF[row - ICE_TOP];
}

// Gövde HAFİF ASİMETRİK: karakterin sağ yanı (izleyicinin solu) göz hizasında
// bir sütun daha geniş, sol yanı belden aşağıda bir sütun dar. Simetrik bir
// kütle heykel gibi duruyor, kimliği olmuyor - diğer üçünde de aynı kural var.
function iceHalfL(row) {
    const h = iceHalf(row);
    return h > 0 && row >= 20 && row <= 28 ? h + 1 : h;
}
function iceHalfR(row) {
    const h = iceHalf(row);
    return h > 0 && row >= 29 ? Math.max(0, h - 1) : h;
}

// Buz hâli. ox, oy: sprite kutusunun sol üst köşesi (canvas pikseli).
//
// Tasarım kullanıcının verdiği sayfadan (2026-09-05): AYRI KAFA YOK - gövdenin
// üst yarısında koyu bir maskenin içinde yanan iki iri göz. Kol yok, yerlerinde
// uçları keskinleşen buz YAPRAKLARI (kılıçlar) - gövdeden AÇIK renkteler.
// Ayak yok: kütle yerin biraz üstünde. Tepede kütlenin yarısı boyunda tek bir
// kristal. Gövde yarı saydam.
//
// hideBlade: -1 / 1 - o yandaki UZUN yaprağı çizme. Kılıç sallanırken sprite'ın
// yaprağı yerinde kalırsa karakterin o yanında iki kılıç oluyor: biri asılı
// duran, biri savuran. Gizlenmiş hâl ayrı bir tuvale saklanıyor, kare başına
// ek maliyet yok (bkz. iceSprite).
function paintIce(ctx, ox, oy, { headTilt = 0, hideBlade = 0 } = {}) {
    const P = ICE_P;
    const X = (col) => ox + col * PX;
    const Y = (row) => oy + row * PX;
    const w = (cols) => cols * PX;

    // Kafa yok, ama giriş animasyonu kütleyi yatırabiliyor: eğim yukarı
    // doğru artıyor, taban yerinde kalıyor.
    const tiltAt = (row) => {
        const k = Math.max(0, Math.min(1, (ICE_BOTTOM - row) / ICE_BOTTOM));
        return -Math.round(headTilt * 2 * k) * PX;
    };
    const put = (col, row, cols, rows, color) => {
        blk(ctx, X(col) + tiltAt(row), Y(row), w(cols), w(rows), color);
    };

    // --- Kristal diken ---
    // Kökten uca doğru incelen, basamak basamak bir kristal. Düz bir üçgen
    // "buz" değil "cam parçası" okunuyordu.
    const spike = (col, row, len, dx, dy, thick) => {
        for (let i = 0; i < len; i++) {
            const t = Math.max(1, Math.round(thick * (1 - i / len)));
            const c = Math.round(col + dx * i);
            const r = Math.round(row + dy * i);
            put(c, r, t, 1, i >= len - 2 ? P.frost : P.light);
            put(c, r, 1, 1, i >= len - 2 ? P.pale : P.mid);
            if (t > 2) put(c + t - 1, r, 1, 1, P.dark);
        }
    };

    // --- Buz yaprağı (kılıç) ---
    // Kolların yerinde duran şey. Ortası şişip ucu sivrilen bir yaprak:
    // ortasında parlak bir omurga, iki yanında koyu kenar. Uzaktan bakınca
    // karakteri tanıtan siluet bunlar - o yüzden UZUN, KALIN ve gövdeden AÇIK.
    const bladeAt = (col, row, len, dx, dy, maxHalf) => {
        let tip = { col, row };
        for (let i = 0; i < len; i++) {
            const t = i / (len - 1);
            // Şişme kökten hemen sonra: yaprağın en kalın yeri ortadan önce
            const half = Math.max(0, Math.round(maxHalf * Math.sin(Math.pow(t, 0.55) * Math.PI)));
            const c = Math.round(col + dx * i);
            const r = Math.round(row + dy * i);
            tip = { col: c, row: r };
            if (half <= 0) {
                put(c, r, 1, 1, P.pale);
                continue;
            }
            put(c - half, r, half * 2 + 1, 1, P.light);
            put(c - half, r, 1, 1, P.mid);
            put(c + half, r, 1, 1, P.deep);
            // Omurga yaprağın ORTASINDA parlak, ucunda değil: ucu da beyaz
            // yapınca yaprak değil İĞNE okunuyor.
            put(c, r, 1, 1, t > 0.2 && t < 0.75 ? P.frost : P.pale);
            // Damarlar: yaprağı bölen kısa eğik hatlar
            if (i % 4 === 2) put(c - half + 1, r, 2, 1, P.pale);
        }
        put(tip.col, tip.row, 1, 1, P.frost);
        return tip;
    };

    // ---- 1) Arkada duran yapraklar ----
    // Gövdeden ÖNCE çiziliyor: sonra çizilirse kökleri kütlenin üstüne binip
    // yapraklar yapıştırılmış duruyor.
    if (hideBlade !== -1) bladeAt(E_CX - 4, 27, 19, -0.76, 0.66, 4);   // sol uzun kılıç
    if (hideBlade !== 1) bladeAt(E_CX + 4, 26, 19, 0.75, 0.67, 4);     // sağ uzun kılıç
    bladeAt(E_CX - 6, 24, 11, -0.95, 0.30, 3);                          // sol yatık kılıç
    bladeAt(E_CX + 6, 23, 10, 0.96, 0.28, 3);                           // sağ yatık kılıç

    // ---- 2) Tepedeki kristal ----
    // Tasarım sayfasında kütlenin YARISI boyunda tek bir kristal var; kısa
    // çizilince karakter tepesi düz bir yumru gibi duruyor. Üç kısa diken
    // yerine BİR uzun kristal + yanında küçükler.
    for (let row = ICE_TOP - 1; row >= 4; row--) {
        const up = ICE_TOP - 1 - row;
        // Kökte 5, ortada 3, tepede 1 sütun. Boydan boya tek sütun çizince
        // kristal değil ANTEN duruyordu.
        const half = up < 3 ? 2 : up < 8 ? 1 : 0;
        put(E_CX - half, row, half * 2 + 1, 1, P.light);
        put(E_CX - half, row, 1, 1, P.pale);      // ışık soldan
        if (half > 0) put(E_CX + half, row, 1, 1, P.mid);
        if (half > 1) put(E_CX + half - 1, row, 1, 1, P.dark);
        if (up === 3 || up === 8) put(E_CX - half, row, half * 2 + 1, 1, P.frost);
    }
    put(E_CX, 4, 1, 1, P.frost);
    spike(E_CX - 6, ICE_TOP + 1, 6, -0.35, -1, 3);
    spike(E_CX + 4, ICE_TOP, 5, 0.35, -1, 3);
    spike(E_CX - 9, ICE_TOP + 4, 3, -0.5, -1, 2);
    spike(E_CX + 8, ICE_TOP + 3, 3, 0.5, -1, 2);

    // ---- 3) Gövde ----
    // YARI SAYDAM: alfa yalnızca dolgu satırında açılıyor, kontur ve gözler
    // opak kalıyor. Üst üste binen yarı saydam bloklar kütleyi lekeli
    // gösteriyor, o yüzden her satır BİR KEZ dolduruluyor.
    for (let row = ICE_TOP; row <= ICE_BOTTOM; row++) {
        const hl = iceHalfL(row);
        const hr = iceHalfR(row);
        if (hl + hr < 2) continue;
        const notch = row < ICE_TOP + ICE_NOTCH ? 2 : 0;   // üstteki çentik

        ctx.save();
        ctx.globalAlpha *= 0.86;
        if (notch) {
            put(E_CX - hl, row, hl - notch + 1, 1, P.body);
            put(E_CX + notch, row, hr - notch + 1, 1, P.body);
        } else {
            put(E_CX - hl, row, hl + hr + 1, 1, P.body);
        }
        ctx.restore();

        // Kenarlar ve hacim
        put(E_CX - hl, row, 1, 1, P.deep);
        put(E_CX + hr, row, 1, 1, P.deep);
        put(E_CX - hl + 1, row, 2, 1, P.light);
        put(E_CX + hr - 2, row, 2, 1, P.dark);
        if (notch) {
            put(E_CX - notch, row, 1, 1, P.deep);
            put(E_CX + notch, row, 1, 1, P.deep);
        }

        // Faseler: düz dolgu buzu "plastik" gösteriyor. SEYREK olmalı - sık
        // olunca gövde buz değil karlı parazit gibi okunuyor ve gözler
        // içinde kayboluyor. hash konuma bağlı, desen her açılışta AYNI.
        for (let c = -hl + 3; c < hr - 2; c++) {
            const r = hash(c, row, 51);
            if (r < 0.05) put(E_CX + c, row, 1, 1, P.light);
            else if (r < 0.09) put(E_CX + c, row, 1, 1, P.mid);
            else if (r < 0.10) put(E_CX + c, row, 1, 1, P.lilac);
        }

        // Alt yarının gölgesi: ışık üstten-soldan geliyor, kütlenin alt sağ
        // yanı koyulaşıyor. Düz aydınlık bir kütle "kâğıttan kesilmiş" duruyor.
        if (row > 29) put(E_CX + hr - 4, row, 3, 1, P.mid);
    }

    // ---- 4) Maske ve gözler ----
    // Ayrı bir kafa yok: kütlenin üst yarısında KOYU BİR MASKE ve içinde
    // yanan iki iri göz. Maske şart - gözleri doğrudan açık gövdeye yazınca
    // kayboluyorlar; yanan şeyin arkasında karanlık olmalı.
    // Maske GÖZLERİN ÇEVRESİYLE sınırlı ve hafif olmalı: kalın ve koyu bir
    // bant gövdenin ortasını yutuyor, karakter buz kütlesi değil koyu bir
    // yürek gibi duruyordu.
    for (let row = 22; row <= 26; row++) {
        const reach = row < 24 ? 10 : 9;
        ctx.save();
        ctx.globalAlpha *= 0.34;
        put(E_CX - reach, row, reach * 2 + 1, 1, P.deep);
        ctx.restore();
    }

    // Göz: dıştan içe doğru AŞAĞI iniyor (yukarı eğim şaşkın, aşağı eğim
    // tehditkâr yapıyor). İki satır kalın - tek piksellik bir yarık faseler
    // arasında kayboluyor.
    // Göz DIŞTAN İÇE İNCELİYOR: baştan sona aynı kalınlıkta çizince göz değil
    // ÇUBUK oluyor, iki çubuk da yüzde bıyık gibi duruyordu. Kalın dış uç +
    // sivri iç uç badem biçimini veriyor.
    const eye = (outerCol, dir) => {
        for (let i = 0; i < 7; i++) {
            const c = outerCol + dir * i;
            const r = 23 + Math.round(i * 0.45);
            const thick = i < 2 ? 3 : i < 4 ? 2 : 1;
            put(c, r - 1, 1, 1, P.deep);                     // üstündeki gölge
            put(c, r, 1, thick, i < 2 ? P.glow : P.eye);     // yanan yarık
            put(c, r + thick, 1, 1, P.dark);                 // altındaki gölge
        }
    };
    eye(E_CX - 9, 1);
    eye(E_CX + 9, -1);
    // İki gözün arasında yükselen sırt: yüzün ortası boş kalmasın
    put(E_CX - 1, 21, 2, 1, P.light);
    put(E_CX, 22, 1, 2, P.pale);

    // ---- 5) Kütlenin alt ucu ----
    // Sivrilerek bitiyor ve ucunda tek bir saçak var. İki saçak koymuştum,
    // uzaktan BACAK okunuyorlardı - oysa bu karakterin ayağı yok.
    put(E_CX, ICE_BOTTOM + 1, 1, 2, P.mid);
    put(E_CX, ICE_BOTTOM + 3, 1, 1, P.pale);

    // Vuran bir el yok; kılıcın çıktığı yer gövdenin omuz hizası.
    return { hand: { x: X(E_CX) + w(6), y: Y(26) } };
}
// Buzun kırağısı. Elektronun kıvılcımı gibi sprite'a gömülmüyor: her karede
// yeniden çiziliyor. Ama RİTMİ bilerek farklı - elektro 4 karede bir çatırdar,
// buz süzülür. Aynı hızda olsalar iki karakter de "titriyor" gibi okunurdu;
// buz titremiyor, üşütüyor.
//
// Karakter YÜZDÜĞÜ için burada iki iş daha var: altındaki buz havuzu ve
// çevresinde dönen kırıklar. İkisi de tasarım sayfasından.
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

    // Havuz: kütlenin altında, yere oturmuş bir buz halkası. Yüzen bir
    // karakterin gölgesi yoktur - yerinin okunması için bir şey gerekiyor.
    const ring = [
        [-9, 0, 18, 1], [-11, -1, 4, 1], [7, -1, 4, 1],
        [-7, -2, 14, 1], [-12, 0, 2, 1], [10, 0, 2, 1]
    ];
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const [cx, cy, cw, ch] of ring) {
        put(x + cx * u, footY + cy * u, cw * u, ch * u, P.glow);
    }
    ctx.globalAlpha = 0.30;
    put(x - 8 * u, footY - 3 * u, 16 * u, 2 * u, P.mid);
    ctx.restore();

    // Süzülen zerreler
    const motes = Math.round(9 * intensity);
    for (let i = 0; i < motes; i++) {
        // x zerreye bağlı ve SABİT, yalnızca y akıyor: x de zıplayınca zerre
        // süzülmüyor, her an başka yerde yeniden doğuyor gibi duruyor.
        const mx = x + Math.round((hash(i * 5.1, 0, 31) - 0.5) * 30) * u;
        const fall = (frame / 3 + i * 9 + hash(i, 1, 32) * 40) % (E_ROWS - 6);
        put(mx, top + Math.round(fall) * u, u, u, hash(i, 2, 33) < 0.35 ? P.frost : P.glow);
    }

    // Çevresinde dönen üç kırık: kütle yalnız değil, kendi parçalarını da
    // taşıyor. Dönüş YAVAŞ - hızlı dönen parçalar "makine" okunuyor.
    for (let i = 0; i < 3; i++) {
        const a = frame * 0.012 + (Math.PI * 2 * i) / 3;
        const rx = x + Math.round((Math.cos(a) * 16)) * u;
        const ry = footY - Math.round(30 + Math.sin(a) * 5) * u;
        put(rx, ry, u * 2, u * (i === 1 ? 3 : 2), P.light);
        put(rx, ry, u, u, P.frost);
    }
}
// Elektrodaki gerekçenin aynısı: kılıç sallanırken o yandaki UZUN yaprak
// sprite'ta durmamalı, yoksa karakterin bir yanında iki kılıç oluyor.
const iceCaches = new Map();

// hideBlade: 0 yok · -1 karakterin sağındaki uzun yaprak · 1 solundaki
export function iceSprite(hideBlade = 0) {
    const cached = iceCaches.get(hideBlade);
    if (cached) return cached;
    const w = PX * E_COLS;
    const h = PX * E_ROWS;
    const { canvas, ctx } = newCanvas(w, h);
    paintIce(ctx, 0, 0, { hideBlade });
    const sprite = { canvas, ox: PX * E_CX, oy: h, w, h };
    iceCaches.set(hideBlade, sprite);
    return sprite;
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
const DIR_POSES = new Set(['punch', 'blob', 'grab', 'beam', 'sword']);

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
    // Buz kılıcı: kütle geriye çekilip SAPLIYOR. Virüsün savurması yayvan ve
    // ağır (geri yaslanma uzun), buzunki kısa ve ileri - biri vuruyor, biri
    // kesiyor.
    sword: (t) => ({
        lean: t < 0.22 ? -PX * 3 * phase(t, 0, 0.22)
            : t < 0.45 ? PX * (-3 + 11 * phase(t, 0.22, 0.45))
            : PX * 8 * (1 - phase(t, 0.45, 1)),
        dy: t > 0.22 && t < 0.55 ? -PX : 0
    }),
    // Klon: kütle bir an ikiye ayrılıyor. Ayrılan yarı arkaya doğru
    // süzülüyor (klon arkada doğuyor), sonra iki gövde de tamamlanıyor.
    // Parlama YARIM: tam güçte beyaz siluet karakteri yutuyordu, ayrılan
    // ikinci gövde hiç görünmüyordu.
    clone: (t) => ({ flash: 0.45 * phase(t, 0.1, 0.35) * (1 - phase(t, 0.35, 0.7)) }),
    // Buz yolu: kütle çöküp soğuğu YERE veriyor
    path: (t) => ({ dy: Math.round(swell(phase(t, 0, 0.6)) * 3) * PX }),
    dashUp: (t) => ({ dy: -PX * 2 * (1 - t) }),
    dashLeft: (t) => ({ lean: -PX * 6 * (1 - t) }),
    dashRight: (t) => ({ lean: PX * 6 * (1 - t) })
};

// --- gövdenin çizimi ---

// Karakterin beyaz silueti: parlama için. Sprite gibi bir kez üretilip
// saklanıyor - her karede yeniden boyamanın anlamı yok.
// Anahtar SPRITE'IN KENDİSİ, karakterin adı değil: aynı karakterin uzvu
// gizlenmiş hâlleri de var (bkz. spriteFor), ada göre saklarsak hepsi ilk
// üretilen siluetle parlıyor.
const silhouettes = new Map();
function silhouetteOf(sprite) {
    const cached = silhouettes.get(sprite);
    if (cached) return cached;
    const { canvas, ctx } = newCanvas(sprite.w, sprite.h);
    ctx.drawImage(sprite.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sprite.w, sprite.h);
    silhouettes.set(sprite, canvas);
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

// Buzun kılıcı. Sprite'ta duran yapraklar KISA - vuruş anında öndeki yaprak
// bir kılıç boyuna uzayıp yay çiziyor. Uzuvun sprite'ta olmayıp hamlede var
// olması virüsün savurmasındaki kuralla aynı: kütlenin sabit bir kolu yok.
//
// Menzil (abilities.ice.basic.reach = 118) ile çizimin boyu birbirine bağlı:
// görünen kılıç ile vuran kutu ayrışırsa oyuncu "vurmadım" der. Kılıcın ucu
// yaklaşık x + dir * 120'ye ulaşıyor.
function iceSwordArm(ctx, x, footY, t, dir) {
    const P = ICE_P;
    // Yay: yukarı-geriden öne-aşağı. -1.15 rad'dan +0.30 rad'a
    const k = phase(t, 0.15, 0.62);
    const a = -1.15 + k * 1.45;
    // Kök, sprite'taki uzun yaprağın kökünün TA KENDİSİ (bkz. bladeAt
    // çağrıları): o yaprak bu hamlede gizleniyor ve yerini bu alıyor.
    // Başka bir noktadan çıkarsa kılıç kütlenin yanında ayrı bir şey olur.
    const root = { x: x + dir * PX * 4, y: footY - PX * 26 };
    const len = PX * 27;
    const dxu = Math.cos(a) * dir;
    const dyu = Math.sin(a);

    // Kılıcın izi: bir önceki karelerin yayı. Vuruşun HIZI buradan okunuyor -
    // izi olmayan bir kılıç sallanmıyor, yer değiştiriyor gibi duruyor.
    if (k > 0.15 && k < 1) {
        ctx.save();
        // İz KESİNTİSİZ olmalı: aralıklı noktalar yay değil serpinti gibi
        // okunuyordu. Her önceki açı için sürekli bir çizgi çekiliyor.
        for (let i = 1; i <= 4; i++) {
            const ta = a - i * 0.15;
            // İz SAYDAMLIKLA değil RENKLE soluyor: yarı saydam beyaz koyu
            // zeminde griye dönüyor ve kılıç sallanmıyor, tırmalıyor gibi
            // duruyordu. Piksel dilinde soluma bir renk merdivenidir.
            ctx.fillStyle = [P.frost, P.pale, P.light, P.mid][i - 1];
            for (let d = 8; d < 27; d++) {
                ctx.fillRect(Math.round((root.x + Math.cos(ta) * dir * d * PX) / PX) * PX,
                    Math.round((root.y + Math.sin(ta) * d * PX) / PX) * PX, PX, PX);
            }
        }
        ctx.restore();
    }

    // Kılıcın kendisi: kökten uca doğru şişip sivrilen yaprak. Her adımda
    // yola DİK bir sütun basılıyor - adım başına kare basınca kılıç kendi
    // içinde iki kez boyanıp kenarları kayboluyordu.
    //
    // Kalınlık gövdedeki yapraklarla aynı dilde olmalı: ilk denemede yarı
    // kalınlık 3'tü ve kılıç, kütlenin yanından çıkan bir ÇUBUK gibi
    // duruyordu. Kütlenin yarısı kadar bir kılıç ancak okunuyor.
    const steps = 30;
    for (let i = 0; i <= steps; i++) {
        const p = i / steps;
        const half = Math.max(1, Math.round(5 * Math.sin(Math.pow(p, 0.5) * Math.PI)));
        const px = Math.round((root.x + dxu * len * p) / PX) * PX;
        const py = Math.round((root.y + dyu * len * p) / PX) * PX;
        // Renkler sprite'taki yapraklarla AYNI: kılıç gövdeden koyu olursa
        // "kütlenin yaprağı" değil, eline tutuşturulmuş başka bir nesne
        // gibi duruyor.
        blk(ctx, px, py - half * PX, PX, half * 2 * PX, P.light);
        blk(ctx, px, py - half * PX, PX, PX, P.mid);               // üst kenar
        blk(ctx, px, py + (half - 1) * PX, PX, PX, P.deep);        // alt kenar
        blk(ctx, px, py, PX, PX, p > 0.2 && p < 0.75 ? P.frost : P.pale);   // omurga
    }

    // Ucun parlaması
    const tipX = Math.round((root.x + dxu * len) / PX) * PX;
    const tipY = Math.round((root.y + dyu * len) / PX) * PX;
    blk(ctx, tipX - PX, tipY - PX, PX * 3, PX * 3, P.frost);
    if (k > 0.55 && k < 0.95) {
        for (let i = 0; i < 4; i++) {
            blk(ctx, tipX + dir * PX * (2 + i * 2), tipY + Math.round(hash(i, 7, 81) * 4 - 2) * PX,
                PX, PX, i % 2 ? P.frost : P.glow);
        }
    }
}

// Klon çıkarken: kütleden arkaya doğru ayrılan yarı saydam bir kopya.
// Klonun kendisi combat.js'te doğuyor (arkada, 80 piksel geride); buradaki
// hayalet ikisini birbirine bağlıyor - yoksa klon yoktan bitmiş gibi duruyor.
function cloneSplit(ctx, x, footY, t, dir) {
    const k = phase(t, 0.15, 0.85);
    if (k <= 0 || k >= 1) return;
    const sprite = iceSprite();
    ctx.save();
    ctx.globalAlpha = 0.45 * (1 - k * 0.4);
    ctx.drawImage(sprite.canvas,
        Math.round((x - dir * 80 * k - sprite.ox) / PX) * PX,
        Math.round(footY - sprite.oy));
    ctx.restore();
}

// Buz yolu kurulurken: kütlenin altından yere dökülen soğuk. Yolun kendisi
// combat.js'te; bu, yolun karakterden ÇIKTIĞI an.
function icePour(ctx, x, footY, t, dir) {
    const P = ICE_P;
    const k = phase(t, 0.2, 1);
    if (k <= 0) return;
    const put = (bx, by, bw, bh, color) => {
        blk(ctx, bx, by, bw, bh, color);
    };

    // Aşağı akan sütun
    const h = Math.round(k * 12) * PX;
    ctx.save();
    ctx.globalAlpha = 0.8;
    put(x - PX * 2, footY - PX * 12, PX * 4, h, P.light);
    put(x - PX * 2, footY - PX * 12, PX, h, P.frost);
    ctx.restore();

    // Yerde öne doğru açılan kırağı: yolun ilk adımı
    const reach = Math.round(k * 9);
    for (let i = 0; i < reach; i++) {
        const hh = (1 + Math.round(hash(i, 8, 82) * 3)) * PX;
        put(x + dir * (i * PX * 4), footY - hh, PX * 3, hh, i % 2 ? P.pale : P.frost);
    }
}
const OVERLAYS = {
    punch: (ctx, x, footY, t, dir) => virusPunchArm(ctx, x, footY, t, dir),
    blob: (ctx, x, footY, t) => coralMuzzle(ctx, x, footY, t),
    burst: (ctx, x, footY, t) => coralBurstSpikes(ctx, x, footY, t),
    beam: (ctx, x, footY, t, dir) => electroBeamArm(ctx, x, footY, t, dir),
    orb: (ctx, x, footY, t) => electroOrbArms(ctx, x, footY, t),
    sword: (ctx, x, footY, t, dir) => iceSwordArm(ctx, x, footY, t, dir),
    clone: (ctx, x, footY, t, dir) => cloneSplit(ctx, x, footY, t, dir),
    path: (ctx, x, footY, t, dir) => icePour(ctx, x, footY, t, dir)
};

// Hangi hamlede sprite'ın hangi uzvu GİZLENECEK. Saldıran uzuv üstüne
// ayrıca çiziliyor (OVERLAYS); uzuv sprite'ta da dururken çizilirse
// karakterin o yanında iki tane oluyor - biri yerinde asılı, biri savuran.
//
// Virüsün savurması bu tabloda YOK ve olmamalı: o kütlenin sabit bir kolu
// yok, kol savurma anında var oluyor (bkz. virusPunchArm).
//
// Yön: hamle karakterin baktığı yanda çıkıyor, o yüzden gizlenecek uzuv da
// dir'e bağlı. dir > 0 ise karakterin SOL yanı (izleyicinin sağı) gizleniyor.
const HIDDEN_LIMB = {
    beam: (dir) => (dir > 0 ? 1 : -1),
    orb: () => 2,                        // küreyi iki elle kuruyor
    sword: (dir) => (dir > 0 ? 1 : -1)
};

// Bu duruş için kullanılacak sprite. Gizlenmiş hâller ayrı tuvallerde
// saklanıyor, yani seçim kare başına bir Map aramasından ibaret.
function spriteFor(key, pose) {
    const build = FIGHTER_SPRITES[key];
    if (!build) return null;
    const rule = pose && HIDDEN_LIMB[pose.id];
    return rule ? build(rule(pose.dir ?? 1)) : build();
}

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
    const sprite = spriteFor(key, pose);
    if (!sprite) return;

    const shape = pose && POSES[pose.id] ? POSES[pose.id](pose.t) : null;
    const dir = pose?.dir ?? 1;
    const lean = (shape?.lean || 0) * (pose && DIR_POSES.has(pose.id) ? dir : 1);
    const px = Math.round(x - sprite.ox);
    // ICE-VİRÜS'ün ayağı yok: kütle yerin üstünde SÜZÜLÜYOR. Yavaş bir iniş
    // çıkış olmadan yüzen bir gövde havada asılı kalmış gibi duruyor. Kaydırma
    // PX'in katı - ara değerler piksel ızgarasını titretiyor.
    const bob = key === 'ice' ? Math.round(Math.sin(frame * 0.045)) * PX : 0;
    const py = Math.round(y - sprite.oy) + Math.round((shape?.dy || 0) / PX) * PX + bob;

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
        ctx.drawImage(silhouetteOf(sprite), px, py);
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
        const boost = pose && (pose.id === 'path' || pose.id === 'clone') ? 1.9 : 1;
        drawFrostMotes(ctx, Math.round(x), Math.round(y), frame, boost);
    }

    if (pose && OVERLAYS[pose.id]) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        OVERLAYS[pose.id](ctx, Math.round(x), Math.round(y), pose.t, dir);
        ctx.restore();
    }
}
