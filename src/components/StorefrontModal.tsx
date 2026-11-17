import { useEffect, useState } from 'react';
import {
  BatteryCharging,
  Bell,
  ChefHat,
  ChevronLeft,
  Clock,
  Croissant,
  Flame,
  Hammer,
  Home,
  Lamp,
  Layers,
  Package,
  Receipt,
  Shirt,
  Signal,
  Star,
  Store,
  Truck,
  Umbrella,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import {
  BAKERY_COSTS,
  BAKING_RECIPES,
  CLOTHING_SHOP_LISTINGS,
  COOKING_SHOP_LISTINGS,
  CRAFT_RECIPES,
  DECORATION_SHOP_LISTINGS,
  formatTime24,
  getWeatherDemandMultiplier,
  HOUSE_BUILD_PIECES,
  ITEM_CATALOG,
  NIGHT_GEAR_LISTINGS,
  PASTRY_IDS,
  PASTRY_SHOP_LISTINGS,
} from '../data/catalog';
import {
  BakeryPastryId,
  ClothingItemId,
  CraftedItemId,
  DecorationItemId,
  GameHudSnapshot,
  HouseBuildPieceId,
  ItemId,
  PlayerTabSection,
} from '../types/game';

interface StorefrontModalProps {
  hud: GameHudSnapshot;
  initialTab?: PlayerTabSection;
  onClose: () => void;
  onStartBakeryPlacement: () => void;
  onQuickBuildBakery: () => void;
  onFinishBakeryBuild: (useMaterials?: boolean) => void;
  onStartHouseBuild: (pieceId?: HouseBuildPieceId) => void;
  onQuickExtendCabin: () => void;
  onQuickAddSecondStory: () => void;
  onBuyBakeryShelf: () => void;
  onBakePastry: (pastryId: BakeryPastryId) => void;
  onCraft: (itemId: CraftedItemId) => void;
  onBuySupply: (itemId: ItemId, price: number) => void;
  onToggleClothing: (itemId: ClothingItemId) => void;
  onToggleTorch: () => void;
  onToggleDecoration: (decId: DecorationItemId) => void;
  onInstallAllDecor: () => void;
  onUpdateShopName: (name: string) => void;
  onToggleShopOpen: () => void;
  onStockSlot: (slotIndex: number, pastryId: BakeryPastryId | null) => void;
  onAddStock: (slotIndex: number, delta: number) => void;
  onQuickStorePastry: (pastryId: BakeryPastryId, count?: number) => void;
  onAcceptOrder: (orderId: string) => void;
  onRefuseOrder: (orderId: string) => void;
  onTakePastryFromShelf: (pastryId: BakeryPastryId) => void;
  onPutBackPastry: () => void;
  onServeOrder: (orderId: string) => void;
  onSetSlotPrice: (slotIndex: number, price: number) => void;
  onConsumeItem: (itemId: ItemId) => void;
}

const APP_TITLES: Record<PlayerTabSection, string> = {
  home: 'Pinecrest Mobile',
  builder: 'House Builder',
  bakery: 'Bakery Shop',
  pastries: 'Cakes & Pastries',
  cooking: 'Cooking Items',
  decorations: 'House Decor',
  clothes: 'Clothes & Gear',
  ledger: 'Sales Ledger',
};

export function StorefrontModal({
  hud,
  initialTab = 'home',
  onClose,
  onStartBakeryPlacement,
  onQuickBuildBakery,
  onFinishBakeryBuild,
  onStartHouseBuild,
  onQuickExtendCabin,
  onQuickAddSecondStory,
  onBuyBakeryShelf,
  onBakePastry,
  onCraft,
  onBuySupply,
  onToggleClothing,
  onToggleTorch,
  onToggleDecoration,
  onInstallAllDecor,
  onUpdateShopName,
  onToggleShopOpen,
  onStockSlot,
  onAddStock,
  onQuickStorePastry,
  onAcceptOrder,
  onRefuseOrder,
  onTakePastryFromShelf,
  onPutBackPastry,
  onServeOrder,
  onSetSlotPrice,
  onConsumeItem,
}: StorefrontModalProps) {
  const [tab, setTab] = useState<PlayerTabSection>(initialTab);
  const [nameDraft, setNameDraft] = useState(hud.bakery.shopName);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setNameDraft(hud.bakery.shopName);
  }, [hud.bakery.shopName]);

  const formatCountdown = (sec: number): string => {
    const sTotal = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sTotal / 60);
    const s = sTotal % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const uninstalledDecorCount = hud.decorationsOwned.filter(
    (id) => !hud.decorationsPlaced.includes(id),
  ).length;
  const inTransitDeliveries = hud.deliveries.filter((d) => d.status === 'in_transit');
  const atDoorDeliveries = hud.deliveries.filter((d) => d.status === 'at_door');

  const isWearing = (id: ClothingItemId): boolean => {
    switch (id) {
      case 'raincoat':
        return hud.survival.wearingRaincoat;
      case 'umbrella':
        return hud.survival.carryingUmbrella;
      case 'wool_parka':
        return hud.survival.parkaEquipped;
      case 'baker_apron':
        return hud.survival.wearingBakerApron;
      case 'ranger_jacket':
        return hud.survival.wearingRangerJacket;
      case 'silk_scarf':
        return hud.survival.wearingSilkScarf;
      case 'winter_sweater':
        return hud.survival.wearingWinterSweater;
    }
  };

  const totalPastryStocked = hud.bakery.shelves
    .filter((s) => s.shelfIndex < hud.bakery.shelvesOwned)
    .reduce((sum, s) => sum + s.stock, 0);

  const totalPastryInPack = PASTRY_IDS.reduce((sum, pid) => sum + (hud.inventory[pid] || 0), 0);
  const totalSalesGold = hud.shop.salesHistory.reduce((sum, s) => sum + s.price, 0);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/68 p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Handheld Smartphone Outer Titanium Chassis */}
      <div className="relative flex h-[min(840px,92vh)] w-full max-w-[424px] flex-col rounded-[42px] border-[3px] border-[#3d4b5d] bg-[#161d26] p-2.5 shadow-[0_26px_75px_rgba(0,0,0,0.88)]">
        {/* Hardware Side Buttons */}
        <div className="pointer-events-none absolute top-24 -left-[5px] h-10 w-[3px] rounded-l bg-[#526277]" />
        <div className="pointer-events-none absolute top-38 -left-[5px] h-14 w-[3px] rounded-l bg-[#526277]" />
        <div className="pointer-events-none absolute top-30 -right-[5px] h-16 w-[3px] rounded-r bg-[#526277]" />

        {/* Inner OLED Mobile Screen */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0b1017]">
          {/* Phone Top Status Bar + Dynamic Camera Notch */}
          <div className="relative flex items-center justify-between bg-[#080c12] px-5 pt-2.5 pb-2 text-[11px] font-medium text-slate-200 select-none">
            <span className="font-mono-nums font-semibold text-slate-100">
              {formatTime24(hud.meteorology.timeOfDay)}
            </span>

            {/* Phone Speaker & Front Camera Island */}
            <div className="flex h-5 w-24 items-center justify-center gap-2 rounded-full border border-white/10 bg-black px-2">
              <div className="h-1 w-8 rounded-full bg-slate-800" />
              <div className="h-2 w-2 rounded-full border border-sky-900 bg-[#0d1c2e]" />
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <Signal className="h-3 w-3" />
              <Wifi className="h-3 w-3" />
              <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
            </div>
          </div>

          {/* Mobile App Header Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#0e151f] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {tab !== 'home' && (
                <button
                  type="button"
                  onClick={() => setTab('home')}
                  aria-label="Back to Mobile Home"
                  className="flex cursor-pointer items-center gap-0.5 rounded-lg border border-white/10 bg-[#17212f] px-2 py-1 text-xs font-medium text-slate-200 hover:text-white shrink-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Home</span>
                </button>
              )}
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-bold text-slate-50">
                  {APP_TITLES[tab]}
                </h2>
                {tab === 'home' && (
                  <div className="text-[10px] text-slate-400">
                    Day {hud.meteorology.dayCount} · {hud.meteorology.weather} ·{' '}
                    {hud.meteorology.ambientTempC > 0
                      ? `+${hud.meteorology.ambientTempC}`
                      : hud.meteorology.ambientTempC}
                    °C
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 font-mono-nums text-xs font-bold text-emerald-300">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span>${hud.shop.gold}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Put away mobile"
                title="Close Mobile (Tab / Esc)"
                className="cursor-pointer rounded-lg border border-white/10 bg-[#17212f] p-1.5 text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Mobile Viewport */}
          <div className="valley-scroll flex-1 overflow-y-auto px-3.5 py-3.5">
            {/* 0. MOBILE HOME SCREEN */}
            {tab === 'home' && (
              <div className="space-y-4">
                {/* Business & Wallet Widget */}
                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-[#1b222e] to-[#111720] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-medium text-amber-400">
                        {hud.bakery.shopName}
                      </div>
                      <div className="mt-0.5 font-mono-nums text-2xl font-bold text-emerald-400">
                        ${hud.shop.gold}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {hud.bakery.stage === 'none'
                          ? 'Bakery not built yet'
                          : hud.bakery.stage === 'foundation'
                            ? 'Foundation ready — finish walls'
                            : `${hud.bakery.shelvesOwned}/4 shelves · ${totalPastryStocked} stocked · ${hud.shop.reputation.toFixed(1)}★ Goodwill`}
                      </div>
                    </div>

                    {hud.bakery.stage === 'built' ? (
                      <button
                        type="button"
                        onClick={onToggleShopOpen}
                        className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                          hud.bakery.isOpen
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                      >
                        {hud.bakery.isOpen ? 'Shop Open' : 'Open Shop'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTab('bakery')}
                        className="cursor-pointer rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 whitespace-nowrap shrink-0"
                      >
                        Build Bakery
                      </button>
                    )}
                  </div>
                </div>

                {/* Health & Rain Status Mini Widget */}
                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#121923] p-3 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400">Health</div>
                    <div className="font-mono-nums text-sm font-bold text-rose-400">
                      {Math.round(hud.survival.health)}%
                    </div>
                  </div>
                  <div className="border-x border-white/10">
                    <div className="text-[10px] text-slate-400">Stamina Cap</div>
                    <div
                      className={`font-mono-nums text-sm font-bold ${
                        hud.survival.isSick ? 'text-amber-400' : 'text-sky-400'
                      }`}
                    >
                      {Math.round(hud.survival.stamina)}/{hud.survival.maxStamina}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Rain Gear</div>
                    <div
                      className={`text-xs font-semibold ${
                        hud.survival.wearingRaincoat || hud.survival.carryingUmbrella
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {hud.survival.carryingUmbrella
                        ? 'Umbrella'
                        : hud.survival.wearingRaincoat
                          ? 'Raincoat'
                          : 'None'}
                    </div>
                  </div>
                </div>

                {/* Featured House Builder & Multi-Floor Launcher */}
                <button
                  type="button"
                  onClick={() => setTab('builder')}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-gradient-to-r from-[#132229] to-[#121a24] p-3.5 text-left transition-colors hover:border-emerald-400/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-md">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-emerald-200">
                        Build &amp; Extend House (V)
                      </div>
                      <div className="truncate text-[11px] text-slate-300">
                        Add rooms, wooden stairs, 2nd &amp; 3rd floors, or new homes
                      </div>
                    </div>
                  </div>
                  <span className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shrink-0">
                    Open
                  </span>
                </button>

                {/* 2x3 Mobile App Launcher Grid */}
                <div>
                  <div className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Apps
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTab('bakery')}
                      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-[#121a24] p-3 transition-colors hover:border-amber-400/45 hover:bg-[#17212e]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-slate-950 shadow-md">
                        <Store className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-100">Bakery</span>
                      <span className="font-mono-nums text-[10px] text-amber-300">
                        {hud.bakery.stage === 'built'
                          ? `${hud.bakery.shelvesOwned}/4 Shelves`
                          : 'Build'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab('pastries')}
                      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-[#121a24] p-3 transition-colors hover:border-rose-400/45 hover:bg-[#17212e]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 text-white shadow-md">
                        <Croissant className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-100">Pastries</span>
                      <span className="font-mono-nums text-[10px] text-slate-400">
                        {totalPastryInPack} in pack
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab('cooking')}
                      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-[#121a24] p-3 transition-colors hover:border-emerald-400/45 hover:bg-[#17212e]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-md">
                        <ChefHat className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-100">Cooking</span>
                      <span className="text-[10px] text-slate-400">Items &amp; Craft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab('decorations')}
                      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-[#121a24] p-3 transition-colors hover:border-orange-400/45 hover:bg-[#17212e]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-amber-700 text-white shadow-md">
                        <Lamp className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-100">Decor</span>
                      <span className="font-mono-nums text-[10px] text-slate-400">
                        {hud.decorationsPlaced.length}/{DECORATION_SHOP_LISTINGS.length} placed
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab('clothes')}
                      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-[#121a24] p-3 transition-colors hover:border-sky-400/45 hover:bg-[#17212e]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-md">
                        <Shirt className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-100">Clothes</span>
                      <span className="text-[10px] text-slate-400">Rain &amp; Coats</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab('ledger')}
                      className="group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-[#121a24] p-3 transition-colors hover:border-amber-400/45 hover:bg-[#17212e]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-amber-300 shadow-md">
                        <Receipt className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-100">Ledger</span>
                      <span className="font-mono-nums text-[10px] text-amber-300">
                        {hud.shop.salesHistory.length} sales
                      </span>
                    </button>
                  </div>
                </div>

                {/* Active Customer Bakery Orders Alert */}
                {hud.bakeryOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab('bakery')}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-amber-400/45 bg-amber-500/15 p-3 text-left text-xs text-amber-100 hover:bg-amber-500/22"
                  >
                    <Bell className="h-5 w-5 text-amber-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {hud.bakeryOrders.length} Customer Order(s) Waiting!
                      </div>
                      <div className="text-[11px] text-amber-200/85">
                        Tap to Take or Refuse orders before the 3:00 timer runs out (
                        {formatCountdown(Math.min(...hud.bakeryOrders.map((o) => o.remainingSec)))} left).
                      </div>
                    </div>
                  </button>
                )}

                {/* Active Delivery / Ready-to-Install Decor Widget */}
                {(inTransitDeliveries.length > 0 || atDoorDeliveries.length > 0 || uninstalledDecorCount > 0) && (
                  <button
                    type="button"
                    onClick={() => setTab('decorations')}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/12 p-3 text-left text-xs text-emerald-100 hover:bg-emerald-500/18"
                  >
                    <Truck className="h-5 w-5 text-emerald-300 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {atDoorDeliveries.length > 0
                          ? `${atDoorDeliveries.length} Delivery Parcel(s) at Your Door!`
                          : uninstalledDecorCount > 0
                            ? `${uninstalledDecorCount} Delivered Item(s) Ready to Install`
                            : `Doorstep Delivery in Progress`}
                      </div>
                      <div className="text-[11px] text-emerald-200/80">
                        {atDoorDeliveries.length > 0
                          ? 'Step outside your front door and press [E] to collect, then install in House Decor.'
                          : uninstalledDecorCount > 0
                            ? 'Tap to open House Decor and install your lamps & furniture.'
                            : `Arriving at your cabin front door in ${formatCountdown(
                                Math.min(...inTransitDeliveries.map((d) => d.remainingSec)),
                              )}.`}
                      </div>
                    </div>
                  </button>
                )}

                {/* Quick Rain Warning Tip on Home Screen if unprotected */}
                {!(hud.survival.wearingRaincoat || hud.survival.carryingUmbrella) && (
                  <button
                    type="button"
                    onClick={() => setTab('clothes')}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-left text-xs text-sky-100 hover:bg-sky-500/15"
                  >
                    <Umbrella className="h-5 w-5 text-sky-300 shrink-0" />
                    <div>
                      <div className="font-semibold">Protect Against Rain Sickness</div>
                      <div className="text-[11px] text-sky-200/80">
                        Tap to buy a Waxed Raincoat ($35), Umbrella ($25), or Night Torch ($18).
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* 0B. HOUSE BUILDER & MULTI-STORY FLOORING APP */}
            {tab === 'builder' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-[#132227] to-[#111720] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                    Custom Home &amp; Multi-Floor Designer
                  </div>
                  <h3 className="mt-0.5 font-display text-lg font-bold text-slate-100">
                    Build, Extend &amp; Add Stairs
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Construct a brand-new house anywhere in the valley, extend your cabin sideways, or
                    install wooden stairs and 2nd/3rd story flooring. Uses pack Timber/Stone first or
                    pays automatically with Money.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 font-mono-nums text-[11px] text-slate-200">
                    <span className="rounded-lg border border-white/10 bg-[#0d141c] px-2.5 py-1">
                      Timber: {hud.inventory.wood}
                    </span>
                    <span className="rounded-lg border border-white/10 bg-[#0d141c] px-2.5 py-1">
                      Granite: {hud.inventory.stone}
                    </span>
                    <span className="rounded-lg border border-white/10 bg-[#0d141c] px-2.5 py-1">
                      Iron: {hud.inventory.iron}
                    </span>
                    <span className="rounded-lg border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 text-emerald-300">
                      ${hud.shop.gold}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartHouseBuild('foundation')}
                    className="mt-3.5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <Hammer className="h-4 w-4" />
                    <span>Enter 3D House Builder Mode (V)</span>
                  </button>
                </div>

                {/* One-Tap Quick Cabin Extensions & 2nd Story */}
                <div className="space-y-2.5 rounded-2xl border border-white/10 bg-[#141c26] p-3.5">
                  <div className="text-xs font-semibold text-slate-100">
                    One-Tap House Upgrades
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0d131b] p-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100">
                        Quick-Extend Starter Cabin (+4×4m Wing)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Opens the side wall &amp; adds a connected room with windows + roof
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={hud.shop.gold < 36}
                      onClick={onQuickExtendCabin}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        hud.shop.gold >= 36
                          ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'cursor-not-allowed bg-slate-800 text-slate-500'
                      }`}
                    >
                      Extend ($36)
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0d131b] p-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100">
                        Add 2nd Story Floor + Wooden Stairs
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Installs walkable stairs, 2nd-floor deck with stairwell, walls &amp; roof
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={hud.shop.gold < 58}
                      onClick={onQuickAddSecondStory}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        hud.shop.gold >= 58
                          ? 'cursor-pointer bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          : 'cursor-not-allowed bg-slate-800 text-slate-500'
                      }`}
                    >
                      Add 2nd Floor ($58)
                    </button>
                  </div>
                </div>

                {/* Full Modular Pieces Catalog */}
                <div className="space-y-2">
                  <div className="px-1 text-xs font-semibold text-slate-200">
                    Pick a Piece to Place in 3D ({hud.structuresCount} built)
                  </div>
                  {HOUSE_BUILD_PIECES.map((piece) => {
                    const isDemolish = piece.id === 'demolish';
                    const isMove = piece.id === 'move';
                    const matText = isDemolish
                      ? '75% Material Refund'
                      : isMove
                        ? 'Free Relocation (Structures & Decor)'
                        : Object.entries(piece.materials)
                            .map(([k, q]) => `${q} ${ITEM_CATALOG[k as ItemId].name.split(' ').pop()}`)
                            .join(' + ');

                    return (
                      <div
                        key={piece.id}
                        className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-white/8 px-1.5 py-0.5 font-mono-nums text-[10px] font-bold text-amber-300">
                              [{piece.hotkey}]
                            </span>
                            <h4 className="truncate text-xs font-semibold text-slate-100">
                              {piece.name}
                            </h4>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{piece.description}</p>
                          <div
                            className={`mt-1 font-mono-nums text-[10px] ${
                              isMove ? 'text-sky-300' : 'text-emerald-300'
                            }`}
                          >
                            {isDemolish || isMove ? matText : `${matText}  or  $${piece.goldCost}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onStartHouseBuild(piece.id)}
                          className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                            isDemolish
                              ? 'border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                              : isMove
                                ? 'border border-sky-400/50 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          }`}
                        >
                          {isDemolish ? 'Remodel' : isMove ? 'Move' : 'Place'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 1. BAKERY SHOP APP */}
            {tab === 'bakery' && (
              <div className="space-y-4">
                {hud.bakery.stage === 'none' && (
                  <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-[#141c26] p-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                        Start Your First Business
                      </div>
                      <h3 className="mt-0.5 font-display text-lg font-bold text-slate-100">
                        Build Your Bakery Shop
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                        Place your bakery foundation, construct the brick oven &amp; awning, buy
                        display shelves, and sell cakes &amp; pastries to earn money!
                      </p>
                    </div>

                    <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#0e141c] p-3">
                      <div className="text-xs font-semibold text-slate-100">
                        Step 1 · Lay Foundation (${BAKERY_COSTS.foundationGold})
                      </div>
                      <button
                        type="button"
                        onClick={onStartBakeryPlacement}
                        className="w-full cursor-pointer rounded-xl bg-amber-500 px-3.5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        Aim &amp; Place in 3D World (B)
                      </button>
                      <button
                        type="button"
                        disabled={hud.shop.gold < BAKERY_COSTS.foundationGold}
                        onClick={onQuickBuildBakery}
                        className={`w-full rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                          hud.shop.gold >= BAKERY_COSTS.foundationGold
                            ? 'cursor-pointer border-white/15 bg-[#192432] text-slate-200 hover:bg-[#223142]'
                            : 'cursor-not-allowed border-white/10 bg-slate-800 text-slate-500'
                        }`}
                      >
                        Quick-Build on Main Road (${BAKERY_COSTS.foundationGold})
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0e141c] p-3 text-xs text-slate-400">
                      <strong className="text-slate-200">Step 2:</strong> Finish walls &amp; oven ($
                      {BAKERY_COSTS.buildGold} or {BAKERY_COSTS.buildWood} Wood +{' '}
                      {BAKERY_COSTS.buildStone} Stone), then buy shelves (${BAKERY_COSTS.shelfGold}).
                    </div>
                  </div>
                )}

                {hud.bakery.stage === 'foundation' && (
                  <div className="space-y-3 rounded-2xl border border-amber-500/35 bg-[#141c26] p-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                        Step 2 of 2 · Foundation Ready
                      </div>
                      <h3 className="mt-0.5 font-display text-lg font-bold text-slate-100">
                        Finish Bakery Walls &amp; Brick Oven
                      </h3>
                      <p className="mt-1 text-xs text-slate-300">
                        Complete your bakery frame to install display shelves and open for customers.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={hud.shop.gold < BAKERY_COSTS.buildGold}
                      onClick={() => onFinishBakeryBuild(false)}
                      className={`w-full rounded-xl px-4 py-2.5 text-xs font-semibold ${
                        hud.shop.gold >= BAKERY_COSTS.buildGold
                          ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'cursor-not-allowed bg-slate-800 text-slate-500'
                      }`}
                    >
                      Construct Bakery (${BAKERY_COSTS.buildGold})
                    </button>
                    <button
                      type="button"
                      disabled={
                        hud.inventory.wood < BAKERY_COSTS.buildWood ||
                        hud.inventory.stone < BAKERY_COSTS.buildStone
                      }
                      onClick={() => onFinishBakeryBuild(true)}
                      className={`w-full rounded-xl border px-4 py-2.5 text-xs font-medium ${
                        hud.inventory.wood >= BAKERY_COSTS.buildWood &&
                        hud.inventory.stone >= BAKERY_COSTS.buildStone
                          ? 'cursor-pointer border-white/15 bg-[#192432] text-slate-200 hover:bg-[#223142]'
                          : 'cursor-not-allowed border-white/10 bg-slate-800 text-slate-500'
                      }`}
                    >
                      Use Materials ({BAKERY_COSTS.buildWood} Wood, {BAKERY_COSTS.buildStone} Stone)
                    </button>
                  </div>
                )}

                {hud.bakery.stage === 'built' && (
                  <>
                    {/* Open / Close & Goodwill Control */}
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#141c26] p-3.5">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                          <span>{hud.bakery.isOpen ? 'Bakery Open for Orders' : 'Bakery Currently Closed'}</span>
                          <span className="inline-flex items-center gap-0.5 font-mono-nums text-[11px] text-amber-300">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {hud.shop.reputation.toFixed(1)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {totalPastryStocked} stocked on {hud.bakery.shelvesOwned} shelves · Goodwill affects demand
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleShopOpen}
                        className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                          hud.bakery.isOpen
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        }`}
                      >
                        {hud.bakery.isOpen ? 'Close' : 'Open Shop'}
                      </button>
                    </div>

                    {/* Active Customer Orders Panel (3:00 Timer) */}
                    <div className="space-y-2.5 rounded-2xl border border-amber-500/30 bg-[#131a23] p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                          <Bell className="h-3.5 w-3.5 text-amber-400" />
                          <span>Customer Orders (3:00 Limit)</span>
                        </div>
                        <span className="font-mono-nums text-[11px] text-slate-400">
                          {hud.bakeryOrders.length} active
                        </span>
                      </div>

                      {hud.heldPastry && (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-500/12 px-3 py-2 text-xs">
                          <span className="font-medium text-amber-100">
                            Carrying: <strong>{ITEM_CATALOG[hud.heldPastry].name}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={onPutBackPastry}
                            className="cursor-pointer rounded-lg border border-white/15 bg-[#1b2532] px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:text-white whitespace-nowrap shrink-0"
                          >
                            Put Back
                          </button>
                        </div>
                      )}

                      {hud.bakeryOrders.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          {hud.bakery.isOpen
                            ? 'Waiting for village customers to walk up to the counter and place an order.'
                            : 'Open your Bakery above and stock shelves so customers come place orders.'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {hud.bakeryOrders.map((order) => {
                            const def = ITEM_CATALOG[order.pastryId];
                            const shelfStock = hud.bakery.shelves
                              .filter((s) => s.shelfIndex < hud.bakery.shelvesOwned && s.pastryId === order.pastryId)
                              .reduce((sum, s) => sum + s.stock, 0);
                            const packStock = hud.inventory[order.pastryId] || 0;
                            const hasShelfStock = shelfStock >= order.quantity;
                            const holdingMatch = hud.heldPastry === order.pastryId;
                            const urgent = order.remainingSec <= 45;
                            const paidPreview = Math.round(
                              order.price * (hud.survival.wearingBakerApron ? 1.18 : 1.0),
                            );

                            return (
                              <div
                                key={order.id}
                                className={`rounded-xl border p-3 text-xs ${
                                  urgent
                                    ? 'border-rose-500/45 bg-[#1d1317]'
                                    : 'border-white/10 bg-[#0d131b]'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-100">
                                    {order.customerName}
                                  </span>
                                  <span
                                    className={`flex items-center gap-1 font-mono-nums font-bold ${
                                      urgent ? 'text-rose-400' : 'text-amber-300'
                                    }`}
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatCountdown(order.remainingSec)}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
                                  <span>
                                    Wants: <strong className="text-white">{def.name}</strong>
                                  </span>
                                  <span className="font-mono-nums font-semibold text-emerald-400">
                                    +${paidPreview}
                                  </span>
                                </div>
                                <div className="mt-1 font-mono-nums text-[10px] text-slate-400">
                                  On Shelves: {shelfStock} · In Pack: {packStock}
                                </div>

                                {order.status === 'waiting_decision' ? (
                                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={!hasShelfStock}
                                      onClick={() => onAcceptOrder(order.id)}
                                      className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                                        hasShelfStock
                                          ? 'cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500'
                                          : 'cursor-not-allowed bg-slate-800 text-slate-500'
                                      }`}
                                    >
                                      {hasShelfStock ? 'Take Order' : 'No Shelf Stock'}
                                    </button>
                                    {!hasShelfStock && packStock > 0 && hud.bakery.shelvesOwned > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => onQuickStorePastry(order.pastryId, 1)}
                                        className="cursor-pointer rounded-xl border border-amber-400/50 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/25 whitespace-nowrap"
                                      >
                                        Store 1 on Shelf
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onRefuseOrder(order.id)}
                                      className="cursor-pointer rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/22 whitespace-nowrap"
                                    >
                                      Refuse
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    {holdingMatch ? (
                                      <button
                                        type="button"
                                        onClick={() => onServeOrder(order.id)}
                                        className="flex-1 cursor-pointer rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
                                      >
                                        Give {def.name} to Customer (+${paidPreview})
                                      </button>
                                    ) : hasShelfStock && !hud.heldPastry ? (
                                      <button
                                        type="button"
                                        onClick={() => onTakePastryFromShelf(order.pastryId)}
                                        className="flex-1 cursor-pointer rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
                                      >
                                        Take from Shelf &amp; Deliver
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-rose-300">
                                        {hud.heldPastry
                                          ? 'Put back current tray item first'
                                          : 'Restock this pastry on a shelf to take it!'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Signboard Name */}
                    <div className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5">
                      <label className="mb-1.5 block text-[11px] font-medium text-slate-300">
                        Bakery Signboard Name
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          maxLength={24}
                          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0b1017] px-3 py-2 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateShopName(nameDraft)}
                          className="cursor-pointer rounded-xl border border-white/15 bg-[#1c2735] px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-[#253447] whitespace-nowrap shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Shelf Purchase Card */}
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#141c26] p-3.5">
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          Display Shelves ({hud.bakery.shelvesOwned}/{BAKERY_COSTS.maxShelves})
                        </div>
                        <div className="text-[11px] text-slate-400">
                          +2 visible 3D pastry tiers per shelf
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={
                          hud.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves ||
                          hud.shop.gold < BAKERY_COSTS.shelfGold
                        }
                        onClick={onBuyBakeryShelf}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                          hud.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves
                            ? 'cursor-default border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : hud.shop.gold >= BAKERY_COSTS.shelfGold
                              ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : 'cursor-not-allowed bg-slate-800 text-slate-500'
                        }`}
                      >
                        {hud.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves
                          ? 'Maxed'
                          : `Buy Shelf ($${BAKERY_COSTS.shelfGold})`}
                      </button>
                    </div>

                    {hud.bakery.shelvesOwned === 0 ? (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                        Buy a Display Shelf (${BAKERY_COSTS.shelfGold}) above, then purchase Cakes &amp;
                        Pastries to display and sell them.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-semibold text-slate-200">
                            Store Pastries on Purchased Shelves
                          </span>
                          <button
                            type="button"
                            onClick={() => setTab('pastries')}
                            className="cursor-pointer text-xs font-semibold text-amber-400 hover:text-amber-300"
                          >
                            Buy Pastries &rarr;
                          </button>
                        </div>

                        {hud.bakery.shelves
                          .filter((slot) => slot.shelfIndex < hud.bakery.shelvesOwned)
                          .map((slot) => {
                            const itemDef = slot.pastryId ? ITEM_CATALOG[slot.pastryId] : null;
                            const demand = slot.pastryId
                              ? getWeatherDemandMultiplier(slot.pastryId, hud.meteorology.weather)
                              : 1;
                            const recommendedMax = itemDef
                              ? Math.round(itemDef.baseValue * demand * 1.45)
                              : 0;

                            return (
                              <div
                                key={slot.slotIndex}
                                className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-200">
                                    Shelf #{slot.shelfIndex + 1} ·{' '}
                                    {slot.slotIndex % 2 === 0 ? 'Top Tier' : 'Bottom Tier'}
                                  </span>
                                  {demand > 1.05 && (
                                    <span className="text-[10px] font-semibold text-amber-400">
                                      +25% Weather Bonus
                                    </span>
                                  )}
                                </div>

                                <select
                                  value={slot.pastryId ?? ''}
                                  onChange={(e) =>
                                    onStockSlot(
                                      slot.slotIndex,
                                      (e.target.value || null) as BakeryPastryId | null,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/15 bg-[#0b1017] px-3 py-2 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                                >
                                  <option value="">Empty Shelf Tier</option>
                                  {PASTRY_IDS.map((pid) => (
                                    <option key={pid} value={pid}>
                                      {ITEM_CATALOG[pid].name} (Pack: {hud.inventory[pid] || 0})
                                    </option>
                                  ))}
                                </select>

                                {slot.pastryId && itemDef && (
                                  <div className="mt-3 space-y-2.5 border-t border-white/10 pt-2.5">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-400">
                                        On Shelf (Pack: {hud.inventory[slot.pastryId] || 0})
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => onAddStock(slot.slotIndex, -1)}
                                          className="cursor-pointer rounded-lg border border-white/12 bg-[#1c2633] px-2.5 py-1 font-mono-nums text-slate-200 hover:bg-[#263344]"
                                        >
                                          -
                                        </button>
                                        <span className="min-w-[22px] text-center font-mono-nums font-semibold text-slate-100">
                                          {slot.stock}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => onAddStock(slot.slotIndex, 1)}
                                          className="cursor-pointer rounded-lg border border-white/12 bg-[#1c2633] px-2.5 py-1 font-mono-nums text-slate-200 hover:bg-[#263344]"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-400">
                                        Price (Max ~${recommendedMax})
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <span className="font-mono-nums text-slate-400">$</span>
                                        <input
                                          type="number"
                                          min={5}
                                          max={200}
                                          value={slot.price}
                                          onChange={(e) =>
                                            onSetSlotPrice(slot.slotIndex, Number(e.target.value))
                                          }
                                          className="w-16 rounded-lg border border-white/15 bg-[#0b1017] px-2 py-1 text-right font-mono-nums text-xs text-amber-300"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 2. CAKES, PASTRIES & SHELVES APP */}
            {tab === 'pastries' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <div>
                    <div className="text-xs font-semibold text-amber-200">
                      Bakery Shelves ({hud.bakery.shelvesOwned}/{BAKERY_COSTS.maxShelves})
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Store cakes &amp; pastries on shelves
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      hud.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves ||
                      hud.shop.gold < BAKERY_COSTS.shelfGold
                    }
                    onClick={onBuyBakeryShelf}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                      hud.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves
                        ? 'cursor-default border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : hud.shop.gold >= BAKERY_COSTS.shelfGold
                          ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'cursor-not-allowed bg-slate-800 text-slate-500'
                    }`}
                  >
                    {hud.bakery.shelvesOwned >= BAKERY_COSTS.maxShelves
                      ? 'Owned 4/4'
                      : `Buy Shelf ($${BAKERY_COSTS.shelfGold})`}
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div className="px-1 text-xs font-semibold text-slate-200">
                    Wholesale Cakes &amp; Pastries
                  </div>
                  {PASTRY_SHOP_LISTINGS.map((listing) => {
                    const def = ITEM_CATALOG[listing.itemId];
                    const owned = hud.inventory[listing.itemId] || 0;
                    const canAfford = hud.shop.gold >= listing.price;

                    return (
                      <div
                        key={listing.itemId}
                        className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-semibold text-amber-300">
                              {listing.badge}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-100">{def.name}</h4>
                          </div>
                          <span className="font-mono-nums text-sm font-bold text-amber-400 shrink-0">
                            ${listing.price}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{listing.effectNote}</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
                          <span className="font-mono-nums text-[11px] text-slate-300">
                            In Pack: {owned}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {owned > 0 && hud.bakery.shelvesOwned > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onQuickStorePastry(listing.itemId as BakeryPastryId, 1)}
                                  className="cursor-pointer rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 whitespace-nowrap"
                                >
                                  Store 1
                                </button>
                                {owned > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onQuickStorePastry(listing.itemId as BakeryPastryId, owned)
                                    }
                                    className="cursor-pointer rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 whitespace-nowrap"
                                  >
                                    Store All
                                  </button>
                                )}
                              </>
                            )}
                            {owned > 0 && (
                              <button
                                type="button"
                                onClick={() => onConsumeItem(listing.itemId)}
                                className="cursor-pointer rounded-xl border border-white/15 bg-[#1b2734] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:text-white"
                              >
                                Eat
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => onBuySupply(listing.itemId, listing.price)}
                              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                                canAfford
                                  ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
                              }`}
                            >
                              Buy (${listing.price})
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  <div className="px-1 text-xs font-semibold text-slate-200">
                    Bake Fresh from Kitchen Ingredients
                  </div>
                  {BAKING_RECIPES.map((recipe) => {
                    const def = ITEM_CATALOG[recipe.pastryId];
                    const canBake = Object.entries(recipe.ingredients).every(
                      ([k, qty]) => (hud.inventory[k as ItemId] || 0) >= (qty || 0),
                    );
                    const hasSkillet = hud.inventory.cast_skillet > 0;

                    return (
                      <div
                        key={recipe.pastryId}
                        className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-100">
                            {def.name}{' '}
                            <span className="font-mono-nums text-xs text-slate-400">
                              (×{recipe.yieldCount + (hasSkillet ? 1 : 0)})
                            </span>
                          </h4>
                          <span className="font-mono-nums text-xs text-amber-400">
                            ~${def.baseValue} retail
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                          {Object.entries(recipe.ingredients).map(([k, qty]) => {
                            const id = k as ItemId;
                            const owned = hud.inventory[id] || 0;
                            const ok = owned >= (qty || 0);
                            return (
                              <span
                                key={k}
                                className={`font-mono-nums ${ok ? 'text-slate-300' : 'text-rose-400'}`}
                              >
                                {ITEM_CATALOG[id].name}: {owned}/{qty}
                              </span>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
                          <span className="font-mono-nums text-[11px] text-slate-400">
                            In Pack: {hud.inventory[recipe.pastryId] || 0}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {(hud.inventory[recipe.pastryId] || 0) > 0 && hud.bakery.shelvesOwned > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onQuickStorePastry(
                                    recipe.pastryId,
                                    hud.inventory[recipe.pastryId] || 1,
                                  )
                                }
                                className="cursor-pointer rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 whitespace-nowrap"
                              >
                                Store on Shelf
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!canBake}
                              onClick={() => onBakePastry(recipe.pastryId)}
                              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                                canBake
                                  ? 'cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500'
                                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
                              }`}
                            >
                              Bake Batch
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. COOKING ITEMS & CRAFTING APP */}
            {tab === 'cooking' && (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  <div className="px-1 text-xs font-semibold text-slate-200">
                    Cooking Items, Cookware &amp; Meals
                  </div>
                  {COOKING_SHOP_LISTINGS.map((listing) => {
                    const def = ITEM_CATALOG[listing.itemId];
                    const owned = hud.inventory[listing.itemId] || 0;
                    const isCookware =
                      listing.itemId === 'cast_skillet' || listing.itemId === 'copper_kettle';
                    const alreadyOwned = isCookware && owned > 0;
                    const canAfford = hud.shop.gold >= listing.price;

                    return (
                      <div
                        key={listing.itemId}
                        className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-semibold text-emerald-300">
                              {listing.badge}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-100">{def.name}</h4>
                          </div>
                          <span className="font-mono-nums text-sm font-bold text-amber-400 shrink-0">
                            ${listing.price}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{listing.effectNote}</p>
                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                          <span className="font-mono-nums text-[11px] text-slate-300">
                            {alreadyOwned ? 'Installed in Kitchen' : `In Pack: ${owned}`}
                          </span>
                          <button
                            type="button"
                            disabled={alreadyOwned || !canAfford}
                            onClick={() => onBuySupply(listing.itemId, listing.price)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              alreadyOwned
                                ? 'cursor-default border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                : canAfford
                                  ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                                  : 'cursor-not-allowed bg-slate-800 text-slate-500'
                            }`}
                          >
                            {alreadyOwned ? 'Owned' : `Buy ($${listing.price})`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-200">
                    <Hammer className="h-3.5 w-3.5 text-amber-400" />
                    <span>Cabin Workbench &amp; Gear Crafting</span>
                  </div>
                  {CRAFT_RECIPES.map((recipe) => {
                    const def = ITEM_CATALOG[recipe.itemId];
                    const missingBench = recipe.requiresWorkbench && !hud.hasWorkbench;
                    const canAfford = Object.entries(recipe.ingredients).every(
                      ([k, qty]) => (hud.inventory[k as ItemId] || 0) >= (qty || 0),
                    );
                    return (
                      <div
                        key={recipe.itemId}
                        className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-slate-100">
                            {def.name}{' '}
                            {recipe.yieldCount > 1 && (
                              <span className="font-mono-nums text-xs text-slate-400">
                                (×{recipe.yieldCount})
                              </span>
                            )}
                          </h4>
                          <span className="font-mono-nums text-xs text-amber-400">
                            ~${def.baseValue}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{def.description}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                          {Object.entries(recipe.ingredients).map(([k, qty]) => {
                            const id = k as ItemId;
                            const owned = hud.inventory[id] || 0;
                            const ok = owned >= (qty || 0);
                            return (
                              <span
                                key={k}
                                className={`font-mono-nums ${ok ? 'text-slate-300' : 'text-rose-400'}`}
                              >
                                {ITEM_CATALOG[id].name}: {owned}/{qty}
                              </span>
                            );
                          })}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                          <span className="font-mono-nums text-[11px] text-slate-400">
                            In Pack: {hud.inventory[recipe.itemId] || 0}
                          </span>
                          <button
                            type="button"
                            disabled={missingBench || !canAfford}
                            onClick={() => onCraft(recipe.itemId)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              missingBench || !canAfford
                                ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                                : 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                          >
                            {missingBench ? 'Needs Bench' : 'Craft'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. LAMPS & HOUSE DECORATIONS APP */}
            {tab === 'decorations' && (
              <div className="space-y-2.5">
                <div className="rounded-2xl border border-amber-500/25 bg-[#141c26] p-3.5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                    <Truck className="h-4 w-4" />
                    <span>1-Minute Doorstep Delivery &amp; House Install</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Order lamps and furniture below. Parcels arrive at your cabin front door in{' '}
                    <strong className="text-slate-200">1 minute</strong>—pick them up with{' '}
                    <strong className="text-slate-200">[E]</strong>, then tap{' '}
                    <strong className="text-slate-200">Install in House</strong>.
                  </p>
                  {uninstalledDecorCount > 0 && (
                    <button
                      type="button"
                      onClick={onInstallAllDecor}
                      className="mt-2.5 w-full cursor-pointer rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Install All Delivered Items ({uninstalledDecorCount})
                    </button>
                  )}
                </div>

                {DECORATION_SHOP_LISTINGS.map((listing) => {
                  const decId = listing.itemId as DecorationItemId;
                  const def = ITEM_CATALOG[decId];
                  const owned = hud.decorationsOwned.includes(decId);
                  const placed = hud.decorationsPlaced.includes(decId);
                  const delivery = hud.deliveries.find((d) => d.itemId === decId);
                  const canAfford = hud.shop.gold >= listing.price;

                  return (
                    <div
                      key={decId}
                      className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold text-orange-300">
                            {listing.badge}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-100">{def.name}</h4>
                        </div>
                        <span className="font-mono-nums text-sm font-bold text-amber-400 shrink-0">
                          ${listing.price}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{listing.effectNote}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                        <span className="font-mono-nums text-[11px] text-slate-300">
                          {delivery?.status === 'in_transit'
                            ? `Arriving in ${formatCountdown(delivery.remainingSec)}`
                            : delivery?.status === 'at_door'
                              ? 'At Front Door — Collect [E]'
                              : owned
                                ? placed
                                  ? 'Installed in House'
                                  : 'Delivered (Ready to Install)'
                                : '1m Door Delivery'}
                        </span>
                        {delivery?.status === 'in_transit' ? (
                          <span className="flex items-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/12 px-3 py-1.5 font-mono-nums text-xs font-semibold text-amber-300 whitespace-nowrap shrink-0">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{formatCountdown(delivery.remainingSec)}</span>
                          </span>
                        ) : delivery?.status === 'at_door' ? (
                          <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 whitespace-nowrap shrink-0">
                            Pick Up at Door [E]
                          </span>
                        ) : owned ? (
                          <button
                            type="button"
                            onClick={() => onToggleDecoration(decId)}
                            className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              placed
                                ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                          >
                            {placed ? 'Installed (Remove)' : 'Install in House'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuySupply(decId, listing.price)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              canAfford
                                ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'cursor-not-allowed bg-slate-800 text-slate-500'
                            }`}
                          >
                            Order (${listing.price})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 5. CLOTHES, NIGHT TORCH & RAIN GEAR APP */}
            {tab === 'clothes' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-100">
                  Buy a <strong>Night Torch</strong> ($18) for dark nights, plus a{' '}
                  <strong>Raincoat</strong> or <strong>Umbrella</strong> to prevent rain sickness!
                </div>

                {/* Night Torch Listing */}
                {NIGHT_GEAR_LISTINGS.map((listing) => {
                  const def = ITEM_CATALOG[listing.itemId];
                  const owned = (hud.inventory.night_torch || 0) > 0;
                  const canAfford = hud.shop.gold >= listing.price;

                  return (
                    <div
                      key={listing.itemId}
                      className="rounded-2xl border border-orange-500/35 bg-[#181617] p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                            <Flame className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-orange-300">
                              {listing.badge}
                            </div>
                            <h4 className="text-sm font-semibold text-slate-100">{def.name}</h4>
                          </div>
                        </div>
                        <span className="font-mono-nums text-sm font-bold text-amber-400 shrink-0">
                          ${listing.price}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">{listing.effectNote}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                        <span className="text-[11px] text-slate-300">
                          {owned ? (hud.torchLit ? 'Lit in Hand (T)' : 'In Pack (Ready)') : 'Not Owned'}
                        </span>
                        {owned ? (
                          <button
                            type="button"
                            onClick={onToggleTorch}
                            className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              hud.torchLit
                                ? 'border border-orange-400/50 bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                          >
                            {hud.torchLit ? 'Lit (Put Away)' : 'Light Torch (T)'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuySupply(listing.itemId, listing.price)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              canAfford
                                ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'cursor-not-allowed bg-slate-800 text-slate-500'
                            }`}
                          >
                            Buy (${listing.price})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {CLOTHING_SHOP_LISTINGS.map((listing) => {
                  const clothId = listing.itemId as ClothingItemId;
                  const def = ITEM_CATALOG[clothId];
                  const owned = (hud.inventory[clothId] || 0) > 0;
                  const equipped = isWearing(clothId);
                  const canAfford = hud.shop.gold >= listing.price;

                  return (
                    <div
                      key={clothId}
                      className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-semibold text-sky-300">
                            {listing.badge}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-100">{def.name}</h4>
                        </div>
                        <span className="font-mono-nums text-sm font-bold text-amber-400 shrink-0">
                          ${listing.price}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{listing.effectNote}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                        <span className="text-[11px] text-slate-300">
                          {owned ? (equipped ? 'Currently Wearing' : 'In Wardrobe') : 'Not Owned'}
                        </span>
                        {owned ? (
                          <button
                            type="button"
                            onClick={() => onToggleClothing(clothId)}
                            className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              equipped
                                ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            }`}
                          >
                            {equipped ? 'Wearing (Remove)' : 'Wear'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuySupply(clothId, listing.price)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                              canAfford
                                ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                                : 'cursor-not-allowed bg-slate-800 text-slate-500'
                            }`}
                          >
                            Buy (${listing.price})
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 6. SALES LEDGER APP */}
            {tab === 'ledger' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5">
                    <div className="text-[11px] text-slate-400">Total Sales</div>
                    <div className="mt-0.5 font-mono-nums text-lg font-bold text-slate-100">
                      {hud.shop.salesHistory.length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#141c26] p-3.5">
                    <div className="text-[11px] text-slate-400">Recent Revenue</div>
                    <div className="mt-0.5 font-mono-nums text-lg font-bold text-emerald-400">
                      +${totalSalesGold}
                    </div>
                  </div>
                </div>

                {hud.shop.salesHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#141c26] px-4 py-10 text-center">
                    <Package className="mb-2 h-8 w-8 text-slate-500" />
                    <p className="text-sm font-medium text-slate-200">No sales recorded yet</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Build your Bakery Shop, install shelves, stock cakes &amp; pastries, and open
                      for customers!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hud.shop.salesHistory.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#141c26] px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-100">
                            {ITEM_CATALOG[sale.itemId].name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {sale.travelerName} · Day {sale.day}, {sale.timeStr}
                          </div>
                        </div>
                        <span className="font-mono-nums font-bold text-emerald-400 shrink-0">
                          +${sale.price}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Bottom Navigation Bar & Home Gesture Bar */}
          <div className="border-t border-white/10 bg-[#080c12] px-1.5 pt-1.5 pb-2">
            <div className="grid grid-cols-7 gap-0.5">
              {(
                [
                  { id: 'home', label: 'Home', Icon: Home },
                  { id: 'builder', label: 'Build', Icon: Layers },
                  { id: 'bakery', label: 'Bakery', Icon: Store },
                  { id: 'pastries', label: 'Pastries', Icon: Croissant },
                  { id: 'cooking', label: 'Cook', Icon: ChefHat },
                  { id: 'decorations', label: 'Decor', Icon: Lamp },
                  { id: 'clothes', label: 'Clothes', Icon: Shirt },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                      active
                        ? 'bg-amber-500/18 text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Smartphone Home Indicator Pill */}
            <div className="mt-1.5 flex justify-center">
              <button
                type="button"
                onClick={() => setTab('home')}
                aria-label="Mobile Home Indicator"
                className="h-1 w-24 cursor-pointer rounded-full bg-white/30 transition-colors hover:bg-white/55"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
