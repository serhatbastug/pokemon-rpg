// Parçalayıcı silahın görsel etkileri. Prologun birden fazla bölümünde
// kullanılıyor (kuşatmada avluya girenler, ormanın ağzında yeşillenenler),
// bu yüzden sahneye değil ortak katmana ait.
//
// Silahın kuralı: virüsü ÖLDÜRMEZ, etrafa dağıtır. Bu yüzden vuruşun kalıcı
// izi bir leke - temizlenmiyor, yok olmuyor.

import { PX, dot, hash } from './pixelDraw.js';

// Parçalayıcı silahın mermisi: kısa, sıcak bir çizgi
export function drawBullet(ctx, bullet) {
    const { x, y, vx, vy } = bullet;
    const len = 3;
    for (let i = 0; i < len; i++) {
        const px = x - vx * i * 0.9;
        const py = y - vy * i * 0.9;
        dot(ctx, px, py, i === 0 ? '#fff3c4' : (i === 1 ? '#f7c948' : '#c9761c'));
    }
}

// Vurulan virüslünün yere dağılması. Virüs ÖLMEZ, dağılır: leke kalıcıdır ve
// ateş ettikçe avlu daha da kirlenir. Oyuncuya ceza yok, ama yaptığı şeyin
// işe yaramadığı gözle görülüyor.
// Taze ve ıslak: hem betonda hem ölü otta seçilmeli. Koyu tutulunca
// şehir sahnesindeki kuru zemine karışıp hiç görünmüyordu.
const SPLAT = ['#8fbb2a', '#6d9418', '#a6d33c', '#4d6a10'];
const SPLAT_RIM = '#2c3d08';

export function drawSplat(ctx, splat) {
    const { x, y, seed, radius } = splat;
    for (let py = y - radius; py <= y + radius; py += PX) {
        for (let px = x - radius; px <= x + radius; px += PX) {
            const d = Math.hypot((px - x) / radius, (py - y) / (radius * 0.55));
            if (d > 1) continue;
            if (hash(px + seed, py, 421) > 0.72 - d * 0.45) continue;
            ctx.fillStyle = SPLAT[Math.floor(hash(px, py + seed, 431) * SPLAT.length)];
            ctx.fillRect(px, py, PX, PX);
        }
    }
    // Koyu kenar: lekeyi zeminden ayırır
    for (let a = 0; a < 28; a++) {
        const angle = (a / 28) * Math.PI * 2;
        dot(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.55, SPLAT_RIM);
    }
    // Islak parlama
    dot(ctx, x - PX, y - PX, '#c8ee5c');
    dot(ctx, x + PX * 2, y, '#c8ee5c');

    // Sıçrayan damlalar
    for (let i = 0; i < 8; i++) {
        const angle = hash(seed, i, 433) * Math.PI * 2;
        const dist = radius * (1 + hash(seed, i, 439) * 0.7);
        dot(ctx, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.55, SPLAT[1]);
    }
}

// Vuruş anı: kısa bir yeşil patlama
export function drawBurst(ctx, x, y, t) {
    if (t <= 0 || t >= 1) return;
    const radius = 6 + t * 26;
    for (let i = 0; i < 30; i++) {
        const angle = hash(i, 0, 443) * Math.PI * 2;
        const dist = radius * (0.4 + hash(i, 1, 449) * 0.6);
        ctx.globalAlpha = 1 - t;
        dot(ctx, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist * 0.6,
            hash(i, 2, 457) < 0.4 ? '#c2e04a' : '#6f9124');
    }
    ctx.globalAlpha = 1;
}
