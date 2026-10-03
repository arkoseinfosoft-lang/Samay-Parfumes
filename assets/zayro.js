/**
 * SAMAY PARFUMES — ZAYRO LUXURY STOREFRONT ENGINE
 * Exact Mediterranean Sandstone Architecture
 * Handles chapter navigation, formula dossier modal, FAQ accordions, and Shopify AJAX cart drawer.
 */

(function () {
  'use strict';

  // ── Helper: Format Currency (₹ INR) ──────────────────────
  function formatMoney(cents) {
    return '₹' + Math.round(cents / 100).toLocaleString('en-IN');
  }

  // ── Toast Notification ───────────────────────────────────
  function showToast(message) {
    const toast = document.getElementById('zayro-toast');
    const toastMsg = document.getElementById('toast-message');
    if (toast && toastMsg) {
      toastMsg.textContent = message;
      toast.classList.add('is-active');
      setTimeout(() => {
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

      if (scrollY > 350) {
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
    const drawerCountEl = document.getElementById('cart-drawer-count');
    const cartSubtotalEl = document.getElementById('cart-drawer-subtotal');
    const cartDrawerItems = document.getElementById('cart-drawer-items') || document.getElementById('cart-drawer-body');

    if (navCartBadge) navCartBadge.textContent = cart.item_count || 0;
    if (drawerCountEl) drawerCountEl.textContent = `(${cart.item_count || 0})`;
    if (cartSubtotalEl) cartSubtotalEl.textContent = formatMoney(cart.total_price || 0);

    if (!cartDrawerItems) return;

    if (!cart.item_count || cart.item_count === 0) {
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
      const imgUrl = item.image || '{{ "logo-black.png" | asset_url }}';
      html += `
        <div class="cart-item-row" data-line-item-key="${item.key}">
          <div class="cart-item-thumb">
            <img src="${imgUrl}" alt="${item.title}" width="70" height="70">
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

  async function addToCart(variantId, quantity = 1, packName = 'Zayro') {
    try {
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });
      await refreshCart();
      showToast(`${packName} added to your shopping bag`);
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

      addBtn.classList.add('is-loading');

      if (variantId) {
        await addToCart(variantId, quantity, packName);
      } else {
        window.location.href = '/collections/all';
      }

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

    // Cart Quantity Buttons
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

    // Review Arrow Click (Visual interaction)
    const reviewArrow = e.target.closest('.hotspot-review-arrow');
    if (reviewArrow) {
      e.preventDefault();
      showToast('Verified Customer: "An absolutely premium fragrance! Long lasting and perfect."');
      return;
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
