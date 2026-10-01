import { BackSide, CapsuleGeometry, CircleGeometry, DataTexture, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat, Scene, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, type MeshBasicMaterialParameters } from 'three'

// ペラリ（仮）: カードの形をしたマスコット。three.js の基本形状だけで組み立てる（外部モデル不要）。
export function buildMascot() {
  const C = { edge: 0xffc53d, face: 0xfffbf0, back: 0x3e3ab0, ink: 0x1f1b3a, cheek: 0xff9bae, leg: 0xf2a516, gold: 0xffd95a };
  const tones = new Uint8Array([150, 215, 255]);
  const grad = new DataTexture(tones, 3, 1, RedFormat);
  grad.minFilter = NearestFilter; grad.magFilter = NearestFilter; grad.needsUpdate = true;
  const toon = (color: number) => new MeshToonMaterial({ color, gradientMap: grad });
  const flat = (color: number, extra: MeshBasicMaterialParameters = {}) => new MeshBasicMaterial(Object.assign({ color }, extra || {}));
  const outlineMat = new MeshBasicMaterial({ color: C.ink, side: BackSide });

  function rounded(w: number, h: number, r: number) {
    const s = new Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function star(outer: number, inner: number) {
    const s = new Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? inner : outer;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
    }
    s.closePath(); return s;
  }
  function withOutline(mesh: Mesh, k: number) {
    const o = new Mesh(mesh.geometry, outlineMat);
    o.scale.setScalar(k || 1.05); mesh.add(o); return mesh;
  }

  const root = new Group();      // 位置（ジャンプ）
  const spin = new Group();      // 回転（カードめくり）
  const squash = new Group();    // つぶれ・のび
  root.add(spin); spin.add(squash);

  const D = 0.2;
  const bodyGeo = new ExtrudeGeometry(rounded(1.0, 1.3, 0.2), { depth: D, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 5, curveSegments: 16 });
  bodyGeo.center();
  const body = new Mesh(bodyGeo, toon(C.edge));
  const hull = new Mesh(bodyGeo, outlineMat); hull.scale.set(1.045, 1.035, 1.25); body.add(hull);
  squash.add(body);
  const zf = D / 2 + 0.05;
  const plate = new Mesh(new ShapeGeometry(rounded(0.84, 1.14, 0.14), 12), flat(C.face));
  plate.position.z = zf + 0.002; squash.add(plate);
  const backPlate = new Mesh(new ShapeGeometry(rounded(0.84, 1.14, 0.14), 12), toon(C.back));
  backPlate.position.z = -zf - 0.002; backPlate.rotation.y = Math.PI; squash.add(backPlate);
  const bStar = new Mesh(new ShapeGeometry(star(0.26, 0.11)), flat(C.gold));
  bStar.position.z = -zf - 0.006; bStar.rotation.y = Math.PI; squash.add(bStar);
  for (const [x, y, r] of [[-0.26, 0.38, 0.05], [0.28, -0.36, 0.06], [0.24, 0.42, 0.035], [-0.3, -0.4, 0.04]]) {
    const dot = new Mesh(new ShapeGeometry(star(r, r * 0.45)), flat(0xfff1c2));
    dot.position.set(-x, y, -zf - 0.006); dot.rotation.y = Math.PI; squash.add(dot);
  }

  const face = new Group(); face.position.z = zf + 0.01; squash.add(face);
  const eyes: { mesh: Mesh; highlights: Mesh[] }[] = [];
  for (const sx of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.085, 24, 16), toon(C.ink));
    eye.scale.set(1, 1.28, 0.45); eye.position.set(sx * 0.19, 0.12, 0.02); face.add(eye);
    const hi = new Mesh(new CircleGeometry(0.028, 16), flat(0xffffff));
    hi.position.set(sx * 0.19 + 0.028, 0.165, 0.065); face.add(hi);
    const hi2 = new Mesh(new CircleGeometry(0.013, 12), flat(0xffffff));
    hi2.position.set(sx * 0.19 - 0.026, 0.075, 0.065); face.add(hi2);
    eyes.push({ mesh: eye, highlights: [hi, hi2] });
    const cheek = new Mesh(new CircleGeometry(0.075, 24), flat(C.cheek, { transparent: true, opacity: 0.9 }));
    cheek.position.set(sx * 0.33, -0.05, 0.004); cheek.scale.set(1.15, 0.8, 1); face.add(cheek);
  }
  const mouth = new Mesh(new TorusGeometry(0.06, 0.018, 8, 20, Math.PI), toon(C.ink));
  mouth.rotation.z = Math.PI; mouth.position.set(0, -0.02, 0.01); face.add(mouth);
  const open = new Mesh(new CircleGeometry(0.075, 24, Math.PI, Math.PI), flat(0xc2364f));
  open.position.set(0, -0.02, 0.012); open.visible = false; face.add(open);

  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new Group(); pivot.position.set(sx * 0.52, 0.0, 0); squash.add(pivot);
    const arm = withOutline(new Mesh(new CapsuleGeometry(0.075, 0.26, 6, 12), toon(C.leg)), 1.12);
    arm.position.set(0, -0.2, 0); pivot.add(arm);
    pivot.rotation.z = sx * 0.6; arms.push(pivot);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = withOutline(new Mesh(new CapsuleGeometry(0.08, 0.1, 6, 12), toon(C.leg)), 1.12);
    leg.position.set(sx * 0.2, -0.8, 0); squash.add(leg); legs.push(leg);
  }
  const shadow = new Mesh(new CircleGeometry(0.5, 32), flat(0x0b0a2a, { transparent: true, opacity: 0.28 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.98;

  const scene = new Scene();
  scene.add(root, shadow);
  scene.add(new HemisphereLight(0xffffff, 0x8a86d6, 1.1));
  const sun = new DirectionalLight(0xffffff, 2.2); sun.position.set(2.5, 3.5, 4); scene.add(sun);
  return { scene, root, spin, squash, arms, legs, eyes, mouth, open, shadow };
}

// t: 0〜1 のループ位置。anim: 'idle' | 'wave' | 'cheer'
export function poseMascot(m: ReturnType<typeof buildMascot>, anim: 'idle' | 'wave' | 'cheer', t: number, extraYaw: number) {
  const TAU = Math.PI * 2, ease = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  let y = 0, sx = 1, sy = 1, yaw = extraYaw || 0, roll = 0, armL = -0.6, armR = 0.6, blink = 1, mouthOpen = false;
  if (anim === 'idle') {
    y = 0.035 * Math.sin(TAU * t); sy = 1 + 0.025 * Math.sin(TAU * t); sx = 1 - 0.012 * Math.sin(TAU * t);
    roll = 0.03 * Math.sin(TAU * t + 1); armL = -0.6 - 0.08 * Math.sin(TAU * t); armR = -armL;
    if (t > 0.78 && t < 0.84) blink = 0.12;
  } else if (anim === 'wave') {
    y = 0.02 * Math.sin(TAU * t * 2); roll = -0.06 + 0.03 * Math.sin(TAU * t * 2);
    armL = -0.6; armR = 2.5 + 0.4 * Math.sin(TAU * t * 2); mouthOpen = true; yaw += 0.18;
  } else if (anim === 'cheer') {
    if (t < 0.15) { const k = t / 0.15; sy = 1 - 0.16 * k; sx = 1 + 0.1 * k; armL = -0.6 - 0.5 * k; armR = -armL; }
    else if (t < 0.75) {
      const k = (t - 0.15) / 0.6; y = 0.42 * Math.sin(Math.PI * k); yaw += TAU * ease(k);
      sy = 1 + 0.08 * Math.sin(Math.PI * k); sx = 1 - 0.05 * Math.sin(Math.PI * k); armL = -2.5; armR = 2.5; mouthOpen = true;
    } else if (t < 0.87) { const k = (t - 0.75) / 0.12; sy = 1 - 0.14 * Math.sin(Math.PI * k); sx = 1 + 0.09 * Math.sin(Math.PI * k); armL = -2.5 + 1.4 * k; armR = -armL; mouthOpen = true; }
    else { const k = (t - 0.87) / 0.13; armL = -1.1 + 0.5 * k; armR = -armL; mouthOpen = k < 0.5; }
  }
  m.root.position.y = y; m.spin.rotation.y = yaw; m.spin.rotation.z = roll;
  m.squash.scale.set(sx, sy, 1); m.squash.position.y = (sy - 1) * 0.9;
  m.arms[0].rotation.z = armL; m.arms[1].rotation.z = armR;
  m.eyes.forEach(({ mesh, highlights }) => { mesh.scale.y = 1.28 * blink; highlights.forEach(h => { h.visible = blink > 0.5; }); });
  m.mouth.visible = !mouthOpen; m.open.visible = mouthOpen;
  const s = 1 - Math.min(0.45, y * 0.6); m.shadow.scale.set(s, s, s); m.shadow.material.opacity = 0.28 * s;
}
