// Kanalizasyonun piksel çizimi.
//
// Tünel üç geçişte çiziliyor: TAVAN satırları, ZEMİN satırları ve DUVAR
// sütunları. Perspektifte duvar kenarları eğik; eğik kenarı poligonla
// çizersek kenarlar yumuşuyor ve sahnenin piksel dili bozuluyor. Bunun
// yerine her satır/sütun kendi z'sini hesaplayıp PX ızgarasına oturan tek
// bir dikdörtgen dolduruyor - kenarlar basamaklı, yani piksel.
//
// Üç geçiş ekranı tam olarak paylaşıyor: bir sütunun duvarı, o sütundaki
// tavanın bittiği yerde başlıyor ve zeminin başladığı yerde bitiyor.
//
// Karanlık iki şeyden geliyor: uzaklık sisi ve tavandaki ızgaraların
// aralıklı ışığı. Işık havuzları üstümüzden akıp geçtikçe koridor
// aydınlanıp kararıyor; sabit aydınlatma burayı "basık" hissettirmiyordu.

import { PX } from '../pixel/pixelDraw.js';
import {
    VIEW, CX, HORIZON, EYE, CEIL_H, TUNNEL_HW, DRAW_Z, RING,
    LANE_GAP, EXIT_Z, LIGHT_SPACING, FIRST_LIGHT,
    scaleAt, zAtScale, groundY, ceilingY, OBSTACLES
} from './sewerLayout.js';

// --- Palet ---
// Kirli tuğla, yosun ve pas. Doygunluk düşük: renkli bir kanalizasyon
// tehlikeli değil, dekoratif görünüyor.
const FOG = '#040608';
const FLOOR_TONES = ['#2e2d29', '#35342e'];
const FLOOR_SEAM = '#211f1d';
const CHANNEL = ['#242c25', '#1f2620'];       // yosunlu oluk
const WALL_TONES = ['#3a352f', '#413b34'];
const WALL_SEAM = '#241f1c';
const WALL_BAND = '#2b2723';                  // duvar boyunca giden çıkıntı
const CEIL_TONES = ['#211f1c', '#262320'];
const CEIL_SEAM = '#161513';
const RUST = '#573018';
const MOSS = '#2c3f1f';
const LIGHT_COLOR = '#c9b981';

// --- Ton hesabı ---
// Her karede binlerce kez çağrılıyor; sonuçlar basamaklandırılıp
// önbelleğe alınıyor, yoksa kare başına renk ayrıştırma maliyeti çıkıyor.
const toneCache = new Map();

function shade(hex, fog, light) {
    const fogStep = Math.round(fog * 12);
    const lightStep = Math.round(light * 8);
    const key = `${hex}|${fogStep}|${lightStep}`;
    const cached = toneCache.get(key);
    if (cached) return cached;

    const f = fogStep / 12;
    const l = lightStep / 8;
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    // Işık: sıcak sarıya doğru
    r = r + (0xc9 - r) * l * 0.55;
    g = g + (0xb9 - g) * l * 0.5;
    b = b + (0x81 - b) * l * 0.35;
    // Sis: uzaklaştıkça gece mavisine
    r = r + (0x05 - r) * f;
    g = g + (0x08 - g) * f;
    b = b + (0x0b - b) * f;

    const out = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    toneCache.set(key, out);
    return out;
}

function fogAt(z) {
    if (z <= 0) return 0;
    // Karekök değil kare: yakın çevre net kalıyor, uzak uç çabuk kapanıyor.
    // Kapanan uzak uç bu koridoru "basık" yapan şeyin yarısı.
    const t = Math.min(1, z / DRAW_Z);
    return Math.min(1, t * t * 1.25);
}

// Tavandaki ızgaraların ışığı: aralıklı havuzlar halinde
function lightAt(worldZ) {
    const phase = ((worldZ - FIRST_LIGHT) % LIGHT_SPACING + LIGHT_SPACING) % LIGHT_SPACING;
    const dist = Math.min(phase, LIGHT_SPACING - phase);
    const t = Math.max(0, 1 - dist / 230);
    return t * t;
}

