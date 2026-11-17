import * as THREE from 'three';
import { BakeryPastryId, CraftedItemId, DecorationItemId, StructureType } from '../types/game';
import { GRID_SIZE, WALL_HEIGHT } from './terrain';
import { createSignboardTexture, ProceduralTextureSet } from './textures';

export interface MaterialLibrary {
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  shingle: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  bark: THREE.MeshStandardMaterial;
  pineFoliage: THREE.MeshStandardMaterial;
  berry: THREE.MeshStandardMaterial;
  ember: THREE.MeshStandardMaterial;
}

export function createMaterialLibrary(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): MaterialLibrary {
  return {
    wood: new THREE.MeshStandardMaterial({
      map: textures.woodAlbedo,
      bumpMap: textures.woodBump,
      bumpScale: 0.03,
      roughness: 0.78,
      metalness: 0.04,
    }),
    woodDark: new THREE.MeshStandardMaterial({
      map: textures.woodAlbedo,
      bumpMap: textures.woodBump,
      bumpScale: 0.035,
      color: new THREE.Color('#7c5a42'),
      roughness: 0.84,
      metalness: 0.05,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: textures.stoneAlbedo,
      bumpMap: textures.stoneBump,
      bumpScale: 0.05,
      roughness: 0.9,
      metalness: 0.06,
    }),
    shingle: new THREE.MeshStandardMaterial({
      map: textures.shingleAlbedo,
      roughness: 0.88,
      metalness: 0.04,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d29f46'),
      roughness: 0.24,
      metalness: 0.92,
    }),
    iron: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#343c44'),
      roughness: 0.36,
      metalness: 0.86,
    }),
    fabric: new THREE.MeshStandardMaterial({
      map: textures.fabricAlbedo,
      roughness: 0.92,
      metalness: 0.0,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d7ebf4'),
      roughness: 0.08,
      metalness: 0.0,
      transmission: isSoftwareGl ? 0 : 0.86,
      transparent: true,
      opacity: isSoftwareGl ? 0.38 : 1.0,
      ior: 1.5,
      thickness: 0.2,
    }),
    bark: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5a3d2b'),
      bumpMap: textures.woodBump,
      bumpScale: 0.05,
      roughness: 0.93,
      metalness: 0.0,
    }),
    pineFoliage: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2b4f34'),
      roughness: 0.82,
      metalness: 0.0,
    }),
    berry: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b82841'),
      roughness: 0.32,
      metalness: 0.05,
    }),
    ember: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ff6a1a'),
      emissive: new THREE.Color('#ff5208'),
      emissiveIntensity: 2.2,
      roughness: 0.6,
    }),
  };
}

function enableShadows(group: THREE.Object3D, cast = true, receive = true): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = cast;
      obj.receiveShadow = receive;
    }
  });
}

export function buildHarvestablePine(mats: MaterialLibrary, scale = 1): THREE.Group {
  const g = new THREE.Group();

  // Root flare
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 0.7, 7), mats.bark);
  flare.position.y = 0.35;
  g.add(flare);

  // Main trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.29, 4.8, 8), mats.bark);
  trunk.position.y = 2.4;
  g.add(trunk);

  // 4 tiered pine boughs
  const tiers = [
    { y: 2.3, r: 1.75, h: 1.9 },
    { y: 3.4, r: 1.45, h: 1.8 },
    { y: 4.45, r: 1.1, h: 1.65 },
    { y: 5.4, r: 0.72, h: 1.5 },
  ];
  tiers.forEach((t) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 8), mats.pineFoliage);
    cone.position.y = t.y;
    g.add(cone);
  });

  g.scale.setScalar(scale);
  enableShadows(g, true, true);
  return g;
}

export function buildOreBoulder(mats: MaterialLibrary, hasIron: boolean): THREE.Group {
  const g = new THREE.Group();

  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), mats.stone);
  main.scale.set(1.2, 0.78, 1.0);
  main.position.y = 0.52;
  g.add(main);

  const side = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), mats.stone);
  side.position.set(0.68, 0.35, 0.38);
  side.rotation.set(0.4, 0.8, 0.2);
  g.add(side);

  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mats.stone);
  cap.position.set(-0.55, 0.28, -0.35);
  g.add(cap);

  if (hasIron) {
    const veinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7f6452'),
      roughness: 0.34,
      metalness: 0.82,
    });
    for (let i = 0; i < 3; i++) {
      const vein = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), veinMat);
      vein.position.set(
        (i - 1) * 0.42,
        0.58 + (i % 2) * 0.2,
        0.52 - i * 0.16,
      );
      vein.scale.set(1.2, 0.8, 0.9);
      g.add(vein);
    }
  }

  enableShadows(g, true, true);
  return g;
}

export function buildBerryBush(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();

  const shrubMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#35613d'),
    roughness: 0.86,
  });

  const offsets = [
    [0, 0.42, 0, 0.52],
    [0.32, 0.34, 0.2, 0.4],
    [-0.3, 0.36, -0.15, 0.42],
    [0.1, 0.32, -0.32, 0.38],
  ];

  offsets.forEach(([x, y, z, r]) => {
    const lobe = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), shrubMat);
    lobe.position.set(x, y, z);
    g.add(lobe);
  });

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), mats.berry);
    berry.position.set(
      Math.cos(angle) * 0.45,
      0.42 + (i % 3) * 0.12,
      Math.sin(angle) * 0.45,
    );
    g.add(berry);
  }

  enableShadows(g, true, true);
  return g;
}

export function buildFallenLog(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.6, 8), mats.bark);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.24;
  g.add(log);

  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 6), mats.bark);
  branch.position.set(0.4, 0.42, 0.25);
  branch.rotation.set(0.5, 0.2, -0.6);
  g.add(branch);

  const moss = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 7, 5),
    new THREE.MeshStandardMaterial({ color: '#476e3f', roughness: 0.92 }),
  );
  moss.scale.set(1.8, 0.4, 0.9);
  moss.position.set(-0.3, 0.45, 0);
  g.add(moss);

  enableShadows(g, true, true);
  return g;
}

export function buildCraftedItemMiniMesh(
  itemId: CraftedItemId,
  mats: MaterialLibrary,
): THREE.Group {
  const g = new THREE.Group();

  switch (itemId) {
    case 'storm_lantern': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 10), mats.brass);
      base.position.y = 0.03;
      const globe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.16, 10),
        new THREE.MeshStandardMaterial({
          color: '#ffd480',
          emissive: '#ff9d2e',
          emissiveIntensity: 1.4,
          roughness: 0.2,
        }),
      );
      globe.position.y = 0.14;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 10), mats.brass);
      cap.position.y = 0.26;
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.014, 6, 12, Math.PI), mats.iron);
      handle.position.y = 0.3;
      g.add(base, globe, cap, handle);
      break;
    }
    case 'brass_compass': {
      const caseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), mats.brass);
      caseBody.position.y = 0.025;
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.105, 0.054, 16),
        new THREE.MeshStandardMaterial({ color: '#f4ecd8', roughness: 0.5 }),
      );
      dial.position.y = 0.028;
      const needle = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.06, 0.14),
        new THREE.MeshStandardMaterial({ color: '#b52f2f', roughness: 0.3 }),
      );
      needle.position.y = 0.038;
      g.add(caseBody, dial, needle);
      break;
    }
    case 'wool_parka': {
      const coatMat = new THREE.MeshStandardMaterial({ color: '#8f3f33', roughness: 0.92 });
      const folded = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.26), coatMat);
      folded.position.y = 0.06;
      const furTrim = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.06, 0.1), mats.fabric);
      furTrim.position.set(0, 0.13, 0.07);
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), mats.brass);
      clasp.position.set(0, 0.13, 0);
      g.add(folded, furTrim, clasp);
      break;
    }
    case 'trail_rations': {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.18), mats.fabric);
      pouch.position.y = 0.055;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.04), mats.woodDark);
      strap.position.y = 0.055;
      const waxSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8), mats.berry);
      waxSeal.position.set(0, 0.12, 0);
      g.add(pouch, strap, waxSeal);
      break;
    }
    case 'timber_pack': {
      const leather = new THREE.MeshStandardMaterial({ color: '#6b472b', roughness: 0.85 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.18), mats.fabric);
      body.position.y = 0.14;
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.08, 0.2), leather);
      flap.position.y = 0.25;
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), mats.brass);
      buckle.position.set(0, 0.21, 0.1);
      g.add(body, flap, buckle);
      break;
    }
    case 'carved_staff': {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.56, 8), mats.wood);
      shaft.rotation.z = Math.PI / 2.2;
      shaft.position.y = 0.08;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.07, 8), mats.brass);
      tip.rotation.z = Math.PI / 2.2;
      tip.position.set(0.25, 0.12, 0);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 8), mats.fabric);
      grip.rotation.z = Math.PI / 2.2;
      grip.position.set(-0.08, 0.07, 0);
      g.add(shaft, tip, grip);
      break;
    }
    case 'hot_cider': {
      const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.2, 10), mats.brass);
      flask.position.y = 0.1;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.08, 10), mats.woodDark);
      band.position.y = 0.09;
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.05, 8), mats.wood);
      cork.position.y = 0.22;
      g.add(flask, band, cork);
      break;
    }
  }

  enableShadows(g, true, true);
  return g;
}

