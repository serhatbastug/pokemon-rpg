import { SHOP_ITEMS } from '../config/shopItems.js';

// Kecleon'un dükkanı: jeton karşılığı eşya satın alma ve çantadaki eşyaları
// kullanma ekranı. Tezgahın önünde F ile açılır.
export class Shop {
    constructor({ progress, onUseItem, merchantName = 'Kecleon' }) {
        this.progress = progress;
        this.onUseItem = onUseItem;
        this.merchantName = merchantName;

        this.overlay = document.getElementById('shop-overlay');
        this.tokenLine = document.getElementById('shop-tokens');
        this.list = document.getElementById('shop-list');
        this.bag = document.getElementById('shop-bag');
        this.speech = document.getElementById('shop-speech');

        document.getElementById('shop-close').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    get isOpen() {
        return !this.overlay.classList.contains('hidden');
    }

    setMerchantName(name) {
        this.merchantName = name;
    }

    open() {
        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('active');
        this.say(`Hoş geldin! Jetonun varsa alışveriş var.`);
        this.render();
    }

    close() {
        this.overlay.classList.add('hidden');
        this.overlay.classList.remove('active');
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    say(text) {
        this.speech.textContent = `${this.merchantName}: "${text}"`;
    }

    render() {
        const { progress } = this;
        this.tokenLine.textContent = `${progress.tokens} yetenek jetonu`;

        // --- Satılık eşyalar ---
        this.list.innerHTML = '';
        for (const item of SHOP_ITEMS) {
            const affordable = progress.tokens >= item.price;
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <div class="shop-icon" style="background:${item.color}"></div>
                <div class="shop-name">${item.name}</div>
                <div class="shop-desc">${item.description}</div>
                <div class="shop-owned">Çantanda: ${progress.itemCount(item.id)}</div>
                <button class="lib-btn ${affordable ? '' : 'disabled'}">
                    ${item.price} jeton${item.stack > 1 ? ` · ${item.stack} adet` : ''}
                </button>
            `;
            card.querySelector('.lib-btn').addEventListener('click', () => {
                const bought = progress.buyItem(item.id);
                if (!bought) {
                    this.say('Jetonun yetmiyor, önce biraz Pokemon yen.');
                    return;
                }
                this.say(`${bought} adet ${item.name}, iyi alışverişler!`);
                this.render();
            });
            this.list.appendChild(card);
        }

        // --- Çanta ---
        this.bag.innerHTML = '';
        const owned = SHOP_ITEMS.filter(item => progress.itemCount(item.id) > 0);
        if (!owned.length) {
            this.bag.innerHTML = '<p class="lib-empty">Çantan boş.</p>';
            return;
        }

        for (const item of owned) {
            const usable = item.id !== 'poke-ball'; // top sahada N ile kullanılır
            const card = document.createElement('div');
            card.className = 'shop-card small';
            card.innerHTML = `
                <div class="shop-icon" style="background:${item.color}"></div>
                <div class="shop-name">${item.name} x${progress.itemCount(item.id)}</div>
                ${usable
                    ? '<button class="lib-btn">Kullan</button>'
                    : '<div class="lib-tag">Sahada N ile</div>'}
            `;
            const button = card.querySelector('.lib-btn');
            if (button) {
                button.addEventListener('click', () => {
                    const result = this.onUseItem(item.id);
                    this.say(result.message);
                    this.render();
                });
            }
            this.bag.appendChild(card);
        }
    }
}
