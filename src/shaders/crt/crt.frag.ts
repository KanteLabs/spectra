export const CRT_FRAG_REV = 8;

export const crtFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D sourceTexture;
uniform float curvature;
uniform float scanlineStrength;
uniform float maskStrength;
uniform float noiseStrength;
uniform float colorAmount;
uniform float signalQuality;
uniform float time;
uniform float brightness;
uniform float contrast;
uniform float powerProgress;
uniform float rollOffset;
uniform float syncDrift;
uniform float vignette;
uniform float rgbSeparation;
uniform float interlace;
uniform float softFocus;
uniform float screenOn;
uniform float phosphorGlow;
uniform float phosphorSpread;
uniform float glassSpec;
uniform float maskMode;
uniform float softFocusQuality;
uniform float depthMode;
uniform float depthAmount;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 curveUV(vec2 uv, float amt) {
  vec2 c = uv * 2.0 - 1.0;
  float r2 = c.x * c.x + c.y * c.y;
  // Mild barrel — picture follows the glass dome without hard edge crop
  c *= 1.0 + amt * 0.055 * r2;
  c /= 1.0 + amt * 0.07;
  // Real CRT overscan: scale |c| DOWN so glass edges sample inset texels.
  // (Scale UP was clamping to edge pixels and reading as letterbox bars.)
  c *= 0.96;
  return c * 0.5 + 0.5;
}

vec3 sampleSource(vec2 uv) {
  return texture2D(sourceTexture, clamp(uv, 0.0, 1.0)).rgb;
}

vec2 glassParallax(vec2 uv) {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  vec3 T = cross(vec3(0.0, 1.0, 0.0), N);
  if (dot(T, T) < 1e-4) T = cross(vec3(1.0, 0.0, 0.0), N);
  T = normalize(T);
  vec3 B = cross(N, T);
  float facing = abs(dot(N, V));
  float depth = depthAmount * (0.3 + 0.7 * (1.0 - facing));
  vec2 para = vec2(dot(V, T), -dot(V, B) * 0.45) * depth * 0.07;
  para = clamp(para, vec2(-0.03), vec2(0.03));
  return uv + para;
}

/** Soft beam — 4-tap or 9-tap only (13-tap removed for frame cost). */
vec3 softFocusBlur(vec2 uv, vec3 center, float quality) {
  if (quality < 1.5) {
    vec3 acc = center * 0.4;
    acc += sampleSource(uv + vec2(0.002, 0.0)) * 0.15;
    acc += sampleSource(uv - vec2(0.002, 0.0)) * 0.15;
    acc += sampleSource(uv + vec2(0.0, 0.002)) * 0.15;
    acc += sampleSource(uv - vec2(0.0, 0.002)) * 0.15;
    return acc;
  }
  vec3 acc = center * 0.2;
  acc += sampleSource(uv + vec2(0.0018, 0.0)) * 0.1;
  acc += sampleSource(uv - vec2(0.0018, 0.0)) * 0.1;
  acc += sampleSource(uv + vec2(0.0, 0.0018)) * 0.1;
  acc += sampleSource(uv - vec2(0.0, 0.0018)) * 0.1;
  acc += sampleSource(uv + vec2(0.0014, 0.0014)) * 0.1;
  acc += sampleSource(uv + vec2(-0.0014, 0.0014)) * 0.1;
  acc += sampleSource(uv + vec2(0.0014, -0.0014)) * 0.1;
  acc += sampleSource(uv + vec2(-0.0014, -0.0014)) * 0.1;
  return acc;
}

