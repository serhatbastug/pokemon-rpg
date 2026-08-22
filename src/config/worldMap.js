// Ana harita verisi. Izgara karakterleri:
//   '.' çim   'p' patika   'T' ağaç (engel)   'W' su (engel)   'R' kaya (engel)
//   '1'-'5' bölge portalı (regions.js'teki bölge numarası; zemin çim sayılır)
// Her satır tam 20 karakter olmalıdır (20 sütun x 10 satır, 50px karo = 1000x500).

export const TILE_SIZE = 50;

export const SOLID_TILES = new Set(['T', 'W', 'R']);

export const PLAYER_START = { col: 10, row: 8 };

export const MAIN_MAP = {
    name: 'Ana Harita',
    grid: [
        'TTTTTTTTTTTTTTTTTTTT',
        'T.........5........T',
        'T.1.......p......2.T',
        'T.p..RR...p..RR..p.T',
        'T.pppppppppppppppp.T',
        'T.p..W....p....W.p.T',
        'T.p..WW...p...WW.p.T',
        'T.3.......p......4.T',
        'T....R....p...R....T',
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
