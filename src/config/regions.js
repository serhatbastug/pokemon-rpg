// Macera modu bölgeleri. Her bölge ana haritadaki bir portala bağlanır.
// Plan: 5 bölge x 3 mekan x 5 Pokemon (3 yaygın + 1 boss + 1 gizli) = 75 karakter.
// locations alanı şimdilik boş; mekan haritaları eklendikçe dolacak.
export const REGIONS = {
    1: {
        name: 'Orman Tapınağı',
        colors: ['#22c55e', '#86efac', '#dcfce7'],
        locations: []
    },
    2: {
        name: 'Ateş Dağı',
        colors: ['#ef4444', '#fb923c', '#fde047'],
        locations: []
    },
    3: {
        name: 'Buz Diyarı',
        colors: ['#0ea5e9', '#7dd3fc', '#e0f2fe'],
        locations: []
    },
    4: {
        name: 'Fırtına Vadisi',
        colors: ['#facc15', '#fde047', '#ffffff'],
        locations: []
    },
    5: {
        name: 'Gölge Kalesi',
        colors: ['#a855f7', '#c084fc', '#f3e8ff'],
        locations: []
    }
};