export function buildStructureModel(
  type: StructureType,
  mats: MaterialLibrary,
  options?: {
    shopName?: string;
    isOpen?: boolean;
    lit?: boolean;
    doorOpen?: boolean;
    stairCutoutRotY?: number;
  },
): THREE.Group {
  const g = new THREE.Group();
  const W = GRID_SIZE;
  const H = WALL_HEIGHT;

  switch (type) {
    case 'foundation': {
      // Raised timber deck + deep anchored corner stone piers
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.24, W), mats.wood);
      deck.position.y = 0.34;
      g.add(deck);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.14, W + 0.08), mats.woodDark);
      trim.position.y = 0.22;
      g.add(trim);

      const corners = [
        [-W / 2 + 0.25, -W / 2 + 0.25],
        [W / 2 - 0.25, -W / 2 + 0.25],
        [-W / 2 + 0.25, W / 2 - 0.25],
        [W / 2 - 0.25, W / 2 - 0.25],
      ];
      corners.forEach(([cx, cz]) => {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.65, 0.44), mats.stone);
        pier.position.set(cx, -0.45, cz);
        g.add(pier);
      });
      break;
    }

    case 'wall': {
      // Base sill beam + 6 stacked horizontal logs + corner posts
      const sill = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, 0.32), mats.woodDark);
      sill.position.y = 0.11;
      g.add(sill);

      for (let i = 0; i < 6; i++) {
        const log = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, W, 10),
          i % 2 === 0 ? mats.wood : mats.woodDark,
        );
        log.rotation.z = Math.PI / 2;
        log.position.y = 0.42 + i * 0.44;
        g.add(log);
      }

      const topPlate = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, 0.34), mats.woodDark);
      topPlate.position.y = H - 0.11;
      g.add(topPlate);

      [-W / 2 + 0.14, W / 2 - 0.14].forEach((px) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, H, 0.34), mats.woodDark);
        post.position.set(px, H / 2, 0);
        g.add(post);
      });
      break;
    }

    case 'window_wall': {
      // Lower half wall
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, W, 10), mats.wood);
        log.rotation.z = Math.PI / 2;
        log.position.y = 0.22 + i * 0.42;
        g.add(log);
      }
      // Side pillars
      [-W / 2 + 0.45, W / 2 - 0.45].forEach((px) => {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.9, H, 0.32), mats.woodDark);
        side.position.set(px, H / 2, 0);
        g.add(side);
      });
      // Header beam
      const header = new THREE.Mesh(new THREE.BoxGeometry(W, 0.56, 0.34), mats.woodDark);
      header.position.y = H - 0.28;
      g.add(header);
      // Window frame + glass + mullions
      const sill = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 0.42), mats.wood);
      sill.position.y = 1.26;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.32, 0.05), mats.glass);
      pane.position.y = 1.96;
      const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.34, 0.12), mats.woodDark);
      mullionV.position.y = 1.96;
      const mullionH = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.07, 0.12), mats.woodDark);
      mullionH.position.y = 1.96;
      g.add(sill, pane, mullionV, mullionH);
      break;
    }

    case 'doorway': {
      // Left & right wall sections
      [-1.35, 1.35].forEach((px) => {
        const wallSeg = new THREE.Mesh(new THREE.BoxGeometry(1.3, H, 0.32), mats.wood);
        wallSeg.position.set(px, H / 2, 0);
        g.add(wallSeg);
      });
      // Lintel header above door
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.36), mats.woodDark);
      lintel.position.set(0, H - 0.36, 0);
      g.add(lintel);

      // Door threshold
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.55), mats.stone);
      step.position.y = 0.06;
      g.add(step);

      // Hinged door pivot at left jamb (-0.65)
      const doorPivot = new THREE.Group();
      doorPivot.name = 'doorPivot';
      doorPivot.position.set(-0.64, 0.12, 0);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.34, 0.1), mats.woodDark);
      leaf.position.set(0.63, 1.17, 0);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.13), mats.iron);
      brace.position.set(0.63, 0.65, 0);
      const handle = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), mats.brass);
      handle.position.set(1.1, 1.12, 0.09);
      doorPivot.add(leaf, brace, handle);
      doorPivot.rotation.y = options?.doorOpen ? Math.PI * 0.48 : 0;
      g.add(doorPivot);
      break;
    }

    case 'roof': {
      // Pitched gable roof spanning 4.3m x 4.3m with overhang
      const slopeLen = 2.45;
      const pitch = 0.46;
      const leftSlope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.18, W + 0.45), mats.shingle);
      leftSlope.position.set(-1.05, 0.58, 0);
      leftSlope.rotation.z = pitch;
      g.add(leftSlope);

      const rightSlope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.18, W + 0.45), mats.shingle);
      rightSlope.position.set(1.05, 0.58, 0);
      rightSlope.rotation.z = -pitch;
      g.add(rightSlope);

      // Ridge timber beam
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, W + 0.5), mats.woodDark);
      ridge.position.y = 1.12;
      g.add(ridge);

      // Gable triangular end caps (front & back)
      const gableShape = new THREE.Shape();
      gableShape.moveTo(-W / 2, 0);
      gableShape.lineTo(W / 2, 0);
      gableShape.lineTo(0, 1.05);
      gableShape.closePath();
      const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.16, bevelEnabled: false });
      const frontGable = new THREE.Mesh(gableGeo, mats.wood);
      frontGable.position.set(0, 0.02, W / 2 - 0.18);
      const backGable = new THREE.Mesh(gableGeo, mats.wood);
      backGable.position.set(0, 0.02, -W / 2 + 0.02);
      g.add(frontGable, backGable);
      break;
    }

    case 'upper_floor': {
      // Walkable 2nd/3rd story timber floor deck with top surface flush at y = 0
      if (options?.stairCutoutRotY !== undefined) {
        const cutGrp = new THREE.Group();
        cutGrp.rotation.y = options.stairCutoutRotY;

        // Left & right side walkways flanking the 1.68m stairwell
        const sideW = 1.16;
        const leftSlab = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.22, W), mats.wood);
        leftSlab.position.set(-W / 2 + sideW / 2, -0.11, 0);
        const rightSlab = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.22, W), mats.wood);
        rightSlab.position.set(W / 2 - sideW / 2, -0.11, 0);

        // Top landing bridge at -Z end (-2.0 to -1.35)
        const landingSlab = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.22, 0.66), mats.wood);
        landingSlab.position.set(0, -0.11, -W / 2 + 0.33);

        // Exposed underside floor joists
        [-1.35, 1.35].forEach((jx) => {
          const joist = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, W), mats.woodDark);
          joist.position.set(jx, -0.26, 0);
          cutGrp.add(joist);
        });

        // Timber stairwell safety railing along left, right, and +Z end of opening
        const railH = 0.88;
        [-0.86, 0.86].forEach((rx) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.28), mats.woodDark);
          rail.position.set(rx, railH, 0.32);
          cutGrp.add(rail);
          [-1.25, 0.32, 1.92].forEach((pz) => {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, railH + 0.06, 0.1), mats.woodDark);
            post.position.set(rx, (railH + 0.06) / 2, pz);
            cutGrp.add(post);
          });
        });
        const backRail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08), mats.woodDark);
        backRail.position.set(0, railH, 1.92);
        cutGrp.add(leftSlab, rightSlab, landingSlab, backRail);
        g.add(cutGrp);
      } else {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, W), mats.wood);
        slab.position.y = -0.11;
        const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.08, W + 0.08), mats.woodDark);
        trim.position.y = -0.22;
        g.add(slab, trim);

        // Exposed cross joists underneath ceiling
        [-1.2, 0, 1.2].forEach((jz) => {
          const joist = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.14, 0.16), mats.woodDark);
          joist.position.set(0, -0.27, jz);
          g.add(joist);
        });
      }
      break;
    }

    case 'stairs': {
      // Composite 3D wooden staircase climbing from +Z (y=0) to -Z (y=WALL_HEIGHT)
      const stairWidth = 1.6;
      const steps = 11;
      const startZ = 1.8;
      const endZ = -1.45;
      const runLen = startZ - endZ; // 3.25m
      const stepDepth = runLen / steps;
      const stepRise = H / steps;

      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const sy = t * H;
        const sz = startZ - (i + 0.5) * stepDepth;

        const tread = new THREE.Mesh(
          new THREE.BoxGeometry(stairWidth - 0.12, 0.09, stepDepth + 0.07),
          i % 2 === 0 ? mats.wood : mats.woodDark,
        );
        tread.position.set(0, sy - 0.045, sz);
        g.add(tread);

        const riser = new THREE.Mesh(
          new THREE.BoxGeometry(stairWidth - 0.16, stepRise, 0.05),
          mats.woodDark,
        );
        riser.position.set(0, sy - stepRise * 0.5, sz + stepDepth * 0.44);
        g.add(riser);
      }

      // Top landing flush at y = WALL_HEIGHT (-1.45 to -2.0)
      const topLanding = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, 0.18, 0.58), mats.wood);
      topLanding.position.set(0, H - 0.09, -1.71);
      g.add(topLanding);

      // Sloped timber stringers & handrails on both sides
      const diagLen = Math.hypot(runLen, H);
      const slopeAngle = Math.atan2(H, runLen);
      const midY = H * 0.5;
      const midZ = (startZ + endZ) * 0.5;

      [-stairWidth / 2 + 0.05, stairWidth / 2 - 0.05].forEach((sx) => {
        const stringer = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, 0.24, diagLen + 0.2),
          mats.woodDark,
        );
        stringer.position.set(sx, midY - 0.14, midZ);
        stringer.rotation.x = slopeAngle;
        g.add(stringer);

        const handrail = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.07, diagLen + 0.15),
          mats.wood,
        );
        handrail.position.set(sx, midY + 0.88, midZ);
        handrail.rotation.x = slopeAngle;
        g.add(handrail);

        // Bottom & top newel posts + mid baluster + brass cap
        const botPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.98, 0.12), mats.woodDark);
        botPost.position.set(sx, 0.49, startZ + 0.02);
        const topPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.98, 0.12), mats.woodDark);
        topPost.position.set(sx, H + 0.44, endZ - 0.04);
        const midPost = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.96, 0.07), mats.woodDark);
        midPost.position.set(sx, midY + 0.42, midZ);
        const brassCap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mats.brass);
        brassCap.position.set(sx, 1.0, startZ + 0.02);
        g.add(botPost, topPost, midPost, brassCap);
      });
      break;
    }

    case 'hearth': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.32, 1.3), mats.stone);
      base.position.y = 0.16;
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.45), mats.stone);
      backWall.position.set(0, 0.9, -0.35);
      const leftCheek = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.1, 0.75), mats.stone);
      leftCheek.position.set(-0.58, 0.75, 0.08);
      const rightCheek = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.1, 0.75), mats.stone);
      rightCheek.position.set(0.58, 0.75, 0.08);
      const mantel = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.16, 0.9), mats.woodDark);
      mantel.position.set(0, 1.38, -0.05);
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.76, 2.2, 0.56), mats.stone);
      chimney.position.set(0, 2.55, -0.26);

      // Firewood logs + embers
      const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.65, 7), mats.bark);
      log1.rotation.z = Math.PI / 2;
      log1.rotation.y = 0.25;
      log1.position.set(0, 0.39, 0.08);
      const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 7), mats.bark);
      log2.rotation.z = Math.PI / 2;
      log2.rotation.y = -0.32;
      log2.position.set(0, 0.45, 0.05);

      const flameGroup = new THREE.Group();
      flameGroup.name = 'hearthFlame';
      flameGroup.visible = options?.lit ?? true;
      const emberBed = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mats.ember);
      emberBed.scale.set(1.3, 0.45, 1.0);
      emberBed.position.set(0, 0.38, 0.08);
      const flameCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.44, 7),
        new THREE.MeshBasicMaterial({ color: '#ffae38' }),
      );
      flameCone.position.set(0, 0.62, 0.08);
      flameGroup.add(emberBed, flameCone);

      g.add(base, backWall, leftCheek, rightCheek, mantel, chimney, log1, log2, flameGroup);
      break;
    }

    case 'bedroll': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 2.1), mats.woodDark);
      frame.position.y = 0.24;
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.16, 1.98), mats.fabric);
      mattress.position.y = 0.46;
      const blanket = new THREE.Mesh(
        new THREE.BoxGeometry(1.06, 0.1, 1.35),
        new THREE.MeshStandardMaterial({ color: '#476852', roughness: 0.92 }),
      );
      blanket.position.set(0, 0.54, 0.3);
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.14, 0.38),
        new THREE.MeshStandardMaterial({ color: '#ebe2d1', roughness: 0.9 }),
      );
      pillow.position.set(0, 0.56, -0.68);
      g.add(frame, mattress, blanket, pillow);
      break;
    }

    case 'workbench': {
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 0.95), mats.wood);
      top.position.y = 0.92;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.78), mats.woodDark);
      shelf.position.y = 0.28;
      [
        [-0.92, -0.38],
        [0.92, -0.38],
        [-0.92, 0.38],
        [0.92, 0.38],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), mats.woodDark);
        leg.position.set(lx, 0.45, lz);
        g.add(leg);
      });
      const vise = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.26), mats.iron);
      vise.position.set(-0.78, 0.94, 0.48);
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.18), mats.iron);
      anvil.position.set(0.62, 1.08, 0);
      const blueprint = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.42),
        new THREE.MeshStandardMaterial({ color: '#d7e3ec', roughness: 0.85 }),
      );
      blueprint.rotation.x = -Math.PI / 2;
      blueprint.position.set(-0.1, 1.0, 0.05);
      g.add(top, shelf, vise, anvil, blueprint);
      break;
    }

    case 'counter': {
      // Main timber counter base
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.96, 0.92), mats.woodDark);
      body.position.y = 0.48;
      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.1, 1.04), mats.wood);
      counterTop.position.y = 1.01;
      const brassTrim = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.05, 1.06), mats.brass);
      brassTrim.position.y = 0.96;

      // Glass display hood on the left half
      const displayCase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.72), mats.glass);
      displayCase.position.set(-0.55, 1.24, 0);

      // Brass cash register on right end
      const regBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.42), mats.brass);
      regBase.position.set(1.05, 1.19, 0.02);
      const regDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.44), mats.wood);
      regDrawer.position.set(1.05, 1.1, 0.05);

      // 4 named display mount slots for live 3D stocked items
      const slotsGroup = new THREE.Group();
      slotsGroup.name = 'counterSlots';
      [-1.02, -0.52, -0.02, 0.48].forEach((sx, idx) => {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 12), mats.fabric);
        pad.position.set(sx, 1.075, 0.05);
        pad.name = `slotPad_${idx}`;
        const anchor = new THREE.Group();
        anchor.name = `slotAnchor_${idx}`;
        anchor.position.set(sx, 1.09, 0.05);
        slotsGroup.add(pad, anchor);
      });

      g.add(body, counterTop, brassTrim, displayCase, regBase, regDrawer, slotsGroup);
      break;
    }

    case 'signpost': {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.75, 8), mats.woodDark);
      post.position.y = 1.375;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 0.12), mats.woodDark);
      arm.position.set(0.78, 2.48, 0);

      const boardPivot = new THREE.Group();
      boardPivot.name = 'signBoardPivot';
      boardPivot.position.set(0.9, 2.42, 0);

      const signTex = createSignboardTexture(
        options?.shopName ?? 'Pinecrest Outfitter',
        options?.isOpen ?? false,
      );
      const boardMat = new THREE.MeshStandardMaterial({
        map: signTex,
        roughness: 0.72,
      });
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.78, 0.08),
        [mats.woodDark, mats.woodDark, mats.woodDark, mats.woodDark, boardMat, boardMat],
      );
      board.name = 'signBoardMesh';
      board.position.y = -0.54;

      const chainL = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), mats.iron);
      chainL.position.set(-0.5, -0.1, 0);
      const chainR = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), mats.iron);
      chainR.position.set(0.5, -0.1, 0);

      boardPivot.add(board, chainL, chainR);

      // Small iron hanging lantern at the tip of the arm
      const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.1, 8), mats.iron);
      lanternCap.position.set(1.58, 2.34, 0);
      const lanternGlow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8),
        new THREE.MeshStandardMaterial({
          color: '#ffd68a',
          emissive: '#ff9c33',
          emissiveIntensity: 1.5,
        }),
      );
      lanternGlow.position.set(1.58, 2.22, 0);

      g.add(post, arm, boardPivot, lanternCap, lanternGlow);
      break;
    }
  }

  enableShadows(g, true, true);
  return g;
}

