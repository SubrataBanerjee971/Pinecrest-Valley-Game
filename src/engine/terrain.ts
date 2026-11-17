import * as THREE from 'three';

export const WORLD_SIZE = 280;
export const PLAYABLE_RADIUS = 104;
export const LAKE_LEVEL = -1.25;
export const GRID_SIZE = 4;
export const WALL_HEIGHT = 3.2;

function hash2D(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * (valueNoise(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.48;
  }
  return value;
}

function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.0001) return Math.hypot(px - ax, pz - az);
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (pz - az) * dz) / lenSq, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/**
 * Main North-South Alpine Valley Road centerline X coordinate as a function of Z.
 * Passes cleanly east of the player's starter house at x ≈ 10.
 */
export function trailCenterXAtZ(z: number): number {
  return 10 + Math.sin(z * 0.028) * 3.8;
}

/**
 * Returns shortest distance in meters to the proper alpine road network:
 * 1) Main North-South Valley Road (z = -96 to z = 88)
 * 2) Lakeshore Spur Road branching West to the glacial lake beach
 * 3) Timber Ridge Spur Road branching East toward mountain timberlands
 * 4) Homestead Driveway connecting the starter cabin doorway to the Main Road
 */
export function distanceToRoad(x: number, z: number): number {
  let minD = 999;

  // 1. Main Valley Road (North-South)
  if (z >= -96 && z <= 88) {
    minD = Math.min(minD, Math.abs(x - trailCenterXAtZ(z)));
  }

  // 2. Lakeshore West Spur: from crossroads (10, 8) -> (-4, 11) -> (-13, 18)
  minD = Math.min(minD, distToSegment(x, z, 10, 8, -4, 11));
  minD = Math.min(minD, distToSegment(x, z, -4, 11, -13, 18));

  // 3. Timber Ridge East Spur: from crossroads (10, 8) -> (34, 4) -> (68, -8)
  minD = Math.min(minD, distToSegment(x, z, 10, 8, 34, 4));
  minD = Math.min(minD, distToSegment(x, z, 34, 4, 68, -8));

  // 4. Homestead Driveway: from starter house front door (2.2, 0) -> Main Road (10, 0)
  minD = Math.min(minD, distToSegment(x, z, 2.2, 0, 10, 0));

  return minD;
}

export function distanceToTrail(x: number, z: number): number {
  return distanceToRoad(x, z);
}

export function isOnRoad(x: number, z: number): boolean {
  return distanceToRoad(x, z) < 2.35;
}

/**
 * Continuous heightfield for Pinecrest Valley.
 * Includes a level homestead clearing near (-4..14, -10..12),
 * a glacial alpine lake around (-30, 24), graded valley roads,
 * and dramatic perimeter mountain ridges.
 */
export function groundHeightAt(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z);

  // Base rolling alpine terrain
  let h = fbm(x * 0.014 + 4.2, z * 0.014 - 2.7, 4) * 5.4;
  h += fbm(x * 0.045 - 1.1, z * 0.045 + 3.4, 2) * 1.1;

  // Gentle elevation rise toward the northern mountain pass
  h += Math.max(0, -z * 0.032);

  // Scenic homestead clearing around the starter cabin & crossroads flattened cleanly
  const clearDist = Math.hypot((x - 3) * 0.82, (z - 2) * 0.88);
  const clearBlend = THREE.MathUtils.smoothstep(clearDist, 10, 30);
  const clearingTarget = 0.85;
  h = THREE.MathUtils.lerp(clearingTarget, h, clearBlend);

  // Alpine glacial lake basin centered around (-30, 24)
  const lakeDx = (x + 30) / 28;
  const lakeDz = (z - 24) / 24;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  if (lakeDist < 1.35) {
    const basin = Math.cos(Math.min(1, lakeDist / 1.2) * Math.PI * 0.5);
    h -= basin * 5.2;
  }

  // Secondary creek channel draining southwest from the lake
  const creekDist = Math.abs(x + 38 + Math.sin(z * 0.07) * 5);
  if (z > 30 && creekDist < 9) {
    const creekDepth = (1 - creekDist / 9) * 2.4;
    h -= creekDepth;
  }

  // Smoothly grade the proper roads so roadbeds are flat and passable
  const roadD = distanceToRoad(x, z);
  if (roadD < 5.4 && lakeDist > 1.06) {
    const roadBlend = THREE.MathUtils.smoothstep(roadD, 2.2, 5.4);
    const roadGradeH = 0.85 + Math.max(0, -z * 0.025) + Math.max(0, (x - 24) * 0.04);
    h = THREE.MathUtils.lerp(roadGradeH, h, roadBlend);
  }

  // Outer alpine mountain peaks creating a natural perimeter
  if (distFromCenter > 78) {
    const rimT = Math.max(0, (distFromCenter - 78) / 52);
    const ridgeNoise = fbm(x * 0.035 + 11.3, z * 0.035 - 7.1, 3) * 0.5 + 0.65;
    h += Math.pow(rimT, 1.75) * 44 * ridgeNoise;
  }

  return h;
}

const _nVec = new THREE.Vector3();
export function terrainNormalAt(x: number, z: number, target = _nVec): THREE.Vector3 {
  const eps = 0.5;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);
  target.set(hL - hR, 2 * eps, hD - hU).normalize();
  return target;
}

export function isInWater(x: number, z: number): boolean {
  return groundHeightAt(x, z) < LAKE_LEVEL - 0.08;
}
