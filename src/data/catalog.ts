import {
  BakeryPastryId,
  ClothingItemId,
  CookingItemId,
  CraftedItemId,
  DecorationItemId,
  HouseBuildPieceId,
  InventoryMap,
  ItemId,
  WeatherType,
} from '../types/game';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  category: 'resource' | 'gear' | 'provision' | 'pastry' | 'cooking' | 'decoration' | 'clothing';
  description: string;
  baseValue: number;
  consumable?: {
    hunger?: number;
    warmth?: number;
    health?: number;
    stamina?: number;
  };
  passivePerk?: string;
}

export interface CraftRecipe {
  itemId: CraftedItemId;
  yieldCount: number;
  ingredients: Partial<Record<ItemId, number>>;
  requiresWorkbench: boolean;
  weatherDemand: WeatherType[];
}

export interface BakingRecipe {
  pastryId: BakeryPastryId;
  yieldCount: number;
  ingredients: Partial<Record<ItemId, number>>;
}

export interface TabStoreListing {
  itemId: ItemId;
  price: number;
  badge: string;
  effectNote: string;
  retailValue?: number;
}

export interface HouseBuildPieceDef {
  id: HouseBuildPieceId;
  hotkey: string;
  name: string;
  shortName: string;
  badge: string;
  description: string;
  materials: Partial<Record<ItemId, number>>;
  goldCost: number;
}

export const HOUSE_BUILD_PIECES: HouseBuildPieceDef[] = [
  {
    id: 'foundation',
    hotkey: '1',
    name: 'Timber Foundation (4×4m)',
    shortName: 'Foundation',
    badge: 'Ground Floor',
    description: 'Raised timber deck & stone piers to start a new house or extend your cabin.',
    materials: { wood: 4, stone: 2 },
    goldCost: 12,
  },
  {
    id: 'stairs',
    hotkey: '2',
    name: 'Wooden Stairs (+1 Story)',
    shortName: 'Stairs',
    badge: 'Multi-Floor',
    description: 'Walkable timber staircase with handrails climbing cleanly to the next floor.',
    materials: { wood: 6, stone: 1 },
    goldCost: 18,
  },
  {
    id: 'upper_floor',
    hotkey: '3',
    name: 'Upper Floor Deck (4×4m)',
    shortName: 'Upper Floor',
    badge: '2nd / 3rd Story',
    description: 'Walkable second-story flooring; auto-opens a stairwell if placed above stairs.',
    materials: { wood: 5 },
    goldCost: 14,
  },
  {
    id: 'wall',
    hotkey: '4',
    name: 'Log Cabin Wall',
    shortName: 'Wall',
    badge: 'Enclosure',
    description: 'Solid stacked-cedar wall that shelters rooms on any floor.',
    materials: { wood: 3 },
    goldCost: 8,
  },
  {
    id: 'window_wall',
    hotkey: '5',
    name: 'Glass Window Wall',
    shortName: 'Window',
    badge: 'Enclosure',
    description: 'Timber wall with glass panes overlooking the valley & mountain peaks.',
    materials: { wood: 3, stone: 1 },
    goldCost: 10,
  },
  {
    id: 'doorway',
    hotkey: '6',
    name: 'Hinged Cabin Doorway',
    shortName: 'Doorway',
    badge: 'Entrance',
    description: 'Framed cabin entrance with an interactive swinging door [E].',
    materials: { wood: 4, iron: 1 },
    goldCost: 12,
  },
  {
    id: 'roof',
    hotkey: '7',
    name: 'Pitched Shingle Roof',
    shortName: 'Roof',
    badge: 'Roofing',
    description: 'Weatherproof gable roof that seals your house against rain & snow.',
    materials: { wood: 4 },
    goldCost: 12,
  },
  {
    id: 'hearth',
    hotkey: '8',
    name: 'Stone Hearth Fireplace',
    shortName: 'Hearth',
    badge: 'Warmth',
    description: 'Warm stone fireplace & chimney for any room or second-story loft.',
    materials: { stone: 4, wood: 2 },
    goldCost: 16,
  },
  {
    id: 'bedroll',
    hotkey: '9',
    name: 'Timber Bed & Quilt',
    shortName: 'Bed',
    badge: 'Comfort',
    description: 'Cozy wooden bed frame; press [E] to rest until dawn in any house.',
    materials: { wood: 3, pelt: 1 },
    goldCost: 14,
  },
  {
    id: 'move',
    hotkey: 'M',
    name: 'Move House Element',
    shortName: 'Move',
    badge: 'Rearrange',
    description: 'Pick up and relocate any wall, door, window, stairs, floor, roof, hearth, bed, lamp, or decor.',
    materials: {},
    goldCost: 0,
  },
  {
    id: 'demolish',
    hotkey: '0',
    name: 'Demolish / Remove Wall',
    shortName: 'Demolish',
    badge: 'Remodel',
    description: 'Remove a wall, roof, or piece (even on starter cabin) to connect extensions & stairs.',
    materials: {},
    goldCost: 0,
  },
];