export function buildVillageCottageModel(
  mats: MaterialLibrary,
  options?: { isSupplyShop?: boolean; trimColor?: string },
): THREE.Group {
  const g = new THREE.Group();
  const W = 4.6;
  const D = 5.4;
  const H = 2.9;

  // Stone foundation plinth + front porch deck
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.55, D + 0.3), mats.stone);
  base.position.y = 0.275;
  g.add(base);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.15), mats.woodDark);
  porch.position.set(0, 0.46, D / 2 + 0.55);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.48), mats.stone);
  step.position.set(0, 0.2, D / 2 + 1.2);
  g.add(porch, step);

  // Main timber cabin walls
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats.wood);
  body.position.y = 0.55 + H / 2;
  g.add(body);

  // Horizontal log trim accents along corners
  [
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [-W / 2, D / 2],
    [W / 2, D / 2],
  ].forEach(([cx, cz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, H + 0.1, 0.28), mats.woodDark);
    post.position.set(cx, 0.55 + H / 2, cz);
    g.add(post);
  });

  // Pitched shingle gable roof
  const slopeMat = options?.isSupplyShop
    ? new THREE.MeshStandardMaterial({ color: '#3b596e', roughness: 0.85 })
    : mats.shingle;
  const leftSlope = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.18, D + 0.75), slopeMat);
  leftSlope.position.set(-1.3, 0.55 + H + 0.62, 0);
  leftSlope.rotation.z = 0.48;
  const rightSlope = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.18, D + 0.75), slopeMat);
  rightSlope.position.set(1.3, 0.55 + H + 0.62, 0);
  rightSlope.rotation.z = -0.48;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, D + 0.8), mats.woodDark);
  ridge.position.set(0, 0.55 + H + 1.28, 0);
  g.add(leftSlope, rightSlope, ridge);

  // Gable end triangles
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-W / 2, 0);
  gableShape.lineTo(W / 2, 0);
  gableShape.lineTo(0, 1.24);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.18, bevelEnabled: false });
  const frontGable = new THREE.Mesh(gableGeo, mats.woodDark);
  frontGable.position.set(0, 0.55 + H, D / 2 - 0.16);
  const backGable = new THREE.Mesh(gableGeo, mats.woodDark);
  backGable.position.set(0, 0.55 + H, -D / 2);
  g.add(frontGable, backGable);

  // Stone chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.74, 2.2, 0.74), mats.stone);
  chimney.position.set(-1.35, 0.55 + H + 0.9, -1.2);
  g.add(chimney);

  // Front wooden door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.1, 0.12), mats.woodDark);
  door.position.set(0, 0.55 + 1.05, D / 2 + 0.04);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mats.brass);
  knob.position.set(0.38, 0.55 + 1.02, D / 2 + 0.12);
  g.add(door, knob);

  // Warm lit cabin windows (front + sides)
  const warmWinMat = new THREE.MeshStandardMaterial({
    color: '#ffe1a1',
    emissive: '#ffaa3b',
    emissiveIntensity: 0.95,
    roughness: 0.3,
  });

  [
    [-1.45, 0.55 + 1.45, D / 2 + 0.03, 0],
    [1.45, 0.55 + 1.45, D / 2 + 0.03, 0],
    [-W / 2 - 0.03, 0.55 + 1.45, 0, Math.PI / 2],
    [W / 2 + 0.03, 0.55 + 1.45, 0, Math.PI / 2],
  ].forEach(([wx, wy, wz, ry]) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.08), warmWinMat);
    win.position.set(wx, wy, wz);
    win.rotation.y = ry;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.08, 0.04), mats.woodDark);
    frame.position.set(wx, wy, wz);
    frame.rotation.y = ry;
    g.add(frame, win);
  });

  // Porch lantern + awning if this is the Village Rain & Gear Supply House
  const lanternGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8),
    new THREE.MeshStandardMaterial({
      color: '#ffe099',
      emissive: '#ff9d2e',
      emissiveIntensity: 1.6,
    }),
  );
  lanternGlow.position.set(0.9, 0.55 + 2.15, D / 2 + 0.28);
  g.add(lanternGlow);

  if (options?.isSupplyShop) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.1, 1.35),
      new THREE.MeshStandardMaterial({ color: '#c48135', roughness: 0.85 }),
    );
    awning.position.set(0, 0.55 + 2.42, D / 2 + 0.62);
    awning.rotation.x = 0.25;

    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.5, 0.08),
      new THREE.MeshStandardMaterial({
        map: createSignboardTexture('Rain & Gear Supply', true),
        roughness: 0.72,
      }),
    );
    signBoard.position.set(0, 0.55 + 2.75, D / 2 + 0.22);
    g.add(awning, signBoard);
  }

  enableShadows(g, true, true);
  return g;
}

