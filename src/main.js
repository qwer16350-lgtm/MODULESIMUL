import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Rhino3dmLoader } from 'three/addons/loaders/3DMLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';
import './style.css';

// ==========================
// DOM
// ==========================

const app = document.querySelector('#app');
const explodeBtn = document.querySelector('#explodeBtn');
const darkModeBtn = document.querySelector('#darkModeBtn');
const aoToggleBtn = document.querySelector('#aoToggleBtn');
const outlineToggleBtn = document.querySelector('#outlineToggleBtn');
const viewButtons = document.querySelectorAll('.view-btn');
const loadingScreen = document.querySelector('#loadingScreen');
const loadingBarFill = document.querySelector('#loadingBarFill');
const loadingPercent = document.querySelector('#loadingPercent');
const loadingStatus = document.querySelector('#loadingStatus');
const loadingCode = document.querySelector('#loadingCode');
const loadingCodeLineA = document.querySelector('#loadingCodeLineA');
const loadingCodeLineB = document.querySelector('#loadingCodeLineB');
const glowSlider = document.querySelector('#glowSlider');
const glowValue = document.querySelector('#glowValue');
const statusText = document.querySelector('#statusText');
const partName = document.querySelector('#partName');
const selectionActions = document.querySelector('#selectionActions');
const hidePartBtn = document.querySelector('#hidePartBtn');
const showAllBtn = document.querySelector('#showAllBtn');

if (!app) throw new Error('#app element not found');
if (!explodeBtn) throw new Error('#explodeBtn element not found');
if (!darkModeBtn) throw new Error('#darkModeBtn element not found');
if (!aoToggleBtn) throw new Error('#aoToggleBtn element not found');
if (!outlineToggleBtn) throw new Error('#outlineToggleBtn element not found');
if (viewButtons.length === 0) throw new Error('.view-btn elements not found');
if (!loadingScreen) throw new Error('#loadingScreen element not found');
if (!loadingBarFill) throw new Error('#loadingBarFill element not found');
if (!loadingPercent) throw new Error('#loadingPercent element not found');
if (!loadingStatus) throw new Error('#loadingStatus element not found');
if (!loadingCode) throw new Error('#loadingCode element not found');
if (!loadingCodeLineA) throw new Error('#loadingCodeLineA element not found');
if (!loadingCodeLineB) throw new Error('#loadingCodeLineB element not found');
if (!glowSlider) throw new Error('#glowSlider element not found');
if (!glowValue) throw new Error('#glowValue element not found');
if (!statusText) throw new Error('#statusText element not found');
if (!partName) throw new Error('#partName element not found');
if (!selectionActions) throw new Error('#selectionActions element not found');
if (!hidePartBtn) throw new Error('#hidePartBtn element not found');
if (!showAllBtn) throw new Error('#showAllBtn element not found');

// ==========================
// Settings
// ==========================

const RHINO_TO_THREE_ROTATION_X = -Math.PI / 2;

const LIGHT_BG = 0xf4f2ee;
const DARK_BG = 0x050505;

const DEFAULT_EXPLODE_RATIO = 0.35;
const DEFAULT_DIST = null;

const EXPLODE_DELAY_STEP = 0.025;
const ASSEMBLE_DELAY_STEP = 0.018;

const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const materials = {};

const LIGHT_TARGET = {
  LED: 'LED',
  DIFFUSER: 'DIFFUSER',
};

let lightTarget = LIGHT_TARGET.DIFFUSER;
let glowLevel = 0.35;

// ==========================
// Scene
// ==========================

const scene = new THREE.Scene();
scene.background = null;

const groundScene = new THREE.Scene();
groundScene.background = new THREE.Color(LIGHT_BG);

// ==========================
// Camera
// ==========================

const perspectiveCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
const groundPerspectiveCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);
const groundOrthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);

let camera = perspectiveCamera;
let groundCamera = groundPerspectiveCamera;

perspectiveCamera.position.set(300, 250, 400);
perspectiveCamera.layers.enable(BLOOM_LAYER);
orthographicCamera.layers.enable(BLOOM_LAYER);

// ==========================
// Renderer
// ==========================

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

// ==========================
// Post Processing / Selective Bloom
// ==========================

const bloomRenderScene = new RenderPass(scene, camera);
const groundRenderScene = new RenderPass(groundScene, groundCamera);
const renderScene = new RenderPass(scene, camera);
renderScene.clear = false;

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45,
  0.32,
  0.12
);

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(bloomRenderScene);
bloomComposer.addPass(bloomPass);

const finalPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;

      varying vec2 vUv;

      void main() {
        vec4 base = texture2D(baseTexture, vUv);
        vec4 bloom = texture2D(bloomTexture, vUv);
        gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
      }
    `,
    defines: {},
  }),
  'baseTexture'
);

finalPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(groundRenderScene);
finalComposer.addPass(renderScene);
const gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
gtaoPass.blendIntensity = 1.75;
gtaoPass.output = GTAOPass.OUTPUT.Default;
finalComposer.addPass(gtaoPass);

const GTAO_BLEND_LIGHT_FRAGMENT = `
  uniform float intensity;
  uniform sampler2D tDiffuse;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(mix(vec3(1.0), texel.rgb, intensity), texel.a);
  }
`;

const GTAO_BLEND_DARK_FRAGMENT = `
  uniform float intensity;
  uniform sampler2D tDiffuse;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    float occlusion = clamp(1.0 - texel.r, 0.0, 1.0);
    float glow = occlusion * intensity;
    gl_FragColor = vec4(vec3(glow), glow);
  }
