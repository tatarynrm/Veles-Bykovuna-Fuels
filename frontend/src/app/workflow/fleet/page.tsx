'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { AuthGate } from '@/components/PageShell';
import { useAuthGuard, signOut } from '@/lib/useAuthGuard';
import {
  Truck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wrench,
  User,
  Gauge,
  Sun,
  Moon,
  LogOut,
  Activity,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import ThemeToggleButton from '@/components/ThemeToggleButton';

const ThreeTruckViewer = dynamic(() => import('@/components/ThreeTruckViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] sm:h-[480px] lg:h-[580px] rounded-card flex flex-col items-center justify-center bg-surface-inset border border-bdr-subtle">
      <div className="w-10 h-10 border-4 border-bdr-highlight border-t-okko-emerald rounded-full animate-spin mb-3"></div>
      <p className="text-txt-secondary text-sm font-semibold font-sans">{t('diag.initialising3DCanvasEllipsis')}</p>
    </div>
  ),
});

// Complete structured list of malfunctions grouped into 5 categories
const diagnosticCategories = [
  {
    id: 'reefer_unit',
    title: 'diag.n1RefrigerationUnit',
    system: 'refrigerator',
    groups: [
      {
        subTitle: 'diag.reeferEngineDrive',
        items: [
          { id: 'reefer_engine_failure', title: 'diag.unitDieselEngineFailure', desc: 'diag.engineWillNotStart', status: 'damaged' as const, code: 'REF-ENG-101', recommendation: 'diag.diagnoseUnitSDiesel' },
          { id: 'reefer_belt_snapped', title: 'diag.driveBeltBrokenWorn2', desc: 'diag.driveBeltBrokenWorn', status: 'damaged' as const, code: 'REF-BLT-102', recommendation: 'diag.replaceDriveBeltImmediately' },
          { id: 'reefer_starter_fault', title: 'diag.reeferStarterFault', desc: 'diag.starterDoesNotTurn', status: 'warning' as const, code: 'REF-STR-103', recommendation: 'diag.repairReplaceStarterSolenoid' },
          { id: 'reefer_alternator_fault', title: 'diag.reeferAlternatorFailure', desc: 'diag.unitSBatteryNot', status: 'warning' as const, code: 'REF-ALT-104', recommendation: 'diag.replaceAlternatorVoltageRegulator' },
          { id: 'reefer_battery_dead', title: 'diag.reeferBatteryFlatFailed', desc: 'diag.batteryVoltageBelowCritical', status: 'warning' as const, code: 'REF-BAT-105', recommendation: 'diag.chargeReeferBatteryFit' },
        ]
      },
      {
        subTitle: 'diag.refrigerationCircuitRefrigerant',
        items: [
          { id: 'compressor_failure', title: 'diag.compressorSeizureFailure', desc: 'diag.criticalFaultUnitS', status: 'damaged' as const, code: 'REF-CMP-201', recommendation: 'diag.replaceRefrigerationCompressorEvacuate' },
          { id: 'freon_leak', title: 'diag.refrigerantLeak', desc: 'diag.damageLinesCondenserEvaporator', status: 'damaged' as const, code: 'REF-FRN-202', recommendation: 'diag.pressureTestSystemNitrogen' },
          { id: 'condenser_fan_broken', title: 'diag.condenserFanFailure', desc: 'diag.outdoorUnitFanDoes', status: 'damaged' as const, code: 'REF-FAN-203', recommendation: 'diag.replaceCondenserFanMotor' },
          { id: 'evaporator_fan_broken', title: 'diag.evaporatorFanFailure', desc: 'diag.fansInsideBoxNot', status: 'damaged' as const, code: 'REF-FAN-204', recommendation: 'diag.replaceImpellerInternalFan' },
          { id: 'evaporator_icing', title: 'diag.evaporatorIcingDefrostFailure', desc: 'diag.defrostSystemFault', status: 'warning' as const, code: 'REF-DEF-205', recommendation: 'diag.checkDefrostHeatersReplace' },
        ]
      },
      {
        subTitle: 'diag.reeferElectronicsFuelSystem',
        items: [
          { id: 'reefer_controller_error', title: 'diag.controlUnitDisplayFailure', desc: 'diag.communicationErrorCodeControl', status: 'warning' as const, code: 'REF-CTR-301', recommendation: 'diag.diagnoseReeferControllerCAN' },
          { id: 'temp_sensor_fault', title: 'diag.temperatureSensorFailure', desc: 'diag.returnSupplyAirSensor', status: 'warning' as const, code: 'REF-SNS-302', recommendation: 'diag.replaceBoxAirTemperature' },
          { id: 'reefer_fuel_filter_clogged', title: 'diag.reeferFuelFilterClogged', desc: 'diag.dieselPressureHasDropped', status: 'warning' as const, code: 'REF-FLT-303', recommendation: 'diag.scheduledReplacementUnitS' },
          { id: 'reefer_fuel_tank_leak', title: 'diag.reeferTankPunctureLeak', desc: 'diag.fuelLeakingBottomUnit', status: 'damaged' as const, code: 'REF-TNK-304', recommendation: 'diag.drainRemainingFuelWeld' },
        ]
      }
    ]
  },
  {
    id: 'trailer_body',
    title: 'diag.n2SemiTrailerBody',
    system: 'cabin',
    groups: [
      {
        subTitle: 'diag.sealingAndHardware',
        items: [
          { id: 'door_seal_damage', title: 'diag.doorSealDamage', desc: 'diag.wornRubberSealsCold', status: 'damaged' as const, code: 'TRL-SEL-401', recommendation: 'diag.fullReplacementRearDoor' },
          { id: 'door_latch_broken', title: 'diag.rearDoorLockFailure', desc: 'diag.rodTypeLockingMechanism', status: 'warning' as const, code: 'TRL-LTH-402', recommendation: 'diag.repairReplaceRodType' },
          { id: 'wall_panel_damage', title: 'diag.insulatedWallPunctured', desc: 'diag.damageSemiTrailerSandwich', status: 'warning' as const, code: 'TRL-WAL-403', recommendation: 'diag.sealHolesExpandingFoam' },
          { id: 'roof_leak', title: 'diag.boxRoofDamageLeak', desc: 'diag.moistureLeakingThroughRoof', status: 'warning' as const, code: 'TRL-ROF-404', recommendation: 'diag.cleanTrailerRoofSeal' },
          { id: 'air_chute_detached', title: 'diag.airChuteDetached', desc: 'diag.damageCeilingAirChute', status: 'warning' as const, code: 'TRL-CHT-405', recommendation: 'diag.refastenReplaceFlexibleAir' },
          { id: 'drain_hole_clogged', title: 'diag.drainHolesBlocked', desc: 'diag.iceDirtFloorDrains', status: 'warning' as const, code: 'TRL-DRN-406', recommendation: 'diag.mechanicallyClearDrainValves' },
          { id: 'floor_damage', title: 'diag.aluminiumFloorDamage', desc: 'diag.reeferTFloorHas', status: 'warning' as const, code: 'TRL-FLR-407', recommendation: 'diag.straightenAluminiumProfileTIG' },
        ]
      }
    ]
  },
  {
    id: 'trailer_chassis',
    title: 'diag.n3TrailerRunningGear',
    system: 'wheels',
    groups: [
      {
        subTitle: 'diag.axlesSuspensionBrakes',
        items: [
          { id: 'tire_blowout', title: 'diag.trailerTyreBlowoutPuncture', desc: 'diag.pressureLossMiddleAxle', status: 'damaged' as const, code: 'TRL-TIR-501', recommendation: 'diag.fitSpareWheelReplace' },
          { id: 'tire_wear_uneven', title: 'diag.unevenTreadWear', desc: 'diag.shoulderWearCausedAxle', status: 'warning' as const, code: 'TRL-TIR-502', recommendation: 'diag.haveSemiTrailerAxle' },
          { id: 'brake_pad_wear', title: 'diag.brakePadsWearLimit', desc: 'diag.frictionLiningThicknessBelow', status: 'warning' as const, code: 'TRL-BRK-503', recommendation: 'diag.replaceBrakePadsWear' },
          { id: 'air_bag_puncture', title: 'diag.trailerAirSpringPuncture', desc: 'diag.airEscapingRubberSuspension', status: 'damaged' as const, code: 'TRL-PNE-504', recommendation: 'diag.replaceSemiTrailerAir' },
          { id: 'brake_air_line_leak', title: 'diag.airLeakBrakeHoses', desc: 'diag.damageFlexibleConnectingTubes', status: 'damaged' as const, code: 'TRL-AIR-505', recommendation: 'diag.replaceDamagedSectionQuick' },
          { id: 'wheel_bearing_overheat', title: 'diag.hubBearingOverheating', desc: 'diag.hubGreaseHasBroken', status: 'damaged' as const, code: 'TRL-BRG-506', recommendation: 'diag.replaceHubBearingTogether' },
          { id: 'landing_gear_broken', title: 'diag.semiTrailerLandingLeg', desc: 'diag.damageLandingGearGearbox', status: 'warning' as const, code: 'TRL-LND-507', recommendation: 'diag.repairJOSTLandingGear' },
          { id: 'kingpin_damage', title: 'diag.kingpinWearDamage', desc: 'diag.criticalPlayFifthWheel', status: 'warning' as const, code: 'TRL-PIN-508', recommendation: 'diag.measureKingpinWear2' },
        ]
      }
    ]
  },
  {
    id: 'truck_tractor',
    title: 'diag.n4TruckTractor',
    system: 'engine',
    groups: [
      {
        subTitle: 'diag.tractorEngineDrivetrain',
        items: [
          { id: 'engine_overheat', title: 'diag.tractorEngineOverheating', desc: 'diag.criticalCoolantTemperatureAntifreeze', status: 'damaged' as const, code: 'TRK-ENG-601', recommendation: 'diag.checkWaterPumpRadiator' },
          { id: 'engine_oil_leak', title: 'diag.engineOilLeak', desc: 'diag.leakUnderValveCover', status: 'damaged' as const, code: 'TRK-OIL-602', recommendation: 'diag.replaceEngineGasketsClean' },
          { id: 'turbo_failure', title: 'diag.tractorTurbochargerFailure', desc: 'diag.lossEnginePowerGrey', status: 'damaged' as const, code: 'TRK-TRB-603', recommendation: 'diag.removeOverhaulTurboReplace' },
          { id: 'transmission_fault', title: 'diag.gearboxFault', desc: 'diag.shiftFaultsIShift', status: 'warning' as const, code: 'TRK-TRN-604', recommendation: 'diag.computerDiagnosisGearboxECU' },
          { id: 'driveshaft_issue', title: 'diag.universalJointPropshaftWear', desc: 'diag.vibrationWhenDrivingUnder', status: 'warning' as const, code: 'TRK-DRV-605', recommendation: 'diag.replaceUniversalJointPropshaft' },
        ]
      },
      {
        subTitle: 'diag.tractorElectricsPneumatics',
        items: [
          { id: 'main_battery_dead', title: 'diag.tractorBatteriesFlat', desc: 'diag.boardVoltageBelow22', status: 'warning' as const, code: 'TRK-BAT-606', recommendation: 'diag.chargeReplaceStarterBatteries' },
          { id: 'truck_alternator_fault', title: 'diag.tractorAlternatorFault', desc: 'diag.batteryChargeWarningDashboard', status: 'warning' as const, code: 'TRK-ALT-607', recommendation: 'diag.repairReplaceTractorAlternator' },
          { id: 'air_compressor_failure', title: 'diag.tractorAirCompressorFailure', desc: 'diag.systemReservoirsFillAir', status: 'warning' as const, code: 'TRK-CMP-608', recommendation: 'diag.replaceCompressorPistonRings' },
          { id: 'gladhand_leak', title: 'diag.leakCouplingHeads', desc: 'diag.airEscapingThroughGladhand', status: 'damaged' as const, code: 'TRK-GLD-609', recommendation: 'diag.replaceRubberSealsGladhands' },
          { id: 'seven_way_cable_damage', title: 'diag.n7CoreCableDamage', desc: 'diag.lightingABSSignalsDropping', status: 'warning' as const, code: 'TRK-CBL-610', recommendation: 'diag.replaceRepairDamaged24' },
        ]
      },
      {
        subTitle: 'diag.emissionsAndExhaust',
        items: [
          { id: 'dpf_clogged', title: 'diag.dpfSootFilterClogged', desc: 'diag.sootLoadingAbove85', status: 'warning' as const, code: 'TRK-DPF-611', recommendation: 'diag.runForcedRegenerationHave' },
          { id: 'egr_valve_fault', title: 'diag.egrValveFailure', desc: 'diag.egrValvePositionSensor', status: 'warning' as const, code: 'TRK-EGR-612', recommendation: 'diag.decokeEGRValveReplace' },
          { id: 'def_adblue_leak', title: 'diag.adblueSystemLeakFault', desc: 'diag.scrSystemErrorUrea', status: 'warning' as const, code: 'TRK-DEF-613', recommendation: 'diag.flushAdblueInjectorCheck' },
        ]
      }
    ]
  },
  {
    id: 'optics_equipment',
    title: 'diag.n5LightingAuxiliaryEquipment',
    system: 'lights',
    groups: [
      {
        subTitle: 'diag.lightingSafetySensors',
        items: [
          { id: 'tail_light_broken', title: 'diag.trailerRearLightsNot', desc: 'diag.powerFailureBrokenLamp', status: 'damaged' as const, code: 'EQP-LGT-701', recommendation: 'diag.replaceBulbsLEDModule' },
          { id: 'side_marker_fault', title: 'diag.sideMarkerLightFailure', desc: 'diag.noPowerTrailerMarker', status: 'warning' as const, code: 'EQP-LGT-702', recommendation: 'diag.traceWiringBreakAlong' },
          { id: 'abs_sensor_fault', title: 'diag.trailerABSSensorFailure', desc: 'diag.trailerABSLightDashboard', status: 'warning' as const, code: 'EQP-ABS-703', recommendation: 'diag.cleanABSSensorAdjust' },
          { id: 'tpms_sensor_fault', title: 'diag.tpmsPressureSensorFault', desc: 'diag.noSignalTrailerWheel', status: 'warning' as const, code: 'EQP-TPM-704', recommendation: 'diag.replaceBatteryFitNew' },
        ]
      }
    ]
  }
];

