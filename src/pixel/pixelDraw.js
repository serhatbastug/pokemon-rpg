// Piksel çizim araçları: sahnelerin ortak alt katmanı.
//
// Piksel birimi PX = 4. Antrenör sprite'ı da 4 ölçeğiyle çizildiği için
// sahnedeki her şey aynı ızgaraya oturur; bu ızgaradan sapan tek bir çizim
// bile piksel dilini bozuyor.

export const PX = 4;

export function newCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
}

// Piksel ızgarasına oturtulmuş dikdörtgen
export function blk(ctx, x, y, w, h, color) {
    const x0 = Math.round(x / PX) * PX;
    const y0 = Math.round(y / PX) * PX;
    const x1 = Math.round((x + w) / PX) * PX;
    const y1 = Math.round((y + h) / PX) * PX;
    if (x1 <= x0 || y1 <= y0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

// Tek piksel blok
export function dot(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, PX, PX);
}

// Konuma göre sahte-rastgele (0..1). Aynı konum her zaman aynı değeri verir,
// böylece sahne her açılışta birebir aynı çıkar.
export function hash(x, y, salt = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
    return n - Math.floor(n);
}
