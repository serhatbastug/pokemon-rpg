// Rozetler ve saha hamleleri.
// Bir mekanın bossunu yenmek o mekanın rozetini verir; her rozet bir saha
// hamlesi açar ve haritada daha önce geçilemeyen engelleri aşılır kılar.
// Böylece eski haritalar tekrar ziyaret edilmeye değer hâle gelir.

export const FIELD_MOVES = [
    {
        id: 'cut',
        name: 'Cut',
        badge: 'loc-1-1',            // Fısıltılı Orman Girişi (Golisopod)
        badgeName: 'Yaprak Rozeti',
        tile: 'h',                   // çalıları keser
        becomes: '.',
        color: '#4ade80',
        hint: 'Çalıyı kes (F)'
    },
    {
        id: 'rock-smash',
        name: 'Rock Smash',
        badge: 'loc-1-2',            // Gölgeli Derinlikler (Hawlucha)
        badgeName: 'Gölge Rozeti',
        tile: 'R',                   // kayaları kırar
        becomes: 's',
        color: '#94a3b8',
        hint: 'Kayayı kır (F)'
    },
    {
        id: 'surf',
        name: 'Surf',
        badge: 'loc-1-3',            // Kadim Ağaç Meydanı (Zarude, bölge bossu)
        badgeName: 'Kadim Rozet',
        tile: 'W',                   // suyun üstünden geçilir (pasif)
        passive: true,
        color: '#38bdf8',
        hint: 'Suyun üstünden geç'
    }
];

export function fieldMoveForTile(tile, badges) {
    return FIELD_MOVES.find(m => m.tile === tile && !m.passive && badges.includes(m.badge)) || null;
}

export function hasSurf(badges) {
    const surf = FIELD_MOVES.find(m => m.id === 'surf');
    return badges.includes(surf.badge);
}

export function unlockedMoves(badges) {
    return FIELD_MOVES.filter(m => badges.includes(m.badge));
}
