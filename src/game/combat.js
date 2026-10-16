// Arenada YAŞAYAN her şey: toplar, ışın, elektrik küresi ve kütleleri,
// bölünen küçük virüsler, salgın izi, enfekte kol.
//
// Player "hangi hamle çıkabilir"e karar veriyor, burası o hamlenin arenada ne
// yaptığını yürütüyor. İkisi ayrı çünkü hamlelerin çoğu karakteri bıraktıktan
// sonra da yaşıyor: ışın karakterin gitmesinden sonra da yerinde duruyor,
// küre üç el ateş edene kadar orada kalıyor.
//
// Sayılar burada değil, abilities.js'te. Burada yalnızca davranış var.

import { PX, hash } from '../pixel/pixelDraw.js';
import { PHYSICS } from '../config/settings.js';
import { drawPixelText, measurePixelText } from '../pixel/pixelFont.js';
import { PAD_GLYPHS } from '../pixel/controlHint.js';
import { ABILITIES } from './abilities.js';
import { muzzleOf, drawFighter } from './fighterArt.js';
import { Sfx } from '../services/audio.js';

// 'KeyF' -> 'F', 'Comma' -> ','   (tuş kapağında yazan)
const KEY_LABELS = { Comma: ',', Period: '.', Slash: '/', Space: 'SPACE' };
export function keyCapLabel(code) {
    if (KEY_LABELS[code]) return KEY_LABELS[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
}

const GLYPH_PX = 4;

function drawPadGlyph(ctx, name, x, y, px = GLYPH_PX) {
    const glyph = PAD_GLYPHS[name];
    if (!glyph) return 0;
    ctx.fillStyle = glyph.color;
    glyph.rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            if (row[c] !== '#') continue;
            ctx.fillRect(x + c * px, y + r * px, px, px);
        }
    });
    return glyph.rows[0].length * px;
}

export class Combat {
    constructor(game) {
        this.game = game;
        this.reset();
    }

    reset() {
        this.entities = [];
    }

    // ---- hamlelerin doğduğu yer ----

    perform(player, ability) {
        switch (ability.kind) {
            case 'shot':  return this.spawnShot(player, ability);
            case 'burst': return this.spawnBurst(player, ability);
            case 'beam':  return this.spawnBeam(player, ability);
            case 'orb':   return this.spawnOrb(player, ability);
            case 'split': return this.spawnPieces(player, ability);
            case 'trail': return this.spawnTrail(player, ability);
            case 'grab':  return this.spawnArm(player, ability);
            case 'blink': return this.blink(player, ability);
            case 'clone': return this.spawnClone(player, ability);
            case 'path':  return this.spawnPath(player, ability);
        }
    }

    onDash(player) {
        Sfx.whoosh();
        this.game.effects.createPulse(player.x, player.footY - 20, player.fighter.themeColor);
    }

    // Yakın dövüş vuruşu (virüsün savurması, buzun kılıcı): hazırlık bitince
    // önündeki kutuya bakıyor.
    meleeHit(player, ability) {
        if (player.action?.landed) return;

        const front = player.x + player.dir * ability.reach / 2;

        // Önce KLON: araya klon girmişse vuruş ona iniyor. Klonun bütün
        // değeri bu - rakip hangisinin asıl olduğunu bilmediği için vuruşunu
        // ona harcıyor.
        const clone = this.cloneAt(front, player.y, player);
        if (clone) {
            player.action.landed = true;
            this.hurtClone(clone, ability.damage);
            this.game.effects.createExplosion(clone.x, player.y, '#dff4fb');
            return;
        }

        const enemy = this.game.getEnemyOf(player);
        if (!enemy || enemy.isDead) return;

        const dx = Math.abs(enemy.x - front);
        const dy = Math.abs(enemy.y - player.y);
        if (dx > ability.reach / 2 + enemy.width / 2 || dy > enemy.height * 0.8) return;

        player.action.landed = true;
        enemy.takeDamage(ability.damage, { kind: 'basic', from: player });
        // Buzun kılıcı rakibi HAFİFÇE savuruyor: hasar değil, kılıç boyu yer.
        if (ability.knockback) enemy.vx = player.dir * ability.knockback;
        this.game.effects.createExplosion(enemy.x, enemy.y, player.fighter.themeColor);
    }

    spawnShot(player, ability) {
        // Top küçük ve BİÇİMSİZ: her topun kendi çentik deseni var, hepsi
        // aynı daire olsa mermi gibi okunurdu.
        // Çıkış noktası OMUZDAKİ BORUNUN UCU: gövdenin ortasından çıkarsa
        // topu kimin gönderdiği okunmuyor.
        const m = muzzleOf(player.fighter.id, player.x, player.footY, player.dir);
        this.entities.push({
            type: 'shot',
            x: m.x,
            y: m.y,
            vx: player.dir * ability.speed,
            vy: 0,
            r: ability.radius,
            damage: ability.damage,
            kind: 'basic',
            owner: player,
            life: ability.life,
            seed: Math.floor(Math.random() * 1000)
        });
    }

    spawnBurst(player, ability) {
        // Eşit açılarla her yöne. Uzaktaki rakip aradaki boşluktan geçer -
        // ayrı bir kural değil, eşit açının kendiliğinden sonucu.
        for (let i = 0; i < ability.count; i++) {
            const a = (Math.PI * 2 * i) / ability.count;
            this.entities.push({
                type: 'shot',
                x: player.x,
                y: player.y - player.height * 0.1,
                vx: Math.cos(a) * ability.speed,
                vy: Math.sin(a) * ability.speed,
                r: ability.radius,
                damage: ability.damage,
                kind: 'special',
                owner: player,
                life: ability.life,
                seed: i * 37
            });
        }
    }

