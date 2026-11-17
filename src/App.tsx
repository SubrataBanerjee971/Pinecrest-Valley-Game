import { useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { ControlsModal } from './components/ControlsModal';
import { HUD } from './components/HUD';
import { NpcDialogueModal } from './components/NpcDialogueModal';
import { StorefrontModal } from './components/StorefrontModal';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { INITIAL_INVENTORY } from './data/catalog';
import { PinecrestWorldEngine } from './engine/worldEngine';
import { GameHudSnapshot, NpcDialogueState, ToastMessage } from './types/game';

const DEFAULT_HUD: GameHudSnapshot = {
  started: false,
  pointerLocked: false,
  activeTool: 'axe',
  lanternLit: false,
  torchLit: false,
  hudCollapsed: false,
  bakeryBuildMode: false,
  bakeryCanPlace: false,
  houseBuildMode: false,
  houseWheelOpen: false,
  houseBuildPiece: 'foundation',
  houseBuildFloorOverride: 'auto',
  houseBuildCanPlace: false,
  houseDemolishLabel: null,
  houseMovingLabel: null,
  meteorology: {
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
  },
  survival: {
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
  },
  inventory: { ...INITIAL_INVENTORY },
  shop: {
    shopName: 'Pinecrest Bakery',
    isOpen: false,
    gold: 160,
    reputation: 4.2,
    salesHistory: [],
    activeTravelers: 0,
  },
  bakery: {
    stage: 'none',
    x: 7.2,
    z: 7.8,
    rotationY: -Math.PI / 2,
    shopName: 'Pinecrest Bakery',
    isOpen: false,
    shelvesOwned: 0,
    shelves: Array.from({ length: 8 }, (_, idx) => ({
      slotIndex: idx,
      shelfIndex: Math.floor(idx / 2),
      pastryId: null,
      stock: 0,
      price: 18,
    })),
  },
  decorationsOwned: [],
  decorationsPlaced: [],
  deliveries: [],
  bakeryOrders: [],
  heldPastry: null,
  prompt: null,
  structuresCount: 0,
  hasWorkbench: true,
  gameOver: false,
  playerX: 0,
  playerZ: 1.4,
  playerYaw: -0.96,
  structuresMini: [],
  cottagesMini: [],
  npcsMini: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PinecrestWorldEngine | null>(null);

  const [hud, setHud] = useState<GameHudSnapshot>(DEFAULT_HUD);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeModal, setActiveModal] = useState<'storefront' | 'bakery' | 'supply' | 'controls' | null>(null);
  const [activeNpc, setActiveNpc] = useState<NpcDialogueState | null>(null);
  const [muted, setMuted] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [hasSavedValley] = useState(() => PinecrestWorldEngine.hasSavedValley());

  const pushToast = useRef((toast: ToastMessage) => {
    setToasts((prev) => [toast, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, 3800);
  });

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new PinecrestWorldEngine(mount, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onToast: (toast) => pushToast.current(toast),
      onOpenModal: (modal) => {
        setActiveNpc(null);
        setActiveModal((prev) => (prev === modal ? null : modal));
      },
      onOpenNpcDialogue: (npc) => {
        if (npc) setActiveModal(null);
        setActiveNpc(npc);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(activeModal !== null || activeNpc !== null);
  }, [activeModal, activeNpc]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && activeModal !== null) {
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [activeModal]);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0e141b]">
      {/* Dedicated isolated WebGL canvas container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {!hud.started && (
        <WelcomeOverlay
          hasSavedValley={hasSavedValley}
          meteorology={hud.meteorology}
          muted={muted}
          onToggleMute={handleToggleMute}
          onOpenControls={() => setActiveModal('controls')}
          onStartNew={() => engineRef.current?.startGame(false)}
          onContinueSaved={() => engineRef.current?.startGame(true)}
        />
      )}

      {hud.started && (
        <HUD
          hud={hud}
          toasts={toasts}
          muted={muted}
          onToggleMute={handleToggleMute}
          onSaveValley={() => engineRef.current?.saveToStorage(true)}
          onOpenControls={() => setActiveModal('controls')}
          onOpenBakeryOrders={() => setActiveModal('bakery')}
          onOpenClothesTab={() => setActiveModal('supply')}
          onToggleHouseBuild={() => engineRef.current?.toggleHouseBuildMode()}
          onToggleHouseWheel={(open) => engineRef.current?.toggleHouseWheel(open)}
          onSelectHousePiece={(id, closeWheel) =>
            engineRef.current?.selectHouseBuildPiece(id, closeWheel)
          }
          onCycleHouseFloor={() => engineRef.current?.cycleHouseFloorOverride()}
          onRotateHouseGhost={() => engineRef.current?.rotateHouseGhost()}
          onCancelHouseMove={() => engineRef.current?.cancelMovingHouseElement()}
          onPutBackPastry={() => engineRef.current?.putBackHeldPastry()}
        />
      )}

      {(activeModal === 'storefront' || activeModal === 'bakery' || activeModal === 'supply') && (
        <StorefrontModal
          hud={hud}
          initialTab={
            activeModal === 'supply'
              ? 'clothes'
              : activeModal === 'bakery'
                ? 'bakery'
                : 'home'
          }
          onClose={() => setActiveModal(null)}
          onStartBakeryPlacement={() => {
            setActiveModal(null);
            engineRef.current?.toggleBakeryBuildMode();
          }}
          onQuickBuildBakery={() => engineRef.current?.buildBakeryFoundationQuick()}
          onFinishBakeryBuild={(useMat) => engineRef.current?.upgradeBakeryToBuilt(useMat)}
          onStartHouseBuild={(pieceId) => {
            setActiveModal(null);
            engineRef.current?.toggleHouseBuildMode(pieceId);
          }}
          onQuickExtendCabin={() => engineRef.current?.quickExtendStarterRoom()}
          onQuickAddSecondStory={() => engineRef.current?.quickAddSecondStory()}
          onBuyBakeryShelf={() => engineRef.current?.buyBakeryShelf()}
          onBakePastry={(pastryId) => engineRef.current?.bakePastryRecipe(pastryId)}
          onCraft={(itemId) => engineRef.current?.craftItem(itemId)}
          onBuySupply={(itemId, price) => engineRef.current?.buySupplyItem(itemId, price)}
          onToggleClothing={(itemId) => engineRef.current?.toggleClothing(itemId)}
          onToggleTorch={() => engineRef.current?.toggleTorch()}
          onToggleDecoration={(decId) => engineRef.current?.toggleDecorationPlaced(decId)}
          onInstallAllDecor={() => engineRef.current?.installAllOwnedDecor()}
          onUpdateShopName={(name) => engineRef.current?.updateShopName(name)}
          onToggleShopOpen={() => engineRef.current?.toggleShopOpen()}
          onStockSlot={(slotIndex, pastryId) => engineRef.current?.stockShelfSlot(slotIndex, pastryId)}
          onAddStock={(slotIndex, delta) => engineRef.current?.addStockToSlot(slotIndex, delta)}
          onQuickStorePastry={(pastryId, count) =>
            engineRef.current?.quickStorePastryOnShelf(pastryId, count)
          }
          onAcceptOrder={(orderId) => engineRef.current?.acceptBakeryOrder(orderId)}
          onRefuseOrder={(orderId) => engineRef.current?.refuseBakeryOrder(orderId)}
          onTakePastryFromShelf={(pastryId) => {
            const ok = engineRef.current?.takePastryFromShelf(pastryId);
            if (ok) setActiveModal(null);
          }}
          onPutBackPastry={() => engineRef.current?.putBackHeldPastry()}
          onServeOrder={(orderId) => {
            const ok = engineRef.current?.serveBakeryOrder(orderId);
            if (ok && hud.bakeryOrders.length <= 1) setActiveModal(null);
          }}
          onSetSlotPrice={(slotIndex, price) => engineRef.current?.setSlotPrice(slotIndex, price)}
          onConsumeItem={(itemId) => engineRef.current?.consumeItem(itemId)}
        />
      )}

      {activeNpc && (
        <NpcDialogueModal
          npc={activeNpc}
          hud={hud}
          onSell={(npcId, haggle) => engineRef.current?.sellToNpc(npcId, haggle)}
          onGift={(npcId, giftId) => engineRef.current?.giftProvisionToNpc(npcId, giftId)}
          onClose={(npcId) => engineRef.current?.endNpcConversation(npcId)}
        />
      )}

      {activeModal === 'controls' && (
        <ControlsModal
          hud={hud}
          timeScale={timeScale}
          onSetTimeScale={(s) => {
            setTimeScale(s);
            engineRef.current?.setTimeScale(s);
          }}
          onResetValley={() => engineRef.current?.resetValley()}
          onClose={() => setActiveModal(null)}
        />
      )}
    </main>
  );
}
