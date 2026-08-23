import { PARTY_SIZE } from '../config/progression.js';
import { fetchCharacter } from '../services/pokeapi.js';
import { Sfx } from '../services/audio.js';
import { ALL_TYPES, TYPE_NAMES_TR, TYPE_COLORS, defensiveProfile, offensiveProfile, preloadTypes } from '../services/typeChart.js';
import { abilityOverride, withKeys } from '../config/playableCharacters.js';
import { buildAbilities } from '../services/moveAbilities.js';

// Pokemon kütüphanesi: ekip, koleksiyon ve jeton harcama ekranı.
// Jetonlar burada istenen Pokemona yatırılıp seviye yükseltilir.
export class Library {
    constructor({ progress, onLevelUp, onPartyChange }) {
        this.progress = progress;
        this.onLevelUp = onLevelUp;
        this.onPartyChange = onPartyChange;
        this.cache = new Map();

        this.overlay = document.getElementById('library-overlay');
        this.tokenLine = document.getElementById('library-tokens');
        this.partyList = document.getElementById('library-party');
        this.collectionList = document.getElementById('library-collection');
        this.dexList = document.getElementById('library-dex');
        this.dexSummary = document.getElementById('library-dex-summary');
        this.detail = document.getElementById('library-detail');
        this.detailId = null;

        // Tip tablosunun tamamı: zayıflık/dayanıklılık hesabı için gerekir
        preloadTypes(ALL_TYPES);

        document.getElementById('library-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    get isOpen() {
        return !this.overlay.classList.contains('hidden');
    }

    sprite(id) {
        if (!this.cache.has(id)) this.cache.set(id, fetchCharacter({ id }));
        return this.cache.get(id);
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    open() {
        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active'); // görünürlük ve tıklanabilirlik
        this.render();
    }

    close() {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('active');
    }

    render() {
        const { progress } = this;
        this.tokenLine.textContent =
            `${progress.tokens} yetenek jetonu · Ekip ${progress.party.length}/${PARTY_SIZE} · ` +
            `${progress.collection.length} yakalanan · ${progress.badges.length} mekan tamamlandı`;

        // --- Ekip ---
        this.partyList.innerHTML = '';
        progress.party.forEach((member, index) => {
            const cost = progress.costToLevel(index);
            const affordable = cost !== null && progress.tokens >= cost;

            const card = document.createElement('div');
            card.className = 'lib-card';
            if (index === progress.activeIndex) card.classList.add('active');
            card.innerHTML = `
                <div class="lib-img-slot"></div>
                <div class="lib-name">${member.name}</div>
                <div class="lib-level">Seviye ${member.level}</div>
                <button class="lib-btn ${affordable ? '' : 'disabled'}">
                    ${cost === null ? 'Maks. seviye' : `Seviye atlat (${cost} jeton)`}
                </button>
                ${index > 0 ? '<button class="lib-remove">Ekipten çıkar</button>' : '<div class="lib-tag">Başlangıç</div>'}
            `;

            const levelBtn = card.querySelector('.lib-btn');
            levelBtn.addEventListener('click', () => {
                if (!progress.spendOnLevel(index)) return;
                Sfx.levelUp();
                this.onLevelUp(index);
                this.render();
            });

            const removeBtn = card.querySelector('.lib-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (!progress.removeFromParty(index)) return;
                    this.onPartyChange();
                    this.render();
                });
            }

            card.querySelector('.lib-img-slot').addEventListener('click', () => this.showDetail(member.formId, member));
            card.querySelector('.lib-name').addEventListener('click', () => this.showDetail(member.formId, member));

            this.partyList.appendChild(card);
            this.fillSprite(card, member.formId);
        });

        // --- Koleksiyon (ekipte olmayanlar) ---
        this.collectionList.innerHTML = '';
        const partyIds = new Set(progress.party.map(p => p.id));
        const benched = progress.collection
            .map((entry, i) => ({ ...entry, index: i }))
            .filter(entry => !partyIds.has(entry.id));

        if (!benched.length) {
            this.collectionList.innerHTML = '<p class="lib-empty">Ekip dışında Pokemon yok. Yabani Pokemonları bayıltıp N ile yakalayın.</p>';
            return;
        }

        for (const entry of benched) {
            const card = document.createElement('div');
            card.className = 'lib-card small';
            card.innerHTML = `
                <div class="lib-img-slot"></div>
                <div class="lib-name">${entry.name}</div>
                <button class="lib-btn ${progress.partyFull ? 'disabled' : ''}">
                    ${progress.partyFull ? 'Ekip dolu' : 'Ekibe al'}
                </button>
            `;
            card.querySelector('.lib-btn').addEventListener('click', () => {
                if (!progress.swapIntoParty(entry.index)) return;
                this.onPartyChange();
                this.render();
            });
            card.querySelector('.lib-img-slot').addEventListener('click', () => this.showDetail(entry.id));
            card.querySelector('.lib-name').addEventListener('click', () => this.showDetail(entry.id));

            this.collectionList.appendChild(card);
            this.fillSprite(card, entry.id);
        }

        this.renderDex();
    }

