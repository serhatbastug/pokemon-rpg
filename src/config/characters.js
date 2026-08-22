// Macera modu başlangıç Pokemonu: Bulbasaur (#1).
// İki kişilik moddaki Şövalye (#2 Ivysaur) bunun evrimleşmiş halidir;
// ileride eklenecek evrim mekaniği bu zinciri kullanacak.
export const ADVENTURE_STARTER = { id: 1, className: 'Başlangıç' };

// Tüccar Pokemon: Kecleon (#352) - Pokemon Mystery Dungeon serisinin resmi
// dükkan sahibi. Her bölgenin merkezinde (mekan portallarının olduğu haritada)
// satış yeri bulunur. Alışveriş mekanikleri sonraki güncellemelerde gelecek.
export const MERCHANT = { id: 352, className: 'Tüccar' };

// Macera modunda Bulbasaur'un harita yetenekleri (hepsi resmi hamleleri).
// type, projectileSprites.js'teki sprite anahtarıdır; 'sleep' alan etkisidir.
export const STARTER_ABILITIES = [
    { key: 'K', name: 'Razor Leaf', type: 'leaf', cooldown: 30, damage: 10, speed: 9, life: 55 },
    { key: 'O', name: 'Seed Bomb', type: 'seedbomb', cooldown: 120, damage: 25, speed: 7, life: 65 },
    { key: 'Ş', name: 'Sleep Powder', type: 'sleep', cooldown: 420, radius: 150, stun: 150 }
];

// Karakter sınıfları ve karşılık gelen Pokemon ID'leri.
// Yeni bir sınıf eklemek için buraya bir kayıt ekleyin ve
// src/game/abilities.js içinde yeteneklerini tanımlayın.
export const CHARACTER_CLASSES = [
    { id: 2, className: 'Şövalye', themeColor: 'var(--color-knight)', baseStats: { hp: 120, attack: 75, defense: 90, speed: 4 }, description: 'Ön saflarda savaşan, keskin yaprakları, tohum bombaları ve güneş ışınıyla rakibini ezen bitki ustası.' },
    { id: 6, className: 'Büyücü', themeColor: 'var(--color-mage)', baseStats: { hp: 95, attack: 95, defense: 60, speed: 4.5 }, description: 'Yıkıcı alev büyüleriyle rakiplerini küle çeviren güçlü büyü ustası.' },
    { id: 94, className: 'Suikastçı', themeColor: 'var(--color-assassin)', baseStats: { hp: 90, attack: 110, defense: 50, speed: 6 }, description: 'Gölgelerden saldıran, zehirli ve illüzyon yeteneklerine sahip ölümcül savaşçı.' },
    { id: 123, className: 'Okçu', themeColor: 'var(--color-archer)', baseStats: { hp: 90, attack: 95, defense: 65, speed: 5.5 }, description: 'Kollarıyla havayı keserek çok hızlı giden ve rakibi delen rüzgar bıçakları fırlatır.' },
    { id: 145, className: 'Elementalist', themeColor: 'var(--color-elementalist)', baseStats: { hp: 100, attack: 85, defense: 75, speed: 5 }, description: 'Yıldırımların ve doğanın gücünü kontrol eden kadim elementalist.' },
    { id: 42, className: 'Vampir', themeColor: 'var(--color-vampire)', baseStats: { hp: 90, attack: 80, defense: 70, speed: 5 }, description: 'Rakiplerinin canını sömürerek hayatta kalan, gecenin karanlık yaratığı.' },
    { id: 649, className: 'Mecha', themeColor: 'var(--color-mecha)', baseStats: { hp: 110, attack: 100, defense: 95, speed: 3.5 }, description: 'Sinyal ışınları, rakibi takip eden manyetik bombaları ve lazer topuyla donatılmış çelik savaş makinesi.' },
    { id: 291, className: 'Ninja', themeColor: 'var(--color-ninja)', baseStats: { hp: 85, attack: 90, defense: 45, speed: 6.5 }, description: 'İnanılmaz hızıyla gözle görülmesi imkansız, keskin X-makas kesikleri ustası.' },
    { id: 144, className: 'Buz Şövalyesi', themeColor: 'var(--color-ice-knight)', baseStats: { hp: 105, attack: 85, defense: 80, speed: 4.5 }, description: 'Rakiplerini donduran buz kristalleri ve dondurucu zırhıyla yenilmez şövalye.' }
];