const snap = (v) => Math.round(v / PX) * PX;

// --- Tünel ---
// travelled: kat edilen yol (dünya birimi). Bantlar buna göre kayıyor,
// ilerleme hissini veren tek şey bu.
export function drawTunnel(ctx, travelled) {
    ctx.fillStyle = FOG;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    drawCeiling(ctx, travelled);
    drawFloor(ctx, travelled);
    drawWalls(ctx, travelled);
}

function drawCeiling(ctx, travelled) {
    let prevBand = null;
    for (let y = 0; y < HORIZON; y += PX) {
        const scale = (HORIZON - y) / (CEIL_H - EYE);
        if (scale <= 0.0001) continue;
        const z = zAtScale(scale);
        if (z > DRAW_Z) continue;

        const worldZ = z + travelled;
        const band = Math.floor(worldZ / RING);
        const fog = fogAt(z);
        const light = lightAt(worldZ);

        const half = TUNNEL_HW * scale;
        const x0 = Math.max(0, snap(CX - half));
        const x1 = Math.min(VIEW.w, snap(CX + half));
        if (x1 <= x0) continue;

        const seam = prevBand !== null && band !== prevBand;
        prevBand = band;
        ctx.fillStyle = shade(seam ? CEIL_SEAM : CEIL_TONES[Math.abs(band) % 2], fog, light * 0.8);
        ctx.fillRect(x0, y, x1 - x0, PX);
    }
}

function drawFloor(ctx, travelled) {
    let prevBand = null;
    for (let y = snap(HORIZON); y <= VIEW.h; y += PX) {
        const scale = (y - HORIZON) / EYE;
        if (scale <= 0.0001) continue;
        const z = zAtScale(scale);
        if (z > DRAW_Z) continue;

        const worldZ = z + travelled;
        const band = Math.floor(worldZ / RING);
        const fog = fogAt(z);
        const light = lightAt(worldZ);

        const half = TUNNEL_HW * scale;
        const x0 = Math.max(0, snap(CX - half));
        const x1 = Math.min(VIEW.w, snap(CX + half));
        if (x1 <= x0) continue;

        const seam = prevBand !== null && band !== prevBand;
        prevBand = band;
        ctx.fillStyle = shade(seam ? FLOOR_SEAM : FLOOR_TONES[Math.abs(band) % 2], fog, light);
        ctx.fillRect(x0, y, x1 - x0, PX);

        // Şeritleri ayıran drenaj olukları: yosun tutmuş, hafif koyu
        const grooveW = Math.max(PX, snap(14 * scale));
        for (const side of [-1, 1]) {
            const gx = snap(CX + side * (LANE_GAP / 2) * scale);
            if (gx < x0 || gx > x1) continue;
            ctx.fillStyle = shade(CHANNEL[Math.abs(band) % 2], fog, light * 0.6);
            ctx.fillRect(gx - grooveW / 2, y, grooveW, PX);
        }
    }
}

function drawWalls(ctx, travelled) {
    let prevBand = null;
    for (let x = 0; x < VIEW.w; x += PX) {
        const dx = Math.abs(x + PX / 2 - CX);
        if (dx < PX) { prevBand = null; continue; }

        const scale = Math.min(3.2, dx / TUNNEL_HW);
        const z = zAtScale(scale);
        if (z > DRAW_Z) { prevBand = null; continue; }

        const worldZ = z + travelled;
        const band = Math.floor(worldZ / RING);
        const fog = fogAt(z);
        const light = lightAt(worldZ);

        const top = Math.max(0, snap(ceilingY(z)));
        const bottom = Math.min(VIEW.h, snap(groundY(z)));
        if (bottom <= top) continue;

        const seam = prevBand !== null && band !== prevBand;
        prevBand = band;
        ctx.fillStyle = shade(seam ? WALL_SEAM : WALL_TONES[Math.abs(band) % 2], fog, light);
        ctx.fillRect(x, top, PX, bottom - top);

        // Duvar boyunca giden çıkıntı ve altındaki pas akıntısı: koridora
        // kaçış noktasına doğru koşan yatay bir çizgi veriyor.
        const bandY = snap(top + (bottom - top) * 0.34);
        const bandH = Math.max(PX, snap(16 * scale));
        ctx.fillStyle = shade(WALL_BAND, fog, light);
        ctx.fillRect(x, bandY, PX, bandH);
        if (!seam && Math.abs(band) % 7 === 0 && Math.round(x / PX) % 3 !== 0) {
            ctx.fillStyle = shade(RUST, fog, light);
            ctx.fillRect(x, bandY + bandH, PX, Math.max(PX, snap(22 * scale)));
        }
        // Zemine yakın yosun bandı: duvarla zeminin birleştiği yeri
        // yumuşatıyor, kendisi görünmemeli
        ctx.fillStyle = shade(MOSS, fog, light * 0.35);
        ctx.fillRect(x, bottom - Math.max(PX, snap(8 * scale)), PX, Math.max(PX, snap(8 * scale)));
    }
}