    // Pokedex: görülen ve yakalanan Pokemonlar
    renderDex() {
        const { progress } = this;
        const stats = progress.dexStats;
        const entries = Object.entries(progress.dex)
            .map(([id, entry]) => ({ id: Number(id), ...entry }))
            .sort((a, b) => a.id - b.id);

        const bossCount = entries.filter(e => e.kind === 'boss' || e.kind === 'regionBoss').length;
        const defeated = entries.filter(e => e.defeated).length;
        this.dexSummary.textContent =
            `${stats.caught} yakalandı · ${stats.seen} görüldü` +
            (bossCount ? ` · ${defeated}/${bossCount} boss yenildi` : '') +
            ` · hedef 75 Pokemon`;

        this.dexList.innerHTML = '';
        if (!entries.length) {
            this.dexList.innerHTML = '<p class="lib-empty">Henüz Pokemon görmediniz.</p>';
            return;
        }

        for (const entry of entries) {
            // Bosslar yakalanamaz; "görüldü" demek yanıltıcı olur
            const isBoss = entry.kind === 'boss' || entry.kind === 'regionBoss';
            const state = isBoss
                ? (entry.defeated ? { cls: 'defeated', label: 'Yenildi' } : { cls: 'boss', label: 'Boss' })
                : (entry.caught ? { cls: 'caught', label: 'Yakalandı' } : { cls: 'seen', label: 'Görüldü' });

            const cell = document.createElement('div');
            cell.className = `dex-cell ${state.cls}`;
            cell.title = `#${entry.id} ${entry.name}`;
            cell.innerHTML = `
                <div class="dex-img-slot"></div>
                <div class="dex-name">${entry.name}</div>
                <div class="dex-tag">${state.label}</div>
            `;
            cell.addEventListener('click', () => this.showDetail(entry.id));
            this.dexList.appendChild(cell);
            this.sprite(entry.id).then(data => {
                const slot = cell.querySelector('.dex-img-slot');
                const src = data.battleSprite || data.sprite;
                if (slot) slot.innerHTML = `<img class="dex-img" src="${src}" alt="${data.name}">`;
            }).catch(() => {});
        }
    }

