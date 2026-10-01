/**
 * SAMAY PARFUMES — ZAYRO LUXURY STOREFRONT ENGINE
 * Fully delegated architecture resilient to dynamic updates and HotReload.
 * Handles chapter navigation, formula dossier modal, FAQ accordions, and Shopify AJAX cart drawer.
 */

(function () {
  'use strict';

  // ── Helper: Format Currency (₹ INR) ──────────────────────
  function formatMoney(cents) {
    return '₹' + Math.round(cents / 100).toLocaleString('en-IN');
  }

  // ── 1. Header Scroll Effect ─────────────────────────────
  function handleScroll() {
    const header = document.getElementById('zayro-header');
    if (header) {
      if (window.scrollY > 40) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }
    updateActiveChapter();
  }

  window.addEventListener('scroll', handleScroll, { passive: true });

  // ── 2. Chapter Navigation Active State ──────────────────
  function updateActiveChapter() {
    const sections = document.querySelectorAll('section[id]');
    const chapterLinks = document.querySelectorAll('.chapter-rail-item, .chapter-menu-item, .zayro-nav-link');
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

  // ── 3. Modal Helpers ────────────────────────────────────
  function openFormula() {
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

  // ── 4. Cart State Management (Shopify AJAX API) ─────────
  async function refreshCart() {
    try {
      const res = await fetch('/cart.js');
      if (!res.ok) return;
      const cart = await res.json();
      renderCart(cart);
    } catch (err) {
      console.warn('Zayro: Cart fetch fallback', err);
    }
  }

  function renderCart(cart) {
    const navCartBadge = document.getElementById('nav-cart-badge');
    const cartSubtotalEl = document.getElementById('cart-drawer-subtotal');
    const cartDrawerBody = document.getElementById('cart-drawer-body');

    if (navCartBadge) navCartBadge.textContent = cart.item_count || 0;
    if (cartSubtotalEl) cartSubtotalEl.textContent = formatMoney(cart.total_price || 0);

    if (!cartDrawerBody) return;

    if (!cart.item_count || cart.item_count === 0) {
      cartDrawerBody.innerHTML = `
        <div style="text-align:center; padding: 4rem 1.5rem;">
          <p style="font-family:var(--font-serif); font-size:1.35rem; font-style:italic; color:var(--text-muted); margin-bottom:1.75rem;">Your shopping bag is currently empty.</p>
          <a href="#packs" class="btn-luxury-solid" data-close-cart-link>Discover The Packs</a>
        </div>
      `;
      return;
    }

    let html = '';
    cart.items.forEach(item => {
      const linePrice = formatMoney(item.final_line_price);
      const imgUrl = item.image || '/assets/zayro-bottle-transparent.png';
      html += `
        <div class="cart-item-row" data-line-key="${item.key}">
          <img src="${imgUrl}" alt="${item.title}" class="cart-item-thumb">
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.product_title}</h4>
            ${item.variant_title ? `<p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.25rem;">${item.variant_title}</p>` : ''}
            <div class="cart-item-price">${linePrice}</div>
            <div class="cart-qty-ctrl">
              <button type="button" class="cart-qty-btn" data-action="minus" data-key="${item.key}" data-qty="${item.quantity - 1}">−</button>
              <span class="cart-qty-val">${item.quantity}</span>
              <button type="button" class="cart-qty-btn" data-action="plus" data-key="${item.key}" data-qty="${item.quantity + 1}">+</button>
            </div>
          </div>
        </div>
      `;
    });

    cartDrawerBody.innerHTML = html;
  }

  async function updateCartItem(key, quantity) {
    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: Math.max(0, quantity) })
      });
      const cart = await res.json();
      renderCart(cart);
    } catch (err) {
      console.error('Zayro: Cart update failed', err);
    }
  }

  async function addToCart(variantId, quantity = 1) {
    try {
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });
      await refreshCart();
      openCart();
    } catch (err) {
      console.error('Zayro: Add to cart failed', err);
      window.location.href = '/checkout';
    }
  }

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
    if (e.target.closest('#formula-modal-close') || e.target.closest('#formula-modal-backdrop')) {
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
    if (e.target.closest('#cart-drawer-close') || e.target.closest('#cart-drawer-backdrop') || e.target.closest('[data-close-cart-link]')) {
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
      const originalText = addBtn.innerHTML;

      addBtn.innerHTML = '<span>Adding...</span>';
      addBtn.disabled = true;

      if (variantId) {
        await addToCart(variantId, quantity);
      } else {
        window.location.href = '/collections/all';
      }

      addBtn.innerHTML = originalText;
      addBtn.disabled = false;
      return;
    }

    // Cart Quantity Buttons
    const qtyBtn = e.target.closest('.cart-qty-btn');
    if (qtyBtn) {
      e.preventDefault();
      const key = qtyBtn.getAttribute('data-key');
      const qty = parseInt(qtyBtn.getAttribute('data-qty'), 10);
      if (key) {
        await updateCartItem(key, qty);
      }
      return;
    }
  });

  // ── 6. Keyboard Accessibility (Escape to close modals) ──
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeFormula();
      closeCart();
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
