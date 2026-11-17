import { useEffect, useRef } from 'react';
import { distanceToRoad, groundHeightAt, LAKE_LEVEL, WORLD_SIZE } from '../engine/terrain';
import { GameHudSnapshot } from '../types/game';

interface CircularMinimapProps {
  hud: GameHudSnapshot;
}

const MAP_PX = 144;
const VIEW_RADIUS_M = 46;
const BASE_PX = WORLD_SIZE; // 1 px = 1 meter across [-140, 140]

function buildTerrainBaseCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BASE_PX;
  canvas.height = BASE_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const img = ctx.createImageData(BASE_PX, BASE_PX);
  const data = img.data;
  const half = WORLD_SIZE * 0.5;

  for (let pz = 0; pz < BASE_PX; pz++) {
    const wz = pz - half;
    for (let px = 0; px < BASE_PX; px++) {
      const wx = px - half;
      const h = groundHeightAt(wx, wz);
      const roadD = distanceToRoad(wx, wz);

      let r = 64;
      let g = 92;
      let b = 58;

      if (h < LAKE_LEVEL) {
        const depth = Math.min(1, (LAKE_LEVEL - h) / 3.2);
        r = Math.round(44 - depth * 18);
        g = Math.round(108 - depth * 36);
        b = Math.round(140 - depth * 32);
      } else if (roadD < 2.25) {
        // Engineered crushed-stone roadbed
        r = 196;
        g = 179;
        b = 152;
      } else if (roadD < 3.15) {
        // Dark graded road shoulder
        r = 112;
        g = 98;
        b = 82;
      } else if (h < LAKE_LEVEL + 0.35) {
        // Sandy shoreline
        r = 148;
        g = 136;
        b = 108;
      } else if (h > 13.5) {
        // Alpine ridge / granite
        const snow = Math.min(1, (h - 13.5) / 10);
        r = Math.round(114 + snow * 96);
        g = Math.round(122 + snow * 96);
        b = Math.round(132 + snow * 98);
      } else {
        // Pine meadow shaded slightly by altitude
        const elev = Math.max(0, Math.min(1, (h + 1) / 14));
        r = Math.round(52 + elev * 30);
        g = Math.round(84 + elev * 24);
        b = Math.round(48 + elev * 16);
      }

      const idx = (pz * BASE_PX + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function CircularMinimap({ hud }: CircularMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseMapRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!baseMapRef.current) {
      baseMapRef.current = buildTerrainBaseCanvas();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const base = baseMapRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetPx = Math.round(MAP_PX * dpr);
    if (canvas.width !== targetPx || canvas.height !== targetPx) {
      canvas.width = targetPx;
      canvas.height = targetPx;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MAP_PX, MAP_PX);

    const center = MAP_PX * 0.5;
    const radius = center - 2;
    const halfWorld = WORLD_SIZE * 0.5;
    const scale = center / VIEW_RADIUS_M;

    // Circular clip
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Base background in case near map edge
    ctx.fillStyle = '#0e151d';
    ctx.fillRect(0, 0, MAP_PX, MAP_PX);

    // Draw local terrain + roads + lake window centered on player
    const srcX = hud.playerX + halfWorld - VIEW_RADIUS_M;
    const srcZ = hud.playerZ + halfWorld - VIEW_RADIUS_M;
    const srcSize = VIEW_RADIUS_M * 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, srcX, srcZ, srcSize, srcSize, 0, 0, MAP_PX, MAP_PX);

    // Subtle distance ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, radius * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    const toMap = (wx: number, wz: number) => ({
      mx: center + (wx - hud.playerX) * scale,
      my: center + (wz - hud.playerZ) * scale,
    });

    // Placed structures (house foundations, upper floors, stairs, roofs, hearth, outfitter counter)
    for (const s of hud.structuresMini) {
      const { mx, my } = toMap(s.x, s.z);
      if (mx < -12 || mx > MAP_PX + 12 || my < -12 || my > MAP_PX + 12) continue;

      if (s.type === 'foundation' || s.type === 'roof' || s.type === 'upper_floor') {
        const size = 4 * scale;
        ctx.fillStyle =
          s.type === 'upper_floor'
            ? 'rgba(217, 166, 102, 0.72)'
            : s.type === 'roof'
              ? 'rgba(130, 86, 52, 0.85)'
              : 'rgba(182, 134, 84, 0.88)';
        ctx.strokeStyle =
          s.type === 'upper_floor' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(20, 15, 10, 0.7)';
        ctx.lineWidth = s.type === 'upper_floor' ? 1.1 : 0.8;
        ctx.fillRect(mx - size * 0.5, my - size * 0.5, size, size);
        ctx.strokeRect(mx - size * 0.5, my - size * 0.5, size, size);
      } else if (s.type === 'stairs') {
        const sw = 1.8 * scale;
        const sl = 3.2 * scale;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(-(s.rotationY || 0));
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#0f141a';
        ctx.lineWidth = 0.8;
        ctx.fillRect(-sw * 0.5, -sl * 0.5, sw, sl);
        ctx.strokeRect(-sw * 0.5, -sl * 0.5, sw, sl);
        ctx.strokeStyle = '#451a03';
        for (let step = -2; step <= 2; step++) {
          const sy = (step / 3) * (sl * 0.44);
          ctx.beginPath();
          ctx.moveTo(-sw * 0.4, sy);
          ctx.lineTo(sw * 0.4, sy);
          ctx.stroke();
        }
        ctx.restore();
      } else if (s.type === 'counter') {
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#0f141a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mx, my, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (s.type === 'hearth') {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player's Bakery Shop footprint
    if (hud.bakery.stage !== 'none') {
      const { mx, my } = toMap(hud.bakery.x, hud.bakery.z);
      if (mx >= -14 && mx <= MAP_PX + 14 && my >= -14 && my <= MAP_PX + 14) {
        const w = 5.4 * scale;
        const h = 4.6 * scale;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(-hud.bakery.rotationY);
        if (hud.bakery.stage === 'built') {
          ctx.fillStyle = hud.bakery.isOpen ? 'rgba(245, 158, 11, 0.95)' : 'rgba(217, 119, 6, 0.85)';
          ctx.strokeStyle = '#0f141a';
          ctx.lineWidth = 1.2;
          ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
          ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
        } else {
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-w * 0.5, -h * 0.5, w, h);
        }
        ctx.restore();
      }
    }

    // Nearby small village houses & Supply Shop
    for (const c of hud.cottagesMini) {
      const { mx, my } = toMap(c.x, c.z);
      if (mx < -12 || mx > MAP_PX + 12 || my < -12 || my > MAP_PX + 12) continue;

      const size = 4.6 * scale;
      ctx.fillStyle = c.isSupply ? 'rgba(56, 152, 184, 0.92)' : 'rgba(148, 96, 58, 0.9)';
      ctx.strokeStyle = 'rgba(15, 20, 26, 0.85)';
      ctx.lineWidth = 1;
      ctx.fillRect(mx - size * 0.5, my - size * 0.5, size, size);
      ctx.strokeRect(mx - size * 0.5, my - size * 0.5, size, size);
    }

    // Active NPC travelers
    for (const npc of hud.npcsMini) {
      const { mx, my } = toMap(npc.x, npc.z);
      if (mx < -8 || mx > MAP_PX + 8 || my < -8 || my > MAP_PX + 8) continue;

      ctx.fillStyle = npc.phase === 'talking' || npc.phase === 'browsing' ? '#fcd34d' : '#38bdf8';
      ctx.strokeStyle = '#0c1218';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Player FOV cone & directional arrow at center
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-hud.playerYaw);

    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 22, -Math.PI * 0.5 - 0.45, -Math.PI * 0.5 + 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#0f141a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -7.5);
    ctx.lineTo(5.2, 5.5);
    ctx.lineTo(0, 2.8);
    ctx.lineTo(-5.2, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Inner vignette rim
    const vig = ctx.createRadialGradient(center, center, radius * 0.72, center, center, radius);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(9,13,18,0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, MAP_PX, MAP_PX);

    ctx.restore();
  }, [hud.playerX, hud.playerZ, hud.playerYaw, hud.bakery, hud.structuresMini, hud.cottagesMini, hud.npcsMini]);

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-20 select-none"
      aria-label="Valley circular minimap"
    >
      <div className="relative flex h-[156px] w-[156px] items-center justify-center rounded-full border-2 border-amber-400/45 bg-[#0c1218] p-1 shadow-[0_12px_28px_rgba(0,0,0,0.65)]">
        <canvas
          ref={canvasRef}
          style={{ width: MAP_PX, height: MAP_PX }}
          className="rounded-full"
        />

        {/* Cardinal compass ticks on bezel */}
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/50 bg-[#0f161f] px-1.5 text-[9px] font-bold leading-tight text-amber-300">
          N
        </span>
        <span className="absolute top-1/2 -right-2 -translate-y-1/2 rounded-full border border-white/15 bg-[#0f161f] px-1 text-[8px] font-semibold leading-tight text-slate-400">
          E
        </span>
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-[#0f161f] px-1 text-[8px] font-semibold leading-tight text-slate-400">
          S
        </span>
        <span className="absolute top-1/2 -left-2 -translate-y-1/2 rounded-full border border-white/15 bg-[#0f161f] px-1 text-[8px] font-semibold leading-tight text-slate-400">
          W
        </span>
      </div>
    </div>
  );
}