    spawnBeam(player, ability) {
        // Işın bir kez çiziliyor ve ARENADA KALIYOR: karakter gitse de o hat
        // duruyor, üstünde durmak hasar demek.
        const { canvas } = this.game;
        // Işın ileri uzanan ELDEN çıkıyor (bkz. fighterArt MUZZLES)
        const m = muzzleOf(player.fighter.id, player.x, player.footY, player.dir);
        const end = player.dir > 0 ? canvas.width : 0;
        this.entities.push({
            type: 'beam',
            x0: m.x,
            x1: end,
            y: m.y,
            thickness: ability.thickness,
            damage: ability.damage,
            tickInterval: ability.tickInterval,
            nextTick: 0,
            owner: player,
            life: ability.life,
            maxLife: ability.life
        });
    }

    spawnOrb(player, ability) {
        const { canvas } = this.game;
        this.entities.push({
            type: 'orb',
            x: canvas.width / 2,
            y: canvas.height / 2,
            owner: player,
            spec: ability,
            volleysLeft: ability.volleys,
            timer: 40,             // ilk el biraz gecikiyor: küre önce kuruluyor
            life: ability.life,
            maxLife: ability.life
        });
    }

    fireMass(orb) {
        const ability = orb.spec;
        const enemy = this.game.getEnemyOf(orb.owner);
        const tx = enemy ? enemy.x : orb.x;
        const ty = enemy ? enemy.y : orb.y;
        const len = Math.hypot(tx - orb.x, ty - orb.y) || 1;
        this.entities.push({
            type: 'mass',
            x: orb.x,
            y: orb.y,
            // BÜYÜK ve YAVAŞ: çıktığı anda nereye gittiği belli, kaçılabilir.
            // İşi vurmak değil, arenayı daraltmak.
            vx: ((tx - orb.x) / len) * ability.massSpeed,
            vy: ((ty - orb.y) / len) * ability.massSpeed,
            r: ability.massRadius,
            damage: ability.massDamage,
            kind: 'special',
            owner: orb.owner,
            life: ability.massLife
        });
        this.game.effects.triggerFlash('rgba(255,255,255,0.18)', 3);
    }

    spawnPieces(player, ability) {
        // Kütle parçalara ayrılıyor; parçalar rakibe yürüyüp ısırıyor.
        // Menzilli karakterin uzakta durup atmasına virüsün tek cevabı bu.
        for (let i = 0; i < ability.pieces; i++) {
            this.entities.push({
                type: 'piece',
                x: player.x + (i - (ability.pieces - 1) / 2) * PX * 12,
                y: player.y,
                vy: -6 - Math.random() * 3,
                // Hızları biraz farklı: aynı hızda giden dört parça yan yana
                // yapışık kalıyor, tek bir yığın gibi okunuyordu.
                speed: ability.pieceSpeed * (0.78 + i * 0.15),
                damage: ability.biteDamage,
                biteRange: ability.biteRange,
                biteInterval: ability.biteInterval,
                biteTimer: 0,
                owner: player,
                life: ability.pieceLife,
                // Her parça rakibin biraz farklı bir yanında duruyor: hepsi
                // aynı noktayı hedeflerse dört parça tek bir yığın gibi
                // üst üste biniyor, bölünme okunmuyor.
                offset: (i - (ability.pieces - 1) / 2) * ability.biteRange,
                seed: i * 91
            });
        }
        this.game.effects.createExplosion(player.x, player.y, player.fighter.themeColor);
    }

    spawnTrail(player, ability) {
        this.entities.push({
            type: 'trail',
            x: player.x,
            y: player.footY,
            w: ability.width,
            slow: ability.slow,
            owner: player,
            life: ability.life,
            maxLife: ability.life
        });
    }

    // ---- ICE-VİRÜS ----

    // Klon: buzun kendi kopyası. GÖRSEL OLARAK AYNI - aynı sprite, aynı
    // duruşlar, hiçbir işaret yok. Rakibin ayırt etmesinin tek yolu vuruşu:
    // klon az vuruyor ve yalnızca kılıç sallayabiliyor.
    //
    // Beklemeyi BURADA sonsuza çekiyoruz. Player.useAbility beklemeyi zaten
    // yazdı, ama klon yaşarken sayaç işlememeli: bekleme ancak klon yok
    // olunca başlıyor (bkz. killClone). "Aynı anda iki klon olmaz" kuralı
    // ayrı bir kontrol değil, bunun kendiliğinden sonucu.
    spawnClone(player, ability) {
        const { canvas } = this.game;
        // Buzun ARKASINDA doğuyor: önünde doğsaydı rakip hangisinin sonradan
        // geldiğini görürdü. Arkada doğan klon bir an sonra buzu geçip öne
        // çıkıyor, ikisi karışıyor.
        const x = Math.max(60, Math.min(canvas.width - 60,
            player.x - player.dir * ability.spawnOffset));

        this.entities.push({
            type: 'clone',
            x,
            footY: player.footY,
            vy: 0,
            dir: player.dir,
            spec: ability,
            hp: ability.hp,
            maxHp: ability.hp,
            attackTimer: ability.attackInterval,
            // Doğarken bir an yerinde duruyor: doğar doğmaz yürümeye başlayan
            // klon aslın üstünden geçip onunla üst üste biniyor, ikisi tek
            // gövde gibi okunuyordu. Bu duraklama ikisini birbirinden ayırıyor.
            birth: 24,
            anim: null,
            owner: player,
            life: ability.life
        });

        player.cooldowns[ability.id] = Infinity;
        this.game.effects.createPulse(x, player.footY - 60, '#dff4fb');
    }

