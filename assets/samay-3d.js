/**
 * samay-3d.js — Three.js Scene for Samay Parfumes
 * Procedural bottle + studio lighting + particles
 * Loaded lazily after first paint.
 *
 * Public API (attached to window.SamayScene):
 *   .init(canvas)        — boot Three.js
 *   .setScrollProgress(n)— 0‥1 → rotate bottle + reposition
 *   .setPanelIndex(n)    — switch bottle transform for panel
 *   .dispose()           — cleanup
 */

(function () {
  'use strict';

  /* ── CDN URLs (three r165) ────────────────────────────── */
  const THREE_URL   = 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
  const ADDONS_URL  = 'https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/';

  /* ── Colours ─────────────────────────────────────────── */
  const GOLD    = 0xC9A24B;
  const GOLD_LT = 0xE2C27A;
  const BLACK   = 0x080808;

  /* ── State ───────────────────────────────────────────── */
  let THREE, renderer, scene, camera, bottle, particleSystem;
  let labelTexture, envTexture;
  let scrollRotation  = 0;   // rad, from scroll progress
  let dragRotation    = 0;   // rad, from user drag
  let dragVelocity    = 0;
  let isDragging      = false;
  let dragStartX      = 0;
  let dragStartRot    = 0;
  let lastDragX       = 0;
  let rafId           = null;
  let isVisible       = true;
  let targetY         = 0;   // bottle world-Y target
  let targetScale     = 1;
  let currentY        = 0;
  let currentScale    = 1;
  let isMobile        = false;
  let useTransmission = true;
  let canvas_el       = null;
  let clock;
  let panelIndex      = 0;

  /* ── Mobile check ────────────────────────────────────── */
  function checkMobile() {
    isMobile = window.matchMedia('(max-width: 768px)').matches;
    useTransmission = !isMobile && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ── Import Three.js from CDN ────────────────────────── */
  async function loadThree() {
    const mod = await import(THREE_URL);
    THREE = mod;

    // Destructure helpers we need
    const {
      WebGLRenderer, Scene, PerspectiveCamera,
      AmbientLight, DirectionalLight, PointLight, SpotLight,
      Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
      CylinderGeometry, PlaneGeometry, BoxGeometry, SphereGeometry,
      TextureLoader, PMREMGenerator, Color, Vector3,
      AdditiveBlending, BufferGeometry, BufferAttribute, Points, PointsMaterial,
      PCFSoftShadowMap, sRGBEncoding, ACESFilmicToneMapping
    } = THREE;

    return THREE;
  }

  /* ── RoomEnvironment (inline, no import needed) ──────── */
  async function loadRoomEnv(renderer) {
    const { RoomEnvironment } = await import(ADDONS_URL + 'environments/RoomEnvironment.js');
    const pmremGen = new THREE.PMREMGenerator(renderer);
    const env = pmremGen.fromScene(new RoomEnvironment(), 0.04);
    pmremGen.dispose();
    return env.texture;
  }

  /* ── Bottle geometry helpers ─────────────────────────── */

  /** Simple rounded box approximated with a scaled SphereGeometry merge:
   *  For now use BoxGeometry + MeshPhysicalMaterial clearcoat.          */
  function makeBody(THREE) {
    const geo  = new THREE.CylinderGeometry(0.28, 0.22, 1.35, 64, 1, false);
    const mat  = new THREE.MeshPhysicalMaterial({
      color:           0x0a0a0a,
      metalness:       0.1,
      roughness:       0.08,
      clearcoat:       1.0,
      clearcoatRoughness: 0.05,
      reflectivity:    0.9,
      envMapIntensity: 2.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  function makeNeck(THREE) {
    const geo = new THREE.CylinderGeometry(0.11, 0.14, 0.38, 32);
    const mat = new THREE.MeshPhysicalMaterial({
      color:      0x080808,
      metalness:  0.05,
      roughness:  0.05,
      clearcoat:  1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.87;
    mesh.castShadow = true;
    return mesh;
  }

  function makeCap(THREE) {
    if (!useTransmission) {
      // Mobile: opaque glossy cap
      const geo = new THREE.CylinderGeometry(0.12, 0.11, 0.22, 12);
      const mat = new THREE.MeshPhysicalMaterial({
        color: GOLD,
        metalness: 0.9,
        roughness: 0.1,
        envMapIntensity: 2.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.18;
      return mesh;
    }

    // Desktop: transmission glass cap
    const geo = new THREE.CylinderGeometry(0.12, 0.11, 0.22, 12);
    const mat = new THREE.MeshPhysicalMaterial({
      color:           0xE8F4FF,
      transmission:    0.92,
      thickness:       0.3,
      ior:             1.5,
      roughness:       0.04,
      metalness:       0.0,
      clearcoat:       1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 1.18;
    return mesh;
  }

  function makeLabel(THREE, texture) {
    const geo  = new THREE.PlaneGeometry(0.45, 0.72);
    const mat  = new THREE.MeshStandardMaterial({
      map:             texture,
      transparent:     true,
      roughness:       0.6,
      metalness:       0.0,
      depthWrite:      false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -0.05, 0.285);
    return mesh;
  }

  function makeGoldFrame(THREE) {
    // Thin rectangular border around label
    const mat = new THREE.MeshStandardMaterial({
      color:     GOLD,
      metalness: 0.85,
      roughness: 0.2,
      envMapIntensity: 1.5,
    });

    const group = new THREE.Group();
    const thick = 0.008;
    const w = 0.47, h = 0.74;

    // Four border strips
    [[w, thick, 0, -h/2], [w, thick, 0, h/2],
     [thick, h, -w/2, 0], [thick, h, w/2, 0]].forEach(([bw, bh, bx, by]) => {
      const g = new THREE.BoxGeometry(bw, bh, thick);
      const m = new THREE.Mesh(g, mat);
      m.position.set(bx, by, 0.288);
      group.add(m);
    });

    return group;
  }

  function makeBackPattern(THREE) {
    // Simple gold-on-black pattern on back face
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, 256, 512);

    ctx.strokeStyle = '#C9A24B';
    ctx.lineWidth   = 1.5;

    // decorative lines
    for (let i = 0; i < 8; i++) {
      const y = 64 + i * 56;
      ctx.beginPath();
      ctx.moveTo(40, y); ctx.lineTo(216, y);
      ctx.stroke();
    }

    // S logo
    ctx.font = 'bold 96px serif';
    ctx.fillStyle = '#C9A24B';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.4;
    ctx.fillText('S', 128, 280);
    ctx.globalAlpha = 1;

    // border
    ctx.strokeRect(20, 20, 216, 472);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.45, 0.72);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -0.05, -0.286);
    mesh.rotation.y = Math.PI;
    return mesh;
  }

  function makeFloorShadow(THREE) {
    const geo = new THREE.CircleGeometry(0.55, 64);
    const mat = new THREE.MeshStandardMaterial({
      color:      0x000000,
      transparent: true,
      opacity:    0.35,
      roughness:  1.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.9;
    mesh.receiveShadow = false;
    return mesh;
  }

  /** Main bottle group */
  function createBottle(THREE, labelTex, envMap) {
    const group = new THREE.Group();

    const body  = makeBody(THREE);
    const neck  = makeNeck(THREE);
    const cap   = makeCap(THREE);
    const frame = makeGoldFrame(THREE);
    const back  = makeBackPattern(THREE);
    const shadow = makeFloorShadow(THREE);

    group.add(body, neck, cap, frame, back, shadow);

    // Apply env map to physical materials
    [body, neck, cap].forEach(m => {
      if (m.material) m.material.envMap = envMap;
    });

    if (labelTex) {
      const label = makeLabel(THREE, labelTex);
      group.add(label);
    }

    return group;
  }

  /* ── Gold Dust Particles ─────────────────────────────── */
  function createParticles(THREE) {
    const count  = isMobile ? 120 : 320;
    const spread = 4.5;
    const pos    = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * spread;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color:       GOLD_LT,
      size:        0.012,
      transparent: true,
      opacity:     0.55,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      sizeAttenuation: true,
    });

    return new THREE.Points(geo, mat);
  }

  /* ── Init scene ──────────────────────────────────────── */
  async function init(canvas) {
    canvas_el = canvas;
    checkMobile();

    await loadThree();

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias:  !isMobile,
      alpha:      true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace  = THREE.SRGBColorSpace;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(BLACK);

    // Camera
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0, 0.05, 3.8);

    clock = new THREE.Clock();

    // Environment
    const envMap = await loadRoomEnv(renderer);
    scene.environment = envMap;
    scene.environmentIntensity = 0.6;

    // Lights
    setupLights();

    // Label texture
    let labelTex = null;
    try {
      const loader = new THREE.TextureLoader();
      labelTex = await new Promise((res, rej) => {
        loader.load(
          window.SamayConfig?.labelUrl || '',
          t => { t.colorSpace = THREE.SRGBColorSpace; res(t); },
          undefined,
          rej
        );
      });
    } catch (_) { /* no label */ }

    // Bottle
    bottle = createBottle(THREE, labelTex, envMap);
    scene.add(bottle);

    // Particles
    particleSystem = createParticles(THREE);
    scene.add(particleSystem);

    // Floor
    const floor = makeFloorShadow(THREE);
    scene.add(floor);

    // Start render loop
    startLoop();

    // Resize
    window.addEventListener('resize', onResize);

    // Visibility
    document.addEventListener('visibilitychange', onVisibility);

    // Canvas drag (rotate bottle)
    setupDrag(canvas);

    // Signal ready
    canvas.dispatchEvent(new CustomEvent('samay3d:ready'));
  }

  function setupLights() {
    // Ambient
    const amb = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(amb);

    // Key light (soft warm)
    const key = new THREE.DirectionalLight(0xfff4e0, 2.4);
    key.position.set(2, 3, 3);
    key.castShadow = !isMobile;
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far  = 20;
      key.shadow.bias = -0.001;
    }
    scene.add(key);

    // Gold rim light (right)
    const rim = new THREE.PointLight(GOLD, 4.5, 8);
    rim.position.set(2.5, 0.5, -1.5);
    scene.add(rim);

    // Fill (left, cool)
    const fill = new THREE.PointLight(0x8898cc, 1.2, 6);
    fill.position.set(-2, 1, 1);
    scene.add(fill);

    // Back rim
    const back = new THREE.PointLight(GOLD, 2.0, 5);
    back.position.set(-1.5, 2, -2);
    scene.add(back);
  }

  /* ── Render loop ─────────────────────────────────────── */
  function startLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    function loop() {
      rafId = requestAnimationFrame(loop);
      if (!isVisible) return;

      const dt = clock.getDelta();

      // Drag inertia
      if (!isDragging) {
        dragVelocity *= 0.93;
        dragRotation += dragVelocity;
        // Ease back toward 0 after scroll takes over
        dragRotation *= 0.98;
      }

      // Apply rotation
      if (bottle) {
        const totalRot = scrollRotation + dragRotation;
        bottle.rotation.y = totalRot;

        // Subtle float
        bottle.position.y = currentY + Math.sin(clock.elapsedTime * 0.6) * 0.018;

        // Scale ease
        currentScale += (targetScale - currentScale) * 0.06;
        bottle.scale.setScalar(currentScale);
      }

      // Particles drift
      if (particleSystem) {
        particleSystem.rotation.y += 0.0005;
        particleSystem.rotation.x += 0.0002;
      }

      renderer.render(scene, camera);
    }
    loop();
  }

  /* ── Resize ──────────────────────────────────────────── */
  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    checkMobile();
  }

  /* ── Visibility ──────────────────────────────────────── */
  function onVisibility() {
    isVisible = !document.hidden;
    if (isVisible && !rafId) startLoop();
  }

  /* ── Drag / swipe on bottle ─────────────────────────── */
  function setupDrag(canvas) {
    let pointerDown = false;
    let suppressScroll = false;

    function onDown(e) {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      isDragging   = true;
      pointerDown  = true;
      dragStartX   = x;
      dragStartRot = dragRotation;
      lastDragX    = x;
      dragVelocity = 0;
      suppressScroll = false;

      // Notify scroll system that we started on canvas
      document.dispatchEvent(new CustomEvent('samay3d:dragstart'));

      // Hide hint
      const hint = document.getElementById('drag-hint');
      if (hint) { hint.classList.remove('visible'); hint.classList.add('hidden'); }
      if (window.SamayScroll?.markDragged) window.SamayScroll.markDragged();
    }

    function onMove(e) {
      if (!isDragging) return;
      const x     = e.touches ? e.touches[0].clientX : e.clientX;
      const delta = x - dragStartX;

      // Suppress page scroll if drag is horizontal
      if (e.touches && Math.abs(delta) > 8) {
        suppressScroll = true;
      }

      if (e.cancelable && suppressScroll) e.preventDefault();

      const vel   = x - lastDragX;
      lastDragX   = x;
      dragVelocity = vel * 0.015;
      dragRotation = dragStartRot + delta * 0.012;
    }

    function onUp() {
      if (!isDragging) return;
      isDragging  = false;
      pointerDown = false;
      document.dispatchEvent(new CustomEvent('samay3d:dragend'));
    }

    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('touchstart', onDown,  { passive: true });
    window.addEventListener('mousemove',  onMove);
    canvas.addEventListener('touchmove',  onMove,  { passive: false });
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('touchend',   onUp);
  }

  /* ── Panel / scroll API ─────────────────────────────── */
  /**
   * progress: 0‥1 across the full track
   * Maps to 0‥2π rotation.
   */
  function setScrollProgress(progress) {
    scrollRotation = progress * Math.PI * 2;
    updateBottleForProgress(progress);
  }

  function updateBottleForProgress(p) {
    if (!bottle) return;
    const isMob = isMobile;

    // Panel breakpoints (6 panels, equal width)
    // p 0–0.166 = hero, 0.166–0.333 = story, etc.
    const panel = Math.floor(p * 6);

    // Bottle position & scale for each panel
    const configs = [
      // panel 0 (Hero):  centred, full size
      { x: isMob ? 0 : -1.0, y: isMob ? 0.6 : 0.0, scale: isMob ? 0.7 : 1.0 },
      // panel 1 (Story): slightly left
      { x: isMob ? 0 : 0.85, y: 0.0, scale: isMob ? 0.65 : 0.85 },
      // panel 2 (Notes): right
      { x: isMob ? 0 : -0.85, y: 0.0, scale: isMob ? 0.65 : 0.85 },
      // panel 3 (Product): centred, larger
      { x: 0, y: 0.0, scale: isMob ? 0.75 : 1.1 },
      // panel 4 (Reviews): left small
      { x: isMob ? 0 : 0.7, y: 0.0, scale: isMob ? 0.6 : 0.75 },
      // panel 5 (Footer): centred, faded small
      { x: 0, y: 0.0, scale: isMob ? 0.55 : 0.65 },
    ];

    const cfg   = configs[Math.min(panel, 5)];
    const next  = configs[Math.min(panel + 1, 5)];
    const frac  = (p * 6) - panel; // 0‥1 within panel

    // Interpolate
    const cx = cfg.x    + (next.x    - cfg.x)    * frac;
    const cy = cfg.y    + (next.y    - cfg.y)    * frac;
    const cs = cfg.scale + (next.scale - cfg.scale) * frac;

    // Ease camera-relative X by shifting bottle
    if (bottle) {
      bottle.position.x  += (cx - bottle.position.x) * 0.05;
      currentY = cy;
      targetScale = cs;
    }
  }

  function setPanelIndex(idx) {
    panelIndex = idx;
  }

  function dispose() {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    renderer?.dispose();
  }

  /* ── Public API ──────────────────────────────────────── */
  window.SamayScene = {
    init,
    setScrollProgress,
    setPanelIndex,
    dispose,
    get isDragging() { return isDragging; },
  };
})();
