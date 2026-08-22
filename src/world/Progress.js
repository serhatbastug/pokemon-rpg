import { xpToNext, MAX_LEVEL, XP_REWARD, CAPTURE_XP_BONUS } from '../config/progression.js';
import { isPlayable } from '../config/playableCharacters.js';

const SAVE_KEY = 'pokerpg-save-v1';

// Macera modunun kalıcı ilerlemesi: seviye, deneyim, yakalananlar, yenilen
// bosslar ve seçili karakter. localStorage'a kaydedilir.
export class Progress {
    constructor() {
        this.reset();
        this.load();
    }

    reset() {
        this.level = 1;
        this.xp = 0;
        this.captures = [];        // { id, name, kind }
        this.defeatedBosses = [];  // harita id'leri
        this.characterId = 1;      // oynanan karakter (başlangıç: Bulbasaur)
        this.formId = 1;           // evrim sonrası güncel form
    }

    // --- Kalıcılık ---

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                version: 1,
                level: this.level,
                xp: this.xp,
                captures: this.captures,
                defeatedBosses: this.defeatedBosses,
                characterId: this.characterId,
                formId: this.formId
            }));
        } catch (error) {
            console.warn('Kayıt yazılamadı:', error);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.version !== 1) return false;

            this.level = data.level ?? 1;
            this.xp = data.xp ?? 0;
            this.captures = Array.isArray(data.captures) ? data.captures : [];
            this.defeatedBosses = Array.isArray(data.defeatedBosses) ? data.defeatedBosses : [];
            this.characterId = data.characterId ?? 1;
            this.formId = data.formId ?? this.characterId;
            return true;
        } catch (error) {
            console.warn('Kayıt okunamadı:', error);
            return false;
        }
    }

    clear() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (error) {
            console.warn('Kayıt silinemedi:', error);
        }
        this.reset();
    }

    // --- Deneyim ve seviye ---

    get xpNeeded() {
        return xpToNext(this.level);
    }

    // Kazanılan XP'yi işler; kaç seviye atlandığını döndürür
    addXp(amount) {
        if (this.level >= MAX_LEVEL) return 0;

        this.xp += Math.round(amount);
        let levelsGained = 0;

        while (this.level < MAX_LEVEL && this.xp >= this.xpNeeded) {
            this.xp -= this.xpNeeded;
            this.level++;
            levelsGained++;
        }
        if (this.level >= MAX_LEVEL) this.xp = 0;

        this.save();
        return levelsGained;
    }

    xpForEnemy(kind, captured = false) {
        const base = XP_REWARD[kind] ?? XP_REWARD.common;
        return captured ? Math.round(base * (1 + CAPTURE_XP_BONUS)) : base;
    }

    // --- Koleksiyon ---

    addCapture(enemy) {
        this.captures.push({ id: enemy.id, name: enemy.name, kind: enemy.kind });
        this.save();
    }

    markBossDefeated(mapId) {
        if (!this.defeatedBosses.includes(mapId)) {
            this.defeatedBosses.push(mapId);
            this.save();
        }
    }

    // Yakalanan bosslar oynanabilir karakter olur
    get playableCharacters() {
        const ids = [1];
        for (const capture of this.captures) {
            if (isPlayable(capture.id) && !ids.includes(capture.id)) ids.push(capture.id);
        }
        return ids;
    }

    selectCharacter(id) {
        this.characterId = id;
        this.formId = id;
        this.save();
    }

    setForm(id) {
        this.formId = id;
        this.save();
    }
}