    // Klon yok oldu: bekleme İŞTE ŞİMDİ başlıyor.
    killClone(e) {
        e.owner.cooldowns[e.spec.id] = e.spec.cooldown;
        this.game.effects.createExplosion(e.x, e.footY - 70, '#dff4fb');
        this.game.effects.spawnText(e.x, e.footY - 130, 'KLON KIRILDI', '#bfefff');
    }

    hurtClone(e, amount) {
        e.hp -= amount;
        e.flash = 8;
        this.game.effects.createPulse(e.x, e.footY - 70, '#dff4fb');
    }

    // Bir noktada rakibin klonu var mı. Klon insan gibi vurulabiliyor:
    // yakın dövüş, mermi ve ışın onu kırıyor - yoksa "hangisi asıl" sorusunun
    // cevabı yalnızca beklemek olurdu.
    cloneAt(x, y, attacker) {
        for (const e of this.entities) {
            if (e.type !== 'clone' || e.owner === attacker) continue;
            if (Math.abs(x - e.x) > 44) continue;
            if (y < e.footY - 190 || y > e.footY + 20) continue;
            return e;
        }
        return null;
    }

    // Buz yolu: buzun ayağından rakibe doğru uzayan bir buz şeridi. NORMAL
    // HIZLA uzuyor - yürüyen rakip kaçabilir, duran kaçamaz.
    //
    // Rakip yüksekteyse (basamakta) yol onun sütununda YUKARI dönüyor. Ucu
    // rakibe denk gelirse rakip donuyor; ıskalarsa yol boşa uzayıp sönüyor.
    spawnPath(player, ability) {
        this.entities.push({
            type: 'path',
            x: player.x,               // yolun başladığı yer
            y: player.footY,           // yatay parçanın zemini
            dir: player.dir,
            len: 0,
            climb: 0,                  // dikey parçanın boyu
            turnAt: null,              // yolun yukarı döndüğü x
            spec: ability,
            owner: player,
            done: false,               // ucu bir yere değdi mi (dondurdu ya da bitti)
            fade: 0
        });
        this.game.effects.createPulse(player.x, player.footY, '#dff4fb');
    }

    // Yolun ucu: yatay parça bitmişse tırmanan uç.
    pathTip(e) {
        return {
            x: e.x + e.dir * e.len,
            y: e.turnAt !== null ? e.y - e.climb : e.y
        };
    }

    stepPath(e) {
        const spec = e.spec;
        const enemy = this.game.getEnemyOf(e.owner);

        if (e.done) {
            e.fade++;
            return e.fade > 40;
        }

        if (e.turnAt === null) e.len += spec.speed;
        else e.climb += spec.climbSpeed;

        const tip = this.pathTip(e);

        // Ucu rakibe DENK GELDİ Mİ. Yalnızca uç dondurur: yolun ortasından
        // atlayan rakip donmuyor, geçtiği yer artık sıradan buz.
        if (enemy && !enemy.isDead &&
            Math.abs(tip.x - enemy.x) < enemy.width / 2 + spec.width / 2 &&
            tip.y < enemy.footY + 24 && tip.y > enemy.footY - enemy.height) {
            enemy.freeze();
            e.done = true;
            return false;
        }

        // Rakibin sütununa gelindi ve rakip YÜKSEKTE: yol yukarı dönüyor.
        if (e.turnAt === null && enemy && !enemy.isDead &&
            Math.abs(tip.x - enemy.x) < spec.width &&
            enemy.footY < e.y - 40) {
            e.turnAt = tip.x;
        }

        if (e.turnAt !== null && e.climb > spec.maxClimb) e.done = true;
        if (e.len > spec.maxLength) e.done = true;
        if (tip.x < 0 || tip.x > this.game.canvas.width) e.done = true;
        return false;
    }

