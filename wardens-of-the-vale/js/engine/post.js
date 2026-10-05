// Optional post-processing for high quality: the scene renders into an HDR,
// multisampled target, bright areas (lava, fire, spells, the sun) are blurred
// into a bloom, and a final pass adds it back with a soft vignette.
import * as THREE from '../lib/three.module.min.js';

let enabled = false;
let renderer = null;
let rtScene = null, rtA = null, rtB = null, rtC = null, rtD = null;
let w = 1, h = 1, pr = 1;
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let quad, brightMat, blurMat, compMat;

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
  compMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: null }, tBloomA: { value: null }, tBloomB: { value: null }, uStrength: { value: 0.55 } },
    vertexShader: VERT, depthTest: false, depthWrite: false,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene, tBloomA, tBloomB; uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb;
        c += (texture2D(tBloomA, vUv).rgb * 0.7 + texture2D(tBloomB, vUv).rgb) * uStrength;
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
  rtA = new THREE.WebGLRenderTarget(1, 1, opts);
  rtB = new THREE.WebGLRenderTarget(1, 1, opts);
  rtC = new THREE.WebGLRenderTarget(1, 1, opts);
  rtD = new THREE.WebGLRenderTarget(1, 1, opts);
}
function disposeTargets() {
  for (const t of [rtScene, rtA, rtB, rtC, rtD]) t?.dispose();
  rtScene = rtA = rtB = rtC = rtD = null;
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
