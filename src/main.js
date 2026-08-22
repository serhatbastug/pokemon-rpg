// Uygulama giriş noktası: modülleri kurar ve birbirine bağlar.
import { CHARACTER_CLASSES } from './config/characters.js';
import { loadCharacters, fetchCharacter } from './services/pokeapi.js';
import { Progress } from './world/Progress.js';
import { AdventurePicker } from './ui/adventurePicker.js';
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
    }
});

// Seçilen karakterle maceraya başlar. Doğru evrim formu, Overworld evrim
// zincirini çekince seviyeye göre kendiliğinden uygulanır.
async function startAdventure() {
    try {
        const character = await fetchCharacter({ id: progress.formId });
        showOverworldScreen();
        overworld.start(character);
    } catch (error) {
        console.error('Karakter yüklenemedi:', error);
    }
}

const picker = new AdventurePicker({
    progress,
    onStart: () => startAdventure(),
    onReset: () => overworld.stop()
});

document.getElementById('start-adventure-btn').addEventListener('click', () => {
    picker.open();
});

// Otomatik UI testleri (tests/ui.test.mjs) oyun durumunu buradan okur
window.__overworld = overworld;
window.__game = game;

document.getElementById('overworld-back-btn').addEventListener('click', () => {
    overworld.stop();
    showSelectionScreen();
});

document.getElementById('start-battle-btn').addEventListener('click', () => {
    const { p1, p2 } = characterSelect.getSelection();
    if (!p1 || !p2) return;

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
