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
// Yetenek tuşları KALDIRILDI: virüslerin güçleri henüz yazılmadı, arenada
// şimdilik yalnızca hareket ve zıplama var.
export const PLAYERS = {
    1: {
        color: '#3b82f6',
        start: { x: 220, y: 380 },
        moveKeys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
        keyLabel: 'W A S D',
        padSlot: 0
    },
    2: {
        color: '#ef4444',
        start: { x: 780, y: 380 },
        moveKeys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
        keyLabel: '← ↑ → ↓',
        padSlot: 1
    }
};

// Arenada kol düzeni: sol analog / D-pad yürütür, ÇARPI zıplatır.
export const PAD_JUMP_BUTTON = 'cross';
export const PAD_CONTROL_LABEL = 'Sol analog · ÇARPI';

// Savaş sırasında tarayıcı kaydırmasını engellenecek tuşlar
export const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