export function buildTravelerModel(coatHex: string, hatHex: string): THREE.Group {
  const g = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: '#dfb394', roughness: 0.78 });
  const coatMat = new THREE.MeshStandardMaterial({ color: coatHex, roughness: 0.88 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#3b424c', roughness: 0.9 });
  const bootMat = new THREE.MeshStandardMaterial({ color: '#452b1a', roughness: 0.85 });
  const hatMat = new THREE.MeshStandardMaterial({ color: hatHex, roughness: 0.86 });
  const packMat = new THREE.MeshStandardMaterial({ color: '#8a6c48', roughness: 0.9 });

  const leftLegPivot = new THREE.Group();
  leftLegPivot.name = 'leftLeg';
  leftLegPivot.position.set(-0.14, 0.72, 0);
  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.64, 8), pantsMat);
  lLeg.position.y = -0.32;
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.24), bootMat);
  lBoot.position.set(0, -0.65, 0.04);
  leftLegPivot.add(lLeg, lBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.name = 'rightLeg';
  rightLegPivot.position.set(0.14, 0.72, 0);
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.64, 8), pantsMat);
  rLeg.position.y = -0.32;
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.24), bootMat);
  rBoot.position.set(0, -0.65, 0.04);
  rightLegPivot.add(rLeg, rBoot);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.28), coatMat);
  torso.position.y = 1.06;

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.2), packMat);
  backpack.position.set(0, 1.08, -0.22);

  const headPivot = new THREE.Group();
  headPivot.name = 'headPivot';
  headPivot.position.y = 1.42;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
  head.position.y = 0.14;

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), hatMat);
  hatBrim.position.y = 0.26;
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.16, 12), hatMat);
  hatCrown.position.y = 0.35;

  headPivot.add(head, hatBrim, hatCrown);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.name = 'leftArm';
  leftArmPivot.position.set(-0.3, 1.32, 0);
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.54, 8), coatMat);
  lArm.position.y = -0.25;
  leftArmPivot.add(lArm);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.name = 'rightArm';
  rightArmPivot.position.set(0.3, 1.32, 0);
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.54, 8), coatMat);
  rArm.position.y = -0.25;
  rightArmPivot.add(rArm);

  g.add(
    leftLegPivot,
    rightLegPivot,
    torso,
    backpack,
    headPivot,
    leftArmPivot,
    rightArmPivot,
  );
  enableShadows(g, true, true);
  return g;
}

