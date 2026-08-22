// Macera modu çizim stili. Üç varyant karşılaştırılabilsin diye çalışma
// anında değiştirilebilir (setRenderStyle) - seçim yapıldıktan sonra
// varsayılan sabitlenir.
//
// Anime'de arka plan ve karakter AYRI sanatlardır:
//   - Arka planlar (背景) guaj boyayla boyanır, KONTURU YOKTUR
//   - Karakterlerin ince çizgisi vardır, genelde siyah değil dolgunun koyu tonu
// Varyantlar bu ayrımın farklı derecelerini dener.

export const STYLES = {
    // A) Boyalı arka plan + ince çizgili karakter (anime'ye en sadık)
    painted: {
        label: 'Boyalı arka plan + ince çizgi',
        terrain: { outline: false, painted: true },
        trainer: { lineWidth: 0.16, tinted: true },
        fx: { outline: false, glow: true }
    },

    // B) Her şey çizgisiz: karakterde de kontur yok
    lineless: {
        label: 'Tamamen çizgisiz (boyalı)',
        terrain: { outline: false, painted: true },
        trainer: { lineWidth: 0, tinted: true },
        fx: { outline: false, glow: true }
    },

    // C) Kalın kontur (şu anki hâli - karşılaştırma için)
    bold: {
        label: 'Kalın kontur (mevcut)',
        terrain: { outline: true, painted: false },
        trainer: { lineWidth: 0.4, tinted: false },
        fx: { outline: true, glow: false }
    }
};

let current = 'painted';

// Varyantları karşılaştırabilmek için: ?style=painted|lineless|bold
// (tarayıcı dışında - node testlerinde - bu blok atlanır)
try {
    if (typeof location !== 'undefined' && location.search) {
        const q = new URLSearchParams(location.search).get('style');
        if (q && STYLES[q]) current = q;
    }
} catch (err) { /* tarayıcı dışı ortam */ }

export function setRenderStyle(name) {
    if (STYLES[name]) current = name;
    return current;
}

export function renderStyleName() {
    return current;
}

export function style() {
    return STYLES[current];
}

// Test/karsilastirma araclari icin: hangi stil etkin?
try {
    if (typeof window !== "undefined") window.__renderStyle = current;
} catch (err) { /* tarayici disi ortam */ }
