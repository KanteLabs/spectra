/**
 * Exports the procedural Spectra model hierarchy to a GLB.
 * Run: npm run export:glb
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// Minimal FileReader polyfill for three's GLTFExporter under Node
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    onerror = null;
    readAsDataURL(blob) {
      Promise.resolve(blob)
        .then(async (b) => {
          if (b && typeof b.arrayBuffer === "function") {
            const buf = Buffer.from(await b.arrayBuffer());
            this.result = `data:application/octet-stream;base64,${buf.toString("base64")}`;
          } else {
            this.result = "data:application/octet-stream;base64,";
          }
          this.onloadend?.({ target: this });
        })
        .catch((err) => this.onerror?.(err));
    }
    readAsArrayBuffer(blob) {
      Promise.resolve(blob)
        .then(async (b) => {
          this.result =
            b && typeof b.arrayBuffer === "function"
              ? await b.arrayBuffer()
              : new ArrayBuffer(0);
          this.onloadend?.({ target: this });
        })
        .catch((err) => this.onerror?.(err));
    }
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function roundedBox(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function buildExportModel() {
  const rootG = new THREE.Group();
  rootG.name = "NordmendeSpectraColorStudio";

  const mats = {
    plastic: new THREE.MeshStandardMaterial({
      color: "#d8d2c6",
      name: "CabinetPlastic",
    }),
    bezel: new THREE.MeshStandardMaterial({ color: "#0d0d0f", name: "Bezel" }),
    chrome: new THREE.MeshStandardMaterial({
      color: "#e8eef2",
      metalness: 1,
      roughness: 0.15,
      name: "Chrome",
    }),
    black: new THREE.MeshStandardMaterial({
      color: "#0a0a0c",
      name: "GlossyBlack",
    }),
    red: new THREE.MeshStandardMaterial({ color: "#c4121a", name: "RedPlastic" }),
    dark: new THREE.MeshStandardMaterial({
      color: "#1a1a1c",
      name: "DarkPlastic",
    }),
  };

  const add = (name, geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    if (pos) m.position.set(...pos);
    rootG.add(m);
    return m;
  };

  add(
    "CircularBase",
    new THREE.CylinderGeometry(0.42, 0.44, 0.05, 48),
    mats.black,
    [0, 0.025, 0]
  );
  add(
    "SupportColumn",
    new THREE.CylinderGeometry(0.045, 0.05, 0.72, 32),
    mats.chrome,
    [0, 0.36, 0]
  );
  add(
    "PedestalMount",
    new THREE.CylinderGeometry(0.08, 0.07, 0.04, 24),
    mats.chrome,
    [0, 0.74, 0]
  );

  const bodyY = 0.78;
  add("MainCabinet", roundedBox(1.05, 0.58, 0.42), mats.plastic, [
    0,
    bodyY + 0.42,
    0,
  ]);
  add("UpperFrontPanel", roundedBox(1.05, 0.58, 0.02), mats.plastic, [
    0,
    bodyY + 0.42,
    0.2,
  ]);
  add("LowerCabinet", roundedBox(1.05, 0.28, 0.42), mats.plastic, [
    0,
    bodyY,
    0,
  ]);
  add("LowerBlackTrim", roundedBox(1.06, 0.035, 0.43), mats.dark, [
    0,
    bodyY - 0.145,
    0,
  ]);
  add("RightVentilationPanel", roundedBox(0.22, 0.52, 0.04), mats.plastic, [
    0.38,
    bodyY + 0.42,
    0.2,
  ]);
  add("MainCRTBezel", roundedBox(0.72, 0.52, 0.06), mats.bezel, [
    -0.12,
    bodyY + 0.42,
    0.2,
  ]);
  add("MainCRTMask", roundedBox(0.64, 0.46, 0.02), mats.dark, [
    -0.12,
    bodyY + 0.42,
    0.225,
  ]);
  add(
    "MainCRTGlass",
    new THREE.PlaneGeometry(0.6, 0.42, 16, 12),
    mats.dark,
    [-0.12, bodyY + 0.42, 0.238]
  );
  add(
    "MainRedKnob",
    new THREE.CylinderGeometry(0.032, 0.035, 0.028, 24),
    mats.red,
    [0.42, bodyY + 0.22, 0.24]
  );

  for (let i = 0; i < 3; i++) {
    const x = -0.36 + i * 0.28;
    const idx = String(i + 1).padStart(2, "0");
    add(`PreviewBezel${idx}`, roundedBox(0.22, 0.16, 0.04), mats.bezel, [
      x,
      bodyY + 0.02,
      0.2,
    ]);
    add(
      `PreviewCRT${idx}`,
      new THREE.PlaneGeometry(0.18, 0.125),
      mats.dark,
      [x, bodyY + 0.02, 0.222]
    );
    add(
      `PreviewButton${idx}`,
      new THREE.CylinderGeometry(0.018, 0.018, 0.014, 16),
      mats.red,
      [x - 0.04, bodyY - 0.08, 0.23]
    );
    add(
      `ChannelMarker${idx}`,
      new THREE.BoxGeometry(0.04, 0.01, 0.006),
      mats.red,
      [x + 0.035, bodyY - 0.08, 0.23]
    );
  }

  add("RightControlAssembly", roundedBox(0.2, 0.26, 0.05), mats.plastic, [
    0.38,
    bodyY + 0.02,
    0.2,
  ]);
  for (let i = 0; i < 6; i++) {
    const idx = String(i + 1).padStart(2, "0");
    const y = bodyY + 0.1 - i * 0.035;
    add(`Slider${idx}`, new THREE.BoxGeometry(0.022, 0.012, 0.014), mats.chrome, [
      0.4,
      y,
      0.238,
    ]);
    add(
      `IndicatorLamp${idx}`,
      new THREE.SphereGeometry(0.006, 8, 8),
      mats.red,
      [0.36, y, 0.232]
    );
  }

  add("RearCabinet", roundedBox(1.0, 0.82, 0.06), mats.dark, [
    0,
    bodyY + 0.22,
    -0.22,
  ]);
  add("RearVentilation", new THREE.BoxGeometry(0.7, 0.35, 0.02), mats.plastic, [
    0,
    bodyY + 0.35,
    -0.255,
  ]);
  add(
    "PowerCable",
    new THREE.CylinderGeometry(0.008, 0.008, 0.5, 8),
    mats.dark,
    [0.5, 0.2, 0]
  );

  return rootG;
}

async function main() {
  const model = buildExportModel();
  const exporter = new GLTFExporter();
  const outDir = join(root, "public", "models");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "nordmende-spectra.glb");

  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      model,
      (result) => resolve(result),
      (err) => reject(err),
      { binary: true }
    );
  });

  writeFileSync(outPath, Buffer.from(arrayBuffer));
  console.log(`Wrote ${outPath} (${Buffer.from(arrayBuffer).length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
