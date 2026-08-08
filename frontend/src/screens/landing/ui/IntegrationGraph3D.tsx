'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Float } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_TONE } from '@/shared/config/integrations';
import VendorLogo from '@/components/VendorLogos';
import { t } from '@/lib/i18n';

/* i18n-ignore-raw: IntegrationGraph3D */

const HUBS = [
  { id: 'okko', name: 'OKKO', sub: 'landing.nodeOkkoSub', tone: 'var(--accent)', hex: '#00A859' },
  { id: 'shell', name: 'Shell', sub: 'landing.nodeShellSub', tone: 'var(--warn)', hex: '#FFD500' },
  { id: 'ruptela', name: 'Ruptela', sub: 'landing.nodeRuptelaSub', tone: 'var(--info)', hex: '#0066FF' },
] as const;

type HubId = 'okko' | 'shell' | 'ruptela' | 'core';

interface OrbitNode {
  name: string;
  short: string;
  hub: HubId;
  meta: {
    status: 'live' | 'available' | 'partner' | 'unclear' | 'research';
    category: string;
    what: string;
    why: string;
  };
}

interface IntegrationGraph3DProps {
  orbit: OrbitNode[];
  active: string | null;
  setActive: (id: string | null) => void;
  dim: (id: string) => number;
  linkDim: (a: string, b: string) => number;
}

/**
 * 3D Частинки пилу / голографічний туман навколо ядра
 */
function HolographicParticles() {
  const count = 120;
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorPalette = [
      new THREE.Color('#6366F1'),
      new THREE.Color('#00A859'),
      new THREE.Color('#0066FF'),
      new THREE.Color('#FFD500'),
    ];

    for (let i = 0; i < count; i++) {
      const radius = 1.2 + Math.random() * 4.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);

      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, col];
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.04 * delta;
      pointsRef.current.rotation.x += 0.015 * delta;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Рухомий імпульсний пакет даних вздовж лінії 3D
 */
function FlowingPacket({
  from,
  to,
  color,
  delay = 0,
  active,
}: {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  delay?: number;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = (clock.getElapsedTime() + delay) % 2.5;
    const progress = time / 2.5;

    meshRef.current.position.lerpVectors(
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      progress
    );

    const scale = progress < 0.1 ? progress * 10 : progress > 0.9 ? (1 - progress) * 10 : 1;
    meshRef.current.scale.setScalar(scale * (active ? 1.2 : 0));
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.075, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={active ? 0.95 : 0} />
    </mesh>
  );
}