export const BAKERY_COSTS = {
  foundationGold: 45,
  foundationWood: 8,
  foundationStone: 4,
  buildGold: 55,
  buildWood: 10,
  buildStone: 4,
  shelfGold: 30,
  maxShelves: 4,
};

export const INITIAL_INVENTORY: InventoryMap = {
  wood: 18,
  stone: 8,
  iron: 2,
  berries: 5,
  pelt: 2,
  resin: 3,
  wool_parka: 0,
  brass_compass: 0,
  storm_lantern: 1,
  night_torch: 0,
  trail_rations: 2,
  timber_pack: 0,
  carved_staff: 0,
  hot_cider: 1,
  raincoat: 0,
  umbrella: 0,
  croissant: 0,
  blueberry_muffin: 0,
  cinnamon_roll: 0,
  berry_tart: 0,
  strawberry_cake: 0,
  chocolate_cake: 0,
  flour: 2,
  butter: 2,
  sugar_honey: 1,
  farm_eggs: 2,
  cocoa: 0,
  cast_skillet: 0,
  copper_kettle: 0,
  woven_rug: 0,
  potted_fern: 0,
  oak_dining_table: 0,
  mountain_painting: 0,
  brass_candelabra: 0,
  wall_clock: 0,
  table_lamp: 0,
  floor_lamp: 0,
  wall_lantern_lamp: 0,
  plush_armchair: 0,
  pine_bookshelf: 0,
  baker_apron: 0,
  ranger_jacket: 0,
  silk_scarf: 0,
  winter_sweater: 0,
};

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  wood: {
    id: 'wood',
    name: 'Cedar Timber',
    category: 'resource',
    description: 'Fragrant alpine timber felled from valley pines.',
    baseValue: 4,
  },
  stone: {
    id: 'stone',
    name: 'Alpine Granite',
    category: 'resource',
    description: 'Dense valley stone for hearths and shop foundations.',
    baseValue: 5,
  },
  iron: {
    id: 'iron',
    name: 'Bog Iron Ore',
    category: 'resource',
    description: 'Metallic ore for lanterns, hinges, and bakery trays.',
    baseValue: 12,
  },
  berries: {
    id: 'berries',
    name: 'Juniper Berries',
    category: 'provision',
    description: 'Tart wild berries foraged from evergreen shrubs.',
    baseValue: 4,
    consumable: { hunger: 16, stamina: 10 },
  },
  pelt: {
    id: 'pelt',
    name: 'Alpine Fleece',
    category: 'resource',
    description: 'Thick insulating wool fibers gathered along ridge trails.',
    baseValue: 10,
  },
  resin: {
    id: 'resin',
    name: 'Pine Resin',
    category: 'resource',
    description: 'Aromatic pitch used for waterproofing and lantern oil.',
    baseValue: 6,
  },

  // Clothes & Rain Gear
  raincoat: {
    id: 'raincoat',
    name: 'Waxed Raincoat',
    category: 'clothing',
    description: 'Waterproof oiled-canvas storm coat that shields you from heavy rain.',
    baseValue: 35,
    passivePerk: 'Keeps you dry & prevents rain sickness/stamina loss (Toggle C)',
  },
  umbrella: {
    id: 'umbrella',
    name: 'Canopy Umbrella',
    category: 'clothing',
    description: 'Brass-ribbed waterproof umbrella carried overhead during downpours.',
    baseValue: 25,
    passivePerk: 'Blocks rain outdoors & preserves full stamina (Toggle U)',
  },
  wool_parka: {
    id: 'wool_parka',
    name: 'Alpine Wool Parka',
    category: 'clothing',
    description: 'Heavy weatherproof coat cutting windchill in blizzards.',
    baseValue: 48,
    passivePerk: 'Reduces cold exposure by 45%',
  },
  baker_apron: {
    id: 'baker_apron',
    name: "Baker's Linen Apron",
    category: 'clothing',
    description: 'Crisp flour-dusted bakery apron & toque worn behind your pastry counter.',
    baseValue: 38,
    passivePerk: '+18% earnings bonus on every Bakery Shop sale when worn',
  },
  ranger_jacket: {
    id: 'ranger_jacket',
    name: 'Ranger Leather Jacket',
    category: 'clothing',
    description: 'Tailored alpine trail jacket for brisk mountain hikes.',
    baseValue: 52,
    passivePerk: 'Reduces sprint stamina drain by 20% & cuts windchill',
  },
  silk_scarf: {
    id: 'silk_scarf',
    name: 'Woven Valley Scarf',
    category: 'clothing',
    description: 'Soft thermal neck wrap stitched by village weavers.',
    baseValue: 28,
    passivePerk: 'Boosts outdoor warmth retention by 18%',
  },
  winter_sweater: {
    id: 'winter_sweater',
    name: 'Cable-Knit Sweater',
    category: 'clothing',
    description: 'Thick highland wool pullover dyed in pine & cream.',
    baseValue: 40,
    passivePerk: 'Steady passive warmth recovery indoors & in mild weather',
  },

  // Crafted Gear & Provisions
  brass_compass: {
    id: 'brass_compass',
    name: 'Brass Pocket Compass',
    category: 'gear',
    description: 'Precision valley navigation instrument prized by hikers.',
    baseValue: 42,
  },
  storm_lantern: {
    id: 'storm_lantern',
    name: 'Brass Storm Lantern',
    category: 'gear',
    description: 'Windproof oil lantern providing light and radiant warmth.',
    baseValue: 38,
    passivePerk: 'Press F to toggle handheld light and warmth',
  },
  night_torch: {
    id: 'night_torch',
    name: 'Pine-Resin Night Torch',
    category: 'gear',
    description: 'Blazing resin-wrapped trail torch casting a wide 26m flame beam through dark nights.',
    baseValue: 18,
    passivePerk: 'Press T to light or put away your handheld Night Torch',
  },
  trail_rations: {
    id: 'trail_rations',
    name: 'Smoked Trail Rations',
    category: 'provision',
    description: 'Hearty packed provisions for high-pass expeditions.',
    baseValue: 24,
    consumable: { hunger: 45, health: 14, stamina: 28 },
  },
  timber_pack: {
    id: 'timber_pack',
    name: 'Canvas Timber Pack',
    category: 'gear',
    description: 'Waxed canvas rucksack built for rugged alpine treks.',
    baseValue: 52,
    passivePerk: 'Reduces sprint stamina drain by 25%',
  },
  carved_staff: {
    id: 'carved_staff',
    name: 'Carved Cedar Staff',
    category: 'gear',
    description: 'Balanced hiking staff tipped with forged brass.',
    baseValue: 30,
  },
  hot_cider: {
    id: 'hot_cider',
    name: 'Spiced Berry Cider',
    category: 'provision',
    description: 'Warming flask of spiced juniper cider that eases rain chills.',
    baseValue: 22,
    consumable: { warmth: 38, hunger: 18, stamina: 32, health: 8 },
  },

  // Cakes & Pastries (Wholesale from Tab -> Stock on Bakery Shelves)
  croissant: {
    id: 'croissant',
    name: 'Butter Croissant',
    category: 'pastry',
    description: 'Flaky golden crescent pastry baked with alpine creamery butter.',
    baseValue: 18,
    consumable: { hunger: 26, stamina: 18, health: 5 },
  },
  blueberry_muffin: {
    id: 'blueberry_muffin',
    name: 'Blueberry Muffin',
    category: 'pastry',
    description: 'Warm domed muffin bursting with wild mountain berries.',
    baseValue: 20,
    consumable: { hunger: 28, warmth: 8, stamina: 20 },
  },
  cinnamon_roll: {
    id: 'cinnamon_roll',
    name: 'Glazed Cinnamon Roll',
    category: 'pastry',
    description: 'Spiced swirled sweet roll topped with warm vanilla glaze.',
    baseValue: 24,
    consumable: { hunger: 32, warmth: 14, stamina: 24 },
  },
  berry_tart: {
    id: 'berry_tart',
    name: 'Alpine Berry Tart',
    category: 'pastry',
    description: 'Crisp shortcrust pastry filled with sweet mountain compote.',
    baseValue: 30,
    consumable: { hunger: 34, health: 10, stamina: 25 },
  },
  strawberry_cake: {
    id: 'strawberry_cake',
    name: 'Strawberry Cream Cake',
    category: 'pastry',
    description: 'Two-layer sponge cake layered with whipped cream and strawberries.',
    baseValue: 38,
    consumable: { hunger: 46, health: 16, stamina: 34 },
  },
  chocolate_cake: {
    id: 'chocolate_cake',
    name: 'Dark Chocolate Layer Cake',
    category: 'pastry',
    description: 'Rich double-cocoa celebration cake glazed in glossy ganache.',
    baseValue: 46,
    consumable: { hunger: 52, warmth: 16, health: 18, stamina: 38 },
  },

  // Cooking Items
  flour: {
    id: 'flour',
    name: 'Stone-Milled Flour',
    category: 'cooking',
    description: 'Fine valley wheat flour essential for baking pastries and cakes.',
    baseValue: 5,
  },
  butter: {
    id: 'butter',
    name: 'Alpine Churn Butter',
    category: 'cooking',
    description: 'Rich salted mountain butter for flaky pastry layers.',
    baseValue: 6,
  },
  sugar_honey: {
    id: 'sugar_honey',
    name: 'Wildflower Honey & Sugar',
    category: 'cooking',
    description: 'Golden alpine sweetener for glazes, tarts, and cakes.',
    baseValue: 7,
  },
  farm_eggs: {
    id: 'farm_eggs',
    name: 'Fresh Farm Eggs',
    category: 'cooking',
    description: 'Free-range valley eggs for sponge cakes and custards.',
    baseValue: 5,
  },
  cocoa: {
    id: 'cocoa',
    name: 'Roasted Cocoa Tin',
    category: 'cooking',
    description: 'Fragrant dark cocoa for chocolate layer cakes and hot drinks.',
    baseValue: 9,
  },
  cast_skillet: {
    id: 'cast_skillet',
    name: 'Cast-Iron Skillet',
    category: 'cooking',
    description: 'Heavy seasoned pan for hearth cooking and roasting.',
    baseValue: 32,
    passivePerk: 'Doubles pastry batch yield (+1 extra pastry) when baking',
  },
  copper_kettle: {
    id: 'copper_kettle',
    name: 'Copper Hearth Kettle',
    category: 'cooking',
    description: 'Polished kettle for brewing hot spiced drinks at home.',
    baseValue: 28,
    passivePerk: 'Unlocks spiced cider brewing & boosts kitchen warmth',
  },

  // House Decorations
  woven_rug: {
    id: 'woven_rug',
    name: 'Woven Hearth Rug',
    category: 'decoration',
    description: 'Hand-loomed wool runner rug placed across your cabin floor.',
    baseValue: 28,
    passivePerk: 'Adds cozy indoor warmth inside your house',
  },
  potted_fern: {
    id: 'potted_fern',
    name: 'Potted Alpine Fern',
    category: 'decoration',
    description: 'Lush mountain fern in a glazed terracotta planter by the window.',
    baseValue: 22,
    passivePerk: 'Brightens your starter house interior',
  },
  oak_dining_table: {
    id: 'oak_dining_table',
    name: 'Oak Tea & Pastry Table',
    category: 'decoration',
    description: 'Handcrafted timber table set with a porcelain teapot.',
    baseValue: 44,
    passivePerk: 'Furnishes your cabin living area',
  },
  mountain_painting: {
    id: 'mountain_painting',
    name: 'Framed Alpine Landscape',
    category: 'decoration',
    description: 'Oil painting of Pinecrest Peak framed in gilt timber.',
    baseValue: 34,
    passivePerk: 'Hangs proudly on your cabin north wall',
  },
  brass_candelabra: {
    id: 'brass_candelabra',
    name: 'Brass Candelabra',
    category: 'decoration',
    description: 'Three-branch brass candle stand casting warm indoor light at night.',
    baseValue: 36,
    passivePerk: 'Lights your starter house warmly during dark nights',
  },
  wall_clock: {
    id: 'wall_clock',
    name: 'Carved Pendulum Clock',
    category: 'decoration',
    description: 'Chiming alpine timber wall clock with brass pendulum.',
    baseValue: 40,
    passivePerk: 'Adds classic alpine character to your cabin wall',
  },
  table_lamp: {
    id: 'table_lamp',
    name: 'Warm Brass Table Lamp',
    category: 'decoration',
    description: 'Turned brass & linen table lamp on a cedar stand casting golden indoor light.',
    baseValue: 30,
    passivePerk: 'Brightens your starter house warmly during dark nights',
  },
  floor_lamp: {
    id: 'floor_lamp',
    name: 'Standing Alpine Floor Lamp',
    category: 'decoration',
    description: 'Tall timber-and-linen standing lamp illuminating your cabin interior.',
    baseValue: 42,
    passivePerk: 'Wide warm room lighting inside your house at night',
  },
  wall_lantern_lamp: {
    id: 'wall_lantern_lamp',
    name: 'Cabin Wall Sconce Lamp',
    category: 'decoration',
    description: 'Forged iron wall sconce with frosted amber glass mounted inside your house.',
    baseValue: 26,
    passivePerk: 'Casts cozy wall-mounted glow across your cabin floor',
  },
  plush_armchair: {
    id: 'plush_armchair',
    name: 'Fireside Velvet Armchair',
    category: 'decoration',
    description: 'Deep forest-green armchair angled toward your cabin hearth.',
    baseValue: 48,
    passivePerk: 'Adds comfort & hearthside relaxation inside your house',
  },
  pine_bookshelf: {
    id: 'pine_bookshelf',
    name: 'Cedar Bookshelf & Curios',
    category: 'decoration',
    description: 'Three-tier alpine cedar bookcase stocked with leather books and pottery.',
    baseValue: 38,
    passivePerk: 'Completes your cabin study corner',
  },
};

