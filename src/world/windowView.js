import * as THREE from 'three';
import { LAYERS } from '../paint/garden.js';
import { painted } from '../paint/painter.js';

// Each garden layer sits at a real depth behind the glass and the shader casts
// the view ray through it, so the parallax matches the camera's movement.

export { LAYERS };

function texture(source) {
  const map = new THREE.Texture(source);
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) map.flipY = false;
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 8;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.needsUpdate = true;
  return map;
}

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uFar;
  uniform sampler2D uMid;
  uniform sampler2D uNear;
  uniform vec4 uRect[3];   // per layer: depth, width, bottom, top
  uniform vec3 uWind;      // per layer
  uniform vec3 uCentre;    // the glass centre (world)
  uniform vec2 uSkyCentre; // the glass centre seen from the resting camera
  uniform float uNight;
  uniform float uTime;
  uniform float uMotion;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + 1.0), u.x), u.y);
  }

  float cloud(vec2 q, vec2 at, float r) {
    vec2 p = (q - at) / r;
    float d = min(min(length(p - vec2(-1.1, 0.0)), length(p - vec2(0.0, 0.45)) * 0.8),
                  min(length(p - vec2(1.0, 0.1)) * 1.1, length(p - vec2(2.0, -0.1)) * 1.4));
    float body = smoothstep(1.0, 0.82, d) * smoothstep(-0.55, -0.35, p.y);
    return body * mix(0.78, 1.0, smoothstep(-0.4, 0.6, p.y));
  }

  vec4 layer(sampler2D map, vec4 rect, float wind, vec3 dir, float layerNight, vec3 nightTint) {
    float t = rect.x / max(-dir.z, 1e-3);
    vec3 hit = vWorld + dir * t;
    vec2 uv = vec2((hit.x - uCentre.x) / rect.y + 0.5, (hit.y - rect.z) / (rect.w - rect.z));
    float sway = sin(uTime * 0.9 + hit.x * 1.7) + 0.5 * sin(uTime * 1.6 + hit.x * 3.1);
    uv.x += sway * 0.0016 * wind * uMotion * smoothstep(0.1, 0.8, uv.y);
    vec4 c = texture2D(map, uv);
    if (uv.y > 1.0) c.a = 0.0;
    float luma = dot(c.rgb, vec3(0.3, 0.59, 0.11));
    c.rgb = mix(c.rgb, nightTint * (0.75 + 0.5 * luma), layerNight);
    return c;
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    vec2 q = dir.xy / max(-dir.z, 1e-3) - uSkyCentre; // sky coordinates
    float h = (q.y + 0.1) * 8.0; // 0 at the sill, ~0.85 at the top of the screen

    vec3 daySky = mix(vec3(0.78, 0.87, 0.93), vec3(0.3, 0.55, 0.86), smoothstep(0.0, 1.0, h));
    daySky = mix(daySky, vec3(0.97, 0.97, 0.98), cloud(q, vec2(-0.03, -0.012), 0.011));
    daySky = mix(daySky, vec3(0.97, 0.97, 0.98), cloud(q, vec2(0.045, 0.006), 0.008));

    vec3 nightSky = mix(vec3(0.05, 0.08, 0.2), vec3(0.012, 0.022, 0.07), smoothstep(0.0, 1.2, h));
    vec2 p = q * 140.0;
    vec2 cell = floor(p);
    float s = hash(cell);
    vec2 at = cell + 0.2 + 0.6 * vec2(hash(cell + 7.1), hash(cell + 3.7));
    float size = mix(0.06, 0.2, hash(cell + 1.3));
    float star = step(0.8, s) * smoothstep(size, size * 0.3, length(p - at));
    float twinkle = 1.0 - uMotion * step(0.975, s) * 0.45 * (0.5 + 0.5 * sin(uTime * 0.7 + s * 90.0));
    nightSky += star * mix(0.35, 1.0, hash(cell + 5.9)) * twinkle * vec3(0.95, 0.95, 1.0);
    // Left pane: the glass's upper half is above the frame at most aspect ratios.
    vec2 m = q - vec2(-0.0145, -0.02);
    float r = 0.0072;
    float disc = smoothstep(r, r * 0.92, length(m));
    float bite = smoothstep(r * 0.9, r * 0.82, length(m - vec2(-0.0045, 0.0025)));
    nightSky += vec3(1.0, 0.95, 0.82) * disc * (1.0 - bite) * 1.2;
    nightSky += vec3(0.05, 0.065, 0.12) * smoothstep(0.045, 0.0, length(m)) * 0.5; // halo

    vec3 colour = mix(daySky, nightSky, uNight);
    vec4 far = layer(uFar, uRect[0], uWind.x, dir, uNight, vec3(0.05, 0.075, 0.15));
    colour = mix(colour, far.rgb, far.a);
    vec4 mid = layer(uMid, uRect[1], uWind.y, dir, uNight, vec3(0.025, 0.04, 0.09));
    colour = mix(colour, mid.rgb, mid.a);
    vec4 near = layer(uNear, uRect[2], uWind.z, dir, uNight, vec3(0.015, 0.025, 0.06));
    colour = mix(colour, near.rgb, near.a);

    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// `layers` are three canvases or textures (far, mid, near); painted here when
// not given.
export function createWindowView({ width, height, layers } = {}) {
  const [far, mid, near] = (
    layers ?? ['gardenFar', 'gardenMid', 'gardenNear'].map((job) => painted(job, job))
  ).map(texture);
  const uniforms = {
    uFar: { value: far },
    uMid: { value: mid },
    uNear: { value: near },
    uRect: { value: LAYERS.map((l) => new THREE.Vector4(l.depth, l.width, l.bottom, l.top)) },
    uWind: { value: new THREE.Vector3(...LAYERS.map((l) => l.wind)) },
    uCentre: { value: new THREE.Vector3() },
    uSkyCentre: { value: new THREE.Vector2() },
    uNight: { value: 1 },
    uTime: { value: 0 },
    uMotion: { value: 1 },
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader }),
  );
  const centre = new THREE.Vector3();
  return {
    mesh,
    uniforms,
    // Call after the window is placed and whenever the camera's resting
    // position changes, so the sky keeps its stars and moon in the frame.
    setViewOrigin(camera) {
      mesh.getWorldPosition(centre);
      uniforms.uCentre.value.copy(centre);
      const d = centre.clone().sub(camera);
      uniforms.uSkyCentre.value.set(d.x / -d.z, d.y / -d.z);
    },
  };
}
