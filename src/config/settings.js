// Oyun geneli sabitler: fizik, oyuncu başlangıç ayarları ve tuş atamaları.

export const FRAME_RATE = 60;

export const PHYSICS = {
    gravity: 0.6,
    jumpVelocity: -13,
    groundOffset: 15 // karakterin zeminden yüksekliği
};

// Oyuncu numarasına göre renk, başlangıç konumu ve kontroller.
// padSlot: bu oyuncunun kolu (0 = takılan ilk kol, 1 = ikinci kol). Kol yoksa
//   oyuncu klavyede kalır; ikisi de her zaman çalışır.
// keyLabel: HUD'da yazan klavye düzeni
//
// actionKeys: dövüş tuşları. Klavyede iki oyuncu var, bu yüzden 1. oyuncunun
//   tuşları sol elin, 2. oyuncununkiler sağ elin altında.
//   combo: kolun L1'inin klavye karşılığı. L1 gibi BASILI TUTULUR, tek başına
//   bir şey yapmaz; yön tuşuyla atılma, saldırı tuşuyla karakterin kendi
//   hamlesi çıkar (bkz. game/abilities.js).
export const PLAYERS = {
    1: {
        color: '#3b82f6',
        start: { x: 220, y: 380 },
        moveKeys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
        actionKeys: { attack: 'KeyF', special: 'KeyG', block: 'KeyV', combo: 'ShiftLeft' },
        keyLabel: 'W A S D · F G V',
        padSlot: 0
    },
    2: {
        color: '#ef4444',
        start: { x: 780, y: 380 },
        moveKeys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
        actionKeys: { attack: 'Comma', special: 'Period', block: 'Slash', combo: 'ShiftRight' },
        keyLabel: '← ↑ → ↓ · , . /',
        padSlot: 1
    }
};

// Arenada kol düzeni. L1 tek başına bir şey yapmaz: basılı tutulunca diğer
// tuşlar kombo hâline geçer (L1+ÇARPI yukarı atılma, L1+DAİRE sağa,
// L1+KARE sola, L1+ÜÇGEN karakterin kendi hamlesi).
export const PAD_JUMP_BUTTON = 'cross';
export const PAD_ATTACK_BUTTON = 'square';
export const PAD_SPECIAL_BUTTON = 'circle';
export const PAD_BLOCK_BUTTON = 'r1';
export const PAD_COMBO_BUTTON = 'l1';
export const PAD_CONTROL_LABEL = 'Sol analog · KARE DAİRE R1 · L1';

// Dövüşün zamanlaması. Hepsi KARE cinsinden (60 kare = 1 saniye); saniye
// yazmak kolay okunur ama motor sabit adımla koştuğu için kare tek doğru
// birim - saniyeye çevirmek her karşılaştırmada yuvarlama hatası demek.
export const COMBAT = {
    // Blok BASILI TUTULMAZ: tek basış kısa bir kalkan penceresi açar, sonra
    // beklemeye girer. Bekleme süresi konduğu an blok "güvenli duruş" olmaktan
    // çıkıp zamanlamaya dönüşüyor - erken basan iki saniye açıkta kalır.
    blockWindow: 30,
    blockCooldown: 120,
    // Temel saldırılar bloğa tamamen takılır, özeller yarısını geçirir; yoksa
    // özellerin uzun bekleme süresi anlamsız kalırdı.
    blockLeak: 0.5,
    blockKnockback: 26,

    // Vurulunca yanıp sönme ve kısa dokunulmazlık: aynı saldırı bir vuruşta
    // iki kez saymasın.
    hitFlash: 20,
    hitInvuln: 18,

    // 3 rauntluk maç: 2 raundu alan kazanır, üçüncüye gerek kalmayabilir.
    roundsToWin: 2,
    maxRounds: 3,
    // Süre sınırı blok yüzünden şart: iki oyuncu da bekleyip birbirine hiç
    // yaklaşmayabilir. Süre biterse canı fazla olan raundu alır.
    roundFrames: 60 * FRAME_RATE,
    // Raunt arası: "RAUNT 2" yazısı ve oyuncuların yerine dönmesi
    intermissionFrames: 150,
    roundStartFreeze: 60
};

// Savaş sırasında tarayıcı kaydırmasını engellenecek tuşlar
export const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