export function createViewmodel(mats: MaterialLibrary): {
  root: THREE.Group;
  axeGroup: THREE.Group;
  pickaxeGroup: THREE.Group;
  lanternGroup: THREE.Group;
  lanternLight: THREE.PointLight;
  torchGroup: THREE.Group;
  torchFlameMesh: THREE.Mesh;
  torchLight: THREE.PointLight;
  umbrellaGroup: THREE.Group;
  heldPastryGroup: THREE.Group;
  heldPastryAnchor: THREE.Group;
} {
  const root = new THREE.Group();

  // Right-hand tool group
  const axeGroup = new THREE.Group();
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.62, 8), mats.wood);
  axeHandle.position.set(0.28, -0.24, -0.45);
  axeHandle.rotation.set(-0.35, 0, 0.18);
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.2), mats.iron);
  axeHead.position.set(0.25, -0.02, -0.58);
  axeHead.rotation.set(-0.35, 0, 0.18);
  axeGroup.add(axeHandle, axeHead);

  const pickaxeGroup = new THREE.Group();
  const pickHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.64, 8), mats.woodDark);
  pickHandle.position.set(0.28, -0.24, -0.45);
  pickHandle.rotation.set(-0.35, 0, 0.18);
  const pickHead = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.34), mats.iron);
  pickHead.position.set(0.25, -0.01, -0.58);
  pickHead.rotation.set(-0.35, 0, 0.18);
  pickaxeGroup.add(pickHandle, pickHead);

  // Left-hand storm lantern
  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(-0.32, -0.22, -0.52);
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.04, 10), mats.brass);
  const lGlobe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.11, 10),
    new THREE.MeshStandardMaterial({
      color: '#ffe099',
      emissive: '#ff9d2e',
      emissiveIntensity: 2.0,
    }),
  );
  lGlobe.position.y = 0.075;
  const lCap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.06, 10), mats.brass);
  lCap.position.y = 0.16;
  const lanternLight = new THREE.PointLight('#ffaa4f', 2.2, 22, 1.55);
  lanternLight.position.set(0, 0.12, 0);
  lanternGroup.add(lBase, lGlobe, lCap, lanternLight);

  // Right-hand Pine-Resin Night Torch
  const torchGroup = new THREE.Group();
  torchGroup.position.set(0.32, -0.24, -0.48);
  torchGroup.rotation.set(-0.22, 0, -0.1);
  const tShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.56, 8), mats.woodDark);
  tShaft.position.y = -0.04;
  const tCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.032, 0.07, 10), mats.iron);
  tCollar.position.y = 0.24;
  const tResinCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 10, 8),
    new THREE.MeshStandardMaterial({
      color: '#4f2410',
      emissive: '#ff5d17',
      emissiveIntensity: 2.1,
      roughness: 0.7,
    }),
  );
  tResinCore.position.y = 0.29;
  const torchFlameMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.058, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: '#ffae38' }),
  );
  torchFlameMesh.position.y = 0.4;
  const torchLight = new THREE.PointLight('#ff9438', 0, 26, 1.35);
  torchLight.position.set(0, 0.44, -0.05);
  torchGroup.add(tShaft, tCollar, tResinCore, torchFlameMesh, torchLight);
  torchGroup.visible = false;

  // Overhead Canopy Umbrella (held when active)
  const umbrellaGroup = new THREE.Group();
  umbrellaGroup.position.set(-0.24, 0.28, -0.42);
  umbrellaGroup.rotation.set(0.18, 0, 0.12);
  const uShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.68, 8), mats.woodDark);
  uShaft.position.y = -0.15;
  const uHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 8), mats.brass);
  uHandle.position.y = -0.46;
  const uCanopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.54, 0.22, 8),
    new THREE.MeshStandardMaterial({
      color: '#2d6a6e',
      roughness: 0.65,
      side: THREE.DoubleSide,
    }),
  );
  uCanopy.position.y = 0.2;
  const uTip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), mats.brass);
  uTip.position.y = 0.34;
  umbrellaGroup.add(uShaft, uHandle, uCanopy, uTip);
  umbrellaGroup.visible = false;

  // Serving tray & carried cake/pastry group
  const heldPastryGroup = new THREE.Group();
  heldPastryGroup.position.set(0.02, -0.26, -0.48);
  const trayPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.14, 0.022, 14),
    new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.35 }),
  );
  const heldPastryAnchor = new THREE.Group();
  heldPastryAnchor.position.y = 0.014;
  heldPastryAnchor.scale.setScalar(1.35);
  heldPastryGroup.add(trayPlate, heldPastryAnchor);
  heldPastryGroup.visible = false;

  root.add(axeGroup, pickaxeGroup, lanternGroup, torchGroup, umbrellaGroup, heldPastryGroup);
  return {
    root,
    axeGroup,
    pickaxeGroup,
    lanternGroup,
    lanternLight,
    torchGroup,
    torchFlameMesh,
    torchLight,
    umbrellaGroup,
    heldPastryGroup,
    heldPastryAnchor,
  };
}

