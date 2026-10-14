// Prologun konuşmaları.
//
// Metin tek yerde duruyor ki sahneler arasında ton kaysın istemeyelim ve
// yazım düzeltmesi tek dosyada yapılabilsin. Konuşan kimlikleri
// dialogue.js'teki VOICE_PITCH ile eşleşiyor.
//
// Balon kesmeleri (aynı kişinin arka arkaya iki balonu) bilerek: uzun cümle
// tek balonda okunmuyor.

// --- Prolog 1: laboratuvar ---
//
// Bölümün tek konuşanı profesör ve kendi kendine konuşuyor. Adı, unvanı,
// yüzü yok; yalnızca sesi ve bileğindeki turuncu saat var.

// Karışım bitince, kağıda son bir kez bakarken
export const LAB_RECIPE = [
    { speaker: 'profesor', text: 'İşte, tarifteki ile aynı yaptım. Umarım bu işe yarar.' }
];

// Koldaki turuncu saate bakarken
export const LAB_LATE = [
    { speaker: 'profesor', text: 'Saat oldukça geç olmuş.' },
    { speaker: 'profesor', text: 'Bugünlük bu kadar yeter, testleri daha sonra yaparım.' }
];

// --- Prolog 3: sağlık ocağı ---
//
// Doktor ve hasta. Doktorun bildiği her şey burada söyleniyor - virüsün
// gerçek kaynağını KENDİSİ de bilmiyor, "araştırılıyor" dışında bir şey
// söylemiyor.

// Ekrandaki tahlile bakarken
export const CLINIC_RESULT = [
    { speaker: 'doktor', text: 'Tahlillerinde bir şey çıktı.' },
    { speaker: 'doktor', text: 'V-986 isimli yeni bir virüs.' }
];

// Doktor ekrandaki grafiği gösteriyor
export const CLINIC_DETAILS = [
    { speaker: 'doktor', text: 'Çok hızlı yayılıyor ve şu ana kadar aşısı yok.' },
    { speaker: 'doktor', text: 'En kötüsü de hiçbir belirti vermiyor.' }
];

// Hasta doğal olarak soruyor
export const CLINIC_ORIGIN_Q = [
    { speaker: 'hasta', text: 'Nereden çıktı bu? Bana nasıl bulaştı?' }
];

export const CLINIC_ORIGIN_A = [
    { speaker: 'doktor', text: 'Henüz bilinmiyor. Hala araştırılıyor.' }
];

export const CLINIC_LOOK_Q = [
    { speaker: 'hasta', text: 'Peki neye benziyor?' }
];

// Doktor çıktıyı uzatırken
export const CLINIC_LOOK_A = [
    { speaker: 'doktor', text: 'Bir kameradan bu görüntü çıkmış.' }
];

// --- Prolog 4: ev ---
//
// Bizimki evde gazete okurken arkadaşı (= profesör, asla söylenmez) içeri
// giriyor. Uzun bir sohbet - birden fazla balona bölünüyor, aralarda
// düşünmesi/okunması için havada kalıyor.

// Bizimki gazeteyi indirip soruyor
export const HOME_ASK = [
    { speaker: 'biz', text: 'Fred, V-986 diye yeni bir virüs çıkmış, duydun mu?' }
];

// Arkadaş kapıdan içeri girerken
export const HOME_HEARD = [
    { speaker: 'arkadas', text: 'Duydum Harry. Çok hızlı yayılıyormuş, aşısı da yokmuş.' }
];

export const HOME_DESC = [
    { speaker: 'arkadas', text: 'En kötüsü belirtisi olmaması. Ortaya çıktığında çok geç olabilir.' }
];

export const HOME_WARN = [
    { speaker: 'arkadas', text: 'Bence insanları karantinaya girmeye çağırmalıyız, Harry.' }
];

// Bizimkinin önerisi
export const HOME_PROPOSE = [
    { speaker: 'biz', text: 'Haklısın Fred. Belirti çıkmadan herkesi uyarmalıyız.' },
    { speaker: 'biz', text: 'Hemen duyuruyu yapalım.' }
];

export const HOME_AGREE = [
    { speaker: 'arkadas', text: 'Duyurduk ama kimse dinlemiyor Harry. Karantinaya girmek istemiyorlar.' }
];

export const HOME_CLOSE = [
    { speaker: 'biz', text: 'O zaman virüsü daha yakından tanımamız lazım, Fred.' },
    { speaker: 'biz', text: 'Ben bilgi toplamaya başlıyorum.' }
];
