import { REGIONS } from './regions.js';

// Macera modu haritaları. Izgara karakterleri:
//   '.' çim      'p' patika   'f' çiçekli çim   'g' uzun çim   's' kum
//   'T' ağaç (engel)   'W' su (engel)   'R' kaya (engel)   'h' çalı (engel)
//   'H' gizli çalı: çalıyla birebir aynı görünür ama içinden GEÇİLEBİLİR
//   'M' tüccar tezgahı (engel; Kecleon'un satış yeri, bölge merkezlerinde durur)
//   'b' boss arenası zemini (boss uyanınca ortalığı dağıtır, zemin onun temasına döner)
//   Rakamlar o haritanın portalDefs tanımındaki portallardır ('0' çıkış geleneğidir).
// Bir haritanın tüm satırları eşit uzunlukta olmalıdır. 20x10 (50px karo) tam bir
// ekran doldurur; daha geniş/yüksek haritalarda kamera oyuncuyu takip eder.
//
// portalDefs: { karo karakteri: { target, label, colors } }
//   target null ise portal görünür ama pasiftir (henüz açılmamış içerik).

export const TILE_SIZE = 50;

export const SOLID_TILES = new Set(['T', 'W', 'R', 'h', 'M']);

const EXIT_COLORS = ['#64748b', '#94a3b8', '#e2e8f0'];

const region1 = REGIONS[1];