export const PASTRY_IDS: BakeryPastryId[] = [
  'croissant',
  'blueberry_muffin',
  'cinnamon_roll',
  'berry_tart',
  'strawberry_cake',
  'chocolate_cake',
];

export const COOKING_IDS: CookingItemId[] = [
  'flour',
  'butter',
  'sugar_honey',
  'farm_eggs',
  'cocoa',
  'cast_skillet',
  'copper_kettle',
];

export const DECORATION_IDS: DecorationItemId[] = [
  'table_lamp',
  'floor_lamp',
  'wall_lantern_lamp',
  'brass_candelabra',
  'woven_rug',
  'potted_fern',
  'oak_dining_table',
  'plush_armchair',
  'pine_bookshelf',
  'mountain_painting',
  'wall_clock',
];

export const CLOTHING_IDS: ClothingItemId[] = [
  'raincoat',
  'umbrella',
  'baker_apron',
  'wool_parka',
  'ranger_jacket',
  'silk_scarf',
  'winter_sweater',
];

export const PASTRY_SHOP_LISTINGS: TabStoreListing[] = [
  {
    itemId: 'croissant',
    price: 8,
    retailValue: 18,
    badge: 'Morning Pastry',
    effectNote: 'Buy wholesale for $8, stock on a Bakery Shelf, and sell for ~$18.',
  },
  {
    itemId: 'blueberry_muffin',
    price: 9,
    retailValue: 20,
    badge: 'Popular Treat',
    effectNote: 'Buy wholesale for $9 and sell from your bakery shelves for ~$20.',
  },
  {
    itemId: 'cinnamon_roll',
    price: 11,
    retailValue: 24,
    badge: 'Warm Sweet',
    effectNote: 'High profit on rainy or chilly mornings (~$24 retail).',
  },
  {
    itemId: 'berry_tart',
    price: 14,
    retailValue: 30,
    badge: 'Artisan Tart',
    effectNote: 'Valued by hikers and villagers along the road (~$30 retail).',
  },
  {
    itemId: 'strawberry_cake',
    price: 18,
    retailValue: 38,
    badge: 'Whole Cake',
    effectNote: 'Showcase layer cake that earns ~$38 per customer sale.',
  },
  {
    itemId: 'chocolate_cake',
    price: 22,
    retailValue: 46,
    badge: 'Signature Cake',
    effectNote: 'Top-earning luxury bakery cake (~$46 retail).',
  },
];

