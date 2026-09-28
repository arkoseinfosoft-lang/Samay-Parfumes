/**
 * samay-scroll.js — Horizontal scroll engine for Samay Parfumes
 *
 * Responsibilities:
 *  - Lenis smooth-scroll instance (vertical wheel/touch → translateX)
 *  - GSAP ScrollTrigger pin + scrub for horizontal track
 *  - Progress bar + panel counter
 *  - Keyboard (←→) and drag-on-track support
 *  - Passes scroll progress to SamayScene
 *  - Preloader management + first-reveal animation
 *
 * Expects on window:
 *   window.SamayScene  (samay-3d.js)
 *   window.SamayConfig.numPanels
 *   GSAP + ScrollTrigger + Lenis available globally
 */

(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const prefersReduced = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── State ────────────────────────────────────────────── */
  let gsap, ScrollTrigger, Lenis;
  let lenisInstance = null;
  let scrollTriggerInstance = null;
  let numPanels = 6;
  let currentPanel = 0;
  let bottleDragActive = false;
  let hintShown = false;
  let hintTimer = null;
  let hasInteracted = false;

  /* ── DOM refs ─────────────────────────────────────────── */
  let root, trackOuter, track, progressFill, counter, dragHint, canvas;

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

    numPanels = window.SamayConfig?.numPanels || 6;

    // Set scroll height for pinned track
    root.style.height = `${numPanels * 100}dvh`;

    gsap         = window.gsap;
    ScrollTrigger = window.ScrollTrigger;
    Lenis        = window.Lenis;

    if (!gsap || !ScrollTrigger || !Lenis) {
      console.warn('Samay: GSAP/Lenis not loaded yet, retrying in 200ms');
      setTimeout(init, 200);
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Reduced-motion: skip animation, just show content
    if (prefersReduced()) {
      setupReducedMotion();
      return;
    }

    setupLenis();
    setupScrollTrigger();
    setupKeyboard();
    setupDragOnTrack();
    updateCounter(0, numPanels);
  }

  /* ── Lenis ────────────────────────────────────────────── */
  function setupLenis() {
    lenisInstance = new Lenis({
      wrapper:    trackOuter,
      content:    root,
      orientation: 'vertical',    // wheel is vertical
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
      infinite:   false,
      autoRaf:    false,          // we drive via GSAP ticker
    });

    // Wire Lenis into GSAP ticker
    gsap.ticker.add(time => {
      if (lenisInstance && !bottleDragActive) lenisInstance.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Keep ScrollTrigger in sync with Lenis scroll
    lenisInstance.on('scroll', ({ scroll, limit }) => {
      ScrollTrigger.update();
    });
  }

  /* ── GSAP ScrollTrigger: pin + scrub horizontal ──────── */
  function setupScrollTrigger() {
    const totalTrackMove = (numPanels - 1) * window.innerWidth;

    scrollTriggerInstance = ScrollTrigger.create({
      trigger:   root,
      start:     'top top',
      end:       `+=${numPanels * 100}vh`,
      pin:       trackOuter,
      scrub:     1.2,
      invalidateOnRefresh: true,
      onUpdate: self => {
        const p = self.progress;
        applyProgress(p);
      },
      onRefresh: self => {
        applyProgress(self.progress);
      },
    });

    // Manually drive translateX via separate tween scrubbed to ST
    gsap.to(track, {
      x: () => -(numPanels - 1) * window.innerWidth,
      ease: 'none',
      scrollTrigger: {
        trigger:  root,
        start:    'top top',
        end:      () => `+=${(numPanels - 1) * window.innerHeight * 100}vh`,
        scrub:    1.0,
        invalidateOnRefresh: true,
      },
    });

    ScrollTrigger.addEventListener('refresh', () => {
      gsap.set(track, { clearProps: 'x' });
    });
  }

  function applyProgress(p) {
    // Progress bar
    if (progressFill) progressFill.style.width = `${p * 100}%`;

    // Panel index
    const panel = Math.min(Math.floor(p * numPanels), numPanels - 1);
    if (panel !== currentPanel) {
      currentPanel = panel;
      updateCounter(panel, numPanels);
      if (window.SamayScene?.setPanelIndex) window.SamayScene.setPanelIndex(panel);

      // Canvas interactive only in first panel (drag bottle)
      if (canvas) {
        canvas.classList.toggle('interactive', panel === 0);
      }

      // Show drag hint in panel 0
      if (panel === 0 && !hasInteracted && dragHint) {
        showDragHint();
      }

      // ── Panel-specific reveal hooks ──────────────────────
      revealPanel(panel);
    }

    // 3D scene
    if (window.SamayScene?.setScrollProgress) {
      window.SamayScene.setScrollProgress(p);
    }
  }

  /**
   * Toggle reveal classes as the user enters/leaves each panel.
   * CSS transitions do the actual animation work.
   */
  function revealPanel(panelIndex) {
    // Story panel (index 1)
    const storyEl = document.querySelector('.panel-story');
    if (storyEl) {
      if (panelIndex >= 1) {
        storyEl.classList.add('story-revealed');
      } else {
        // Reset so re-entering from left replays the animation
        storyEl.classList.remove('story-revealed');
      }
    }
  }

  /* ── Counter ─────────────────────────────────────────── */
  function updateCounter(panel, total) {
    if (!counter) return;
    const cur = String(panel + 1).padStart(2, '0');
    const tot = String(total).padStart(2, '0');
    counter.innerHTML = `<span class="current">${cur}</span> / ${tot}`;
  }

  /* ── Keyboard ────────────────────────────────────────── */
  function setupKeyboard() {
    document.addEventListener('keydown', e => {
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

  /* ── Drag/swipe on the track itself ─────────────────────
     (separate from bottle drag — this is the track background) */
  function setupDragOnTrack() {
    let startY = 0;
    let startScroll = 0;

    trackOuter.addEventListener('touchstart', e => {
      if (bottleDragActive) return;
      startY      = e.touches[0].clientY;
      startScroll = window.scrollY;
    }, { passive: true });

    trackOuter.addEventListener('touchmove', e => {
      if (bottleDragActive) return;
      const dy = startY - e.touches[0].clientY;
      if (lenisInstance) {
        lenisInstance.scrollTo(startScroll + dy, { immediate: true });
      }
    }, { passive: true });
  }

  /* ── Bottle drag events ───────────────────────────────── */
  document.addEventListener('samay3d:dragstart', () => {
    bottleDragActive = true;
    if (lenisInstance) lenisInstance.stop();
  });

  document.addEventListener('samay3d:dragend', () => {
    bottleDragActive = false;
    if (lenisInstance) lenisInstance.start();
  });

  /* ── Drag hint ───────────────────────────────────────── */
  function showDragHint() {
    if (!dragHint || hintShown) return;
    hintShown = true;
    // Show after a delay
    setTimeout(() => {
      if (!hasInteracted && dragHint) {
        dragHint.classList.add('visible');
        // Auto-hide after 4 s
        hintTimer = setTimeout(() => {
          dragHint.classList.remove('visible');
          dragHint.classList.add('hidden');
        }, 4000);
      }
    }, 2500);
  }

  /* ── "markDragged" — hide hint on first interaction ──── */
  window.SamayScroll = {
    markDragged() {
      hasInteracted = true;
      if (hintTimer) clearTimeout(hintTimer);
      if (dragHint) {
        dragHint.classList.remove('visible');
        dragHint.classList.add('hidden');
      }
    },
  };

  /* ── Preloader ────────────────────────────────────────── */
  function runPreloader() {
    const preloader = $('samay-preloader');
    const bar       = qs('.preloader-bar-fill', preloader);

    if (!preloader) { revealPage(); return; }

    // Animate bar to 100%
    if (bar) {
      bar.style.right = '60%';
      setTimeout(() => { bar.style.right = '20%'; }, 300);
      setTimeout(() => { bar.style.right = '0%'; }, 700);
    }

    // Wait for 3D scene to be ready (or 2s max)
    const canvas = $('samay-canvas');
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      // bar complete
      if (bar) bar.style.right = '0%';
      setTimeout(() => {
        preloader.classList.add('hidden');
        revealPage();
      }, 500);
    }

    if (canvas) {
      canvas.addEventListener('samay3d:ready', finish, { once: true });
    }
    setTimeout(finish, 2200); // failsafe
  }

  function revealPage() {
    // Reveal hero text
    const heroContent = qs('.hero-content');
    if (heroContent) {
      requestAnimationFrame(() => heroContent.classList.add('revealed'));
    }

    // Show drag hint on panel 0
    if (currentPanel === 0) showDragHint();

    // Make canvas interactive
    if (canvas) canvas.classList.add('interactive');
  }

  /* ── Reduced motion fallback ─────────────────────────── */
  function setupReducedMotion() {
    // Simple vertical page scroll, no horizontal
    root.style.height = 'auto';
    if (track) {
      track.style.flexDirection = 'column';
      track.style.transform     = 'none';
    }
    if (trackOuter) {
      trackOuter.style.overflow = 'auto';
      trackOuter.style.position = 'static';
      trackOuter.style.height   = 'auto';
    }
    document.body.style.overflow = 'auto';
    // Immediately reveal
    revealPage();
  }

  /* ── Horizontal trackpad support ─────────────────────── */
  function setupTrackpadHorizontal() {
    // Intercept horizontal wheel events → scroll vertically
    window.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && lenisInstance) {
        e.preventDefault();
        lenisInstance.scrollTo(window.scrollY + e.deltaX, { immediate: false });
      }
    }, { passive: false });
  }

  /* ── Wait for DOM + scripts ──────────────────────────── */
  function waitAndInit() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  function boot() {
    runPreloader();

    // Lazy-load Three.js scene
    requestAnimationFrame(() => {
      setTimeout(() => {
        const c = $('samay-canvas');
        if (c && window.SamayScene) {
          window.SamayScene.init(c).catch(console.error);
        }
      }, 50);
    });

    // Init scroll (after scripts loaded)
    function tryInit() {
      if (window.gsap && window.ScrollTrigger && window.Lenis) {
        init();
        setupTrackpadHorizontal();
      } else {
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
  }

  waitAndInit();
})();
