// Ayarlar ekranı ya da çıkış onayı açıkken oyun donar. Sahneler her adımın başında
// bu bayrağa bakar; klavye ve kol girdisi de bu sırada oyuna ulaşmaz.
// Aynı anda yalnızca bir pencere (modal) açık olabilir.
let open = false;
let modal = null;

export function isPaused() {
    return open;
}

export function setPaused(value) {
    open = value;
}

// Açık pencerenin adı ('settings' | 'exit' | null)
export function currentModal() {
    return modal;
}

export function setModal(name) {
    modal = name;
    open = name !== null;
}
