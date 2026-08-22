// Uygulama giriş noktası: modülleri kurar ve birbirine bağlar.
import { CHARACTER_CLASSES, ADVENTURE_STARTER } from './config/characters.js';
import { loadCharacters, fetchCharacter } from './services/pokeapi.js';
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

const overworld = new Overworld({
    canvas: document.getElementById('worldCanvas'),
    input,
    onExit: () => {
        overworld.stop();
        showSelectionScreen();
    }
});

// Macera her zaman başlangıç Pokemonu (Bulbasaur) ile başlar; ilk tıklamada yüklenir
let adventureStarter = null;
document.getElementById('start-adventure-btn').addEventListener('click', async () => {
    if (!adventureStarter) {
        try {
            adventureStarter = await fetchCharacter(ADVENTURE_STARTER);
        } catch (error) {
            console.error('Başlangıç Pokemonu yüklenemedi:', error);
            return;
        }
    }

    showOverworldScreen();
    overworld.start(adventureStarter);
});

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
