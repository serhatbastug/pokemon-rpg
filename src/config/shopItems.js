// Kecleon'un dükkanında satılan eşyalar. Para birimi yetenek jetonudur:
// jetonu ya Pokemon seviyesine yatırırsınız ya da buraya harcarsınız.
export const SHOP_ITEMS = [
    {
        id: 'poke-ball',
        name: 'Poke Ball',
        price: 4,
        stack: 5,               // bir alışta kaç adet gelir
        color: '#dc2626',
        description: 'Bayılmış yabani Pokemonları yakalamak için gerekir.'
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

export function itemById(id) {
    return SHOP_ITEMS.find(item => item.id === id) || null;
}
