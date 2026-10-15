// Ekranlar arası geçişler. DOM sınıf değişiklikleri tek yerde toplanır.
const el = (id) => document.getElementById(id);

const SCREENS = ['menu-screen', 'comic-screen', 'adventure-screen', 'selection-screen', 'battle-screen'];

function show(id, { header = false, lockScroll = true } = {}) {
    for (const screen of SCREENS) el(screen).classList.toggle('hidden', screen !== id);
    el('main-header').classList.toggle('hidden', !header);
    document.body.classList.toggle('battle-active', lockScroll);
}

// Ana menü: antrenörün içinde gezdiği piksel sahne (oyunun açılış ekranı)
export function showMenuScreen() {
    show('menu-screen');
}

// Prolog: çizgi roman. Oyunun oynanan kısmı ormanda başlıyor, ondan
// öncesi kare kare anlatılıyor.
export function showComicScreen() {
    show('comic-screen');
}

// Oynanış: prologdan sonra başlayan 3/4 görünümlü sahne
export function showAdventureScreen() {
    show('adventure-screen');
}

// Karakter seçimi: ana menüdeki geçitten gelinir, iki kişilik moda çıkar
export function showSelectionScreen() {
    show('selection-screen', { header: true, lockScroll: false });
}

export function showBattleScreen() {
    show('battle-screen');
}


export function showGameOver(text) {
    el('winner-announcement').textContent = text;
    el('gameover-screen').classList.remove('hidden');
}

export function hideGameOver() {
    el('gameover-screen').classList.add('hidden');
}
