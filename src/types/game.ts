export type WeatherType =
  | 'Clear'
  | 'Overcast'
  | 'Rain'
  | 'Thunderstorm'
  | 'Fog'
  | 'Snow'
  | 'Blizzard';

export type ResourceId =
  | 'wood'
  | 'stone'
  | 'iron'
  | 'berries'
  | 'pelt'
  | 'resin';

export type CraftedItemId =
  | 'wool_parka'
  | 'brass_compass'
  | 'storm_lantern'
  | 'trail_rations'
  | 'timber_pack'
  | 'carved_staff'
  | 'hot_cider';

export type BakeryPastryId =
  | 'croissant'
  | 'blueberry_muffin'
  | 'cinnamon_roll'
  | 'berry_tart'
  | 'strawberry_cake'
  | 'chocolate_cake';

export type CookingItemId =
  | 'flour'
  | 'butter'
  | 'sugar_honey'
  | 'farm_eggs'
  | 'cocoa'
  | 'cast_skillet'
  | 'copper_kettle';

export type DecorationItemId =
  | 'woven_rug'
  | 'potted_fern'
  | 'oak_dining_table'
  | 'mountain_painting'
  | 'brass_candelabra'
  | 'wall_clock'
  | 'table_lamp'
  | 'floor_lamp'
  | 'wall_lantern_lamp'
  | 'plush_armchair'
  | 'pine_bookshelf';

export type ClothingItemId =
  | 'raincoat'
  | 'umbrella'
  | 'wool_parka'
  | 'baker_apron'
  | 'ranger_jacket'
  | 'silk_scarf'
  | 'winter_sweater';

export type SupplyGearId =
  | 'night_torch'
  | 'raincoat'
  | 'umbrella'
  | 'baker_apron'
  | 'ranger_jacket'
  | 'silk_scarf'
  | 'winter_sweater';

export type ItemId =
  | ResourceId
  | CraftedItemId
  | BakeryPastryId
  | CookingItemId
  | DecorationItemId
  | SupplyGearId;

export type ToolId = 'hands' | 'axe' | 'pickaxe' | 'lantern';

export type StructureType =
  | 'foundation'
  | 'wall'
  | 'window_wall'
  | 'doorway'
  | 'roof'
  | 'upper_floor'
  | 'stairs'
  | 'hearth'
  | 'bedroll'
  | 'workbench'
  | 'counter'
  | 'signpost';

export type HouseBuildPieceId =
  | 'foundation'
  | 'stairs'
  | 'upper_floor'
  | 'wall'
  | 'window_wall'
  | 'doorway'
  | 'roof'
  | 'hearth'
  | 'bedroll'
  | 'move'
  | 'demolish';

export type InventoryMap = Record<ItemId, number>;

export interface PlacedStructure {
  id: string;
  type: StructureType;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  lit?: boolean;
  doorOpen?: boolean;
}

export interface BakeryShelfSlot {
  slotIndex: number;
  shelfIndex: number;
  pastryId: BakeryPastryId | null;
  stock: number;
  price: number;
}

export interface BakeryShopState {
  stage: 'none' | 'foundation' | 'built';
  x: number;
  z: number;
  rotationY: number;
  shopName: string;
  isOpen: boolean;
  shelvesOwned: number; // 0..4 physical wooden shelves purchased
  shelves: BakeryShelfSlot[]; // up to 8 slots (2 tiers per shelf)
}

export interface SaleRecord {
  id: string;
  day: number;
  timeStr: string;
  travelerName: string;
  itemId: ItemId;
  price: number;
  weatherBonus: boolean;
}

export interface MeteorologyState {
  timeOfDay: number; // 0..24
  dayCount: number;
  weather: WeatherType;
  nextWeather: WeatherType;
  transitionProgress: number; // 0..1
  ambientTempC: number;
  windSpeedMs: number;
  humidity: number;
  pressureHpa: number;
  precipitationIntensity: number; // 0..1
  snowAccumulation: number; // 0..1
  wetness: number; // 0..1
}