export const COOKING_SHOP_LISTINGS: TabStoreListing[] = [
  {
    itemId: 'flour',
    price: 5,
    badge: 'Baking Staple',
    effectNote: 'Used to bake fresh croissants, muffins, tarts, and cakes.',
  },
  {
    itemId: 'butter',
    price: 6,
    badge: 'Dairy Ingredient',
    effectNote: 'Essential for flaky croissants, cinnamon rolls, and tarts.',
  },
  {
    itemId: 'sugar_honey',
    price: 7,
    badge: 'Sweetener',
    effectNote: 'Used for glazes, cakes, and spiced berry treats.',
  },
  {
    itemId: 'farm_eggs',
    price: 5,
    badge: 'Baking Staple',
    effectNote: 'Rich free-range eggs for muffins and layer cakes.',
  },
  {
    itemId: 'cocoa',
    price: 9,
    badge: 'Specialty',
    effectNote: 'Rich dark cocoa required to bake Chocolate Layer Cakes.',
  },
  {
    itemId: 'cast_skillet',
    price: 32,
    badge: 'Cookware',
    effectNote: 'Permanent kitchen upgrade: +1 bonus pastry whenever you bake!',
  },
  {
    itemId: 'copper_kettle',
    price: 28,
    badge: 'Cookware',
    effectNote: 'Permanent kitchen upgrade: +1 bonus Hot Cider when brewing.',
  },
  {
    itemId: 'hot_cider',
    price: 20,
    badge: 'Ready Drink',
    effectNote: 'Warming drink that restores warmth, stamina, and cures rain chills.',
  },
  {
    itemId: 'trail_rations',
    price: 22,
    badge: 'Ready Meal',
    effectNote: 'Hearty meal restoring hunger, health, and stamina.',
  },
];