export function buildPastryMiniMesh(
  pastryId: BakeryPastryId,
  mats: MaterialLibrary,
): THREE.Group {
  const g = new THREE.Group();

  // Small wooden serving plate under every pastry/cake
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.14, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: '#f3ece0', roughness: 0.32 }),
  );
  plate.position.y = 0.01;
  g.add(plate);

  switch (pastryId) {
    case 'croissant': {
      const pastryMat = new THREE.MeshStandardMaterial({ color: '#d8923e', roughness: 0.62 });
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.036, 8, 14, Math.PI * 1.15), pastryMat);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = -Math.PI * 0.08;
      arc.position.set(0, 0.048, 0.01);
      const centerRidge = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), pastryMat);
      centerRidge.scale.set(1.2, 0.85, 0.9);
      centerRidge.position.set(0, 0.056, -0.04);
      g.add(arc, centerRidge);
      break;
    }
    case 'blueberry_muffin': {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.058, 0.075, 10),
        new THREE.MeshStandardMaterial({ color: '#e6d8be', roughness: 0.85 }),
      );
      cup.position.y = 0.055;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#c88743', roughness: 0.72 }),
      );
      dome.scale.set(1, 0.75, 1);
      dome.position.y = 0.1;
      const berryMat = new THREE.MeshStandardMaterial({ color: '#2b3e6e', roughness: 0.35 });
      [
        [-0.03, 0.14, 0.02],
        [0.035, 0.13, -0.02],
        [0.0, 0.15, -0.03],
      ].forEach(([bx, by, bz]) => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), berryMat);
        b.position.set(bx, by, bz);
        g.add(b);
      });
      g.add(cup, dome);
      break;
    }
    case 'cinnamon_roll': {
      const roll = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.065, 12),
        new THREE.MeshStandardMaterial({ color: '#b56e35', roughness: 0.7 }),
      );
      roll.position.y = 0.052;
      const swirl = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.015, 6, 14),
        new THREE.MeshStandardMaterial({ color: '#7a3f1a', roughness: 0.78 }),
      );
      swirl.rotation.x = Math.PI / 2;
      swirl.position.y = 0.086;
      const glaze = new THREE.Mesh(
        new THREE.CylinderGeometry(0.078, 0.082, 0.015, 12),
        new THREE.MeshStandardMaterial({ color: '#fbf5ea', roughness: 0.28 }),
      );
      glaze.position.y = 0.092;
      g.add(roll, swirl, glaze);
      break;
    }
    case 'berry_tart': {
      const crust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.1, 0.045, 14),
        new THREE.MeshStandardMaterial({ color: '#d49d56', roughness: 0.72 }),
      );
      crust.position.y = 0.042;
      const filling = new THREE.Mesh(
        new THREE.CylinderGeometry(0.096, 0.096, 0.022, 14),
        mats.berry,
      );
      filling.position.y = 0.064;
      const cream = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#fff8ee', roughness: 0.35 }),
      );
      cream.position.y = 0.082;
      g.add(crust, filling, cream);
      break;
    }
    case 'strawberry_cake': {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.05, 10), mats.brass);
      stand.position.y = 0.04;
      const sponge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.095, 16),
        new THREE.MeshStandardMaterial({ color: '#fff4eb', roughness: 0.45 }),
      );
      sponge.position.y = 0.11;
      const jamBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.123, 0.123, 0.018, 16),
        new THREE.MeshStandardMaterial({ color: '#d9485f', roughness: 0.35 }),
      );
      jamBand.position.y = 0.11;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const sb = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.036, 7), mats.berry);
        sb.rotation.x = Math.PI;
        sb.position.set(Math.cos(a) * 0.065, 0.17, Math.sin(a) * 0.065);
        g.add(sb);
      }
      g.add(stand, sponge, jamBand);
      break;
    }
    case 'chocolate_cake': {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.05, 10), mats.brass);
      stand.position.y = 0.04;
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.11, 16),
        new THREE.MeshStandardMaterial({ color: '#3b2116', roughness: 0.45 }),
      );
      base.position.y = 0.12;
      const ganache = new THREE.Mesh(
        new THREE.CylinderGeometry(0.133, 0.128, 0.035, 16),
        new THREE.MeshStandardMaterial({ color: '#24120b', roughness: 0.18 }),
      );
      ganache.position.y = 0.165;
      const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), mats.berry);
      cherry.position.y = 0.195;
      g.add(stand, base, ganache, cherry);
      break;
    }
  }

  enableShadows(g, true, true);
  return g;
}

export function buildBakeryShelfModel(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const W = 1.08;
  const D = 0.44;

  // Back frame & side uprights
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(W, 1.48, 0.05), mats.woodDark);
  backPanel.position.set(0, 0.78, -D / 2 + 0.025);
  [-W / 2 + 0.04, W / 2 - 0.04].forEach((px) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.54, D), mats.woodDark);
    post.position.set(px, 0.77, 0);
    g.add(post);
  });

  // 3 Wooden Display Tiers (Lower tier = tierAnchor_0, Upper tier = tierAnchor_1)
  const shelfHeights = [0.42, 0.88, 1.34];
  shelfHeights.forEach((sy, idx) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.055, D), mats.wood);
    board.position.set(0, sy, 0.02);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.035, 0.025), mats.brass);
    lip.position.set(0, sy + 0.025, D / 2 + 0.01);
    g.add(board, lip);

    if (idx < 2) {
      const tierAnchor = new THREE.Group();
      tierAnchor.name = `shelfTier_${idx}`;
      tierAnchor.position.set(0, sy + 0.03, 0.03);
      g.add(tierAnchor);
    }
  });

  // Top decorative cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.09, D + 0.06), mats.woodDark);
  cornice.position.set(0, 1.54, 0);
  g.add(backPanel, cornice);

  enableShadows(g, true, true);
  return g;
}

export function buildBakeryFrameModel(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const W = 5.4;
  const D = 4.6;

  // Stone foundation & raised timber floor deck
  const stonePlinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.45, D + 0.24), mats.stone);
  stonePlinth.position.y = 0.225;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, D), mats.wood);
  deck.position.y = 0.54;
  g.add(stonePlinth, deck);

  // Corner timber framing posts
  [
    [-W / 2 + 0.16, -D / 2 + 0.16],
    [W / 2 - 0.16, -D / 2 + 0.16],
    [-W / 2 + 0.16, D / 2 - 0.16],
    [W / 2 - 0.16, D / 2 - 0.16],
  ].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.35, 0.22), mats.woodDark);
    post.position.set(px, 0.63 + 1.175, pz);
    g.add(post);
  });

  // Top tie beams
  const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, 0.18), mats.woodDark);
  frontBeam.position.set(0, 2.95, D / 2 - 0.16);
  const backBeam = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, 0.18), mats.woodDark);
  backBeam.position.set(0, 2.95, -D / 2 + 0.16);
  g.add(frontBeam, backBeam);

  // Stacked lumber & construction sign
  for (let i = 0; i < 4; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 0.24), mats.wood);
    plank.position.set(-0.9, 0.7 + (i % 2) * 0.13, 0.2 + Math.floor(i / 2) * 0.3);
    g.add(plank);
  }

  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.35, 6), mats.woodDark);
  stake.position.set(1.4, 1.25, D / 2 + 0.45);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.52, 0.06),
    new THREE.MeshStandardMaterial({
      map: createSignboardTexture('Bakery Plot (Build [E])', false),
      roughness: 0.72,
    }),
  );
  sign.position.set(1.4, 1.75, D / 2 + 0.45);
  g.add(stake, sign);

  enableShadows(g, true, true);
  return g;
}

