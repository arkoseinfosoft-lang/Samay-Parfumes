/**
 * SAMAY PARFUMES - Interactive Logic & E-Commerce Cart System (Shopify AJAX API)
 */

(function () {
  'use strict';

  // Format cents to Indian Rupee (₹) format
  function formatMoney(cents) {
    if (cents === null || cents === undefined) cents = 0;
    const amount = Number(cents) / 100;
    return '₹' + amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // Active Shopify Cart State
  let currentCart = { item_count: 0, items: [], total_price: 0 };

  // Fetch full cart state from Shopify /cart.js
  async function fetchCart() {
    try {
      const res = await fetch('/cart.js', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to fetch cart');
      currentCart = await res.json();
      renderCart(currentCart);
      return currentCart;
    } catch (err) {
      console.error('[Samay Cart] Error fetching cart:', err);
      return null;
    }
  }

  // Add line item to Shopify /cart/add.js
  async function addToCart(variantId, qty) {
    qty = parseInt(qty, 10) || 1;
    const id = Number(variantId);
    if (!id) {
      console.error('[Samay Cart] Invalid variant id:', variantId);
      return;
    }

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id: id,
          quantity: qty
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.description || errData.message || 'Error adding item to cart');
      }

      await fetchCart();
      openCartDrawer();
    } catch (err) {
      console.error('[Samay Cart] Add to cart error:', err);
      alert(err.message || 'Could not add item to cart. Please try again.');
    }
  }

  // Update line item quantity or remove via Shopify /cart/change.js
  async function changeQuantity(lineKey, newQty) {
    newQty = parseInt(newQty, 10);
    if (isNaN(newQty) || newQty < 0) newQty = 0;

    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id: String(lineKey),
          quantity: newQty
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.description || 'Error updating cart item');
      }

      currentCart = await res.json();
      renderCart(currentCart);
    } catch (err) {
      console.error('[Samay Cart] Change quantity error:', err);
      await fetchCart();
    }
  }

  // Render Cart Drawer DOM & Badges
  function renderCart(cart) {
    const totalCount = cart ? (cart.item_count || 0) : 0;
    const countBubbles = document.querySelectorAll('.samay-cart-badge, #cartCount');
    countBubbles.forEach(b => {
      b.textContent = totalCount;
      b.style.display = totalCount > 0 ? 'flex' : 'none';
    });

    const drawerItemsContainer = document.getElementById('samayCartDrawerItems');
    const subtotalEl = document.getElementById('samayCartSubtotal');
    if (!drawerItemsContainer || !subtotalEl) return;

    if (!cart || !cart.items || cart.items.length === 0) {
      drawerItemsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--taupe);">
          <div style="font-size: 2.4rem; color: var(--gold); margin-bottom: 12px;">⚜</div>
          <h4 style="font-family: var(--serif); font-size: 1.4rem; margin-bottom: 8px;">Your Shopping Bag is Empty</h4>
          <p style="font-size: 0.9rem; color: var(--dim);">Experience the timeless essence of Zayro Eau De Parfum.</p>
          <a href="#collection" class="samay-btn samay-btn--gold" style="margin-top: 16px; padding: 12px 24px;" onclick="window.samayCart && window.samayCart.close()">SHOP ZAYRO</a>
        </div>
      `;
      subtotalEl.textContent = '₹0.00';
      return;
    }

    drawerItemsContainer.innerHTML = cart.items.map(item => {
      const lineKey = item.key || item.id;
      let itemImg = item.featured_image?.url || item.image || '';
      if (window.samayAssets) {
        const h = (item.handle || '').toLowerCase();
        const t = (item.product_title || item.title || '').toLowerCase();
        if (h.includes('trio') || t.includes('trio')) {
          itemImg = window.samayAssets.trio;
        } else if (h.includes('duo') || t.includes('duo')) {
          itemImg = window.samayAssets.duo;
        } else if (h.includes('zayro') || t.includes('zayro') || t.includes('samay')) {
          itemImg = window.samayAssets.single;
        }
      }
      const itemTitle = item.product_title || item.title;
      const itemVariant = (item.variant_title && item.variant_title !== 'Default Title') ? item.variant_title : '';
      const itemPriceFormatted = formatMoney(item.price);
      return `
        <div class="samay-cart-item" data-line-key="${lineKey}">
          ${itemImg ? `<img src="${itemImg}" alt="${itemTitle.replace(/"/g, '&quot;')}" class="samay-cart-item-img">` : ''}
          <div class="samay-cart-item-details">
            <h5 class="samay-cart-item-title">${itemTitle}</h5>
            ${itemVariant ? `<div class="samay-cart-item-variant">${itemVariant}</div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span class="samay-cart-item-price">${itemPriceFormatted} × ${item.quantity}</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button type="button" class="samay-qty-btn" style="width:24px;height:24px;font-size:0.8rem;" onclick="window.samayCart && window.samayCart.change('${lineKey}', ${item.quantity - 1})">-</button>
                <span style="font-size:0.85rem;font-weight:600;">${item.quantity}</span>
                <button type="button" class="samay-qty-btn" style="width:24px;height:24px;font-size:0.8rem;" onclick="window.samayCart && window.samayCart.change('${lineKey}', ${item.quantity + 1})">+</button>
              </div>
            </div>
            <div style="margin-top: 8px;">
              <button type="button" class="samay-cart-item-remove" onclick="window.samayCart && window.samayCart.remove('${lineKey}')">Remove</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    subtotalEl.textContent = formatMoney(cart.total_price);
  }

  function openCartDrawer() {
    const overlay = document.getElementById('samayCartOverlay');
    if (overlay) {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCartDrawer() {
    const overlay = document.getElementById('samayCartOverlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  // Expose Real Cart API to Window
  window.samayCart = {
    add: addToCart,
    change: changeQuantity,
    remove: function (key) { return changeQuantity(key, 0); },
    updateQty: function (key, delta) {
      if (!currentCart || !currentCart.items) return;
      const item = currentCart.items.find(i => (i.key === key || String(i.id) === String(key)));
      if (item) {
        return changeQuantity(item.key || item.id, item.quantity + delta);
      }
    },
    fetch: fetchCart,
    open: openCartDrawer,
    close: closeCartDrawer
  };

  // DOM Loaded Listeners
  document.addEventListener('DOMContentLoaded', function () {
    // Clear any obsolete localStorage fake cart
    try {
      localStorage.removeItem('samay_cart');
    } catch (e) {}

    // Initialize Real Shopify Cart
    fetchCart();

    // Header Scroll Effect
    const header = document.querySelector('.samay-header-wrapper');
    window.addEventListener('scroll', function () {
      if (window.scrollY > 30) {
        header?.classList.add('is-scrolled');
      } else {
        header?.classList.remove('is-scrolled');
      }
    });

    // Mobile Menu Drawer Toggle
    const mobileBtn = document.getElementById('samayMobileToggle');
    const mobileDrawer = document.getElementById('samayMobileDrawerOverlay');
    const mobileCloseBtn = document.getElementById('samayMobileDrawerClose');
    const mobileCta = document.getElementById('samayMobileDrawerCta');

    function openMobileDrawer() {
      if (mobileDrawer) {
        mobileDrawer.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeMobileDrawer() {
      if (mobileDrawer) {
        mobileDrawer.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    }

    window.closeMobileDrawer = closeMobileDrawer;

    if (mobileBtn) {
      mobileBtn.addEventListener('click', openMobileDrawer);
    }

    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', closeMobileDrawer);
    }

    if (mobileDrawer) {
      mobileDrawer.addEventListener('click', function (e) {
        if (e.target === mobileDrawer) closeMobileDrawer();
      });
    }

    if (mobileCta) {
      mobileCta.addEventListener('click', closeMobileDrawer);
    }

    document.querySelectorAll('.samay-mobile-link').forEach(link => {
      link.addEventListener('click', closeMobileDrawer);
    });


    // FAQ Accordion
    document.querySelectorAll('.samay-faq-question').forEach(btn => {
      btn.addEventListener('click', function () {
        const item = this.closest('.samay-faq-item');
        const isOpen = item.classList.contains('is-open');
        document.querySelectorAll('.samay-faq-item').forEach(i => {
          i.classList.remove('is-open');
          const qBtn = i.querySelector('.samay-faq-question');
          if (qBtn) qBtn.setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('is-open');
          this.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // Quantity buttons on product cards
    document.querySelectorAll('.samay-product-card, .ep-card').forEach(card => {
      const input = card.querySelector('.samay-qty-input');
      const minus = card.querySelector('.samay-qty-minus');
      const plus = card.querySelector('.samay-qty-plus');

      if (minus && input) {
        minus.addEventListener('click', () => {
          let val = parseInt(input.value, 10) || 1;
          if (val > 1) input.value = val - 1;
        });
      }

      if (plus && input) {
        plus.addEventListener('click', () => {
          let val = parseInt(input.value, 10) || 1;
          input.value = val + 1;
        });
      }
    });

    // Drawer Backdrop click to close
    const overlay = document.getElementById('samayCartOverlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          closeCartDrawer();
        }
      });
    }

    // Direct checkout navigation to avoid Shopify POST /cart 302 redirect warning in terminal
    const checkoutForm = document.getElementById('samayCartDrawerForm');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', function (e) {
        e.preventDefault();
        window.location.href = '/checkout';
      });
    }



    // Initialize Perfume Atomizer & Golden Spray Mist Cursor
    initPerfumeSprayCursor();
  });

  // ==========================================================================
  // PERFUME ATOMIZER & GOLDEN SPRAY MIST CURSOR (HOUSE OF SASAA SIGNATURE)
  // ==========================================================================
  function initPerfumeSprayCursor() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (reduceMotion || isTouch) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'samay-spray-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed!important;inset:0!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;pointer-events:none!important;z-index:99998!important;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const atomizer = document.createElement('div');
    atomizer.className = 'samay-atomizer';
    atomizer.setAttribute('aria-hidden', 'true');
    atomizer.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:30px!important;height:46px!important;max-width:30px!important;max-height:46px!important;pointer-events:none!important;z-index:99999!important;will-change:transform;transition:opacity 0.2s;';
    atomizer.innerHTML = `
      <svg width="30" height="46" viewBox="0 0 30 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:30px!important;height:46px!important;display:block!important;filter:drop-shadow(0 3px 8px rgba(27,19,9,0.4));">
        <defs>
          <linearGradient id="liveCapGlass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="rgba(255, 255, 255, 0.9)"/>
            <stop offset="30%" stop-color="rgba(245, 248, 252, 0.45)"/>
            <stop offset="70%" stop-color="rgba(215, 225, 235, 0.3)"/>
            <stop offset="100%" stop-color="rgba(255, 255, 255, 0.8)"/>
          </linearGradient>
          <linearGradient id="liveGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#C9A96E"/>
            <stop offset="35%" stop-color="#F5E7CB"/>
            <stop offset="70%" stop-color="#C9A96E"/>
            <stop offset="100%" stop-color="#9C783E"/>
          </linearGradient>
          <linearGradient id="liveBottle" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#16120D"/>
            <stop offset="25%" stop-color="#241D14"/>
            <stop offset="50%" stop-color="#120E09"/>
            <stop offset="85%" stop-color="#0B0906"/>
            <stop offset="100%" stop-color="#17120C"/>
          </linearGradient>
        </defs>

        <!-- Actuator Nozzle with pump press animation -->
        <g id="samayActuator" style="transition: transform 0.08s ease-out; transform-origin: 15px 12px;">
          <rect x="13" y="1.5" width="4" height="4" rx="0.8" fill="url(#liveGold)"/>
          <circle cx="15" cy="3" r="0.65" fill="#1B1309"/>
          <!-- Faceted Crystal Cap -->
          <rect x="9" y="5" width="12" height="8.5" rx="1.5" fill="url(#liveCapGlass)" stroke="rgba(255,255,255,0.8)" stroke-width="0.7"/>
          <line x1="12" y1="5.5" x2="12" y2="13" stroke="rgba(255,255,255,0.9)" stroke-width="0.6"/>
          <line x1="18" y1="5.5" x2="18" y2="13" stroke="rgba(255,255,255,0.6)" stroke-width="0.5"/>
        </g>

        <!-- Polished Gold Collar -->
        <rect x="10.5" y="13.5" width="9" height="2" rx="0.4" fill="url(#liveGold)"/>

        <!-- Obsidian Glass Flacon -->
        <rect x="5.5" y="15.5" width="19" height="26" rx="2" fill="url(#liveBottle)" stroke="rgba(201, 169, 110, 0.45)" stroke-width="0.7"/>
        <line x1="6.7" y1="17" x2="6.7" y2="39.5" stroke="rgba(255, 255, 255, 0.25)" stroke-width="0.6" stroke-linecap="round"/>

        <!-- Gold Framed Label -->
        <rect x="8.5" y="18.5" width="13" height="19" rx="0.6" fill="#110D08" stroke="url(#liveGold)" stroke-width="0.6"/>
        <rect x="9.5" y="19.5" width="11" height="17" rx="0.3" fill="none" stroke="url(#liveGold)" stroke-width="0.3" opacity="0.8"/>

        <!-- Pocket Watch Emblem -->
        <circle cx="15" cy="24.5" r="2.6" fill="none" stroke="url(#liveGold)" stroke-width="0.6"/>
        <line x1="15" y1="21.3" x2="15" y2="21.9" stroke="url(#liveGold)" stroke-width="0.5"/>
        <circle cx="15" cy="24.5" r="0.45" fill="url(#liveGold)"/>
        <line x1="15" y1="24.5" x2="15" y2="23" stroke="url(#liveGold)" stroke-width="0.45" stroke-linecap="round"/>
        <line x1="15" y1="24.5" x2="16.3" y2="24.5" stroke="url(#liveGold)" stroke-width="0.45" stroke-linecap="round"/>

        <!-- Scent Line & Zayro Brand -->
        <line x1="11.5" y1="29.5" x2="18.5" y2="29.5" stroke="url(#liveGold)" stroke-width="0.35" opacity="0.7"/>
        <text x="15" y="33" font-family="'Plus Jakarta Sans', serif" font-size="2" font-weight="700" fill="url(#liveGold)" text-anchor="middle" letter-spacing="0.3">ZAYRO</text>
      </svg>
    `;
    document.body.appendChild(atomizer);

    // ========================================================================
    // ORGANIC VOLUMETRIC PERFUME MIST & SCENT ENGINE
    // ========================================================================
    class PerfumeVaporCloud {
      constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 4 + Math.random() * 4;
        this.maxRadius = 22 + Math.random() * 16;
        this.growth = 0.8 + Math.random() * 0.6;
        this.life = 1.0;
        this.decay = 0.022 + Math.random() * 0.018;
        this.drag = 0.88 + Math.random() * 0.03;
        this.buoyancy = -0.06 - Math.random() * 0.04;
        this.opacity = 0.38 + Math.random() * 0.22;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.vy += this.buoyancy;
        if (this.radius < this.maxRadius) this.radius += this.growth;
        this.life -= this.decay;
      }

      draw(c) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life) * this.opacity;
        const g = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        g.addColorStop(0, `rgba(255, 252, 245, ${alpha * 0.9})`);
        g.addColorStop(0.35, `rgba(245, 228, 190, ${alpha * 0.6})`);
        g.addColorStop(0.7, `rgba(215, 185, 125, ${alpha * 0.22})`);
        g.addColorStop(1, 'rgba(215, 185, 125, 0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        c.fill();
      }
    }

    class AtomizedDroplet {
      constructor(x, y, angle, speed, isMicro = false) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = isMicro ? (0.6 + Math.random() * 0.8) : (0.9 + Math.random() * 1.5);
        this.life = 1.0;
        this.decay = isMicro ? (0.03 + Math.random() * 0.02) : (0.02 + Math.random() * 0.015);
        this.drag = 0.91 + Math.random() * 0.03;
        this.buoyancy = -0.03;
        this.isGold = Math.random() > 0.35;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.vy += this.buoyancy;
        this.life -= this.decay;
      }

      draw(c) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life) * 0.85;
        c.fillStyle = this.isGold ? `rgba(225, 195, 130, ${alpha})` : `rgba(255, 250, 242, ${alpha})`;
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
      }
    }

    class ScentSparkle {
      constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 1.2 + Math.random() * 1.6;
        this.life = 1.0;
        this.decay = 0.03 + Math.random() * 0.02;
        this.drag = 0.92;
        this.rotation = Math.random() * Math.PI;
        this.rotSpeed = (Math.random() - 0.5) * 0.1;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.rotation += this.rotSpeed;
        this.life -= this.decay;
      }

      draw(c) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life);
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.fillStyle = `rgba(255, 248, 225, ${alpha * 0.95})`;
        const s = this.size * Math.sin(alpha * Math.PI);
        c.beginPath();
        c.moveTo(0, -s * 2);
        c.lineTo(s * 0.4, -s * 0.4);
        c.lineTo(s * 2, 0);
        c.lineTo(s * 0.4, s * 0.4);
        c.lineTo(0, s * 2);
        c.lineTo(-s * 0.4, s * 0.4);
        c.lineTo(-s * 2, 0);
        c.lineTo(-s * 0.4, -s * 0.4);
        c.closePath();
        c.fill();
        c.restore();
      }
    }

    const particles = [];
    let width = 0;
    let height = 0;
    let lastX = 0;
    let lastY = 0;
    let ax = -100;
    let ay = -100;
    let tx = -100;
    let ty = -100;
    let currentTilt = 0;
    let running = false;
    let lastMove = 0;
    let isMouseDown = false;
    let holdInterval = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Authentic perfume spritz release from the nozzle
    const sprayMist = (isBurst = false) => {
      const rad = (currentTilt * Math.PI) / 180;
      // Nozzle is at local (15, 3). With anchor at (15, 6), offset is (0, -3)
      const nozzleX = ax;
      const nozzleY = ay - 3;
      const baseAngle = -Math.PI / 2 + rad; // upward spray

      // 1. Billowing vapor puffs (soft ethereal clouds)
      const puffCount = isBurst ? 12 : 1;
      for (let i = 0; i < puffCount; i += 1) {
        const spread = (Math.random() - 0.5) * 0.7; // ~40° cone
        const angle = baseAngle + spread;
        const speed = (isBurst ? 2.5 : 1.2) + Math.random() * (isBurst ? 4.5 : 1.8);
        particles.push(new PerfumeVaporCloud(nozzleX, nozzleY, angle, speed));
      }

      // 2. Atomized micro-droplets
      const dropCount = isBurst ? 28 : 2;
      for (let i = 0; i < dropCount; i += 1) {
        const spread = (Math.random() - 0.5) * 0.75;
        const angle = baseAngle + spread;
        const speed = (isBurst ? 3.5 : 1.5) + Math.random() * (isBurst ? 5.5 : 2.5);
        particles.push(new AtomizedDroplet(nozzleX, nozzleY, angle, speed, !isBurst));
      }

      // 3. Shimmer glints
      if (isBurst) {
        for (let i = 0; i < 4; i += 1) {
          const spread = (Math.random() - 0.5) * 0.5;
          const angle = baseAngle + spread;
          const speed = 2.0 + Math.random() * 3.0;
          particles.push(new ScentSparkle(nozzleX, nozzleY, angle, speed));
        }
      }
    };

    // Actuator pump bounce animation
    const pumpActuator = () => {
      const act = atomizer.querySelector('#samayActuator');
      if (act) {
        act.style.transform = 'translateY(1.8px)';
        setTimeout(() => {
          act.style.transform = 'translateY(0px)';
        }, 110);
      }
    };

    const tick = () => {
      running = true;
      ctx.clearRect(0, 0, width, height);

      ax += (tx - ax) * 0.25;
      ay += (ty - ay) * 0.25;
      currentTilt = Math.max(-12, Math.min(12, (tx - ax) * 0.3));
      // Anchor nozzle right at (ax, ay)
      atomizer.style.transform = `translate(${ax}px, ${ay}px) translate(-15px, -6px) rotate(${currentTilt}deg)`;

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.draw(ctx);
      }

      if (Date.now() - lastMove > 160) {
        atomizer.classList.remove('is-on');
      }

      if (particles.length || Date.now() - lastMove < 400) {
        requestAnimationFrame(tick);
      } else {
        running = false;
        ctx.clearRect(0, 0, width, height);
      }
    };

    const onMove = (event) => {
      const x = event.clientX;
      const y = event.clientY;
      if (ax === -100 && ay === -100) {
        ax = x;
        ay = y;
        lastX = x;
        lastY = y;
      }
      const vx = x - lastX;
      const vy = y - lastY;
      const dist = Math.hypot(vx, vy);
      lastX = x;
      lastY = y;
      tx = x;
      ty = y;
      lastMove = Date.now();
      atomizer.classList.add('is-on');

      // Subtle delicate scent trail on movement (not heavy spraying!)
      if (dist > 3.0 && Math.random() > 0.45) {
        sprayMist(false);
      }

      if (!running) requestAnimationFrame(tick);
    };

    const onDown = () => {
      isMouseDown = true;
      sprayMist(true); // Full, satisfying perfume spritz!
      pumpActuator();
      lastMove = Date.now();

      if (holdInterval) clearInterval(holdInterval);
      holdInterval = setInterval(() => {
        if (isMouseDown) {
          sprayMist(true);
          pumpActuator();
          lastMove = Date.now();
          if (!running) requestAnimationFrame(tick);
        }
      }, 140);

      if (!running) requestAnimationFrame(tick);
    };

    const onUp = () => {
      isMouseDown = false;
      if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    resize();
  }
})();

