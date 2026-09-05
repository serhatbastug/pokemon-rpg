// Yapay zekâ: ikinci oyuncuyu klavye/kol yerine bu oynatıyor.
//
// TEK KURAL: AI ayrı bir yol açmıyor, TUŞA BASIYOR. Player.readInput'un
// klavyeden ürettiği tablonun aynısını üretiyor, gerisi bire bir aynı yoldan
// gidiyor - aynı bekleme süreleri, aynı blok penceresi, aynı fizik, aynı
// kombo tuşları. Doğrudan useAbility çağırsaydı AI oyuncunun oynayamadığı bir
// oyunu oynardı: beklemesiz saldırır, havada özel çıkarır, donmuşken hamle
// yapardı. Böyle olunca "AI hile yapıyor" diye bir şey mümkün değil.
//
// Karakterlere göre AYRI bir yazı yok: ne yapacağına abilities.js'teki VERİYE
// bakarak karar veriyor (hamlenin türü, menzili, beklemesi). Yeni bir dövüşçü
// eklendiğinde AI'yı da yazmak gerekmesin.

import { ABILITIES } from './abilities.js';

// Zorluk seviyeleri. Hepsi AYNI aklı kullanıyor; değişen şey ne kadar hızlı
// tepki verdiği, ne sıklıkla hata yaptığı ve elindeki araçların kaçını
// kullandığı. Zoru "daha çok hasar veren" yapmak kolay ama sahte olurdu -
// zorluk sayılardan değil oynayıştan gelmeli.
export const AI_LEVELS = {
    kolay: {
        label: 'KOLAY',
        react: 22,        // kaç karede bir yeni karar veriyor (tepki süresi)
        mistake: 0.38,    // kararın boşa gitme olasılığı
        block: 0.10,      // yaklaşan saldırıyı bloklama olasılığı
        combo: 0.10,      // hazır olan kombo/özeli kullanma olasılığı
        aggression: 0.45  // menzile girme ve saldırma isteği
    },
    normal: {
        label: 'NORMAL',
        react: 12,
        mistake: 0.16,
        block: 0.30,
        combo: 0.35,
        aggression: 0.75
    },
    zor: {
        label: 'ZOR',
        react: 6,
        mistake: 0.04,
        block: 0.58,
        combo: 0.60,
        aggression: 1
    }
};

export const DEFAULT_AI_LEVEL = 'normal';

export function aiLevel(key) {
    return AI_LEVELS[key] ? key : DEFAULT_AI_LEVEL;
}

// Basılı tutulmayan tuşlar KISA basılıyor: "yeni basıldı" ancak tuş bırakılıp
// yeniden basılınca doğuyor (bkz. Player.readInput). Sürekli basılı tutulan
// bir saldırı tuşu bir kez ateşler, sonra bekleme dolsa da bir daha ateşlemez.
const TAP_FRAMES = 3;

export class FighterAi {
    constructor(player, level = DEFAULT_AI_LEVEL) {
        this.player = player;
        this.levelKey = aiLevel(level);
        this.level = AI_LEVELS[this.levelKey];

        this.timer = 0;
        // Bir karar penceresi boyunca sürdürülen niyet
        this.plan = { move: 0, jump: false, block: false, crouch: false };
        // Kısa basılacak tuşlar: ad -> kalan kare
        this.taps = {};
    }

    get set() {
        return ABILITIES[this.player.fighter.id] || null;
    }

    ready(ability) {
        return !!ability && (this.player.cooldowns[ability.id] || 0) <= 0;
    }

    tap(name) {
        this.taps[name] = TAP_FRAMES;
    }

    // Bu dövüşçünün rahat ettiği mesafe. Yakın dövüşçü menzilinin biraz
    // içine girmek ister, menzilli uzakta durmak. Veriye bakıyor: karakter
    // adı geçmiyor, yeni dövüşçüde de çalışsın.
    preferredGap() {
        const basic = this.set?.basic;
        if (!basic) return 200;
        if (basic.kind === 'melee') return basic.reach * 0.42;
        if (basic.kind === 'beam') return 320;
        return 260;
    }

    // Rakip şu an bir saldırının içinde mi? Blok kararı buna bakıyor -
    // rastgele bloklayan AI, oyuncunun ritmini hiç okumamış olurdu.
    foeAttacking(foe) {
        if (foe.action) return true;
        if (!foe.anim) return false;
        const foeSet = ABILITIES[foe.fighter.id];
        return !!foeSet && [foeSet.basic, foeSet.special, foeSet.signature]
            .some(a => a && a.id === foe.anim.id);
    }

    // Karar penceresi: burada NİYET kuruluyor, tuşlar decide()'da basılıyor.
    think(foe) {
        const p = this.player;
        const lv = this.level;
        const set = this.set;
        if (!set) return;

        // Hata payı: karar boşa gidiyor, AI bir pencere boyunca oyalanıyor.
        // Kusursuz oynayan bir rakiple dövüşmek eğlenceli değil.
        if (Math.random() < lv.mistake) {
            this.plan = { move: Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1), jump: false, block: false, crouch: false };
            return;
        }