export function buildBakeryShopModel(
  mats: MaterialLibrary,
  options?: { shopName?: string; isOpen?: boolean },
): THREE.Group {
  const g = new THREE.Group();
  const W = 5.4;
  const D = 4.6;
  const H = 2.9;

  const plasterMat = new THREE.MeshStandardMaterial({ color: '#ece3d2', roughness: 0.86 });
  const awningRedMat = new THREE.MeshStandardMaterial({ color: '#a83b36', roughness: 0.84 });
  const awningCreamMat = new THREE.MeshStandardMaterial({ color: '#f3ead9', roughness: 0.84 });

  // Stone foundation plinth + timber shop deck + front step
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.28, 0.45, D + 0.28), mats.stone);
  base.position.y = 0.225;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W, 0.18, D), mats.wood);
  deck.position.y = 0.54;
  const porchStep = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.24, 0.96), mats.stone);
  porchStep.position.set(0.25, 0.2, D / 2 + 0.48);
  g.add(base, deck, porchStep);

  const floorY = 0.63;

  // Back wall & left/right walls (open storefront in front)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.26), plasterMat);
  backWall.position.set(0, floorY + H / 2, -D / 2 + 0.13);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.26, H, D), plasterMat);
  leftWall.position.set(-W / 2 + 0.13, floorY + H / 2, 0);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.26, H, D), plasterMat);
  rightWall.position.set(W / 2 - 0.13, floorY + H / 2, 0);
  g.add(backWall, leftWall, rightWall);

  // Front half-walls + wide bakery service arch & open right-front walk-in entrance
  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, H, 0.24), mats.woodDark);
  leftPillar.position.set(-W / 2 + 0.55, floorY + H / 2, D / 2 - 0.12);
  const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(1.0, H, 0.24), mats.woodDark);
  rightPillar.position.set(W / 2 - 0.5, floorY + H / 2, D / 2 - 0.12);
  const header = new THREE.Mesh(new THREE.BoxGeometry(W, 0.56, 0.26), mats.woodDark);
  header.position.set(0, floorY + H - 0.28, D / 2 - 0.12);
  g.add(leftPillar, rightPillar, header);

  // Pitched shingle roof + gables
  const leftSlope = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.18, D + 0.8), mats.shingle);
  leftSlope.position.set(-1.45, floorY + H + 0.68, 0);
  leftSlope.rotation.z = 0.47;
  const rightSlope = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.18, D + 0.8), mats.shingle);
  rightSlope.position.set(1.45, floorY + H + 0.68, 0);
  rightSlope.rotation.z = -0.47;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, D + 0.86), mats.woodDark);
  ridge.position.set(0, floorY + H + 1.4, 0);
  g.add(leftSlope, rightSlope, ridge);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-W / 2, 0);
  gableShape.lineTo(W / 2, 0);
  gableShape.lineTo(0, 1.38);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.18, bevelEnabled: false });
  const frontGable = new THREE.Mesh(gableGeo, mats.wood);
  frontGable.position.set(0, floorY + H, D / 2 - 0.18);
  const backGable = new THREE.Mesh(gableGeo, mats.wood);
  backGable.position.set(0, floorY + H, -D / 2);
  g.add(frontGable, backGable);

  // Striped Bakery Awning over the front serving window
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.08, 1.25),
      i % 2 === 0 ? awningRedMat : awningCreamMat,
    );
    stripe.position.set(-1.45 + i * 0.58, floorY + 2.26, D / 2 + 0.45);
    stripe.rotation.x = 0.28;
    g.add(stripe);
  }

  // Brick artisan bake oven inside back-left corner + chimney
  const ovenBase = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.55, 1.2), mats.stone);
  ovenBase.position.set(-1.7, floorY + 0.775, -D / 2 + 0.85);
  const ovenGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.42, 0.12),
    mats.ember,
  );
  ovenGlow.position.set(-1.7, floorY + 0.92, -D / 2 + 1.45);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.5, 0.72), mats.stone);
  chimney.position.set(-1.7, floorY + H + 0.85, -D / 2 + 0.8);
  g.add(ovenBase, ovenGlow, chimney);

  // Front-left service counter + brass register (leaving wide right-front doorway open to walk inside!)
  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.92, 0.66), mats.woodDark);
  counterBase.position.set(-0.72, floorY + 0.46, D / 2 - 0.26);
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.09, 0.8), mats.wood);
  counterTop.position.set(-0.72, floorY + 0.96, D / 2 - 0.26);
  const register = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.32), mats.brass);
  register.position.set(-0.12, floorY + 1.13, D / 2 - 0.25);
  const welcomeMat = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.025, 0.64),
    new THREE.MeshStandardMaterial({ color: '#7b3c2d', roughness: 0.95 }),
  );
  welcomeMat.position.set(0.96, floorY + 0.015, D / 2 - 0.16);
  g.add(counterBase, counterTop, register, welcomeMat);

  // Bakery Shop Signboard mounted on front gable
  const signTex = createSignboardTexture(
    options?.shopName ?? 'Pinecrest Bakery',
    options?.isOpen ?? false,
  );
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 });
  const signMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.65, 0.08),
    [mats.woodDark, mats.woodDark, mats.woodDark, mats.woodDark, signMat, signMat],
  );
  signMesh.name = 'bakerySignMesh';
  signMesh.position.set(0, floorY + H + 0.36, D / 2 + 0.06);
  g.add(signMesh);

  // Warm Bakery Lantern + interior pendant light
  const porchGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.2, 8),
    new THREE.MeshStandardMaterial({
      color: '#ffe1a6',
      emissive: '#ffaa3b',
      emissiveIntensity: 1.7,
    }),
  );
  porchGlow.position.set(-1.55, floorY + 2.25, D / 2 + 0.12);
  g.add(porchGlow);

  // 4 Named Shelf Mounting Bays along back & right interior walls
  const shelfBays: Array<[number, number, number]> = [
    [-0.08, -1.68, 0],
    [1.16, -1.68, 0],
    [2.02, -0.72, -Math.PI / 2],
    [2.02, 0.56, -Math.PI / 2],
  ];
  shelfBays.forEach(([bx, bz, bry], idx) => {
    const bay = new THREE.Group();
    bay.name = `shelfBay_${idx}`;
    bay.position.set(bx, floorY, bz);
    bay.rotation.y = bry;
    g.add(bay);
  });

  enableShadows(g, true, true);
  return g;
}

