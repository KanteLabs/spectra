import * as THREE from "three";

function makeCanvas(w = 640, h = 480): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export type ProceduralClip = {
  texture: THREE.CanvasTexture;
  update?: (t: number) => void;
  dispose: () => void;
};

export function createSmptePattern(): ProceduralClip {
  const canvas = makeCanvas();
  const ctx = canvas.getContext("2d")!;
  const bars = [
    "#c0c0c0",
    "#c0c000",
    "#00c0c0",
    "#00c000",
    "#c000c0",
    "#c00000",
    "#0000c0",
  ];
  const bw = canvas.width / bars.length;
  bars.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * bw, 0, bw, canvas.height * 0.7);
  });
  const lower = ["#0000c0", "#ffffff", "#c000c0", "#000000", "#c0c0c0", "#000000"];
  const lw = canvas.width / lower.length;
  lower.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * lw, canvas.height * 0.7, lw, canvas.height * 0.3);
  });
  ctx.fillStyle = "#111";
  ctx.font = "28px monospace";
  ctx.fillText("NORDMENDE SPECTRA · TEST", 40, canvas.height * 0.55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, dispose: () => texture.dispose() };
}

export function createBroadcastSimulation(): ProceduralClip {
  const canvas = makeCanvas(480, 360);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    update: (t: number) => {
      ctx.fillStyle = "#1a2840";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#2d5a27";
      ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
      ctx.fillStyle = "#87a0c0";
      ctx.beginPath();
      ctx.arc(80 + Math.sin(t * 0.2) * 20, 80, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c4121a";
      ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
      ctx.fillStyle = "#fff";
      ctx.font = "20px monospace";
      const msg = "  ·  SPECTRA COLOR STUDIO 1973  ·  MULTIVIEW BROADCAST  ·  ";
      const x = ((t * 60) % (msg.length * 12)) - msg.length * 6;
      ctx.fillText(msg + msg, -x, canvas.height - 14);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(canvas.width - 70, 12, 58, 24);
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      ctx.fillText("CH 7", canvas.width - 58, 30);
      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

export function createStaticSnow(): ProceduralClip {
  const canvas = makeCanvas(320, 240);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);

  // Reuse one ImageData and scroll a prebuilt noise pool through it: a native
  // typed-array copy per frame instead of ~77k Math.random() calls + a 300KB
  // allocation that the GC then has to reclaim 60x a second.
  const frame = ctx.createImageData(canvas.width, canvas.height);
  const frameBytes = frame.data.length;
  const pool = new Uint8ClampedArray(frameBytes * 2);
  for (let i = 0; i < pool.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    pool[i] = n;
    pool[i + 1] = n;
    pool[i + 2] = n;
    pool[i + 3] = 255;
  }

  return {
    texture,
    update: () => {
      // Pixel-aligned offset so RGBA channels stay in phase
      const offset = ((Math.random() * (frameBytes / 4)) | 0) * 4;
      frame.data.set(pool.subarray(offset, offset + frameBytes));
      ctx.putImageData(frame, 0, 0);
      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

export function createArchivalStill(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#8a6a4a");
  g.addColorStop(1, "#3a2a1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e8dcc8";
  ctx.beginPath();
  ctx.moveTo(220, 320);
  ctx.lineTo(320, 140);
  ctx.lineTo(420, 320);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(300, 240, 40, 80);
  ctx.fillStyle = "#c06080";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(180 + i * 25, 340 + Math.sin(i) * 10, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = "22px serif";
  ctx.fillText("Archival · 1973", 40, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, dispose: () => texture.dispose() };
}

/**
 * Moire / interference — two ring lattices whose phase drift produces
 * crawling beat patterns. Low-res buffer, reused ImageData + axis terms.
 */
export function createMoireInterference(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const lowW = 160;
  const lowH = 120;
  const field = document.createElement("canvas");
  field.width = lowW;
  field.height = lowH;
  const fieldCtx = field.getContext("2d")!;
  const pixels = fieldCtx.createImageData(lowW, lowH);
  const data = pixels.data;
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  // Precompute pixel coords relative to two drifting centres
  const xs = new Float32Array(lowW);
  const ys = new Float32Array(lowH);
  for (let x = 0; x < lowW; x++) xs[x] = x;
  for (let y = 0; y < lowH; y++) ys[y] = y;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;

      const cx1 = lowW * 0.38 + Math.sin(t * 0.35) * lowW * 0.12;
      const cy1 = lowH * 0.42 + Math.cos(t * 0.28) * lowH * 0.1;
      const cx2 = lowW * 0.62 + Math.cos(t * 0.31) * lowW * 0.11;
      const cy2 = lowH * 0.55 + Math.sin(t * 0.41) * lowH * 0.09;
      const freq1 = 0.42 + Math.sin(t * 0.15) * 0.04;
      const freq2 = 0.47 + Math.cos(t * 0.19) * 0.05;
      const phase1 = t * 1.1;
      const phase2 = t * -0.85;

      for (let y = 0; y < lowH; y++) {
        const py = ys[y];
        for (let x = 0; x < lowW; x++) {
          const px = xs[x];
          const dx1 = px - cx1;
          const dy1 = py - cy1;
          const dx2 = px - cx2;
          const dy2 = py - cy2;
          const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
          const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          const a = Math.sin(r1 * freq1 + phase1);
          const b = Math.sin(r2 * freq2 + phase2);
          // Beat + a soft diagonal carrier for extra crawl
          const beat = a * b;
          const diag = Math.sin((px + py) * 0.08 + t * 0.6) * 0.25;
          const n = (beat + diag + 1.25) * 0.4;
          const i = (y * lowW + x) * 4;
          data[i] = 20 + n * 200;
          data[i + 1] = 30 + n * 160;
          data[i + 2] = 55 + n * 200;
        }
      }
      fieldCtx.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(field, 0, 0, w, h);

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(20, 18, 168, 40);
      ctx.fillStyle = "#a8c8ff";
      ctx.font = "14px monospace";
      ctx.fillText("INTERFER  ·  LIVE", 36, 44);
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, h - 48, w, 48);
      ctx.fillStyle = "#e8f0ff";
      ctx.font = "bold 20px monospace";
      ctx.fillText("MOIRÉ  ·  INTERFERENZ 73", 24, h - 18);

      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/** Analog-computer Rechnergrafik — generative field + Lissajous traces. */
export function createGeneratorGraphic(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const lowW = 160;
  const lowH = 120;
  const field = document.createElement("canvas");
  field.width = lowW;
  field.height = lowH;
  const fieldCtx = field.getContext("2d")!;
  const plasma = fieldCtx.createImageData(lowW, lowH);
  const data = plasma.data;
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const colTerm = new Float32Array(lowW);
  const rowTerm = new Float32Array(lowH);
  const traces: Array<[number, number, number, string]> = [
    [3, 2, 0.0, "rgba(80,255,180,0.85)"],
    [4, 3, 0.7, "rgba(255,90,160,0.7)"],
    [5, 4, 1.4, "rgba(255,210,80,0.65)"],
  ];

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;

      for (let x = 0; x < lowW; x++) {
        colTerm[x] =
          Math.sin(x * 0.11 + t * 0.7) + Math.sin(x * 0.037 - t * 0.33);
      }
      for (let y = 0; y < lowH; y++) {
        rowTerm[y] =
          Math.sin(y * 0.09 - t * 0.55) + Math.sin(y * 0.021 + t * 0.19);
      }
      for (let y = 0; y < lowH; y++) {
        const ry = rowTerm[y];
        for (let x = 0; x < lowW; x++) {
          const v =
            colTerm[x] +
            ry +
            Math.sin((x * 0.4 + y * 0.35) * 0.08 + t * 0.45);
          const n = (v + 4) * 0.125;
          const i = (y * lowW + x) * 4;
          data[i] = 18 + n * 210;
          data[i + 1] = 8 + n * 70;
          data[i + 2] = 40 + n * 180;
        }
      }
      fieldCtx.putImageData(plasma, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(field, 0, 0, w, h);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      for (const [a, b, phase, color] of traces) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        const steps = 180;
        for (let i = 0; i <= steps; i++) {
          const u = (i / steps) * Math.PI * 2;
          const x =
            w * 0.5 + Math.sin(a * u + t * 0.6 + phase) * w * 0.32;
          const y =
            h * 0.46 + Math.sin(b * u + t * 0.47) * h * 0.28;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, h - 56, w, 56);
      ctx.fillStyle = "#f0e6d4";
      ctx.font = "bold 22px monospace";
      ctx.fillText("RECHNERGRAFIK  ·  GENERATOR 73", 24, h - 22);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(20, 18, 148, 44);
      ctx.fillStyle = "#7dffc4";
      ctx.font = "14px monospace";
      ctx.fillText("PROC  ·  LIVE", 36, 46);

      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/** Simple sports field with a bouncing ball. */
export function createSportsPitch(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#2d6b2d";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, w - 80, h - 80);
      ctx.beginPath();
      ctx.moveTo(w / 2, 40);
      ctx.lineTo(w / 2, h - 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 50, 0, Math.PI * 2);
      ctx.stroke();
      // Ball
      const bx = w * 0.5 + Math.sin(t * 1.4) * 180;
      const by = h * 0.5 + Math.cos(t * 1.1) * 90;
      ctx.fillStyle = "#f0f0f0";
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(w - 100, 16, 84, 28);
      ctx.fillStyle = "#fff";
      ctx.font = "14px monospace";
      ctx.fillText("SPORT  ·  LIVE", w - 92, 36);
      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/** Abstract variety / music show with pulsing color bars. */
export function createVarietyShow(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#120818";
      ctx.fillRect(0, 0, w, h);
      const colors = ["#c4121a", "#e8a020", "#2ecc40", "#3d7eff", "#c000c0"];
      for (let i = 0; i < 12; i++) {
        const barH = 40 + Math.abs(Math.sin(t * 3 + i * 0.7)) * (h * 0.45);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(30 + i * 50, h - 80 - barH, 36, barH);
      }
      // Spotlight
      const gx = w * 0.5 + Math.sin(t) * 80;
      const grad = ctx.createRadialGradient(gx, h * 0.35, 10, gx, h * 0.35, 160);
      grad.addColorStop(0, "rgba(255,240,200,0.35)");
      grad.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c4121a";
      ctx.fillRect(0, h - 48, w, 48);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("MUSIKLADEN  ·  COLOR STUDIO", 24, h - 18);
      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/** Perspective starfield flying toward the viewer. */
export function createStarfieldTunnel(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const COUNT = 420;
  const sx = new Float32Array(COUNT);
  const sy = new Float32Array(COUNT);
  const sz = new Float32Array(COUNT);
  const spawn = (i: number) => {
    sx[i] = (Math.random() - 0.5) * 2.4;
    sy[i] = (Math.random() - 0.5) * 1.8;
    sz[i] = Math.random() * 3.2 + 0.4;
  };
  for (let i = 0; i < COUNT; i++) spawn(i);

  // Baked vignette — avoid createRadialGradient every frame
  const vig = document.createElement("canvas");
  vig.width = canvas.width;
  vig.height = canvas.height;
  const vigCtx = vig.getContext("2d")!;
  const grad = vigCtx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    40,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.55
  );
  grad.addColorStop(0, "rgba(20,40,80,0.35)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  vigCtx.fillStyle = grad;
  vigCtx.fillRect(0, 0, vig.width, vig.height);

  const STAR_FILL = [
    "#3a4a66",
    "#5a6e90",
    "#7a90b8",
    "#9ab0d0",
    "#b8d0f0",
    "#d0e4ff",
    "#e8f2ff",
  ];
  const STREAK = "rgba(180,220,255,0.28)";

  let lastT = 0;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const dt = lastT === 0 ? 0.016 : Math.min(0.05, Math.max(0.001, t - lastT));
      lastT = t;

      ctx.fillStyle = "#05060c";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(vig, 0, 0);

      const cx = w * 0.5;
      const cy = h * 0.5;
      const speed = 0.55 + Math.sin(t * 0.4) * 0.08;
      const focal = Math.min(w, h) * 0.42;

      ctx.strokeStyle = STREAK;
      ctx.lineWidth = 1;

      for (let i = 0; i < COUNT; i++) {
        sz[i] -= speed * dt;
        if (sz[i] <= 0.06) spawn(i);

        const z = sz[i];
        const px = cx + (sx[i] / z) * focal;
        const py = cy + (sy[i] / z) * focal;
        if (px < -4 || px > w + 4 || py < -4 || py > h + 4) continue;

        const bright = Math.max(0.15, 1 - z / 3.4);
        const size = Math.max(1, (1.15 / z) * 1.6);
        const bi = Math.min(STAR_FILL.length - 1, (bright * STAR_FILL.length) | 0);
        ctx.fillStyle = STAR_FILL[bi];
        ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);

        if (z < 1.1) {
          const tx = cx + (sx[i] / (z + 0.12)) * focal;
          const ty = cy + (sy[i] / (z + 0.12)) * focal;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      }

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(20, 18, 168, 40);
      ctx.fillStyle = "#b8d8ff";
      ctx.font = "14px monospace";
      ctx.fillText("TUNNEL  ·  LIVE", 36, 44);
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, h - 48, w, 48);
      ctx.fillStyle = "#e8f0ff";
      ctx.font = "bold 20px monospace";
      ctx.fillText("STERNENTUNNEL  ·  RAUMFAHRT 73", 24, h - 18);

      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/**
 * Brian's Brain cellular automaton — bright firing cells, dying trail.
 * Reseeds when activity collapses so the channel stays alive.
 */
export function createCellularAutomata(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.NearestFilter;

  const gw = 128;
  const gh = 96;
  const field = document.createElement("canvas");
  field.width = gw;
  field.height = gh;
  const fieldCtx = field.getContext("2d")!;
  const pixels = fieldCtx.createImageData(gw, gh);
  const data = pixels.data;
  for (let i = 3; i < data.length; i += 4) data[i] = 255;

  // 0 = off, 1 = on, 2 = dying
  let cur = new Uint8Array(gw * gh);
  let next = new Uint8Array(gw * gh);

  const reseed = () => {
    cur.fill(0);
    for (let i = 0; i < cur.length; i++) {
      if (Math.random() < 0.12) cur[i] = 1;
    }
  };
  reseed();

  let acc = 0;
  let gen = 0;
  let lastT = 0;
  let lastHudGen = -1;
  let hudLabel = "BRAIN  ·  GEN 0000";
  const STEP = 1 / 14;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const dt = lastT === 0 ? STEP : Math.min(0.08, Math.max(0.001, t - lastT));
      lastT = t;
      acc += dt;

      while (acc >= STEP) {
        acc -= STEP;
        gen++;
        let onCount = 0;
        for (let y = 0; y < gh; y++) {
          const y0 = ((y - 1 + gh) % gh) * gw;
          const y1 = y * gw;
          const y2 = ((y + 1) % gh) * gw;
          for (let x = 0; x < gw; x++) {
            const i = y1 + x;
            const s = cur[i];
            if (s === 1) {
              next[i] = 2;
              onCount++;
              continue;
            }
            if (s === 2) {
              next[i] = 0;
              continue;
            }
            const xm = (x - 1 + gw) % gw;
            const xp = (x + 1) % gw;
            const n =
              (cur[y0 + xm] === 1 ? 1 : 0) +
              (cur[y0 + x] === 1 ? 1 : 0) +
              (cur[y0 + xp] === 1 ? 1 : 0) +
              (cur[y1 + xm] === 1 ? 1 : 0) +
              (cur[y1 + xp] === 1 ? 1 : 0) +
              (cur[y2 + xm] === 1 ? 1 : 0) +
              (cur[y2 + x] === 1 ? 1 : 0) +
              (cur[y2 + xp] === 1 ? 1 : 0);
            next[i] = n === 2 ? 1 : 0;
            if (next[i] === 1) onCount++;
          }
        }
        const swap = cur;
        cur = next;
        next = swap;
        if (onCount < 40 || gen % 480 === 0) reseed();
      }

      for (let i = 0; i < cur.length; i++) {
        const o = i * 4;
        const s = cur[i];
        if (s === 1) {
          data[o] = 120;
          data[o + 1] = 255;
          data[o + 2] = 210;
        } else if (s === 2) {
          data[o] = 180;
          data[o + 1] = 40;
          data[o + 2] = 160;
        } else {
          data[o] = 8;
          data[o + 1] = 10;
          data[o + 2] = 18;
        }
      }
      fieldCtx.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(field, 0, 0, w, h);

      if (gen !== lastHudGen) {
        lastHudGen = gen;
        const g = gen % 10000;
        hudLabel =
          "BRAIN  ·  GEN " +
          (g < 10 ? "000" : g < 100 ? "00" : g < 1000 ? "0" : "") +
          g;
      }
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(20, 18, 176, 40);
      ctx.fillStyle = "#7dffc4";
      ctx.font = "14px monospace";
      ctx.fillText(hudLabel, 36, 44);
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(0, h - 48, w, 48);
      ctx.fillStyle = "#f0e6d4";
      ctx.font = "bold 20px monospace";
      ctx.fillText("ZELLAUTOMAT  ·  BRIAN'S BRAIN", 24, h - 18);

      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/** Soft rainbow plasma / station ID card. */
export function createStationId(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  // One reused buffer (a fresh 640x480 ImageData is 1.2MB of garbage per frame)
  // plus per-axis sin terms hoisted out of the inner loop.
  const plasma = ctx.createImageData(canvas.width, canvas.height);
  const plasmaData = plasma.data;
  for (let i = 3; i < plasmaData.length; i += 4) plasmaData[i] = 255;
  const rowTerm = new Float32Array(canvas.height);
  const colTerm = new Float32Array(canvas.width);

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      for (let x = 0; x < w; x += 2) colTerm[x] = Math.sin(x * 0.02 + t);
      for (let y = 0; y < h; y += 2) rowTerm[y] = Math.sin(y * 0.03 - t * 0.7);
      for (let y = 0; y < h; y += 2) {
        const ry = rowTerm[y];
        for (let x = 0; x < w; x += 2) {
          const v = colTerm[x] + ry + Math.sin((x + y) * 0.01 + t * 0.4);
          const n = (v + 3) / 6;
          const i = (y * w + x) * 4;
          plasmaData[i] = 40 + n * 180;
          plasmaData[i + 1] = 30 + n * 100;
          plasmaData[i + 2] = 80 + n * 140;
        }
      }
      ctx.putImageData(plasma, 0, 0);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(w * 0.2, h * 0.38, w * 0.6, 90);
      ctx.fillStyle = "#f0e6d4";
      ctx.font = "bold 36px serif";
      ctx.textAlign = "center";
      ctx.fillText("NORDMENDE", w / 2, h * 0.48);
      ctx.font = "18px sans-serif";
      ctx.fillText("SPECTRA COLOR STUDIO", w / 2, h * 0.55);
      ctx.textAlign = "left";
      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

export function createProceduralById(id: string): ProceduralClip | null {
  switch (id) {
    case "smpte":
      return createSmptePattern();
    case "broadcast":
      return createBroadcastSimulation();
    case "staticSnow":
      return createStaticSnow();
    case "archival":
      return createArchivalStill();
    case "newsroom":
      return createMoireInterference();
    case "weather":
      return createGeneratorGraphic();
    case "starfield":
      return createStarfieldTunnel();
    case "automata":
      return createCellularAutomata();
    case "sports":
      return createSportsPitch();
    case "variety":
      return createVarietyShow();
    case "stationId":
      return createStationId();
    default:
      return null;
  }
}
