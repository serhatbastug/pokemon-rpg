// Ana harita verisi. Izgara karakterleri:
//   '.' çim      'p' patika   'f' çiçekli çim   'g' uzun çim   's' kum
//   'T' ağaç (engel)   'W' su (engel)   'R' kaya (engel)   'h' çalı (engel)
//   '1'-'5' bölge portalı (regions.js'teki bölge numarası; zemin çim sayılır)
// Her satır tam 20 karakter olmalıdır (20 sütun x 10 satır, 50px karo = 1000x500).

export const TILE_SIZE = 50;

export const SOLID_TILES = new Set(['T', 'W', 'R', 'h']);

export const PLAYER_START = { col: 10, row: 8 };

export const MAIN_MAP = {
    name: 'Ana Harita',
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
    ]
};

// Izgaradaki portal karolarını { region, col, row } listesine çevirir
export function extractPortals(map) {
    const portals = [];
    map.grid.forEach((rowStr, row) => {
        for (let col = 0; col < rowStr.length; col++) {
            const ch = rowStr[col];
            if (ch >= '1' && ch <= '5') {
                portals.push({ region: Number(ch), col, row });
            }
        }
    });
    return portals;
}
