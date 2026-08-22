import { PROJECTILE_SPRITES, drawPixelSprite } from './projectileSprites.js';

// Mermi / yetenek nesnesi. type alanı çizim stilini, hareket davranışını ve
// isabet anındaki özel durum etkisini (hipnoz, dondurma, zehir) belirler.
export class Projectile {
    constructor(x, y, vx, vy, radius, dmg, color, type, owner, duration = 300) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.dmg = dmg;
        this.color = color;
        this.type = type;
        this.owner = owner; // sahibi olan oyuncu numarası (1 | 2)
        this.duration = duration; // otomatik yok olmadan önceki kare sayısı
    }

    update(game) {
        // Tohum bombası yerçekimiyle kavis çizer
        if (this.type === 'seedbomb') {
            this.vy += 0.35;
        }

        // Manyetik bomba rakibe doğru yumuşakça yönelir
        if (this.type === 'magnetbomb') {
            const target = this.owner === 1 ? game.p2 : game.p1;
            const desired = Math.atan2(target.y - this.y, target.x - this.x);
            const current = Math.atan2(this.vy, this.vx);
            let diff = desired - current;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turn = Math.max(-0.08, Math.min(0.08, diff));
            const speed = 6;
            this.vx = Math.cos(current + turn) * speed;
            this.vy = Math.sin(current + turn) * speed;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.duration--;

        // Tohum bombası zemine çarpınca patlar (patlama efekti Game tarafında)
        if (this.type === 'seedbomb' && this.y >= game.canvas.height - 50) {
            this.duration = 0;
        }

        // Blizzard/fırtına alanları sahibini takip eder
        if (this.type === 'blizzard' || this.type === 'storm') {
            const follow = this.owner === 1 ? game.p1 : game.p2;
            this.x = follow.x;
            this.y = follow.y;
        }

        // Ekran dışına çıkanları yok et
        const { width, height } = game.canvas;
        if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
            this.duration = 0;
        }
    }

    draw(ctx) {
        // Desen tabanlı sprite'ı olan tipler tek yerden çizilir
        const def = PROJECTILE_SPRITES[this.type];
        if (def) {
            const opts = {};
            if (def.spin) {
                opts.angle = (Date.now() / 1000) * def.spin;
            } else if (def.directional && this.vx < 0) {
                opts.flip = true;
            }
            drawPixelSprite(ctx, def, this.x, this.y, opts);
            return;
        }

        // Alan etkileri ve ışınlar: desene sığmayan özel piksel çizimleri
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const t = Date.now() / 100;
        const r = this.radius;
        const x = this.x, y = this.y;

        switch (this.type) {
            case 'lightning': {
                // Zikzak yolu boyunca dizilmiş piksel kareler
                const seed = Math.floor(Date.now() / 60);
                ctx.shadowBlur = 14;
                ctx.shadowColor = '#facc15';
                const pts = [[0, -1.5], [0.5, -0.3], [-0.3, 0], [0.4, 0.8], [0, 1.5]];
                for (let s = 0; s < pts.length - 1; s++) {
                    const [ax, ay] = pts[s];
                    const [bx, by] = pts[s + 1];
                    const steps = 4;
                    for (let i = 0; i <= steps; i++) {
                        const px = x + (ax + (bx - ax) * i / steps) * r;
                        const py = y + (ay + (by - ay) * i / steps) * r;
                        ctx.fillStyle = (i + seed) % 2 === 0 ? '#ffffff' : '#facc15';
                        ctx.fillRect(px - 3, py - 3, 6, 6);
                    }
                }
                break;
            }
            case 'hypnosis': {
                // Zıt yönlerde dönen piksel halkalar
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#a855f7';
                const ringColors = ['#e9d5ff', '#a855f7', '#7e22ce'];
                for (let ring = 0; ring < 3; ring++) {
                    const ringR = r * (0.5 + ring * 0.35);
                    const n = 6 + ring * 3;
                    const dir = ring % 2 === 0 ? 1 : -1;
                    ctx.fillStyle = ringColors[ring];
                    for (let i = 0; i < n; i++) {
                        const a = t * 0.4 * dir + (i / n) * Math.PI * 2;
                        ctx.fillRect(x + Math.cos(a) * ringR - 2, y + Math.sin(a) * ringR - 2, 5, 5);
                    }
                }
                break;
            }
            case 'storm': {
                // Dönen elektrik halkası + içeride rastgele kıvılcımlar
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#facc15';
                const n = 26;
                ctx.globalAlpha = 0.8;
                for (let i = 0; i < n; i++) {
                    const a = t * 0.15 + (i / n) * Math.PI * 2;
                    ctx.fillStyle = i % 3 === 0 ? '#fde047' : '#facc15';
                    ctx.fillRect(x + Math.cos(a) * r - 3, y + Math.sin(a) * r - 3, 6, 6);
                }
                const seed = Math.floor(Date.now() / 90);
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = '#ffffff';
                for (let i = 0; i < 5; i++) {
                    const a = (((seed * 13 + i * 47) % 100) / 100) * Math.PI * 2;
                    const rr = (((seed * 29 + i * 31) % 100) / 100) * r * 0.8;
                    ctx.fillRect(x + Math.cos(a) * rr - 2, y + Math.sin(a) * rr - 2, 4, 4);
                }
                break;
            }
            case 'blizzard': {
                // Buz halkası + içeride savrulan kar taneleri
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#38bdf8';
                const n = 30;
                ctx.globalAlpha = 0.5;
                for (let i = 0; i < n; i++) {
                    const a = -t * 0.1 + (i / n) * Math.PI * 2;
                    ctx.fillStyle = i % 3 === 0 ? '#bae6fd' : '#38bdf8';
                    ctx.fillRect(x + Math.cos(a) * r - 3, y + Math.sin(a) * r - 3, 6, 6);
                }
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = '#e0f2fe';
                for (let i = 0; i < 8; i++) {
                    const sx = x + Math.sin(t * 0.3 + i * 2.1) * r * 0.7;
                    const sy = y + (((t * 8 + i * 37) % (r * 1.6)) - r * 0.8);
                    ctx.fillRect(sx - 2, sy - 2, 4, 4);
                }
                break;
            }
            case 'trap': {
                // Dönen piksel kenarlı tuzak karesi
                ctx.translate(x, y);
                ctx.rotate(t * 0.2);
                ctx.fillStyle = 'rgba(34,197,94,0.25)';
                ctx.fillRect(-r, -r, r * 2, r * 2);
                ctx.fillStyle = '#22c55e';
                for (let i = -r; i < r; i += 6) {
                    ctx.fillRect(i, -r, 4, 4);
                    ctx.fillRect(i, r - 4, 4, 4);
                    ctx.fillRect(-r, i, 4, 4);
                    ctx.fillRect(r - 4, i, 4, 4);
                }
                break;
            }
            case 'laser': {
                // Akan enerji şeritli lazer ışını
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#06b6d4';
                ctx.fillStyle = '#0891b2';
                ctx.fillRect(x - r, y - 10, r * 2, 20);
                ctx.fillStyle = '#67e8f9';
                ctx.fillRect(x - r, y - 6, r * 2, 12);
                ctx.fillStyle = '#ffffff';
                const dir = this.vx >= 0 ? 1 : -1;
                const off = (Math.floor(Date.now() / 40) % 12) * dir;
                for (let i = -r; i < r; i += 12) {
                    const sx = i + off;
                    if (sx < -r || sx + 8 > r) continue;
                    ctx.fillRect(x + sx, y - 3, 8, 6);
                }
                break;
            }
            default: {
                // Varsayılan: parlayan piksel top
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.color;
                ctx.fillStyle = this.color;
                ctx.fillRect(x - r, y - r, r * 2, r * 2);
                break;
            }
        }

        ctx.restore();
    }
}