function Graph3DCanvas({
  orbit,
  active,
  setActive,
  dim,
  linkDim,
  nodes3D,
  autoRotate,
}: IntegrationGraph3DProps & {
  nodes3D: Record<string, [number, number, number]>;
  autoRotate: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useFrame((state, delta) => {
    if (groupRef.current && autoRotate && !isInteracting) {
      groupRef.current.rotation.y += 0.08 * delta;
      groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.1;
    }
  });

  const lines = useMemo(() => {
    const list: {
      from: [number, number, number];
      to: [number, number, number];
      color: string;
      isLive: boolean;
      key: string;
      nodeName: string;
      hubId: string;
    }[] = [];

    // Hub to Core links (Live)
    HUBS.forEach(h => {
      if (nodes3D[h.id]) {
        list.push({
          from: nodes3D[h.id],
          to: nodes3D.core,
          color: h.hex,
          isLive: true,
          key: `live-${h.id}`,
          nodeName: h.id,
          hubId: 'core',
        });
      }
    });

    // Orbit to Hub links
    orbit.forEach(o => {
      if (nodes3D[o.name] && nodes3D[o.hub]) {
        list.push({
          from: nodes3D[o.name],
          to: nodes3D[o.hub],
          color: o.meta.status === 'available' ? '#00B4D8' : o.meta.status === 'partner' ? '#F59E0B' : '#64748B',
          isLive: false,
          key: `orbit-${o.name}`,
          nodeName: o.name,
          hubId: o.hub,
        });
      }
    });

    return list;
  }, [nodes3D, orbit]);

  const handlePointerEnter = (id: string) => {
    setActive(id);
  };

  const handlePointerLeave = () => {
    setActive(null);
  };

  return (
    <>
      <ambientLight intensity={0.9} />
      <pointLight position={[10, 15, 10]} intensity={1.5} color="#818CF8" />
      <pointLight position={[-10, -10, -10]} intensity={0.8} color="#00B4D8" />

      <HolographicParticles />

      <group ref={groupRef}>
        {/* Render connections */}
        {lines.map(line => {
          const points = [new THREE.Vector3(...line.from), new THREE.Vector3(...line.to)];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(points);

          const baseOpacity = line.isLive ? 0.65 : 0.25;
          const currentLinkDim = linkDim(line.nodeName, line.hubId);
          const finalOpacity = baseOpacity * currentLinkDim;

          return (
            <lineSegments key={line.key} geometry={lineGeom}>
              <lineBasicMaterial
                color={line.color}
                opacity={finalOpacity}
                transparent
                linewidth={line.isLive ? 2 : 1}
              />
            </lineSegments>
          );
        })}

        {/* Flowing data packets */}
        {HUBS.map((h, i) => (
          <FlowingPacket
            key={`packet-${h.id}`}
            from={nodes3D[h.id]}
            to={nodes3D.core}
            color={h.hex}
            delay={i * 0.8}
            active={linkDim(h.id, 'core') > 0.2}
          />
        ))}

        {/* Core Node: VELES ERP */}
        <Float speed={2} rotationIntensity={0.2} floatIntensity={0.4}>
          <group position={nodes3D.core}>
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); handlePointerEnter('core'); }}
              onPointerOut={(e) => { e.stopPropagation(); handlePointerLeave(); }}
            >
              <sphereGeometry args={[0.34, 32, 32]} />
              <meshBasicMaterial
                color="#6366F1"
                transparent
                opacity={dim('core') * 0.9}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.38, 32, 32]} />
              <meshBasicMaterial
                color="#818CF8"
                wireframe
                transparent
                opacity={dim('core') * 0.4}
              />
            </mesh>
            <Html position={[0, 0.52, 0]} center distanceFactor={6.5}>
              <div
                onMouseEnter={() => handlePointerEnter('core')}
                onMouseLeave={handlePointerLeave}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#090D16]/90 border border-indigo-500/40 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)] transition-all duration-300 select-none cursor-pointer pointer-events-auto ${
                  dim('core') < 0.5 ? 'opacity-30 scale-90' : 'opacity-100 scale-100'
                }`}
              >
                <VendorLogo name="core" size={18} />
                <span className="text-[11px] font-bold font-display tracking-wider uppercase text-indigo-300">
                  VELES ERP
                </span>
              </div>
            </Html>
          </group>
        </Float>

        {/* Hub Nodes: OKKO, Shell, Ruptela */}
        {HUBS.map(h => (
          <group key={h.id} position={nodes3D[h.id]}>
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); handlePointerEnter(h.id); }}
              onPointerOut={(e) => { e.stopPropagation(); handlePointerLeave(); }}
            >
              <sphereGeometry args={[0.22, 24, 24]} />
              <meshBasicMaterial
                color={h.hex}
                transparent
                opacity={dim(h.id) * 0.95}
              />
            </mesh>
            <Html position={[0, 0.38, 0]} center distanceFactor={7}>
              <div
                onMouseEnter={() => handlePointerEnter(h.id)}
                onMouseLeave={handlePointerLeave}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#070A10]/90 border border-white/10 text-white shadow-lg transition-all duration-200 select-none cursor-pointer pointer-events-auto ${
                  dim(h.id) < 0.5 ? 'opacity-25 scale-90' : 'opacity-100 scale-100'
                }`}
              >
                <VendorLogo name={h.id} size={16} />
                <span className="text-[10px] font-bold tracking-wide">{h.name}</span>
              </div>
            </Html>
          </group>
        ))}

        {/* Orbit Nodes */}
        {orbit.map(o => {
          const pos = nodes3D[o.name];
          if (!pos) return null;
          const tone = o.meta.status === 'available' ? '#00B4D8' : o.meta.status === 'partner' ? '#F59E0B' : '#64748B';

          const isHovered = active === o.name;
          const isDimmed = dim(o.name) < 0.5;

          return (
            <group key={o.name} position={pos}>
              <mesh
                onPointerOver={(e) => { e.stopPropagation(); handlePointerEnter(o.name); }}
                onPointerOut={(e) => { e.stopPropagation(); handlePointerLeave(); }}
              >
                <sphereGeometry args={[isHovered ? 0.12 : 0.08, 16, 16]} />
                <meshBasicMaterial
                  color={tone}
                  transparent
                  opacity={dim(o.name) * (isHovered ? 1 : 0.85)}
                />
              </mesh>
              <Html position={[0, 0.24, 0]} center distanceFactor={8}>
                <div
                  onMouseEnter={() => handlePointerEnter(o.name)}
                  onMouseLeave={handlePointerLeave}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#070A10]/85 border transition-all duration-200 cursor-pointer pointer-events-auto select-none ${
                    isHovered
                      ? 'border-indigo-400/60 bg-[#0F172A] scale-110 opacity-100 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                      : isDimmed
                      ? 'border-transparent opacity-20'
                      : 'border-white/5 opacity-80'
                  }`}
                >
                  <VendorLogo name={o.name} size={isHovered ? 16 : 14} />
                  <span
                    className={`text-[9px] font-medium tracking-wide whitespace-nowrap ${
                      isHovered ? 'text-white font-bold' : 'text-neutral-300'
                    }`}
                  >
                    {o.short}
                  </span>
                </div>
              </Html>
            </group>
          );
        })}
      </group>

      <OrbitControls
        enableZoom={true}
        minDistance={2.5}
        maxDistance={9.5}
        enablePan={false}
        dampingFactor={0.06}
        onStart={() => setIsInteracting(true)}
        onEnd={() => setIsInteracting(false)}
      />
    </>
  );
}

export default function IntegrationGraph3D({
  orbit,
  active,
  setActive,
  dim,
  linkDim,
}: IntegrationGraph3DProps) {
  const [autoRotate, setAutoRotate] = useState(true);

  const nodes3D = useMemo(() => {
    const R_hub = 2.1;
    const R_orbit = 3.65;
    const positions: Record<string, [number, number, number]> = {
      core: [0, 0, 0],
    };

    // Hub angles
    const hubAngles = {
      okko: { theta: Math.PI / 2 - 0.15, phi: 0 },
      shell: { theta: Math.PI / 2 - 0.15, phi: (2 * Math.PI) / 3 },
      ruptela: { theta: Math.PI / 2 - 0.15, phi: (4 * Math.PI) / 3 },
    };

    HUBS.forEach(h => {
      const angle = hubAngles[h.id];
      const x = R_hub * Math.sin(angle.theta) * Math.cos(angle.phi);
      const y = R_hub * Math.cos(angle.theta);
      const z = R_hub * Math.sin(angle.theta) * Math.sin(angle.phi);
      positions[h.id] = [x, y, z];
    });

    const hubNodesCount: Record<string, number> = { core: 0, okko: 0, shell: 0, ruptela: 0 };
    orbit.forEach(o => {
      hubNodesCount[o.hub] = (hubNodesCount[o.hub] || 0) + 1;
    });

    const hubNodesCurrentIndex: Record<string, number> = { core: 0, okko: 0, shell: 0, ruptela: 0 };

    orbit.forEach(o => {
      const hubId = o.hub;
      const baseDir = new THREE.Vector3(0, 0, 0);

      if (hubId !== 'core') {
        const hubPos = positions[hubId];
        baseDir.set(hubPos[0], hubPos[1], hubPos[2]).normalize();
      } else {
        baseDir.set(0, 1, 0);
      }

      const count = hubNodesCount[hubId] || 1;
      const idx = hubNodesCurrentIndex[hubId]++;

      const angleOffset = 0.55;
      const rotAngle = (idx / count) * 2 * Math.PI;

      const ortho = new THREE.Vector3(0, 0, 0);
      if (Math.abs(baseDir.x) > Math.abs(baseDir.y)) {
        ortho.set(-baseDir.z, 0, baseDir.x).normalize();
      } else {
        ortho.set(0, baseDir.z, -baseDir.y).normalize();
      }

      const dir = baseDir.clone();
      ortho.applyAxisAngle(baseDir, rotAngle);
      dir.addScaledVector(ortho, Math.sin(angleOffset)).normalize();

      const x = dir.x * R_orbit;
      const y = dir.y * R_orbit;
      const z = dir.z * R_orbit;

      positions[o.name] = [x, y, z];
    });

    return positions;
  }, [orbit]);

  return (
    <div className="relative w-full h-[450px] sm:h-[520px] bg-transparent">
      <Canvas gl={{ alpha: true }} camera={{ position: [0, 2.2, 6.8], fov: 48 }}>
        <Graph3DCanvas
          orbit={orbit}
          active={active}
          setActive={setActive}
          dim={dim}
          linkDim={linkDim}
          nodes3D={nodes3D}
          autoRotate={autoRotate}
        />
      </Canvas>
    </div>
  );
}