// Tavandaki ızgara lambalar: ışık havuzunun kaynağı görünmeli, yoksa
// aydınlık nereden geliyor belli olmuyor.
export function drawCeilingGrates(ctx, travelled) {
    const first = Math.max(0, Math.floor((travelled - FIRST_LIGHT) / LIGHT_SPACING));
    for (let i = first; i < first + 6; i++) {
        const worldZ = FIRST_LIGHT + i * LIGHT_SPACING;
        const z = worldZ - travelled;
        if (z < -60 || z > DRAW_Z) continue;

        const scale = scaleAt(z);
        const fog = fogAt(z);
        const w = snap(150 * scale);
        const h = Math.max(PX, snap(30 * scale));
        const x = snap(CX - w / 2);
        const y = snap(ceilingY(z));
        if (w < PX) continue;

        ctx.fillStyle = shade('#171512', fog, 0);
        ctx.fillRect(x - PX, y, w + PX * 2, h + PX);
        ctx.fillStyle = shade(LIGHT_COLOR, fog, 1);
        ctx.fillRect(x, y, w, h);
        // Izgara çubukları
        ctx.fillStyle = shade('#191713', fog, 0.2);
        for (let bx = x; bx < x + w; bx += Math.max(PX * 2, snap(26 * scale))) {
            ctx.fillRect(bx, y, PX, h);
        }
    }
}

// --- Engeller ---

// Yükseklikten ekran y'sine (zeminden h birim yukarısı)
function yAtHeight(h, z) {
    return HORIZON + (EYE - h) * scaleAt(z);
}

// Konuma göre sabit sahte-rastgele: aynı engel her karede aynı çizilir
function seeded(seed, salt) {
    const n = Math.sin(seed * 91.7 + salt * 47.3) * 43758.5453;
    return n - Math.floor(n);
}

export function drawObstacle(ctx, obstacle, z) {
    if (z < -140 || z > DRAW_Z) return;
    const box = OBSTACLES[obstacle.type];
    if (!box) return;

    const scale = scaleAt(z);
    const cx = CX + laneWorldX(obstacle.lane) * scale;
    const half = box.hw * scale;
    if (half < PX / 2) return;

    // Işık dünyada sabit: engel hangi ızgaranın altındaysa onun payını alır
    const paint = { fog: fogAt(z), light: lightAt(obstacle.z), scale, cx, half, z };
    if (obstacle.type === 'tas') drawRubble(ctx, obstacle, paint);
    else if (obstacle.type === 'boru') drawPipe(ctx, obstacle, paint);
    else if (obstacle.type === 'enkaz') drawCollapse(ctx, obstacle, paint);
    else if (obstacle.type === 'su') drawSludge(ctx, obstacle, paint);
}

function laneWorldX(lane) {
    return (lane - 1) * LANE_GAP;
}

