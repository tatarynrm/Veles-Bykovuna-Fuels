'use client';

import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

// Map GLTF nodes to truck components
const getNodeSystem = (nodeName: string): string => {
  if (nodeName === 'Object_2') return 'refrigerator';
  if (['Object_3', 'Object_9', 'Object_21', 'Object_11', 'Object_27', 'Object_7', 'Object_8'].includes(nodeName)) return 'cabin';
  if (['Object_23', 'Object_24', 'Object_25', 'Object_26'].includes(nodeName)) return 'wheels';
  if (['Object_22'].includes(nodeName)) return 'lights';
  return 'engine';
};

// Define camera target configurations for main components
const cameraTargets: Record<string, { target: [number, number, number]; position: [number, number, number] }> = {
  all: {
    target: [0, 0.8, 0],
    position: [6, 2.5, 7],
  },
  refrigerator: {
    target: [0, 1.3, -2.2],
    position: [-5, 2.2, -5.5],
  },
  cabin: {
    target: [0, 1.2, 2.2],
    position: [4, 1.8, 4.5],
  },
  engine: {
    target: [0, 0.6, 3.2],
    position: [2.5, 1.1, 4.5],
  },
  wheels: {
    target: [-1.2, 0.4, -0.8],
    position: [-3.8, 0.7, -0.8],
  },
  lights: {
    target: [0, 0.9, 3.4],
    position: [-1.2, 1.2, 4.8],
  },
};