// Initial Wheels Configuration Data
const initialWheelsData: Record<string, WheelInfo[]> = {
  'volvo-reefer-damaged': [
    { id: 'FL', name: 'FL', positionName: 'diag.frontLeftTractorSteering', pressure: 8.5, temperature: 45, treadWear: 75, lastReplacement: '15.06.2025', mileageSinceReplacement: 45000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'diag.frontRightTractorSteering', pressure: 8.4, temperature: 46, treadWear: 72, lastReplacement: '15.06.2025', mileageSinceReplacement: 45000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'diag.rearLeftTractorDrive', pressure: 8.6, temperature: 52, treadWear: 55, lastReplacement: '10.11.2024', mileageSinceReplacement: 95000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'diag.rearRightTractorDrive', pressure: 8.6, temperature: 53, treadWear: 53, lastReplacement: '10.11.2024', mileageSinceReplacement: 95000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'diag.firstLeftTrailerAxle', pressure: 8.5, temperature: 40, treadWear: 68, lastReplacement: '20.01.2025', mileageSinceReplacement: 62000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'diag.firstRightTrailerAxle', pressure: 4.8, temperature: 85, treadWear: 12, lastReplacement: '14.05.2023', mileageSinceReplacement: 165000, status: 'damaged' }, // Damaged tire
    { id: 'T2L', name: 'T2L', positionName: 'diag.secondLeftTrailerAxle', pressure: 8.7, temperature: 42, treadWear: 64, lastReplacement: '20.01.2025', mileageSinceReplacement: 62000, status: 'ok' },
    { id: 'T2R', name: 'T2R', positionName: 'diag.secondRightTrailerAxle', pressure: 8.6, temperature: 41, treadWear: 62, lastReplacement: '20.01.2025', mileageSinceReplacement: 62000, status: 'ok' },
    { id: 'T3L', name: 'T3L', positionName: 'diag.thirdLeftTrailerAxle', pressure: 8.4, temperature: 44, treadWear: 42, lastReplacement: '12.04.2024', mileageSinceReplacement: 122000, status: 'warning' }, // Warning tire
    { id: 'T3R', name: 'T3R', positionName: 'diag.thirdRightTrailerAxle', pressure: 8.5, temperature: 43, treadWear: 40, lastReplacement: '12.04.2024', mileageSinceReplacement: 122000, status: 'warning' }, // Warning tire
  ],
  'scania-reefer-warning': [
    { id: 'FL', name: 'FL', positionName: 'diag.frontLeftTractorSteering', pressure: 8.6, temperature: 38, treadWear: 88, lastReplacement: '10.09.2025', mileageSinceReplacement: 12000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'diag.frontRightTractorSteering', pressure: 8.6, temperature: 39, treadWear: 86, lastReplacement: '10.09.2025', mileageSinceReplacement: 12000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'diag.rearLeftTractorDrive', pressure: 8.5, temperature: 42, treadWear: 70, lastReplacement: '01.03.2025', mileageSinceReplacement: 52000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'diag.rearRightTractorDrive', pressure: 8.5, temperature: 43, treadWear: 68, lastReplacement: '01.03.2025', mileageSinceReplacement: 52000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'diag.firstLeftTrailerAxle', pressure: 8.4, temperature: 36, treadWear: 74, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'diag.firstRightTrailerAxle', pressure: 8.4, temperature: 37, treadWear: 72, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
    { id: 'T2L', name: 'T2L', positionName: 'diag.secondLeftTrailerAxle', pressure: 8.5, temperature: 38, treadWear: 35, lastReplacement: '18.02.2024', mileageSinceReplacement: 128000, status: 'warning' },
    { id: 'T2R', name: 'T2R', positionName: 'diag.secondRightTrailerAxle', pressure: 8.5, temperature: 38, treadWear: 33, lastReplacement: '18.02.2024', mileageSinceReplacement: 128000, status: 'warning' },
    { id: 'T3L', name: 'T3L', positionName: 'diag.thirdLeftTrailerAxle', pressure: 8.6, temperature: 36, treadWear: 76, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
    { id: 'T3R', name: 'T3R', positionName: 'diag.thirdRightTrailerAxle', pressure: 8.6, temperature: 35, treadWear: 75, lastReplacement: '15.05.2025', mileageSinceReplacement: 38000, status: 'ok' },
  ],
  'daf-reefer-ok': [
    { id: 'FL', name: 'FL', positionName: 'diag.frontLeftTractorSteering', pressure: 8.6, temperature: 34, treadWear: 95, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'diag.frontRightTractorSteering', pressure: 8.6, temperature: 35, treadWear: 94, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'diag.rearLeftTractorDrive', pressure: 8.5, temperature: 38, treadWear: 90, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'diag.rearRightTractorDrive', pressure: 8.5, temperature: 37, treadWear: 89, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'diag.firstLeftTrailerAxle', pressure: 8.6, temperature: 34, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'diag.firstRightTrailerAxle', pressure: 8.6, temperature: 34, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T2L', name: 'T2L', positionName: 'diag.secondLeftTrailerAxle', pressure: 8.5, temperature: 35, treadWear: 91, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T2R', name: 'T2R', positionName: 'diag.secondRightTrailerAxle', pressure: 8.5, temperature: 35, treadWear: 91, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T3L', name: 'T3L', positionName: 'diag.thirdLeftTrailerAxle', pressure: 8.6, temperature: 33, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
    { id: 'T3R', name: 'T3R', positionName: 'diag.thirdRightTrailerAxle', pressure: 8.6, temperature: 33, treadWear: 92, lastReplacement: '10.01.2026', mileageSinceReplacement: 5000, status: 'ok' },
  ],
  'man-reefer-mixed': [
    { id: 'FL', name: 'FL', positionName: 'diag.frontLeftTractorSteering', pressure: 8.5, temperature: 40, treadWear: 82, lastReplacement: '12.05.2025', mileageSinceReplacement: 24000, status: 'ok' },
    { id: 'FR', name: 'FR', positionName: 'diag.frontRightTractorSteering', pressure: 8.5, temperature: 40, treadWear: 80, lastReplacement: '12.05.2025', mileageSinceReplacement: 24000, status: 'ok' },
    { id: 'RL', name: 'RL', positionName: 'diag.rearLeftTractorDrive', pressure: 8.6, temperature: 44, treadWear: 62, lastReplacement: '18.10.2024', mileageSinceReplacement: 68000, status: 'ok' },
    { id: 'RR', name: 'RR', positionName: 'diag.rearRightTractorDrive', pressure: 8.6, temperature: 45, treadWear: 60, lastReplacement: '18.10.2024', mileageSinceReplacement: 68000, status: 'ok' },
    { id: 'T1L', name: 'T1L', positionName: 'diag.firstLeftTrailerAxle', pressure: 8.5, temperature: 38, treadWear: 72, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
    { id: 'T1R', name: 'T1R', positionName: 'diag.firstRightTrailerAxle', pressure: 8.4, temperature: 37, treadWear: 70, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
    { id: 'T2L', name: 'T2L', positionName: 'diag.secondLeftTrailerAxle', pressure: 8.5, temperature: 39, treadWear: 42, lastReplacement: '05.08.2024', mileageSinceReplacement: 84000, status: 'warning' },
    { id: 'T2R', name: 'T2R', positionName: 'diag.secondRightTrailerAxle', pressure: 8.5, temperature: 38, treadWear: 40, lastReplacement: '05.08.2024', mileageSinceReplacement: 84000, status: 'warning' },
    { id: 'T3L', name: 'T3L', positionName: 'diag.thirdLeftTrailerAxle', pressure: 8.6, temperature: 37, treadWear: 75, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
    { id: 'T3R', name: 'T3R', positionName: 'diag.thirdRightTrailerAxle', pressure: 8.6, temperature: 37, treadWear: 73, lastReplacement: '10.03.2025', mileageSinceReplacement: 42000, status: 'ok' },
  ],
};

interface WheelInfo {
  id: string;
  name: string;
  positionName: string;
  pressure: number;
  temperature: number;
  treadWear: number;
  lastReplacement: string;
  mileageSinceReplacement: number;
  status: 'ok' | 'warning' | 'damaged';
}

const mockVehicles = [
  {
    id: 'volvo-reefer-damaged',
    name: 'Volvo FH16 Globetrotter Reefer',
    plate: 'CE 7749 BE',
    type: 'diag.reefer',
    status: 'damaged',
    driver: 'diag.oleksandrShevchenko',
    phone: '+380 50 123 45 67',
    mileage: 'diag.n342150Km',
    fuelConsumption: 'diag.n285L100',
    activeRoute: 'diag.chernivtsiDepotLvivWarehouse',
    temperatureSet: '-18°C',
    temperatureCurrent: '-4°C',
    activeFaultIds: [
      'reefer_engine_failure',
      'reefer_belt_snapped',
      'compressor_failure',
      'freon_leak',
      'condenser_fan_broken',
      'evaporator_fan_broken',
      'reefer_fuel_tank_leak',
      'door_seal_damage',
      'tire_blowout',
      'air_bag_puncture',
      'brake_air_line_leak',
      'wheel_bearing_overheat',
      'engine_overheat',
      'engine_oil_leak',
      'turbo_failure',
      'gladhand_leak',
      'tail_light_broken'
    ],
  },
  {
    id: 'scania-reefer-warning',
    name: 'Scania S580 Highline Reefer',
    plate: 'CE 2200 OK',
    type: 'diag.reefer',
    status: 'warning',
    driver: 'diag.mykolaKozak',
    phone: '+380 67 987 65 43',
    mileage: 'diag.n189420Km',
    fuelConsumption: 'diag.n312L100',
    activeRoute: 'diag.ternopilWarehouse2Chernivtsi',
    temperatureSet: '-20°C',
    temperatureCurrent: '-16°C',
    activeFaultIds: [
      'reefer_starter_fault',
      'reefer_alternator_fault',
      'reefer_battery_dead',
      'evaporator_icing',
      'temp_sensor_fault',
      'door_latch_broken',
      'wall_panel_damage',
      'roof_leak',
      'air_chute_detached',
      'drain_hole_clogged',
      'floor_damage',
      'tire_wear_uneven',
      'brake_pad_wear',
      'landing_gear_broken',
      'kingpin_damage',
      'main_battery_dead',
      'truck_alternator_fault',
      'air_compressor_failure',
      'seven_way_cable_damage',
      'dpf_clogged',
      'egr_valve_fault',
      'def_adblue_leak',
      'side_marker_fault',
      'abs_sensor_fault',
      'tpms_sensor_fault'
    ],
  },
  {
    id: 'daf-reefer-ok',
    name: 'DAF XF 530 Super Space Reefer',
    plate: 'diag.ce0555BB',
    type: 'diag.reefer',
    status: 'ok',
    driver: 'diag.vitaliiPetrenko',
    phone: '+380 99 444 33 22',
    mileage: 'diag.n412800Km',
    fuelConsumption: 'diag.n290L100',
    activeRoute: 'diag.kyivLogisticsCentreChernivtsi',
    temperatureSet: '-18°C',
    temperatureCurrent: '-18°C',
    activeFaultIds: [],
  },
  {
    id: 'man-reefer-mixed',
    name: 'MAN TGX 18.510 Lion\'s Reefer',
    plate: 'CE 9911 KM',
    type: 'diag.reefer',
    status: 'warning',
    driver: 'diag.dmytroKovalenko',
    phone: '+380 63 555 11 22',
    mileage: 'diag.n224100Km',
    fuelConsumption: 'diag.n274L100',
    activeRoute: 'diag.odesaPortChernivtsi',
    temperatureSet: '-22°C',
    temperatureCurrent: '-19°C',
    activeFaultIds: [
      'evaporator_icing',
      'reefer_fuel_filter_clogged',
      'wall_panel_damage',
      'brake_pad_wear',
      'dpf_clogged',
      'air_chute_detached',
      'driveshaft_issue',
      'egr_valve_fault',
      'abs_sensor_fault',
      'tpms_sensor_fault'
    ],
  }
];

export default function FleetPage() {
  const router = useRouter();
  const { authenticated } = useAuthGuard();
  const [selectedVehicle, setSelectedVehicle] = useState(mockVehicles[0]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedSubFault, setSelectedSubFault] = useState<string | null>(null);

  // Real-time wheel database state
  const [wheelsState, setWheelsState] = useState<Record<string, WheelInfo[]>>(initialWheelsData);
  const [selectedWheelId, setSelectedWheelId] = useState<string | null>(null);

  // Track expanded category IDs in the accordion layout
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    reefer_unit: true,
    trailer_body: false,
    trailer_chassis: false,
    truck_tractor: false,
    optics_equipment: false,
  });

  const handleLogout = () => {
    signOut();
    router.push('/');
  };

  const handlePartClick = (partKey: string) => {
    setSelectedPart((prev) => (prev === partKey ? null : partKey));
    setSelectedSubFault(null);
    setSelectedWheelId(null);
    
    const matchCat = diagnosticCategories.find(c => c.system === partKey);
    if (matchCat) {
      setExpandedCategories(prev => ({
        ...prev,
        [matchCat.id]: true
      }));
    }
  };

  const handleSubFaultClick = (subFaultId: string | null, systemKey: string) => {
    setSelectedSubFault(subFaultId);
    setSelectedPart(systemKey);
    setSelectedWheelId(null);
  };

  const toggleCategoryAccordion = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Get active wheels list for the selected vehicle
  const currentVehicleWheels = useMemo(() => {
    return wheelsState[selectedVehicle.id] || [];
  }, [wheelsState, selectedVehicle.id]);

  // Find currently selected wheel info
  const selectedWheel = useMemo(() => {
    if (!selectedWheelId) return null;
    return currentVehicleWheels.find(w => w.id === selectedWheelId) || null;
  }, [selectedWheelId, currentVehicleWheels]);

  // Handler when clicking a wheel in the 2D schematic diagram
  const handleWheelSelect = (wheelId: string) => {
    setSelectedWheelId(wheelId);
    setSelectedPart('wheels');
    // Zoom camera directly to the clicked wheel
    setSelectedSubFault(`wheel_${wheelId}`);
  };

  // Handler to register replacement of a specific wheel
  const handleReplaceWheel = (wheelId: string) => {
    // 1. Update wheels state properties
    const todayStr = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const updatedWheels = currentVehicleWheels.map((w) => {
      if (w.id === wheelId) {
        return {
          ...w,
          pressure: 8.5,
          temperature: 35,
          treadWear: 100,
          mileageSinceReplacement: 0,
          lastReplacement: todayStr,
          status: 'ok' as const,
        };
      }
      return w;
    });

    setWheelsState(prev => ({
      ...prev,
      [selectedVehicle.id]: updatedWheels
    }));

    // 2. Clear faults from vehicle activeFaultIds dynamically
    const dynamicFaultIds = [...selectedVehicle.activeFaultIds];
    
    if (wheelId === 'T1R') {
      const idxTire = dynamicFaultIds.indexOf('tire_blowout');
      if (idxTire !== -1) dynamicFaultIds.splice(idxTire, 1);
      
      const idxBrg = dynamicFaultIds.indexOf('wheel_bearing_overheat');
      if (idxBrg !== -1) dynamicFaultIds.splice(idxBrg, 1);
    }
    
    // Check if there are any warning wheels left on the vehicle
    const remainingWarnings = updatedWheels.filter(w => w.status === 'warning');
    if (remainingWarnings.length === 0) {
      const idxWear = dynamicFaultIds.indexOf('tire_wear_uneven');
      if (idxWear !== -1) dynamicFaultIds.splice(idxWear, 1);

      const idxBrake = dynamicFaultIds.indexOf('brake_pad_wear');
      if (idxBrake !== -1) dynamicFaultIds.splice(idxBrake, 1);
    }

    const remainingDamaged = updatedWheels.filter(w => w.status === 'damaged');
    if (remainingDamaged.length === 0) {
      const idxBlow = dynamicFaultIds.indexOf('tire_blowout');
      if (idxBlow !== -1) dynamicFaultIds.splice(idxBlow, 1);
    }

    // Update selected vehicle properties in memory
    const updatedVehicle = {
      ...selectedVehicle,
      activeFaultIds: dynamicFaultIds,
      status: dynamicFaultIds.includes('reefer_engine_failure') || dynamicFaultIds.includes('compressor_failure') || dynamicFaultIds.includes('freon_leak') || remainingDamaged.length > 0 ? 'damaged' as const : dynamicFaultIds.length > 0 || remainingWarnings.length > 0 ? 'warning' as const : 'ok' as const
    };

    setSelectedVehicle(updatedVehicle);
    
    // Update the master mockVehicles array entry so state is preserved when switching back and forth
    const idxInMock = mockVehicles.findIndex(v => v.id === selectedVehicle.id);
    if (idxInMock !== -1) {
      mockVehicles[idxInMock] = updatedVehicle;
    }
  };

  // Compute 3D model part glow statuses dynamically based on selected vehicle's activeFaultIds and wheels
  const partStatuses = useMemo(() => {
    const statuses: Record<string, 'ok' | 'warning' | 'damaged'> = {
      refrigerator: 'ok',
      cabin: 'ok',
      wheels: 'ok',
      engine: 'ok',
      lights: 'ok',
    };

    // Evaluate active faults
    selectedVehicle.activeFaultIds.forEach((faultId) => {
      diagnosticCategories.forEach((cat) => {
        cat.groups.forEach((g) => {
          const item = g.items.find(i => i.id === faultId);
          if (item) {
            const current = statuses[cat.system];
            if (item.status === 'damaged') {
              statuses[cat.system] = 'damaged';
            } else if (item.status === 'warning' && current !== 'damaged') {
              statuses[cat.system] = 'warning';
            }
          }
        });
      });
    });

    // Evaluate wheels statuses
    currentVehicleWheels.forEach((wheel) => {
      const current = statuses.wheels;
      if (wheel.status === 'damaged') {
        statuses.wheels = 'damaged';
      } else if (wheel.status === 'warning' && current !== 'damaged') {
        statuses.wheels = 'warning';
      }
    });

    return statuses;
  }, [selectedVehicle, currentVehicleWheels]);

  // Find currently active sub-fault details to display recommendations
  const activeSubFaultData = useMemo(() => {
    if (!selectedSubFault) return null;
    for (const cat of diagnosticCategories) {
      for (const group of cat.groups) {
        const match = group.items.find(item => item.id === selectedSubFault);
        if (match) return match;
      }
    }
    return null;
  }, [selectedSubFault]);

  // Helper to get CSS classes for wheel status representation
  const getWheelColorClass = (wheelId: string) => {
    const wheel = currentVehicleWheels.find(w => w.id === wheelId);
    const isSelected = selectedWheelId === wheelId;
    const ringStyle = isSelected ? 'ring-2 ring-white scale-110 shadow-apple-sm' : 'hover:scale-105';
    
    if (!wheel) return `bg-surface-hover border-bdr-subtle ${ringStyle}`;
    if (wheel.status === 'damaged') return `bg-danger hover:bg-danger border-danger/30 animate-pulse ${ringStyle}`;
    if (wheel.status === 'warning') return `bg-warn hover:bg-warn border-warn/30 ${ringStyle}`;
    return `bg-accent hover:bg-accent border-bdr-highlight ${ringStyle}`;
  };

  if (!authenticated) return <AuthGate />;

  return (
    <div className="flex min-h-screen w-full bg-page overflow-hidden text-txt-secondary">
      <Sidebar />

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-bdr-subtle bg-glass px-4 py-3 backdrop-blur-chrome sm:px-6">
          <div className="min-w-0 flex-1 pl-12 lg:pl-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-txt-primary sm:text-lg">
              {t('diag.fleetMonitoringInspection')}
            </h1>
            <p className="mt-0.5 truncate text-2xs text-txt-muted">
              {t('diag.interactive3DConditionMonitoring')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <button
              onClick={handleLogout}
              className="btn-icon hover:text-danger"
              title={t('common.signOut')}
              aria-label={t('common.signOut')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* 3-Column Interactive Layout */}
        <div className="px-3 sm:px-5 lg:px-8 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
            
            {/* ══════════════════════════════════════════
                КОЛОНКА 1 (lg:col-span-3) — Список транспорту
            ══════════════════════════════════════════ */}
            <div className="lg:col-span-3 space-y-4">
              <div className="glass-card rounded-card overflow-hidden border border-bdr-subtle">
                <div className="flex items-center justify-between px-4 py-3 border-b border-bdr-subtle bg-surface-inset">
                  <h3 className="font-semibold text-xs text-txt-secondary tracking-wider uppercase flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-accent" /> {t('diag.reefers')}
                  </h3>
                  <span className="bg-surface-inset border border-bdr-subtle text-[9px] px-2 py-0.5 rounded-full font-bold text-txt-secondary">
                    {mockVehicles.length} {t('diag.units')}
                  </span>
                </div>
                
                <div className="p-3 space-y-2.5 max-h-[480px] overflow-y-auto">
                  {mockVehicles.map((vehicle) => {
                    const isSelected = selectedVehicle.id === vehicle.id;
                    
                    // Count issues
                    const wheels = wheelsState[vehicle.id] || [];
                    const activeTireIssues = wheels.filter(w => w.status !== 'ok').length;
                    const totalFaultsCount = vehicle.activeFaultIds.length + activeTireIssues;

                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => {
                          setSelectedVehicle(vehicle);
                          setSelectedPart(null);
                          setSelectedSubFault(null);
                          setSelectedWheelId(null);
                        }}
                        className={`p-3.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                          isSelected
                            ? 'bg-accent/10 border-bdr-highlight shadow-md shadow-okko-green/5'
                            : 'bg-surface-inset border-bdr-subtle hover:border-bdr-strong hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-txt-primary">{t(vehicle.plate)}</span>
                              <span className="bg-surface-inset border border-bdr-subtle text-[8px] text-txt-secondary font-bold px-1.5 py-0.5 rounded">
                                {t(vehicle.type)}
                              </span>
                            </div>
                            <h4 className="text-[10px] text-txt-secondary font-semibold mt-1 truncate">{vehicle.name}</h4>
                          </div>
                          <span className="flex-shrink-0 ml-2">
                            {vehicle.status === 'damaged' || totalFaultsCount > 10 ? (
                              <XCircle className="w-4 h-4 text-okko-red animate-pulse" />
                            ) : totalFaultsCount > 0 ? (
                              <AlertTriangle className="w-4 h-4 text-okko-accent" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-accent" />
                            )}
                          </span>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-bdr-subtle flex items-center justify-between text-[9px] text-txt-secondary font-semibold gap-2">
                          <span className="flex items-center gap-1 min-w-0 truncate">
                            <User className="w-2.5 h-2.5 text-txt-muted flex-shrink-0" /> {t(vehicle.driver)}
                          </span>
                          <span className="flex items-center gap-1 font-mono flex-shrink-0">
                            <Gauge className="w-2.5 h-2.5 text-txt-muted" /> {t(vehicle.mileage)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Стан автопарку */}
              <div className="glass-card p-4 rounded-card border border-bdr-subtle">
                <h4 className="font-bold text-[10px] text-txt-secondary tracking-wider uppercase mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-accent" /> {t('diag.reeferQuickStatus')}
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">{t('diag.activeReefersColon')}</span>
                    <span className="text-txt-primary font-bold">{mockVehicles.length}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">{t('diag.healthyOKColon')}</span>
                    <span className="text-accent font-bold">1</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">{t('diag.partialWarningsColon')}</span>
                    <span className="text-okko-accent font-bold">2</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-txt-secondary">{t('diag.criticalFaultColon')}</span>
                    <span className="text-okko-red font-bold">1</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════
                КОЛОНКА 2 (lg:col-span-4) — Список проблем чи все ок
            ══════════════════════════════════════════ */}
            <div className="lg:col-span-4 space-y-4">
              <div className="glass-card p-4 sm:p-5 rounded-card border border-bdr-subtle">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-bdr-subtle">
                  <h3 className="font-semibold text-xs text-txt-secondary tracking-wider uppercase flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-accent" /> {t('diag.faultMap')}
                  </h3>
                  <span className="text-[10px] text-txt-secondary font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-accent" /> OBD-II
                  </span>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {selectedVehicle.activeFaultIds.length > 0 || currentVehicleWheels.some(w => w.status !== 'ok') ? (
                    diagnosticCategories.map((cat) => {
                      const isExpanded = expandedCategories[cat.id];
                      
                      // Count active faults in this category
                      const activeInCat = cat.groups.flatMap(g => g.items).filter(i => selectedVehicle.activeFaultIds.includes(i.id));
                      const activeTiresInCat = cat.id === 'trailer_chassis' ? currentVehicleWheels.filter(w => w.status !== 'ok').length : 0;
                      const totalActive = activeInCat.length + activeTiresInCat;
                      
                      if (totalActive === 0) return null;

                      return (
                        <div key={cat.id} className="border border-bdr-subtle rounded-xl overflow-hidden bg-surface-inset">
                          {/* Accordion Header */}
                          <button
                            onClick={() => toggleCategoryAccordion(cat.id)}
                            className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-inset hover:bg-surface-inset transition-colors text-left"
                          >
                            <span className="text-[11px] font-semibold text-txt-primary tracking-wide uppercase flex items-center gap-2">
                              {t(cat.title)}
                              <span className="bg-danger/20 text-okko-red text-[9px] px-1.5 py-0.5 rounded font-semibold">
                                {totalActive}
                              </span>
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-txt-secondary" /> : <ChevronDown className="w-3.5 h-3.5 text-txt-secondary" />}
                          </button>

                          {/* Accordion Content */}
                          {isExpanded && (
                            <div className="p-2.5 space-y-3.5 bg-surface-inset border-t border-bdr-subtle fade-in">
                              
                              {/* ══════════════════════════════════════════
                                  HIGH FIDELITY INTERACTIVE WHEEL SCHEMATIC
                              ══════════════════════════════════════════ */}
                              {cat.id === 'trailer_chassis' && (
                                <div className="p-1 space-y-2 border-b border-bdr-subtle pb-3">
                                  <span className="text-[9px] text-accent font-semibold uppercase tracking-widest block mb-2">
                                    {t('diag.interactiveWheelDiagram')}
                                  </span>
                                  
                                  <div className="grid grid-cols-12 gap-3 items-center bg-surface-inset p-2 rounded-lg border border-bdr-subtle">
                                    {/* Visual Schematic Layout - Absolute Positioning over Vector Truck outline */}
                                    <div className="col-span-6 flex items-center justify-center py-2 pr-1 border-r border-bdr-subtle">
                                      <div className="relative w-[120px] h-[280px] flex-shrink-0 select-none bg-surface-inset rounded-xl border border-bdr-subtle p-2">
                                        
                                        {/* SVG top-down truck blueprint outline */}
                                        <svg className="absolute inset-0 w-full h-full text-bdr-strong pointer-events-none" viewBox="0 0 120 280" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          {/* Tractor Cab Contour (Narrower steer front) */}
                                          <path d="M22 15 C22 10, 98 10, 98 15 L94 55 C94 58, 26 58, 26 55 Z" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3"/>
                                          {/* Kingpin / Fifth Wheel hitch circle */}
                                          <circle cx="60" cy="98" r="8" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
                                          {/* Connection lines */}
                                          <line x1="60" y1="55" x2="60" y2="90" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                                          
                                          {/* Trailer Chassis Frame (Wider box - x from 8 to 112) */}
                                          <rect x="8" y="75" width="104" height="195" rx="6" stroke="currentColor" strokeWidth="1.5" />
                                          
                                          {/* Reefer Cooling unit mounted on front wall of trailer */}
                                          <rect x="35" y="65" width="50" height="10" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1" />
                                        </svg>

                                        {/* Front Steer Axle (Steer tires inside cab width boundary) */}
                                        <button 
                                          onClick={() => handleWheelSelect('FL')}
                                          style={{ left: '10px', top: '22px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('FL')}`}
                                          title={t('diag.frontLeftSteering')}
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('FR')}
                                          style={{ right: '10px', top: '22px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('FR')}`}
                                          title={t('diag.frontRightSteering')}
                                        />

                                        {/* Tractor Rear Drive Axle (Twin/Dual tires on each side) */}
                                        {/* RL Duals */}
                                        <button 
                                          onClick={() => handleWheelSelect('RL')}
                                          style={{ left: '8px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RL')}`}
                                          title={t('diag.rearLeftOuterDrive')}
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('RL')}
                                          style={{ left: '17px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RL')}`}
                                          title={t('diag.rearLeftInnerDrive')}
                                        />

                                        {/* RR Duals */}
                                        <button 
                                          onClick={() => handleWheelSelect('RR')}
                                          style={{ right: '17px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RR')}`}
                                          title={t('diag.rearRightInnerDrive')}
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('RR')}
                                          style={{ right: '8px', top: '88px', width: '7px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('RR')}`}
                                          title={t('diag.rearRightOuterDrive')}
                                        />

                                        {/* Trailer Axle 1 (Sticks out at the very edge of the trailer box width) */}
                                        <button 
                                          onClick={() => handleWheelSelect('T1L')}
                                          style={{ left: '2px', top: '165px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T1L')}`}
                                          title={t('diag.trailer1Left')}
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('T1R')}
                                          style={{ right: '2px', top: '165px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T1R')}`}
                                          title={t('diag.trailer1Right')}
                                        />

                                        {/* Trailer Axle 2 */}
                                        <button 
                                          onClick={() => handleWheelSelect('T2L')}
                                          style={{ left: '2px', top: '195px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T2L')}`}
                                          title={t('diag.trailer2Left')}
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('T2R')}
                                          style={{ right: '2px', top: '195px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T2R')}`}
                                          title={t('diag.trailer2Right')}
                                        />

                                        {/* Trailer Axle 3 */}
                                        <button 
                                          onClick={() => handleWheelSelect('T3L')}
                                          style={{ left: '2px', top: '225px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T3L')}`}
                                          title={t('diag.trailer3Left')}
                                        />
                                        <button 
                                          onClick={() => handleWheelSelect('T3R')}
                                          style={{ right: '2px', top: '225px', width: '9px', height: '22px' }}
                                          className={`absolute rounded-[2px] transition-all border ${getWheelColorClass('T3R')}`}
                                          title={t('diag.trailer3Right')}
                                        />
                                      </div>
                                    </div>

                                    {/* Selected Wheel Details panel */}
                                    <div className="col-span-6 text-left space-y-1.5 min-h-[140px] flex flex-col justify-center">
                                      {selectedWheel ? (
                                        <div className="space-y-1.5 fade-in">
                                          <div className="flex items-center justify-between">
                                            <span className="font-semibold text-[10px] text-txt-primary">
                                              {t('diag.wheel')} {selectedWheel.id}
                                            </span>
                                            <span className={`text-[7px] font-semibold px-1 py-0.5 rounded-full uppercase ${
                                              selectedWheel.status === 'damaged' ? 'bg-danger/10 text-okko-red border border-okko-red/25 animate-pulse' :
                                              selectedWheel.status === 'warning' ? 'bg-warn/10 text-okko-accent border border-okko-accent/25' :
                                              'bg-accent/10 text-accent border border-bdr-highlight'
                                            }`}>
                                              {selectedWheel.status === 'damaged' ? t('diag.fault') : selectedWheel.status === 'warning' ? t('diag.wear') : t('diag.normal')}
                                            </span>
                                          </div>
                                          <p className="text-[8px] text-txt-secondary font-semibold leading-tight">{t(selectedWheel.positionName)}</p>
                                          
                                          <div className="grid grid-cols-2 gap-1 text-[9px]">
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">{t('diag.pressure')}</span>
                                              <span className={`font-mono font-bold ${selectedWheel.pressure < 6.0 ? 'text-okko-red animate-pulse' : 'text-txt-primary'}`}>{selectedWheel.pressure} {t('diag.bar')}</span>
                                            </div>
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">{t('diag.temp')}</span>
                                              <span className={`font-mono font-bold ${selectedWheel.temperature > 70 ? 'text-okko-red' : 'text-txt-primary'}`}>{selectedWheel.temperature}°C</span>
                                            </div>
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">{t('diag.tread')}</span>
                                              <span className={`font-mono font-bold ${selectedWheel.treadWear < 20 ? 'text-okko-red' : selectedWheel.treadWear < 45 ? 'text-okko-accent' : 'text-txt-primary'}`}>{selectedWheel.treadWear}{t('diag.remaining')}</span>
                                            </div>
                                            <div className="bg-surface-inset p-1 rounded border border-bdr-subtle">
                                              <span className="text-txt-muted block text-[7px] font-bold">{t('diag.tyreMileage')}</span>
                                              <span className="font-mono font-bold text-txt-primary">{selectedWheel.mileageSinceReplacement.toLocaleString()} {t('common.km')}</span>
                                            </div>
                                          </div>
                                          
                                          <div className="pt-1.5 text-[8px] text-txt-secondary flex flex-wrap items-center justify-between gap-1 border-t border-bdr-subtle">
                                            <span>{t('diag.replacedColon')} {selectedWheel.lastReplacement}</span>
                                            {selectedWheel.status !== 'ok' && (
                                              <button
                                                onClick={() => handleReplaceWheel(selectedWheel.id)}
                                                className="px-2 py-0.5 rounded bg-accent/20 hover:bg-accent text-[8px] font-semibold uppercase text-accent hover:text-txt-primary border border-bdr-highlight hover:border-bdr-highlight transition-all active:scale-95"
                                              >
                                                {t('diag.replace')}
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-6 text-txt-muted text-[9px] font-semibold flex flex-col items-center gap-1">
                                          <Info className="w-4 h-4 text-txt-muted" />
                                          <span>{t('diag.selectTyreDiagramDiagnose')}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {cat.groups.map((group, groupIdx) => {
                                const activeInGroup = group.items.filter(i => selectedVehicle.activeFaultIds.includes(i.id));
                                if (activeInGroup.length === 0) return null;

                                return (
                                  <div key={groupIdx} className="space-y-1.5">
                                    <span className="text-[9px] text-txt-muted font-semibold uppercase tracking-wider block ml-1">
                                      {t(group.subTitle)}
                                    </span>
                                    <div className="space-y-1.5">
                                      {activeInGroup.map((item) => {
                                        const isSelected = selectedSubFault === item.id;
                                        return (
                                          <div
                                            key={item.id}
                                            onClick={() => handleSubFaultClick(item.id, cat.system)}
                                            className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                                              isSelected
                                                ? 'bg-danger/10 border-danger/30 shadow-md ring-1 ring-red-500/30'
                                                : 'bg-surface-inset border-bdr-subtle hover:border-bdr-strong hover:bg-surface-inset'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-1 mb-1">
                                              <span className="font-semibold text-[11px] text-txt-primary flex items-center gap-1.5 leading-tight">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status === 'damaged' ? 'bg-danger animate-pulse' : 'bg-warn'}`} />
                                                {t(item.title)}
                                              </span>
                                              <span className="text-[8px] font-mono text-txt-muted font-bold flex-shrink-0">{item.code}</span>
                                            </div>
                                            <p className="text-[10px] text-txt-secondary line-clamp-1">{t(item.desc)}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    /* Fully operational state */
                    <div className="p-6 rounded-xl bg-accent/5 border border-bdr-highlight text-center space-y-3.5">
                      <CheckCircle className="w-10 h-10 text-accent mx-auto shadow shadow-okko-green/10" />
                      <div>
                        <h4 className="font-bold text-xs text-txt-primary">{t('diag.allSystemsOperatingNormally')}</h4>
                        <p className="text-[10px] text-txt-secondary mt-1 leading-relaxed">
                          {t('diag.noErrorsDetectedOBD')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance recommendation */}
              <div className="glass-card p-4 rounded-card border border-bdr-subtle bg-surface-inset">
                {activeSubFaultData ? (
                  <div className="space-y-3 fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-accent font-semibold uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> {t('diag.repairRecommendation')}
                      </span>
                      <span className="text-[9px] font-mono font-bold text-txt-muted">{activeSubFaultData.code}</span>
                    </div>
                    <h4 className="text-txt-primary font-semibold text-xs">{t(activeSubFaultData.title)}</h4>
                    <p className="text-[11px] text-txt-secondary leading-relaxed">{t(activeSubFaultData.desc)}</p>
                    
                    <div className="p-3 rounded-lg bg-danger/5 border-l-4 border-okko-red text-[11px] text-txt-secondary leading-normal">
                      <strong className="text-txt-primary block mb-0.5">{t('diag.workRequiredColon')}</strong>
                      {t(activeSubFaultData.recommendation)}
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button className="okko-btn px-4 py-2 text-[9px] uppercase font-semibold tracking-wider rounded-lg text-txt-primary active:scale-95 shadow">
                        {t('diag.createWorkshopOrder')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 text-xs text-txt-secondary justify-center py-3.5 font-semibold">
                    <Info className="w-4 h-4 text-txt-muted" />
                    <span>{selectedVehicle.activeFaultIds.length > 0 ? t('diag.selectFaultListSee') : t('diag.vehicleFullyOperational')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════
                КОЛОНКА 3 (lg:col-span-5) — 3D Модель
            ══════════════════════════════════════════ */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-card p-3 sm:p-4 rounded-card w-full border border-bdr-subtle relative">
                
                {/* Title Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1">
                  <div>
                    <span className="bg-danger/10 text-okko-red border border-okko-red/20 text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full tracking-wider animate-pulse inline-flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> {t('diag.n3dDiagnostics')} {t(selectedVehicle.type)}
                    </span>
                    <h2 className="text-sm sm:text-base font-semibold text-txt-primary mt-1">
                      {selectedVehicle.name} <span className="text-txt-muted font-normal">({t(selectedVehicle.plate)})</span>
                    </h2>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPart(null);
                      setSelectedSubFault(null);
                      setSelectedWheelId(null);
                    }}
                    className={`text-[9px] font-semibold uppercase px-2.5 py-1.5 rounded-lg border transition-all ${
                      selectedPart === null && selectedSubFault === null && selectedWheelId === null
                        ? 'bg-surface-inset border-bdr-subtle text-txt-secondary cursor-default'
                        : 'bg-surface-inset hover:bg-surface-hover border-bdr-subtle text-txt-secondary active:scale-95'
                    }`}
                  >
                    {t('diag.resetTheCamera')}
                  </button>
                </div>

                {/* 3D Canvas */}
                <ThreeTruckViewer
                  selectedPart={selectedPart}
                  onPartClick={handlePartClick}
                  partStatuses={partStatuses}
                  selectedSubFault={selectedSubFault}
                  activeFaultIds={selectedVehicle.activeFaultIds}
                  onSubFaultClick={(id) => {
                    setSelectedSubFault(id);
                    if (id) {
                      // If it's a wheel target (e.g. wheel_T1R), parse and set selectedWheelId
                      if (id.startsWith('wheel_')) {
                        const wheelId = id.replace('wheel_', '');
                        setSelectedWheelId(wheelId);
                        setExpandedCategories(prev => ({ ...prev, trailer_chassis: true }));
                        setSelectedPart('wheels');
                        return;
                      }

                      for (const cat of diagnosticCategories) {
                        for (const g of cat.groups) {
                          if (g.items.some(item => item.id === id)) {
                            setExpandedCategories(prev => ({
                              ...prev,
                              [cat.id]: true
                            }));
                            setSelectedPart(cat.system);
                            return;
                          }
                        }
                      }
                    }
                  }}
                />

                {/* Help tip */}
                <div className="mt-3 p-3 rounded-xl bg-surface-inset border border-bdr-subtle text-[10px] text-txt-secondary leading-relaxed flex items-start gap-2 fade-in">
                  <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-txt-primary block mb-0.5">{t('diag.interactive3DInspectionColon')}</strong>
                    {t('diag.inspectWheelsBelowSide')}
                  </div>
                </div>
              </div>

              {/* Sensors and driver cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Driver */}
                <div className="glass-card p-4 rounded-card border border-bdr-subtle">
                  <h4 className="font-bold text-[10px] text-txt-secondary tracking-wider uppercase mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-accent" /> {t('diag.assignedDriver')}
                  </h4>
                  <div className="flex items-center gap-3 mb-3.5">
                    <div className="w-10 h-10 rounded-xl bg-surface-inset border border-bdr-subtle flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-accent/75" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-txt-primary truncate">{t(selectedVehicle.driver)}</p>
                      <p className="text-[10px] text-txt-secondary font-semibold">{selectedVehicle.phone}</p>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-bdr-subtle text-[10px] text-txt-secondary font-semibold space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-txt-muted">{t('diag.tripColon')}</span>
                      <span className="text-txt-primary font-bold truncate max-w-[140px]">{t(selectedVehicle.activeRoute)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-txt-muted">{t('diag.departureTimeColon')}</span>
                      <span className="text-txt-primary font-bold">{t('diag.today0615')}</span>
                    </div>
                  </div>
                </div>

                {/* Sensors */}
                <div className="glass-card p-4 rounded-card border border-bdr-subtle">
                  <h4 className="font-bold text-[10px] text-txt-secondary tracking-wider uppercase mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-accent" /> {t('diag.reeferSensors')}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-surface-inset border border-bdr-subtle p-2 rounded-xl text-center">
                      <span className="text-[8px] text-txt-secondary font-bold block">{t('diag.targetTemp')}</span>
                      <span className="text-txt-primary font-semibold text-xs font-mono">{selectedVehicle.temperatureSet}</span>
                    </div>
                    <div className={`p-2 rounded-xl text-center ${selectedVehicle.status === 'ok' ? 'bg-accent/5 border border-bdr-highlight' : 'bg-danger/5 border border-danger/30'}`}>
                      <span className="text-[8px] font-bold block text-txt-secondary">{t('diag.currentTemp')}</span>
                      <span className={`font-semibold text-xs font-mono ${selectedVehicle.status === 'ok' ? 'text-accent' : 'text-okko-red animate-pulse'}`}>{selectedVehicle.temperatureCurrent}</span>
                    </div>
                  </div>
                  <div className="pt-2.5 border-t border-bdr-subtle text-[10px] text-txt-secondary font-semibold space-y-1">
                    <div className="flex justify-between">
                      <span className="text-txt-muted">{t('diag.humidityColon')}</span>
                      <span className="text-txt-primary font-bold">{t('diag.n54Normal')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-txt-muted">{t('diag.fansColon')}</span>
                      <span className={`font-bold ${selectedVehicle.status === 'ok' ? 'text-accent' : 'text-okko-accent'}`}>{selectedVehicle.status === 'ok' ? t('diag.steady') : t('diag.n100Capacity')}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}