void main() {
  if (screenOn < 0.01 && powerProgress < 0.01) {
    gl_FragColor = vec4(0.01, 0.01, 0.012, 1.0);
    return;
  }

  // Aperture follows the glass mesh; sampling gets the curved+overscanned UV
  vec2 sampleUv = curveUV(vUv, curvature);
  sampleUv.x += syncDrift * sin(time * 2.1 + sampleUv.y * 40.0);
  sampleUv.y = fract(sampleUv.y + rollOffset * time * 0.15);

  vec2 glassUv = vUv;
  vec2 uv = sampleUv;
  float sep = rgbSeparation;
  float focus = softFocus;
  if (depthMode > 0.5 && depthMode < 1.5 && depthAmount > 0.01) {
    uv = glassParallax(sampleUv);
  } else if (depthMode > 2.5 && depthAmount > 0.01) {
    float radial = length(glassUv - 0.5);
    float boost = depthAmount * radial * 3.5;
    // Slight center emphasis without shrinking off the bezel
    uv = 0.5 + (sampleUv - 0.5) * (1.0 - depthAmount * 0.03);
    sep = sep + depthAmount * 0.006 + boost * 0.012;
    focus = clamp(focus + depthAmount * 0.12 + boost * 0.35, 0.0, 0.7);
  }

  // Physical bezel frames the picture — no shader oval / round-rect crop
  float mask = 1.0;

  float expand = smoothstep(0.0, 0.35, powerProgress);
  float line = exp(-pow((glassUv.y - 0.5) / max(0.002, 0.08 * (1.0 - expand + 0.02)), 2.0));
  float powerFade = mix(line * 1.4, 1.0, smoothstep(0.25, 0.85, powerProgress));

  vec2 uvR = uv + vec2(sep, 0.0);
  vec2 uvB = uv - vec2(sep, 0.0);

  vec3 col;
  if (signalQuality < 0.08) {
    float n = hash(uv * vec2(320.0, 240.0) + time * 12.0);
    col = vec3(n);
  } else if (depthMode > 1.5 && depthMode < 2.5 && depthAmount > 0.01) {
    float stereo = depthAmount * 0.038;
    vec3 left = sampleSource(uv + vec2(-stereo, 0.0));
    vec3 right = sampleSource(uv + vec2(stereo, 0.0));
    col = vec3(left.r, right.g, right.b);
    col = mix(col, vec3(left.r, right.g * 0.92, right.b * 1.05), 0.55);
    if (focus > 0.01 && softFocusQuality > 0.5) {
      vec3 blurred = softFocusBlur(uv, col, softFocusQuality);
      col = mix(col, mix(blurred, col, 0.35), focus * 0.45);
    }
  } else {
    float r = texture2D(sourceTexture, clamp(uvR, 0.0, 1.0)).r;
    float g = texture2D(sourceTexture, clamp(uv, 0.0, 1.0)).g;
    float b = texture2D(sourceTexture, clamp(uvB, 0.0, 1.0)).b;
    col = vec3(r, g, b);
    if (focus > 0.01 && softFocusQuality > 0.5) {
      vec3 blurred = softFocusBlur(uv, col, softFocusQuality);
      col = mix(col, mix(blurred, col, 0.35), focus);
    }
  }

  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, colorAmount);

  col = (col - 0.5) * contrast + 0.5;
  col *= brightness;

  // Scanlines / grille stay on the glass so the tube lattice doesn't slide with parallax
  float scan = sin(glassUv.y * 680.0 * 3.14159) * 0.5 + 0.5;
  col *= 1.0 - scanlineStrength * scan * 0.55;

  // Interlace flicker
  float field = step(0.5, fract(glassUv.y * 240.0 + time * 30.0));
  col *= 1.0 - interlace * 0.08 * field;

  // Shadow mask: simple grille (low) or RGB aperture (med/high)
  if (maskMode > 0.5) {
    float stripe = floor(mod(glassUv.x * 480.0, 3.0));
    vec3 aperture = stripe < 0.5
      ? vec3(1.0, 0.72, 0.72)
      : (stripe < 1.5 ? vec3(0.72, 1.0, 0.72) : vec3(0.72, 0.72, 1.0));
    col *= mix(vec3(1.0), aperture, maskStrength * 0.85);
  } else {
    float grille = sin(glassUv.x * 920.0 * 3.14159) * 0.5 + 0.5;
    col *= 1.0 - maskStrength * grille * 0.25;
  }

  // Phosphor glow — bright cores bloom slightly (esp. useful without post FX)
  if (phosphorGlow > 0.001) {
    float hot = max(0.0, luma - 0.55);
    col += col * hot * phosphorGlow * vec3(0.55, 1.0, 0.45);

    // Ultra: bleed light from neighbours so hot areas halo like real phosphor
    if (phosphorSpread > 0.0001) {
      vec3 ring =
        sampleSource(uv + vec2(phosphorSpread, 0.0)) +
        sampleSource(uv - vec2(phosphorSpread, 0.0)) +
        sampleSource(uv + vec2(0.0, phosphorSpread)) +
        sampleSource(uv - vec2(0.0, phosphorSpread));
      float ringLuma = dot(ring * 0.25, vec3(0.299, 0.587, 0.114));
      col += ring * 0.25 * max(0.0, ringLuma - 0.5) * phosphorGlow * 0.9;
    }
  }

  // Noise / snow
  float noise = hash(uv * 400.0 + fract(time) * 100.0);
  col = mix(col, vec3(noise), noiseStrength * (1.0 - signalQuality * 0.7));

  col *= 0.35 + 0.65 * signalQuality;

  float vig = 1.0 - vignette * length(glassUv - 0.5) * 1.05;
  col *= clamp(vig, 0.15, 1.0);

  float ndotv = abs(dot(normalize(vWorldNormal), normalize(vViewDir)));
  // Keep edge brightness up so top/bottom don't read as letterbox bars
  float angleFalloff = mix(0.82, 1.0, pow(ndotv, 0.55));
  // Soft edge glass — cool, low-contrast fresnel (not a white rim)
  float fresnel = pow(1.0 - ndotv, 4.2) * (0.06 + glassSpec * 0.22);
  col *= angleFalloff;
  col += vec3(0.72, 0.78, 0.88) * fresnel;

  // Soft room reflection streak — wide, dim, view-gated (not a hard white bar)
  if (glassSpec > 0.01) {
    float viewGate = pow(1.0 - ndotv, 1.8);
    float streak = smoothstep(0.55, 0.0, abs(glassUv.x - 0.32)) * glassSpec * 0.055 * viewGate;
    streak *= smoothstep(0.08, 0.35, glassUv.y) * smoothstep(0.92, 0.65, glassUv.y);
    col += vec3(0.85, 0.9, 1.0) * streak;
  }

  col *= powerFade * mask * screenOn;
  col = clamp(col, 0.0, 1.65);

  gl_FragColor = vec4(col, 1.0);
}
`;
