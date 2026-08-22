// Macera modu bölgeleri. Her bölge ana haritadaki bir portala bağlanır.
// Plan: 5 bölge x 3 mekan x 5 Pokemon (3 yaygın + 1 boss + 1 gizli) = 75 karakter.
// pokemon alanları PokeAPI numaralarıdır; bossKind 'mekan' veya 'bölge' olabilir
// (her bölgenin 3. mekanının bossu aynı zamanda bölge bossudur).
export const REGIONS = {
    1: {
        name: 'Vahşi Orman',
        colors: ['#22c55e', '#86efac', '#dcfce7'],
        locations: [
            {
                id: 'loc-1-1',
                name: 'Fısıltılı Orman Girişi',
                colors: ['#22c55e', '#86efac', '#dcfce7'],
                pokemon: { commons: [127, 217, 709], hidden: 545, boss: 768, bossKind: 'mekan' }
            },
            {
                id: 'loc-1-2',
                name: 'Gölgeli Derinlikler',
                colors: ['#0d9488', '#2dd4bf', '#ccfbf1'],
                pokemon: { commons: [123, 455, 553], hidden: 197, boss: 701, bossKind: 'mekan' }
            },
            {
                id: 'loc-1-3',
                name: 'Kadim Ağaç Meydanı',
                colors: ['#ca8a04', '#facc15', '#fef9c3'],
                pokemon: { commons: [130, 635, 289], hidden: 143, boss: 893, bossKind: 'bölge' }
            }
        ]
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
