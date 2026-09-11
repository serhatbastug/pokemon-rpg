// Ana menüdeki oyuncu avatarının piksel sprite'ı - ANTİ-VİRÜS'ün görünüşüne
// göre reskin edilmiş. Kullanıcı eski kırmızı şapkalı "antrenör" görünüşünü
// (trainerSprite.js) beğenmedi, arenadaki anti-virüs dövüşçüsünün paletini
// istedi: haki tulum + mercan rengi asimetrik kaplama.
//
// BİLEREK AYRI DOSYA: bu görünüş SADECE ana menüde kullanılıyor
// (MenuScene.js). Kuşatma/ormanın ağzı prologları hâlâ eski
// `trainerSprite.js`'i kullanıyor - onlar yakında tamamen silinecek, o
// yüzden oraya dokunmaya gerek yok (kullanıcının isteği, 2026-09-11).
//
// Palet `src/game/fighterArt.js`'teki CORAL_P / HUMAN_B ile birebir aynı:
// aynı karakterin iki farklı ölçekte (yandan dövüşçü / üstten yürüyüş)
// çizimi gibi dursun istendi.
//
// 12x16 ızgara, trainerSprite.js ile AYNI boyut - MenuScene'deki
// (x, y - 26, ..., PLAYER_SCALE) çağrısı değişmeden çalışsın diye.
//
// Kaplamanın kendi tarifi (bkz. [[arena-dovuscular]]) yandan dövüşçüde
// gövdenin SAĞ yarısını sarıp SOL koldan yukarı bir boru+küçük kafa
// uzatıyordu. Bu üstten görünüşte 12 piksel eninde bir alanda o ayrıntı
// okunmuyor; en azından aynı YÖN kuralı korundu (karakterin sağı mercan,
// solu haki) ve boru+küçük kafa satır ızgarasının DIŞINDA, ayrı bir
// ekleme olarak eklendi (drawMenuAvatar'ın sonunda).

const COLORS = {
    k: '#1f2937', // kontur
    h: '#4a3a2a', // saç (HUMAN_B ile aynı)
    s: '#e8b98c', // ten
    S: '#c9985f', // ten gölgesi
    j: '#5a5340', // haki tulum
    J: '#43402f', // tulum gölgesi
    y: '#2a2118', // bot
    r: '#f2795c', // mercan kaplama (CORAL_P.body)
    R: '#c9503a'  // mercan gölgesi (CORAL_P.dark)
};

const DOWN = [
    [
        '...hhhhhh...',
        '..hhhhhhhh..',
        '.hhhhhhhhhh.',
        '..kkkkkkkk..',
        '..kssssssk..',
        '..ksSssSsk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..jjjjrrrr..',
        '.sjjjjrrrrr.',
        '.sjjjjrrrrr.',
        '..jJjjrRrr..',
        '...jjjjjj...',
        '...jj..jj...',
        '...jj..jj...',
        '..yry..yyy..'
    ],
    [
        '...hhhhhh...',
        '..hhhhhhhh..',
        '.hhhhhhhhhh.',
        '..kkkkkkkk..',
        '..kssssssk..',
        '..ksSssSsk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..jjjjrrrr..',
        '.sjjjjrrrrr.',
        '.sjjjjrrrrr.',
        '..jJjjrRrr..',
        '...jjjjjj...',
        '..jj....jj..',
        '..jj....jj..',
        '.yry......yy'
    ]
];

const UP = [
    [
        '...hhhhhh...',
        '..hhhhhhhh..',
        '.hhhhhhhhhh.',
        '..kkkkkkkk..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '...hhhhhh...',
        '..jjjjrrrr..',
        '.sjjjjrrrrr.',
        '.sjjjjrrrrr.',
        '..jJjjrRrr..',
        '...jjjjjj...',
        '...jj..jj...',
        '...jj..jj...',
        '..yry..yyy..'
    ],
    [
        '...hhhhhh...',
        '..hhhhhhhh..',
        '.hhhhhhhhhh.',
        '..kkkkkkkk..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '...hhhhhh...',
        '..jjjjrrrr..',
        '.sjjjjrrrrr.',
        '.sjjjjrrrrr.',
        '..jJjjrRrr..',
        '...jjjjjj...',
        '..jj....jj..',
        '..jj....jj..',
        '.yry......yy'
    ]
];

// Sağa bakan duruş (sola bakarken aynalanır)
const SIDE = [
    [
        '...hhhhhh...',
        '..hhhhhhhhh.',
        '..hhhhhhhhh.',
        '...kkkkkkk..',
        '...kssssss..',
        '...ksskSss..',
        '...kssssss..',
        '....kSSSS...',
        '...jjjrrr...',
        '..sjjjrrr...',
        '..sjjjrrr.r.',
        '...jJjrrR.r.',
        '...jjjjj....',
        '...jj.jj....',
        '...jj.jj....',
        '..yry.yyy...'
    ],
    [
        '...hhhhhh...',
        '..hhhhhhhhh.',
        '..hhhhhhhhh.',
        '...kkkkkkk..',
        '...kssssss..',
        '...ksskSss..',
        '...kssssss..',
        '....kSSSS...',
        '...jjjrrr...',
        '..sjjjrrr...',
        '.ssjjjrrr...',
        '...jJjrrR...',
        '...jjjjj....',
        '..jj...jj...',
        '.jj.....jj..',
        'yry.....yyy.'
    ]
];

export const MENU_AVATAR_FRAMES = { down: DOWN, up: UP, side: SIDE };

// Sağ omuzdan yukarı uzanan mercan boru + ucundaki küçük kafa. Satır
// ızgarasının DIŞINDA: 12 piksellik bir ızgarada boru+yüz okunmuyordu, ayrı
// bir ekleme olarak üstten taşırıldı.
function drawTube(ctx, ox, oy, scale) {
    const col = 9.4;
    for (const row of [7.2, 6, 4.8, 3.6]) {
        ctx.fillStyle = COLORS.r;
        ctx.fillRect(ox + col * scale, oy + row * scale, scale, scale);
    }
    ctx.fillStyle = COLORS.R;
    ctx.fillRect(ox + (col - 0.3) * scale, oy + 2 * scale, scale * 1.6, scale * 1.6);
    ctx.fillStyle = '#ffe0d0';
    ctx.fillRect(ox + (col + 0.1) * scale, oy + 2.4 * scale, scale * 0.5, scale * 0.5);
}

// Antrenörü (x, y) merkezli çizer - trainerSprite.js'teki drawTrainer ile
// AYNI imza, MenuScene'de doğrudan onun yerine geçebilsin diye.
export function drawMenuAvatar(ctx, x, y, dir, moving, scale = 3) {
    const key = (dir === 'left' || dir === 'right') ? 'side' : dir;
    const frames = MENU_AVATAR_FRAMES[key] || MENU_AVATAR_FRAMES.down;
    const frame = frames[moving ? Math.floor(Date.now() / 160) % 2 : 0];

    const cols = frame[0].length;
    const rows = frame.length;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (dir === 'left') ctx.scale(-1, 1);

    const ox = -cols * scale / 2;
    const oy = -rows * scale / 2;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const color = COLORS[frame[r][c]];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(ox + c * scale, oy + r * scale, scale, scale);
        }
    }
    drawTube(ctx, ox, oy, scale);

    ctx.restore();
}