// Camera targets for EVERY single sub-fault ID
const subFaultCameraTargets: Record<string, { target: [number, number, number]; position: [number, number, number] }> = {
  // 1. Reefer Unit
  reefer_engine_failure: { target: [0.35, 1.5, -2.1], position: [2.5, 1.8, -4.5] },
  reefer_belt_snapped: { target: [0.35, 1.35, -2.1], position: [2.5, 1.6, -4.5] },
  reefer_starter_fault: { target: [0.35, 1.1, -2.1], position: [2.5, 1.3, -4.5] },
  reefer_alternator_fault: { target: [-0.35, 1.5, -2.1], position: [-2.5, 1.8, -4.5] },
  reefer_battery_dead: { target: [-0.35, 1.2, -2.1], position: [-2.5, 1.4, -4.5] },
  compressor_failure: { target: [0.0, 1.4, -2.3], position: [0.0, 1.6, -4.8] },
  freon_leak: { target: [0.0, 1.1, -2.3], position: [0.0, 1.2, -4.8] },
  condenser_fan_broken: { target: [0.0, 1.7, -2.0], position: [0.0, 2.2, -4.2] },
  evaporator_fan_broken: { target: [0.0, 1.8, -3.2], position: [-2.0, 2.5, -5.2] },
  evaporator_icing: { target: [0.0, 1.6, -3.2], position: [2.0, 2.2, -5.2] },
  reefer_controller_error: { target: [-0.5, 1.3, -2.0], position: [-2.2, 1.4, -3.2] },
  temp_sensor_fault: { target: [0.0, 1.4, -2.5], position: [-1.8, 1.6, -4.5] },
  reefer_fuel_filter_clogged: { target: [0.4, 0.8, -2.2], position: [2.0, 0.9, -3.8] },
  reefer_fuel_tank_leak: { target: [0.0, 0.5, -3.0], position: [2.2, 0.6, -4.8] },

  // 2. Trailer Body & Insulation
  door_seal_damage: { target: [0.0, 1.5, -7.5], position: [0.0, 1.8, -10.5] },
  door_latch_broken: { target: [0.6, 1.4, -7.5], position: [1.2, 1.5, -9.5] },
  wall_panel_damage: { target: [1.3, 1.5, -5.0], position: [4.8, 1.8, -5.0] },
  roof_leak: { target: [0.0, 2.2, -5.0], position: [0.0, 4.8, -8.0] },
  air_chute_detached: { target: [0.0, 1.9, -4.8], position: [0.0, 2.1, -7.8] },
  drain_hole_clogged: { target: [1.1, 0.4, -7.2], position: [2.5, 0.5, -8.5] },
  floor_damage: { target: [0.0, 0.4, -5.5], position: [0.0, 0.8, -8.5] },

  // 3. Trailer Chassis
  tire_blowout: { target: [-1.2, 0.5, -6.0], position: [-4.2, 0.7, -6.8] },
  tire_wear_uneven: { target: [1.2, 0.5, -6.0], position: [4.2, 0.7, -6.8] },
  brake_pad_wear: { target: [-0.8, 0.5, -5.8], position: [-3.0, 0.6, -6.2] },
  air_bag_puncture: { target: [-0.9, 0.7, -6.2], position: [-3.2, 0.9, -7.2] },
  brake_air_line_leak: { target: [0.0, 0.4, -4.8], position: [0.0, 0.5, -7.2] },
  wheel_bearing_overheat: { target: [-1.2, 0.5, -5.6], position: [-3.8, 0.6, -6.0] },
  landing_gear_broken: { target: [-1.0, 0.4, -3.2], position: [-3.5, 0.6, -3.2] },
  kingpin_damage: { target: [0.0, 0.8, -1.2], position: [2.8, 1.0, -1.2] },

  // 4. Truck Tractor
  engine_overheat: { target: [0.0, 0.7, 3.2], position: [2.2, 1.2, 4.5] },
  engine_oil_leak: { target: [0.0, 0.4, 3.2], position: [2.0, 0.5, 4.2] },
  turbo_failure: { target: [0.3, 0.8, 3.0], position: [1.8, 1.1, 4.0] },
  transmission_fault: { target: [0.0, 0.5, 1.0], position: [3.2, 0.6, 1.0] },
  driveshaft_issue: { target: [0.0, 0.5, 0.0], position: [3.2, 0.5, 0.0] },
  main_battery_dead: { target: [-0.8, 0.6, 1.8], position: [-3.2, 0.9, 1.8] },
  truck_alternator_fault: { target: [-0.4, 0.8, 3.1], position: [-2.2, 1.1, 4.0] },
  air_compressor_failure: { target: [0.4, 0.6, 2.8], position: [2.2, 0.8, 3.6] },
  gladhand_leak: { target: [0.0, 1.1, 0.6], position: [2.5, 1.4, 0.6] },
  seven_way_cable_damage: { target: [0.0, 1.2, 0.5], position: [-2.2, 1.5, 0.5] },
  dpf_clogged: { target: [0.8, 0.6, 1.5], position: [3.2, 0.8, 1.5] },
  egr_valve_fault: { target: [0.2, 0.9, 2.9], position: [1.8, 1.2, 3.8] },
  def_adblue_leak: { target: [0.8, 0.5, 0.8], position: [3.0, 0.6, 0.8] },

  // 5. Optics
  tail_light_broken: { target: [0.8, 0.8, -7.8], position: [2.0, 1.0, -10.0] },
  side_marker_fault: { target: [-1.3, 1.2, -4.0], position: [-4.0, 1.4, -4.0] },
  abs_sensor_fault: { target: [-1.2, 0.5, -5.8], position: [-3.5, 0.6, -6.5] },
  tpms_sensor_fault: { target: [-1.2, 0.5, -6.2], position: [-3.5, 0.6, -7.0] },

  // Wheel-specific inspection targets (zoom to individual wheels)
  wheel_FL: { target: [-0.8, 0.4, 3.2], position: [-2.8, 0.6, 4.2] },
  wheel_FR: { target: [0.8, 0.4, 3.2], position: [2.8, 0.6, 4.2] },
  wheel_RL: { target: [-0.8, 0.4, 1.0], position: [-2.8, 0.6, 1.8] },
  wheel_RR: { target: [0.8, 0.4, 1.0], position: [2.8, 0.6, 1.8] },
  wheel_T1L: { target: [-1.2, 0.5, -4.8], position: [-4.0, 0.6, -4.8] },
  wheel_T1R: { target: [1.2, 0.5, -4.8], position: [4.0, 0.6, -4.8] },
  wheel_T2L: { target: [-1.2, 0.5, -5.8], position: [-4.0, 0.6, -5.8] },
  wheel_T2R: { target: [1.2, 0.5, -5.8], position: [4.0, 0.6, -5.8] },
  wheel_T3L: { target: [-1.2, 0.5, -6.8], position: [-4.0, 0.6, -6.8] },
  wheel_T3R: { target: [1.2, 0.5, -6.8], position: [4.0, 0.6, -6.8] },
};

