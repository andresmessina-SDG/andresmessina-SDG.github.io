// Post-processing: tilt-shift blur (miniature look), then a warm paper grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    dir: { value: new THREE.Vector2(1, 0) },
    res: { value: new THREE.Vector2(1, 1) },
    focus: { value: 0.45 },
    band: { value: 0.16 },
    amount: { value: 9 },
  },
  vertexShader: vert,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 dir;
uniform vec2 res;
uniform float focus;
uniform float band;
uniform float amount;
varying vec2 vUv;
void main() {
  float d = abs(vUv.y - focus);
  float r = smoothstep(band, band + 0.32, d) * amount;
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int i = -7; i <= 7; i++) {
    float f = float(i) / 7.0;
    float w = exp(-f * f * 2.5);
    sum += texture2D(tDiffuse, vUv + dir / res * f * r) * w;
    wsum += w;
  }
  gl_FragColor = sum / wsum;
}`,
};

const Grade = {
  uniforms: {
    tDiffuse: { value: null },
    res: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    night: { value: 0 },
  },
  vertexShader: vert,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 res;
uniform float time;
uniform float night;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c *= mix(vec3(1.05, 1.0, 0.92), vec3(0.94, 0.98, 1.08), night);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.1);
  vec2 p = vUv - 0.5;
  float v = smoothstep(0.85, 0.2, length(p * vec2(1.0, 1.2)));
  c *= mix(0.55, 1.0, v);
  float n = fract(sin(dot(floor(vUv * res) + floor(time * 24.0) * 7.13, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * 0.03;
  gl_FragColor = vec4(c, 1.0);
}`,
};

export class Post {
  composer: EffectComposer;
  tiltH: ShaderPass;
  tiltV: ShaderPass;
  grade: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.tiltH = new ShaderPass(TiltShift);
    this.tiltV = new ShaderPass(TiltShift);
    this.tiltV.uniforms.dir.value = new THREE.Vector2(0, 1);
    this.grade = new ShaderPass(Grade);
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number, dpr: number) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    const res = new THREE.Vector2(w * dpr, h * dpr);
    for (const p of [this.tiltH, this.tiltV, this.grade]) p.uniforms.res.value = res.clone();
    const scale = Math.min(1.6, Math.max(0.7, (h * dpr) / 900));
    this.tiltH.uniforms.amount.value = this.tiltV.uniforms.amount.value = 9 * scale;
  }

  set focus(y: number) {
    this.tiltH.uniforms.focus.value = this.tiltV.uniforms.focus.value = y;
  }
  get focus() {
    return this.tiltH.uniforms.focus.value;
  }

  render(time: number, night: number) {
    this.grade.uniforms.time.value = time;
    this.grade.uniforms.night.value = night;
    this.composer.render();
  }
}
