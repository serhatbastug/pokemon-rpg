// Klavye durumu takibi. Oyun mantığı tuşları yalnızca bu sınıf üzerinden okur.
export class InputManager {
    constructor() {
        this.keys = {};
        this.keydownHandlers = [];

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            for (const handler of this.keydownHandlers) handler(e);
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    isDown(code) {
        return !!this.keys[code];
    }

    onKeyDown(handler) {
        this.keydownHandlers.push(handler);
    }
}
