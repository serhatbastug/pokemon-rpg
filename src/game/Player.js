import {
    PHYSICS, COMBAT,
    PAD_JUMP_BUTTON, PAD_ATTACK_BUTTON, PAD_SPECIAL_BUTTON, PAD_BLOCK_BUTTON, PAD_COMBO_BUTTON
} from '../config/settings.js';
import { drawFighter, FIGHTER_SPRITES } from './fighterArt.js';
import { hash } from '../pixel/pixelDraw.js';
import { abilitiesOf, abilityOf, DASHES, FREEZE } from './abilities.js';

// Bir karenin girdi anlık görüntüsü. Basılı tutmayı da, "yeni basıldı"yı da
// buradan okuyoruz: kol tuşları için tarayıcıda olay yok, klavye ile aynı
// yoldan gitmek iki cihaz arasındaki farkı ortadan kaldırıyor.
// Kombo dalında klavye ile kolun tuşları AYRI okunuyor: kolda sola atılma
// KARE, klavyede A. İkisini tek ada indirirsek kolda "sola atılma" ile
// klavyede "karakterin kendi hamlesi" aynı tuşa düşüyor.
const ACTIONS = [
    'jump', 'attack', 'special', 'block', 'combo', 'left', 'right', 'down',
    'keyAttack', 'padSquare', 'padCircle', 'padTriangle'
];

// Arenadaki bir oyuncu: hareket, fizik, blok, bekleme süreleri ve can.
//
// Hamlelerin KENDİSİ burada değil (bkz. combat.js): burada yalnızca "hangi
// hamle ne zaman çıkabilir" kararı var. Bölünme, ışın, küre gibi şeylerin
// arenada yaşayan parçaları var, onları Game tutuyor.
export class Player {
    constructor({ x, y, fighter, playerNum, color, controls, actionKeys, padSlot = null, game }) {
        this.x = x;
        this.y = y;
        this.spawnX = x;
        this.fighter = fighter;
        this.playerNum = playerNum;
        this.color = color;
        this.controls = controls;
        this.actionKeys = actionKeys;
        this.padSlot = padSlot;   // bu oyuncunun kolu (yoksa klavye)
        this.game = game;

        // Çarpışma kutusu sprite'ın kendi ölçüsü: virüs anti-virüsten hem
        // daha geniş hem daha kütleli, ikisini aynı kutuya sokmak yanlış olur.
        const sprite = FIGHTER_SPRITES[fighter.id]?.();
        this.width = sprite ? sprite.w * 0.55 : 80;
        this.height = sprite ? sprite.h : 160;

        this.maxHp = fighter.stats.hp;
        this.hp = this.maxHp;
        this.speed = fighter.stats.speed;
        this.dir = playerNum === 1 ? 1 : -1;
        this.vy = 0;
        this.vx = 0;          // atılma ve geri tepme; yürüyüşten ayrı

        // Ayak altında bir yüzey var mı (zemin ya da basamak). Zıplama buna
        // bakıyor: basamağın üstünden de zıplanabilmeli.
        this.grounded = true;
        // Basamaktan aşağı inerken basamakların görmezden gelindiği kareler
        this.dropFrames = 0;

        this.invulnerable = false;
        this.frozen = false;
        this.damageMultiplier = 1.0;
        this.speedMultiplier = 1.0;
        this.flashFrames = 0;
        this.invulnFrames = 0;
        this.isDead = false;

        // ICE-VİRÜS'ün BUZ YOLU'nun ucu değerse buraya düşüyor.
        // `frozen`den AYRI tutuluyor: `frozen`ı Game raunt aralarında her
        // karede yazıyor, donma oraya karışırsa dövüş sırasında siliniyor.
        this.frozenFrames = 0;     // donmuş kalan kare
        this.freezeImmune = 0;     // tekrar donmaya bağışık kalan kare

        // Bekleme süreleri: hamle kimliği -> kalan kare
        this.cooldowns = {};
        for (const ability of abilitiesOf(fighter.id)) this.cooldowns[ability.id] = 0;

        // Blok basılı tutulmuyor: bir basış kısa bir pencere açıyor.
        this.blockFrames = 0;
        this.blockCooldown = 0;

        // Yakın dövüş hamlesinin evreleri (hazırlık / vuran kare / toparlanma)
        this.action = null;

        // Saldırı animasyonu: hangi hamle, kaçıncı karesinde. Bekleme
        // süresinden AYRI - animasyon biter, hamle hâlâ beklemede olabilir.
        // Duruşu ve uzuvu fighterArt.js çiziyor.
        this.anim = null;

        // Arenada duran bir uzvu var mı (anti-virüsün fırlattığı enfekte kol).
        // Varsa o kol sprite'ta çizilmiyor - bkz. pose ve fighterArt.spriteFor.
        // combat.js kolu doğururken yazıyor, kol dönünce sıfırlıyor.
        this.limbOut = 0;

        // Anti-virüsün koluna yakalanınca: kurtulmak için kendi saldırı
        // tuşuna basmak gerekiyor.
        this.grabbedBy = null;
        this.escapePresses = 0;

        this.held = {};
        this.pressed = {};
        for (const name of ACTIONS) {
            this.held[name] = false;
            this.pressed[name] = false;
        }
    }

