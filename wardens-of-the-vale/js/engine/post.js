// Optional post-processing for high quality: the scene renders into an HDR,
// multisampled target with depth. Ambient occlusion darkens creases and
// contact points, light shafts stream from the sun past anything in front of
// it, bright areas bloom, and a final pass grades the image and adds a vignette.
import * as THREE from '../lib/three.module.min.js';
import { shared, preset } from './gfx.js';

let enabled = false;
let renderer = null;
let rtScene = null, rtA = null, rtB = null, rtC = null, rtD = null, rtAO = null, rtAO2 = null, rtRay = null, rtRay2 = null;
let w = 1, h = 1, pr = 1;
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let quad, brightMat, blurMat, compMat, aoMat, maskMat, rayMat;
const _sun = new THREE.Vector3();

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export function initPost(r) {
  renderer = r;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uThreshold: { value: 1.35 }, uKnee: { value: 0.6 } },
    vertexShader: VERT, toneMapped: false, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uThreshold, uKnee;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = max(c.r, max(c.g, c.b));
        float k = smoothstep(uThreshold, uThreshold + uKnee, l);
        gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0);
      }`,
  });
  blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: VERT, toneMapped: false, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform vec2 uDir;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
        c += texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
        c += texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
        c += texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
        c += texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  // ambient occlusion from the depth buffer: nearby geometry in front of a
  // surface (along its normal) blocks some of the sky light reaching it
  aoMat = new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uProjScale: { value: new THREE.Vector2() }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.3 }, uIntensity: { value: 1.1 } },
    vertexShader: VERT, toneMapped: false, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tDepth; uniform mat4 uProjInv; uniform vec2 uProjScale, uTexel; uniform float uRadius, uIntensity;
      varying vec2 vUv;
      vec3 viewPos(vec2 uv) {
        float d = texture2D(tDepth, uv).x;
        vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return v.xyz / v.w;
      }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        if (texture2D(tDepth, vUv).x >= 0.99999) { gl_FragColor = vec4(1.0); return; }
        vec3 P = viewPos(vUv);
        vec3 N = normalize(cross(viewPos(vUv + vec2(uTexel.x, 0.0)) - P, viewPos(vUv + vec2(0.0, uTexel.y)) - P));
        if (dot(N, P) > 0.0) N = -N;
        vec2 rad = uProjScale * uRadius / -P.z;
        float ang = hash(gl_FragCoord.xy) * 6.2831;
        float occ = 0.0;
        for (int i = 0; i < 10; i++) {
          float f = (float(i) + 0.5) / 10.0;
          float a = ang + float(i) * 2.39996;
          vec3 v = viewPos(vUv + vec2(cos(a), sin(a)) * rad * f) - P;
          float vv = dot(v, v);
          float range = 1.0 - smoothstep(uRadius, uRadius * 2.5, sqrt(vv));
          occ += max(0.0, dot(v, N) - 0.015 * -P.z) / (vv + 0.02) * range;
        }
        float ao = clamp(1.0 - uIntensity * occ / 10.0, 0.0, 1.0);
        gl_FragColor = vec4(ao, ao, ao, 1.0);
      }`,
  });
  // light shafts: the open sky around the sun, smeared outward from it
  maskMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } },
    vertexShader: VERT, toneMapped: false, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, tDepth; uniform vec2 uSun; uniform float uAspect;
      varying vec2 vUv;
      void main() {
        float sky = step(0.99999, texture2D(tDepth, vUv).x);
        vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
        float near = 1.0 - smoothstep(0.0, 0.45, length(d));
        vec3 c = texture2D(tScene, vUv).rgb;
        gl_FragColor = vec4(min(c, vec3(4.0)) * sky * near * near, 1.0);
      }`,
  });
  rayMat = new THREE.ShaderMaterial({
    uniforms: { tMask: { value: null }, uSun: { value: new THREE.Vector2() } },
    vertexShader: VERT, toneMapped: false, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tMask; uniform vec2 uSun;
      varying vec2 vUv;
      void main() {
        vec2 delta = (vUv - uSun) / 36.0 * 0.92;
        vec2 uv = vUv;
        float decay = 1.0;
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 36; i++) {
          uv -= delta;
          acc += texture2D(tMask, uv).rgb * decay;
          decay *= 0.955;
        }
        gl_FragColor = vec4(acc / 18.0, 1.0);
      }`,
  });
  compMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, uStrength: { value: 0.55 }, tAO: { value: null }, uAO: { value: 0 }, tRays: { value: null }, uRays: { value: 0 }, uRayCol: { value: new THREE.Color() } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, tBloomA, tBloomB, tAO, tRays; uniform float uStrength, uAO, uRays; uniform vec3 uRayCol;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb;
        if (uAO > 0.0) c *= mix(1.0, texture2D(tAO, vUv).r, uAO);
        c += (texture2D(tBloomA, vUv).rgb * 0.7 + texture2D(tBloomB, vUv).rgb) * uStrength;
        if (uRays > 0.0) c += texture2D(tRays, vUv).rgb * uRayCol * uRays;
        // grade: a little more saturation and contrast, warm highlights, cool shadows
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(vec3(0.0), mix(vec3(l), c, 1.12));
        c *= mix(vec3(0.95, 0.98, 1.05), vec3(1.05, 1.0, 0.94), smoothstep(0.05, 0.8, l));
        c = mix(c, c * c * (3.0 - 2.0 * min(c, vec3(1.0))), 0.12);
        vec2 d = vUv - 0.5;
        c *= mix(1.0, 0.72, smoothstep(0.32, 0.95, dot(d, d) * 2.2));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  quad = new THREE.Mesh(geo, compMat);
  quad.frustumCulled = false;
  postScene.add(quad);
}

