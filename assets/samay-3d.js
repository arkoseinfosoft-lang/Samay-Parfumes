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
  const GOLD    = 0xA88232;
  const GOLD_LT = 0xC59E4E;
  const BLACK   = 0x141412;

  /* ── State ───────────────────────────────────────────── */
  let THREE, renderer, scene, camera, bottle, particleSystem;
  let labelTexture, envTexture;
  let ambLight, keyLight, rimLight, fillLight, backLight, floorShadowMesh;
  let scrollRotation  = 0;   // rad, from scroll progress
  let dragRotation    = 0;   // rad, from user drag
  let dragVelocity    = 0;
  let isDragging      = false;
  let dragStartX      = 0;
  let dragStartRot    = 0;
  let lastDragX       = 0;
  let rafId           = null;
  let isVisible       = true;
  let targetX         = 0;
  let currentX        = 0;
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

  /* ── RoomEnvironment ─────────────────────────────────── */
  async function loadRoomEnv(renderer) {
    try {
      const { RoomEnvironment } = await import(ADDONS_URL + 'environments/RoomEnvironment.js');
      const pmremGen = new THREE.PMREMGenerator(renderer);
      const env = pmremGen.fromScene(new RoomEnvironment(), 0.04);
      pmremGen.dispose();
      return env.texture;
    } catch (err) {
      console.warn('Samay: RoomEnvironment fallback', err);
      return null;
    }
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
    // Solid 24-karat gold-gilded magnetic stopper
    const geo = new THREE.CylinderGeometry(0.12, 0.11, 0.22, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: GOLD,
      metalness: 0.92,
      roughness: 0.14,
      envMapIntensity: 2.2,
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
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(35, 30, 24, 0.20)');
    grad.addColorStop(0.3, 'rgba(35, 30, 24, 0.10)');
    grad.addColorStop(0.65, 'rgba(35, 30, 24, 0.025)');
    grad.addColorStop(1, 'rgba(35, 30, 24, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(1.6, 1.6);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.92;
    mesh.receiveShadow = false;
    floorShadowMesh = mesh;
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
      color:       GOLD,
      size:        0.014,
      transparent: true,
      opacity:     0.7,
      blending:    THREE.NormalBlending,
      depthWrite:  false,
      sizeAttenuation: true,
    });

    return new THREE.Points(geo, mat);
  }

  /* ── Init scene ──────────────────────────────────────── */
  let isInitializing = false;
  async function init(canvas) {
    if (renderer || isInitializing) return;
    isInitializing = true;
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
    scene.background = null; // Transparent to reveal pristine white/alabaster theme

    // Camera
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0, 0.05, 3.8);

    clock = new THREE.Clock();

    // Environment
    const envMap = await loadRoomEnv(renderer);
    if (envMap) {
      scene.environment = envMap;
      scene.environmentIntensity = 0.6;
    }

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

    // Floor shadow (attached to bottle so it follows position & scale)
    const floor = makeFloorShadow(THREE);
    bottle.add(floor);

    scene.add(bottle);

    // Particles
    particleSystem = createParticles(THREE);
    scene.add(particleSystem);

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
    // Ambient - balanced daylight for clean white theme
    ambLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambLight);

    // Key light (soft warm white)
    keyLight = new THREE.DirectionalLight(0xfffaf0, 2.5);
    keyLight.position.set(2, 3.5, 3);
    keyLight.castShadow = !isMobile;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far  = 20;
      keyLight.shadow.bias = -0.001;
    }
    scene.add(keyLight);

    // Gold rim light (right)
    rimLight = new THREE.PointLight(GOLD, 3.8, 8);
    rimLight.position.set(2.5, 0.5, -1.5);
    scene.add(rimLight);

    // Fill (left, soft clean daylight)
    fillLight = new THREE.PointLight(0xe8eeff, 1.3, 6);
    fillLight.position.set(-2, 1, 1);
    scene.add(fillLight);

    // Back rim
    backLight = new THREE.PointLight(GOLD_LT, 2.2, 5);
    backLight.position.set(-1.5, 2, -2);
    scene.add(backLight);

    // Check current theme at load time
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(activeTheme);
  }

  function setTheme(mode) {
    if (!THREE || !ambLight) return;
    const isDark = (mode === 'dark');
    if (isDark) {
      ambLight.intensity = 0.35;
      ambLight.color.setHex(0x282632);
      if (keyLight) {
        keyLight.intensity = 3.2;
        keyLight.color.setHex(0xffecc0);
      }
      if (fillLight) fillLight.intensity = 0.6;
      if (rimLight) rimLight.intensity = 4.2;
      if (floorShadowMesh && floorShadowMesh.material) floorShadowMesh.material.opacity = 0.65;
    } else {
      ambLight.intensity = 0.7;
      ambLight.color.setHex(0xffffff);
      if (keyLight) {
        keyLight.intensity = 2.5;
        keyLight.color.setHex(0xfffaf0);
      }
      if (fillLight) fillLight.intensity = 1.3;
      if (rimLight) rimLight.intensity = 3.8;
      if (floorShadowMesh && floorShadowMesh.material) floorShadowMesh.material.opacity = 0.35;
    }
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

        // Position eases
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        bottle.position.x = currentX;
        bottle.position.y = currentY + Math.sin(clock.elapsedTime * 0.6) * 0.018;

        // Scale ease
        currentScale += (targetScale - currentScale) * 0.08;
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
    const total = 8;
    const panel = Math.min(Math.floor(p * total), total - 1);

    // Bottle position & scale for each of the 8 panels
    const configs = [
      // panel 0 (Hero): on the right on desktop, upper-center on mobile
      { x: isMob ? 0 : 0.95, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.65 : 1.05 },
      // panel 1 (Story): on the right side
      { x: isMob ? 0 : 0.85, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.55 : 0.9 },
      // panel 2 (Notes): left side
      { x: isMob ? 0 : -0.85, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.55 : 0.85 },
      // panel 3 (Product): centered in stage
      { x: isMob ? 0 : 0.0, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.65 : 1.15 },
      // panel 4 (Reviews): far right side
      { x: isMob ? 0 : 1.25, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.55 : 0.85 },
      // panel 5 (FAQ): far right side away from accordion
      { x: isMob ? 0 : 1.35, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.45 : 0.8 },
      // panel 6 (Contact): far left side away from form
      { x: isMob ? 0 : -1.35, y: isMob ? 0.35 : 0.0, scale: isMob ? 0.45 : 0.8 },
      // panel 7 (Footer): centered, subtle
      { x: 0, y: isMob ? 0.25 : 0.1, scale: isMob ? 0.45 : 0.65 },
    ];

    const cfg   = configs[panel];
    const next  = configs[Math.min(panel + 1, total - 1)];
    const frac  = (p * total) - panel;

    const cx = cfg.x    + (next.x    - cfg.x)    * frac;
    const cy = cfg.y    + (next.y    - cfg.y)    * frac;
    const cs = cfg.scale + (next.scale - cfg.scale) * frac;

    targetX     = cx;
    targetY     = cy;
    targetScale = cs;
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
    setTheme,
    dispose,
    get isDragging() { return isDragging; },
  };

  // Auto-init once canvas is ready
  function autoInit() {
    const c = document.getElementById('samay-canvas');
    if (c && !renderer) {
      init(c).catch(console.error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
