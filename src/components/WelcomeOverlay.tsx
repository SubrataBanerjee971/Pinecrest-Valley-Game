import {
  CloudRain,
  Compass,
  HelpCircle,
  Home,
  Play,
  RotateCcw,
  Sparkles,
  Store,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useEffect } from 'react';
import { formatTime24 } from '../data/catalog';
import { MeteorologyState } from '../types/game';

interface WelcomeOverlayProps {
  hasSavedValley: boolean;
  meteorology: MeteorologyState;
  muted: boolean;
  onToggleMute: () => void;
  onOpenControls: () => void;
  onStartNew: () => void;
  onContinueSaved: () => void;
}

export function WelcomeOverlay({
  hasSavedValley,
  meteorology,
  muted,
  onToggleMute,
  onOpenControls,
  onStartNew,
  onContinueSaved,
}: WelcomeOverlayProps) {
  // Press Enter to jump straight into the valley
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        if (hasSavedValley) {
          onContinueSaved();
        } else {
          onStartNew();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSavedValley, onContinueSaved, onStartNew]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between overflow-hidden pointer-events-auto">
      {/* Cinematic Left & Bottom Vignette allowing the live orbiting 3D Alpine Valley to shine on center-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070b11]/92 via-[#090f17]/58 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#060a0f]/95 via-[#070b11]/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#060a0f]/75 to-transparent"
      />

      {/* Top Game Bar: Edition Tag & Live Valley Telemetry + Audio/Guide Buttons */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Compass className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400/90">
              3D Alpine Sandbox
            </div>
            <div className="text-xs font-medium text-slate-300">
              Survival · Custom Architecture · Bakery Shop
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-2 rounded-lg border border-white/12 bg-[#0b1118]/80 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-md sm:flex">
            <Sun className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono-nums font-medium">
              Day {meteorology.dayCount} · {formatTime24(meteorology.timeOfDay)}
            </span>
            <span className="text-slate-600">|</span>
            <span>{meteorology.weather}</span>
            <span className="font-mono-nums text-amber-200">
              {meteorology.ambientTempC > 0 ? `+${meteorology.ambientTempC}` : meteorology.ambientTempC}°C
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenControls}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#0e1620]/85 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-md transition-colors hover:border-amber-400/50 hover:text-white"
          >
            <HelpCircle className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden sm:inline">Controls</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute audio' : 'Mute audio'}
            className="flex cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-[#0e1620]/85 p-2 text-slate-200 backdrop-blur-md transition-colors hover:border-amber-400/50 hover:text-white"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-300" /> : <Volume2 className="h-4 w-4 text-emerald-300" />}
          </button>
        </div>
      </header>

      {/* Main Left-Aligned Title & Game Menu Stack */}
      <div className="relative z-10 flex flex-1 items-center px-6 sm:px-12 lg:px-16">
        <div className="w-full max-w-lg">
          <div className="mb-3 inline-flex items-center gap-2 border-l-2 border-amber-400 pl-3 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Welcome to the Timberland Frontier</span>
          </div>

          <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)] sm:text-6xl">
            Pinecrest
            <span className="mt-1 block bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Valley
            </span>
          </h1>

          <div className="mt-4 h-0.5 w-28 bg-gradient-to-r from-amber-400 to-transparent" />

          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-200/90 drop-shadow">
            Build multi-story mountain homes, face dark nights and alpine storms, and open a
            bustling bakery shop along the valley road.
          </p>

          {/* Game Menu Button Stack */}
          <div className="mt-8 flex max-w-sm flex-col gap-3">
            {hasSavedValley ? (
              <>
                <button
                  type="button"
                  onClick={onContinueSaved}
                  className="group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-lg border border-amber-300/60 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-6 py-3.5 text-left text-slate-950 shadow-[0_10px_32px_rgba(245,158,11,0.35)] transition-all hover:scale-[1.015] hover:shadow-[0_12px_36px_rgba(245,158,11,0.5)] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <Play className="h-5 w-5 fill-slate-950 transition-transform group-hover:translate-x-0.5" />
                    <div>
                      <div className="font-display text-base font-extrabold uppercase tracking-wide">
                        Continue Valley
                      </div>
                      <div className="text-[11px] font-semibold text-slate-900/80">
                        Resume saved homestead &amp; shop
                      </div>
                    </div>
                  </div>
                  <span className="rounded border border-slate-950/25 bg-slate-950/10 px-2 py-0.5 font-mono-nums text-[10px] font-bold uppercase">
                    Enter
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onStartNew}
                  className="group flex cursor-pointer items-center justify-between rounded-lg border border-white/18 bg-[#0e1620]/82 px-5 py-3 text-left text-slate-100 backdrop-blur-md transition-all hover:border-amber-400/55 hover:bg-[#152231]"
                >
                  <div className="flex items-center gap-3">
                    <RotateCcw className="h-4 w-4 text-amber-300 transition-transform group-hover:-rotate-45" />
                    <div>
                      <div className="font-display text-sm font-bold uppercase tracking-wider">
                        New Journey
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Start fresh from Day 1 in the valley
                      </div>
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onStartNew}
                className="group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-lg border border-amber-300/60 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-6 py-4 text-left text-slate-950 shadow-[0_10px_32px_rgba(245,158,11,0.35)] transition-all hover:scale-[1.015] hover:shadow-[0_12px_36px_rgba(245,158,11,0.5)] active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <Play className="h-5 w-5 fill-slate-950 transition-transform group-hover:translate-x-0.5" />
                  <div>
                    <div className="font-display text-base font-extrabold uppercase tracking-wide">
                      Enter the Valley
                    </div>
                    <div className="text-[11px] font-semibold text-slate-900/80">
                      Begin Day 1 · Starter Cabin &amp; Homestead
                    </div>
                  </div>
                </div>
                <span className="rounded border border-slate-950/25 bg-slate-950/10 px-2 py-0.5 font-mono-nums text-[10px] font-bold uppercase">
                  Enter
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenControls}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-white/14 bg-[#0b1118]/75 px-5 py-2.5 text-left text-slate-200 backdrop-blur-md transition-colors hover:border-white/30 hover:bg-[#131d29]"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="h-4 w-4 text-sky-300" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Field Guide &amp; Keybinds
                </span>
              </div>
              <span className="text-[11px] text-slate-400">View →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Game Bar: 3 Compact Gameplay Cards + Clean Quick-Key Strip */}
      <footer className="relative z-10 flex flex-col gap-3 px-6 pb-5 sm:px-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5 rounded border border-white/12 bg-[#0b1118]/80 px-2.5 py-1 backdrop-blur-sm">
            <kbd className="font-mono-nums font-bold text-amber-300">WASD</kbd> Move
          </span>
          <span className="flex items-center gap-1.5 rounded border border-white/12 bg-[#0b1118]/80 px-2.5 py-1 backdrop-blur-sm">
            <kbd className="font-mono-nums font-bold text-emerald-300">V / Q</kbd> Build Wheel
          </span>
          <span className="flex items-center gap-1.5 rounded border border-white/12 bg-[#0b1118]/80 px-2.5 py-1 backdrop-blur-sm">
            <kbd className="font-mono-nums font-bold text-amber-300">Tab</kbd> Mobile Store
          </span>
          <span className="flex items-center gap-1.5 rounded border border-white/12 bg-[#0b1118]/80 px-2.5 py-1 backdrop-blur-sm">
            <kbd className="font-mono-nums font-bold text-sky-300">B</kbd> Bakery
          </span>
          <span className="flex items-center gap-1.5 rounded border border-white/12 bg-[#0b1118]/80 px-2.5 py-1 backdrop-blur-sm">
            <kbd className="font-mono-nums font-bold text-orange-300">F / T</kbd> Light
          </span>
        </div>

        <div className="hidden grid-cols-3 gap-2.5 md:grid lg:max-w-xl">
          <div className="rounded-lg border border-white/12 bg-[#0b1118]/78 px-3.5 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <Home className="h-3.5 w-3.5" />
              <span>Multi-Story Homes</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Circular wheel to add rooms, stairs, upper floors &amp; home decor.
            </p>
          </div>
          <div className="rounded-lg border border-white/12 bg-[#0b1118]/78 px-3.5 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Store className="h-3.5 w-3.5" />
              <span>Your Bakery Shop</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Bake pastries, stock shelves &amp; serve villagers to earn $.
            </p>
          </div>
          <div className="rounded-lg border border-white/12 bg-[#0b1118]/78 px-3.5 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
              <CloudRain className="h-3.5 w-3.5" />
              <span>Dark Nights &amp; Storms</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              Carry torches, lamps, rain gear &amp; winter coats to thrive.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