`;
finalComposer.addPass(finalPass);
finalComposer.addPass(new OutputPass());

// ==========================
// Controls
// ==========================

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.rotateSpeed = 0.72;
controls.enablePan = true;
controls.screenSpacePanning = false;

// ==========================
// Lights
// ==========================

const ambient = new THREE.AmbientLight(0xffffff, 1.4);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 2.2);
dir.position.set(300, 500, 300);
scene.add(dir);

// ==========================
// Ground Reference
// ==========================

let hiddenReferenceGrid = new THREE.GridHelper(800, 20, 0xbbbbbb, 0xdddddd);
hiddenReferenceGrid.name = 'Hidden_Reference_Grid';
hiddenReferenceGrid.visible = false;
hiddenReferenceGrid.position.set(0, 0, 0);
hiddenReferenceGrid.layers.disable(BLOOM_LAYER);
hiddenReferenceGrid.raycast = () => {};
scene.add(hiddenReferenceGrid);

let visualGround = null;
let visualGroundY = 0;

// ==========================
// State
// ==========================

let modelRoot = null;
let exploded = false;
let darkMode = false;
let ambientOcclusionEnabled = true;
let outlineMode = false;
let modelSize = 100;

let selected = null;
let selectedGrid = null;
const hiddenParts = new Set();

const parts = [];
const originalMaterials = new Map();

let edgeHelpers = [];

const ANNOTATION_NAME_LINE_HEIGHT = 15;
const ANNOTATION_UNDERLINE_MARGIN_TOP = 3;
const ANNOTATION_LEADER_STROKE_WIDTH = 1;

// Annotation state
let annotationRoot = null;
let annotationSvg = null;
let annotationPath = null;
let annotationDot = null;
let annotationPanel = null;
let annotationName = null;
let annotationNameText = null;
let annotationNameCaret = null;
let annotationUnderline = null;
let annotationMaterial = null;
let annotationMaterialText = null;
let annotationMaterialCaret = null;
let annotationSize = null;
let annotationSizeText = null;
let annotationSizeCaret = null;
let annotationAnchor = null;
let annotationAnchorLocal = null;
let annotationSide = 'right';
let annotationPanelFixedWidth = 80;
let annotationUnderlineFixedWidth = 80;
let annotationTypeTween = null;
let annotationAnimId = 0;
let annotationPathDrawn = false;

explodeBtn.disabled = true;
darkModeBtn.disabled = true;
aoToggleBtn.disabled = true;
outlineToggleBtn.disabled = true;
glowSlider.disabled = true;
hidePartBtn.disabled = true;
showAllBtn.disabled = true;
viewButtons.forEach((button) => {
  button.disabled = true;
});

injectAnnotationStyles();
createAnnotationOverlay();
updateAmbientOcclusionButton();
updateOutlineButton();

const DOWNLOAD_PROGRESS_END = 86;
const MIN_LOADING_INTRO_MS = 4600;
const LOADING_OUTRO_MS = 5600;
const LOADING_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOADING_CODE_TARGET = 'STOXL';

const loadingStartedAt = window.performance.now();
let loadingCompletionScheduled = false;
let loadingCodeFillIndex = 0;
let loadingCodeTypingTimer = null;
let loadingCodeRandomTimer = null;
let loadingCodeMorphFrame = null;
let loadingCodeColumns = 48;

function getDownloadLoadingLabel(rawPercent) {
  if (rawPercent < 4) return 'REQUESTING MODEL FILE';
  if (rawPercent < 18) return 'OPENING DATA STREAM';
  if (rawPercent < 42) return 'DOWNLOADING GEOMETRY';
  if (rawPercent < 68) return 'DOWNLOADING MATERIAL DATA';
  if (rawPercent < 92) return 'VERIFYING MODEL PACKAGE';
  return 'FINALIZING DOWNLOAD';
}

function setLoadingProgress(percent, label = 'LOADING MODEL DATA') {
  const clamped = THREE.MathUtils.clamp(percent, 0, 100);
  loadingBarFill.style.width = `${clamped.toFixed(1)}%`;
  loadingPercent.textContent = `${Math.round(clamped)}%`;
  loadingStatus.textContent = label;
}

function setLoadingStage(percent, label) {
  setLoadingProgress(percent, label);
}

function getRandomLoadingCode(length) {
  let value = '';

  for (let index = 0; index < length; index += 1) {
    value += LOADING_CODE_ALPHABET[Math.floor(Math.random() * LOADING_CODE_ALPHABET.length)];
  }

  return value;
}

function getStoxlLoadingCode(length) {
  let value = '';

  for (let index = 0; index < length; index += 1) {
    value += LOADING_CODE_TARGET[index % LOADING_CODE_TARGET.length];
  }

  return value;
}

function updateLoadingCodeColumns() {
  const sample = document.createElement('span');
  sample.textContent = 'W'.repeat(20);
  sample.style.position = 'absolute';
  sample.style.visibility = 'hidden';
  sample.style.whiteSpace = 'nowrap';
  sample.style.font = window.getComputedStyle(loadingCode).font;
  sample.style.letterSpacing = window.getComputedStyle(loadingCode).letterSpacing;
  loadingCode.appendChild(sample);

  const characterWidth = sample.getBoundingClientRect().width / 20;
  sample.remove();

  const availableWidth = loadingCode.getBoundingClientRect().width;
  loadingCodeColumns = Math.max(8, Math.floor(availableWidth / characterWidth));
}

function setLoadingCodeLines(lineA, lineB) {
  loadingCodeLineA.textContent = lineA;
  loadingCodeLineB.textContent = lineB;
}

function startRandomLoadingCodeLoop() {
  updateLoadingCodeColumns();
  window.clearInterval(loadingCodeRandomTimer);
  setLoadingCodeLines(
    getRandomLoadingCode(loadingCodeColumns),
    getRandomLoadingCode(loadingCodeColumns)
  );

  loadingCodeRandomTimer = window.setInterval(() => {
    updateLoadingCodeColumns();
    setLoadingCodeLines(
      getRandomLoadingCode(loadingCodeColumns),
      getRandomLoadingCode(loadingCodeColumns)
    );
  }, 500);
}

function startLoadingCodeTyping() {
  window.clearInterval(loadingCodeTypingTimer);
  updateLoadingCodeColumns();
  loadingCodeFillIndex = 0;
  loadingCode.classList.add('is-typing');

  loadingCodeTypingTimer = window.setInterval(() => {
    loadingCodeFillIndex = Math.min(loadingCodeFillIndex + 4, loadingCodeColumns);
    setLoadingCodeLines(
      getRandomLoadingCode(loadingCodeFillIndex),
      getRandomLoadingCode(loadingCodeFillIndex)
    );

    if (loadingCodeFillIndex >= loadingCodeColumns) {
      window.clearInterval(loadingCodeTypingTimer);
      loadingCode.classList.remove('is-typing');
      startRandomLoadingCodeLoop();
    }
  }, 34);
}

function startLoadingCodeStoxlMorph(durationMs) {
  window.clearInterval(loadingCodeTypingTimer);
  window.clearInterval(loadingCodeRandomTimer);
  window.cancelAnimationFrame(loadingCodeMorphFrame);
  loadingCode.classList.remove('is-typing');
  updateLoadingCodeColumns();

  const totalLength = loadingCodeColumns * 2;
  const target = getStoxlLoadingCode(totalLength);
  const startAt = window.performance.now();

  function animateMorph(now) {
    const progress = THREE.MathUtils.clamp((now - startAt) / durationMs, 0, 1);
    const stoxlLength = Math.floor(totalLength * progress);
    const randomLength = totalLength - stoxlLength;
    const combined = target.slice(0, stoxlLength) + getRandomLoadingCode(randomLength);

    setLoadingCodeLines(
      combined.slice(0, loadingCodeColumns),
      combined.slice(loadingCodeColumns, totalLength)
    );

    if (progress < 1) {
      loadingCodeMorphFrame = window.requestAnimationFrame(animateMorph);
      return;
    }

    setLoadingCodeLines(
      target.slice(0, loadingCodeColumns),
      target.slice(loadingCodeColumns, totalLength)
    );
  }

  loadingCodeMorphFrame = window.requestAnimationFrame(animateMorph);
}

function completeLoadingScreen() {
  if (loadingCompletionScheduled) return;

  loadingCompletionScheduled = true;
  setLoadingProgress(100, 'ASSEMBLY READY');

  const elapsed = window.performance.now() - loadingStartedAt;
  const introRemaining = Math.max(MIN_LOADING_INTRO_MS - elapsed, 0);
  startLoadingCodeStoxlMorph(introRemaining + LOADING_OUTRO_MS);

  window.setTimeout(() => {
    loadingScreen.classList.add('is-completing');

    window.setTimeout(() => {
      loadingScreen.classList.add('is-hidden');
      document.body.classList.remove('is-loading');
    }, LOADING_OUTRO_MS);
  }, introRemaining);
}

function failLoadingScreen() {
  setLoadingProgress(100, 'LOAD ERROR');
  loadingScreen.classList.add('is-error');
}

setLoadingProgress(0, 'INITIALIZING MODEL DATA');
startLoadingCodeTyping();

// ==========================
// Loader
// ==========================

const loader = new Rhino3dmLoader();
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/');

loader.load(
  '/model/test.3dm',
  (object) => {
    setLoadingStage(88, 'PARSING GEOMETRY');
    modelRoot = object;

    modelRoot.rotation.x = RHINO_TO_THREE_ROTATION_X;
    scene.add(modelRoot);

    centerObject(modelRoot);
    modelRoot.updateMatrixWorld(true);

    setLoadingStage(91, 'MEASURING MODEL');
    modelSize = getModelSize(modelRoot);
    updateAmbientOcclusion();
    createGroundForModel(modelRoot);

    setLoadingStage(94, 'BUILDING ASSEMBLY');
    createExplodePivots(modelRoot);
    saveOriginalMaterials();
    createEdgeHelpers();

    setLoadingStage(97, 'APPLYING MATERIALS');
    applyMaterialSystem();
    transferLightTo(LIGHT_TARGET.DIFFUSER);
    applyGlowLevel(glowLevel);
    frameObject(modelRoot);

    setLoadingStage(99, 'PREPARING INTERFACE');
    explodeBtn.disabled = false;
    darkModeBtn.disabled = false;
    aoToggleBtn.disabled = false;
    outlineToggleBtn.disabled = false;
    glowSlider.disabled = false;
    updateSelectionActions();
    viewButtons.forEach((button) => {
      button.disabled = false;
    });

    statusText.textContent = `3DM loaded / Parts: ${parts.length} / Light: ${lightTarget}`;
    completeLoadingScreen();

    console.log('3DM loaded:', modelRoot);
    console.log(`Explode parts: ${parts.length}`);

    console.table(
      parts.map((p) => ({
        name: p.name,
        dir: p.dirTag,
        dist: p.distance,
        order: p.order,
        led: isLedPart(p),
        polycarbon: isPolycarbonPart(p),
        glass: isGlassPart(p),
        topPanel: isTopPanelPart(p),
      }))
    );
  },
  (xhr) => {
    if (xhr.lengthComputable && xhr.total > 0) {
      const rawPercent = (xhr.loaded / xhr.total) * 100;
      const percent = rawPercent * (DOWNLOAD_PROGRESS_END / 100);
      const loadingLabel = getDownloadLoadingLabel(rawPercent);
      statusText.textContent = `Loading ${rawPercent.toFixed(1)}%`;
      setLoadingProgress(percent, loadingLabel);
      console.log(`Loading: ${rawPercent.toFixed(1)}%`);
    } else {
      const loadedMb = (xhr.loaded / 1024 / 1024).toFixed(2);
      statusText.textContent = `Loading 3DM... ${loadedMb}MB`;
      setLoadingProgress(12, `STREAMING MODEL ${loadedMb}MB`);
    }
  },
  (error) => {
    statusText.textContent = '3DM load error - check console';
    failLoadingScreen();
    console.error('3DM load error:', error);
  }
);

// ==========================
// Basic Helpers
// ==========================

function centerObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

function getModelSize(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}

function updateAmbientOcclusion() {
  gtaoPass.enabled = ambientOcclusionEnabled;
  configureAmbientOcclusionBlend();

  gtaoPass.blendIntensity = darkMode ? 2.2 : 1.75;
  gtaoPass.updateGtaoMaterial({
    radius: Math.max(modelSize * 0.18, 24),
    distanceExponent: 1.2,
    thickness: Math.max(modelSize * 0.06, 8),
    distanceFallOff: 0.85,
    scale: darkMode ? 1.55 : 1.28,
    samples: 192,
    screenSpaceRadius: false,
  });

  gtaoPass.updatePdMaterial({
    lumaPhi: 18,
    depthPhi: 28,
    normalPhi: 22,
    radius: 12,
    radiusExponent: 1.9,
    rings: 4,
    samples: 128,
  });
}

function updateAmbientOcclusionButton() {
  aoToggleBtn.textContent = ambientOcclusionEnabled ? 'AO On' : 'AO Off';
  aoToggleBtn.classList.toggle('is-off', !ambientOcclusionEnabled);
}

function updateOutlineButton() {
  outlineToggleBtn.textContent = outlineMode ? 'Outline On' : 'Outline Off';
  outlineToggleBtn.classList.toggle('is-off', !outlineMode);
}

function setAmbientOcclusionEnabled(enabled) {
  ambientOcclusionEnabled = enabled;
  gtaoPass.enabled = ambientOcclusionEnabled;
  updateAmbientOcclusionButton();

  statusText.textContent = ambientOcclusionEnabled
    ? 'Ambient occlusion on'
    : 'Ambient occlusion off';
}

function setOutlineMode(enabled) {
  outlineMode = enabled;
  updateOutlineButton();
  updateEdgeHelpersAppearance();

  statusText.textContent = outlineMode ? 'Outline mode on' : 'Outline mode off';
}

function configureAmbientOcclusionBlend() {
  const material = gtaoPass.blendMaterial;
  const nextFragment = darkMode ? GTAO_BLEND_DARK_FRAGMENT : GTAO_BLEND_LIGHT_FRAGMENT;

  if (material.fragmentShader !== nextFragment) {
    material.fragmentShader = nextFragment;
    material.needsUpdate = true;
  }

  if (darkMode) {
    material.blending = THREE.AdditiveBlending;
    material.blendSrc = THREE.SrcAlphaFactor;
    material.blendDst = THREE.OneFactor;
    material.blendEquation = THREE.AddEquation;
    material.blendSrcAlpha = THREE.ZeroFactor;
    material.blendDstAlpha = THREE.OneFactor;
    material.blendEquationAlpha = THREE.AddEquation;
    return;
  }

  material.blending = THREE.CustomBlending;
  material.blendSrc = THREE.DstColorFactor;
  material.blendDst = THREE.ZeroFactor;
  material.blendEquation = THREE.AddEquation;
  material.blendSrcAlpha = THREE.DstAlphaFactor;
  material.blendDstAlpha = THREE.ZeroFactor;
  material.blendEquationAlpha = THREE.AddEquation;
}

function getModelBottomY(object) {
  const box = new THREE.Box3().setFromObject(object);
  return box.min.y;
}

function createVisualGroundMaterial() {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    uniforms: {
      baseColor: { value: new THREE.Color(0xffffff) },
      lineColor: { value: new THREE.Color(0x4f6666) },
      majorLineColor: { value: new THREE.Color(0x6f8888) },
      gridOpacity: { value: 0.0 },
      minorGridSize: { value: 28.0 },
      majorGridSize: { value: 140.0 },
      fadeDistance: { value: 1800.0 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 lineColor;
      uniform vec3 majorLineColor;
      uniform float gridOpacity;
      uniform float minorGridSize;
      uniform float majorGridSize;
      uniform float fadeDistance;

      varying vec3 vWorldPosition;

      float gridLine(vec2 coord, float size, float thickness) {
        vec2 grid = abs(fract(coord / size - 0.5) - 0.5) / fwidth(coord / size);
        float line = min(grid.x, grid.y);
        return 1.0 - min(line / thickness, 1.0);
      }

      void main() {
        vec2 coord = vWorldPosition.xz;
        float minor = gridLine(coord, minorGridSize, 1.0);
        float major = gridLine(coord, majorGridSize, 1.25);
        float distanceFade = 1.0 - smoothstep(fadeDistance * 0.55, fadeDistance, length(coord - cameraPosition.xz));
        vec3 gridColor = mix(lineColor, majorLineColor, major);
        float gridAmount = max(minor * 0.55, major) * gridOpacity * distanceFade;
        gl_FragColor = vec4(mix(baseColor, gridColor, gridAmount), 1.0);
      }
    `,
  });
}

