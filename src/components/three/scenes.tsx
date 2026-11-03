import { useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Float, MeshDistortMaterial, OrbitControls, RoundedBox, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/* ── Warehouse: one platform per pavilion, crates stacked by real stock ── */

export type PavilionStack = {
  id: string;
  nome: string;
  total: number;
  produtos: number;
  top: { nome: string; quantidade: number; cor: string }[];
};

const CRATE = 0.46;
const GAP = 0.06;
const GRID = 4;

/** Crate count grows with the square root so a huge pavilion never dwarfs the rest. */
function crateCount(total: number, max: number) {
  if (total <= 0 || max <= 0) return 0;
  return Math.max(1, Math.round((Math.sqrt(total) / Math.sqrt(max)) * GRID * GRID * 3));
}

function Pavilion({
  data,
  x,
  z,
  max,
  active,
  onHover,
  lite,
}: {
  data: PavilionStack;
  x: number;
  z: number;
  max: number;
  active: boolean;
  onHover: (id: string | null) => void;
  lite: boolean;
}) {
  const crates = crateCount(data.total, max);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const born = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => {
    const palette = data.top.length ? data.top.map((t) => new THREE.Color(t.cor || "#3d9a68")) : [new THREE.Color("#3d9a68")];
    const arr = new Float32Array(Math.max(crates, 1) * 3);
    for (let i = 0; i < crates; i++) {
      const c = palette[i % palette.length].clone().offsetHSL(0, -0.08, (((i * 37) % 10) - 5) / 120);
      arr.set([c.r, c.g, c.b], i * 3);
    }
    return arr;
  }, [crates, data.top]);

  useFrame(({ clock }) => {
    const m = mesh.current;
    if (m) {
      if (born.current === null) born.current = clock.elapsedTime;
      const t = lite ? 99 : clock.elapsedTime - born.current;
      for (let i = 0; i < crates; i++) {
        const layer = Math.floor(i / (GRID * GRID));
        const cell = i % (GRID * GRID);
        const cx = (cell % GRID) - (GRID - 1) / 2;
        const cz = Math.floor(cell / GRID) - (GRID - 1) / 2;
        const delay = layer * 0.12 + cell * 0.012 + (x + z + 10) * 0.03 + 0.2;
        const k = Math.min(1, Math.max(0, (t - delay) / 0.55));
        const ease = 1 - Math.pow(1 - k, 3);
        const y = 0.16 + CRATE / 2 + layer * (CRATE + GAP);
        dummy.position.set(cx * (CRATE + GAP), y + (1 - ease) * 2.4, cz * (CRATE + GAP));
        dummy.scale.setScalar(Math.max(0.0001, ease));
        dummy.rotation.y = (1 - ease) * 0.8;
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, active ? 0.9 : 0.18, 0.12);
      ring.current.scale.setScalar(THREE.MathUtils.lerp(ring.current.scale.x, active ? 1.08 : 1, 0.12));
    }
  });

  return (
    <group
      position={[x, 0, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(data.id);
      }}
      onPointerOut={() => onHover(null)}
    >
      <RoundedBox args={[2.5, 0.16, 2.5]} radius={0.06} smoothness={3} position={[0, 0.08, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={active ? "#2c7a52" : "#1d4b36"} roughness={0.55} metalness={0.15} />
      </RoundedBox>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.62, 1.72, 64]} />
        <meshBasicMaterial color="#e0a43a" transparent opacity={0.18} />
      </mesh>
      {crates > 0 ? (
        <instancedMesh ref={mesh} args={[undefined, undefined, crates]} castShadow receiveShadow>
          <boxGeometry args={[CRATE, CRATE, CRATE]}>
            <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
          </boxGeometry>
          <meshStandardMaterial vertexColors roughness={0.45} metalness={0.05} />
        </instancedMesh>
      ) : null}
    </group>
  );
}

/** Pins plain DOM labels over the 3D scene: one projection per frame, no extra React roots. */
function LabelProjector({ anchors, els }: { anchors: THREE.Vector3[]; els: MutableRefObject<(HTMLDivElement | null)[]> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    anchors.forEach((a, i) => {
      const el = els.current[i];
      if (!el) return;
      v.copy(a).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      const scale = THREE.MathUtils.clamp(15 / camera.position.distanceTo(a), 0.62, 1.15);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      el.style.opacity = v.z < 1 ? "1" : "0";
      el.style.zIndex = String(Math.round((1 - v.z) * 1000));
    });
  });
  return null;
}

