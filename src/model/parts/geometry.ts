import * as THREE from "three";

/** Rounded box via ExtrudeGeometry. */
export function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius: number,
  segments = 4,
  opts?: { bevel?: boolean }
): THREE.BufferGeometry {
  const r = Math.min(radius, width / 2, height / 2, depth / 2);
  const shape = roundedRectShape(width, height, r);
  const bevel = opts?.bevel !== false;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel,
    bevelThickness: bevel ? r * 0.25 : 0,
    bevelSize: bevel ? r * 0.2 : 0,
    bevelSegments: bevel ? Math.max(1, segments - 1) : 0,
    curveSegments: segments,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

export function roundedRectShape(
  width: number,
  height: number,
  radius: number
): THREE.Shape {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  const hw = width / 2 - r;
  const hh = height / 2 - r;
  shape.moveTo(-hw, -hh - r);
  shape.lineTo(hw, -hh - r);
  shape.absarc(hw, -hh, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw + r, hh);
  shape.absarc(hw, hh, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw, hh + r);
  shape.absarc(-hw, hh, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw - r, -hh);
  shape.absarc(-hw, -hh, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/**
 * Flat rounded-rect screen glass. UVs are normalized to 0..1 for the CRT shader.
 * Boundary-only ShapeGeometry — fine for masks, not for vertex bulge.
 */
export function roundedPlane(
  width: number,
  height: number,
  radius: number,
  curveSegments = 10
): THREE.BufferGeometry {
  const shape = roundedRectShape(width, height, radius);
  const geo = new THREE.ShapeGeometry(shape, curveSegments);
  const pos = geo.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = pos.getX(i) / width + 0.5;
    uvs[i * 2 + 1] = pos.getY(i) / height + 0.5;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Pull a point onto a rounded-rect boundary (keeps interior points). */
export function clampToRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): [number, number] {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw, hh);
  let px = Math.max(-hw, Math.min(hw, x));
  let py = Math.max(-hh, Math.min(hh, y));
  const ix = hw - r;
  const iy = hh - r;
  const ax = Math.abs(px);
  const ay = Math.abs(py);
  if (ax > ix && ay > iy) {
    const cx = px < 0 ? -ix : ix;
    const cy = py < 0 ? -iy : iy;
    const dx = px - cx;
    const dy = py - cy;
    const len = Math.hypot(dx, dy);
    if (len > r && len > 1e-8) {
      const s = r / len;
      px = cx + dx * s;
      py = cy + dy * s;
    }
  }
  return [px, py];
}

/**
 * Subdivided rounded CRT glass: interior verts for the tube dome, outline
 * matches the hollow bezel aperture so corners don't go square.
 */
export function crtGlassPlane(
  width: number,
  height: number,
  radius: number,
  segX = 24,
  segY = 16,
  bakeCurvature = 0.55
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  // Scale dome with the short side — fixed absolute rise made preview tubes look bubbly
  const bulgeAmt = Math.min(width, height) * bakeCurvature * 0.14;
  for (let i = 0; i < pos.count; i++) {
    const [x, y] = clampToRoundedRect(
      pos.getX(i),
      pos.getY(i),
      width,
      height,
      radius
    );
    pos.setX(i, x);
    pos.setY(i, y);

    const u = uv.getX(i);
    const v = uv.getY(i);
    const cx = (u - 0.5) * 2;
    const cy = (v - 0.5) * 2;
    const edge = Math.max(Math.abs(cx), Math.abs(cy));
    const bulge = (1 - edge * edge) * bulgeAmt;
    pos.setZ(i, bulge);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Bezel lip with a cutout. Glass sits in the opening so angled views
 * do not show a solid black face as fake letterbox bars.
 */
export function roundedFrame(
  width: number,
  height: number,
  depth: number,
  radius: number,
  rim: number,
  segments = 10
): THREE.BufferGeometry {
  const outerR = Math.min(radius, width / 2, height / 2);
  const innerW = Math.max(0.02, width - rim * 2);
  const innerH = Math.max(0.02, height - rim * 2);
  // Match glass corner radius closely so the aperture reads as one continuous tube lip
  const innerR = Math.max(
    0.004,
    Math.min(outerR * 0.92, innerW / 2 - 0.001, innerH / 2 - 0.001)
  );

  const shape = roundedRectShape(width, height, outerR);
  // Dense hole outline — sparse arcs caused faceted “steps” on the lip
  const holePts = roundedRectShape(innerW, innerH, innerR).getPoints(
    Math.max(48, segments * 8)
  );
  const hole = new THREE.Path();
  for (let i = holePts.length - 1; i >= 0; i--) {
    const p = holePts[i];
    if (i === holePts.length - 1) hole.moveTo(p.x, p.y);
    else hole.lineTo(p.x, p.y);
  }
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: Math.max(8, segments),
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Inner aperture radius used by {@link roundedFrame} — keep glass in sync. */
export function crtApertureRadius(
  outerW: number,
  outerH: number,
  bezelR: number,
  rim: number
): number {
  const innerW = Math.max(0.02, outerW - rim * 2);
  const innerH = Math.max(0.02, outerH - rim * 2);
  const outerR = Math.min(bezelR, outerW / 2, outerH / 2);
  return Math.max(
    0.004,
    Math.min(outerR * 0.92, innerW / 2 - 0.001, innerH / 2 - 0.001)
  );
}

export function namedMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position?: [number, number, number]
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (position) mesh.position.set(...position);
  return mesh;
}

export function namedGroup(name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  return g;
}