    // Ayakların değdiği çizgi: sprite ayak hizasından çiziliyor
    get footY() {
        return this.y + this.height / 2;
    }

    get isBlocking() {
        return this.blockFrames > 0;
    }

    // Çizime giden duruş: hangi hamle, ne kadarı geçti, hangi yöne dönük.
    //
    // hide: sprite'ta ÇİZİLMEYECEK uzuv. Arenada duran bir uzuv varsa
    // (anti-virüsün fırlattığı enfekte kol) o kol gövdede de durmamalı, ve
    // bu hamlenin ANİMASYONUNDAN uzun sürüyor - o yüzden duruş, animasyon
    // bitmiş olsa bile üretiliyor.
    get pose() {
        if (!this.anim) return this.limbOut ? { id: null, t: 0, dir: this.dir, hide: this.limbOut } : null;
        return {
            id: this.anim.id,
            t: this.anim.frame / this.anim.total,
            dir: this.dir,
            hide: this.limbOut
        };
    }

    startAnim(ability) {
        if (!ability?.animFrames) return;
        this.anim = { id: ability.id, frame: 0, total: ability.animFrames };
    }

    get onGround() {
        return this.grounded;
    }

    // Arenanın en alt zemini (y merkez cinsinden). Basamaklar bunun üstünde.
    get groundY() {
        return this.floorFoot - this.height / 2;
    }

    // Zeminin ayak çizgisi. Basamakların y'si de ayak çizgisi cinsinden.
    get floorFoot() {
        return this.game.canvas.height - PHYSICS.groundOffset;
    }

    // Ayakların bu karede değdiği yüzeyin ayak çizgisi; hiçbiri yoksa null.
    //
    // Basamaklar TEK YÖNLÜ: altlarından zıplayıp üstlerine çıkılır, içlerinden
    // geçilmez. Bu yüzden yalnızca DÜŞERKEN ve ayaklar basamağın üstünü o
    // karede geçtiyse iniliyor. Birden çok aday varsa en YÜKSEK olanı kazanır:
    // aşağı düşen figür ilk ona değer.
    landingFoot(prevFoot) {
        const foot = this.footY;
        let best = foot >= this.floorFoot ? this.floorFoot : null;
        if (this.vy < 0 || this.dropFrames > 0) return best;

        const half = this.width * 0.3;   // ayakların değdiği genişlik
        for (const s of this.game.ledges) {
            if (this.x + half < s.x || this.x - half > s.x + s.w) continue;
            if (prevFoot > s.y + 1 || foot < s.y) continue;
            if (best === null || s.y < best) best = s.y;
        }
        return best;
    }

    // Bu oyuncu kolla mı oynuyor? Ekrandaki tuş ipuçları buna bakıyor -
    // device.js'in "son girdi kazanır"ı iki oyunculu arenada yanlış cevap
    // verir, çünkü iki oyuncu iki ayrı cihazda olabilir.
    get onPad() {
        return this.padSlot !== null && this.padSlot < (this.game.gamepad?.padCount || 0);
    }

    draw(ctx) {
        if (this.isDead) return; // ölü karakter çizilmez, piksel patlaması devralır

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Hasar alınca yanıp sönme
        if (this.flashFrames > 0) {
            this.flashFrames--;
            if (this.flashFrames % 4 < 2) ctx.globalAlpha = 0.25;
        }

        // Sprite AYNALANMIYOR: iki karakterin de kimliği asimetrisinde
        // (anti-virüsün kaplı yanı, virüsün yüksek omzu). Aynalayınca hangi
        // yanın kaplı olduğu karaktere değil, rakibin yerine bağlı olurdu.
        drawFighter(ctx, this.fighter.id, this.x, this.footY, this.game.frame, this.pose);

        ctx.restore();

        if (this.frozenFrames > 0) this.drawFrozen(ctx);
        if (this.isBlocking) this.drawShield(ctx);
    }

