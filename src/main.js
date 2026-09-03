// Uygulama giriş noktası: modülleri kurar ve birbirine bağlar.
//
// Oyunun iki parçası var: ana menü sahnesinden açılan PROLOG (çizgi roman)
// ve sağdaki portaldan açılan İKİ KİŞİLİK ARENA. Eski Pokemon macera modu
// (ana harita, yakalama, dükkan, kütüphane) tamamen kaldırıldı.
import { InputManager } from './core/input.js';
import { GamepadManager } from './core/gamepad.js';
import { CharacterSelect } from './ui/characterSelect.js';
import { Hud } from './ui/hud.js';
import { PadMenu } from './ui/padMenu.js';
import { showBattleScreen, showGameOver, hideGameOver, showSelectionScreen, showMenuScreen, showComicScreen } from './ui/screens.js';
import { Game } from './game/Game.js';
import { MenuScene } from './menu/MenuScene.js';
import { StartPrompt } from './ui/startPrompt.js';
import { ComicScene } from './comic/ComicScene.js';
import { INTRO_FRAMES, ANTIVIRUS_INTRO_FRAMES, VIRUS_INTRO_FRAMES } from './game/fighterIntro.js';
import { FIGHTERS } from './game/fighters.js';
import { ABILITIES } from './game/abilities.js';

const characterSelect = new CharacterSelect();
const hud = new Hud();
const input = new InputManager();

// Oyun kolu (PS5 DualSense). Menüde ve prologda tek kol oynatır; iki kişilik
// arenada her oyuncu kendi kolunu kullanır (bkz. core/gamepad.js yuvaları).
const gamepad = new GamepadManager();

// Karakter seçimi ve "SAVAŞ BİTTİ" penceresi kolla da kullanılabilsin: bu iki
// ekranda çizen bir sahne olmadığı için kolu tarayan da yok, PadMenu kendi
// küçük döngüsünü açıyor. Tuşlar gerçek düğmelere basıyor - fareyle aynı yol.
const padMenu = new PadMenu({
    gamepad,
    characterSelect,
    onStart: () => document.getElementById('start-battle-btn').click(),
    onBack: () => returnToMenu(),
    onRestart: () => document.getElementById('restart-btn').click()
});

const game = new Game({
    canvas: document.getElementById('battleCanvas'),
    input,
    gamepad,
    hud,
    onGameOver: (winnerNum, winner) => {
        showGameOver(`Oyuncu ${winnerNum} (${winner.fighter.name}) Kazandı!`);
        // Savaş döngüsü durdu; kolu artık PadMenu tarıyor (ÇARPI = yeniden oyna)
        padMenu.start('gameover');
    }
});

function returnToMenu() {
    padMenu.stop();
    showMenuScreen();
    menu.start();
}

// PROLOG: çizgi roman. Oyunun oynanan kısmı ormana girişte başlıyor; ondan
// öncesi (laboratuvar, yayılma yolu, kuşatma, ormanın ağzı) kare kare
// anlatılıyor. Prolog bitince şimdilik ana menüye dönülüyor - ormanın
// kendisi sıradaki iş.
const comic = new ComicScene({
    canvas: document.getElementById('comicCanvas'),
    input,
    gamepad,
    onExit: () => {
        comic.stop();
        showMenuScreen();
        menu.start();
    },
    onFinish: () => {
        comic.stop();
        showMenuScreen();
        menu.start();
    }
});

const startPrompt = new StartPrompt({
    // EVET: ekran yavaşça kararır, sonra prolog çizgi romanı başlar
    onConfirm: () => menu.beginExit(() => {
        menu.stop();
        showComicScreen();
        comic.start();
    }),
    onCancel: () => menu.setPaused(false)
});

// Kol: pencere açıkken Çarpı onaylar, Daire kapatır
gamepad.onButtonDown(button => {
    if (!startPrompt.open) return;
    if (button === 'cross') startPrompt.confirm();
    else if (button === 'circle') startPrompt.cancel();
});

// --- Ana menü sahnesi ---
// Menü bir düğme listesi değil, antrenörün gezdiği bir sahne: ortadaki
// macera kapısı F ile açılır, sağdaki portal iki kişilik moda çıkar.
const menu = new MenuScene({
    canvas: document.getElementById('menuCanvas'),
    input,
    gamepad,
    // Macera kapısının önünde F / ÜÇGEN: sahne donar, onay penceresi açılır
    onAdventureGate: () => {
        menu.setPaused(true);
        startPrompt.show();
    },
    // İki kişilik portaldan geçildi: ekran karardı, sıra karakter seçiminde
    onVersusPortal: () => {
        menu.stop();
        showSelectionScreen();
        padMenu.start('selection');
    }
});

showMenuScreen();
menu.start();

document.getElementById('selection-back-btn').addEventListener('click', returnToMenu);

// Otomatik UI testleri (tests/ui.test.mjs) oyun durumunu buradan okur
window.__game = game;
window.__menu = menu;
window.__comic = comic;
window.__gamepad = gamepad;
window.__padMenu = padMenu;
window.__characterSelect = characterSelect;
// Giriş animasyonunun süresi: tools/intro-shots.mjs kareyi buradan sarıyor
window.__introInfo = { INTRO_FRAMES, ANTIVIRUS_INTRO_FRAMES, VIRUS_INTRO_FRAMES };
window.__fighters = { FIGHTERS };
window.__abilities = { ABILITIES };

document.getElementById('start-battle-btn').addEventListener('click', () => {
    const { p1, p2 } = characterSelect.getSelection();
    if (!p1 || !p2) {
        const hint = document.getElementById('mode-hint');
        if (hint) hint.textContent = 'Önce aşağıdan iki karakter seçin (P1 ve P2).';
        return;
    }

    padMenu.stop();   // taramayı savaş döngüsü devralıyor
    showBattleScreen();
    game.start(p1, p2);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    hideGameOver();
    padMenu.stop();
    const { p1, p2 } = characterSelect.getSelection();
    game.start(p1, p2);
});
