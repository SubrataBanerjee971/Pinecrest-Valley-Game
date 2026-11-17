import { CloudSun, DollarSign, Gift, Handshake, X } from 'lucide-react';
import { ITEM_CATALOG } from '../data/catalog';
import { GameHudSnapshot, NpcDialogueState } from '../types/game';

interface NpcDialogueModalProps {
  npc: NpcDialogueState;
  hud: GameHudSnapshot;
  onSell: (npcId: string, haggle: boolean) => void;
  onGift: (npcId: string, giftId: 'berries' | 'hot_cider' | 'trail_rations') => void;
  onClose: (npcId: string) => void;
}

export function NpcDialogueModal({
  npc,
  hud,
  onSell,
  onGift,
  onClose,
}: NpcDialogueModalProps) {
  const wantedDef = ITEM_CATALOG[npc.wantedItemId];
  const ownedCount = hud.inventory[npc.wantedItemId] || 0;
  const berriesCount = hud.inventory.berries || 0;
  const ciderCount = hud.inventory.hot_cider || 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-white/14 bg-[#111821] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">{npc.name}</h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
              <span>{npc.role}</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-300">{npc.mood}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClose(npc.id)}
            aria-label="End conversation"
            className="cursor-pointer rounded-lg border border-white/10 bg-[#18222e] p-2 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Spoken Dialogue */}
          <blockquote className="rounded-lg border border-white/10 bg-[#151e28] p-4 text-sm leading-relaxed text-slate-200">
            &ldquo;{npc.greeting}&rdquo;
          </blockquote>

          {/* Direct Trade Request */}
          <div className="rounded-lg border border-white/10 bg-[#151e28] p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>Trail Gear Request</span>
              </div>
              <span className="font-mono-nums text-xs text-slate-400">
                In Pack: {ownedCount}
              </span>
            </div>

            {npc.fulfilled ? (
              <div className="text-xs font-medium text-emerald-400">
                Trade completed — {npc.name} is equipped for the pass.
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{wantedDef.name}</div>
                  <div className="mt-0.5 font-mono-nums text-xs text-amber-400">
                    Offering ${npc.offerPrice} (or ~${Math.round(npc.offerPrice * 1.2)} haggled)
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ownedCount <= 0}
                    onClick={() => onSell(npc.id, false)}
                    className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      ownedCount > 0
                        ? 'cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'cursor-not-allowed bg-slate-800 text-slate-500'
                    }`}
                  >
                    Sell (${npc.offerPrice})
                  </button>
                  <button
                    type="button"
                    disabled={ownedCount <= 0}
                    onClick={() => onSell(npc.id, true)}
                    className={`flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      ownedCount > 0
                        ? 'cursor-pointer border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                        : 'cursor-not-allowed border-white/10 bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Handshake className="h-3.5 w-3.5" />
                    <span>Haggle +20%</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Share Warmth / Provisions */}
          <div className="rounded-lg border border-white/10 bg-[#151e28] p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-100">
              <Gift className="h-4 w-4 text-emerald-400" />
              <span>Share Trail Hospitality</span>
            </div>
            {npc.helpedWarmth ? (
              <div className="text-xs text-emerald-300">
                {npc.name} thanked you for your kindness and shared spare supplies.
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Gift food or warm cider to raise Valley Reputation and receive gathered supplies.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={berriesCount <= 0}
                    onClick={() => onGift(npc.id, 'berries')}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                      berriesCount > 0
                        ? 'cursor-pointer border-white/15 bg-[#1b2734] text-slate-200 hover:border-emerald-400/50 hover:text-white'
                        : 'cursor-not-allowed border-white/10 bg-slate-800 text-slate-500'
                    }`}
                  >
                    Gift Berries ({berriesCount})
                  </button>
                  <button
                    type="button"
                    disabled={ciderCount <= 0}
                    onClick={() => onGift(npc.id, 'hot_cider')}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                      ciderCount > 0
                        ? 'cursor-pointer border-white/15 bg-[#1b2734] text-slate-200 hover:border-amber-400/50 hover:text-white'
                        : 'cursor-not-allowed border-white/10 bg-slate-800 text-slate-500'
                    }`}
                  >
                    Gift Hot Cider ({ciderCount})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mountain Pass Weather Forecast */}
          <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#151e28] p-4">
            <CloudSun className="mt-0.5 h-4 w-4 text-sky-400 shrink-0" />
            <div className="text-xs leading-relaxed text-slate-300">
              <span className="font-semibold text-slate-100">Ridge Weather Report: </span>
              {npc.weatherForecast}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-white/10 bg-[#0d131a] px-6 py-3">
          <button
            type="button"
            onClick={() => onClose(npc.id)}
            className="cursor-pointer rounded-lg bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            Say Goodbye
          </button>
        </div>
      </div>
    </div>
  );
}