    // Karakter bilgisi: statlar, hamleler ve tip zayıflıkları
    async showDetail(id, member = null) {
        this.detailId = id;
        this.detail.classList.remove('hidden');
        this.detail.innerHTML = '<p class="lib-empty">Bilgiler yükleniyor...</p>';

        let data;
        try {
            data = await this.sprite(id);
        } catch {
            this.detail.innerHTML = '<p class="lib-empty">Bilgi alınamadı.</p>';
            return;
        }
        if (this.detailId !== id) return; // arada başka karta tıklandı

        // Yetenekler: elle yazılmış set varsa o, yoksa gerçek hamlelerden üretilen
        const level = member?.level ?? 5;
        const override = abilityOverride(member?.id ?? id, level);
        let abilities;
        try {
            abilities = withKeys(override && override.length ? override : await buildAbilities(data));
        } catch {
            abilities = [];
        }
        if (this.detailId !== id) return;

        await preloadTypes([...ALL_TYPES, ...data.types]);
        if (this.detailId !== id) return;

        const profile = defensiveProfile(data.types);
        const offense = offensiveProfile(abilities.map(a => a.moveType).filter(Boolean));

        const chip = (entry, showMultiplier = true) => {
            const name = TYPE_NAMES_TR[entry.type] || entry.type;
            const suffix = showMultiplier ? ` ${entry.multiplier}x` : '';
            return `<span class="type-chip" style="background:${TYPE_COLORS[entry.type]}">${name}${suffix}</span>`;
        };

        const stats = data.apiStats || data.baseStats || {};
        const statRow = (label, value, max = 160) => `
            <div class="stat-line">
                <span>${label}</span>
                <div class="stat-track"><div class="stat-fill" style="width:${Math.min(100, (value / max) * 100)}%"></div></div>
                <span class="stat-val">${value}</span>
            </div>`;

        this.detail.innerHTML = `
            <button class="detail-close">&times;</button>
            <div class="detail-top">
                <img class="detail-sprite" src="${data.battleSprite || data.sprite}" alt="${data.name}">
                <div>
                    <h4 class="detail-name">${data.name} <span class="detail-id">#${id}</span></h4>
                    ${member ? `<div class="detail-level">Seviye ${member.level}</div>` : ''}
                    <div class="chip-row">
                        ${data.types.map(t => chip({ type: t }, false)).join('')}
                    </div>
                </div>
            </div>

            <div class="detail-cols">
                <div>
                    <h5 class="detail-heading">İstatistikler</h5>
                    ${statRow('Can', stats.hp ?? 0)}
                    ${statRow('Saldırı', stats.attack ?? 0)}
                    ${statRow('Savunma', stats.defense ?? 0)}
                    ${statRow('Hız', stats.speed ?? 0)}

                    <h5 class="detail-heading">Hamleleri</h5>
                    <ul class="move-list">
                        ${abilities.length
                            ? abilities.map(a => `<li><b>${a.key}</b> ${a.name}
                                <span class="type-chip small" style="background:${TYPE_COLORS[a.moveType] || '#475569'}">${TYPE_NAMES_TR[a.moveType] || a.moveType}</span></li>`).join('')
                            : '<li>Hamle bilgisi yok</li>'}
                    </ul>
                </div>

                <div>
                    <h5 class="detail-heading danger">Zayıf olduğu (fazla hasar alır)</h5>
                    <div class="chip-row">${profile.weakTo.length ? profile.weakTo.map(e => chip(e)).join('') : '<span class="lib-empty">Yok</span>'}</div>

                    <h5 class="detail-heading safe">Dayanıklı olduğu (az hasar alır)</h5>
                    <div class="chip-row">${profile.resists.length ? profile.resists.map(e => chip(e)).join('') : '<span class="lib-empty">Yok</span>'}</div>

                    ${profile.immune.length ? `
                        <h5 class="detail-heading">Etkilenmediği</h5>
                        <div class="chip-row">${profile.immune.map(e => chip(e, false)).join('')}</div>` : ''}

                    <h5 class="detail-heading good">Hamleleri şunlara üstün</h5>
                    <div class="chip-row">${offense.length ? offense.map(e => chip(e)).join('') : '<span class="lib-empty">Bilgi yok</span>'}</div>
                </div>
            </div>
        `;

        this.detail.querySelector('.detail-close').addEventListener('click', () => {
            this.detail.classList.add('hidden');
            this.detailId = null;
        });
        this.detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    fillSprite(card, id) {
        this.sprite(id).then(data => {
            const slot = card.querySelector('.lib-img-slot');
            // Sahada piksel sprite kullanılıyor; menüde de aynısı görünsün ki
            // Pokemonu sahaya sürdüğünde görseli değişmesin
            const src = data.battleSprite || data.sprite;
            if (slot) slot.innerHTML = `<img class="lib-img" src="${src}" alt="${data.name}">`;
        }).catch(() => {});
    }
}
