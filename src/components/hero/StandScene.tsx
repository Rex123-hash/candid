"use client";

import { ContactShadows, Environment, Float, Lightformer, OrbitControls, RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3, type Group, type Mesh } from "three";

export type SceneItemId = "eggs" | "honey" | "sunflowers" | "tomatoes";

type Props = {
  onPick: (id: SceneItemId) => void;
  highlight: SceneItemId | null;
  onHover: (id: SceneItemId | null) => void;
  reducedMotion: boolean;
};

const WOOD = "#c8996a";
const WOOD_DARK = "#a77a4f";

/**
 * A stylised honesty stand, built from primitives so it loads instantly with no
 * model files. Hovering an item sweeps a "scan" ring over it; clicking adds it to
 * the receipt beside the scene. Every interaction also exists as a normal button
 * outside the canvas for keyboard and screen-reader users.
 */
export default function StandScene({ onPick, highlight, onHover, reducedMotion }: Props) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Stop rendering when the hero scrolls out of view, to save battery.
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapper} className="scene" aria-hidden="true" data-cursor="Drag · Tap to scan">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: [3.3, 2.6, 5.3], fov: 33 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => onHover(null)}
      >
        <CameraFit />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2.2} position={[0, 5, -4]} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffe2b0" position={[-5, 2, 2]} scale={[4, 4, 1]} />
          <Lightformer form="ring" intensity={0.8} position={[4, 3, 4]} scale={2} />
        </Environment>

        <ParallaxRig reducedMotion={reducedMotion}>
        <group position={[0.45, -0.75, 0]} scale={1.05}>
          <Stand />
          {!reducedMotion ? <ScanBeam /> : null}
          <Sparkles count={40} scale={[4, 2, 2]} position={[0, 1.4, 0]} size={2.2} speed={reducedMotion ? 0 : 0.35} color="#f5a524" opacity={0.55} />
          <Pickable id="eggs" position={[-1.05, 0.62, 0.15]} {...{ onPick, onHover, highlight, reducedMotion }}>
            <EggCarton />
          </Pickable>
          <Pickable id="honey" position={[-0.1, 0.62, 0.25]} {...{ onPick, onHover, highlight, reducedMotion }}>
            <HoneyJars />
          </Pickable>
          <Pickable id="tomatoes" position={[0.85, 0.62, 0.2]} {...{ onPick, onHover, highlight, reducedMotion }}>
            <TomatoPunnet />
          </Pickable>
          <Pickable id="sunflowers" position={[1.25, 0.62, -0.5]} {...{ onPick, onHover, highlight, reducedMotion }}>
            <Sunflowers />
          </Pickable>
          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={9} blur={2.6} far={3} />
        </group>
        </ParallaxRig>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
          minAzimuthAngle={-Math.PI / 3}
          maxAzimuthAngle={Math.PI / 3}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
}

/** Pulls the camera back on tall, narrow canvases so the whole stand stays in frame. */
function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const distance = 5.4 * Math.max(1, 1.2 / aspect);
    const dir = new Vector3(3.3, 2.6, 5.3).normalize();
    camera.position.copy(dir.multiplyScalar(distance));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Leans the whole stand gently toward the pointer for a sense of depth. */
function ParallaxRig({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  const rig = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!rig.current || reducedMotion) return;
    const k = Math.min(1, delta * 3);
    rig.current.rotation.y += (state.pointer.x * 0.25 - rig.current.rotation.y) * k;
    rig.current.rotation.x += (-state.pointer.y * 0.08 - rig.current.rotation.x) * k;
  });
  return <group ref={rig}>{children}</group>;
}

