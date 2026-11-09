"use client";

import { ContactShadows, Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { MathUtils, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { CashBox, EggCarton, GrowerToken, HoneyJars, Phone, StandTable, Sunflowers, TomatoPunnet } from "../three/models";
import { PhoneScreen } from "../three/PhoneScreen";
import { CHAPTERS, chapterAt, chapterProgress, markSceneReady, storyState } from "./chapters";

/**
 * The pinned 3D stage of the landing story. Scroll progress (storyState) moves
 * the camera between chapter framings and drives each chapter's animation.
 * Purely visual: every fact shown here is also in the page's text.
 */
export default function StoryScene({ reducedMotion }: { reducedMotion: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapper} className="story-canvas" aria-hidden="true">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        frameloop={visible ? "always" : "never"}
        camera={{ position: CHAPTERS[0].camera, fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <fog attach="fog" args={["#120d09", 9, 20]} />
        <ambientLight intensity={0.25} />
        {/* warm lantern over the stand, cool rim from the sky */}
        {/* bias + normalBias stop shadow acne (flickering stripes) on thin wooden parts */}
        <pointLight
          position={[0.4, 2.6, 1.2]}
          intensity={14}
          distance={9}
          decay={1.8}
          color="#ffb35c"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0008}
          shadow-normalBias={0.04}
        />
        <directionalLight position={[-5, 4, -3]} intensity={0.6} color="#9fb4ff" />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={1.2} color="#ffcf8a" position={[0, 4, -4]} scale={[8, 3, 1]} />
          <Lightformer form="ring" intensity={0.6} color="#ffe2b0" position={[4, 2, 3]} scale={2} />
        </Environment>

        <FirstFrame />
        <CameraRig reducedMotion={reducedMotion} />
        <Stage reducedMotion={reducedMotion} />

        <Sparkles count={60} scale={[8, 4, 6]} position={[0, 1.6, 0]} size={2.4} speed={reducedMotion ? 0 : 0.3} color="#ffc46b" opacity={0.7} />
        <ContactShadows position={[0, -0.749, 0]} opacity={0.55} scale={10} blur={2.8} far={3} color="#000000" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.75, 0]} receiveShadow>
          <circleGeometry args={[9, 64]} />
          <meshStandardMaterial color="#2a1e15" roughness={1} />
        </mesh>
      </Canvas>
    </div>
  );
}

/** Tells the preloader the stage is visible, a couple of frames after the first render. */
function FirstFrame() {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 3) markSceneReady();
  });
  return null;
}

const camPos = new Vector3();
const camTarget = new Vector3();
const from = new Vector3();
const to = new Vector3();

/** Interpolates the camera between chapter framings, eased, with pointer parallax. */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const lookAt = useRef(new Vector3(...CHAPTERS[0].target));
  useFrame((state, delta) => {
    // Each chapter's framing is reached at the centre of its slice of the scroll.
    const p = MathUtils.clamp(storyState.progress * CHAPTERS.length - 0.5, 0, CHAPTERS.length - 1);
    const i = Math.min(CHAPTERS.length - 2, Math.floor(p));
    const t = MathUtils.smootherstep(p - i, 0, 1);
    camPos.lerpVectors(from.set(...CHAPTERS[i].camera), to.set(...CHAPTERS[i + 1].camera), t);
    camTarget.lerpVectors(from.set(...CHAPTERS[i].target), to.set(...CHAPTERS[i + 1].target), t);
    if (!reducedMotion) {
      camPos.x += state.pointer.x * 0.25;
      camPos.y += state.pointer.y * 0.12;
    }
    const k = 1 - Math.exp(-delta * 6);
    state.camera.position.lerp(camPos, k);
    lookAt.current.lerp(camTarget, k);
    state.camera.lookAt(lookAt.current);
  });
  return null;
}

