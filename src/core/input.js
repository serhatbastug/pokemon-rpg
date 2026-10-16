// Klavye durumu takibi. Oyun mantığı tuşları yalnızca bu sınıf üzerinden okur.
import { setDevice } from './device.js';
import { isPaused } from './pause.js';

export class InputManager {
    constructor() {
        this.keys = {};
        this.keydownHandlers = [];

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            setDevice('keyboard');   // ekrandaki ipuçları klavye simgesine döner
            for (const handler of this.keydownHandlers) handler(e);
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    isDown(code) {
        return !isPaused() && !!this.keys[code];
    }

    onKeyDown(handler) {
        this.keydownHandlers.push(handler);
    }
}