function createGroundForModel(object) {
  const bottomY = getModelBottomY(object);
  const groundSize = Math.max(modelSize * 80, 8000);
  const groundY = bottomY - Math.max(modelSize * 0.002, 0.05);
  visualGroundY = groundY;

  hiddenReferenceGrid.position.set(0, 0, 0);
  hiddenReferenceGrid.visible = false;
  hiddenReferenceGrid.layers.disable(BLOOM_LAYER);
  hiddenReferenceGrid.raycast = () => {};

  if (visualGround) {
    groundScene.remove(visualGround);
    visualGround.geometry?.dispose?.();
    visualGround.material?.dispose?.();
  }

  visualGround = new THREE.Mesh(
    new THREE.PlaneGeometry(groundSize, groundSize),
    createVisualGroundMaterial()
  );
  visualGround.name = 'Visual_Infinite_Ground';
  visualGround.rotation.x = -Math.PI / 2;
  visualGround.position.y = groundY;
  visualGround.renderOrder = -10;
  visualGround.raycast = () => {};
  groundScene.add(visualGround);

  updateGroundTheme();
}

function updateGroundTheme() {
  if (hiddenReferenceGrid) {
    hiddenReferenceGrid.position.set(0, 0, 0);
    hiddenReferenceGrid.visible = false;
  }

  groundScene.background = new THREE.Color(darkMode ? DARK_BG : LIGHT_BG);

  if (!visualGround) return;

  visualGround.visible = true;
  visualGround.material.uniforms.baseColor.value.setHex(darkMode ? DARK_BG : 0xffffff);
  visualGround.material.uniforms.lineColor.value.setHex(0x405a5a);
  visualGround.material.uniforms.majorLineColor.value.setHex(0x6f8585);
  visualGround.material.uniforms.minorGridSize.value = Math.max(modelSize * 0.08, 24);
  visualGround.material.uniforms.majorGridSize.value = Math.max(modelSize * 0.42, 120);
  updateVisualGroundCameraStyle();
  visualGround.material.needsUpdate = true;
}

function updateVisualGroundCameraStyle() {
  if (!visualGround) return;

  visualGround.material.uniforms.gridOpacity.value = darkMode
    ? 0.42
    : 0.0;

  visualGround.material.uniforms.fadeDistance.value = Math.max(modelSize * 8.0, 1400);
}

function updateVisualGroundPosition() {
  if (!visualGround) return;

  visualGround.position.x = controls.target.x;
  visualGround.position.y = visualGroundY;
  visualGround.position.z = controls.target.z;
}

function updateOrthographicFrustum() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = Math.max(modelSize * 2.1, 100);
  const halfHeight = viewSize / 2;
  const halfWidth = halfHeight * aspect;

  orthographicCamera.left = -halfWidth;
  orthographicCamera.right = halfWidth;
  orthographicCamera.top = halfHeight;
  orthographicCamera.bottom = -halfHeight;
  orthographicCamera.near = Math.max(modelSize / 100, 0.1);
  orthographicCamera.far = Math.max(modelSize * 100, 10000);
  orthographicCamera.updateProjectionMatrix();
}

function syncGroundCamera() {
  if (camera.isOrthographicCamera) {
    groundCamera = groundOrthographicCamera;
    groundOrthographicCamera.left = orthographicCamera.left;
    groundOrthographicCamera.right = orthographicCamera.right;
    groundOrthographicCamera.top = orthographicCamera.top;
    groundOrthographicCamera.bottom = orthographicCamera.bottom;
    groundOrthographicCamera.near = orthographicCamera.near;
    groundOrthographicCamera.far = orthographicCamera.far;
    groundOrthographicCamera.position.copy(camera.position);
    groundOrthographicCamera.quaternion.copy(camera.quaternion);
    groundOrthographicCamera.up.copy(camera.up);
    groundOrthographicCamera.updateProjectionMatrix();
  } else {
    groundCamera = groundPerspectiveCamera;
    groundPerspectiveCamera.fov = perspectiveCamera.fov;
    groundPerspectiveCamera.aspect = perspectiveCamera.aspect;
    groundPerspectiveCamera.near = perspectiveCamera.near;
    groundPerspectiveCamera.far = perspectiveCamera.far;
    groundPerspectiveCamera.quaternion.copy(camera.quaternion);
    groundPerspectiveCamera.up.copy(camera.up);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const distance = Math.max(modelSize * 4.8, 900);
    groundPerspectiveCamera.position.copy(controls.target).addScaledVector(forward, -distance);
    groundPerspectiveCamera.updateProjectionMatrix();
  }

  groundRenderScene.camera = groundCamera;
}

function setActiveCamera(nextCamera) {
  if (camera === nextCamera) {
    if (camera.isPerspectiveCamera) {
      camera.up.set(0, 1, 0);
      controls.target.set(0, 0, 0);
    }

    updateCameraControlFeel();
    updateVisualGroundCameraStyle();
    syncGroundCamera();
    return;
  }

  if (nextCamera.isPerspectiveCamera) {
    nextCamera.up.set(0, 1, 0);
  } else {
    nextCamera.up.copy(camera.up);
  }

  nextCamera.position.copy(camera.position);
  nextCamera.quaternion.copy(camera.quaternion);
  nextCamera.near = camera.near;
  nextCamera.far = camera.far;
  nextCamera.updateProjectionMatrix();

  camera = nextCamera;
  bloomRenderScene.camera = camera;
  renderScene.camera = camera;
  gtaoPass.camera = camera;
  controls.object = camera;
  if (camera.isPerspectiveCamera) {
    controls.target.set(0, 0, 0);
  }
  controls.update();
  updateCameraControlFeel();
  updateVisualGroundCameraStyle();
  syncGroundCamera();
}

