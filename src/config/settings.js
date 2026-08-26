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
// padSlot: bu oyuncunun kolu (0 = takılan ilk kol, 1 = ikinci kol). Kol yoksa
//   oyuncu klavyede kalır; ikisi de her zaman çalışır.
// keyLabels: HUD'daki tuş kapaklarında yazan şey
export const PLAYERS = {
    1: {
        color: '#3b82f6',
        start: { x: 150, y: 430 },
        moveKeys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
        abilityKeys: { KeyF: 0, ShiftLeft: 1, Space: 2 },
        keyLabels: ['F', 'Shift', 'Space'],
        padSlot: 0
    },
    2: {
        color: '#ef4444',
        start: { x: 850, y: 430 },
        moveKeys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
        abilityKeys: { ShiftRight: 0, Comma: 1, Enter: 2 },
        keyLabels: ['Shift', ',', 'Enter'],
        padSlot: 1
    }
};

// Arenada kol düzeni - her iki oyuncu için aynı, çünkü herkesin kendi kolu var:
//   KARE = 1. güç   L1 = 2. güç   R1 = 3. güç (ulti)
//   ÇARPI = zıpla   sol analog / D-pad = hareket
// Güçler başparmak tuşlarına değil omuz tuşlarına verildi: zıplarken (ÇARPI)
// aynı anda güç basmak gerekiyor, ikisi de sağ başparmakta olsa çakışırdı.
export const PAD_ABILITY_BUTTONS = { square: 0, l1: 1, r1: 2 };
export const PAD_JUMP_BUTTON = 'cross';

// HUD'da tuş kapağı yerine gösterilen kol simgeleri (yetenek sırasına göre).
// KARE'nin rengi prologdaki piksel kol simgesiyle aynı (pixel/controlHint.js) -
// aynı tuş oyunun iki yerinde farklı renkte görünmesin.
export const PAD_ABILITY_LABELS = ['□', 'L1', 'R1'];
export const PAD_ABILITY_COLORS = ['#f0a8de', '#cbd5e1', '#cbd5e1'];

// Savaş sırasında tarayıcı kaydırmasını engellenecek tuşlar
export const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
