'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_TONE } from '@/shared/config/integrations';

const HUBS = [
  { id: 'okko', name: 'OKKO', sub: 'landing.nodeOkkoSub', tone: 'var(--accent)' },
  { id: 'shell', name: 'Shell', sub: 'landing.nodeShellSub', tone: 'var(--warn)' },
  { id: 'ruptela', name: 'Ruptela', sub: 'landing.nodeRuptelaSub', tone: 'var(--info)' },
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
    const time = (clock.getElapsedTime() + delay) % 2.8;
    const progress = time / 2.8;

    meshRef.current.position.lerpVectors(
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      progress
    );

    const scale = progress < 0.08 ? progress * 12.5 : progress > 0.92 ? (1 - progress) * 12.5 : 1;
    meshRef.current.scale.setScalar(scale * (active ? 1 : 0));
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.07, 16, 16]} />
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
}: IntegrationGraph3DProps & {
  nodes3D: Record<string, [number, number, number]>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  // Auto rotate the globe when the user is not interacting
  useFrame((state, delta) => {
    if (groupRef.current && !isInteracting) {
      groupRef.current.rotation.y += 0.09 * delta;
      groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.12) * 0.12;
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
          color: h.tone,
          isLive: true,
          key: `live-${h.id}`,
          nodeName: h.id,
          hubId: 'core',
        });
      }
    });

    // Orbit to Hub links (Available / Inactive)
    orbit.forEach(o => {
      if (nodes3D[o.name] && nodes3D[o.hub]) {
        list.push({
          from: nodes3D[o.name],
          to: nodes3D[o.hub],
          color: STATUS_TONE[o.meta ? o.meta.status : 'available'] || 'var(--border-subtle)',
          isLive: false,
          key: `orbit-${o.name}`,
          nodeName: o.name,
          hubId: o.hub,
        });
      }
    });

    return list;
  }, [nodes3D, orbit]);

  return (
    <>
      <ambientLight intensity={0.75} />
      <pointLight position={[10, 10, 10]} intensity={1.2} />

      <group ref={groupRef}>
        {/* Render lines */}
        {lines.map(line => {
          const points = [new THREE.Vector3(...line.from), new THREE.Vector3(...line.to)];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(points);

          const baseOpacity = line.isLive ? 0.6 : 0.22;
          const currentLinkDim = linkDim(line.nodeName, line.hubId);
          const finalOpacity = baseOpacity * currentLinkDim;

          return (
            <line key={line.key} geometry={lineGeom}>
              <lineBasicMaterial
                color={line.color}
                opacity={finalOpacity}
                transparent
                linewidth={1}
              />
            </line>
          );
        })}

        {/* Flowing packets on live lines */}
        {HUBS.map((h, i) => (
          <FlowingPacket
            key={`packet-${h.id}`}
            from={nodes3D[h.id]}
            to={nodes3D.core}
            color={h.tone}
            delay={i * 0.9}
            active={linkDim(h.id, 'core') > 0.25}
          />
        ))}

        {/* Core Node */}
        <group position={nodes3D.core}>
          <mesh
            onPointerOver={(e) => { e.stopPropagation(); setActive('core'); }}
            onPointerOut={(e) => { e.stopPropagation(); setActive(null); }}
          >
            <sphereGeometry args={[0.26, 32, 32]} />
            <meshBasicMaterial
              color="var(--accent)"
              transparent
              opacity={dim('core') * 0.9}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.275, 32, 32]} />
            <meshBasicMaterial
              color="var(--accent)"
              wireframe
              transparent
              opacity={dim('core') * 0.28}
            />
          </mesh>
          <Html position={[0, 0.46, 0]} center distanceFactor={7}>
            <div className={`text-[10px] font-bold font-display tracking-widest uppercase px-2 py-0.5 rounded-md bg-[#070A10]/85 border border-white/10 text-white shadow-lg transition-opacity duration-200 select-none ${dim('core') < 0.5 ? 'opacity-25' : 'opacity-100'
              }`}>
              VELES ERP
            </div>
          </Html>
        </group>

        {/* Hub Nodes */}
        {HUBS.map(h => (
          <group key={h.id} position={nodes3D[h.id]}>
            <mesh
              onPointerOver={(e) => { e.stopPropagation(); setActive(h.id); }}
              onPointerOut={(e) => { e.stopPropagation(); setActive(null); }}
            >
              <sphereGeometry args={[0.16, 24, 24]} />
              <meshBasicMaterial
                color={h.tone}
                transparent
                opacity={dim(h.id) * 0.95}
              />
            </mesh>
            <Html position={[0, 0.32, 0]} center distanceFactor={7.5}>
              <div className={`text-[9.5px] font-bold tracking-wide px-1.5 py-0.5 rounded-md bg-[#070A10]/75 border border-white/5 text-white shadow-md transition-opacity duration-200 select-none ${dim(h.id) < 0.5 ? 'opacity-25' : 'opacity-100'
                }`}>
                {h.name}
              </div>
            </Html>
          </group>
        ))}

        {/* Orbit Nodes */}
        {orbit.map(o => {
          const pos = nodes3D[o.name];
          if (!pos) return null;
          const tone = STATUS_TONE[o.meta.status] || 'var(--text-muted)';

          const isHovered = active === o.name;
          const isDimmed = dim(o.name) < 0.5;

          return (
            <group key={o.name} position={pos}>
              <mesh
                onPointerOver={(e) => { e.stopPropagation(); setActive(o.name); }}
                onPointerOut={(e) => { e.stopPropagation(); setActive(null); }}
              >
                <sphereGeometry args={[0.075, 16, 16]} />
                <meshBasicMaterial
                  color={tone}
                  transparent
                  opacity={dim(o.name) * 0.85}
                />
              </mesh>
              <Html position={[0, 0.18, 0]} center distanceFactor={8.5}>
                <div
                  className={`text-[8.5px] font-semibold font-sans tracking-wide whitespace-nowrap transition-all duration-200 pointer-events-none select-none ${isHovered
                      ? 'text-white scale-110 opacity-100 font-bold drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]'
                      : isDimmed
                        ? 'text-neutral-600 opacity-20'
                        : 'text-neutral-400 opacity-75'
                    }`}
                >
                  {o.short}
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
  const nodes3D = useMemo(() => {
    const R_hub = 2.1;
    const R_orbit = 3.65;
    const positions: Record<string, [number, number, number]> = {
      core: [0, 0, 0],
    };

    // Position hubs spaced 120deg apart on horizontal plane
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

    // Cluster candidates around their respective hub on the outer sphere
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
    <div className="w-full h-[380px] sm:h-[450px] cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 2.5, 6.5], fov: 50 }}>
        <Graph3DCanvas
          orbit={orbit}
          active={active}
          setActive={setActive}
          dim={dim}
          linkDim={linkDim}
          nodes3D={nodes3D}
        />
      </Canvas>
    </div>
  );
}