export const DECORATION_SHOP_LISTINGS: TabStoreListing[] = [
  {
    itemId: 'table_lamp',
    price: 30,
    badge: 'Table Lamp',
    effectNote: 'Delivered to your door in 1 min. Install inside for warm golden lamp light.',
  },
  {
    itemId: 'floor_lamp',
    price: 42,
    badge: 'Floor Lamp',
    effectNote: 'Delivered in 1 min. Tall standing lamp that brightly lights your cabin at night.',
  },
  {
    itemId: 'wall_lantern_lamp',
    price: 26,
    badge: 'Wall Lamp',
    effectNote: 'Delivered in 1 min. Warm wall-mounted amber sconce for your cabin interior.',
  },
  {
    itemId: 'brass_candelabra',
    price: 36,
    badge: 'Night Lighting',
    effectNote: 'Delivered in 1 min. Casts warm golden candlelight inside your cabin at night.',
  },
  {
    itemId: 'woven_rug',
    price: 28,
    badge: 'Flooring',
    effectNote: 'Delivered in 1 min. Hand-loomed wool rug installed inside your starter house.',
  },
  {
    itemId: 'potted_fern',
    price: 22,
    badge: 'Botanical',
    effectNote: 'Delivered in 1 min. Terracotta alpine fern placed beside your cabin window.',
  },
  {
    itemId: 'oak_dining_table',
    price: 44,
    badge: 'Furniture',
    effectNote: 'Delivered in 1 min. Oak tea table & teapot installed in your living area.',
  },
  {
    itemId: 'plush_armchair',
    price: 48,
    badge: 'Furniture',
    effectNote: 'Delivered in 1 min. Fireside velvet armchair for your cabin hearth corner.',
  },
  {
    itemId: 'pine_bookshelf',
    price: 38,
    badge: 'Furniture',
    effectNote: 'Delivered in 1 min. Stocked cedar bookcase installed along your cabin wall.',
  },
  {
    itemId: 'mountain_painting',
    price: 34,
    badge: 'Wall Art',
    effectNote: 'Delivered in 1 min. Framed valley oil painting mounted on your cabin wall.',
  },
  {
    itemId: 'wall_clock',
    price: 40,
    badge: 'Heirloom',
    effectNote: 'Delivered in 1 min. Carved wooden pendulum clock mounted on your cabin wall.',
  },
];

