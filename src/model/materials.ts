import * as THREE from "three";

function noiseCanvas(size = 64): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 220 + Math.random() * 35;
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

let roughnessNoise: THREE.CanvasTexture | null = null;

function getRoughnessNoise(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (!roughnessNoise) roughnessNoise = noiseCanvas();
  return roughnessNoise;
}

export function createMaterials() {
  const noise = getRoughnessNoise();

  const cabinetPlastic = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#d8d2c6"),
    roughness: 0.55,
    metalness: 0.02,
    roughnessMap: noise ?? undefined,
  });

  const warmGray = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#c9c3b8"),
    roughness: 0.5,
    metalness: 0.03,
  });

  const darkPlastic = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1a1a1c"),
    roughness: 0.7,
    metalness: 0.05,
  });

  const bezel = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0d0d0f"),
    roughness: 0.45,
    metalness: 0.08,
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#e8eef2"),
    roughness: 0.12,
    metalness: 1.0,
  });

  const glossyBlack = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0a0a0c"),
    roughness: 0.18,
    metalness: 0.35,
  });

  const redPlastic = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#c4121a"),
    roughness: 0.25,
    metalness: 0.05,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });

  const smokedGlass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#1a1c20"),
    roughness: 0.08,
    metalness: 0.0,
    transmission: 0.15,
    thickness: 0.02,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#1c1c1c"),
    roughness: 0.95,
    metalness: 0,
  });

  const ventPlastic = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#bdb7ac"),
    roughness: 0.6,
    metalness: 0.04,
  });

  const indicatorGreen = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2ecc40"),
    emissive: new THREE.Color("#145a20"),
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const indicatorOrange = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#ff851b"),
    emissive: new THREE.Color("#7a3a00"),
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const indicatorBlue = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#3d7eff"),
    emissive: new THREE.Color("#1a3a80"),
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });

  const label = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2a2a2a"),
    roughness: 0.8,
    metalness: 0,
  });

  const wire = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#222"),
    roughness: 0.85,
    metalness: 0.1,
  });

  return {
    cabinetPlastic,
    warmGray,
    darkPlastic,
    bezel,
    chrome,
    glossyBlack,
    redPlastic,
    smokedGlass,
    rubber,
    ventPlastic,
    indicatorGreen,
    indicatorOrange,
    indicatorBlue,
    label,
    wire,
  };
}

export type SpectraMaterials = ReturnType<typeof createMaterials>;
