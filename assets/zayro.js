/**
 * SAMAY PARFUMES — ZAYRO LUXURY STOREFRONT ENGINE
 * Exact Mediterranean Sandstone Architecture
 * Handles chapter navigation, formula dossier modal, FAQ accordions, and Shopify AJAX cart drawer with preview fallback.
 */

(function () {
  'use strict';

  // ── Helper: Format Currency (₹ INR) ──────────────────────
  function formatMoney(cents) {
    return '₹' + Math.round(cents / 100).toLocaleString('en-IN');
  }

  // ── Helper: Safe Image Fallback ──────────────────────────
  function getBrandLogoUrl() {
    const logoEl = document.querySelector('.zayro-brand-logo-img');
    if (logoEl && logoEl.src) return logoEl.src;
    return 'assets/logo-black.png';
  }

  // ── Toast Notification ───────────────────────────────────
  function showToast(message) {
    const toast = document.getElementById('zayro-toast');
    const toastMsg = document.getElementById('toast-message');
    if (toast && toastMsg) {
      toastMsg.textContent = message;
      toast.classList.add('is-active');
      if (window._zayroToastTimeout) clearTimeout(window._zayroToastTimeout);
      window._zayroToastTimeout = setTimeout(() => {
        toast.classList.remove('is-active');
      }, 3500);
    }
  }

  // ── 1. Header Scroll Effect & Mobile Sticky Bar ────────
  function handleScroll() {
    const header = document.getElementById('zayro-header');
    if (header) {
      if (window.scrollY > 40) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }

    // Mobile Quick Purchase Sticky Bar
    const stickyBar = document.getElementById('sticky-mobile-bar') || document.getElementById('mobile-sticky-bar');
    if (stickyBar) {
      const scrollY = window.scrollY;
      const packsSec = document.getElementById('packs');
      const footer = document.querySelector('footer');

      if (scrollY > 320) {
        let hideBar = false;
        if (packsSec) {
          const top = packsSec.offsetTop - 120;
          const bottom = top + packsSec.offsetHeight;
          if (scrollY >= top && scrollY <= bottom) hideBar = true;
        }
        if (footer && scrollY >= footer.offsetTop - window.innerHeight + 80) {
          hideBar = true;
        }

        if (hideBar) {
          stickyBar.classList.remove('is-visible');
        } else {
          stickyBar.classList.add('is-visible');
        }
      } else {
        stickyBar.classList.remove('is-visible');
      }
    }

    updateActiveChapter();
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  // ── 2. Chapter Navigation Active State ──────────────────
  function updateActiveChapter() {
    const sections = document.querySelectorAll('section[id]');
    const chapterLinks = document.querySelectorAll('.zayro-nav-link');
    const scrollPos = window.scrollY + 250;

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      const id = sec.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        chapterLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('is-active');
          } else {
            link.classList.remove('is-active');
          }
        });
      }
    });
  }

  // ── 3. Modal & Drawer Helpers ───────────────────────────
  function openMobileMenu() {
    const menu = document.getElementById('zayro-mobile-menu');
    if (menu) {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeMobileMenu() {
    const menu = document.getElementById('zayro-mobile-menu');
    if (menu) {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  function openFormula() {
    closeMobileMenu();
    const modal = document.getElementById('zayro-formula-modal');
    if (modal) {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeFormula() {
    const modal = document.getElementById('zayro-formula-modal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  function openCart() {
    closeMobileMenu();
    closeFormula();
    const drawer = document.getElementById('zayro-cart-drawer');
    if (drawer) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      refreshCart();
    }
  }

  function closeCart() {
    const drawer = document.getElementById('zayro-cart-drawer');
    if (drawer) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  // ── 4. Cart State Management (Shopify AJAX API + Local Resilience) ──
  const isShopifyStore = typeof window.Shopify !== 'undefined' && Boolean(window.Shopify.shop);

  let localCart = {
    item_count: 0,
    total_price: 0,
    items: []
  };

  try {
    const stored = localStorage.getItem('zayro_cart_state');
    if (stored) localCart = JSON.parse(stored);
  } catch (e) {}

  function persistLocalCart() {
    try {
      localStorage.setItem('zayro_cart_state', JSON.stringify(localCart));
    } catch (e) {}
  }

  function recalcLocalCart() {
    let count = 0;
    let total = 0;
    localCart.items.forEach(it => {
      count += it.quantity;
      total += it.final_line_price;
    });
    localCart.item_count = count;
    localCart.total_price = total;
    persistLocalCart();
  }

  async function refreshCart() {
    try {
      const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const cart = await res.json();
        if (cart && (cart.item_count > 0 || isShopifyStore)) {
          renderCart(cart);
          return;
        }
      }
    } catch (err) {
      // Offline / standalone fallback
    }

    if (localCart.items && localCart.items.length > 0) {
      renderCart(localCart);
    } else {
      renderCart({ item_count: 0, total_price: 0, items: [] });
    }
  }

  function renderCart(cart) {
    const navCartBadge = document.getElementById('nav-cart-badge');
    const drawerCountEl = document.getElementById('cart-drawer-count');
    const cartSubtotalEl = document.getElementById('cart-drawer-subtotal');
    const cartDrawerItems = document.getElementById('cart-drawer-items') || document.getElementById('cart-drawer-body');

    const count = cart.item_count || 0;
    const total = cart.total_price || 0;

    if (navCartBadge) navCartBadge.textContent = count;
    if (drawerCountEl) drawerCountEl.textContent = `(${count})`;
    if (cartSubtotalEl) cartSubtotalEl.textContent = formatMoney(total);

    if (!cartDrawerItems) return;

    if (!cart.items || cart.items.length === 0) {
      cartDrawerItems.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">&#128717;</div>
          <p class="cart-empty-title">Your Bag is Empty</p>
          <p class="cart-empty-sub">Experience the timeless olfactory essence of Zayro Eau de Parfum.</p>
          <a href="#packs" class="btn-sand-solid" data-close-cart-link>EXPLORE PACKS &rarr;</a>
        </div>
      `;
      return;
    }

    let html = '';
    cart.items.forEach(item => {
      const linePrice = formatMoney(item.final_line_price);
      const imgUrl = item.image || getBrandLogoUrl();
      html += `
        <div class="cart-item-row" data-line-item-key="${item.key}">
          <div class="cart-item-thumb">
            <img src="${imgUrl}" alt="${item.title || 'Zayro Eau de Parfum'}" width="70" height="70">
          </div>
          <div class="cart-item-details">
            <h4 class="cart-item-title">${item.product_title || 'Zayro Eau de Parfum'}</h4>
            ${item.variant_title ? `<p class="cart-item-variant">${item.variant_title}</p>` : ''}
            <div class="cart-item-price-qty">
              <div class="cart-qty-ctrl">
                <button type="button" class="btn-qty-adj" data-key="${item.key}" data-adj="-1" aria-label="Decrease quantity">&minus;</button>
                <span class="qty-num">${item.quantity}</span>
                <button type="button" class="btn-qty-adj" data-key="${item.key}" data-adj="1" aria-label="Increase quantity">&plus;</button>
              </div>
              <span class="cart-item-price">${linePrice}</span>
            </div>
          </div>
          <button type="button" class="cart-item-remove" data-key="${item.key}" aria-label="Remove item">&times;</button>
        </div>
      `;
    });

    cartDrawerItems.innerHTML = html;
  }

  async function updateCartItem(key, quantity) {
    let updatedViaShopify = false;
    if (isShopifyStore) {
      try {
        const res = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ id: key, quantity: Math.max(0, quantity) })
        });
        if (res.ok) {
          updatedViaShopify = true;
          const cart = await res.json();
          renderCart(cart);
        }
      } catch (err) {}
    }

    if (!updatedViaShopify) {
      if (quantity <= 0) {
        localCart.items = localCart.items.filter(i => i.key !== key);
      } else {
        const item = localCart.items.find(i => i.key === key);
        if (item) {
          item.quantity = quantity;
          item.final_line_price = item.price * quantity;
        }
      }
      recalcLocalCart();
      renderCart(localCart);
    }
  }

  async function addToCart(variantId, quantity = 1, packName = 'Zayro Eau de Parfum', priceInRupees = 1499) {
    let addedViaShopify = false;
    if (variantId && isShopifyStore) {
      try {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity })
        });
        if (res.ok) {
          addedViaShopify = true;
          await refreshCart();
        }
      } catch (err) {
        console.warn('Shopify add error, falling back to local simulation', err);
      }
    }

    if (!addedViaShopify) {
      const unitPriceCents = priceInRupees * 100;
      const existing = localCart.items.find(i => i.title === packName);
      if (existing) {
        existing.quantity += quantity;
        existing.final_line_price = existing.quantity * unitPriceCents;
      } else {
        localCart.items.push({
          key: 'item_' + Date.now(),
          title: packName,
          product_title: 'ZAYRO Eau de Parfum',
          variant_title: packName,
          price: unitPriceCents,
          final_line_price: unitPriceCents * quantity,
          quantity: quantity,
          image: getBrandLogoUrl()
        });
      }
      recalcLocalCart();
      renderCart(localCart);
    }

    showToast(`${packName} added to your shopping bag`);
    openCart();
  }

  // ── Customer Reviews Array ───────────────────────────────
  const customerReviews = [
    'Verified Customer: "An absolutely premium fragrance! Long lasting and perfect for every occasion." ★★★★★',
    'Kabir M. (Mumbai): "The opening bergamot and drydown of cedarwood and amber is divine. 16+ hours longevity." ★★★★★',
    'Aisha R. (New Delhi): "A masterpiece in Indian luxury perfumery. The heavy crystal cap feels regal." ★★★★★',
    'Rohan S. (Bangalore): "Ordered the Duo Pack. Packaging and maceration quality exceeded expectations." ★★★★★',
    'Meera V. (Hyderabad): "Compliments everywhere I go. True Eau de Parfum concentration with rich sillage." ★★★★★'
  ];
  let reviewIdx = 0;

  // ── 5. Global Delegated Click Handler ────────────────────
  document.addEventListener('click', async function (e) {
    // Open Formula Modal
    const openFormulaBtn = e.target.closest('[data-open-formula]');
    if (openFormulaBtn) {
      e.preventDefault();
      openFormula();
      return;
    }

    // Close Formula Modal
    if (e.target.closest('#formula-modal-close') || e.target.closest('#formula-modal-backdrop') || e.target.closest('[data-close-formula]')) {
      e.preventDefault();
      closeFormula();
      return;
    }

    // Open Cart Drawer
    if (e.target.closest('#nav-cart-btn') || e.target.closest('[data-open-cart]')) {
      e.preventDefault();
      openCart();
      return;
    }

    // Close Cart Drawer
    if (e.target.closest('#cart-drawer-close') || e.target.closest('#cart-drawer-backdrop') || e.target.closest('[data-close-cart-link]') || e.target.closest('[data-close-cart-drawer]')) {
      e.preventDefault();
      closeCart();
      return;
    }

    // FAQ Accordion Toggle
    const faqBtn = e.target.closest('.faq-question-btn');
    if (faqBtn) {
      e.preventDefault();
      const item = faqBtn.closest('.faq-item');
      if (item) {
        const isOpen = item.classList.contains('is-open');
        document.querySelectorAll('.faq-item').forEach(other => other.classList.remove('is-open'));
        if (!isOpen) {
          item.classList.add('is-open');
        }
      }
      return;
    }

    // Add to Cart Buttons
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.preventDefault();
      const variantId = addBtn.getAttribute('data-variant-id');
      const quantity = parseInt(addBtn.getAttribute('data-quantity') || '1', 10);
      const packName = addBtn.getAttribute('data-pack-name') || 'Zayro Eau de Parfum';
      const price = parseInt(addBtn.getAttribute('data-price') || '1499', 10);

      addBtn.classList.add('is-loading');
      await addToCart(variantId, quantity, packName, price);
      addBtn.classList.remove('is-loading');
      return;
    }

    // Open Mobile Menu
    if (e.target.closest('#mobile-menu-toggle')) {
      e.preventDefault();
      openMobileMenu();
      return;
    }

    // Close Mobile Menu
    if (e.target.closest('#mobile-menu-close') || e.target.closest('#mobile-menu-backdrop') || e.target.closest('[data-close-mobile-menu]')) {
      closeMobileMenu();
      const link = e.target.closest('a[href^="#"]');
      if (link) {
        const targetId = link.getAttribute('href').substring(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          setTimeout(() => {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }, 250);
        }
      }
      return;
    }

    // Cart Quantity Adjustment Buttons
    const adjBtn = e.target.closest('.btn-qty-adj');
    if (adjBtn) {
      e.preventDefault();
      const key = adjBtn.getAttribute('data-key');
      const adj = parseInt(adjBtn.getAttribute('data-adj'), 10);
      const row = adjBtn.closest('.cart-item-row');
      const qtyNum = row ? row.querySelector('.qty-num') : null;
      const currentQty = qtyNum ? parseInt(qtyNum.textContent, 10) : 1;
      const newQty = Math.max(0, currentQty + adj);
      if (key) {
        await updateCartItem(key, newQty);
      }
      return;
    }

    // Remove Cart Item
    const removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) {
      e.preventDefault();
      const key = removeBtn.getAttribute('data-key');
      if (key) {
        await updateCartItem(key, 0);
      }
      return;
    }

    // Checkout Button Handling
    const checkoutBtn = e.target.closest('.btn-checkout');
    if (checkoutBtn && !isShopifyStore) {
      e.preventDefault();
      showToast('Proceeding to Express COD & UPI Checkout (' + formatMoney(localCart.total_price) + ')');
      setTimeout(() => {
        showToast('✓ Dispatch confirmed: Kanpur Atelier • 24-48 hr courier tracking');
      }, 1600);
      return;
    }

    // Review Arrow Click (Visual interaction)
    const reviewArrow = e.target.closest('.hotspot-review-arrow');
    if (reviewArrow) {
      e.preventDefault();
      if (reviewArrow.classList.contains('rev-next')) {
        reviewIdx = (reviewIdx + 1) % customerReviews.length;
      } else {
        reviewIdx = (reviewIdx - 1 + customerReviews.length) % customerReviews.length;
      }
      showToast(customerReviews[reviewIdx]);
      return;
    }

    // Details Craftsmanship Hotspot
    const detailsAction = e.target.closest('.hotspot-details-action');
    if (detailsAction) {
      e.preventDefault();
      openFormula();
      return;
    }

    // Smooth In-Page Anchor Navigation
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor && !anchor.closest('#zayro-mobile-menu')) {
      const href = anchor.getAttribute('href');
      if (href && href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  });

  // ── 6. Keyboard Accessibility (Escape to close modals) ──
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeFormula();
      closeCart();
      closeMobileMenu();
    }
  });

  // ── 7. Initial Lifecycle Run ─────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      refreshCart();
      handleScroll();
    });
  } else {
    refreshCart();
    handleScroll();
  }
})();