function updateCameraControlFeel() {
  controls.rotateSpeed = 0.72;
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim === 0) return;

  const distance = maxDim * 1.8;

  setActiveCamera(perspectiveCamera);
  perspectiveCamera.up.set(0, 1, 0);
  perspectiveCamera.position.set(distance, distance * 0.7, distance);
  perspectiveCamera.near = maxDim / 100;
  perspectiveCamera.far = maxDim * 100;
  perspectiveCamera.updateProjectionMatrix();
  updateOrthographicFrustum();

  controls.target.set(0, 0, 0);
  controls.update();

  setActiveViewButton(null);
}

function getCameraViewDirection(view) {
  switch (view) {
    case 'top':
      return new THREE.Vector3(0, 1, 0);
    case 'bottom':
      return new THREE.Vector3(0, -1, 0);
    case 'front':
      return new THREE.Vector3(0, 0, 1);
    case 'rear':
      return new THREE.Vector3(0, 0, -1);
    case 'left':
      return new THREE.Vector3(-1, 0, 0);
    case 'right':
      return new THREE.Vector3(1, 0, 0);
    case 'iso-nw':
      return new THREE.Vector3(-1, 1, 1);
    case 'iso-ne':
      return new THREE.Vector3(1, 1, 1);
    case 'iso-sw':
      return new THREE.Vector3(-1, 1, -1);
    case 'iso-se':
      return new THREE.Vector3(1, 1, -1);
    default:
      return new THREE.Vector3(1, 0.7, 1);
  }
}

function getCameraViewLabel(view) {
  return String(view || '')
    .replace('iso-', 'ISO ')
    .replace('-', ' ')
    .toUpperCase();
}

function isIsoView(view) {
  return String(view || '').startsWith('iso-');
}

function applyCameraUpForView(view) {
  if (camera.isPerspectiveCamera) {
    camera.up.set(0, 1, 0);
    return;
  }

  if (view === 'top') {
    camera.up.set(0, 0, -1);
    return;
  }

  if (view === 'bottom') {
    camera.up.set(0, 0, 1);
    return;
  }

  camera.up.set(0, 1, 0);
}

function moveCameraToView(view) {
  if (!modelRoot) return;

  if (isIsoView(view)) {
    updateOrthographicFrustum();
    setActiveCamera(orthographicCamera);
  } else {
    setActiveCamera(perspectiveCamera);
  }

  const direction = getCameraViewDirection(view).normalize();
  if (camera.isPerspectiveCamera && (view === 'top' || view === 'bottom')) {
    direction.z = view === 'top' ? 0.001 : -0.001;
    direction.normalize();
  }

  const target = new THREE.Vector3(0, 0, 0);
  const distance = isIsoView(view)
    ? Math.max(modelSize * 3.2, 100)
    : Math.max(modelSize * 2.6, camera.position.distanceTo(controls.target));
  const cameraTargetPosition = target.clone().add(direction.multiplyScalar(distance));

  applyCameraUpForView(view);

  const start = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
    tx: controls.target.x,
    ty: controls.target.y,
    tz: controls.target.z,
  };

  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);

  gsap.to(start, {
    x: cameraTargetPosition.x,
    y: cameraTargetPosition.y,
    z: cameraTargetPosition.z,
    tx: target.x,
    ty: target.y,
    tz: target.z,
    duration: 0.7,
    ease: 'power3.inOut',
    onUpdate: () => {
      camera.position.set(start.x, start.y, start.z);
      controls.target.set(start.tx, start.ty, start.tz);
      controls.update();
      updateAnnotationPosition();
    },
  });

  statusText.textContent = `Camera view: ${getCameraViewLabel(view)}`;
}

function getMeshWorldCenter(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return box.getCenter(new THREE.Vector3());
}

function getObjectName(object, fallback = 'Unnamed part') {
  const candidates = [
    object.name,
    object.userData?.name,
    object.userData?.attributes?.name,
    object.userData?.attributes?.Name,
    object.userData?.geometry?.name,
    object.parent?.name,
    object.parent?.userData?.attributes?.name,
    object.parent?.userData?.attributes?.Name,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return fallback;
}

function cleanDisplayName(name) {
  return String(name || '')
    .replace(/__DIR_[A-Z]+/gi, '')
    .replace(/__DIST_[0-9.]+/gi, '')
    .replace(/__ORDER_[0-9]+/gi, '')
    .replace(/^PART_/i, '')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
}

// ==========================
// Tag Parser
// ==========================

function parsePartTag(name, fallbackIndex) {
  const upper = name.toUpperCase();

  const dirMatch = upper.match(/__DIR_(XP|XN|YP|YN|ZP|ZN)/);
  const distMatch = upper.match(/__DIST_([0-9]+(?:\.[0-9]+)?)/);
  const orderMatch = upper.match(/__ORDER_([0-9]+)/);

  const dirTag = dirMatch ? dirMatch[1] : null;
  const distance = distMatch ? Number(distMatch[1]) : DEFAULT_DIST;
  const order = orderMatch ? Number(orderMatch[1]) : fallbackIndex;

  return {
    dirTag,
    distance,
    order,
  };
}

function directionFromDirTag(dirTag) {
  switch (dirTag) {
    case 'XP':
      return new THREE.Vector3(1, 0, 0);
    case 'XN':
      return new THREE.Vector3(-1, 0, 0);
    case 'YP':
      return new THREE.Vector3(0, 1, 0);
    case 'YN':
      return new THREE.Vector3(0, -1, 0);
    case 'ZP':
      return new THREE.Vector3(0, 0, 1);
    case 'ZN':
      return new THREE.Vector3(0, 0, -1);
    default:
      return null;
  }
}

function getFallbackDirection(localCenter) {
  const direction = localCenter.clone();

  if (direction.lengthSq() < 0.0001) {
    direction.set(
      Math.random() - 0.5,
      Math.random() * 0.5,
      Math.random() - 0.5
    );
  }

  return direction.normalize();
}

// ==========================
// Explode Pivot System
// ==========================

function createExplodePivots(root) {
  parts.length = 0;

  const meshes = [];

  root.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child);
    }
  });

  root.updateMatrixWorld(true);

  meshes.forEach((mesh, index) => {
    const meshName = getObjectName(mesh, `PART_${index + 1}`);
    const tag = parsePartTag(meshName, index + 1);

    const worldCenter = getMeshWorldCenter(mesh);
    const localCenter = root.worldToLocal(worldCenter.clone());

    root.attach(mesh);

    const pivot = new THREE.Group();
    pivot.name = `Pivot_${meshName}`;
    pivot.position.copy(localCenter);

    root.add(pivot);
    pivot.attach(mesh);

    const taggedDirection = directionFromDirTag(tag.dirTag);
    const direction = taggedDirection || getFallbackDirection(localCenter);

    parts.push({
      pivot,
      mesh,
      name: meshName,
      originalPosition: pivot.position.clone(),
      direction,
      dirTag: tag.dirTag || 'AUTO',
      distance: tag.distance,
      order: tag.order,
      index,
    });
  });

  parts.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.index - b.index;
  });

  root.updateMatrixWorld(true);
}

// ==========================
// Part Type Helpers
// ==========================

function saveOriginalMaterials() {
  originalMaterials.clear();

  parts.forEach((part) => {
    originalMaterials.set(part.mesh.uuid, part.mesh.material);
  });
}

function getPartByMesh(mesh) {
  return parts.find((part) => part.mesh === mesh || part.mesh.uuid === mesh.uuid) || null;
}

function isLedPart(part) {
  const name = part.name.toUpperCase();
  return /LED_0[1-6]/.test(name) || name.includes('LED');
}

function isPolycarbonPart(part) {
  return part.name.toUpperCase().includes('POLYCARBON');
}

function isGlassPart(part) {
  return part.name.toUpperCase().includes('GLASS');
}

function isTopPanelPart(part) {
  const name = part.name.toUpperCase();
  return name.includes('TOPPANEL') || name.includes('TOP_PANEL') || name.includes('TOP');
}

function isBloomOccluderObject(obj) {
  const name = getObjectName(obj, '').toUpperCase();

  return (
    name.includes('GLASS') ||
    name.includes('POLYCARBON') ||
    name.includes('SHADOW_CATCHER')
  );
}

// ==========================
// Material System
// ==========================

function createPolycarbonMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: darkMode ? 0xd8d8d4 : 0xe8e6dc,
    roughness: 0.98,
    metalness: 0.0,
    transparent: true,
    opacity: darkMode ? 0.72 : 0.84,
    transmission: 0.02,
    thickness: 18.0,
    ior: 1.45,
    clearcoat: 0.02,
    clearcoatRoughness: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function createGlassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: darkMode ? 0xf5f5f2 : 0xffffff,
    roughness: darkMode ? 0.16 : 0.18,
    metalness: 0.0,
    transparent: true,
    opacity: darkMode ? 0.24 : 0.32,
    transmission: darkMode ? 0.78 : 0.72,
    thickness: 1.2,
    ior: 1.5,
    clearcoat: 0.75,
    clearcoatRoughness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

function createLedMaterial(isLightOwner = false) {
  const emissiveIntensity = isLightOwner
    ? THREE.MathUtils.lerp(0.1, darkMode ? 4.2 : 1.6, glowLevel)
    : 0.0;

  return new THREE.MeshStandardMaterial({
    color: isLightOwner ? 0x00ffff : 0x202020,
    emissive: 0x00ffff,
    emissiveIntensity,
    roughness: 0.03,
    metalness: 0.0,
  });
}

