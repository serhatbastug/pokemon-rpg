// Uygulama giriş noktası: modülleri kurar ve birbirine bağlar.
import { CHARACTER_CLASSES } from './config/characters.js';
import { loadCharacters } from './services/pokeapi.js';
import { Progress } from './world/Progress.js';
import { Library } from './ui/library.js';
import { Shop } from './ui/shop.js';
import { InputManager } from './core/input.js';
import { GamepadManager } from './core/gamepad.js';
import { CharacterSelect } from './ui/characterSelect.js';
import { Hud } from './ui/hud.js';
import { showBattleScreen, showGameOver, hideGameOver, showOverworldScreen, showSelectionScreen, showMenuScreen, showAdventureScreen, showSiegeScreen } from './ui/screens.js';
import { Game } from './game/Game.js';
import { Overworld } from './world/Overworld.js';
import { MenuScene } from './menu/MenuScene.js';
import { StartPrompt } from './ui/startPrompt.js';
import { AdventureScene } from './adventure/AdventureScene.js';
import { SiegeScene } from './adventure/SiegeScene.js';

const characterSelect = new CharacterSelect();
const hud = new Hud();
const input = new InputManager();

const game = new Game({
    canvas: document.getElementById('battleCanvas'),
    input,
    hud,
    onGameOver: (winnerNum, winner) => {
        showGameOver(`Oyuncu ${winnerNum} (${winner.char.className}) Kazandı!`);
    }
});

// Macera modu ilerlemesi (seviye, deneyim, yakalananlar) localStorage'da tutulur
const progress = new Progress();

const overworld = new Overworld({
    canvas: document.getElementById('worldCanvas'),
    input,
    progress,
    onExit: () => returnToMenu(),
    onOpenShop: () => shop.toggle(),
    onMerchantLoaded: (name) => shop.setMerchantName(name)
});

// Kecleon'un dükkanı: tezgahın önünde F ile açılır
const shop = new Shop({
    progress,
    onUseItem: (id) => overworld.useItem(id)
});

// Kütüphane: jetonları harcayıp Pokemon seviyesi yükseltme ve ekip düzenleme
const library = new Library({
    progress,
    onLevelUp: (index) => overworld.onMemberLeveled(index),
    onPartyChange: () => overworld.loadParty()
});

// E tuşu kütüphaneyi açar/kapatır (macera modundayken)
input.onKeyDown(e => {
    if (e.code === 'KeyE' && overworld.running) library.toggle();
});

// --- Ana menü sahnesi ---
// Menü artık bir düğme listesi değil, antrenörün gezdiği bir sahne:
// ortadaki macera kapısı F ile açılır, sağdaki portal iki kişilik moda çıkar.

// Oyun kolu (PS5 DualSense): sol analog yürütür, ÜÇGEN = F.
// Kolun durumu MenuScene döngüsünde her karede taranır.
const gamepad = new GamepadManager();

// Eski overworld (ana harita). Menüden erişilmiyor - macera modu sıfırdan
// kuruluyor - ama motor duruyor ve UI testleri buradan giriyor.
async function enterOverworld() {
    menu.stop();
    showOverworldScreen();
    await overworld.start();
}

function returnToMenu() {
    overworld.stop();
    showMenuScreen();
    menu.start();
}

const adventure = new AdventureScene({
    canvas: document.getElementById('adventureCanvas'),
    input,
    gamepad,
    onExit: () => {
        adventure.stop();
        showMenuScreen();
        menu.start();
    }
});

// Prolog 3: kuşatılan çalışma alanı. Sahnenin sonunda rögardan aşağı inilir.
// Kanalizasyon bölümü henüz yazılmadı; şimdilik doğrudan şehir sahnesine
// (prologun 4. bölümü) bağlanıyor - hikâyede zaten oradan çıkılıyor.
const siege = new SiegeScene({
    canvas: document.getElementById('siegeCanvas'),
    input,
    gamepad,
    onExit: () => {
        siege.stop();
        showMenuScreen();
        menu.start();
    },
    onFinish: () => {
        siege.stop();
        showAdventureScreen();
        adventure.start();
    }
});

const startPrompt = new StartPrompt({
    // EVET: ekran yavaşça kararır, sonra prologun 3. bölümü açılır
    onConfirm: () => menu.beginExit(() => {
        menu.stop();
        showSiegeScreen();
        siege.start();
    }),
    onCancel: () => menu.setPaused(false)
});

// Kol: pencere açıkken Çarpı onaylar, Daire kapatır
gamepad.onButtonDown(button => {
    if (!startPrompt.open) return;
    if (button === 'cross') startPrompt.confirm();
    else if (button === 'circle') startPrompt.cancel();
});

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
    }
});

showMenuScreen();
menu.start();

document.getElementById('selection-back-btn').addEventListener('click', returnToMenu);
document.getElementById('overworld-back-btn').addEventListener('click', returnToMenu);

// Otomatik UI testleri (tests/ui.test.mjs) oyun durumunu buradan okur
window.__overworld = overworld;
window.__game = game;
window.__library = library;
window.__shop = shop;
window.__progress = progress;
window.__menu = menu;
window.__gamepad = gamepad;
window.__adventure = adventure;
window.__siege = siege;
window.__enterOverworld = enterOverworld;

document.getElementById('start-battle-btn').addEventListener('click', () => {
    const { p1, p2 } = characterSelect.getSelection();
    if (!p1 || !p2) {
        const hint = document.getElementById('mode-hint');
        if (hint) hint.textContent = 'Önce aşağıdan iki karakter seçin (P1 ve P2).';
        return;
    }

    showBattleScreen();
    game.start(p1, p2);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    hideGameOver();
    const { p1, p2 } = characterSelect.getSelection();
    game.start(p1, p2);
});

// Karakterleri yükle; her biri hazır oldukça karta dönüşür
loadCharacters(CHARACTER_CLASSES, character => characterSelect.addCharacter(character))
    .then(characters => {
        if (characters.length === 0) {
            const spinner = document.querySelector('.loading-spinner');
            if (spinner) spinner.textContent = 'Pokemonlar yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.';
        }
    });