        const gap = foe.x - p.x;
        const dist = Math.abs(gap);
        const toward = Math.sign(gap) || 1;
        const want = this.preferredGap();
        const above = p.footY - foe.footY;      // + = rakip yukarıda

        const plan = { move: 0, jump: false, block: false, crouch: false };

        // --- Yer alma ---
        if (dist > want + 50) plan.move = toward;
        else if (dist < want - 70) plan.move = -toward;       // fazla yaklaştı
        else if (Math.random() < 0.3) plan.move = -toward;    // yerinde çakılı kalmasın

        // Rakip yukarıdaysa peşinden çık, aşağıdaysa basamaktan in
        if (above > 70 && dist < 260) plan.jump = true;
        else if (above < -70 && dist < 260) plan.crouch = true;

        // --- Blok ---
        // Yaklaşan saldırıyı bloklamak zorluğun asıl belirleyicisi: zor
        // seviyede oyuncu artık savurup geçemiyor.
        if (dist < 190 && this.foeAttacking(foe) && Math.random() < lv.block) {
            plan.block = true;
            this.plan = plan;
            return;
        }

        // --- Saldırı ---
        const basic = set.basic;
        const inRange = basic.kind === 'melee'
            ? dist < basic.reach * 0.8 && Math.abs(above) < 110
            : dist < 620 && Math.abs(above) < 130;

        if (inRange && this.ready(basic) && Math.random() < 0.35 + lv.aggression * 0.5) {
            this.tap('attack');
        }

        // Özel: hazırsa ve mesafe uygunsa. Bekleme süreleri uzun, o yüzden
        // "hazırsa hemen bas" demek yerine bir olasılık var - AI özelini hep
        // aynı anda çıkarırsa oyuncu ezberler.
        const special = set.special;
        if (this.ready(special) && Math.random() < lv.combo && dist < 700) {
            this.tap('special');
        }

        // Karakterin kendi hamlesi (L1+ÜÇGEN)
        const sig = set.signature;
        if (this.ready(sig) && Math.random() < lv.combo * 0.8) {
            this.tap('signature');
        }

        // Atılma: mesafe kapatmanın hızlı yolu. Yalnızca uzaktayken ve
        // ustalık arttıkça daha sık.
        if (dist > want + 160 && Math.random() < lv.combo * 0.5) {
            this.tap(toward > 0 ? 'dashRight' : 'dashLeft');
        }

        this.plan = plan;
    }

    // Player.readInput'un beklediği tablo. Her kare çağrılıyor.
    decide() {
        const p = this.player;
        const now = {
            jump: false, attack: false, special: false, block: false, combo: false,
            left: false, right: false, down: false,
            keyAttack: false, padSquare: false, padCircle: false, padTriangle: false
        };

        const foe = p.game.getEnemyOf(p);
        if (!foe || p.isDead || foe.isDead || p.game.isGameOver) return now;

        // Yakalandık: kurtulmak için saldırı tuşuna basıp bırakmak gerekiyor.
        // Oyuncuya ne söyleniyorsa AI da onu yapıyor.
        if (p.grabbedBy) {
            now.attack = p.game.frame % 4 < 2;
            return now;
        }

        // Donmuşken düşünmenin anlamı yok; sayaç da işlemesin ki çözülünce
        // hemen bir karar versin.
        if (p.frozenFrames > 0) return now;

        if (--this.timer <= 0) {
            this.think(foe);
            this.timer = this.level.react;
        }

        const plan = this.plan;
        if (plan.move < 0) now.left = true;
        if (plan.move > 0) now.right = true;
        if (plan.jump) now.jump = true;
        if (plan.block) now.block = true;
        if (plan.crouch) now.down = true;

        // Kısa basışlar
        for (const name of Object.keys(this.taps)) {
            if (this.taps[name] <= 0) continue;
            this.taps[name]--;
            switch (name) {
                case 'attack':
                    now.attack = true;
                    now.keyAttack = true;
                    break;
                case 'special':
                    now.special = true;
                    break;
                // Kombolar: kombo tuşu BASILI tutulurken yön/saldırı tuşuna
                // basılıyor - oyuncunun L1 ile yaptığının aynısı.
                case 'signature':
                    now.combo = true;
                    now.keyAttack = true;
                    now.padTriangle = true;
                    break;
                case 'dashLeft':
                    now.combo = true;
                    now.left = true;
                    now.padSquare = true;
                    break;
                case 'dashRight':
                    now.combo = true;
                    now.right = true;
                    now.padCircle = true;
                    break;
                case 'dashUp':
                    now.combo = true;
                    now.jump = true;
                    break;
            }
        }

        // Kombo tuşu basılıyken yürüme yönü kombo okunuyor: aynı karede hem
        // atılma hem yürüme isteği varsa atılma kazanır.
        if (now.combo) {
            now.block = false;
            now.special = false;
        }
        return now;
    }
}