    // Donmanın görüntüsü. KUTU DEĞİL: gövdeyi saran, düzensiz bir buz kütlesi.
    // Dikdörtgen bir kabuk "oyun bir kutu koydu" gibi duruyordu; buz gövdenin
    // biçimini alıp üstünden taşmalı - satırlar gövde profiline göre daralıp
    // genişliyor, kenarlardan dışarı kırıklar çıkıyor.
    //
    // Şekil KONUMA BAĞLI değil oyuncuya: hash'in tohumu gövdenin satırı, yani
    // desen donma boyunca sabit kalıyor. Her karede yeniden çekilse buz
    // kaynardı - donan şey kımıldamaz.
    drawFrozen(ctx) {
        const PXL = 4;
        const h = Math.round(this.height * 0.92 / PXL) * PXL;
        const top = this.footY - h;
        const rows = h / PXL;
        const k = 1 - this.frozenFrames / FREEZE.duration;   // 0 = yeni dondu

        ctx.save();

        // Gövdeyi saran kütle: her satırın kendi genişliği. Omuz hizasında
        // en geniş, tepede ve tabanda daralıyor - insan silueti gibi.
        for (let r = 0; r < rows; r++) {
            const t = r / rows;
            const profile = 0.42 + 0.58 * Math.sin(Math.min(1, t * 1.15) * Math.PI);
            const jitter = Math.round(hash(0, r, 71) * 2) * PXL;
            const half = Math.round((this.width * 0.62 * profile) / PXL) * PXL + jitter;
            if (half < PXL * 2) continue;
            const y = top + r * PXL;

            ctx.globalAlpha = 0.40;
            ctx.fillStyle = '#8fd4e8';
            ctx.fillRect(this.x - half, y, half * 2, PXL);

            // Kenar ışığı: buzun dış yüzeyi. Solda parlak, sağda koyu -
            // sahnenin ışığı hep soldan.
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#dff4fb';
            ctx.fillRect(this.x - half, y, PXL, PXL);
            ctx.fillStyle = '#4a90ad';
            ctx.fillRect(this.x + half - PXL, y, PXL, PXL);

            // İçerideki fase: kütleyi "cam" değil "buz" yapan şey
            if (hash(1, r, 72) < 0.3) {
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(this.x - half + PXL * 2 + Math.round(hash(2, r, 73) * 4) * PXL,
                    y, PXL * 2, PXL);
            }
        }

        // Dışarı büyüyen kırıklar: kütle düz bir siluet kalmasın
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < 7; i++) {
            const side = i % 2 ? 1 : -1;
            const ry = top + Math.round(hash(i, 3, 74) * rows) * PXL;
            const len = (2 + Math.round(hash(i, 4, 75) * 3)) * PXL;
            const rx = this.x + side * Math.round(this.width * 0.5 / PXL) * PXL;
            ctx.fillStyle = i % 3 ? '#dff4fb' : '#ffffff';
            ctx.fillRect(side > 0 ? rx : rx - len, ry, len, PXL);
        }

