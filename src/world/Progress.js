import { levelUpCost, MAX_LEVEL, PARTY_SIZE, STARTING_LEVEL, TOKEN_DROP } from '../config/progression.js';
import { itemById, STARTING_ITEMS } from '../config/shopItems.js';

const SAVE_KEY = 'pokerpg-save-v2';
const STARTER_ID = 1; // Bulbasaur

// Macera modunun kalıcı ilerlemesi: ekip, koleksiyon, jetonlar ve rozetler.
// Ekipteki her Pokemonun kendi seviyesi ve formu (evrim) vardır.
export class Progress {
    constructor() {
        this.reset();
        this.load();
    }

    reset() {
        // party: { id, formId, level, name }  (id = yakalanan tür, formId = güncel evrim)
        this.party = [{ id: STARTER_ID, formId: STARTER_ID, level: STARTING_LEVEL, name: 'Bulbasaur' }];
        this.collection = [];      // yakalanan her Pokemon (ekip dışındakiler dahil)
        this.tokens = 0;           // yetenek jetonu (aynı zamanda para birimi)
        this.badges = [];          // yenilen bossların mekan id'leri
        this.activeIndex = 0;      // sahadaki Pokemon
        this.items = { ...STARTING_ITEMS }; // çanta: eşya id -> adet
    }

    // --- Kalıcılık ---

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                version: 2,
                party: this.party,
                collection: this.collection,
                tokens: this.tokens,
                badges: this.badges,
                activeIndex: this.activeIndex,
                items: this.items
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
            if (data.version !== 2 || !Array.isArray(data.party) || !data.party.length) return false;

            this.party = data.party;
            this.collection = Array.isArray(data.collection) ? data.collection : [];
            this.tokens = data.tokens ?? 0;
            this.badges = Array.isArray(data.badges) ? data.badges : [];
            this.activeIndex = Math.min(data.activeIndex ?? 0, this.party.length - 1);
            this.items = data.items && typeof data.items === 'object' ? data.items : { ...STARTING_ITEMS };
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

    // --- Ekip ---

    get active() {
        return this.party[this.activeIndex] || this.party[0];
    }

    setActive(index) {
        if (index < 0 || index >= this.party.length) return false;
        this.activeIndex = index;
        this.save();
        return true;
    }

    get partyFull() {
        return this.party.length >= PARTY_SIZE;
    }

    // Yakalanan Pokemon koleksiyona, yer varsa ekibe eklenir
    addCapture(id, name) {
        const entry = { id, formId: id, level: STARTING_LEVEL, name };
        this.collection.push({ id, name });
        if (!this.partyFull) this.party.push(entry);
        this.save();
        return !this.partyFull || this.party.includes(entry);
    }

    // Koleksiyondaki bir Pokemonu ekibe alır / ekipten çıkarır
    swapIntoParty(collectionIndex) {
        const entry = this.collection[collectionIndex];
        if (!entry || this.partyFull) return false;
        if (this.party.some(p => p.id === entry.id)) return false;
        this.party.push({ id: entry.id, formId: entry.id, level: STARTING_LEVEL, name: entry.name });
        this.save();
        return true;
    }

    removeFromParty(index) {
        if (this.party.length <= 1 || index === 0) return false; // başlangıç Pokemonu kalır
        this.party.splice(index, 1);
        if (this.activeIndex >= this.party.length) this.activeIndex = 0;
        this.save();
        return true;
    }

    // --- Jetonlar ve seviye ---

    tokensForEnemy(kind) {
        return TOKEN_DROP[kind] ?? TOKEN_DROP.common;
    }

    addTokens(amount) {
        this.tokens += amount;
        this.save();
    }

    costToLevel(index) {
        const member = this.party[index];
        if (!member || member.level >= MAX_LEVEL) return null;
        return levelUpCost(member.level);
    }

    // Jeton harcayarak bir Pokemonu bir seviye yükseltir
    spendOnLevel(index) {
        const cost = this.costToLevel(index);
        if (cost === null || this.tokens < cost) return false;

        this.tokens -= cost;
        this.party[index].level++;
        this.save();
        return true;
    }

    setForm(index, formId) {
        if (!this.party[index]) return;
        this.party[index].formId = formId;
        this.save();
    }

    markBossDefeated(mapId) {
        if (!this.badges.includes(mapId)) {
            this.badges.push(mapId);
            this.save();
            return true; // yeni rozet
        }
        return false;
    }

    hasBadge(mapId) {
        return this.badges.includes(mapId);
    }

    // --- Çanta ve dükkan ---

    itemCount(id) {
        return this.items[id] || 0;
    }

    // Jetonla eşya satın alır; kaç adet geldiğini döndürür (0 = alınamadı)
    buyItem(id) {
        const item = itemById(id);
        if (!item || this.tokens < item.price) return 0;

        this.tokens -= item.price;
        this.items[id] = this.itemCount(id) + item.stack;
        this.save();
        return item.stack;
    }

    consumeItem(id) {
        if (this.itemCount(id) <= 0) return false;
        this.items[id]--;
        if (this.items[id] <= 0) delete this.items[id];
        this.save();
        return true;
    }
}
