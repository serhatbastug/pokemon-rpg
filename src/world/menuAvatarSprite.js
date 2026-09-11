// Ana menüdeki oyuncu avatarının piksel sprite'ı - anti-virüsün İNSAN
// TAŞIYICISININ (henüz bulaşmamış, sağlıklı hâli) görünüşüne göre reskin
// edilmiş. Kullanıcı eski kırmızı şapkalı "antrenör" görünüşünü
// (trainerSprite.js) beğenmedi; önce mercan kaplamalı hâli denendi, ama
// kullanıcı "anti-virüs karakterinin BULAŞMAMIŞ hâlini kastettim" dedi -
// yani sadece taşıyıcı: mercan YOK, düz haki tulum + açık kahve saç.
//
// BİLEREK AYRI DOSYA: bu görünüş SADECE ana menüde kullanılıyor
// (MenuScene.js). Kuşatma/ormanın ağzı prologları hâlâ eski
// `trainerSprite.js`'i kullanıyor - onlar yakında tamamen silinecek, o
// yüzden oraya dokunmaya gerek yok (kullanıcının isteği, 2026-09-11).
//
// Palet `src/game/fighterArt.js`'teki HUMAN_B (anti-virüsün taşıyıcısı)
// ile birebir aynı: açık kahve saç, haki tulum, kahve bot.
//
// 12x16 ızgara, trainerSprite.js ile AYNI boyut - MenuScene'deki
// (x, y - 26, ..., PLAYER_SCALE) çağrısı değişmeden çalışsın diye.

const COLORS = {
    k: '#1f2937', // kontur
    h: '#4a3a2a', // saç (HUMAN_B ile aynı)
    s: '#e8b98c', // ten
    S: '#c9985f', // ten gölgesi
    j: '#5a5340', // haki tulum
    J: '#43402f', // tulum gölgesi
    y: '#2a2118'  // bot
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
        '..jjjjjjjj..',
        '.sjjjjjjjjs.',
        '.sjjjjjjjjs.',
        '..jJjjjJjj..',
        '...jjjjjj...',
        '...jj..jj...',
        '...jj..jj...',
        '..yyy..yyy..'
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
        '..jjjjjjjj..',
        '.sjjjjjjjjs.',
        '.sjjjjjjjjs.',
        '..jJjjjJjj..',
        '...jjjjjj...',
        '..jj....jj..',
        '..jj....jj..',
        '.yyy......yy'
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
        '..jjjjjjjj..',
        '.sjjjjjjjjs.',
        '.sjjjjjjjjs.',
        '..jJjjjJjj..',
        '...jjjjjj...',
        '...jj..jj...',
        '...jj..jj...',
        '..yyy..yyy..'
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
        '..jjjjjjjj..',
        '.sjjjjjjjjs.',
        '.sjjjjjjjjs.',
        '..jJjjjJjj..',
        '...jjjjjj...',
        '..jj....jj..',
        '..jj....jj..',
        '.yyy......yy'
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
        '...jjjjjj...',
        '..sjjjjjj...',
        '..sjjjjjj.s.',
        '...jJjjjJ.s.',
        '...jjjjj....',
        '...jj.jj....',
        '...jj.jj....',
        '..yyy.yyy...'
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
        '...jjjjjj...',
        '..sjjjjjj...',
        '.ssjjjjjj...',
        '...jJjjjJ...',
        '...jjjjj....',
        '..jj...jj...',
        '.jj.....jj..',
        'yyy.....yyy.'
    ]
];

export const MENU_AVATAR_FRAMES = { down: DOWN, up: UP, side: SIDE };

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

    ctx.restore();
}
