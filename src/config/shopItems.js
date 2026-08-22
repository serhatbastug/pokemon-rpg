// Kecleon'un dükkanında satılan eşyalar. Para birimi yetenek jetonudur:
// jetonu ya Pokemon seviyesine yatırırsınız ya da buraya harcarsınız.
export const SHOP_ITEMS = [
    {
        id: 'poke-ball',
        name: 'Poke Ball',
        price: 4,
        stack: 5,               // bir alışta kaç adet gelir
        color: '#dc2626',
        catchRate: 1,
        description: 'Bayılmış yabani Pokemonları yakalar. Kaçma ihtimali vardır.'
    },
    {
        id: 'great-ball',
        name: 'Great Ball',
        price: 9,
        stack: 3,
        color: '#3b82f6',
        catchRate: 1.5,
        description: 'Daha güvenilir top. Gizli Pokemonlar için iyi seçim.'
    },
    {
        id: 'ultra-ball',
        name: 'Ultra Ball',
        price: 18,
        stack: 2,
        color: '#facc15',
        catchRate: 2.2,
        description: 'En güçlü top. Zor yakalananlar için saklayın.'
    },
    {
        id: 'antidote',
        name: 'Panzehir',
        price: 6,
        stack: 2,
        color: '#a855f7',
        description: 'Zehir, yanık ve felç durumunu geçirir.'
    },
    {
        id: 'potion',
        name: 'Potion',
        price: 10,
        stack: 1,
        color: '#f472b6',
        description: 'Sahadaki Pokemonun canının yarısını yeniler.'
    },
    {
        id: 'revive',
        name: 'Revive',
        price: 25,
        stack: 1,
        color: '#fbbf24',
        description: 'Bayılmış bir ekip üyesini yarı canla ayağa kaldırır.'
    },
    {
        id: 'team-tonic',
        name: 'Ekip Toniği',
        price: 45,
        stack: 1,
        color: '#4ade80',
        description: 'Tüm ekibi tamamen iyileştirir.'
    }
];

export const STARTING_ITEMS = { 'poke-ball': 8 };

// Yakalama topları, güçlüden zayıfa (elde olan en iyisi kullanılır)
export const BALLS = SHOP_ITEMS
    .filter(item => item.catchRate)
    .sort((a, b) => b.catchRate - a.catchRate);

export function itemById(id) {
    return SHOP_ITEMS.find(item => item.id === id) || null;
}