// Tavandan dökülmüş taş yığını: alçak, düzensiz bloklar. ZIPLANIR.
function drawRubble(ctx, obstacle, { fog, light, scale, cx, half, z }) {
    const base = yAtHeight(0, z);
    const blocks = 9;
    for (let i = 0; i < blocks; i++) {
        const t = i / (blocks - 1);
        const bw = (14 + seeded(obstacle.z, i) * 18) * scale;
        const bh = (16 + seeded(obstacle.z, i + 30) * 34) * scale;
        const bx = cx - half + t * (half * 2) - bw / 2;
        // Kenarlar alçak, orta yüksek: yığın gibi otursun
        const droop = Math.abs(t - 0.5) * 2;
        const height = bh * (1 - droop * 0.55);
        const tone = seeded(obstacle.z, i + 60) < 0.4 ? '#6a625a' : '#565049';
        ctx.fillStyle = shade(tone, fog, light);
        ctx.fillRect(snap(bx), snap(base - height), Math.max(PX, snap(bw)), Math.max(PX, snap(height)));
        // Üst kenarın aydınlık payı
        ctx.fillStyle = shade('#7d746a', fog, light);
        ctx.fillRect(snap(bx), snap(base - height), Math.max(PX, snap(bw)), PX);
    }
    // Yığının dibindeki toz
    ctx.fillStyle = shade('#413b35', fog, light);
    ctx.fillRect(snap(cx - half - PX), snap(base), Math.max(PX, snap(half * 2 + PX * 2)), PX * 2);
}

// Patlamış, sarkan boru: altından KAYILIR. Zıplayan çarpar - bu yüzden
// borunun altındaki boşluk gözle ölçülebilecek kadar açık olmalı.
function drawPipe(ctx, obstacle, { fog, light, scale, cx, half, z }) {
    const box = OBSTACLES.boru;
    const yLow = yAtHeight(box.low, z);                 // borunun ALTI: buradan kayılır
    const yTop = Math.max(ceilingY(z), yAtHeight(210, z));
    const h = Math.max(PX * 2, snap(yLow - yTop));
    const x0 = snap(cx - half);
    const w = Math.max(PX, snap(half * 2));

    // Tavandan boruya inen askılar
    ctx.fillStyle = shade('#2f2b26', fog, light);
    for (const side of [-0.62, 0.62]) {
        const sx = snap(cx + half * side);
        const top = snap(ceilingY(z));
        if (yTop > top) ctx.fillRect(sx, top, Math.max(PX, snap(10 * scale)), snap(yTop - top));
    }

    // Gövde: silindir gibi bantlanmış. Üstü aydınlık, altı koyu - böylece
    // yuvarlak okunuyor ve altındaki boşluk gözle ölçülebiliyor.
    ctx.fillStyle = shade('#4c443b', fog, light);
    ctx.fillRect(x0, snap(yTop), w, h);
    ctx.fillStyle = shade('#6d6153', fog, light);
    ctx.fillRect(x0, snap(yTop) + Math.max(PX, snap(h * 0.16)), w, Math.max(PX, snap(h * 0.14)));
    ctx.fillStyle = shade('#2a2621', fog, light);
    ctx.fillRect(x0, snap(yLow) - Math.max(PX, snap(h * 0.16)), w, Math.max(PX, snap(h * 0.16)));

    // Duvara giren uçlar ve gövdeyi saran kelepçeler
    const flangeW = Math.max(PX, snap(12 * scale));
    ctx.fillStyle = shade('#38322c', fog, light);
    ctx.fillRect(x0 - PX, snap(yTop), flangeW, h);
    ctx.fillRect(x0 + w - flangeW + PX, snap(yTop), flangeW, h);
    for (let i = 1; i < 3; i++) {
        ctx.fillRect(snap(x0 + (w * i) / 3), snap(yTop), Math.max(PX, snap(7 * scale)), h);
    }

    // Kaçaktan sızan pas izi ve altındaki ıslaklık: boruyu "canlı" yapıyor
    ctx.fillStyle = shade(RUST, fog, light);
    ctx.fillRect(snap(cx - half * 0.24), snap(yLow) - Math.max(PX, snap(h * 0.3)),
        Math.max(PX, snap(20 * scale)), Math.max(PX, snap(h * 0.3)));
    ctx.fillStyle = shade('#232b24', fog, light);
    ctx.fillRect(snap(cx - half * 0.5), snap(yAtHeight(0, z)) - PX,
        Math.max(PX, snap(half)), PX * 2);
}