export const MAPS = {
    'main': {
        id: 'main',
        name: 'Ana Harita',
        start: { col: 10, row: 8 },
        grid: [
            'TTTTTTTTTTTTTTTTTTTT',
            'T.f......s5s....hf.T',
            'T.1......gpg.....2.T',
            'T.p.hRR..gpg.RRh.p.T',
            'T.pppppppppppppppp.T',
            'T.p.fWWs..p..sWWfp.T',
            'T.p.sWWg..p..gWWsp.T',
            'T.3..f...gpg..f..4.T',
            'T.g.hR.f..p..f.Rh.gT',
            'TTTTTTTTTTTTTTTTTTTT'
        ],
        portalDefs: {
            '1': { target: 'region-1', label: REGIONS[1].name, colors: REGIONS[1].colors },
            '2': { target: null, label: REGIONS[2].name, colors: REGIONS[2].colors },
            '3': { target: null, label: REGIONS[3].name, colors: REGIONS[3].colors },
            '4': { target: null, label: REGIONS[4].name, colors: REGIONS[4].colors },
            '5': { target: null, label: REGIONS[5].name, colors: REGIONS[5].colors }
        }
    },

    // 1. Bölge: Vahşi Orman - 3 mekan portalı + ana haritaya çıkış
    'region-1': {
        id: 'region-1',
        name: region1.name,
        ambience: 'forest',
        start: { col: 9, row: 7 },
        grid: [
            'TTTTTTTTTTTTTTTTTTTT',
            'TTg.f....3....f.gTTT',
            'TT..g....p....g..TTT',
            'T.1...TT.p.TT...2..T',
            'T.p.f.TT.p.TT.f.p..T',
            'T.ppppppppppppppp..T',
            'T..g..h..p..h.Mg...T',
            'T.f......p......f..T',
            'T...g....0....g....T',
            'TTTTTTTTTTTTTTTTTTTT'
        ],
        portalDefs: {
            '1': { target: 'loc-1-1', label: region1.locations[0].name, colors: region1.locations[0].colors },
            '2': { target: null, label: region1.locations[1].name, colors: region1.locations[1].colors },
            '3': { target: null, label: region1.locations[2].name, colors: region1.locations[2].colors },
            '0': { target: 'main', label: 'Ana Harita', colors: EXIT_COLORS }
        }
    },

    // 1. Bölge / 1. Mekan: Fısıltılı Orman Girişi
    // Her yöne uzanan labirent (40x20 = 2x2 ekran); kamera oyuncuyu takip eder.
    // Izgara scratchpad'deki gen-maze.mjs betiğiyle üretildi (seed: 20260822).
    // Giriş/çıkış sol ortada; sağ-alttaki açık meydan mekan bossunun alanı olacak.
    // (Pokemonlar henüz haritada değil; liste regions.js'te hazır)
    'loc-1-1': {
        id: 'loc-1-1',
        name: region1.locations[0].name,
        ambience: 'forest',
        theme: 'dark', // derin orman: loş palet + vinyet + ateşböcekleri
        start: { col: 2, row: 7 },
        grid: [
            'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
            'T.g....f.......T.......g...gs.T..f.....TTTTT',
            'Tff..g....s..g.T.....g.......gT...f...gTTTTT',
            'T..TTTTg.TTTT..Ts.Tg.TTTT..T..TTTT..Ts.TTssT',
            'T..T.g...Tf..gfT.gf..gf.T.fT..T...g.T.gHsssT',
            'T..Tf....T.....Tg...gs..T.fTg.T..f..T..TTssT',
            'TTTT..TTTTg.TTTT..TTTTTTT.gT..Tf.TTTT..TTTTT',
            'T0.Tf...gT..Ts..g.T.....g..T....gT..Tf.TTTTT',
            'T..T...s.Tg.T.gf..T........T.....T.gT..TTTTT',
            'T..Tg.T.gT..TTTTTTT..TTTTTTTTTTTTT..Tg.TTTTT',
            'T..T.....T.....g..Tgs..gTf.g....f...T..TTTTT',
            'Tf.Tg....T.......gT..gs.T..f.g...g..T.fTTTTT',
            'T.gT..TTTT.gTTTTs.TTTT..T..T..TTTTTTT..TTTTT',
            'T..T.gT..T...g.T..T..g.fT.fT..g...g....TTTTT',
            'T..T..Tg.T.g...T..T.g...Ts.Tgsf.gsf.gsfTTTTT',
            'T.fT..T..T..T.gT..Ts.TTTT.gTTTTf.T.....TTTTT',
            'T..g..T.f...T...g...gT..gf..gsT...f....TTTTT',
            'T.....T...g.T.g...gs.Tgff.....T....g...TTTTT',
            'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
            'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT'
        ],
        portalDefs: {
            '0': { target: 'region-1', label: region1.name, colors: EXIT_COLORS }
        },
        // Boss uyanınca ortalığı dağıtıp burayı açık arenaya çevirir
        bossArena: { col0: 25, row0: 11, col1: 38, row1: 17 },
        // Haritaya dağılmış düşmanlar (regions.js'teki mekan listesinden).
        // kind: common (yaygın), hidden (gizli mağarasını korur), boss (uyuyan)
        spawns: [
            { id: 127, kind: 'common', col: 6, row: 1 },
            { id: 127, kind: 'common', col: 20, row: 8 },
            { id: 127, kind: 'common', col: 13, row: 16 },
            { id: 217, kind: 'common', col: 26, row: 4 },
            { id: 217, kind: 'common', col: 5, row: 10 },
            { id: 217, kind: 'common', col: 33, row: 13 },
            { id: 709, kind: 'common', col: 16, row: 7 },
            { id: 709, kind: 'common', col: 30, row: 10 },
            { id: 709, kind: 'common', col: 8, row: 17 },
            // Gizli Scolipede: sağdaki gizli çalının (H) ardındaki mağarada
            { id: 545, kind: 'hidden', col: 41, row: 4 },
            { id: 768, kind: 'boss', col: 34, row: 15 }
        ]
    }
};

// Izgaradaki portal karolarını { ...tanım, col, row } listesine çevirir
export function extractPortals(map) {
    const portals = [];
    map.grid.forEach((rowStr, row) => {
        for (let col = 0; col < rowStr.length; col++) {
            const def = map.portalDefs[rowStr[col]];
            if (def) portals.push({ ...def, col, row });
        }
    });
    return portals;
}