export function buildDecorationModel(
  id: DecorationItemId,
  mats: MaterialLibrary,
): THREE.Group {
  const g = new THREE.Group();

  switch (id) {
    case 'woven_rug': {
      const rugOuter = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.03, 1.55),
        new THREE.MeshStandardMaterial({ color: '#8f3f38', roughness: 0.94 }),
      );
      rugOuter.position.y = 0.015;
      const rugInner = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.034, 1.2),
        new THREE.MeshStandardMaterial({ color: '#d4b88e', roughness: 0.92 }),
      );
      rugInner.position.y = 0.017;
      const centerMedallion = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.038, 0.56),
        new THREE.MeshStandardMaterial({ color: '#3a594e', roughness: 0.92 }),
      );
      centerMedallion.position.y = 0.019;
      g.add(rugOuter, rugInner, centerMedallion);
      break;
    }

    case 'potted_fern': {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.17, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: '#a85d3c', roughness: 0.78 }),
      );
      pot.position.y = 0.17;
      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12),
        mats.bark,
      );
      soil.position.y = 0.33;
      g.add(pot, soil);

      const frondMat = new THREE.MeshStandardMaterial({ color: '#3f7344', roughness: 0.78 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 5), frondMat);
        frond.position.set(Math.cos(a) * 0.18, 0.5, Math.sin(a) * 0.18);
        frond.rotation.z = -Math.cos(a) * 0.55;
        frond.rotation.x = Math.sin(a) * 0.55;
        g.add(frond);
      }
      break;
    }

    case 'oak_dining_table': {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.84), mats.wood);
      top.position.y = 0.74;
      [
        [-0.48, -0.32],
        [0.48, -0.32],
        [-0.48, 0.32],
        [0.48, 0.32],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.72, 8), mats.woodDark);
        leg.position.set(lx, 0.36, lz);
        g.add(leg);
      });
      // Porcelain teapot + cup on table
      const potBody = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#e9eef2', roughness: 0.25 }),
      );
      potBody.position.set(-0.15, 0.87, 0.05);
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.035, 0.075, 10),
        new THREE.MeshStandardMaterial({ color: '#e9eef2', roughness: 0.25 }),
      );
      cup.position.set(0.18, 0.82, 0.12);
      g.add(top, potBody, cup);
      break;
    }

    case 'mountain_painting': {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.92, 0.07), mats.woodDark);
      const canvas = new THREE.Mesh(
        new THREE.BoxGeometry(1.22, 0.72, 0.08),
        new THREE.MeshStandardMaterial({ color: '#6b8fae', roughness: 0.7 }),
      );
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.36, 4),
        new THREE.MeshStandardMaterial({ color: '#dfe8f0', roughness: 0.8 }),
      );
      peak.rotation.y = Math.PI / 4;
      peak.scale.set(1.2, 1, 0.15);
      peak.position.set(-0.1, -0.05, 0.05);
      g.add(frame, canvas, peak);
      break;
    }

    case 'brass_candelabra': {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.85, 10), mats.woodDark);
      stand.position.y = 0.425;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.06, 12), mats.brass);
      base.position.y = 0.88;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8), mats.brass);
      stem.position.y = 1.05;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), mats.brass);
      bar.position.y = 1.15;
      g.add(stand, base, stem, bar);

      [-0.18, 0, 0.18].forEach((cx, idx) => {
        const candle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.026, idx === 1 ? 0.18 : 0.14, 8),
          new THREE.MeshStandardMaterial({ color: '#f8f1e0', roughness: 0.6 }),
        );
        candle.position.set(cx, idx === 1 ? 1.28 : 1.23, 0);
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.018, 0.055, 6),
          new THREE.MeshBasicMaterial({ color: '#ffbe47' }),
        );
        flame.position.set(cx, idx === 1 ? 1.4 : 1.33, 0);
        g.add(candle, flame);
      });
      break;
    }

    case 'wall_clock': {
      const caseBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.14), mats.woodDark);
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: '#f6eedc', roughness: 0.4 }),
      );
      dial.rotation.x = Math.PI / 2;
      dial.position.set(0, 0.2, 0.06);
      const pendulumRod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), mats.brass);
      pendulumRod.position.set(0, -0.14, 0.075);
      const pendulumBob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mats.brass);
      pendulumBob.scale.set(1, 1, 0.45);
      pendulumBob.position.set(0, -0.31, 0.075);
      g.add(caseBox, dial, pendulumRod, pendulumBob);
      break;
    }

    case 'table_lamp': {
      // Compact cedar side table + brass & linen lamp
      const sideTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12), mats.wood);
      sideTop.position.y = 0.68;
      const sideLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.68, 10), mats.woodDark);
      sideLeg.position.y = 0.34;
      const sideFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 12), mats.woodDark);
      sideFoot.position.y = 0.02;
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.05, 12), mats.brass);
      lampBase.position.y = 0.73;
      const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.26, 8), mats.brass);
      lampStem.position.y = 0.87;
      const lampShade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.2, 0.24, 14, 1, false),
        new THREE.MeshStandardMaterial({
          color: '#faecc8',
          emissive: '#ffb85c',
          emissiveIntensity: 1.45,
          roughness: 0.65,
          side: THREE.DoubleSide,
        }),
      );
      lampShade.position.y = 1.07;
      g.add(sideTop, sideLeg, sideFoot, lampBase, lampStem, lampShade);
      break;
    }

    case 'floor_lamp': {
      const fBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.05, 14), mats.woodDark);
      fBase.position.y = 0.025;
      const fPole = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.036, 1.56, 10), mats.woodDark);
      fPole.position.y = 0.82;
      const fCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10), mats.brass);
      fCollar.position.y = 1.58;
      const fShade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.26, 0.34, 16),
        new THREE.MeshStandardMaterial({
          color: '#fdf0d1',
          emissive: '#ffc26b',
          emissiveIntensity: 1.55,
          roughness: 0.65,
          side: THREE.DoubleSide,
        }),
      );
      fShade.position.y = 1.76;
      g.add(fBase, fPole, fCollar, fShade);
      break;
    }

    case 'wall_lantern_lamp': {
      const backplate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.04), mats.woodDark);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), mats.iron);
      arm.position.set(0, 0.08, 0.12);
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.06, 0.18, 10),
        new THREE.MeshStandardMaterial({
          color: '#ffe8b5',
          emissive: '#ffaa44',
          emissiveIntensity: 1.65,
          roughness: 0.35,
        }),
      );
      glass.position.set(0, -0.02, 0.2);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.07, 10), mats.iron);
      cap.position.set(0, 0.09, 0.2);
      g.add(backplate, arm, glass, cap);
      break;
    }

    case 'plush_armchair': {
      const fabricMat = new THREE.MeshStandardMaterial({ color: '#2b594b', roughness: 0.88 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.72), fabricMat);
      seat.position.y = 0.34;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.62, 0.18), fabricMat);
      back.position.set(0, 0.68, -0.27);
      back.rotation.x = -0.12;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.68), fabricMat);
      armL.position.set(-0.34, 0.48, 0);
      const armR = armL.clone();
      armR.position.x = 0.34;
      [
        [-0.3, -0.28],
        [0.3, -0.28],
        [-0.3, 0.28],
        [0.3, 0.28],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.24, 8), mats.woodDark);
        leg.position.set(lx, 0.12, lz);
        g.add(leg);
      });
      g.add(seat, back, armL, armR);
      break;
    }

    case 'pine_bookshelf': {
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.65, 0.36), mats.woodDark);
      sideL.position.set(-0.48, 0.825, 0);
      const sideR = sideL.clone();
      sideR.position.x = 0.48;
      const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.65, 0.04), mats.wood);
      backPanel.position.set(0, 0.825, -0.16);
      g.add(sideL, sideR, backPanel);

      const bookPalette = ['#8f3a36', '#2f5a6b', '#4b6844', '#a87d39', '#5a4468'];
      [0.08, 0.54, 1.02, 1.52].forEach((sy, sIdx) => {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.045, 0.36), mats.wood);
        shelf.position.set(0, sy, 0);
        g.add(shelf);
        if (sIdx < 3) {
          for (let b = 0; b < 6; b++) {
            const h = 0.24 + ((b + sIdx) % 3) * 0.04;
            const book = new THREE.Mesh(
              new THREE.BoxGeometry(0.08, h, 0.22),
              new THREE.MeshStandardMaterial({
                color: bookPalette[(b + sIdx) % bookPalette.length],
                roughness: 0.78,
              }),
            );
            book.position.set(-0.32 + b * 0.11, sy + h / 2 + 0.022, 0.02);
            g.add(book);
          }
        }
      });
      break;
    }
  }

  enableShadows(g, true, true);
  return g;
}

export function buildDeliveryParcelModel(mats: MaterialLibrary): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.42, 0.56),
    new THREE.MeshStandardMaterial({ color: '#b88b58', roughness: 0.84 }),
  );
  box.position.y = 0.21;

  const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.44, 0.06), mats.woodDark);
  ribbonA.position.y = 0.215;
  const ribbonB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.58), mats.woodDark);
  ribbonB.position.y = 0.215;

  const tag = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.02, 0.14),
    new THREE.MeshStandardMaterial({
      color: '#34d399',
      emissive: '#10b981',
      emissiveIntensity: 0.85,
      roughness: 0.4,
    }),
  );
  tag.position.set(0.12, 0.43, 0.1);
  tag.rotation.y = 0.25;

  const beaconLight = new THREE.PointLight('#6ee7b7', 1.4, 5.5, 1.8);
  beaconLight.position.set(0, 0.62, 0);

  g.add(box, ribbonA, ribbonB, tag, beaconLight);
  enableShadows(g, true, true);
  return g;
}
