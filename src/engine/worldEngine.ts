import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BAKERY_COSTS,
  BAKING_RECIPES,
  CRAFT_RECIPES,
  formatTime24,
  getWeatherDemandMultiplier,
  HOUSE_BUILD_PIECES,
  INITIAL_INVENTORY,
  ITEM_CATALOG,
  PASTRY_IDS,
  TRAVELER_NAMES,
} from '../data/catalog';
import { soundEngine } from '../audio/soundEngine';
import {
  BakeryOrder,
  BakeryPastryId,
  BakeryShelfSlot,
  BakeryShopState,
  ClothingItemId,
  CraftedItemId,
  DecorationItemId,
  DeliveryOrder,
  GameHudSnapshot,
  HouseBuildPieceId,
  InteractionPrompt,
  InventoryMap,
  ItemId,
  MeteorologyState,
  NpcDialogueState,
  PersistedValleySave,
  PlacedStructure,
  SaleRecord,
  StructureType,
  SurvivalState,
  ToastMessage,
  ToolId,
  WeatherType,
} from '../types/game';
import {
  buildBakeryFrameModel,
  buildBakeryShelfModel,
  buildBakeryShopModel,
  buildBerryBush,
  buildDecorationModel,
  buildDeliveryParcelModel,
  buildFallenLog,
  buildHarvestablePine,
  buildOreBoulder,
  buildPastryMiniMesh,
  buildStructureModel,
  buildTravelerModel,
  buildVillageCottageModel,
  createMaterialLibrary,
  createViewmodel,
  MaterialLibrary,
} from './models';
import {
  distanceToRoad,
  GRID_SIZE,
  groundHeightAt,
  isInWater,
  LAKE_LEVEL,
  PLAYABLE_RADIUS,
  terrainNormalAt,
  trailCenterXAtZ,
  WALL_HEIGHT,
  WORLD_SIZE,
} from './terrain';
import { createProceduralTextures, createSignboardTexture } from './textures';

const SAVE_KEY = 'pinecrest_valley_save_v2';

function createDefaultBakeryShelves(): BakeryShelfSlot[] {
  return Array.from({ length: 8 }, (_, idx) => ({
    slotIndex: idx,
    shelfIndex: Math.floor(idx / 2),
    pastryId: null,
    stock: 0,
    price: 18,
  }));
}

// Pre-allocated scratch math objects (zero GC in animation loop)
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _colorC = new THREE.Color();

interface HarvestNode {
  id: string;
  kind: 'pine' | 'stone' | 'iron' | 'berry' | 'log';
  x: number;
  y: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  respawnTimer: number;
  mesh: THREE.Group;
  hitAnim: number;
}

interface StructureEntry {
  data: PlacedStructure;
  group: THREE.Group;
  spawnSpring: number;
  fireLight?: THREE.PointLight;
  doorAnim: number;
  stairCutoutRotY?: number;
}

interface TravelerAgent {
  id: string;
  name: string;
  role: string;
  mesh: THREE.Group;
  x: number;
  z: number;
  yaw: number;
  phase: 'entering' | 'warming' | 'browsing' | 'ordering' | 'talking' | 'leaving';
  preTalkPhase: 'entering' | 'warming' | 'browsing' | 'ordering' | 'leaving';
  waitTimer: number;
  walkCycle: number;
  targetX: number;
  targetZ: number;
  waypointIndex: number;
  boughtAlready: boolean;
  warmedAlready: boolean;
  wantedItemId: CraftedItemId | BakeryPastryId;
  offerPrice: number;
  fulfilled: boolean;
  helpedWarmth: boolean;
  greetWave: number;
  orderId?: string;
}

interface ParticleBurst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
  lifetime: number;
}

interface VillageCottage {
  id: string;
  x: number;
  z: number;
  rotY: number;
  isSupply: boolean;
  mesh: THREE.Group;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: GameHudSnapshot) => void;
  onToast: (toast: ToastMessage) => void;
  onOpenModal: (modal: 'storefront' | 'bakery' | 'supply' | 'controls') => void;
  onOpenNpcDialogue: (npc: NpcDialogueState | null) => void;
}

