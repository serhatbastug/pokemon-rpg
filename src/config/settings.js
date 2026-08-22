// Oyun geneli sabitler: fizik, oyuncu başlangıç ayarları ve tuş atamaları.

export const FRAME_RATE = 60;

export const PLAYER_SIZE = { width: 110, height: 110 };

export const PHYSICS = {
    gravity: 0.6,
    jumpVelocity: -13,
    groundOffset: 15 // karakterin zeminden yüksekliği
};

// Oyuncu numarasına göre renk, başlangıç konumu ve kontroller.
// abilityKeys: KeyboardEvent.code -> yetenek indeksi (0, 1, 2)
export const PLAYERS = {
    1: {
        color: '#3b82f6',
        start: { x: 150, y: 430 },
        moveKeys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
        abilityKeys: { KeyF: 0, ShiftLeft: 1, Space: 2 }
    },
    2: {
        color: '#ef4444',
        start: { x: 850, y: 430 },
        moveKeys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
        abilityKeys: { ShiftRight: 0, Comma: 1, Enter: 2 }
    }
};

// Savaş sırasında tarayıcı kaydırmasını engellenecek tuşlar
export const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