function createPolycarbonLightMaterial() {
  const emissiveIntensity = THREE.MathUtils.lerp(
    0.1,
    darkMode ? 4.2 : 1.6,
    glowLevel
  );

  return new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity,
    roughness: 0.03,
    metalness: 0.0,
  });
}

function createDarkMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x070707,
    roughness: 0.78,
    metalness: 0.08,
  });
}

function applyMaterialSystem() {
  parts.forEach((part) => {
    part.mesh.layers.disable(BLOOM_LAYER);

    if (isLedPart(part)) {
      part.mesh.material = createLedMaterial(lightTarget === LIGHT_TARGET.LED);

      if (lightTarget === LIGHT_TARGET.LED) {
        part.mesh.layers.enable(BLOOM_LAYER);
      }

      return;
    }

    if (isPolycarbonPart(part)) {
      part.mesh.material =
        lightTarget === LIGHT_TARGET.DIFFUSER
          ? createPolycarbonLightMaterial()
          : createPolycarbonMaterial();

      if (lightTarget === LIGHT_TARGET.DIFFUSER) {
        part.mesh.layers.enable(BLOOM_LAYER);
      }

      return;
    }

    if (isGlassPart(part)) {
      part.mesh.material = createGlassMaterial();
      part.mesh.layers.disable(BLOOM_LAYER);
      part.mesh.renderOrder = 10;
      return;
    }

    if (darkMode) {
      part.mesh.material = createDarkMaterial();
      return;
    }

    const originalMaterial = originalMaterials.get(part.mesh.uuid);

    if (originalMaterial) {
      part.mesh.material = originalMaterial;
    }
  });
}

function transferLightTo(target) {
  lightTarget = target;
  applyMaterialSystem();
  applyGlowLevel(glowLevel);

  console.log(`Light transferred to: ${lightTarget}`);
}

// ==========================
// Edges
// ==========================

function createEdgeHelpers() {
  disposeEdgeHelpers();

  edgeHelpers = [];

  parts.forEach((part) => {
    if (!part.mesh.geometry) return;

    const edgesGeometry = new THREE.EdgesGeometry(part.mesh.geometry, 30);

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      linewidth: 2,
    });

    const edgeLine = new THREE.LineSegments(edgesGeometry, edgeMaterial);
    edgeLine.name = `Edge_${part.name}`;
    edgeLine.visible = false;
    edgeLine.layers.disable(BLOOM_LAYER);

    part.mesh.add(edgeLine);
    edgeHelpers.push(edgeLine);
  });

  updateEdgeHelpersAppearance();

  console.log(`Edge helpers created: ${edgeHelpers.length}`);
}

function updateEdgeHelpersAppearance() {
  const visible = darkMode || outlineMode;
  const color = darkMode ? 0xffffff : 0x050505;
  const opacity = darkMode ? 0.95 : 0.72;

  edgeHelpers.forEach((edge) => {
    edge.visible = visible;
    edge.layers.disable(BLOOM_LAYER);
    edge.material.color.setHex(color);
    edge.material.opacity = opacity;
    edge.material.depthTest = true;
    edge.material.needsUpdate = true;
  });
}

function disposeEdgeHelpers() {
  edgeHelpers.forEach((edge) => {
    edge.geometry?.dispose?.();
    edge.material?.dispose?.();
    edge.removeFromParent();
  });
}

// ==========================
// Selective Bloom Helpers
// ==========================

function darkenNonBloomed(obj) {
  if (!obj.isMesh) return;
  if (bloomLayer.test(obj.layers)) return;

  materials[obj.uuid] = {
    material: obj.material,
    visible: obj.visible,
  };

  if (isBloomOccluderObject(obj)) {
    obj.visible = false;
    return;
  }

  obj.material = darkMaterial;
}

function restoreMaterial(obj) {
  const saved = materials[obj.uuid];

  if (!saved) return;

  obj.material = saved.material;
  obj.visible = saved.visible;

  delete materials[obj.uuid];
}

// ==========================
// Glow Control
// ==========================

function applyGlowLevel(level) {
  glowLevel = THREE.MathUtils.clamp(level, 0, 1);

  const percent = Math.round(glowLevel * 100);
  glowValue.textContent = `${percent}%`;

  bloomPass.strength = THREE.MathUtils.lerp(
    0.0,
    darkMode ? 1.25 : 0.45,
    glowLevel
  );

  bloomPass.radius = THREE.MathUtils.lerp(
    0.08,
    darkMode ? 0.72 : 0.32,
    glowLevel
  );

  bloomPass.threshold = THREE.MathUtils.lerp(
    0.35,
    darkMode ? 0.02 : 0.12,
    glowLevel
  );

  parts.forEach((part) => {
    if (isLedPart(part)) {
      part.mesh.material = createLedMaterial(lightTarget === LIGHT_TARGET.LED);
      part.mesh.layers.disable(BLOOM_LAYER);

      if (lightTarget === LIGHT_TARGET.LED) {
        part.mesh.layers.enable(BLOOM_LAYER);
      }
    }

    if (isPolycarbonPart(part)) {
      part.mesh.material =
        lightTarget === LIGHT_TARGET.DIFFUSER
          ? createPolycarbonLightMaterial()
          : createPolycarbonMaterial();

      part.mesh.layers.disable(BLOOM_LAYER);

      if (lightTarget === LIGHT_TARGET.DIFFUSER) {
        part.mesh.layers.enable(BLOOM_LAYER);
      }
    }

    if (isGlassPart(part)) {
      part.mesh.material = createGlassMaterial();
      part.mesh.layers.disable(BLOOM_LAYER);
      part.mesh.renderOrder = 10;
    }
  });

}

glowSlider.addEventListener('input', (event) => {
  const value = Number(event.target.value) / 100;
  applyGlowLevel(value);
});

// ==========================
// Dark Mode
// ==========================

function setDarkMode(nextDarkMode) {
  if (!modelRoot || parts.length === 0) return;

  darkMode = nextDarkMode;

  ambient.intensity = darkMode ? 0.8 : 1.4;
  dir.intensity = darkMode ? 1.2 : 2.2;

  updateGroundTheme();
  updateAmbientOcclusion();

  applyMaterialSystem();
  applyGlowLevel(glowLevel);

  updateEdgeHelpersAppearance();

  document.body.classList.toggle('dark-mode', darkMode);

  darkModeBtn.textContent = darkMode ? 'Light Mode' : 'Dark Mode';

  updateSelectionGridAppearance();
  updateAnnotationTheme();

  statusText.textContent = darkMode
    ? `Dark mode / Light: ${lightTarget}`
    : `Light mode / Light: ${lightTarget}`;
}

darkModeBtn.addEventListener('click', () => {
  setDarkMode(!darkMode);
});

aoToggleBtn.addEventListener('click', () => {
  setAmbientOcclusionEnabled(!ambientOcclusionEnabled);
});

outlineToggleBtn.addEventListener('click', () => {
  setOutlineMode(!outlineMode);
});

// ==========================
// Camera Views
// ==========================

function setActiveViewButton(view) {
  viewButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });
}

viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (!view) return;

    setActiveViewButton(view);
    moveCameraToView(view);
  });
});

// ==========================
// Explode / Assemble Animation
// ==========================

function getPartExplodeDistance(part) {
  if (typeof part.distance === 'number' && !Number.isNaN(part.distance)) {
    return part.distance;
  }

  return modelSize * DEFAULT_EXPLODE_RATIO;
}

function setExploded(nextExploded) {
  if (!modelRoot || parts.length === 0) return;

  exploded = nextExploded;
  explodeBtn.disabled = true;

  let completedCount = 0;
  let lightTransferredBackToLed = false;

  const orderedParts = exploded
    ? [...parts]
    : [...parts].reverse();

  orderedParts.forEach((part, sequenceIndex) => {
    const partDistance = getPartExplodeDistance(part);

    const target = exploded
      ? part.originalPosition
          .clone()
          .add(part.direction.clone().multiplyScalar(partDistance))
      : part.originalPosition.clone();

    gsap.killTweensOf(part.pivot.position);

    gsap.to(part.pivot.position, {
      x: target.x,
      y: target.y,
      z: target.z,

      duration: exploded ? 0.8 : 0.68,
      ease: exploded ? 'power3.out' : 'back.out(0.75)',
      delay: sequenceIndex * (exploded ? EXPLODE_DELAY_STEP : ASSEMBLE_DELAY_STEP),

      onStart: () => {
        if (
          exploded &&
          !lightTransferredBackToLed &&
          isTopPanelPart(part)
        ) {
          lightTransferredBackToLed = true;
          transferLightTo(LIGHT_TARGET.LED);
          statusText.textContent = `Exploding... / Light moved to LED`;
        }
      },

      onUpdate: () => {
        updateAnnotationPosition();
      },

      onComplete: () => {
        completedCount += 1;
        updateAnnotationPosition();

        if (completedCount === orderedParts.length) {
          explodeBtn.disabled = false;

          if (!exploded) {
            transferLightTo(LIGHT_TARGET.DIFFUSER);
          }

          statusText.textContent = exploded
            ? `Exploded view / Light: ${lightTarget}`
            : `Assembled view / Light: ${lightTarget}`;
        }
      },
    });
  });

  explodeBtn.textContent = exploded ? 'Assemble' : 'Explode';

  statusText.textContent = exploded
    ? `Exploding by ORDER... / Parts: ${parts.length}`
    : `Assembling by reverse ORDER... / Parts: ${parts.length}`;
}