export class PinecrestWorldEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private mats!: MaterialLibrary;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fog!: THREE.FogExp2;
  private skyMat!: THREE.ShaderMaterial;
  private waterMat!: THREE.ShaderMaterial;
  private terrainMat!: THREE.MeshStandardMaterial;

  private rainPoints!: THREE.LineSegments;
  private snowPoints!: THREE.Points;
  private instancedForest!: THREE.InstancedMesh;
  private forestShaderUniforms: { time: { value: number }; wind: { value: number } } = {
    time: { value: 0 },
    wind: { value: 1 },
  };

  private viewmodel!: ReturnType<typeof createViewmodel>;
  private toolSwing = 0;

  private harvestNodes: HarvestNode[] = [];
  private structures: Map<string, StructureEntry> = new Map();
  private villageCottages: VillageCottage[] = [];
  private travelers: TravelerAgent[] = [];
  private bursts: ParticleBurst[] = [];

  private bakeryGroup: THREE.Group | null = null;
  private bakeryFireLight: THREE.PointLight | null = null;
  private bakeryGhostGroup: THREE.Group | null = null;
  private bakeryBuildMode = false;
  private bakeryGhostCanPlace = false;
  private bakeryGhostX = 7.2;
  private bakeryGhostZ = 7.8;
  private bakeryGhostRotY = -Math.PI / 2;

  private houseBuildMode = false;
  private houseWheelOpen = false;
  private houseBuildPiece: HouseBuildPieceId = 'foundation';
  private houseBuildFloorOverride: 'auto' | 0 | 1 | 2 = 'auto';
  private houseGhostGroup: THREE.Group | null = null;
  private houseGhostVisualKey = '';
  private houseGhostCanPlace = false;
  private houseGhostX = 0;
  private houseGhostY = 0;
  private houseGhostZ = 0;
  private houseGhostRotY = 0;
  private houseGhostFlip = 0;
  private houseBuildFailReason = '';
  private houseDemolishTargetId: string | null = null;
  private houseDemolishLabel: string | null = null;
  private houseMoveTargetKind: 'structure' | 'decor' | null = null;
  private houseMovingElement:
    | { kind: 'structure'; data: PlacedStructure }
    | { kind: 'decor'; decId: DecorationItemId; origPos: { x: number; y: number; z: number; ry: number } }
    | null = null;

  private decorationsOwned: DecorationItemId[] = [];
  private decorationsPlaced: DecorationItemId[] = [];
  private decorationPositions: Partial<Record<DecorationItemId, { x: number; y: number; z: number; ry: number }>> = {};
  private decorationMeshes: Map<DecorationItemId, THREE.Group> = new Map();
  private decorLights: THREE.PointLight[] = [];
  private pendingDeliveries: DeliveryOrder[] = [];
  private deliveryParcelMesh: THREE.Group | null = null;
  private deliveryUiTimer = 0;

  private bakeryOrders: BakeryOrder[] = [];
  private heldPastry: BakeryPastryId | null = null;
  private heldPastryVisualId: BakeryPastryId | null = null;
  private orderUiTimer = 0;

  // Player & Input state
  private started = false;
  private paused = false;
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private keys: Record<string, boolean> = {};
  private centerNdc = new THREE.Vector2(0, 0);
  private pointerNdc = new THREE.Vector2(0, 0);
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private dragPlaneHit = new THREE.Vector3();
  private dragHoldActive = false;
  private dragAutoExitOnDrop = false;
  private dragMovedEnough = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTime = 0;
  private pendingDrag: {
    kind: 'structure' | 'decor';
    id: string;
    startX: number;
    startY: number;
    timerId: number;
  } | null = null;
  private pendingBuildTap = false;

  private playerPos = new THREE.Vector3(0, 3.03, 1.4);
  private playerVelY = 0;
  private onGround = true;
  private playerYaw = -0.96;
  private playerPitch = -0.05;
  private headBobPhase = 0;
  private stepDistAccum = 0;

  private activeTool: ToolId = 'axe';
  private lanternLit = false;
  private torchLit = false;
  private hudCollapsed = false;
  private timeScale = 1;
  private rainSickWarned = false;

  private meteorology: MeteorologyState = {
    timeOfDay: 8.5,
    dayCount: 1,
    weather: 'Clear',
    nextWeather: 'Overcast',
    transitionProgress: 0,
    ambientTempC: 11,
    windSpeedMs: 3.2,
    humidity: 48,
    pressureHpa: 1018,
    precipitationIntensity: 0,
    snowAccumulation: 0.08,
    wetness: 0,
  };
  private weatherHoldTimer = 55;
  private lightningTimer = 6;
  private lightningFlash = 0;

  private survival: SurvivalState = {
    health: 100,
    warmth: 84,
    hunger: 88,
    stamina: 100,
    maxStamina: 100,
    sicknessLevel: 0,
    isSick: false,
    isSheltered: false,
    nearFire: false,
    isWet: false,
    wearingRaincoat: false,
    carryingUmbrella: false,
    parkaEquipped: false,
    packEquipped: false,
    wearingBakerApron: false,
    wearingRangerJacket: false,
    wearingSilkScarf: false,
    wearingWinterSweater: false,
  };

  private inventory: InventoryMap = { ...INITIAL_INVENTORY };

  private shopName = 'Pinecrest Bakery';
  private shopIsOpen = false;
  private gold = 160;
  private reputation = 4.2;
  private bakery: BakeryShopState = {
    stage: 'none',
    x: 7.2,
    z: 7.8,
    rotationY: -Math.PI / 2,
    shopName: 'Pinecrest Bakery',
    isOpen: false,
    shelvesOwned: 0,
    shelves: createDefaultBakeryShelves(),
  };
  private salesHistory: SaleRecord[] = [];
  private travelerSpawnTimer = 2.0;

  private currentPrompt: InteractionPrompt | null = null;
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private frameId = 0;
  private hudSyncTimer = 0;
  private autoSaveTimer = 0;
  private disposed = false;

  // Starter campfire light
  private campFireLight!: THREE.PointLight;
  private campFlameMesh!: THREE.Mesh;

  // Bound event listeners
  private onResizeBound: () => void;
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onMouseMoveBound: (e: MouseEvent) => void;
  private onMouseDownBound: (e: MouseEvent) => void;
  private onMouseUpBound: () => void;
  private onContextMenuBound: (e: MouseEvent) => void;
  private onPointerLockChangeBound: () => void;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.onResizeBound = this.handleResize.bind(this);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onMouseMoveBound = this.handleMouseMove.bind(this);
    this.onMouseDownBound = this.handleMouseDown.bind(this);
    this.onMouseUpBound = this.handleMouseUp.bind(this);
    this.onContextMenuBound = (e) => e.preventDefault();
    this.onPointerLockChangeBound = this.handlePointerLockChange.bind(this);

    this.initRendererAndScene();
    this.buildWorldEnvironment();
    this.buildStarterCampAndNodes();
    this.initWeatherParticles();
    this.bindEvents();
    this.syncCameraToPlayer(0);
    this.emitHud();
    this.tick();
  }

  public static hasSavedValley(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_KEY));
    } catch {
      return false;
    }
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.container.appendChild(canvas);

    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2('#8eb2cc', 0.0085);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      68,
      Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight),
      0.1,
      460,
    );
    this.scene.add(this.camera);

    // Mandatory studio environment reflection map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Lighting rig
    this.hemiLight = new THREE.HemisphereLight('#a8d0ee', '#4f4636', 0.65);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff0d6', 1.65);
    this.sunLight.position.set(45, 70, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 56;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 210;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);
    this.mats = createMaterialLibrary(textures, this.isSoftwareGl);
    this.terrainMat = new THREE.MeshStandardMaterial({
      map: textures.grassAlbedo,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.02,
    });

    // Inject dynamic snow accumulation & rain wetness shader uniforms
    this.terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uSnowAccum = { value: this.meteorology.snowAccumulation };
      shader.uniforms.uWetness = { value: this.meteorology.wetness };
      this.terrainMat.userData.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPos;
           varying vec3 vWorldNorm;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
           vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uSnowAccum;
           uniform float uWetness;
           varying vec3 vWorldPos;
           varying vec3 vWorldNorm;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float slope = clamp(vWorldNorm.y, 0.0, 1.0);
           float altSnow = smoothstep(10.0, 24.0, vWorldPos.y);
           float valleySnow = uSnowAccum * smoothstep(0.55, 0.88, slope) * smoothstep(-0.8, 0.4, vWorldPos.y);
           float snowMask = clamp(max(altSnow * smoothstep(0.42, 0.8, slope), valleySnow), 0.0, 1.0);
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.91, 0.94, 0.98), snowMask);
           diffuseColor.rgb *= mix(1.0, 0.68, uWetness * (1.0 - snowMask));`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
           roughnessFactor = mix(roughnessFactor, 0.24, uWetness * 0.7);`,
        );
    };

    // First-person viewmodel attached to camera
    this.viewmodel = createViewmodel(this.mats);
    this.viewmodel.root.visible = false;
    this.camera.add(this.viewmodel.root);
  }

  private buildWorldEnvironment(): void {
    // 1. Custom Atmospheric Sky Dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#2c669e') },
        uHorizonColor: { value: new THREE.Color('#a4c9e0') },
        uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.4).normalize() },
        uSunColor: { value: new THREE.Color('#fff2cf') },
        uCloudCover: { value: 0.2 },
        uNightFactor: { value: 0.0 },
        uTime: { value: 0.0 },
        uFlash: { value: 0.0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uCloudCover;
        uniform float uNightFactor;
        uniform float uTime;
        uniform float uFlash;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.58));

          // Sun disc & corona
          float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
          float sunGlow = pow(sunDot, 10.0) * 0.35 + pow(sunDot, 180.0) * 1.4;
          col += uSunColor * sunGlow * (1.0 - uCloudCover * 0.75) * (1.0 - uNightFactor);

          // Drifting alpine clouds
          if (dir.y > 0.02) {
            vec2 cloudUv = dir.xz / (dir.y + 0.18) * 1.35 + vec2(uTime * 0.012, uTime * 0.004);
            float c = noise(cloudUv) * 0.65 + noise(cloudUv * 2.4) * 0.35;
            float cloudMask = smoothstep(0.68 - uCloudCover * 0.45, 0.92 - uCloudCover * 0.25, c);
            vec3 cloudCol = mix(vec3(0.95, 0.96, 0.98), vec3(0.32, 0.36, 0.42), uCloudCover * 0.7);
            cloudCol *= mix(1.0, 0.015, uNightFactor);
            col = mix(col, cloudCol, cloudMask * smoothstep(0.02, 0.2, dir.y) * 0.78);
          }

          // Twinkling stars at night
          if (uNightFactor > 0.1 && dir.y > 0.06) {
            float starVal = hash(floor(dir.xz * 260.0 / (dir.y + 0.3)));
            if (starVal > 0.9915) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 3.0 + starVal * 90.0);
              col += vec3(0.88, 0.94, 1.0) * uNightFactor * (1.0 - uCloudCover * 0.88) * twinkle * 1.35;
            }
          }

          col += vec3(0.75, 0.85, 1.0) * uFlash;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), this.skyMat);
    this.scene.add(skyDome);

    // 2. Vertex-colored & Height-mapped Alpine Terrain
    const segs = 200;
    const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = groundHeightAt(x, z);
      posAttr.setY(i, y);

      const n = terrainNormalAt(x, z);
      const roadDist = distanceToRoad(x, z);

      if (y < LAKE_LEVEL + 0.35) {
        // Sandy pebble lakeshore
        _colorA.set('#8f846b');
      } else if (roadDist < 2.25 && y > LAKE_LEVEL + 0.3) {
        // Engineered compacted crushed-stone alpine roadbed
        _colorA.set('#877b6c');
        _colorB.set('#776c5e');
        _colorA.lerp(_colorB, (Math.sin(x * 1.4) * Math.cos(z * 1.4) + 1) * 0.5);
      } else if (roadDist < 3.1 && y > LAKE_LEVEL + 0.3) {
        // Graded roadside gravel shoulder / curb
        _colorA.set('#5e5447');
      } else if (n.y < 0.78 || y > 13.5) {
        // Exposed granite cliff rock
        _colorA.set('#6b727a');
      } else {
        // Rich pine meadow turf
        _colorA.set('#46633b');
        _colorB.set('#5a7545');
        _colorA.lerp(_colorB, (Math.sin(x * 0.14) * Math.cos(z * 0.14) + 1) * 0.5);
      }

      colors[i * 3] = _colorA.r;
      colors[i * 3 + 1] = _colorA.g;
      colors[i * 3 + 2] = _colorA.b;
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.name = 'terrain';
    this.scene.add(terrainMesh);

    // 3. Reflective Animated Alpine Lake Shader
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uSkyColor: { value: new THREE.Color('#7da8ca') },
        uDeepColor: { value: new THREE.Color('#173b4e') },
        uSunDir: { value: new THREE.Vector3(0.4, 0.7, 0.4).normalize() },
        uWind: { value: 1.0 },
        uNightFactor: { value: 0.0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uWind;
        varying vec3 vWorldPos;
        void main() {
          vec3 pos = position;
          float wave = sin(pos.x * 0.45 + uTime * 1.4) * cos(pos.z * 0.42 + uTime * 1.1) * (0.04 + uWind * 0.012);
          pos.y += wave;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSkyColor;
        uniform vec3 uDeepColor;
        uniform vec3 uSunDir;
        uniform float uNightFactor;
        varying vec3 vWorldPos;
        void main() {
          vec2 p = vWorldPos.xz;
          float r1 = sin(p.x * 1.7 + uTime * 1.8) * cos(p.y * 1.5 - uTime * 1.4);
          float r2 = sin(p.x * 3.1 - uTime * 2.2) * cos(p.y * 2.9 + uTime * 1.7);
          vec3 norm = normalize(vec3((r1 + r2) * 0.05, 1.0, (r1 - r2) * 0.05));
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, norm)), 3.2);
          vec3 refl = reflect(-viewDir, norm);
          float spec = pow(max(0.0, dot(refl, normalize(uSunDir))), 72.0);
          vec3 col = mix(uDeepColor, uSkyColor, clamp(fresnel * 0.85 + 0.15, 0.0, 1.0));
          col += vec3(1.0, 0.94, 0.82) * spec * 0.75 * (1.0 - uNightFactor * 0.9);
          gl_FragColor = vec4(col, 0.88);
        }
      `,
    });
    const lakeMesh = new THREE.Mesh(new THREE.CircleGeometry(40, 48), this.waterMat);
    lakeMesh.rotation.x = -Math.PI / 2;
    lakeMesh.position.set(-30, LAKE_LEVEL, 24);
    this.scene.add(lakeMesh);

    // 4. Instanced Scenic Alpine Forest (240 outer/valley pines with wind-sway shader)
    const pineTrunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 4.4, 7);
    pineTrunkGeo.translate(0, 2.2, 0);
    const pineTopGeo = new THREE.ConeGeometry(1.7, 5.2, 7);
    pineTopGeo.translate(0, 4.8, 0);

    const trunkInst = new THREE.InstancedMesh(pineTrunkGeo, this.mats.bark, 240);
    const foliageMat = this.mats.pineFoliage.clone();
    foliageMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.forestShaderUniforms.time;
      shader.uniforms.uWind = this.forestShaderUniforms.wind;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uWind;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float hFactor = max(0.0, (position.y - 2.2) / 5.0);
           transformed.x += sin(uTime * 1.6 + float(gl_InstanceID) * 0.9) * hFactor * uWind * 0.12;
           transformed.z += cos(uTime * 1.3 + float(gl_InstanceID) * 1.4) * hFactor * uWind * 0.09;`,
        );
    };
    this.instancedForest = new THREE.InstancedMesh(pineTopGeo, foliageMat, 240);
    trunkInst.castShadow = !this.isSoftwareGl;
    this.instancedForest.castShadow = !this.isSoftwareGl;
    this.instancedForest.receiveShadow = true;

    let placed = 0;
    let attempts = 0;
    while (placed < 240 && attempts < 2000) {
      attempts++;
      const angle = (attempts * 2.39996) % (Math.PI * 2);
      const rad = 22 + Math.sqrt(attempts / 2000) * 84;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      const y = groundHeightAt(x, z);

      if (y < LAKE_LEVEL + 0.8 || y > 18) continue;
      if (distanceToRoad(x, z) < 4.5) continue;
      if (Math.hypot(x - 2, z - 2) < 18) continue; // Keep starter house & clearing open

      const s = 0.82 + ((attempts * 17) % 100) / 180;
      _euler.set(0, angle, 0);
      _quat.setFromEuler(_euler);
      _vec3.set(x, y - 0.1, z);
      _vec3B.set(s, s, s);
      _mat4.compose(_vec3, _quat, _vec3B);

      trunkInst.setMatrixAt(placed, _mat4);
      this.instancedForest.setMatrixAt(placed, _mat4);
      _colorA.setHSL(0.36 + ((attempts % 7) - 3) * 0.008, 0.34, 0.22 + (attempts % 5) * 0.02);
      this.instancedForest.setColorAt(placed, _colorA);
      placed++;
    }
    trunkInst.count = placed;
    this.instancedForest.count = placed;
    trunkInst.instanceMatrix.needsUpdate = true;
    this.instancedForest.instanceMatrix.needsUpdate = true;
    if (this.instancedForest.instanceColor) this.instancedForest.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    this.instancedForest.computeBoundingSphere();

    this.scene.add(trunkInst, this.instancedForest);
  }

  private buildStarterCampAndNodes(): void {
    // Starter Trailside Campfire Stone Ring beside the driveway & Main Road
    const campGroup = new THREE.Group();
    const campX = 6.5;
    const campZ = -5.8;
    const campY = groundHeightAt(campX, campZ);
    campGroup.position.set(campX, campY, campZ);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), this.mats.stone);
      stone.position.set(Math.cos(a) * 0.56, 0.12, Math.sin(a) * 0.56);
      stone.scale.set(1.2, 0.7, 1.0);
      campGroup.add(stone);
    }
    const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.85, 7), this.mats.bark);
    logA.rotation.z = Math.PI / 2;
    logA.rotation.y = 0.4;
    logA.position.y = 0.1;
    const logB = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.85, 7), this.mats.bark);
    logB.rotation.z = Math.PI / 2;
    logB.rotation.y = -0.6;
    logB.position.y = 0.14;

    this.campFlameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 7),
      new THREE.MeshBasicMaterial({ color: '#ffab36' }),
    );
    this.campFlameMesh.position.y = 0.34;

    this.campFireLight = new THREE.PointLight('#ff9636', 3.4, 16, 1.7);
    this.campFireLight.position.set(0, 0.75, 0);
    campGroup.add(logA, logB, this.campFlameMesh, this.campFireLight);
    this.scene.add(campGroup);

    // Roadside Timber Lantern Posts along the Valley Road & Crossroads
    const lanternSpots: Array<{ x: number; z: number; yaw: number; addLight: boolean }> = [
      { x: 7.4, z: -2.0, yaw: Math.PI * 0.5, addLight: true },
      { x: 12.9, z: 9.8, yaw: -Math.PI * 0.5, addLight: true },
      { x: 12.8, z: -18.0, yaw: -Math.PI * 0.5, addLight: false },
      { x: -4.2, z: 13.8, yaw: -0.25, addLight: false },
      { x: 26.0, z: 8.2, yaw: 0.22, addLight: false },
    ];
    lanternSpots.forEach((spot) => {
      const py = groundHeightAt(spot.x, spot.z);
      const postGrp = new THREE.Group();
      postGrp.position.set(spot.x, py, spot.z);
      postGrp.rotation.y = spot.yaw;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.1, 7), this.mats.woodDark);
      pole.position.y = 1.55;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.75), this.mats.woodDark);
      arm.position.set(0, 2.95, 0.32);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.48), this.mats.woodDark);
      brace.position.set(0, 2.75, 0.18);
      brace.rotation.x = -Math.PI / 4;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.14, 8), this.mats.iron);
      cap.position.set(0, 2.74, 0.62);
      const globe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8),
        new THREE.MeshStandardMaterial({
          color: '#ffd88f',
          emissive: '#ffaa3b',
          emissiveIntensity: 1.5,
          roughness: 0.25,
        }),
      );
      globe.position.set(0, 2.58, 0.62);
      postGrp.add(pole, arm, brace, cap, globe);

      if (spot.addLight) {
        const pt = new THREE.PointLight('#ffae4a', 1.8, 12, 1.8);
        pt.position.set(0, 2.55, 0.62);
        postGrp.add(pt);
      }
      this.scene.add(postGrp);
    });

    // Build player's cozy starter small cabin & Outfitter counter + place player inside
    this.buildStarterHouse();
    this.buildNearbySmallHouses();

    // Interactive harvestable nodes around the valley clearing & lakeshore
    const nodeSpecs: Array<{
      kind: HarvestNode['kind'];
      x: number;
      z: number;
    }> = [];

    for (let i = 0; i < 48; i++) {
      const angle = i * 2.39996;
      const r = 11 + (i % 10) * 5.2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (isInWater(x, z)) continue;
      if (distanceToRoad(x, z) < 4.0) continue;
      if (Math.hypot(x - 6.5, z + 5.8) < 4.2) continue;
      if (x > -5.5 && x < 9.5 && z > -5.5 && z < 9.5) continue; // Keep starter house & porch clear
      if (this.villageCottages.some((c) => Math.hypot(x - c.x, z - c.z) < 5.5)) continue;

      const mod = i % 7;
      const kind: HarvestNode['kind'] =
        mod === 0 || mod === 3
          ? 'pine'
          : mod === 1
            ? 'iron'
            : mod === 2 || mod === 5
              ? 'berry'
              : mod === 4
                ? 'stone'
                : 'log';
      nodeSpecs.push({ kind, x, z });
    }

    nodeSpecs.forEach((spec, idx) => {
      const y = groundHeightAt(spec.x, spec.z);
      if (y < LAKE_LEVEL + 0.15) return;

      let mesh: THREE.Group;
      let maxHp = 3;
      let radius = 0.7;

      if (spec.kind === 'pine') {
        mesh = buildHarvestablePine(this.mats, 0.9 + (idx % 3) * 0.14);
        maxHp = 4;
        radius = 0.6;
      } else if (spec.kind === 'iron') {
        mesh = buildOreBoulder(this.mats, true);
        maxHp = 4;
        radius = 1.05;
      } else if (spec.kind === 'stone') {
        mesh = buildOreBoulder(this.mats, false);
        maxHp = 3;
        radius = 1.0;
      } else if (spec.kind === 'berry') {
        mesh = buildBerryBush(this.mats);
        maxHp = 1;
        radius = 0.65;
      } else {
        mesh = buildFallenLog(this.mats);
        maxHp = 2;
        radius = 0.75;
      }

      mesh.position.set(spec.x, y - 0.05, spec.z);
      mesh.rotation.y = (idx * 1.7) % (Math.PI * 2);
      mesh.userData.harvestId = `node_${idx}`;
      this.scene.add(mesh);

      this.harvestNodes.push({
        id: `node_${idx}`,
        kind: spec.kind,
        x: spec.x,
        y,
        z: spec.z,
        radius,
        hp: maxHp,
        maxHp,
        respawnTimer: 0,
        mesh,
        hitAnim: 0,
      });
    });
  }

  private initWeatherParticles(): void {
    // 1. Rain streaks (1200 line segments around player)
    const rainCount = 1200;
    const rainPositions = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * 44;
      const ry = Math.random() * 24;
      const rz = (Math.random() - 0.5) * 44;
      rainPositions[i * 6] = rx;
      rainPositions[i * 6 + 1] = ry;
      rainPositions[i * 6 + 2] = rz;
      rainPositions[i * 6 + 3] = rx - 0.14;
      rainPositions[i * 6 + 4] = ry - 0.85;
      rainPositions[i * 6 + 5] = rz;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: '#bed7ec',
      transparent: true,
      opacity: 0.45,
    });
    this.rainPoints = new THREE.LineSegments(rainGeo, rainMat);
    this.rainPoints.frustumCulled = false;
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // 2. Swirling snowflakes (1400 points)
    const snowCount = 1400;
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 46;
      snowPositions[i * 3 + 1] = Math.random() * 24;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

    const flakeCanvas = document.createElement('canvas');
    flakeCanvas.width = 32;
    flakeCanvas.height = 32;
    const fCtx = flakeCanvas.getContext('2d')!;
    const grad = fCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    fCtx.fillStyle = grad;
    fCtx.fillRect(0, 0, 32, 32);
    const flakeTex = new THREE.CanvasTexture(flakeCanvas);

    const snowMat = new THREE.PointsMaterial({
      map: flakeTex,
      size: 0.24,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.snowPoints = new THREE.Points(snowGeo, snowMat);
    this.snowPoints.frustumCulled = false;
    this.snowPoints.visible = false;
    this.scene.add(this.snowPoints);
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    document.addEventListener('pointerlockchange', this.onPointerLockChangeBound);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousemove', this.onMouseMoveBound);
    dom.addEventListener('mousedown', this.onMouseDownBound);
    window.addEventListener('mouseup', this.onMouseUpBound);
    dom.addEventListener('contextmenu', this.onContextMenuBound);
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.started) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    this.keys[e.code] = true;

    if (e.code === 'KeyE' && !this.paused) {
      e.preventDefault();
      if (this.bakeryBuildMode) {
        this.confirmBakeryGhostPlacement();
      } else if (this.houseBuildMode) {
        if (this.houseWheelOpen) {
          this.toggleHouseWheel(false);
        } else {
          this.confirmHouseBuildAction();
        }
      } else {
        this.triggerPrimaryInteract();
      }
    } else if (e.code === 'KeyV' && !this.paused) {
      e.preventDefault();
      this.toggleHouseBuildMode();
    } else if (e.code === 'KeyM' && !this.paused) {
      e.preventDefault();
      this.toggleHouseBuildMode('move');
    } else if (e.code === 'KeyQ' && !this.paused && this.houseBuildMode) {
      e.preventDefault();
      this.toggleHouseWheel();
    } else if (e.code === 'Escape' && !this.paused && this.houseBuildMode) {
      if (this.houseWheelOpen) {
        e.preventDefault();
        this.toggleHouseWheel(false);
      } else if (this.houseMovingElement) {
        e.preventDefault();
        this.cancelMovingHouseElement();
      }
    } else if (e.code === 'KeyZ' && !this.paused && this.houseBuildMode) {
      e.preventDefault();
      this.cycleHouseFloorOverride();
    } else if (e.code === 'KeyB' && !this.paused) {
      e.preventDefault();
      if (this.bakery.stage === 'none') {
        this.toggleBakeryBuildMode();
      } else {
        if (document.pointerLockElement) document.exitPointerLock();
        this.callbacks.onOpenModal('bakery');
      }
    } else if (e.code === 'KeyR' && !this.paused && (this.bakeryBuildMode || this.houseBuildMode)) {
      e.preventDefault();
      if (this.bakeryBuildMode) {
        this.bakeryGhostRotY += Math.PI / 2;
        soundEngine.playUiTone(520);
      } else if (this.houseBuildMode) {
        this.rotateHouseGhost();
      }
    } else if (e.code === 'KeyF' && !this.paused) {
      e.preventDefault();
      this.toggleLantern();
    } else if (e.code === 'KeyT' && !this.paused) {
      e.preventDefault();
      this.toggleTorch();
    } else if (e.code === 'KeyC' && !this.paused) {
      e.preventDefault();
      this.toggleRaincoat();
    } else if (e.code === 'KeyU' && !this.paused) {
      e.preventDefault();
      this.toggleUmbrella();
    } else if (e.code === 'KeyH') {
      e.preventDefault();
      this.hudCollapsed = !this.hudCollapsed;
      this.emitHud();
    } else if (e.code === 'Tab') {
      e.preventDefault();
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.callbacks.onOpenModal('storefront');
    } else if (this.houseBuildMode && !this.paused && /^Digit[0-9]$/.test(e.code)) {
      const keyChar = e.code.replace('Digit', '');
      const piece = HOUSE_BUILD_PIECES.find((p) => p.hotkey === keyChar);
      if (piece) {
        e.preventDefault();
        this.selectHouseBuildPiece(piece.id);
      }
    } else if (e.code === 'Digit1') {
      this.selectTool('hands');
    } else if (e.code === 'Digit2') {
      this.selectTool('axe');
    } else if (e.code === 'Digit3') {
      this.selectTool('pickaxe');
    } else if (e.code === 'Digit4') {
      this.consumeItem('berries');
    } else if (e.code === 'Digit5') {
      this.consumeItem('trail_rations');
    } else if (e.code === 'Digit6') {
      this.consumeItem('hot_cider');
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private getAimNdc(): THREE.Vector2 {
    return this.pointerLocked ? this.centerNdc : this.pointerNdc;
  }

  private clearPendingDrag(): void {
    if (this.pendingDrag) {
      window.clearTimeout(this.pendingDrag.timerId);
      this.pendingDrag = null;
    }
  }

  private updatePointerNdc(e: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointerNdc.set(
      THREE.MathUtils.clamp(nx, -1, 1),
      THREE.MathUtils.clamp(ny, -1, 1),
    );
  }

  private findMovableElementUnderRay(
    ndc: THREE.Vector2,
    includeAllStructures: boolean,
    maxDist = 10.0,
  ): { kind: 'structure' | 'decor'; id: string; distance: number } | null {
    this.raycaster.setFromCamera(ndc, this.camera);

    const candidates: THREE.Object3D[] = [];
    for (const s of this.structures.values()) {
      const t = s.data.type;
      if (includeAllStructures || t === 'workbench' || t === 'hearth' || t === 'bedroll') {
        candidates.push(s.group);
      }
    }
    for (const m of this.decorationMeshes.values()) {
      if (m.visible) candidates.push(m);
    }

    const hits = this.raycaster.intersectObjects(candidates, true);
    if (hits.length > 0 && hits[0].distance <= maxDist) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.structureId && !obj.userData.decorId) {
        obj = obj.parent;
      }
      const stId = obj?.userData.structureId as string | undefined;
      if (stId && this.structures.has(stId)) {
        return { kind: 'structure', id: stId, distance: hits[0].distance };
      }
      const decId = obj?.userData.decorId as DecorationItemId | undefined;
      if (decId && this.decorationMeshes.has(decId)) {
        return { kind: 'decor', id: decId, distance: hits[0].distance };
      }
    }

    // Forgiving Box3 fallback for slim lamps/candelabra/wall sconces
    let bestBoxHit: { kind: 'structure' | 'decor'; id: string; distance: number } | null = null;
    const tempBox = new THREE.Box3();
    const hitVec = new THREE.Vector3();
    for (const [decId, mesh] of this.decorationMeshes.entries()) {
      if (!mesh.visible) continue;
      tempBox.setFromObject(mesh).expandByScalar(0.16);
      if (this.raycaster.ray.intersectBox(tempBox, hitVec)) {
        const d = this.raycaster.ray.origin.distanceTo(hitVec);
        if (d <= maxDist && (!bestBoxHit || d < bestBoxHit.distance)) {
          bestBoxHit = { kind: 'decor', id: decId, distance: d };
        }
      }
    }
    if (bestBoxHit) return bestBoxHit;

    // Also forgiving Box3 fallback for Player Kitchen / hearth / bedroll
    for (const s of this.structures.values()) {
      const t = s.data.type;
      if (t !== 'workbench' && t !== 'hearth' && t !== 'bedroll') continue;
      tempBox.setFromObject(s.group).expandByScalar(0.12);
      if (this.raycaster.ray.intersectBox(tempBox, hitVec)) {
        const d = this.raycaster.ray.origin.distanceTo(hitVec);
        if (d <= maxDist && (!bestBoxHit || d < bestBoxHit.distance)) {
          bestBoxHit = { kind: 'structure', id: s.data.id, distance: d };
        }
      }
    }

    return bestBoxHit;
  }

  private getCursorFloorPoint(targetY: number, maxDist = 13): { x: number; z: number } {
    this.raycaster.setFromCamera(this.getAimNdc(), this.camera);
    this.dragPlane.set(new THREE.Vector3(0, 1, 0), -targetY);
    const hit = this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneHit);
    if (hit) {
      const dist = Math.hypot(hit.x - this.playerPos.x, hit.z - this.playerPos.z);
      if (dist <= maxDist) {
        return { x: hit.x, z: hit.z };
      }
      if (dist > 0.01) {
        const scale = maxDist / dist;
        return {
          x: this.playerPos.x + (hit.x - this.playerPos.x) * scale,
          z: this.playerPos.z + (hit.z - this.playerPos.z) * scale,
        };
      }
    }
    const rx = this.raycaster.ray.direction.x;
    const rz = this.raycaster.ray.direction.z;
    const hLen = Math.hypot(rx, rz);
    if (hLen > 0.01) {
      return {
        x: this.playerPos.x + (rx / hLen) * 4.2,
        z: this.playerPos.z + (rz / hLen) * 4.2,
      };
    }
    const dirX = -Math.sin(this.playerYaw);
    const dirZ = -Math.cos(this.playerYaw);
    return {
      x: this.playerPos.x + dirX * 4.2,
      z: this.playerPos.z + dirZ * 4.2,
    };
  }

  private beginClickHoldDrag(
    kind: 'structure' | 'decor',
    id: string,
    autoExitOnDrop: boolean,
  ): boolean {
    this.clearPendingDrag();
    if (this.houseMovingElement) {
      this.cancelMovingHouseElement(true);
    }

    if (kind === 'structure') {
      const entry = this.structures.get(id);
      if (!entry) return false;
      this.houseBuildMode = true;
      this.houseBuildPiece = 'move';
      this.houseWheelOpen = false;
      this.dragHoldActive = true;
      this.dragAutoExitOnDrop = autoExitOnDrop;
      this.dragStartTime = performance.now();

      this.houseMovingElement = { kind: 'structure', data: { ...entry.data } };
      this.houseGhostRotY = entry.data.rotationY;
      this.houseGhostFlip = Math.abs(Math.round(entry.data.rotationY / Math.PI)) % 2;
      this.scene.remove(entry.group);
      this.structures.delete(entry.data.id);
      if (entry.data.type === 'stairs' || entry.data.type === 'upper_floor') {
        this.syncUpperFloorStairCutouts();
      }
      const label = this.getMovingElementLabel() || 'Element';
      soundEngine.playUiTone(680);
      this.emitToast(`Moving ${label} — drag to spot & release mouse to drop · [R] Rotate`, 'info');
      this.houseGhostVisualKey = '';
      this.syncHouseGhost();
      this.emitHud();
      return true;
    }

    const decId = id as DecorationItemId;
    const mesh = this.decorationMeshes.get(decId);
    if (!mesh) return false;
    this.houseBuildMode = true;
    this.houseBuildPiece = 'move';
    this.houseWheelOpen = false;
    this.dragHoldActive = true;
    this.dragAutoExitOnDrop = autoExitOnDrop;
    this.dragStartTime = performance.now();

    const origPos = {
      x: Number(mesh.position.x.toFixed(2)),
      y: Number(mesh.position.y.toFixed(2)),
      z: Number(mesh.position.z.toFixed(2)),
      ry: mesh.rotation.y,
    };
    this.houseMovingElement = { kind: 'decor', decId, origPos };
    this.houseGhostRotY = origPos.ry;
    mesh.visible = false;
    soundEngine.playUiTone(680);
    this.emitToast(
      `Moving ${ITEM_CATALOG[decId].name} — drag to spot & release mouse to drop · [R] Rotate`,
      'info',
    );
    this.houseGhostVisualKey = '';
    this.syncHouseGhost();
    this.emitHud();
    return true;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.started || this.paused || this.houseWheelOpen) return;

    if (!this.pointerLocked) {
      this.updatePointerNdc(e);
    }

    if (this.pendingDrag) {
      const moved = this.pointerLocked
        ? Math.hypot(e.movementX, e.movementY) >= 5
        : Math.hypot(e.clientX - this.pendingDrag.startX, e.clientY - this.pendingDrag.startY) >= 5;
      if (moved) {
        this.dragMovedEnough = true;
        this.dragStartX = this.pendingDrag.startX;
        this.dragStartY = this.pendingDrag.startY;
        this.beginClickHoldDrag(this.pendingDrag.kind, this.pendingDrag.id, true);
        return;
      }
    }

    if (this.dragHoldActive) {
      if (this.pointerLocked) {
        this.dragMovedEnough = true;
        this.playerYaw -= e.movementX * 0.0022;
        this.playerPitch = THREE.MathUtils.clamp(
          this.playerPitch - e.movementY * 0.0022,
          -1.38,
          1.38,
        );
      } else {
        if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) >= 5) {
          this.dragMovedEnough = true;
        }
      }
      this.syncHouseGhost();
      return;
    }

    if (this.pendingBuildTap && !this.pointerLocked) {
      if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) >= 5) {
        this.dragMovedEnough = true;
      }
    }

    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * 0.0022;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - e.movementY * 0.0022,
        -1.38,
        1.38,
      );
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * 0.0042;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - dy * 0.0042,
        -1.38,
        1.38,
      );
    } else if (this.houseBuildMode) {
      this.syncHouseGhost();
    }
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.started || this.paused || this.houseWheelOpen) return;
    soundEngine.init();

    if (!this.pointerLocked) {
      this.updatePointerNdc(e);
    }

    if (e.button === 0) {
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartTime = performance.now();
      this.dragMovedEnough = false;
      this.pendingBuildTap = false;

      // 1. Move Mode (M / Wheel -> Move): Click & Hold grabs ANY house element immediately
      if (this.houseBuildMode && this.houseBuildPiece === 'move') {
        if (!this.houseMovingElement) {
          const hit = this.findMovableElementUnderRay(this.getAimNdc(), true, 10.0);
          if (hit) {
            this.beginClickHoldDrag(hit.kind, hit.id, false);
            return;
          }
          // Clicked empty space in Move Mode: allow drag-look without stealing cursor
          if (!this.pointerLocked) {
            this.isDraggingLook = true;
          }
          return;
        }
        // Already carrying an element (via quick click): place it now
        this.confirmHouseBuildAction();
        return;
      }

      // 2. Normal Mode: Click & Hold on Player Kitchen, Hearth, Bedroll, or any Tab Lamp/Decor grabs it directly
      if (!this.houseBuildMode && !this.bakeryBuildMode) {
        const movable = this.findMovableElementUnderRay(this.getAimNdc(), false, 8.5);
        if (movable) {
          this.clearPendingDrag();
          const timerId = window.setTimeout(() => {
            if (!this.pendingDrag) return;
            this.beginClickHoldDrag(movable.kind, movable.id, true);
          }, 150);
          this.pendingDrag = {
            kind: movable.kind,
            id: movable.id,
            startX: e.clientX,
            startY: e.clientY,
            timerId,
          };
          return;
        }
      }

      // 3. House Builder / Bakery placement or camera look
      this.isDraggingLook = true;
      if (!this.pointerLocked) {
        if (this.houseBuildMode || this.bakeryBuildMode) {
          this.pendingBuildTap = true;
        } else if (this.renderer.domElement.requestPointerLock) {
          try {
            const maybePromise = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
            if (maybePromise && typeof maybePromise.catch === 'function') {
              maybePromise.catch(() => {
                // Click-drag fallback remains active
              });
            }
          } catch {
            // Click-drag fallback remains active
          }
        }
      } else {
        if (this.bakeryBuildMode) {
          this.confirmBakeryGhostPlacement();
        } else if (this.houseBuildMode) {
          this.confirmHouseBuildAction();
        } else {
          this.triggerPrimaryInteract();
        }
      }
    } else if (e.button === 2) {
      this.clearPendingDrag();
      if (this.dragHoldActive) {
        const autoExit = this.dragAutoExitOnDrop;
        this.dragHoldActive = false;
        this.dragAutoExitOnDrop = false;
        this.cancelMovingHouseElement();
        if (autoExit) {
          this.houseBuildMode = false;
          this.houseWheelOpen = false;
          this.syncHouseGhost();
          this.emitHud();
        }
        return;
      }
      if (this.bakeryBuildMode) {
        this.bakeryBuildMode = false;
        this.syncBakeryGhost();
        this.emitHud();
        return;
      }
      if (this.houseBuildMode) {
        if (this.houseMovingElement) {
          this.cancelMovingHouseElement();
          return;
        }
        this.houseBuildMode = false;
        this.houseWheelOpen = false;
        this.syncHouseGhost();
        this.emitHud();
        return;
      }
      this.isDraggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  }

  private handleMouseUp(): void {
    this.isDraggingLook = false;

    if (this.pendingDrag) {
      this.clearPendingDrag();
      if (this.pointerLocked && !this.houseBuildMode && !this.bakeryBuildMode) {
        this.triggerPrimaryInteract();
      }
      return;
    }

    if (this.dragHoldActive) {
      const wasHold =
        this.dragMovedEnough || performance.now() - this.dragStartTime >= 130;
      const autoExit = this.dragAutoExitOnDrop;
      this.dragHoldActive = false;
      if (wasHold || autoExit) {
        const placed = this.confirmHouseBuildAction();
        if (!placed) {
          this.cancelMovingHouseElement();
        }
        if (autoExit) {
          this.dragAutoExitOnDrop = false;
          this.houseBuildMode = false;
          this.houseWheelOpen = false;
          this.syncHouseGhost();
          this.emitHud();
        }
      }
      return;
    }

    if (this.pendingBuildTap) {
      this.pendingBuildTap = false;
      const isQuickTap =
        !this.dragMovedEnough && performance.now() - this.dragStartTime < 220;
      if (isQuickTap && !this.pointerLocked) {
        if (this.bakeryBuildMode) {
          this.confirmBakeryGhostPlacement();
        } else if (this.houseBuildMode && this.houseBuildPiece !== 'move') {
          this.confirmHouseBuildAction();
        }
      }
    }
  }

  // =========================================================================
  // Public Control API for React HUD
  // =========================================================================

  public startGame(loadSaved: boolean): void {
    soundEngine.init();
    if (loadSaved) {
      this.loadFromStorage();
    }
    this.started = true;
    this.viewmodel.root.visible = true;
    this.syncCameraToPlayer(0);
    this.emitHud();
  }

  public resetValley(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
    this.structures.forEach((entry) => this.scene.remove(entry.group));
    this.structures.clear();
    this.travelers.forEach((t) => this.scene.remove(t.mesh));
    this.travelers = [];
    if (this.bakeryGroup) {
      this.scene.remove(this.bakeryGroup);
      this.bakeryGroup = null;
      this.bakeryFireLight = null;
    }
    this.bakeryBuildMode = false;
    this.syncBakeryGhost();
    this.houseBuildMode = false;
    this.houseWheelOpen = false;
    this.clearPendingDrag();
    this.dragHoldActive = false;
    this.dragAutoExitOnDrop = false;
    this.pendingBuildTap = false;
    this.houseMovingElement = null;
    this.houseMoveTargetKind = null;
    this.houseBuildPiece = 'foundation';
    this.houseBuildFloorOverride = 'auto';
    this.syncHouseGhost();

    this.decorationMeshes.forEach((mesh) => this.scene.remove(mesh));
    this.decorationMeshes.clear();
    this.decorLights = [];
    this.decorationsOwned = [];
    this.decorationsPlaced = [];
    this.decorationPositions = {};
    this.pendingDeliveries = [];
    this.bakeryOrders = [];
    this.heldPastry = null;
    this.heldPastryVisualId = null;
    if (this.deliveryParcelMesh) {
      this.scene.remove(this.deliveryParcelMesh);
      this.deliveryParcelMesh = null;
    }
    this.torchLit = false;

    this.buildStarterHouse();
    this.inventory = { ...INITIAL_INVENTORY };
    this.rainSickWarned = false;
    this.survival = {
      health: 100,
      warmth: 84,
      hunger: 88,
      stamina: 100,
      maxStamina: 100,
      sicknessLevel: 0,
      isSick: false,
      isSheltered: false,
      nearFire: false,
      isWet: false,
      wearingRaincoat: false,
      carryingUmbrella: false,
      parkaEquipped: false,
      packEquipped: false,
      wearingBakerApron: false,
      wearingRangerJacket: false,
      wearingSilkScarf: false,
      wearingWinterSweater: false,
    };
    this.meteorology = {
      timeOfDay: 8.5,
      dayCount: 1,
      weather: 'Clear',
      nextWeather: 'Overcast',
      transitionProgress: 0,
      ambientTempC: 11,
      windSpeedMs: 3.2,
      humidity: 48,
      pressureHpa: 1018,
      precipitationIntensity: 0,
      snowAccumulation: 0.08,
      wetness: 0,
    };
    this.gold = 160;
    this.reputation = 4.2;
    this.shopName = 'Pinecrest Bakery';
    this.shopIsOpen = false;
    this.bakery = {
      stage: 'none',
      x: 7.2,
      z: 7.8,
      rotationY: -Math.PI / 2,
      shopName: 'Pinecrest Bakery',
      isOpen: false,
      shelvesOwned: 0,
      shelves: createDefaultBakeryShelves(),
    };
    this.salesHistory = [];

    this.harvestNodes.forEach((n) => {
      n.hp = n.maxHp;
      n.respawnTimer = 0;
      n.mesh.visible = true;
    });

    this.emitToast('Started a fresh alpine valley expedition.', 'info');
    this.emitHud();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.keys = {};
  }

  public selectTool(tool: ToolId): void {
    this.activeTool = tool;
    soundEngine.playUiTone(480);
    this.emitHud();
  }

  public toggleLantern(): void {
    if (this.inventory.storm_lantern <= 0) {
      this.emitToast('Buy or craft a Brass Storm Lantern to use light.', 'warning');
      return;
    }
    this.lanternLit = !this.lanternLit;
    soundEngine.playUiTone(this.lanternLit ? 720 : 360);
    this.emitHud();
  }

  public toggleTorch(): void {
    if (this.inventory.night_torch <= 0) {
      this.emitToast('Buy a Pine-Resin Night Torch ($18) in Mobile -> Clothes & Gear first.', 'warning');
      soundEngine.playUiTone(260);
      return;
    }
    this.torchLit = !this.torchLit;
    soundEngine.playUiTone(this.torchLit ? 740 : 340);
    this.emitToast(
      this.torchLit ? 'Lit your Night Torch — wide flame lighting active.' : 'Put away your Night Torch.',
      this.torchLit ? 'warm' : 'info',
    );
    this.saveToStorage();
    this.emitHud();
  }

  public toggleRaincoat(): void {
    if (this.inventory.raincoat <= 0) {
      this.emitToast('Buy a Waxed Raincoat at the Rain & Gear Supply shop first (Tab).', 'warning');
      return;
    }
    this.survival.wearingRaincoat = !this.survival.wearingRaincoat;
    soundEngine.playUiTone(this.survival.wearingRaincoat ? 660 : 410);
    this.emitToast(
      this.survival.wearingRaincoat ? 'Put on your Waxed Raincoat.' : 'Took off your Waxed Raincoat.',
      'info',
    );
    this.saveToStorage();
    this.emitHud();
  }

  public toggleUmbrella(): void {
    if (this.inventory.umbrella <= 0) {
      this.emitToast('Buy a Canopy Umbrella at the Rain & Gear Supply shop first (Tab).', 'warning');
      return;
    }
    this.survival.carryingUmbrella = !this.survival.carryingUmbrella;
    soundEngine.playUiTone(this.survival.carryingUmbrella ? 700 : 390);
    this.emitToast(
      this.survival.carryingUmbrella ? 'Opened your Canopy Umbrella overhead.' : 'Closed your Canopy Umbrella.',
      'info',
    );
    this.saveToStorage();
    this.emitHud();
  }

  public buySupplyItem(itemId: ItemId, price: number): boolean {
    if (this.gold < price) {
      this.emitToast(`Need $${price} to purchase ${ITEM_CATALOG[itemId].name}.`, 'warning');
      soundEngine.playUiTone(240);
      return false;
    }

    const def = ITEM_CATALOG[itemId];
    const isUniqueClothing =
      def.category === 'clothing' && this.inventory[itemId] > 0;
    const isUniqueTorch =
      itemId === 'night_torch' && this.inventory.night_torch > 0;
    const isUniqueDecor =
      def.category === 'decoration' &&
      (this.decorationsOwned.includes(itemId as DecorationItemId) ||
        this.pendingDeliveries.some((d) => d.itemId === itemId));
    const isUniqueCookware =
      (itemId === 'cast_skillet' || itemId === 'copper_kettle') &&
      this.inventory[itemId] > 0;

    if (isUniqueClothing || isUniqueTorch || isUniqueDecor || isUniqueCookware) {
      this.emitToast(`You already ordered or own ${def.name}.`, 'info');
      return false;
    }

    this.gold -= price;

    if (def.category === 'decoration') {
      const decId = itemId as DecorationItemId;
      this.pendingDeliveries.push({
        id: `del_${Date.now()}_${decId}`,
        itemId: decId,
        remainingSec: 60,
        totalSec: 60,
        status: 'in_transit',
      });
      soundEngine.playCoinSale();
      this.emitToast(
        `Ordered ${def.name} for $${price}! Arrives at your cabin front door in 1:00.`,
        'gold',
      );
      this.saveToStorage();
      this.emitHud();
      return true;
    }

    this.inventory[itemId] = (this.inventory[itemId] || 0) + 1;

    if (itemId === 'raincoat') {
      this.survival.wearingRaincoat = true;
    } else if (itemId === 'umbrella') {
      this.survival.carryingUmbrella = true;
    } else if (itemId === 'baker_apron') {
      this.survival.wearingBakerApron = true;
    } else if (itemId === 'ranger_jacket') {
      this.survival.wearingRangerJacket = true;
    } else if (itemId === 'silk_scarf') {
      this.survival.wearingSilkScarf = true;
    } else if (itemId === 'winter_sweater') {
      this.survival.wearingWinterSweater = true;
    } else if (itemId === 'night_torch') {
      this.torchLit = true;
    }

    soundEngine.playCoinSale();
    this.emitToast(
      itemId === 'night_torch'
        ? `Purchased ${def.name} for $${price}! Press [T] anytime to toggle flame.`
        : `Purchased ${def.name} for $${price}.`,
      'gold',
    );
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public toggleClothing(itemId: ClothingItemId): void {
    if ((this.inventory[itemId] || 0) <= 0) {
      this.emitToast(`Purchase ${ITEM_CATALOG[itemId].name} in the Clothes tab first.`, 'warning');
      return;
    }
    if (itemId === 'raincoat') {
      this.toggleRaincoat();
      return;
    }
    if (itemId === 'umbrella') {
      this.toggleUmbrella();
      return;
    }
    if (itemId === 'baker_apron') {
      this.survival.wearingBakerApron = !this.survival.wearingBakerApron;
      this.emitToast(
        this.survival.wearingBakerApron ? "Put on Baker's Linen Apron (+18% bakery income)." : "Removed Baker's Apron.",
        'info',
      );
    } else if (itemId === 'ranger_jacket') {
      this.survival.wearingRangerJacket = !this.survival.wearingRangerJacket;
      this.emitToast(
        this.survival.wearingRangerJacket ? 'Put on Ranger Leather Jacket.' : 'Took off Ranger Jacket.',
        'info',
      );
    } else if (itemId === 'silk_scarf') {
      this.survival.wearingSilkScarf = !this.survival.wearingSilkScarf;
      this.emitToast(
        this.survival.wearingSilkScarf ? 'Wrapped Woven Valley Scarf.' : 'Removed Valley Scarf.',
        'info',
      );
    } else if (itemId === 'winter_sweater') {
      this.survival.wearingWinterSweater = !this.survival.wearingWinterSweater;
      this.emitToast(
        this.survival.wearingWinterSweater ? 'Put on Cable-Knit Sweater.' : 'Took off Cable-Knit Sweater.',
        'info',
      );
    } else if (itemId === 'wool_parka') {
      this.survival.parkaEquipped = !this.survival.parkaEquipped;
      this.emitToast(
        this.survival.parkaEquipped ? 'Put on Alpine Wool Parka.' : 'Took off Alpine Wool Parka.',
        'info',
      );
    }
    soundEngine.playUiTone(620);
    this.saveToStorage();
    this.emitHud();
  }

  public toggleDecorationPlaced(decId: DecorationItemId): void {
    if (!this.decorationsOwned.includes(decId)) return;
    if (this.decorationsPlaced.includes(decId)) {
      this.decorationsPlaced = this.decorationsPlaced.filter((id) => id !== decId);
      this.emitToast(`Stored ${ITEM_CATALOG[decId].name} away.`, 'info');
    } else {
      this.decorationsPlaced.push(decId);
      this.emitToast(`Installed ${ITEM_CATALOG[decId].name} inside your house!`, 'warm');
    }
    this.syncDecorationsInWorld();
    soundEngine.playBuild();
    this.saveToStorage();
    this.emitHud();
  }

  public installAllOwnedDecor(): void {
    const missing = this.decorationsOwned.filter((id) => !this.decorationsPlaced.includes(id));
    if (missing.length === 0) return;
    this.decorationsPlaced = [...this.decorationsOwned];
    this.syncDecorationsInWorld();
    soundEngine.playBuild();
    this.emitToast(`Installed ${missing.length} delivered item(s) inside your house!`, 'warm');
    this.saveToStorage();
    this.emitHud();
  }

  private collectDoorDeliveries(): void {
    const ready = this.pendingDeliveries.filter((d) => d.status === 'at_door');
    if (ready.length === 0) return;

    const names: string[] = [];
    for (const order of ready) {
      if (!this.decorationsOwned.includes(order.itemId)) {
        this.decorationsOwned.push(order.itemId);
      }
      names.push(ITEM_CATALOG[order.itemId].name);
    }

    this.pendingDeliveries = this.pendingDeliveries.filter((d) => d.status !== 'at_door');
    this.syncDeliveryParcelInWorld();
    soundEngine.playCoinSale();
    this.emitToast(
      `Picked up ${names.join(', ')}! Open Mobile (Tab) -> House Decor to install inside your house.`,
      'gold',
    );
    this.saveToStorage();
    this.emitHud();
  }

  public toggleHudCollapsed(): void {
    this.hudCollapsed = !this.hudCollapsed;
    this.emitHud();
  }

  public setTimeScale(scale: number): void {
    this.timeScale = scale;
  }

  public toggleDayNight(): void {
    const isNight = this.meteorology.timeOfDay < 6 || this.meteorology.timeOfDay >= 19.5;
    this.meteorology.timeOfDay = isNight ? 9.5 : 22.4;
    if (!isNight && this.inventory.storm_lantern > 0 && !this.lanternLit) {
      this.lanternLit = true;
    }
    soundEngine.playUiTone(isNight ? 660 : 320);
    this.emitToast(
      isNight ? 'Shifted sky to crisp morning daylight.' : 'Nightfall arrived across Pinecrest Valley.',
      'info',
    );
    this.emitHud();
  }

  public cycleWeatherPreview(): void {
    const order: WeatherType[] = [
      'Clear',
      'Overcast',
      'Rain',
      'Thunderstorm',
      'Fog',
      'Snow',
      'Blizzard',
    ];
    const idx = order.indexOf(this.meteorology.weather);
    const next = order[(idx + 1) % order.length];
    this.meteorology.weather = next;
    this.meteorology.nextWeather = order[(idx + 2) % order.length];
    this.meteorology.transitionProgress = 0;
    this.weatherHoldTimer = 45;
    this.emitToast(`Weather front shifting to ${next}.`, 'info');
    this.emitHud();
  }

  public consumeItem(itemId: ItemId): void {
    if ((this.inventory[itemId] || 0) <= 0) {
      this.emitToast(`No ${ITEM_CATALOG[itemId].name} left in pack.`, 'warning');
      return;
    }
    const def = ITEM_CATALOG[itemId];
    if (!def.consumable) return;

    this.inventory[itemId]--;
    if (def.consumable.hunger) {
      this.survival.hunger = Math.min(100, this.survival.hunger + def.consumable.hunger);
    }
    if (def.consumable.warmth) {
      this.survival.warmth = Math.min(100, this.survival.warmth + def.consumable.warmth);
    }
    if (def.consumable.health) {
      this.survival.health = Math.min(100, this.survival.health + def.consumable.health);
    }
    if (def.consumable.stamina) {
      this.survival.stamina = Math.min(this.survival.maxStamina, this.survival.stamina + def.consumable.stamina);
    }
    if (itemId === 'hot_cider' || itemId === 'trail_rations') {
      this.survival.sicknessLevel = Math.max(0, this.survival.sicknessLevel - 35);
      if (this.survival.sicknessLevel < 12) {
        this.survival.isSick = false;
        this.survival.maxStamina = 100;
      }
    }

    soundEngine.playUiTone(680);
    this.emitToast(`Consumed ${def.name}.`, 'warm');
    this.emitHud();
  }

  public craftItem(itemId: CraftedItemId): boolean {
    const recipe = CRAFT_RECIPES.find((r) => r.itemId === itemId);
    if (!recipe) return false;

    const hasWorkbench = this.hasStructureType('workbench');
    if (recipe.requiresWorkbench && !hasWorkbench) {
      this.emitToast('Use your cabin Workbench to craft this item.', 'warning');
      return false;
    }

    for (const [matKey, qty] of Object.entries(recipe.ingredients)) {
      const id = matKey as ItemId;
      if ((this.inventory[id] || 0) < (qty || 0)) {
        this.emitToast(`Missing ${ITEM_CATALOG[id].name}.`, 'warning');
        return false;
      }
    }

    for (const [matKey, qty] of Object.entries(recipe.ingredients)) {
      this.inventory[matKey as ItemId] -= qty || 0;
    }
    const bonus = itemId === 'hot_cider' && this.inventory.copper_kettle > 0 ? 1 : 0;
    const wasZero = (this.inventory[itemId] || 0) === 0;
    this.inventory[itemId] += recipe.yieldCount + bonus;
    if (itemId === 'wool_parka' && wasZero) {
      this.survival.parkaEquipped = true;
    }

    soundEngine.playBuild();
    this.emitToast(`Crafted ${recipe.yieldCount + bonus}× ${ITEM_CATALOG[itemId].name}.`, 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public bakePastryRecipe(pastryId: BakeryPastryId): boolean {
    const recipe = BAKING_RECIPES.find((r) => r.pastryId === pastryId);
    if (!recipe) return false;

    for (const [matKey, qty] of Object.entries(recipe.ingredients)) {
      const id = matKey as ItemId;
      if ((this.inventory[id] || 0) < (qty || 0)) {
        this.emitToast(`Missing ${ITEM_CATALOG[id].name} (buy in Cooking Items tab).`, 'warning');
        return false;
      }
    }

    for (const [matKey, qty] of Object.entries(recipe.ingredients)) {
      this.inventory[matKey as ItemId] -= qty || 0;
    }
    const bonus = this.inventory.cast_skillet > 0 ? 1 : 0;
    const totalYield = recipe.yieldCount + bonus;
    this.inventory[pastryId] = (this.inventory[pastryId] || 0) + totalYield;

    soundEngine.playBuild();
    this.emitToast(`Baked ${totalYield}× ${ITEM_CATALOG[pastryId].name}!`, 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  // =========================================================================
  // Player-Owned Bakery Shop Building, Shelves & Stocking
  // =========================================================================

  public toggleBakeryBuildMode(): void {
    if (this.bakery.stage !== 'none') {
      this.emitToast('Your Bakery Plot is already placed! Walk up to it and press [E].', 'info');
      return;
    }
    this.bakeryBuildMode = !this.bakeryBuildMode;
    if (this.bakeryBuildMode && this.houseBuildMode) {
      this.houseBuildMode = false;
      this.syncHouseGhost();
    }
    this.syncBakeryGhost();
    soundEngine.playUiTone(this.bakeryBuildMode ? 620 : 380);
    this.emitHud();
  }

  public buildBakeryFoundationQuick(): boolean {
    if (this.bakery.stage !== 'none') return false;
    return this.placeBakeryFoundationAt(7.2, 7.8, -Math.PI / 2, false);
  }

  public confirmBakeryGhostPlacement(): boolean {
    if (!this.bakeryBuildMode) return false;
    if (!this.bakeryGhostCanPlace) {
      this.emitToast('Find clear flat ground away from water and buildings for your Bakery.', 'warning');
      return false;
    }
    return this.placeBakeryFoundationAt(this.bakeryGhostX, this.bakeryGhostZ, this.bakeryGhostRotY, false);
  }

  public placeBakeryFoundationAt(
    x: number,
    z: number,
    rotY: number,
    useMaterials: boolean,
  ): boolean {
    if (this.bakery.stage !== 'none') return false;

    if (useMaterials) {
      if (this.inventory.wood < BAKERY_COSTS.foundationWood || this.inventory.stone < BAKERY_COSTS.foundationStone) {
        this.emitToast(
          `Need ${BAKERY_COSTS.foundationWood} Timber and ${BAKERY_COSTS.foundationStone} Granite.`,
          'warning',
        );
        return false;
      }
      this.inventory.wood -= BAKERY_COSTS.foundationWood;
      this.inventory.stone -= BAKERY_COSTS.foundationStone;
    } else {
      if (this.gold < BAKERY_COSTS.foundationGold) {
        this.emitToast(`Need $${BAKERY_COSTS.foundationGold} to lay the Bakery foundation.`, 'warning');
        return false;
      }
      this.gold -= BAKERY_COSTS.foundationGold;
    }

    this.bakery.stage = 'foundation';
    this.bakery.x = x;
    this.bakery.z = z;
    this.bakery.rotationY = rotY;
    this.bakeryBuildMode = false;
    this.syncBakeryGhost();
    this.syncBakeryInWorld();
    const gy = groundHeightAt(x, z);
    this.spawnBurst(x, gy + 0.5, z, '#b3895e', 24);
    soundEngine.playBuild();
    this.emitToast('Bakery Foundation built! Approach it and press [E] (or use Tab) to build walls & roof.', 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public upgradeBakeryToBuilt(useMaterials = false): boolean {
    if (this.bakery.stage !== 'foundation') return false;

    if (useMaterials) {
      if (this.inventory.wood < BAKERY_COSTS.buildWood || this.inventory.stone < BAKERY_COSTS.buildStone) {
        this.emitToast(
          `Need ${BAKERY_COSTS.buildWood} Timber and ${BAKERY_COSTS.buildStone} Granite.`,
          'warning',
        );
        return false;
      }
      this.inventory.wood -= BAKERY_COSTS.buildWood;
      this.inventory.stone -= BAKERY_COSTS.buildStone;
    } else {
      if (this.gold < BAKERY_COSTS.buildGold) {
        this.emitToast(`Need $${BAKERY_COSTS.buildGold} to construct the Bakery walls & oven.`, 'warning');
        return false;
      }
      this.gold -= BAKERY_COSTS.buildGold;
    }

    this.bakery.stage = 'built';
    this.syncBakeryInWorld();
    const gy = groundHeightAt(this.bakery.x, this.bakery.z);
    this.spawnBurst(this.bakery.x, gy + 1.4, this.bakery.z, '#d6a46f', 32);
    soundEngine.playBuild();
    this.emitToast('Your Bakery Shop is built! Purchase Shelves & Pastries in Tab to start selling.', 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public buyBakeryShelf(): boolean {
    if (this.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves) {
      this.emitToast('Your Bakery already has all 4 display shelves installed.', 'info');
      return false;
    }
    if (this.gold < BAKERY_COSTS.shelfGold) {
      this.emitToast(`Need $${BAKERY_COSTS.shelfGold} to purchase a Bakery Display Shelf.`, 'warning');
      return false;
    }

    this.gold -= BAKERY_COSTS.shelfGold;
    this.bakery.shelvesOwned += 1;
    this.syncBakeryShelvesInWorld();
    soundEngine.playCoinSale();
    this.emitToast(
      `Purchased Bakery Shelf #${this.bakery.shelvesOwned} (${this.bakery.shelvesOwned * 2} display tiers)!`,
      'gold',
    );
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public updateShopName(name: string): void {
    const clean = name.slice(0, 24) || 'Pinecrest Bakery';
    this.shopName = clean;
    this.bakery.shopName = clean;
    this.refreshBakerySignboard();
    this.saveToStorage();
    this.emitHud();
  }

  public toggleShopOpen(): void {
    if (this.bakery.stage !== 'built') {
      this.emitToast('Build your Bakery Shop first before opening for customers.', 'warning');
      return;
    }
    this.bakery.isOpen = !this.bakery.isOpen;
    this.shopIsOpen = this.bakery.isOpen;
    this.refreshBakerySignboard();
    soundEngine.playUiTone(this.bakery.isOpen ? 760 : 380);
    this.emitToast(
      this.bakery.isOpen
        ? `${this.bakery.shopName} is now OPEN for village customers!`
        : `${this.bakery.shopName} is now closed.`,
      this.bakery.isOpen ? 'gold' : 'info',
    );
    this.saveToStorage();
    this.emitHud();
  }

  public stockShelfSlot(slotIndex: number, pastryId: BakeryPastryId | null, price?: number): void {
    const slot = this.bakery.shelves[slotIndex];
    if (!slot) return;
    if (slot.shelfIndex >= this.bakery.shelvesOwned) {
      this.emitToast('Purchase this Bakery Shelf first to store cakes & pastries on it.', 'warning');
      return;
    }

    if (slot.pastryId && slot.pastryId !== pastryId && slot.stock > 0) {
      this.inventory[slot.pastryId] += slot.stock;
      slot.stock = 0;
    }

    slot.pastryId = pastryId;
    if (pastryId) {
      if (price !== undefined) {
        slot.price = Math.max(5, Math.min(200, price));
      } else {
        slot.price = ITEM_CATALOG[pastryId].baseValue;
      }
    }

    this.refreshBakeryShelfItems();
    this.saveToStorage();
    this.emitHud();
  }

  public addStockToSlot(slotIndex: number, delta: number): void {
    const slot = this.bakery.shelves[slotIndex];
    if (!slot || !slot.pastryId) return;
    if (slot.shelfIndex >= this.bakery.shelvesOwned) return;

    if (delta > 0) {
      if (this.inventory[slot.pastryId] <= 0) {
        this.emitToast(`No ${ITEM_CATALOG[slot.pastryId].name} in pack—buy more in Cakes & Pastries tab.`, 'warning');
        return;
      }
      this.inventory[slot.pastryId] -= 1;
      slot.stock += 1;
    } else if (delta < 0 && slot.stock > 0) {
      slot.stock -= 1;
      this.inventory[slot.pastryId] += 1;
    }

    soundEngine.playUiTone(delta > 0 ? 600 : 450);
    this.refreshBakeryShelfItems();
    this.saveToStorage();
    this.emitHud();
  }

  public setSlotPrice(slotIndex: number, price: number): void {
    const slot = this.bakery.shelves[slotIndex];
    if (!slot) return;
    slot.price = Math.max(5, Math.min(250, Math.round(price)));
    this.saveToStorage();
    this.emitHud();
  }

  public getShelfStockForPastry(pastryId: BakeryPastryId): number {
    return this.bakery.shelves
      .filter((s) => s.shelfIndex < this.bakery.shelvesOwned && s.pastryId === pastryId)
      .reduce((sum, s) => sum + s.stock, 0);
  }

  public quickStorePastryOnShelf(pastryId: BakeryPastryId, count = 1): boolean {
    if (this.bakery.stage !== 'built') {
      this.emitToast('Build your Bakery Shop first before storing pastries on shelves.', 'warning');
      return false;
    }
    if (this.bakery.shelvesOwned <= 0) {
      this.emitToast('Purchase a Bakery Display Shelf ($40) first to store pastries.', 'warning');
      return false;
    }
    const availableInPack = this.inventory[pastryId] || 0;
    if (availableInPack <= 0) {
      this.emitToast(`No ${ITEM_CATALOG[pastryId].name} in your pack to store.`, 'warning');
      return false;
    }

    const activeSlots = this.bakery.shelves.filter((s) => s.shelfIndex < this.bakery.shelvesOwned);
    let targetSlot = activeSlots.find((s) => s.pastryId === pastryId);
    if (!targetSlot) {
      targetSlot = activeSlots.find((s) => !s.pastryId || s.stock === 0);
    }
    if (!targetSlot) {
      this.emitToast(
        'All purchased shelf tiers are occupied with other pastries. Clear or buy another shelf.',
        'warning',
      );
      return false;
    }

    const toStore = Math.min(count, availableInPack);
    if (!targetSlot.pastryId || targetSlot.stock === 0) {
      targetSlot.pastryId = pastryId;
      targetSlot.price = ITEM_CATALOG[pastryId].baseValue;
    }
    this.inventory[pastryId] -= toStore;
    targetSlot.stock += toStore;

    soundEngine.playUiTone(620);
    this.refreshBakeryShelfItems();
    this.emitToast(
      `Stored ${toStore}× ${ITEM_CATALOG[pastryId].name} on Shelf #${targetSlot.shelfIndex + 1}.`,
      'gold',
    );
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public acceptBakeryOrder(orderId: string): boolean {
    const order = this.bakeryOrders.find((o) => o.id === orderId);
    if (!order || order.status !== 'waiting_decision') return false;

    const shelfStock = this.getShelfStockForPastry(order.pastryId);
    if (shelfStock < order.quantity) {
      const packStock = this.inventory[order.pastryId] || 0;
      if (packStock >= order.quantity) {
        this.emitToast(
          `Store ${ITEM_CATALOG[order.pastryId].name} onto a Bakery Shelf first, or refuse the order.`,
          'warning',
        );
      } else {
        this.emitToast(
          `Out of stock for ${ITEM_CATALOG[order.pastryId].name}! Refuse the order or bake/buy more.`,
          'warning',
        );
      }
      soundEngine.playUiTone(260);
      return false;
    }

    order.status = 'accepted';
    soundEngine.playUiTone(660);
    this.emitToast(
      `Took ${order.customerName}'s order! Grab ${ITEM_CATALOG[order.pastryId].name} from a shelf and serve within 3:00.`,
      'gold',
    );
    this.emitHud();
    return true;
  }

  public refuseBakeryOrder(orderId: string): void {
    const idx = this.bakeryOrders.findIndex((o) => o.id === orderId);
    if (idx === -1) return;

    const order = this.bakeryOrders[idx];
    this.bakeryOrders.splice(idx, 1);

    const tr = this.travelers.find((t) => t.id === order.travelerId);
    if (tr) {
      tr.orderId = undefined;
      tr.phase = 'leaving';
      tr.targetZ = 48;
      tr.targetX = trailCenterXAtZ(48);
    }

    soundEngine.playUiTone(360);
    this.emitToast(`Declined ${order.customerName}'s order cleanly.`, 'info');
    this.emitHud();
  }

  public takePastryFromShelf(pastryId: BakeryPastryId, preferredShelfIndex?: number): boolean {
    if (this.heldPastry) {
      this.emitToast(
        `Already carrying ${ITEM_CATALOG[this.heldPastry].name}. Serve it or return it first.`,
        'warning',
      );
      return false;
    }

    const activeSlots = this.bakery.shelves.filter(
      (s) => s.shelfIndex < this.bakery.shelvesOwned && s.pastryId === pastryId && s.stock > 0,
    );
    if (preferredShelfIndex !== undefined) {
      activeSlots.sort((a, b) =>
        a.shelfIndex === preferredShelfIndex ? -1 : b.shelfIndex === preferredShelfIndex ? 1 : 0,
      );
    }

    const slot = activeSlots[0];
    if (!slot) {
      this.emitToast(`No ${ITEM_CATALOG[pastryId].name} currently stocked on your shelves.`, 'warning');
      return false;
    }

    slot.stock -= 1;
    this.heldPastry = pastryId;
    this.refreshBakeryShelfItems();
    soundEngine.playUiTone(680);
    this.emitToast(`Picked up ${ITEM_CATALOG[pastryId].name} on serving tray! Give it to the customer.`, 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public putBackHeldPastry(): void {
    if (!this.heldPastry) return;
    const pastryId = this.heldPastry;
    this.heldPastry = null;

    // Return to matching shelf if available, else back to pack
    const slot = this.bakery.shelves.find(
      (s) => s.shelfIndex < this.bakery.shelvesOwned && s.pastryId === pastryId,
    );
    if (slot) {
      slot.stock += 1;
      this.refreshBakeryShelfItems();
      this.emitToast(`Returned ${ITEM_CATALOG[pastryId].name} to Shelf #${slot.shelfIndex + 1}.`, 'info');
    } else {
      this.inventory[pastryId] = (this.inventory[pastryId] || 0) + 1;
      this.emitToast(`Returned ${ITEM_CATALOG[pastryId].name} to your pack.`, 'info');
    }
    soundEngine.playUiTone(420);
    this.saveToStorage();
    this.emitHud();
  }

  public serveBakeryOrder(orderId: string): boolean {
    const idx = this.bakeryOrders.findIndex((o) => o.id === orderId);
    if (idx === -1) return false;
    const order = this.bakeryOrders[idx];
    if (order.status !== 'accepted') {
      this.emitToast('Accept the customer order first before serving.', 'warning');
      return false;
    }
    if (this.heldPastry !== order.pastryId) {
      this.emitToast(
        `Take ${ITEM_CATALOG[order.pastryId].name} from a shelf first before serving ${order.customerName}.`,
        'warning',
      );
      return false;
    }

    this.heldPastry = null;
    this.bakeryOrders.splice(idx, 1);

    const apronBonus = this.survival.wearingBakerApron ? 1.18 : 1.0;
    const paid = Math.round(order.price * apronBonus);
    this.gold += paid;
    this.reputation = Math.min(5.0, Number((this.reputation + 0.15).toFixed(2)));

    const demandMult = getWeatherDemandMultiplier(order.pastryId, this.meteorology.weather);
    this.salesHistory.unshift({
      id: `sale_${Date.now()}`,
      day: this.meteorology.dayCount,
      timeStr: formatTime24(this.meteorology.timeOfDay),
      travelerName: order.customerName,
      itemId: order.pastryId,
      price: paid,
      weatherBonus: demandMult > 1.05 || this.survival.wearingBakerApron,
    });
    if (this.salesHistory.length > 30) this.salesHistory.pop();

    const tr = this.travelers.find((t) => t.id === order.travelerId);
    if (tr) {
      tr.orderId = undefined;
      tr.fulfilled = true;
      tr.boughtAlready = true;
      tr.phase = 'leaving';
      tr.targetZ = 48;
      tr.targetX = trailCenterXAtZ(48);
    }

    soundEngine.playCoinSale();
    this.emitToast(
      `Served ${ITEM_CATALOG[order.pastryId].name} to ${order.customerName} for +$${paid}! Goodwill ${this.reputation.toFixed(1)}★`,
      'gold',
    );
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  private buildNpcDialogueState(tr: TravelerAgent): NpcDialogueState {
    const w = this.meteorology.weather;
    const isColdOrStorm =
      w === 'Rain' ||
      w === 'Thunderstorm' ||
      w === 'Snow' ||
      w === 'Blizzard' ||
      this.meteorology.ambientTempC < 6;

    const mood = tr.fulfilled
      ? 'Supplied & grateful'
      : isColdOrStorm
        ? 'Chilled & seeking reliable gear'
        : 'Exploring the valley trail';

    const itemDef = ITEM_CATALOG[tr.wantedItemId];
    let greeting: string;
    if (tr.fulfilled) {
      greeting = `Appreciate the ${itemDef.name}! It will make the climb over the north ridge far safer.`;
    } else if (w === 'Blizzard' || w === 'Snow') {
      greeting = `The wind up on the pass is biting hard. Do you happen to carry a ${itemDef.name}? I can pay $${tr.offerPrice}.`;
    } else if (w === 'Rain' || w === 'Thunderstorm') {
      greeting = `Caught in this downpour without proper kit. I would gladly buy a ${itemDef.name} for $${tr.offerPrice} if you have one.`;
    } else if (w === 'Fog') {
      greeting = `Visibility dropped fast in the timberline. Looking for a ${itemDef.name}—offering $${tr.offerPrice}.`;
    } else {
      greeting = `Fine day in Pinecrest Valley! I'm heading toward the upper ridge and looking to pick up a ${itemDef.name} for $${tr.offerPrice}.`;
    }

    const forecastMap: Record<WeatherType, string> = {
      Clear: `Skies look clear ahead, though pressure is shifting toward ${this.meteorology.nextWeather}.`,
      Overcast: `Clouds are thickening over the peaks—expect ${this.meteorology.nextWeather} before long.`,
      Rain: `Barometer sits at ${this.meteorology.pressureHpa} hPa; this front should turn toward ${this.meteorology.nextWeather}.`,
      Thunderstorm: `Heavy squall rolling through. Keep a roof overhead until it shifts to ${this.meteorology.nextWeather}.`,
      Fog: `Valley mist is clinging to the lake; it should transition to ${this.meteorology.nextWeather} soon.`,
      Snow: `Powder is settling across the clearing—watch your warmth as ${this.meteorology.nextWeather} approaches.`,
      Blizzard: `Severe cold front! Stay by a lit hearth until conditions ease toward ${this.meteorology.nextWeather}.`,
    };

    return {
      id: tr.id,
      name: tr.name,
      role: tr.role,
      mood,
      greeting,
      wantedItemId: tr.wantedItemId,
      offerPrice: tr.offerPrice,
      weatherForecast: forecastMap[w],
      fulfilled: tr.fulfilled,
      helpedWarmth: tr.helpedWarmth,
    };
  }

  public sellToNpc(npcId: string, haggle: boolean): void {
    const tr = this.travelers.find((t) => t.id === npcId);
    if (!tr || tr.fulfilled) return;

    const itemId = tr.wantedItemId;
    if ((this.inventory[itemId] || 0) <= 0) {
      this.emitToast(`You don't have a ${ITEM_CATALOG[itemId].name} in your pack.`, 'warning');
      return;
    }

    let finalPrice = tr.offerPrice;
    if (haggle) {
      const successChance = Math.min(0.85, 0.45 + (this.reputation - 3.5) * 0.2);
      if (Math.random() <= successChance) {
        finalPrice = Math.round(tr.offerPrice * 1.2);
        this.emitToast(`${tr.name} agreed to $${finalPrice} after haggling!`, 'gold');
      } else {
        finalPrice = Math.max(5, Math.round(tr.offerPrice * 0.92));
        this.reputation = Math.max(1.0, Number((this.reputation - 0.05).toFixed(1)));
        this.emitToast(`${tr.name} balked slightly and settled at $${finalPrice}.`, 'info');
      }
    } else {
      this.emitToast(`Sold ${ITEM_CATALOG[itemId].name} to ${tr.name} for +$${finalPrice}!`, 'gold');
    }

    this.inventory[itemId] -= 1;
    this.gold += finalPrice;
    tr.fulfilled = true;
    tr.boughtAlready = true;
    this.reputation = Math.min(5.0, Number((this.reputation + 0.12).toFixed(1)));

    this.salesHistory.unshift({
      id: `sale_${Date.now()}`,
      day: this.meteorology.dayCount,
      timeStr: formatTime24(this.meteorology.timeOfDay),
      travelerName: tr.name,
      itemId,
      price: finalPrice,
      weatherBonus: getWeatherDemandMultiplier(itemId, this.meteorology.weather) > 1.05,
    });
    if (this.salesHistory.length > 30) this.salesHistory.pop();

    soundEngine.playCoinSale();
    this.saveToStorage();
    this.callbacks.onOpenNpcDialogue(this.buildNpcDialogueState(tr));
    this.emitHud();
  }

  public giftProvisionToNpc(
    npcId: string,
    giftId: 'berries' | 'hot_cider' | 'trail_rations',
  ): void {
    const tr = this.travelers.find((t) => t.id === npcId);
    if (!tr || tr.helpedWarmth) return;

    if ((this.inventory[giftId] || 0) <= 0) {
      this.emitToast(`No ${ITEM_CATALOG[giftId].name} in pack.`, 'warning');
      return;
    }

    this.inventory[giftId] -= 1;
    tr.helpedWarmth = true;
    this.reputation = Math.min(5.0, Number((this.reputation + 0.2).toFixed(1)));

    const gifts: ItemId[] = ['iron', 'pelt', 'resin'];
    const reward = gifts[Math.floor(Math.random() * gifts.length)];
    const qty = reward === 'pelt' ? 1 : 2;
    this.inventory[reward] += qty;

    soundEngine.playUiTone(700);
    this.emitToast(
      `Shared ${ITEM_CATALOG[giftId].name} with ${tr.name}. Received +${qty} ${ITEM_CATALOG[reward].name}!`,
      'warm',
    );
    this.saveToStorage();
    this.callbacks.onOpenNpcDialogue(this.buildNpcDialogueState(tr));
    this.emitHud();
  }

  public endNpcConversation(npcId: string): void {
    const tr = this.travelers.find((t) => t.id === npcId);
    if (tr && tr.phase === 'talking') {
      tr.phase = tr.fulfilled ? 'leaving' : tr.preTalkPhase;
      if (tr.phase === 'leaving') {
        tr.targetZ = 48;
        tr.targetX = trailCenterXAtZ(48);
      }
    }
    this.callbacks.onOpenNpcDialogue(null);
  }

  public saveToStorage(notify = false): void {
    try {
      const invToSave = { ...this.inventory };
      if (this.heldPastry) {
        invToSave[this.heldPastry] = (invToSave[this.heldPastry] || 0) + 1;
      }
      const save: PersistedValleySave = {
        version: 2,
        savedAt: Date.now(),
        playerPos: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z },
        playerYaw: this.playerYaw,
        playerPitch: this.playerPitch,
        meteorology: this.meteorology,
        survival: this.survival,
        inventory: invToSave,
        structures: (() => {
          const list = Array.from(this.structures.values()).map((s) => s.data);
          if (this.houseMovingElement?.kind === 'structure') {
            list.push(this.houseMovingElement.data);
          }
          return list;
        })(),
        bakery: this.bakery,
        decorationsOwned: this.decorationsOwned,
        decorationsPlaced: this.decorationsPlaced,
        decorationPositions: this.decorationPositions,
        pendingDeliveries: this.pendingDeliveries,
        torchLit: this.torchLit,
        shop: {
          shopName: this.bakery.shopName,
          isOpen: this.bakery.isOpen,
          gold: this.gold,
          reputation: this.reputation,
          salesHistory: this.salesHistory.slice(0, 30),
        },
        harvestedNodeIds: this.harvestNodes.filter((n) => !n.mesh.visible).map((n) => n.id),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      if (notify) {
        this.emitToast('Valley progress saved.', 'info');
      }
    } catch {
      // ignore quota errors
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw) as PersistedValleySave;
      if (!save || save.version !== 2) return;

      this.playerPos.set(save.playerPos.x, save.playerPos.y, save.playerPos.z);
      this.playerYaw = save.playerYaw;
      this.playerPitch = save.playerPitch;
      this.meteorology = { ...this.meteorology, ...save.meteorology };
      this.survival = { ...this.survival, ...save.survival };
      this.inventory = { ...INITIAL_INVENTORY, ...save.inventory };
      this.shopName = save.shop.shopName;
      this.shopIsOpen = save.shop.isOpen;
      this.gold = save.shop.gold;
      this.reputation = save.shop.reputation;
      this.salesHistory = save.shop.salesHistory || [];

      if (save.bakery) {
        this.bakery = {
          ...this.bakery,
          ...save.bakery,
          shelves: save.bakery.shelves?.length ? save.bakery.shelves : createDefaultBakeryShelves(),
        };
      }
      this.decorationsOwned = save.decorationsOwned || [];
      this.decorationsPlaced = save.decorationsPlaced || [];
      this.decorationPositions = save.decorationPositions ? { ...save.decorationPositions } : {};
      this.pendingDeliveries = Array.isArray(save.pendingDeliveries) ? save.pendingDeliveries : [];
      this.torchLit = Boolean(save.torchLit && this.inventory.night_torch > 0);

      this.structures.forEach((s) => this.scene.remove(s.group));
      this.structures.clear();
      for (const st of save.structures) {
        this.spawnStructureMesh(st, false);
      }
      this.syncUpperFloorStairCutouts();
      this.syncBakeryInWorld();
      this.syncDecorationsInWorld();
      this.syncDeliveryParcelInWorld();

      const harvestedSet = new Set(save.harvestedNodeIds || []);
      this.harvestNodes.forEach((n) => {
        if (harvestedSet.has(n.id)) {
          n.mesh.visible = false;
          n.respawnTimer = 45;
        }
      });
    } catch {
      // corrupt save fallback
    }
  }

  // =========================================================================
  // Starter House, Player Bakery Shop, House Decorations & Nearby Cottages
  // =========================================================================

  private buildStarterHouse(): void {
    const baseY = Number(groundHeightAt(0, 0).toFixed(2));
    const deckY = Number((baseY + 0.46).toFixed(2));
    const roofY = Number((deckY + WALL_HEIGHT).toFixed(2));

    const starterPieces: PlacedStructure[] = [
      // Player's starter little house (4m x 8m)
      { id: 'starter_f0', type: 'foundation', x: 0, y: baseY, z: 0, rotationY: 0 },
      { id: 'starter_f1', type: 'foundation', x: 0, y: baseY, z: 4, rotationY: 0 },
      { id: 'starter_w_north', type: 'wall', x: 0, y: deckY, z: -2, rotationY: 0 },
      { id: 'starter_w_south', type: 'wall', x: 0, y: deckY, z: 6, rotationY: 0 },
      { id: 'starter_w_west0', type: 'window_wall', x: -2, y: deckY, z: 0, rotationY: Math.PI / 2 },
      { id: 'starter_w_west1', type: 'wall', x: -2, y: deckY, z: 4, rotationY: Math.PI / 2 },
      { id: 'starter_door', type: 'doorway', x: 2, y: deckY, z: 0, rotationY: Math.PI / 2, doorOpen: false },
      { id: 'starter_w_east1', type: 'window_wall', x: 2, y: deckY, z: 4, rotationY: Math.PI / 2 },
      { id: 'starter_roof0', type: 'roof', x: 0, y: roofY, z: 0, rotationY: 0 },
      { id: 'starter_roof1', type: 'roof', x: 0, y: roofY, z: 4, rotationY: 0 },
      { id: 'starter_hearth', type: 'hearth', x: 0, y: deckY, z: 5.1, rotationY: Math.PI, lit: true },
      { id: 'starter_bed', type: 'bedroll', x: -1.05, y: deckY, z: 3.6, rotationY: 0 },
      { id: 'starter_bench', type: 'workbench', x: -0.2, y: deckY, z: -1.15, rotationY: 0 },
    ];

    starterPieces.forEach((piece) => {
      this.spawnStructureMesh(piece, false);
    });

    // Spawn player inside the cozy starter cabin facing the front door & valley road
    this.playerPos.set(0, deckY + 1.72, 1.4);
    this.playerYaw = -0.96;
    this.playerPitch = -0.05;
  }

  // =========================================================================
  // Modular House Building, Extensions, Multi-Floor Decks & Stairs
  // =========================================================================

  private getMovingElementLabel(): string | null {
    if (!this.houseMovingElement) return null;
    if (this.houseMovingElement.kind === 'decor') {
      return ITEM_CATALOG[this.houseMovingElement.decId].name;
    }
    const t = this.houseMovingElement.data.type;
    if (t === 'workbench') return 'Player Kitchen';
    const def = HOUSE_BUILD_PIECES.find((p) => p.id === t);
    return def ? def.shortName : t;
  }

  public cancelMovingHouseElement(silent = false): void {
    if (!this.houseMovingElement) return;
    const item = this.houseMovingElement;
    this.houseMovingElement = null;
    this.houseGhostVisualKey = '';

    if (item.kind === 'structure') {
      this.spawnStructureMesh(item.data, false);
      if (item.data.type === 'stairs' || item.data.type === 'upper_floor') {
        this.syncUpperFloorStairCutouts();
      }
    } else {
      this.decorationPositions[item.decId] = item.origPos;
      this.syncDecorationsInWorld();
    }

    if (!silent) {
      soundEngine.playUiTone(380);
      this.emitToast('Move cancelled — returned element to original spot.', 'info');
    }
    this.syncHouseGhost();
    this.emitHud();
  }

  public toggleHouseBuildMode(piece?: HouseBuildPieceId): void {
    if (piece) {
      if (piece !== 'move') this.cancelMovingHouseElement(true);
      this.houseBuildPiece = piece;
      this.houseBuildMode = true;
      this.houseWheelOpen = false;
    } else {
      if (this.houseBuildMode) {
        this.cancelMovingHouseElement(true);
      }
      this.houseBuildMode = !this.houseBuildMode;
      this.houseWheelOpen = this.houseBuildMode;
    }
    if (this.houseWheelOpen && document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (this.houseBuildMode && this.bakeryBuildMode) {
      this.bakeryBuildMode = false;
      this.syncBakeryGhost();
    }
    this.syncHouseGhost();
    soundEngine.playUiTone(this.houseBuildMode ? 640 : 360);
    if (this.houseBuildMode) {
      this.emitToast(
        this.houseWheelOpen
          ? 'Circular House Builder Open: Pick any slice or press [Q] to aim in 3D'
          : piece === 'move'
            ? 'Move Mode Active: Click & Hold any house element, Player Kitchen, or Tab Lamp to drag & release!'
            : 'House Builder Active: [Q] Circular Wheel · [Z] Story · [R] Rotate · [E/Click] Place',
        'gold',
      );
    }
    this.emitHud();
  }

  public toggleHouseWheel(open?: boolean): void {
    if (!this.houseBuildMode && open !== false) {
      this.houseBuildMode = true;
      if (this.bakeryBuildMode) {
        this.bakeryBuildMode = false;
        this.syncBakeryGhost();
      }
    }
    if (!this.houseBuildMode) return;
    this.houseWheelOpen = open !== undefined ? open : !this.houseWheelOpen;
    if (this.houseWheelOpen && document.pointerLockElement) {
      document.exitPointerLock();
    }
    soundEngine.playUiTone(this.houseWheelOpen ? 640 : 480);
    this.syncHouseGhost();
    this.emitHud();
  }

  public selectHouseBuildPiece(id: HouseBuildPieceId, closeWheel = false): void {
    if (id !== 'move') {
      this.cancelMovingHouseElement(true);
    }
    this.houseBuildPiece = id;
    if (!this.houseBuildMode) {
      this.houseBuildMode = true;
      if (this.bakeryBuildMode) {
        this.bakeryBuildMode = false;
        this.syncBakeryGhost();
      }
    }
    if (closeWheel) {
      this.houseWheelOpen = false;
    }
    soundEngine.playUiTone(560);
    this.syncHouseGhost();
    this.emitHud();
  }

  public cycleHouseBuildPiece(): void {
    const idx = HOUSE_BUILD_PIECES.findIndex((p) => p.id === this.houseBuildPiece);
    const next = HOUSE_BUILD_PIECES[(idx + 1) % HOUSE_BUILD_PIECES.length];
    this.selectHouseBuildPiece(next.id);
  }

  public cycleHouseFloorOverride(): void {
    const order: Array<'auto' | 0 | 1 | 2> = ['auto', 0, 1, 2];
    const idx = order.indexOf(this.houseBuildFloorOverride);
    this.houseBuildFloorOverride = order[(idx + 1) % order.length];
    soundEngine.playUiTone(620);
    this.syncHouseGhost();
    this.emitHud();
  }

  public rotateHouseGhost(): void {
    if (this.houseMovingElement?.kind === 'decor') {
      this.houseGhostRotY += Math.PI / 4;
    } else {
      this.houseGhostRotY += Math.PI / 2;
      this.houseGhostFlip = (this.houseGhostFlip + 1) % 2;
    }
    soundEngine.playUiTone(520);
    this.syncHouseGhost();
  }

  private getNearestFoundationDeckY(x: number, z: number): number | null {
    let bestDist = 14;
    let bestDeckY: number | null = null;
    this.structures.forEach((s) => {
      if (s.data.type !== 'foundation') return;
      const d = Math.hypot(s.data.x - x, s.data.z - z);
      if (d < bestDist) {
        bestDist = d;
        bestDeckY = s.data.y + 0.46;
      }
    });
    return bestDeckY;
  }

  private clearHarvestNodesNear(x: number, z: number, radius = 2.6): void {
    for (const node of this.harvestNodes) {
      if (!node.mesh.visible) continue;
      if (Math.hypot(node.x - x, node.z - z) < radius) {
        node.mesh.visible = false;
        node.respawnTimer = 999999;
      }
    }
  }

  private canPayPieceCost(def: (typeof HOUSE_BUILD_PIECES)[number]): 'materials' | 'gold' | 'none' {
    const hasMats = Object.entries(def.materials).every(
      ([k, qty]) => (this.inventory[k as ItemId] || 0) >= (qty || 0),
    );
    if (hasMats) return 'materials';
    if (this.gold >= def.goldCost) return 'gold';
    return 'none';
  }

  private payForPiece(def: (typeof HOUSE_BUILD_PIECES)[number]): boolean {
    const mode = this.canPayPieceCost(def);
    if (mode === 'materials') {
      for (const [k, qty] of Object.entries(def.materials)) {
        this.inventory[k as ItemId] -= qty || 0;
      }
      return true;
    }
    if (mode === 'gold') {
      this.gold -= def.goldCost;
      return true;
    }
    const matLabel = Object.entries(def.materials)
      .map(([k, q]) => `${q} ${ITEM_CATALOG[k as ItemId].name}`)
      .join(' + ');
    this.emitToast(`Need ${matLabel} (or $${def.goldCost}) to build ${def.shortName}.`, 'warning');
    soundEngine.playUiTone(250);
    return false;
  }

  private getStructureCostLabel(def: (typeof HOUSE_BUILD_PIECES)[number]): string {
    const matStr = Object.entries(def.materials)
      .map(([k, q]) => `${q} ${ITEM_CATALOG[k as ItemId].name.split(' ').pop()}`)
      .join(' + ');
    const mode = this.canPayPieceCost(def);
    if (mode === 'materials') return `${matStr} (Using Pack Materials)`;
    if (mode === 'gold') return `$${def.goldCost} (Using Money — missing materials)`;
    return `Requires ${matStr} or $${def.goldCost}`;
  }

  private disposeGhostGroup(grp: THREE.Group): void {
    grp.traverse((child) => {
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
      const m = (child as THREE.Mesh).material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) (m as THREE.Material).dispose();
    });
  }

  private computeStructurePlacement(pieceId: StructureType): {
    gx: number;
    gy: number;
    gz: number;
    rotY: number;
    canPlace: boolean;
    failReason: string;
  } {
    const dirX = -Math.sin(this.playerYaw);
    const dirZ = -Math.cos(this.playerYaw);
    let ax = this.playerPos.x + dirX * 4.2;
    let az = this.playerPos.z + dirZ * 4.2;

    if (this.dragHoldActive || !this.pointerLocked) {
      const refDeckY =
        this.getNearestFoundationDeckY(this.playerPos.x, this.playerPos.z) ??
        groundHeightAt(this.playerPos.x, this.playerPos.z) + 0.46;
      const feetInit = this.playerPos.y - 1.72;
      const relInit = feetInit - refDeckY;
      const autoInit: 0 | 1 | 2 =
        relInit > WALL_HEIGHT * 1.65 ? 2 : relInit > WALL_HEIGHT * 0.65 ? 1 : 0;
      const standInit: 0 | 1 | 2 =
        this.houseBuildFloorOverride === 'auto' ? autoInit : this.houseBuildFloorOverride;
      const planeY =
        pieceId === 'foundation'
          ? refDeckY - 0.46
          : pieceId === 'roof'
            ? refDeckY + (standInit + 1) * WALL_HEIGHT
            : refDeckY + standInit * WALL_HEIGHT;
      const cursorPt = this.getCursorFloorPoint(planeY, 12);
      ax = cursorPt.x;
      az = cursorPt.z;
    }

    const cellX = Math.round(ax / GRID_SIZE) * GRID_SIZE;
    const cellZ = Math.round(az / GRID_SIZE) * GRID_SIZE;

    const nearestDeckY = this.getNearestFoundationDeckY(cellX, cellZ);
    const fallbackDeckY = groundHeightAt(cellX, cellZ) + 0.46;
    const baseDeckY = nearestDeckY ?? fallbackDeckY;
    const feetY = this.playerPos.y - 1.72;
    const relY = feetY - baseDeckY;
    const autoFloor: 0 | 1 | 2 =
      relY > WALL_HEIGHT * 1.65 ? 2 : relY > WALL_HEIGHT * 0.65 ? 1 : 0;
    const standFloor: 0 | 1 | 2 =
      this.houseBuildFloorOverride === 'auto' ? autoFloor : this.houseBuildFloorOverride;

    let gx = cellX;
    let gy = baseDeckY;
    let gz = cellZ;
    let rotY = Math.round(this.houseGhostRotY / (Math.PI / 2)) * (Math.PI / 2);
    let canPlace = true;
    let failReason = '';

    if (pieceId === 'foundation') {
      const groundY = groundHeightAt(gx, gz);
      gy = Number(groundY.toFixed(2));
      rotY = 0;

      let adjacentFound: StructureEntry | null = null;
      for (const s of this.structures.values()) {
        if (s.data.type !== 'foundation') continue;
        const d = Math.hypot(s.data.x - gx, s.data.z - gz);
        if (d > 2.5 && d <= 4.4 && !adjacentFound) {
          adjacentFound = s;
        }
      }
      if (adjacentFound && Math.abs(groundY - adjacentFound.data.y) <= 0.85) {
        gy = adjacentFound.data.y;
      }

      if (groundY < LAKE_LEVEL + 0.45) {
        canPlace = false;
        failReason = 'Too close to deep lake water';
      } else if (Math.hypot(gx, gz) > PLAYABLE_RADIUS - 6) {
        canPlace = false;
        failReason = 'Too close to mountain rim';
      } else if (groundY > gy + 0.48) {
        canPlace = false;
        failReason = 'Terrain rises above adjacent floor deck';
      } else if (this.villageCottages.some((c) => Math.hypot(gx - c.x, gz - c.z) < 5.6)) {
        canPlace = false;
        failReason = 'Too close to village cottage';
      } else if (this.bakery.stage !== 'none' && Math.hypot(gx - this.bakery.x, gz - this.bakery.z) < 5.2) {
        canPlace = false;
        failReason = 'Too close to your Bakery Shop';
      } else {
        for (const s of this.structures.values()) {
          if (s.data.type === 'foundation' && Math.hypot(s.data.x - gx, s.data.z - gz) < 2.2) {
            canPlace = false;
            failReason = 'Foundation already exists here';
            break;
          }
        }
      }
    } else if (pieceId === 'stairs') {
      gy = Number((baseDeckY + standFloor * WALL_HEIGHT).toFixed(2));
      if (standFloor >= 2) {
        canPlace = false;
        failReason = 'Maximum 3 stories reached';
      } else {
        let hasFloorBelow = false;
        let hasDuplicate = false;
        for (const s of this.structures.values()) {
          const sameCol = Math.hypot(s.data.x - gx, s.data.z - gz) < 0.8;
          if (!sameCol) continue;
          if (standFloor === 0 && s.data.type === 'foundation' && Math.abs(s.data.y + 0.46 - gy) < 0.65) {
            hasFloorBelow = true;
          }
          if (standFloor >= 1 && s.data.type === 'upper_floor' && Math.abs(s.data.y - gy) < 0.65) {
            hasFloorBelow = true;
          }
          if (s.data.type === 'stairs' && Math.abs(s.data.y - gy) < 0.65) {
            hasDuplicate = true;
          }
        }
        if (!hasFloorBelow) {
          canPlace = false;
          failReason = 'Place stairs over a Foundation or Upper Floor';
        } else if (hasDuplicate) {
          canPlace = false;
          failReason = 'Stairs already placed on this tile';
        }
      }
    } else if (pieceId === 'upper_floor') {
      rotY = 0;
      let targetLevel = 1;
      if (this.houseBuildFloorOverride === 'auto') {
        if (standFloor === 0) {
          targetLevel = 1;
        } else {
          let existsAtStand = false;
          for (const s of this.structures.values()) {
            if (
              s.data.type === 'upper_floor' &&
              Math.hypot(s.data.x - gx, s.data.z - gz) < 0.8 &&
              Math.abs(s.data.y - (baseDeckY + standFloor * WALL_HEIGHT)) < 0.6
            ) {
              existsAtStand = true;
              break;
            }
          }
          targetLevel = !existsAtStand && this.playerPitch < -0.12 ? standFloor : Math.min(3, standFloor + 1);
        }
      } else if (this.houseBuildFloorOverride === 0) {
        targetLevel = 1;
      } else {
        const ovFloor = this.houseBuildFloorOverride as 1 | 2;
        let existsAtOv = false;
        for (const s of this.structures.values()) {
          if (
            s.data.type === 'upper_floor' &&
            Math.hypot(s.data.x - gx, s.data.z - gz) < 0.8 &&
            Math.abs(s.data.y - (baseDeckY + ovFloor * WALL_HEIGHT)) < 0.6
          ) {
            existsAtOv = true;
            break;
          }
        }
        targetLevel = existsAtOv ? Math.min(3, ovFloor + 1) : ovFloor;
      }

      gy = Number((baseDeckY + targetLevel * WALL_HEIGHT).toFixed(2));
      const belowY = baseDeckY + (targetLevel - 1) * WALL_HEIGHT;

      let hasSupport = false;
      let hasDuplicate = false;
      let hasBlockingRoof = false;

      for (const s of this.structures.values()) {
        const d = Math.hypot(s.data.x - gx, s.data.z - gz);
        if (d < 0.8) {
          if (targetLevel === 1 && s.data.type === 'foundation' && Math.abs(s.data.y + 0.46 - belowY) < 0.65) {
            hasSupport = true;
          }
          if (targetLevel >= 2 && s.data.type === 'upper_floor' && Math.abs(s.data.y - belowY) < 0.65) {
            hasSupport = true;
          }
          if (s.data.type === 'upper_floor' && Math.abs(s.data.y - gy) < 0.65) {
            hasDuplicate = true;
          }
          if (s.data.type === 'roof' && Math.abs(s.data.y - gy) < 0.65) {
            hasBlockingRoof = true;
          }
        } else if (d <= 4.3 && s.data.type === 'upper_floor' && Math.abs(s.data.y - gy) < 0.65) {
          hasSupport = true;
        }
      }

      if (!hasSupport) {
        canPlace = false;
        failReason = 'Requires Foundation below or adjacent Upper Floor';
      } else if (hasDuplicate) {
        canPlace = false;
        failReason = 'Upper Floor already exists here';
      } else if (hasBlockingRoof) {
        canPlace = false;
        failReason = 'Demolish existing Roof [0] first to add Upper Floor';
      }
    } else if (pieceId === 'roof') {
      rotY = Math.round(this.houseGhostRotY / Math.PI) * Math.PI;
      const roofLevel = standFloor + 1;
      gy = Number((baseDeckY + roofLevel * WALL_HEIGHT).toFixed(2));
      const supportFloorY = baseDeckY + standFloor * WALL_HEIGHT;

      let hasColumn = false;
      let hasDuplicate = false;
      for (const s of this.structures.values()) {
        const d = Math.hypot(s.data.x - gx, s.data.z - gz);
        if (d > 0.8) continue;
        if (standFloor === 0 && s.data.type === 'foundation' && Math.abs(s.data.y + 0.46 - supportFloorY) < 0.65) {
          hasColumn = true;
        }
        if (standFloor >= 1 && s.data.type === 'upper_floor' && Math.abs(s.data.y - supportFloorY) < 0.65) {
          hasColumn = true;
        }
        if ((s.data.type === 'roof' || s.data.type === 'upper_floor') && Math.abs(s.data.y - gy) < 0.65) {
          hasDuplicate = true;
        }
      }

      if (!hasColumn) {
        canPlace = false;
        failReason = 'Place over a Foundation or Upper Floor';
      } else if (hasDuplicate) {
        canPlace = false;
        failReason = 'Roof or Upper Floor already covers this cell';
      }
    } else if (pieceId === 'wall' || pieceId === 'window_wall' || pieceId === 'doorway') {
      const nsX = Math.round(ax / GRID_SIZE) * GRID_SIZE;
      const nsZ = Math.round((az - 2) / GRID_SIZE) * GRID_SIZE + 2;
      const ewX = Math.round((ax - 2) / GRID_SIZE) * GRID_SIZE + 2;
      const ewZ = Math.round(az / GRID_SIZE) * GRID_SIZE;

      const dNs = Math.hypot(ax - nsX, az - nsZ);
      const dEw = Math.hypot(ax - ewX, az - ewZ);

      if (dNs <= dEw) {
        gx = nsX;
        gz = nsZ;
        rotY = this.houseGhostFlip ? Math.PI : 0;
      } else {
        gx = ewX;
        gz = ewZ;
        rotY = this.houseGhostFlip ? -Math.PI / 2 : Math.PI / 2;
      }

      gy = Number((baseDeckY + standFloor * WALL_HEIGHT).toFixed(2));

      let bordersFloor = false;
      let duplicateWall = false;
      for (const s of this.structures.values()) {
        if (standFloor === 0 && s.data.type === 'foundation') {
          if (
            Math.abs(s.data.x - gx) <= 2.35 &&
            Math.abs(s.data.z - gz) <= 2.35 &&
            Math.abs(s.data.y + 0.46 - gy) < 0.7
          ) {
            bordersFloor = true;
          }
        }
        if (standFloor >= 1 && s.data.type === 'upper_floor') {
          if (
            Math.abs(s.data.x - gx) <= 2.35 &&
            Math.abs(s.data.z - gz) <= 2.35 &&
            Math.abs(s.data.y - gy) < 0.7
          ) {
            bordersFloor = true;
          }
        }
        if (
          (s.data.type === 'wall' || s.data.type === 'window_wall' || s.data.type === 'doorway') &&
          Math.hypot(s.data.x - gx, s.data.z - gz) < 0.65 &&
          Math.abs(s.data.y - gy) < 0.65
        ) {
          duplicateWall = true;
        }
      }

      if (!bordersFloor) {
        canPlace = false;
        failReason =
          standFloor === 0
            ? 'Snap wall along any Foundation edge'
            : 'Snap wall along an Upper Floor edge';
      } else if (duplicateWall) {
        canPlace = false;
        failReason = 'Demolish existing wall [0] here first';
      }
    } else {
      // hearth / bedroll / workbench: 0.5m snap on current floor or outdoor ground
      gx = Math.round(ax * 2) / 2;
      gz = Math.round(az * 2) / 2;
      const targetFloorY = baseDeckY + standFloor * WALL_HEIGHT;

      let floorDeckAtSpot: number | null = null;
      for (const s of this.structures.values()) {
        if (Math.abs(s.data.x - gx) <= 1.85 && Math.abs(s.data.z - gz) <= 1.85) {
          if (s.data.type === 'foundation' && standFloor === 0) {
            floorDeckAtSpot = s.data.y + 0.46;
          }
          if (s.data.type === 'upper_floor' && Math.abs(s.data.y - targetFloorY) < 0.7) {
            floorDeckAtSpot = s.data.y;
          }
        }
      }

      if (floorDeckAtSpot !== null) {
        gy = Number(floorDeckAtSpot.toFixed(2));
      } else if (standFloor === 0) {
        const groundY = groundHeightAt(gx, gz);
        gy = Number(groundY.toFixed(2));
        if (groundY < LAKE_LEVEL + 0.35) {
          canPlace = false;
          failReason = 'Cannot place in lake water';
        }
      } else {
        canPlace = false;
        failReason = 'Must rest on an Upper Floor deck';
      }

      if (canPlace) {
        for (const s of this.structures.values()) {
          if (
            (s.data.type === 'hearth' || s.data.type === 'bedroll' || s.data.type === 'workbench') &&
            Math.hypot(s.data.x - gx, s.data.z - gz) < 1.1 &&
            Math.abs(s.data.y - gy) < 1.2
          ) {
            canPlace = false;
            failReason = 'Too close to existing furniture';
            break;
          }
        }
      }
    }

    return { gx, gy, gz, rotY, canPlace, failReason };
  }

  private computeDecorMovePlacement(decId: DecorationItemId): {
    gx: number;
    gy: number;
    gz: number;
    rotY: number;
    canPlace: boolean;
    failReason: string;
  } {
    const isWallDecor =
      decId === 'mountain_painting' || decId === 'wall_clock' || decId === 'wall_lantern_lamp';

    const aimNdc = this.getAimNdc();
    const refDeck =
      this.getNearestFoundationDeckY(this.playerPos.x, this.playerPos.z) ??
      groundHeightAt(this.playerPos.x, this.playerPos.z) + 0.46;
    const refFeetY = this.playerPos.y - 1.72;
    const refRelY = refFeetY - refDeck;
    const refAutoFloor =
      refRelY > WALL_HEIGHT * 1.65 ? 2 : refRelY > WALL_HEIGHT * 0.65 ? 1 : 0;
    const refStandFloor =
      this.houseBuildFloorOverride === 'auto' ? refAutoFloor : this.houseBuildFloorOverride;
    const cursorFloorPt = this.getCursorFloorPoint(refDeck + refStandFloor * WALL_HEIGHT, 12);

    const fallbackX = Math.round(cursorFloorPt.x * 4) / 4;
    const fallbackZ = Math.round(cursorFloorPt.z * 4) / 4;

    if (isWallDecor) {
      this.raycaster.setFromCamera(aimNdc, this.camera);
      const wallGroups = Array.from(this.structures.values())
        .filter((s) => s.data.type === 'wall' || s.data.type === 'window_wall' || s.data.type === 'doorway')
        .map((s) => s.group);
      const hits = this.raycaster.intersectObjects(wallGroups, true);
      const hit = hits[0];
      if (hit && hit.distance <= 10.5 && hit.face) {
        const worldNormal = hit.face.normal
          .clone()
          .transformDirection(hit.object.matrixWorld)
          .normalize();
        const horizLen = Math.hypot(worldNormal.x, worldNormal.z);
        if (horizLen > 0.45) {
          const nx = worldNormal.x / horizLen;
          const nz = worldNormal.z / horizLen;
          const px = Number((hit.point.x + nx * 0.14).toFixed(2));
          const pz = Number((hit.point.z + nz * 0.14).toFixed(2));
          const py = Number(THREE.MathUtils.clamp(hit.point.y, groundHeightAt(px, pz) + 0.8, hit.point.y).toFixed(2));
          const ry = Math.atan2(nx, nz);
          return { gx: px, gy: py, gz: pz, rotY: ry, canPlace: true, failReason: '' };
        }
      }

      const wallPlanePt = this.getCursorFloorPoint(
        refDeck + refStandFloor * WALL_HEIGHT + 1.85,
        10,
      );
      const wallX = Math.round(wallPlanePt.x * 4) / 4;
      const wallZ = Math.round(wallPlanePt.z * 4) / 4;
      const nearestDeck = this.getNearestFoundationDeckY(wallX, wallZ) ?? groundHeightAt(wallX, wallZ) + 0.46;
      const gy = Number((nearestDeck + refStandFloor * WALL_HEIGHT + 1.85).toFixed(2));
      return {
        gx: wallX,
        gy,
        gz: wallZ,
        rotY: this.houseGhostRotY,
        canPlace: true,
        failReason: '',
      };
    }

    // Floor or tabletop decor
    const nearestDeck = this.getNearestFoundationDeckY(fallbackX, fallbackZ) ?? groundHeightAt(fallbackX, fallbackZ) + 0.46;
    const feetY = this.playerPos.y - 1.72;
    const relY = feetY - nearestDeck;
    const autoFloor = relY > WALL_HEIGHT * 1.65 ? 2 : relY > WALL_HEIGHT * 0.65 ? 1 : 0;
    const standFloor = this.houseBuildFloorOverride === 'auto' ? autoFloor : this.houseBuildFloorOverride;
    const targetFloorY = nearestDeck + standFloor * WALL_HEIGHT;

    let gx = fallbackX;
    let gz = fallbackZ;

    // If aiming directly at a floor/upper floor within 11m, snap right onto the aimed point
    this.raycaster.setFromCamera(aimNdc, this.camera);
    const floorGroups = Array.from(this.structures.values())
      .filter((s) => s.data.type === 'foundation' || s.data.type === 'upper_floor')
      .map((s) => s.group);
    const floorHits = this.raycaster.intersectObjects(floorGroups, true);
    if (floorHits.length > 0 && floorHits[0].distance <= 11.5) {
      gx = Math.round(floorHits[0].point.x * 4) / 4;
      gz = Math.round(floorHits[0].point.z * 4) / 4;
    }

    let deckAtSpot: number | null = null;
    for (const s of this.structures.values()) {
      if (Math.abs(s.data.x - gx) <= 1.95 && Math.abs(s.data.z - gz) <= 1.95) {
        if (s.data.type === 'foundation' && standFloor === 0) {
          deckAtSpot = s.data.y + 0.46;
        }
        if (s.data.type === 'upper_floor' && Math.abs(s.data.y - targetFloorY) < 0.7) {
          deckAtSpot = s.data.y;
        }
      }
    }

    let gy: number;
    let canPlace = true;
    let failReason = '';
    if (deckAtSpot !== null) {
      gy = Number(deckAtSpot.toFixed(2));
    } else if (standFloor === 0) {
      const groundY = groundHeightAt(gx, gz);
      gy = Number(groundY.toFixed(2));
      if (groundY < LAKE_LEVEL + 0.35) {
        canPlace = false;
        failReason = 'Cannot place decor in lake water';
      }
    } else {
      gy = Number(targetFloorY.toFixed(2));
      canPlace = false;
      failReason = 'Must rest on an Upper Floor deck';
    }

    return { gx, gy, gz, rotY: this.houseGhostRotY, canPlace, failReason };
  }

  private syncHouseGhost(): void {
    if (!this.houseBuildMode) {
      if (this.houseGhostGroup) {
        this.scene.remove(this.houseGhostGroup);
        this.disposeGhostGroup(this.houseGhostGroup);
        this.houseGhostGroup = null;
      }
      this.houseGhostVisualKey = '';
      this.houseDemolishTargetId = null;
      this.houseDemolishLabel = null;
      this.houseMoveTargetKind = null;
      return;
    }

    const pieceId = this.houseBuildPiece;

    if (pieceId === 'move') {
      if (!this.houseMovingElement) {
        // Step 1: Aim or hover cursor at any structure or placed decoration/lamp to pick it up
        this.houseDemolishTargetId = null;
        this.houseDemolishLabel = null;
        this.houseMoveTargetKind = null;
        this.houseGhostCanPlace = false;
        this.houseBuildFailReason = 'Click & Hold any Wall, Door, Roof, Stairs, Floor, Player Kitchen, or Tab Lamp to drag';

        const hit = this.findMovableElementUnderRay(this.getAimNdc(), true, 10.0);
        if (hit) {
          if (hit.kind === 'structure' && this.structures.has(hit.id)) {
            const entry = this.structures.get(hit.id)!;
            const t = entry.data.type;
            const def = HOUSE_BUILD_PIECES.find((p) => p.id === t);
            this.houseDemolishTargetId = entry.data.id;
            this.houseDemolishLabel = t === 'workbench' ? 'Player Kitchen' : def ? def.shortName : t;
            this.houseMoveTargetKind = 'structure';
            this.houseGhostCanPlace = true;
            this.houseBuildFailReason = '';

            const dims: [number, number, number] =
              t === 'wall' || t === 'window_wall' || t === 'doorway'
                ? [4.1, 3.25, 0.55]
                : t === 'foundation' || t === 'upper_floor' || t === 'stairs' || t === 'roof'
                  ? [4.15, t === 'stairs' ? 3.25 : t === 'roof' ? 1.25 : 0.45, 4.15]
                  : [1.8, 1.8, 1.8];
            const yMid =
              t === 'upper_floor'
                ? -0.11
                : t === 'foundation'
                  ? 0.28
                  : dims[1] * 0.5;
            const key = `move_st_hl_${t}`;
            if (!this.houseGhostGroup || this.houseGhostVisualKey !== key) {
              if (this.houseGhostGroup) {
                this.scene.remove(this.houseGhostGroup);
                this.disposeGhostGroup(this.houseGhostGroup);
              }
              const grp = new THREE.Group();
              const box = new THREE.Mesh(
                new THREE.BoxGeometry(dims[0], dims[1], dims[2]),
                new THREE.MeshBasicMaterial({
                  color: '#38bdf8',
                  transparent: true,
                  opacity: 0.32,
                  depthWrite: false,
                }),
              );
              box.position.y = yMid;
              grp.add(box);
              this.houseGhostGroup = grp;
              this.houseGhostVisualKey = key;
              this.scene.add(grp);
            }
            this.houseGhostGroup.visible = true;
            this.houseGhostGroup.position.set(entry.data.x, entry.data.y, entry.data.z);
            this.houseGhostGroup.rotation.y = entry.data.rotationY;
            return;
          }

          const decId = hit.id as DecorationItemId;
          if (hit.kind === 'decor' && this.decorationMeshes.has(decId)) {
            const mesh = this.decorationMeshes.get(decId)!;
            this.houseDemolishTargetId = decId;
            this.houseDemolishLabel = ITEM_CATALOG[decId].name;
            this.houseMoveTargetKind = 'decor';
            this.houseGhostCanPlace = true;
            this.houseBuildFailReason = '';

            const key = `move_dec_hl_${decId}`;
            if (!this.houseGhostGroup || this.houseGhostVisualKey !== key) {
              if (this.houseGhostGroup) {
                this.scene.remove(this.houseGhostGroup);
                this.disposeGhostGroup(this.houseGhostGroup);
              }
              const prevPos = mesh.position.clone();
              const prevRot = mesh.rotation.y;
              mesh.position.set(0, 0, 0);
              mesh.rotation.y = 0;
              mesh.updateMatrixWorld(true);
              const box = new THREE.Box3().setFromObject(mesh);
              mesh.position.copy(prevPos);
              mesh.rotation.y = prevRot;
              mesh.updateMatrixWorld(true);
              const size = new THREE.Vector3();
              const center = new THREE.Vector3();
              box.getSize(size);
              box.getCenter(center);

              const grp = new THREE.Group();
              const hl = new THREE.Mesh(
                new THREE.BoxGeometry(
                  Math.max(0.55, size.x + 0.18),
                  Math.max(0.45, size.y + 0.16),
                  Math.max(0.55, size.z + 0.18),
                ),
                new THREE.MeshBasicMaterial({
                  color: '#38bdf8',
                  transparent: true,
                  opacity: 0.34,
                  depthWrite: false,
                }),
              );
              hl.position.copy(center);
              grp.add(hl);
              this.houseGhostGroup = grp;
              this.houseGhostVisualKey = key;
              this.scene.add(grp);
            }
            this.houseGhostGroup.visible = true;
            this.houseGhostGroup.position.copy(mesh.position);
            this.houseGhostGroup.rotation.y = mesh.rotation.y;
            return;
          }
        }
        if (this.houseGhostGroup) this.houseGhostGroup.visible = false;
        return;
      }

      // Step 2: Carrying an element — preview new position
      this.houseDemolishTargetId = null;
      this.houseDemolishLabel = null;
      this.houseMoveTargetKind = null;

      if (this.houseMovingElement.kind === 'structure') {
        const stData = this.houseMovingElement.data;
        const key = `move_carry_st_${stData.type}`;
        if (!this.houseGhostGroup || this.houseGhostVisualKey !== key) {
          if (this.houseGhostGroup) {
            this.scene.remove(this.houseGhostGroup);
            this.disposeGhostGroup(this.houseGhostGroup);
          }
          const preview = buildStructureModel(stData.type, this.mats, {
            lit: stData.lit,
            doorOpen: stData.doorOpen,
          });
          preview.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = false;
              m.receiveShadow = false;
              m.material = new THREE.MeshBasicMaterial({
                color: '#38bdf8',
                transparent: true,
                opacity: 0.46,
                depthWrite: false,
              });
            }
          });
          this.houseGhostGroup = preview;
          this.houseGhostVisualKey = key;
          this.scene.add(preview);
        }
        this.houseGhostGroup.visible = true;

        const placement = this.computeStructurePlacement(stData.type);
        this.houseGhostX = placement.gx;
        this.houseGhostY = placement.gy;
        this.houseGhostZ = placement.gz;
        this.houseGhostRotY = placement.rotY;
        this.houseGhostCanPlace = placement.canPlace;
        this.houseBuildFailReason = placement.failReason;

        this.houseGhostGroup.position.set(placement.gx, placement.gy, placement.gz);
        this.houseGhostGroup.rotation.y = placement.rotY;
      } else {
        const decId = this.houseMovingElement.decId;
        const key = `move_carry_dec_${decId}`;
        if (!this.houseGhostGroup || this.houseGhostVisualKey !== key) {
          if (this.houseGhostGroup) {
            this.scene.remove(this.houseGhostGroup);
            this.disposeGhostGroup(this.houseGhostGroup);
          }
          const preview = buildDecorationModel(decId, this.mats);
          preview.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = false;
              m.receiveShadow = false;
              m.material = new THREE.MeshBasicMaterial({
                color: '#38bdf8',
                transparent: true,
                opacity: 0.48,
                depthWrite: false,
              });
            }
          });
          this.houseGhostGroup = preview;
          this.houseGhostVisualKey = key;
          this.scene.add(preview);
        }
        this.houseGhostGroup.visible = true;

        const placement = this.computeDecorMovePlacement(decId);
        this.houseGhostX = placement.gx;
        this.houseGhostY = placement.gy;
        this.houseGhostZ = placement.gz;
        this.houseGhostRotY = placement.rotY;
        this.houseGhostCanPlace = placement.canPlace;
        this.houseBuildFailReason = placement.failReason;

        this.houseGhostGroup.position.set(placement.gx, placement.gy, placement.gz);
        this.houseGhostGroup.rotation.y = placement.rotY;
      }

      const tint = this.houseGhostCanPlace ? '#38bdf8' : '#f43f5e';
      this.houseGhostGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.color.set(tint);
        }
      });
      return;
    }

    if (pieceId === 'demolish') {
      this.houseDemolishTargetId = null;
      this.houseDemolishLabel = null;
      this.houseMoveTargetKind = null;
      this.houseGhostCanPlace = false;
      this.houseBuildFailReason = 'Aim at any wall, roof, stairs, or floor piece to remove it';

      this.raycaster.setFromCamera(this.getAimNdc(), this.camera);
      const stGroups = Array.from(this.structures.values()).map((s) => s.group);
      const hits = this.raycaster.intersectObjects(stGroups, true);
      if (hits.length > 0 && hits[0].distance <= 8.0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData.structureId) obj = obj.parent;
        const id = obj?.userData.structureId as string | undefined;
        const entry = id ? this.structures.get(id) : undefined;
        if (entry) {
          this.houseDemolishTargetId = entry.data.id;
          const t = entry.data.type;
          const def = HOUSE_BUILD_PIECES.find((p) => p.id === t);
          this.houseDemolishLabel = t === 'workbench' ? 'Player Kitchen' : def ? def.shortName : t;
          if (t === 'workbench') {
            this.houseGhostCanPlace = false;
            this.houseBuildFailReason = 'Player Kitchen cannot be demolished (use Move [M] instead)';
          } else {
            this.houseGhostCanPlace = true;
            this.houseBuildFailReason = '';
          }
          this.houseGhostX = entry.data.x;
          this.houseGhostY = entry.data.y;
          this.houseGhostZ = entry.data.z;
          this.houseGhostRotY = entry.data.rotationY;

          const key = `demolish_${t}`;
          if (!this.houseGhostGroup || this.houseGhostVisualKey !== key) {
            if (this.houseGhostGroup) {
              this.scene.remove(this.houseGhostGroup);
              this.disposeGhostGroup(this.houseGhostGroup);
            }
            const dims: [number, number, number] =
              t === 'wall' || t === 'window_wall' || t === 'doorway'
                ? [4.1, 3.25, 0.55]
                : t === 'foundation' || t === 'upper_floor' || t === 'stairs' || t === 'roof'
                  ? [4.15, t === 'stairs' ? 3.25 : t === 'roof' ? 1.25 : 0.45, 4.15]
                  : [1.8, 1.8, 1.8];
            const yMid =
              t === 'upper_floor'
                ? -0.11
                : t === 'foundation'
                  ? 0.28
                  : dims[1] * 0.5;
            const grp = new THREE.Group();
            const box = new THREE.Mesh(
              new THREE.BoxGeometry(dims[0], dims[1], dims[2]),
              new THREE.MeshBasicMaterial({
                color: '#f43f5e',
                transparent: true,
                opacity: 0.34,
                depthWrite: false,
              }),
            );
            box.position.y = yMid;
            grp.add(box);
            this.houseGhostGroup = grp;
            this.houseGhostVisualKey = key;
            this.scene.add(grp);
          }
          this.houseGhostGroup.visible = true;
          this.houseGhostGroup.position.set(entry.data.x, entry.data.y, entry.data.z);
          this.houseGhostGroup.rotation.y = entry.data.rotationY;
          return;
        }
      }
      if (this.houseGhostGroup) this.houseGhostGroup.visible = false;
      return;
    }

    // Build / Extend placement mode
    this.houseDemolishTargetId = null;
    this.houseDemolishLabel = null;
    this.houseMoveTargetKind = null;

    if (!this.houseGhostGroup || this.houseGhostVisualKey !== pieceId) {
      if (this.houseGhostGroup) {
        this.scene.remove(this.houseGhostGroup);
        this.disposeGhostGroup(this.houseGhostGroup);
      }
      const preview = buildStructureModel(pieceId as StructureType, this.mats, {});
      preview.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.castShadow = false;
          m.receiveShadow = false;
          m.material = new THREE.MeshBasicMaterial({
            color: '#34d399',
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          });
        }
      });
      this.houseGhostGroup = preview;
      this.houseGhostVisualKey = pieceId;
      this.scene.add(preview);
    }
    this.houseGhostGroup.visible = true;

    const placement = this.computeStructurePlacement(pieceId as StructureType);
    this.houseGhostX = placement.gx;
    this.houseGhostY = placement.gy;
    this.houseGhostZ = placement.gz;
    this.houseGhostRotY = placement.rotY;
    this.houseGhostCanPlace = placement.canPlace;
    this.houseBuildFailReason = placement.failReason;

    this.houseGhostGroup.position.set(placement.gx, placement.gy, placement.gz);
    this.houseGhostGroup.rotation.y = placement.rotY;

    const tint = placement.canPlace ? '#34d399' : '#f43f5e';
    this.houseGhostGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.color.set(tint);
      }
    });
  }

  private syncUpperFloorStairCutouts(): void {
    const stairsList: StructureEntry[] = [];
    const upperList: StructureEntry[] = [];
    this.structures.forEach((s) => {
      if (s.data.type === 'stairs') stairsList.push(s);
      else if (s.data.type === 'upper_floor') upperList.push(s);
    });

    for (const uf of upperList) {
      const matchStair = stairsList.find(
        (st) =>
          Math.hypot(st.data.x - uf.data.x, st.data.z - uf.data.z) < 0.7 &&
          Math.abs(st.data.y + WALL_HEIGHT - uf.data.y) < 0.65,
      );
      const desiredCutout = matchStair ? matchStair.data.rotationY - uf.data.rotationY : undefined;
      const changed =
        (desiredCutout === undefined) !== (uf.stairCutoutRotY === undefined) ||
        (desiredCutout !== undefined &&
          uf.stairCutoutRotY !== undefined &&
          Math.abs(desiredCutout - uf.stairCutoutRotY) > 0.01);

      if (changed) {
        this.scene.remove(uf.group);
        const rebuilt = buildStructureModel('upper_floor', this.mats, {
          stairCutoutRotY: desiredCutout,
        });
        rebuilt.position.set(uf.data.x, uf.data.y, uf.data.z);
        rebuilt.rotation.y = uf.data.rotationY;
        rebuilt.userData.structureId = uf.data.id;
        this.scene.add(rebuilt);
        uf.group = rebuilt;
        uf.stairCutoutRotY = desiredCutout;
      }
    }
  }

  public confirmHouseBuildAction(): boolean {
    if (!this.houseBuildMode) return false;
    this.syncHouseGhost();

    if (this.houseBuildPiece === 'move') {
      if (!this.houseMovingElement) {
        if (!this.houseDemolishTargetId || !this.houseMoveTargetKind) {
          this.emitToast('Look directly at any house wall, roof, stairs, floor, or decor item to move it.', 'warning');
          soundEngine.playUiTone(250);
          return false;
        }
        if (this.houseMoveTargetKind === 'structure') {
          const entry = this.structures.get(this.houseDemolishTargetId);
          if (!entry) return false;
          this.houseMovingElement = { kind: 'structure', data: { ...entry.data } };
          this.houseGhostRotY = entry.data.rotationY;
          this.houseGhostFlip = Math.abs(Math.round(entry.data.rotationY / Math.PI)) % 2;
          this.scene.remove(entry.group);
          this.structures.delete(entry.data.id);
          if (entry.data.type === 'stairs' || entry.data.type === 'upper_floor') {
            this.syncUpperFloorStairCutouts();
          }
          const label = this.getMovingElementLabel() || 'Element';
          soundEngine.playUiTone(680);
          this.emitToast(`Picked up ${label} — aim at new spot, [R] Rotate, [E / Click] Place`, 'info');
          this.houseGhostVisualKey = '';
          this.syncHouseGhost();
          this.emitHud();
          return true;
        } else {
          const decId = this.houseDemolishTargetId as DecorationItemId;
          const mesh = this.decorationMeshes.get(decId);
          if (!mesh) return false;
          const origPos = {
            x: Number(mesh.position.x.toFixed(2)),
            y: Number(mesh.position.y.toFixed(2)),
            z: Number(mesh.position.z.toFixed(2)),
            ry: mesh.rotation.y,
          };
          this.houseMovingElement = { kind: 'decor', decId, origPos };
          this.houseGhostRotY = origPos.ry;
          mesh.visible = false;
          soundEngine.playUiTone(680);
          this.emitToast(
            `Picked up ${ITEM_CATALOG[decId].name} — aim at new spot, [R] Rotate, [E / Click] Place`,
            'info',
          );
          this.houseGhostVisualKey = '';
          this.syncHouseGhost();
          this.emitHud();
          return true;
        }
      }

      // Step 2: Place the held element
      if (!this.houseGhostCanPlace) {
        this.emitToast(this.houseBuildFailReason || 'Cannot place element here.', 'warning');
        soundEngine.playUiTone(250);
        return false;
      }

      if (this.houseMovingElement.kind === 'structure') {
        const updated: PlacedStructure = {
          ...this.houseMovingElement.data,
          x: Number(this.houseGhostX.toFixed(2)),
          y: Number(this.houseGhostY.toFixed(2)),
          z: Number(this.houseGhostZ.toFixed(2)),
          rotationY: this.houseGhostRotY,
        };
        if (updated.type === 'foundation' || updated.type === 'stairs') {
          this.clearHarvestNodesNear(updated.x, updated.z, 2.7);
        }
        const label = this.getMovingElementLabel() || 'Element';
        this.houseMovingElement = null;
        this.houseGhostVisualKey = '';
        this.spawnStructureMesh(updated, true);
        if (updated.type === 'stairs' || updated.type === 'upper_floor') {
          this.syncUpperFloorStairCutouts();
        }
        this.spawnBurst(updated.x, updated.y + 0.5, updated.z, '#38bdf8', 18);
        soundEngine.playBuild();
        this.emitToast(`Moved ${label}!`, 'gold');
        this.syncHouseGhost();
        this.saveToStorage();
        this.emitHud();
        return true;
      } else {
        const decId = this.houseMovingElement.decId;
        this.decorationPositions[decId] = {
          x: Number(this.houseGhostX.toFixed(2)),
          y: Number(this.houseGhostY.toFixed(2)),
          z: Number(this.houseGhostZ.toFixed(2)),
          ry: this.houseGhostRotY,
        };
        this.houseMovingElement = null;
        this.houseGhostVisualKey = '';
        this.syncDecorationsInWorld();
        this.spawnBurst(this.houseGhostX, this.houseGhostY + 0.4, this.houseGhostZ, '#38bdf8', 16);
        soundEngine.playBuild();
        this.emitToast(`Moved ${ITEM_CATALOG[decId].name}!`, 'gold');
        this.syncHouseGhost();
        this.saveToStorage();
        this.emitHud();
        return true;
      }
    }

    if (this.houseBuildPiece === 'demolish') {
      if (!this.houseDemolishTargetId) {
        this.emitToast('Look directly at a wall, roof, stairs, or floor piece to remove it.', 'warning');
        return false;
      }
      const target = this.structures.get(this.houseDemolishTargetId);
      if (!target) return false;
      if (target.data.type === 'workbench') {
        this.emitToast('Your Player Kitchen cannot be demolished (click & hold to move it).', 'warning');
        soundEngine.playUiTone(250);
        return false;
      }

      const t = target.data.type;
      const def = HOUSE_BUILD_PIECES.find((p) => p.id === t);
      this.scene.remove(target.group);
      this.structures.delete(target.data.id);

      let refundMsg = '';
      if (def) {
        const refunded: string[] = [];
        for (const [k, qty] of Object.entries(def.materials)) {
          const back = Math.max(1, Math.floor((qty || 0) * 0.75));
          this.inventory[k as ItemId] = (this.inventory[k as ItemId] || 0) + back;
          refunded.push(`+${back} ${ITEM_CATALOG[k as ItemId].name}`);
        }
        refundMsg = refunded.join(', ');
      }

      this.spawnBurst(target.data.x, target.data.y + 0.8, target.data.z, '#c49664', 18);
      if (t === 'stairs' || t === 'upper_floor') {
        this.syncUpperFloorStairCutouts();
      }
      soundEngine.playChop('wood');
      this.emitToast(
        `Removed ${def ? def.shortName : t}${refundMsg ? ` (${refundMsg})` : ''}.`,
        'info',
      );
      this.syncHouseGhost();
      this.saveToStorage();
      this.emitHud();
      return true;
    }

    if (!this.houseGhostCanPlace) {
      this.emitToast(this.houseBuildFailReason || 'Cannot place piece here.', 'warning');
      soundEngine.playUiTone(250);
      return false;
    }

    const def = HOUSE_BUILD_PIECES.find((p) => p.id === this.houseBuildPiece);
    if (!def) return false;
    if (!this.payForPiece(def)) return false;

    const newPiece: PlacedStructure = {
      id: `hb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: this.houseBuildPiece as StructureType,
      x: Number(this.houseGhostX.toFixed(2)),
      y: Number(this.houseGhostY.toFixed(2)),
      z: Number(this.houseGhostZ.toFixed(2)),
      rotationY: this.houseGhostRotY,
      lit: this.houseBuildPiece === 'hearth' ? true : undefined,
      doorOpen: this.houseBuildPiece === 'doorway' ? false : undefined,
    };

    if (newPiece.type === 'foundation' || newPiece.type === 'stairs') {
      this.clearHarvestNodesNear(newPiece.x, newPiece.z, 2.7);
    }

    this.spawnStructureMesh(newPiece, true);
    if (newPiece.type === 'stairs' || newPiece.type === 'upper_floor') {
      this.syncUpperFloorStairCutouts();
    }

    this.spawnBurst(newPiece.x, newPiece.y + 0.5, newPiece.z, '#d6a46f', 20);
    soundEngine.playBuild();
    this.emitToast(`Built ${def.shortName}!`, 'gold');
    this.syncHouseGhost();
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public quickExtendStarterRoom(): boolean {
    const baseY = Number(groundHeightAt(0, 0).toFixed(2));
    const deckY = Number((baseY + 0.46).toFixed(2));
    const roofY = Number((deckY + WALL_HEIGHT).toFixed(2));

    // Candidate 4x4m cells adjacent to the starter cabin (prefer West or South extension)
    const candidates: Array<{
      cx: number;
      cz: number;
      joinEdge: { x: number; z: number };
      outerEdges: Array<{ x: number; z: number; ry: number; type: 'wall' | 'window_wall' }>;
    }> = [
      {
        cx: -4,
        cz: 0,
        joinEdge: { x: -2, z: 0 },
        outerEdges: [
          { x: -6, z: 0, ry: Math.PI / 2, type: 'window_wall' },
          { x: -4, z: -2, ry: 0, type: 'wall' },
          { x: -4, z: 2, ry: 0, type: 'wall' },
        ],
      },
      {
        cx: -4,
        cz: 4,
        joinEdge: { x: -2, z: 4 },
        outerEdges: [
          { x: -6, z: 4, ry: Math.PI / 2, type: 'window_wall' },
          { x: -4, z: 6, ry: 0, type: 'wall' },
          { x: -4, z: 2, ry: 0, type: 'window_wall' },
        ],
      },
      {
        cx: 0,
        cz: 8,
        joinEdge: { x: 0, z: 6 },
        outerEdges: [
          { x: 0, z: 10, ry: 0, type: 'window_wall' },
          { x: -2, z: 8, ry: Math.PI / 2, type: 'wall' },
          { x: 2, z: 8, ry: Math.PI / 2, type: 'window_wall' },
        ],
      },
      {
        cx: 0,
        cz: -4,
        joinEdge: { x: 0, z: -2 },
        outerEdges: [
          { x: 0, z: -6, ry: 0, type: 'window_wall' },
          { x: -2, z: -4, ry: Math.PI / 2, type: 'wall' },
          { x: 2, z: -4, ry: Math.PI / 2, type: 'window_wall' },
        ],
      },
    ];

    const spot = candidates.find((cand) => {
      let hasFound = false;
      this.structures.forEach((s) => {
        if (s.data.type === 'foundation' && Math.hypot(s.data.x - cand.cx, s.data.z - cand.cz) < 1.2) {
          hasFound = true;
        }
      });
      const nearBakery =
        this.bakery.stage !== 'none' &&
        Math.hypot(cand.cx - this.bakery.x, cand.cz - this.bakery.z) < 4.8;
      return !hasFound && !nearBakery;
    });

    if (!spot) {
      this.emitToast(
        'Starter cabin is already extended on nearby sides! Use [V] House Builder to expand further.',
        'info',
      );
      return false;
    }

    const wingCost = 36;
    if (this.gold < wingCost) {
      this.emitToast(`Need $${wingCost} to quick-extend your house (or build piece-by-piece with [V]).`, 'warning');
      return false;
    }
    this.gold -= wingCost;

    // Remove the connecting wall between starter cabin and new wing so rooms join into one interior
    for (const [id, entry] of this.structures.entries()) {
      if (
        (entry.data.type === 'wall' || entry.data.type === 'window_wall') &&
        Math.hypot(entry.data.x - spot.joinEdge.x, entry.data.z - spot.joinEdge.z) < 0.7 &&
        Math.abs(entry.data.y - deckY) < 0.7
      ) {
        this.scene.remove(entry.group);
        this.structures.delete(id);
      }
    }

    this.clearHarvestNodesNear(spot.cx, spot.cz, 3.0);

    const pieces: PlacedStructure[] = [
      {
        id: `ext_f_${Date.now()}_${spot.cx}_${spot.cz}`,
        type: 'foundation',
        x: spot.cx,
        y: baseY,
        z: spot.cz,
        rotationY: 0,
      },
      {
        id: `ext_r_${Date.now()}_${spot.cx}_${spot.cz}`,
        type: 'roof',
        x: spot.cx,
        y: roofY,
        z: spot.cz,
        rotationY: 0,
      },
    ];

    spot.outerEdges.forEach((edge, idx) => {
      let exists = false;
      this.structures.forEach((s) => {
        if (
          (s.data.type === 'wall' || s.data.type === 'window_wall' || s.data.type === 'doorway') &&
          Math.hypot(s.data.x - edge.x, s.data.z - edge.z) < 0.7 &&
          Math.abs(s.data.y - deckY) < 0.7
        ) {
          exists = true;
        }
      });
      if (!exists) {
        pieces.push({
          id: `ext_w_${Date.now()}_${idx}_${spot.cx}`,
          type: edge.type,
          x: edge.x,
          y: deckY,
          z: edge.z,
          rotationY: edge.ry,
        });
      }
    });

    pieces.forEach((p) => this.spawnStructureMesh(p, true));
    this.spawnBurst(spot.cx, deckY + 1.0, spot.cz, '#d6a46f', 26);
    soundEngine.playBuild();
    this.emitToast('Extended your house with a connected 4×4m wing! (-$36)', 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  public quickAddSecondStory(): boolean {
    const baseY = Number(groundHeightAt(0, 0).toFixed(2));
    const deckY = Number((baseY + 0.46).toFixed(2));
    const floor1Y = Number((deckY + WALL_HEIGHT).toFixed(2));
    const roof2Y = Number((floor1Y + WALL_HEIGHT).toFixed(2));

    let alreadyHasUpper = false;
    this.structures.forEach((s) => {
      if (s.data.type === 'upper_floor' && Math.hypot(s.data.x, s.data.z - 2) < 5) {
        alreadyHasUpper = true;
      }
    });
    if (alreadyHasUpper) {
      this.emitToast(
        'Your house already has a 2nd story! Use [V] House Builder to extend upper floors & roofs.',
        'info',
      );
      return false;
    }

    const storyCost = 58;
    if (this.gold < storyCost) {
      this.emitToast(`Need $${storyCost} to add a complete 2nd floor + stairs (or use [V] Builder).`, 'warning');
      return false;
    }
    this.gold -= storyCost;

    // Remove starter 1st-floor roofs over (0, 0) and (0, 4)
    for (const [id, entry] of this.structures.entries()) {
      if (
        entry.data.type === 'roof' &&
        Math.abs(entry.data.y - floor1Y) < 0.7 &&
        Math.abs(entry.data.x - 0) < 0.8 &&
        (Math.abs(entry.data.z - 0) < 0.8 || Math.abs(entry.data.z - 4) < 0.8)
      ) {
        this.scene.remove(entry.group);
        this.structures.delete(id);
      }
    }

    const secondFloorPieces: PlacedStructure[] = [
      // Stairs on north bay climbing from center (+Z) to north (-Z)
      { id: `up_stairs_${Date.now()}`, type: 'stairs', x: 0, y: deckY, z: 0, rotationY: 0 },
      // Upper floor decks (stairwell bay auto-cuts out!)
      { id: `up_floor0_${Date.now()}`, type: 'upper_floor', x: 0, y: floor1Y, z: 0, rotationY: 0 },
      { id: `up_floor1_${Date.now()}`, type: 'upper_floor', x: 0, y: floor1Y, z: 4, rotationY: 0 },
      // 2nd story walls & panoramic windows
      { id: `up_w_n_${Date.now()}`, type: 'window_wall', x: 0, y: floor1Y, z: -2, rotationY: 0 },
      { id: `up_w_s_${Date.now()}`, type: 'window_wall', x: 0, y: floor1Y, z: 6, rotationY: 0 },
      { id: `up_w_w0_${Date.now()}`, type: 'wall', x: -2, y: floor1Y, z: 0, rotationY: Math.PI / 2 },
      { id: `up_w_w1_${Date.now()}`, type: 'window_wall', x: -2, y: floor1Y, z: 4, rotationY: Math.PI / 2 },
      { id: `up_w_e0_${Date.now()}`, type: 'window_wall', x: 2, y: floor1Y, z: 0, rotationY: Math.PI / 2 },
      { id: `up_w_e1_${Date.now()}`, type: 'wall', x: 2, y: floor1Y, z: 4, rotationY: Math.PI / 2 },
      // New 2nd story pitched roofs
      { id: `up_roof0_${Date.now()}`, type: 'roof', x: 0, y: roof2Y, z: 0, rotationY: 0 },
      { id: `up_roof1_${Date.now()}`, type: 'roof', x: 0, y: roof2Y, z: 4, rotationY: 0 },
    ];

    secondFloorPieces.forEach((p) => this.spawnStructureMesh(p, true));
    this.syncUpperFloorStairCutouts();
    this.spawnBurst(0, floor1Y + 1.0, 2, '#e2b47c', 36);
    soundEngine.playBuild();
    this.emitToast('Added a 2nd Floor + Wooden Stairs to your house! Walk up the stairs inside. (-$58)', 'gold');
    this.saveToStorage();
    this.emitHud();
    return true;
  }

  private syncBakeryGhost(): void {
    if (!this.bakeryBuildMode) {
      if (this.bakeryGhostGroup) {
        this.scene.remove(this.bakeryGhostGroup);
        this.bakeryGhostGroup = null;
      }
      return;
    }

    if (!this.bakeryGhostGroup) {
      const grp = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(5.4, 3.2, 4.6),
        new THREE.MeshBasicMaterial({
          color: '#34d399',
          transparent: true,
          opacity: 0.28,
          wireframe: false,
        }),
      );
      box.position.y = 1.6;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(5.44, 3.22, 4.64)),
        new THREE.LineBasicMaterial({ color: '#6ee7b7' }),
      );
      edges.position.y = 1.6;
      grp.add(box, edges);
      this.bakeryGhostGroup = grp;
      this.scene.add(grp);
    }

    const dirX = -Math.sin(this.playerYaw);
    const dirZ = -Math.cos(this.playerYaw);
    const gx = Math.round((this.playerPos.x + dirX * 6.5) * 2) / 2;
    const gz = Math.round((this.playerPos.z + dirZ * 6.5) * 2) / 2;
    const gy = groundHeightAt(gx, gz);

    let canPlace = gy >= LAKE_LEVEL + 0.5 && Math.hypot(gx, gz) <= PLAYABLE_RADIUS - 6;
    if (Math.abs(gx - 0) < 5.2 && Math.abs(gz - 2) < 6.8) canPlace = false; // Clear of starter house
    for (const c of this.villageCottages) {
      if (Math.hypot(gx - c.x, gz - c.z) < 6.5) canPlace = false;
    }

    this.bakeryGhostX = gx;
    this.bakeryGhostZ = gz;
    this.bakeryGhostCanPlace = canPlace;

    this.bakeryGhostGroup.position.set(gx, gy, gz);
    this.bakeryGhostGroup.rotation.y = this.bakeryGhostRotY;
    const mesh = this.bakeryGhostGroup.children[0] as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(canPlace ? '#34d399' : '#f43f5e');
  }

  private worldToBakeryLocal(x: number, z: number): { lx: number; lz: number } {
    const dx = x - this.bakery.x;
    const dz = z - this.bakery.z;
    const c = Math.cos(this.bakery.rotationY);
    const s = Math.sin(this.bakery.rotationY);
    return {
      lx: dx * c - dz * s,
      lz: dx * s + dz * c,
    };
  }

  private clearHarvestNodesNearBakery(): void {
    if (this.bakery.stage === 'none') return;
    for (const node of this.harvestNodes) {
      if (!node.mesh.visible) continue;
      const { lx, lz } = this.worldToBakeryLocal(node.x, node.z);
      if (Math.abs(lx) < 3.6 && Math.abs(lz) < 3.6) {
        node.mesh.visible = false;
        node.respawnTimer = 999999;
      }
    }
  }

  private syncBakeryInWorld(): void {
    if (this.bakeryGroup) {
      this.scene.remove(this.bakeryGroup);
      this.bakeryGroup = null;
      this.bakeryFireLight = null;
    }
    if (this.bakery.stage === 'none') return;

    this.clearHarvestNodesNearBakery();

    const gy = groundHeightAt(this.bakery.x, this.bakery.z);
    if (this.bakery.stage === 'foundation') {
      this.bakeryGroup = buildBakeryFrameModel(this.mats);
      this.bakeryGroup.position.set(this.bakery.x, gy - 0.05, this.bakery.z);
      this.bakeryGroup.rotation.y = this.bakery.rotationY;
      this.bakeryGroup.userData.bakeryStage = 'foundation';
      this.scene.add(this.bakeryGroup);
      return;
    }

    this.bakeryGroup = buildBakeryShopModel(this.mats, {
      shopName: this.bakery.shopName,
      isOpen: this.bakery.isOpen,
    });
    this.bakeryGroup.position.set(this.bakery.x, gy - 0.05, this.bakery.z);
    this.bakeryGroup.rotation.y = this.bakery.rotationY;
    this.bakeryGroup.userData.bakeryStage = 'built';

    const lantern = new THREE.PointLight('#ffaa4a', 2.8, 16, 1.7);
    lantern.position.set(-1.3, 2.75, 2.45);
    this.bakeryGroup.add(lantern);
    this.bakeryFireLight = lantern;

    this.scene.add(this.bakeryGroup);
    this.syncBakeryShelvesInWorld();
  }

  private syncBakeryShelvesInWorld(): void {
    if (!this.bakeryGroup || this.bakery.stage !== 'built') return;
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const bay = this.bakeryGroup.getObjectByName(`shelfBay_${sIdx}`);
      if (!bay) continue;
      while (bay.children.length > 0) {
        bay.remove(bay.children[0]);
      }
      if (sIdx < this.bakery.shelvesOwned) {
        const shelfMesh = buildBakeryShelfModel(this.mats);
        shelfMesh.name = `bakeryShelfMesh_${sIdx}`;
        shelfMesh.userData.shelfIndex = sIdx;
        shelfMesh.traverse((child) => {
          child.userData.shelfIndex = sIdx;
        });
        bay.add(shelfMesh);
      }
    }
    this.refreshBakeryShelfItems();
  }

  private refreshBakeryShelfItems(): void {
    if (!this.bakeryGroup || this.bakery.stage !== 'built') return;
    for (let sIdx = 0; sIdx < this.bakery.shelvesOwned; sIdx++) {
      const bay = this.bakeryGroup.getObjectByName(`shelfBay_${sIdx}`);
      if (!bay) continue;
      for (let t = 0; t < 2; t++) {
        const tierAnchor = bay.getObjectByName(`shelfTier_${t}`);
        if (!tierAnchor) continue;
        while (tierAnchor.children.length > 0) {
          tierAnchor.remove(tierAnchor.children[0]);
        }
        const slot = this.bakery.shelves[sIdx * 2 + t];
        if (slot && slot.pastryId && slot.stock > 0) {
          const displayCount = Math.min(3, slot.stock);
          for (let k = 0; k < displayCount; k++) {
            const mini = buildPastryMiniMesh(slot.pastryId, this.mats);
            mini.position.x = (k - (displayCount - 1) * 0.5) * 0.31;
            tierAnchor.add(mini);
          }
        }
      }
    }
  }

  private refreshBakerySignboard(): void {
    if (!this.bakeryGroup || this.bakery.stage !== 'built') return;
    const signMesh = this.bakeryGroup.getObjectByName('bakerySignMesh') as THREE.Mesh | undefined;
    if (signMesh && Array.isArray(signMesh.material)) {
      const tex = createSignboardTexture(this.bakery.shopName, this.bakery.isOpen);
      const faceMat = signMesh.material[4] as THREE.MeshStandardMaterial;
      faceMat.map = tex;
      faceMat.needsUpdate = true;
    }
  }

  private syncDecorationsInWorld(): void {
    this.decorationMeshes.forEach((m) => this.scene.remove(m));
    this.decorationMeshes.clear();
    this.decorLights = [];

    const baseY = Number(groundHeightAt(0, 0).toFixed(2));
    const deckY = Number((baseY + 0.46).toFixed(2));

    const layout: Record<DecorationItemId, { x: number; y: number; z: number; ry: number }> = {
      woven_rug: { x: 0.2, y: deckY, z: 2.3, ry: 0 },
      potted_fern: { x: -1.35, y: deckY, z: 0.3, ry: 0.4 },
      oak_dining_table: { x: 0.9, y: deckY, z: 2.35, ry: 0 },
      mountain_painting: { x: 0.3, y: deckY + 1.88, z: -1.8, ry: 0 },
      brass_candelabra: { x: 1.38, y: deckY, z: 4.9, ry: -0.4 },
      wall_clock: { x: -1.8, y: deckY + 1.85, z: 3.4, ry: Math.PI / 2 },
      table_lamp: { x: -1.35, y: deckY, z: 2.1, ry: 0.2 },
      floor_lamp: { x: 1.38, y: deckY, z: -1.35, ry: -0.5 },
      wall_lantern_lamp: { x: -1.8, y: deckY + 1.95, z: 1.5, ry: Math.PI / 2 },
      plush_armchair: { x: 1.12, y: deckY, z: 3.85, ry: -2.45 },
      pine_bookshelf: { x: -1.48, y: deckY, z: -1.15, ry: Math.PI / 2 },
    };

    for (const decId of this.decorationsPlaced) {
      const pos = this.decorationPositions[decId] ?? layout[decId];
      if (!pos) continue;
      const mesh = buildDecorationModel(decId, this.mats);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.y = pos.ry;
      mesh.userData.decorId = decId;

      if (decId === 'brass_candelabra') {
        const pt = new THREE.PointLight('#ffbb66', 2.4, 11, 1.8);
        pt.position.set(0, 1.4, 0);
        mesh.add(pt);
        this.decorLights.push(pt);
      } else if (decId === 'table_lamp') {
        const pt = new THREE.PointLight('#ffc878', 2.8, 12, 1.65);
        pt.position.set(0, 1.08, 0);
        mesh.add(pt);
        this.decorLights.push(pt);
      } else if (decId === 'floor_lamp') {
        const pt = new THREE.PointLight('#ffd088', 3.4, 14, 1.55);
        pt.position.set(0, 1.72, 0);
        mesh.add(pt);
        this.decorLights.push(pt);
      } else if (decId === 'wall_lantern_lamp') {
        const pt = new THREE.PointLight('#ffbb68', 2.9, 12, 1.65);
        pt.position.set(0, -0.02, 0.28);
        mesh.add(pt);
        this.decorLights.push(pt);
      }

      this.scene.add(mesh);
      this.decorationMeshes.set(decId, mesh);
    }
  }

  private syncDeliveryParcelInWorld(): void {
    const hasAtDoor = this.pendingDeliveries.some((d) => d.status === 'at_door');
    if (!hasAtDoor) {
      if (this.deliveryParcelMesh) {
        this.scene.remove(this.deliveryParcelMesh);
        this.deliveryParcelMesh = null;
      }
      return;
    }

    if (!this.deliveryParcelMesh) {
      const parcel = buildDeliveryParcelModel(this.mats);
      const px = 2.85;
      const pz = -0.65;
      const py = groundHeightAt(px, pz);
      parcel.position.set(px, py - 0.02, pz);
      parcel.rotation.y = 0.25;
      parcel.userData.deliveryParcel = true;
      this.scene.add(parcel);
      this.deliveryParcelMesh = parcel;
    }
  }

  private tickDeliveries(dt: number): void {
    if (this.pendingDeliveries.length === 0) return;

    let anyChanged = false;
    let hasTransit = false;
    const newlyArrived: DecorationItemId[] = [];

    for (const order of this.pendingDeliveries) {
      if (order.status === 'in_transit') {
        hasTransit = true;
        order.remainingSec = Math.max(0, order.remainingSec - dt);
        if (order.remainingSec <= 0) {
          order.status = 'at_door';
          newlyArrived.push(order.itemId);
          anyChanged = true;
        }
      }
    }

    if (newlyArrived.length > 0) {
      this.syncDeliveryParcelInWorld();
      soundEngine.playCoinSale();
      const names = newlyArrived.map((id) => ITEM_CATALOG[id].name).join(', ');
      this.emitToast(
        `Doorstep delivery arrived: ${names}! Pick up the parcel at your front door [E].`,
        'gold',
      );
      this.saveToStorage(false);
    }

    this.deliveryUiTimer += dt;
    if (anyChanged || (hasTransit && this.deliveryUiTimer >= 0.45)) {
      this.deliveryUiTimer = 0;
      this.emitHud();
    }
  }

  private buildNearbySmallHouses(): void {
    const specs: Array<{ id: string; x: number; z: number; rotY: number; isSupply: boolean }> = [
      // Village Rain & Gear Supply House directly across the Main Road
      { id: 'cottage_supply', x: 16.8, z: -3.5, rotY: -Math.PI / 2, isSupply: true },
      // Neighbor cottages nearby along the valley roads
      { id: 'cottage_lake', x: -8.5, z: 16.5, rotY: Math.PI * 0.78, isSupply: false },
      { id: 'cottage_north', x: 3.8, z: -24.0, rotY: Math.PI * 0.5, isSupply: false },
      { id: 'cottage_east', x: 28.5, z: -2.5, rotY: 0, isSupply: false },
    ];

    specs.forEach((spec) => {
      const y = groundHeightAt(spec.x, spec.z);
      const mesh = buildVillageCottageModel(this.mats, { isSupplyShop: spec.isSupply });
      mesh.position.set(spec.x, y - 0.08, spec.z);
      mesh.rotation.y = spec.rotY;
      mesh.userData.cottageId = spec.id;
      mesh.userData.isSupply = spec.isSupply;
      this.scene.add(mesh);

      this.villageCottages.push({
        id: spec.id,
        x: spec.x,
        z: spec.z,
        rotY: spec.rotY,
        isSupply: spec.isSupply,
        mesh,
      });
    });
  }

  private spawnStructureMesh(data: PlacedStructure, animateSpring: boolean): void {
    let stairCutoutRotY: number | undefined;
    if (data.type === 'upper_floor') {
      for (const s of this.structures.values()) {
        if (
          s.data.type === 'stairs' &&
          Math.hypot(s.data.x - data.x, s.data.z - data.z) < 0.7 &&
          Math.abs(s.data.y + WALL_HEIGHT - data.y) < 0.65
        ) {
          stairCutoutRotY = s.data.rotationY - data.rotationY;
          break;
        }
      }
    }

    const group = buildStructureModel(data.type, this.mats, {
      shopName: this.shopName,
      isOpen: this.shopIsOpen,
      lit: data.lit,
      doorOpen: data.doorOpen,
      stairCutoutRotY,
    });
    group.position.set(data.x, data.y, data.z);
    group.rotation.y = data.rotationY;
    group.userData.structureId = data.id;

    let fireLight: THREE.PointLight | undefined;
    if (data.type === 'hearth') {
      fireLight = new THREE.PointLight('#ff9438', data.lit ? 3.8 : 0, 15, 1.7);
      fireLight.position.set(0, 0.85, 0.35);
      group.add(fireLight);
    }

    if (animateSpring) {
      group.scale.set(0.75, 0.45, 0.75);
    }

    this.scene.add(group);
    this.structures.set(data.id, {
      data,
      group,
      spawnSpring: animateSpring ? 0 : 1,
      fireLight,
      doorAnim: data.doorOpen ? 1 : 0,
      stairCutoutRotY,
    });
  }

  private hasStructureType(type: StructureType): boolean {
    for (const s of this.structures.values()) {
      if (s.data.type === type) return true;
    }
    return false;
  }

  // =========================================================================
  // Interactions & Harvesting
  // =========================================================================

  private updateInteractionTarget(): void {
    if (!this.started) {
      this.currentPrompt = null;
      return;
    }

    if (this.bakeryBuildMode) {
      this.currentPrompt = {
        id: 'bakery_ghost',
        label: this.bakeryGhostCanPlace
          ? `[E / Click] Place Bakery Foundation ($${BAKERY_COSTS.foundationGold})`
          : 'Move to Clear Ground to Place Bakery',
        sublabel: 'Press [R] to Rotate · Right-Click to Cancel',
        actionType: 'bakery_frame',
      };
      return;
    }

    if (this.houseBuildMode) {
      if (this.houseWheelOpen) {
        this.currentPrompt = null;
        return;
      }
      if (this.houseBuildPiece === 'move') {
        if (this.houseMovingElement) {
          const movingName = this.getMovingElementLabel() || 'Element';
          this.currentPrompt = {
            id: 'house_move_place',
            label: this.houseGhostCanPlace
              ? `Drag & Release or [Click / E] to Place ${movingName}`
              : this.houseBuildFailReason || `Cannot place ${movingName} here`,
            sublabel: '[R] Rotate · [Z] Floor Story · [Right-Click] Cancel Move',
            actionType: 'harvest',
          };
        } else {
          this.currentPrompt = {
            id: 'house_move_pick',
            label: this.houseGhostCanPlace
              ? `Click & Hold (or [E]) to Move ${this.houseDemolishLabel || 'Element'}`
              : this.houseBuildFailReason || 'Click & Hold any Wall, Door, Roof, Stairs, Floor, Player Kitchen, or Lamp to Move',
            sublabel: '[Q] Circular Wheel · [1-9] Pieces · [V / Right-Click] Exit',
            actionType: 'harvest',
          };
        }
        return;
      }
      if (this.houseBuildPiece === 'demolish') {
        this.currentPrompt = {
          id: 'house_demolish',
          label: this.houseGhostCanPlace
            ? `[E / Click] Remove ${this.houseDemolishLabel || 'Structure'} (Refund Materials)`
            : this.houseBuildFailReason || 'Aim at a Wall, Roof, Stairs, or Floor to Remove',
          sublabel: '[Q] Circular Wheel · [1-9] Select Piece · [V / Right-Click] Exit',
          actionType: 'harvest',
        };
      } else {
        const def = HOUSE_BUILD_PIECES.find((p) => p.id === this.houseBuildPiece)!;
        this.currentPrompt = {
          id: 'house_ghost',
          label: this.houseGhostCanPlace
            ? `[E / Click] Build ${def.shortName}`
            : this.houseBuildFailReason || `Cannot place ${def.shortName} here`,
          sublabel: `${this.getStructureCostLabel(def)} · [Q] Wheel · [R] Rotate · [Z] Story · [V] Exit`,
          actionType: 'harvest',
        };
      }
      return;
    }

    this.raycaster.setFromCamera(this.getAimNdc(), this.camera);

    // Check doorstep delivery parcel outside starter cabin front door
    if (this.deliveryParcelMesh) {
      const readyCount = this.pendingDeliveries.filter((d) => d.status === 'at_door').length;
      const parcelHits = this.raycaster.intersectObject(this.deliveryParcelMesh, true);
      const parcelDist = Math.hypot(this.playerPos.x - 2.85, this.playerPos.z + 0.65);
      if ((parcelHits.length > 0 && parcelHits[0].distance <= 4.5) || parcelDist <= 2.3) {
        this.currentPrompt = {
          id: 'delivery_parcel',
          label: `[E] Collect Doorstep Delivery (${readyCount})`,
          sublabel: 'Pick up delivered lamps & decor to install inside your house',
          actionType: 'delivery_parcel',
        };
        return;
      }
    }

    // Check valley travelers within 4.7m (prioritize Bakery Orders at counter!)
    const npcMeshes = this.travelers.map((t) => t.mesh);
    const npcHits = this.raycaster.intersectObjects(npcMeshes, true);
    if (npcHits.length > 0 && npcHits[0].distance <= 4.7) {
      let obj: THREE.Object3D | null = npcHits[0].object;
      while (obj && !obj.userData.travelerId) obj = obj.parent;
      const tId = obj?.userData.travelerId as string | undefined;
      const tr = this.travelers.find((t) => t.id === tId);
      if (tr) {
        const order = tr.orderId ? this.bakeryOrders.find((o) => o.id === tr.orderId) : undefined;
        if (order) {
          const pastryName = ITEM_CATALOG[order.pastryId].name;
          const timeLeft = `${Math.floor(Math.max(0, Math.ceil(order.remainingSec)) / 60)}:${String(Math.max(0, Math.ceil(order.remainingSec)) % 60).padStart(2, '0')}`;
          if (order.status === 'waiting_decision') {
            const stocked = this.getShelfStockForPastry(order.pastryId);
            this.currentPrompt = {
              id: tr.id,
              orderId: order.id,
              label: `[E] ${tr.name} Orders ${pastryName} ($${order.price})`,
              sublabel: `${timeLeft} left · On Shelves: ${stocked} · Take or Refuse Order`,
              actionType: 'bakery_order',
            };
          } else if (this.heldPastry === order.pastryId) {
            this.currentPrompt = {
              id: tr.id,
              orderId: order.id,
              label: `[E] Give ${pastryName} to ${tr.name} (+$${order.price})`,
              sublabel: `Serve before timer ends (${timeLeft} remaining)`,
              actionType: 'bakery_order',
            };
          } else {
            this.currentPrompt = {
              id: tr.id,
              orderId: order.id,
              label: `[E] Order Accepted: Grab ${pastryName} from Shelf`,
              sublabel: `${tr.name} is waiting (${timeLeft} left)`,
              actionType: 'bakery_order',
            };
          }
          return;
        }

        this.currentPrompt = {
          id: tr.id,
          label: `[E] Talk to ${tr.name}`,
          sublabel: tr.fulfilled
            ? `${tr.role} · Supplied`
            : `${tr.role} · Looking for ${ITEM_CATALOG[tr.wantedItemId].name}`,
          actionType: 'npc',
        };
        return;
      }
    }

    // Check player's Bakery Shop / Display Shelves / Construction Frame within 5.5m
    if (this.bakeryGroup && this.bakery.stage !== 'none') {
      const bakeryHits = this.raycaster.intersectObject(this.bakeryGroup, true);
      if (bakeryHits.length > 0 && bakeryHits[0].distance <= 5.5) {
        if (this.bakery.stage === 'foundation') {
          this.currentPrompt = {
            id: 'bakery_frame',
            label: `[E] Build Bakery Walls & Oven ($${BAKERY_COSTS.buildGold})`,
            sublabel: 'Construct your Bakery Shop to install shelves & sell pastries',
            actionType: 'bakery_frame',
          };
          return;
        }

        // Check if aiming directly at a purchased display shelf inside the shop
        let hitObj: THREE.Object3D | null = bakeryHits[0].object;
        let hitShelfIdx: number | undefined = undefined;
        while (hitObj && hitObj !== this.bakeryGroup) {
          if (typeof hitObj.userData.shelfIndex === 'number') {
            hitShelfIdx = hitObj.userData.shelfIndex;
            break;
          }
          hitObj = hitObj.parent;
        }

        if (hitShelfIdx !== undefined && bakeryHits[0].distance <= 3.8) {
          const topSlot = this.bakery.shelves[hitShelfIdx * 2];
          const botSlot = this.bakery.shelves[hitShelfIdx * 2 + 1];
          const acceptedForShelf =
            !this.heldPastry &&
            this.bakeryOrders.find(
              (o) =>
                o.status === 'accepted' &&
                ((topSlot?.pastryId === o.pastryId && topSlot.stock > 0) ||
                  (botSlot?.pastryId === o.pastryId && botSlot.stock > 0)),
            );

          if (acceptedForShelf) {
            this.currentPrompt = {
              id: `bakery_shelf_${hitShelfIdx}`,
              shelfIndex: hitShelfIdx,
              orderId: acceptedForShelf.id,
              label: `[E] Take ${ITEM_CATALOG[acceptedForShelf.pastryId].name} from Shelf #${hitShelfIdx + 1}`,
              sublabel: `Serve to ${acceptedForShelf.customerName} at counter`,
              actionType: 'bakery_shelf',
            };
            return;
          }

          const itemsSummary = [topSlot, botSlot]
            .filter((s) => s && s.pastryId && s.stock > 0)
            .map((s) => `${s.stock}× ${ITEM_CATALOG[s.pastryId!].name}`)
            .join(' · ');

          this.currentPrompt = {
            id: `bakery_shelf_${hitShelfIdx}`,
            shelfIndex: hitShelfIdx,
            label: `[E] Shelf #${hitShelfIdx + 1}: Store Cakes & Pastries`,
            sublabel: itemsSummary || 'Empty Shelf — Press [E] to store pastries',
            actionType: 'bakery_shelf',
          };
          return;
        }

        this.currentPrompt = {
          id: 'bakery_shop',
          label: '[E] Manage Bakery Shelves & Orders',
          sublabel: this.bakery.isOpen
            ? `${this.bakery.shopName} Open · ${this.bakery.shelvesOwned}/4 Shelves`
            : `${this.bakery.shopName} Closed · Open in Mobile to Earn`,
          actionType: 'bakery_shop',
        };
        return;
      }
    }

    // Check nearby Village Rain & Gear Supply Cottage within 5.6m
    const supplyCottage = this.villageCottages.find((c) => c.isSupply);
    if (supplyCottage) {
      const supplyHits = this.raycaster.intersectObject(supplyCottage.mesh, true);
      if (supplyHits.length > 0 && supplyHits[0].distance <= 5.6) {
        this.currentPrompt = {
          id: supplyCottage.id,
          label: '[E] Visit Rain & Gear Supply Shop',
          sublabel: 'Buy Waxed Raincoat ($35), Umbrella ($25) & Clothes',
          actionType: 'supply_shop',
        };
        return;
      }
    }

    // Check placed structures & Tab decorations/lights (closest hit wins!)
    const stGroups = Array.from(this.structures.values()).map((s) => s.group);
    const stHits = this.raycaster.intersectObjects(stGroups, true);
    const decorHits = this.raycaster.intersectObjects(
      Array.from(this.decorationMeshes.values()),
      true,
    );

    const closestDecorDist = decorHits.length > 0 ? decorHits[0].distance : Infinity;
    const closestStDist = stHits.length > 0 ? stHits[0].distance : Infinity;

    if (decorHits.length > 0 && closestDecorDist <= 5.2 && closestDecorDist <= closestStDist + 0.05) {
      let dObj: THREE.Object3D | null = decorHits[0].object;
      while (dObj && !dObj.userData.decorId) dObj = dObj.parent;
      const decId = dObj?.userData.decorId as DecorationItemId | undefined;
      if (decId) {
        this.currentPrompt = {
          id: decId,
          label: ITEM_CATALOG[decId].name,
          sublabel: 'Click & Hold to Move anywhere',
          actionType: 'decor',
        };
        return;
      }
    }

    if (stHits.length > 0 && closestStDist <= 4.2) {
      let obj: THREE.Object3D | null = stHits[0].object;
      while (obj && !obj.userData.structureId) obj = obj.parent;
      const id = obj?.userData.structureId as string | undefined;
      if (id) {
        const entry = this.structures.get(id);
        if (entry) {
          if (entry.data.type === 'doorway') {
            this.currentPrompt = {
              id,
              label: entry.data.doorOpen ? '[E] Close Cabin Door' : '[E] Open Cabin Door',
              actionType: 'door',
            };
            return;
          }
          if (entry.data.type === 'hearth') {
            this.currentPrompt = {
              id,
              label: entry.data.lit ? '[E] Bank Hearth Fire' : '[E] Light Hearth Fire',
              sublabel: 'Click & Hold to Move',
              actionType: 'hearth',
            };
            return;
          }
          if (entry.data.type === 'bedroll') {
            this.currentPrompt = {
              id,
              label: '[E] Rest Until Dawn',
              sublabel: 'Restores Health & Stamina · Click & Hold to Move',
              actionType: 'bedroll',
            };
            return;
          }
          if (entry.data.type === 'workbench') {
            this.currentPrompt = {
              id,
              label: '[E] Open Player Kitchen & Tab',
              sublabel: 'Click & Hold to Move anywhere',
              actionType: 'workbench',
            };
            return;
          }
        }
      }
    }

    // Check harvestable natural nodes within 4.2m
    const nodeMeshes = this.harvestNodes.filter((n) => n.mesh.visible).map((n) => n.mesh);
    const nodeHits = this.raycaster.intersectObjects(nodeMeshes, true);
    if (nodeHits.length > 0 && nodeHits[0].distance <= 4.2) {
      let obj: THREE.Object3D | null = nodeHits[0].object;
      while (obj && !obj.userData.harvestId) obj = obj.parent;
      const hId = obj?.userData.harvestId as string | undefined;
      const node = this.harvestNodes.find((n) => n.id === hId);
      if (node) {
        const labelMap: Record<HarvestNode['kind'], string> = {
          pine: '[E / Click] Chop Alpine Pine',
          log: '[E / Click] Split Fallen Cedar',
          stone: '[E / Click] Mine Alpine Granite',
          iron: '[E / Click] Mine Bog Iron Vein',
          berry: '[E / Click] Gather Juniper Berries',
        };
        this.currentPrompt = {
          id: node.id,
          label: labelMap[node.kind],
          sublabel: `Integrity ${node.hp}/${node.maxHp}`,
          actionType: 'harvest',
        };
        return;
      }
    }

    // Check if near lake water edge
    if (isInWater(this.playerPos.x, this.playerPos.z) || groundHeightAt(this.playerPos.x, this.playerPos.z) < LAKE_LEVEL + 0.55) {
      this.currentPrompt = {
        id: 'lake',
        label: '[E] Drink Glacial Water',
        sublabel: 'Refreshes Stamina (+18)',
        actionType: 'drink',
      };
      return;
    }

    this.currentPrompt = null;
  }

  private triggerPrimaryInteract(): void {
    this.toolSwing = 1.0;
    if (this.bakeryBuildMode) {
      this.confirmBakeryGhostPlacement();
      return;
    }
    if (this.houseBuildMode) {
      this.confirmHouseBuildAction();
      return;
    }

    const p = this.currentPrompt;
    if (!p) return;

    if (p.actionType === 'delivery_parcel') {
      this.collectDoorDeliveries();
      return;
    }

    if (p.actionType === 'bakery_frame') {
      this.upgradeBakeryToBuilt(false);
      return;
    }

    if (p.actionType === 'bakery_order' && p.orderId) {
      const order = this.bakeryOrders.find((o) => o.id === p.orderId);
      if (order) {
        if (order.status === 'accepted' && this.heldPastry === order.pastryId) {
          this.serveBakeryOrder(order.id);
          return;
        }
        if (document.pointerLockElement) document.exitPointerLock();
        this.callbacks.onOpenModal('bakery');
        return;
      }
    }

    if (p.actionType === 'bakery_shelf') {
      if (p.orderId) {
        const order = this.bakeryOrders.find((o) => o.id === p.orderId);
        if (order && order.status === 'accepted' && !this.heldPastry) {
          this.takePastryFromShelf(order.pastryId, p.shelfIndex);
          return;
        }
      }
      if (document.pointerLockElement) document.exitPointerLock();
      this.callbacks.onOpenModal('bakery');
      return;
    }

    if (p.actionType === 'bakery_shop') {
      if (document.pointerLockElement) document.exitPointerLock();
      this.callbacks.onOpenModal('bakery');
      return;
    }

    if (p.actionType === 'drink') {
      this.survival.stamina = Math.min(100, this.survival.stamina + 18);
      this.survival.hunger = Math.min(100, this.survival.hunger + 4);
      soundEngine.playFootstep('water');
      this.emitToast('Drank crisp glacial lake water.', 'info');
      this.emitHud();
      return;
    }

    if (p.actionType === 'door') {
      const entry = this.structures.get(p.id);
      if (entry) {
        entry.data.doorOpen = !entry.data.doorOpen;
        soundEngine.playBuild();
        this.saveToStorage();
        this.emitHud();
      }
      return;
    }

    if (p.actionType === 'hearth') {
      const entry = this.structures.get(p.id);
      if (entry) {
        entry.data.lit = !entry.data.lit;
        const flame = entry.group.getObjectByName('hearthFlame');
        if (flame) flame.visible = Boolean(entry.data.lit);
        if (entry.fireLight) entry.fireLight.intensity = entry.data.lit ? 3.8 : 0;
        soundEngine.playUiTone(entry.data.lit ? 640 : 320);
        this.saveToStorage();
        this.emitHud();
      }
      return;
    }

    if (p.actionType === 'bedroll') {
      this.meteorology.dayCount += 1;
      this.meteorology.timeOfDay = 6.5;
      this.survival.health = Math.min(100, this.survival.health + 45);
      this.survival.stamina = 100;
      this.survival.warmth = Math.min(100, this.survival.warmth + 35);
      this.survival.hunger = Math.max(15, this.survival.hunger - 14);
      soundEngine.playUiTone(540);
      this.emitToast(`Rested through the night. Welcome to Day ${this.meteorology.dayCount}.`, 'warm');
      this.saveToStorage();
      this.emitHud();
      return;
    }

    if (p.actionType === 'workbench' || p.actionType === 'counter') {
      if (document.pointerLockElement) document.exitPointerLock();
      this.callbacks.onOpenModal('storefront');
      return;
    }

    if (p.actionType === 'supply_shop') {
      if (document.pointerLockElement) document.exitPointerLock();
      this.callbacks.onOpenModal('supply');
      return;
    }

    if (p.actionType === 'signpost') {
      this.toggleShopOpen();
      return;
    }

    if (p.actionType === 'npc') {
      const tr = this.travelers.find((t) => t.id === p.id);
      if (tr) {
        if (tr.phase !== 'talking') {
          tr.preTalkPhase = tr.phase;
        }
        tr.phase = 'talking';
        tr.yaw = Math.atan2(this.playerPos.x - tr.x, this.playerPos.z - tr.z);
        tr.greetWave = 1.0;
        if (document.pointerLockElement) document.exitPointerLock();
        soundEngine.playUiTone(580);
        this.callbacks.onOpenNpcDialogue(this.buildNpcDialogueState(tr));
      }
      return;
    }

    if (p.actionType === 'harvest') {
      const node = this.harvestNodes.find((n) => n.id === p.id);
      if (!node || !node.mesh.visible) return;

      const dmg =
        (node.kind === 'pine' || node.kind === 'log') && this.activeTool === 'axe'
          ? 2
          : (node.kind === 'stone' || node.kind === 'iron') && this.activeTool === 'pickaxe'
            ? 2
            : 1;

      node.hp -= dmg;
      node.hitAnim = 1.0;

      if (node.kind === 'pine' || node.kind === 'log') {
        soundEngine.playChop('wood');
        this.spawnBurst(node.x, node.y + 1.1, node.z, '#9b6b43', 14);
      } else if (node.kind === 'stone' || node.kind === 'iron') {
        soundEngine.playChop('stone');
        this.spawnBurst(node.x, node.y + 0.7, node.z, '#8e969e', 14);
      } else {
        soundEngine.playChop('gather');
        this.spawnBurst(node.x, node.y + 0.5, node.z, '#b82841', 12);
      }

      if (node.hp <= 0) {
        node.mesh.visible = false;
        node.respawnTimer = 65;

        if (node.kind === 'pine') {
          const woodAmt = 4;
          const resinAmt = 1;
          this.inventory.wood += woodAmt;
          this.inventory.resin += resinAmt;
          this.emitToast(`+${woodAmt} Cedar Timber, +${resinAmt} Pine Resin`, 'info');
        } else if (node.kind === 'log') {
          this.inventory.wood += 3;
          this.emitToast('+3 Cedar Timber', 'info');
        } else if (node.kind === 'stone') {
          this.inventory.stone += 4;
          this.emitToast('+4 Alpine Granite', 'info');
        } else if (node.kind === 'iron') {
          this.inventory.stone += 2;
          this.inventory.iron += 2;
          this.emitToast('+2 Bog Iron Ore, +2 Granite', 'info');
        } else if (node.kind === 'berry') {
          this.inventory.berries += 3;
          if (Math.random() > 0.55) {
            this.inventory.pelt += 1;
            this.emitToast('+3 Juniper Berries, +1 Alpine Fleece', 'info');
          } else {
            this.emitToast('+3 Juniper Berries', 'info');
          }
        }
        this.saveToStorage();
      }
      this.emitHud();
    }
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: string, count: number): void {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x + (Math.random() - 0.5) * 0.4;
      pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
      vel[i * 3] = (Math.random() - 0.5) * 3.4;
      vel[i * 3 + 1] = 1.6 + Math.random() * 2.8;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: colorHex, size: 0.14 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.bursts.push({ points: pts, velocities: vel, age: 0, lifetime: 0.65 });
  }

  // =========================================================================
  // Core Simulation Loop
  // =========================================================================

  private tick = (): void => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const dt = Math.min(0.05, Math.max(0.001, rawDelta));
    const elapsed = this.clock.elapsedTime;

    if (this.started) {
      this.tickDeliveries(Math.min(0.25, Math.max(0.001, rawDelta)));
    }

    if (!this.paused) {
      this.updateMeteorology(dt, elapsed);
      if (this.started) {
        this.updatePlayerMovement(dt);
        this.updateSurvival(dt);
        this.updateStructures(dt, elapsed);
        this.updateHarvestNodes(dt);
        this.updateTravelers(dt, elapsed);
        this.tickBakeryOrders(Math.min(0.25, Math.max(0.001, rawDelta)));
        if (this.bakeryBuildMode) {
          this.syncBakeryGhost();
        } else if (this.houseBuildMode) {
          this.syncHouseGhost();
        }
        this.updateInteractionTarget();
      } else {
        // Gentle orbital showcase camera on arrival screen
        const a = elapsed * 0.09;
        this.camera.position.set(Math.sin(a) * 18, 9.5, Math.cos(a) * 18 + 6);
        this.camera.lookAt(-8, 2.2, 6);
      }
      this.updateWeatherParticles(dt, elapsed);
      this.updateBursts(dt);
      this.updateViewmodel(dt, elapsed);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.started) {
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.08) {
        this.hudSyncTimer = 0;
        this.emitHud();
      }
      this.autoSaveTimer += dt;
      if (this.autoSaveTimer >= 12) {
        this.autoSaveTimer = 0;
        this.saveToStorage(false);
      }
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateMeteorology(dt: number, elapsed: number): void {
    // 24 game hours = ~8 real minutes at 1x
    const hoursPerSec = (24 / 480) * this.timeScale;
    this.meteorology.timeOfDay += dt * hoursPerSec;
    if (this.meteorology.timeOfDay >= 24) {
      this.meteorology.timeOfDay -= 24;
      this.meteorology.dayCount += 1;
    }

    // Weather state machine progression
    this.weatherHoldTimer -= dt * this.timeScale;
    if (this.weatherHoldTimer <= 0) {
      this.meteorology.transitionProgress += dt * 0.08;
      if (this.meteorology.transitionProgress >= 1) {
        this.meteorology.weather = this.meteorology.nextWeather;
        this.meteorology.transitionProgress = 0;
        this.weatherHoldTimer = 45 + Math.random() * 40;
        const pool: WeatherType[] = ['Clear', 'Overcast', 'Rain', 'Thunderstorm', 'Fog', 'Snow', 'Blizzard'];
        const currIdx = pool.indexOf(this.meteorology.weather);
        const step = Math.random() > 0.35 ? 1 : -1;
        this.meteorology.nextWeather = pool[(currIdx + step + pool.length) % pool.length];
        this.emitToast(`Weather front shifting: ${this.meteorology.weather}`, 'info');
      }
    }

    const w = this.meteorology.weather;
    const targetPrecip =
      w === 'Rain' ? 0.65 : w === 'Thunderstorm' ? 1.0 : w === 'Snow' ? 0.58 : w === 'Blizzard' ? 1.0 : 0;
    const targetWind =
      w === 'Blizzard' ? 17.5 : w === 'Thunderstorm' ? 13.8 : w === 'Rain' ? 8.4 : w === 'Snow' ? 6.2 : w === 'Overcast' ? 4.8 : 2.8;
    const targetCloud =
      w === 'Clear' ? 0.14 : w === 'Fog' ? 0.65 : w === 'Overcast' ? 0.76 : 0.94;
    const targetHumidity =
      w === 'Rain' || w === 'Thunderstorm' || w === 'Fog' ? 88 : w === 'Snow' || w === 'Blizzard' ? 78 : 44;
    const targetPressure =
      w === 'Thunderstorm' || w === 'Blizzard' ? 994 : w === 'Rain' || w === 'Snow' ? 1004 : 1020;

    this.meteorology.precipitationIntensity = THREE.MathUtils.damp(
      this.meteorology.precipitationIntensity,
      targetPrecip,
      0.8,
      dt,
    );
    this.meteorology.windSpeedMs = THREE.MathUtils.damp(this.meteorology.windSpeedMs, targetWind, 0.7, dt);
    this.meteorology.humidity = Math.round(THREE.MathUtils.damp(this.meteorology.humidity, targetHumidity, 0.6, dt));
    this.meteorology.pressureHpa = Math.round(THREE.MathUtils.damp(this.meteorology.pressureHpa, targetPressure, 0.5, dt));

    const isSnowWeather = w === 'Snow' || w === 'Blizzard';
    const isRainWeather = w === 'Rain' || w === 'Thunderstorm';

    // Snow & Wetness accumulation on terrain
    if (isSnowWeather) {
      this.meteorology.snowAccumulation = Math.min(1, this.meteorology.snowAccumulation + dt * 0.025);
      this.meteorology.wetness = Math.max(0, this.meteorology.wetness - dt * 0.04);
    } else if (isRainWeather) {
      this.meteorology.wetness = Math.min(1, this.meteorology.wetness + dt * 0.05);
      this.meteorology.snowAccumulation = Math.max(0.05, this.meteorology.snowAccumulation - dt * 0.02);
    } else {
      this.meteorology.wetness = Math.max(0, this.meteorology.wetness - dt * 0.02);
      this.meteorology.snowAccumulation = Math.max(0.06, this.meteorology.snowAccumulation - dt * 0.008);
    }

    // Diurnal ambient temperature (°C)
    const hourAngle = ((this.meteorology.timeOfDay - 6) / 24) * Math.PI * 2;
    const diurnal = Math.sin(hourAngle) * 7.5; // warmer afternoon, colder pre-dawn
    const weatherTempOffset =
      w === 'Blizzard' ? -12 : w === 'Snow' ? -7 : w === 'Thunderstorm' ? -3 : w === 'Rain' ? -2 : 2;
    this.meteorology.ambientTempC = Number((6 + diurnal + weatherTempOffset).toFixed(1));

    // Sun & Sky Choreography
    const sunElev = Math.sin(hourAngle);
    const sunAz = Math.cos(hourAngle);
    this.sunLight.position.set(
      this.playerPos.x + sunAz * 70,
      Math.max(8, sunElev * 85),
      this.playerPos.z + 36,
    );
    this.sunLight.target.position.set(this.playerPos.x, 0, this.playerPos.z);

    const nightFactor = THREE.MathUtils.clamp((-sunElev + 0.1) * 2.6, 0, 1);
    const stormDarken = isRainWeather || w === 'Blizzard' ? 0.45 : w === 'Overcast' || w === 'Fog' ? 0.25 : 0;

    // Lightning in Thunderstorm
    if (w === 'Thunderstorm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 7 + Math.random() * 11;
        this.lightningFlash = 1.0;
        soundEngine.playThunder();
      }
    }
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.8);

    // Sky colors (pitch-deep midnight dark at night, even in storms)
    const dayRatio = 1 - nightFactor;
    _colorA.set('#286299').lerp(_colorC.set('#1f2630'), stormDarken * 0.75);
    _colorA.lerp(_colorC.set('#000104'), nightFactor);
    this.skyMat.uniforms.uTopColor.value.copy(_colorA);

    const sunsetFactor = Math.exp(-Math.pow(sunElev * 3.4, 2));
    _colorB.set('#a8cde4').lerp(_colorC.set('#df8f5d'), sunsetFactor * (1 - stormDarken));
    _colorB.lerp(_colorC.set('#2a3440'), stormDarken * 0.75);
    _colorB.lerp(_colorC.set('#010308'), nightFactor);
    this.skyMat.uniforms.uHorizonColor.value.copy(_colorB);

    this.skyMat.uniforms.uSunDir.value.set(sunAz, sunElev, 0.45).normalize();
    this.skyMat.uniforms.uCloudCover.value = THREE.MathUtils.damp(
      this.skyMat.uniforms.uCloudCover.value,
      targetCloud,
      0.7,
      dt,
    );
    this.skyMat.uniforms.uNightFactor.value = nightFactor;
    this.skyMat.uniforms.uTime.value = elapsed;
    this.skyMat.uniforms.uFlash.value = this.lightningFlash * 0.65;

    // Fog matched to horizon + denser night darkness shroud
    this.fog.color.copy(_colorB);
    const baseFog =
      w === 'Fog' ? 0.036 : w === 'Blizzard' ? 0.032 : w === 'Thunderstorm' ? 0.018 : w === 'Rain' || w === 'Snow' ? 0.014 : 0.0072;
    const targetFog = baseFog + nightFactor * 0.0055;
    this.fog.density = THREE.MathUtils.damp(this.fog.density, targetFog, 0.8, dt);

    // Light intensities & IBL environment attenuation for genuinely dark nights
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.88, 0.003, nightFactor) * (1 - stormDarken * 0.35);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.06, 0.52, nightFactor);

    const daySunInt = (1 - stormDarken * 0.72) * dayRatio;
    this.sunLight.intensity = 0.008 + daySunInt * 1.65 + this.lightningFlash * 2.4;
    this.sunLight.color
      .set('#fff1d6')
      .lerp(_colorC.set('#ffae70'), sunsetFactor * 0.7)
      .lerp(_colorC.set('#203254'), nightFactor);

    this.hemiLight.intensity = 0.008 + dayRatio * 0.56;
    this.hemiLight.color.set('#a8d0ee').lerp(_colorC.set('#040814'), nightFactor);
    this.hemiLight.groundColor.set('#4f4636').lerp(_colorC.set('#010204'), nightFactor);

    // Update terrain & foliage uniforms
    if (this.terrainMat.userData.shader) {
      this.terrainMat.userData.shader.uniforms.uSnowAccum.value = this.meteorology.snowAccumulation;
      this.terrainMat.userData.shader.uniforms.uWetness.value = this.meteorology.wetness;
    }
    this.forestShaderUniforms.time.value = elapsed;
    this.forestShaderUniforms.wind.value = 0.5 + this.meteorology.windSpeedMs * 0.14;
    this.waterMat.uniforms.uTime.value = elapsed;
    this.waterMat.uniforms.uSkyColor.value.copy(_colorB);
    this.waterMat.uniforms.uDeepColor.value.set('#173b4e').lerp(_colorC.set('#010206'), nightFactor);
    this.waterMat.uniforms.uWind.value = this.meteorology.windSpeedMs;
    this.waterMat.uniforms.uNightFactor.value = nightFactor;

    // Starter campfire, bakery porch lantern & candelabra flicker
    const flicker = 3.1 + Math.sin(elapsed * 14) * 0.35 + Math.cos(elapsed * 23) * 0.25;
    this.campFireLight.intensity = flicker;
    this.campFlameMesh.scale.set(1, 0.85 + Math.sin(elapsed * 18) * 0.18, 1);
    if (this.bakeryFireLight) {
      this.bakeryFireLight.intensity = (this.bakery.isOpen ? 3.2 : 1.6) + Math.sin(elapsed * 9) * 0.2;
    }
    this.decorLights.forEach((pt, idx) => {
      pt.intensity = 2.6 + Math.sin(elapsed * 10 + idx * 1.7) * 0.16;
    });

    soundEngine.updateAmbience(
      this.meteorology.windSpeedMs,
      this.meteorology.precipitationIntensity,
      isSnowWeather,
      this.survival.isSheltered,
      this.survival.nearFire,
    );
  }

  private updatePlayerMovement(dt: number): void {
    const forward = (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) - (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) - (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);

    const wantsSprint = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const canSprint = wantsSprint && this.survival.stamina > 6 && (forward !== 0 || strafe !== 0);
    const sickSpeedScale = this.survival.isSick ? 0.84 : 1.0;
    const speed = (canSprint ? 7.8 : 4.7) * sickSpeedScale;

    if (canSprint) {
      const sprintScale =
        (this.survival.packEquipped ? 0.75 : 1.0) * (this.survival.wearingRangerJacket ? 0.8 : 1.0);
      const drainRate = 12 * sprintScale;
      this.survival.stamina = Math.max(0, this.survival.stamina - drainRate * dt);
    } else {
      const baseRegen = this.survival.hunger > 20 ? 11 : 5;
      const regen = this.survival.isSick ? baseRegen * 0.42 : baseRegen;
      this.survival.stamina = Math.min(this.survival.maxStamina, this.survival.stamina + regen * dt);
    }

    // Dynamic FOV ease when sprinting
    const targetFov = canSprint ? 74 : 68;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }

    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);

    let moveX = (-sinY * forward + cosY * strafe);
    let moveZ = (-cosY * forward - sinY * strafe);
    const len = Math.hypot(moveX, moveZ);
    if (len > 0.001) {
      moveX = (moveX / len) * speed * dt;
      moveZ = (moveZ / len) * speed * dt;
    }

    const nextX = this.playerPos.x + moveX;
    const nextZ = this.playerPos.z + moveZ;

    // Collide against solid structures & outer boundary
    if (!this.collidesWithWorld(nextX, this.playerPos.z)) {
      this.playerPos.x = nextX;
    }
    if (!this.collidesWithWorld(this.playerPos.x, nextZ)) {
      this.playerPos.z = nextZ;
    }

    // Clamp within natural valley mountain rim
    const r = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (r > PLAYABLE_RADIUS) {
      const s = PLAYABLE_RADIUS / r;
      this.playerPos.x *= s;
      this.playerPos.z *= s;
    }

    // Floor height: terrain, cabin foundations, multi-story upper floors, walkable stairs, or bakery deck/step
    const currentFeetY = this.playerPos.y - 1.72;
    let floorY = groundHeightAt(this.playerPos.x, this.playerPos.z);
    let standingOnWood = false;
    let ceilingStopY: number | null = null;

    this.structures.forEach((s) => {
      const t = s.data.type;
      const sx = s.data.x;
      const sz = s.data.z;

      if (t === 'foundation') {
        if (Math.abs(this.playerPos.x - sx) <= GRID_SIZE * 0.52 && Math.abs(this.playerPos.z - sz) <= GRID_SIZE * 0.52) {
          const deckTop = s.data.y + 0.46;
          if (deckTop <= currentFeetY + 0.95 && deckTop > floorY) {
            floorY = deckTop;
            standingOnWood = true;
          }
        }
      } else if (t === 'upper_floor') {
        if (Math.abs(this.playerPos.x - sx) <= GRID_SIZE * 0.52 && Math.abs(this.playerPos.z - sz) <= GRID_SIZE * 0.52) {
          let overStairHole = false;
          if (s.stairCutoutRotY !== undefined) {
            const totalRot = s.data.rotationY + s.stairCutoutRotY;
            const dx = this.playerPos.x - sx;
            const dz = this.playerPos.z - sz;
            const c = Math.cos(totalRot);
            const sn = Math.sin(totalRot);
            const lx = dx * c - dz * sn;
            const lz = dx * sn + dz * c;
            if (Math.abs(lx) < 0.78 && lz > -1.32 && lz <= 2.06) {
              overStairHole = true;
            }
          }
          if (!overStairHole) {
            if (s.data.y <= currentFeetY + 0.95 && s.data.y > floorY) {
              floorY = s.data.y;
              standingOnWood = true;
            } else if (currentFeetY < s.data.y - 0.5) {
              const underside = s.data.y - 0.34;
              if (ceilingStopY === null || underside < ceilingStopY) {
                ceilingStopY = underside;
              }
            }
          }
        }
      } else if (t === 'stairs') {
        const dx = this.playerPos.x - sx;
        const dz = this.playerPos.z - sz;
        const c = Math.cos(s.data.rotationY);
        const sn = Math.sin(s.data.rotationY);
        const lx = dx * c - dz * sn;
        const lz = dx * sn + dz * c;
        if (Math.abs(lx) <= 0.86 && lz >= -2.06 && lz <= 2.06) {
          const frac =
            lz <= -1.45
              ? 1
              : lz >= 1.8
                ? 0
                : (1.8 - lz) / 3.25;
          const stairTop = s.data.y + frac * WALL_HEIGHT;
          if (currentFeetY >= s.data.y - 0.85 && stairTop <= currentFeetY + 1.05 && stairTop > floorY) {
            floorY = stairTop;
            standingOnWood = true;
          }
        }
      } else if (t === 'roof') {
        if (Math.abs(this.playerPos.x - sx) <= GRID_SIZE * 0.5 && Math.abs(this.playerPos.z - sz) <= GRID_SIZE * 0.5) {
          if (currentFeetY < s.data.y - 0.4) {
            const underside = s.data.y - 0.1;
            if (ceilingStopY === null || underside < ceilingStopY) {
              ceilingStopY = underside;
            }
          }
        }
      }
    });

    if (this.bakery.stage !== 'none') {
      const { lx, lz } = this.worldToBakeryLocal(this.playerPos.x, this.playerPos.z);
      const bakeryBaseY = groundHeightAt(this.bakery.x, this.bakery.z);
      if (Math.abs(lx) <= 2.76 && Math.abs(lz) <= 2.36) {
        const deckTop = bakeryBaseY + 0.58;
        if (deckTop > floorY) {
          floorY = deckTop;
          standingOnWood = true;
        }
      } else if (lx >= -1.35 && lx <= 1.85 && lz > 2.30 && lz <= 3.35) {
        const stepTop = bakeryBaseY + 0.28;
        if (stepTop > floorY) {
          floorY = stepTop;
          standingOnWood = true;
        }
      }
    }

    const minSurfaceY = Math.max(floorY, LAKE_LEVEL - 0.55);
    const eyeTargetY = minSurfaceY + 1.72;

    if (this.keys['Space'] && this.onGround) {
      this.playerVelY = 6.2;
      this.onGround = false;
    }

    this.playerVelY -= 16.5 * dt;
    this.playerPos.y += this.playerVelY * dt;
    if (ceilingStopY !== null && this.playerVelY > 0 && this.playerPos.y + 0.12 > ceilingStopY) {
      this.playerPos.y = Math.max(eyeTargetY, ceilingStopY - 0.12);
      this.playerVelY = 0;
    }
    if (this.playerPos.y <= eyeTargetY) {
      this.playerPos.y = eyeTargetY;
      this.playerVelY = 0;
      this.onGround = true;
    }

    // Smooth head-bob & footsteps
    if (len > 0.001 && this.onGround) {
      const distMoved = Math.hypot(moveX, moveZ);
      this.headBobPhase += dt * (canSprint ? 13.5 : 9.2);
      this.stepDistAccum += distMoved;
      if (this.stepDistAccum >= 1.95) {
        this.stepDistAccum = 0;
        const surf = standingOnWood
          ? 'wood'
          : isInWater(this.playerPos.x, this.playerPos.z)
            ? 'water'
            : this.meteorology.snowAccumulation > 0.35
              ? 'snow'
              : 'grass';
        soundEngine.playFootstep(surf);
      }
    } else {
      this.headBobPhase = THREE.MathUtils.damp(this.headBobPhase, 0, 5, dt);
    }

    this.syncCameraToPlayer(len > 0.001 && this.onGround ? Math.sin(this.headBobPhase) * 0.045 : 0);
  }

  private syncCameraToPlayer(bobOffsetY: number): void {
    this.camera.position.set(this.playerPos.x, this.playerPos.y + bobOffsetY, this.playerPos.z);
    _euler.set(this.playerPitch, this.playerYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);
  }

  private collidesWithWorld(x: number, z: number): boolean {
    const r = 0.42;
    const feetY = this.playerPos.y - 1.72;
    const pBot = feetY + 0.22;
    const pTop = feetY + 1.75;

    for (const s of this.structures.values()) {
      const t = s.data.type;
      if (t === 'foundation' || t === 'roof' || t === 'bedroll') continue;
      if (t === 'doorway' && s.data.doorOpen) continue;

      if (t === 'upper_floor') {
        if (s.stairCutoutRotY !== undefined && Math.abs(feetY - s.data.y) < 0.75) {
          // Stairwell safety handrails on upper floor leave front top-landing open (-Z)
          const totalRot = s.data.rotationY + s.stairCutoutRotY;
          const dx = x - s.data.x;
          const dz = z - s.data.z;
          const c = Math.cos(totalRot);
          const sn = Math.sin(totalRot);
          const lx = dx * c - dz * sn;
          const lz = dx * sn + dz * c;
          if (lz > -1.25 && lz < 2.02 && (Math.abs(Math.abs(lx) - 0.86) < 0.24)) {
            return true;
          }
          if (Math.abs(lx) < 0.92 && Math.abs(lz - 1.92) < 0.24) {
            return true;
          }
        }
        continue;
      }

      if (t === 'stairs') {
        if (feetY >= s.data.y - 0.6 && feetY < s.data.y + WALL_HEIGHT - 0.25) {
          const dx = x - s.data.x;
          const dz = z - s.data.z;
          const c = Math.cos(s.data.rotationY);
          const sn = Math.sin(s.data.rotationY);
          const lx = dx * c - dz * sn;
          const lz = dx * sn + dz * c;
          // Block walking into raised underside from lower floor
          if (feetY < s.data.y + 1.25 && Math.abs(lx) < 0.85 && lz < 0.22 && lz > -2.02) {
            return true;
          }
          // Stair side rails once raised above the first 2 steps
          if (feetY > s.data.y + 0.55 && lz > -1.45 && lz < 1.85 && Math.abs(Math.abs(lx) - 0.84) < 0.26) {
            return true;
          }
        }
        continue;
      }

      if (t === 'wall' || t === 'window_wall' || t === 'doorway') {
        if (pTop <= s.data.y + 0.08 || pBot >= s.data.y + WALL_HEIGHT - 0.08) continue;
        const rot90 = Math.round(s.data.rotationY / (Math.PI / 2)) % 2 !== 0;
        const halfX = rot90 ? 0.25 + r : GRID_SIZE * 0.48;
        const halfZ = rot90 ? GRID_SIZE * 0.48 : 0.25 + r;
        if (Math.abs(x - s.data.x) < halfX && Math.abs(z - s.data.z) < halfZ) {
          if (t === 'doorway' && !s.data.doorOpen) return true;
          if (t !== 'doorway') return true;
        }
      } else if (t === 'counter' || t === 'workbench' || t === 'hearth') {
        const objH = t === 'hearth' ? 1.8 : 1.15;
        if (pTop <= s.data.y + 0.08 || pBot >= s.data.y + objH) continue;
        if (Math.hypot(x - s.data.x, z - s.data.z) < 1.15) return true;
      }
    }

    for (const c of this.villageCottages) {
      if (Math.abs(x - c.x) < 2.8 && Math.abs(z - c.z) < 3.1) return true;
    }

    if (this.bakery.stage !== 'none') {
      const { lx, lz } = this.worldToBakeryLocal(x, z);

      if (this.bakery.stage === 'built') {
        if (Math.abs(lx) < 2.86 && Math.abs(lz) < 2.52) {
          // Back wall
          if (lz < -1.86) return true;
          // Side walls
          if (lx < -2.24 || lx > 2.24) return true;
          // Front-left pillar + serving counter (leaving wide right-front doorway lx in [0.42, 1.48] open!)
          if (lz > 1.52 && lx < 0.42) return true;
          // Front-right pillar
          if (lz > 1.82 && lx > 1.48) return true;
          // Brick artisan oven in back-left corner
          if (lx < -0.78 && lz < -0.68) return true;
        }
      } else if (this.bakery.stage === 'foundation') {
        // Lumber pile on foundation plot
        if (Math.hypot(lx + 0.9, lz - 0.35) < 0.95) return true;
      }
    }

    for (const node of this.harvestNodes) {
      if (!node.mesh.visible || node.kind === 'berry') continue;
      if (Math.hypot(x - node.x, z - node.z) < node.radius + 0.32) return true;
    }

    return false;
  }

  private updateSurvival(dt: number): void {
    this.survival.parkaEquipped = this.inventory.wool_parka > 0 && this.survival.parkaEquipped;
    this.survival.packEquipped = this.inventory.timber_pack > 0;
    this.survival.wearingRaincoat = this.inventory.raincoat > 0 && this.survival.wearingRaincoat;
    this.survival.carryingUmbrella = this.inventory.umbrella > 0 && this.survival.carryingUmbrella;
    this.survival.wearingBakerApron = this.inventory.baker_apron > 0 && this.survival.wearingBakerApron;
    this.survival.wearingRangerJacket = this.inventory.ranger_jacket > 0 && this.survival.wearingRangerJacket;
    this.survival.wearingSilkScarf = this.inventory.silk_scarf > 0 && this.survival.wearingSilkScarf;
    this.survival.wearingWinterSweater = this.inventory.winter_sweater > 0 && this.survival.wearingWinterSweater;

    // Check multi-story shelter: roof or upper_floor overhead & >= 2 wall pieces on player's floor, OR inside built Bakery
    const feetY = this.playerPos.y - 1.72;
    let hasRoofAbove = false;
    let nearbyWalls = 0;
    let nearHearthFire = Math.hypot(this.playerPos.x - 6.5, this.playerPos.z + 5.8) < 5.2;

    this.structures.forEach((s) => {
      const dx = Math.abs(this.playerPos.x - s.data.x);
      const dz = Math.abs(this.playerPos.z - s.data.z);
      const d = Math.hypot(dx, dz);
      if (s.data.type === 'roof' && s.data.y > feetY + 1.2 && dx < 2.65 && dz < 2.65) {
        hasRoofAbove = true;
      }
      if (s.data.type === 'upper_floor' && s.data.y > feetY + 1.4 && dx < 2.35 && dz < 2.35) {
        hasRoofAbove = true;
      }
      if (
        (s.data.type === 'wall' || s.data.type === 'window_wall' || s.data.type === 'doorway') &&
        d < 4.0 &&
        Math.abs(s.data.y - feetY) < 2.2
      ) {
        nearbyWalls += 1;
      }
      if (s.data.type === 'hearth' && s.data.lit && d < 6.2 && Math.abs(s.data.y - feetY) < 4.5) {
        nearHearthFire = true;
      }
    });

    let insideBakery = false;
    if (this.bakery.stage === 'built') {
      const { lx, lz } = this.worldToBakeryLocal(this.playerPos.x, this.playerPos.z);
      if (Math.abs(lx) < 2.48 && Math.abs(lz) < 2.1) {
        insideBakery = true;
        nearHearthFire = true;
      }
    }

    this.survival.isSheltered = (hasRoofAbove && nearbyWalls >= 2) || insideBakery;
    const hasTorch = this.torchLit && this.inventory.night_torch > 0;
    this.survival.nearFire =
      nearHearthFire || (this.lanternLit && this.inventory.storm_lantern > 0) || hasTorch;

    const hasRainGear = this.survival.wearingRaincoat || this.survival.carryingUmbrella;
    const isRaining =
      this.meteorology.weather === 'Rain' || this.meteorology.weather === 'Thunderstorm';
    const exposedToRain = !this.survival.isSheltered && isRaining;

    this.survival.isWet =
      (exposedToRain && !hasRainGear) || isInWater(this.playerPos.x, this.playerPos.z);

    // Rain sickness & reduced stamina mechanic if outdoors in rain without Raincoat or Umbrella
    if (exposedToRain && !hasRainGear) {
      this.survival.sicknessLevel = Math.min(100, this.survival.sicknessLevel + dt * 8.5);
      if (this.survival.sicknessLevel >= 12 && !this.rainSickWarned) {
        this.rainSickWarned = true;
        this.emitToast(
          'Caught a chill in the rain! Stamina is reduced—buy a Raincoat or Umbrella.',
          'warning',
        );
      }
    } else {
      const recoveryRate = this.survival.nearFire
        ? 11
        : this.survival.isSheltered
          ? 7
          : hasRainGear
            ? 4.2
            : 4.8;
      this.survival.sicknessLevel = Math.max(0, this.survival.sicknessLevel - dt * recoveryRate);
      if (this.survival.sicknessLevel < 4) {
        this.rainSickWarned = false;
      }
    }

    this.survival.isSick = this.survival.sicknessLevel >= 12;
    this.survival.maxStamina = Math.round(Math.max(38, 100 - this.survival.sicknessLevel * 0.62));
    this.survival.stamina = Math.min(this.survival.stamina, this.survival.maxStamina);

    // Hunger gentle decay
    this.survival.hunger = Math.max(0, this.survival.hunger - dt * 0.24);

    // Balanced warmth physics with clothing & cabin decor bonuses
    let warmthDelta = 0;
    const rugBonus = this.decorationsPlaced.includes('woven_rug') ? 0.6 : 0;
    const sweaterBonus = this.survival.wearingWinterSweater ? 0.45 : 0;
    if (nearHearthFire) {
      warmthDelta += 5.5 + rugBonus;
    } else if (this.survival.isSheltered) {
      warmthDelta += 1.4 + rugBonus + sweaterBonus;
    } else {
      const chill = Math.max(0, 14 - this.meteorology.ambientTempC) * 0.085;
      const windChill = this.meteorology.windSpeedMs * 0.045;
      const wetPenalty = this.survival.isWet ? 1.2 : 0;
      let coldMitigation = this.survival.parkaEquipped ? 0.55 : this.survival.wearingRaincoat ? 0.72 : 1.0;
      if (this.survival.wearingSilkScarf) coldMitigation *= 0.82;
      if (this.survival.wearingRangerJacket) coldMitigation *= 0.85;
      if (this.survival.wearingWinterSweater) coldMitigation *= 0.84;
      const lanternBonus = this.lanternLit && this.inventory.storm_lantern > 0 ? 0.9 : 0;
      const torchBonus = this.torchLit && this.inventory.night_torch > 0 ? 1.15 : 0;
      warmthDelta += lanternBonus + torchBonus + sweaterBonus - (chill + windChill + wetPenalty) * coldMitigation;
    }
    this.survival.warmth = THREE.MathUtils.clamp(this.survival.warmth + warmthDelta * dt, 0, 100);

    // Health response (cold, hunger, or severe rain sickness)
    if (this.survival.warmth <= 5 || this.survival.hunger <= 3) {
      this.survival.health = Math.max(0, this.survival.health - dt * 2.2);
    } else if (this.survival.isSick && this.survival.sicknessLevel > 55) {
      this.survival.health = Math.max(0, this.survival.health - dt * 0.85);
    } else if (this.survival.warmth > 50 && this.survival.hunger > 45 && !this.survival.isSick) {
      this.survival.health = Math.min(100, this.survival.health + dt * 0.8);
    }

    if (this.survival.health <= 0) {
      // Rescue revival inside starter cabin
      this.survival.health = 70;
      this.survival.warmth = 75;
      this.survival.hunger = 60;
      this.survival.sicknessLevel = 0;
      this.survival.isSick = false;
      this.survival.maxStamina = 100;
      const startDeckY = groundHeightAt(0, 0) + 0.46;
      this.playerPos.set(0, startDeckY + 1.72, 1.4);
      this.emitToast('You collapsed from exposure and were rescued back to your cabin hearth.', 'warning');
      this.emitHud();
    }
  }

  private updateStructures(dt: number, elapsed: number): void {
    this.structures.forEach((entry) => {
      if (entry.spawnSpring < 1) {
        entry.spawnSpring = Math.min(1, entry.spawnSpring + dt * 4.2);
        const ease = 1 - Math.pow(1 - entry.spawnSpring, 3);
        entry.group.scale.set(
          THREE.MathUtils.lerp(0.75, 1, ease),
          THREE.MathUtils.lerp(0.45, 1, ease),
          THREE.MathUtils.lerp(0.75, 1, ease),
        );
      }

      if (entry.data.type === 'doorway') {
        const pivot = entry.group.getObjectByName('doorPivot');
        if (pivot) {
          const target = entry.data.doorOpen ? 1 : 0;
          entry.doorAnim = THREE.MathUtils.damp(entry.doorAnim, target, 9, dt);
          pivot.rotation.y = entry.doorAnim * Math.PI * 0.48;
        }
      }

      if (entry.data.type === 'hearth' && entry.data.lit && entry.fireLight) {
        entry.fireLight.intensity = 3.2 + Math.sin(elapsed * 15 + entry.data.x) * 0.5;
      }

      if (entry.data.type === 'signpost') {
        const pivot = entry.group.getObjectByName('signBoardPivot');
        if (pivot) {
          pivot.rotation.x = Math.sin(elapsed * 2.1 + entry.data.x) * 0.04 * (1 + this.meteorology.windSpeedMs * 0.15);
        }
      }
    });
  }

  private updateHarvestNodes(dt: number): void {
    for (const node of this.harvestNodes) {
      if (!node.mesh.visible) {
        node.respawnTimer -= dt;
        if (node.respawnTimer <= 0) {
          node.hp = node.maxHp;
          node.mesh.visible = true;
          node.mesh.scale.setScalar(0.2);
          node.hitAnim = 0;
        }
      } else {
        if (node.mesh.scale.x < 0.99 && node.kind !== 'pine') {
          const s = THREE.MathUtils.damp(node.mesh.scale.x, 1, 5, dt);
          node.mesh.scale.setScalar(s);
        }
        if (node.hitAnim > 0) {
          node.hitAnim = Math.max(0, node.hitAnim - dt * 5.5);
          node.mesh.rotation.z = Math.sin(node.hitAnim * Math.PI * 3) * 0.08;
        } else {
          node.mesh.rotation.z = 0;
        }
      }
    }
  }

  private pickWantedItemForWeather(): CraftedItemId | BakeryPastryId {
    const w = this.meteorology.weather;
    if (this.bakery.stage === 'built' && Math.random() > 0.45) {
      return PASTRY_IDS[Math.floor(Math.random() * PASTRY_IDS.length)];
    }
    if (w === 'Blizzard' || w === 'Snow') {
      const coldPool: Array<CraftedItemId | BakeryPastryId> = ['wool_parka', 'hot_cider', 'cinnamon_roll', 'storm_lantern'];
      return coldPool[Math.floor(Math.random() * coldPool.length)];
    }
    if (w === 'Rain' || w === 'Thunderstorm') {
      const stormPool: Array<CraftedItemId | BakeryPastryId> = ['storm_lantern', 'cinnamon_roll', 'hot_cider', 'chocolate_cake'];
      return stormPool[Math.floor(Math.random() * stormPool.length)];
    }
    if (w === 'Fog') {
      const fogPool: Array<CraftedItemId | BakeryPastryId> = ['brass_compass', 'blueberry_muffin', 'storm_lantern'];
      return fogPool[Math.floor(Math.random() * fogPool.length)];
    }
    const clearPool: Array<CraftedItemId | BakeryPastryId> = ['croissant', 'berry_tart', 'strawberry_cake', 'trail_rations', 'brass_compass'];
    return clearPool[Math.floor(Math.random() * clearPool.length)];
  }

  private getBakeryCustomerSpot(slotIndex = 0): { x: number; z: number } {
    // Place customer in front of the left-front serving counter so they're reachable from inside & outside
    const localX = -0.65 + ((slotIndex % 3) - 1) * 0.65;
    const localZ = 3.05;
    const cosR = Math.cos(this.bakery.rotationY);
    const sinR = Math.sin(this.bakery.rotationY);
    return {
      x: this.bakery.x + localX * cosR + localZ * sinR,
      z: this.bakery.z - localX * sinR + localZ * cosR,
    };
  }

  private createBakeryOrderForTraveler(traveler: TravelerAgent): void {
    const stockedSlots = this.bakery.shelves.filter(
      (s) => s.shelfIndex < this.bakery.shelvesOwned && s.pastryId && s.stock > 0,
    );

    let chosenPastry: BakeryPastryId;
    let chosenPrice: number;

    if (stockedSlots.length > 0 && Math.random() < 0.72) {
      const pick = stockedSlots[Math.floor(Math.random() * stockedSlots.length)];
      chosenPastry = pick.pastryId!;
      chosenPrice = pick.price;
    } else {
      chosenPastry = PASTRY_IDS[Math.floor(Math.random() * PASTRY_IDS.length)];
      const demand = getWeatherDemandMultiplier(chosenPastry, this.meteorology.weather);
      chosenPrice = Math.round(ITEM_CATALOG[chosenPastry].baseValue * demand);
    }

    const order: BakeryOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      travelerId: traveler.id,
      customerName: traveler.name,
      pastryId: chosenPastry,
      quantity: 1,
      price: chosenPrice,
      remainingSec: 180,
      totalSec: 180,
      status: 'waiting_decision',
    };

    this.bakeryOrders.push(order);
    traveler.orderId = order.id;
    traveler.phase = 'ordering';
    traveler.wantedItemId = chosenPastry;
    traveler.offerPrice = chosenPrice;

    soundEngine.playUiTone(780);
    this.emitToast(
      `${traveler.name} placed an order for ${ITEM_CATALOG[chosenPastry].name} (3:00 wait)!`,
      'gold',
    );
    this.emitHud();
  }

  private tickBakeryOrders(dt: number): void {
    if (this.bakeryOrders.length === 0) return;

    let anyExpired = false;
    for (let i = this.bakeryOrders.length - 1; i >= 0; i--) {
      const order = this.bakeryOrders[i];
      order.remainingSec = Math.max(0, order.remainingSec - dt);
      if (order.remainingSec <= 0) {
        anyExpired = true;
        this.bakeryOrders.splice(i, 1);

        if (order.status === 'accepted') {
          this.reputation = Math.max(1.0, Number((this.reputation - 0.35).toFixed(2)));
          this.emitToast(
            `${order.customerName} waited 3:00 for ${ITEM_CATALOG[order.pastryId].name} and left! Shop goodwill dropped to ${this.reputation.toFixed(1)}★.`,
            'warning',
          );
        } else {
          this.reputation = Math.max(1.0, Number((this.reputation - 0.08).toFixed(2)));
          this.emitToast(
            `${order.customerName}'s order went unanswered for 3:00 and they left (${this.reputation.toFixed(1)}★).`,
            'warning',
          );
        }
        soundEngine.playUiTone(220);

        const tr = this.travelers.find((t) => t.id === order.travelerId);
        if (tr) {
          tr.orderId = undefined;
          tr.phase = 'leaving';
          tr.targetZ = 48;
          tr.targetX = trailCenterXAtZ(48);
        }
      }
    }

    this.orderUiTimer += dt;
    if (anyExpired || this.orderUiTimer >= 0.45) {
      this.orderUiTimer = 0;
      if (anyExpired) this.saveToStorage();
      this.emitHud();
    }
  }

  private updateTravelers(dt: number, elapsed: number): void {
    const bakeryOpen = this.bakery.stage === 'built' && this.bakery.isOpen;
    const canQueueOrder = bakeryOpen && this.bakeryOrders.length < 3;

    let hearthPos: { x: number; z: number } = { x: 6.5, z: -5.8 };
    for (const s of this.structures.values()) {
      if (s.data.type === 'hearth' && s.data.lit) {
        hearthPos = { x: s.data.x, z: s.data.z };
      }
    }

    this.travelerSpawnTimer -= dt;
    if (this.travelerSpawnTimer <= 0 && this.travelers.length < 4) {
      this.travelerSpawnTimer = bakeryOpen ? 8.5 + Math.random() * 4.5 : 14;
      const startZ = this.travelers.length === 0 ? -24 : -58;
      const startX = trailCenterXAtZ(startZ);
      const coatPalette = ['#395b72', '#7a4538', '#46684f', '#6b5344'];
      const hatPalette = ['#2d2722', '#523b29', '#394b42', '#704935'];
      const roles = ['Ridge Mountaineer', 'Timber Scout', 'Alpine Botanist', 'Village Neighbor'];
      const idx = Math.floor(Math.random() * TRAVELER_NAMES.length);
      const mesh = buildTravelerModel(
        coatPalette[idx % coatPalette.length],
        hatPalette[idx % hatPalette.length],
      );
      const id = `trav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      mesh.userData.travelerId = id;
      mesh.position.set(startX, groundHeightAt(startX, startZ), startZ);
      this.scene.add(mesh);

      const wantedItemId = this.pickWantedItemForWeather();
      const demand = getWeatherDemandMultiplier(wantedItemId, this.meteorology.weather);
      const offerPrice = Math.round(ITEM_CATALOG[wantedItemId].baseValue * demand * 1.18);

      const spot = canQueueOrder ? this.getBakeryCustomerSpot(this.bakeryOrders.length) : null;
      const targetX = spot ? spot.x : trailCenterXAtZ(12);
      const targetZ = spot ? spot.z : 32;

      this.travelers.push({
        id,
        name: TRAVELER_NAMES[idx],
        role: roles[idx % roles.length],
        mesh,
        x: startX,
        z: startZ,
        yaw: 0,
        phase: 'entering',
        preTalkPhase: 'entering',
        waitTimer: 2.0,
        walkCycle: elapsed,
        targetX,
        targetZ,
        waypointIndex: 0,
        boughtAlready: false,
        warmedAlready: false,
        wantedItemId,
        offerPrice,
        fulfilled: false,
        helpedWarmth: false,
        greetWave: 0,
      });
    }

    const isChilly =
      this.meteorology.ambientTempC < 7 ||
      this.meteorology.weather === 'Rain' ||
      this.meteorology.weather === 'Thunderstorm' ||
      this.meteorology.weather === 'Snow' ||
      this.meteorology.weather === 'Blizzard';

    for (let i = this.travelers.length - 1; i >= 0; i--) {
      const tr = this.travelers[i];
      const distToPlayer = Math.hypot(this.playerPos.x - tr.x, this.playerPos.z - tr.z);

      // Travelers automatically open closed cabin doors on their path
      this.structures.forEach((s) => {
        if (s.data.type === 'doorway' && !s.data.doorOpen) {
          if (Math.hypot(s.data.x - tr.x, s.data.z - tr.z) < 1.95) {
            s.data.doorOpen = true;
            soundEngine.playBuild();
          }
        }
      });

      if (tr.greetWave > 0) {
        tr.greetWave = Math.max(0, tr.greetWave - dt * 1.4);
      }

      if (tr.phase === 'talking') {
        tr.yaw = Math.atan2(this.playerPos.x - tr.x, this.playerPos.z - tr.z);
      } else if (tr.phase === 'entering') {
        // Stop briefly by the campfire/hearth if weather is chilly and not heading to order
        const distToFire = Math.hypot(hearthPos.x - tr.x, hearthPos.z - tr.z);
        if (isChilly && !tr.warmedAlready && distToFire < 9.5 && tr.z > -12) {
          if (distToFire < 2.2) {
            tr.phase = 'warming';
            tr.waitTimer = 3.2;
            tr.warmedAlready = true;
          } else {
            const dx = hearthPos.x - tr.x;
            const dz = hearthPos.z - tr.z;
            const moveSpeed = 2.55;
            tr.x += (dx / distToFire) * moveSpeed * dt;
            tr.z += (dz / distToFire) * moveSpeed * dt;
            tr.yaw = Math.atan2(dx, dz);
            tr.walkCycle += dt * 7.5;
          }
        } else {
          const bakerySpot =
            bakeryOpen && !tr.boughtAlready && this.bakeryOrders.length < 3
              ? this.getBakeryCustomerSpot(i)
              : null;
          const goalX = bakerySpot ? bakerySpot.x : trailCenterXAtZ(12);
          const goalZ = bakerySpot ? bakerySpot.z : 32;
          const nextGoalZ = tr.z < -8 ? Math.min(-4, tr.z + 14) : goalZ;
          const nextGoalX = tr.z < -8 ? trailCenterXAtZ(nextGoalZ) : goalX;

          const dx = nextGoalX - tr.x;
          const dz = nextGoalZ - tr.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.85 && tr.z >= -8) {
            if (bakerySpot) {
              tr.phase = 'browsing';
              tr.waitTimer = 1.6;
            } else {
              tr.phase = 'leaving';
              tr.targetZ = 48;
              tr.targetX = trailCenterXAtZ(48);
            }
          } else {
            const moveSpeed = 2.6;
            tr.x += (dx / Math.max(0.01, dist)) * moveSpeed * dt;
            tr.z += (dz / Math.max(0.01, dist)) * moveSpeed * dt;
            tr.yaw = Math.atan2(dx, dz);
            tr.walkCycle += dt * 7.5;
          }
        }
      } else if (tr.phase === 'warming') {
        tr.yaw = Math.atan2(hearthPos.x - tr.x, hearthPos.z - tr.z);
        tr.waitTimer -= dt;
        if (tr.waitTimer <= 0) {
          tr.phase = 'entering';
        }
      } else if (tr.phase === 'browsing') {
        tr.yaw = Math.atan2(this.bakery.x - tr.x, this.bakery.z - tr.z);
        tr.waitTimer -= dt;
        if (tr.waitTimer <= 0 && !tr.boughtAlready) {
          if (this.bakery.stage === 'built' && this.bakery.isOpen && this.bakeryOrders.length < 3) {
            tr.boughtAlready = true;
            this.createBakeryOrderForTraveler(tr);
          } else {
            tr.phase = 'leaving';
            tr.targetZ = 48;
            tr.targetX = trailCenterXAtZ(48);
          }
        }
      } else if (tr.phase === 'ordering') {
        // Customer waits up to 3 minutes facing the bakery counter or approaching player
        tr.yaw =
          distToPlayer < 4.5
            ? Math.atan2(this.playerPos.x - tr.x, this.playerPos.z - tr.z)
            : Math.atan2(this.bakery.x - tr.x, this.bakery.z - tr.z);
      } else {
        const dx = tr.targetX - tr.x;
        const dz = tr.targetZ - tr.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5 || tr.z > 46) {
          this.scene.remove(tr.mesh);
          this.travelers.splice(i, 1);
          continue;
        }
        const moveSpeed = 2.65;
        tr.x += (dx / dist) * moveSpeed * dt;
        tr.z += (dz / dist) * moveSpeed * dt;
        tr.yaw = Math.atan2(dx, dz);
        tr.walkCycle += dt * 7.5;
      }

      // Friendly wave trigger when player walks close
      if (distToPlayer < 4.4 && tr.greetWave === 0 && tr.phase !== 'leaving') {
        tr.greetWave = 0.85;
      }

      // Ground traveler & animate limbs smoothly
      const gy = groundHeightAt(tr.x, tr.z);
      let deckY = gy;
      this.structures.forEach((s) => {
        if (
          s.data.type === 'foundation' &&
          Math.abs(tr.x - s.data.x) <= GRID_SIZE * 0.5 &&
          Math.abs(tr.z - s.data.z) <= GRID_SIZE * 0.5
        ) {
          deckY = Math.max(deckY, s.data.y + 0.46);
        }
      });

      tr.mesh.position.set(tr.x, deckY, tr.z);
      tr.mesh.rotation.y = tr.yaw;

      const isMoving = tr.phase === 'entering' || tr.phase === 'leaving';
      const swing = isMoving ? Math.sin(tr.walkCycle) * 0.45 : 0;
      const lLeg = tr.mesh.getObjectByName('leftLeg');
      const rLeg = tr.mesh.getObjectByName('rightLeg');
      const lArm = tr.mesh.getObjectByName('leftArm');
      const rArm = tr.mesh.getObjectByName('rightArm');
      const headPivot = tr.mesh.getObjectByName('headPivot');

      if (lLeg) lLeg.rotation.x = swing;
      if (rLeg) rLeg.rotation.x = -swing;

      if (tr.phase === 'warming') {
        if (lArm) {
          lArm.rotation.x = -1.05 + Math.sin(elapsed * 5.2) * 0.1;
          lArm.rotation.z = -0.18;
        }
        if (rArm) {
          rArm.rotation.x = -1.05 + Math.cos(elapsed * 5.2) * 0.1;
          rArm.rotation.z = 0.18;
        }
      } else if (tr.phase === 'browsing' || tr.phase === 'ordering') {
        if (lArm) {
          lArm.rotation.x = -0.25;
          lArm.rotation.z = 0;
        }
        if (rArm) {
          rArm.rotation.x = tr.phase === 'ordering'
            ? -1.25 + Math.sin(elapsed * 3.8) * 0.16
            : -0.85 + Math.sin(elapsed * 2.5) * 0.15;
          rArm.rotation.z = 0;
        }
      } else if (tr.greetWave > 0 || tr.phase === 'talking') {
        if (lArm) {
          lArm.rotation.x = -swing * 0.7;
          lArm.rotation.z = 0;
        }
        if (rArm) {
          rArm.rotation.x = -2.2 + Math.sin(elapsed * 9) * 0.25;
          rArm.rotation.z = -0.35;
        }
      } else {
        if (lArm) {
          lArm.rotation.x = -swing * 0.7;
          lArm.rotation.z = 0;
        }
        if (rArm) {
          rArm.rotation.x = swing * 0.7;
          rArm.rotation.z = 0;
        }
      }

      if (headPivot) {
        if (distToPlayer < 5.5 && tr.phase !== 'talking') {
          const toPlayerYaw = Math.atan2(this.playerPos.x - tr.x, this.playerPos.z - tr.z) - tr.yaw;
          const clamped = THREE.MathUtils.clamp(Math.atan2(Math.sin(toPlayerYaw), Math.cos(toPlayerYaw)), -0.75, 0.75);
          headPivot.rotation.y = THREE.MathUtils.damp(headPivot.rotation.y, clamped, 6, dt);
        } else {
          headPivot.rotation.y = THREE.MathUtils.damp(headPivot.rotation.y, 0, 5, dt);
        }
        headPivot.rotation.x = tr.phase === 'browsing' ? 0.16 : tr.phase === 'talking' ? Math.sin(elapsed * 3.5) * 0.06 : 0;
      }
    }
  }

  private updateWeatherParticles(dt: number, elapsed: number): void {
    const w = this.meteorology.weather;
    const isRain = w === 'Rain' || w === 'Thunderstorm';
    const isSnow = w === 'Snow' || w === 'Blizzard';

    this.rainPoints.visible = isRain && !this.survival.isSheltered;
    this.snowPoints.visible = isSnow && !this.survival.isSheltered;

    if (this.rainPoints.visible) {
      this.rainPoints.position.set(this.playerPos.x, Math.max(0, this.playerPos.y - 3), this.playerPos.z);
      const attr = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const fallSpeed = w === 'Thunderstorm' ? 30 : 22;
      const windDrift = this.meteorology.windSpeedMs * 0.45;
      for (let i = 0; i < arr.length; i += 6) {
        arr[i] -= windDrift * dt;
        arr[i + 1] -= fallSpeed * dt;
        arr[i + 3] = arr[i] - windDrift * 0.04;
        arr[i + 4] = arr[i + 1] - 0.85;
        if (arr[i + 1] < -2) {
          arr[i] = (Math.random() - 0.5) * 44;
          arr[i + 1] = 22;
          arr[i + 2] = (Math.random() - 0.5) * 44;
          arr[i + 3] = arr[i] - windDrift * 0.04;
          arr[i + 4] = arr[i + 1] - 0.85;
          arr[i + 5] = arr[i + 2];
        }
      }
      attr.needsUpdate = true;
    }

    if (this.snowPoints.visible) {
      this.snowPoints.position.set(this.playerPos.x, Math.max(0, this.playerPos.y - 3), this.playerPos.z);
      const attr = this.snowPoints.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const fallSpeed = w === 'Blizzard' ? 5.6 : 2.6;
      const windDrift = this.meteorology.windSpeedMs * 0.35;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += (Math.sin(elapsed * 1.5 + i) * 0.6 - windDrift) * dt;
        arr[i + 1] -= fallSpeed * dt;
        if (arr[i + 1] < -2) {
          arr[i] = (Math.random() - 0.5) * 46;
          arr[i + 1] = 22;
          arr[i + 2] = (Math.random() - 0.5) * 46;
        }
      }
      attr.needsUpdate = true;
    }
  }

  private updateBursts(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      if (b.age >= b.lifetime) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      const attr = b.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let j = 0; j < arr.length; j += 3) {
        b.velocities[j + 1] -= 9.8 * dt;
        arr[j] += b.velocities[j] * dt;
        arr[j + 1] += b.velocities[j + 1] * dt;
        arr[j + 2] += b.velocities[j + 2] * dt;
      }
      attr.needsUpdate = true;
    }
  }

  private updateViewmodel(dt: number, elapsed: number): void {
    const hasTorch = this.inventory.night_torch > 0 && this.torchLit;
    const carryingPastry = this.heldPastry !== null;
    this.viewmodel.axeGroup.visible = this.activeTool === 'axe' && !hasTorch && !carryingPastry;
    this.viewmodel.pickaxeGroup.visible = this.activeTool === 'pickaxe' && !hasTorch && !carryingPastry;
    const hasLantern = this.inventory.storm_lantern > 0 && this.lanternLit;
    this.viewmodel.lanternGroup.visible = hasLantern;
    this.viewmodel.lanternLight.intensity = hasLantern ? 4.4 + Math.sin(elapsed * 9) * 0.2 : 0;

    if (this.heldPastry !== this.heldPastryVisualId) {
      while (this.viewmodel.heldPastryAnchor.children.length > 0) {
        this.viewmodel.heldPastryAnchor.remove(this.viewmodel.heldPastryAnchor.children[0]);
      }
      if (this.heldPastry) {
        const mesh = buildPastryMiniMesh(this.heldPastry, this.mats);
        this.viewmodel.heldPastryAnchor.add(mesh);
      }
      this.heldPastryVisualId = this.heldPastry;
    }
    this.viewmodel.heldPastryGroup.visible = carryingPastry;
    if (carryingPastry) {
      this.viewmodel.heldPastryGroup.position.y = -0.26 + Math.sin(elapsed * 2.4) * 0.008;
    }

    this.viewmodel.torchGroup.visible = hasTorch;
    if (hasTorch) {
      this.viewmodel.torchLight.intensity =
        5.5 + Math.sin(elapsed * 13) * 0.45 + Math.cos(elapsed * 19) * 0.25;
      const fScale = 0.92 + Math.sin(elapsed * 16) * 0.14;
      this.viewmodel.torchFlameMesh.scale.set(1, fScale, 1);
      this.viewmodel.torchGroup.position.y = -0.24 + Math.sin(elapsed * 2.4) * 0.01;
    } else {
      this.viewmodel.torchLight.intensity = 0;
    }

    const hasUmbrella = this.inventory.umbrella > 0 && this.survival.carryingUmbrella;
    this.viewmodel.umbrellaGroup.visible = hasUmbrella;
    if (hasUmbrella) {
      this.viewmodel.umbrellaGroup.position.y = 0.28 + Math.sin(elapsed * 2.0) * 0.01;
    }

    if (this.toolSwing > 0) {
      this.toolSwing = Math.max(0, this.toolSwing - dt * 4.5);
    }
    const swingAngle = Math.sin(this.toolSwing * Math.PI) * 0.72;
    const sway = Math.sin(elapsed * 1.8) * 0.012;
    this.viewmodel.axeGroup.rotation.x = -swingAngle + sway;
    this.viewmodel.pickaxeGroup.rotation.x = -swingAngle + sway;
    this.viewmodel.lanternGroup.position.y = -0.22 + Math.sin(elapsed * 2.2) * 0.012;
  }

  private emitHud(): void {
    const structuresMini = Array.from(this.structures.values()).map((s) => ({
      x: s.data.x,
      z: s.data.z,
      type: s.data.type,
      rotationY: s.data.rotationY,
    }));
    const cottagesMini = this.villageCottages.map((c) => ({
      x: c.x,
      z: c.z,
      isSupply: c.isSupply,
    }));
    const npcsMini = this.travelers.map((t) => ({
      x: t.x,
      z: t.z,
      phase: t.phase,
    }));

    this.callbacks.onHudUpdate({
      started: this.started,
      pointerLocked: this.pointerLocked,
      activeTool: this.activeTool,
      lanternLit: this.lanternLit,
      torchLit: this.torchLit,
      hudCollapsed: this.hudCollapsed,
      bakeryBuildMode: this.bakeryBuildMode,
      bakeryCanPlace: this.bakeryGhostCanPlace,
      houseBuildMode: this.houseBuildMode,
      houseWheelOpen: this.houseWheelOpen,
      houseBuildPiece: this.houseBuildPiece,
      houseBuildFloorOverride: this.houseBuildFloorOverride,
      houseBuildCanPlace: this.houseGhostCanPlace,
      houseDemolishLabel: this.houseDemolishLabel,
      houseMovingLabel: this.getMovingElementLabel(),
      meteorology: { ...this.meteorology },
      survival: { ...this.survival },
      inventory: { ...this.inventory },
      shop: {
        shopName: this.bakery.shopName,
        isOpen: this.bakery.isOpen,
        gold: this.gold,
        reputation: this.reputation,
        salesHistory: [...this.salesHistory],
        activeTravelers: this.travelers.length,
      },
      bakery: {
        ...this.bakery,
        shelves: this.bakery.shelves.map((s) => ({ ...s })),
      },
      decorationsOwned: [...this.decorationsOwned],
      decorationsPlaced: [...this.decorationsPlaced],
      deliveries: this.pendingDeliveries.map((d) => ({ ...d })),
      bakeryOrders: this.bakeryOrders.map((o) => ({ ...o })),
      heldPastry: this.heldPastry,
      prompt: this.currentPrompt,
      structuresCount: this.structures.size,
      hasWorkbench: this.hasStructureType('workbench'),
      gameOver: this.survival.health <= 0,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      playerYaw: this.playerYaw,
      structuresMini,
      cottagesMini,
      npcsMini,
    });
  }

  private emitToast(text: string, tone: ToastMessage['tone']): void {
    this.callbacks.onToast({
      id: `${Date.now()}_${Math.random()}`,
      text,
      tone,
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.clearPendingDrag();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    document.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousemove', this.onMouseMoveBound);
    dom.removeEventListener('mousedown', this.onMouseDownBound);
    dom.removeEventListener('contextmenu', this.onContextMenuBound);

    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
