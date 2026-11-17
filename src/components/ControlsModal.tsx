import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { GameHudSnapshot } from '../types/game';

interface ControlsModalProps {
  hud: GameHudSnapshot;
  timeScale: number;
  onSetTimeScale: (scale: number) => void;
  onResetValley: () => void;
  onClose: () => void;
}

export function ControlsModal({
  hud,
  timeScale,
  onSetTimeScale,
  onResetValley,
  onClose,
}: ControlsModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/14 bg-[#111821] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">
              Field Guide &amp; Controls
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Barometric pressure {hud.meteorology.pressureHpa} hPa · Humidity{' '}
              {hud.meteorology.humidity}% · {hud.cottagesMini.length + 1} valley homes
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            className="cursor-pointer rounded-lg border border-white/10 bg-[#18222e] p-2 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-6 text-xs text-slate-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-[#151e28] p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-100">
                Exploration &amp; Survival
              </h3>
              <ul className="space-y-1.5 text-slate-300">
                <li>
                  <strong className="text-slate-100">WASD / Arrows</strong> — Walk across terrain &amp; roads
                </li>
                <li>
                  <strong className="text-slate-100">Shift / Space</strong> — Sprint / Jump
                </li>
                <li>
                  <strong className="text-slate-100">Click or Drag</strong> — First-person camera look
                </li>
                <li>
                  <strong className="text-slate-100">E / Left-Click</strong> — Chop, mine, forage, talk, or open doors
                </li>
                <li>
                  <strong className="text-slate-100">1–6</strong> — Switch tools or eat provisions
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#151e28] p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-100">
                House Builder, Bakery &amp; Mobile
              </h3>
              <ul className="space-y-1.5 text-slate-300">
                <li>
                  <strong className="text-slate-100">Tab</strong> — Open Handheld Mobile (House Builder, Bakery, Pastries, Decor, Clothes)
                </li>
                <li>
                  <strong className="text-slate-100">V / Q / M</strong> — Circular House Builder Wheel, 3D Aim, &amp; Move Mode
                </li>
                <li>
                  <strong className="text-slate-100">Click &amp; Hold</strong> — Drag Player Kitchen, Tab Lights, Furniture &amp; House Parts (R to Rotate)
                </li>
                <li>
                  <strong className="text-slate-100">1–9 / 0 / Z / R</strong> — Select Piece, Demolish, Floor Story, &amp; Rotate
                </li>
                <li>
                  <strong className="text-slate-100">B / C / U</strong> — Build Bakery / Toggle Raincoat / Toggle Umbrella
                </li>
                <li>
                  <strong className="text-slate-100">F / T</strong> — Toggle Brass Lantern / Pine-Resin Night Torch
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 bg-[#151e28] p-4">
            <div>
              <div className="font-semibold text-slate-100">Daylight &amp; Weather Pace</div>
              <div className="mt-0.5 text-slate-400">
                Accelerate diurnal time to experience storms, sunsets, dark nights, and snowfall faster.
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-md bg-[#0d131a] p-1">
              {[1, 4, 12].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSetTimeScale(s)}
                  className={`cursor-pointer rounded px-3 py-1 font-mono-nums text-xs font-medium transition-colors ${
                    timeScale === s
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Valley</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-rose-300">Reset expedition progress?</span>
                <button
                  type="button"
                  onClick={() => {
                    onResetValley();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="cursor-pointer rounded bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="cursor-pointer rounded border border-white/15 px-3 py-1.5 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-amber-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              Return to Valley
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