function Stage({ reducedMotion }: { reducedMotion: boolean }) {
  const cashBox = useRef<Group>(null);
  const phone = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const tokens = useRef<Group>(null);

  useFrame((state, delta) => {
    const progress = storyState.progress;
    const current = chapterAt(progress);
    const local = chapterProgress(progress);
    const k = 1 - Math.exp(-delta * 7);

    // Chapter 2: the cash box lifts away and vanishes.
    if (cashBox.current) {
      const gone = current >= 2 ? 1 : current === 1 ? MathUtils.smoothstep(local, 0.45, 1) : 0;
      cashBox.current.position.y = MathUtils.lerp(cashBox.current.position.y, 0.62 + gone * 1.6, k);
      cashBox.current.rotation.z = MathUtils.lerp(cashBox.current.rotation.z, gone * 0.9, k);
      const s = MathUtils.lerp(cashBox.current.scale.x, 1 - gone, k);
      cashBox.current.scale.setScalar(Math.max(0.001, s));
    }

    // Chapters 3–4: the phone rises in front of the basket.
    if (phone.current) {
      const show = current === 2 || current === 3 ? 1 : 0;
      phone.current.position.y = MathUtils.lerp(phone.current.position.y, show ? 1.25 : -1.5, k);
      phone.current.rotation.y = MathUtils.lerp(phone.current.rotation.y, current === 3 ? 0 : -0.5, k);
    }

    // The scan beam sweeps during the snap chapter.
    if (beam.current) {
      const active = current === 2;
      const sweep = reducedMotion ? 0.5 : (state.clock.elapsedTime % 2.4) / 2.4;
      beam.current.position.x = -1.7 + sweep * 2.4;
      const material = beam.current.material as MeshBasicMaterial;
      material.opacity = MathUtils.lerp(material.opacity, active ? 0.28 * Math.sin(sweep * Math.PI) + 0.05 : 0, k);
    }

    // Last chapter: grower tokens rise above the stand.
    if (tokens.current) {
      const up = current === 5 ? 1 : 0;
      tokens.current.position.y = MathUtils.lerp(tokens.current.position.y, up ? 2.35 : -2, k);
      if (!reducedMotion) tokens.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group position={[0, -0.75, 0]}>
      <StandTable />
      <Item position={[-1.05, 0.62, 0.15]} reducedMotion={reducedMotion}>
        <EggCarton />
      </Item>
      <Item position={[-0.1, 0.62, 0.25]} reducedMotion={reducedMotion}>
        <HoneyJars />
      </Item>
      <Item position={[0.6, 0.62, -0.35]} reducedMotion={reducedMotion}>
        <TomatoPunnet />
      </Item>
      <Item position={[1.25, 0.62, -0.5]} reducedMotion={reducedMotion}>
        <Sunflowers />
      </Item>

      <group ref={cashBox} position={[0.9, 0.62, 0.2]}>
        <CashBox />
      </group>

      <group ref={phone} position={[-0.15, -1.5, 1.15]} rotation={[-0.12, -0.5, 0]} scale={0.72}>
        <Phone>
          <PhoneScreen mode={() => (chapterAt(storyState.progress) >= 3 ? "pay" : "scan")} reducedMotion={reducedMotion} />
        </Phone>
      </group>

      <mesh ref={beam} position={[-0.6, 1.0, 0.15]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 0.9]} />
        <meshBasicMaterial color="#ffb547" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      <group ref={tokens} position={[0.2, -2, 0.7]} scale={1.3}>
        {(
          [
            [-0.9, "#e9b84a"],
            [0, "#d98a3d"],
            [0.9, "#c96b3a"],
          ] as const
        ).map(([x, color]) => (
          <group key={color} position={[x, 0, 0]}>
            <Float speed={reducedMotion ? 0 : 2} floatIntensity={0.3} rotationIntensity={0.2}>
              <GrowerToken color={color} />
            </Float>
          </group>
        ))}
      </group>
    </group>
  );
}

function Item({ position, children, reducedMotion }: { position: [number, number, number]; children: React.ReactNode; reducedMotion: boolean }) {
  return (
    <group position={position}>
      {reducedMotion ? children : <Float speed={1.2} rotationIntensity={0.06} floatIntensity={0.1}>{children}</Float>}
    </group>
  );
}