function makeTargets() {
  // HDR targets need a float color-buffer extension; without it fall back to 8-bit
  const ext = renderer.extensions;
  const type = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
  if (type === THREE.UnsignedByteType) brightMat.uniforms.uThreshold.value = 0.82;
  const opts = { type, depthBuffer: false };
  rtScene = new THREE.WebGLRenderTarget(1, 1, { type, samples: 4 });
  rtScene.depthTexture = new THREE.DepthTexture(1, 1);
  rtA = new THREE.WebGLRenderTarget(1, 1, opts);
  rtB = new THREE.WebGLRenderTarget(1, 1, opts);
  rtC = new THREE.WebGLRenderTarget(1, 1, opts);
  rtD = new THREE.WebGLRenderTarget(1, 1, opts);
  const ldr = { type: THREE.UnsignedByteType, depthBuffer: false };
  rtAO = new THREE.WebGLRenderTarget(1, 1, ldr);
  rtAO2 = new THREE.WebGLRenderTarget(1, 1, ldr);
  rtRay = new THREE.WebGLRenderTarget(1, 1, opts);
  rtRay2 = new THREE.WebGLRenderTarget(1, 1, opts);
}
function disposeTargets() {
  for (const t of [rtScene, rtA, rtB, rtC, rtD, rtAO, rtAO2, rtRay, rtRay2]) t?.dispose();
  rtScene = rtA = rtB = rtC = rtD = rtAO = rtAO2 = rtRay = rtRay2 = null;
}

export function setBloom(on) {
  enabled = !!on;
  if (enabled && !rtScene) { makeTargets(); resizePost(w, h, pr); }
  if (!enabled) disposeTargets();
}
export function bloomOn() { return enabled; }

export function resizePost(width, height, pixelRatio) {
  w = width; h = height; pr = pixelRatio;
  if (!rtScene) return;
  const W = Math.max(1, Math.floor(w * pr)), H = Math.max(1, Math.floor(h * pr));
  rtScene.setSize(W, H);
  rtA.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
  rtB.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
  rtC.setSize(Math.max(1, W >> 3), Math.max(1, H >> 3));
  rtD.setSize(Math.max(1, W >> 3), Math.max(1, H >> 3));
  rtAO.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
  rtAO2.setSize(Math.max(1, W >> 1), Math.max(1, H >> 1));
  rtRay.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2));
  rtRay2.setSize(Math.max(1, W >> 2), Math.max(1, H >> 2));
}