// Structured array of ALL hotspots
const allHotspots = [
  // 1. Reefer Unit
  { id: 'reefer_engine_failure', system: 'refrigerator', label: 'Двигун установки', pos: [0.35, 1.5, -2.1] as [number, number, number], status: 'damaged' },
  { id: 'reefer_belt_snapped', system: 'refrigerator', label: 'Приводний ремінь', pos: [0.35, 1.35, -2.1] as [number, number, number], status: 'damaged' },
  { id: 'reefer_starter_fault', system: 'refrigerator', label: 'Стартер рефрижератора', pos: [0.35, 1.1, -2.1] as [number, number, number], status: 'warning' },
  { id: 'reefer_alternator_fault', system: 'refrigerator', label: 'Генератор установки', pos: [-0.35, 1.5, -2.1] as [number, number, number], status: 'warning' },
  { id: 'reefer_battery_dead', system: 'refrigerator', label: 'Акумулятор рефа', pos: [-0.35, 1.2, -2.1] as [number, number, number], status: 'warning' },
  { id: 'compressor_failure', system: 'refrigerator', label: 'Компресор рефа', pos: [0.0, 1.4, -2.3] as [number, number, number], status: 'damaged' },
  { id: 'freon_leak', system: 'refrigerator', label: 'Витік фреону', pos: [0.0, 1.1, -2.3] as [number, number, number], status: 'damaged' },
  { id: 'condenser_fan_broken', system: 'refrigerator', label: 'Вентилятор конденсера', pos: [0.0, 1.7, -2.0] as [number, number, number], status: 'damaged' },
  { id: 'evaporator_fan_broken', system: 'refrigerator', label: 'Вентилятор випарника', pos: [0.0, 1.8, -3.2] as [number, number, number], status: 'damaged' },
  { id: 'evaporator_icing', system: 'refrigerator', label: 'Обмерзання випарника', pos: [0.0, 1.6, -3.2] as [number, number, number], status: 'warning' },
  { id: 'reefer_controller_error', system: 'refrigerator', label: 'Пульт рефрижератора', pos: [-0.5, 1.3, -2.0] as [number, number, number], status: 'warning' },
  { id: 'temp_sensor_fault', system: 'refrigerator', label: 'Датчик температури', pos: [0.0, 1.4, -2.5] as [number, number, number], status: 'warning' },
  { id: 'reefer_fuel_filter_clogged', system: 'refrigerator', label: 'Паливний фільтр рефа', pos: [0.4, 0.8, -2.2] as [number, number, number], status: 'warning' },
  { id: 'reefer_fuel_tank_leak', system: 'refrigerator', label: 'Витік бака рефа', pos: [0.0, 0.5, -3.0] as [number, number, number], status: 'damaged' },

  // 2. Trailer Body & Insulation
  { id: 'door_seal_damage', system: 'cabin', label: 'Ущільнювач дверей', pos: [0.0, 1.5, -7.5] as [number, number, number], status: 'damaged' },
  { id: 'door_latch_broken', system: 'cabin', label: 'Запірний механізм', pos: [0.6, 1.4, -7.5] as [number, number, number], status: 'warning' },
  { id: 'wall_panel_damage', system: 'cabin', label: 'Сендвіч-панель', pos: [1.3, 1.5, -5.0] as [number, number, number], status: 'warning' },
  { id: 'roof_leak', system: 'cabin', label: 'Протікання даху', pos: [0.0, 2.2, -5.0] as [number, number, number], status: 'warning' },
  { id: 'air_chute_detached', system: 'cabin', label: 'Повітропровідний рукав', pos: [0.0, 1.9, -4.8] as [number, number, number], status: 'warning' },
  { id: 'drain_hole_clogged', system: 'cabin', label: 'Засмічення дренажу', pos: [1.1, 0.4, -7.2] as [number, number, number], status: 'warning' },
  { id: 'floor_damage', system: 'cabin', label: 'Пошкодження підлоги', pos: [0.0, 0.4, -5.5] as [number, number, number], status: 'warning' },

  // 3. Trailer Chassis / Wheels
  { id: 'tire_blowout', system: 'wheels', label: 'Пробій шини причепа', pos: [-1.2, 0.5, -6.0] as [number, number, number], status: 'damaged' },
  { id: 'tire_wear_uneven', system: 'wheels', label: 'Знос шин причепа', pos: [1.2, 0.5, -6.0] as [number, number, number], status: 'warning' },
  { id: 'brake_pad_wear', system: 'wheels', label: 'Гальмівні колодки причепа', pos: [-0.8, 0.5, -5.8] as [number, number, number], status: 'warning' },
  { id: 'air_bag_puncture', system: 'wheels', label: 'Пневмоподушка причепа', pos: [-0.9, 0.7, -6.2] as [number, number, number], status: 'damaged' },
  { id: 'brake_air_line_leak', system: 'wheels', label: 'Витік гальмівної магістралі', pos: [0.0, 0.4, -4.8] as [number, number, number], status: 'damaged' },
  { id: 'wheel_bearing_overheat', system: 'wheels', label: 'Перегрів підшипника', pos: [-1.2, 0.5, -5.6] as [number, number, number], status: 'damaged' },
  { id: 'landing_gear_broken', system: 'wheels', label: 'Опорні лапи причепа', pos: [-1.0, 0.4, -3.2] as [number, number, number], status: 'warning' },
  { id: 'kingpin_damage', system: 'wheels', label: 'Зчіпний шкворень (Kingpin)', pos: [0.0, 0.8, -1.2] as [number, number, number], status: 'warning' },

  // 4. Truck Tractor (Engine)
  { id: 'engine_overheat', system: 'engine', label: 'Перегрів двигуна', pos: [0.0, 0.7, 3.2] as [number, number, number], status: 'damaged' },
  { id: 'engine_oil_leak', system: 'engine', label: 'Витік моторної оливи', pos: [0.0, 0.4, 3.2] as [number, number, number], status: 'damaged' },
  { id: 'turbo_failure', system: 'engine', label: 'Турбокомпресор тягача', pos: [0.3, 0.8, 3.0] as [number, number, number], status: 'damaged' },
  { id: 'transmission_fault', system: 'engine', label: 'Несправність трансмісії', pos: [0.0, 0.5, 1.0] as [number, number, number], status: 'warning' },
  { id: 'driveshaft_issue', system: 'engine', label: 'Карданний вал тягача', pos: [0.0, 0.5, 0.0] as [number, number, number], status: 'warning' },
  { id: 'main_battery_dead', system: 'engine', label: 'АКБ тягача', pos: [-0.8, 0.6, 1.8] as [number, number, number], status: 'warning' },
  { id: 'truck_alternator_fault', system: 'engine', label: 'Генератор тягача', pos: [-0.4, 0.8, 3.1] as [number, number, number], status: 'warning' },
  { id: 'air_compressor_failure', system: 'engine', label: 'Пневмокомпресор тягача', pos: [0.4, 0.6, 2.8] as [number, number, number], status: 'warning' },
  { id: 'gladhand_leak', system: 'engine', label: 'Головка зчеплення (Gladhand)', pos: [0.0, 1.1, 0.6] as [number, number, number], status: 'damaged' },
  { id: 'seven_way_cable_damage', system: 'engine', label: '7-жильний кабель', pos: [0.0, 1.2, 0.5] as [number, number, number], status: 'warning' },
  { id: 'dpf_clogged', system: 'engine', label: 'Сажовий фільтр (DPF)', pos: [0.8, 0.6, 1.5] as [number, number, number], status: 'warning' },
  { id: 'egr_valve_fault', system: 'engine', label: 'Клапан EGR', pos: [0.2, 0.9, 2.9] as [number, number, number], status: 'warning' },
  { id: 'def_adblue_leak', system: 'engine', label: 'Витік AdBlue / DEF', pos: [0.8, 0.5, 0.8] as [number, number, number], status: 'warning' },

  // 5. Optics / Lights
  { id: 'tail_light_broken', system: 'lights', label: 'Задні ліхтарі причепа', pos: [0.8, 0.8, -7.8] as [number, number, number], status: 'damaged' },
  { id: 'side_marker_fault', system: 'lights', label: 'Габаритні вогні причепа', pos: [-1.3, 1.2, -4.0] as [number, number, number], status: 'warning' },
  { id: 'abs_sensor_fault', system: 'lights', label: 'Датчик ABS причепа', pos: [-1.2, 0.5, -5.8] as [number, number, number], status: 'warning' },
  { id: 'tpms_sensor_fault', system: 'lights', label: 'Датчик тиску TPMS', pos: [-1.2, 0.5, -6.2] as [number, number, number], status: 'warning' },
];

