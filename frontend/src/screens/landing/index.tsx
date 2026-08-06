'use client';

import React from 'react';
import Hero from './ui/Hero';
import StatsBand from './ui/StatsBand';
import Capabilities from './ui/Capabilities';
import FleetDayScrubber from './ui/FleetDayScrubber';
import IntegrationFlow from './ui/IntegrationFlow';
import HowItWorks from './ui/HowItWorks';
import Cta from './ui/Cta';

/**
 * Порядок секцій — це і є сценарій сторінки: обіцянка (Hero) → масштаб
 * (StatsBand) → що вміє (Capabilities) → як це виглядає в роботі
 * (FleetDayScrubber) → чому це працює (IntegrationFlow, HowItWorks) → дія.
 */
export default function LandingScreen() {
  return (
    <>
      <Hero />
      <StatsBand />
      <Capabilities />
      <FleetDayScrubber />
      <IntegrationFlow />
      <HowItWorks />
      <Cta />
    </>
  );
}
