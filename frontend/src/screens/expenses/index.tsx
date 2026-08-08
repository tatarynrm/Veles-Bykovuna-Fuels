'use client';

import React from 'react';
import ExpensesHero from './ui/ExpensesHero';
import TripScene from './ui/TripScene';
import NormalizationBand from './ui/NormalizationBand';
import PlatformGrid from './ui/PlatformGrid';
import ExpensesCta from './ui/ExpensesCta';

/**
 * Порядок секцій — це сценарій сторінки, і він побудований навколо одного
 * рейсу: обіцянка (Hero) → рейс туди й назад, тобто витрати та дані, які з
 * них виходять (TripScene) → чому цифрам можна вірити (NormalizationBand) →
 * що з цього вже є в системі (PlatformGrid) → дія.
 */
export default function ExpensesScreen() {
  return (
    <>
      <ExpensesHero />
      <TripScene />
      <NormalizationBand />
      <PlatformGrid />
      <ExpensesCta />
    </>
  );
}
