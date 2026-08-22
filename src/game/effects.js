// Savaş sahnesindeki tüm görsel efektler: parçacıklar, uçan hasar yazıları,
// ekran sarsıntısı/flaşı ve ölüm animasyonu pikselleri.
export class EffectsManager {
    constructor() {
        this.reset();
    }

    reset() {
        this.particles = [];
        this.floatingTexts = [];
        this.deathPixels = [];
        this.shakeIntensity = 0;
        this.flashColor = null;
        this.flashDuration = 0;
    }

    triggerShake(intensity) {
        this.shakeIntensity = intensity;
    }

    triggerFlash(color, duration = 3) {
        this.flashColor = color;
        this.flashDuration = duration;
    }

    spawnText(x, y, text, color = '#ff3b30', isCritical = false) {
        this.floatingTexts.push({
            x,
            y,
            text,
            color,
            fontSize: isCritical ? 28 : 20,
            vy: -1.2,
            alpha: 1.0,
            life: 50 // kare cinsinden ömür
        });
    }

    createPulse(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                radius: Math.random() * 4 + 2,
                color,
                alpha: 1,
                life: 30
            });
        }
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 25; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                radius: Math.random() * 6 + 3,
                color,
                alpha: 1,
                life: 40
            });
        }
    }

    // Solar Beam / Thunder gibi özel yeteneklerin tekil parçacık eklemesi için
    pushParticle(particle) {
        this.particles.push(particle);
    }

    // K.O. anında karakterin dağılan piksel patlaması
    spawnDeathPixels(x, y, colors) {
        const PX = 10;
        for (let gx = -5; gx <= 5; gx++) {
            for (let gy = -5; gy <= 5; gy++) {
                const dist = Math.sqrt(gx*gx + gy*gy);
                if (dist > 5.5) continue;
                this.deathPixels.push({
                    x: x + gx * PX,
                    y: y + gy * PX,
                    vx: gx * (0.8 + Math.random() * 1.5),
                    vy: gy * (0.8 + Math.random() * 1.5) - 3 - Math.random() * 4,
                    size: PX,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    alpha: 1,
                    gravity: 0.25 + Math.random() * 0.2,
                    life: 60 + Math.floor(Math.random() * 40)
                });
            }
        }
    }

    // Sarsıntıyı mevcut transform'a uygular; çağıran taraf ctx.save/restore yönetir
    applyShake(ctx) {
        if (this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
            this.shakeIntensity *= 0.85; // yumuşak sönüm
            if (this.shakeIntensity < 0.2) this.shakeIntensity = 0;
        }
    }

    drawParticles(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.alpha -= 1 / pt.life;

            if (pt.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Pixel art bütünlüğü için parçacıklar kare çizilir
            ctx.save();
            ctx.globalAlpha = pt.alpha;
            ctx.fillStyle = pt.color;
            ctx.fillRect(pt.x - pt.radius, pt.y - pt.radius, pt.radius * 2, pt.radius * 2);
            ctx.restore();
        }
    }

    drawDeathPixels(ctx) {
        for (let i = this.deathPixels.length - 1; i >= 0; i--) {
            const px = this.deathPixels[i];
            px.vy += px.gravity;
            px.x += px.vx;
            px.y += px.vy;
            px.life--;
            px.alpha = Math.max(0, px.life / 60);

            if (px.life <= 0) {
                this.deathPixels.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = px.alpha;
            ctx.fillStyle = px.color;
            ctx.fillRect(px.x - px.size/2, px.y - px.size/2, px.size, px.size);
            ctx.restore();
        }
    }

    drawFloatingTexts(ctx) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.alpha -= 1 / ft.life;

            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.fillStyle = ft.color;
            ctx.font = `bold ${ft.fontSize}px 'Space Grotesk', sans-serif`;
            ctx.textAlign = 'center';
            // Okunabilirlik için siyah kontur
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 4;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    drawFlash(ctx, width, height) {
        if (this.flashColor && this.flashDuration > 0) {
            ctx.save();
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();

            this.flashDuration--;
            if (this.flashDuration <= 0) {
                this.flashColor = null;
            }
        }
    }
}