explodeBtn.addEventListener('click', () => {
  setExploded(!exploded);
});

// ==========================
// Selection Grid
// ==========================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const CLICK_MOVE_THRESHOLD = 5;
let selectionPointerDown = null;

function getSelectionGridColor() {
  return darkMode ? 0x8a8a8a : 0x000000;
}

function getSelectionGridOpacity() {
  return darkMode ? 0.38 : 0.5;
}

function createSelectionGrid(mesh) {
  if (!mesh.geometry) return null;

  mesh.geometry.computeBoundingBox();

  const box = mesh.geometry.boundingBox.clone();
  const min = box.min;
  const max = box.max;

  const size = new THREE.Vector3();
  box.getSize(size);

  const maxSize = Math.max(size.x, size.y, size.z);
  const offset = maxSize * 0.0025;

  const divisions = 10;
  const positions = [];

  function addLine(a, b) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function addXYFace(z) {
    for (let i = 0; i <= divisions; i += 1) {
      const t = i / divisions;

      const x = lerp(min.x, max.x, t);
      const y = lerp(min.y, max.y, t);

      addLine(new THREE.Vector3(x, min.y, z), new THREE.Vector3(x, max.y, z));
      addLine(new THREE.Vector3(min.x, y, z), new THREE.Vector3(max.x, y, z));
    }
  }

  function addXZFace(y) {
    for (let i = 0; i <= divisions; i += 1) {
      const t = i / divisions;

      const x = lerp(min.x, max.x, t);
      const z = lerp(min.z, max.z, t);

      addLine(new THREE.Vector3(x, y, min.z), new THREE.Vector3(x, y, max.z));
      addLine(new THREE.Vector3(min.x, y, z), new THREE.Vector3(max.x, y, z));
    }
  }

  function addYZFace(x) {
    for (let i = 0; i <= divisions; i += 1) {
      const t = i / divisions;

      const y = lerp(min.y, max.y, t);
      const z = lerp(min.z, max.z, t);

      addLine(new THREE.Vector3(x, y, min.z), new THREE.Vector3(x, y, max.z));
      addLine(new THREE.Vector3(x, min.y, z), new THREE.Vector3(x, max.y, z));
    }
  }

  addXYFace(min.z - offset);
  addXYFace(max.z + offset);

  addXZFace(min.y - offset);
  addXZFace(max.y + offset);

  addYZFace(min.x - offset);
  addYZFace(max.x + offset);

  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const gridMaterial = new THREE.LineBasicMaterial({
    color: getSelectionGridColor(),
    transparent: true,
    opacity: getSelectionGridOpacity(),
    depthTest: true,
    depthWrite: false,
  });

  const gridObject = new THREE.LineSegments(gridGeometry, gridMaterial);
  gridObject.name = `SelectionGrid_${getObjectName(mesh, 'mesh')}`;

  gridObject.layers.disable(BLOOM_LAYER);
  gridObject.renderOrder = 999;

  mesh.add(gridObject);

  return gridObject;
}

function clearSelection() {
  if (selectedGrid) {
    selectedGrid.geometry?.dispose?.();
    selectedGrid.material?.dispose?.();
    selectedGrid.removeFromParent();
    selectedGrid = null;
  }

  selected = null;
  partName.textContent = 'None';
  statusText.textContent = `Selection cleared / Light: ${lightTarget}`;
  updateSelectionActions();
  hideAnnotation();
}

function selectMesh(mesh, hitPoint = null) {
  if (selected === mesh) {
    clearSelection();
    return;
  }

  if (selectedGrid) {
    selectedGrid.geometry?.dispose?.();
    selectedGrid.material?.dispose?.();
    selectedGrid.removeFromParent();
    selectedGrid = null;
  }

  selected = mesh;
  selectedGrid = createSelectionGrid(mesh);

  const name = getObjectName(mesh);

  partName.textContent = name;
  statusText.textContent = `Selected: ${name}`;
  updateSelectionActions();

  showAnnotationForMesh(mesh);

  console.log('Selected part:', mesh);
}

function updateSelectionGridAppearance() {
  if (!selectedGrid) return;

  selectedGrid.material.color.setHex(getSelectionGridColor());
  selectedGrid.material.opacity = getSelectionGridOpacity();
  selectedGrid.material.needsUpdate = true;
}

function updateSelectionActions() {
  const hasSelection = Boolean(selected);
  const hasHiddenParts = hiddenParts.size > 0;

  selectionActions.hidden = !hasSelection && !hasHiddenParts;
  hidePartBtn.disabled = !hasSelection;
  showAllBtn.disabled = !hasHiddenParts;
}

function hideSelectedPart() {
  if (!selected) return;

  const mesh = selected;
  const name = getObjectName(mesh);

  hiddenParts.add(mesh);
  mesh.visible = false;
  clearSelection();

  statusText.textContent = `Hidden: ${name}`;
  updateSelectionActions();
}

function showAllHiddenParts() {
  hiddenParts.forEach((mesh) => {
    mesh.visible = true;
  });

  const count = hiddenParts.size;
  hiddenParts.clear();
  updateSelectionActions();

  statusText.textContent = count > 0 ? `All shown / Restored: ${count}` : `All shown`;
}

hidePartBtn.addEventListener('click', hideSelectedPart);
showAllBtn.addEventListener('click', showAllHiddenParts);

function handleSelectionClick(event) {
  if (!modelRoot || parts.length === 0) return;
  if (event.target.closest?.('.ui')) return;

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const meshes = parts
    .map((part) => part.mesh)
    .filter((mesh) => mesh.visible && !hiddenParts.has(mesh));
  const hits = raycaster.intersectObjects(meshes, true);

  if (!hits.length) {
    clearSelection();
    return;
  }

  let hitObject = hits[0].object;

  if (hitObject.name?.startsWith('SelectionGrid_') && hitObject.parent?.isMesh) {
    hitObject = hitObject.parent;
  }

  selectMesh(hitObject, hits[0].point);
}

window.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (event.target.closest?.('.ui')) return;

  selectionPointerDown = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
});

window.addEventListener('pointerup', (event) => {
  if (event.button !== 0 || !selectionPointerDown) return;
  if (selectionPointerDown.pointerId !== event.pointerId) return;

  const dx = event.clientX - selectionPointerDown.x;
  const dy = event.clientY - selectionPointerDown.y;
  const distance = Math.hypot(dx, dy);

  selectionPointerDown = null;

  if (distance > CLICK_MOVE_THRESHOLD) return;

  handleSelectionClick(event);
});

window.addEventListener('pointercancel', () => {
  selectionPointerDown = null;
});

// ==========================
// Annotation Overlay
// ==========================

function injectAnnotationStyles() {
  const style = document.createElement('style');

  style.textContent = `
    .part-annotation-root {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 999998;
      opacity: 0;
      color: #050505;
      font-family:
        "JetBrains Mono",
        "IBM Plex Mono",
        "Cascadia Code",
        "SFMono-Regular",
        Consolas,
        "Liberation Mono",
        Menlo,
        monospace;
    }

    .dark-mode .part-annotation-root {
      color: #f4f4f4;
    }

    .part-annotation-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .part-annotation-dot {
      position: absolute;
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: currentColor;
      box-shadow:
        0 0 0 5px rgba(5, 5, 5, 0.12),
        0 0 18px rgba(5, 5, 5, 0.16);
      transform: translate(-50%, -50%) scale(0);
      transform-origin: center;
    }

    .dark-mode .part-annotation-dot {
      box-shadow:
        0 0 0 5px rgba(244, 244, 244, 0.16),
        0 0 18px rgba(244, 244, 244, 0.18);
    }

    .part-annotation-panel {
      position: absolute;
      min-width: 80px;
      max-width: min(240px, calc(100vw - 48px));
      opacity: 0;
      white-space: nowrap;
      text-align: right;
    }

    .part-annotation-name {
      display: inline-block;
      font-size: 15px;
      line-height: 15px;
      height: 15px;
      font-weight: 800;
      letter-spacing: 0;
      text-align: right;
    }

    .part-annotation-text {
      display: inline-block;
    }

    .part-annotation-caret {
      display: inline-block;
      width: 1.5px;
      height: 1em;
      margin-left: 2px;
      background: currentColor;
      vertical-align: -0.12em;
      opacity: 0;
    }

    .part-annotation-caret.is-blinking {
      animation: part-annotation-caret-blink 1s steps(1, end) infinite;
    }

    @keyframes part-annotation-caret-blink {
      0%,
      46% {
        opacity: 1;
      }

      47%,
      100% {
        opacity: 0;
      }
    }

    .part-annotation-underline {
      height: 4px;
      width: 0;
      margin-top: 3px;
      margin-bottom: 5px;
      margin-left: auto;
      background: currentColor;
      transform: scaleX(0);
    }

    .part-annotation-meta {
      font-size: 10px;
      line-height: 13px;
      height: 13px;
      font-weight: 400;
      letter-spacing: 0;
      opacity: 0;
      text-align: right;
    }
  `;

  document.head.appendChild(style);
}