    // Klonun bir karesi: rakibe yürüyor, menzile girince kılıç sallıyor.
    // Basamakları da kullanıyor - rakip yukarı kaçınca klon peşinden zıplıyor,
    // yoksa "yukarıda dur" klonun tek cevabı olurdu.
    stepClone(e) {
        const { canvas } = this.game;
        const spec = e.spec;
        const enemy = this.game.getEnemyOf(e.owner);

        e.life--;
        if (e.flash > 0) e.flash--;
        if (e.anim && ++e.anim.frame >= e.anim.total) e.anim = null;

        if (e.birth > 0) e.birth--;

        if (e.birth <= 0 && enemy && !enemy.isDead) {
            e.dir = enemy.x >= e.x ? 1 : -1;
            const gap = Math.abs(enemy.x - e.x);
            if (gap > spec.reach * 0.7) e.x += e.dir * spec.speed;

            // Rakip yukarıdaysa zıpla
            if (e.grounded && enemy.footY < e.footY - 60 && gap < 320) {
                e.vy = PHYSICS.jumpVelocity;
                e.grounded = false;
            }

            if (e.attackTimer > 0) e.attackTimer--;
            if (e.attackTimer <= 0 && gap < spec.reach &&
                Math.abs(enemy.footY - e.footY) < 120) {
                enemy.takeDamage(spec.damage, { kind: 'basic', from: e.owner });
                this.game.effects.createExplosion(enemy.x, enemy.y, '#dff4fb');
                e.attackTimer = spec.attackInterval;
                e.anim = { id: 'sword', frame: 0, total: spec.animFrames };
            }
        }

        e.x = Math.max(40, Math.min(canvas.width - 40, e.x));

        // Fizik: oyuncununkinin sadeleştirilmiş hâli (basamaklar tek yönlü)
        const prevFoot = e.footY;
        e.vy += PHYSICS.gravity;
        e.footY += e.vy;
        const floor = canvas.height - PHYSICS.groundOffset;
        let land = e.footY >= floor ? floor : null;
        if (e.vy >= 0) {
            for (const s of this.game.ledges) {
                if (e.x < s.x || e.x > s.x + s.w) continue;
                if (prevFoot > s.y + 1 || e.footY < s.y) continue;
                if (land === null || s.y < land) land = s.y;
            }
        }
        e.grounded = land !== null;
        if (e.grounded) {
            e.footY = land;
            e.vy = 0;
        }

        if (e.hp <= 0 || e.life <= 0) {
            this.killClone(e);
            return true;
        }
        return false;
    }

    spawnArm(player, ability) {
        // Kol ıskalarsa bekleme süresi YOK (abilities.js'te cooldown 0);
        // bedeli yakaladığında ödeniyor.
        //
        // Fırlatılan şey MERCAN kolu: gövdede de durmasın diye sprite'ın o
        // kolu gizleniyor (bkz. Player.limbOut). Animasyon 30 kare, ama kol
        // dört saniyeye kadar arenada kalabiliyor - o yüzden gizleme
        // animasyona değil kolun ömrüne bağlı.
        player.limbOut = -1;
        this.entities.push({
            type: 'arm',
            x: player.x,
            y: player.y - player.height * 0.15,
            dir: player.dir,
            length: 0,
            spec: ability,
            owner: player,
            state: 'out'
        });
    }

    blink(player, ability) {
        const { canvas } = this.game;
        this.game.effects.createExplosion(player.x, player.y, '#ffe66d');
        player.x = ability.margin + Math.random() * (canvas.width - ability.margin * 2);
        player.y = player.groundY;
        player.vx = 0;
        player.vy = 0;
        this.game.effects.createExplosion(player.x, player.y, '#7dd3fc');
    }

    // ---- yürütme ----

    hitsPlayer(e, player) {
        if (!player || player.isDead || player === e.owner) return false;
        return Math.abs(e.x - player.x) < player.width / 2 + e.r &&
               Math.abs(e.y - player.y) < player.height / 2 + e.r;
    }

