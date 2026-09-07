// The 3D roll: a cup shaken side-on, lifted away, then the camera swings overhead.
// Loaded on demand from dice-tray.tsx so three.js never lands in the initial bundle.
//
// The dice values are decided before this runs. Each die is placed with the rotation
// that puts its own face up, so the animation cannot disagree with the result.
// Spec and timings: DICE_ANIMATION.md.

import * as THREE from 'three';

import { BEATS, ROLL_3D_MS, SHAKE_CYCLES } from './roll-timing';

export { BEATS, ROLL_3D_MS };

/** BoxGeometry material order is +X -X +Y -Y +Z -Z. Opposite faces sum to seven. */
const FACE_ORDER = [1, 6, 2, 5, 3, 4];

/** Rotation that brings each value's face to point up (+Y). */
const FACE_UP: Record<number, [number, number, number]> = {
  2: [0, 0, 0],
  5: [Math.PI, 0, 0],
  1: [0, 0, Math.PI / 2],
  6: [0, 0, -Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
};

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Quincunx: four corners and one in the middle. */
const SPOTS: [number, number][] = [[-1.15, -1.15], [1.15, -1.15], [0, 0], [-1.15, 1.15], [1.15, 1.15]];

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const span = (now: number, from: number, to: number) => clamp01((now - from) / (to - from));

function pipTexture(value: number, accent: boolean) {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = accent ? '#e94a3c' : '#f1eadf';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = accent ? '#ffffff' : '#242424';
  const a = S * 0.26, b = S * 0.5, c = S * 0.74, r = S * 0.072;
  const spots: [number, number][][] = [
    [], [[b, b]], [[a, a], [c, c]], [[a, a], [b, b], [c, c]],
    [[a, a], [c, a], [a, c], [c, c]], [[a, a], [c, a], [b, b], [a, c], [c, c]],
    [[a, a], [c, a], [a, b], [c, b], [a, c], [c, c]],
  ];
  for (const [x, y] of spots[value]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/** A soft round contact shadow, so things read as sitting on a surface. */
function shadowTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}

export type RollHandle = {
  cancel: () => void;
  finish: () => void;
  /** Render one frame at an explicit time. Only used to inspect the beats. */
  step: (t: number) => void;
};

export function playRoll(opts: {
  canvas: HTMLCanvasElement;
  dice: number[];
  onSettled: () => void;
  /**
   * Where in the timeline to start, in ms. 0 plays the whole roll. BEATS.liftFrom
   * skips the shake and lifts straight away — that is the AI's reveal, whose cup
   * already had its six shakes at the top of the round and has been sitting still
   * ever since. Nothing else changes: the beats keep their absolute times, only
   * less of the timeline is played.
   */
  startAt?: number;
}): RollHandle {
  const { canvas, dice, onSettled, startAt = 0 } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  // The canvas is sized by CSS, and its box is not necessarily final when this
  // runs — fonts and layout can still be settling. Re-read it every frame and
  // only touch the renderer when it actually changed, so the scene is never
  // rendered at an aspect the element does not have.
  let lastW = 0;
  let lastH = 0;
  function fit() {
    const w = canvas.clientWidth || 260;
    const h = canvas.clientHeight || 220;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.2);
  key.position.set(-3.2, 6, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe94a3c, 0.2);
  rim.position.set(4, 2, -3);
  scene.add(rim);

  const shadowMap = shadowTexture();
  const disposables: { dispose: () => void }[] = [shadowMap];

  // ---- dice ----
  const pipTextures = new Map<string, THREE.Texture>();
  const dieMeshes: THREE.Mesh[] = [];
  const dieShadows: THREE.Mesh[] = [];
  const dieGeometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  disposables.push(dieGeometry);

  dice.forEach((value, i) => {
    const materials = FACE_ORDER.map((face) => {
      const accent = face === 1;
      const cacheKey = `${face}-${accent}`;
      let texture = pipTextures.get(cacheKey);
      if (!texture) { texture = pipTexture(face, accent); pipTextures.set(cacheKey, texture); disposables.push(texture); }
      const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.02 });
      disposables.push(material);
      return material;
    });
    const mesh = new THREE.Mesh(dieGeometry, materials);
    const [x, z] = SPOTS[i] ?? [0, 0];
    mesh.position.set(x, 0.46, z);
    const [rx, ry, rz] = FACE_UP[value] ?? [0, 0, 0];
    mesh.rotation.set(rx, ry, rz);
    // A free spin about the WORLD up axis: cosmetic only, it never changes which
    // face is up. rotateY would spin about the die's own axis, which after FACE_UP
    // is not vertical, and would tip the chosen face off the top.
    mesh.rotateOnWorldAxis(WORLD_UP, i * 0.7);
    mesh.visible = false;
    scene.add(mesh);
    dieMeshes.push(mesh);

    const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
    disposables.push(shadowMaterial);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.01, z);
    shadow.visible = false;
    scene.add(shadow);
    dieShadows.push(shadow);
  });

  // ---- cup ----
  const cupGroup = new THREE.Group();
  const cupGeometry = new THREE.CylinderGeometry(1.55, 2.05, 2.5, 40, 1, false);
  const cupMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3f35, roughness: 0.62, metalness: 0.12, side: THREE.DoubleSide });
  disposables.push(cupGeometry, cupMaterial);
  const cup = new THREE.Mesh(cupGeometry, cupMaterial);
  cup.position.y = 1.25;
  cupGroup.add(cup);
  const rimGeometry = new THREE.TorusGeometry(2.05, 0.075, 10, 44);
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7761, roughness: 0.45, metalness: 0.25 });
  disposables.push(rimGeometry, rimMaterial);
  const rimRing = new THREE.Mesh(rimGeometry, rimMaterial);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 0.03;
  cupGroup.add(rimRing);
  scene.add(cupGroup);

  const cupShadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false });
  disposables.push(cupShadowMaterial);
  const cupShadow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), cupShadowMaterial);
  cupShadow.rotation.x = -Math.PI / 2;
  cupShadow.position.y = 0.005;
  scene.add(cupShadow);

  // ---- camera path ----
  const SIDE = new THREE.Vector3(0.5, 2.6, 10.6);
  const TOP = new THREE.Vector3(0, 6.1, 0.02);
  const LOOK_SIDE = new THREE.Vector3(0, 1.1, 0);
  const LOOK_TOP = new THREE.Vector3(0, 0, 0);
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  // Looking straight down, an up vector of +Y is degenerate and lookAt picks an
  // arbitrary roll. Swing the up vector to -Z as well, so the overhead view always
  // lands with world -Z at the top of the screen and the quincunx in the same
  // corners as the CSS grid it hands over to.
  const UP_SIDE = new THREE.Vector3(0, 1, 0);
  const UP_TOP = new THREE.Vector3(0, 0, -1);

  let raf = 0;
  let start = 0;
  let frames = 0;
  let done = false;
  const finishOnce = () => { if (!done) { done = true; onSettled(); } };

  function draw(t: number) {
    fit();
    // camera: swing from the side to overhead, through an arc rather than a straight line
    const swing = easeInOut(span(t, BEATS.swingFrom, BEATS.swingTo));
    camPos.copy(SIDE).lerp(TOP, swing);
    const arc = Math.sin(swing * Math.PI) * 1.4;
    camPos.y += arc;
    camera.position.copy(camPos);
    camera.up.copy(UP_SIDE).lerp(UP_TOP, swing).normalize();
    camera.lookAt(camLook.copy(LOOK_SIDE).lerp(LOOK_TOP, swing));

    // cup: rattle on the table, then lift straight up and fade
    // Every term is a whole number of cycles over the shake window, so at shakeTo
    // the cup is back at rest and simply stops rather than freezing mid-wobble.
    if (t < BEATS.shakeTo) {
      const w = (t / BEATS.shakeTo) * SHAKE_CYCLES * Math.PI * 2;
      cupGroup.position.set(Math.sin(w) * 0.13, Math.abs(Math.sin(w)) * 0.09, Math.sin(w * 2) * 0.09);
      cupGroup.rotation.z = Math.sin(w) * 0.045;
      cupGroup.rotation.x = Math.sin(w * 2) * 0.03;
    } else if (t < BEATS.liftFrom) {
      cupGroup.position.set(0, 0, 0);
      cupGroup.rotation.set(0, 0, 0);
    }
    const lift = easeOut(span(t, BEATS.liftFrom, BEATS.liftTo));
    if (lift > 0) {
      cupGroup.position.y = lift * 7.5;
      cupGroup.rotation.z *= 1 - lift;
      cupGroup.rotation.x *= 1 - lift;
      cupMaterial.opacity = 1 - lift; cupMaterial.transparent = true;
      rimMaterial.opacity = 1 - lift; rimMaterial.transparent = true;
      cupShadowMaterial.opacity = 1 - lift;
      cupGroup.visible = lift < 1;
      cupShadow.visible = lift < 1;
    }

    // dice appear as the cup clears them, with a short settle
    const reveal = span(t, BEATS.liftFrom + 90, BEATS.liftTo + 160);
    dieMeshes.forEach((mesh, i) => {
      const local = clamp01((reveal - i * 0.06) / 0.7);
      mesh.visible = local > 0;
      dieShadows[i].visible = local > 0;
      const settle = easeOut(local);
      mesh.position.y = 0.46 + (1 - settle) * 0.55;
      mesh.scale.setScalar(0.9 + settle * 0.1);
      (dieShadows[i].material as THREE.MeshBasicMaterial).opacity = settle * 0.9;
    });

    renderer.render(scene, camera);
  }

  function frame(now: number) {
    if (!start) start = now;
    frames += 1;
    const t = now - start + startAt;
    draw(t);
    if (t >= BEATS.holdTo) { finishOnce(); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // Two safety nets, both for the case where the browser starves this tab of frames
  // (backgrounded, throttled, low power). A frozen cup is worse than no animation:
  // if nothing has drawn shortly after the start, hand straight over to the flat
  // dice; and whatever happens, never hold the round past the animation's length.
  const stall = window.setTimeout(() => { if (frames === 0) finishOnce(); }, 400);
  const guard = window.setTimeout(finishOnce, BEATS.holdTo - startAt + 300);

  const teardown = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(stall);
    window.clearTimeout(guard);
    disposables.forEach((d) => d.dispose());
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    renderer.dispose();
  };

  return {
    cancel: () => { done = true; teardown(); },
    finish: () => { finishOnce(); teardown(); },
    step: (t: number) => { cancelAnimationFrame(raf); window.clearTimeout(stall); window.clearTimeout(guard); draw(t); },
  };
}