// Çökmüş tavan: şerit boydan boya kapalı. Tek çare ŞERİT DEĞİŞTİRMEK.
function drawCollapse(ctx, obstacle, { fog, light, scale, cx, half, z }) {
    const base = yAtHeight(0, z);
    const top = Math.max(ceilingY(z), yAtHeight(OBSTACLES.enkaz.high, z));
    const x0 = snap(cx - half);
    const w = Math.max(PX, snap(half * 2));
    const h = Math.max(PX, snap(base - top));

    ctx.fillStyle = shade('#4e453c', fog, light);
    ctx.fillRect(x0, snap(top), w, h);
    // Kırık beton yüzeyi: yatay plaka izleri
    ctx.fillStyle = shade('#3c352e', fog, light);
    for (let i = 1; i < 6; i++) {
        ctx.fillRect(x0, snap(top + (h * i) / 6), w, PX);
    }
    // Dışarı fırlamış donatı demirleri
    ctx.fillStyle = shade('#6d4a24', fog, light);
    for (let i = 0; i < 4; i++) {
        const rx = snap(x0 + w * (0.15 + i * 0.23));
        const rh = Math.max(PX, snap((26 + seeded(obstacle.z, i) * 30) * scale));
        ctx.fillRect(rx, snap(top) - rh, PX, rh);
    }
    // Yığının dibi
    ctx.fillStyle = shade('#5a524a', fog, light);
    ctx.fillRect(x0 - PX, snap(base) - Math.max(PX, snap(18 * scale)),
        w + PX * 2, Math.max(PX, snap(18 * scale)));
}

// Taşan lağım birikintisi ve kırık ızgara: üstünden ZIPLANIR.
function drawSludge(ctx, obstacle, { fog, light, scale, cx, half, z }) {
    const box = OBSTACLES.su;
    const zFar = z + box.depth;
    const yFar = yAtHeight(0, zFar);
    const yNear = yAtHeight(0, z);
    const laneWorld = laneWorldX(obstacle.lane);
    const rows = Math.max(1, Math.round((yNear - yFar) / PX));

    // Zemine yatan birikinti: her satır kendi derinliğinin ölçeğiyle
    // daralıyor, yani gölet gerçekten yerde duruyor
    for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const y = snap(yFar + (yNear - yFar) * t);
        const rowScale = scaleAt(zFar + (z - zFar) * t);
        const rowHalf = box.hw * rowScale;
        const rowCx = CX + laneWorld * rowScale;
        const rowFog = fogAt(zFar + (z - zFar) * t);
        ctx.fillStyle = shade(t < 0.12 ? '#3f5f2e' : '#1e2a1c', rowFog, light);
        ctx.fillRect(snap(rowCx - rowHalf), y, Math.max(PX, snap(rowHalf * 2)), PX);
    }

    // Yüzeyde duran köpük ve kabarcıklar
    ctx.fillStyle = shade('#5d8138', fog, light);
    for (let i = 0; i < 7; i++) {
        const bx = snap(cx - half + half * 2 * seeded(obstacle.z, i + 5));
        const by = snap(yFar + (yNear - yFar) * seeded(obstacle.z, i + 15));
        ctx.fillRect(bx, by, PX * 2, PX);
    }

    // Kırık ızgaranın kalan dişleri: buranın sadece su olmadığını,
    // basılırsa takılacağını söyleyen tek işaret
    const toothH = Math.max(PX, snap(box.high * scale));
    ctx.fillStyle = shade('#413a33', fog, light);
    for (let i = 0; i < 4; i++) {
        if (seeded(obstacle.z, i + 40) < 0.3) continue;
        ctx.fillRect(snap(cx - half + half * 2 * (0.12 + i * 0.26)), snap(yNear) - toothH,
            Math.max(PX, snap(12 * scale)), toothH);
    }
}

