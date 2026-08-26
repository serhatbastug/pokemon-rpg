// Oyuncu şu an neyle oynuyor? Ekrandaki kontrol ipuçları buna bakıp KARE mi
// SPACE mi göstereceğine karar veriyor: yanlış simge gösteren bir öğretme
// hiç göstermemekten kötü.
//
// Cihaz "son girdi kazanır" mantığıyla seçiliyor - kol takılı dursa bile
// klavyeye basan biri klavye ipucu görür.

let current = 'keyboard';

export function setDevice(kind) {
    if (kind === 'keyboard' || kind === 'gamepad') current = kind;
}

export function lastDevice() {
    return current;
}
