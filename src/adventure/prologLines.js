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
    { speaker: 'biz', text: 'Duydun mu, yeni bir virüs çıkmış.' }
];

// Arkadaş kapıdan içeri girerken
export const HOME_HEARD = [
    { speaker: 'arkadas', text: 'V-986 virüsünü mü diyorsun? Evet, duydum onu.' }
];

export const HOME_DESC = [
    { speaker: 'arkadas', text: 'Çok hızlı yayılıyormuş, aşısı da yokmuş.' }
];

export const HOME_WARN = [
    { speaker: 'arkadas', text: 'Belirtisi olmaması kötü yanı, ama önemli olabilir diye konuşuluyor.' }
];

// Bizimkinin önerisi
export const HOME_PROPOSE = [
    { speaker: 'biz', text: 'Bence işimiz gereği bu virüs üzerine biraz çalışmalıyız.' },
    { speaker: 'biz', text: 'İleride bir belirti ortaya çıkarsa insanları uyarabilmeliyiz.' }
];

export const HOME_AGREE = [
    { speaker: 'arkadas', text: 'Katılıyorum.' }
];

// Balon burada BİLEREK kesiliyor - kullanıcının işaret ettiği nokta
export const HOME_SUBJECT = [
    { speaker: 'arkadas', text: 'Fakat önce bir denek bulmalıyız.' }
];

export const HOME_REWARD = [
    { speaker: 'arkadas', text: 'İnsanları ikna etmek için iş bitince bir de para ödülü koyabiliriz.' }
];

export const HOME_CLOSE = [
    { speaker: 'biz', text: 'Peki, o zaman sen bir denek bul.' },
    { speaker: 'biz', text: 'Ben de bu virüs hakkında edinebileceğim bilgileri toplayayım.' }
];

// --- Prolog 5: kuşatma ---

// Virüslüler tel örgüye dayandığı an
export const SIEGE_SPOTTED = [
    { speaker: 'arkadas', text: 'Şuraya bakın, olamaz burayı da bulmuşlar.' }
];

// Bizim planımız
export const SIEGE_PLAN = [
    { speaker: 'biz', text: 'Bu beyinleri erimiş virüsler için iyi bir süre,' },
    { speaker: 'biz', text: 'herneyse acil kaçış planı için hemen ormana kaçalım, orada daha yavaş olduklarını gördük.' },
    { speaker: 'biz', text: 'Hem bizim ormanda olduğumuzu anlamaları uzun sürer.' }
];

// Sağlıklılardan biri onaylıyor
export const SIEGE_AGREE = [
    { speaker: 'saglikli-0', text: 'Tamamdır hemen gidelim, ulaştığımız verilere göre herhangi bir delikli koruma onlar için engel değil, deliklerden geçebiliyorlar.' }
];

// Biz geçerken arkadaşımız geri dönüyor. Cümle KAPI KAPANINCA KESİLİYOR -
// son balon bilerek yarım.
export const SIEGE_CALL = [
    { speaker: 'biz', text: 'Haydi gel.' },
    { speaker: 'biz', text: 'HEY nereye gidiyors-' }
];

// --- Kanalizasyon (prolog 5 ile 6 arasında) ---

// Rögardan indik, koşu başlıyor
export const SEWER_START = [
    { speaker: 'saglikli-2', text: 'Bu tünel şehrin kenarına çıkıyor, sakın durmayın!' }
];

// Koşu sürerken
export const SEWER_RUN = [
    { speaker: 'biz', text: 'Arkamızdalar. Önünüze bakın ve koşun.' }
];

// Çıkış bacası göründüğünde
export const SEWER_EXIT = [
    { speaker: 'saglikli-1', text: 'Merdiven şurada, yukarı çıkıyoruz.' }
];

// --- Prolog 6: şehrin kenarı ---

// Rögar kapağından çıkınca
export const CITY_HOPE = [
    { speaker: 'biz', text: 'Umarım o iyidir.' }
];

// Kuşatmada konuşandan BAŞKASI cevap veriyor
export const CITY_DOUBT = [
    { speaker: 'saglikli-1', text: 'Umarım öyledir fakat ben öyle olduğunu zannetmiyorum,' },
    { speaker: 'saglikli-1', text: 'sonuçta virüslerin arasında tek sağlıklı.' }
];

export const CITY_ONWARD = [
    { speaker: 'biz', text: 'Eh, orası doğru. En iyisi şimdi önümüze bakmak,' },
    { speaker: 'biz', text: 'ORMANA.' }
];

// Ormanın ağzında hepsi duruyor
export const FOREST_STOPPED = [
    { speaker: 'biz', text: 'Hey, neden durdunuz?' }
];

// Hepsini vurduktan sonra
export const FOREST_AFTER = [
    { speaker: 'biz', text: 'İşte bu gerçekten zordu...' }
];
