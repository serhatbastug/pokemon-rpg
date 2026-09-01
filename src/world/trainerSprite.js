// Antrenör karakterinin elle çizilmiş piksel sprite'ı (dışarıdan gelen bir
// görseli yok). 12x16 ızgara, 4 yön ve yürüyüş için 2'şer kare.
// Harfler renk haritasındaki anahtarlardır; '.' saydamdır.

const COLORS = {
    k: '#1f2937', // kontur / saç gölgesi
    h: '#3f2a12', // saç
    s: '#f6c8a0', // ten
    S: '#e0a97d', // ten gölgesi
    c: '#dc2626', // şapka / ceket kırmızısı
    C: '#991b1b', // kırmızı gölge
    w: '#f8fafc', // şapka önü
    b: '#1d4ed8', // pantolon
    B: '#1e3a8a', // pantolon gölgesi
    y: '#111827'  // ayakkabı
};

// Aşağı bakan (oyuncuya dönük) duruş
const DOWN = [
    [
        '...cccccc...',
        '..cccccccc..',
        '.cwwwwwwwwc.',
        '..kkkkkkkk..',
        '..kssssssk..',
        '..ksSssSsk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..cccccccc..',
        '.sccccccccs.',
        '.sccccccccs.',
        '..cCcccCcc..',
        '...bbbbbb...',
        '...bb..bb...',
        '...bb..bb...',
        '..yyy..yyy..'
    ],
    [
        '...cccccc...',
        '..cccccccc..',
        '.cwwwwwwwwc.',
        '..kkkkkkkk..',
        '..kssssssk..',
        '..ksSssSsk..',
        '..kssssssk..',
        '...kSSSSk...',
        '..cccccccc..',
        '.sccccccccs.',
        '.sccccccccs.',
        '..cCcccCcc..',
        '...bbbbbb...',
        '..bb....bb..',
        '..bb....bb..',
        '.yyy......yy'
    ]
];

// Yukarı bakan (sırtı dönük) duruş
const UP = [
    [
        '...cccccc...',
        '..cccccccc..',
        '.cccccccccc.',
        '..kkkkkkkk..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '...hhhhhh...',
        '..cccccccc..',
        '.sccccccccs.',
        '.sccccccccs.',
        '..cCcccCcc..',
        '...bbbbbb...',
        '...bb..bb...',
        '...bb..bb...',
        '..yyy..yyy..'
    ],
    [
        '...cccccc...',
        '..cccccccc..',
        '.cccccccccc.',
        '..kkkkkkkk..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '..hhhhhhhh..',
        '...hhhhhh...',
        '..cccccccc..',
        '.sccccccccs.',
        '.sccccccccs.',
        '..cCcccCcc..',
        '...bbbbbb...',
        '..bb....bb..',
        '..bb....bb..',
        '.yyy......yy'
    ]
];

// Sağa bakan duruş (sola bakarken aynalanır)
const SIDE = [
    [
        '...cccccc...',
        '..ccccccccc.',
        '..cwwwwwwwc.',
        '...kkkkkkk..',
        '...kssssss..',
        '...ksskSss..',
        '...kssssss..',
        '....kSSSS...',
        '...cccccc...',
        '..scccccc...',
        '..scccccc.s.',
        '...cCcccC.s.',
        '...bbbbb....',
        '...bb.bb....',
        '...bb.bb....',
        '..yyy.yyy...'
    ],
    [
        '...cccccc...',
        '..ccccccccc.',
        '..cwwwwwwwc.',
        '...kkkkkkk..',
        '...kssssss..',
        '...ksskSss..',
        '...kssssss..',
        '....kSSSS...',
        '...cccccc...',
        '..scccccc...',
        '.sscccccc...',
        '...cCcccC...',
        '...bbbbb....',
        '..bb...bb...',
        '.bb.....bb..',
        'yyy.....yyy.'
    ]
];

// Kayma duruşu (kanalizasyon). Kameraya sırtı dönük kayıyor: en yakın olan
// şapka, en uzak olan ayaklar. Gövde ızgaranın alt yarısına iniyor ki
// karakter gerçekten yere yatmış görünsün.
const SLIDE = [
    [
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '....yyyy....',
        '...bbbbbb...',
        '...bbbbbb...',
        '..cccccccc..',
        '.sccccccccs.',
        '.sccccccccs.',
        '..kcccccck..',
        '...cccccc...'
    ],
    [
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '............',
        '...yyy.yy...',
        '...bbbbbb...',
        '...bbbbbb...',
        '..cccccccc..',
        '.sccccccccs.',
        '.sccccccccs.',
        '..kcccccck..',
        '...cccccc...'
    ]
];

export const TRAINER_FRAMES = { down: DOWN, up: UP, side: SIDE, slide: SLIDE };

// Antrenörü (x, y) merkezli çizer. dir: 'down' | 'up' | 'left' | 'right'
export function drawTrainer(ctx, x, y, dir, moving, scale = 3) {
    const key = (dir === 'left' || dir === 'right') ? 'side' : dir;
    const frames = TRAINER_FRAMES[key] || TRAINER_FRAMES.down;
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