function pass(mat, target) {
  quad.material = mat;
  renderer.setRenderTarget(target);
  renderer.render(postScene, postCam);
}
function blur(src, tmp, dirScale) {
  blurMat.uniforms.tDiffuse.value = src.texture;
  blurMat.uniforms.uDir.value.set(dirScale / src.width, 0);
  pass(blurMat, tmp);
  blurMat.uniforms.tDiffuse.value = tmp.texture;
  blurMat.uniforms.uDir.value.set(0, dirScale / src.height);
  pass(blurMat, src);
}

export function renderFrame(r, scene, camera) {
  if (!enabled || !rtScene) {
    r.setRenderTarget(null);
    r.render(scene, camera);
    return;
  }
  r.setRenderTarget(rtScene);
  r.render(scene, camera);
  const P = preset();
  // ambient occlusion at half resolution, softened with a small blur
  const cu = compMat.uniforms;
  cu.uAO.value = 0;
  if (P.ao) {
    const au = aoMat.uniforms;
    au.tDepth.value = rtScene.depthTexture;
    au.uProjInv.value.copy(camera.projectionMatrixInverse);
    au.uProjScale.value.set(camera.projectionMatrix.elements[0] * 0.5, camera.projectionMatrix.elements[5] * 0.5);
    au.uTexel.value.set(1 / rtAO.width, 1 / rtAO.height);
    pass(aoMat, rtAO);
    blur(rtAO, rtAO2, 1);
    cu.tAO.value = rtAO.texture;
    cu.uAO.value = 0.75;
  }
  // sun shafts when the sun is up and roughly in view
  cu.uRays.value = 0;
  if (P.rays && scene.userData.outdoors !== false) {
    _sun.copy(shared.uSunDir.value).multiplyScalar(300).add(camera.position).project(camera);
    const sunUp = shared.uSunDir.value.y;
    const facing = _sun.z < 1 && Math.abs(_sun.x) < 1.6 && Math.abs(_sun.y) < 1.6;
    if (sunUp > -0.02 && facing) {
      const sx = _sun.x * 0.5 + 0.5, sy = _sun.y * 0.5 + 0.5;
      maskMat.uniforms.tScene.value = rtScene.texture;
      maskMat.uniforms.tDepth.value = rtScene.depthTexture;
      maskMat.uniforms.uSun.value.set(sx, sy);
      maskMat.uniforms.uAspect.value = w / h;
      pass(maskMat, rtRay);
      rayMat.uniforms.tMask.value = rtRay.texture;
      rayMat.uniforms.uSun.value.set(sx, sy);
      pass(rayMat, rtRay2);
      const edge = 1 - Math.min(1, Math.max(0, Math.max(Math.abs(_sun.x), Math.abs(_sun.y)) - 1) / 0.6);
      cu.tRays.value = rtRay2.texture;
      cu.uRays.value = (0.35 + 0.45 * shared.uSunset.value) * Math.min(1, (sunUp + 0.02) * 8) * edge;
      cu.uRayCol.value.copy(shared.uSunColor.value);
    }
  }
  brightMat.uniforms.tDiffuse.value = rtScene.texture;
  pass(brightMat, rtA);
  blur(rtA, rtB, 1);
  // a wider, softer halo from an eighth-resolution copy
  blurMat.uniforms.tDiffuse.value = rtA.texture;
  blurMat.uniforms.uDir.value.set(0, 0);
  pass(blurMat, rtC);
  blur(rtC, rtD, 1.5);
  blur(rtC, rtD, 2.5);
  compMat.uniforms.tScene.value = rtScene.texture;
  compMat.uniforms.tBloomA.value = rtA.texture;
  compMat.uniforms.tBloomB.value = rtC.texture;
  pass(compMat, null);
}