export const NIGHT_GEAR_LISTINGS: TabStoreListing[] = [
  {
    itemId: 'night_torch',
    price: 18,
    badge: 'Night Essential',
    effectNote: 'Light with (T) for a blazing 26m trail flame and extra warmth during dark nights.',
  },
];

export const CLOTHING_SHOP_LISTINGS: TabStoreListing[] = [
  {
    itemId: 'raincoat',
    price: 35,
    badge: 'Rain Essential',
    effectNote: 'Wear (C) to stay dry and prevent rain sickness or stamina loss.',
  },
  {
    itemId: 'umbrella',
    price: 25,
    badge: 'Rain Essential',
    effectNote: 'Hold overhead (U) to block downpours and preserve full stamina.',
  },
  {
    itemId: 'baker_apron',
    price: 38,
    badge: 'Business Attire',
    effectNote: 'Wear while running your Bakery Shop for +18% extra money per sale!',
  },
  {
    itemId: 'wool_parka',
    price: 48,
    badge: 'Winter Coat',
    effectNote: 'Cuts blizzard and freezing windchill exposure by 45%.',
  },
  {
    itemId: 'ranger_jacket',
    price: 52,
    badge: 'Trail Wear',
    effectNote: 'Cuts sprint stamina drain by 20% and warms against breezes.',
  },
  {
    itemId: 'silk_scarf',
    price: 28,
    badge: 'Accessory',
    effectNote: 'Boosts cold resistance by 18% outdoors.',
  },
  {
    itemId: 'winter_sweater',
    price: 40,
    badge: 'Knitwear',
    effectNote: 'Steady cozy warmth bonus during chilly valley mornings & nights.',
  },
];