interface ModelProps {
  selectedPart: string | null;
  hoveredPart: string | null;
  setHoveredPart: (part: string | null) => void;
  onPartClick: (part: string) => void;
  partStatuses: Record<string, 'ok' | 'warning' | 'damaged'>;
  targetCamera: THREE.Vector3;
  targetLookAt: THREE.Vector3;
}

function TruckModel({
  selectedPart,
  hoveredPart,
  setHoveredPart,
  onPartClick,
  partStatuses,
  targetCamera,
  targetLookAt,
}: ModelProps) {
  const { scene } = useGLTF('/models/trucks/Refridge-Truck.glb');
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Trigger camera transition when selected part or sub-fault changes
  useEffect(() => {
    setIsMoving(true);
  }, [targetCamera, targetLookAt]);

  // Clone scene
  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.scale.set(0.65, 0.65, 0.65);
    clone.position.set(0, 0, 0);
    return clone;
  }, [scene]);

  // Apply materials and highlights
  useEffect(() => {
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        const system = getNodeSystem(child.name);
        const isSelected = selectedPart === system;
        const isHovered = hoveredPart === system;
        const status = partStatuses[system] || 'ok';

        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material;
        }

        const baseMat = child.userData.originalMaterial;
        const mat = baseMat.clone();

        if (isSelected || isHovered) {
          const glowColor =
            status === 'damaged'
              ? new THREE.Color('#ff4d4d')
              : status === 'warning'
              ? new THREE.Color('#ffb703')
              : new THREE.Color('#00c853');

          mat.emissive = glowColor;
          mat.emissiveIntensity = isHovered ? 0.7 : 0.45;
          
          if (mat.color) {
            mat.color.lerp(glowColor, 0.35);
          }
        } else {
          if (status === 'damaged') {
            mat.emissive = new THREE.Color('#ff4d4d');
            mat.emissiveIntensity = 0.25;
          } else if (status === 'warning') {
            mat.emissive = new THREE.Color('#ffb703');
            mat.emissiveIntensity = 0.18;
          } else {
            mat.emissive = new THREE.Color('#000000');
            mat.emissiveIntensity = 0;
          }
        }

        child.material = mat;
      }
    });
  }, [clonedScene, selectedPart, hoveredPart, partStatuses]);

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    if (e.object && e.object.isMesh) {
      const system = getNodeSystem(e.object.name);
      setHoveredPart(system);
      document.body.style.cursor = 'pointer';
    }
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHoveredPart(null);
    document.body.style.cursor = 'default';
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.object && e.object.isMesh) {
      const system = getNodeSystem(e.object.name);
      onPartClick(system);
    }
  };

  useFrame(() => {
    if (isMoving) {
      camera.position.lerp(targetCamera, 0.055);

      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt, 0.055);
        controlsRef.current.update();
      }

      const distCam = camera.position.distanceTo(targetCamera);
      const distTgt = controlsRef.current 
        ? controlsRef.current.target.distanceTo(targetLookAt) 
        : 0;

      if (distCam < 0.08 && distTgt < 0.08) {
        setIsMoving(false);
      }
    }
  });

  return (
    <>
      <primitive
        object={clonedScene}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2 + 0.18}
        minDistance={2}
        maxDistance={12}
        onStart={() => setIsMoving(false)}
      />
    </>
  );
}