    update() {
        const { canvas, frame } = this.game;
        const players = [this.game.p1, this.game.p2].filter(Boolean);

        // Yavaşlatma her karede sıfırdan kuruluyor: iz üstünden çıkan
        // karakter hemen normale dönsün.
        for (const p of players) p.speedMultiplier = 1;

        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            let dead = false;

            switch (e.type) {
                case 'shot':
                case 'mass': {
                    if (e.gravity) e.vy += e.gravity;
                    e.x += e.vx;
                    e.y += e.vy;
                    e.life--;
                    for (const p of players) {
                        if (!this.hitsPlayer(e, p)) continue;
                        p.takeDamage(e.damage, { kind: e.kind, from: e.owner });
                        this.game.effects.createPulse(e.x, e.y, e.owner.fighter.themeColor);
                        dead = true;
                    }
                    // Klon mermiyi de yiyor: rakip uzaktan atarken de hangisine
                    // attığına karar vermek zorunda.
                    if (!dead) {
                        const hitClone = this.cloneAt(e.x, e.y, e.owner);
                        if (hitClone) {
                            this.hurtClone(hitClone, e.damage);
                            dead = true;
                        }
                    }
                    if (e.x < -40 || e.x > canvas.width + 40 || e.y < -60 || e.y > canvas.height + 40) dead = true;
                    if (e.life <= 0) dead = true;
                    break;
                }
                case 'beam': {
                    e.life--;
                    const lo = Math.min(e.x0, e.x1);
                    const hi = Math.max(e.x0, e.x1);
                    if (frame >= e.nextTick) {
                        for (const p of players) {
                            if (p === e.owner || p.isDead) continue;
                            if (p.x + p.width / 2 < lo || p.x - p.width / 2 > hi) continue;
                            if (Math.abs(p.y - e.y) > p.height / 2 + e.thickness) continue;
                            p.takeDamage(e.damage, { kind: 'basic', from: e.owner });
                            e.nextTick = frame + e.tickInterval;
                        }
                        // Işın klonu da kesiyor: hattın üstünde duran klon
                        // erimeli, yoksa buz klonu ışının içine park ederdi.
                        for (const c of this.entities) {
                            if (c.type !== 'clone' || c.owner === e.owner) continue;
                            if (c.x < lo || c.x > hi) continue;
                            if (Math.abs(c.footY - 70 - e.y) > 90) continue;
                            this.hurtClone(c, e.damage);
                            e.nextTick = frame + e.tickInterval;
                        }
                    }
                    if (e.life <= 0) dead = true;
                    break;
                }
                case 'orb': {
                    e.life--;
                    e.timer--;
                    if (e.timer <= 0 && e.volleysLeft > 0) {
                        this.fireMass(e);
                        e.volleysLeft--;
                        e.timer = e.spec.volleyInterval;
                    }
                    if (e.life <= 0) dead = true;
                    break;
                }
                case 'piece': {
                    e.life--;
                    const target = this.game.getEnemyOf(e.owner);
                    if (target && !target.isDead) {
                        const goal = target.x + e.offset;
                        if (Math.abs(goal - e.x) > e.speed) e.x += Math.sign(goal - e.x) * e.speed;
                    }
                    e.vy += 0.6;
                    e.y += e.vy;
                    const floor = canvas.height - 15 - PX * 3;
                    if (e.y > floor) { e.y = floor; e.vy = 0; }

                    if (e.biteTimer > 0) e.biteTimer--;
                    if (target && !target.isDead && e.biteTimer <= 0 &&
                        Math.abs(target.x - e.x) < e.biteRange &&
                        Math.abs(target.y - e.y) < target.height) {
                        target.takeTickDamage(e.damage);
                        e.biteTimer = e.biteInterval;
                    }
                    if (e.life <= 0) dead = true;
                    break;
                }
                case 'trail': {
                    e.life--;
                    for (const p of players) {
                        if (p === e.owner || p.isDead) continue;
                        if (Math.abs(p.x - e.x) > e.w / 2 + p.width / 2) continue;
                        if (Math.abs(p.footY - e.y) > 30) continue;
                        p.speedMultiplier = e.slow;
                    }
                    if (e.life <= 0) dead = true;
                    break;
                }
                case 'clone': {
                    dead = this.stepClone(e);
                    break;
                }
                case 'path': {
                    dead = this.stepPath(e);
                    break;
                }
                case 'arm': {
                    dead = this.stepArm(e);
                    // Kol döndü: gövdedeki kolu geri getir.
                    if (dead) e.owner.limbOut = 0;
                    break;
                }
            }

            if (dead) this.entities.splice(i, 1);
        }
    }

    // Enfekte kol: uzuyor, tutarsa aşamalı hasar veriyor, yakalanan kendi
    // saldırı tuşuna basarak kurtuluyor.
    stepArm(e) {
        const spec = e.spec;
        const owner = e.owner;
        const target = this.game.getEnemyOf(owner);

        if (e.state === 'out') {
            e.x = owner.x;
            e.y = owner.y - owner.height * 0.15;
            e.dir = owner.dir;
            e.length += spec.speed;

            const tip = e.x + e.dir * e.length;
            if (target && !target.isDead && !target.invulnerable &&
                Math.abs(tip - target.x) < target.width / 2 + PX * 4 &&
                Math.abs(e.y - target.y) < target.height / 2) {
                e.state = 'hold';
                e.holdFrames = 0;
                e.tickTimer = spec.tickInterval;
                target.grabbedBy = owner;
                target.escapePresses = 0;
                owner.cooldowns[spec.id] = spec.cooldownOnHit;
                return false;
            }
            if (e.length >= spec.reach) return true;   // ıskaladı: bekleme yok
            return false;
        }

        // Tutma
        if (!target || target.isDead || target.grabbedBy !== owner) return true;
        e.x = owner.x;
        e.y = owner.y - owner.height * 0.15;
        e.dir = target.x >= owner.x ? 1 : -1;
        e.length = Math.abs(target.x - owner.x);
        e.holdFrames++;

        if (--e.tickTimer <= 0) {
            target.takeTickDamage(spec.tickDamage);
            e.tickTimer = spec.tickInterval;
        }

        if (target.escapePresses >= spec.escapePresses || e.holdFrames >= spec.maxHold) {
            target.grabbedBy = null;
            target.escapePresses = 0;
            target.vx = e.dir * 14;
            return true;
        }
        return false;
    }

    // ---- çizim ----

    draw(ctx) {
        for (const e of this.entities) {
            switch (e.type) {
                case 'shot': this.drawShot(ctx, e); break;
                case 'mass': this.drawMass(ctx, e); break;
                case 'beam': this.drawBeam(ctx, e); break;
                case 'orb': this.drawOrb(ctx, e); break;
                case 'piece': this.drawPiece(ctx, e); break;
                case 'trail': this.drawTrail(ctx, e); break;
                case 'clone': this.drawClone(ctx, e); break;
                case 'path': this.drawPath(ctx, e); break;
                case 'arm': this.drawArm(ctx, e); break;
            }
        }
    }

    // Küçük, biçimsiz, hızlı: gövde bir blok, kenarlarında düzensiz çentikler.
    drawShot(ctx, e) {
        const r = Math.round(e.r / PX) * PX;
        ctx.fillStyle = '#7f2a20';
        ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
        ctx.fillStyle = '#f2795c';
        ctx.fillRect(e.x - r + PX, e.y - r + PX, r * 2 - PX * 2, r * 2 - PX * 2);
        ctx.fillStyle = '#ffb9a3';
        const s = e.seed;
        ctx.fillRect(e.x - r + PX * ((s % 2) + 1), e.y - r, PX, PX);
        ctx.fillRect(e.x + r - PX, e.y + PX * ((s >> 1) % 2), PX, PX);
        ctx.fillRect(e.x - r, e.y - PX * ((s >> 2) % 2), PX, PX);
    }

    // Beyaz elektrik kütlesi: köşeleri kesilmiş bir yığın, kenarları her
    // karede çatırdıyor. Düz beyaz bir kare "kütle" değil "kutu" okunuyordu.
    drawMass(ctx, e) {
        const r = Math.round(e.r / PX) * PX;
        const t = this.game.frame;
        const cx = Math.round(e.x / PX) * PX;
        const cy = Math.round(e.y / PX) * PX;

        // Gövde: satır satır, köşelerde daralarak
        const rows = (r * 2) / PX;
        for (let i = 0; i < rows; i++) {
            const d = Math.abs(i - (rows - 1) / 2) / ((rows - 1) / 2);   // 0 orta, 1 uç
            const half = Math.round((r * (1 - d * d * 0.55)) / PX) * PX;
            ctx.fillStyle = '#7dd3fc';
            ctx.fillRect(cx - half, cy - r + i * PX, half * 2, PX);
            if (half > PX * 2) {
                ctx.fillStyle = '#f8fbff';
                ctx.fillRect(cx - half + PX, cy - r + i * PX, half * 2 - PX * 2, PX);
            }
        }

        // Çekirdek: sönüp yanan bir çekirdek, kütlenin canlı durduğunu söyler
        ctx.fillStyle = (t >> 2) % 2 ? '#ffffff' : '#bfdbfe';
        ctx.fillRect(cx - PX * 2, cy - PX * 2, PX * 4, PX * 4);

        // Kenarlardan fırlayan kıvılcımlar
        ctx.fillStyle = '#e0f2fe';
        for (let i = 0; i < 5; i++) {
            const a = t * 0.24 + (i * Math.PI * 2) / 5;
            const d = r + PX * (1 + ((t >> 3) + i) % 3);
            ctx.fillRect(
                Math.round((e.x + Math.cos(a) * d) / PX) * PX,
                Math.round((e.y + Math.sin(a) * d) / PX) * PX,
                PX, PX
            );
        }
    }

    // Işın katman katman: dıştan içe lacivert, sarı, beyaz çekirdek. Tek
    // renkli ince bir çizgi "ışın" değil "tel" gibi duruyordu.
    drawBeam(ctx, e) {
        const fade = Math.min(1, e.life / 40);
        const lo = Math.round(Math.min(e.x0, e.x1) / PX) * PX;
        const w = Math.abs(e.x1 - e.x0);
        const t = this.game.frame;
        const y = Math.round(e.y / PX) * PX;
        const half = Math.round(e.thickness / 2 / PX) * PX;

        ctx.save();
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(lo, y - half, w, half * 2);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(lo, y - half + PX, w, half * 2 - PX * 2);
        ctx.fillStyle = '#fffbeb';
        ctx.fillRect(lo, y - PX, w, PX * 2);

        // Hattın içinde koşuşan kıvılcımlar ve dışına taşan çatırtılar:
        // durmuş bir çizgi değil, yerinde duran ama yaşayan bir hat.
        ctx.fillStyle = '#e0f2fe';
        for (let x = lo + ((t * 6) % (PX * 6)); x < lo + w; x += PX * 6) {
            const up = ((x / PX) | 0) % 2 === 0;
            ctx.fillRect(Math.round(x / PX) * PX, up ? y - half - PX * 2 : y + half, PX, PX * 2);
        }
        ctx.restore();
    }

    drawOrb(ctx, e) {
        const t = this.game.frame;
        const r = PX * 8 + (Math.sin(t * 0.15) > 0 ? PX : 0);
        const cx = Math.round(e.x / PX) * PX;
        const cy = Math.round(e.y / PX) * PX;

        // Küre: satırlar uçlara doğru daralıyor. Kare çizilince "kutu"
        // okunuyordu; kütlelerin çıktığı yer yuvarlak durmalı.
        const rows = (r * 2) / PX;
        for (let i = 0; i < rows; i++) {
            const d = Math.abs(i - (rows - 1) / 2) / ((rows - 1) / 2);
            const half = Math.round((r * Math.sqrt(Math.max(0, 1 - d * d))) / PX) * PX;
            if (half <= 0) continue;
            ctx.fillStyle = '#1e3a8a';
            ctx.fillRect(cx - half - PX, cy - r + i * PX, (half + PX) * 2, PX);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(cx - half, cy - r + i * PX, half * 2, PX);
        }
        ctx.fillStyle = (t >> 2) % 2 ? '#ffffff' : '#fef3c7';
        ctx.fillRect(cx - PX * 2, cy - PX * 2, PX * 4, PX * 4);
        ctx.fillStyle = '#e0f2fe';
        for (let i = 0; i < 6; i++) {
            const a = t * 0.1 + (i * Math.PI) / 3;
            const d = r + PX * 3 + (i % 2) * PX * 2;
            ctx.fillRect(
                Math.round((e.x + Math.cos(a) * d) / PX) * PX,
                Math.round((e.y + Math.sin(a) * d) / PX) * PX,
                PX, PX
            );
        }
    }

    // Küçük virüs: büyüğünün küçültülmüş hâli değil, kendi başına duran bir
    // parça - sırtı kabarık, altından iki kısa uzantı, iki nokta göz. Yürürken
    // hafifçe zıplıyor, dört parça tek bir yığın gibi okunmasın diye.
    drawPiece(ctx, e) {
        const x = Math.round(e.x / PX) * PX;
        const y = Math.round(e.y / PX) * PX;
        const bob = (Math.floor(this.game.frame / 8) + e.seed) % 2 === 0 ? 0 : PX;

        // Bacaklar
        ctx.fillStyle = '#3f5f16';
        ctx.fillRect(x - PX * 3, y - PX * 2, PX * 2, PX * 2);
        ctx.fillRect(x + PX, y - PX * 2 - bob, PX * 2, PX * 2 + bob);

        // Gövde
        ctx.fillStyle = '#3f5f16';
        ctx.fillRect(x - PX * 4, y - PX * 7 - bob, PX * 8, PX * 5);
        ctx.fillStyle = '#6ea32c';
        ctx.fillRect(x - PX * 3, y - PX * 6 - bob, PX * 6, PX * 4);

        // Kabaran sırt
        ctx.fillStyle = '#3f5f16';
        ctx.fillRect(x - PX * 2, y - PX * 9 - bob, PX * 4, PX * 2);
        ctx.fillStyle = '#87c33a';
        ctx.fillRect(x - PX, y - PX * 9 - bob, PX * 2, PX);

        // Gözler
        ctx.fillStyle = '#0d1a05';
        ctx.fillRect(x - PX * 3, y - PX * 6 - bob, PX, PX);
        ctx.fillRect(x + PX * 2, y - PX * 6 - bob, PX, PX);

        // Damlayan uçlar
        ctx.fillStyle = '#87c33a';
        ctx.fillRect(x - PX * 4, y - PX * 4 - bob, PX, PX * 2);
        ctx.fillRect(x + PX * 3, y - PX * 5 - bob, PX, PX * 2);
    }

    drawTrail(ctx, e) {
        const fade = Math.min(1, e.life / 60);
        const w = Math.round(e.w / PX) * PX;
        ctx.save();
        ctx.globalAlpha = 0.8 * fade;
        ctx.fillStyle = '#2f4a12';
        ctx.fillRect(e.x - w / 2, e.y - PX * 3, w, PX * 3);
        ctx.fillStyle = '#6ea32c';
        ctx.fillRect(e.x - w / 2 + PX, e.y - PX * 2, w - PX * 2, PX * 2);
        // Kenarları düz değil: birikinti kalıp değil, yayılmış bir şey
        ctx.fillStyle = '#87c33a';
        for (let x = e.x - w / 2; x < e.x + w / 2; x += PX * 3) {
            if (((x / PX) | 0) % 2 === 0) ctx.fillRect(x, e.y - PX * 4, PX * 2, PX);
        }
        ctx.restore();
    }

    // Klon: buzun kendisiyle AYNI çizim. Renk oynaması, saydamlık, işaret
    // yok - "hangisi asıl" sorusunun cevabı görüntüde olsaydı klonun hiçbir
    // anlamı kalmazdı. Tek fark vurulduğunda yanıp sönmesi (asıl da yanıyor).
    drawClone(ctx, e) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (e.flash > 0 && e.flash % 4 < 2) ctx.globalAlpha = 0.25;
        const pose = e.anim
            ? { id: e.anim.id, t: e.anim.frame / e.anim.total, dir: e.dir }
            : null;
        drawFighter(ctx, 'ice', e.x, e.footY, this.game.frame, pose);
        ctx.restore();
    }

    // Buz yolu: zeminde uzayan bir buz şeridi, ucunda büyüyen kristaller.
    // Ucu ayrıca vurgulu - dondurmanın yalnızca UÇTA olduğu görüntüden
    // okunmalı, kural metninden değil.
    drawPath(ctx, e) {
        const spec = e.spec;
        const tip = this.pathTip(e);
        const half = Math.round(spec.width / 2 / PX) * PX;
        const fade = e.done ? Math.max(0, 1 - e.fade / 40) : 1;

        ctx.save();
        ctx.globalAlpha = 0.9 * fade;

        // Yatay parça: zemine yapışmış buz şeridi
        const x0 = Math.round(Math.min(e.x, e.x + e.dir * e.len) / PX) * PX;
        const x1 = Math.round(Math.max(e.x, e.x + e.dir * e.len) / PX) * PX;
        const top = Math.round((e.y - half) / PX) * PX;
        ctx.fillStyle = '#2f6c88';
        ctx.fillRect(x0, top, x1 - x0, half + PX * 2);
        ctx.fillStyle = '#5fb4e8';
        ctx.fillRect(x0, top + PX, x1 - x0, half);
        ctx.fillStyle = '#dff4fb';
        ctx.fillRect(x0, top + PX, x1 - x0, PX);

        // Şeridin üstünde büyüyen kırıklar: düz bir çubuk "buz" değil "ray"
        // okunuyordu; buz kendi kendine büyüyen bir şey.
        for (let x = x0; x < x1; x += PX * 5) {
            const h = Math.round(hash(x, 3, 61) * 3 + 1) * PX;
            ctx.fillStyle = hash(x, 4, 62) < 0.4 ? '#ffffff' : '#a8e0f0';
            ctx.fillRect(x, top - h + PX, PX * 2, h);
        }

        // Dikey parça: rakip yukarıdaysa sütun hâlinde tırmanıyor
        if (e.turnAt !== null) {
            const cx = Math.round(e.turnAt / PX) * PX;
            const ct = Math.round((e.y - e.climb) / PX) * PX;
            ctx.fillStyle = '#2f6c88';
            ctx.fillRect(cx - half, ct, half * 2, e.y - ct);
            ctx.fillStyle = '#5fb4e8';
            ctx.fillRect(cx - half + PX, ct, half * 2 - PX * 2, e.y - ct);
            ctx.fillStyle = '#dff4fb';
            ctx.fillRect(cx - half + PX, ct, PX, e.y - ct);
        }

        // Uç: dondurmayı yapan yer. Yıldız gibi açılan kristal.
        const tx = Math.round(tip.x / PX) * PX;
        const ty = Math.round(tip.y / PX) * PX;
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI * 2 * i) / 6 + this.game.frame * 0.04;
            ctx.fillStyle = i % 2 ? '#ffffff' : '#dff4fb';
            ctx.fillRect(Math.round((tx + Math.cos(a) * spec.width * 0.7) / PX) * PX,
                Math.round((ty - half + Math.sin(a) * spec.width * 0.5) / PX) * PX,
                PX * 2, PX * 2);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tx - PX * 2, ty - half - PX * 2, PX * 4, PX * 4);
        ctx.restore();
    }

    drawArm(ctx, e) {
        const len = e.length;
        const x0 = e.x;
        const step = PX * 3;

        // Kolun KÖKÜ omuzda. Sprite'ta mercan kol karakterin sağ omzunda
        // (izleyicinin solunda) duruyor ve fırlatılırken oradan gizleniyor;
        // buradan çıkmazsa kol gövdenin ortasından biten ayrı bir şey gibi
        // duruyor. Vuran kutu değişmiyor - uç hesabı hâlâ e.x'ten.
        const shoulder = e.owner.x - PX * 10;
        ctx.fillStyle = '#7f2a20';
        ctx.fillRect(Math.min(shoulder, x0), e.y - PX * 2, Math.abs(x0 - shoulder) + PX, PX * 4);
        ctx.fillStyle = '#f2795c';
        ctx.fillRect(Math.min(shoulder, x0), e.y - PX, Math.abs(x0 - shoulder) + PX, PX * 2);
        for (let d = 0; d < len; d += step) {
            const x = x0 + e.dir * d;
            const wob = ((d / step) | 0) % 2 === 0 ? 0 : PX;
            ctx.fillStyle = '#7f2a20';
            ctx.fillRect(x, e.y - PX * 2 + wob, step, PX * 4);
            ctx.fillStyle = '#f2795c';
            ctx.fillRect(x, e.y - PX + wob, step, PX * 2);
        }
        // Ucundaki küçük kafa
        const tip = x0 + e.dir * len;
        ctx.fillStyle = '#7f2a20';
        ctx.fillRect(tip - PX * 2, e.y - PX * 3, PX * 5, PX * 6);
        ctx.fillStyle = '#f2795c';
        ctx.fillRect(tip - PX, e.y - PX * 2, PX * 3, PX * 4);
        ctx.fillStyle = '#1b0d0a';
        ctx.fillRect(tip, e.y - PX, PX, PX);
        ctx.fillRect(tip + PX * 2, e.y - PX, PX, PX);
    }

    // Yakalanan oyuncunun üstünde "şuna bas" kutusu. Simge, YAKALANAN
    // oyuncunun kendi cihazına göre: iki oyuncu iki ayrı cihazda olabilir,
    // device.js'in "son girdi kazanır"ı burada yanlış simge gösterir.
    drawGrabPrompt(ctx) {
        for (const p of [this.game.p1, this.game.p2]) {
            if (!p || !p.grabbedBy) continue;
            const spec = ABILITIES[p.grabbedBy.fighter.id]?.signature;
            if (!spec) continue;

            const left = Math.max(0, spec.escapePresses - p.escapePresses);
            const boxY = p.y - p.height / 2 - PX * 16;
            const label = keyCapLabel(p.actionKeys.attack);
            const usePad = p.onPad;

            const iconW = usePad ? PAD_GLYPHS.square.rows[0].length * GLYPH_PX
                                 : measurePixelText(label, 2) + PX * 5;
            const caption = `${left}`;
            const capW = measurePixelText(caption, 2);
            const boxW = iconW + PX * 3 + capW + PX * 6;
            const boxH = PX * 13;
            const x = Math.round((p.x - boxW / 2) / PX) * PX;

            ctx.save();
            ctx.fillStyle = '#0b1220';
            ctx.fillRect(x - PX, boxY - PX, boxW + PX * 2, boxH + PX * 2);
            ctx.fillStyle = '#f2795c';
            ctx.fillRect(x, boxY, boxW, PX);
            ctx.fillRect(x, boxY + boxH - PX, boxW, PX);

            const iconY = boxY + PX * 2;
            if (usePad) {
                drawPadGlyph(ctx, 'square', x + PX * 3, iconY);
            } else {
                ctx.fillStyle = '#94a3b8';
                ctx.fillRect(x + PX * 3, iconY + PX, iconW, PX * 9);
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(x + PX * 3, iconY, iconW, PX * 9);
                drawPixelText(ctx, label, x + PX * 3 + iconW / 2, iconY + PX * 2,
                    { scale: 2, color: '#111827', align: 'center' });
            }
            drawPixelText(ctx, caption, x + boxW - PX * 3 - capW, boxY + PX * 4,
                { scale: 2, color: '#ffd7cc', shadow: '#000000' });
            ctx.restore();
        }
    }
}
