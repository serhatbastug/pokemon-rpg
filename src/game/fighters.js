// İki kişilik arenanın kadrosu.
//
// Eskiden burada PokeAPI'den çekilen Pokemonlar vardı; oyunun hikâyesi
// virüs salgınına döndüğü için hepsi kaldırıldı. Kadro artık oyunun kendi
// yaratıkları: elle çizilmiş, hikâyeden gelen virüsler (bkz. fighterArt.js).
//
// Dövüşme yetenekleri HENÜZ YOK: bu turda yalnızca karakterler kuruldu,
// güçler sonra yazılacak.
//
// intro: bu dövüşçünün kendine ait giriş animasyonu (bkz. fighterIntro.js).

import { FIGHTER_SPRITES } from './fighterArt.js';

export const FIGHTERS = [
    {
        id: 'virus',
        name: 'VİRÜS',
        themeColor: '#6ea32c',
        stats: { hp: 120, speed: 4 },
        intro: 'virus',
        description: 'Salgının ayakta duran hâli. Taşıdığı insandan geriye bir hat bile ' +
            'kalmamış; kütle ne durur ne dinlenir, yalnızca yayılır. Ağır ve dayanıklı, ' +
            'ama yavaş.'
    },
    {
        id: 'antivirus',
        name: 'ANTİ-VİRÜS',
        themeColor: '#f2795c',
        stats: { hp: 100, speed: 5.5 },
        intro: 'antivirus',
        description: 'Yayılmayı kendi yayılmasıyla durduran şey. Taşıyıcısını yutmaz, ' +
            'ona tutunur: gövdenin yalnız bir yanını sarar, kalanını sağlam bırakır. ' +
            'Kadronun en hızlısı, en incesi.'
    },
    {
        id: 'electro',
        name: 'ELECTRO-VİRÜS',
        themeColor: '#ffd23f',
        stats: { hp: 115, speed: 5 },
        intro: 'electro',
        description: 'Yükü boşaltmadan duramayan taşıyıcı. Kabuğun altındaki damarlar ' +
            'hiç sönmez, durduğu yerde bile havayı çatırdatır. Cana da hıza da yakın ' +
            'duran, ortadaki dövüşçü.'
    },
    {
        id: 'ice',
        name: 'ICE-VİRÜS',
        themeColor: '#8fd4e8',
        // Can ve hız ortada: buz ne virüs kadar ağır ne anti kadar ince.
        // Dengesi statlarında değil hamlelerinde - kadronun en az hasar veren
        // dövüşçüsü, karşılığında rakibi yavaşlatıp donduran tek karakter
        // (bkz. abilities.js'teki CHILL).
        stats: { hp: 110, speed: 4.5 },
        intro: 'ice',
        description: 'Yayılmayı yavaşlatan değil DURDURAN sap. Taşıyıcısını yutmuyor, ' +
            'olduğu yerde donduruyor: gövde artık ne akar ne dinlenir, kristal kristal ' +
            'büyür. Dokunduğu her şeyin ısısını alır; en az vuran, en çok bekleten.'
    }
];

export function fighterById(id) {
    return FIGHTERS.find(f => f.id === id) || null;
}

// Kartlarda ve arenada aynı çizim kullanılıyor: kadroda gördüğün şey
// arenaya çıkan şeyin ta kendisi.
export function fighterSprite(id) {
    return FIGHTER_SPRITES[id]?.() || null;
}