function CanvasLoader() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center bg-surface-inset border border-bdr-subtle px-6 py-4 rounded-card backdrop-blur-md shadow-apple-md text-center w-64">
        <div className="w-10 h-10 border-4 border-bdr-highlight border-t-okko-emerald rounded-full animate-spin mb-3"></div>
        <p className="text-txt-primary text-sm font-bold tracking-wide font-sans">Завантаження 3D моделі...</p>
        <p className="text-txt-secondary text-[10px] font-semibold mt-1 font-sans">Refridge-Truck.glb (~1.1 MB)</p>
      </div>
    </Html>
  );
}

interface ThreeTruckViewerProps {
  selectedPart: string | null;
  onPartClick: (part: string) => void;
  partStatuses: Record<string, 'ok' | 'warning' | 'damaged'>;
  selectedSubFault: string | null;
  onSubFaultClick: (subFault: string | null) => void;
  activeFaultIds: string[];
}

export default function ThreeTruckViewer({
  selectedPart,
  onPartClick,
  partStatuses,
  selectedSubFault,
  onSubFaultClick,
  activeFaultIds,
}: ThreeTruckViewerProps) {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);

  // Derive target camera vectors based on selectedPart or selectedSubFault
  const { targetCamera, targetLookAt } = useMemo(() => {
    const config = (selectedSubFault && subFaultCameraTargets[selectedSubFault]) ||
                   (selectedPart && cameraTargets[selectedPart]) ||
                   cameraTargets.all;
    
    const tgt = new THREE.Vector3(...config.target);
    const pos = new THREE.Vector3(...config.position);
    
    // Scale out the zoom distance so it's not too close (allowing easy reading of popups)
    if (selectedSubFault) {
      const dir = new THREE.Vector3().subVectors(pos, tgt);
      // Increased minimum distance from 4.2 to 5.2 units to be further away and comfortable
      const minDistance = 5.2; 
      if (dir.length() < minDistance) {
        dir.setLength(minDistance);
        pos.addVectors(tgt, dir);
      }
    } else if (selectedPart) {
      const dir = new THREE.Vector3().subVectors(pos, tgt);
      // Ensure main part focus is also slightly pulled back (4.8 units minimum)
      const minDistance = 4.8;
      if (dir.length() < minDistance) {
        dir.setLength(minDistance);
        pos.addVectors(tgt, dir);
      }
    }
    
    return {
      targetCamera: pos,
      targetLookAt: tgt,
    };
  }, [selectedPart, selectedSubFault]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

  // Filter which hotspots to show to avoid screen clutter
  const visibleHotspots = useMemo(() => {
    return allHotspots.filter(h => {
      // Only show if the selected vehicle has this fault active
      if (!activeFaultIds.includes(h.id)) return false;
      // Always show if this specific sub-fault is selected
      if (selectedSubFault === h.id) return true;
      // Show hotspots of the selected group
      if (selectedPart === h.system) return true;
      return false;
    });
  }, [selectedPart, selectedSubFault, activeFaultIds]);

  return (
    <div className="relative w-full h-[500px] lg:h-[620px] rounded-card overflow-hidden bg-surface-inset border border-bdr-subtle group">
      {/* Instructions */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-60">
        <div className="bg-surface-inset backdrop-blur-md border border-bdr-subtle rounded-xl px-3 py-2 text-[10px] text-txt-secondary font-semibold space-y-1 shadow-md font-sans">
          <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent"></span> Ліва кнопка миші — обертання</p>
          <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent"></span> Права кнопка миші / Shift — зсув</p>
          <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent"></span> Скрол — масштабування</p>
          <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent"></span> Клік на деталь — наближення</p>
        </div>
      </div>

      {/* Floating System HUD */}
      {hoveredPart && !selectedSubFault && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none fade-in">
          <div className="bg-surface-inset border border-bdr-subtle rounded-full px-5 py-1.5 text-xs text-txt-primary font-semibold tracking-wider shadow-apple-sm flex items-center gap-2 font-sans">
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              partStatuses[hoveredPart] === 'damaged' ? 'bg-okko-red' : partStatuses[hoveredPart] === 'warning' ? 'bg-okko-accent' : 'bg-accent'
            }`}></span>
            {hoveredPart === 'refrigerator' && 'ХОЛОДИЛЬНО-ОБІГРІВАЛЬНА УСТАНОВКА (REEFER)'}
            {hoveredPart === 'cabin' && 'КАБІНА & КЛІМАТ ТЯГАЧА / ПРИЧІП'}
            {hoveredPart === 'engine' && 'ДВИГУН & ТРАНСМІСІЯ'}
            {hoveredPart === 'wheels' && 'ХОДОВА ЧАСТИНА & ШИНИ'}
            {hoveredPart === 'lights' && 'СВІТЛОВА СИСТЕМА & ЕЛЕКТРОНІКА'}
            <span className="text-[9px] text-txt-secondary font-bold uppercase ml-1">
              ({partStatuses[hoveredPart] === 'damaged' ? 'Пошкоджено' : partStatuses[hoveredPart] === 'warning' ? 'Увага' : 'Норма'})
            </span>
          </div>
        </div>
      )}

      {/* Canvas */}
      <Canvas
        camera={{ position: cameraTargets.all.position, fov: 45 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[8, 12, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-8, 6, -5]} intensity={0.45} />
        <pointLight position={[0, 4, 0]} intensity={0.4} />
        
        <Suspense fallback={<CanvasLoader />}>
          <TruckModel
            selectedPart={selectedPart}
            hoveredPart={hoveredPart}
            setHoveredPart={setHoveredPart}
            onPartClick={onPartClick}
            partStatuses={partStatuses}
            targetCamera={targetCamera}
            targetLookAt={targetLookAt}
          />

          {/* Render Active Hotspots without distanceFactor to keep stable readable size */}
          {visibleHotspots.map((h) => {
            const isSelected = selectedSubFault === h.id;
            const statusColor = h.status === 'damaged' ? 'bg-danger border-danger/30' : 'bg-warn border-warn/30';
            return (
              <Html key={h.id} position={h.pos} center>
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSubFaultClick(h.id);
                  }}
                  className="cursor-pointer group relative flex items-center justify-center fade-in"
                >
                  <span className={`absolute inline-flex h-5 w-5 rounded-full ${h.status === 'damaged' ? 'bg-danger' : 'bg-warn'} opacity-75 animate-ping`} />
                  <span className={`relative inline-flex rounded-full h-4 w-4 ${statusColor} border-2 shadow-apple-sm transition-transform ${isSelected ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'}`} />
                  
                  <div className={`absolute left-6 bg-surface-inset border border-bdr-subtle text-txt-primary text-[10px] font-semibold py-1.5 px-2.5 rounded-lg whitespace-nowrap shadow-apple-md transition-all ${
                    isSelected ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-2 scale-95 group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100 pointer-events-none'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${h.status === 'damaged' ? 'bg-danger animate-pulse' : 'bg-warn'}`} />
                      {h.label}
                    </div>
                  </div>
                </div>
              </Html>
            );
          })}

          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/trucks/Refridge-Truck.glb');
