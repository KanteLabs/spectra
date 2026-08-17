export const CRT_VERT_REV = 6;

export const crtVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

uniform float curvature;
uniform float domeScale;

void main() {
  vUv = uv;

  vec3 pos = position;
  float cx = (uv.x - 0.5) * 2.0;
  float cy = (uv.y - 0.5) * 2.0;
  // Extra live dome (tier-driven); domeScale keeps preview tubes mild
  float edge = max(abs(cx), abs(cy));
  float bulge = (1.0 - edge * edge) * curvature * 0.012 * domeScale;
  pos.z += bulge;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  // Tilt normals with the dome so glass specular reads as curved glass
  float nTilt = curvature * 0.28 * domeScale;
  vec3 localN = normalize(vec3(cx * nTilt, cy * nTilt, 1.0));
  vWorldNormal = normalize(mat3(modelMatrix) * localN);
  vViewDir = normalize(cameraPosition - worldPos.xyz);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;
