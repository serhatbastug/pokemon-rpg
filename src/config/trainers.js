// Haritada duran NPC antrenörler. Görüş alanına girince meydan okur ve
// ekibindeki Pokemonları sırayla sahaya sürer. Boss'tan önceki "ara sınav".
//
// party: sırayla çıkacak Pokemon numaraları (o mekanın türlerinden seçilir)
// sightRange: bu mesafeye girince savaş başlar
// reward: yenilince düşen ek jeton
export const TRAINERS = {
    'loc-1-1': [
        {
            id: 'kasif-emre',
            name: 'Kaşif Emre',
            col: 20, row: 4,
            party: [127, 217],
            sightRange: 150,
            reward: 30,
            taunt: 'Bu ormanı benden iyi bilen yok!',
            defeated: 'İyi savaştın, ormanın derinlikleri senin.'
        }
    ],
    'loc-1-2': [
        {
            id: 'golge-avcisi',
            name: 'Gölge Avcısı Deniz',
            col: 20, row: 15,
            party: [123, 553],
            sightRange: 160,
            reward: 40,
            taunt: 'Karanlıkta avlanmayı bilir misin?',
            defeated: 'Gölgeler seni kabul etti.'
        }
    ],
    'loc-1-3': [
        {
            id: 'tapinak-bekcisi',
            name: 'Tapınak Bekçisi Aslı',
            col: 23, row: 6,
            party: [130, 289, 635],
            sightRange: 170,
            reward: 60,
            taunt: 'Kadim ağaca ancak layık olan yaklaşır!',
            defeated: 'Geç bakalım, ağaç seni bekliyor.'
        }
    ]
};

export function trainersFor(mapId) {
    return TRAINERS[mapId] || [];
}