/** A translucent amber plane that sweeps across the stand like a camera scan. */
function ScanBeam() {
  const beam = useRef<Mesh>(null);
  useFrame((state) => {
    if (!beam.current) return;
    const t = (state.clock.elapsedTime % 4) / 4;
    beam.current.position.x = -1.9 + t * 3.8;
    const material = beam.current.material as { opacity: number };
    material.opacity = Math.sin(t * Math.PI) * 0.22;
  });
  return (
    <mesh ref={beam} position={[0, 1.05, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[1.7, 1]} />
      <meshBasicMaterial color="#f5a524" transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Stand() {
  return (
    <group>
      {/* tabletop */}
      <RoundedBox args={[3.4, 0.12, 1.5]} radius={0.04} position={[0, 0.56, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.75} />
      </RoundedBox>
      {/* legs */}
      {[
        [-1.55, 0.25, 0.62],
        [1.55, 0.25, 0.62],
        [-1.55, 0.25, -0.62],
        [1.55, 0.25, -0.62],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.1, 0.62, 0.1]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
        </mesh>
      ))}
      {/* back board with the QR sign */}
      <RoundedBox args={[1.2, 0.9, 0.06]} radius={0.03} position={[-0.3, 1.25, -0.68]} castShadow>
        <meshStandardMaterial color="#fbf8f1" roughness={0.9} />
      </RoundedBox>
      <QrPattern position={[-0.3, 1.27, -0.645]} />
      <mesh position={[-0.3, 0.75, -0.68]}>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
    </group>
  );
}

/** A stylised QR code: a fixed pseudo-random grid of dark squares. */
function QrPattern({ position }: { position: [number, number, number] }) {
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < 11; x++) for (let y = 0; y < 11; y++) {
      const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
      if (finder ? !(x % 10 === 1 && y % 10 === 1) : rand() > 0.55) out.push([x, y]);
    }
    return out;
  }, []);
  const size = 0.055;
  return (
    <group position={position}>
      {cells.map(([x, y]) => (
        <mesh key={`${x}-${y}`} position={[(x - 5) * size, (5 - y) * size, 0]}>
          <planeGeometry args={[size * 0.92, size * 0.92]} />
          <meshBasicMaterial color="#16130f" />
        </mesh>
      ))}
    </group>
  );
}

function Pickable({
  id,
  position,
  children,
  onPick,
  onHover,
  highlight,
  reducedMotion,
}: Props & { id: SceneItemId; position: [number, number, number]; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const active = highlight === id;

  useFrame((state, delta) => {
    if (!group.current || !ring.current) return;
    const targetY = active ? 0.12 : 0;
    group.current.position.y += (targetY - group.current.position.y) * Math.min(1, delta * 10);
    const t = state.clock.elapsedTime;
    ring.current.visible = active;
    ring.current.position.y = reducedMotion ? 0.25 : 0.05 + ((Math.sin(t * 3) + 1) / 2) * 0.55;
  });

  return (
    <group position={position}>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(id);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onPick(id);
        }}
      >
        {reducedMotion ? children : <Float speed={1.4} rotationIntensity={0.08} floatIntensity={0.12}>{children}</Float>}
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.42, 0.012, 12, 64]} />
        <meshBasicMaterial color="#f5a524" toneMapped={false} />
      </mesh>
    </group>
  );
}

function EggCarton() {
  return (
    <group>
      <RoundedBox args={[0.78, 0.14, 0.4]} radius={0.03} position={[0, 0.07, 0]} castShadow>
        <meshStandardMaterial color="#cdbfa9" roughness={1} />
      </RoundedBox>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-0.26 + (i % 3) * 0.26, 0.19, i < 3 ? -0.09 : 0.09]} scale={[0.085, 0.11, 0.085]} castShadow>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color={i % 2 ? "#e7c9a1" : "#d9a979"} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function HoneyJars() {
  return (
    <group>
      {[-0.17, 0.17].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.17, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.32, 32]} />
            <meshPhysicalMaterial color="#f5a524" roughness={0.08} transmission={0.55} thickness={0.4} ior={1.45} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.135, 0.135, 0.06, 32]} />
            <meshStandardMaterial color="#16130f" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function TomatoPunnet() {
  const tomatoes: [number, number, number, string][] = [
    [-0.12, 0.17, -0.06, "#d6402a"],
    [0.1, 0.17, -0.07, "#e8742a"],
    [-0.02, 0.17, 0.09, "#c9361d"],
    [0.0, 0.29, -0.01, "#f0a73a"],
  ];
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.5, 0.14, 0.4]} />
        <meshStandardMaterial color="#e9dcc3" roughness={1} />
      </mesh>
      {tomatoes.map(([x, y, z, color]) => (
        <mesh key={`${x}${z}`} position={[x, y, z]} castShadow>
          <sphereGeometry args={[0.11, 24, 24]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Sunflowers() {
  const heads: [number, number, number][] = [
    [0, 0.95, 0],
    [-0.16, 0.82, 0.06],
    [0.15, 0.86, -0.05],
  ];
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.4, 24]} />
        <meshStandardMaterial color="#e8e2d6" roughness={0.9} />
      </mesh>
      {heads.map(([x, y, z]) => (
        <group key={`${x}${z}`}>
          <mesh position={[x * 0.5, y / 2, z * 0.5]}>
            <cylinderGeometry args={[0.012, 0.012, y, 8]} />
            <meshStandardMaterial color="#6b7f3a" />
          </mesh>
          <group position={[x, y, z]} rotation={[0.35, 0, x * 2]}>
            <mesh>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
              <meshStandardMaterial color="#f5b81f" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.015, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.025, 24]} />
              <meshStandardMaterial color="#5a3a1c" roughness={0.9} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
