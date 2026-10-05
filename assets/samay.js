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
  });
})();
