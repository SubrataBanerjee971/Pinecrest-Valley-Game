import {
  Bell,
  BookOpen,
  Clock,
  Croissant,
  HeartPulse,
  Package,
  Save,
  ShieldAlert,
  Volume2,
  VolumeX,
  Wallet,
} from 'lucide-react';
import { formatTime24, ITEM_CATALOG } from '../data/catalog';
import {
  GameHudSnapshot,
  HouseBuildPieceId,
  ToastMessage,
} from '../types/game';
import { CircularMinimap } from './CircularMinimap';
import { HouseRadialMenu } from './HouseRadialMenu';

interface HUDProps {
  hud: GameHudSnapshot;
  toasts: ToastMessage[];
  muted: boolean;
  onToggleMute: () => void;
  onSaveValley: () => void;
  onOpenControls: () => void;
  onOpenBakeryOrders: () => void;
  onOpenClothesTab: () => void;
  onToggleHouseBuild: () => void;
  onToggleHouseWheel: (open?: boolean) => void;
  onSelectHousePiece: (id: HouseBuildPieceId, closeWheel?: boolean) => void;
  onCycleHouseFloor: () => void;
  onRotateHouseGhost: () => void;
  onCancelHouseMove: () => void;
  onPutBackPastry: () => void;
}

function TopVitalBar({
  label,
  value,
  maxCap,
  barColor,
  warningText,
}: {
  label: string;
  value: number;
  maxCap?: number;
  barColor: string;
  warningText?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const capPct = maxCap !== undefined ? Math.max(0, Math.min(100, Math.round(maxCap))) : 100;

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium">
        <span className="text-slate-300">
          {label}
          {warningText && <span className="ml-1.5 text-[10px] font-semibold text-rose-400">({warningText})</span>}
        </span>
        <span className="font-mono-nums text-slate-100">
          {pct}%{capPct < 100 ? <span className="text-rose-400"> / {capPct}%</span> : null}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        {capPct < 100 && (
          <div
            className="absolute inset-y-0 right-0 bg-rose-950/80"
            style={{ width: `${100 - capPct}%` }}
          />
        )}
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function HUD({
  hud,
  toasts,
  muted,
  onToggleMute,
  onSaveValley,
  onOpenControls,
  onOpenBakeryOrders,
  onOpenClothesTab,
  onToggleHouseBuild,
  onToggleHouseWheel,
  onSelectHousePiece,
  onCycleHouseFloor,
  onRotateHouseGhost,
  onCancelHouseMove,
  onPutBackPastry,
}: HUDProps) {
  const { meteorology, survival, shop } = hud;
  const isRaining = meteorology.weather === 'Rain' || meteorology.weather === 'Thunderstorm';
  const hasRainGear = survival.wearingRaincoat || survival.carryingUmbrella;
  const exposedNoGear = isRaining && !survival.isSheltered && !hasRainGear;

  const formatCountdown = (sec: number): string => {
    const sTotal = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sTotal / 60);
    const s = sTotal % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4">
      {/* Top Bar: Money, Day & Time at Top-Left, Health + Stamina/Sickness at Top-Right */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Corner: Money, Day & Time */}
        <div className="pointer-events-auto flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2.5 rounded-lg border border-white/12 bg-[#0f141a]/90 px-3.5 py-2 text-xs text-slate-200 shadow-lg">
            <div className="flex items-center gap-1.5 font-mono-nums text-sm font-bold text-emerald-400">
              <Wallet className="h-4 w-4 text-emerald-400" />
              <span>${shop.gold}</span>
            </div>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="font-mono-nums text-slate-200">
              Day {meteorology.dayCount}, {formatTime24(meteorology.timeOfDay)}
            </span>
          </div>
          {hud.deliveries.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-[#0f141a]/90 px-3 py-1.5 text-xs font-mono-nums font-medium text-emerald-300 shadow-lg">
              <Package className="h-3.5 w-3.5 text-emerald-400" />
              {hud.deliveries.some((d) => d.status === 'at_door')
                ? `Parcel at Door (${hud.deliveries.filter((d) => d.status === 'at_door').length}) [E]`
                : (() => {
                    const nextSec = Math.ceil(
                      Math.min(
                        ...hud.deliveries
                          .filter((d) => d.status === 'in_transit')
                          .map((d) => d.remainingSec),
                      ),
                    );
                    const m = Math.floor(nextSec / 60);
                    const s = nextSec % 60;
                    return `Delivery ${m}:${String(s).padStart(2, '0')}`;
                  })()}
            </div>
          )}
        </div>

        {/* Top-Right Corner: Player Health, Stamina (Reduced if Sick in Rain), Warmth & Guide Button */}
        <div className="pointer-events-auto w-[288px] rounded-xl border border-white/12 bg-[#0f141a]/90 p-3 text-xs shadow-lg">
          <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-100">
              {survival.isSick || exposedNoGear ? (
                <ShieldAlert className="h-4 w-4 text-rose-400" />
              ) : (
                <HeartPulse className="h-4 w-4 text-rose-400" />
              )}
              <span>
                {survival.isSick ? 'Sick (No Rain Gear)' : exposedNoGear ? 'Soaked in Rain' : 'Player Health'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onSaveValley}
                aria-label="Save valley"
                title="Save valley"
                className="cursor-pointer rounded p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                title={muted ? 'Unmute audio' : 'Mute audio'}
                className="cursor-pointer rounded p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onOpenControls}
                title="Controls & Field Guide"
                className="ml-0.5 flex cursor-pointer items-center gap-1 rounded border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/25 whitespace-nowrap"
              >
                <BookOpen className="h-3 w-3 text-amber-300" />
                <span>Guide</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <TopVitalBar label="Health" value={survival.health} barColor="bg-rose-500" />
            <TopVitalBar
              label="Stamina"
              value={survival.stamina}
              maxCap={survival.maxStamina}
              barColor={survival.isSick ? 'bg-amber-500' : 'bg-sky-400'}
              warningText={survival.isSick ? 'Sick' : exposedNoGear ? 'Draining' : undefined}
            />
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <TopVitalBar label="Warmth" value={survival.warmth} barColor="bg-amber-500" />
              <TopVitalBar label="Hunger" value={survival.hunger} barColor="bg-emerald-500" />
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[11px]">
            <span className={hasRainGear ? 'text-emerald-400 font-medium' : exposedNoGear ? 'text-rose-300 font-medium' : 'text-slate-400'}>
              {survival.carryingUmbrella
                ? 'Umbrella Open'
                : survival.wearingRaincoat
                  ? 'Raincoat Worn'
                  : exposedNoGear
                    ? 'Need Raincoat / Umbrella!'
                    : 'No Rain Gear Equipped'}
            </span>
            <button
              type="button"
              onClick={onOpenClothesTab}
              className="cursor-pointer text-[11px] font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap"
            >
              Clothes &amp; Gear
            </button>
          </div>
        </div>
      </div>

      {/* Center Reticle, Active Bakery Orders Banner, Contextual Prompt & Toasts */}
      <div className="relative flex flex-1 items-center justify-center">
        <div className="h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />

        {(hud.bakeryOrders.length > 0 || hud.heldPastry) && (
          <div className="pointer-events-auto absolute top-2 right-0 flex w-[270px] flex-col gap-2">
            {hud.heldPastry && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/45 bg-[#1b160c]/92 px-3 py-2 text-xs shadow-lg">
                <div className="flex min-w-0 items-center gap-2">
                  <Croissant className="h-4 w-4 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-amber-200">
                      Tray: {ITEM_CATALOG[hud.heldPastry].name}
                    </div>
                    <div className="text-[10px] text-amber-300/80">
                      Give to customer at counter [E]
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onPutBackPastry}
                  className="cursor-pointer rounded-md border border-white/15 bg-[#1a222d] px-2 py-1 text-[10px] font-medium text-slate-200 hover:text-white whitespace-nowrap shrink-0"
                >
                  Put Back
                </button>
              </div>
            )}

            {hud.bakeryOrders.map((order) => {
              const urgent = order.remainingSec <= 45;
              const holdingMatch = hud.heldPastry === order.pastryId;
              return (
                <div
                  key={order.id}
                  className={`rounded-xl border px-3 py-2 text-xs shadow-lg ${
                    urgent
                      ? 'border-rose-500/50 bg-[#1e1216]/94'
                      : 'border-amber-500/35 bg-[#0f141a]/92'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 font-semibold text-slate-100">
                      <Bell className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{order.customerName}</span>
                    </div>
                    <span
                      className={`flex items-center gap-1 font-mono-nums text-[11px] font-bold shrink-0 ${
                        urgent ? 'text-rose-400' : 'text-amber-300'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {formatCountdown(order.remainingSec)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
                    <span>
                      {ITEM_CATALOG[order.pastryId].name} (${order.price})
                    </span>
                    <button
                      type="button"
                      onClick={onOpenBakeryOrders}
                      className="cursor-pointer font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap"
                    >
                      {order.status === 'waiting_decision'
                        ? 'Take / Refuse'
                        : holdingMatch
                          ? 'Serve [E]'
                          : 'Accepted'}
                    </button>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {order.status === 'waiting_decision'
                      ? 'Press [E] on customer or click Take / Refuse'
                      : holdingMatch
                        ? 'Look at customer & press [E] to hand over'
                        : 'Take ordered pastry from shelf [E]'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hud.prompt && (
          <div className="absolute top-[56%] rounded-lg border border-white/15 bg-[#0f141a]/90 px-3.5 py-2 text-center">
            <div className="text-xs font-semibold text-slate-100">{hud.prompt.label}</div>
            {hud.prompt.sublabel && (
              <div className="mt-0.5 text-[11px] text-slate-400">{hud.prompt.sublabel}</div>
            )}
          </div>
        )}

        {toasts.length > 0 && (
          <div className="absolute top-2 left-0 flex max-w-xs flex-col gap-1.5">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  t.tone === 'gold'
                    ? 'border-amber-500/40 bg-[#1a160e]/92 text-amber-200'
                    : t.tone === 'warning'
                      ? 'border-rose-500/40 bg-[#1f1215]/92 text-rose-200'
                      : t.tone === 'warm'
                        ? 'border-orange-500/40 bg-[#1c1510]/92 text-orange-200'
                        : 'border-white/12 bg-[#0f141a]/90 text-slate-200'
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom-Left Circular Minimap */}
      <CircularMinimap hud={hud} />

      {/* Circular House Builder Menu (Cleared of Circular Minimap) */}
      {hud.houseBuildMode && (
        <div className="flex flex-col items-center md:pl-[176px]">
          <HouseRadialMenu
            hud={hud}
            onSelectPiece={onSelectHousePiece}
            onToggleWheel={onToggleHouseWheel}
            onCycleFloor={onCycleHouseFloor}
            onRotate={onRotateHouseGhost}
            onCancelMove={onCancelHouseMove}
            onExitBuildMode={onToggleHouseBuild}
          />
        </div>
      )}
    </div>
  );
}