        // Çatlaklar: donma bitmek üzereyken çoğalıyor. Oyuncu ne zaman
        // çözüleceğini kabuğun kendisinden görmeli.
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        const cracks = Math.round(k * 5);
        for (let i = 0; i < cracks; i++) {
            const cy = top + PXL * (6 + i * 9);
            const cx = this.x - PXL * 5 + Math.round(hash(i, 5, 76) * 6) * PXL;
            ctx.fillRect(cx, cy, PXL * 4, PXL);
            ctx.fillRect(cx + PXL * 3, cy + PXL, PXL * 3, PXL);
        }
        ctx.restore();
    }

    // Blok penceresi açıkken karakterin önünde duran kalkan. Piksel dilinde:
    // düz bir dikdörtgen kenar, karakterin baktığı yanda.
    drawShield(ctx) {
        const PX = 4;
        const h = Math.round(this.height * 0.8 / PX) * PX;
        const top = this.footY - h - PX * 2;
        const edge = this.x + this.dir * (this.width / 2 + PX * 2);
        const alpha = Math.min(1, this.blockFrames / 8);

        ctx.save();
        ctx.globalAlpha = 0.55 * alpha;
        ctx.fillStyle = '#cfe9ff';
        ctx.fillRect(edge - (this.dir > 0 ? 0 : PX * 2), top, PX * 2, h);
        ctx.globalAlpha = 0.22 * alpha;
        ctx.fillStyle = '#7fb8ff';
        ctx.fillRect(edge - this.dir * PX * 3 - (this.dir > 0 ? 0 : PX * 2), top, PX * 3, h);
        ctx.restore();
    }

    // Bu oyuncunun kolunun sol analogu. Kolu yoksa nötr döner.
    padStick() {
        if (this.padSlot === null) return { x: 0, y: 0, magnitude: 0 };
        return this.game.gamepad?.stickAt(this.padSlot) || { x: 0, y: 0, magnitude: 0 };
    }

    // Bu oyuncunun kolunda bir tuş basılı mı
    padDown(button) {
        if (this.padSlot === null) return false;
        return !!this.game.gamepad?.isDownAt(this.padSlot, button);
    }

    // Klavye ve kol tek bir tabloya indirgeniyor; "yeni basıldı" da burada
    // üretiliyor, böylece iki cihaz aynı kodu kullanıyor.
    readInput() {
        const { input } = this.game;
        const k = this.actionKeys;
        const now = {
            jump:    input.isDown(this.controls.up) || this.padDown(PAD_JUMP_BUTTON),
            attack:  input.isDown(k.attack) || this.padDown(PAD_ATTACK_BUTTON),
            special: input.isDown(k.special) || this.padDown(PAD_SPECIAL_BUTTON),
            block:   input.isDown(k.block) || this.padDown(PAD_BLOCK_BUTTON),
            combo:   input.isDown(k.combo) || this.padDown(PAD_COMBO_BUTTON),
            left:    input.isDown(this.controls.left),
            right:   input.isDown(this.controls.right),
            down:    input.isDown(this.controls.down) || this.padStick().y > 0.5,
            keyAttack:   input.isDown(k.attack),
            padSquare:   this.padDown(PAD_ATTACK_BUTTON),
            padCircle:   this.padDown(PAD_SPECIAL_BUTTON),
            padTriangle: this.padDown('triangle')
        };
        for (const name of ACTIONS) {
            this.pressed[name] = now[name] && !this.held[name];
            this.held[name] = now[name];
        }
    }

    tickTimers() {
        for (const id of Object.keys(this.cooldowns)) {
            if (this.cooldowns[id] > 0) this.cooldowns[id]--;
        }
        if (this.anim && ++this.anim.frame >= this.anim.total) this.anim = null;
        if (this.blockFrames > 0) this.blockFrames--;
        if (this.blockCooldown > 0) this.blockCooldown--;
        if (this.invulnFrames > 0) {
            this.invulnFrames--;
            if (this.invulnFrames === 0) this.invulnerable = false;
        }

        if (this.frozenFrames > 0) this.frozenFrames--;
        if (this.freezeImmune > 0) this.freezeImmune--;
    }

    // Buz yolunun ucu değdi: rakip donuyor. Bağışıklık açıkken hiçbir şey
    // olmuyor - zincirleme donma yok, dövüş tek bir hamlenin etrafında
    // kilitlenemez.
    freeze() {
        if (this.isDead || this.game.isGameOver) return false;
        const { effects } = this.game;

        if (this.freezeImmune > 0) {
            effects.spawnText(this.x, this.y - 90, 'ÇÖZÜLDÜ', '#bfefff');
            return false;
        }

        this.frozenFrames = FREEZE.duration;
        this.freezeImmune = FREEZE.duration + FREEZE.immune;
        this.action = null;
        this.anim = null;
        this.vx = 0;
        effects.spawnText(this.x, this.y - 90, 'DONDU!', '#eaffff', true);
        effects.triggerFlash('rgba(191, 239, 255, 0.22)', 5);
        effects.createPulse(this.x, this.y, '#dff4fb');
        return true;
    }

    ready(ability) {
        return !!ability && (this.cooldowns[ability.id] || 0) <= 0;
    }

    // Kombo tuşu (L1 / Shift) BASILI TUTULUYORSA diğer tuşlar kombo hâline
    // geçer: normal saldırı, özel ve zıplama o karede çıkmaz.
    handleActions() {
        // Donmuş oyuncu hamle çıkaramaz: donmanın bütün değeri rakibin
        // SIRASINI kesmesi. Yalnızca yavaşlatsaydı salgın izinden farkı olmazdı.
        if (this.action || this.grabbedBy || this.frozenFrames > 0) return;

        if (this.held.combo) {
            if (this.pressed.jump) return this.useDash(DASHES[0]);                        // L1+ÇARPI / Shift+yukarı
            if (this.pressed.left || this.pressed.padSquare) return this.useDash(DASHES[1]);   // L1+KARE / Shift+sol
            if (this.pressed.right || this.pressed.padCircle) return this.useDash(DASHES[2]);  // L1+DAİRE / Shift+sağ
            if (this.pressed.padTriangle || this.pressed.keyAttack) return this.useAbility('signature');
            return;
        }

        if (this.pressed.block) return this.startBlock();
        if (this.pressed.attack) return this.useAbility('basic');
        if (this.pressed.special) return this.useAbility('special');
    }

    startBlock() {
        if (this.blockCooldown > 0) return;
        this.blockFrames = COMBAT.blockWindow;
        this.blockCooldown = COMBAT.blockWindow + COMBAT.blockCooldown;
    }

    useDash(dash) {
        if (!this.ready(dash)) return;
        this.cooldowns[dash.id] = dash.cooldown;
        this.startAnim(dash);
        this.vx = dash.velocity.x;
        this.vy = dash.velocity.y;
        this.game.combat.onDash(this, dash);
    }

    useAbility(slot) {
        const ability = abilityOf(this.fighter.id, slot);
        if (!this.ready(ability)) return;

        // Yakın dövüş hamlesi evreli: hazırlık, vuran kare, toparlanma.
        // Menzillilerde tek karelik bir hazırlık yetiyor.
        this.startAnim(ability);
        if (ability.kind === 'melee') {
            this.action = { ability, frame: 0 };
            this.cooldowns[ability.id] = ability.cooldown;
            return;
        }
        this.cooldowns[ability.id] = ability.cooldown;
        this.game.combat.perform(this, ability);
    }

    stepAction() {
        if (!this.action) return;
        const { ability } = this.action;
        const f = this.action.frame++;

        if (f === 0) this.vx = this.dir * (ability.lunge || 0) / 5;

        const activeStart = ability.startup;
        const activeEnd = ability.startup + ability.active;
        if (f >= activeStart && f < activeEnd) this.game.combat.meleeHit(this, ability);
        if (f >= activeEnd + ability.recovery) this.action = null;
    }

    move() {
        // Donmuş karakter havadaysa OLDUĞU YERDE asılı kalıyor: yer çekimi de
        // duruyor. Raunt aralarının donması (`frozen`) da aynı yoldan geçiyor,
        // ikisi tek davranış olsun. Buz için ayrıca doğru duruyor - donan şey
        // düşmez, kalır.
        if (this.frozen || this.grabbedBy || this.frozenFrames > 0) {
            this.vx *= 0.7;
            return;
        }

        const { input, canvas } = this.game;
        const moveSpeed = this.speed * this.speedMultiplier;

        // Yatay hareket: klavye tuşları ile kolun sol analogu aynı işi görür.
        // Klavyede iki yön birden basılıysa birbirini götürür; kolda analog
        // yarım itilirse karakter daha yavaş yürür.
        // Kombo tuşu basılıyken yürüme kapanmıyor - yalnızca tuşlar kombo
        // okuyor; oyuncu atılmayı beklerken yerinde çakılı kalmasın.
        let dx = 0;
        if (!this.action) {
            if (input.isDown(this.controls.left)) dx -= 1;
            if (input.isDown(this.controls.right)) dx += 1;
            if (dx === 0) dx = this.padStick().x;
        }

        this.x += dx * moveSpeed + this.vx;
        this.vx *= 0.86;
        if (Math.abs(this.vx) < 0.3) this.vx = 0;
        this.x = Math.min(canvas.width - this.width / 2, Math.max(this.width / 2, this.x));

        // Yerçekimi, zıplama ve basamaklar. Zıplama "yerde miyim"e değil
        // "ayak altımda bir şey var mı"ya bakıyor: basamağın üstünden de
        // zıplanabilmeli. Havada zıplanamıyor, uçmak yok.
        const prevFoot = this.footY;

        if (!this.held.combo && this.held.jump && this.grounded) {
            this.vy = PHYSICS.jumpVelocity;
            this.grounded = false;
        }

        // Basamağın üstündeyken AŞAĞI: sekiden aşağı süzülme. Kısa bir süre
        // basamaklar görmezden geliniyor, yoksa karakter aynı karede geri biner.
        if (this.pressed.down && this.grounded && prevFoot < this.floorFoot - 1) {
            this.dropFrames = PHYSICS.dropFrames;
            this.grounded = false;
        }

        this.vy += PHYSICS.gravity;
        this.y += this.vy;
        if (this.dropFrames > 0) this.dropFrames--;

        const land = this.landingFoot(prevFoot);
        this.grounded = land !== null;
        if (this.grounded) {
            this.y = land - this.height / 2;
            this.vy = 0;
        }
    }

    // kind: 'special' verilen hasar bloğun yarısını geçer; temel saldırılar
    // bloğa tamamen takılır.
    takeDamage(amount, { kind = 'basic', from = null } = {}) {
        if (this.invulnerable || this.game.isGameOver || this.isDead) return 0;

        const { effects, hud } = this.game;

        if (this.isBlocking) {
            const leak = kind === 'special' ? COMBAT.blockLeak : 0;
            const push = from && from.x > this.x ? -1 : 1;
            this.vx = push * COMBAT.blockKnockback;
            effects.spawnText(this.x, this.y - 60, 'BLOK', '#9ad4ff');
            effects.triggerShake(4);
            if (leak <= 0) return 0;
            amount *= leak;
        }

        this.flashFrames = COMBAT.hitFlash;
        this.invulnFrames = COMBAT.hitInvuln;
        this.invulnerable = true;
        effects.triggerShake(8);

        const dmg = Math.ceil(amount);
        const isCrit = amount > 20;
        const txt = isCrit ? `KRİTİK! -${dmg}` : `-${dmg}`;
        const color = isCrit ? '#fbbf24' : '#ff4444';
        if (isCrit) effects.triggerFlash('rgba(255, 255, 255, 0.25)', 4);

        this.hp -= amount;
        effects.spawnText(this.x, this.y - 60, txt, color, isCrit);

        if (this.hp <= 0) {
            this.hp = 0;
            hud.updateHealth(this.game.p1, this.game.p2);
            this.triggerDeathAnimation(this.playerNum === 1 ? 2 : 1);
            return dmg;
        }

        hud.updateHealth(this.game.p1, this.game.p2);
        return dmg;
    }

    // Aşamalı hasar (enfekte kolun tuttuğu sürece verdiği): yanıp sönme ve
    // dokunulmazlık YOK, yoksa iki tik arasında karakter dokunulmaz kalırdı.
    takeTickDamage(amount) {
        if (this.isDead || this.game.isGameOver) return;
        this.hp = Math.max(0, this.hp - amount);
        this.game.effects.spawnText(this.x, this.y - 70, `-${amount}`, '#ffb3a0');
        this.game.hud.updateHealth(this.game.p1, this.game.p2);
        if (this.hp <= 0) this.triggerDeathAnimation(this.playerNum === 1 ? 2 : 1);
    }

    triggerDeathAnimation(winnerNum) {
        const { effects } = this.game;

        this.isDead = true;
        this.invulnerable = true;
        this.grabbedBy = null;
        effects.triggerShake(20);
        effects.triggerFlash('rgba(255,255,255,0.7)', 8);

        effects.spawnText(this.x, this.y - 80, 'K.O.!', '#ff0000', true);
        effects.spawnDeathPixels(this.x, this.y, [this.fighter.themeColor, '#ffffff', '#ffff00']);

        this.game.endRound(winnerNum);
    }

    // Raunt arası: can dolar, bekleme süreleri sıfırlanır, herkes yerine döner.
    resetForRound() {
        this.hp = this.maxHp;
        this.x = this.spawnX;
        this.y = this.groundY;
        this.vx = 0;
        this.vy = 0;
        this.grounded = true;
        this.dropFrames = 0;
        this.isDead = false;
        this.invulnerable = false;
        this.invulnFrames = 0;
        this.flashFrames = 0;
        this.speedMultiplier = 1;
        this.blockFrames = 0;
        this.blockCooldown = 0;
        this.action = null;
        this.anim = null;
        this.grabbedBy = null;
        this.escapePresses = 0;
        this.limbOut = 0;
        this.frozenFrames = 0;
        this.freezeImmune = 0;
        for (const id of Object.keys(this.cooldowns)) this.cooldowns[id] = 0;
    }

    update() {
        this.readInput();
        this.tickTimers();

        // Yakalandıysak tek işimiz kurtulmaya çalışmak: kendi saldırı tuşuna
        // basmak. Kaç kez basıldığı kolu tutan tarafta sayılıyor.
        if (this.grabbedBy) {
            if (this.pressed.attack) this.escapePresses++;
            this.speedMultiplier = 1;
            return;
        }

        this.stepAction();
        this.handleActions();
        this.move();
    }
}
