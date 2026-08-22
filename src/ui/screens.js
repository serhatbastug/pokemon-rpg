// Ekranlar arası geçişler. DOM sınıf değişiklikleri tek yerde toplanır.
const el = (id) => document.getElementById(id);

export function showBattleScreen() {
    el('selection-screen').classList.add('hidden');
    el('main-header').classList.add('hidden');
    el('battle-screen').classList.remove('hidden');
    document.body.classList.add('battle-active');
}

export function showGameOver(text) {
    el('winner-announcement').textContent = text;
    el('gameover-screen').classList.remove('hidden');
}

export function hideGameOver() {
    el('gameover-screen').classList.add('hidden');
}

export function showOverworldScreen() {
    el('selection-screen').classList.add('hidden');
    el('main-header').classList.add('hidden');
    el('overworld-screen').classList.remove('hidden');
    document.body.classList.add('battle-active');
}

export function showSelectionScreen() {
    el('overworld-screen').classList.add('hidden');
    el('battle-screen').classList.add('hidden');
    el('selection-screen').classList.remove('hidden');
    el('main-header').classList.remove('hidden');
    document.body.classList.remove('battle-active');
}