export interface SurvivalState {
  health: number;
  warmth: number;
  hunger: number;
  stamina: number;
  maxStamina: number;
  sicknessLevel: number; // 0..100
  isSick: boolean;
  isSheltered: boolean;
  nearFire: boolean;
  isWet: boolean;
  wearingRaincoat: boolean;
  carryingUmbrella: boolean;
  parkaEquipped: boolean;
  packEquipped: boolean;
  wearingBakerApron: boolean;
  wearingRangerJacket: boolean;
  wearingSilkScarf: boolean;
  wearingWinterSweater: boolean;
}

export interface InteractionPrompt {
  id: string;
  label: string;
  sublabel?: string;
  actionType:
    | 'harvest'
    | 'drink'
    | 'door'
    | 'hearth'
    | 'bedroll'
    | 'workbench'
    | 'counter'
    | 'signpost'
    | 'supply_shop'
    | 'bakery_frame'
    | 'bakery_shop'
    | 'bakery_shelf'
    | 'bakery_order'
    | 'delivery_parcel'
    | 'decor'
    | 'npc';
  shelfIndex?: number;
  orderId?: string;
}

export interface BakeryOrder {
  id: string;
  travelerId: string;
  customerName: string;
  pastryId: BakeryPastryId;
  quantity: number;
  price: number;
  remainingSec: number;
  totalSec: number;
  status: 'waiting_decision' | 'accepted';
}

export interface DeliveryOrder {
  id: string;
  itemId: DecorationItemId;
  remainingSec: number;
  totalSec: number;
  status: 'in_transit' | 'at_door';
}

export interface NpcDialogueState {
  id: string;
  name: string;
  role: string;
  mood: string;
  greeting: string;
  wantedItemId: CraftedItemId | BakeryPastryId;
  offerPrice: number;
  weatherForecast: string;
  fulfilled: boolean;
  helpedWarmth: boolean;
}

export interface ShopState {
  shopName: string;
  isOpen: boolean;
  gold: number;
  reputation: number;
  salesHistory: SaleRecord[];
  activeTravelers: number;
}

export type PlayerTabSection =
  | 'home'
  | 'builder'
  | 'bakery'
  | 'pastries'
  | 'cooking'
  | 'decorations'
  | 'clothes'
  | 'ledger';

export interface GameHudSnapshot {
  started: boolean;
  pointerLocked: boolean;
  activeTool: ToolId;
  lanternLit: boolean;
  torchLit: boolean;
  hudCollapsed: boolean;
  bakeryBuildMode: boolean;
  bakeryCanPlace: boolean;
  houseBuildMode: boolean;
  houseWheelOpen: boolean;
  houseBuildPiece: HouseBuildPieceId;
  houseBuildFloorOverride: 'auto' | 0 | 1 | 2;
  houseBuildCanPlace: boolean;
  houseDemolishLabel: string | null;
  houseMovingLabel: string | null;
  meteorology: MeteorologyState;
  survival: SurvivalState;
  inventory: InventoryMap;
  shop: ShopState;
  bakery: BakeryShopState;
  decorationsOwned: DecorationItemId[];
  decorationsPlaced: DecorationItemId[];
  deliveries: DeliveryOrder[];
  bakeryOrders: BakeryOrder[];
  heldPastry: BakeryPastryId | null;
  prompt: InteractionPrompt | null;
  structuresCount: number;
  hasWorkbench: boolean;
  gameOver: boolean;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  structuresMini: Array<{ x: number; z: number; type: StructureType; rotationY?: number }>;
  cottagesMini: Array<{ x: number; z: number; isSupply: boolean }>;
  npcsMini: Array<{ x: number; z: number; phase: string }>;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'warm' | 'gold' | 'warning';
}

export interface PersistedValleySave {
  version: number;
  savedAt: number;
  playerPos: { x: number; y: number; z: number };
  playerYaw: number;
  playerPitch: number;
  meteorology: MeteorologyState;
  survival: SurvivalState;
  inventory: InventoryMap;
  structures: PlacedStructure[];
  bakery: BakeryShopState;
  decorationsOwned: DecorationItemId[];
  decorationsPlaced: DecorationItemId[];
  decorationPositions?: Partial<Record<DecorationItemId, { x: number; y: number; z: number; ry: number }>>;
  pendingDeliveries?: DeliveryOrder[];
  torchLit?: boolean;
  shop: Omit<ShopState, 'activeTravelers'>;
  harvestedNodeIds: string[];
}
