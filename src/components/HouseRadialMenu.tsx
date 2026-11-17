import {
  AppWindow,
  BedDouble,
  BrickWall,
  Compass,
  DoorOpen,
  Flame,
  Grid2x2,
  Home,
  Layers,
  Layers2,
  Move,
  RotateCw,
  SquareStack,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { HOUSE_BUILD_PIECES } from '../data/catalog';
import { GameHudSnapshot, HouseBuildPieceId } from '../types/game';

interface HouseRadialMenuProps {
  hud: GameHudSnapshot;
  onSelectPiece: (id: HouseBuildPieceId, closeWheel?: boolean) => void;
  onToggleWheel: (open?: boolean) => void;
  onCycleFloor: () => void;
  onRotate: () => void;
  onCancelMove: () => void;
  onExitBuildMode: () => void;
}

function PieceIcon({
  id,
  className = 'h-4 w-4',
}: {
  id: HouseBuildPieceId;
  className?: string;
}) {
  switch (id) {
    case 'foundation':
      return <Layers2 className={className} />;
    case 'stairs':
      return <TrendingUp className={className} />;
    case 'upper_floor':
      return <SquareStack className={className} />;
    case 'wall':
      return <BrickWall className={className} />;
    case 'window_wall':
      return <AppWindow className={className} />;
    case 'doorway':
      return <DoorOpen className={className} />;
    case 'roof':
      return <Home className={className} />;
    case 'hearth':
      return <Flame className={className} />;
    case 'bedroll':
      return <BedDouble className={className} />;
    case 'move':
      return <Move className={className} />;
    case 'demolish':
      return <Trash2 className={className} />;
    default:
      return <Grid2x2 className={className} />;
  }
}

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeAnnularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle <= Math.PI ? '0' : '1';

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function formatCostShort(piece: (typeof HOUSE_BUILD_PIECES)[number]): string {
  if (piece.id === 'demolish') return '75% Refund';
  if (piece.id === 'move') return 'Free Move';
  const mats = Object.entries(piece.materials)
    .map(([k, q]) => `${q}${k[0].toUpperCase()}`)
    .join('+');
  return mats ? `${mats} · $${piece.goldCost}` : `$${piece.goldCost}`;
}

function floorLabel(override: 'auto' | 0 | 1 | 2): string {
  if (override === 'auto') return 'Auto';
  if (override === 0) return 'Ground';
  if (override === 1) return '2nd Floor';
  return '3rd Floor';
}

export function HouseRadialMenu({
  hud,
  onSelectPiece,
  onToggleWheel,
  onCycleFloor,
  onRotate,
  onCancelMove,
  onExitBuildMode,
}: HouseRadialMenuProps) {
  const [hoveredId, setHoveredId] = useState<HouseBuildPieceId | null>(null);

  const activePiece =
    HOUSE_BUILD_PIECES.find((p) => p.id === hud.houseBuildPiece) ?? HOUSE_BUILD_PIECES[0];
  const inspectedPiece =
    HOUSE_BUILD_PIECES.find((p) => p.id === (hoveredId ?? hud.houseBuildPiece)) ?? activePiece;

  const canAfford = (piece: (typeof HOUSE_BUILD_PIECES)[number]): boolean => {
    if (piece.id === 'demolish' || piece.id === 'move') return true;
    if (hud.shop.gold < piece.goldCost) return false;
    for (const [k, q] of Object.entries(piece.materials)) {
      if ((hud.inventory[k as keyof typeof hud.inventory] ?? 0) < (q ?? 0)) return false;
    }
    return true;
  };

  // Compact Circular Mini-Dial shown cleanly above the bottom dock when aiming in 3D
  if (!hud.houseWheelOpen) {
    const isMoveMode = activePiece.id === 'move';
    const isDemolishMode = activePiece.id === 'demolish';
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`pointer-events-auto mb-2 flex items-center gap-2.5 rounded-full border bg-[#0d151d]/92 py-1.5 pl-1.5 pr-3 shadow-2xl backdrop-blur-sm ${
          isMoveMode
            ? 'border-sky-400/50'
            : isDemolishMode
              ? 'border-rose-400/45'
              : 'border-emerald-400/40'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggleWheel(true)}
          title="Open Circular House Option Menu (Q)"
          className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105 ${
            isDemolishMode
              ? 'border-rose-400 bg-rose-500/20 text-rose-200'
              : isMoveMode
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
          }`}
        >
          <PieceIcon id={activePiece.id} className="h-5 w-5" />
          <span className="absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white/20 bg-[#0c1219] px-1 font-mono-nums text-[9px] font-bold text-amber-300">
            Q
          </span>
        </button>

        <div className="flex flex-col pr-1 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
            <span>
              {isMoveMode && hud.houseMovingLabel
                ? `Moving: ${hud.houseMovingLabel}`
                : `${activePiece.hotkey}. ${activePiece.shortName}`}
            </span>
            <span className="font-mono-nums text-[10px] font-normal text-slate-400">
              {formatCostShort(activePiece)}
            </span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                hud.houseBuildCanPlace
                  ? isMoveMode
                    ? 'bg-sky-400'
                    : 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
          </div>
          <div className="text-[10px] text-slate-400">
            {isMoveMode ? (
              hud.houseMovingLabel ? (
                <>
                  <span className="text-sky-300">Drag &amp; Release or [Click / E] Place</span> ·{' '}
                  <span className="text-slate-300">[R] Rotate</span> ·{' '}
                  <span className="text-slate-300">[Right-Click] Cancel</span>
                </>
              ) : (
                <>
                  <span className="text-sky-300">Click &amp; Hold</span> any house element, Kitchen, or Lamp to drag ·{' '}
                  <span className="font-semibold text-amber-300">[Q]</span> Wheel
                </>
              )
            ) : (
              <>
                Click dial or <span className="font-semibold text-amber-300">[Q]</span> for Circular Options ·{' '}
                <span className="text-slate-300">[E / Click]</span>{' '}
                {isDemolishMode ? 'Remove' : 'Place'}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
          {hud.houseMovingLabel && (
            <button
              type="button"
              onClick={onCancelMove}
              title="Cancel Move and return element (Right-Click)"
              className="cursor-pointer rounded-full border border-amber-400/45 bg-amber-500/18 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/28 whitespace-nowrap"
            >
              Return Spot
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleWheel(true)}
            className="cursor-pointer rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/25 whitespace-nowrap"
          >
            Wheel [Q]
          </button>
          <button
            type="button"
            onClick={onCycleFloor}
            title="Cycle target floor level (Z)"
            className="flex cursor-pointer items-center gap-1 rounded-full border border-white/12 bg-[#16212c] px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:border-amber-400/50 whitespace-nowrap"
          >
            <Layers className="h-3 w-3" />
            <span>{floorLabel(hud.houseBuildFloorOverride)} [Z]</span>
          </button>
          <button
            type="button"
            onClick={onRotate}
            title="Rotate piece (R)"
            className="flex cursor-pointer items-center justify-center rounded-full border border-white/12 bg-[#16212c] p-1.5 text-slate-200 hover:border-white/30 hover:text-white"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onExitBuildMode}
            title="Exit House Builder (V)"
            className="cursor-pointer rounded-full border border-rose-500/35 bg-rose-500/15 px-2.5 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-500/25 whitespace-nowrap"
          >
            Exit [V]
          </button>
        </div>
      </div>
    );
  }

  // Full Centered Circular Option Wheel
  const size = 412;
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 80;
  const outerR = 194;
  const labelR = (innerR + outerR) / 2;
  const total = HOUSE_BUILD_PIECES.length;
  const sliceRad = (Math.PI * 2) / total;
  const gapRad = 0.032;
  const inspectedAffordable = canAfford(inspectedPiece);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onToggleWheel(false);
      }}
      className="pointer-events-auto fixed inset-0 z-[25] flex flex-col items-center justify-center bg-[#060a0f]/45 backdrop-blur-[2px]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative flex flex-col items-center"
      >
        {/* Top subtle wheel header */}
        <div className="mb-2 flex items-center gap-3 rounded-full border border-white/12 bg-[#0d151d]/92 px-4 py-1 text-[11px] text-slate-300 shadow-lg">
          <span className="font-semibold text-emerald-300">House Builder Wheel</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono-nums text-slate-300">
            Wood {hud.inventory.wood} · Stone {hud.inventory.stone} · Iron {hud.inventory.iron} · ${hud.shop.gold}
          </span>
        </div>

        {/* Circular SVG Radial Selector */}
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="drop-shadow-[0_14px_34px_rgba(0,0,0,0.65)]"
          >
            <circle
              cx={cx}
              cy={cy}
              r={outerR + 4}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
            />
            {HOUSE_BUILD_PIECES.map((piece, idx) => {
              const startAngle = -Math.PI / 2 - sliceRad / 2 + idx * sliceRad + gapRad / 2;
              const endAngle = startAngle + sliceRad - gapRad;
              const midAngle = (startAngle + endAngle) / 2;
              const isSelected = hud.houseBuildPiece === piece.id;
              const isHovered = hoveredId === piece.id;
              const isDemolish = piece.id === 'demolish';
              const isMove = piece.id === 'move';
              const affordable = canAfford(piece);

              let fill = 'rgba(15, 23, 33, 0.92)';
              let stroke = 'rgba(255, 255, 255, 0.14)';
              let strokeWidth = 1.4;

              if (isSelected) {
                fill = isDemolish
                  ? 'rgba(136, 19, 55, 0.90)'
                  : isMove
                    ? 'rgba(12, 74, 110, 0.92)'
                    : 'rgba(6, 78, 59, 0.92)';
                stroke = isDemolish ? '#fb7185' : isMove ? '#38bdf8' : '#34d399';
                strokeWidth = 2.4;
              } else if (isHovered) {
                fill = isDemolish
                  ? 'rgba(76, 17, 36, 0.94)'
                  : isMove
                    ? 'rgba(14, 52, 82, 0.94)'
                    : 'rgba(24, 38, 54, 0.96)';
                stroke = isDemolish ? '#fda4af' : isMove ? '#7dd3fc' : '#fbbf24';
                strokeWidth = 2;
              } else if (!affordable) {
                fill = 'rgba(13, 19, 27, 0.82)';
              }

              const d = describeAnnularSector(cx, cy, innerR, outerR, startAngle, endAngle);
              const pos = polarToCartesian(cx, cy, labelR, midAngle);

              return (
                <g
                  key={piece.id}
                  onMouseEnter={() => setHoveredId(piece.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectPiece(piece.id, true)}
                  className="cursor-pointer transition-opacity"
                >
                  <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
                  <text
                    x={pos.x}
                    y={pos.y + 18}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isSelected ? '#fde68a' : affordable ? '#94a3b8' : '#64748b'}
                    fontSize="9.5"
                    fontWeight="700"
                    className="pointer-events-none select-none font-mono-nums"
                  >
                    [{piece.hotkey}]
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Crisp HTML Icons & Labels overlay aligned with each wedge center */}
          {HOUSE_BUILD_PIECES.map((piece, idx) => {
            const startAngle = -Math.PI / 2 - sliceRad / 2 + idx * sliceRad + gapRad / 2;
            const endAngle = startAngle + sliceRad - gapRad;
            const midAngle = (startAngle + endAngle) / 2;
            const pos = polarToCartesian(cx, cy, labelR - 4, midAngle);
            const isSelected = hud.houseBuildPiece === piece.id;
            const isHovered = hoveredId === piece.id;
            const isDemolish = piece.id === 'demolish';
            const isMove = piece.id === 'move';
            const affordable = canAfford(piece);

            return (
              <div
                key={`label-${piece.id}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: 'translate(-50%, -50%)',
                }}
                className="pointer-events-none absolute flex flex-col items-center text-center"
              >
                <PieceIcon
                  id={piece.id}
                  className={`h-4 w-4 ${
                    isDemolish
                      ? isSelected || isHovered
                        ? 'text-rose-300'
                        : 'text-rose-400/80'
                      : isMove
                        ? isSelected || isHovered
                          ? 'text-sky-200'
                          : 'text-sky-300'
                        : isSelected
                          ? 'text-emerald-300'
                          : isHovered
                            ? 'text-amber-300'
                            : affordable
                              ? 'text-slate-100'
                              : 'text-slate-500'
                  }`}
                />
                <span
                  className={`mt-0.5 text-[10px] font-semibold leading-tight whitespace-nowrap ${
                    isSelected
                      ? 'text-white'
                      : isHovered
                        ? 'text-amber-200'
                        : affordable
                          ? 'text-slate-200'
                          : 'text-slate-500'
                  }`}
                >
                  {piece.shortName}
                </span>
              </div>
            );
          })}

          {/* Central Circular Hub */}
          <button
            type="button"
            onClick={() => onToggleWheel(false)}
            title="Click to Aim in 3D"
            className="absolute flex h-[146px] w-[146px] cursor-pointer flex-col items-center justify-center rounded-full border-2 border-white/20 bg-[#0b1118]/96 p-3 text-center shadow-[0_0_28px_rgba(0,0,0,0.85)] transition-transform hover:scale-[1.03] hover:border-amber-400/60"
          >
            <PieceIcon
              id={inspectedPiece.id}
              className={`h-6 w-6 ${
                inspectedPiece.id === 'demolish'
                  ? 'text-rose-400'
                  : inspectedPiece.id === 'move'
                    ? 'text-sky-300'
                    : 'text-emerald-300'
              }`}
            />
            <div className="mt-1 text-xs font-bold leading-tight text-slate-100">
              {inspectedPiece.shortName}
            </div>
            <div
              className={`mt-0.5 font-mono-nums text-[10px] font-medium ${
                inspectedPiece.id === 'demolish'
                  ? 'text-rose-300'
                  : inspectedPiece.id === 'move'
                    ? 'text-sky-300'
                    : inspectedAffordable
                      ? 'text-amber-300'
                      : 'text-rose-400'
              }`}
            >
              {formatCostShort(inspectedPiece)}
            </div>
            <div className="mt-1.5 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-200">
              <Compass className="h-3 w-3" />
              <span>Aim [Q]</span>
            </div>
          </button>
        </div>

        {/* Circular Orbital Option Toggles beneath the Wheel */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCycleFloor}
            title="Toggle target floor story (Z)"
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/40 bg-[#121c27]/95 px-3.5 py-1.5 text-xs font-semibold text-amber-200 shadow-lg hover:bg-[#1a2837]"
          >
            <Layers className="h-3.5 w-3.5 text-amber-400" />
            <span>Story [Z]: {floorLabel(hud.houseBuildFloorOverride)}</span>
          </button>
          <button
            type="button"
            onClick={onRotate}
            title="Rotate piece (R)"
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-[#121c27]/95 px-3.5 py-1.5 text-xs font-semibold text-slate-200 shadow-lg hover:border-white/35 hover:text-white"
          >
            <RotateCw className="h-3.5 w-3.5 text-sky-300" />
            <span>Rotate [R]</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleWheel(false)}
            title="Close wheel and aim in 3D (Q)"
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 shadow-lg hover:bg-emerald-500/30"
          >
            <span>Aim in 3D [Q]</span>
          </button>
          <button
            type="button"
            onClick={onExitBuildMode}
            title="Exit House Builder Mode (V)"
            className="flex cursor-pointer items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/18 px-3.5 py-1.5 text-xs font-semibold text-rose-200 shadow-lg hover:bg-rose-500/30"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit [V]</span>
          </button>
        </div>
      </div>
    </div>
  );
}
