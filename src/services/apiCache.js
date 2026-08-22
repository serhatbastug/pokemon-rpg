// PokeAPI yanıtları için önbellek.
// Aynı istek oturum boyunca bir kez atılır (bellek) ve localStorage'a yazılır;
// böylece sonraki açılışlar hızlanır ve ağ dalgalanmalarına dayanıklı olur.
const MEMORY = new Map();
const STORAGE_PREFIX = 'pokeapi:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // bir hafta

function readStorage(key) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || Date.now() - entry.t > TTL_MS) {
            localStorage.removeItem(STORAGE_PREFIX + key);
            return null;
        }
        return entry.v;
    } catch {
        return null;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (error) {
        // Kota dolduysa eski PokeAPI kayıtlarını temizleyip bir kez daha dene
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
            }
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
        } catch {
            // Önbellek olmadan da çalışabiliriz; sessizce vazgeç
        }
    }
}

// url'yi getirir; cacheKey verilmişse sonucu önbelleğe alır.
// pick, saklanacak veriyi küçültmek için kullanılır (tüm yanıtı tutmayalım).
export async function cachedJson(url, cacheKey, pick = (data) => data) {
    if (!cacheKey) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`PokeAPI ${response.status}: ${url}`);
        return pick(await response.json());
    }

    if (MEMORY.has(cacheKey)) return MEMORY.get(cacheKey);

    const stored = readStorage(cacheKey);
    if (stored) {
        const ready = Promise.resolve(stored);
        MEMORY.set(cacheKey, ready);
        return ready;
    }

    const promise = fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`PokeAPI ${response.status}: ${url}`);
            return response.json();
        })
        .then(data => {
            const value = pick(data);
            writeStorage(cacheKey, value);
            return value;
        })
        .catch(error => {
            MEMORY.delete(cacheKey); // başarısız istek önbellekte kalmasın
            throw error;
        });

    MEMORY.set(cacheKey, promise);
    return promise;
}

export function clearApiCache() {
    MEMORY.clear();
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
        }
    } catch {
        // erişilemiyorsa yapacak bir şey yok
    }
}
