// Uygulama giriş noktası: modülleri kurar ve birbirine bağlar.
import { CHARACTER_CLASSES } from './config/characters.js';
import { loadCharacters, fetchCharacter } from './services/pokeapi.js';
import { Progress } from './world/Progress.js';
import { Library } from './ui/library.js';
import { Shop } from './ui/shop.js';
import { InputManager } from './core/input.js';
import { CharacterSelect } from './ui/characterSelect.js';
import { Hud } from './ui/hud.js';
import { showBattleScreen, showGameOver, hideGameOver, showOverworldScreen, showSelectionScreen } from './ui/screens.js';
import { Game } from './game/Game.js';
import { Overworld } from './world/Overworld.js';

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
    onExit: () => {
        overworld.stop();
        showSelectionScreen();
    },
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

document.getElementById('start-adventure-btn').addEventListener('click', async () => {
    showOverworldScreen();
    await overworld.start();
});

// Otomatik UI testleri (tests/ui.test.mjs) oyun durumunu buradan okur
window.__overworld = overworld;
window.__game = game;
window.__library = library;
window.__shop = shop;
window.__progress = progress;

document.getElementById('overworld-back-btn').addEventListener('click', () => {
    overworld.stop();
    showSelectionScreen();
});

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
