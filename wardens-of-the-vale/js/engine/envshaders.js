// Shader materials for the sky dome, water and lava.
import * as THREE from '../lib/three.module.min.js';
import { shared, waterTexture } from './gfx.js';

const NOISE = /* glsl */`
  float vhash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(vhash(i), vhash(i + vec2(1.0, 0.0)), u.x), mix(vhash(i + vec2(0.0, 1.0)), vhash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float vfbm(vec2 p, int oct) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) { if (i >= oct) break; s += vnoise(p) * a; p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
`;
const OUT = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// ---------- sky ----------
export function skyMaterial(lowPower) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uCloudTint: { value: new THREE.Color(1, 1, 1) } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    defines: { CLOUD_OCT: lowPower ? 3 : 5 },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSkyTop, uHorizon, uSunDir, uSunColor, uCloudTint;
      uniform float uTime, uCloud;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uSkyTop, smoothstep(-0.02, 0.5, h));
        float sd = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(sd, 1400.0) * 9.0 + pow(sd, 60.0) * 0.35 + pow(sd, 6.0) * 0.12);
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.1) * 0.9 + vec2(uTime * 0.0045, uTime * 0.002);
          float n = vfbm(uv * 1.3, CLOUD_OCT);
          float cover = smoothstep(0.62 - uCloud * 0.28, 0.9 - uCloud * 0.2, n) * smoothstep(0.0, 0.18, h);
          float lit = smoothstep(0.45, 0.85, vfbm(uv * 1.3 + uSunDir.xz * 0.06, 3));
          vec3 cc = uCloudTint * mix(vec3(0.72, 0.74, 0.8), vec3(1.05), lit) + uSunColor * pow(sd, 5.0) * 0.5;
          col = mix(col, cc, cover * 0.9);
        }
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
      }`,
  });
}

// ---------- water ----------
// Depth comes from a small texture of the terrain heights, so shallows turn
// clear and turquoise, deep water goes dark, and foam laps at the shore.
export function waterMaterial(heightTex, hmap) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uHeight: { value: null }, uWaterTex: { value: null },
    uShallow: { value: new THREE.Color(0x3fa3a0) }, uDeep: { value: new THREE.Color(0x12384f) },
    uHMap: { value: new THREE.Vector4() },
  }]);
  Object.assign(uniforms, shared);
  uniforms.uHeight.value = heightTex;
  uniforms.uWaterTex.value = waterTexture();
  uniforms.uHMap.value.set(hmap.half, hmap.step, hmap.n, 0);
  return new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uHeight, uWaterTex;
      uniform float uTime;
      uniform vec3 uSunDir, uSunColor, uSkyTop, uHorizon, uShallow, uDeep;
      uniform vec4 uHMap;
      varying vec3 vWPos;
      void main() {
        vec2 huv = ((vWPos.xz + uHMap.x) / uHMap.y + 0.5) / uHMap.z;
        float ground = texture2D(uHeight, huv).r * 16.0 - 10.0;
        float depth = vWPos.y - ground;
        if (depth < 0.0) discard;
        vec2 p = vWPos.xz;
        vec3 na = texture2D(uWaterTex, p * 0.045 + uTime * vec2(0.011, 0.007)).xyz * 2.0 - 1.0;
        vec3 nb = texture2D(uWaterTex, p * 0.083 - uTime * vec2(0.006, 0.013)).xyz * 2.0 - 1.0;
        vec3 n = normalize(vec3(na.x + nb.x, (na.z + nb.z) * 2.4, na.y + nb.y));
        vec3 V = normalize(cameraPosition - vWPos);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(uHorizon, uSkyTop, smoothstep(0.0, 0.45, R.y));
        float sr = max(dot(R, uSunDir), 0.0);
        float spec = pow(sr, 260.0) * 5.0 + pow(sr, 30.0) * 0.15;
        vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 6.0, depth));
        base *= 0.62 + 0.38 * max(dot(n, uSunDir), 0.0);
        vec3 col = mix(base, sky, clamp(fres, 0.0, 1.0) * 0.8) + uSunColor * spec;
        float shore = 1.0 - smoothstep(0.0, 0.3, depth);
        float fn = texture2D(uWaterTex, p * 0.21 + vec2(uTime * 0.02, -uTime * 0.015)).a;
        float wave = 0.5 + 0.5 * sin(uTime * 1.3 - depth * 18.0 + fn * 5.0);
        float foam = smoothstep(0.62, 0.85, fn * 0.65 + shore * 0.35 + wave * 0.3) * shore;
        col = mix(col, vec3(0.86, 0.9, 0.9), foam * 0.7);
        float alpha = mix(0.35, 0.9, smoothstep(0.0, 3.0, depth));
        alpha = max(max(alpha, foam * 0.8), min(1.0, fres));
        gl_FragColor = vec4(col, alpha);
        ${OUT}
        #include <fog_fragment>
      }`,
  });
}

// ---------- lava ----------
export function lavaMaterial() {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
  uniforms.uTime = shared.uTime;
  return new THREE.ShaderMaterial({
    uniforms, fog: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec3 vWPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform float uTime;
      varying vec3 vWPos;
      ${NOISE}
      void main() {
        vec2 p = vWPos.xz * 0.32;
        float a = vfbm(p + vec2(uTime * 0.05, uTime * 0.03), 4);
        float b = vfbm(p * 2.3 - uTime * 0.07, 3);
        float crust = smoothstep(0.43, 0.6, a * 0.65 + b * 0.35);
        float pulse = 0.85 + 0.2 * sin(uTime * 1.7 + a * 9.0);
        vec3 hot = mix(vec3(2.2, 0.75, 0.12), vec3(1.4, 0.28, 0.04), b) * pulse;
        vec3 col = mix(hot, vec3(0.1, 0.035, 0.025) + vec3(0.25, 0.05, 0.0) * (1.0 - crust) , crust);
        gl_FragColor = vec4(col, 1.0);
        ${OUT}
        #include <fog_fragment>
      }`,
  });
}