export const BAKING_RECIPES: BakingRecipe[] = [
  {
    pastryId: 'croissant',
    yieldCount: 2,
    ingredients: { flour: 1, butter: 1 },
  },
  {
    pastryId: 'blueberry_muffin',
    yieldCount: 2,
    ingredients: { flour: 1, berries: 2, sugar_honey: 1 },
  },
  {
    pastryId: 'cinnamon_roll',
    yieldCount: 2,
    ingredients: { flour: 1, butter: 1, sugar_honey: 1 },
  },
  {
    pastryId: 'berry_tart',
    yieldCount: 2,
    ingredients: { flour: 1, butter: 1, berries: 2 },
  },
  {
    pastryId: 'strawberry_cake',
    yieldCount: 1,
    ingredients: { flour: 2, farm_eggs: 2, sugar_honey: 1, berries: 2 },
  },
  {
    pastryId: 'chocolate_cake',
    yieldCount: 1,
    ingredients: { flour: 2, farm_eggs: 2, butter: 1, cocoa: 1 },
  },
];

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    itemId: 'trail_rations',
    yieldCount: 2,
    ingredients: { berries: 3, wood: 1 },
    requiresWorkbench: false,
    weatherDemand: ['Clear', 'Overcast', 'Rain'],
  },
  {
    itemId: 'hot_cider',
    yieldCount: 2,
    ingredients: { berries: 3, resin: 1, wood: 1 },
    requiresWorkbench: false,
    weatherDemand: ['Rain', 'Snow', 'Blizzard', 'Thunderstorm'],
  },
  {
    itemId: 'carved_staff',
    yieldCount: 1,
    ingredients: { wood: 4, resin: 1 },
    requiresWorkbench: false,
    weatherDemand: ['Clear', 'Fog', 'Overcast'],
  },
  {
    itemId: 'storm_lantern',
    yieldCount: 1,
    ingredients: { iron: 2, resin: 2, wood: 1 },
    requiresWorkbench: true,
    weatherDemand: ['Fog', 'Rain', 'Thunderstorm', 'Blizzard'],
  },
  {
    itemId: 'brass_compass',
    yieldCount: 1,
    ingredients: { iron: 2, stone: 1 },
    requiresWorkbench: true,
    weatherDemand: ['Fog', 'Snow', 'Blizzard'],
  },
  {
    itemId: 'wool_parka',
    yieldCount: 1,
    ingredients: { pelt: 2, resin: 1 },
    requiresWorkbench: true,
    weatherDemand: ['Snow', 'Blizzard', 'Rain', 'Thunderstorm'],
  },
  {
    itemId: 'timber_pack',
    yieldCount: 1,
    ingredients: { pelt: 2, wood: 2, iron: 1 },
    requiresWorkbench: true,
    weatherDemand: ['Clear', 'Overcast', 'Snow'],
  },
];

export const TRAVELER_NAMES = [
  'Clara Vance',
  'Rowan Mercer',
  'Henrik Lind',
  'Maeve Calloway',
  'Soren Holt',
  'Nadia Brooks',
  'Callum Reid',
  'Tessa Albright',
];

export function formatTime24(timeOfDay: number): string {
  const normalized = ((timeOfDay % 24) + 24) % 24;
  const hrs = Math.floor(normalized);
  const mins = Math.floor((normalized - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getWeatherDemandMultiplier(itemId: ItemId, weather: WeatherType): number {
  const recipe = CRAFT_RECIPES.find((r) => r.itemId === itemId);
  if (recipe) {
    return recipe.weatherDemand.includes(weather) ? 1.35 : 1.0;
  }
  if (
    (itemId === 'cinnamon_roll' || itemId === 'chocolate_cake') &&
    (weather === 'Rain' || weather === 'Thunderstorm' || weather === 'Snow' || weather === 'Blizzard')
  ) {
    return 1.25;
  }
  return 1.0;
}
