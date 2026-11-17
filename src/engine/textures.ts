import * as THREE from 'three';

export interface ProceduralTextureSet {
  woodAlbedo: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  stoneAlbedo: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  shingleAlbedo: THREE.CanvasTexture;
  fabricAlbedo: THREE.CanvasTexture;
  grassAlbedo: THREE.CanvasTexture;
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Cedar Wood Albedo & Bump
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 256;
  woodCanvas.height = 256;
  const wCtx = woodCanvas.getContext('2d')!;
  wCtx.fillStyle = '#8b5e3c';
  wCtx.fillRect(0, 0, 256, 256);

  const woodBumpCanvas = document.createElement('canvas');
  woodBumpCanvas.width = 256;
  woodBumpCanvas.height = 256;
  const wbCtx = woodBumpCanvas.getContext('2d')!;
  wbCtx.fillStyle = '#808080';
  wbCtx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y++) {
    const plankEdge = y % 32 === 0;
    const grain = Math.sin(y * 0.25) * 10 + (Math.random() - 0.5) * 14;
    const r = Math.min(255, Math.max(0, 142 + grain));
    const g = Math.min(255, Math.max(0, 96 + grain * 0.7));
    const b = Math.min(255, Math.max(0, 62 + grain * 0.45));
    wCtx.fillStyle = plankEdge ? '#52341e' : `rgb(${r | 0},${g | 0},${b | 0})`;
    wCtx.fillRect(0, y, 256, 1);

    const bVal = plankEdge ? 40 : Math.min(255, Math.max(0, 128 + grain * 2));
    wbCtx.fillStyle = `rgb(${bVal | 0},${bVal | 0},${bVal | 0})`;
    wbCtx.fillRect(0, y, 256, 1);
  }

  // Subtle wood knots
  for (let i = 0; i < 8; i++) {
    const kx = Math.random() * 230 + 12;
    const ky = Math.random() * 230 + 12;
    wCtx.fillStyle = 'rgba(65, 38, 20, 0.35)';
    wCtx.beginPath();
    wCtx.ellipse(kx, ky, 9, 4, 0, 0, Math.PI * 2);
    wCtx.fill();
  }

  // 2. Alpine Granite Stone Albedo & Bump
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 256;
  stoneCanvas.height = 256;
  const sCtx = stoneCanvas.getContext('2d')!;
  sCtx.fillStyle = '#6f777f';
  sCtx.fillRect(0, 0, 256, 256);

  const stoneBumpCanvas = document.createElement('canvas');
  stoneBumpCanvas.width = 256;
  stoneBumpCanvas.height = 256;
  const sbCtx = stoneBumpCanvas.getContext('2d')!;
  sbCtx.fillStyle = '#808080';
  sbCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const sz = 4 + Math.random() * 14;
    const shade = 92 + Math.floor(Math.random() * 52);
    sCtx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 8}, 0.42)`;
    sCtx.fillRect(x, y, sz, sz * 0.75);

    const bShade = 80 + Math.floor(Math.random() * 90);
    sbCtx.fillStyle = `rgba(${bShade}, ${bShade}, ${bShade}, 0.45)`;
    sbCtx.fillRect(x, y, sz, sz * 0.75);
  }

  // 3. Cedar Shingle Roof Albedo
  const shingleCanvas = document.createElement('canvas');
  shingleCanvas.width = 256;
  shingleCanvas.height = 256;
  const shCtx = shingleCanvas.getContext('2d')!;
  shCtx.fillStyle = '#47362b';
  shCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    const y = row * 16;
    const offset = (row % 2) * 16;
    for (let col = -1; col < 9; col++) {
      const x = col * 32 + offset;
      const tone = 56 + Math.floor(Math.random() * 24);
      shCtx.fillStyle = `rgb(${tone + 14}, ${tone + 2}, ${tone - 8})`;
      shCtx.fillRect(x + 1, y + 1, 30, 14);
    }
  }

  // 4. Woven Wool / Canvas Fabric
  const fabricCanvas = document.createElement('canvas');
  fabricCanvas.width = 128;
  fabricCanvas.height = 128;
  const fCtx = fabricCanvas.getContext('2d')!;
  fCtx.fillStyle = '#c8bca9';
  fCtx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    fCtx.fillStyle = y % 8 === 0 ? 'rgba(90, 75, 60, 0.14)' : 'rgba(255, 255, 255, 0.08)';
    fCtx.fillRect(0, y, 128, 2);
  }
  for (let x = 0; x < 128; x += 4) {
    fCtx.fillStyle = x % 8 === 0 ? 'rgba(90, 75, 60, 0.12)' : 'rgba(255, 255, 255, 0.06)';
    fCtx.fillRect(x, 0, 2, 128);
  }

  // 5. Alpine Meadow Micro-detail Texture
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#536f45';
  gCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random();
    gCtx.fillStyle =
      v > 0.65
        ? 'rgba(104, 134, 78, 0.35)'
        : v > 0.3
          ? 'rgba(65, 92, 52, 0.35)'
          : 'rgba(116, 102, 74, 0.25)';
    gCtx.fillRect(x, y, 3, 3);
  }

  return {
    woodAlbedo: configureTexture(woodCanvas, true, aniso, 2, 2),
    woodBump: configureTexture(woodBumpCanvas, false, aniso, 2, 2),
    stoneAlbedo: configureTexture(stoneCanvas, true, aniso, 2, 2),
    stoneBump: configureTexture(stoneBumpCanvas, false, aniso, 2, 2),
    shingleAlbedo: configureTexture(shingleCanvas, true, aniso, 3, 3),
    fabricAlbedo: configureTexture(fabricCanvas, true, aniso, 2, 2),
    grassAlbedo: configureTexture(grassCanvas, true, aniso, 24, 24),
  };
}

export function createSignboardTexture(shopName: string, isOpen: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Aged cedar board
  ctx.fillStyle = '#4e3522';
  ctx.fillRect(0, 0, 512, 256);

  // Inner brass border
  ctx.strokeStyle = '#d49d46';
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, 476, 220);

  // Shop name
  ctx.fillStyle = '#f8f1e4';
  ctx.font = '700 38px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const displayTitle = shopName.trim().slice(0, 22) || 'Pinecrest Outfitter';
  ctx.fillText(displayTitle, 256, 92);

  // Subtitle
  ctx.fillStyle = '#d4b896';
  ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('GENERAL STORE & OUTFITTER', 256, 138);

  // Open/Closed banner
  ctx.fillStyle = isOpen ? '#3f7f58' : '#7f3b3b';
  ctx.fillRect(146, 166, 220, 44);
  ctx.strokeStyle = '#f3e5cd';
  ctx.lineWidth = 2;
  ctx.strokeRect(146, 166, 220, 44);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.fillText(isOpen ? 'OPEN FOR TRADE' : 'CLOSED', 256, 189);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
