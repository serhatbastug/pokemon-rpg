// Mermi / yetenek nesnesi. type alanı çizim stilini ve isabet anındaki
// özel durum etkisini (hipnoz, dondurma, zehir) belirler.
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
        this.x += this.vx;
        this.y += this.vy;
        this.duration--;

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
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const t = Date.now() / 100;
        const r = this.radius;
        const x = this.x, y = this.y;

        switch (this.type) {
            case 'leaf': {
                // Yeşil dönen yaprak
                ctx.translate(x, y);
                ctx.rotate(t * 0.3);
                ctx.fillStyle = '#22c55e';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#22c55e';
                ctx.fillRect(-r, -r/2, r*2, r);
                ctx.fillStyle = '#4ade80';
                ctx.fillRect(-r/2, -r, r, r*2);
                break;
            }
            case 'ember': {
                // Kızıl kor top
                ctx.shadowBlur = 16;
                ctx.shadowColor = '#ff6a00';
                // Merkez çekirdek
                ctx.fillStyle = '#fffc00';
                ctx.fillRect(x-r/2, y-r/2, r, r);
                // Ateş halkaları
                ctx.fillStyle = '#ff4500';
                ctx.fillRect(x-r, y-r/2, r/2, r);
                ctx.fillRect(x+r/2, y-r/2, r/2, r);
                ctx.fillRect(x-r/2, y-r, r, r/2);
                ctx.fillRect(x-r/2, y+r/2, r, r/2);
                // Köşeler
                ctx.fillStyle = '#ff8c00';
                ctx.fillRect(x-r, y-r, r/2, r/2);
                ctx.fillRect(x+r/2, y-r, r/2, r/2);
                ctx.fillRect(x-r, y+r/2, r/2, r/2);
                ctx.fillRect(x+r/2, y+r/2, r/2, r/2);
                break;
            }
            case 'fireblast': {
                // Devasa ateş küresi
                const pulse = Math.sin(t * 0.5) * 4;
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#ff2200';
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(x-r-pulse, y-r-pulse, (r+pulse)*2, (r+pulse)*2);
                ctx.fillStyle = '#ff6600';
                ctx.fillRect(x-r+4, y-r+4, (r-4)*2, (r-4)*2);
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(x-r/2, y-r/2, r, r);
                break;
            }
            case 'wind': {
                // Parlak rüzgar dilimi
                ctx.shadowBlur = 14;
                ctx.shadowColor = '#86efac';
                // Çarpraz bant
                ctx.fillStyle = '#4ade80';
                for (let i = -2; i <= 2; i++) {
                    ctx.fillRect(x - r + i*6, y - r/3, r*0.8, r/3);
                }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - r/2, y - 2, r, 4);
                break;
            }
            case 'trap': {
                // Yeşil dönen tuzak
                ctx.translate(x, y);
                ctx.rotate(t * 0.2);
                ctx.fillStyle = 'rgba(34,197,94,0.4)';
                ctx.fillRect(-r, -r, r*2, r*2);
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2;
                ctx.strokeRect(-r, -r, r*2, r*2);
                break;
            }
            case 'lightning': {
                // Elektrik şimşeği - dikey zikzak
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#facc15';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(x, y - r*1.5);
                ctx.lineTo(x + r*0.5, y - r*0.3);
                ctx.lineTo(x - r*0.3, y);
                ctx.lineTo(x + r*0.4, y + r*0.8);
                ctx.lineTo(x, y + r*1.5);
                ctx.stroke();
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(x, y - r*1.5);
                ctx.lineTo(x + r*0.5, y - r*0.3);
                ctx.lineTo(x - r*0.3, y);
                ctx.lineTo(x + r*0.4, y + r*0.8);
                ctx.lineTo(x, y + r*1.5);
                ctx.globalAlpha = 0.4;
                ctx.stroke();
                break;
            }
            case 'storm': {
                // Elektrik fırtınası alanı
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#facc15';
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.stroke();
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = '#facc15';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.fill();
                break;
            }
            case 'punch': {
                // Mor gölge yumruk - yıldız patlaması
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#a855f7';
                ctx.fillStyle = '#a855f7';
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2 + t * 0.5;
                    const bx = x + Math.cos(angle) * r;
                    const by = y + Math.sin(angle) * r;
                    ctx.fillRect(bx - 4, by - 4, 8, 8);
                }
                ctx.fillStyle = '#e9d5ff';
                ctx.fillRect(x-r/2, y-r/2, r, r);
                break;
            }
            case 'hypnosis': {
                // Mor spiral halkalar
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#a855f7';
                for (let ring = 0; ring < 3; ring++) {
                    const ringR = r * (0.4 + ring * 0.35);
                    ctx.strokeStyle = ring === 0 ? '#e9d5ff' : ring === 1 ? '#a855f7' : '#7e22ce';
                    ctx.lineWidth = 3;
                    ctx.globalAlpha = 0.7 - ring * 0.2;
                    ctx.beginPath();
                    ctx.arc(x, y, ringR, t * 0.4, t * 0.4 + Math.PI * 1.5);
                    ctx.stroke();
                }
                break;
            }
            case 'bite': {
                // Kırmızı ısırık dişleri
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#e11d48';
                ctx.fillStyle = '#e11d48';
                // Üst dişler
                for (let i = -1; i <= 1; i++) {
                    ctx.fillRect(x + i*r*0.5 - 3, y - r, 6, r * 0.8);
                }
                // Alt dişler
                ctx.fillStyle = '#fb7185';
                for (let i = -1; i <= 1; i++) {
                    ctx.fillRect(x + i*r*0.5 - 3, y + r*0.2, 6, r * 0.8);
                }
                break;
            }
            case 'poison': {
                // Zehirli yeşil balon
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#10b981';
                ctx.fillStyle = '#064e3b';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = '#10b981';
                ctx.beginPath();
                ctx.arc(x - r*0.3, y - r*0.3, r*0.4, 0, Math.PI*2);
                ctx.fill();
                // Zehir kabarcıkları
                ctx.fillStyle = '#34d399';
                ctx.fillRect(x+r*0.3-2, y-r*0.5-2, 5, 5);
                ctx.fillRect(x-r*0.5-2, y+r*0.2-2, 4, 4);
                break;
            }
            case 'claw': {
                // Çelik pençe izleri
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#06b6d4';
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 3;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(x - r + i*5, y - r);
                    ctx.lineTo(x + r + i*5, y + r);
                    ctx.stroke();
                }
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                for (let i = -1; i <= 1; i++) {
                    ctx.beginPath();
                    ctx.moveTo(x - r + i*5, y - r);
                    ctx.lineTo(x + r + i*5, y + r);
                    ctx.stroke();
                }
                break;
            }
            case 'laser': {
                // Cyan lazer ışını - dikdörtgen blok
                ctx.shadowBlur = 25;
                ctx.shadowColor = '#06b6d4';
                ctx.fillStyle = '#06b6d4';
                ctx.fillRect(x - r, y - 8, r*2, 16);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(x - r + 4, y - 4, r*2 - 8, 8);
                break;
            }
            case 'slash': {
                // Gri hız çizgisi
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#94a3b8';
                ctx.strokeStyle = '#f1f5f9';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(x - r, y + r*0.5);
                ctx.lineTo(x + r, y - r*0.5);
                ctx.stroke();
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x - r*0.7, y + r*0.7);
                ctx.lineTo(x + r*0.7, y - r*0.7);
                ctx.stroke();
                break;
            }
            case 'ice': {
                // Buz kristali (köşeli)
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#38bdf8';
                ctx.fillStyle = '#0ea5e9';
                ctx.fillRect(x - r, y - r/3, r*2, r*0.66);
                ctx.fillRect(x - r/3, y - r, r*0.66, r*2);
                ctx.fillStyle = '#bae6fd';
                ctx.fillRect(x-4, y-4, 8, 8);
                break;
            }
            case 'freeze': {
                // Büyük dondurucu kristal
                ctx.shadowBlur = 20;
                ctx.shadowColor = '#38bdf8';
                ctx.fillStyle = '#0ea5e9';
                ctx.fillRect(x - r, y - r/4, r*2, r/2);
                ctx.fillRect(x - r/4, y - r, r/2, r*2);
                ctx.fillRect(x - r*0.7, y - r*0.7, r*0.5, r*0.5);
                ctx.fillRect(x + r*0.2, y - r*0.7, r*0.5, r*0.5);
                ctx.fillRect(x - r*0.7, y + r*0.2, r*0.5, r*0.5);
                ctx.fillRect(x + r*0.2, y + r*0.2, r*0.5, r*0.5);
                ctx.fillStyle = '#e0f2fe';
                ctx.fillRect(x-5, y-5, 10, 10);
                break;
            }
            case 'blizzard': {
                // Buz fırtınası alan etkisi
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#38bdf8';
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.stroke();
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#bae6fd';
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI*2);
                ctx.fill();
                break;
            }
            default: {
                // Varsayılan: parlayan top
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.color;
                ctx.fillStyle = this.color;
                ctx.fillRect(x - r, y - r, r*2, r*2);
                break;
            }
        }

        ctx.restore();
    }
}
