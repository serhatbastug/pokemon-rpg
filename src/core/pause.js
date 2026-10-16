// Ayarlar ekranı açıkken oyun donar. Sahneler her adımın başında bu bayrağa
// bakar; klavye ve kol girdisi de bu sırada oyuna ulaşmaz.
let open = false;

export function isPaused() {
    return open;
}

export function setPaused(value) {
    open = value;
}