// --- Çıkış bacası ---
// Tünelin sonu: karşı duvar, ona dayalı merdiven ve yukarıdan düşen gün
// ışığı. Prolog 4 bu bacanın ağzından başlıyor.
export function drawExitShaft(ctx, travelled) {
    const z = EXIT_Z - travelled;
    if (z > DRAW_Z || z < -200) return;

    const scale = scaleAt(z);
    const fog = fogAt(z);
    const top = ceilingY(z);
    const bottom = groundY(z);
    const half = TUNNEL_HW * scale;
    const x0 = snap(CX - half);
    const w = Math.max(PX, snap(half * 2));

    // Kapatan duvar
    ctx.fillStyle = shade('#3f3a33', fog, 0.15);
    ctx.fillRect(x0, snap(top), w, Math.max(PX, snap(bottom - top)));

    // Yukarı açılan baca: tavanda parlak bir dikdörtgen
    const shaftW = Math.max(PX, snap(110 * scale));
    const shaftX = snap(CX - shaftW / 2);
    const shaftH = Math.max(PX, snap(90 * scale));
    ctx.fillStyle = shade('#151310', fog, 0);
    ctx.fillRect(shaftX - PX, snap(top) - shaftH - PX, shaftW + PX * 2, shaftH + PX);
    ctx.fillStyle = shade('#cbbf92', fog, 1);
    ctx.fillRect(shaftX, snap(top) - shaftH, shaftW, shaftH);

    // Bacadan zemine düşen ışık sütunu
    ctx.save();
    ctx.globalAlpha = 0.16 * (1 - fog);
    ctx.fillStyle = '#e7dcae';
    ctx.fillRect(shaftX, snap(top), shaftW, Math.max(PX, snap(bottom - top)));
    ctx.restore();

    // Merdiven
    const ladderW = Math.max(PX, snap(46 * scale));
    const lx = snap(CX - ladderW / 2);
    ctx.fillStyle = shade('#5a4a34', fog, 0.6);
    ctx.fillRect(lx, snap(top), PX, Math.max(PX, snap(bottom - top)));
    ctx.fillRect(lx + ladderW - PX, snap(top), PX, Math.max(PX, snap(bottom - top)));
    const step = Math.max(PX * 2, snap(22 * scale));
    for (let y = snap(top); y < bottom; y += step) {
        ctx.fillRect(lx, y, ladderW, PX);
    }
}

// --- Damlalar ---
// Tavandan düşen su: koridorun tek canlı sesi ve tek hareketli ayrıntısı.
export function drawDrip(ctx, drip, travelled) {
    const z = drip.z - travelled;
    if (z < 0 || z > DRAW_Z * 0.7) return;
    const scale = scaleAt(z);
    const fog = fogAt(z);
    const x = snap(CX + drip.x * scale);
    const y = snap(HORIZON + (EYE - drip.h) * scale);
    const size = Math.max(PX, snap(6 * scale));
    ctx.fillStyle = shade('#9fb6c6', fog, 0.4);
    ctx.fillRect(x, y, PX, size);
}

// Ekranın kenarlarını karartan basamaklı vinyet. Gradyan kullanmıyoruz:
// yumuşak geçiş sahnedeki her şeyin piksel kenarının yanında yamalı duruyor.
export function drawVignette(ctx) {
    ctx.save();
    ctx.fillStyle = '#000000';
    const bands = 5;
    for (let i = 0; i < bands; i++) {
        // Dışarıdan içeri zayıflayan basamaklar. Sabit alfa kenarı kalın bir
        // çerçeveye çeviriyordu; buradaki azalma onu gölgeye döndürüyor.
        ctx.globalAlpha = 0.055 * (1 - i / bands);
        const inset = i * PX * 5;
        const band = PX * 5;
        ctx.fillRect(0, inset, VIEW.w, band);
        ctx.fillRect(0, VIEW.h - inset - band, VIEW.w, band);
        ctx.fillRect(inset, 0, band, VIEW.h);
        ctx.fillRect(VIEW.w - inset - band, 0, band, VIEW.h);
    }
    ctx.restore();
}