function FitCamera({ span }: { span: number }) {
  const { camera, size } = useThree();
  useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    // Fit the whole row of pavilions: distance grows with span and with a narrow canvas.
    const dist = Math.max(11, (span * 1.5) / Math.min(1.7, aspect) + 4.5);
    camera.position.set(dist * 0.55, dist * 0.62, dist * 0.7);
    camera.lookAt(0, 0.2, 0);
  }, [camera, size.width, size.height, span]);
  return null;
}

export function WarehouseScene({ pavilions, lite }: { pavilions: PavilionStack[]; lite: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...pavilions.map((p) => p.total));
  const spacing = 3.4;
  // A yard, not a row: a compact grid keeps every pavilion in frame while it turns.
  const cols = Math.max(1, Math.ceil(Math.sqrt(pavilions.length * 1.5)));
  const rows = Math.max(1, Math.ceil(pavilions.length / cols));
  const span = Math.max(cols, rows) * spacing;
  const spots = pavilions.map((p, i) => {
    const x = ((i % cols) - (cols - 1) / 2) * spacing;
    const z = (Math.floor(i / cols) - (rows - 1) / 2) * spacing;
    const height = 0.16 + Math.ceil(crateCount(p.total, max) / (GRID * GRID)) * (CRATE + GAP);
    return { x, z, anchor: new THREE.Vector3(x, height + 0.55, z) };
  });
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <div className="wh-stage">
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 34, near: 0.1, far: 100 }} frameloop={lite ? "demand" : "always"} gl={{ antialias: true, alpha: true }}>
      <FitCamera span={span} />
      <fog attach="fog" args={["#0a1f16", 16, 38]} />
      <hemisphereLight args={["#e9fff2", "#0b2a1d", 0.75]} />
      <directionalLight
        position={[6, 11, 7]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-8, 4, -4]} intensity={18} color="#e0a43a" distance={22} />
      <group>
        {pavilions.map((p, i) => (
          <Pavilion
            key={p.id}
            data={p}
            x={spots[i].x}
            z={spots[i].z}
            max={max}
            active={hover === p.id}
            onHover={setHover}
            lite={lite}
          />
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[Math.max(14, span), 64]} />
        <meshStandardMaterial color="#0f2a1f" roughness={0.9} />
      </mesh>
      <gridHelper args={[60, 60, "#1f4a37", "#163a2b"]} position={[0, 0.001, 0]} />
      <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={span + 10} blur={2.4} far={6} />
      {lite ? null : <Sparkles count={40} scale={[span + 6, 5, 6]} position={[0, 2.5, 0]} size={2.2} speed={0.25} color="#f0c56a" opacity={0.6} />}
      {lite ? null : (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.55} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette offset={0.28} darkness={0.55} />
        </EffectComposer>
      )}
      <OrbitControls enableZoom={false} enablePan={false} autoRotate={!lite && hover === null} autoRotateSpeed={0.6} minPolarAngle={0.55} maxPolarAngle={1.25} target={[0, 0.2, 0]} />
      <LabelProjector anchors={spots.map((s) => s.anchor)} els={labelEls} />
    </Canvas>
    <div className="wh-labels" aria-hidden="true">
      {pavilions.map((data, i) => {
        const active = hover === data.id;
        return (
          <div key={data.id} ref={(el) => { labelEls.current[i] = el; }} className="wh-pin">
            <div className={active ? "wh-label is-active" : "wh-label"}>
              <strong>{data.nome}</strong>
              <span>{data.total.toLocaleString("pt-BR")} vol · {data.produtos} itens</span>
              {active && data.top.length ? (
                <ul>
                  {data.top.slice(0, 3).map((t) => (
                    <li key={t.nome}>
                      <i style={{ background: t.cor }} />
                      {t.nome}
                      <b>{t.quantidade.toLocaleString("pt-BR")}</b>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

/* ── Login: produce floating in a lit, glossy field ── */

const FRUITS: { color: string; r: number; pos: [number, number, number]; leaf?: boolean }[] = [
  { color: "#f28c28", r: 0.62, pos: [-2.6, 1.2, -1], leaf: true },
  { color: "#c8252c", r: 0.55, pos: [2.4, 1.7, -1.6], leaf: true },
  { color: "#8bc34a", r: 0.48, pos: [1.4, -1.5, 0.2], leaf: true },
  { color: "#ffd23f", r: 0.42, pos: [-1.2, -1.8, 0.6] },
  { color: "#6a1b9a", r: 0.36, pos: [3.2, -0.4, 0.4] },
  { color: "#e65100", r: 0.5, pos: [-3.4, -0.6, -2] , leaf: true },
  { color: "#7cb342", r: 0.34, pos: [0.2, 2.3, -2.4] },
];

function Fruit({ color, r, leaf }: { color: string; r: number; leaf?: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[r, 48, 48]} />
        <meshPhysicalMaterial color={color} roughness={0.32} clearcoat={0.8} clearcoatRoughness={0.25} sheen={0.4} sheenColor="#ffffff" />
      </mesh>
      {leaf ? (
        <group position={[0, r * 0.96, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.16, 8]} />
            <meshStandardMaterial color="#5d4037" />
          </mesh>
          <mesh position={[0.13, 0.1, 0]} rotation={[0, 0, -0.9]} scale={[1, 0.35, 0.6]}>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial color="#2e7d32" roughness={0.5} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function Crate({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[1.25, 0.8, 0.85]} radius={0.05} smoothness={3} castShadow>
        <meshStandardMaterial color="#c49a5a" roughness={0.7} />
      </RoundedBox>
      {[-0.22, 0.02, 0.26].map((y) => (
        <mesh key={y} position={[0, y, 0.431]}>
          <boxGeometry args={[1.18, 0.12, 0.02]} />
          <meshStandardMaterial color="#a77b3e" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function PointerRig() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ pointer }) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, pointer.x * 0.35, 0.05);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -pointer.y * 0.18, 0.05);
  });
  return (
    <group ref={group}>
      {FRUITS.map((f, i) => (
        <Float key={i} speed={1.4 + (i % 3) * 0.3} rotationIntensity={0.9} floatIntensity={1.4} position={f.pos}>
          <Fruit color={f.color} r={f.r} leaf={f.leaf} />
        </Float>
      ))}
      <Float speed={1.1} rotationIntensity={0.5} floatIntensity={0.8}>
        <Crate position={[0.1, -0.1, -0.6]} rotation={[0.25, -0.6, 0.08]} />
      </Float>
      <Float speed={0.9} rotationIntensity={0.6} floatIntensity={1}>
        <Crate position={[-2.2, 2.4, -3]} rotation={[-0.3, 0.5, -0.2]} />
      </Float>
    </group>
  );
}

export function ProduceScene({ lite }: { lite: boolean }) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 0, 7.5], fov: 42 }} frameloop={lite ? "demand" : "always"} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} castShadow />
      <pointLight position={[-5, -2, 3]} intensity={30} color="#e0a43a" distance={20} />
      <pointLight position={[5, 3, -2]} intensity={22} color="#5fc58f" distance={20} />
      <PointerRig />
      {lite ? null : <Sparkles count={70} scale={[12, 7, 6]} size={2.4} speed={0.3} color="#f0c56a" opacity={0.7} />}
      <ContactShadows position={[0, -3, 0]} opacity={0.35} scale={14} blur={3} far={5} color="#04120b" />
      {lite ? null : (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.7} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette offset={0.3} darkness={0.5} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

/* ── Radar orb: a living, distorting sphere ── */

function Blob({ lite }: { lite: boolean }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock, pointer }) => {
    if (!mesh.current || lite) return;
    mesh.current.rotation.y = clock.elapsedTime * 0.35 + pointer.x * 0.4;
    mesh.current.rotation.x = pointer.y * 0.3;
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 96, 96]} />
      <MeshDistortMaterial color="#2f9a66" emissive="#0c3322" roughness={0.18} metalness={0.25} distort={lite ? 0.2 : 0.38} speed={lite ? 0 : 2.2} />
    </mesh>
  );
}

export function OrbScene({ lite }: { lite: boolean }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 3.1], fov: 40 }} frameloop={lite ? "demand" : "always"} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 3]} intensity={2.4} />
      <pointLight position={[-3, -2, 2]} intensity={14} color="#e0a43a" />
      <pointLight position={[2, -1, -2]} intensity={10} color="#9ef0c3" />
      <Blob lite={lite} />
    </Canvas>
  );
}
