/**
 * SAMAY PARFUMES - Interactive Logic & E-Commerce Cart System
 */

(function () {
  'use strict';

  // Default Zyro Product Catalog Definitions
  const ZYRO_PRODUCTS = {
    'zyro-single': {
      id: 'zyro-single',
      shopifyId: 1,
      name: 'Zyro Eau De Parfum (50ml)',
      variant: 'Single Bottle (1x 50ml)',
      price: 1499,
      comparePrice: 2199,
      image: 'zyro-single.jpg'
    },
    'zyro-duo': {
      id: 'zyro-duo',
      shopifyId: 2,
      name: 'Zyro Duo Privilege Set (50ml + 50ml)',
      variant: '2-in-1 Combo (2x 50ml)',
      price: 2499,
      comparePrice: 3699,
      image: 'zyro-duo.jpg'
    },
    'zyro-trio': {
      id: 'zyro-trio',
      shopifyId: 3,
      name: 'Zyro Grand Trio Reserve (50ml + 50ml + 50ml)',
      variant: '3-in-1 Combo (3x 50ml)',
      price: 3299,
      comparePrice: 5399,
      image: 'zyro-trio.jpg'
    }
  };

  // State Management
  let cart = [];
  try {
    const saved = localStorage.getItem('samay_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }

  function saveCart() {
    try {
      localStorage.setItem('samay_cart', JSON.stringify(cart));
    } catch (e) {}
    renderCart();
  }

  function addToCart(productId, qty) {
    qty = parseInt(qty, 10) || 1;
    const itemInfo = ZYRO_PRODUCTS[productId];
    if (!itemInfo) return;

    const existing = cart.find(item => item.id === productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({
        id: itemInfo.id,
        name: itemInfo.name,
        variant: itemInfo.variant,
        price: itemInfo.price,
        image: itemInfo.image,
        quantity: qty
      });
    }

    saveCart();
    openCartDrawer();

    // Also attempt Shopify AJAX Cart API if available
    try {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            quantity: qty,
            id: itemInfo.shopifyId || 1,
            properties: {
              'Edition': itemInfo.variant
            }
          }]
        })
      }).catch(() => {});
    } catch (err) {}
  }

  function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
  }

  function updateQuantity(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (item) {
      item.quantity += delta;
      if (item.quantity <= 0) {
        removeFromCart(productId);
      } else {
        saveCart();
      }
    }
  }

  function renderCart() {
    const countBubbles = document.querySelectorAll('.samay-cart-badge');
    const totalCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);
    countBubbles.forEach(b => {
      b.textContent = totalCount;
      b.style.display = totalCount > 0 ? 'flex' : 'none';
    });

    const drawerItemsContainer = document.getElementById('samayCartDrawerItems');
    const subtotalEl = document.getElementById('samayCartSubtotal');
    if (!drawerItemsContainer || !subtotalEl) return;

    if (cart.length === 0) {
      drawerItemsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: var(--taupe);">
          <div style="font-size: 2.4rem; color: var(--gold); margin-bottom: 12px;">⚜</div>
          <h4 style="font-family: var(--serif); font-size: 1.4rem; margin-bottom: 8px;">Your Shopping Bag is Empty</h4>
          <p style="font-size: 0.9rem; color: var(--dim);">Experience the timeless essence of Zyro Eau De Parfum.</p>
          <a href="#collection" class="samay-btn samay-btn--gold" style="margin-top: 16px; padding: 12px 24px;" onclick="closeCartDrawer()">SHOP ZYRO</a>
        </div>
      `;
      subtotalEl.textContent = '₹0';
      return;
    }

    let subtotal = 0;
    drawerItemsContainer.innerHTML = cart.map(item => {
      const lineTotal = item.price * item.quantity;
      subtotal += lineTotal;
      return `
        <div class="samay-cart-item">
          <img src="${window.samayAssetUrl ? window.samayAssetUrl + item.image : item.image}" alt="${item.name}" class="samay-cart-item-img">
          <div class="samay-cart-item-details">
            <h5 class="samay-cart-item-title">${item.name}</h5>
            <div class="samay-cart-item-variant">${item.variant}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
              <span class="samay-cart-item-price">₹${item.price.toLocaleString('en-IN')} × ${item.quantity}</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <button type="button" class="samay-qty-btn" style="width:24px;height:24px;font-size:0.8rem;" onclick="window.samayCart.updateQty('${item.id}', -1)">-</button>
                <span style="font-size:0.85rem;font-weight:600;">${item.quantity}</span>
                <button type="button" class="samay-qty-btn" style="width:24px;height:24px;font-size:0.8rem;" onclick="window.samayCart.updateQty('${item.id}', 1)">+</button>
              </div>
            </div>
            <div style="margin-top: 8px;">
              <button type="button" class="samay-cart-item-remove" onclick="window.samayCart.remove('${item.id}')">Remove</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
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

  // Expose Cart Functions to Window
  window.samayCart = {
    add: addToCart,
    remove: removeFromCart,
    updateQty: updateQuantity,
    open: openCartDrawer,
    close: closeCartDrawer
  };

  // DOM Loaded Listeners
  document.addEventListener('DOMContentLoaded', function () {
    renderCart();

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
        document.querySelectorAll('.samay-faq-item').forEach(i => i.classList.remove('is-open'));
        if (!isOpen) item.classList.add('is-open');
      });
    });

    // Quantity buttons on product cards
    document.querySelectorAll('.samay-product-card').forEach(card => {
      const input = card.querySelector('.samay-qty-input');
      const minus = card.querySelector('.samay-qty-minus');
      const plus = card.querySelector('.samay-qty-plus');
      const addBtn = card.querySelector('.samay-add-cart-btn');
      const buyBtn = card.querySelector('.samay-buy-now-btn');
      const productId = card.getAttribute('data-product-id');

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

      if (addBtn && productId) {
        addBtn.addEventListener('click', () => {
          const qty = parseInt(input?.value, 10) || 1;
          addToCart(productId, qty);
        });
      }

      if (buyBtn && productId) {
        buyBtn.addEventListener('click', () => {
          const qty = parseInt(input?.value, 10) || 1;
          addToCart(productId, qty);
          // Redirect to checkout
          window.location.href = '/checkout';
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

    // Contact Form handling
    const contactForm = document.getElementById('samayContactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const successMsg = document.getElementById('samayContactSuccess');
        if (successMsg) {
          successMsg.style.display = 'block';
          contactForm.reset();
          setTimeout(() => {
            successMsg.style.display = 'none';
          }, 6000);
        }
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
    atomizer.style.cssText = 'position:fixed!important;top:0!important;left:0!important;width:36px!important;height:52px!important;max-width:36px!important;max-height:52px!important;pointer-events:none!important;z-index:99999!important;will-change:transform;transition:opacity 0.25s;';
    atomizer.innerHTML = `
      <svg width="36" height="52" viewBox="0 0 36 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:36px!important;height:52px!important;max-width:36px!important;max-height:52px!important;display:block!important;filter:drop-shadow(0 2px 6px rgba(44,31,14,0.25));">
        <path d="M14 14h8v4.5c0 1 .6 1.5 1.5 1.5H26c1.2 0 2 .8 2 2v1H8v-1c0-1.2.8-2 2-2h2.5c.9 0 1.5-.5 1.5-1.5V14Z" stroke="#C9A96E" stroke-width="1.2"/>
        <rect x="11" y="23" width="14" height="24" rx="4" stroke="#C9A96E" stroke-width="1.2"/>
        <path d="M15 30h6M15 35h6M15 40h4" stroke="#C9A96E" stroke-width="1" stroke-linecap="round" opacity="0.7"/>
        <path d="M18 8.5c0-2.4 1.4-4.5 4-5.2" stroke="#C9A96E" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="23.5" cy="2.6" r="1.4" fill="#C9A96E"/>
        <rect x="16.5" y="8" width="3" height="6" rx="0.6" fill="#C9A96E"/>
      </svg>
    `;
    document.body.appendChild(atomizer);

    const particles = [];
    let width = 0;
    let height = 0;
    let lastX = 0;
    let lastY = 0;
    let ax = -100;
    let ay = -100;
    let tx = -100;
    let ty = -100;
    let running = false;
    let lastMove = 0;

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

    const goldPalette = [
      [201, 169, 110], // Warm Antique Gold
      [247, 242, 234], // Champagne Sparkle
      [168, 132, 74],  // Rich Amber
      [239, 232, 220]  // Soft Luminous Cream
    ];

    const spawn = (x, y, vx, vy, burst = false) => {
      const count = burst ? 28 : Math.min(10, 3 + Math.hypot(vx, vy) * 0.08);
      const speed = burst ? 3.2 : 1.1;

      for (let i = 0; i < count; i += 1) {
        const angle = Math.atan2(vy, vx) + (Math.random() - 0.5) * (burst ? 2.4 : 0.9);
        const mag = (burst ? 1.4 : 0.45) + Math.random() * speed;
        const color = goldPalette[Math.floor(Math.random() * goldPalette.length)];

        particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y - 18 + (Math.random() - 0.5) * 6,
          vx: Math.cos(angle) * mag * 2.2,
          vy: Math.sin(angle) * mag * 2.2 - 0.35,
          life: 1,
          decay: 0.012 + Math.random() * 0.02,
          size: burst ? 1.6 + Math.random() * 3.4 : 0.8 + Math.random() * 2.4,
          r: color[0],
          g: color[1],
          b: color[2],
          mist: Math.random() > 0.55
        });
      }
    };

    const tick = () => {
      running = true;
      ctx.clearRect(0, 0, width, height);

      ax += (tx - ax) * 0.22;
      ay += (ty - ay) * 0.22;
      const angle = Math.max(-18, Math.min(18, (tx - ax) * 0.4));
      atomizer.style.transform = `translate(${ax}px, ${ay}px) translate(-50%, -70%) rotate(${angle}deg)`;

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.vy -= 0.012;
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const alpha = p.life * (p.mist ? 0.28 : 0.7);

        ctx.beginPath();
        if (p.mist) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
          g.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${alpha})`);
          g.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
          ctx.fillStyle = g;
          ctx.arc(p.x, p.y, p.size * 6, 0, Math.PI * 2);
        } else {
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      if (Date.now() - lastMove > 140) {
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
      lastX = x;
      lastY = y;
      tx = x;
      ty = y;
      lastMove = Date.now();
      atomizer.classList.add('is-on');

      if (Math.hypot(vx, vy) > 0.4) {
        spawn(x, y, vx, vy, false);
      }

      if (!running) requestAnimationFrame(tick);
    };

    const onClick = (event) => {
      spawn(event.clientX, event.clientY, 0, -2, true);
      lastMove = Date.now();
      if (!running) requestAnimationFrame(tick);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('click', onClick);
    resize();
  }
})();

