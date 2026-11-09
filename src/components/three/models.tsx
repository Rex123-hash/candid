"use client";

import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";

/**
 * Stylised stand models built from primitives, so the scene needs no model files
 * and loads instantly. Shared by the landing story and any other 3D view.
 */

export const WOOD = "#c8996a";
export const WOOD_DARK = "#9c7047";

export function StandTable() {
  return (
    <group>
      <RoundedBox args={[3.4, 0.12, 1.5]} radius={0.04} position={[0, 0.56, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD} roughness={0.75} />
      </RoundedBox>
      {(
        [
          [-1.55, 0.25, 0.62],
          [1.55, 0.25, 0.62],
          [-1.55, 0.25, -0.62],
          [1.55, 0.25, -0.62],
        ] as const
      ).map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.1, 0.62, 0.1]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
        </mesh>
      ))}
      <RoundedBox args={[1.2, 0.9, 0.06]} radius={0.03} position={[-0.3, 1.25, -0.68]} castShadow>
        <meshStandardMaterial color="#fbf8f1" roughness={0.9} />
      </RoundedBox>
      <QrPattern position={[-0.3, 1.27, -0.638]} />
      {/* sign post: set behind the board (not at the same depth) so the faces never
          overlap, which caused z-fighting flicker */}
      <mesh position={[-0.3, 0.74, -0.735]} castShadow>
        <boxGeometry args={[0.06, 0.36, 0.04]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** A stylised QR code: a fixed pseudo-random grid of dark squares. */
export function QrPattern({ position }: { position: [number, number, number] }) {
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let x = 0; x < 11; x++) {
      for (let y = 0; y < 11; y++) {
        const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
        if (finder ? !(x % 10 === 1 && y % 10 === 1) : rand() > 0.55) out.push([x, y]);
      }
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

export function EggCarton() {
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

export function HoneyJars() {
  return (
    <group>
      {[-0.17, 0.17].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.17, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.32, 32]} />
            <meshPhysicalMaterial color="#f5a524" roughness={0.08} transmission={0.5} thickness={0.4} ior={1.45} clearcoat={1} emissive="#7a3d00" emissiveIntensity={0.25} />
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

export function TomatoPunnet() {
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

export function Sunflowers() {
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
            <meshStandardMaterial color="#7d7a3a" />
          </mesh>
          <group position={[x, y, z]} rotation={[0.35, 0, x * 2]}>
            <mesh>
              <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
              <meshStandardMaterial color="#f5b81f" roughness={0.6} emissive="#8a5200" emissiveIntensity={0.15} />
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

/** The old way: a tin cash box with a coin slot. */
export function CashBox() {
  return (
    <group>
      <RoundedBox args={[0.46, 0.22, 0.32]} radius={0.02} position={[0, 0.11, 0]} castShadow>
        <meshStandardMaterial color="#5c6670" metalness={0.65} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.226, 0]}>
        <boxGeometry args={[0.2, 0.004, 0.03]} />
        <meshBasicMaterial color="#0b0b0b" />
      </mesh>
      <mesh position={[0, 0.16, 0.162]}>
        <boxGeometry args={[0.08, 0.05, 0.01]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** A phone body; the screen is supplied by the caller (e.g. a live canvas texture). */
export function Phone({ children }: { children?: React.ReactNode }) {
  return (
    <group>
      <RoundedBox args={[0.46, 0.92, 0.05]} radius={0.06} smoothness={6} castShadow>
        <meshStandardMaterial color="#121212" metalness={0.5} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[0.4, 0.84]} />
        {children ?? <meshBasicMaterial color="#0d0d0d" />}
      </mesh>
    </group>
  );
}

/** A grower token: a coin with a ring, used for the payout split. */
export function GrowerToken({ color }: { color: string }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 48]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.027, 0]}>
        <torusGeometry args={[0.15, 0.012, 12, 48]} />
        <meshStandardMaterial color="#fff6e5" metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}