function createAnnotationOverlay() {
  annotationRoot = document.createElement('div');
  annotationRoot.className = 'part-annotation-root';

  annotationSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  annotationSvg.classList.add('part-annotation-svg');

  annotationPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  annotationPath.setAttribute('fill', 'none');
  annotationPath.setAttribute('stroke', 'currentColor');
  annotationPath.setAttribute('stroke-width', `${ANNOTATION_LEADER_STROKE_WIDTH}`);
  annotationPath.setAttribute('stroke-linecap', 'square');
  annotationPath.setAttribute('stroke-linejoin', 'miter');

  annotationSvg.appendChild(annotationPath);

  annotationDot = document.createElement('div');
  annotationDot.className = 'part-annotation-dot';

  annotationPanel = document.createElement('div');
  annotationPanel.className = 'part-annotation-panel';

  annotationName = document.createElement('div');
  annotationName.className = 'part-annotation-name';

  annotationNameText = document.createElement('span');
  annotationNameText.className = 'part-annotation-text';

  annotationNameCaret = document.createElement('span');
  annotationNameCaret.className = 'part-annotation-caret';

  annotationUnderline = document.createElement('div');
  annotationUnderline.className = 'part-annotation-underline';

  annotationMaterial = document.createElement('div');
  annotationMaterial.className = 'part-annotation-meta';

  annotationMaterialText = document.createElement('span');
  annotationMaterialText.className = 'part-annotation-text';

  annotationMaterialCaret = document.createElement('span');
  annotationMaterialCaret.className = 'part-annotation-caret';

  annotationSize = document.createElement('div');
  annotationSize.className = 'part-annotation-meta';

  annotationSizeText = document.createElement('span');
  annotationSizeText.className = 'part-annotation-text';

  annotationSizeCaret = document.createElement('span');
  annotationSizeCaret.className = 'part-annotation-caret';

  annotationName.appendChild(annotationNameText);
  annotationName.appendChild(annotationNameCaret);
  annotationMaterial.appendChild(annotationMaterialText);
  annotationMaterial.appendChild(annotationMaterialCaret);
  annotationSize.appendChild(annotationSizeText);
  annotationSize.appendChild(annotationSizeCaret);

  annotationPanel.appendChild(annotationName);
  annotationPanel.appendChild(annotationUnderline);
  annotationPanel.appendChild(annotationMaterial);
  annotationPanel.appendChild(annotationSize);

  annotationRoot.appendChild(annotationSvg);
  annotationRoot.appendChild(annotationDot);
  annotationRoot.appendChild(annotationPanel);

  document.body.appendChild(annotationRoot);
}

function getAnnotationColor() {
  return darkMode ? '#f4f4f4' : '#050505';
}

function updateAnnotationTheme() {
  if (!annotationRoot) return;
  annotationRoot.style.color = getAnnotationColor();
}

function getSelectedWorldCenter(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  return box.getCenter(new THREE.Vector3());
}

function getMeshBoundingBoxScreenAnchor(mesh, side) {
  const box = new THREE.Box3().setFromObject(mesh);
  return box.getCenter(new THREE.Vector3());
}

function getAnnotationWorldAnchor() {
  if (!selected) return null;

  if (annotationAnchorLocal) {
    return selected.localToWorld(annotationAnchorLocal.clone());
  }

  return getSelectedWorldCenter(selected);
}

function worldToScreenPosition(worldPosition) {
  const projected = worldPosition.clone().project(camera);

  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    z: projected.z,
  };
}

function getMeshWorldSize(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());

  return {
    x: Math.round(size.x),
    y: Math.round(size.y),
    z: Math.round(size.z),
  };
}

function getMaterialLabel(mesh) {
  const part = getPartByMesh(mesh);

  if (!part) return 'Material';

  if (isLedPart(part)) return 'Cyan Emissive LED';
  if (isPolycarbonPart(part)) {
    return lightTarget === LIGHT_TARGET.DIFFUSER
      ? 'Cyan Emissive Polycarbon'
      : 'Milky Polycarbon';
  }
  if (isGlassPart(part)) return 'Transparent Glass';

  const mat = mesh.material;

  if (Array.isArray(mat)) {
    return mat[0]?.name || 'Material';
  }

  return mat?.name || mat?.type || 'Material';
}

function getAnnotationInfo(mesh) {
  const rawName = getObjectName(mesh, 'Unnamed part');
  const displayName = cleanDisplayName(rawName) || 'NAME';
  const material = getMaterialLabel(mesh);
  const size = getMeshWorldSize(mesh);

  return {
    name: displayName,
    material,
    sizeText: `${size.x}*${size.y}*${size.z}`,
  };
}

function getAnnotationPanelWidth() {
  return Math.ceil(
    Math.max(
      annotationPanelFixedWidth,
      annotationName.scrollWidth,
      annotationMaterial.scrollWidth,
      annotationSize.scrollWidth
    )
  );
}

function getAnnotationUnderlineWidth() {
  return Math.ceil(Math.max(1, annotationUnderlineFixedWidth));
}

