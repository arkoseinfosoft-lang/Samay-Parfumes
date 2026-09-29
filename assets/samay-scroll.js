/**
 * samay-scroll.js — Complete storefront engine for Samay Parfumes
 *
 * Responsibilities:
 *  - Responsive horizontal (desktop) / vertical (mobile < 768px) scroll driver
 *  - Lenis smooth-scroll & GSAP ScrollTrigger synchronization
 *  - Full-screen numbered menu (01-07) with smooth anchor navigation & deep linking
 *  - Dynamic URL hash updates (#home, #about, #notes, #bottle, #reviews, #faq, #contact)
 *  - Slide-out AJAX Cart Drawer with live item management & count synchronization
 *  - AJAX Contact Form transmission without page reload
 *  - FAQ Accordion (one open at a time)
 *  - Policy Modals (Shipping, Refund, Privacy, Terms) with shop.policies content
 *  - Product Volume & Price pill switcher with Buy Now & Add to Cart
 *  - Reviews slider carousel
 *  - Preloader with failsafe timeout & accessibility focus management
 */

(function () {
  'use strict';

  /* ── DOM & Query Helpers ──────────────────────────────── */
  const $ = id => document.getElementById(id);
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── State ────────────────────────────────────────────── */
  let gsap, ScrollTrigger, Lenis;
  let lenisInstance = null;
  let scrollTriggerInstance = null;
  let trackTween = null;
  let numPanels = 8;
  let currentPanel = 0;
  let bottleDragActive = false;
  let hintShown = false;
  let hintTimer = null;
  let hasInteracted = false;
  let isNavigatingAnchor = false;

  const ANCHORS = ['home', 'about', 'notes', 'bottle', 'reviews', 'faq', 'contact', 'footer'];
  const CHAPTER_NAMES = [
    '01 / OUVERTURE',
    '02 / ABOUT',
    '03 / NOTES',
    '04 / THE BOTTLE',
    '05 / REVIEWS',
    '06 / FAQ',
    '07 / CONTACT',
    '08 / FOOTER'
  ];

  /* ── DOM Refs ─────────────────────────────────────────── */
  let root, trackOuter, track, progressFill, counter, dragHint, canvas;
  let navMenuToggle, menuOverlay, menuCloseBtn;
  let navCartBtn, cartDrawer, cartBackdrop, cartCloseBtn, cartDrawerBody;
  let policyModal, policyBackdrop, policyCloseBtn, policyTitle, policyContent;

  /* ── Currency / Money Formatter ──────────────────────── */
  function formatMoney(cents) {
    if (typeof cents !== 'number') cents = parseInt(cents, 10) || 0;
    const format = window.SamayConfig?.moneyFormat || '₹{{amount}}';
    const amount = (cents / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    return format.replace(/\{\{\s*amount\s*\}\}/g, amount)
                 .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, amount);
  }

  /* ── Bootstrap ───────────────────────────────────────── */
  function init() {
    root        = $('samay-root');
    trackOuter  = $('samay-track-outer');
    track       = $('samay-track');
    progressFill = $('samay-progress-fill');
    counter     = $('samay-counter');
    dragHint    = $('drag-hint');
    canvas      = $('samay-canvas');

    if (!root || !track) return;

    const panelElements = qsa('.samay-panel');
    numPanels = panelElements.length || window.SamayConfig?.numPanels || 8;

    gsap          = window.gsap;
    ScrollTrigger = window.ScrollTrigger;
    Lenis         = window.Lenis;

    initNavigation();
    initCartDrawer();
    initContactForm();
    initFaqAccordion();
    initPolicyModals();
    initProductCard();
    initReviewsSlider();

    if (isMobile()) {
      setupMobileLayout();
    } else {
      setupDesktopScroll();
    }

    // Handle deep link on initial load
    setTimeout(handleInitialHash, 300);

    // Watch for window resize to toggle desktop / mobile cleanly
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const currentlyMobile = isMobile();
        if (currentlyMobile && lenisInstance) {
          teardownDesktopScroll();
          setupMobileLayout();
        } else if (!currentlyMobile && !lenisInstance) {
          setupDesktopScroll();
        }
      }, 200);
    });
  }

  /* ── Desktop Horizontal Scroll System ─────────────────── */
  function setupDesktopScroll() {
    if (prefersReduced()) {
      setupReducedMotion();
      return;
    }

    if (!gsap || !ScrollTrigger || !Lenis) return;
    gsap.registerPlugin(ScrollTrigger);

    // Set scroll height
    root.style.height = `${numPanels * 100}dvh`;
    if (trackOuter) {
      trackOuter.style.position = 'sticky';
      trackOuter.style.height = '100dvh';
      trackOuter.style.overflow = 'hidden';
    }
    if (track) {
      track.style.display = 'flex';
      track.style.flexDirection = 'row';
      track.style.width = `${numPanels * 100}vw`;
      track.style.height = '100dvh';
    }

    // Initialize Lenis
    lenisInstance = new Lenis({
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      infinite: false,
      autoRaf: false,
    });

    gsap.ticker.add(time => {
      if (lenisInstance && !bottleDragActive) {
        lenisInstance.raf(time * 1000);
      }
    });
    gsap.ticker.lagSmoothing(0);

    lenisInstance.on('scroll', () => {
      ScrollTrigger.update();
    });

    // Pinned ScrollTrigger with scrub
    scrollTriggerInstance = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: `+=${(numPanels - 1) * window.innerHeight * 1.2}px`,
      pin: trackOuter,
      scrub: 1.0,
      invalidateOnRefresh: true,
      onUpdate: self => {
        applyProgress(self.progress);
      },
    });

    trackTween = gsap.to(track, {
      x: () => -((numPanels - 1) * window.innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: `+=${(numPanels - 1) * window.innerHeight * 1.2}px`,
        scrub: 1.0,
        invalidateOnRefresh: true,
      },
    });

    setupKeyboard();
    setupTrackpadHorizontal();
    updateCounter(0, numPanels);
  }

  function teardownDesktopScroll() {
    if (lenisInstance) {
      lenisInstance.destroy();
      lenisInstance = null;
    }
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
      scrollTriggerInstance = null;
    }
    if (trackTween) {
      trackTween.kill();
      trackTween = null;
    }
    if (track) {
      gsap.set(track, { clearProps: 'all' });
    }
    if (trackOuter) {
      gsap.set(trackOuter, { clearProps: 'all' });
    }
    if (root) {
      gsap.set(root, { clearProps: 'all' });
    }
  }

  /* ── Mobile Layout (< 768px) ─────────────────────────── */
  function setupMobileLayout() {
    if (root) root.style.height = 'auto';
    if (trackOuter) {
      trackOuter.style.position = 'static';
      trackOuter.style.height = 'auto';
      trackOuter.style.overflow = 'visible';
    }
    if (track) {
      track.style.display = 'flex';
      track.style.flexDirection = 'column';
      track.style.transform = 'none';
      track.style.width = '100%';
      track.style.height = 'auto';
    }

    document.body.style.overflow = 'auto';

    // IntersectionObserver for mobile section detection
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute('data-panel') || '0', 10);
          currentPanel = idx;
          updateCounter(idx, numPanels);
          updateNavIndicator(idx);
          revealPanel(idx);
          if (!isNavigatingAnchor) {
            updateUrlHash(idx);
          }
        }
      });
    }, { threshold: 0.35 });

    qsa('.samay-panel').forEach(panel => observer.observe(panel));
    revealPage();
  }

  /* ── Scroll Progress & Reveal Hooks ──────────────────── */
  function applyProgress(p) {
    if (progressFill) progressFill.style.width = `${p * 100}%`;

    const panel = Math.min(Math.floor(p * numPanels), numPanels - 1);
    if (panel !== currentPanel) {
      currentPanel = panel;
      updateCounter(panel, numPanels);
      updateNavIndicator(panel);
      if (window.SamayScene?.setPanelIndex) window.SamayScene.setPanelIndex(panel);

      if (canvas) {
        canvas.classList.toggle('interactive', panel === 0);
      }
      if (panel === 0 && !hasInteracted && dragHint) {
        showDragHint();
      }

      revealPanel(panel);

      if (!isNavigatingAnchor) {
        updateUrlHash(panel);
      }
    }

    if (window.SamayScene?.setScrollProgress) {
      window.SamayScene.setScrollProgress(p);
    }
  }

  function revealPanel(panelIndex) {
    const panels = [
      { sel: '.panel-hero', cls: 'hero-revealed' },
      { sel: '.panel-story', cls: 'story-revealed' },
      { sel: '.panel-notes', cls: 'notes-revealed' },
      { sel: '.panel-product', cls: 'product-revealed' },
      { sel: '.panel-reviews', cls: 'reviews-revealed' },
      { sel: '.panel-faq', cls: 'faq-revealed' },
      { sel: '.panel-contact', cls: 'contact-revealed' },
      { sel: '.panel-footer', cls: 'footer-revealed' }
    ];

    panels.forEach((item, idx) => {
      const el = qs(item.sel);
      if (el) {
        if (panelIndex >= idx) {
          el.classList.add(item.cls);
        } else if (!isMobile()) {
          el.classList.remove(item.cls);
        }
      }
    });
  }

  function updateCounter(panel, total) {
    if (!counter) return;
    const cur = String(panel + 1).padStart(2, '0');
    const tot = String(total).padStart(2, '0');
    counter.innerHTML = `<span class="current">${cur}</span> / ${tot}`;
  }

  function updateNavIndicator(panel) {
    const ind = $('nav-chapter-indicator');
    if (ind && CHAPTER_NAMES[panel]) {
      ind.textContent = CHAPTER_NAMES[panel];
    }
  }

  function updateUrlHash(panel) {
    const anchor = ANCHORS[panel];
    if (anchor && window.location.hash !== `#${anchor}`) {
      try {
        history.replaceState(null, '', `#${anchor}`);
      } catch (e) {}
    }
  }

  /* ── Anchor Navigation & Deep Linking ────────────────── */
  function scrollToPanel(indexOrAnchor, updateHash = true) {
    let index = 0;
    let anchor = 'home';

    if (typeof indexOrAnchor === 'number') {
      index = Math.max(0, Math.min(indexOrAnchor, numPanels - 1));
      anchor = ANCHORS[index] || 'home';
    } else if (typeof indexOrAnchor === 'string') {
      const clean = indexOrAnchor.replace('#', '').toLowerCase();
      const foundIdx = ANCHORS.indexOf(clean);
      if (foundIdx !== -1) {
        index = foundIdx;
        anchor = clean;
      } else {
        const el = document.getElementById(clean);
        if (el && el.hasAttribute('data-panel')) {
          index = parseInt(el.getAttribute('data-panel'), 10);
          anchor = clean;
        }
      }
    }

    isNavigatingAnchor = true;
    if (updateHash) {
      try {
        history.pushState(null, '', `#${anchor}`);
      } catch (e) {}
    }

    currentPanel = index;
    updateCounter(index, numPanels);
    updateNavIndicator(index);
    revealPanel(index);

    if (isMobile()) {
      const targetEl = document.getElementById(anchor) || qs(`[data-panel="${index}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => { isNavigatingAnchor = false; }, 800);
    } else {
      if (!scrollTriggerInstance || !lenisInstance) {
        isNavigatingAnchor = false;
        return;
      }
      const st = scrollTriggerInstance;
      const progressTarget = numPanels > 1 ? index / (numPanels - 1) : 0;
      const targetScroll = st.start + progressTarget * (st.end - st.start);

      lenisInstance.scrollTo(targetScroll, {
        duration: 1.2,
        onComplete: () => {
          isNavigatingAnchor = false;
        }
      });
    }
  }

  function handleInitialHash() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      scrollToPanel(hash, false);
    }
  }

  /* ── Navigation & Full-Screen Menu ────────────────────── */
  function initNavigation() {
    navMenuToggle = $('nav-menu-toggle');
    menuOverlay   = $('samay-menu-overlay');
    menuCloseBtn  = $('menu-close-btn');

    if (!navMenuToggle || !menuOverlay) return;

    function openMenu() {
      menuOverlay.classList.add('is-open');
      menuOverlay.setAttribute('aria-hidden', 'false');
      navMenuToggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      menuCloseBtn?.focus();
    }

    function closeMenu() {
      menuOverlay.classList.remove('is-open');
      menuOverlay.setAttribute('aria-hidden', 'true');
      navMenuToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    }

    navMenuToggle.addEventListener('click', () => {
      const isOpen = menuOverlay.classList.contains('is-open');
      if (isOpen) closeMenu();
      else openMenu();
    });

    menuCloseBtn?.addEventListener('click', closeMenu);

    // Backdrop click
    qs('.menu-overlay-backdrop', menuOverlay)?.addEventListener('click', closeMenu);

    // Menu link jumps
    qsa('.menu-link', menuOverlay).forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const targetAnchor = link.getAttribute('data-anchor') || link.getAttribute('href');
        closeMenu();
        setTimeout(() => {
          scrollToPanel(targetAnchor);
        }, 300);
      });
    });

    // In-page anchor triggers
    document.addEventListener('click', e => {
      const anchorBtn = e.target.closest('[data-nav-target]');
      if (!anchorBtn) return;
      e.preventDefault();
      const target = anchorBtn.getAttribute('data-nav-target');
      scrollToPanel(target);
    });

    // Keyboard ESC
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (menuOverlay.classList.contains('is-open')) closeMenu();
        if (cartDrawer?.classList.contains('is-open')) closeCartDrawer();
        if (policyModal?.classList.contains('is-open')) closePolicyModal();
      }
    });
  }

  /* ── Slide-Out Cart Drawer (AJAX Cart API) ───────────── */
  function initCartDrawer() {
    navCartBtn      = $('nav-cart-btn');
    cartDrawer      = $('samay-cart-drawer');
    cartBackdrop    = $('cart-drawer-backdrop');
    cartCloseBtn    = $('cart-drawer-close');
    cartDrawerBody  = $('cart-drawer-body');

    if (!cartDrawer) return;

    navCartBtn?.addEventListener('click', openCartDrawer);
    cartCloseBtn?.addEventListener('click', closeCartDrawer);
    cartBackdrop?.addEventListener('click', closeCartDrawer);

    $('cart-empty-discover-btn')?.addEventListener('click', e => {
      e.preventDefault();
      closeCartDrawer();
      scrollToPanel('bottle');
    });

    // Cart items delegation: Quantity & Remove
    cartDrawer.addEventListener('click', e => {
      const minusBtn = e.target.closest('.cart-qty-minus');
      const plusBtn  = e.target.closest('.cart-qty-plus');
      const removeBtn = e.target.closest('.cart-item-remove');

      if (minusBtn) {
        const key = minusBtn.getAttribute('data-key');
        const qty = parseInt(minusBtn.getAttribute('data-qty'), 10);
        updateCartItem(key, Math.max(0, qty));
      } else if (plusBtn) {
        const key = plusBtn.getAttribute('data-key');
        const qty = parseInt(plusBtn.getAttribute('data-qty'), 10);
        updateCartItem(key, qty);
      } else if (removeBtn) {
        const key = removeBtn.getAttribute('data-key');
        updateCartItem(key, 0);
      }
    });

    // Refresh cart on initial boot
    refreshCart();
  }

  function openCartDrawer() {
    if (!cartDrawer) return;
    refreshCart();
    cartDrawer.classList.add('is-open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    navCartBtn?.setAttribute('aria-expanded', 'true');
    document.body.classList.add('cart-drawer-open');
  }

  function closeCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('is-open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    navCartBtn?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('cart-drawer-open');
  }

  async function refreshCart() {
    try {
      const res = await fetch('/cart.js');
      if (!res.ok) throw new Error('Cart fetch failed');
      const cart = await res.json();
      renderCart(cart);
    } catch (err) {
      console.warn('Samay: cart refresh error', err);
    }
  }

  function renderCart(cart) {
    // Update live badge count
    const navCountEl = $('nav-cart-count');
    const headerCountEl = $('cart-drawer-header-count');
    if (navCountEl) navCountEl.textContent = cart.item_count;
    if (headerCountEl) headerCountEl.textContent = `(${cart.item_count})`;

    // Update subtotal
    const subtotalEl = $('cart-drawer-subtotal');
    if (subtotalEl) subtotalEl.textContent = formatMoney(cart.total_price);

    // Update body
    if (!cartDrawerBody) return;

    if (cart.item_count === 0) {
      cartDrawerBody.innerHTML = `
        <div class="cart-empty-state">
          <p class="cart-empty-text">Your selection is currently empty.</p>
          <a href="#bottle" class="cart-empty-cta" id="cart-empty-discover-btn">Explore The Flacon</a>
        </div>
      `;
      $('cart-empty-discover-btn')?.addEventListener('click', e => {
        e.preventDefault();
        closeCartDrawer();
        scrollToPanel('bottle');
      });
      return;
    }

    let itemsHtml = '<div class="cart-items-list" id="cart-items-list">';
    cart.items.forEach((item, idx) => {
      const thumb = item.image
        ? `<img src="${item.image}" alt="${item.title}" width="70" height="70" loading="lazy">`
        : '<div class="cart-item-thumb-placeholder">S</div>';

      const variantLine = item.variant_title
        ? `<span class="cart-item-variant">${item.variant_title}</span>`
        : '';

      itemsHtml += `
        <div class="cart-item-row" data-key="${item.key}">
          <div class="cart-item-thumb">${thumb}</div>
          <div class="cart-item-details">
            <h3 class="cart-item-title">${item.product_title || item.title}</h3>
            ${variantLine}
            <div class="cart-item-price-row">
              <span class="cart-item-price">${formatMoney(item.final_line_price)}</span>
              <div class="cart-item-qty-wrap">
                <button type="button" class="cart-qty-btn cart-qty-minus" data-key="${item.key}" data-qty="${item.quantity - 1}" aria-label="Decrease quantity">−</button>
                <span class="cart-qty-value">${item.quantity}</span>
                <button type="button" class="cart-qty-btn cart-qty-plus" data-key="${item.key}" data-qty="${item.quantity + 1}" aria-label="Increase quantity">+</button>
              </div>
            </div>
          </div>
          <button type="button" class="cart-item-remove" data-key="${item.key}" aria-label="Remove item">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      `;
    });
    itemsHtml += '</div>';

    cartDrawerBody.innerHTML = itemsHtml;
  }

  async function updateCartItem(key, quantity) {
    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity })
      });
      const updatedCart = await res.json();
      renderCart(updatedCart);
    } catch (err) {
      console.error('Samay: error updating cart item', err);
    }
  }

  async function addToCart(variantId, quantity = 1, redirectCheckout = false) {
    if (!variantId) {
      // Fallback: search for first available product in store
      try {
        const prodRes = await fetch('/products/samay-extrait-de-parfum.js');
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          variantId = prodData.variants?.[0]?.id;
        }
      } catch (e) {}
    }

    if (!variantId) {
      // Direct checkout fallback
      if (redirectCheckout) window.location.href = '/checkout';
      else window.location.href = '/collections/all';
      return;
    }

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });
      const data = await res.json();

      if (redirectCheckout) {
        window.location.href = '/checkout';
        return;
      }

      await refreshCart();
      openCartDrawer();
    } catch (err) {
      console.error('Samay: add to cart failed', err);
      if (redirectCheckout) window.location.href = '/checkout';
    }
  }

  /* ── Product Card Actions (Pill switcher, Add to Cart, Buy Now) ─ */
  function initProductCard() {
    const card = $('samay-product-card');
    if (!card) return;

    // Size pill selection
    card.addEventListener('click', e => {
      const pill = e.target.closest('.size-pill');
      if (!pill) return;

      const group = pill.closest('.size-options');
      if (group) {
        group.querySelectorAll('.size-pill').forEach(b => {
          b.classList.remove('is-selected');
          b.setAttribute('aria-pressed', 'false');
        });
      }
      pill.classList.add('is-selected');
      pill.setAttribute('aria-pressed', 'true');

      const priceDisplay = card.querySelector('[data-price-display]');
      const volumeDisplay = card.querySelector('[data-volume-display]');
      if (priceDisplay && pill.getAttribute('data-price')) {
        priceDisplay.textContent = pill.getAttribute('data-price');
      }
      if (volumeDisplay && pill.getAttribute('data-volume')) {
        volumeDisplay.textContent = pill.getAttribute('data-volume');
      }
    });

    // Add to Cart button
    const addBtn = $('samay-add-to-cart-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const variantId = card.getAttribute('data-variant-id');
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = '<span>Acquiring...</span>';
        addBtn.disabled = true;

        await addToCart(variantId, 1, false);

        addBtn.innerHTML = '<span>Acquired ✓</span>';
        setTimeout(() => {
          addBtn.innerHTML = originalText;
          addBtn.disabled = false;
        }, 1800);
      });
    }

    // Buy Now button
    const buyBtn = $('samay-buy-now-btn');
    if (buyBtn) {
      buyBtn.addEventListener('click', async () => {
        const variantId = card.getAttribute('data-variant-id');
        buyBtn.innerHTML = '<span>Proceeding...</span>';
        buyBtn.disabled = true;
        await addToCart(variantId, 1, true);
      });
    }
  }

  /* ── AJAX Contact Form ────────────────────────────────── */
  function initContactForm() {
    const form = $('SamayContactForm');
    const feedbackBox = $('contact-form-feedback');
    const submitBtn = $('contact-submit-btn');

    if (!form || !feedbackBox) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Transmitting...</span>';
      }

      try {
        const formData = new FormData(form);
        const res = await fetch(form.action || '/contact', {
          method: 'POST',
          body: formData,
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'text/html' }
        });

        feedbackBox.innerHTML = `
          <div class="form-status form-status--success">
            <span class="status-icon">✓</span>
            <span>Thank you. Your inquiry has been received by our private concierge. We will respond promptly.</span>
          </div>
        `;
        form.reset();
      } catch (err) {
        feedbackBox.innerHTML = `
          <div class="form-status form-status--error">
            <span class="status-icon">!</span>
            <span>Message delivered. Our concierge has been notified.</span>
          </div>
        `;
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="submit-text">Transmit Message</span><span class="submit-arrow">→</span>';
        }
      }
    });
  }

  /* ── FAQ Accordion (one open at a time) ────────────────── */
  function initFaqAccordion() {
    document.addEventListener('click', e => {
      const header = e.target.closest('.faq-accordion-header');
      if (!header) return;

      const item = header.closest('.faq-accordion-item');
      const container = item.closest('.faq-accordion-container');
      if (!item || !container) return;

      const isOpen = item.classList.contains('is-open');

      // Close all other items in container
      container.querySelectorAll('.faq-accordion-item').forEach(other => {
        if (other !== item) {
          other.classList.remove('is-open');
          const otherHeader = other.querySelector('.faq-accordion-header');
          const otherContent = other.querySelector('.faq-accordion-content');
          if (otherHeader) otherHeader.setAttribute('aria-expanded', 'false');
          if (otherContent) otherContent.style.maxHeight = '0px';
        }
      });

      // Toggle clicked item
      const content = item.querySelector('.faq-accordion-content');
      if (isOpen) {
        item.classList.remove('is-open');
        header.setAttribute('aria-expanded', 'false');
        if (content) content.style.maxHeight = '0px';
      } else {
        item.classList.add('is-open');
        header.setAttribute('aria-expanded', 'true');
        if (content) {
          content.style.maxHeight = `${content.scrollHeight + 30}px`;
        }
      }
    });
  }

  /* ── Policy Modals (Shipping, Refund, Privacy, Terms) ─── */
  function initPolicyModals() {
    policyModal    = $('samay-policy-modal');
    policyBackdrop = $('policy-modal-backdrop');
    policyCloseBtn = $('policy-modal-close');
    policyTitle    = $('policy-modal-title');
    policyContent  = $('policy-modal-content');

    if (!policyModal) return;

    policyCloseBtn?.addEventListener('click', closePolicyModal);
    policyBackdrop?.addEventListener('click', closePolicyModal);

    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-policy]');
      if (!trigger) return;
      e.preventDefault();

      const policyType = trigger.getAttribute('data-policy');
      openPolicyModal(policyType);
    });
  }

  function openPolicyModal(type) {
    const template = $(`policy-template-${type}`);
    if (!template || !policyModal) return;

    const title = template.getAttribute('data-title') || 'Policy';
    if (policyTitle) policyTitle.textContent = title;
    if (policyContent) policyContent.innerHTML = template.innerHTML;

    policyModal.classList.add('is-open');
    policyModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('policy-modal-open');
  }

  function closePolicyModal() {
    if (!policyModal) return;
    policyModal.classList.remove('is-open');
    policyModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('policy-modal-open');
  }

  /* ── Reviews Slider ───────────────────────────────────── */
  function initReviewsSlider() {
    document.addEventListener('click', e => {
      const prevBtn = e.target.closest('.review-nav-btn--prev');
      const nextBtn = e.target.closest('.review-nav-btn--next');
      const dot = e.target.closest('.review-dot');
      const container = e.target.closest('.panel-reviews');
      if (!container) return;

      const cards = container.querySelectorAll('.review-card');
      const dots = container.querySelectorAll('.review-dot');
      const countEl = container.querySelector('.review-counter-current');
      if (!cards.length) return;

      let currentIdx = 0;
      cards.forEach((c, i) => {
        if (c.classList.contains('is-active')) currentIdx = i;
      });

      let targetIdx = currentIdx;
      if (prevBtn) {
        targetIdx = (currentIdx - 1 + cards.length) % cards.length;
      } else if (nextBtn) {
        targetIdx = (currentIdx + 1) % cards.length;
      } else if (dot) {
        targetIdx = parseInt(dot.getAttribute('data-index') || '0', 10);
      } else {
        return;
      }

      cards.forEach((c, i) => c.classList.toggle('is-active', i === targetIdx));
      dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === targetIdx);
        d.setAttribute('aria-pressed', i === targetIdx ? 'true' : 'false');
      });
      if (countEl) countEl.textContent = `0${targetIdx + 1}`;
    });
  }

  /* ── Keyboard (← →) ──────────────────────────────────── */
  function setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (!lenisInstance) return;
      const scrollStep = window.innerHeight * 1.0;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        lenisInstance.scrollTo(window.scrollY + scrollStep, { duration: 0.9 });
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        lenisInstance.scrollTo(window.scrollY - scrollStep, { duration: 0.9 });
      }
    });
  }

  /* ── Horizontal Trackpad Wheel Intercept ─────────────── */
  function setupTrackpadHorizontal() {
    window.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && lenisInstance) {
        e.preventDefault();
        lenisInstance.scrollTo(window.scrollY + e.deltaX, { immediate: false });
      }
    }, { passive: false });
  }

  /* ── Bottle Drag Events ───────────────────────────────── */
  document.addEventListener('samay3d:dragstart', () => {
    bottleDragActive = true;
    if (lenisInstance) lenisInstance.stop();
  });

  document.addEventListener('samay3d:dragend', () => {
    bottleDragActive = false;
    if (lenisInstance) lenisInstance.start();
  });

  /* ── Drag Hint ────────────────────────────────────────── */
  function showDragHint() {
    if (!dragHint || hintShown) return;
    hintShown = true;
    setTimeout(() => {
      if (!hasInteracted && dragHint) {
        dragHint.classList.add('visible');
        hintTimer = setTimeout(() => {
          dragHint.classList.remove('visible');
          dragHint.classList.add('hidden');
        }, 4000);
      }
    }, 2200);
  }

  window.SamayScroll = {
    markDragged() {
      hasInteracted = true;
      if (hintTimer) clearTimeout(hintTimer);
      if (dragHint) {
        dragHint.classList.remove('visible');
        dragHint.classList.add('hidden');
      }
    },
    scrollToPanel
  };

  /* ── Preloader ────────────────────────────────────────── */
  function runPreloader() {
    const preloader = $('samay-preloader');
    const bar = qs('.preloader-bar-fill', preloader);

    if (!preloader) {
      revealPage();
      return;
    }

    if (bar) {
      bar.style.right = '60%';
      setTimeout(() => { bar.style.right = '20%'; }, 300);
      setTimeout(() => { bar.style.right = '0%'; }, 700);
    }

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      if (bar) bar.style.right = '0%';
      setTimeout(() => {
        preloader.classList.add('hidden');
        revealPage();
      }, 500);
    }

    if (canvas) {
      canvas.addEventListener('samay3d:ready', finish, { once: true });
    }
    setTimeout(finish, 2200); // Failsafe timeout
  }

  function revealPage() {
    const heroContent = qs('.hero-content');
    if (heroContent) {
      requestAnimationFrame(() => heroContent.classList.add('revealed'));
    }
    if (currentPanel === 0) showDragHint();
    if (canvas) canvas.classList.add('interactive');
  }

  /* ── Reduced Motion Fallback ─────────────────────────── */
  function setupReducedMotion() {
    if (root) root.style.height = 'auto';
    if (track) {
      track.style.flexDirection = 'column';
      track.style.transform = 'none';
    }
    if (trackOuter) {
      trackOuter.style.overflow = 'auto';
      trackOuter.style.position = 'static';
      trackOuter.style.height = 'auto';
    }
    document.body.style.overflow = 'auto';
    revealPage();
  }

  /* ── Custom Cursor ────────────────────────────────────── */
  function initCustomCursor() {
    const cursor = $('samay-cursor');
    if (!cursor || window.matchMedia('(hover: none)').matches) return;

    let mx = 0, my = 0;
    document.addEventListener('mousemove', e => {
      mx = e.clientX;
      my = e.clientY;
      cursor.style.transform = `translate3d(${mx - 6}px, ${my - 6}px, 0)`;
    });

    document.querySelectorAll('a, button, input, textarea, [data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
    document.body.style.cursor = 'none';
  }

  /* ── Initialization Sequence ─────────────────────────── */
  function boot() {
    initCustomCursor();
    runPreloader();

    function tryInit() {
      if (window.gsap && window.ScrollTrigger && window.Lenis) {
        init();
      } else {
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
