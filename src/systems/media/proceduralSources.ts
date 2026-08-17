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

/** Evening news desk with talking-head silhouette and lower-third. */
export function createNewsroom(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#1a3050";
      ctx.fillRect(0, 0, w, h);
      // Backdrop panels
      ctx.fillStyle = "#243a5c";
      ctx.fillRect(40, 40, w - 80, h * 0.55);
      ctx.fillStyle = "#c4121a";
      ctx.fillRect(60, 60, 12, h * 0.45);
      // Desk
      ctx.fillStyle = "#3a2a18";
      ctx.fillRect(80, h * 0.62, w - 160, 80);
      // Presenter silhouette (bobbing)
      const bob = Math.sin(t * 2.2) * 3;
      ctx.fillStyle = "#1a1510";
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.48 + bob, 55, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.32 + bob, 32, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      // Lower third
      ctx.fillStyle = "rgba(196,18,26,0.92)";
      ctx.fillRect(0, h - 70, w, 70);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("ABENDSCHAU  ·  BREMEN", 24, h - 38);
      ctx.font = "16px monospace";
      ctx.fillText(
        new Date(1973, 0, 1, 20, Math.floor(t) % 60).toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        w - 120,
        h - 38
      );
      texture.needsUpdate = true;
    },
    dispose: () => texture.dispose(),
  };
}

/** Animated weather map with drifting cloud blobs. */
export function createWeatherMap(): ProceduralClip {
  const canvas = makeCanvas(640, 480);
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return {
    texture,
    update: (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#2a6a3a";
      ctx.fillRect(0, 0, w, h);
      // Simplified "Europe" blobs
      ctx.fillStyle = "#3d8a4a";
      ctx.beginPath();
      ctx.ellipse(w * 0.45, h * 0.5, 180, 140, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a9a5a";
      ctx.beginPath();
      ctx.ellipse(w * 0.55, h * 0.42, 90, 70, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Clouds
      for (let i = 0; i < 5; i++) {
        const cx = ((t * 30 + i * 140) % (w + 100)) - 50;
        const cy = 80 + i * 55 + Math.sin(t + i) * 8;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 40 + i * 4, 18, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 25, cy + 4, 28, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Temp callout
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(20, 20, 160, 64);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px monospace";
      ctx.fillText(`${Math.round(12 + Math.sin(t * 0.3) * 3)}°C`, 36, 62);
      ctx.font = "14px sans-serif";
      ctx.fillText("WETTER · NORD", 36, 78);
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
      return createNewsroom();
    case "weather":
      return createWeatherMap();
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