function rectsOverlap(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

function getAnnotationLayout(dotX, dotY, preferredSide = null) {
  const margin = 24;
  const leaderGap = 210;
  const panelWidth = Math.min(getAnnotationPanelWidth(), window.innerWidth - margin * 2);
  const underlineWidth = Math.min(getAnnotationUnderlineWidth(), panelWidth);
  const panelHeight = Math.max(annotationPanel.offsetHeight, 40);
  const uiRect = document.querySelector('.ui')?.getBoundingClientRect();
  const underlineOffsetTop = ANNOTATION_NAME_LINE_HEIGHT + ANNOTATION_UNDERLINE_MARGIN_TOP;

  let side = preferredSide || (dotX < window.innerWidth * 0.55 ? 'right' : 'left');
  if (dotX + leaderGap + underlineWidth > window.innerWidth - margin) side = 'left';
  if (dotX - leaderGap - underlineWidth < margin) side = 'right';
  if (uiRect && side === 'left' && dotX < uiRect.right + panelWidth + leaderGap) {
    side = 'right';
  }

  const leaderEndX = side === 'right' ? dotX + leaderGap : dotX - leaderGap;
  let panelX =
    side === 'right'
      ? leaderEndX + underlineWidth - panelWidth
      : leaderEndX - underlineWidth;
  let underlineTop = dotY - Math.min(86, Math.max(54, window.innerHeight * 0.1));
  let panelY = underlineTop - underlineOffsetTop;

  panelX = THREE.MathUtils.clamp(panelX, margin, window.innerWidth - margin - panelWidth);
  panelY = THREE.MathUtils.clamp(
    panelY,
    margin,
    window.innerHeight - margin - panelHeight
  );
  underlineTop = panelY + underlineOffsetTop;

  if (uiRect) {
    const panelRect = {
      left: panelX,
      right: panelX + panelWidth,
      top: panelY,
      bottom: panelY + panelHeight,
    };

    if (rectsOverlap(panelRect, uiRect)) {
      const belowUi = uiRect.bottom + margin;
      const aboveUi = uiRect.top - margin - panelHeight;
      panelY =
        belowUi + panelHeight < window.innerHeight - margin
          ? belowUi
          : Math.max(margin, aboveUi);
      panelY = THREE.MathUtils.clamp(panelY, margin, window.innerHeight - margin - panelHeight);
      underlineTop = panelY + underlineOffsetTop;
    }
  }

  return { panelX, panelY, panelWidth, underlineTop, underlineWidth, side };
}

function setAnnotationAlignment(side) {
  annotationSide = side;
  const align = side === 'right' ? 'right' : 'left';

  annotationPanel.style.textAlign = align;
  annotationName.style.textAlign = align;
  annotationMaterial.style.textAlign = align;
  annotationSize.style.textAlign = align;
  annotationUnderline.style.marginLeft = side === 'right' ? 'auto' : '0';
  annotationUnderline.style.marginRight = side === 'right' ? '0' : 'auto';
  annotationUnderline.style.transformOrigin = side === 'right' ? 'left center' : 'right center';
}

function setAnnotationPath(
  dotX,
  dotY,
  panelX,
  panelY,
  panelWidth,
  underlineWidth,
  side,
  resetDash = false
) {
  const endX =
    side === 'right'
      ? panelX + panelWidth - underlineWidth
      : panelX + underlineWidth;
  const underlineTop = panelY + ANNOTATION_NAME_LINE_HEIGHT + ANNOTATION_UNDERLINE_MARGIN_TOP;
  const textLineY = underlineTop + ANNOTATION_LEADER_STROKE_WIDTH / 2;
  const elbowX = dotX + (side === 'right' ? 48 : -48);
  const elbowY = textLineY;

  const d = `M ${dotX} ${dotY} L ${elbowX} ${elbowY} L ${endX} ${textLineY}`;
  annotationPath.setAttribute('d', d);

  const length = annotationPath.getTotalLength();

  if (resetDash) {
    annotationPath.style.strokeDasharray = `${length}`;
    annotationPath.style.strokeDashoffset = `${length}`;
    annotationPathDrawn = false;
  } else if (annotationPathDrawn) {
    annotationPath.style.strokeDasharray = `${length}`;
    annotationPath.style.strokeDashoffset = `0`;
  }

  return length;
}

function updateAnnotationPosition() {
  if (!selected || !annotationRoot) return;

  const centerScreen = worldToScreenPosition(getSelectedWorldCenter(selected));
  const { side: preferredSide } = getAnnotationLayout(centerScreen.x, centerScreen.y, annotationSide);

  annotationAnchor = getMeshBoundingBoxScreenAnchor(selected, preferredSide);
  annotationAnchorLocal = selected.worldToLocal(annotationAnchor.clone());

  const screen = worldToScreenPosition(annotationAnchor);

  const dotX = screen.x;
  const dotY = screen.y;

  if (
    screen.z < -1 ||
    screen.z > 1 ||
    dotX < -80 ||
    dotX > window.innerWidth + 80 ||
    dotY < -80 ||
    dotY > window.innerHeight + 80
  ) {
    annotationRoot.style.visibility = 'hidden';
    return;
  }

  annotationRoot.style.visibility = 'visible';

  const { panelX, panelY, panelWidth, underlineWidth, side } =
    getAnnotationLayout(dotX, dotY, preferredSide);
  setAnnotationAlignment(side);

  annotationDot.style.left = `${dotX}px`;
  annotationDot.style.top = `${dotY}px`;

  annotationPanel.style.left = `${panelX}px`;
  annotationPanel.style.top = `${panelY}px`;
  annotationPanel.style.width = `${panelWidth}px`;
  annotationUnderline.style.width = `${underlineWidth}px`;

  setAnnotationPath(dotX, dotY, panelX, panelY, panelWidth, underlineWidth, side, false);
}

function syncAnnotationPanelWidth() {
  const width = getAnnotationPanelWidth();
  annotationPanel.style.width = `${width}px`;
  annotationUnderline.style.width = `${getAnnotationUnderlineWidth()}px`;
}

function setAnnotationLineText(line, text) {
  const target =
    line === annotationName
      ? annotationNameText
      : line === annotationMaterial
        ? annotationMaterialText
        : annotationSizeText;

  if (target) target.textContent = text;
}

function getAnnotationCaret(line) {
  if (line === annotationName) return annotationNameCaret;
  if (line === annotationMaterial) return annotationMaterialCaret;
  return annotationSizeCaret;
}

function typeAnnotationLine(timeline, line, value, animId, keepCaret = false) {
  const caret = getAnnotationCaret(line);
  const state = { count: 0 };
  const totalChars = value.length;

  timeline.call(() => {
    if (animId !== annotationAnimId) return;
    caret.classList.add('is-blinking');
  });
  timeline.to({}, { duration: 0.5 });
  timeline.to(state, {
    count: totalChars,
    duration: Math.max(0.56, totalChars * 0.056),
    ease: `steps(${Math.max(totalChars, 1)})`,
    onUpdate: () => {
      if (animId !== annotationAnimId) return;

      const count = Math.round(state.count);
      setAnnotationLineText(line, value.slice(0, count));
    },
    onComplete: () => {
      if (animId !== annotationAnimId) return;

      setAnnotationLineText(line, value);
      if (!keepCaret) {
        caret.classList.remove('is-blinking');
        gsap.set(caret, { opacity: 0 });
      }
    },
  });
}

function measureAnnotationPanel(info) {
  annotationNameText.textContent = info.name;
  annotationMaterialText.textContent = info.material;
  annotationSizeText.textContent = info.sizeText;
  annotationPanelFixedWidth = Math.ceil(
    Math.max(
      80,
      annotationName.scrollWidth,
      annotationMaterial.scrollWidth,
      annotationSize.scrollWidth
    )
  );
  annotationUnderlineFixedWidth = Math.ceil(Math.max(1, annotationNameText.scrollWidth));
  syncAnnotationPanelWidth();

  annotationNameText.textContent = '';
  annotationMaterialText.textContent = '';
  annotationSizeText.textContent = '';
}

function showAnnotationForMesh(mesh) {
  if (!annotationRoot) return;

  annotationAnimId += 1;
  const animId = annotationAnimId;

  if (annotationTypeTween) {
    annotationTypeTween.kill();
    annotationTypeTween = null;
  }

  const centerScreen = worldToScreenPosition(getSelectedWorldCenter(mesh));
  const { side } = getAnnotationLayout(centerScreen.x, centerScreen.y);
  setAnnotationAlignment(side);

  annotationAnchor = getMeshBoundingBoxScreenAnchor(mesh, side);
  annotationAnchorLocal = mesh.worldToLocal(annotationAnchor.clone());
  const info = getAnnotationInfo(mesh);

  annotationRoot.style.opacity = '1';
  updateAnnotationTheme();

  annotationNameText.textContent = '';
  annotationMaterialText.textContent = '';
  annotationSizeText.textContent = '';
  annotationUnderline.style.width = '0px';
  annotationPanelFixedWidth = 80;
  annotationUnderlineFixedWidth = 80;
  annotationPanel.style.width = '80px';
  measureAnnotationPanel(info);

  updateAnnotationPosition();

  gsap.killTweensOf([
    annotationRoot,
    annotationDot,
    annotationPanel,
    annotationPath,
    annotationMaterial,
    annotationSize,
    annotationUnderline,
    annotationNameCaret,
    annotationMaterialCaret,
    annotationSizeCaret,
  ]);

  gsap.set(annotationDot, { scale: 0, opacity: 0 });
  gsap.set(annotationPanel, { opacity: 0 });
  gsap.set([annotationMaterial, annotationSize], { opacity: 1, y: 0 });
  [annotationNameCaret, annotationMaterialCaret, annotationSizeCaret].forEach((caret) => {
    caret.classList.remove('is-blinking');
  });
  gsap.set([annotationNameCaret, annotationMaterialCaret, annotationSizeCaret], { opacity: 0 });
  gsap.set(annotationUnderline, { scaleX: 0 });

  const screen = worldToScreenPosition(annotationAnchor);
  const layout = getAnnotationLayout(screen.x, screen.y, annotationSide);
  setAnnotationAlignment(layout.side);
  const length = setAnnotationPath(
    screen.x,
    screen.y,
    layout.panelX,
    layout.panelY,
    layout.panelWidth,
    layout.underlineWidth,
    layout.side,
    true
  );

  gsap.set(annotationPath, {
    strokeDasharray: length,
    strokeDashoffset: length,
    opacity: 1,
  });

  const tl = gsap.timeline();

  tl.to(annotationDot, {
    scale: 1,
    opacity: 1,
    duration: 0.16,
    ease: 'power2.out',
  });

  tl.to(annotationPath, {
    strokeDashoffset: 0,
    duration: 0.36,
    ease: 'power2.out',
    onComplete: () => {
      annotationPathDrawn = true;
      annotationPath.style.strokeDashoffset = '0';
    },
  });

  tl.to(annotationPanel, {
    opacity: 1,
    duration: 0.06,
  });

  tl.to(annotationUnderline, {
    scaleX: 1,
    duration: 0.24,
    ease: 'power2.out',
  });

  typeAnnotationLine(tl, annotationName, info.name, animId, true);
  typeAnnotationLine(tl, annotationMaterial, info.material, animId);
  typeAnnotationLine(tl, annotationSize, info.sizeText, animId);

  annotationTypeTween = tl;
}

function hideAnnotation() {
  annotationAnimId += 1;
  annotationPathDrawn = false;

  if (annotationTypeTween) {
    annotationTypeTween.kill();
    annotationTypeTween = null;
  }

  annotationAnchor = null;
  annotationAnchorLocal = null;

  if (!annotationRoot) return;

  gsap.killTweensOf([
    annotationRoot,
    annotationDot,
    annotationPanel,
    annotationPath,
    annotationMaterial,
    annotationSize,
    annotationUnderline,
    annotationNameCaret,
    annotationMaterialCaret,
    annotationSizeCaret,
  ]);

  gsap.to(annotationRoot, {
    opacity: 0,
    duration: 0.12,
    ease: 'power1.out',
  });

  [annotationNameCaret, annotationMaterialCaret, annotationSizeCaret].forEach((caret) => {
    caret.classList.remove('is-blinking');
  });
  gsap.set([annotationNameCaret, annotationMaterialCaret, annotationSizeCaret], { opacity: 0 });
  annotationNameText.textContent = '';
  annotationMaterialText.textContent = '';
  annotationSizeText.textContent = '';
  annotationPanelFixedWidth = 80;
}

// ==========================
// Resize
// ==========================

window.addEventListener('resize', () => {
  perspectiveCamera.aspect = window.innerWidth / window.innerHeight;
  perspectiveCamera.updateProjectionMatrix();
  groundPerspectiveCamera.aspect = window.innerWidth / window.innerHeight;
  groundPerspectiveCamera.updateProjectionMatrix();
  updateOrthographicFrustum();
  syncGroundCamera();

  renderer.setSize(window.innerWidth, window.innerHeight);

  bloomComposer.setSize(window.innerWidth, window.innerHeight);
  finalComposer.setSize(window.innerWidth, window.innerHeight);
  gtaoPass.setSize(window.innerWidth, window.innerHeight);

  if (document.body.classList.contains('is-loading')) {
    updateLoadingCodeColumns();
  }

  updateAnnotationPosition();
});

// ==========================
// Animate
// ==========================

function animate() {
  requestAnimationFrame(animate);

  controls.update();
  updateVisualGroundCameraStyle();
  updateVisualGroundPosition();
  syncGroundCamera();
  updateAnnotationPosition();

  const originalBackground = scene.background;
  scene.background = new THREE.Color(0x000000);

  scene.traverse(darkenNonBloomed);
  bloomComposer.render();

  scene.traverse(restoreMaterial);
  scene.background = originalBackground;

  finalComposer.render();
}

animate();
